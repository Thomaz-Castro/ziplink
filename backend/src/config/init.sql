-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Links table
CREATE TABLE IF NOT EXISTS links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug         VARCHAR(20) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,
  title        VARCHAR(512),
  clicks       BIGINT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical index: redirect lookup is the hottest path
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_active ON links(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_links_expires_at ON links(expires_at) WHERE expires_at IS NOT NULL;

-- Batch jobs table
CREATE TABLE IF NOT EXISTS batch_jobs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','completed','failed')),
  total          INT NOT NULL DEFAULT 0,
  processed      INT NOT NULL DEFAULT 0,
  success_count  INT NOT NULL DEFAULT 0,
  failure_count  INT NOT NULL DEFAULT 0,
  results        JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status  ON batch_jobs(status);

-- Click analytics table (append-only, partitioned by month in prod)
CREATE TABLE IF NOT EXISTS link_clicks (
  id         BIGSERIAL,
  link_id    UUID NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  referer    TEXT,
  user_agent TEXT,
  ip_hash    VARCHAR(64),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (clicked_at);

-- Create initial partition for current + next month
DO $$
DECLARE
  start_date DATE := DATE_TRUNC('month', NOW());
  end_date   DATE := DATE_TRUNC('month', NOW() + INTERVAL '2 months');
  part_name  TEXT;
BEGIN
  part_name := 'link_clicks_' || TO_CHAR(start_date, 'YYYY_MM');
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF link_clicks
     FOR VALUES FROM (%L) TO (%L)',
    part_name, start_date, start_date + INTERVAL '1 month'
  );
  part_name := 'link_clicks_' || TO_CHAR(start_date + INTERVAL '1 month', 'YYYY_MM');
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF link_clicks
     FOR VALUES FROM (%L) TO (%L)',
    part_name, start_date + INTERVAL '1 month', end_date
  );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id    ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_links_updated_at
  BEFORE UPDATE ON links FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_batch_jobs_updated_at
  BEFORE UPDATE ON batch_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
