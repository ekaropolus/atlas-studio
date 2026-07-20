import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  activateUser,
  authenticateUser,
  clearSessionCookie,
  createSessionToken,
  getAdminOverview,
  getAuthConfiguration,
  inspectActivationToken,
  inspectPasswordResetToken,
  listPortalUsers,
  readSession,
  recordPortalView,
  registerAccessRequest,
  requireAdmin,
  requireAuth,
  requestPasswordReset,
  resetPassword,
  sendAuthError,
  sendPasswordResetForUser,
  setSessionCookie,
} from './auth/authService.mjs'
import {
  getCityDetail,
  getStateDetail,
  getStudyOverview,
} from './services/studyService.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

const app = express()
const port = Number(process.env.PORT ?? 4173)

app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'atlas-studio',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/auth/session', (request, response) => {
  const session = readSession(request)

  if (!session) {
    response.status(401).json({ error: 'AUTH_REQUIRED' })
    return
  }

  response.json({ user: session })
})

app.get('/api/auth/config', (_request, response) => {
  response.json(getAuthConfiguration())
})

app.post('/api/auth/register-request', async (request, response) => {
  try {
    const payload = await registerAccessRequest(request.body, request)
    response.status(202).json(payload)
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.get('/api/auth/activation/:token', (request, response) => {
  try {
    response.json(inspectActivationToken(request.params.token))
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.post('/api/auth/password-reset-request', async (request, response) => {
  try {
    const payload = await requestPasswordReset(request.body, request)
    response.status(202).json(payload)
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.get('/api/auth/password-reset/:token', (request, response) => {
  try {
    response.json(inspectPasswordResetToken(request.params.token))
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.post('/api/auth/activate', (request, response) => {
  try {
    const user = activateUser(request.body?.token, request.body?.password, request)
    const token = createSessionToken(user)
    setSessionCookie(request, response, token)
    response.status(201).json({ user })
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.post('/api/auth/password-reset/confirm', (request, response) => {
  try {
    const user = resetPassword(request.body?.token, request.body?.password, request)
    const token = createSessionToken(user)
    setSessionCookie(request, response, token)
    response.status(201).json({ user })
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.post('/api/auth/login', (request, response) => {
  let user = null

  try {
    user = authenticateUser(request.body?.email, request.body?.password, request)
  } catch (error) {
    sendAuthError(response, error)
    return
  }

  const token = createSessionToken(user)
  setSessionCookie(request, response, token)
  response.json({ user })
})

app.post('/api/auth/logout', (request, response) => {
  clearSessionCookie(request, response)
  response.json({ status: 'ok' })
})

app.get('/api/auth/admin/users', requireAdmin, (_request, response) => {
  response.json({ users: listPortalUsers() })
})

app.get('/api/auth/admin/overview', requireAdmin, (_request, response) => {
  response.json(getAdminOverview())
})

app.post('/api/auth/admin/users/:userId/password-reset', requireAdmin, async (request, response) => {
  try {
    const payload = await sendPasswordResetForUser(request.params.userId, request)
    response.status(202).json(payload)
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.post('/api/auth/track', requireAuth, (request, response) => {
  try {
    response.status(202).json(recordPortalView(request.sessionUser, request.body, request))
  } catch (error) {
    sendAuthError(response, error)
  }
})

app.get('/api/study', requireAuth, (_request, response) => {
  response.json(getStudyOverview())
})

app.get('/api/states/:stateId', requireAuth, (request, response) => {
  const payload = getStateDetail(request.params.stateId)

  if (!payload) {
    response.status(404).json({ error: 'STATE_NOT_FOUND' })
    return
  }

  response.json(payload)
})

app.get('/api/states/:stateId/cities/:cityId', requireAuth, (request, response) => {
  const payload = getCityDetail(request.params.stateId, request.params.cityId)

  if (!payload) {
    response.status(404).json({ error: 'CITY_NOT_FOUND' })
    return
  }

  response.json(payload)
})

app.use(express.static(distDir))

app.use((request, response) => {
  if (request.path.startsWith('/api/')) {
    response.status(404).json({ error: 'NOT_FOUND' })
    return
  }

  response.sendFile(path.join(distDir, 'index.html'))
})

const server = app.listen(port, () => {
  console.log(`atlas-studio listening on http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
