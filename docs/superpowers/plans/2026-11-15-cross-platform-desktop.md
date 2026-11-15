# Cross-platform Desktop Implementation Plan

**Goal:** Complete native Windows execution and preserve the POSIX path for macOS/Linux; validate Windows locally and document the remaining OS acceptance.

**Architecture:** Share deployment, repository and channel behavior. Centralize executable lookup and invocation, make paths platform aware, and inject worker environment per managed command and managed shell. Keep the host process environment unchanged. Desktop owns its process lifecycle; the existing Python/tmux helper remains a POSIX Web/CLI helper.

**Validation boundary:** Local automated tests use temporary repositories and fake account CLIs. Desktop plugin loading is checked with an isolated profile without editing the user's active profile or sending external messages. Real authenticated task acceptance remains separately identified.

## Tasks (execute inline in the current feature branch)

- [x] Reproduce Windows failures with the original full suite; record the baseline separately from fixes.
- [x] Add regression tests for drive/UNC paths, executable suffix lookup, `.cmd/.ps1` execution with literal arguments, probe environment, failure status, cancellation, and wrapper recursion.
- [x] Create `src/infra/platform.ts` for path normalization, executable resolution and native CLI invocation. Wire it into deployment, host Commands and streaming Feishu commands. Remove external `env` dependencies.
- [x] Fix worker wrappers; test nested account wrappers, paths with spaces/Chinese, and environment isolation.
- [x] Replace process-global environment mutation with a worker environment service used by preset shell adapters and executor prepare/worktree/verification commands. Test that an ordinary host session retains its environment.
- [x] Filter the router tool list by actually registered tools and guard both bash and PowerShell against waits.
- [x] Make existing OS-specific tests explicit and portable where appropriate; retain POSIX executable-script and service tests for macOS/Linux.
- [x] Run Windows tests, typecheck and build; verify the built plugin against the installed Harness Desktop host in an isolated profile.
- [x] Document setup and Windows evidence, plus macOS/Linux acceptance steps and limits. Review the final diff and commit only task files.

## Core acceptance cases

1. `Config({ stateDir: absoluteWindowsDirectory })` and executor directory settings accept local absolute paths and reject relative paths.
2. `gh` resolves to a real executable outside worker-bin, respecting Windows case-insensitive PATH and suffixes.
3. A command wrapper receives literal spaces, Unicode and shell metacharacters; a nonzero status and cancellation are observable.
4. Worker startup probes and prepare commands use explicit environment entries without invoking the external POSIX `env` binary.
5. A worker shim invoking an account wrapper which invokes `gh` by name reaches the real CLI once.
6. Setup, concurrent managed sessions, shutdown and failed setup never rewrite `process.env`.
7. The router only restricts known tools; PowerShell receives the same wait limits as bash.
8. A local temporary repository supports worktree creation, code modification, test execution and commit under the isolated worker environment.
9. macOS/Linux follow the existing POSIX executable and shell behavior; native OS runs are deferred to the user's acceptance machines.

## Review findings and fixes

- Initial Windows baseline: 1203 passed, 38 failed out of 1241 tests.
- Independent review found that cmd.exe truncates multiline payloads and additional batch forwarding corrupts embedded quotes. Provider calls now use GitHub/Lark file inputs, with native regressions for cmd and PowerShell account wrappers, long Chinese text and failure cleanup. Generic batch calls reject unsafe quotes/newlines explicitly.
- Feishu consumer tests use deterministic disable polling and platform-specific native startup budgets; teardown closes SQLite even on assertion failures. Production readiness deadlines remain unchanged.
- Final Windows regression: 68 test files, 1,267 cases; 1,244 passed, 0 failed, 23 POSIX-only cases skipped. macOS/Linux and authenticated chat-to-MR acceptance remain for native environments.

## Final verification

- Windows full suite: 1,244 passed / 0 failed / 23 POSIX-only skipped (1,267 total; 68 files).
- Final TypeScript check and tsdown build: exit 0; package tarball created successfully.
- Installed Desktop runtime: final built bundle imports successfully against bundled 0.2.2-rc.1 peers, and its actual PowerShell executor returns the expected worker environment marker (Electron Node 24.21.0). Earlier isolated Host profile check returned HTTP 200; temporary Host stopped and port closed.
- Focused independent review after the payload fixes: no additional findings.
- No live account messages or remote MR creation performed; native macOS/Linux and authenticated acceptance are documented in docs/desktop-acceptance.md.
