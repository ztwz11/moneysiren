# Opt-in notification scheduler

MoneySiren notification scheduling is disabled by default. `moneysiren notify scheduler enable` records explicit local consent; status and disable do not call provider APIs.

The scheduler uses a local exclusive lock containing only a schema marker, PID, acquisition timestamp, and SHA-256 nonce hash. Malformed, oversized, non-regular, or foreign files fail closed and are never auto-deleted. Only a valid MoneySiren lock whose PID is no longer alive may be cleaned as stale.

This file lock is an interim primitive, not the production scheduler-owner contract. Acquire, stale replacement, nonce comparison, and release are serialized by the same local mutation guard, so an old lease cannot remove a successor in cooperating MoneySiren processes. A stranded mutation guard fails closed with `NOTIFICATION_SCHEDULER_MUTATION_GUARD_BUSY` and requires manual recovery.

PID-only liveness can still be fooled by PID reuse, and the default path is relative to the caller's working directory. A production owner loop must pass one canonical absolute path derived from the local data root and move ownership to a SQLite compare-and-swap lease with owner-only heartbeat, expiry, and nonce-conditional release. Until that work lands, scheduler enablement records consent and preferences but does not claim that a long-running owner loop is active.

Evaluation consumes normalized local alert fields only. Persisted scheduler and delivery records contain fingerprints, enum reason/error codes, timestamps, and provider keys; notification text, raw provider payloads, webhook URLs, prompts, and auth data are never persisted.
