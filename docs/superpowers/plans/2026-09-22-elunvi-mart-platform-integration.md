# Elunvi Mart Platform Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Electron Elunvi Mart client to ElunviPlatform for platform login, user profile, wallet balance, point-package payments, and product support operations while keeping Pinduoduo merchant accounts local.

**Architecture:** Keep all platform network access in the Electron main process behind a focused `platform-client.js` adapter that follows the ElunviPlatform SDK v1.2.0 contracts. Store only an encrypted refresh token through Electron `safeStorage`; expose typed, minimal `platform:*` IPC methods through preload; render platform account and payment state in the existing app shell without exposing tokens or arbitrary network access.

**Tech Stack:** CommonJS Electron 37, Node built-in `fetch`, Electron `safeStorage` and `shell`, existing SQLite store, plain renderer JavaScript/CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-22-elunvi-mart-platform-integration-design.md`

## Global Constraints

- The platform product code is `elunvi-mart`; the desktop client ID is provisioned by ElunviPlatform and must be recorded as public configuration only.
- The API base URL is `https://elunvi-api.honeykid.cn`; production requests use HTTPS and renderer CSP keeps `connect-src 'none'`.
- Required initial scopes are `profile:read`, `wallet:read`, `payments:read`, and `payments:write`.
- Access tokens remain in main-process memory; refresh tokens are encrypted with Electron `safeStorage` and never cross IPC.
- Pinduoduo merchant sessions remain isolated from ElunviPlatform sessions and continue using their existing persistent partitions.
- The client never changes platform balances, payment states, or ledger facts locally.
- Do not commit passwords, refresh tokens, device secrets, Webhooks, payment secrets, or user data.
- Keep CommonJS, two-space indentation, single-quoted strings, semicolons, and Chinese user-facing errors.

## Review Focus

- Wrong product/client attribution in profile, wallet, or payment responses must be rejected and tested in Task 2.
- A device session that expires or is cancelled must clear pending secrets and produce a retryable login state; test in Task 2.
- Refresh-token decryption failure or refresh rejection must log the user out without leaving stale credentials; test in Task 1 and Task 3.
- `manual_review`, timeout, and uncertain payment states must never be treated as paid or create a second checkout; test in Task 2 and Task 4.
- Renderer APIs must not expose arbitrary IPC, tokens, device secrets, or arbitrary network access; test in Task 3 and Task 5.

---

### Task 1: Provision ElunviPlatform product, desktop clients, and support team

**Files:**
- Modify: `src/main/platform-config.js` after the admin assigns the public client IDs
- Create: `docs/product-integration/elunvi-platform.md`

**Interfaces:**
- Consumes: ElunviPlatform admin product registry and integration configuration.
- Produces: public `ELUNVI_PLATFORM_CONFIG` values consumed by `PlatformClient`, and an operator runbook with no secrets.

- [ ] **Step 1: Create the product in the ElunviPlatform admin console.**

  Use product code `elunvi-mart`, display name `Elunvi Mart`, app type `desktop`, and an enabled/public status. Do not enter or store the admin password in the repository.

- [ ] **Step 2: Create or verify desktop clients for Windows and macOS.**

  Request scopes `profile:read`, `wallet:read`, `payments:read`, and `payments:write`; record the assigned public client IDs and the platform API URL. Do not invent a client ID in code before the console returns it.

- [ ] **Step 3: Create the support team.**

  Create a team named `Elunvi Mart Support`, assign the approved support owner/member accounts in the admin console, and verify that the team can filter Elunvi Mart users, orders/payments, and point transactions. The client does not manage team membership.

- [ ] **Step 4: Add public config and an operator runbook.**

  `src/main/platform-config.js` exports:

  ```js
  const ELUNVI_PLATFORM_CONFIG = Object.freeze({
    apiBaseUrl: 'https://elunvi-api.honeykid.cn',
    productCode: 'elunvi-mart',
    clients: {
      darwin: 'elunvi-mart-desktop-macos',
      win32: 'elunvi-mart-desktop-windows'
    },
    scopes: ['profile:read', 'wallet:read', 'payments:read', 'payments:write'],
    redirectUri: 'https://elunvi-api.honeykid.cn/v1/auth/device-callback'
  });
  module.exports = { ELUNVI_PLATFORM_CONFIG };
  ```

  Fill the two client entries with the exact public values returned by Step 2 before committing. `docs/product-integration/elunvi-platform.md` records the product code, client IDs, scopes, admin verification checklist, and support-team responsibilities, never credentials.

