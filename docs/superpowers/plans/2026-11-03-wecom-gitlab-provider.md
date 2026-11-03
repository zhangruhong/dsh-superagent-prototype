# WeCom GitLab Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a provider-neutral repository boundary, a GitLab implementation, a CNB capability skeleton, and a WeCom group-bot source while preserving the existing GitHub and Feishu behavior.

**Architecture:** Tickets keep their originating channel and gain an optional immutable repository binding. Repository adapters expose typed read/comment/change-request operations behind a registry; channel adapters continue to implement `SourceKind` and communicate through normalized triggers and the outbox. The first live path targets one GitLab project and one WeCom robot; CNB validates configuration but returns typed unsupported results until its network operations are implemented.

**Tech Stack:** TypeScript ESM, Zod 4 schemas, existing SourceKind/SourceRegistry contracts, Vitest, pnpm, GitLab CLI/API, WeCom intelligent-robot WebSocket.

---

### Task 1: Provider-neutral domain types and identity keys

**Files:**
- Modify: `src/core/model.ts`
- Modify: `src/core/ids.ts`
- Modify: `src/core/index.ts`
- Test: `tests/model-surface.spec.ts`
- Test: `tests/ids.spec.ts`

- [ ] **Step 1: Write failing identity and model tests**

```ts
it('keeps same IID objects distinct by provider and kind', () => {
  expect(changeRequestKey({ provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'issue', iid: 42 }))
    .toBe('gitlab:gitlab.com:acme/app:issue:42')
  expect(changeRequestKey({ provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'merge-request', iid: 42 }))
    .not.toBe(changeRequestKey({ provider: 'gitlab', host: 'gitlab.com', repository: 'acme/app', kind: 'issue', iid: 42 }))
})
```

- [ ] **Step 2: Run the focused tests and verify the new symbol is missing**

Run: `pnpm vitest run tests/ids.spec.ts tests/model-surface.spec.ts`  
Expected: FAIL because `changeRequestKey` and the repository types are not exported.

- [ ] **Step 3: Add the minimal types and canonical key helper**

```ts
export type RepositoryProvider = 'github' | 'gitlab' | 'cnb'
export type ChangeRequestKind = 'issue' | 'pull-request' | 'merge-request'
export interface RepositoryBinding { provider: RepositoryProvider; host: string; repository: string; defaultBranch?: string }
export interface ChangeRequestRef extends RepositoryBinding { kind: ChangeRequestKind; iid: number; url?: string }
export const changeRequestKey = (ref: Pick<ChangeRequestRef, 'provider' | 'host' | 'repository' | 'kind' | 'iid'>): string =>
  [ref.provider, ref.host.toLowerCase(), ref.repository, ref.kind, String(ref.iid)].join(':')
```

Add `repository?: RepositoryBinding` to `Ticket` and re-export the new symbols from `src/core/index.ts`.

- [ ] **Step 4: Run the focused tests and typecheck**

Run: `pnpm vitest run tests/ids.spec.ts tests/model-surface.spec.ts && pnpm typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/core/model.ts src/core/ids.ts src/core/index.ts tests/ids.spec.ts tests/model-surface.spec.ts
git commit -m "feat: add provider-neutral repository identities"
```

### Task 2: Repository adapter contract, registry, GitLab, and CNB skeleton

**Files:**
- Create: `src/repositories/adapter.ts`
- Create: `src/repositories/config.ts`
- Create: `src/repositories/registry.ts`
- Create: `src/repositories/gitlab.ts`
- Create: `src/repositories/cnb.ts`
- Test: `tests/repositories.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

Test that GitLab config accepts `hostname`, `project`, `token`, and `pollSeconds`; that `link()` returns `/-/merge_requests/:iid`; that the registry selects GitLab; and that CNB's unimplemented operation rejects with `UnsupportedRepositoryOperation` without invoking its transport.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run tests/repositories.spec.ts`  
Expected: FAIL because `src/repositories/*` does not exist.

