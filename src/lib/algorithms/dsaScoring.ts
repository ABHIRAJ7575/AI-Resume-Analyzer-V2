/**
 * DSA Scoring Pipeline — keyword density scoring, action verb validation,
 * and score aggregation.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 14.1, 14.2, 14.3, 14.4
 */

// ─── Tech Fields ──────────────────────────────────────────────────────────────

/**
 * Set of 50+ technology keywords used for keyword density scoring.
 * All entries are lowercase so they can be compared directly against
 * the lowercased, cleaned words extracted from resume text.
 */
export const TECH_FIELDS = new Set<string>([
  // Languages
  'typescript',
  'javascript',
  'python',
  'java',
  'go',
  'rust',
  'c++',
  'c#',
  'ruby',
  'swift',
  'kotlin',
  'scala',
  'php',
  'elixir',
  'haskell',
  // Frontend frameworks / libraries
  'react',
  'vue',
  'angular',
  'svelte',
  'nextjs',
  'nuxt',
  'remix',
  'gatsby',
  // Styling
  'tailwindcss',
  'sass',
  'css',
  'html',
  // Build tools
  'webpack',
  'vite',
  'esbuild',
  'rollup',
  'turbopack',
  // Backend frameworks
  'nodejs',
  'express',
  'fastapi',
  'django',
  'flask',
  'spring',
  'rails',
  'nestjs',
  'hono',
  // Databases
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'sqlite',
  'elasticsearch',
  'cassandra',
  'dynamodb',
  'supabase',
  'firebase',
  'prisma',
  // Cloud / infrastructure
  'aws',
  'gcp',
  'azure',
  'docker',
  'kubernetes',
  'terraform',
  'ansible',
  'pulumi',
  'linux',
  'nginx',
  'serverless',
  // APIs / protocols
  'graphql',
  'rest',
  'grpc',
  'websockets',
  'trpc',
  // Messaging / streaming
  'kafka',
  'rabbitmq',
  'sqs',
  'pubsub',
  // Auth / security
  'oauth',
  'jwt',
  'saml',
  // Testing
  'jest',
  'vitest',
  'cypress',
  'playwright',
  'pytest',
  // Data / ML
  'sql',
  'nosql',
  'pandas',
  'numpy',
  'tensorflow',
  'pytorch',
  // DevOps / practices
  'git',
  'cicd',
  'microservices',
  'agile',
  'scrum',
  'devops',
]);

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * Calculate a keyword density score for the given resume text.
 *
 * Algorithm (from design doc):
 *  1. Split text to lowercase words.
 *  2. Use a Map to count occurrences of each tech keyword found.
 *  3. densityScore = (totalTechMentions / wordCount) * 100
 *  4. diversityBonus = Math.min(uniqueTechCount * 2, 30)
 *  5. return Math.min(densityScore + diversityBonus, 100)
 *
 * Preconditions:
 *  - `text` is a non-empty string.
 *  - `techFields` is a non-empty Set with size >= 50.
 *
 * Postconditions:
 *  - Returns a number in [0, 100].
 *  - Score is normalised by word count to prevent gaming via repetition.
 *  - Diversity bonus is capped at 30 points.
 *  - Neither input parameter is mutated.
 *
 * Requirements: 2.1, 2.4, 14.3
 */
