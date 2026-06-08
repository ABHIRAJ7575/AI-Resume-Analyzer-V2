/**
 * Prompt Injection Prevention — sanitises resume text before it is embedded
 * in an LLM prompt, validates LLM output format, enforces token limits, and
 * logs suspicious patterns.
 *
 * Requirements: 11.4
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maximum number of tokens allowed for the resume text portion of a prompt.
 * Mirrors the TOKEN_BUDGET used in contextBuilder.ts (3800 tokens total).
 * We cap the raw resume input at 3000 tokens to leave room for the rest of
 * the prompt structure.
 */
export const MAX_RESUME_TOKENS = 3000;

/**
 * Approximate characters-per-token ratio for English text.
 * 1 token ≈ 4 characters.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Maximum characters allowed for resume text before sanitisation truncates it.
 */
export const MAX_RESUME_CHARS = MAX_RESUME_TOKENS * CHARS_PER_TOKEN;

// ─── Suspicious pattern detection ────────────────────────────────────────────

/**
 * Patterns that are characteristic of prompt injection attempts.
 *
 * These cover the most common attack vectors:
 *  - Instruction override attempts ("ignore previous instructions")
 *  - Role/persona hijacking ("you are now", "act as")
 *  - System prompt leakage attempts ("reveal your prompt", "print your instructions")
 *  - Delimiter injection (Llama-3 special tokens)
 *  - Jailbreak preambles ("DAN", "developer mode", "pretend you have no restrictions")
 *  - Markdown/code-block escapes used to break out of context
 */
const INJECTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|rules?)/i,
    label: 'instruction-override: "ignore previous instructions"',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|rules?)/i,
    label: 'instruction-override: "disregard previous instructions"',
  },
  {
    pattern: /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context|rules?)/i,
    label: 'instruction-override: "forget previous instructions"',
  },
  {
    pattern: /you\s+are\s+now\s+/i,
    label: 'persona-hijack: "you are now"',
  },
  {
    pattern: /act\s+as\s+(a\s+|an\s+)?\w/i,
    label: 'persona-hijack: "act as [role]"',
  },
  {
    pattern: /pretend\s+(you\s+)?(are|have|don'?t|do\s+not)/i,
    label: 'persona-hijack: "pretend you are/have"',
  },
  {
    pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|context|rules?)/i,
    label: 'data-exfiltration: "reveal your prompt/instructions"',
  },
  {
    pattern: /print\s+(your\s+)?(system\s+)?(prompt|instructions?|context|rules?)/i,
    label: 'data-exfiltration: "print your instructions"',
  },
  {
    pattern: /show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|context|rules?)/i,
    label: 'data-exfiltration: "show your instructions"',
  },
  {
    pattern: /what\s+(are|is)\s+(your\s+)?(system\s+)?(prompt|instructions?|context|rules?)/i,
    label: 'data-exfiltration: "what are your instructions"',
  },
  {
    // Llama-3 special tokens used to inject fake turns
    pattern: /<\|(?:begin_of_text|start_header_id|end_header_id|eot_id|system|user|assistant)\|>/i,
    label: 'delimiter-injection: Llama-3 special token',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/i,
    label: 'delimiter-injection: Llama-2/Mistral instruction tokens',
  },
  {
    pattern: /\bDAN\b|do\s+anything\s+now/i,
    label: 'jailbreak: DAN / "do anything now"',
  },
  {
    pattern: /developer\s+mode/i,
    label: 'jailbreak: "developer mode"',
  },
  {
    pattern: /jailbreak/i,
    label: 'jailbreak: explicit "jailbreak" keyword',
  },
  {
    pattern: /no\s+restrictions?/i,
    label: 'jailbreak: "no restrictions"',
  },
  {
    pattern: /bypass\s+(your\s+)?(safety|filter|restriction|guideline|rule)/i,
    label: 'jailbreak: "bypass safety/filter"',
  },
  {
    // Attempts to inject a new system message via markdown headings
    pattern: /^#{1,6}\s*(system|instructions?|prompt|rules?)\s*:/im,
    label: 'context-escape: markdown heading used as system/instruction label',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SanitisationResult {
  /** The cleaned resume text, safe to embed in an LLM prompt. */
  sanitisedText: string;
  /** Whether any suspicious patterns were detected. */
  isSuspicious: boolean;
  /** Human-readable labels for each detected pattern. */
  detectedPatterns: string[];
  /** Whether the text was truncated to fit within the token limit. */
  wasTruncated: boolean;
}

export interface OutputValidationResult {
  /** Whether the LLM output passes all format checks. */
  isValid: boolean;
  /** Reasons the output failed validation (empty when valid). */
  violations: string[];
}

// ─── Sanitisation ─────────────────────────────────────────────────────────────

/**
 * Detect suspicious prompt-injection patterns in `text`.
 *
 * @param text - Raw text to inspect.
 * @returns Array of human-readable labels for each detected pattern.
 */
export function detectInjectionPatterns(text: string): string[] {
  const detected: string[] = [];
  for (const { pattern, label } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detected.push(label);
    }
  }
  return detected;
}

