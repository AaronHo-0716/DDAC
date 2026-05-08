# NeighborHelp (DDAC)

NeighborHelp is a professional community service marketplace designed to connect homeowners with verified local handymen. Built with a focus on security, real-time communication, and a robust financial ledger, the platform provides a seamless workflow for household maintenance and repair jobs.

## 🎯 Project Purpose

The goal of NeighborHelp is to provide a secure and structured workflow for:
- Homeowners to post jobs and receive handyman bids
- Handymen to discover work opportunities and submit bids
- Admins to moderate users and bidding activity

The system is designed around strong backend authority for business rules, role permissions, and auditability.
NeighborHelp aims to solve the trust gap in local service hiring by providing:
- **Verified Identity**: A strict handyman verification workflow.
- **Secure Payments**: An intermediary payment system that protects both parties.
- **Real-Time Coordination**: Instant messaging and notifications for immediate updates.
- **Backend Authority**: Centralized business logic that enforces role permissions and data integrity.

---

## ✨ Key Features

### 🔐 Security & Identity
*   **OTP-Based Authentication**: Secure registration and password reset using 6-digit email codes.
*   **Live Session Guard**: Middleware-level token validation that instantly revokes access for blocked users or after password changes.
*   **Role-Based Access**: Specialized views and permissions for Homeowners, Handymen, and Administrators.

### 🛠️ Job & Bid Management
*   **Job Lifecycle**: Complete flow from open bidding to "In-Progress" and "Completed" states.
*   **Image Support**: High-performance media handling using AWS S3 (LocalStack) with time-limited pre-signed URLs.

### 💬 Real-Time Messaging
*   **SignalR Integration**: Instant 1-on-1 job chats and admin support tickets.
*   **Intelligent Inbox**: Real-time unread counts and message snippets synced across devices via Redis.
*   **Support Queue**: Shared ticket system where admins can broadcast and "take" user support requests.

### 💳 Financial Ecosystem
*   **Intermediary Payments**: Stripe-integrated checkout supporting Cards, FPX, and E-Wallets.
*   **Platform Commissions**: Automated calculation of platform fees and handyman earnings.
*   **Virtual Wallet**: Handymen track earnings and request payouts to their bank accounts through a secure approval workflow.

---

## 🏗️ Repository Structure

```text
├── .github/                # GitHub configuration (workflows, templates, CI/CD pipelines)
├── backend.Test/           # Backend testing suite (currently incomplete)
├── backend/                # ASP.NET Core 8 Web API (C#)
│   ├── Controllers/        # REST API Endpoints (Inheriting BaseController)
│   ├── Services/           # Business Logic (Suitcase Dependency Pattern)
│   ├── Hubs/               # SignalR WebSocket Hubs
│   ├── Middleware/         # Security, Exception, and Token validation guards
│   ├── Models/             # EF Core Entities and DTOs
│   ├── Data/               # DbContext and SQL Seeders
│   ├── sql/                # Database migrations and init scripts
│   └── docker-compose.yml  # Full-stack orchestration (API, DB, Redis, LocalStack, Mailpit)
├── deployment/             # infrastructure-as-code assets for cloud deployment
│   ├── compose/            # Docker compose files that are used for running the apps inside each instance.
│   ├── grafana/            # Grafana related configs​
│   ├── scripts/            # User data scripts that will setup or install software during an EC2 instance's first start up​
├── neighbour-help/         # Next.js 15 Frontend (TypeScript)
│   ├── app/                # App Router (Pages & Components)
│   └── lib/                # API Clients, Contexts, and SignalR Hooks
```

---

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (for frontend local development)
- .NET 8 SDK

### 1. Backend & Infrastructure
The easiest way to run the entire infrastructure is via Docker:
```bash
cd backend
docker-compose up -d
```

### 2. Frontend Development
```bash
cd neighbour-help
npm install
npm run dev -- -H 0.0.0.0
```
*Note: Using `-H 0.0.0.0` allows you to test the app on your smartphone using your laptop's IP.*

### 3. Stripe Integration (Local Testing)
To receive payment updates locally, run the Stripe CLI:
```bash
stripe listen --forward-to http://localhost:5073/api/payments/webhook
```

---

## 🛠️ Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS, SignalR Browser Client.
- **Backend**: ASP.NET Core 8, Entity Framework Core, LINQ.
- **Database**: PostgreSQL 16.
- **Real-Time**: SignalR + Redis Backplane.
- **Cloud/Storage**: AWS SDK (S3), LocalStack (Mock S3).
- **Payments**: Stripe API & Webhooks.
- **Testing**: Mailpit (Mock SMTP), Serilog (Structured Logging).

---

## 🛡️ Architecture Highlights

- **Base Architecture**: Centralized error handling and user context retrieval through `BaseController` and `BaseService`.
- **Database Triggers**: Critical logic (like unread counts and financial math) is enforced at the database level for 100% reliability.
- **Suitcase Pattern**: Services use a `ServiceDependencies` aggregate to keep constructors clean and maintainable.
- **Standalone Frontend**: Optimized Next.js deployment using the standalone output for minimal Docker image size.

---
**NeighborHelp** — *Building stronger communities, one fix at a time.*