- [ ] **Step 5: Verify the admin state.**

  Confirm the product integration page shows both desktop clients, login is enabled, and the support team can view Elunvi Mart data. Capture only non-sensitive identifiers in the runbook.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/main/platform-config.js docs/product-integration/elunvi-platform.md
  git commit -m "chore: provision Elunvi Mart platform configuration"
  ```

### Task 2: Build and test the platform session, transport, user, wallet, and payment adapter

**Files:**
- Create: `src/main/platform-session.js`
- Create: `src/main/platform-client.js`
- Test: `test/platform-session.test.js`
- Test: `test/platform-client.test.js`

**Interfaces:**
- Consumes: `ELUNVI_PLATFORM_CONFIG`, injected `fetch`, injected `safeStorage` facade, and platform v1.2.0 response shapes.
- Produces: `PlatformClient` methods:
  - `startWechatLogin()` -> `{ authorizationUrl, expiresAt, pollIntervalSeconds, deviceSessionId, deviceSecret, verifier }`
  - `loginWithPassword({ email, password })` -> session summary
  - `exchangeDeviceSession(flow)` -> session summary
  - `refresh()` / `logout()`
  - `getProfile()` / `getWallet()` / `getPackages()`
  - `createCheckout(packageCode, idempotencyKey)` / `createPaymentAttempt(checkoutId, channel)`
  - `getCheckout(checkoutId)` / `closeCheckout(checkoutId)`

- [ ] **Step 1: Write failing session-store tests.**

  Cover empty storage, encrypt/decrypt round trip, atomic replacement, malformed ciphertext, and `clear()`. The store accepts injected `{ isEncryptionAvailable, encryptString, decryptString }` so tests never depend on a real OS keychain.

- [ ] **Step 2: Implement `SafeTokenStore`.**

  Store JSON `{ refreshToken, accessExpiresAt, refreshExpiresAt }` as `encrypted:<base64>` in `app.getPath('userData')/platform-session.bin`, write a temporary file and rename it, and delete the file when decryption or JSON validation fails. Never store access tokens.

- [ ] **Step 3: Write failing transport/client tests.**

  Use a fake fetch queue to assert:

  ```js
  assert.equal(request.headers.get('x-elunvi-client-id'), expectedClientId);
  assert.equal(request.headers.get('authorization'), `Bearer ${accessToken}`);
  assert.equal(request.headers.get('idempotency-key'), idempotencyKey);
  ```

  Add fixtures for device-session creation, token exchange, profile, wallet, packages, checkout, payment attempt, `paid`, `manual_review`, 401, and malformed attribution responses.

- [ ] **Step 4: Implement the adapter.**

  Use the SDK contract paths `/v1/auth/device-sessions`, `/v1/auth/device-sessions/:id/token`, `/v1/auth/email/password-login`, `/v1/auth/refresh`, `/v1/auth/logout`, `/v1/me/profile`, `/v1/me/wallet`, `/v1/payments/packages`, `/v1/payments/checkouts`, and `/v1/payments/checkouts/:id/attempts`. Validate HTTPS, response shape, product code, client ID, scopes, request IDs, and retryable errors before returning data.

- [ ] **Step 5: Run focused tests and then the existing suite.**

  ```bash
  node --test test/platform-session.test.js test/platform-client.test.js
  npm test
  ```

  Expected: all focused tests and all existing tests pass.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/main/platform-session.js src/main/platform-client.js test/platform-session.test.js test/platform-client.test.js
  git commit -m "feat: add ElunviPlatform client and secure session storage"
  ```

### Task 3: Wire main-process IPC and secure lifecycle handling

**Files:**
- Modify: `src/main/main.js`
- Modify: `src/renderer/preload.js`
- Test: `test/platform-ipc.test.js`

**Interfaces:**
- Consumes: `PlatformClient`, `SafeTokenStore`, Electron `shell`, and the existing `app.whenReady` lifecycle.
- Produces: preload methods `platform.status`, `platform.loginWithPassword`, `platform.startWechatLogin`, `platform.completeWechatLogin`, `platform.refresh`, `platform.logout`, `platform.packages`, `platform.createCheckout`, `platform.createPaymentAttempt`, `platform.getCheckout`, and `platform.closeCheckout`.

- [ ] **Step 1: Write failing IPC contract tests.**

  Assert each handler delegates to the client, returns plain serializable values, rejects unknown payment channels, and never includes `accessToken`, `refreshToken`, `deviceSecret`, or `pkceVerifier` in a result.

- [ ] **Step 2: Initialize the platform client in `app.whenReady`.**

  Select the `darwin` or `win32` public client ID, create `SafeTokenStore` with Electron `safeStorage`, create `PlatformClient`, attempt one refresh if a stored token exists, and retain only the in-memory access token in the client.