/**
 * Log suspicious prompt patterns to the console (server-side monitoring).
 *
 * In production this would forward to a structured logging / SIEM service.
 * The resume text itself is NOT logged to avoid leaking PII.
 *
 * @param detectedPatterns - Labels returned by {@link detectInjectionPatterns}.
 * @param context          - Optional context string (e.g. userId or requestId).
 */
export function logSuspiciousPatterns(
  detectedPatterns: string[],
  context?: string,
): void {
  if (detectedPatterns.length === 0) return;

  const contextStr = context ? ` [context: ${context}]` : '';
  console.warn(
    `[PromptInjection] Suspicious patterns detected${contextStr}:`,
    detectedPatterns,
  );
}

/**
 * Remove or neutralise characters and sequences that could be used to
 * manipulate the LLM prompt structure.
 *
 * Transformations applied (in order):
 *  1. Strip Llama-3 / Llama-2 / Mistral special delimiter tokens.
 *  2. Strip null bytes and other non-printable control characters
 *     (except common whitespace: \t, \n, \r).
 *  3. Collapse runs of more than 3 consecutive blank lines to 2 blank lines
 *     (prevents large whitespace-based context separation tricks).
 *  4. Trim leading/trailing whitespace.
 *
 * Note: We intentionally do NOT strip the injection phrases themselves —
 * they are detected and logged, but the text is kept intact so the LLM
 * still receives the full resume content.  The system prompt and prompt
 * structure are the primary defence; stripping phrases would be fragile
 * and could corrupt legitimate resume content.
 */
function neutraliseText(text: string): string {
  let result = text;

  // 1. Remove Llama-3 special tokens
  result = result.replace(
    /<\|(?:begin_of_text|start_header_id|end_header_id|eot_id|system|user|assistant)\|>/gi,
    '',
  );

  // 2. Remove Llama-2 / Mistral instruction tokens
  result = result.replace(/\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>>/gi, '');

  // 3. Strip non-printable control characters (keep \t \n \r)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Collapse excessive blank lines (> 2 consecutive)
  result = result.replace(/(\r?\n){4,}/g, '\n\n\n');

  // 5. Trim
  result = result.trim();

  return result;
}

/**
 * Sanitise resume text before it is embedded in an LLM prompt.
 *
 * Steps:
 *  1. Detect injection patterns and log if suspicious.
 *  2. Neutralise delimiter tokens and control characters.
 *  3. Truncate to {@link MAX_RESUME_CHARS} if necessary.
 *
 * @param resumeText - Raw resume text extracted from the PDF.
 * @param context    - Optional context string for logging (e.g. userId).
 * @returns {@link SanitisationResult} with the cleaned text and metadata.
 *
 * Requirements: 11.4
 */
export function sanitiseResumeText(
  resumeText: string,
  context?: string,
): SanitisationResult {
  // 1. Detect suspicious patterns on the original text
  const detectedPatterns = detectInjectionPatterns(resumeText);
  const isSuspicious = detectedPatterns.length > 0;

  if (isSuspicious) {
    logSuspiciousPatterns(detectedPatterns, context);
  }

  // 2. Neutralise delimiter tokens and control characters
  let sanitised = neutraliseText(resumeText);

  // 3. Enforce token limit
  let wasTruncated = false;
  if (sanitised.length > MAX_RESUME_CHARS) {
    sanitised = sanitised.slice(0, MAX_RESUME_CHARS);
    wasTruncated = true;
  }

  return {
    sanitisedText: sanitised,
    isSuspicious,
    detectedPatterns,
    wasTruncated,
  };
}

