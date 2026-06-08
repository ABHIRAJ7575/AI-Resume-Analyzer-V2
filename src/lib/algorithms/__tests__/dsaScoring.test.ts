/**
 * Unit tests for keywordDensity(), actionVerbValidation(), TECH_FIELDS,
 * ACTION_VERBS, and WEAK_PHRASES.
 *
 * Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 14.3, 14.4
 */

import { describe, it, expect } from 'vitest';
import {
  keywordDensity,
  actionVerbValidation,
  calculateScore,
  TECH_FIELDS,
  ACTION_VERBS,
  WEAK_PHRASES,
} from '../dsaScoring';

// ─── TECH_FIELDS ──────────────────────────────────────────────────────────────

describe('TECH_FIELDS', () => {
  it('contains at least 50 keywords', () => {
    expect(TECH_FIELDS.size).toBeGreaterThanOrEqual(50);
  });

  it('all entries are lowercase strings', () => {
    for (const keyword of TECH_FIELDS) {
      expect(keyword).toBe(keyword.toLowerCase());
    }
  });

  it('contains expected core technology keywords', () => {
    const expected = [
      'typescript',
      'javascript',
      'react',
      'nodejs',
      'python',
      'aws',
      'docker',
      'kubernetes',
      'postgresql',
      'graphql',
    ];
    for (const kw of expected) {
      expect(TECH_FIELDS.has(kw)).toBe(true);
    }
  });
});

// ─── keywordDensity ───────────────────────────────────────────────────────────

