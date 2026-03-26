# NeighborHelp Backend Implementation Plan (ASP.NET Core .NET 8)

## 1. Goals and Scope

NeighborHelp backend should provide a secure, scalable API for:
- Authentication and role-based authorization (`homeowner`, `handyman`, `admin`)
- Job posting and discovery
- Bid lifecycle management
- Notification events and read state
- Admin moderation and metrics
- Support for current frontend contracts in `app/types/index.ts`

Non-goals for v1:
- Real-time chat (defer to v1.1)
- AI recommendation engine (defer to v1.2)
- Multi-language localization

## 2. Recommended Stack

- Framework: ASP.NET Core 8 Web API
- Language: C# 12
- ORM: Entity Framework Core 9
- Database: PostgreSQL (AWS RDS in production)
- PostgreSQL driver/provider: Npgsql + EFCore.PG
- Auth: JWT access token + refresh token rotation
- Validation: FluentValidation
- Logging: Serilog + Seq (or ELK)
- Background jobs: Hangfire (for cleanup, digest notifications)
- API docs: Swagger / OpenAPI
- Caching: Redis (optional in v1, recommended in v1.1)
- Object storage for job photos: Amazon S3 (or MinIO for local development)

## 3. Project Structure

```text
NeighborHelp.Api/
  src/
    NeighborHelp.Api/                 # API host (controllers/endpoints, middleware)
    NeighborHelp.Application/         # Use cases, DTOs, interfaces, validators
    NeighborHelp.Domain/              # Entities, enums, domain rules
    NeighborHelp.Infrastructure/      # EF Core, repositories, external services
    NeighborHelp.Contracts/           # Public request/response models (versioned)
  tests/
    NeighborHelp.UnitTests/
    NeighborHelp.IntegrationTests/
```

Architecture style:
- Clean architecture / vertical slices
- Domain logic isolated from transport and persistence
- CQRS-lite (handlers for complex operations, keep simple CRUD straightforward)

## 4. Core Domain Model

## 4.1 Users

Fields:
- `Id` (GUID)
- `Name`
- `Email` (unique)
- `PasswordHash`
- `Role` (`Homeowner`, `Handyman`, `Admin`)
- `AvatarUrl` (nullable)
- `Rating` (nullable decimal)
- `CreatedAtUtc`
- `UpdatedAtUtc`
- `IsActive`

## 4.2 Jobs

Fields:
- `Id` (GUID)
- `Title`
- `Description`
- `Category` (`Plumbing`, `Electrical`, `Carpentry`, `ApplianceRepair`, `GeneralMaintenance`)
- `LocationText`
- `Latitude` / `Longitude` (optional v1, recommended)
- `Budget` (nullable decimal)
- `Status` (`Open`, `InProgress`, `Completed`)
- `IsEmergency` (bool)
- `PostedByUserId` (FK -> Users)
- `CreatedAtUtc`
- `UpdatedAtUtc`

Related:
- `JobImages` (1:n)
- `Bids` (1:n)

`JobImages` persistence model (recommended):
- `Id` (GUID)
- `JobId` (FK -> Jobs)
- `S3Key` (string, unique per object)
- `PublicUrl` (or pre-signed URL generated at read time)
- `ContentType`
- `SizeBytes`
- `CreatedAtUtc`

Important: image binary data is not stored in PostgreSQL. Database stores only S3 object metadata and references.

## 4.3 Bids

Fields:
- `Id` (GUID)
- `JobId` (FK)
- `HandymanUserId` (FK)
- `Price` (decimal)
- `EstimatedArrivalUtc` (datetime)
- `Message`
- `Status` (`Pending`, `Accepted`, `Rejected`)
- `IsRecommended` (bool; computed in service)
- `CreatedAtUtc`
- `UpdatedAtUtc`

Rules:
- One accepted bid per job
- Only job owner can accept/reject
- Handyman cannot bid on own job

## 4.4 Notifications

Fields:
- `Id` (GUID)
- `UserId` (FK)
- `Type` (`BidReceived`, `BidAccepted`, `HandymanArriving`, `JobCompleted`)
- `Message`
- `RelatedJobId` (nullable)
- `IsRead`
- `CreatedAtUtc`

## 4.5 Refresh Tokens

Fields:
- `Id` (GUID)
- `UserId` (FK)
- `TokenHash`
- `ExpiresAtUtc`
- `RevokedAtUtc` (nullable)
- `CreatedAtUtc`
- `ReplacedByTokenHash` (nullable)
- `UserAgent` / `IpAddress` (optional)

## 5. API Surface (v1)

Base path: `/api`

