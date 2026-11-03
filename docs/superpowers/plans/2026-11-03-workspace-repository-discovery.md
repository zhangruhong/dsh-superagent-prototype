# Workspace Repository Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Discover repositories recursively under a configured workspace, select a target per Ticket, and create an isolated worktree for it.

**Architecture:** A pure scanner/ranker produces provider-neutral candidates. Setup stores the catalog and per-candidate adapters in Deployment; the main Session chooses a candidate through explicit or scored metadata, and the executor creates a worktree from the immutable Ticket binding.

**Tech Stack:** TypeScript, Zod, Node fs, existing DSH executor, Vitest.

---

### Task 1: Add scanner and ranking primitives

**Files:**
- Create: `src/repositories/workspace.ts`
- Test: `tests/workspace-repositories.spec.ts`

- [ ] Add `WorkspaceRepository`, remote parsing, recursive discovery with skip rules, and `selectWorkspaceRepository`.
- [ ] Test HTTPS/SSH remotes, default branch parsing, nested repositories, symlink/dependency skips, exact selection, scoring, and ambiguity.
- [ ] Run `pnpm vitest run tests/workspace-repositories.spec.ts`.

### Task 2: Extend repository configuration and setup

**Files:**
- Modify: `src/repositories/config.ts`
- Modify: `src/deployment.ts`
- Modify: `src/setup.ts`
- Modify: `src/app/setup.ts`
- Modify: `src/repositories/registry.ts`
- Test: `tests/provider-setup.spec.ts`

- [ ] Add workspace mode, absolute root, and default repository fields.
- [ ] Resolve the recursive catalog and provider adapters while preserving single-repository behavior.
- [ ] Add deployment setup errors for an invalid/empty workspace.
- [ ] Test workspace setup and adapter catalog creation.

### Task 3: Persist and expose the selected repository

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/core/ports.ts`
- Modify: `src/policy.ts`
- Modify: `src/app/assessment.ts`
- Modify: `src/app/tools/main.ts`
- Modify: `src/app/links.ts`
- Modify: `src/app/runtime.ts`
- Test: `tests/workspace-routing.spec.ts`

- [ ] Add optional repository selection to assessment and explicit routing schemas.
- [ ] Include a bounded catalog in candidate cards.
- [ ] Resolve and persist the selected binding at Ticket creation.
- [ ] Test explicit selection, scored fallback, and ambiguous rejection.

### Task 4: Create selected repository worktrees and adapters

**Files:**
- Modify: `src/executor/dsh.ts`
- Modify: `src/app/tools/executor.ts`
- Modify: `src/app/runtime.ts`
- Modify: `src/app/execution-environment.ts`
- Test: `tests/workspace-executor.spec.ts`

- [ ] Create a detached worktree from the Ticket binding before prepare.
- [ ] Select a repository adapter using the Ticket binding.
- [ ] Add provider-neutral repository path variables without credentials.
- [ ] Test the worktree command and adapter scope validation.

### Task 5: Update docs and verify

**Files:**
- Modify: `README.md`
- Modify: `docs/006-deployment.md`
- Modify: `docs/007-architecture.md`
- Modify: `prompts/dispatch.md`
- Modify: `prompts/admission.md`

- [ ] Document recursive discovery, selection syntax, ambiguity behavior, and worktree lifecycle.
- [ ] Run `pnpm vitest run tests/workspace-repositories.spec.ts tests/provider-setup.spec.ts tests/workspace-routing.spec.ts tests/workspace-executor.spec.ts`.
- [ ] Run `pnpm typecheck`, `pnpm build`, and `pnpm test`; record Windows POSIX-environment limitations separately.
- [ ] Commit and push the feature branch.

