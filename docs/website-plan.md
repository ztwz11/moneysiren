# MoneySiren Website Plan

## Goal

Create a static landing and documentation site only. The site should explain MoneySiren, link to safe setup docs, and help new users try fake fixture data quickly.

## Do Not Build Yet

- hosted dashboard
- login
- team mode
- cloud sync
- credential upload
- billing data upload
- remote telemetry
- provider write actions
- emergency execution controls

## Pages

- Home
- Quickstart
- Demo
- Security
- Providers
- Troubleshooting
- Contributing
- Roadmap
- Changelog

## Home Page Messages

- Local-first AI/cloud/SaaS usage and cost visibility.
- Read-only connectors.
- Normalized SQLite snapshots.
- Fake demo data without credentials.
- No default telemetry.
- Emergency readiness is manual and official-link based.

## Deployment Candidates

- GitHub Pages
- Cloudflare Pages
- Vercel static

## Content Sources

- README.md
- docs/demo.md
- docs/troubleshooting.md
- docs/security-model.md
- docs/data-we-never-store.md
- docs/provider-permissions.md
- docs/provider-support-matrix.md
- docs/local-first-architecture.md
- docs/good-first-issues.md
- docs/roadmap.md

## Guardrails

The website must not become a hosted MoneySiren product surface. It should not accept credentials, upload billing data, collect telemetry by default, or promise production stability.