## 5.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/admin/login`
- `POST /api/auth/admin/force-reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Responses should match frontend contracts:
- `AuthResponse`: `{ user, tokens }`
- `User`: include `role`, `rating`, `avatarUrl`

Admin account provisioning:
- Seed one bootstrap admin account during environment initialization.
- Set `MustResetPassword=true` for bootstrap admin account.
- Disallow public self-registration for admin role.

## 5.2 Jobs

- `GET /api/jobs`
  - Query: `page`, `pageSize`, `category`, `status`, `search`, `isEmergency`, `maxDistanceKm`
- `GET /api/jobs/my`
- `GET /api/jobs/{id}`
- `POST /api/jobs`
- `PUT /api/jobs/{id}`
- `DELETE /api/jobs/{id}`

Rules:
- Create/update/delete only by homeowner who owns job
- Handyman can read open jobs
- Admin can read/manage all

## 5.3 Bids

- `GET /api/jobs/{jobId}/bids`
- `POST /api/jobs/{jobId}/bids`
- `PATCH /api/bids/{bidId}/accept`
- `PATCH /api/bids/{bidId}/reject`
- `DELETE /api/bids/{bidId}`

Rules:
- Bid creation only by handyman
- Accept/reject only by job owner
- On accept: mark all other pending bids as rejected in one transaction

## 5.4 Notifications

- `GET /api/notifications`
- `PATCH /api/notifications/{id}/read`
- `PATCH /api/notifications/read-all`

## 5.5 Admin (v1)

- `GET /api/admin/overview`
- `GET /api/admin/handymen/pending-verification`
- `PATCH /api/admin/handymen/{id}/approve`
- `PATCH /api/admin/handymen/{id}/reject`
- `GET /api/admin/jobs/emergency`
- `PATCH /api/admin/jobs/{id}/assign`

Bid transaction administration:
- `GET /api/admin/bid-transactions`
- `GET /api/admin/bid-transactions/{bidId}`
- `PATCH /api/admin/bid-transactions/{bidId}/force-reject`
- `PATCH /api/admin/bid-transactions/{bidId}/lock`
- `PATCH /api/admin/bid-transactions/{bidId}/flag`

User administration:
- `GET /api/admin/users`
- `GET /api/admin/users/{id}`
- `PATCH /api/admin/users/{id}/block`
- `PATCH /api/admin/users/{id}/unblock`

Audit:
- `GET /api/admin/audit-log`

Access: `Admin` role only.

## 5.6 File Uploads

- `POST /api/uploads/job-image` (multipart/form-data)
- Store file in Amazon S3
- Return: public URL (or object URL) and S3 object key

Server-side validation:
- MIME type allowlist
- max file size (10 MB)
- antivirus scan hook (stub for v1, real scanner in v1.1)

## 6. Security and Authorization

Authentication:
- Access token JWT (short-lived, e.g. 15 min)
- Refresh token (7-30 days) with rotation and revocation

Authorization policies:
- `RequireRole(Homeowner)`
- `RequireRole(Handyman)`
- `RequireRole(Admin)`
- Resource ownership checks in handlers

Security controls:
- BCrypt/Argon2 for password hashing
- Rate limiting on login/register endpoints
- CORS restricted to frontend origins
- Standard headers (CSP, X-Content-Type-Options, X-Frame-Options)
- Input validation and output encoding

## 7. Error Contract

Use consistent problem details (align with frontend `ApiError`):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": {
    "email": ["Email is invalid"]
  }
}
```

Also support RFC7807 `application/problem+json` for interoperability.

## 8. Data Access and Migrations

- EF Core Code-First migrations
- Production database target: AWS RDS for PostgreSQL (Multi-AZ recommended for production)
- Use separate RDS instances or schemas per environment (`dev`, `staging`, `prod`)
- Enforce SSL/TLS in production DB connections (`Ssl Mode=Require;Trust Server Certificate=false`)
- v1 payment note: no in-app payment mechanism; admin transaction scope is bidding only.
- Image storage model: store images in S3 and persist only `JobImages` references/metadata in PostgreSQL.
- Add indices for common filters:
  - `Jobs(Status, Category, IsEmergency, CreatedAtUtc)`
  - `Bids(JobId, Status)`
  - `Notifications(UserId, IsRead, CreatedAtUtc)`
  - `JobImages(JobId, CreatedAtUtc)`
