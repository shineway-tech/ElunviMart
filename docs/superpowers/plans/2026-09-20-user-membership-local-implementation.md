# User, Workspace, and Membership System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete local user, workspace, sub-account, role, email verification, membership, entitlement, and frontend integration flow while keeping development and production configuration isolated in files.

**Architecture:** The empty `backend/` repository becomes a Koa API using Sequelize, MySQL, Redis, and Nodemailer. The Electron `frontend/` remains responsible for local PDD sessions and product cache, while the backend becomes authoritative for platform identity, workspace membership, authorization, subscriptions, and entitlements. Configuration is selected with an explicit `--config <path>` argument; no application setting or secret is injected through environment variables.

**Tech Stack:** CommonJS, Koa, Sequelize, MySQL 8, Redis, Nodemailer, Joi validation, bcryptjs password hashing, JWT access/refresh sessions, Docker Compose for local services, Node test runner, and Electron renderer/main-process IPC.

**Spec:** `frontend/docs/superpowers/specs/2026-09-20-user-membership-system-design.md`

## Global Constraints

- Users authenticate with email and password; phone numbers and SMS are out of scope.
- Registration requires email verification before workspace operations are available.
- Membership belongs to a workspace; sub-accounts share the workspace subscription.
- A workspace can bind at most 10 PDD merchant accounts, regardless of membership tier.
- Product history retention, per-merchant product caps, and API/Webhook entitlements are not membership dimensions.
- PDD cookies, Anti-Content, and merchant login sessions remain local to the Electron client.
- Development and production use separate config files, databases, Redis instances, mail settings, and signing secrets.
- Runtime configuration is loaded from an explicit config file path; do not read application configuration or secrets from environment variables.
- Real SMTP passwords, JWT secrets, database passwords, and Redis credentials must never be committed, logged, or included in example files.
- Migrations are versioned and run by an explicit migration command; application startup never silently changes the schema.
- Existing local frontend product caches remain usable when the backend is unavailable, but new account and membership operations require backend availability.

## Review Focus

- A verification token, password reset token, refresh token, or invitation token must be single-use, hashed at rest, and rejected after expiry.
- Every workspace-scoped read and write must verify both the authenticated user membership and the requested workspace ID; cross-workspace IDs must return the standard authorization error.
- A member limit or merchant limit must be checked in one backend transaction before the new record is created, including concurrent invitations; the workspace merchant hard limit is 10.
- A subscription downgrade must preserve existing data while blocking only new over-limit actions; it must not silently delete members, shops, or cached products.
- A missing, malformed, or production-insecure config file must fail startup with a clear error and must never fall back to development values.
- A failed migration must stop the release command before the application starts against a partial schema.
- The Electron UI must show a readable login/verification/permission state and preserve the existing visual language rather than exposing raw API errors.

---

### Task 1: Scaffold the backend and file-based configuration

**Files:**
- Create: `backend/package.json`
- Create: `backend/README.md`
- Create: `backend/src/server.js`
- Create: `backend/src/app.js`
- Create: `backend/src/config/load-config.js`
- Create: `backend/configs/local.example.json`
- Create: `backend/configs/test.json`
- Create: `backend/configs/production.example.json`
- Create: `backend/docker-compose.local.yml`
- Create: `backend/test/config.test.js`

**Interfaces:**
- `loadConfig(configPath)` reads one JSON config file, validates required fields, and returns a frozen normalized object.
- `createApp({ config, dependencies })` returns a Koa app without opening a network port.
- `src/server.js --config configs/local.json` loads the selected file, runs the app, and exposes `/health` and `/ready`.

- [ ] **Step 1: Write failing config and health tests**

  Test that a valid test config loads without consulting `process.env`, that a missing config file fails, that a missing SMTP or database field fails, and that `/health` does not require a database while `/ready` reports a failed dependency.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run from `backend/`: `node --test test/config.test.js`.

  Expected result: FAIL because the backend package, config loader, and app do not exist.

- [ ] **Step 3: Implement the local backend skeleton**

  Add the Koa app, config loader, Joi validation, structured request IDs, JSON error handling, and explicit config-path CLI parsing. Add local Docker services for MySQL, Redis, and Mailpit. Keep `local.json` ignored and commit only example files with non-secret sample values.

- [ ] **Step 4: Run the focused tests and local smoke check**

  Run `node --test test/config.test.js` and `node src/server.js --config configs/test.json`; assert `/health` returns 200 and `/ready` returns the documented dependency state.

