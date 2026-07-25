---
name: feedback-server-startup
description: Never start the Node.js server in the background — user always starts it manually
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dcb01897-6d09-42a0-9949-3eb12abf864f
---

Never start the server automatically (no Start-Process, no background npm start, no hidden windows).

**Why:** User wants full control over when the server runs and prefers to see the console output themselves.

**How to apply:** After making backend changes, instruct the user to run `npm start` themselves. Do not attempt to launch the server in any form — visible, hidden, or background.
