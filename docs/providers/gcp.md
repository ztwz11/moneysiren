# Google Cloud Provider

## v0.1 Scope

Google Cloud cost collection is planned, not enabled as a live v0.1 connector. The local web dashboard can inspect Google Cloud CLI setup status so the operator can prepare authentication without storing Google credentials in MoneySiren.

## Credentials

Use Google Cloud CLI and Application Default Credentials outside MoneySiren. MoneySiren must not store raw service account JSON, OAuth refresh tokens, or provider account identifiers.

Recommended local setup:

```text
gcloud --version
gcloud init
gcloud auth login
gcloud auth application-default login
gcloud config set project fake-moneysiren-project
```

Optional env-only inputs:

```text
GOOGLE_CLOUD_PROJECT=fake-moneysiren-project
GOOGLE_APPLICATION_CREDENTIALS=
CLOUDSDK_CONFIG=
```

`GOOGLE_APPLICATION_CREDENTIALS` can point to an operator-managed service account key file, but the key file must stay outside the repository and must not be committed. Prefer `gcloud auth application-default login` for local developer setup.

## Required API Surface

Future cost collection should use read-only Google Cloud billing and usage APIs only. The v0.1 local setup check reads:

- `gcloud --version`
- active gcloud account status, with the account masked before returning it to the UI
- current gcloud project status, with the project ID masked before returning it to the UI
- Application Default Credentials file existence only

## Data Handling

Do not read or persist ADC file contents, service account key JSON, OAuth refresh tokens, billing account IDs, invoice IDs, emails, or raw project IDs. The local setup panel returns only boolean setup state plus masked account and project hints.

## Risks

- `gcloud auth login` and `gcloud auth application-default login` configure different credential surfaces.
- Billing access can require organization or billing account permissions beyond project access.
- The current local setup check does not prove Cost/Billing API authorization.
