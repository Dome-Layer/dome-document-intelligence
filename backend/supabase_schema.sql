-- Run this in your Supabase SQL editor to set up the Document Intelligence schema.

-- Governance rules (per-user, seeded on first /api/rules request)
CREATE TABLE IF NOT EXISTS governance_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES auth.users ON DELETE CASCADE,
    rule_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    severity    TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    enabled     BOOLEAN DEFAULT TRUE,
    config      JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, rule_id)
);

-- Governance audit log (metadata only — no document content ever stored)
CREATE TABLE IF NOT EXISTS governance_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL,
    action_type     TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    input_hash      TEXT NOT NULL,
    input_type      TEXT NOT NULL,
    output_summary  TEXT NOT NULL,
    rules_applied   TEXT[] DEFAULT '{}',
    rules_triggered TEXT[] DEFAULT '{}',
    confidence      FLOAT,
    human_in_loop   TEXT,
    user_id         UUID REFERENCES auth.users ON DELETE SET NULL,
    metadata        JSONB DEFAULT '{}'
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_governance_rules_user_id ON governance_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_governance_events_user_id ON governance_events (user_id);
CREATE INDEX IF NOT EXISTS idx_governance_events_timestamp ON governance_events (timestamp DESC);

-- Row Level Security (recommended — backend uses service_role key which bypasses RLS)
ALTER TABLE governance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;
