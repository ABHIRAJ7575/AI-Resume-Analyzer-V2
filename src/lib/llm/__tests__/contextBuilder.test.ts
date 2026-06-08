/**
 * Unit tests for buildPrompt(), generateFeedback(), and LLMContextBuilder.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 9.1, 9.2, 9.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildPrompt, generateFeedback, LLMContextBuilder } from '../contextBuilder';
import { LLMError } from '@/types/errors';
import type { LLMResponse, RAGMatch, ScoringResult } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid ScoringResult with no penalties. */
const baseScore: ScoringResult = {
  totalScore: 72,
  breakdown: {
    skillDensity: 65,
    actionVerbQuality: 80,
    ragSimilarity: 70,
  },
  penalties: [],
};

/** ScoringResult with penalties. */
const scoreWithPenalties: ScoringResult = {
  totalScore: 35,
  breakdown: {
    skillDensity: 20,
    actionVerbQuality: 25,
    ragSimilarity: 55,
  },
  penalties: [
    'Low technical keyword density (score: 20/100)',
    'Weak action verb usage (score: 25/100)',
  ],
};

/** A single RAGMatch fixture. */
function makeRAGMatch(id: string, text: string): RAGMatch {
  return {
    id,
    score: 0.9,
    metadata: {
      resumeType: 'template',
      industryTag: 'software-engineering',
      qualityRating: 0.95,
    },
    text,
  };
}

const ragMatch1 = makeRAGMatch('match-1', 'Senior engineer with 8 years of TypeScript experience.');
const ragMatch2 = makeRAGMatch('match-2', 'Full-stack developer specialising in React and Node.js.');
const ragMatch3 = makeRAGMatch('match-3', 'DevOps engineer with expertise in Kubernetes and AWS.');
const ragMatch4 = makeRAGMatch('match-4', 'This fourth match should be excluded from the prompt.');

const sampleResume =
  '• Architected scalable microservices using TypeScript and Node.js\n' +
  '• Implemented CI/CD pipeline with Docker and Kubernetes\n' +
  '• Optimized PostgreSQL queries reducing latency by 40%';

// ─── Llama-3 chat template format ─────────────────────────────────────────────

describe('buildPrompt() — Llama-3 chat template format', () => {
  it('starts with <|begin_of_text|>', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt.startsWith('<|begin_of_text|>')).toBe(true);
  });

  it('includes system header tokens', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('<|start_header_id|>system<|end_header_id|>');
  });

  it('includes user header tokens', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('<|start_header_id|>user<|end_header_id|>');
  });

  it('includes assistant header token at the end', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt.endsWith('<|start_header_id|>assistant<|end_header_id|>')).toBe(true);
  });

  it('includes <|eot_id|> end-of-turn tokens', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    // Should appear at least twice: after system message and after user message
    const eotCount = (prompt.match(/<\|eot_id\|>/g) ?? []).length;
    expect(eotCount).toBeGreaterThanOrEqual(2);
  });

  it('includes the system message text', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('You are an expert resume coach');
    expect(prompt).toContain('STAR method');
  });
});

// ─── Score breakdown ──────────────────────────────────────────────────────────

describe('buildPrompt() — score breakdown', () => {
  it('includes the ## Score Breakdown heading', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('## Score Breakdown');
  });

  it('includes skill density score', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('Skill Density: 65/100');
  });

  it('includes action verb quality score', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('Action Verb Quality: 80/100');
  });

  it('includes semantic similarity score', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('Semantic Similarity: 70/100');
  });

  it('includes total score', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('Total Score: 72/100');
  });

  it('includes penalties when present', () => {
    const prompt = buildPrompt(sampleResume, [], scoreWithPenalties);
    expect(prompt).toContain('Low technical keyword density (score: 20/100)');
    expect(prompt).toContain('Weak action verb usage (score: 25/100)');
  });

  it('shows "None" for penalties when penalties array is empty', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('Penalties:');
    expect(prompt).toContain('- None');
  });
});

