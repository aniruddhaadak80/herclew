---
name: telegram-crabbox-e2e-proof
description: Use the Mantis Telegram Crabbox proof flow to capture a real Telegram Desktop login, a status reply, and a cropped PR proof GIF from a leased Crabbox session.
metadata:
  {
    "openclaw":
      {
        "emoji": "X",
        "os": ["linux"],
        "requires": { "env": ["OPENCLAW_TELEGRAM_USER_PROOF_CMD"] },
      },
  }
---

# Telegram Crabbox e2e proof

Captures a real Telegram Desktop session on a remote Crabbox host and turns it
into PR-ready evidence: a recorded screen, a cropped chat pane, and a
redacted transcript of the observed messages.

## How to run it

The workflow installs the proof wrapper and exports the path in
`OPENCLAW_TELEGRAM_USER_PROOF_CMD`:

```bash
"$OPENCLAW_TELEGRAM_USER_PROOF_CMD" start
"$OPENCLAW_TELEGRAM_USER_PROOF_CMD" send --text /status
"$OPENCLAW_TELEGRAM_USER_PROOF_CMD" view
"$OPENCLAW_TELEGRAM_USER_PROOF_CMD" finish --preview-crop telegram-window
```

Never call the wrapper through a package script. The
`OPENCLAW_TELEGRAM_USER_PROOF_CMD` path is the only supported entry point,
because the wrapper depends on the leased Crabbox session and on the
Telegram Desktop app that the workflow installed for this run.

## Leases and cleanup

The flow leases a Telegram user credential and a Crabbox session. Both are
released by the `finish` step, and the workflow also releases leaked leases
after an interrupted agent run. If a run is abandoned, release the lease
explicitly instead of leaving the session behind:

```bash
"$OPENCLAW_TELEGRAM_USER_PROOF_CMD" release --lease-file <path>
```

## Evidence and cropping

The recorded screen is cropped so the proof shows the chat pane only. The
crop can isolate the chat pane from the surrounding desktop chrome, which
keeps the Telegram conversation readable at small sizes. The crop geometry is
derived from the Telegram Desktop window that the proof script positions, so
the crop follows the real window rather than hard-coded pixels.

The observed messages are redacted before they reach the transcript, so the
published evidence never contains credentials or raw group identifiers.
