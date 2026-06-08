/**
 * LLM Context Builder — constructs optimised prompts for Google Gemini
 * and generates feedback via the official @google/genai SDK.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 9.1, 9.2, 9.3, 11.4
 */

import type { LLMResponse, RAGMatch, ScoringResult } from '@/types';
import { LLMError } from '@/types/errors';
import { sanitiseResumeText } from '@/lib/security/promptInjection';
import { GoogleGenAI } from '@google/genai';

// 💎 THE CORRECT SYNTAX FOR THE MODERN SDK: Pass the raw string directly!
// Replace the old object constructor with a direct string initialization pass
// Note: TypeScript requires the options object signature: { apiKey: string }
const ai = new GoogleGenAI({
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
});

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_MESSAGE =
  "You are an elite, hyper-critical MNC technical interviewer. Provide absolute engineering honesty with zero corporate sugarcoating. " +
  "If the resume lacks impact or depth, detail deep constructive criticism. " +
  "Output exactly to the required JSON schema with no truncation.";

const MAX_RAG_MATCHES = 3;
const TOKEN_BUDGET = 3800;
const CHARS_PER_TOKEN = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatScoreBreakdown(scoreBreakdown: ScoringResult): string {
  const { breakdown, totalScore, penalties } = scoreBreakdown;
  const penaltiesText = penalties.length > 0 ? penalties.map((p) => `- ${p}`).join('\n') : '- None';
  return (
    `## Score Breakdown\n` +
    `- Skill Density: ${Math.round(breakdown.skillDensity)}/100\n` +
    `- Action Verb Quality: ${Math.round(breakdown.actionVerbQuality)}/100\n` +
    `- Semantic Similarity: ${Math.round(breakdown.ragSimilarity)}/100\n` +
    `- Total Score: ${Math.round(totalScore)}/100\n\n` +
    `Penalties:\n${penaltiesText}`
  );
}

function formatRAGContext(ragContext: RAGMatch[]): string {
  if (ragContext.length === 0) return '';
  const topMatches = ragContext.slice(0, MAX_RAG_MATCHES);
  const matchesText = topMatches.map((match, index) => `### Target Profile Benchmark ${index + 1}\n${match.text}`).join('\n\n');
  return `## Strict Benchmarking Thresholds (Top Profiles)\nEvaluate the resume against these high-quality targets:\n\n${matchesText}`;
}

function formatInstructions(missingKeywords: string[], experienceLevel: string): string {
  return (
    `## Instructions\n` +
    `Provide:\n` +
    `1. A legit, mathematically rigorous 'atsComplianceRating' score (0-100).\n` +
    `2. A raw, high-impact reality check and structural critique as 'feedback'.\n` +
    `3. A meticulous list of missing core competencies based on benchmarks as 'missingKeywords'.\n` +
    `4. Three highly advanced technical interview questions customized to the candidate's actual depth as 'interviewQuestions'.\n` +
    `   - Context: Candidate is assessed at '${experienceLevel}' level.\n` +
    `   - Context: Missing keywords: ${missingKeywords.join(', ') || 'None identified'}.\n` +
    `5. Specific, actionable STAR-method metric rewrites as 'starMethodSuggestions'.\n` +
    `   - Format the suggestions array items with keys strictly named 'original' and 'improved' (do NOT use 'rewrite').\n` +
    `Format your response strictly as a JSON object with keys: atsComplianceRating, feedback, starMethodSuggestions, missingKeywords, interviewQuestions.`
  );
}

// ─── buildPrompt ──────────────────────────────────────────────────────────────

export function buildPrompt(
  resume: string,
  ragContext: RAGMatch[],
  scoreBreakdown: ScoringResult,
  missingKeywords: string[],
  experienceLevel: string,
): string {
  const { sanitisedText } = sanitiseResumeText(resume);
  const scoreSection = formatScoreBreakdown(scoreBreakdown);
  const ragSection = formatRAGContext(ragContext);
  const instructionsSection = formatInstructions(missingKeywords, experienceLevel);

  const overheadText = SYSTEM_MESSAGE + scoreSection + ragSection + instructionsSection;
  const overheadTokens = estimateTokens(overheadText);
  const resumeTokenBudget = TOKEN_BUDGET - overheadTokens;

  let resumeText = sanitisedText;
  const maxResumeChars = resumeTokenBudget * CHARS_PER_TOKEN;
  if (sanitisedText.length > maxResumeChars) {
    resumeText = sanitisedText.slice(0, maxResumeChars);
  }

  const userMessageParts: string[] = [
    SYSTEM_MESSAGE,
    scoreSection,
  ];

  if (ragSection) userMessageParts.push(ragSection);
  userMessageParts.push(`## Resume to Analyze\n${resumeText}`);
  userMessageParts.push(instructionsSection);

  return userMessageParts.join('\n\n');
}

