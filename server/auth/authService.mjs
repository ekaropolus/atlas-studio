import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import {
  portalTermsTitle,
  portalTermsVersion,
} from '../../shared/portalTerms.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..')

const SESSION_COOKIE_NAME = 'atlas_session'
const SESSION_DURATION_MS = readPositiveNumber(
  process.env.ATLAS_SESSION_DURATION_HOURS,
  12,
) * 60 * 60 * 1000
const ACTIVATION_TOKEN_TTL_MS = readPositiveNumber(
  process.env.ATLAS_ACTIVATION_TOKEN_TTL_HOURS,
  72,
) * 60 * 60 * 1000
const PASSWORD_RESET_TOKEN_TTL_MS = readPositiveNumber(
  process.env.ATLAS_PASSWORD_RESET_TOKEN_TTL_HOURS,
  6,
) * 60 * 60 * 1000
const PASSWORD_MIN_LENGTH = readPositiveNumber(process.env.ATLAS_PASSWORD_MIN_LENGTH, 12)
const MAX_AUDIT_ROWS = 5000
const ACTIVE_VIEWER_WINDOW_MS = 15 * 60 * 1000
const ANALYTICS_WINDOW_MS = 24 * 60 * 60 * 1000
const TRACK_DEDUP_WINDOW_MS = 2 * 60 * 1000

let cachedMailTransport = null

function readPositiveNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function createClientError(code, status, details = {}) {
  const error = new Error(code)
  error.code = code
  error.status = status
  error.details = details
  return error
}

function parseIsoMs(value) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

function nowIso() {
  return new Date().toISOString()
}

function getTokenTtlMs(purpose) {
  return purpose === 'password_reset' ? PASSWORD_RESET_TOKEN_TTL_MS : ACTIVATION_TOKEN_TTL_MS
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function resolveDisplayName(email, displayName) {
  const provided = String(displayName ?? '').trim()
  if (provided) {
    return provided.slice(0, 120)
  }

  const localPart = normalizeEmail(email).split('@')[0] ?? 'portal'
  return localPart
    .split(/[.\-_]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
    .slice(0, 120)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getRuntimeDir() {
  return process.env.ATLAS_RUNTIME_DIR
    ? path.resolve(process.env.ATLAS_RUNTIME_DIR)
    : path.join(rootDir, 'runtime-data')
}

function getStorePath() {
  return path.join(getRuntimeDir(), 'auth-store.json')
}

function getOutboxDir() {
  return path.join(getRuntimeDir(), 'mail-outbox')
}

function createDefaultStore() {
  return {
    version: 1,
    system: {
      sessionSecret: crypto.randomBytes(48).toString('base64url'),
      createdAt: nowIso(),
    },
    users: [],
    tokens: [],
    audit: [],
  }
}

function ensureRuntimeLayout() {
  fs.mkdirSync(getRuntimeDir(), { recursive: true })
  fs.mkdirSync(getOutboxDir(), { recursive: true })

  const storePath = getStorePath()
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, `${JSON.stringify(createDefaultStore(), null, 2)}\n`)
  }
}

function sanitizeStore(rawStore) {
  const defaultStore = createDefaultStore()
  const store = rawStore && typeof rawStore === 'object' ? rawStore : defaultStore

  store.version = 1
  store.system = store.system && typeof store.system === 'object' ? store.system : {}
  store.system.sessionSecret =
    typeof store.system.sessionSecret === 'string' && store.system.sessionSecret
      ? store.system.sessionSecret
      : defaultStore.system.sessionSecret
  store.system.createdAt =
    typeof store.system.createdAt === 'string' && store.system.createdAt
      ? store.system.createdAt
      : defaultStore.system.createdAt
  store.users = Array.isArray(store.users) ? store.users : []
  store.tokens = Array.isArray(store.tokens) ? store.tokens : []
  store.audit = Array.isArray(store.audit) ? store.audit.slice(-MAX_AUDIT_ROWS) : []
  return store
}

function loadStore() {
  ensureRuntimeLayout()
  const storePath = getStorePath()
  const rawValue = fs.readFileSync(storePath, 'utf8')
  const store = sanitizeStore(JSON.parse(rawValue))
  pruneStore(store)
  return store
}

function saveStore(store) {
  ensureRuntimeLayout()
  pruneStore(store)
  const storePath = getStorePath()
  const nextPayload = `${JSON.stringify(store, null, 2)}\n`
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tempPath, nextPayload)
  fs.renameSync(tempPath, storePath)
}

function pruneStore(store) {
  const now = Date.now()
  store.tokens = store.tokens
    .filter((token) => {
      const tokenTtlMs = getTokenTtlMs(token.purpose)
      const expiresAt = Date.parse(token.expiresAt ?? '')
      if (Number.isFinite(expiresAt) && expiresAt < now - tokenTtlMs) {
        return false
      }

      if (token.consumedAt) {
        const consumedAt = Date.parse(token.consumedAt)
        return Number.isFinite(consumedAt) ? consumedAt >= now - tokenTtlMs : false
      }

      return true
    })
    .slice(-200)
  store.audit = store.audit.slice(-MAX_AUDIT_ROWS)
}

function appendAudit(store, type, meta = {}) {
  store.audit.push({
    id: createId('audit'),
    at: nowIso(),
    type,
    ...meta,
  })
}

function createPasswordSalt() {
  return crypto.randomBytes(16).toString('hex')
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function getSessionSecret() {
  return loadStore().system.sessionSecret
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`]

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }

  if (options.path) {
    parts.push(`Path=${options.path}`)
  }

  if (options.httpOnly) {
    parts.push('HttpOnly')
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`)
  }

  if (options.secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function parseCookies(headerValue = '') {
  return Object.fromEntries(
    headerValue
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=')
        if (separatorIndex === -1) {
          return [part, '']
        }

        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))]
      }),
  )
}

function getCookieSecurityFlag(request) {
  const forwardedProto = request.headers['x-forwarded-proto']
  return process.env.ATLAS_COOKIE_SECURE === 'true' || forwardedProto === 'https'
}

