# WeCom GitLab Provider Design

**Status:** Draft for review  
**Date:** 2026-11-03  
**Target branch:** `codex/wecom-gitlab-cnb`  
**Baseline:** upstream `deepseek-ai/dsh-superagent-prototype` at `6337fc823ce20251c8de8085948165c81aaa701e`

## Goal

Deliver the first usable vertical slice for the requested workflow:

1. A user mentions the WeCom bot in a group and assigns a task.
2. The agent runs against one configured GitLab project.
3. The agent reports progress and a merge-request link back to the same WeCom group.

The design must also leave a stable extension point for additional repository hosts and channels. CNB is included in this first slice as a configuration and capability skeleton so it can be selected later without coupling the core to GitLab or GitHub APIs.

## Scope

### Included

- WeCom intelligent-robot WebSocket source, group mention parsing, authorization, duplicate-event handling, reconnect, and outbound progress/link messages.
- GitLab repository provider for one project, including issue/MR lookup, comments, branch/commit information, pipeline status, and MR URL generation.
- Provider-neutral repository and change-request identities.
- Provider-aware executor reporting and polling paths.
- CNB provider interface, configuration validation, capability declaration, and typed `unsupported` responses for operations not yet implemented.
- Backward-compatible migration of existing tickets, GitHub, and Feishu configurations.
- Targeted tests and build/type checks.

### Excluded from this slice

- Live CNB API calls or CNB webhook registration.
- QQ bot, personal WeChat, and WeCom app-bot variants.
- Account-wide multi-project scheduling; a deployment selects one project for the first release.
- Automatic merge, deployment, or permission management.
- Rewriting persisted storage or moving credentials into a new secret service.

## Decisions

### Separate origin channels from repository providers

The existing `SourceKind` contract remains the channel/origin boundary. A new repository-provider contract owns repository and merge-request operations. A ticket records both the channel that accepted it and the repository binding used to execute it.

This keeps WeCom, Feishu, QQ, and future channels interchangeable, while GitHub, GitLab, and CNB can share the same execution model. Channel adapters never call provider SDKs directly; they emit normalized triggers and consume outbox notifications.

### Use provider-neutral identities

Every external change request is addressed by a canonical key containing provider, host, repository, object kind, and IID:

```text
<provider>:<host>:<repository-id>:<kind>:<iid>
```

For example, `gitlab:gitlab.example.com:group/project:merge-request:42` and `gitlab:gitlab.example.com:group/project:issue:42` remain distinct. This prevents the Issue/MR/PR same-number collision found in the researched fork.

### Preserve the existing tool boundary during migration

`orchestrator_report` keeps accepting the existing `pr_number` field for GitHub compatibility. It gains a structured `change_request` field containing provider, repository, kind, and IID. A request may use either representation; mixed values are rejected with a clear validation error. New provider implementations use the structured form.

### Bind a ticket to one repository

The first release resolves one immutable `RepositoryBinding` when a ticket is created. Later provider or project changes do not silently redirect an existing ticket. A future multi-project scheduler can create separate bindings and routing rules without changing the ticket identity model.

## Proposed model

Add the following domain concepts under `src/core/model.ts`:

- `RepositoryProvider = "github" | "gitlab" | "cnb"`.
- `RepositoryBinding` with provider, host, repository identifier, default branch, and optional project metadata.
- `RepositoryCapabilities` describing supported read, comment, branch, pipeline, merge-request, and watch operations.
- `ChangeRequestKind = "issue" | "pull-request" | "merge-request"`.
- `ChangeRequestRef` with provider, repository, kind, IID, and URL.
- Optional `Ticket.repository` carrying the binding and selected change request.

Existing ticket records without `repository` deserialize unchanged. Migration only fills defaults when the deployment has an unambiguous repository configuration; otherwise the ticket remains usable with its old GitHub execution path.

Add canonical key helpers under `src/core/ids.ts`. All provider polling, claim, comment, and cursor maps use these helpers rather than raw numeric IDs.

## Repository provider boundary

Create `src/repositories/adapter.ts` with a small async contract:

- `health()` and `capabilities()`.
- `readIssue()` / `readChangeRequest()`.
- `comment()`.
- `createBranch()` / `readCommit()` where supported.
- `readPipeline()` and `watchChangeRequest()`.
- `claimChangeRequest()` and `reportChangeRequest()`.
- `link()` for user-facing URLs.

Create `src/repositories/registry.ts` to validate provider configuration, construct the selected adapter, and expose provider-specific setup errors. Existing GitHub operations are wrapped behind this boundary incrementally so the current behavior remains available during migration.

