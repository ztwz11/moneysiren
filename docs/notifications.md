# Opt-in notification scheduler

MoneySiren notification scheduling is disabled by default. `moneysiren notify scheduler enable` records explicit local consent; status and disable do not call provider APIs.

The scheduler uses a local exclusive lock containing only a schema marker, PID, acquisition timestamp, and SHA-256 nonce hash. Malformed, oversized, non-regular, or foreign files fail closed and are never auto-deleted. Only a valid MoneySiren lock whose PID is no longer alive may be cleaned as stale.

A PID can theoretically be reused after a crash. The nonce prevents an unrelated process from releasing an active lease, while the short scheduler interval bounds exposure. A future long-running daemon should add an OS process-start identity check and heartbeat expiry before treating PID liveness as sufficient.

Evaluation consumes normalized local alert fields only. Persisted scheduler and delivery records contain fingerprints, enum reason/error codes, timestamps, and provider keys; notification text, raw provider payloads, webhook URLs, prompts, and auth data are never persisted.
