import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function PasswordResetPage({
  initialToken = '',
  onPasswordReset,
  onNavigateLogin,
}) {
  const [token, setToken] = useState(initialToken)
  const [resetState, setResetState] = useState({
    loading: true,
    error: '',
    payload: null,
  })
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    let ignore = false

    async function inspect() {
      if (!token) {
        setResetState({
          loading: false,
          error: 'Falta el token de restablecimiento.',
          payload: null,
        })
        return
      }

      setResetState({
        loading: true,
        error: '',
        payload: null,
      })

      try {
        const payload = await api.inspectPasswordResetToken(token)
        if (!ignore) {
          setResetState({
            loading: false,
            error: '',
            payload,
          })
        }
      } catch (error) {
        if (!ignore) {
          const code = error.payload?.error
          const nextMessage =
            code === 'PASSWORD_RESET_TOKEN_EXPIRED'
              ? 'El enlace de reset ya expiro. Solicita uno nuevo.'
              : code === 'PASSWORD_RESET_TOKEN_CONSUMED'
                ? 'Este enlace ya fue usado. Solicita otro si todavia lo necesitas.'
                : code === 'ACCOUNT_NOT_ACTIVE'
                  ? 'Este correo todavia no tiene acceso activo. Primero activa la cuenta.'
                  : 'No pude validar este enlace de restablecimiento.'
          setResetState({
            loading: false,
            error: nextMessage,
            payload: null,
          })
        }
      }
    }

    inspect()

    return () => {
      ignore = true
    }
  }, [token])

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitError('')

    if (password !== confirmPassword) {
      setSubmitError('Los passwords no coinciden.')
      return
    }

    setSubmitting(true)

    try {
      const payload = await api.confirmPasswordReset({ token, password })
      onPasswordReset(payload.user)
    } catch (error) {
      const code = error.payload?.error
      const nextMessage =
        code === 'PASSWORD_TOO_SHORT'
          ? 'El password es demasiado corto.'
          : code === 'PASSWORD_RESET_TOKEN_EXPIRED'
            ? 'El enlace ya expiro. Solicita otro.'
            : code === 'PASSWORD_RESET_TOKEN_CONSUMED'
              ? 'Este enlace ya fue consumido. Solicita uno nuevo.'
              : 'No pude restablecer tu password.'
      setSubmitError(nextMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Password reset / atlas studio</p>
        <h1>Restablece tu password</h1>
        <p className="login-copy">
          Este paso reemplaza tu password actual y vuelve a abrir el portal para tu correo.
        </p>

        {resetState.loading ? (
          <div className="activation-status">
            <strong>Validando enlace...</strong>
          </div>
        ) : resetState.error ? (
          <div className="activation-status activation-status--error">
            <strong>{resetState.error}</strong>
            <div className="form-actions">
              <button className="nav-button" onClick={onNavigateLogin} type="button">
                Volver al acceso
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="activation-status activation-status--ok">
              <strong>{resetState.payload?.maskedEmail}</strong>
              <span>
                Enlace valido hasta {new Date(resetState.payload?.expiresAt).toLocaleString()}
              </span>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Password nuevo</span>
                <input
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Crea un password fuerte"
                  required
                  type="password"
                  value={password}
                />
              </label>

              <label className="form-field">
                <span>Confirmar password</span>
                <input
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repite el password"
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>

              {submitError ? <p className="login-error">{submitError}</p> : null}

              <div className="form-actions">
                <button
                  className="nav-button nav-button--ghost"
                  onClick={onNavigateLogin}
                  type="button"
                >
                  Cancelar
                </button>
                <button className="nav-button is-active" disabled={submitting} type="submit">
                  {submitting ? 'Guardando...' : 'Guardar password'}
                </button>
              </div>
            </form>
          </>
        )}

        <div className="activation-token-field">
          <label className="form-field">
            <span>Token detectado</span>
            <input
              onChange={(event) => setToken(event.target.value)}
              spellCheck="false"
              type="text"
              value={token}
            />
          </label>
        </div>
      </section>
    </main>
  )
}