// ─── RAG context ──────────────────────────────────────────────────────────────

describe('buildPrompt() — RAG context', () => {
  it('includes ## Similar High-Quality Resumes section when matches provided', () => {
    const prompt = buildPrompt(sampleResume, [ragMatch1], baseScore);
    expect(prompt).toContain('## Similar High-Quality Resumes');
  });

  it('includes the text of provided RAG matches', () => {
    const prompt = buildPrompt(sampleResume, [ragMatch1, ragMatch2], baseScore);
    expect(prompt).toContain(ragMatch1.text);
    expect(prompt).toContain(ragMatch2.text);
  });

  it('omits ## Similar High-Quality Resumes section when ragContext is empty', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).not.toContain('## Similar High-Quality Resumes');
  });

  it('only includes the top 3 RAG matches even when more are provided', () => {
    const prompt = buildPrompt(
      sampleResume,
      [ragMatch1, ragMatch2, ragMatch3, ragMatch4],
      baseScore,
    );
    expect(prompt).toContain(ragMatch1.text);
    expect(prompt).toContain(ragMatch2.text);
    expect(prompt).toContain(ragMatch3.text);
    // The 4th match should be excluded
    expect(prompt).not.toContain(ragMatch4.text);
  });

  it('handles exactly 3 RAG matches without excluding any', () => {
    const prompt = buildPrompt(
      sampleResume,
      [ragMatch1, ragMatch2, ragMatch3],
      baseScore,
    );
    expect(prompt).toContain(ragMatch1.text);
    expect(prompt).toContain(ragMatch2.text);
    expect(prompt).toContain(ragMatch3.text);
  });
});

// ─── Resume text ──────────────────────────────────────────────────────────────

describe('buildPrompt() — resume text', () => {
  it('includes the ## Resume to Analyze heading', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('## Resume to Analyze');
  });

  it('includes the resume text in the prompt', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain(sampleResume);
  });

  it('includes resume text when RAG context is also present', () => {
    const prompt = buildPrompt(sampleResume, [ragMatch1], baseScore);
    expect(prompt).toContain(sampleResume);
  });
});

// ─── JSON format instructions ─────────────────────────────────────────────────

describe('buildPrompt() — JSON format instructions', () => {
  it('includes the ## Instructions heading', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('## Instructions');
  });

  it('instructs the model to provide STAR-method improvements', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('STAR-method bullet point improvements');
  });

  it('instructs the model to provide interview preparation questions', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('interview preparation questions');
  });

  it('includes the JSON response format structure', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('"feedback"');
    expect(prompt).toContain('"starRecommendations"');
    expect(prompt).toContain('"interviewQuestions"');
  });

  it('includes original/improved/reasoning fields in the JSON structure', () => {
    const prompt = buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('"original"');
    expect(prompt).toContain('"improved"');
    expect(prompt).toContain('"reasoning"');
  });
});

// ─── Token limit / truncation ─────────────────────────────────────────────────

describe('buildPrompt() — token limit enforcement', () => {
  it('does not truncate a short resume that fits within the token budget', () => {
    const shortResume = '• Built a REST API using Node.js';
    const prompt = buildPrompt(shortResume, [], baseScore);
    expect(prompt).toContain(shortResume);
  });

  it('truncates a very long resume to keep estimated tokens under 4096', () => {
    // Create a resume that is far too long (~80 000 chars ≈ 20 000 tokens)
    const longResume = 'A'.repeat(80_000);
    const prompt = buildPrompt(longResume, [], baseScore);

    // The full resume should NOT appear verbatim
    expect(prompt).not.toContain(longResume);

    // The estimated token count of the resulting prompt should be <= 4096
    const estimatedTokens = Math.ceil(prompt.length / 4);
    expect(estimatedTokens).toBeLessThanOrEqual(4096);
  });

  it('truncated prompt still contains all required sections', () => {
    const longResume = 'B'.repeat(80_000);
    const prompt = buildPrompt(longResume, [], baseScore);

    expect(prompt).toContain('<|begin_of_text|>');
    expect(prompt).toContain('## Score Breakdown');
    expect(prompt).toContain('## Resume to Analyze');
    expect(prompt).toContain('## Instructions');
    expect(prompt.endsWith('<|start_header_id|>assistant<|end_header_id|>')).toBe(true);
  });
});

