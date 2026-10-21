# Deployment and Operations Guide

**Product:** ORIMS  
**Version:** 1.0

## 1. Deployment objectives

Deploy the frontend, Node.js application API, MySQL database, and Python ML service with clear boundaries, secure configuration, health checks, logging, and a tested recovery path. Do not expose the database or internal ML service publicly.

## 2. Environments

### Local development

- React frontend running on a development port.
- Node.js/Express API running on a separate local port.
- MySQL local instance or development container.
- Python/FastAPI service on a local internal port.
- Disposable development records and secrets kept outside source control.

### Test/staging

- Separate database and secrets from development and production.
- Apply migrations against a clean or resettable test database.
- Run API integration and end-to-end tests before deployment.
- Use synthetic or anonymized data.

### Production/demo deployment

- Serve the frontend over HTTPS.
- Expose the Node.js API through an HTTPS endpoint.
- Place MySQL on private networking with restricted connections.
- Restrict Python/FastAPI to private networking or service-level access controls.
- Inject secrets through environment configuration or a managed secret store.
- Pin dependencies and use reproducible deployment artifacts.

## 3. Configuration categories

Exact variable names are implementation-specific, but configure the following through the deployment platform rather than hardcoding values:

- Node environment and HTTP port.
- Frontend origin/CORS allowlist.
- MySQL host, port, database, username, and password.
- Session signing secret or token configuration.
- ML service base URL and service credential.
- ML request timeout and batch limits.
- Active model version or model artifact reference.
- Logging level and request-correlation settings.
- Backup storage target and retention settings.

Do not commit real credentials or production data dumps.

## 4. Build and release process

1. Review changes and required migrations.
2. Run frontend, Node API, and Python service tests.
3. Build dependency artifacts with pinned versions.
4. Apply database migrations using a controlled deployment identity.
5. Deploy the backend and ML service, then verify health checks.
6. Deploy the frontend configured to use the correct public API URL.
7. Run a smoke test: login, product search, inventory read, test sale or designated demo flow, forecast health, and report access.
8. Monitor errors and roll back application/model changes if critical checks fail.

Database rollback is not always a simple reversal; prefer backward-compatible migrations and tested recovery plans.

## 5. Monitoring and logs

Monitor:
- Node API request count, error rate, and response latency.
- Database connection failures, slow queries, and transaction errors.
- Checkout conflicts, idempotency hits, and receipt retries.
- ML service availability, inference latency, prediction errors, and model-load errors.
- Forecast coverage, percentage of fallback predictions, and model performance once actual demand is available.
- Backup completion and restore-test results.

Logs should include timestamps, severity, service name, and correlation ID, but not passwords, authentication tokens, or unnecessary personal data.

## 6. Health checks

- Frontend: page can load and reach the configured API.
- Node API: process and essential dependencies are healthy; do not return sensitive configuration.
- MySQL: connectivity/readiness check using restricted credentials.
- ML service: process readiness and active-model load status, exposed only to authorized internal monitoring.

A failed ML health check should disable or degrade forecasting without making routine checkout or inventory views unavailable.

## 7. Backups and recovery

- Establish a scheduled backup policy suitable for the deployment and business criticality.
- Restrict and protect backup access.
- Define acceptable recovery point and recovery time objectives for the demonstration deployment.
- Test restoration into a separate environment before relying on backups.
- Include database schema/migration version and required model artifacts/metadata in recovery planning.
- Do not assume a backup is valid simply because the backup job reports success.

## 8. Model artifact operations

- Store model artifacts in a controlled, versioned location.
- Record a checksum, feature schema version, dependency versions, training window, and evaluation report.
- Promote a new model only after comparison with the baseline and approval.
- Keep the previous known-good model available for rollback.
- Prevent untrusted model uploads or arbitrary artifact paths.

## 9. Troubleshooting guide

- **Frontend cannot reach API:** verify configured API base URL, CORS, HTTPS, and deployed environment settings.
- **Database connection failure:** verify private network, credentials, user privileges, connection limits, and migration state.
- **Checkout conflict:** refresh the current stock and explain that inventory changed; do not retry a new sale blindly.
- **Duplicate request:** check the idempotency record and return the prior outcome where appropriate.
- **Forecast unavailable:** inspect Node-to-ML connectivity, service health, request schema, model artifact compatibility, and logs; use only an explicit fallback.
- **Unexpected stock mismatch:** compare inventory balances with stock movements and transaction records, identify the failed workflow, and correct using a controlled auditable adjustment rather than direct silent edits.
