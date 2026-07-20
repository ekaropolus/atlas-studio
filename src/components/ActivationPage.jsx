import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export default function ActivationPage({ initialToken = '', onActivated, onNavigateLogin }) {
  const [token, setToken] = useState(initialToken)
  const [activationState, setActivationState] = useState({
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
        setActivationState({
          loading: false,
          error: 'Falta el token de activacion.',
          payload: null,
        })
        return
      }

      setActivationState({
        loading: true,
        error: '',
        payload: null,
      })

      try {
        const payload = await api.inspectActivationToken(token)
        if (!ignore) {
          setActivationState({
            loading: false,
            error: '',
            payload,
          })
        }
      } catch (error) {
        if (!ignore) {
          const code = error.payload?.error
          const nextMessage =
            code === 'ACTIVATION_TOKEN_EXPIRED'
              ? 'El enlace de activacion ya expiro. Solicita uno nuevo.'
              : code === 'ACCOUNT_ALREADY_ACTIVE'
                ? 'Este acceso ya fue activado. Puedes entrar directo con tu correo y password.'
                : 'No pude validar este enlace de activacion.'
          setActivationState({
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
      const payload = await api.activate({ token, password })
      onActivated(payload.user)
    } catch (error) {
      const code = error.payload?.error
      const nextMessage =
        code === 'PASSWORD_TOO_SHORT'
          ? `El password es demasiado corto.`
          : code === 'ACTIVATION_TOKEN_EXPIRED'
            ? 'El enlace ya expiro. Solicita otro.'
            : 'No pude activar tu acceso.'
      setSubmitError(nextMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Activacion / atlas studio</p>
        <h1>Activa tu acceso</h1>
        <p className="login-copy">
          Este paso crea tu password y habilita el portal para tu correo.
        </p>

        {activationState.loading ? (
          <div className="activation-status">
            <strong>Validando enlace...</strong>
          </div>
        ) : activationState.error ? (
          <div className="activation-status activation-status--error">
            <strong>{activationState.error}</strong>
            <div className="form-actions">
              <button className="nav-button" onClick={onNavigateLogin} type="button">
                Volver al acceso
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="activation-status activation-status--ok">
              <strong>{activationState.payload?.maskedEmail}</strong>
              <span>
                Enlace valido hasta {new Date(activationState.payload?.expiresAt).toLocaleString()}
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
                <button className="nav-button nav-button--ghost" onClick={onNavigateLogin} type="button">
                  Cancelar
                </button>
                <button className="nav-button is-active" disabled={submitting} type="submit">
                  {submitting ? 'Activando...' : 'Activar portal'}
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