// ─── LLMContextBuilder class ──────────────────────────────────────────────────

describe('LLMContextBuilder', () => {
  it('can be instantiated without an API key', () => {
    const builder = new LLMContextBuilder();
    expect(builder).toBeInstanceOf(LLMContextBuilder);
    expect(builder.apiKey).toBeUndefined();
  });

  it('stores the provided API key', () => {
    const builder = new LLMContextBuilder('hf_test_key_123');
    expect(builder.apiKey).toBe('hf_test_key_123');
  });

  it('buildPrompt method produces the same output as the standalone function', () => {
    const builder = new LLMContextBuilder();
    const classResult = builder.buildPrompt(sampleResume, [ragMatch1], baseScore);
    const fnResult = buildPrompt(sampleResume, [ragMatch1], baseScore);
    expect(classResult).toBe(fnResult);
  });

  it('buildPrompt method includes system message', () => {
    const builder = new LLMContextBuilder('key');
    const prompt = builder.buildPrompt(sampleResume, [], baseScore);
    expect(prompt).toContain('<|start_header_id|>system<|end_header_id|>');
    expect(prompt).toContain('You are an expert resume coach');
  });
});

// ─── generateFeedback() ───────────────────────────────────────────────────────

/** A minimal valid LLMResponse that passes validation. */
const validLLMResponse: LLMResponse = {
  feedback: 'Great resume overall.',
  starRecommendations: [
    {
      original: 'Worked on backend services',
      improved: 'Architected and deployed 3 microservices reducing latency by 40%',
      reasoning: 'Quantified impact with action verb and metric',
    },
  ],
  interviewQuestions: [
    'Tell me about your most significant technical achievement.',
    'How do you approach problem-solving in a team environment?',
    'What technologies are you most proficient in and why?',
  ],
};

