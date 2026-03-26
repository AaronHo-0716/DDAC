CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TYPE user_role AS ENUM ('homeowner', 'handyman', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'blocked');
CREATE TYPE handyman_verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE job_category AS ENUM ('plumbing', 'electrical', 'carpentry', 'appliance_repair', 'general_maintenance');
CREATE TYPE job_status AS ENUM ('open', 'in_progress', 'completed');
CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE notification_type AS ENUM ('bid_received', 'bid_accepted', 'handyman_arriving', 'job_completed');
CREATE TYPE bid_tx_event_type AS ENUM (
  'created', 'updated', 'accepted', 'rejected', 'retracted',
  'force_rejected', 'locked', 'unlocked', 'flagged', 'unflagged'
);
CREATE TYPE admin_action_type AS ENUM (
  'block_user', 'unblock_user', 'approve_handyman', 'reject_handyman',
  'force_reject_bid', 'lock_bid', 'unlock_bid', 'flag_bid', 'unflag_bid',
  'assign_emergency_job'
);
CREATE TYPE admin_target_type AS ENUM ('user', 'job', 'bid', 'verification');


CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(320) NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  account_status account_status NOT NULL DEFAULT 'active',
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  rating NUMERIC(3,2),
  blocked_reason TEXT,
  blocked_at_utc TIMESTAMPTZ,
  blocked_by_user_id UUID REFERENCES users(id),
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT chk_users_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5))
);

CREATE TABLE refresh_tokens (
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

CREATE UNIQUE INDEX uq_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX ix_refresh_tokens_user_created ON refresh_tokens(user_id, created_at_utc DESC);


CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by_user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  category job_category NOT NULL,
  location_text VARCHAR(255) NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  budget NUMERIC(10,2),
  status job_status NOT NULL DEFAULT 'open',
  is_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_jobs_budget_nonnegative CHECK (budget IS NULL OR budget >= 0)
);

CREATE TABLE job_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  handyman_user_id UUID NOT NULL REFERENCES users(id),
  price NUMERIC(10,2) NOT NULL,
  estimated_arrival_utc TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  status bid_status NOT NULL DEFAULT 'pending',
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bids_price_positive CHECK (price > 0)
);

-- Optional business rule guard at DB layer: one active bid per handyman per job
CREATE UNIQUE INDEX uq_bids_job_handyman ON bids(job_id, handyman_user_id);

-- One accepted bid per job invariant
CREATE UNIQUE INDEX uq_bids_one_accepted_per_job
  ON bids(job_id)
  WHERE status = 'accepted';


CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE handyman_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status handyman_verification_status NOT NULL DEFAULT 'pending',
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at_utc TIMESTAMPTZ,
  notes TEXT,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_handyman_verifications_user UNIQUE (user_id)
);

CREATE TABLE bid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  handyman_user_id UUID NOT NULL REFERENCES users(id),
  homeowner_user_id UUID NOT NULL REFERENCES users(id),
  event_type bid_tx_event_type NOT NULL,
  event_by_user_id UUID REFERENCES users(id),
  event_reason TEXT,
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bid_locks (
  bid_id UUID PRIMARY KEY REFERENCES bids(id) ON DELETE CASCADE,
  locked_by_user_id UUID NOT NULL REFERENCES users(id),
  locked_reason TEXT,
  locked_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id),
  action_type admin_action_type NOT NULL,
  target_type admin_target_type NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX ix_users_role_status ON users(role, account_status);
CREATE INDEX ix_users_created ON users(created_at_utc DESC);

CREATE INDEX ix_jobs_status_category_emergency_created
  ON jobs(status, category, is_emergency, created_at_utc DESC);
CREATE INDEX ix_jobs_posted_by ON jobs(posted_by_user_id, created_at_utc DESC);

CREATE INDEX ix_bids_job_status_created ON bids(job_id, status, created_at_utc DESC);
CREATE INDEX ix_bids_handyman_status_created ON bids(handyman_user_id, status, created_at_utc DESC);

CREATE INDEX ix_notifications_user_read_created
  ON notifications(user_id, is_read, created_at_utc DESC);

CREATE INDEX ix_verifications_status_created
  ON handyman_verifications(status, created_at_utc DESC);

CREATE INDEX ix_bid_tx_bid_created ON bid_transactions(bid_id, created_at_utc DESC);
CREATE INDEX ix_bid_tx_job_created ON bid_transactions(job_id, created_at_utc DESC);
CREATE INDEX ix_bid_tx_event_type_created ON bid_transactions(event_type, created_at_utc DESC);

CREATE INDEX ix_admin_actions_actor_created ON admin_actions(admin_user_id, created_at_utc DESC);
CREATE INDEX ix_admin_actions_target ON admin_actions(target_type, target_id, created_at_utc DESC);