- [ ] **Step 5: Commit the scaffold**

  Commit in the backend repository with `feat: scaffold local api configuration`.

### Task 2: Add migrations, models, and deterministic seed data

**Files:**
- Create: `backend/src/db/sequelize.js`
- Create: `backend/src/db/migrator.js`
- Create: `backend/src/db/models/*.js`
- Create: `backend/src/db/migrations/001_create_users.js` through the membership and audit migrations
- Create: `backend/src/db/seeders/001_roles_permissions.js`
- Create: `backend/src/db/seeders/002_plans_entitlements.js`
- Create: `backend/test/migrations.test.js`
- Modify: `backend/README.md`

**Interfaces:**
- `runMigrations({ config, direction: 'up' | 'down', target })` applies versioned migrations with a lock and records execution.
- `seedReferenceData({ sequelize })` is idempotent and creates the four initial roles, permission codes, and three membership plans.
- Models expose workspace-scoped associations without implicit cross-tenant queries.

- [ ] **Step 1: Write failing schema and seed tests**

  Use a disposable local database to assert all required tables, unique indexes, foreign-key cascades, token hash indexes, the 10-shop product rule field, and idempotent role/plan seeds.

- [ ] **Step 2: Run the migration tests and verify failure**

  Run `node --test test/migrations.test.js` with `--config configs/test.json`.

  Expected result: FAIL because no migration runner or schema exists.

- [ ] **Step 3: Implement schema and migration runner**

  Add tables for users, email verifications, password resets, workspaces, workspace members, invitations, roles, permissions, role permissions, plans, plan entitlements, subscriptions, subscription events, usage counters, device sessions, audit logs, and merchant account metadata. Use transactions for each migration and an explicit migration lock.

- [ ] **Step 4: Implement idempotent reference seeds**

  Seed owner/admin/operator/viewer roles, permission codes, and the base/professional/enterprise plans. Store entitlement keys for member count, merchant count, sync interval, notification channels, export, and audit. Set the enterprise merchant limit to 10.

- [ ] **Step 5: Run up/down/up migration verification**

  Run the migration command on a disposable database, verify seed counts, roll back the latest migration, reapply it, and run the same test again. Do not use schema synchronization.

- [ ] **Step 6: Commit the database foundation**

  Commit in the backend repository with `feat: add identity and membership schema`.

### Task 3: Implement email delivery and authentication

**Files:**
- Create: `backend/src/services/email-service.js`
- Create: `backend/src/services/token-service.js`
- Create: `backend/src/logics/auth-logic.js`
- Create: `backend/src/middleware/auth-user.js`
- Create: `backend/src/routers/v1/auth_api.js`
- Create: `backend/test/auth.test.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- `EmailService.sendVerification({ to, token })` and `sendPasswordReset({ to, token })` use the config file's SMTP block.
- `AuthLogic.register`, `verifyEmail`, `login`, `refresh`, `logout`, and `resetPassword` return the existing `{ err_code, err_msg, data }` response shape.
- `authUser` resolves the authenticated user and attaches it to `ctx.state.user`.

- [ ] **Step 1: Write failing auth tests**

  Cover registration normalization, duplicate email rejection, verification-required login, expired and reused verification tokens, password hashing, login, refresh rotation, logout revocation, password reset, and SMTP service calls using a fake mail transport.

- [ ] **Step 2: Run `node --test test/auth.test.js` and verify failure**

- [ ] **Step 3: Implement token and email services**

  Hash all one-time tokens before persistence, expire them, make them single-use, and implement SMTP delivery with the local config shape. Do not log message bodies or credentials.

- [ ] **Step 4: Implement auth routes and middleware**

  Add registration, verification, resend verification, login, refresh, logout, current-user, forgot-password, and reset-password routes under `/api/v1/auth`. Apply request validation and rate limits through Redis.

- [ ] **Step 5: Run auth tests and a local Mailpit smoke test**

  Run the focused test suite and use the local Mailpit container to verify verification and reset messages without contacting the production SMTP server.

- [ ] **Step 6: Commit authentication**

  Commit in the backend repository with `feat: add email authentication`.

### Task 4: Implement workspaces, sub-accounts, roles, and authorization

**Files:**
- Create: `backend/src/middleware/workspace-context.js`
- Create: `backend/src/middleware/require-permission.js`
- Create: `backend/src/logics/workspace-logic.js`
- Create: `backend/src/routers/v1/workspace_api.js`
- Create: `backend/test/workspace.test.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- `workspaceContext` resolves the requested workspace membership and attaches `ctx.state.workspace` and `ctx.state.membership`.
- `requirePermission(code)` rejects missing role permission with the standard authorization response.
- Workspace member invitation, acceptance, role change, disable, and removal are transaction-protected.