- Add admin/moderation tables:
  - `HandymanVerifications` (`UserId`, `Status`, `ReviewedByUserId`, `ReviewedAtUtc`, `Notes`)
  - `BidTransactions` (immutable event ledger: `BidId`, `JobId`, `EventType`, `EventByUserId`, `EventReason`, `EventMetadata`, `CreatedAtUtc`)
  - `AdminActions` (`AdminUserId`, `ActionType`, `TargetType`, `TargetId`, `Reason`, `Payload`, `CreatedAtUtc`)
- Extend `Users` table:
  - `AccountStatus` (`Active`, `Blocked`)
  - `BlockedAtUtc`, `BlockedReason`, `BlockedByUserId`
  - `MustResetPassword` (for seeded bootstrap admin)
- Soft delete only where needed (v1 can use hard delete for bids/jobs if business allows)

Integrity rules:
- Blocked users cannot login or create/update jobs/bids.
- Every admin mutation must append one `AdminActions` row.
- Every bid moderation action must append one `BidTransactions` row.

## 9. Observability

- Structured logs with correlation ID per request
- Metrics:
  - request latency, error rates, auth failures
  - bid conversion rate
  - average time-to-first-bid
- Health endpoints:
  - `GET /health/live`
  - `GET /health/ready`

## 10. Containerization and Environment

Required env vars:
- `ASPNETCORE_URLS=http://+:5000`
- `ConnectionStrings__DefaultConnection=Host=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASSWORD};Ssl Mode=${DB_SSL_MODE};Trust Server Certificate=${DB_TRUST_SERVER_CERT}`
- `Jwt__Issuer`
- `Jwt__Audience`
- `Jwt__SigningKey`
- `Jwt__AccessTokenMinutes=15`
- `Jwt__RefreshTokenDays=14`
- `Storage__Provider=S3|Local`
- `Storage__BucketName`
- `Storage__ObjectPrefix=job-images` (optional)
- `AWS__Region`
- `AWS__AccessKeyId` (local/dev only; prefer IAM role in AWS)
- `AWS__SecretAccessKey` (local/dev only; prefer IAM role in AWS)

Containerization notes:
- Build and run API as a stateless .NET 8 container image (multi-stage Dockerfile)
- Keep API container independent from database container in production (RDS is managed externally)
- Use a local PostgreSQL container only for local development/integration testing
- Expose only API port to frontend/reverse proxy
- Apply migration using a startup migration gate or a separate one-off migration job in CI/CD
- Pass secrets via AWS Secrets Manager/SSM Parameter Store (not hardcoded env files in production)
- Add readiness/liveness probes for orchestrated deployment (ECS, EKS, or App Runner)

Example local development `docker-compose` services:
- `api` (.NET 8 Web API container)
- `postgres` (PostgreSQL container with persistent volume)
- `seq` (optional structured log viewer)

Example production deployment topology:
- API container(s): ECS Fargate service (or EKS deployment)
- Database: AWS RDS PostgreSQL
- Object storage: Amazon S3
- Secret/config management: AWS Secrets Manager + Parameter Store
- Ingress: Application Load Balancer + HTTPS (ACM certificate)

## 11. Development Roadmap

## Phase 1 (MVP, 2-3 weeks)
- Auth endpoints + JWT/refresh
- Jobs CRUD + listing filters
- Bids create/list/accept/reject
- Notification generation on bid/accept events
- Swagger, validation, integration tests for critical flows

## Phase 2 (Admin + polish, 1-2 weeks)
- Admin endpoints and moderation tools
- File uploads + image URLs in job payload
- Better observability and error dashboards
- Security hardening and rate limits

## Phase 3 (Post-MVP)
- Real-time notifications (SignalR)
- In-app chat between homeowner and handyman
- Recommendation engine for `IsRecommended`
- Redis caching and queue-based async workflows

## 12. Testing Strategy

Unit tests:
- domain rules (one accepted bid per job, ownership checks)

Integration tests (with Testcontainers PostgreSQL):
- register/login/refresh/logout
- create job -> submit bid -> accept bid -> notifications generated
- forbidden access for wrong roles

Contract tests:
- Ensure payload shape remains compatible with frontend `app/types/index.ts`

## 13. Backend-to-Frontend Mapping Checklist

Must match existing frontend expectations:
- Auth response includes `user` and `tokens`
- Job fields: `id`, `title`, `description`, `category`, `location`, `budget`, `imageUrls`, `status`, `isEmergency`, `postedBy`, `createdAt`, `updatedAt`, `bidCount`
- Bid fields: `id`, `jobId`, `handyman`, `price`, `estimatedArrival`, `message`, `status`, `isRecommended`, `createdAt`
- Notification fields: `id`, `type`, `message`, `read`, `createdAt`, `relatedJobId`

If API contracts deviate, update frontend service layer and shared types in one PR.