/** Build a minimal mock Response object. */
function mockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('generateFeedback()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['HF_API_KEY'] = 'hf_test_key';
    process.env['HF_LLM_MODEL'] = 'meta-llama/Llama-3-8B-Instruct';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Restore env
    process.env['HF_API_KEY'] = originalEnv['HF_API_KEY'];
    process.env['HF_LLM_MODEL'] = originalEnv['HF_LLM_MODEL'];
  });

  it('returns parsed LLMResponse from a valid JSON response', async () => {
    const hfBody = [{ generated_text: JSON.stringify(validLLMResponse) }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateFeedback('test prompt');

    expect(result.feedback).toBe(validLLMResponse.feedback);
    expect(result.starRecommendations).toHaveLength(1);
    expect(result.interviewQuestions).toHaveLength(3);
  });

  it('handles JSON embedded in surrounding text (regex extraction)', async () => {
    const embeddedText =
      'Here is my analysis:\n' +
      JSON.stringify(validLLMResponse) +
      '\nEnd of response.';
    const hfBody = [{ generated_text: embeddedText }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateFeedback('test prompt');

    expect(result.feedback).toBe(validLLMResponse.feedback);
    expect(result.starRecommendations).toHaveLength(1);
  });

  it('returns fallback response when the response body is unparseable', async () => {
    const hfBody = [{ generated_text: 'This is not JSON at all.' }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateFeedback('test prompt');

    expect(result.feedback).toContain('Unable to generate detailed feedback');
    expect(result.starRecommendations).toHaveLength(1);
    expect(result.interviewQuestions).toHaveLength(3);
  });

  it('retries on 429 and respects the Retry-After header', async () => {
    const hfBody = [{ generated_text: JSON.stringify(validLLMResponse) }];
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(429, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(mockResponse(200, hfBody));

    // Stub sleep so the test doesn't actually wait
    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0; });

    const result = await generateFeedback('test prompt');

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(result.feedback).toBe(validLLMResponse.feedback);
  });

  it('retries on 5xx after 2 seconds', async () => {
    const hfBody = [{ generated_text: JSON.stringify(validLLMResponse) }];
    vi.mocked(fetch)
      .mockResolvedValueOnce(mockResponse(503, {}))
      .mockResolvedValueOnce(mockResponse(200, hfBody));

    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0; });

    const result = await generateFeedback('test prompt');

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect(result.feedback).toBe(validLLMResponse.feedback);
  });

  it('throws LLMError immediately on 4xx (not 429)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(401, {}));

    await expect(generateFeedback('test prompt')).rejects.toBeInstanceOf(LLMError);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('returns fallback when starRecommendations is empty (validation failure)', async () => {
    const invalidResponse: LLMResponse = {
      feedback: 'Some feedback',
      starRecommendations: [], // fails validation
      interviewQuestions: ['Question 1'],
    };
    const hfBody = [{ generated_text: JSON.stringify(invalidResponse) }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateFeedback('test prompt');

    expect(result.feedback).toContain('Unable to generate detailed feedback');
    expect(result.starRecommendations).toHaveLength(1);
  });

  it('returns fallback when interviewQuestions is empty (validation failure)', async () => {
    const invalidResponse: LLMResponse = {
      feedback: 'Some feedback',
      starRecommendations: [
        { original: 'x', improved: 'y', reasoning: 'z' },
      ],
      interviewQuestions: [], // fails validation
    };
    const hfBody = [{ generated_text: JSON.stringify(invalidResponse) }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateFeedback('test prompt');

    expect(result.feedback).toContain('Unable to generate detailed feedback');
  });
});

// ─── LLMContextBuilder.generateFeedback() ────────────────────────────────────

describe('LLMContextBuilder.generateFeedback()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['HF_LLM_MODEL'] = 'meta-llama/Llama-3-8B-Instruct';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env['HF_API_KEY'] = originalEnv['HF_API_KEY'];
    process.env['HF_LLM_MODEL'] = originalEnv['HF_LLM_MODEL'];
  });

  it('uses this.apiKey when set, overriding the env var', async () => {
    // Set a different key in env to confirm the instance key wins
    process.env['HF_API_KEY'] = 'env_key_should_not_be_used';

    const hfBody = [{ generated_text: JSON.stringify(validLLMResponse) }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const builder = new LLMContextBuilder('hf_instance_key');
    const result = await builder.generateFeedback('test prompt');

    // Verify the Authorization header used the instance key
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer hf_instance_key');

    expect(result.feedback).toBe(validLLMResponse.feedback);
  });

  it('falls back to process.env.HF_API_KEY when no instance key is set', async () => {
    process.env['HF_API_KEY'] = 'hf_env_key';

    const hfBody = [{ generated_text: JSON.stringify(validLLMResponse) }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const builder = new LLMContextBuilder(); // no apiKey
    const result = await builder.generateFeedback('test prompt');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer hf_env_key');

    expect(result.feedback).toBe(validLLMResponse.feedback);
  });
});

// ─── generateInterviewQuestions() ────────────────────────────────────────────

import { generateInterviewQuestions } from '../contextBuilder';

/** A valid HF response body containing a JSON array of questions. */
function makeQuestionsBody(questions: string[]): unknown {
  return [{ generated_text: JSON.stringify(questions) }];
}

