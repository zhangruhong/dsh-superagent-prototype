---
name: dsh-superagent-wecom
description: Receive tasks from an Enterprise WeChat intelligent robot and reply in the originating group.
---

In a group, explicitly mention the robot to create a Trigger. Direct messages are addressed automatically. The source ignores bot self-messages, unsupported event frames and duplicate message IDs, and reconnects the intelligent-robot WebSocket with backoff. Progress, questions, failures and GitLab MR links return to the same group through the durable outbox. Only users on the WeCom Source allow-list may originate work.
