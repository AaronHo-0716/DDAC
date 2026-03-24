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
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Responses should match frontend contracts:
- `AuthResponse`: `{ user, tokens }`
- `User`: include `role`, `rating`, `avatarUrl`

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

- `GET /api/admin/metrics`
- `GET /api/admin/handymen/pending-verification`
- `PATCH /api/admin/handymen/{id}/approve`
- `PATCH /api/admin/handymen/{id}/reject`
- `GET /api/admin/jobs/emergency`
- `PATCH /api/admin/jobs/{id}/assign`

Access: `Admin` role only.

## 5.6 File Uploads

- `POST /api/uploads/job-image` (multipart/form-data)
- Return: public URL and blob key

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
- Add indices for common filters:
  - `Jobs(Status, Category, IsEmergency, CreatedAtUtc)`
  - `Bids(JobId, Status)`
  - `Notifications(UserId, IsRead, CreatedAtUtc)`
- Soft delete only where needed (v1 can use hard delete for bids/jobs if business allows)

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

---

If you want, the next step is I can scaffold the actual ASP.NET solution skeleton (projects, folders, base Program.cs, JWT setup, DbContext, and the first auth/jobs endpoints) so your team can start coding immediately.
