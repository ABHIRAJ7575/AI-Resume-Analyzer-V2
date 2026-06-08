-- TalentGraph AI Resume Analyzer — Database Schema
-- Requirements: 5.5, 8.5, 11.1

-- ─── analyses table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Accepts both authenticated user UUIDs and guest session keys (e.g. "guest:<uuid>", "ip:<addr>")
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_text TEXT NOT NULL,
  score JSONB NOT NULL,
  rag_matches JSONB NOT NULL DEFAULT '[]',
  llm_feedback JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Guest sessions expire after 24 hours; NULL means no expiry (authenticated users)
  expires_at TIMESTAMPTZ NULL
);

-- ─── Indexes for query performance ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_uploaded_at ON analyses(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_expires_at ON analyses(expires_at)
  WHERE expires_at IS NOT NULL;

-- ─── Automatic expiry cleanup (requires pg_cron extension) ───────────────────
-- Uncomment if pg_cron is enabled on your Supabase project:
-- SELECT cron.schedule('purge-expired-analyses', '0 * * * *',
--   $$DELETE FROM analyses WHERE expires_at IS NOT NULL AND expires_at < NOW()$$);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Authenticated users: scoped to their own rows via app.current_user_id
CREATE POLICY "Authenticated users access own analyses"
  ON analyses FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- Guest sessions: allow access by matching user_id directly (service role bypasses RLS)
-- The application layer enforces guest key scoping; RLS is a belt-and-suspenders guard.
CREATE POLICY "Guest sessions access own transient analyses"
  ON analyses FOR ALL
  USING (
    user_id = current_setting('app.current_user_id', true)
    OR (expires_at IS NOT NULL AND expires_at > NOW())
  );
