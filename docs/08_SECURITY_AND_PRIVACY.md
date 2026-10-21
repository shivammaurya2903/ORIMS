# Security and Privacy Requirements

**Product:** ORIMS  
**Version:** 1.0

## 1. Security objectives

Protect retail data, user accounts, inventory integrity, transaction history, and model operations. Prevent unauthorized changes to prices, stock, users, purchases, and forecasts. Use least privilege across the browser, Node.js service, MySQL database, and Python service.

## 2. Authentication and sessions

- Store password hashes using a suitable password-hashing library and safe configuration; never store plaintext passwords.
- Use a clear session strategy: secure, HttpOnly cookies with appropriate SameSite settings, or a properly designed token flow.
- Apply expiry and logout/revocation behavior deliberately.
- Rate-limit login and account-sensitive routes.
- Do not put authentication tokens or secrets in local storage without a documented threat assessment.
- Avoid revealing whether a particular email account exists during login failures.

## 3. Authorization

- Enforce role and resource permissions in Node.js.
- Verify store scope on every resource if multi-store support is enabled.
- Separate permission to view from permission to adjust stock, approve purchases, process returns, or administer users.
- Do not trust role values, product prices, stock counts, or approval status from the frontend.
- Test direct API calls by unauthorized roles, not only the visibility of UI controls.

## 4. Input and API protection

- Validate request parameters, path IDs, quantities, dates, enums, and text lengths.
- Use parameterized queries through the ORM or safe query interface.
- Set request body and upload limits; the initial release should avoid arbitrary file uploads unless required.
- Configure CORS to approved frontend origins, not wildcard origins with credentials.
- Use HTTPS outside local development.
- Apply rate limits to authentication and expensive report/forecast endpoints.
- Return safe errors; never expose stack traces, SQL details, file paths, or secrets to clients.

## 5. Transaction integrity

- Perform checkout and receiving using database transactions.
- Prevent overselling using row locks or safe atomic conditional updates and a documented isolation approach.
- Use idempotency keys or equivalent duplicate-request controls for checkout and receipt operations.
- Record stock changes in the ledger in the same transaction as the balance update.
- Use compensating records for returns and corrections instead of silently editing financial history.
- Define lock ordering and transaction retry behavior to reduce deadlocks.

## 6. Python ML service security

- Do not expose the ML service directly to browsers or the public internet.
- Restrict network access to the Node.js service and authorized maintenance job.
- Authenticate service-to-service requests or rely on a carefully controlled private network with an additional service credential.
- Validate the expected feature schema and maximum request sizes.
- Place timeouts and limits on inference requests.
- Load only trusted, versioned model artifacts. Never accept uploaded or user-provided model files for loading.
- Do not return local filesystem paths, environment variables, sensitive training rows, or internal exception details from health/model-info endpoints.
- Keep model dependencies pinned and update them through tested changes.

## 7. Database and secret management

- Use a dedicated database account with only required privileges.
- Do not expose MySQL publicly where avoidable.
- Use environment configuration or a secret store for credentials and signing keys.
- Exclude local environment files, credentials, database dumps containing real data, and private model artifacts from version control unless explicitly sanitized and intended for sharing.
- Rotate credentials if exposed.
- Use versioned database migrations and backups stored with appropriate access restrictions.

## 8. Audit and logging

Audit sensitive actions with actor, action, entity, timestamp, and correlation identifier. Avoid logging passwords, tokens, payment secrets, or unnecessarily detailed personal information. Restrict access to audit data and document retention. Use structured logs so failed transactions, service timeouts, and authorization denials can be investigated.

## 9. Privacy and data minimization

Collect only data required for product, sales, purchasing, account, and forecasting functions. The initial design need not store customer personal data unless a defined business requirement exists. If customer details are later introduced, document purpose, access, retention, and deletion behavior before implementation.

## 10. Operational controls

- Separate development, test, and production secrets and data.
- Use dependency scanning and update vulnerable dependencies.
- Restrict production access to authorized maintainers.
- Test backups and restoration, not merely backup creation.
- Document incident response steps for leaked credentials, database exposure, or model artifact compromise.

## 11. Security acceptance checklist

A release is not ready until authentication, role boundaries, request validation, transaction behavior, ML service isolation, secrets handling, error response safety, and backup access have been reviewed and tested.
