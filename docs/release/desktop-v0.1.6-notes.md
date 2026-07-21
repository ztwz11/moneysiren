# MoneySiren v0.1.6

MoneySiren v0.1.6 completes the source-free Windows HUD installation path.

## Highlights

- Global `@moneysiren/app` installation requests the matching web runtime and
  Windows HUD by default.
- The installed dashboard and CLI resolve the version-matched portable HUD
  without requiring a source checkout.
- Local Codex and Claude usage history supports daily, Monday-based weekly, and
  calendar-month views using sanitized SQLite numeric buckets.
- The OpenAI connection flow can validate, save, and perform the first safe
  read-only sync in one local action.

## Release safety

- Windows public release assets must be signed.
- Candidate and public installed-package HUD smokes must pass before npm
  publication.
- npm publication runs only after matching GitHub Release assets are available.
- No provider secrets, local AI prompt text, command bodies, auth files, or raw
  provider payloads are persisted or returned by these release paths.