- [ ] **Step 1: Write failing workspace and authorization tests**

  Cover first-workspace creation, workspace switching, duplicate membership, invite and acceptance, expired invite, role changes, owner protection, disabled users, cross-workspace access, and concurrent member-limit checks.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run `node --test test/workspace.test.js`.

- [ ] **Step 3: Implement workspace routes and logic**

  Add current-workspace, list-workspaces, member list, invite, accept, role change, disable, remove, and ownership-transfer routes. Use transactions for invitation acceptance and member writes; record audit events for permission-sensitive operations.

- [ ] **Step 4: Run workspace tests and API contract checks**

  Verify every response uses `{ err_code, err_msg, data }` and every workspace query requires membership context.

- [ ] **Step 5: Commit workspace authorization**

  Commit in the backend repository with `feat: add workspace members and permissions`.

### Task 5: Implement plans, subscriptions, entitlements, and usage limits

**Files:**
- Create: `backend/src/logics/entitlement-logic.js`
- Create: `backend/src/logics/subscription-logic.js`
- Create: `backend/src/routers/v1/membership_api.js`
- Create: `backend/src/middleware/require-entitlement.js`
- Create: `backend/test/membership.test.js`
- Modify: `backend/src/app.js`

**Interfaces:**
- `getEffectiveEntitlements(workspaceId)` returns plan defaults plus active subscription state and usage.
- `requireEntitlement(key, amount)` checks the current workspace before a protected write.
- Membership routes return plans, current subscription, entitlements, usage, and owner-only subscription actions.

- [ ] **Step 1: Write failing membership tests**

  Cover active, trialing, grace-period, canceled, past-due, and expired subscriptions; plan lookup; member and merchant limits; the hard maximum of 10 merchant accounts; downgrade without deletion; and owner-only billing actions.

- [ ] **Step 2: Run `node --test test/membership.test.js` and verify failure**

- [ ] **Step 3: Implement entitlement evaluation and limits**

  Resolve plan entitlements by workspace, apply hard product limits, and check limits inside the same transaction as member or merchant creation. Do not add product-history, per-merchant-product, or API/Webhook entitlement keys.

- [ ] **Step 4: Implement subscription state changes and audit events**

  Support local manual activation for development, trialing, cancellation, grace period, expiration, and downgrade. Keep payment-provider callbacks behind an adapter for a later online phase.

- [ ] **Step 5: Run membership tests and seed verification**

  Run the focused tests against a clean migrated database and verify all three seeded plans.

- [ ] **Step 6: Commit membership rules**

  Commit in the backend repository with `feat: add membership entitlements`.

### Task 6: Add frontend configuration and authenticated API client

**Files:**
- Create: `frontend/src/shared/runtime-config.js`
- Create: `frontend/src/shared/api-client.js`
- Create: `frontend/configs/local.example.json`
- Create: `frontend/configs/production.example.json`
- Modify: `frontend/.gitignore`
- Modify: `frontend/src/main/main.js`
- Modify: `frontend/src/main/store.js`
- Modify: `frontend/src/renderer/preload.js`
- Create: `frontend/test/runtime-config.test.js`
- Create: `frontend/test/api-client.test.js`

**Interfaces:**
- `loadRuntimeConfig({ appPath, configPath })` loads a frontend config file and rejects an invalid environment or missing API URL.
- `ApiClient.request(path, options)` attaches the current access token, refreshes once on 401, and returns normalized API errors.
- Preload exposes auth, workspace, membership, and member APIs without exposing Node or filesystem access to the renderer.

- [ ] **Step 1: Write failing config and API-client tests**

  Cover explicit config-file loading, no environment-variable fallback, separate local/production API URLs, token refresh, logout, and normalized errors.

- [ ] **Step 2: Run the focused frontend tests and verify failure**

  Run from `frontend/`: `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/Electron.app/Contents/MacOS/Electron --test test/runtime-config.test.js test/api-client.test.js`.

