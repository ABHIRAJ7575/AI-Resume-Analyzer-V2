/**
 * Pinecone vector database client using the native fetch API.
 * Requirements: 3.6, 10.1, 10.6
 */

import type { RAGMatch, VectorRecord } from '@/types';
import { RAGError } from '@/types/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PineconeClientConfig {
  apiKey?: string;
  indexHost?: string;
  indexName?: string;
}

interface PineconeQueryResponse {
  matches: Array<{
    id: string;
    score: number;
    metadata?: {
      resumeType?: string;
      industryTag?: string;
      qualityRating?: number;
      text?: string;
    };
  }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
const REQUEST_TIMEOUT_MS = 10_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── PineconeClient ───────────────────────────────────────────────────────────

export class PineconeClient {
  private readonly apiKey: string;
  private readonly indexHost: string;

  constructor(config: PineconeClientConfig = {}) {
    const apiKey = config.apiKey ?? process.env['PINECONE_API_KEY'];
    const indexName = config.indexName ?? process.env['PINECONE_INDEX_NAME'];
    const indexHost = config.indexHost;

    const resolvedHost =
      indexHost ??
      process.env['PINECONE_INDEX_HOST'] ??
      process.env['PINECONE_HOST'] ??
      (indexName ? `https://${indexName}.svc.pinecone.io` : undefined);

    console.log("🌲 Checking Keys -> Has Key:", !!process.env.PINECONE_API_KEY, "Host URL:", resolvedHost);

    if (!apiKey) {
      throw new RAGError(
        'Pinecone API key is required. Set PINECONE_API_KEY environment variable or pass apiKey in config.',
      );
    }

    if (!resolvedHost) {
      throw new RAGError(
        'Pinecone index host is required. Set PINECONE_INDEX_HOST or PINECONE_INDEX_NAME environment variable.',
      );
    }

    this.apiKey = apiKey;
    this.indexHost = resolvedHost.replace(/\/$/, ''); // strip trailing slash
  }

  /**
   * Query the Pinecone index for nearest-neighbour vectors.
   * Retries up to 3 times on 5xx errors with exponential backoff (1s/2s/4s).
   * Each attempt has a 10-second timeout (Requirement 10.6).
   */
  async query(embedding: number[], namespace: string, topK: number): Promise<RAGMatch[]> {
    const url = `${this.indexHost}/query`;
    const body = JSON.stringify({
      vector: embedding,
      topK,
      namespace,
      includeMetadata: true,
      includeValues: false,
    });

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body,
        });

        if (!response.ok) {
          if (!isRetryableStatus(response.status)) {
            // 4xx and other non-retryable errors — fail immediately
            throw new RAGError(
              `Pinecone query failed with status ${response.status}: ${response.statusText}`,
            );
          }
          // 5xx — retryable
          lastError = new RAGError(
            `Pinecone query failed with status ${response.status}: ${response.statusText}`,
          );
          if (attempt < MAX_RETRIES - 1) {
            await sleep(RETRY_DELAYS_MS[attempt] ?? 1000);
          }
          continue;
        }

        const data = (await response.json()) as PineconeQueryResponse;
        return this.mapMatches(data);
      } catch (err) {
        if (err instanceof RAGError) {
          // Non-retryable RAGError — rethrow immediately
          throw err;
        }
        // Network / timeout errors are retryable
        lastError = err;
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 1000);
        }
      }
    }

    throw new RAGError('Pinecone query failed after all retries exhausted.', lastError);
  }

  /**
   * Upsert vectors into the Pinecone index.
   */
  async upsert(vectors: VectorRecord[]): Promise<void> {
    const url = `${this.indexHost}/vectors/upsert`;
    const body = JSON.stringify({ vectors });

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Api-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (err) {
      throw new RAGError('Pinecone upsert request failed.', err);
    }

    if (!response.ok) {
      throw new RAGError(
        `Pinecone upsert failed with status ${response.status}: ${response.statusText}`,
      );
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new RAGError(`Pinecone request timed out after ${REQUEST_TIMEOUT_MS}ms.`, err);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private mapMatches(data: PineconeQueryResponse): RAGMatch[] {
    return data.matches
      .map((m) => ({
        id: m.id,
        score: m.score,
        metadata: {
          resumeType: m.metadata?.resumeType ?? '',
          industryTag: m.metadata?.industryTag ?? '',
          qualityRating: m.metadata?.qualityRating ?? 0,
        },
        text: m.metadata?.text ?? '',
      }))
      .sort((a, b) => b.score - a.score);
  }
}
