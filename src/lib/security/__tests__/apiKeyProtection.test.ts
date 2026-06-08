/**
 * Unit tests for API key protection utilities.
 *
 * These tests verify that:
 *  - `getApiKeys()` reads all required keys from environment variables
 *  - `getApiKeys()` throws a descriptive error when a required key is missing
 *  - `validateApiKeys()` correctly identifies present and missing keys
 *  - No secret key is ever exposed to the client bundle (structural check)
 *
 * Requirements: 11.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock 'server-only' so tests can import the module without Next.js ────────
vi.mock('server-only', () => ({}));

// Import after mocking server-only
const { getApiKeys, validateApiKeys } = await import('../apiKeyProtection');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All required environment variable names. */
const REQUIRED_VARS = [
  'PINECONE_API_KEY',
  'HF_API_KEY',
  'HF_LLM_MODEL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const;

/** A complete set of valid test values for all required vars. */
const VALID_ENV: Record<string, string> = {
  PINECONE_API_KEY: 'test-pinecone-key',
  PINECONE_INDEX_NAME: 'test-index',
  HF_API_KEY: 'test-hf-key',
  HF_EMBEDDING_MODEL: 'sentence-transformers/all-MiniLM-L6-v2',
  HF_LLM_MODEL: 'meta-llama/Meta-Llama-3-8B-Instruct',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
};

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  // Save and clear all relevant env vars before each test
  savedEnv = {};
  for (const key of Object.keys(VALID_ENV)) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  // Restore original env vars
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

// ─── getApiKeys() ─────────────────────────────────────────────────────────────

describe('getApiKeys()', () => {
  it('returns all keys when all required env vars are set', () => {
    // Arrange
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = value;
    }

    // Act
    const keys = getApiKeys();

    // Assert
    expect(keys.pineconeApiKey).toBe('test-pinecone-key');
    expect(keys.pineconeIndexName).toBe('test-index');
    expect(keys.hfApiKey).toBe('test-hf-key');
    expect(keys.hfEmbeddingModel).toBe('sentence-transformers/all-MiniLM-L6-v2');
    expect(keys.hfLlmModel).toBe('meta-llama/Meta-Llama-3-8B-Instruct');
    expect(keys.supabaseServiceRoleKey).toBe('test-service-role-key');
    expect(keys.supabaseUrl).toBe('https://test.supabase.co');
  });

  it('uses default for PINECONE_INDEX_NAME when not set', () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = value;
    }
    delete process.env['PINECONE_INDEX_NAME'];

    const keys = getApiKeys();

    expect(keys.pineconeIndexName).toBe('talent-graph-resumes');
  });

  it('uses default for HF_EMBEDDING_MODEL when not set', () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = value;
    }
    delete process.env['HF_EMBEDDING_MODEL'];

    const keys = getApiKeys();

    expect(keys.hfEmbeddingModel).toBe('sentence-transformers/all-MiniLM-L6-v2');
  });

  it.each(REQUIRED_VARS)(
    'throws a descriptive error when %s is missing',
    (varName) => {
      // Set all vars except the one under test
      for (const [key, value] of Object.entries(VALID_ENV)) {
        process.env[key] = value;
      }
      delete process.env[varName];

      expect(() => getApiKeys()).toThrow(varName);
      expect(() => getApiKeys()).toThrow(/Missing required environment variable/);
    },
  );

  it.each(REQUIRED_VARS)(
    'throws when %s is set to an empty string',
    (varName) => {
      for (const [key, value] of Object.entries(VALID_ENV)) {
        process.env[key] = value;
      }
      process.env[varName] = '';

      expect(() => getApiKeys()).toThrow(varName);
    },
  );

  it.each(REQUIRED_VARS)(
    'throws when %s is set to whitespace only',
    (varName) => {
      for (const [key, value] of Object.entries(VALID_ENV)) {
        process.env[key] = value;
      }
      process.env[varName] = '   ';

      expect(() => getApiKeys()).toThrow(varName);
    },
  );

  it('trims whitespace from env var values', () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = `  ${value}  `;
    }

    const keys = getApiKeys();

    expect(keys.pineconeApiKey).toBe('test-pinecone-key');
    expect(keys.hfApiKey).toBe('test-hf-key');
    expect(keys.supabaseServiceRoleKey).toBe('test-service-role-key');
  });
});

// ─── validateApiKeys() ────────────────────────────────────────────────────────

describe('validateApiKeys()', () => {
  it('returns { valid: true, missing: [] } when all required vars are set', () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = value;
    }

    const result = validateApiKeys();

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('returns { valid: false } and lists missing vars when some are absent', () => {
    // Set only some vars
    process.env['PINECONE_API_KEY'] = 'test-key';
    process.env['HF_API_KEY'] = 'test-hf-key';
    // Leave HF_LLM_MODEL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL unset

    const result = validateApiKeys();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('HF_LLM_MODEL');
    expect(result.missing).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('returns { valid: false } and lists all vars when none are set', () => {
    const result = validateApiKeys();

    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(REQUIRED_VARS.length);
    for (const varName of REQUIRED_VARS) {
      expect(result.missing).toContain(varName);
    }
  });

  it('treats empty string as missing', () => {
    for (const [key, value] of Object.entries(VALID_ENV)) {
      process.env[key] = value;
    }
    process.env['HF_API_KEY'] = '';

    const result = validateApiKeys();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('HF_API_KEY');
  });
});

// ─── Client-bundle safety check ───────────────────────────────────────────────

describe('client-bundle safety', () => {
  it('does not reference NEXT_PUBLIC_ prefixed names for secret keys', async () => {
    // Read the source file and verify no secret key is exposed via NEXT_PUBLIC_
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      __dirname,
      '../apiKeyProtection.ts',
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    // These secret keys must NEVER be prefixed with NEXT_PUBLIC_
    const secretKeyNames = [
      'PINECONE_API_KEY',
      'HF_API_KEY',
      'HF_LLM_MODEL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];

    for (const keyName of secretKeyNames) {
      expect(source).not.toContain(`NEXT_PUBLIC_${keyName}`);
    }
  });

  it('imports server-only to prevent client-bundle inclusion', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(
      __dirname,
      '../apiKeyProtection.ts',
    );
    const source = fs.readFileSync(filePath, 'utf-8');

    expect(source).toContain("import 'server-only'");
  });
});
