# 营销竞价响应捕获实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将营销活动商品同步改为由隐藏营销竞价页面发起请求、应用捕获并解析 `bidList` 响应的模式，删除 Node 侧手工 `Anti-Content` 请求代码。

**Architecture:** 每个账号维护一个隐藏的真实 Electron 页面；页面通过 DevTools Protocol Network 事件产生并捕获 `bidList` 响应。分页请求在页面上下文执行并继续由 Network 响应捕获器解析。账号级同步队列串行化自动和手动同步，现有商品归并、缓存和通知逻辑继续复用。

**Tech Stack:** Electron 37 `webContents.debugger`, Node.js `EventEmitter`, Electron `webContents.executeJavaScript`, Node test runner。

**Spec:** `docs/superpowers/specs/2026-09-20-marketing-bid-response-capture-design.md`

## Global Constraints

- Node 侧不再调用 `executeJavaScript(fetch('/lakemms/bid/query/bidList'))`。
- 页面上下文负责 Cookie、请求头和 `Anti-Content`。
- 同一账号同一时间最多一个同步任务。
- 单次同步必须有响应超时、最大页数和最大商品数限制。
- 现有 `reconcileProducts`、掉标状态、通知和本地缓存行为保持不变。
- 不新增运行时依赖。

## Review Focus

- 页面响应事件先于同步等待注册时到达：必须缓存并交付已到达的匹配响应，不能丢第一页。
- 页面返回错误 JSON 或 HTTP 401/403：必须转成现有适配器错误并保留旧缓存。
- 多账号并行同步：不同账号可以并行，但同一账号不能并发。
- 分页缺页、重复页和 `total` 超过预算：必须停止并返回明确错误，不能无限请求。
- 可见登录窗口与隐藏监控窗口：同步不能强制把用户正在使用的登录窗口导航到营销页。

### Task 1: 建立页面响应捕获器

**Files:**
- Create: `src/main/pdd-response-capture.js`
- Test: `test/pdd-response-capture.test.js`

**Interfaces:**
- Produces `PddResponseCapture` with `attach(webContents)`, `detach()`, `waitForPage({ page, timeoutMs })`, `requestPage(webContents, request)`, and `close()` methods.
- Produces `isBidListResponse(url)` and `parseBidListResponseBody(body)` pure helpers for unit tests.

- [ ] **Step 1: Write failing tests**

  Cover URL filtering, request ID matching, response-body JSON parsing, malformed body rejection, HTTP error propagation, timeout, and a response arriving before `waitForPage` is called.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `node --test test/pdd-response-capture.test.js`

  Expected: FAIL because the capture module does not exist.

- [ ] **Step 3: Implement the minimal capture module**

  Attach the debugger, enable `Network`, listen for `message`, filter `Network.responseReceived` events by `POST` bid-list URL, call `Network.getResponseBody`, parse the JSON, and store unmatched responses in a bounded per-page buffer. Resolve the oldest matching waiter by page number; reject non-2xx responses and malformed payloads with `AdapterResponseError`.

- [ ] **Step 4: Run focused tests and verify pass**

  Run: `node --test test/pdd-response-capture.test.js`

  Expected: all capture tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/pdd-response-capture.js test/pdd-response-capture.test.js
  git commit -m "feat: capture bid list responses from page network"
  ```

### Task 2: Add hidden monitoring page and page-context pagination

**Files:**
- Create: `src/main/merchant-session.js`
- Modify: `src/main/pdd-adapter.js`
- Modify: `src/main/main.js:72-148, 261-289, 394-423`
- Test: `test/pdd-adapter.test.js`
- Test: `test/merchant-session.test.js`

**Interfaces:**
- `MerchantSessionManager.ensureMonitoringPage(accountId)` returns `{ window, webContents }` and never shows a newly created monitor window.
- `MerchantSessionManager.close(accountId)` releases debugger and window resources.
- `PddActivityAdapter.syncProducts(account)` uses the session manager and capture service; it returns a complete mapped product snapshot.

- [ ] **Step 1: Extend tests with failing page-driven sync cases**

  Add a fake page context where the first page response is emitted by the page, then `requestPage` executes in the page context for pages 2 and 3. Assert that `syncProducts` returns all rows, never calls a Node-side `fetch`, rejects a page timeout, and enforces page/product budgets.

  Add session tests asserting a new monitoring window is created with `show: false`, that an existing visible login window is not navigated by `ensureMonitoringPage`, and that closing a session detaches the debugger.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `node --test test/pdd-adapter.test.js test/merchant-session.test.js`

  Expected: FAIL because the session manager and page-driven adapter interfaces are not implemented.

- [ ] **Step 3: Implement `MerchantSessionManager`**

  Move account partition/window setup into the new manager. Create a dedicated hidden monitor window after login, navigate it to `BID_PAGE_URL`, attach `PddResponseCapture` before navigation, and keep visible login windows untouched. Clean up debugger, listeners, response caches, and window references on close.

- [ ] **Step 4: Replace adapter request path**

  Remove `executeBidListRequest`, `getAntiContent`, `ensureBidPage`, `BID_LIST_PATH`, and the manual `Anti-Content` fetch path. `syncProducts` waits for the page’s first captured response, then invokes a page-context function that uses the same page `fetch` with the observed request contract for each remaining page. Add a randomized delay between pages, `MAX_BID_LIST_PAGES`, `MAX_BID_LIST_PRODUCTS`, and a per-page timeout.

- [ ] **Step 5: Wire main process to the session manager**

  Construct one manager in `app.whenReady`, pass it to the adapter, create monitor pages after successful login, and close them on account removal and app quit. Preserve `syncAccount` reconciliation and notification behavior.

- [ ] **Step 6: Run focused tests and verify pass**

  Run: `node --test test/pdd-adapter.test.js test/merchant-session.test.js`

  Expected: all page-driven sync and session lifecycle tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add src/main/merchant-session.js src/main/pdd-response-capture.js src/main/pdd-adapter.js src/main/main.js test/pdd-adapter.test.js test/merchant-session.test.js
  git commit -m "feat: sync products from hidden page responses"
  ```

