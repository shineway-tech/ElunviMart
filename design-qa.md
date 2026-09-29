# Design QA — Elunvi Mart account and password surfaces

- source visual truth: `/Users/honeykid/.codex/generated_images/01a0c7d8-dbb3-75c2-b5c4-512863ceeff7/exec-c0664df0-45fa-493d-8f6a-97ce7f0a133e.png`
- implementation: current `main` worktree and packaged app at `/Users/honeykid/workstation/ElunviMartWorkspace/frontend/release/mac-universal/Elunvi Mart.app`
- reference viewport: desktop 1440 x 1024; native window was inspected in the packaged app at its available desktop size
- captured states: signed-in account footer, account menu, settings, merchant account empty state, and the team entry point

## Findings

- The native-window verification blocker is resolved. The packaged client launches and renders the account footer, account menu, settings view, and merchant account empty state.
- The completed `团队` and `钱包` entries are available in the primary sidebar again, and the account menu keeps its `我的团队` and `钱包` shortcuts as a second entry point.
- The existing local Mart session expired when the team view was opened. The client showed `登录状态已失效，请重新登录` and the empty/error state. A populated team or wallet data-state requires a valid test session; no credentials were supplied for this pass.
- The password-change surface switches to a compact right-pane-only modal. Its email field is populated from the active account and read-only, while normal password reset restores an editable email field.
- Password-change verification uses its own `password_reset` challenge state; after the code is sent, the informational email notice is cleared and submit no longer falls through to the “请先点击获取验证码” prompt.
- Merchant row actions use external-link, log-in, and trash icons. Notification channels use monitor, message-circle-more, and send icons to match their actions.
- Lucide is loaded from a bundled renderer asset so sidebar, settings, account actions, and form controls render in both the worktree client and packaged app.

## Verification

- Frontend automated suite: 84/84 passed.
- Node syntax checks passed for `src/main/main.js`, `src/main/platform-service.js`, and `src/renderer/app.js`.
- `git diff --check` passed.
- `pnpm run package:mac` completed successfully and produced the unsigned local smoke-test package; signing and notarization remain CI responsibilities.
- Packaged Electron window was restarted and inspected natively.

## Final result

final result: passed for the native shell, account menu, settings, and password surfaces; populated team/wallet data-state remains pending a valid authenticated test session.