## 14. Strict 3-Tier Architecture Contract

Target architecture:
- Presentation tier: Next.js frontend (render + input collection only)
- Application tier: ASP.NET Core API (all business rules and workflows)
- Data tier: PostgreSQL (persistent storage and query indexes)

Mandatory rule:
- Frontend must not own business logic, permission logic, workflow state transitions, or moderation decisions.

Frontend is allowed to do:
- Form validation for UX only (required fields, input format hints)
- Display loading/error/empty states
- Call APIs and render API responses
- Client-side route guards for UX (not security)

Frontend is not allowed to do:
- Decide if a user can perform an action (backend must enforce)
- Change business states locally (bid accepted/rejected, user blocked/unblocked)
- Compute final recommendation/priority scores used for moderation or matching
- Persist canonical workflow state in local storage as source of truth
- Execute admin moderation actions without API confirmation

Backend responsibilities (authoritative):
- Role and ownership authorization on every protected endpoint
- Workflow transitions and invariants (job and bid lifecycle)
- Moderation decisions and audit logging
- Derived flags (recommended bid, suspicious/flagged bid, emergency priority)
- Serialization contract and backward-compatible API shape

## 15. Hidden Business Logic (Must Live In Backend)

The following logic must be implemented server-side and never trusted to frontend state:

Auth and session:
- Password hashing and verification
- Refresh token rotation, revocation, and replay protection
- Admin bootstrap and force-reset-password enforcement
- Blocked user login denial

Jobs:
- Homeowner ownership checks for update/delete
- Valid status transitions:
  - `Open -> InProgress -> Completed`
  - no direct `Open -> Completed` without policy override
- Emergency assignment rules and admin override behavior

Bids:
- Bid submission eligibility (only handyman, cannot bid own job, cannot bid blocked/inactive users)
- One accepted bid per job invariant
- On accept:
  - accepted bid set to `Accepted`
  - all other pending bids set to `Rejected`
  - job status moved to `InProgress`
  - notification events generated
- Bid lock and force-reject behaviors for admin actions

Admin moderation:
- Block/unblock writes with mandatory reason
- Handyman verification review flow (`Pending/Approved/Rejected`)
- Bid moderation actions (`Flag`, `Lock`, `ForceReject`) with immutable event history
- Mandatory `AdminActions` audit row per admin mutation

Observability and governance:
- Correlation IDs, structured logs, and request tracing
- Uniform error contract and HTTP status semantics
- Idempotency guarantees for retried mutation endpoints where applicable

## 16. Endpoint Behavior Specification (Implementation Detail)

### 16.1 Auth Endpoints

- `POST /api/auth/register`
  - Creates homeowner or handyman only (admin registration forbidden)
  - Validates unique email
  - Returns `AuthResponse`

- `POST /api/auth/login`
  - Denies blocked users
  - Returns `AuthResponse` with role

- `POST /api/auth/admin/login`
  - Requires `role=Admin`
  - If `MustResetPassword=true`, return response indicating forced reset required

- `POST /api/auth/admin/force-reset-password`
  - Admin-only endpoint for first-login reset flow
  - On success set `MustResetPassword=false`

- `POST /api/auth/refresh`
  - Validates refresh token status and rotation chain
  - Revokes compromised/reused tokens

- `POST /api/auth/logout`
  - Revokes current refresh token

- `GET /api/auth/me`
  - Returns canonical user profile and role

### 16.2 Job Endpoints

- `GET /api/jobs`
  - Supports filters and pagination
  - Handyman scope defaults to discoverable jobs
  - Admin can query all jobs

- `GET /api/jobs/my`
  - Homeowner: jobs posted by current user
  - Handyman: optional extension in v1.1 for assigned/accepted jobs (if desired)

- `POST /api/jobs`
  - Homeowner only
  - Initializes `Status=Open`

- `PUT /api/jobs/{id}` and `DELETE /api/jobs/{id}`
  - Homeowner owner only (or admin override)

### 16.3 Bid Endpoints

- `POST /api/jobs/{jobId}/bids`
  - Handyman only
  - Validates bid is against open job
  - Records bid and emits bid-created event

- `PATCH /api/bids/{bidId}/accept`
  - Homeowner owner only
  - Transactional update of all related bid states and job state

- `PATCH /api/bids/{bidId}/reject`
  - Homeowner owner only
  - Updates single bid state to rejected

- `DELETE /api/bids/{bidId}`
  - Handyman owner only
  - Allowed only when status is pending

### 16.4 Admin Endpoints

- `GET /api/admin/overview`
  - Returns daily operation aggregates:
    - users created today
    - jobs posted today
    - bids created today
    - open emergencies
    - blocked account count