export function keywordDensity(
  text: string,
  techFields: Set<string>,
): number {
  const words = text.toLowerCase().split(/\s+/);
  const wordCount = words.length;

  if (wordCount === 0) return 0;

  // Map<keyword, occurrenceCount> — O(n) single pass
  const techFieldMap = new Map<string, number>();

  for (const word of words) {
    // Strip punctuation while preserving characters meaningful in tech names
    // (e.g. "c++" → "c++", "node.js" → "nodejs", "ci/cd" → "cicd")
    const cleaned = word.replace(/[^a-z0-9+#]/g, '');

    if (techFields.has(cleaned)) {
      techFieldMap.set(cleaned, (techFieldMap.get(cleaned) ?? 0) + 1);
    }
  }

  const uniqueTechCount = techFieldMap.size;
  const totalTechMentions = Array.from(techFieldMap.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Normalise by total word count to prevent score gaming via repetition
  const densityScore = (totalTechMentions / wordCount) * 100;

  // Reward breadth of technical vocabulary, capped at 30 points
  const diversityBonus = Math.min(uniqueTechCount * 2, 30);

  return Math.min(densityScore + diversityBonus, 100);
}

// ─── Action Verbs ─────────────────────────────────────────────────────────────

/**
 * Set of 100+ strong action verbs used for action verb validation scoring.
 * All entries are lowercase for direct comparison against lowercased bullet
 * point first words.
 *
 * Requirements: 2.2, 2.5, 14.4
 */
export const ACTION_VERBS = new Set<string>([
  // Architecture & Engineering
  'architected',
  'engineered',
  'designed',
  'built',
  'constructed',
  'established',
  'founded',
  'pioneered',
  'spearheaded',
  'initiated',
  // Development & Implementation
  'implemented',
  'developed',
  'created',
  'coded',
  'programmed',
  'deployed',
  'launched',
  'shipped',
  'released',
  'published',
  // Optimization & Improvement
  'optimized',
  'improved',
  'enhanced',
  'upgraded',
  'modernized',
  'refactored',
  'streamlined',
  'accelerated',
  'boosted',
  'increased',
  // Automation & Integration
  'automated',
  'integrated',
  'migrated',
  'consolidated',
  'unified',
  'synchronized',
  'orchestrated',
  'configured',
  'provisioned',
  'containerized',
  // Leadership & Management
  'led',
  'managed',
  'directed',
  'supervised',
  'oversaw',
  'mentored',
  'coached',
  'trained',
  'guided',
  'championed',
  // Delivery & Execution
  'delivered',
  'executed',
  'completed',
  'achieved',
  'accomplished',
  'finalized',
  'shipped',
  'produced',
  'generated',
  'drove',
  // Transformation & Change
  'transformed',
  'revamped',
  'restructured',
  'redesigned',
  'reengineered',
  'overhauled',
  'rearchitected',
  'rebuilt',
  'rewrote',
  'converted',
  // Debugging & Resolution
  'debugged',
  'resolved',
  'fixed',
  'diagnosed',
  'troubleshot',
  'patched',
  'remediated',
  'mitigated',
  'eliminated',
  'reduced',
  // Analysis & Research
  'analyzed',
  'researched',
  'evaluated',
  'identified',
  'assessed',
  'investigated',
  'audited',
  'benchmarked',
  'profiled',
  'measured',
  // Collaboration & Communication
  'collaborated',
  'coordinated',
  'facilitated',
  'communicated',
  'presented',
  'documented',
  'authored',
  'wrote',
  'drafted',
  'published',
  // Negotiation & Influence
  'negotiated',
  'influenced',
  'persuaded',
  'advocated',
  'proposed',
  'recommended',
  'advised',
  'consulted',
  'strategized',
  'prioritized',
  // Scaling & Growth
  'scaled',
  'expanded',
  'grew',
  'extended',
  'broadened',
  'diversified',
  'amplified',
  'maximized',
  'leveraged',
  'capitalized',
]);

// ─── Weak Phrases ─────────────────────────────────────────────────────────────

/**
 * Set of weak phrases that indicate passive or vague descriptions.
 * Used to apply score penalties when detected at the start of bullet points.
 * All entries are lowercase.
 *
 * Requirements: 2.6, 14.4
 */
export const WEAK_PHRASES = new Set<string>([
  'responsible for',
  'worked on',
  'helped with',
  'assisted in',
  'involved in',
  'participated in',
  'contributed to',
  'tasked with',
  'duties included',
  'was responsible',
  'helped to',
  'assisted with',
  'worked with',
  'part of',
  'member of',
  'supported the',
  'helped the',
  'worked alongside',
  'was involved',
  'took part',
]);

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * Validate action verb usage in resume bullet points and return a quality score.
 *
 * Algorithm (from design doc):
 *  1. Split text by newlines, filter for bullet points (lines starting with
 *     •, -, *, or digit+.).
 *  2. For each bullet: strip marker, lowercase, get first word.
 *  3. Check if first word is in verbSet (strong verb) OR line starts with a
 *     weak phrase.
 *  4. strongVerbRatio = strongVerbCount / bulletPoints.length
 *  5. weakPhrasePenalty = (weakPhraseCount / bulletPoints.length) * 30
 *  6. score = (strongVerbRatio * 100) - weakPhrasePenalty
 *  7. return Math.max(0, Math.min(score, 100))
 *
 * Preconditions:
 *  - `text` is a non-empty string.
 *  - `verbSet` is a non-empty Set with size >= 100.
 *
 * Postconditions:
 *  - Returns a number in [0, 100].
 *  - Penalizes weak phrases by up to 30 points.
 *  - Rewards strong action verbs at bullet start.
 *  - Neither input parameter is mutated.
 *  - Returns 0 when no bullet points are detected.
 *
 * Requirements: 2.2, 2.5, 2.6, 14.4
 */
export function actionVerbValidation(
  text: string,
  verbSet: Set<string>,
): number {
  // Step 1: Detect bullet points — lines starting with •, -, *, or digit+.
  const bulletPoints = text.split(/\n/).filter((line) =>
    line.trim().match(/^[•\-*]/) || line.trim().match(/^\d+\./)
  );

  if (bulletPoints.length === 0) return 0;

  let strongVerbCount = 0;
  let weakPhraseCount = 0;

  for (const bullet of bulletPoints) {
    // Step 2: Strip bullet marker, trim, lowercase.
    // Handles: •, -, * (single char) and numbered markers like "1.", "12."
    const cleaned = bullet
      .replace(/^\s*(\d+\.|[•\-*])\s*/, '')
      .trim()
      .toLowerCase();

    // Step 3a: Check for weak phrase at start of bullet
    let hasWeakPhrase = false;
    for (const phrase of WEAK_PHRASES) {
      if (cleaned.startsWith(phrase)) {
        weakPhraseCount++;
        hasWeakPhrase = true;
        break;
      }
    }

    // Step 3b: Check if first word is a strong verb (only if no weak phrase)
    if (!hasWeakPhrase) {
      const firstWord = cleaned.split(/\s+/)[0];
      if (firstWord && verbSet.has(firstWord)) {
        strongVerbCount++;
      }
    }
  }

  // Steps 4–7: Compute score
  const strongVerbRatio = strongVerbCount / bulletPoints.length;
  const weakPhrasePenalty = (weakPhraseCount / bulletPoints.length) * 30;

  const score = strongVerbRatio * 100 - weakPhrasePenalty;

  return Math.max(0, Math.min(score, 100));
}

// ─── Score Aggregation ────────────────────────────────────────────────────────

/**
 * Aggregate all DSA scoring components into a single `ScoringResult`.
 *
 * Algorithm (from design doc):
 *  1. Call keywordDensity(text, techFields) → skillDensity
 *  2. Call actionVerbValidation(text, verbSet) → actionVerbQuality
 *  3. ragSimilarity defaults to 0 when not provided (DSA-only mode)
 *  4. totalScore = (0.3 * skillDensity) + (0.3 * actionVerbQuality) + (0.4 * ragSimilarity)
 *  5. Clamp totalScore to [0, 100]
 *  6. Build penalties array:
 *     - If skillDensity < 30: "Low technical keyword density (score: X/100)"
 *     - If actionVerbQuality < 30: "Weak action verb usage (score: X/100)"
 *     - If ragSimilarity < 30: "Low semantic similarity to high-quality resumes (score: X/100)"
 *  7. Return ScoringResult with totalScore, breakdown, penalties
 *
 * Preconditions:
 *  - `text` is a non-empty string with length > 0
 *  - `techFields` contains valid technology keywords (size >= 50)
 *  - `verbSet` contains valid action verbs (size >= 100)
 *  - `ragSimilarity`, when provided, is a number in [0, 100]
 *
 * Postconditions:
 *  - Returns `ScoringResult` with `totalScore` in range [0, 100]
 *  - `breakdown.skillDensity` in range [0, 100]
 *  - `breakdown.actionVerbQuality` in range [0, 100]
 *  - `breakdown.ragSimilarity` in range [0, 100]
 *  - `totalScore = (0.3 * skillDensity) + (0.3 * actionVerbQuality) + (0.4 * ragSimilarity)`
 *  - `penalties` array contains descriptive strings for each low component
 *  - Neither input parameter is mutated
 *
 * Requirements: 2.3, 2.7, 14.1, 14.2
 */
export function calculateScore(
  text: string,
  techFields: Set<string>,
  verbSet: Set<string>,
  ragSimilarity: number = 0,
): import('../../types/index').ScoringResult {
  // Step 1 & 2: Compute component scores
  const skillDensity = keywordDensity(text, techFields);
  const actionVerbQuality = actionVerbValidation(text, verbSet);

  // Step 3: ragSimilarity already defaults to 0 via parameter default

  // Step 4: Apply weighted formula
  const rawTotal =
    0.3 * skillDensity + 0.3 * actionVerbQuality + 0.4 * ragSimilarity;

  // Step 5: Clamp to [0, 100]
  const totalScore = Math.max(0, Math.min(rawTotal, 100));

  // Step 6: Build penalties for low-scoring components
  const penalties: string[] = [];

  if (skillDensity < 30) {
    penalties.push(
      `Low technical keyword density (score: ${Math.round(skillDensity)}/100)`,
    );
  }

  if (actionVerbQuality < 30) {
    penalties.push(
      `Weak action verb usage (score: ${Math.round(actionVerbQuality)}/100)`,
    );
  }

  if (ragSimilarity < 30) {
    penalties.push(
      `Low semantic similarity to high-quality resumes (score: ${Math.round(ragSimilarity)}/100)`,
    );
  }

  // Step 7: Return ScoringResult
  return {
    totalScore,
    breakdown: {
      skillDensity,
      actionVerbQuality,
      ragSimilarity,
    },
    penalties,
  };
}