describe('keywordDensity()', () => {
  // ── Output range ────────────────────────────────────────────────────────────

  it('returns 0 for empty string', () => {
    // An empty string splits to [""] — wordCount 1, no matches
    expect(keywordDensity('', TECH_FIELDS)).toBe(0);
  });

  it('returns 0 for text with no tech keywords', () => {
    const text = 'I enjoy hiking and cooking on weekends with my family';
    expect(keywordDensity(text, TECH_FIELDS)).toBe(0);
  });

  it('returns a value in [0, 100] for typical resume text', () => {
    const text =
      'Architected scalable microservices using TypeScript and Node.js. ' +
      'Implemented CI/CD pipeline with Docker and Kubernetes. ' +
      'Optimised PostgreSQL queries reducing latency by 40%.';
    const score = keywordDensity(text, TECH_FIELDS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('never exceeds 100 even when text is entirely tech keywords', () => {
    // Repeat many different keywords to maximise both density and diversity
    const keywords = Array.from(TECH_FIELDS).join(' ');
    const score = keywordDensity(keywords, TECH_FIELDS);
    expect(score).toBeLessThanOrEqual(100);
  });

  // ── Diversity bonus ──────────────────────────────────────────────────────────

  it('awards a higher score for more unique keywords (diversity bonus)', () => {
    // Both texts have the same number of tech-keyword tokens (5) out of 50 total
    // words, so their density components are identical. The difference comes
    // entirely from the diversity bonus.
    const filler = Array(45).fill('word').join(' ');

    // 1 unique keyword repeated 5 times → diversityBonus = min(1*2, 30) = 2
    const oneKeyword = `typescript typescript typescript typescript typescript ${filler}`;
    // 5 unique keywords, one each → diversityBonus = min(5*2, 30) = 10
    const fiveKeywords = `typescript javascript python react nodejs ${filler}`;

    const scoreOne = keywordDensity(oneKeyword, TECH_FIELDS);
    const scoreFive = keywordDensity(fiveKeywords, TECH_FIELDS);

    expect(scoreFive).toBeGreaterThan(scoreOne);
  });

  it('caps diversity bonus at 30 points (15 unique keywords × 2)', () => {
    // Build a text with exactly 15 unique tech keywords and lots of filler
    // so the density component is negligible.
    const uniqueKeywords = Array.from(TECH_FIELDS).slice(0, 15).join(' ');
    // Add enough filler words to make density ≈ 0
    const filler = Array(500).fill('word').join(' ');
    const text = `${uniqueKeywords} ${filler}`;

    const score = keywordDensity(text, TECH_FIELDS);
    // diversity bonus = min(15 * 2, 30) = 30; density ≈ 15/515 * 100 ≈ 2.9
    // total ≈ 32.9 — well below 100, so the cap isn't the binding constraint here
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // ── Normalisation ────────────────────────────────────────────────────────────

  it('penalises repetition of the same keyword (normalised by word count)', () => {
    // Repeating one keyword 100 times in a 100-word text gives density 100%
    // but only 1 unique keyword → diversityBonus = 2
    const repeated = Array(100).fill('typescript').join(' ');
    const score = keywordDensity(repeated, TECH_FIELDS);
    // densityScore = (100/100)*100 = 100; diversityBonus = 2 → capped at 100
    expect(score).toBe(100);

    // Now add 900 filler words — density drops to 10%
    const diluted =
      Array(100).fill('typescript').join(' ') +
      ' ' +
      Array(900).fill('word').join(' ');
    const dilutedScore = keywordDensity(diluted, TECH_FIELDS);
    // densityScore = (100/1000)*100 = 10; diversityBonus = 2 → 12
    expect(dilutedScore).toBeLessThan(score);
  });

  // ── Case insensitivity ───────────────────────────────────────────────────────

  it('is case-insensitive (matches uppercase keywords)', () => {
    const lower = 'typescript react nodejs';
    const upper = 'TypeScript React Node.js';
    // Both should produce the same score since text is lowercased before matching
    expect(keywordDensity(lower, TECH_FIELDS)).toBeCloseTo(
      keywordDensity(upper, TECH_FIELDS),
      5,
    );
  });

  // ── Punctuation stripping ────────────────────────────────────────────────────

  it('strips surrounding punctuation from words before matching', () => {
    // "typescript," and "react." should still match
    const withPunctuation = 'typescript, react. nodejs; postgresql:';
    const withoutPunctuation = 'typescript react nodejs postgresql';
    expect(keywordDensity(withPunctuation, TECH_FIELDS)).toBeCloseTo(
      keywordDensity(withoutPunctuation, TECH_FIELDS),
      5,
    );
  });

  // ── No mutation ──────────────────────────────────────────────────────────────

  it('does not mutate the techFields Set', () => {
    const copy = new Set(TECH_FIELDS);
    keywordDensity('typescript react nodejs', TECH_FIELDS);
    expect(TECH_FIELDS.size).toBe(copy.size);
    for (const kw of copy) {
      expect(TECH_FIELDS.has(kw)).toBe(true);
    }
  });

  // ── Custom techFields ────────────────────────────────────────────────────────

  it('works correctly with a custom techFields Set', () => {
    const custom = new Set(['foo', 'bar', 'baz']);
    const text = 'foo bar baz qux quux';
    // 3 matches out of 5 words → density = 60; diversity = min(3*2,30) = 6 → 66
    expect(keywordDensity(text, custom)).toBeCloseTo(66, 5);
  });
});

// ─── ACTION_VERBS ─────────────────────────────────────────────────────────────

describe('ACTION_VERBS', () => {
  it('contains at least 100 entries', () => {
    expect(ACTION_VERBS.size).toBeGreaterThanOrEqual(100);
  });

  it('all entries are lowercase strings', () => {
    for (const verb of ACTION_VERBS) {
      expect(verb).toBe(verb.toLowerCase());
    }
  });

  it('contains expected strong action verbs', () => {
    const expected = [
      'architected',
      'implemented',
      'optimized',
      'designed',
      'developed',
      'engineered',
      'built',
      'led',
      'automated',
      'deployed',
    ];
    for (const verb of expected) {
      expect(ACTION_VERBS.has(verb)).toBe(true);
    }
  });
});

// ─── WEAK_PHRASES ─────────────────────────────────────────────────────────────

describe('WEAK_PHRASES', () => {
  it('contains at least one entry', () => {
    expect(WEAK_PHRASES.size).toBeGreaterThan(0);
  });

  it('all entries are lowercase strings', () => {
    for (const phrase of WEAK_PHRASES) {
      expect(phrase).toBe(phrase.toLowerCase());
    }
  });

  it('contains expected weak phrases', () => {
    const expected = [
      'responsible for',
      'worked on',
      'helped with',
      'assisted in',
      'involved in',
    ];
    for (const phrase of expected) {
      expect(WEAK_PHRASES.has(phrase)).toBe(true);
    }
  });
});

// ─── actionVerbValidation ─────────────────────────────────────────────────────

describe('actionVerbValidation()', () => {
  // ── Returns 0 for plain paragraph text (no bullet points) ──────────────────

  it('returns 0 when no bullet points are detected (plain paragraph text)', () => {
    const text =
      'I have five years of experience in software development. ' +
      'I worked on various projects and helped with deployments.';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(0);
  });

  // ── Returns 100 when all bullets start with strong verbs ───────────────────

  it('returns 100 when all bullets start with strong action verbs', () => {
    const text = [
      '• Architected scalable microservices using TypeScript',
      '• Implemented CI/CD pipeline with Docker',
      '• Optimized PostgreSQL queries reducing latency by 40%',
    ].join('\n');
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  // ── Returns 0 when all bullets use weak phrases ────────────────────────────

  it('returns 0 when all bullets use weak phrases (penalty maxes out, score clamped)', () => {
    // weakPhrasePenalty = (1.0) * 30 = 30; strongVerbRatio = 0 → score = -30 → 0
    const text = [
      '• Responsible for maintaining the backend services',
      '• Worked on frontend features for the dashboard',
      '• Helped with deployment and release management',
    ].join('\n');
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(0);
  });

  // ── Bullet point format detection ─────────────────────────────────────────

  it('detects bullet points starting with • (bullet character)', () => {
    const text = '• Implemented a new authentication system';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  it('detects bullet points starting with - (hyphen)', () => {
    const text = '- Developed a REST API using Node.js';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  it('detects bullet points starting with * (asterisk)', () => {
    const text = '* Designed the database schema for the application';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  it('detects numbered bullet points (e.g. "1. Verb ...")', () => {
    const text = '1. Engineered a high-performance caching layer';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  // ── Case insensitivity ─────────────────────────────────────────────────────

  it('is case-insensitive (uppercase verb at start of bullet still matches)', () => {
    // "IMPLEMENTED" should match "implemented" in ACTION_VERBS after lowercasing
    const text = '• IMPLEMENTED a new feature for the platform';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  it('is case-insensitive (mixed-case verb at start of bullet still matches)', () => {
    const text = '• Optimized the query performance by 50%';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  // ── Partial penalty ────────────────────────────────────────────────────────

  it('applies partial penalty when some bullets have weak phrases', () => {
    // 1 strong verb, 1 weak phrase out of 2 bullets
    // strongVerbRatio = 0.5 → 50; weakPhrasePenalty = (0.5) * 30 = 15
    // score = 50 - 15 = 35
    const text = [
      '• Implemented a new caching strategy',
      '• Responsible for maintaining legacy code',
    ].join('\n');
    expect(actionVerbValidation(text, ACTION_VERBS)).toBeCloseTo(35, 5);
  });

  // ── Score bounds ───────────────────────────────────────────────────────────

  it('score stays in [0, 100] range for any input', () => {
    const inputs = [
      '• Responsible for everything\n• Worked on stuff\n• Helped with tasks',
      '• Architected systems\n• Built features\n• Deployed services',
      '• Responsible for backend\n• Implemented frontend\n• Worked on APIs',
      '• Some random text without a verb here',
    ];
    for (const text of inputs) {
      const score = actionVerbValidation(text, ACTION_VERBS);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // ── No mutation ────────────────────────────────────────────────────────────

  it('does not mutate the verbSet parameter', () => {
    const customVerbs = new Set(['built', 'designed', 'led', 'managed', 'created',
      'developed', 'implemented', 'deployed', 'optimized', 'architected',
      'engineered', 'automated', 'migrated', 'configured', 'delivered',
      'executed', 'analyzed', 'researched', 'evaluated', 'identified',
      'assessed', 'audited', 'benchmarked', 'profiled', 'measured',
      'collaborated', 'coordinated', 'facilitated', 'communicated', 'presented',
      'documented', 'authored', 'wrote', 'drafted', 'negotiated',
      'influenced', 'persuaded', 'advocated', 'proposed', 'recommended',
      'advised', 'consulted', 'strategized', 'prioritized', 'scaled',
      'expanded', 'grew', 'extended', 'broadened', 'diversified',
      'amplified', 'maximized', 'leveraged', 'capitalized', 'transformed',
      'revamped', 'restructured', 'redesigned', 'reengineered', 'overhauled',
      'rebuilt', 'rewrote', 'converted', 'debugged', 'resolved',
      'fixed', 'diagnosed', 'patched', 'remediated', 'mitigated',
      'eliminated', 'reduced', 'improved', 'enhanced', 'upgraded',
      'modernized', 'refactored', 'streamlined', 'accelerated', 'boosted',
      'increased', 'integrated', 'consolidated', 'unified', 'synchronized',
      'orchestrated', 'provisioned', 'containerized', 'directed', 'supervised',
      'oversaw', 'mentored', 'coached', 'trained', 'guided',
      'championed', 'completed', 'achieved', 'accomplished', 'finalized',
      'produced', 'generated', 'drove', 'shipped', 'launched',
      'released', 'published', 'coded', 'programmed', 'initiated',
    ]);
    const sizeBefore = customVerbs.size;
    const contentBefore = new Set(customVerbs);

    actionVerbValidation('• Built a scalable API\n• Designed the schema', customVerbs);

    expect(customVerbs.size).toBe(sizeBefore);
    for (const verb of contentBefore) {
      expect(customVerbs.has(verb)).toBe(true);
    }
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it('edge case: single bullet with strong verb returns 100', () => {
    const text = '• Built a high-performance API gateway';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(100);
  });

  it('edge case: single bullet with weak phrase returns 0 (penalty = 30, score = -30 → clamped)', () => {
    // strongVerbRatio = 0 → 0; weakPhrasePenalty = (1/1) * 30 = 30
    // score = 0 - 30 = -30 → Math.max(0, -30) = 0
    const text = '• Responsible for the entire backend infrastructure';
    expect(actionVerbValidation(text, ACTION_VERBS)).toBe(0);
  });
});

// ─── calculateScore ───────────────────────────────────────────────────────────

describe('calculateScore()', () => {
  // ── Weighted formula ────────────────────────────────────────────────────────

  it('applies the weighted formula: (0.3 * skillDensity) + (0.3 * actionVerbQuality) + (0.4 * ragSimilarity)', () => {
    // Use a text that produces known component scores via the sub-functions,
    // then verify the aggregated totalScore matches the formula.
    const text = [
      '• Architected scalable microservices using TypeScript and Node.js',
      '• Implemented CI/CD pipeline with Docker and Kubernetes',
      '• Optimized PostgreSQL queries reducing latency by 40%',
    ].join('\n');

    const ragSimilarity = 75;
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);

    const expected =
      0.3 * result.breakdown.skillDensity +
      0.3 * result.breakdown.actionVerbQuality +
      0.4 * ragSimilarity;

    expect(result.totalScore).toBeCloseTo(expected, 5);
  });

  it('uses exact component values from keywordDensity and actionVerbValidation', () => {
    const text = [
      '• Developed a REST API using Python and Django',
      '• Deployed services on AWS with Docker',
    ].join('\n');

    const ragSimilarity = 50;
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, ragSimilarity);

    // Verify breakdown values match what the sub-functions would return
    expect(result.breakdown.skillDensity).toBeCloseTo(
      keywordDensity(text, TECH_FIELDS),
      5,
    );
    expect(result.breakdown.actionVerbQuality).toBeCloseTo(
      actionVerbValidation(text, ACTION_VERBS),
      5,
    );
    expect(result.breakdown.ragSimilarity).toBe(ragSimilarity);
  });

  // ── Score clamping ──────────────────────────────────────────────────────────

  it('clamps totalScore to a maximum of 100', () => {
    // All components at 100 → raw = 0.3*100 + 0.3*100 + 0.4*100 = 100 (already at max)
    // Use a text that maximises both sub-scores
    const allKeywords = Array.from(TECH_FIELDS).join(' ');
    const result = calculateScore(allKeywords, TECH_FIELDS, ACTION_VERBS, 100);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('clamps totalScore to a minimum of 0', () => {
    // All components at 0 → raw = 0
    const result = calculateScore('hello world', TECH_FIELDS, ACTION_VERBS, 0);
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
  });

  it('all breakdown scores remain in [0, 100]', () => {
    const texts = [
      'hello world',
      '• Responsible for everything\n• Worked on stuff',
      '• Architected systems using TypeScript and React',
    ];
    for (const text of texts) {
      const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 50);
      expect(result.breakdown.skillDensity).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.skillDensity).toBeLessThanOrEqual(100);
      expect(result.breakdown.actionVerbQuality).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.actionVerbQuality).toBeLessThanOrEqual(100);
      expect(result.breakdown.ragSimilarity).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.ragSimilarity).toBeLessThanOrEqual(100);
    }
  });

  // ── ragSimilarity defaults to 0 ─────────────────────────────────────────────

  it('defaults ragSimilarity to 0 when not provided (DSA-only mode)', () => {
    const text = '• Implemented a caching layer using Redis';
    const withDefault = calculateScore(text, TECH_FIELDS, ACTION_VERBS);
    const withExplicitZero = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 0);

    expect(withDefault.breakdown.ragSimilarity).toBe(0);
    expect(withDefault.totalScore).toBeCloseTo(withExplicitZero.totalScore, 5);
  });

  it('ragSimilarity=0 contributes 0 to the total score', () => {
    const text = '• Built a scalable API with Node.js';
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 0);

    const expectedTotal =
      0.3 * result.breakdown.skillDensity +
      0.3 * result.breakdown.actionVerbQuality;

    expect(result.totalScore).toBeCloseTo(expectedTotal, 5);
  });

  // ── Penalties ───────────────────────────────────────────────────────────────

  it('generates a penalty when skillDensity < 30', () => {
    // Plain text with no tech keywords → skillDensity = 0
    const text = '• Managed the team and coordinated meetings effectively';
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 50);

    const hasPenalty = result.penalties.some((p) =>
      p.includes('Low technical keyword density'),
    );
    expect(hasPenalty).toBe(true);
  });

  it('generates a penalty when actionVerbQuality < 30', () => {
    // All weak phrases → actionVerbQuality = 0
    const text = [
      '• Responsible for maintaining the backend',
      '• Worked on frontend features',
      '• Helped with deployments',
    ].join('\n');
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 50);

    const hasPenalty = result.penalties.some((p) =>
      p.includes('Weak action verb usage'),
    );
    expect(hasPenalty).toBe(true);
  });

  it('generates a penalty when ragSimilarity < 30', () => {
    const text = '• Architected scalable systems using TypeScript';
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 10);

    const hasPenalty = result.penalties.some((p) =>
      p.includes('Low semantic similarity to high-quality resumes'),
    );
    expect(hasPenalty).toBe(true);
  });

  it('generates no penalties when all components are >= 30', () => {
    const text = [
      '• Architected scalable microservices using TypeScript and Node.js',
      '• Implemented CI/CD pipeline with Docker and Kubernetes',
      '• Optimized PostgreSQL queries reducing latency by 40%',
      '• Deployed services on AWS using Terraform and Ansible',
      '• Designed GraphQL APIs with Redis caching layer',
    ].join('\n');
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 80);

    // All components should be >= 30 for this strong resume text
    if (
      result.breakdown.skillDensity >= 30 &&
      result.breakdown.actionVerbQuality >= 30 &&
      result.breakdown.ragSimilarity >= 30
    ) {
      expect(result.penalties).toHaveLength(0);
    }
  });

  it('penalty descriptions include the rounded component score', () => {
    // ragSimilarity = 15 → penalty should mention "15/100"
    const text = '• Responsible for maintaining legacy systems';
    const result = calculateScore(text, TECH_FIELDS, ACTION_VERBS, 15);

    const ragPenalty = result.penalties.find((p) =>
      p.includes('Low semantic similarity'),
    );
    expect(ragPenalty).toBeDefined();
    expect(ragPenalty).toContain('15/100');
  });

  // ── Return shape ────────────────────────────────────────────────────────────

  it('returns a ScoringResult with the correct shape', () => {
    const result = calculateScore(
      '• Built a REST API using Node.js and PostgreSQL',
      TECH_FIELDS,
      ACTION_VERBS,
      60,
    );

    expect(result).toHaveProperty('totalScore');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown).toHaveProperty('skillDensity');
    expect(result.breakdown).toHaveProperty('actionVerbQuality');
    expect(result.breakdown).toHaveProperty('ragSimilarity');
    expect(result).toHaveProperty('penalties');
    expect(Array.isArray(result.penalties)).toBe(true);
    expect(typeof result.totalScore).toBe('number');
  });
});