// ─── LLM output validation ────────────────────────────────────────────────────

/**
 * Validate that an LLM output object conforms to the expected `LLMResponse`
 * structure and content requirements.
 *
 * Checks:
 *  - `feedback` is a non-empty string.
 *  - `starRecommendations` is a non-empty array.
 *  - Each recommendation has non-empty `original`, `improved`, `reasoning`.
 *  - `interviewQuestions` is an array with 1–10 string elements.
 *  - No field contains Llama-3 delimiter tokens (output injection guard).
 *
 * @param output - The parsed LLM response object to validate.
 * @returns {@link OutputValidationResult} describing any violations found.
 *
 * Requirements: 11.4
 */
export function validateLLMOutput(output: unknown): OutputValidationResult {
  const violations: string[] = [];

  if (typeof output !== 'object' || output === null) {
    return { isValid: false, violations: ['output is not an object'] };
  }

  const obj = output as Record<string, unknown>;

  // feedback
  if (typeof obj['feedback'] !== 'string' || obj['feedback'].trim() === '') {
    violations.push('feedback must be a non-empty string');
  }

  // starRecommendations
  if (!Array.isArray(obj['starRecommendations'])) {
    violations.push('starRecommendations must be an array');
  } else if ((obj['starRecommendations'] as unknown[]).length === 0) {
    violations.push('starRecommendations must contain at least one item');
  } else {
    const recs = obj['starRecommendations'] as unknown[];
    recs.forEach((rec, i) => {
      if (typeof rec !== 'object' || rec === null) {
        violations.push(`starRecommendations[${i}] is not an object`);
        return;
      }
      const r = rec as Record<string, unknown>;
      if (typeof r['original'] !== 'string' || r['original'].trim() === '') {
        violations.push(`starRecommendations[${i}].original must be a non-empty string`);
      }
      if (typeof r['improved'] !== 'string' || r['improved'].trim() === '') {
        violations.push(`starRecommendations[${i}].improved must be a non-empty string`);
      }
      if (typeof r['reasoning'] !== 'string' || r['reasoning'].trim() === '') {
        violations.push(`starRecommendations[${i}].reasoning must be a non-empty string`);
      }
    });
  }

  // interviewQuestions
  if (!Array.isArray(obj['interviewQuestions'])) {
    violations.push('interviewQuestions must be an array');
  } else {
    const qs = obj['interviewQuestions'] as unknown[];
    if (qs.length === 0) {
      violations.push('interviewQuestions must contain at least one item');
    } else if (qs.length > 10) {
      violations.push('interviewQuestions must contain no more than 10 items');
    }
    qs.forEach((q, i) => {
      if (typeof q !== 'string' || q.trim() === '') {
        violations.push(`interviewQuestions[${i}] must be a non-empty string`);
      }
    });
  }

  // Guard against delimiter injection in output fields
  const delimiterPattern =
    /<\|(?:begin_of_text|start_header_id|end_header_id|eot_id|system|user|assistant)\|>/i;

  const fieldsToCheck: Array<[string, unknown]> = [
    ['feedback', obj['feedback']],
  ];

  if (Array.isArray(obj['starRecommendations'])) {
    (obj['starRecommendations'] as unknown[]).forEach((rec, i) => {
      if (typeof rec === 'object' && rec !== null) {
        const r = rec as Record<string, unknown>;
        fieldsToCheck.push([`starRecommendations[${i}].original`, r['original']]);
        fieldsToCheck.push([`starRecommendations[${i}].improved`, r['improved']]);
        fieldsToCheck.push([`starRecommendations[${i}].reasoning`, r['reasoning']]);
      }
    });
  }

  if (Array.isArray(obj['interviewQuestions'])) {
    (obj['interviewQuestions'] as unknown[]).forEach((q, i) => {
      fieldsToCheck.push([`interviewQuestions[${i}]`, q]);
    });
  }

  for (const [fieldName, value] of fieldsToCheck) {
    if (typeof value === 'string' && delimiterPattern.test(value)) {
      violations.push(`${fieldName} contains disallowed delimiter tokens`);
    }
  }

  return { isValid: violations.length === 0, violations };
}
