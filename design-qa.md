# Design QA — Elunvi Mart account and password surfaces

- source visual truth: `/Users/honeykid/.codex/generated_images/01a0c7d8-dbb3-75c2-b5c4-512863ceeff7/exec-c0664df0-45fa-493d-8f6a-97ce7f0a133e.png`
- implementation: Electron window from `/tmp/ElunviMart-platform-integration`
- target viewport: desktop 1440 x 1024 reference; native Mart window inspected after restart
- implementation state captured: signed-out login state
- intended comparison states: signed-in account footer with account menu expanded, password-change form, settings and merchant action icons

## Findings

- [P2] Authenticated account-menu visual comparison is blocked because the current client has no active Platform session and no test account credentials were supplied for this pass. The implementation has automated DOM coverage for the sidebar account placement and menu actions, plus a native signed-out launch check. The signed-in avatar, email fallback, popover placement, and menu open state still require one live authenticated capture.
- The password-change surface now switches to a compact right-pane-only modal; its email field is populated from the active account and read-only, while normal password reset restores an editable email field.
- Password-change verification now uses its own challenge state; after the code is sent the informational email notice is cleared, and submit no longer falls through to the “请先点击获取验证码” prompt.
- Merchant row actions use external-link, log-in, and trash icons; notification channels use monitor, message-circle-more, and send icons to match their actions.
- Lucide is now loaded from a bundled Mart renderer asset so sidebar, settings, account actions, and form controls render in both the worktree client and packaged app.
- Password-change verification now requests a `password_reset` challenge, matching the Platform endpoint consumed by `/v1/me/password`.

## Verification

- Full automated suite: 65/65 passed.
- Node syntax checks passed for `src/main/main.js`, `src/main/platform-service.js`, and `src/renderer/app.js`.
- `git diff --check` passed.
- Signed-out client restart and login surface inspected in the native Electron window.

## Final result

final result: blocked