function readRequestMeta(request) {
  const forwardedFor = String(request.headers['x-forwarded-for'] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[0]

  return {
    ip: forwardedFor || request.socket?.remoteAddress || null,
    userAgent: request.headers['user-agent'] ?? null,
  }
}

function getBaseUrl(request) {
  if (process.env.ATLAS_BASE_URL) {
    return process.env.ATLAS_BASE_URL.replace(/\/+$/, '')
  }

  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol = forwardedProto || (request.socket?.encrypted ? 'https' : 'http')
  const host = request.headers.host ?? `localhost:${process.env.PORT ?? '4173'}`
  return `${protocol}://${host}`
}

function findUserByEmail(store, email) {
  return store.users.find((candidate) => candidate.email === normalizeEmail(email)) ?? null
}

function findUserById(store, userId) {
  return store.users.find((candidate) => candidate.id === userId) ?? null
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role ?? 'viewer',
    status: user.status ?? 'pending',
    createdAt: user.createdAt ?? null,
    activatedAt: user.activatedAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    acceptedTermsVersion: user.acceptedTermsVersion ?? null,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    acceptedMarketing: Boolean(user.acceptedMarketing),
    acceptedMarketingAt: user.acceptedMarketingAt ?? null,
  }
}

function routeLabel(route) {
  if (route === 'dashboard') {
    return 'Comparativo'
  }

  if (route === 'investment') {
    return 'Inversion'
  }

  if (route === 'docs') {
    return 'Docs'
  }

  if (route === 'methodology') {
    return 'Metodologia'
  }

  if (route === 'admin') {
    return 'Admin'
  }

  return 'Portal'
}

function maskIpAddress(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) {
    return null
  }

  if (rawValue.includes('.')) {
    const parts = rawValue.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.x.x`
    }
  }

  if (rawValue.includes(':')) {
    const parts = rawValue.split(':').filter(Boolean)
    if (parts.length >= 3) {
      return `${parts.slice(0, 2).join(':')}:x:x`
    }
  }

  return rawValue
}

function normalizePortalEvent(input = {}) {
  const route = ['dashboard', 'investment', 'docs', 'methodology', 'admin'].includes(input.route)
    ? input.route
    : null

  if (!route) {
    throw createClientError('INVALID_TRACK_ROUTE', 400)
  }

  const stateId = String(input.stateId ?? '').trim() || null
  const stateName = String(input.stateName ?? '').trim() || null
  const docId = String(input.docId ?? '').trim() || null
  const docTitle = String(input.docTitle ?? '').trim() || null
  const metricId = String(input.metricId ?? '').trim() || null
  const metricLabel = String(input.metricLabel ?? '').trim() || null

  return {
    route,
    routeLabel: routeLabel(route),
    stateId,
    stateName,
    docId,
    docTitle,
    metricId,
    metricLabel,
  }
}

function createPortalEventSignature(event) {
  return JSON.stringify([
    event.route,
    event.docId,
    event.stateId,
    event.metricId,
  ])
}

function createPortalViewSummary(entry) {
  if (!entry) {
    return {
      route: null,
      routeLabel: null,
      focusLabel: 'Sin vista registrada',
      detailLabel: 'Sin foco visible',
      metricLabel: null,
      at: null,
      ip: null,
      userAgent: null,
    }
  }

  const focusLabel =
    entry.route === 'dashboard'
      ? entry.stateName
        ? `Comparativo · ${entry.stateName}`
        : 'Comparativo · vista nacional'
      : entry.route === 'investment'
        ? entry.stateName
          ? `Inversion · ${entry.stateName}`
          : 'Inversion · capa nacional'
      : entry.route === 'docs'
        ? entry.docTitle
          ? `Docs · ${entry.docTitle}`
          : 'Docs'
        : entry.route === 'methodology'
          ? 'Metodologia'
          : entry.route === 'admin'
            ? 'Admin'
            : routeLabel(entry.route)

  const detailLabel =
    entry.route === 'dashboard'
      ? [entry.stateName, entry.metricLabel].filter(Boolean).join(' · ') || 'Sin foco especifico'
      : entry.route === 'investment'
        ? [entry.stateName, entry.metricLabel].filter(Boolean).join(' · ') || 'Sin foco presupuestal'
      : entry.route === 'docs'
        ? entry.docTitle || entry.docId || 'Sin documento'
        : entry.route === 'methodology'
          ? 'Fuentes, scoring y pipeline'
          : entry.route === 'admin'
            ? 'Accesos, actividad y vistas'
            : 'Sin detalle'

  return {
    route: entry.route ?? null,
    routeLabel: entry.routeLabel ?? routeLabel(entry.route),
    focusLabel,
    detailLabel,
    metricLabel: entry.metricLabel ?? null,
    at: entry.at ?? null,
    ip: maskIpAddress(entry.ip),
    userAgent: entry.userAgent ?? null,
  }
}

function maskEmail(email) {
  const [localPart = '', domain = ''] = String(email).split('@')
  if (!domain) {
    return email
  }

  const maskedLocal =
    localPart.length <= 2
      ? `${localPart.charAt(0)}*`
      : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(1, localPart.length - 2))}`

  return `${maskedLocal}@${domain}`
}

function sanitizeMailError(error) {
  if (!error) {
    return null
  }

  return {
    code: typeof error.code === 'string' ? error.code : null,
    responseCode: Number.isFinite(error.responseCode) ? error.responseCode : null,
    command: typeof error.command === 'string' ? error.command : null,
    message: String(error.message ?? 'MAIL_DELIVERY_FAILED')
      .replaceAll(/\s+/g, ' ')
      .trim()
      .slice(0, 240),
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    throw createClientError('PASSWORD_TOO_SHORT', 400, {
      minimumLength: PASSWORD_MIN_LENGTH,
    })
  }
}

