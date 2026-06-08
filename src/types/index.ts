/**
 * Core TypeScript interfaces for TalentGraph AI Resume Analyzer
 * Requirements: 1.5, 2.7, 5.2, 5.3, 8.5
 */

// ─── Scoring ─────────────────────────────────────────────────────────────────

export interface ScoringResult {
  totalScore: number;
  breakdown: {
    skillDensity: number;
    actionVerbQuality: number;
    ragSimilarity: number;
  };
  penalties: string[];
}

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

export interface ParsedResume {
  text: string;
  metadata: {
    pageCount: number;
    wordCount: number;
    extractedAt: Date;
  };
}

// ─── RAG / Vector Search ──────────────────────────────────────────────────────

export interface RAGMatch {
  id: string;
  score: number;
  metadata: {
    resumeType: string;
    industryTag: string;
    qualityRating: number;
  };
  text: string;
}

export interface VectorMetadata {
  resumeType: 'template' | 'user_submission';
  industryTag: string;
  qualityRating: number;
  techStack: string[];
  experienceYears: number;
  lastUpdated: Date;
}

export interface VectorRecord {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

// ─── LLM Feedback ─────────────────────────────────────────────────────────────

export interface STARRecommendation {
  original: string;
  improved: string;
  reasoning: string;
}

export interface LLMResponse {
  atsComplianceRating: number;
  feedback: string;
  starRecommendations: STARRecommendation[];
  interviewQuestions: string[];
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

export interface AnalysisMetadata {
  processingTimeMs: number;
  pdfPageCount: number;
  wordCount: number;
  techStackDetected: string[];
  missingKeywords?: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
}

export interface ResumeAnalysis {
  id: string;
  userId: string;
  fileName: string;
  uploadedAt: Date;
  parsedText: string;
  score: ScoringResult;
  ragMatches: RAGMatch[];
  llmFeedback: LLMResponse;
  metadata: AnalysisMetadata;
}

// ─── User / Auth ──────────────────────────────────────────────────────────────

export interface SubscriptionTier {
  tier: 'free' | 'premium' | 'enterprise';
  analysisLimit: number;
  analysisUsed: number;
  resetDate: Date;
}

export interface UserPreferences {
  theme: 'dark' | 'light';
  animationsEnabled: boolean;
  defaultJobRole: string;
  notificationsEnabled: boolean;
}

export interface UserSession {
  userId: string;
  email: string;
  createdAt: Date;
  analysisHistory: string[];
  subscription: SubscriptionTier;
  preferences: UserPreferences;
}
