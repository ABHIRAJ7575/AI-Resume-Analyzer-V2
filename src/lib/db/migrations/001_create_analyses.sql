-- TalentGraph AI Resume Analyzer — Migration 001: Create analyses table
-- Requirements: 5.5, 8.5, 11.1

-- ─── analyses table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_text TEXT NOT NULL,
  score JSONB NOT NULL,
  rag_matches JSONB NOT NULL DEFAULT '[]',
  llm_feedback JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes for query performance ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_uploaded_at ON analyses(uploaded_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own analyses
CREATE POLICY "Users can only access their own analyses"
  ON analyses FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));
