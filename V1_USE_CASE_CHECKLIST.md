# V1 Core Functionality Checklist

## Authentication and Account

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | Homeowner | Register account | Email not used; role is homeowner | Submit registration form | Account created; auth tokens issued; profile returned | Response includes user and tokens; user role is homeowner; password is hashed in DB; duplicate email rejected |
| [ ] | Handyman | Register account | Email not used; role is handyman | Submit registration form | Account created; auth tokens issued; profile returned | Response includes user and tokens; user role is handyman; duplicate email rejected |
| [ ] | Any user | Login | Valid credentials; account active | Submit email and password | Auth tokens issued; profile returned | Invalid password returns unauthorized; blocked user login denied; response shape matches frontend contract |
| [ ] | Admin | Admin login | Admin account exists | Submit admin credentials | Admin session established | Non-admin cannot pass admin login; must-reset-password handling works |
| [ ] | Admin | Force reset bootstrap password | Admin logged in; must-reset-password is true | Submit new password in force-reset flow | Password updated; must-reset-password cleared | Old password rejected after reset; new password accepted; flag switched off |
| [ ] | Any user | Refresh token | Valid active refresh token | Call refresh endpoint | New access token and rotated refresh token returned | Old refresh token revoked; token reuse detected and blocked; expiry handled correctly |
| [ ] | Any user | Logout | User authenticated with refresh token | Call logout endpoint | Current refresh token revoked | Refresh after logout fails; access token eventually expires and cannot be reused |
| [ ] | Any user | Get my profile | Valid access token | Call me endpoint | Canonical profile returned | Returned role/status is authoritative; unauthorized request rejected |

## Job Management

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | Homeowner | Create job | Logged in as homeowner; account active | Submit job details | Job created with status Open | Handyman/admin creation blocked if policy says homeowner-only; required fields validated |
| [ ] | Homeowner | Update own job | Job exists; requester owns job | Edit job | Job updated; updated timestamp changes | Non-owner update forbidden; invalid status transition blocked |
| [ ] | Homeowner | Delete own job | Job exists; requester owns job | Delete job | Job removed according to policy | Non-owner delete forbidden; related records handled safely |
| [ ] | Homeowner | View my jobs | Logged in | Call my jobs endpoint | Only homeowner jobs returned | Pagination works; no cross-user data leakage |
| [ ] | Handyman | Browse open jobs | Logged in as handyman | Query jobs with filters | Discoverable job list returned | Filters work (category, status, search, emergency, page); only allowed jobs returned |
| [ ] | Any allowed role | View job detail | Job exists and visible to role | Request job by id | Full job payload returned | Payload includes expected fields (title, category, location, budget, status, image URLs, bid count) |

## Bid Lifecycle

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | Handyman | Submit bid | Logged in as handyman; job is Open; not own job | Create bid for job | Bid created with Pending status | Own-job bidding blocked; blocked users blocked; one bid per handyman per job enforced |
| [ ] | Job owner (Homeowner) | View bids for own job | Job exists; requester is owner (or admin) | Request job bids | All bids for that job returned | Non-owner handyman cannot see private bid list unless policy allows |
| [ ] | Job owner (Homeowner) | Accept bid | Pending bids exist; requester owns job | Accept selected bid | Selected bid Accepted; other pending bids Rejected; job moves to InProgress | All updates happen transactionally; one accepted bid invariant holds; idempotent retry behavior validated |
| [ ] | Job owner (Homeowner) | Reject bid | Bid is Pending; requester owns job | Reject selected bid | Bid status becomes Rejected | Accept/reject permission enforced; rejected bid cannot be accepted without policy override |
| [ ] | Handyman | Delete own pending bid | Bid belongs to requester; status Pending | Delete bid | Bid removed | Non-owner cannot delete; non-pending delete blocked |