- [ ] **Step 3: Register `platform:*` handlers.**

  Add the exact channels from the spec. For `platform:startWechatLogin`, call `shell.openExternal(authorizationUrl)` only after the client has validated the URL. For expired/401 responses, clear the session and return a stable `AUTH_REQUIRED` error. Include profile and wallet in `platform:status` after login.

- [ ] **Step 4: Expose a minimal preload surface.**

  Add `contextBridge.exposeInMainWorld('pddMonitor', { platform: { ... } })` methods that only call named IPC channels. Do not expose `ipcRenderer`, fetch, session paths, or token values.

- [ ] **Step 5: Run IPC tests and syntax checks.**

  ```bash
  node --test test/platform-ipc.test.js
  node --check src/main/main.js
  node --check src/renderer/app.js
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add src/main/main.js src/renderer/preload.js test/platform-ipc.test.js
  git commit -m "feat: expose secure platform account IPC"
  ```

### Task 4: Add renderer account, login, wallet, and payment UI

**Files:**
- Modify: `src/renderer/index.html`
- Modify: `src/renderer/app.js`
- Modify: `src/renderer/styles.css`
- Test: `test/platform-ui.test.js`

**Interfaces:**
- Consumes: `window.pddMonitor.platform` methods from Task 3 and `platform:status` data.
- Produces: a platform account panel with email/password login, “微信扫码登录” browser launch, logout, profile display, balance, package picker, payment-channel picker, QR payload display, checkout polling, and retry/manual-review states.

- [ ] **Step 1: Write failing DOM behavior tests.**

  Use the existing Node test style with a minimal DOM fixture or extracted pure render helpers to cover logged-out, logged-in, expired-session, empty-package, paid, and manual-review states. Assert all dynamic user text uses `textContent` and payment buttons disable while requests are pending.

- [ ] **Step 2: Add the platform account panel markup.**

  Add a top-level account section separate from the Pinduoduo merchant account list. Include status, display name, masked user ID/email, login method controls, wallet balance, package selection, channel selection, QR/status area, logout, and request-ID error details.

- [ ] **Step 3: Implement renderer state and actions.**

  Load `platform.status` during initialization. Implement email/password login without retaining the password, open the WeChat authorization URL through the preload method, poll the device transaction at the server-provided interval, refresh user/wallet after login, and clear all local UI state on logout.

- [ ] **Step 4: Implement payment state transitions.**

  Create one checkout with a generated idempotency key, create one payment attempt, render the QR payload as text or a safe QR-compatible container, poll `getCheckout`, refresh wallet only on `paid`, and show `manual_review` or expired states without automatically retrying or charging again.

- [ ] **Step 5: Add styles and accessible states.**

  Reuse existing colors, buttons, cards, and responsive layout. Add `aria-live` status text, disabled/loading states, keyboard labels, and a clear distinction between platform account data and local merchant accounts.

- [ ] **Step 6: Run UI tests and renderer syntax check.**

  ```bash
  node --test test/platform-ui.test.js
  node --check src/renderer/app.js
  ```

- [ ] **Step 7: Commit.**

  ```bash
  git add src/renderer/index.html src/renderer/app.js src/renderer/styles.css test/platform-ui.test.js
  git commit -m "feat: add platform account and payment controls"
  ```

### Task 5: Document operations, run full verification, and integrate

**Files:**
- Modify: `PROJECT_GUIDELINES.md`
- Modify: `docs/product-integration/elunvi-platform.md`
- Test: all `test/*.test.js`

**Interfaces:**
- Consumes: completed client, IPC, UI, and admin provisioning from Tasks 1-4.
- Produces: operator-ready runbook and a verified branch ready to push.

- [ ] **Step 1: Document operational checks.**

  Record how to verify the `elunvi-mart` product, desktop clients, support team permissions, login, wallet, and payment state in the admin UI. Explicitly state that credentials and tokens are never committed.

- [ ] **Step 2: Run the complete project checks.**

  ```bash
  npm test
  node --check src/main/main.js
  node --check src/renderer/app.js
  git diff --check
  git status --short --branch
  ```

  Expected: all tests pass, both syntax checks exit 0, no whitespace errors, and no sensitive/untracked runtime files appear.

- [ ] **Step 3: Launch the client for smoke verification.**

  Run `npm start`, verify the platform panel loads, use the provisioned test account or approved login path, and confirm merchant account login remains independent. Stop before any real payment unless a specific test amount and channel has been authorized.

- [ ] **Step 4: Commit final documentation and push.**

  ```bash
  git add PROJECT_GUIDELINES.md docs/product-integration/elunvi-platform.md
  git commit -m "docs: document Elunvi Mart platform operations"
  GIT_SSH_COMMAND='ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519' git push
  ```