### Task 3: Serialize account sync and add bounded retry behavior

**Files:**
- Create: `src/main/sync-queue.js`
- Modify: `src/main/main.js:261-289, 376-379, 403-418`
- Modify: `src/main/scheduler.js:21-43`
- Test: `test/sync-queue.test.js`
- Test: `test/scheduler.test.js`

**Interfaces:**
- `SyncQueue.run(accountId, task)` serializes tasks per account while allowing different accounts to run in parallel.
- `SyncQueue.isRunning(accountId)` reports active work.
- Scheduler skips accounts whose queue is already running.

- [ ] **Step 1: Write failing queue and scheduler tests**

  Test same-account serialization, different-account parallelism, queued task cancellation on account removal, and scheduler skip behavior. Add retry tests for `54001`: no immediate in-call retry, a backoff delay is scheduled, and the account is not marked successful.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `node --test test/sync-queue.test.js test/scheduler.test.js`

  Expected: FAIL because `SyncQueue` and scheduler skip behavior do not exist.

- [ ] **Step 3: Implement queue and scheduler integration**

  Route both `products:sync` and scheduled sync through `SyncQueue`. Return a clear manual “同步进行中” error when the account is busy; scheduled work silently skips. Move retry timing to scheduler state with exponential backoff and a maximum delay. Keep existing 60-second manual cooldown as a separate user-facing guard.

- [ ] **Step 4: Run focused tests and verify pass**

  Run: `node --test test/sync-queue.test.js test/scheduler.test.js`

  Expected: all queue, skip, and backoff tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/sync-queue.js src/main/main.js src/main/scheduler.js test/sync-queue.test.js test/scheduler.test.js
  git commit -m "feat: serialize account sync and back off retries"
  ```

### Task 4: Delete superseded request code and update adapter tests

**Files:**
- Modify: `src/main/pdd-adapter.js`
- Modify: `src/main/main.js`
- Modify: `test/pdd-adapter.test.js`
- Modify: `test/product-monitor.test.js` only if test fixtures reference removed request helpers

- [ ] **Step 1: Remove obsolete paths**

  Delete the manual `executeBidListRequest`, anti-content polling map, request-header capture used only by that path, and any `ensureBidPage` branches that force a page reload for every sync. Keep `buildBidListRequest` only if it is used to construct page-context pagination requests; otherwise remove it and its tests.

- [ ] **Step 2: Search for dead references**

  Run: `rg -n "executeBidListRequest|antiContentByAccount|getAntiContent|ensureBidPage|BID_LIST_PATH|Anti-Content" src test`

  Expected: only response-capture/session code references the browser-network behavior; no Node-side manual bid-list fetch remains.

- [ ] **Step 3: Update tests to assert the new contract**

  Replace tests that expect `fetch` calls from a fake BrowserWindow with tests that emit debugger response events and assert page-context pagination calls.

- [ ] **Step 4: Run the complete test suite**

  Run: `node --test test/*.test.js`

  Expected: all tests pass with zero failures.

- [ ] **Step 5: Commit**

  ```bash
  git add src/main/pdd-adapter.js src/main/main.js test/pdd-adapter.test.js test/product-monitor.test.js
  git commit -m "refactor: remove manual bid list request path"
  ```

### Task 5: Final verification and operator documentation

**Files:**
- Modify: `PROJECT_GUIDELINES.md` only if the repository documents sync behavior there
- Modify: `docs/superpowers/specs/2026-09-20-marketing-bid-response-capture-design.md` if implementation constraints changed

- [ ] **Step 1: Run static searches and syntax checks**

  Run:

  ```bash
  rg -n "executeJavaScript.*fetch|lakemms/bid/query/bidList|Anti-Content" src/main test
  node --check src/main/main.js
  node --check src/main/pdd-adapter.js
  node --check src/main/pdd-response-capture.js
  node --check src/main/merchant-session.js
  ```

  Expected: no manual Node-side bid-list fetch; all syntax checks exit 0.

- [ ] **Step 2: Run the full test suite**

  Run: `node --test test/*.test.js`

  Expected: all tests pass.

- [ ] **Step 3: Review the final diff**

  Run: `git diff origin/main...HEAD --stat && git diff origin/main...HEAD --check`

  Expected: only response-capture implementation, sync queue, tests, and related documentation are changed; no whitespace errors.

- [ ] **Step 4: Commit documentation changes if any**

  ```bash
  git add PROJECT_GUIDELINES.md docs/superpowers/specs/2026-09-20-marketing-bid-response-capture-design.md
  git commit -m "docs: document page response sync behavior"
  ```
