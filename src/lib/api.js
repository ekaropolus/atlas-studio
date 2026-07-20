async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    let payload = null

    try {
      payload = await response.json()
    } catch (_error) {
      payload = null
    }

    const error = new Error(payload?.error ?? `REQUEST_FAILED:${path}`)
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const api = {
  getAuthConfig() {
    return request('/api/auth/config')
  },
  getSession() {
    return request('/api/auth/session')
  },
  login(credentials) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },
  requestAccess(payload) {
    return request('/api/auth/register-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  requestPasswordReset(payload) {
    return request('/api/auth/password-reset-request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  inspectActivationToken(token) {
    return request(`/api/auth/activation/${encodeURIComponent(token)}`)
  },
  inspectPasswordResetToken(token) {
    return request(`/api/auth/password-reset/${encodeURIComponent(token)}`)
  },
  activate(payload) {
    return request('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  confirmPasswordReset(payload) {
    return request('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  logout() {
    return request('/api/auth/logout', {
      method: 'POST',
    })
  },
  getPortalUsers() {
    return request('/api/auth/admin/users')
  },
  getAdminOverview() {
    return request('/api/auth/admin/overview')
  },
  sendPasswordResetForUser(userId) {
    return request(`/api/auth/admin/users/${encodeURIComponent(userId)}/password-reset`, {
      method: 'POST',
    })
  },
  trackPortalView(payload) {
    return request('/api/auth/track', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getStudy() {
    return request('/api/study')
  },
  getStateDetail(stateId) {
    return request(`/api/states/${stateId}`)
  },
  getCityDetail(stateId, cityId) {
    return request(`/api/states/${stateId}/cities/${cityId}`)
  },
}
