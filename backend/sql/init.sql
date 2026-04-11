CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Replaced enum types with VARCHAR for simplicity
-- Previous enums:
-- user_role: 'homeowner', 'handyman', 'admin'
-- account_status: 'active', 'blocked'
-- handyman_verification_status: 'pending', 'approved', 'rejected'
-- job_category: 'plumbing', 'electrical', 'carpentry', 'appliance_repair', 'general_maintenance'
-- job_status: 'open', 'in_progress', 'completed'
-- bid_status: 'pending', 'accepted', 'rejected'
-- notification_type: 'bid_received', 'bid_accepted', 'handyman_arriving', 'job_completed'
-- bid_tx_event_type: 'created', 'updated', 'accepted', 'rejected', 'retracted', 'force_rejected', 'locked', 'unlocked', 'flagged', 'unflagged'
-- admin_action_type: 'block_user', 'unblock_user', 'approve_handyman', 'reject_handyman', 'force_reject_bid', 'lock_bid', 'unlock_bid', 'flag_bid', 'unflag_bid', 'assign_emergency_job'
-- admin_target_type: 'user', 'job', 'bid', 'verification'

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  account_status BOOLEAN NOT NULL DEFAULT TRUE,
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  rating NUMERIC(3,2),
  blocked_reason TEXT,
  blocked_at_utc TIMESTAMPTZ,
  blocked_by_user_id UUID REFERENCES users(id),
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_version INT NOT NULL DEFAULT 1,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at_utc TIMESTAMPTZ NOT NULL,
  revoked_at_utc TIMESTAMPTZ,
  replaced_by_token_hash TEXT,
  user_agent TEXT,
  ip_address VARCHAR(64),
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_created ON refresh_tokens(user_id, created_at_utc DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by_user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  location_text VARCHAR(255) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  budget NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_jobs_budget_nonnegative CHECK (budget IS NULL OR budget >= 0)
);

CREATE TABLE IF NOT EXISTS job_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  handyman_user_id UUID NOT NULL REFERENCES users(id),
  price NUMERIC(10,2) NOT NULL,
  estimated_arrival_utc TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bids_price_positive CHECK (price > 0)
);

-- Optional business rule guard at DB layer: one active bid per handyman per job
CREATE UNIQUE INDEX IF NOT EXISTS uq_bids_job_handyman ON bids(job_id, handyman_user_id);

-- One accepted bid per job invariant
CREATE UNIQUE INDEX IF NOT EXISTS uq_bids_one_accepted_per_job
  ON bids(job_id)
  WHERE status = 'accepted';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handyman_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at_utc TIMESTAMPTZ,
  notes TEXT,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_handyman_verifications_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS bid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  handyman_user_id UUID NOT NULL REFERENCES users(id),
  homeowner_user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  event_by_user_id UUID REFERENCES users(id),
  event_reason TEXT,
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bid_locks (
  bid_id UUID PRIMARY KEY REFERENCES bids(id) ON DELETE CASCADE,
  locked_by_user_id UUID NOT NULL REFERENCES users(id),
  locked_reason TEXT,
  locked_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_role_status ON users(role, account_status);
CREATE INDEX IF NOT EXISTS ix_users_created ON users(created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_jobs_status_category_emergency_created
  ON jobs(status, category, is_emergency, created_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_jobs_posted_by ON jobs(posted_by_user_id, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_bids_job_status_created ON bids(job_id, status, created_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_bids_handyman_status_created ON bids(handyman_user_id, status, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_notifications_user_read_created
  ON notifications(user_id, is_read, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_verifications_status_created
  ON handyman_verifications(status, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_bid_tx_bid_created ON bid_transactions(bid_id, created_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_bid_tx_job_created ON bid_transactions(job_id, created_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_bid_tx_event_type_created ON bid_transactions(event_type, created_at_utc DESC);

CREATE INDEX IF NOT EXISTS ix_admin_actions_actor_created ON admin_actions(admin_user_id, created_at_utc DESC);
CREATE INDEX IF NOT EXISTS ix_admin_actions_target ON admin_actions(target_type, target_id, created_at_utc DESC);