function createEmailTokenRecord({ purpose, userId, requestMeta, timestamp }) {
  return {
    id: createId('tok'),
    purpose,
    userId,
    tokenHash: null,
    createdAt: timestamp,
    expiresAt: new Date(Date.now() + getTokenTtlMs(purpose)).toISOString(),
    consumedAt: null,
    deliveryMode: null,
    deliveryStatus: 'pending',
    deliveryMessageId: null,
    deliveryAttempts: 0,
    lastDeliveryAttemptAt: null,
    lastDeliveryError: null,
    requestMeta,
  }
}

function findTokenByPurpose(store, rawToken, purpose) {
  const tokenHash = hashToken(rawToken)
  return store.tokens.find(
    (candidate) => candidate.purpose === purpose && candidate.tokenHash === tokenHash,
  )
}

function assertValidEmailToken(store, rawToken, purpose, errorPrefix) {
  if (!rawToken) {
    throw createClientError(`${errorPrefix}_TOKEN_REQUIRED`, 400)
  }

  const token = findTokenByPurpose(store, rawToken, purpose)
  if (!token) {
    throw createClientError(`${errorPrefix}_TOKEN_INVALID`, 404)
  }

  if (token.consumedAt) {
    throw createClientError(`${errorPrefix}_TOKEN_CONSUMED`, 410)
  }

  const expiresAt = Date.parse(token.expiresAt ?? '')
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw createClientError(`${errorPrefix}_TOKEN_EXPIRED`, 410)
  }

  const user = findUserById(store, token.userId)
  if (!user) {
    throw createClientError(`${errorPrefix}_USER_NOT_FOUND`, 404)
  }

  return { token, user }
}

function assertValidActivationToken(store, rawToken) {
  return assertValidEmailToken(store, rawToken, 'activation', 'ACTIVATION')
}

function assertValidPasswordResetToken(store, rawToken) {
  return assertValidEmailToken(store, rawToken, 'password_reset', 'PASSWORD_RESET')
}

function buildMailTransportConfig() {
  if (process.env.ATLAS_SMTP_HOST) {
    return {
      mode: 'smtp',
      options: {
        host: process.env.ATLAS_SMTP_HOST,
        port: readPositiveNumber(process.env.ATLAS_SMTP_PORT, 587),
        secure: process.env.ATLAS_SMTP_SECURE === 'true',
        auth:
          process.env.ATLAS_SMTP_USER || process.env.ATLAS_SMTP_PASS
            ? {
                user: process.env.ATLAS_SMTP_USER ?? '',
                pass: process.env.ATLAS_SMTP_PASS ?? '',
              }
            : undefined,
      },
    }
  }

  if (process.env.ATLAS_SENDMAIL_PATH) {
    return {
      mode: 'sendmail',
      options: {
        sendmail: true,
        newline: 'unix',
        path: process.env.ATLAS_SENDMAIL_PATH,
      },
    }
  }

  return {
    mode: 'outbox',
    options: null,
  }
}