## Notifications

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | System | Generate bid received notification | New bid created | Create notification event | Homeowner gets unread notification | Notification type and related job id are correct |
| [ ] | System | Generate bid accepted notification | Bid accepted | Create notification event | Winning handyman gets unread notification | Correct recipient and message; timestamp recorded |
| [ ] | Any user | List notifications | Logged in | Request notifications | User-specific notification list returned | Read/unread filtering works; sorted by created time |
| [ ] | Any user | Mark notification as read | Notification belongs to requester | Update notification read state | Notification marked read | Cannot mark another user notification |
| [ ] | Any user | Mark all as read | Logged in | Call read-all action | All user notifications marked read | Only caller notifications updated |

## Admin and Moderation

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | Admin | View admin overview | Logged in as admin | Request overview metrics | Aggregated operational metrics returned | Counts are accurate for date window; access is admin-only |
| [ ] | Admin | Review pending handyman verifications | Logged in as admin | Request pending list | Pending verification queue returned | Status filter works; no non-admin access |
| [ ] | Admin | Approve handyman verification | Pending verification exists | Approve request | Verification status becomes Approved | Admin action audit row written; reviewer and time stored |
| [ ] | Admin | Reject handyman verification | Pending verification exists | Reject request with reason | Verification status becomes Rejected | Reason persisted; admin action audit row written |
| [ ] | Admin | List users | Logged in as admin | Query users with filters | User list returned | Role/status/date filters work |
| [ ] | Admin | Block user | Target user exists; reason provided | Block request | Account status becomes Blocked | Block reason, blocked by, blocked at recorded; blocked user denied login and writes |
| [ ] | Admin | Unblock user | Target user is blocked | Unblock request | Account status becomes Active | Admin action audit row written; user can login again |
| [ ] | Admin | List bid transactions | Logged in as admin | Query transaction ledger | Immutable bid event history returned | Filtering by date, status, job works |
| [ ] | Admin | Force reject bid | Target bid eligible | Force reject action | Bid forcibly rejected by admin policy | Bid transaction event written; admin action audit row written |
| [ ] | Admin | Lock bid | Target bid exists | Lock action | Bid lock state applied | Locked bid cannot be modified until unlocked; audit rows created |
| [ ] | Admin | Flag bid | Target bid exists | Flag action | Bid flagged for moderation | Flag reflected in queries; audit rows created |
| [ ] | Admin | View audit log | Logged in as admin | Request audit records | Admin actions list returned | Every admin mutation has corresponding audit record |

## File Uploads

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | Homeowner or allowed user | Upload job image | Authenticated; file type/size valid | Upload multipart image | File stored in object storage; URL/key returned | MIME allowlist enforced; max size enforced; invalid files rejected |
| [ ] | System | Persist image metadata | Upload successful | Save image metadata linked to job | Job image row created with key/url/content data | Binary not stored in relational DB; metadata linked to correct job |

## Cross-Cutting Rules and Verification

| Done | Actor | Use Case | Preconditions | Action | Expected Result | Verification Checklist |
|---|---|---|---|---|---|---|
| [ ] | System | Enforce authorization and ownership | Protected endpoint called | Validate role and resource ownership | Unauthorized operations blocked | Role policies applied consistently; ownership checks on updates, deletes, accept, reject |
| [ ] | System | Enforce lifecycle rules | Job/bid state change requested | Validate transition rules | Only legal transitions allowed | Open to InProgress to Completed sequence enforced; no conflicting accepted bids |
| [ ] | System | Return consistent error contract | Validation/business/auth errors occur | Return standardized error payload | Frontend receives predictable error shape | Status code, message, field errors present where applicable |
| [ ] | System | Health and readiness reporting | Service running | Call live/ready endpoints | Correct health status returned | Liveness works without DB dependency; readiness checks dependencies |
| [ ] | QA/Dev | Critical integration flow | Test environment ready | Run end-to-end scenario | Flow passes: register/login, create job, bid, accept, notifications | Transactional integrity verified; forbidden access tests included |
| [ ] | QA/Dev | Admin moderation flow | Admin and sample data ready | Run admin block/unblock and bid moderation tests | All moderation actions succeed with full audit trail | Blocked user denied auth/writes; bid transaction ledger complete |
