/**
 * API Key Protection — centralised, server-side-only access to secret
 * environment variables.
 *
 * Rules enforced here:
 *  1. All secret keys are read from environment variables (never hard-coded).
 *  2. This module is server-side only — it must never be imported from a
 *     'use client' component.  The `server-only` package enforces this at
 *     build time: Next.js will throw a build error if any client bundle
 *     transitively imports this file.
 *  3. Keys are validated at call time so misconfiguration surfaces early
 *     with a clear error message rather than a cryptic downstream failure.
 *
 * Requirements: 11.2
 */

// Importing 'server-only' causes Next.js to throw a build-time error if this
// module is ever bundled into a client (browser) chunk.  This is the
// recommended Next.js pattern for protecting server secrets.
// See: node_modules/next/dist/docs/01-app/02-guides/environment-variables.md
import 'server-only';

// ─── Types ────────────────────────────────────────────────────────────────────

/** All secret API keys used by the application. */
export interface ApiKeys {
  /** Pinecone vector database API key. */
  pineconeApiKey: string;
  /** Pinecone index name. */
  pineconeIndexName: string;
  /** Hugging Face API token (embeddings + LLM). */
  hfApiKey: string;
  /** Hugging Face embedding model identifier. */
  hfEmbeddingModel: string;
  /** Hugging Face LLM model identifier. */
  hfLlmModel: string;
  /** Supabase service-role key (server-side DB access). */
  supabaseServiceRoleKey: string;
  /** Supabase project URL (also used server-side for REST calls). */
  supabaseUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read a required environment variable.
 * Throws a descriptive `Error` when the variable is absent or empty so that
 * misconfiguration is caught early rather than causing a cryptic failure deep
 * in a service call.
 *
 * @param name - The environment variable name (e.g. `'PINECONE_API_KEY'`).
 * @returns The non-empty string value.
 * @throws {Error} when the variable is missing or empty.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[API Key Protection] Missing required environment variable: ${name}. ` +
        `Ensure it is set in .env.local (development) or your deployment environment.`,
    );
  }
  return value.trim();
}

/**
 * Read an optional environment variable, returning a default when absent.
 *
 * @param name         - The environment variable name.
 * @param defaultValue - Value to return when the variable is not set.
 */
function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return all secret API keys, reading them from environment variables.
 *
 * Call this function inside server-side code (Route Handlers, Server
 * Components, server actions) — never in client components.
 *
 * Each key is validated on every call so that a missing variable is caught
 * immediately rather than silently producing undefined behaviour.
 *
 * Requirements: 11.2
 */
export function getApiKeys(): ApiKeys {
  return {
    pineconeApiKey: requireEnv('PINECONE_API_KEY'),
    pineconeIndexName: optionalEnv('PINECONE_INDEX_NAME', 'talent-graph-resumes'),
    hfApiKey: requireEnv('HF_API_KEY'),
    hfEmbeddingModel: optionalEnv(
      'HF_EMBEDDING_MODEL',
      'sentence-transformers/all-MiniLM-L6-v2',
    ),
    hfLlmModel: requireEnv('HF_LLM_MODEL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  };
}

/**
 * Validate that all required API keys are present in the environment.
 *
 * Intended for use in health-check endpoints or application startup
 * instrumentation so that missing configuration is surfaced before the
 * first real request arrives.
 *
 * Returns an object describing which keys are present and which are missing.
 *
 * Requirements: 11.2
 */
export function validateApiKeys(): { valid: boolean; missing: string[] } {
  const required = [
    'PINECONE_API_KEY',
    'HF_API_KEY',
    'HF_LLM_MODEL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
  ] as const;

  const missing = required.filter((name) => {
    const value = process.env[name];
    return !value || value.trim() === '';
  });

  return { valid: missing.length === 0, missing };
}