Create `src/repositories/gitlab.ts` for GitLab REST operations. It must support a GitLab.com or self-managed host, project path or numeric project ID, private-token authentication, issue/MR comments, MR URL generation, and pipeline status. Pagination and polling cursors are persisted by canonical change-request key.

Create `src/repositories/cnb.ts` and `src/repositories/config.ts` for CNB. The adapter validates host, repository, and token shape and exposes the declared capabilities. Unimplemented operations return a typed `UnsupportedRepositoryOperation` without making a network request. The implementation is ready for the documented CNB issue, pull-request, build, commit, and event APIs in a later slice.

## WeCom channel boundary

Add `src/sources/wecom.ts`, `wecom-trigger.ts`, `wecom-channel.ts`, `wecom-read.ts`, and `wecom-ws.ts`, based on the researched intelligent-robot WebSocket implementation while adapting it to the official source contract.

The adapter will:

- accept only explicitly mentioned group messages for task creation;
- ignore bot self-messages and unsupported message types;
- apply an allow-list policy by group and user;
- deduplicate by WeCom message/event ID;
- reconnect with bounded backoff and restore subscriptions;
- send progress, errors, and MR links through the source outbox;
- keep outbound delivery idempotent so a reconnect cannot duplicate a notification.

The normalized trigger carries channel, group, sender, message ID, text, and reply context. Provider details are absent from the trigger; deployment setup resolves the repository binding.

## Configuration and setup

Extend `src/deployment.ts` and `src/app/setup.ts` with:

- a `wecom` account containing WebSocket credentials, group/user allow-list, and notification policy;
- a `repository` selection containing provider, host, project/repository, token reference, default branch, and polling interval;
- provider-specific validation and health reporting;
- startup that succeeds for GitLab-only or CNB-configured deployments without requiring a GitHub account.

Secrets remain references in configuration and are redacted from logs and errors. Existing GitHub and Feishu account schemas continue to load.

## Runtime flow

1. WeCom WebSocket receives a group event and validates signature/session state.
2. The trigger adapter checks mention, allow-list, bot-self, type, and deduplication rules.
3. `SourceContext.receiveTrigger` applies policy and creates a ticket with the selected repository binding.
4. The worker executes provider-neutral tools; `orchestrator_report` writes a structured change-request reference.
5. The repository adapter atomically claims or reports the GitLab MR and returns its canonical URL.
6. Polling reads comments, pipeline status, and close/merge state using a persisted cursor.
7. Notifications are written to the outbox and delivered to the originating WeCom group with the MR link.

Abort, retry, and shutdown paths preserve the cursor and ticket binding. Unknown CI states remain unknown and are not converted to success.

## Error handling and compatibility

- Setup errors identify the account/provider and actionable field without exposing tokens.
- A malformed or mixed legacy/structured report is rejected before provider mutation.
- Claim/report operations are idempotent and use the canonical key.
- A failed WeCom send stays in the outbox for retry and is not silently dropped.
- Old tickets, GitHub PR numbering, Feishu messages, and existing commands remain readable during migration.
- CNB unsupported operations are explicit in health output and logs, with no false success.

## Test plan

Add focused tests for:

- canonical identity keys distinguishing issue, pull-request, and merge-request objects with the same number;
- repository binding config and GitLab-only setup without GitHub;
- WeCom group mention, direct message rejection, unauthorized user, bot-self, duplicate event, reconnect, and outbound idempotency;
- structured merge-request reporting, legacy GitHub `pr_number`, mixed-field rejection, and atomic provider failure;
- GitLab comment/pipeline/unknown/close/merge transitions and cursor persistence;
- CNB config parsing and typed unsupported operations with no network call;
- migration of tickets created before repository bindings existed.

Validation commands after implementation:

```text
pnpm typecheck
pnpm vitest run <targeted provider and source tests>
pnpm build
pnpm check
```

The exact targeted test paths will follow the repository's existing test layout.

## Rollout

The first deployment enables one GitLab project and one WeCom robot. CNB may be configured for capability discovery but remains disabled for live task execution until its adapter methods are implemented. GitHub and Feishu remain available through their existing configuration.

Follow-up slices can add live CNB operations, QQ's official bot API, personal WeChat only if an approved business account route exists, multi-project routing, and stronger secret storage. These additions should implement the existing channel/provider contracts rather than modify ticket semantics.

## Review checklist

- Does the split between channel and repository provider cover the requested WeCom + GitLab + CNB direction?
- Is the first slice small enough to test and deploy safely?
- Are the identity and migration rules sufficient to avoid cross-provider and Issue/MR collisions?
- Are any required behaviors or deployment constraints missing before implementation begins?