// ─── generateFeedback ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseLLMResponse(generatedText: string): LLMResponse {
  console.log("🤖 RAW LLM OUTPUT:", generatedText);
  const cleanedText = generatedText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (e) {
    throw new LLMError('Failed to parse LLM response into JSON schema');
  }

  if (typeof parsed.atsComplianceRating !== 'number' || typeof parsed.feedback !== 'string') {
    throw new LLMError('Invalid JSON schema returned');
  }

  // Map starMethodSuggestions to the internal starRecommendations if needed by tests/types
  return {
    atsComplianceRating: parsed.atsComplianceRating ?? 0,
    feedback: parsed.feedback ?? '',
    starMethodSuggestions: parsed.starMethodSuggestions || [],
    starRecommendations: parsed.starMethodSuggestions || parsed.starRecommendations || [],
    interviewQuestions: parsed.interviewQuestions || [],
    missingKeywords: parsed.missingKeywords || [],
  } as unknown as LLMResponse;
}

export async function generateFeedback(prompt: string): Promise<LLMResponse> {
  async function executeAnalysisRequest(): Promise<{ response: LLMResponse | null; retryAfterMs: number }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      });
      const generatedText = response.text;
      if (!generatedText) throw new Error('Empty response');
      return { response: parseLLMResponse(generatedText), retryAfterMs: 0 };
    } catch (sdkError: any) {
      console.error("❌ CORE INVOCATION EXCEPTION:", sdkError);
      if (sdkError.status === 429) return { response: null, retryAfterMs: 5000 };
      if (sdkError.status >= 500) return { response: null, retryAfterMs: 2000 };
      throw new LLMError(`Gemini API failed: ${sdkError.message}`, sdkError);
    }
  }

  const first = await executeAnalysisRequest();
  if (first.response !== null) return first.response;

  // Increase the cooling window so the free tier doesn't flag back-to-back calls
  console.log("⏳ Rate limit or spike detected. Cooling down thread for 6 seconds...");
  await sleep(6000);

  const second = await executeAnalysisRequest();
  if (second.response !== null) return second.response;
  throw new LLMError('Gemini API request failed after retry');
}

// ─── generateInterviewQuestions ───────────────────────────────────────────────

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 10;

function buildFallbackQuestions(jobRole: string): string[] {
  return [
    `Can you describe a time when you had to balance technical debt with delivering a feature on time for a ${jobRole} role?`,
    `How do you ensure code quality within your team as a ${jobRole}?`,
    `What is the most complex technical challenge you've solved recently in a ${jobRole} context?`
  ];
}

export async function generateInterviewQuestions(resume: string, jobRole: string): Promise<string[]> {
  const prompt = `You are an expert technical interviewer.\nGenerate exactly 3 to 10 highly advanced interview questions for a ${jobRole} role based on the following resume.\nRespond with a JSON array of strings only.\n\nResume:\n${resume}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      }
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '[]');
    } catch (e) {
      return buildFallbackQuestions(jobRole);
    }

    if (!Array.isArray(parsed)) return buildFallbackQuestions(jobRole);
    const questions = parsed.filter(q => typeof q === 'string');
    if (questions.length < MIN_QUESTIONS) return buildFallbackQuestions(jobRole);
    return questions.slice(0, MAX_QUESTIONS);
  } catch (sdkError: any) {
    console.error("❌ CORE INVOCATION EXCEPTION:", sdkError);
    return buildFallbackQuestions(jobRole);
  }
}

// ─── LLMContextBuilder ────────────────────────────────────────────────────────

export class LLMContextBuilder {
  constructor() {
    // Force this to ignore external input arguments entirely
  }

  buildPrompt(
    resume: string,
    ragContext: RAGMatch[],
    scoreBreakdown: ScoringResult,
    missingKeywords: string[],
    experienceLevel: string,
  ): string {
    return buildPrompt(resume, ragContext, scoreBreakdown, missingKeywords, experienceLevel);
  }

  async generateFeedback(prompt: string): Promise<LLMResponse> {
    // Force a direct bypass pass straight to the hardcoded global helper
    return generateFeedback(prompt);
  }

  async generateInterviewQuestions(resume: string, jobRole: string): Promise<string[]> {
    // Force a direct bypass pass straight to the hardcoded global helper
    return generateInterviewQuestions(resume, jobRole);
  }
}
