# NeighborHelp (DDAC)

NeighborHelp is a community service marketplace that connects homeowners with nearby handymen for household maintenance and repair jobs. The platform supports job posting, bidding, notifications, and moderation workflows, with a Next.js frontend and an ASP.NET Core backend.

## Project Purpose

The goal of NeighborHelp is to provide a secure and structured workflow for:
- Homeowners to post jobs and receive handyman bids
- Handymen to discover work opportunities and submit bids
- Admins to moderate users and bidding activity

The system is designed around strong backend authority for business rules, role permissions, and auditability.

## Repository Structure

- `backend/`: ASP.NET Core (.NET 8) Web API, authentication, domain models, DB context, and API host
- `neighbour-help/`: Next.js frontend application and local SQL initialization script
- `deployment/`: infrastructure-as-code assets for cloud deployment
- `V1_USE_CASE_CHECKLIST.md`: checklist for v1 feature verification during development/testing

## Core Functionalities (V1 Scope)

### Authentication and Access Control
- User registration and login
- JWT-based authentication and profile retrieval
- Role-based authorization model: homeowner, handyman, admin
- Refresh and logout flows (implementation maturity may vary by module)

### Job Lifecycle
- Homeowner job creation and management
- Job browsing and detail viewing for eligible users
- Emergency job flag support

### Bid Lifecycle
- Handyman bid submission for open jobs
- Homeowner bid review and decision (accept/reject)
- Invariant goal: only one accepted bid per job

### Notifications
- Notification events for important bid and job transitions
- Read/unread notification state management

### Admin and Moderation
- User oversight and account control (block/unblock)
- Handyman verification workflows
- Bid moderation actions such as flag/lock/force-reject
- Audit trail expectations for admin actions

### Data and Persistence
- Relational schema designed for users, jobs, bids, notifications, refresh tokens, and moderation logs
- PostgreSQL-oriented schema and enums available in `neighbour-help/sql/init.sql`

## Architecture Overview

NeighborHelp follows a 3-tier model:
1. Presentation tier: Next.js frontend
2. Application tier: ASP.NET Core API
3. Data tier: PostgreSQL

Key principle: business-critical decisions and workflow transitions must be enforced by the backend, not the frontend.

## Tech Stack

- Frontend: Next.js + TypeScript
- Backend: ASP.NET Core (.NET 8), C#
- Data access: Entity Framework Core
- Database: PostgreSQL (target), with environment-specific configuration
- Authentication: JWT and token-based session flow

## Current Development Status

The repository contains foundational backend and frontend work, including:
- Frontend app structure and pages
- Backend auth endpoints and DB model scaffolding
- PostgreSQL initialization script with core tables and indexes

Some planned v1 modules are partially implemented and still in progress. Use `V1_USE_CASE_CHECKLIST.md` to track feature completion and verification.

## Getting Started (High Level)

1. Frontend
- Go to `neighbour-help/`
- Install dependencies and run the Next.js development server

2. Backend
- Go to `backend/`
- Configure connection strings and JWT settings
- Run the ASP.NET Core API

3. Database
- Initialize PostgreSQL schema using `neighbour-help/sql/init.sql`

4. Infrastructure (optional)
- Review `deployment/` for environment provisioning assets

## Documentation Notes

- This README provides project-level orientation.
- For implementation tracking, use `V1_USE_CASE_CHECKLIST.md`.
- For backend scope and rules, refer to `backend/BACKEND_IMPLEMENTATION_PLAN.md`.