- [ ] **Step 3: Implement the typed adapter contract**

```ts
export interface RepositoryAdapter {
  provider: RepositoryProvider
  binding: RepositoryBinding
  capabilities(): RepositoryCapabilities
  health(): Promise<RepositoryHealth>
  link(ref: ChangeRequestRef): string
  readChangeRequest(ref: ChangeRequestRef): Promise<ChangeRequest>
  comment(ref: ChangeRequestRef, body: string): Promise<void>
  reportChangeRequest(ref: ChangeRequestRef, action: 'claim' | 'close'): Promise<void>
}
export class UnsupportedRepositoryOperation extends Error {
  constructor(readonly operation: string, provider: RepositoryProvider) { super(`${provider} does not support ${operation}`) }
}
```

Keep transport injectable. The GitLab adapter uses `glab api` through a narrow `run(argv)` function, validates host/project identity, paginates bounded reads, and never embeds tokens in errors. The CNB adapter implements configuration and capabilities and throws the typed error for network operations.

- [ ] **Step 4: Run repository tests and typecheck**

Run: `pnpm vitest run tests/repositories.spec.ts && pnpm typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/repositories tests/repositories.spec.ts
git commit -m "feat: add gitlab repository adapter and cnb boundary"
```

### Task 3: Deployment configuration and provider-aware setup

**Files:**
- Modify: `src/deployment.ts`
- Modify: `src/app/setup.ts`
- Modify: `src/setup.ts`
- Modify: `tests/deployment.spec.ts`

- [ ] **Step 1: Add failing setup tests**

Cover GitLab-only setup without a GitHub repository, WeCom account validation, provider-specific setup errors, and legacy GitHub setup remaining unchanged.

- [ ] **Step 2: Run setup tests and confirm the current GitHub-required failure**

Run: `pnpm vitest run tests/deployment.spec.ts`  
Expected: the new GitLab-only case fails with `repositoryUnset`.

- [ ] **Step 3: Add schemas and resolve the selected provider**

Add `GitlabRepositorySchema`, `WecomBotSchema`, and `RepositoryConfigSchema`. Extend `Deployment` with `repositoryBinding` and optional `wecom`. `resolveDeployment` must branch on provider: retain the current GitHub CLI probe for `github`, validate GitLab host/project/token for `gitlab`, and validate CNB fields without claiming live support. Add setup codes for GitLab and WeCom while keeping old codes.

- [ ] **Step 4: Run deployment tests and typecheck**

Run: `pnpm vitest run tests/deployment.spec.ts && pnpm typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/deployment.ts src/app/setup.ts src/setup.ts tests/deployment.spec.ts
git commit -m "feat: configure gitlab and wecom deployments"
```

### Task 4: WeCom channel adapter and source registration