- [ ] **Step 3: Implement file-based frontend config and secure token storage**

  Load a selected JSON file outside the packaged application, use Electron `safeStorage` for tokens, and ensure a production build cannot silently use the local API URL.

- [ ] **Step 4: Implement the preload API boundary**

  Add typed-by-convention IPC methods for auth, workspaces, members, membership, and existing local products. Keep backend access in the main process.

- [ ] **Step 5: Run frontend client tests**

  Verify local config and mocked auth flows without starting a real backend.

- [ ] **Step 6: Commit frontend API foundation**

  Commit in the frontend repository with `feat: add authenticated backend client`.

### Task 7: Add the authenticated UI and membership management screens

**Files:**
- Modify: `frontend/src/renderer/index.html`
- Modify: `frontend/src/renderer/app.js`
- Modify: `frontend/src/renderer/styles.css`
- Create: `frontend/src/renderer/auth-view.js`
- Create: `frontend/src/renderer/workspace-view.js`
- Create: `frontend/src/renderer/membership-view.js`
- Create: `frontend/test/renderer-auth.test.js`
- Create: `frontend/test/renderer-membership.test.js`

**Interfaces:**
- The renderer has explicit unauthenticated, email-verification, workspace-selection, and authenticated states.
- Workspace member and membership screens consume only the preload API.
- All disabled actions explain which role or membership entitlement is missing.

- [ ] **Step 1: Write failing renderer tests**

  Cover registration, login, verification reminder, logout, workspace switching, member invitation, role display, plan display, upgrade/downgrade messaging, and disabled actions.

- [ ] **Step 2: Implement views using the existing visual system**

  Reuse the current sidebar, cards, tables, buttons, modal, spacing, color, and icon conventions. Add a restrained auth layout, workspace selector, team table, invitation modal, and membership comparison cards without introducing a separate visual language.

- [ ] **Step 3: Wire error, loading, and empty states**

  Translate backend error codes into user-facing Chinese copy. Never show raw stack traces, SMTP errors, JWT data, or database messages.

- [ ] **Step 4: Run renderer tests and a manual Electron smoke test**

  Verify the application starts in logged-out state, completes local mocked login, shows the workspace, and returns to the login screen after logout.

- [ ] **Step 5: Commit the authenticated UI**

  Commit in the frontend repository with `feat: add workspace and membership screens`.

### Task 8: Migrate local merchant data and finish local integration

**Files:**
- Create: `frontend/src/main/backend-migration.js`
- Modify: `frontend/src/main/store.js`
- Modify: `frontend/src/main/main.js`
- Create: `frontend/test/backend-migration.test.js`
- Create: `backend/test/integration-local.test.js`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`

**Interfaces:**
- `migrateLocalMerchantAccounts({ localStore, apiClient, workspaceId })` imports local merchant metadata without uploading PDD credentials or Anti-Content.
- Local migration is idempotent and records a local mapping from legacy account ID to backend merchant ID.
- A local integration command starts services, migrates, seeds, starts the API with a config file, and runs the frontend against the local API.

- [ ] **Step 1: Write failing migration and integration tests**

  Cover first-run import, rerun without duplicates, missing email identity, backend unavailable with cache preserved, and refusal to serialize PDD cookies or Anti-Content.

- [ ] **Step 2: Implement local merchant metadata migration**

  Require an authenticated workspace, import only shop name/ID/status, keep products and sessions local, and make the mapping idempotent.

- [ ] **Step 3: Add local run documentation and scripts**

  Document config-file creation from examples, Docker startup, migration/seed commands, API startup, Mailpit access, and frontend launch. Do not use environment-variable injection in any command.

- [ ] **Step 4: Run the full local integration suite**

  Run backend migrations and seeds on a clean local database, exercise registration through membership limits, run the merchant import, and run frontend tests plus existing PDD sync tests.

- [ ] **Step 5: Commit the local integration**

  Commit the backend integration as `feat: complete local user and membership integration` and commit the environment documentation separately in the repository that owns it.

## Final Verification

- [ ] Backend lint passes for all changed JavaScript files.
- [ ] Backend migration up/down/up and idempotent seed tests pass on a clean local database.
- [ ] Backend auth, workspace, permission, membership, and integration tests pass.
- [ ] Frontend existing sync/store tests and new auth/membership tests pass.
- [ ] Local Electron smoke test starts with a config file and never reads production settings.
- [ ] `git status` is clean in both repositories, and no secret appears in tracked files or history.
