# Workspace Repository Discovery Design

## Goal

Allow dsh-superagent to discover Git repositories recursively under a configured workspace directory and select one repository per Ticket before creating an isolated worktree.

## Scope

- Add a Repository Source workspace mode with an absolute `workspaceRoot`.
- Recursively discover Git repositories, skipping `.git`, dependency/build/cache directories, and symbolic links.
- Parse each repository's origin remote and default branch into a provider-neutral candidate.
- Expose the bounded repository catalog to the orchestrator.
- Let explicit routing and proactive assessment name a repository alias or remote path.
- Select a repository by exact identifier first, then metadata scoring; reject ambiguous selections instead of modifying an arbitrary repository.
- Persist the selected repository binding on the Ticket, including its local path for worktree creation.
- Create a detached Git worktree for the selected repository automatically.
- Resolve provider adapters per selected repository using the configured provider token.

Out of scope for this slice:

- Editing multiple repositories in one Ticket.
- Cloning missing remote repositories.
- Searching file contents across repositories.
- Remote GitLab/CNB group enumeration.

## Architecture

The scanner is a pure repository module. It returns stable candidates with an alias, absolute local path, remote metadata, default branch, and optional provider-neutral binding. Setup invokes it for workspace mode and stores the catalog and provider adapters in Deployment.

The main Session receives a bounded catalog in candidate cards. `orchestrator_route` and `orchestrator_eval_decide` accept an optional repository identifier. Runtime resolves that identifier against the catalog, with deterministic metadata matching for explicit requests. A Ticket stores the immutable binding. The executor creates a worktree from the binding's local path before running the configured prepare command.

A selection that has no unique match fails with a clear error, so the agent asks the user instead of changing an arbitrary repository. Existing single-repository GitHub/GitLab behavior remains the fallback.

## Selection Rules

1. An exact alias, relative path, or provider/host/repository identifier wins.
2. Otherwise score repository basename, relative path segments, remote path, and provider tokens found in the request.
3. A unique top score is selected; a tie is ambiguous.
4. A configured default repository is used only when the request contains no repository clues.
5. One discovered repository is selected automatically when no clue exists.
6. Zero candidates or an unresolved ambiguity is reported before work starts.

## Safety

The workspace root must be absolute. Discovery never follows symlinks and never writes during scanning. Worktrees are created below the configured execution directory, and the selected source path must be inside the configured workspace root. Credentials are kept in the provider configuration and are never placed in the Ticket binding or worker environment.

## Testing

Cover remote parsing, recursive discovery and skip rules, deterministic ranking and ambiguity, workspace setup, catalog exposure, Ticket binding, and automatic worktree command construction. Run the provider/workspace suite, typecheck, build, and the full suite on Linux CI.

