# MoneySiren Context

Status: approved.

## Repository Context

- Product repository: `/Users/ztwz/Desktop/project/moneysiren`
- Automation controller: `/Users/ztwz/Desktop/project/auto-driver`

`auto-driver` must not contain MoneySiren product docs, code, tests, or release notes. It may contain controller metadata required to select MoneySiren as the active project.

## Operator Intent

The primary operator wants a readable daily Korean Slack report that summarizes current cloud/SaaS usage, service health, expected billing, and risk hints.

## Privacy Context

Provider data can contain account IDs, project IDs, invoice IDs, billing profiles, email addresses, and usage metadata. v0.1 must avoid raw payload persistence and must not include secrets or unmasked identifiers in logs, reports, or dashboard responses.

## Implementation Context

The first implementation slice is structural only. Provider connectors come later and must be implemented fixture-first with read-only contracts.
