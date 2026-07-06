# Emergency Actions Permission Matrix

```text
SPEC_LOCKED: YES
PROVIDER_WRITE_EXECUTION_ALLOWED: NO
```

This matrix documents future emergency action requirements. It is not an implementation approval for provider write calls.

## Current Policy

- Default provider connectors remain read-only.
- Emergency actions use a separate future access boundary.
- v0.2 may show requirements, manual runbooks, and dry-run readiness only.
- All executable provider write actions are planned-only.

## AWS

| Candidate | Risk | Future Permission | Dry-Run Surface | v0.2 Status | Recovery |
|---|---:|---|---|---|---|
| Open Cost Explorer | Low | Existing local browser session | Not needed | Manual ready | None |
| Review top-cost services | Low | `ce:GetCostAndUsage`, `ce:GetCostForecast` for reads | Local checklist | Manual ready | None |
| Review Budgets and anomaly alerts | Low | Console access or read APIs | Local checklist | Manual ready | None |
| Stop EC2 instance | High | `ec2:StopInstances` scoped to target | AWS DryRun where available | Planned only | Start instance manually |
| Pause or stop database resource | Critical | Provider-specific write/admin permission | Provider-dependent | Planned only | Restore service manually |

## OpenAI

| Candidate | Risk | Future Permission | Dry-Run Surface | v0.2 Status | Recovery |
|---|---:|---|---|---|---|
| Open usage and costs dashboard | Low | Existing local browser session | Not needed | Manual ready | None |
| Validate Admin API key setup | Low | Usage/Costs read permission | Local checklist | Manual ready | None |
| Manual key rotation runbook | Medium | Organization admin access in provider console | Local checklist | Manual ready | Create and distribute replacement key manually |
| Revoke Admin API key | Critical | Admin key management permission | No reliable provider dry-run | Planned only | Create new key manually and update dependent systems |

## Supabase

| Candidate | Risk | Future Permission | Dry-Run Surface | v0.2 Status | Recovery |
|---|---:|---|---|---|---|
| Open project dashboard | Low | Existing local browser session | Not needed | Manual ready | None |
| Review project usage and health | Low | `projects:read` and usage read scopes | Local checklist | Manual ready | None |
| Regenerate PAT or OAuth connection | Medium | Account token management | Local checklist | Manual ready | Update local read-only credential manually |
| Pause project | Critical | Project write/admin permission | No reliable provider dry-run | Planned only | Resume project manually |

## Cloudflare

| Candidate | Risk | Future Permission | Dry-Run Surface | v0.2 Status | Recovery |
|---|---:|---|---|---|---|
| Open Billing dashboard | Low | Existing local browser session | Not needed | Manual ready | None |
| Review token billing permissions | Low | Account Billing Read | Local checklist | Manual ready | None |
| Review Workers, Pages, and Zone usage | Low | Account/zone read permissions | Local checklist | Manual ready | None |
| Disable Worker route | Critical | Worker/route write permission | Limited | Planned only | Re-enable route manually |
| Pause zone | Critical | Zone write/admin permission | Limited | Planned only | Re-enable zone manually |

## Local AI Providers

| Candidate | Risk | Future Permission | Dry-Run Surface | v0.2 Status | Recovery |
|---|---:|---|---|---|---|
| Review Codex or Claude quota state | Low | Local metadata reads only | Local checklist | Manual ready | None |
| Review local log discovery configuration | Low | Local file metadata only | Local checklist | Manual ready | Fix local path configuration |
| Expose raw prompts, commands, auth files, or JSONL | Critical | Not applicable | Not applicable | Not supported | Not applicable |

## Planned Catalog Providers

Planned providers may show guidance only after provider-specific connector specs exist. Until then they remain `planned` or `not_supported`.
