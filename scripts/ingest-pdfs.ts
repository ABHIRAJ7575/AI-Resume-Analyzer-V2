/**
 * Administrative PDF Ingestion Script
 *
 * Recursively scans `scripts/resume_data/`, parses each PDF, generates a
 * 384-dimensional embedding via the Hugging Face Serverless Inference API,
 * deduplicates against Upstash Redis using SHA-256 content hashes, and
 * upserts the resulting vectors into the active Pinecone index.
 *
 * Execution (Node 22+, no build step required):
 *   node --experimental-strip-types scripts/ingest-pdfs.ts
 *
 * Required environment variables (read from .env.local):
 *   HF_API_KEY, HF_EMBEDDING_MODEL
 *   PINECONE_API_KEY, PINECONE_HOST, PINECONE_INDEX_NAME
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// @ts-expect-error - pdf-parse does not provide types for its internal files
import pdfParseRaw from 'pdf-parse/lib/pdf-parse.js';

const pdfParse = pdfParseRaw as unknown as (buffer: Buffer) => Promise<{ text: string; numpages: number }>;

// ─── Environment Bootstrap ────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnv(): void {
  const envPath = join(ROOT, '.env.local');
  let raw: string;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    console.warn('[env] .env.local not found — relying on process.env');
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ─── Configuration ────────────────────────────────────────────────────────────

interface IngestConfig {
  readonly hfApiKey: string;
  readonly hfEmbeddingModel: string;
  readonly pineconeApiKey: string;
  readonly pineconeHost: string;
  readonly upstashUrl: string;
  readonly upstashToken: string;
  readonly resumeDataDir: string;
}

function resolveConfig(): IngestConfig {
  const required: Record<string, string | undefined> = {
    HF_API_KEY: process.env['HF_API_KEY'],
    PINECONE_API_KEY: process.env['PINECONE_API_KEY'],
    PINECONE_HOST: process.env['PINECONE_HOST'],
    UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
    UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    hfApiKey: required['HF_API_KEY']!,
    hfEmbeddingModel:
      process.env['HF_EMBEDDING_MODEL'] ?? 'sentence-transformers/all-MiniLM-L6-v2',
    pineconeApiKey: required['PINECONE_API_KEY']!,
    pineconeHost: required['PINECONE_HOST']!.replace(/\/$/, ''),
    upstashUrl: required['UPSTASH_REDIS_REST_URL']!.replace(/\/$/, ''),
    upstashToken: required['UPSTASH_REDIS_REST_TOKEN']!,
    resumeDataDir: join(__dirname, 'resume_data'),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PineconeVector {
  readonly id: string;
  readonly values: number[];
  readonly metadata: PineconeMetadata;
}

interface PineconeMetadata {
  readonly role: string;
  readonly company: string;
  readonly tier: number;
  readonly textExcerpt: string;
}

interface PineconeUpsertBody {
  readonly vectors: PineconeVector[];
  readonly namespace: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function normaliseText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
    .trim();
}

// ─── File Discovery ───────────────────────────────────────────────────────────

interface PdfEntry {
  readonly filePath: string;
  readonly role: string;
}

function discoverPdfs(dataDir: string): PdfEntry[] {
  const entries: PdfEntry[] = [];

  for (const subfolder of readdirSync(dataDir)) {
    const subfolderPath = join(dataDir, subfolder);
    if (!statSync(subfolderPath).isDirectory()) continue;

    for (const file of readdirSync(subfolderPath)) {
      if (!file.toLowerCase().endsWith('.pdf')) continue;
      entries.push({ filePath: join(subfolderPath, file), role: subfolder });
    }
  }

  return entries;
}

// ─── Upstash Redis (REST API) ─────────────────────────────────────────────────

async function redisGet(
  url: string,
  token: string,
  key: string,
): Promise<string | null> {
  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { result: string | null };
  return body.result;
}

async function redisSet(
  url: string,
  token: string,
  key: string,
  value: string,
): Promise<void> {
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Hugging Face Embedding ───────────────────────────────────────────────────

const EMBEDDING_DIMENSIONS = 384;
const HF_TIMEOUT_MS = 30_000;

function meanPool(matrix: number[][]): number[] {
  if (matrix.length === 0) return [];
  const dims = matrix[0]?.length ?? 0;
  const result = new Array<number>(dims).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < dims; i++) {
      result[i] = (result[i] ?? 0) + (row[i] ?? 0);
    }
  }
  return result.map((v) => v / matrix.length);
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function normaliseEmbedding(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Hugging Face API returned an unexpected embedding shape.');
  }

  let flat: number[];

  if (typeof raw[0] === 'number') {
    flat = raw as number[];
  } else if (Array.isArray(raw[0])) {
    flat = meanPool(raw as number[][]);
  } else {
    throw new Error('Hugging Face API returned an unexpected embedding type.');
  }

  if (flat.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS}-dimensional embedding, received ${flat.length}.`,
    );
  }

  return flat.map(clamp);
}

async function generateEmbedding(
  text: string,
  apiKey: string,
  model: string,
): Promise<number[]> {
  const cleanModel = model.trim();
  const url = `https://router.huggingface.co/hf-inference/models/${cleanModel}/pipeline/feature-extraction`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') {
      throw new Error(`Hugging Face request timed out after ${HF_TIMEOUT_MS}ms.`);
    }
    throw new Error(`Hugging Face network request failed: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Hugging Face API error ${response.status}: ${response.statusText}. ${body}`.trim(),
    );
  }

  const raw: unknown = await response.json();
  return normaliseEmbedding(raw);
}

// ─── Pinecone Upsert ──────────────────────────────────────────────────────────

const PINECONE_BATCH_SIZE = 100;
const PINECONE_TIMEOUT_MS = 15_000;

async function pineconeUpsert(
  host: string,
  apiKey: string,
  vectors: PineconeVector[],
): Promise<void> {
  const body: PineconeUpsertBody = { vectors, namespace: 'resumes' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PINECONE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${host}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`Pinecone upsert network error: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Pinecone upsert failed ${response.status}: ${response.statusText}. ${text}`.trim(),
    );
  }
}

async function flushBatch(
  batch: PineconeVector[],
  host: string,
  apiKey: string,
): Promise<void> {
  if (batch.length === 0) return;
  for (let i = 0; i < batch.length; i += PINECONE_BATCH_SIZE) {
    const chunk = batch.slice(i, i + PINECONE_BATCH_SIZE);
    await pineconeUpsert(host, apiKey, chunk);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = resolveConfig();

  console.log('[ingest] Scanning:', config.resumeDataDir);
  const pdfs = discoverPdfs(config.resumeDataDir);
  console.log(`[ingest] Discovered ${pdfs.length} PDF(s) across all role subfolders.`);

  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  const batch: PineconeVector[] = [];

  for (const { filePath, role } of pdfs) {
    const label = `${role}/${filePath.split(/[\\/]/).pop() ?? filePath}`;

    let rawBuffer: Buffer;
    try {
      rawBuffer = readFileSync(filePath);
    } catch (err) {
      console.error(`[skip] Cannot read file: ${label} — ${String(err)}`);
      failed++;
      continue;
    }

    let parsedText: string;
    try {
      const result = await pdfParse(rawBuffer);
      parsedText = normaliseText(result.text ?? '');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? (err.stack ?? '') : '';
      const code = (err as NodeJS.ErrnoException).code ?? 'UNKNOWN';
      console.error(`❌ Ingestion failure for file: ${filePath}`);
      console.error(`   Code   : ${code}`);
      console.error(`   Error  : ${message}`);
      if (stack) console.error(`   Stack  :\n${stack}`);
      failed++;
      continue;
    }

    if (parsedText.length === 0) {
      console.warn(`[skip] Empty text after normalisation: ${label}`);
      skipped++;
      continue;
    }

    // SHA-256 deduplication key — idempotent across re-runs
    const contentHash = sha256Hex(parsedText);
    const redisKey = `ingest:dedup:v3:${contentHash}`;

    const cached = await redisGet(config.upstashUrl, config.upstashToken, redisKey);
    if (cached !== null) {
      console.log(`[skip] Already ingested (Redis hit): ${label}`);
      skipped++;
      continue;
    }

    let embedding: number[];
    try {
      embedding = await generateEmbedding(
        parsedText,
        config.hfApiKey,
        config.hfEmbeddingModel,
      );
    } catch (err) {
      console.error(`[fail] Embedding error: ${label} — ${String(err)}`);
      failed++;
      continue;
    }

    const vector: PineconeVector = {
      id: randomUUID(),
      values: embedding,
      metadata: {
        role,
        company: 'Tier-1 Industry Template',
        tier: 1,
        textExcerpt: parsedText.slice(0, 500),
      },
    };

    batch.push(vector);

    if (batch.length >= PINECONE_BATCH_SIZE) {
      try {
        await flushBatch(batch, config.pineconeHost, config.pineconeApiKey);
        console.log(`[upsert] Flushed batch of ${batch.length} vector(s).`);
      } catch (err) {
        console.error(`[fail] Pinecone batch upsert failed — ${String(err)}`);
        failed += batch.length;
        batch.length = 0;
        continue;
      }

      // Mark all successfully upserted documents in Redis
      for (const v of batch) {
        const hash = sha256Hex(v.metadata.textExcerpt);
        await redisSet(config.upstashUrl, config.upstashToken, `ingest:dedup:${hash}`, '1');
      }
      batch.length = 0;
    }

    // Mark this document as ingested in Redis immediately after queuing
    await redisSet(config.upstashUrl, config.upstashToken, redisKey, '1');
    ingested++;
    console.log(`[ok] Queued: ${label}`);
  }

  // Flush remaining vectors
  if (batch.length > 0) {
    try {
      await flushBatch(batch, config.pineconeHost, config.pineconeApiKey);
      console.log(`[upsert] Flushed final batch of ${batch.length} vector(s).`);
    } catch (err) {
      console.error(`[fail] Final Pinecone batch upsert failed — ${String(err)}`);
      failed += batch.length;
    }
  }

  console.log('\n─── Ingestion Summary ───────────────────────────────────────');
  console.log(`  Ingested : ${ingested}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Failed   : ${failed}`);
  console.log(`  Total    : ${pdfs.length}`);
  console.log('─────────────────────────────────────────────────────────────');

  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('[fatal]', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
