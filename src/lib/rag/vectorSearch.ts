/**
 * Vector RAG Layer — semantic search against the Pinecone resume corpus.
 * Requirements: 3.2, 3.5, 10.6, 12.6
 */

import type { RAGMatch } from '@/types';
import { RAGError } from '@/types/errors';
import { generateEmbedding } from './embeddingService';
import { PineconeClient } from './pineconeClient';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Weights applied to the top-4 matches when computing the similarity score. */
const SIMILARITY_WEIGHTS = [0.5, 0.3, 0.15, 0.05] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute a weighted similarity score from an ordered list of RAG matches.
 *
 * - Applies weights [0.5, 0.3, 0.15, 0.05] to the top-4 matches.
 * - Each match contributes `match.score * weight * 100` to the weighted sum.
 * - The result is normalised by the total weight actually used and capped at 100.
 * - Returns 0 when `matches` is empty.
 *
 * Requirements: 3.2, 3.5
 */
export function calculateCosineSimilarity(matches: RAGMatch[]): number {
  if (matches.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  const limit = Math.min(matches.length, SIMILARITY_WEIGHTS.length);
  for (let i = 0; i < limit; i++) {
    const match = matches[i]!;
    const weight = SIMILARITY_WEIGHTS[i]!;

    weightedSum += match.score * weight * 100;
    totalWeight += weight;
  }

  const normalizedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return Math.min(normalizedScore, 100);
}

// ─── VectorRAGLayer ───────────────────────────────────────────────────────────

/**
 * Wraps Pinecone vector search with embedding generation and similarity scoring.
 *
 * Accepts an optional `PineconeClient` instance for dependency injection (testing).
 * When none is provided a default client is constructed from environment variables.
 *
 * Requirements: 3.2, 3.5, 10.6, 12.6
 */
export class VectorRAGLayer {
  private readonly pineconeClient: PineconeClient;

  constructor(pineconeClient?: PineconeClient) {
    this.pineconeClient = pineconeClient ?? new PineconeClient();
  }

  /**
   * Perform a semantic search against the Pinecone resume corpus.
   *
   * 1. Generates a 384-dimensional embedding for `text` via the Hugging Face API.
   * 2. Queries Pinecone for the `topK` nearest neighbours in the `resumes` namespace.
   * 3. Matches are returned sorted by score descending (handled by PineconeClient).
   * 4. Computes a weighted similarity score from the top matches.
   *
   * Timeout handling (10 s) and retries are delegated to `PineconeClient.query()`.
   *
   * @param text  Resume text to search against the corpus (non-empty).
   * @param topK  Number of nearest neighbours to retrieve (default: 5).
   * @returns     `{ matches, similarity }` — matches sorted by score desc,
   *              similarity in range [0, 100].
   * @throws {RAGError}  Propagated from PineconeClient on query failure.
   * @throws {LLMError}  Propagated from generateEmbedding on API failure.
   */
  async semanticSearch(
    text: string,
    topK = 5,
  ): Promise<{ matches: RAGMatch[]; similarity: number }> {
    const embedding = await generateEmbedding(text);

    let matches: RAGMatch[];
    try {
      matches = await this.pineconeClient.query(embedding, 'resumes', topK);
    } catch (err) {
      if (err instanceof RAGError) throw err;
      throw new RAGError('Pinecone query failed during semantic search.', err);
    }

    const similarity = calculateCosineSimilarity(matches);
    return { matches, similarity };
  }
}
