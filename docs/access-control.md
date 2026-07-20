# Access Control

## Overview

Atlas Studio now uses an email-first access flow for the portal:

1. A visitor submits an access request with email and display name.
2. The visitor must read and accept the portal terms.
3. The same acceptance event also stores consent for operational, commercial and promotional email usage.
4. The backend issues an activation token and sends an activation email.
5. The visitor sets a password from the activation link.
6. Active users can request a password reset by email, and admins can resend that reset from the admin page.
7. After activation or password reset, the portal creates an authenticated session cookie and unlocks the dashboard, docs and API.

This replaces the previous static credential model.

## Auth storage

Auth data is persisted in `runtime-data/auth-store.json`.

Store sections:

- `system`: platform-level metadata such as the generated session secret.
- `users`: portal users, role, status, password hash and consent metadata.
- `tokens`: activation and password reset tokens hashed with SHA-256.
- `audit`: append-only audit log for requests, activations, password resets, mail delivery and logins.

Each mail token now persists delivery telemetry:

- `deliveryStatus`: `pending`, `sent`, `queued`, `failed`
- `deliveryMode`: `smtp`, `sendmail`, `outbox`
- `deliveryAttempts`
- `lastDeliveryAttemptAt`
- `deliveryAt`
- `lastDeliveryError`

Passwords are hashed with `scrypt`.
Activation and password reset tokens are never stored in plaintext.

## User lifecycle

Supported states:

- `pending`: email captured, terms accepted, waiting for password activation.
- `active`: password set, portal access enabled.

Roles:

- `admin`: can access admin-only auth endpoints.
- `viewer`: standard portal user.

## Public auth endpoints

- `GET /api/auth/config`
- `POST /api/auth/register-request`
- `GET /api/auth/activation/:token`
- `POST /api/auth/activate`
- `POST /api/auth/password-reset-request`
- `GET /api/auth/password-reset/:token`
- `POST /api/auth/password-reset/confirm`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Protected:

- `GET /api/auth/session`
- `GET /api/auth/admin/users`
- `GET /api/auth/admin/overview`
- `POST /api/auth/admin/users/:userId/password-reset`
- `POST /api/auth/track`

The admin users endpoint now includes the latest activation and password reset delivery trace per user so the portal can expose:

- current lifecycle (`pending` vs `active`)
- last transport used
- last delivery timestamp
- last SMTP failure message, if any
- resend reset actions for active users as support fallback

The admin overview endpoint also aggregates portal usage telemetry:

- last route seen per user
- last state/doc focus
- recent activity feed
- route consumption in the last 24h
- top states and docs by recent views

Tracked portal routes now include:

- `dashboard` for the integrated comparative surface
- `investment` for the detailed spending surface
- `methodology`
- `docs`
- `admin`

## Terms and consent

Terms are versioned from `shared/portalTerms.mjs`.

Current fields stored per user:

- `acceptedTermsVersion`
- `termsAcceptedAt`
- `acceptedMarketing`
- `acceptedMarketingAt`

The request flow requires both:

- terms acceptance
- promotional/commercial email consent

## Email delivery

The mailer supports three modes:

1. `smtp`: enabled with `ATLAS_SMTP_HOST`
2. `sendmail`: enabled with `ATLAS_SENDMAIL_PATH`
3. `outbox`: fallback mode when no real mail transport is configured

In fallback mode, activation and password reset emails are written to `runtime-data/mail-outbox/`.

If SMTP/sendmail delivery fails, the request is still persisted and auditable. The token keeps the failure metadata and the error is also appended to the audit stream instead of being lost in process logs only.

Password reset is self-service for any active user from the public login screen. The admin page only exposes a resend action for support.

## Runtime environment

Primary env vars:

- `ATLAS_BASE_URL`
- `ATLAS_RUNTIME_DIR`
- `ATLAS_SESSION_DURATION_HOURS`
- `ATLAS_ACTIVATION_TOKEN_TTL_HOURS`
- `ATLAS_PASSWORD_RESET_TOKEN_TTL_HOURS`
- `ATLAS_PASSWORD_MIN_LENGTH`
- `ATLAS_MAIL_FROM`
- `ATLAS_SMTP_HOST`
- `ATLAS_SMTP_PORT`
- `ATLAS_SMTP_SECURE`
- `ATLAS_SMTP_USER`
- `ATLAS_SMTP_PASS`
- `ATLAS_SENDMAIL_PATH`

## Bootstrap users

Use the bootstrap script to create or update a functional user:

```bash
node scripts/bootstrap-auth-user.mjs \
  --email edgar@hadox.org \
  --password '<strong-password>' \
  --name 'Edgar Hadox' \
  --role admin
```

The command:

- creates the user if it does not exist
- forces active status
- hashes the password
- records current terms version and consent metadata
