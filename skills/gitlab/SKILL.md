---
name: dsh-superagent-gitlab
description: Read GitLab issues, merge requests, comments and pipelines through the configured provider.
---

Workers report a GitLab merge request with `orchestrator_report` using `change_request`:

```json
{"provider":"gitlab","host":"gitlab.com","repository":"group/project","kind":"merge-request","iid":42}
```

The configured repository is immutable for a Ticket. Use the MR URL returned in the report summary when communicating progress. GitLab tokens stay in provider configuration and must never be copied into prompts, logs, comments or environment variables. The first release supports one configured project and bounded reads; unknown pipeline states remain unknown.