async function deliverEmail({ to, subject, html, text }) {
  const transportConfig = buildMailTransportConfig()
  const from = process.env.ATLAS_MAIL_FROM ?? 'Atlas Studio <no-reply@polisplexity.tech>'

  if (transportConfig.mode === 'outbox') {
    const messageId = createId('mail')
    const stem = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}_${messageId}`
    fs.writeFileSync(
      path.join(getOutboxDir(), `${stem}.json`),
      `${JSON.stringify({ to, subject, text, html, from, createdAt: nowIso() }, null, 2)}\n`,
    )
    fs.writeFileSync(path.join(getOutboxDir(), `${stem}.html`), html)
    return {
      mode: 'outbox',
      messageId,
    }
  }

  if (!cachedMailTransport) {
    cachedMailTransport = nodemailer.createTransport(transportConfig.options)
  }

  const result = await cachedMailTransport.sendMail({
    from,
    to,
    subject,
    html,
    text,
  })

  return {
    mode: transportConfig.mode,
    messageId: result.messageId ?? null,
  }
}

function toPublicMailToken(token) {
  if (!token) {
    return null
  }

  const derivedDeliveryStatus =
    token.deliveryStatus ??
    (token.lastDeliveryError
      ? 'failed'
      : token.deliveryAt
        ? token.deliveryMode === 'outbox'
          ? 'queued'
          : 'sent'
        : 'pending')
  const derivedAttempts =
    Number(token.deliveryAttempts ?? 0) || (token.deliveryAt || token.lastDeliveryError ? 1 : 0)
  const derivedLastAttemptAt = token.lastDeliveryAttemptAt ?? token.deliveryAt ?? null

  return {
    id: token.id,
    purpose: token.purpose ?? null,
    createdAt: token.createdAt ?? null,
    expiresAt: token.expiresAt ?? null,
    consumedAt: token.consumedAt ?? null,
    deliveryMode: token.deliveryMode ?? null,
    deliveryStatus: derivedDeliveryStatus,
    deliveryAt: token.deliveryAt ?? null,
    deliveryMessageId: token.deliveryMessageId ?? null,
    deliveryAttempts: derivedAttempts,
    lastDeliveryAttemptAt: derivedLastAttemptAt,
    lastDeliveryError: token.lastDeliveryError ?? null,
  }
}

function findLatestActivationToken(store, userId) {
  return (
    [...store.tokens]
      .filter((token) => token.userId === userId && token.purpose === 'activation')
      .sort((left, right) =>
        String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
      )[0] ?? null
  )
}

function findLatestPasswordResetToken(store, userId) {
  return (
    [...store.tokens]
      .filter((token) => token.userId === userId && token.purpose === 'password_reset')
      .sort((left, right) =>
        String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
      )[0] ?? null
  )
}

function findLatestPortalView(store, userId) {
  return (
    [...store.audit]
      .filter((entry) => entry.type === 'portal_view' && entry.userId === userId)
      .sort((left, right) => String(right.at ?? '').localeCompare(String(left.at ?? '')))[0] ?? null
  )
}

function aggregateCountsBy(items, keySelector, labelSelector) {
  const index = new Map()

  for (const item of items) {
    const key = keySelector(item)
    if (!key) {
      continue
    }

    const current = index.get(key) ?? {
      id: key,
      label: labelSelector(item),
      count: 0,
      lastAt: item.at ?? null,
    }

    current.count += 1
    if (String(item.at ?? '').localeCompare(String(current.lastAt ?? '')) > 0) {
      current.lastAt = item.at ?? null
      current.label = labelSelector(item)
    }
    index.set(key, current)
  }

  return [...index.values()].sort((left, right) => right.count - left.count)
}

function buildPortalUserRecord(store, user) {
  const activityItems = store.audit.filter(
    (entry) => entry.type === 'portal_view' && entry.userId === user.id,
  )
  const latestPortalView =
    activityItems.sort((left, right) => String(right.at ?? '').localeCompare(String(left.at ?? '')))[0] ??
    null
  const viewCutoff = Date.now() - ANALYTICS_WINDOW_MS
  const views24h = activityItems.filter((entry) => {
    const entryMs = parseIsoMs(entry.at)
    return entryMs !== null && entryMs >= viewCutoff
  })
  const activitySummary = createPortalViewSummary(latestPortalView)
  const lastSeenAt =
    latestPortalView?.at ??
    user.lastSeenAt ??
    user.lastLoginAt ??
    user.activatedAt ??
    user.createdAt ??
    null
  const lastSeenMs = parseIsoMs(lastSeenAt)

  return {
    ...toPublicUser(user),
    requestCount: Number(user.requestCount ?? 0),
    latestActivation: toPublicMailToken(findLatestActivationToken(store, user.id)),
    latestPasswordReset: toPublicMailToken(findLatestPasswordResetToken(store, user.id)),
    lastSeenAt,
    isActiveViewer:
      lastSeenMs !== null ? lastSeenMs >= Date.now() - ACTIVE_VIEWER_WINDOW_MS : false,
    views24h: views24h.length,
    latestView: activitySummary,
  }
}

function buildAdminOverviewPayload() {
  const store = loadStore()
  const users = store.users
    .map((user) => buildPortalUserRecord(store, user))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))

  const cutoff = Date.now() - ANALYTICS_WINDOW_MS
  const portalViews = store.audit
    .filter((entry) => entry.type === 'portal_view')
    .sort((left, right) => String(right.at ?? '').localeCompare(String(left.at ?? '')))
  const portalViews24h = portalViews.filter((entry) => {
    const entryMs = parseIsoMs(entry.at)
    return entryMs !== null && entryMs >= cutoff
  })

  const activeViewers = users.filter((user) => user.isActiveViewer)
  const routeBreakdown = aggregateCountsBy(
    portalViews24h,
    (entry) => entry.route,
    (entry) => entry.routeLabel ?? routeLabel(entry.route),
  )
  const topStates = aggregateCountsBy(
    portalViews24h.filter((entry) => ['dashboard', 'investment'].includes(entry.route) && entry.stateId),
    (entry) => entry.stateId,
    (entry) => entry.stateName ?? entry.stateId,
  ).slice(0, 8)
  const topDocs = aggregateCountsBy(
    portalViews24h.filter((entry) => entry.route === 'docs' && entry.docId),
    (entry) => entry.docId,
    (entry) => entry.docTitle ?? entry.docId,
  ).slice(0, 8)
  const recentActivity = portalViews.slice(0, 40).map((entry) => {
    const user = store.users.find((candidate) => candidate.id === entry.userId) ?? null
    return {
      id: entry.id,
      at: entry.at ?? null,
      email: entry.email ?? user?.email ?? null,
      displayName: user?.displayName ?? entry.email ?? 'Usuario',
      route: entry.route ?? null,
      routeLabel: entry.routeLabel ?? routeLabel(entry.route),
      focusLabel: createPortalViewSummary(entry).focusLabel,
      detailLabel: createPortalViewSummary(entry).detailLabel,
      stateId: entry.stateId ?? null,
      stateName: entry.stateName ?? null,
      docId: entry.docId ?? null,
      docTitle: entry.docTitle ?? null,
      metricId: entry.metricId ?? null,
      metricLabel: entry.metricLabel ?? null,
      ip: maskIpAddress(entry.ip),
      userAgent: entry.userAgent ?? null,
    }
  })

  return {
    summary: {
      usersTotal: users.length,
      activeViewers: activeViewers.length,
      uniqueViewers24h: new Set(portalViews24h.map((entry) => entry.userId).filter(Boolean)).size,
      views24h: portalViews24h.length,
      dashboardViews24h: portalViews24h.filter((entry) => entry.route === 'dashboard').length,
      investmentViews24h: portalViews24h.filter((entry) => entry.route === 'investment').length,
      docsViews24h: portalViews24h.filter((entry) => entry.route === 'docs').length,
      methodologyViews24h: portalViews24h.filter((entry) => entry.route === 'methodology').length,
      adminViews24h: portalViews24h.filter((entry) => entry.route === 'admin').length,
      passwordResetRequests24h: store.audit.filter((entry) => {
        const entryMs = parseIsoMs(entry.at)
        return (
          entry.type === 'password_reset_requested' &&
          entryMs !== null &&
          entryMs >= cutoff
        )
      }).length,
      passwordResetEmailsSent24h: store.audit.filter((entry) => {
        const entryMs = parseIsoMs(entry.at)
        return (
          entry.type === 'password_reset_delivery_succeeded' &&
          entryMs !== null &&
          entryMs >= cutoff
        )
      }).length,
      passwordResetEmailsFailed24h: store.audit.filter((entry) => {
        const entryMs = parseIsoMs(entry.at)
        return (
          entry.type === 'password_reset_delivery_failed' &&
          entryMs !== null &&
          entryMs >= cutoff
        )
      }).length,
      passwordResetCompleted24h: store.audit.filter((entry) => {
        const entryMs = parseIsoMs(entry.at)
        return (
          entry.type === 'password_reset_completed' &&
          entryMs !== null &&
          entryMs >= cutoff
        )
      }).length,
    },
    users,
    routeBreakdown,
    topStates,
    topDocs,
    recentActivity,
  }
}

async function sendActivationEmail(request, user, rawToken) {
  const activationUrl = `${getBaseUrl(request)}/activar?token=${encodeURIComponent(rawToken)}`
  const subject = 'Activa tu acceso al portal Atlas Studio'
  const introName = user.displayName || user.email
  const safeIntroName = escapeHtml(introName)
  const safeActivationUrl = escapeHtml(activationUrl)
  const text = [
    `Hola ${introName},`,
    '',
    'Recibimos una solicitud para activar acceso al portal Atlas Studio.',
    `Activa tu cuenta aqui: ${activationUrl}`,
    '',
    `Este enlace expira en ${Math.round(ACTIVATION_TOKEN_TTL_MS / (60 * 60 * 1000))} horas.`,
    '',
    'Al activar tu acceso confirmas que aceptaste los terminos del portal y el uso comercial/promocional del correo conforme al aviso visible en el portal.',
    '',
    'Si no reconoces esta solicitud, ignora este mensaje.',
  ].join('\n')
  const html = `
    <div style="font-family: IBM Plex Sans, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hola <strong>${safeIntroName}</strong>,</p>
      <p>Recibimos una solicitud para activar acceso al portal privado de <strong>Atlas Studio</strong>.</p>
      <p>
        <a href="${safeActivationUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;">
          Activar acceso
        </a>
      </p>
      <p>Si el boton no abre, usa esta liga:</p>
      <p><a href="${safeActivationUrl}">${safeActivationUrl}</a></p>
      <p>Este enlace expira en <strong>${Math.round(ACTIVATION_TOKEN_TTL_MS / (60 * 60 * 1000))} horas</strong>.</p>
      <p>Al activar tu acceso confirmas la aceptacion de <strong>${portalTermsTitle}</strong> (${portalTermsVersion}) y la autorizacion para comunicaciones operativas, comerciales y promocionales asociadas al portal.</p>
      <p>Si no reconoces esta solicitud, ignora este mensaje.</p>
    </div>
  `

  return deliverEmail({
    to: user.email,
    subject,
    html,
    text,
  })
}

async function sendPasswordResetEmail(request, user, rawToken) {
  const resetUrl = `${getBaseUrl(request)}/restablecer?token=${encodeURIComponent(rawToken)}`
  const subject = 'Restablece tu password del portal Atlas Studio'
  const introName = user.displayName || user.email
  const safeIntroName = escapeHtml(introName)
  const safeResetUrl = escapeHtml(resetUrl)
  const ttlHours = Math.round(PASSWORD_RESET_TOKEN_TTL_MS / (60 * 60 * 1000))
  const text = [
    `Hola ${introName},`,
    '',
    'Recibimos una solicitud para restablecer el password de tu acceso a Atlas Studio.',
    `Crea un password nuevo aqui: ${resetUrl}`,
    '',
    `Este enlace expira en ${ttlHours} horas.`,
    '',
    'Si no reconoces esta solicitud, ignora este mensaje.',
  ].join('\n')
  const html = `
    <div style="font-family: IBM Plex Sans, Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <p>Hola <strong>${safeIntroName}</strong>,</p>
      <p>Recibimos una solicitud para restablecer el password de tu acceso a <strong>Atlas Studio</strong>.</p>
      <p>
        <a href="${safeResetUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;">
          Restablecer password
        </a>
      </p>
      <p>Si el boton no abre, usa esta liga:</p>
      <p><a href="${safeResetUrl}">${safeResetUrl}</a></p>
      <p>Este enlace expira en <strong>${ttlHours} horas</strong>.</p>
      <p>Si no reconoces esta solicitud, ignora este mensaje.</p>
    </div>
  `

  return deliverEmail({
    to: user.email,
    subject,
    html,
    text,
  })
}

async function issuePasswordReset(store, user, request, options = {}) {
  const requestMeta = options.requestMeta ?? readRequestMeta(request ?? { headers: {}, socket: {} })
  const timestamp = nowIso()

  store.tokens = store.tokens.filter(
    (token) => !(token.userId === user.id && token.purpose === 'password_reset' && !token.consumedAt),
  )

  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenRecord = createEmailTokenRecord({
    purpose: 'password_reset',
    userId: user.id,
    requestMeta,
    timestamp,
  })
  tokenRecord.tokenHash = hashToken(rawToken)
  store.tokens.push(tokenRecord)

  appendAudit(store, 'password_reset_requested', {
    email: user.email,
    userId: user.id,
    source: options.source ?? 'self_service',
    actorUserId: options.actorUser?.id ?? null,
    actorEmail: options.actorUser?.email ?? null,
    ...requestMeta,
  })
  saveStore(store)

  try {
    const delivery = await sendPasswordResetEmail(request, user, rawToken)
    tokenRecord.deliveryMode = delivery.mode
    tokenRecord.deliveryStatus = delivery.mode === 'outbox' ? 'queued' : 'sent'
    tokenRecord.deliveryMessageId = delivery.messageId
    tokenRecord.deliveryAt = nowIso()
    tokenRecord.deliveryAttempts = Number(tokenRecord.deliveryAttempts ?? 0) + 1
    tokenRecord.lastDeliveryAttemptAt = tokenRecord.deliveryAt
    tokenRecord.lastDeliveryError = null
    appendAudit(store, 'password_reset_delivery_succeeded', {
      email: user.email,
      userId: user.id,
      source: options.source ?? 'self_service',
      actorUserId: options.actorUser?.id ?? null,
      actorEmail: options.actorUser?.email ?? null,
      ...requestMeta,
      mailMode: delivery.mode,
      deliveryStatus: tokenRecord.deliveryStatus,
      deliveryMessageId: delivery.messageId ?? null,
    })
    saveStore(store)

    return {
      status: 'password_reset_requested',
      email: maskEmail(user.email),
      deliveryMode: delivery.mode,
      deliveryStatus: tokenRecord.deliveryStatus,
      deliveryAt: tokenRecord.deliveryAt,
      expiresAt: tokenRecord.expiresAt,
    }
  } catch (error) {
    const mailMode = buildMailTransportConfig().mode
    const deliveryError = sanitizeMailError(error)
    tokenRecord.deliveryMode = mailMode
    tokenRecord.deliveryStatus = 'failed'
    tokenRecord.deliveryAttempts = Number(tokenRecord.deliveryAttempts ?? 0) + 1
    tokenRecord.lastDeliveryAttemptAt = nowIso()
    tokenRecord.lastDeliveryError = deliveryError
    appendAudit(store, 'password_reset_delivery_failed', {
      email: user.email,
      userId: user.id,
      source: options.source ?? 'self_service',
      actorUserId: options.actorUser?.id ?? null,
      actorEmail: options.actorUser?.email ?? null,
      ...requestMeta,
      mailMode,
      errorCode: deliveryError?.code ?? null,
      errorMessage: deliveryError?.message ?? 'MAIL_DELIVERY_FAILED',
    })
    saveStore(store)

    return {
      status: 'password_reset_delivery_failed',
      email: maskEmail(user.email),
      deliveryMode: mailMode,
      deliveryStatus: 'failed',
      deliveryAt: null,
      lastDeliveryError: deliveryError,
      expiresAt: tokenRecord.expiresAt,
    }
  }
}

export function createSessionToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role ?? 'viewer',
      exp: Date.now() + SESSION_DURATION_MS,
    }),
  ).toString('base64url')

  return `${payload}.${signPayload(payload)}`
}

export function readSession(request) {
  const cookies = parseCookies(request.headers.cookie)
  const rawToken = cookies[SESSION_COOKIE_NAME]

  if (!rawToken) {
    return null
  }

  const [payload, signature] = rawToken.split('.')

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return null
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!session.exp || Date.now() > session.exp) {
      return null
    }

    const store = loadStore()
    const user = findUserById(store, session.sub)

    if (!user || user.status !== 'active') {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role ?? 'viewer',
      expiresAt: session.exp,
    }
  } catch (_error) {
    return null
  }
}

export function setSessionCookie(request, response, token) {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, token, {
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: getCookieSecurityFlag(request),
    }),
  )
}

export function clearSessionCookie(request, response) {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: getCookieSecurityFlag(request),
    }),
  )
}

export function requireAuth(request, response, next) {
  const session = readSession(request)

  if (!session) {
    response.status(401).json({ error: 'AUTH_REQUIRED' })
    return
  }

  request.sessionUser = session
  next()
}

export function requireAdmin(request, response, next) {
  const session = readSession(request)

  if (!session) {
    response.status(401).json({ error: 'AUTH_REQUIRED' })
    return
  }

  if (session.role !== 'admin') {
    response.status(403).json({ error: 'ADMIN_REQUIRED' })
    return
  }

  request.sessionUser = session
  next()
}

export function authenticateUser(email, password, request = null) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !password) {
    throw createClientError('INVALID_CREDENTIALS', 401)
  }

  const store = loadStore()
  const user = findUserByEmail(store, normalizedEmail)

  if (!user) {
    appendAudit(store, 'login_failed', {
      email: normalizedEmail,
      ...readRequestMeta(request ?? { headers: {}, socket: {} }),
      reason: 'unknown_email',
    })
    saveStore(store)
    throw createClientError('INVALID_CREDENTIALS', 401)
  }

  if (user.status !== 'active' || !user.passwordHash || !user.salt) {
    throw createClientError('ACCOUNT_NOT_ACTIVE', 403)
  }

  const attemptedHash = hashPassword(password, user.salt)
  if (!safeEqual(attemptedHash, user.passwordHash)) {
    appendAudit(store, 'login_failed', {
      email: normalizedEmail,
      userId: user.id,
      ...readRequestMeta(request ?? { headers: {}, socket: {} }),
      reason: 'bad_password',
    })
    saveStore(store)
    throw createClientError('INVALID_CREDENTIALS', 401)
  }

  user.lastLoginAt = nowIso()
  user.lastSeenAt = user.lastLoginAt
  appendAudit(store, 'login_succeeded', {
    email: normalizedEmail,
    userId: user.id,
    ...readRequestMeta(request ?? { headers: {}, socket: {} }),
  })
  saveStore(store)
  return toPublicUser(user)
}

export async function registerAccessRequest(input, request) {
  const email = normalizeEmail(input?.email)
  const displayName = resolveDisplayName(email, input?.displayName)
  const acceptedTerms = Boolean(input?.acceptedTerms)
  const acceptedMarketing = Boolean(input?.acceptedMarketing)

  if (!email || !isValidEmail(email)) {
    throw createClientError('INVALID_EMAIL', 400)
  }

  if (!acceptedTerms) {
    throw createClientError('TERMS_ACCEPTANCE_REQUIRED', 400, {
      termsVersion: portalTermsVersion,
    })
  }

  if (!acceptedMarketing) {
    throw createClientError('MARKETING_CONSENT_REQUIRED', 400)
  }

  const store = loadStore()
  const requestMeta = readRequestMeta(request)
  const timestamp = nowIso()
  let user = findUserByEmail(store, email)

  if (!user) {
    user = {
      id: createId('usr'),
      email,
      displayName,
      role: 'viewer',
      status: 'pending',
      salt: null,
      passwordHash: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      activatedAt: null,
      lastLoginAt: null,
      termsAcceptedAt: timestamp,
      acceptedTermsVersion: portalTermsVersion,
      acceptedMarketing: true,
      acceptedMarketingAt: timestamp,
      requestCount: 0,
    }
    store.users.push(user)
  }

  if (user.status === 'active' && user.passwordHash) {
    user.displayName = displayName || user.displayName
    if (!user.termsAcceptedAt) {
      user.termsAcceptedAt = timestamp
    }
    user.acceptedTermsVersion = portalTermsVersion
    user.acceptedMarketing = true
    user.acceptedMarketingAt = user.acceptedMarketingAt ?? timestamp
    user.updatedAt = timestamp
    appendAudit(store, 'access_request_existing_active', {
      email,
      userId: user.id,
      ...requestMeta,
    })
    saveStore(store)
    return {
      status: 'already_active',
      email: maskEmail(email),
      deliveryMode: null,
    }
  }

  user.displayName = displayName || user.displayName
  user.status = 'pending'
  user.updatedAt = timestamp
  user.termsAcceptedAt = timestamp
  user.acceptedTermsVersion = portalTermsVersion
  user.acceptedMarketing = true
  user.acceptedMarketingAt = timestamp
  user.requestCount = Number(user.requestCount ?? 0) + 1

  store.tokens = store.tokens.filter(
    (token) => !(token.userId === user.id && token.purpose === 'activation' && !token.consumedAt),
  )

  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenRecord = createEmailTokenRecord({
    purpose: 'activation',
    userId: user.id,
    requestMeta,
    timestamp,
  })
  tokenRecord.tokenHash = hashToken(rawToken)
  store.tokens.push(tokenRecord)
  appendAudit(store, 'activation_requested', {
    email,
    userId: user.id,
    ...requestMeta,
  })
  saveStore(store)

  try {
    const delivery = await sendActivationEmail(request, user, rawToken)
    tokenRecord.deliveryMode = delivery.mode
    tokenRecord.deliveryStatus = delivery.mode === 'outbox' ? 'queued' : 'sent'
    tokenRecord.deliveryMessageId = delivery.messageId
    tokenRecord.deliveryAt = nowIso()
    tokenRecord.deliveryAttempts = Number(tokenRecord.deliveryAttempts ?? 0) + 1
    tokenRecord.lastDeliveryAttemptAt = tokenRecord.deliveryAt
    tokenRecord.lastDeliveryError = null
    appendAudit(store, 'activation_delivery_succeeded', {
      email,
      userId: user.id,
      ...requestMeta,
      mailMode: delivery.mode,
      deliveryStatus: tokenRecord.deliveryStatus,
      deliveryMessageId: delivery.messageId ?? null,
    })
    saveStore(store)

    return {
      status: 'activation_requested',
      email: maskEmail(email),
      deliveryMode: delivery.mode,
      deliveryStatus: tokenRecord.deliveryStatus,
      deliveryAt: tokenRecord.deliveryAt,
      termsVersion: portalTermsVersion,
    }
  } catch (error) {
    const mailMode = buildMailTransportConfig().mode
    const deliveryError = sanitizeMailError(error)
    tokenRecord.deliveryMode = mailMode
    tokenRecord.deliveryStatus = 'failed'
    tokenRecord.deliveryAttempts = Number(tokenRecord.deliveryAttempts ?? 0) + 1
    tokenRecord.lastDeliveryAttemptAt = nowIso()
    tokenRecord.lastDeliveryError = deliveryError
    appendAudit(store, 'activation_delivery_failed', {
      email,
      userId: user.id,
      ...requestMeta,
      mailMode,
      errorCode: deliveryError?.code ?? null,
      errorMessage: deliveryError?.message ?? 'MAIL_DELIVERY_FAILED',
    })
    saveStore(store)

    return {
      status: 'activation_delivery_failed',
      email: maskEmail(email),
      deliveryMode: mailMode,
      deliveryStatus: 'failed',
      deliveryAt: null,
      lastDeliveryError: deliveryError,
      termsVersion: portalTermsVersion,
    }
  }
}

export function inspectActivationToken(rawToken) {
  const store = loadStore()
  const { token, user } = assertValidActivationToken(store, rawToken)

  if (user.status === 'active' && user.passwordHash) {
    throw createClientError('ACCOUNT_ALREADY_ACTIVE', 409)
  }

  return {
    email: user.email,
    maskedEmail: maskEmail(user.email),
    displayName: user.displayName,
    expiresAt: token.expiresAt,
    termsVersion: user.acceptedTermsVersion ?? portalTermsVersion,
    termsAcceptedAt: user.termsAcceptedAt ?? null,
    acceptedMarketing: Boolean(user.acceptedMarketing),
  }
}

export async function requestPasswordReset(input, request) {
  const email = normalizeEmail(input?.email)

  if (!email || !isValidEmail(email)) {
    throw createClientError('INVALID_EMAIL', 400)
  }

  const store = loadStore()
  const requestMeta = readRequestMeta(request)
  const user = findUserByEmail(store, email)

  if (!user || user.status !== 'active' || !user.passwordHash || !user.salt) {
    appendAudit(store, 'password_reset_accepted_without_delivery', {
      email,
      userId: user?.id ?? null,
      reason: !user ? 'unknown_email' : 'inactive_account',
      ...requestMeta,
    })
    saveStore(store)

    return {
      status: 'password_reset_requested',
      email: maskEmail(email),
      deliveryMode: null,
      deliveryStatus: 'accepted',
      deliveryAt: null,
      expiresAt: null,
    }
  }

  return issuePasswordReset(store, user, request, {
    requestMeta,
    source: 'self_service',
  })
}

export function inspectPasswordResetToken(rawToken) {
  const store = loadStore()
  const { token, user } = assertValidPasswordResetToken(store, rawToken)

  if (user.status !== 'active' || !user.passwordHash) {
    throw createClientError('ACCOUNT_NOT_ACTIVE', 409)
  }

  return {
    email: user.email,
    maskedEmail: maskEmail(user.email),
    displayName: user.displayName,
    expiresAt: token.expiresAt,
  }
}

export function resetPassword(rawToken, password, request = null) {
  validatePassword(password)

  const store = loadStore()
  const { token, user } = assertValidPasswordResetToken(store, rawToken)

  if (user.status !== 'active' || !user.passwordHash) {
    throw createClientError('ACCOUNT_NOT_ACTIVE', 409)
  }

  const timestamp = nowIso()
  const salt = createPasswordSalt()

  user.salt = salt
  user.passwordHash = hashPassword(password, salt)
  user.lastPasswordResetAt = timestamp
  user.lastLoginAt = timestamp
  user.lastSeenAt = timestamp
  user.updatedAt = timestamp
  token.consumedAt = timestamp

  appendAudit(store, 'password_reset_completed', {
    email: user.email,
    userId: user.id,
    ...readRequestMeta(request ?? { headers: {}, socket: {} }),
  })
  saveStore(store)

  return toPublicUser(user)
}

export function activateUser(rawToken, password, request = null) {
  validatePassword(password)

  const store = loadStore()
  const { token, user } = assertValidActivationToken(store, rawToken)

  if (user.status === 'active' && user.passwordHash) {
    throw createClientError('ACCOUNT_ALREADY_ACTIVE', 409)
  }

  const timestamp = nowIso()
  const salt = createPasswordSalt()

  user.salt = salt
  user.passwordHash = hashPassword(password, salt)
  user.status = 'active'
  user.activatedAt = user.activatedAt ?? timestamp
  user.lastLoginAt = timestamp
  user.updatedAt = timestamp
  user.termsAcceptedAt = user.termsAcceptedAt ?? timestamp
  user.acceptedTermsVersion = user.acceptedTermsVersion ?? portalTermsVersion
  user.acceptedMarketing = true
  user.acceptedMarketingAt = user.acceptedMarketingAt ?? timestamp
  token.consumedAt = timestamp

  appendAudit(store, 'account_activated', {
    email: user.email,
    userId: user.id,
    ...readRequestMeta(request ?? { headers: {}, socket: {} }),
  })
  saveStore(store)

  return toPublicUser(user)
}

export function listPortalUsers() {
  const store = loadStore()
  return store.users
    .map((user) => buildPortalUserRecord(store, user))
    .sort((left, right) =>
      String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')),
    )
}

export async function sendPasswordResetForUser(userId, request) {
  const store = loadStore()
  const user = findUserById(store, userId)

  if (!user) {
    throw createClientError('USER_NOT_FOUND', 404)
  }

  if (user.status !== 'active' || !user.passwordHash || !user.salt) {
    throw createClientError('ACCOUNT_NOT_ACTIVE', 409)
  }

  return issuePasswordReset(store, user, request, {
    requestMeta: readRequestMeta(request),
    source: 'admin_resend',
    actorUser: request.sessionUser ?? null,
  })
}

export function recordPortalView(sessionUser, payload, request = null) {
  if (!sessionUser?.id) {
    throw createClientError('AUTH_REQUIRED', 401)
  }

  const event = normalizePortalEvent(payload)
  const store = loadStore()
  const user = findUserById(store, sessionUser.id)

  if (!user || user.status !== 'active') {
    throw createClientError('AUTH_REQUIRED', 401)
  }

  const timestamp = nowIso()
  const signature = createPortalEventSignature(event)
  const lastTrackedAtMs = parseIsoMs(user.lastTrackedAt)
  const shouldAppendAudit =
    user.lastTrackedSignature !== signature ||
    lastTrackedAtMs === null ||
    Date.now() - lastTrackedAtMs >= TRACK_DEDUP_WINDOW_MS

  user.lastSeenAt = timestamp
  user.lastRoute = event.route
  user.lastRouteLabel = event.routeLabel
  user.lastStateId = event.stateId
  user.lastStateName = event.stateName
  user.lastDocId = event.docId
  user.lastDocTitle = event.docTitle
  user.lastMetricId = event.metricId
  user.lastMetricLabel = event.metricLabel
  user.updatedAt = timestamp

  if (shouldAppendAudit) {
    appendAudit(store, 'portal_view', {
      email: user.email,
      userId: user.id,
      route: event.route,
      routeLabel: event.routeLabel,
      stateId: event.stateId,
      stateName: event.stateName,
      docId: event.docId,
      docTitle: event.docTitle,
      metricId: event.metricId,
      metricLabel: event.metricLabel,
      ...readRequestMeta(request ?? { headers: {}, socket: {} }),
    })
    user.lastTrackedSignature = signature
    user.lastTrackedAt = timestamp
  }

  saveStore(store)

  return {
    status: 'ok',
    tracked: shouldAppendAudit,
    lastSeenAt: user.lastSeenAt,
  }
}

export function getAdminOverview() {
  return buildAdminOverviewPayload()
}

export function upsertActiveUser({
  email,
  password,
  displayName,
  role = 'admin',
  acceptedMarketing = true,
}) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw createClientError('INVALID_EMAIL', 400)
  }

  validatePassword(password)

  const store = loadStore()
  const timestamp = nowIso()
  let user = findUserByEmail(store, normalizedEmail)

  if (!user) {
    user = {
      id: createId('usr'),
      email: normalizedEmail,
      createdAt: timestamp,
    }
    store.users.push(user)
  }

  const salt = createPasswordSalt()
  user.displayName = resolveDisplayName(normalizedEmail, displayName)
  user.role = role === 'viewer' ? 'viewer' : 'admin'
  user.status = 'active'
  user.salt = salt
  user.passwordHash = hashPassword(password, salt)
  user.activatedAt = user.activatedAt ?? timestamp
  user.updatedAt = timestamp
  user.termsAcceptedAt = user.termsAcceptedAt ?? timestamp
  user.acceptedTermsVersion = portalTermsVersion
  user.acceptedMarketing = Boolean(acceptedMarketing)
  user.acceptedMarketingAt = Boolean(acceptedMarketing)
    ? user.acceptedMarketingAt ?? timestamp
    : null
  user.lastLoginAt = user.lastLoginAt ?? null

  store.tokens = store.tokens.filter((token) => token.userId !== user.id)
  appendAudit(store, 'admin_user_upserted', {
    email: user.email,
    userId: user.id,
    role: user.role,
  })
  saveStore(store)

  return toPublicUser(user)
}

export function getAuthConfiguration() {
  return {
    termsVersion: portalTermsVersion,
    passwordMinimumLength: PASSWORD_MIN_LENGTH,
    activationTokenTtlHours: Math.round(ACTIVATION_TOKEN_TTL_MS / (60 * 60 * 1000)),
    passwordResetTokenTtlHours: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / (60 * 60 * 1000)),
    mailMode: buildMailTransportConfig().mode,
  }
}

export function sendAuthError(response, error) {
  if (error?.code && error?.status) {
    response.status(error.status).json({
      error: error.code,
      details: error.details ?? null,
    })
    return
  }

  console.error(error)
  response.status(500).json({ error: 'INTERNAL_SERVER_ERROR' })
}
