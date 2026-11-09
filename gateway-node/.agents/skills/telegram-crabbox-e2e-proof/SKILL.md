---
name: telegram-crabbox-e2e-proof
description: Capture native Telegram Desktop proof GIFs for OpenClaw Telegram PRs inside a Crabbox rental.
---

# Telegram Crabbox E2E Proof

Use `OPENCLAW_TELEGRAM_USER_PROOF_CMD` (`/usr/local/bin/openclaw-telegram-user-crabbox-proof`,
wrapping `scripts/e2e/telegram-user-crabbox-proof.ts`) to run the Telegram Desktop
user proof flow inside a Crabbox desktop rental: log in through the QR flow,
send a message through the local gateway, and capture the session.

## Key env vars

- `OPENCLAW_TELEGRAM_USER_DRIVER_SCRIPT` — repo-local TDLib driver
  (`scripts/e2e/telegram-user-driver.py`).
- `OPENCLAW_TELEGRAM_USER_CRABBOX_BIN` — Crabbox binary (`/usr/local/bin/crabbox`).
- `OPENCLAW_QA_CREDENTIAL_OWNER_ID` — per-run credential owner for lease cleanup.

## Workflow notes

- Credentials come from the QA credential broker (`telegram-user-credential.ts`);
  never print tokens or TDLib auth data.
- The proof script crops the Telegram Desktop chat pane for PR proof GIFs:
  crop can isolate the chat pane from the side panel and composer, so keep
  the crop geometry tied to the native window constants.
- Let `start` return or fail on its own; use a long command timeout for
  `start`, `send`, `view`, and `finish`.