**Files:**
- Create: `src/sources/wecom-trigger.ts`
- Create: `src/sources/wecom-channel.ts`
- Create: `src/sources/wecom-read.ts`
- Create: `src/sources/wecom-ws.ts`
- Create: `src/sources/wecom.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Test: `tests/wecom-trigger.spec.ts`
- Test: `tests/wecom-ws.spec.ts`

- [ ] **Step 1: Write failing trigger and transport tests**

Cover group mention normalization, direct messages, bot-self filtering, duplicate IDs, markdown truncation, subscription acknowledgement, heartbeat timeout, reconnect callback, and send acknowledgement.

- [ ] **Step 2: Run focused tests and verify missing modules**

Run: `pnpm vitest run tests/wecom-trigger.spec.ts tests/wecom-ws.spec.ts`  
Expected: FAIL because the WeCom source modules are absent.

- [ ] **Step 3: Port and adapt the researched WebSocket implementation**

Use the tested `samanhappy` implementation as source material, but keep the official `SourceKind` contract: `wecomTrigger()` emits a normalized `Trigger`, `wecomChannel.send()` uses the active connection and outbox message ID, `wecom-read.ts` stores a bounded in-memory transcript, and `wecom.ts` owns health/reconnect and policy allow-list checks. Add `ws` and `@types/ws` only if the existing lockfile does not already provide them.

- [ ] **Step 4: Register the source and run focused checks**

Export `apply()`/`wecomKind`, register it in the composition path used by tests, and run:

`pnpm vitest run tests/wecom-trigger.spec.ts tests/wecom-ws.spec.ts tests/registry.spec.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/sources/wecom* package.json pnpm-lock.yaml tests/wecom*.spec.ts
git commit -m "feat: add wecom intelligent robot source"
```

### Task 5: Provider-aware reporting, migration, and execution environment

**Files:**
- Modify: `src/app/tools/executor.ts`
- Modify: `src/app/execution-environment.ts`
- Modify: `src/app/migration.ts`
- Modify: `src/app/runtime.ts`
- Test: `tests/tools.spec.ts`
- Test: `tests/migration.spec.ts`

- [ ] **Step 1: Write failing reporting and migration tests**

Cover structured `change_request`, legacy GitHub `pr_number`, mixed-field rejection, binding persistence, old tickets loading without a repository, and GitLab environment variables being present only for GitLab tickets.

- [ ] **Step 2: Run focused tests and confirm the old GitHub-only behavior**

Run: `pnpm vitest run tests/tools.spec.ts tests/migration.spec.ts`  
Expected: the structured GitLab report is rejected or unavailable while the legacy GitHub case passes.

- [ ] **Step 3: Implement the compatibility layer**

Extend the report schema with:

```ts
change_request: z.object({ provider: z.enum(['github', 'gitlab', 'cnb']), host: z.string(), repository: z.string(), kind: z.enum(['issue', 'pull-request', 'merge-request']), iid: z.number().int().positive() }).optional()
```

Reject requests containing both fields, resolve the ticket binding, and delegate to the repository registry. Preserve the existing `readPull`/`claimPull` path when only `pr_number` is supplied. Update migration to leave existing JSON intact and add provider cursor namespaces without rewriting old keys. Add provider variables to `ticketEnvironment()`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm vitest run tests/tools.spec.ts tests/migration.spec.ts && pnpm typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add src/app/tools/executor.ts src/app/execution-environment.ts src/app/migration.ts src/app/runtime.ts tests/tools.spec.ts tests/migration.spec.ts
git commit -m "feat: report provider-neutral change requests"
```

### Task 6: Documentation, skills, and complete verification

**Files:**
- Create: `skills/gitlab/SKILL.md`
- Create: `skills/wecom/SKILL.md`
- Create: `skills/cnb/SKILL.md`
- Modify: `docs/006-deployment.md`
- Modify: `README.md`
- Test: `tests/docs.spec.ts`

- [ ] **Step 1: Add docs tests for configuration and safety statements**

Assert the deployment docs name GitLab, WeCom, CNB capability-only status, token redaction, and the one-project first-release scope.

- [ ] **Step 2: Write the operator documentation and provider skills**

Document the exact environment/config fields, WeCom group mention requirement, GitLab token scope, CNB unsupported operations, and the commands `pnpm typecheck`, `pnpm test`, and `pnpm build`.

- [ ] **Step 3: Run the full verification suite**

Run: `pnpm check`  
Expected: typecheck, all Vitest tests, and build complete successfully.

- [ ] **Step 4: Review the final diff and commit**

Run: `git diff origin/main...HEAD --stat` and `git status --short`; confirm `.research/`, `docs/research/`, and `forks.json` remain uncommitted research artifacts. Then commit the documentation and final fixes:

```text
git add skills docs/006-deployment.md README.md tests/docs.spec.ts
git commit -m "docs: document gitlab wecom and cnb providers"
```