describe('generateInterviewQuestions()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['HF_API_KEY'] = 'hf_test_key';
    process.env['HF_LLM_MODEL'] = 'meta-llama/Llama-3-8B-Instruct';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env['HF_API_KEY'] = originalEnv['HF_API_KEY'];
    process.env['HF_LLM_MODEL'] = originalEnv['HF_LLM_MODEL'];
  });

  it('returns an array of 3–10 questions from a valid JSON array response', async () => {
    const questions = [
      'Describe a challenging TypeScript project.',
      'How do you handle async errors in Node.js?',
      'What is your approach to code reviews?',
      'How do you optimise database queries?',
      'Describe your CI/CD experience.',
    ];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(questions)),
    );

    const result = await generateInterviewQuestions(sampleResume, 'Software Engineer');

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result).toEqual(questions);
  });

  it('returns fallback questions when the response is unparseable', async () => {
    const hfBody = [{ generated_text: 'This is not a JSON array.' }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateInterviewQuestions(sampleResume, 'Backend Engineer');

    expect(result).toHaveLength(3);
    expect(result[0]).toContain('Backend Engineer');
    expect(result[1]).toContain('problem-solving');
    expect(result[2]).toContain('technologies');
  });

  it('returns fallback questions when fewer than 3 questions are returned', async () => {
    const tooFew = ['Only one question here?'];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(tooFew)),
    );

    const result = await generateInterviewQuestions(sampleResume, 'DevOps Engineer');

    expect(result).toHaveLength(3);
    // Fallback questions should be returned
    expect(result[0]).toContain('DevOps Engineer');
  });

  it('clamps to 10 questions when more than 10 are returned', async () => {
    const tooMany = Array.from({ length: 15 }, (_, i) => `Question ${i + 1}?`);
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(tooMany)),
    );

    const result = await generateInterviewQuestions(sampleResume, 'Frontend Engineer');

    expect(result).toHaveLength(10);
    expect(result[0]).toBe('Question 1?');
    expect(result[9]).toBe('Question 10?');
  });

  it('includes the jobRole in the prompt sent to the API', async () => {
    const questions = ['Q1?', 'Q2?', 'Q3?'];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(questions)),
    );

    await generateInterviewQuestions(sampleResume, 'Data Scientist');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const body = JSON.parse(requestInit.body as string) as { inputs: string };
    expect(body.inputs).toContain('Data Scientist');
  });

  it('extracts questions from JSON array embedded in surrounding text', async () => {
    const questions = ['Tell me about yourself.', 'What is your greatest strength?', 'Where do you see yourself in 5 years?'];
    const embeddedText = 'Here are the questions:\n' + JSON.stringify(questions) + '\nDone.';
    const hfBody = [{ generated_text: embeddedText }];
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(200, hfBody));

    const result = await generateInterviewQuestions(sampleResume, 'Product Manager');

    expect(result).toEqual(questions);
  });
});

// ─── LLMContextBuilder.generateInterviewQuestions() ──────────────────────────

describe('LLMContextBuilder.generateInterviewQuestions()', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env['HF_API_KEY'] = 'hf_test_key';
    process.env['HF_LLM_MODEL'] = 'meta-llama/Llama-3-8B-Instruct';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env['HF_API_KEY'] = originalEnv['HF_API_KEY'];
    process.env['HF_LLM_MODEL'] = originalEnv['HF_LLM_MODEL'];
  });

  it('delegates to the standalone generateInterviewQuestions function', async () => {
    const questions = ['Q1?', 'Q2?', 'Q3?'];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(questions)),
    );

    const builder = new LLMContextBuilder();
    const result = await builder.generateInterviewQuestions(sampleResume, 'ML Engineer');

    expect(result).toEqual(questions);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('uses this.apiKey when set, overriding the env var', async () => {
    process.env['HF_API_KEY'] = 'env_key_should_not_be_used';

    const questions = ['Q1?', 'Q2?', 'Q3?'];
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse(200, makeQuestionsBody(questions)),
    );

    const builder = new LLMContextBuilder('hf_instance_key');
    await builder.generateInterviewQuestions(sampleResume, 'ML Engineer');

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer hf_instance_key');
  });
});
