---
name: dsh-superagent-cnb
description: Configure CNB as a repository provider boundary while live CNB operations are being added.
---

CNB configuration validates host, repository and access-token shape and exposes provider capabilities. This release intentionally returns typed unsupported-operation errors for live issue, pull-request, comment and build calls; it does not make a network request or claim a successful operation. Use GitLab for the first production workflow. CNB API and event integration can be added behind the same repository adapter without changing channel or Ticket semantics.