- `GET /api/admin/users`
  - Filter by role, status, verification, date

- `PATCH /api/admin/users/{id}/block`
  - Sets `AccountStatus=Blocked`
  - Requires `reason`
  - Inserts `AdminActions` audit row

- `PATCH /api/admin/users/{id}/unblock`
  - Sets `AccountStatus=Active`
  - Inserts `AdminActions` audit row

- `GET /api/admin/bid-transactions`
  - Filter by status/date/job/emergency/flagged/locked

- `PATCH /api/admin/bid-transactions/{bidId}/flag`
- `PATCH /api/admin/bid-transactions/{bidId}/lock`
- `PATCH /api/admin/bid-transactions/{bidId}/force-reject`
  - Each action appends `BidTransactions` event row and `AdminActions` row

## 17. API-to-DB Write Mapping (Critical)

Each write endpoint must define exact table mutations:

- Register user:
  - write `Users`
  - write `RefreshTokens` (if issuing at register)

- Login/logout/refresh:
  - read/write `RefreshTokens`
  - read `Users`

- Create job:
  - write `Jobs`
  - write `JobImages` (if image URLs submitted)

- Create bid:
  - write `Bids`
  - write `BidTransactions` (`EventType=Created`)
  - write `Notifications` for job owner

- Accept bid:
  - update `Bids` (target accepted, others rejected)
  - update `Jobs` (`Status=InProgress`)
  - write `BidTransactions` events for each changed bid
  - write `Notifications` for affected users

- Admin block/unblock:
  - update `Users.AccountStatus`
  - write `AdminActions`

- Admin bid moderation:
  - update target bid/lock state as needed
  - write `BidTransactions`
  - write `AdminActions`

## 18. Acceptance Criteria For Teammate Implementation

Definition of done for backend:
- All protected endpoints enforce role and ownership server-side.
- No business-critical state change is possible without an API write.
- Admin actions are fully auditable through `AdminActions`.
- Bid lifecycle invariants are enforced transactionally.
- Blocked users are denied login and denied write operations.
- API contracts match frontend type expectations in `app/types/index.ts`.
- Integration tests cover critical flows:
  - homeowner create job -> handyman bid -> homeowner accept
  - admin block/unblock user
  - admin force-reject/lock/flag bid
  - blocked user denied auth and writes

## 19. Complete PostgreSQL Schema (PK/FK Blueprint)

Note on terminology:
- Use **primary keys (PK)** and **foreign keys (FK)** to link tables.
- Public/private cryptographic keys are not used for relational table linking.

### 19.1 SQL Extensions and Enums

```sql
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
```

### 19.2 Core Identity and Auth Tables

```sql
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
```

### 19.3 Job and Bid Domain Tables

```sql
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
```

### 19.4 Notification and Admin Workflow Tables

```sql
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
```

### 19.5 Required Indexes

```sql
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
```

### 19.6 Relationship Map (Quick Reference)

- `users (1) -> (many) jobs` via `jobs.posted_by_user_id`
- `jobs (1) -> (many) job_images` via `job_images.job_id`
- `jobs (1) -> (many) bids` via `bids.job_id`
- `users (1) -> (many) bids` via `bids.handyman_user_id`
- `users (1) -> (many) notifications` via `notifications.user_id`
- `jobs (0..1) <- (many) notifications` via `notifications.related_job_id`
- `users (1) -> (many) refresh_tokens` via `refresh_tokens.user_id`
- `users (1) -> (0..1) handyman_verifications` via `handyman_verifications.user_id`
- `bids (1) -> (many) bid_transactions` via `bid_transactions.bid_id`
- `users (1) -> (many) admin_actions` via `admin_actions.admin_user_id`

### 19.7 Migration and Seeding Order

1. Create enums
2. Create `users`
3. Seed bootstrap admin user (`role=admin`, `must_reset_password=true`)
4. Create auth and domain tables (`refresh_tokens`, `jobs`, `job_images`, `bids`, `notifications`)
5. Create admin tables (`handyman_verifications`, `bid_transactions`, `bid_locks`, `admin_actions`)
6. Create all indexes and partial indexes
7. Seed minimal lookup/demo data for local development only

### 19.8 Non-Negotiable DB Constraints

- `users.email` unique (case-insensitive uniqueness recommended with normalized lowercased email)
- one accepted bid per job (partial unique index)
- admin actions append-only (do not update/delete in normal flow)
- bid transaction events append-only (immutable ledger pattern)
- blocked user state stored in `users.account_status` and checked by API for login and writes

---

