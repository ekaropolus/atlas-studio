import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import portalTermsMarkdown from '../../docs/portal-terms.md?raw'

function TermsModal({ onAccept, onClose, termsVersion }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="portal-terms-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Acceso y consentimiento</p>
            <h2 id="portal-terms-title">Terminos del portal</h2>
          </div>
          <button className="nav-button nav-button--ghost" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <div className="docs-markdown docs-markdown--modal">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{portalTermsMarkdown}</ReactMarkdown>
        </div>

        <div className="modal-actions">
          <p>
            Al aceptar se guarda la version <strong>{termsVersion}</strong> junto con la
            autorizacion para comunicaciones operativas, comerciales y promocionales.
          </p>
          <button className="nav-button is-active" onClick={onAccept} type="button">
            Leer y aceptar
          </button>
        </div>
      </section>
    </div>
  )
}

export default function LoginPage({
  authConfig,
  error,
  loading,
  onRequestAccess,
  onRequestPasswordReset,
  onSubmit,
}) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestNotice, setRequestNotice] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetNotice, setResetNotice] = useState('')
  const [showTerms, setShowTerms] = useState(false)

  const minimumLength = authConfig?.passwordMinimumLength ?? 12
  const mailMode = authConfig?.mailMode ?? 'outbox'
  const termsVersion = authConfig?.termsVersion ?? 'current'

  const requestHint =
    mailMode === 'smtp' || mailMode === 'sendmail'
      ? 'El acceso se activa desde un enlace enviado por correo.'
      : 'El flujo de activacion ya usa token; si el correo no llega, el equipo puede reenviarlo manualmente.'
  const resetHint =
    mailMode === 'smtp' || mailMode === 'sendmail'
      ? 'Cualquier usuario activo puede pedir este reset desde aqui. Admin solo lo reenvia como soporte.'
      : 'El reset ya usa token y cualquier usuario activo puede pedirlo desde aqui. Si no llega, Admin puede reenviarlo como soporte.'

  async function handleLogin(event) {
    event.preventDefault()
    await onSubmit({ email, password })
  }

  async function handleRequestAccess(event) {
    event.preventDefault()
    setRequestLoading(true)
    setRequestError('')
    setRequestNotice('')

    try {
      const payload = await onRequestAccess({
        email: requestEmail,
        displayName,
        acceptedTerms: termsAccepted,
        acceptedMarketing: marketingAccepted,
      })

      if (payload.status === 'already_active') {
        setRequestNotice(
          `El correo ${payload.email} ya tiene acceso activo. Puedes entrar directo con tu password.`,
        )
      } else if (payload.status === 'activation_delivery_failed') {
        setRequestNotice(
          `La solicitud de ${payload.email} quedó registrada, pero el correo de activación falló. El equipo ya puede ver el error SMTP dentro del portal.`,
        )
      } else {
        setRequestNotice(
          payload.deliveryStatus === 'queued'
            ? `La activación de ${payload.email} quedó en outbox. El equipo puede reenviarla desde infraestructura.`
            : `Se envió activación para ${payload.email} por ${payload.deliveryMode} el ${new Date(payload.deliveryAt).toLocaleString()}. Revisa tu correo para continuar.`,
        )
      }
    } catch (requestAccessError) {
      const code = requestAccessError.payload?.error
      const nextMessage =
        code === 'INVALID_EMAIL'
          ? 'Necesito un correo valido.'
          : code === 'TERMS_ACCEPTANCE_REQUIRED' || code === 'MARKETING_CONSENT_REQUIRED'
            ? 'Necesitas leer y aceptar terminos y uso promocional del correo.'
            : code === 'EMAIL_DELIVERY_FAILED'
              ? 'Registré la solicitud, pero no pude enviar el correo de activación.'
            : 'No pude registrar la solicitud de acceso.'
      setRequestError(nextMessage)
    } finally {
      setRequestLoading(false)
    }
  }

  async function handlePasswordResetRequest(event) {
    event.preventDefault()
    setResetLoading(true)
    setResetError('')
    setResetNotice('')

    try {
      const payload = await onRequestPasswordReset({
        email: resetEmail,
      })

      if (payload.status === 'password_reset_delivery_failed') {
        setResetNotice(
          `La solicitud de reset para ${payload.email} quedó registrada, pero el correo falló. El equipo puede reenviarlo desde Admin.`,
        )
      } else if (payload.deliveryStatus === 'accepted') {
        setResetNotice(
          `Si ${payload.email} ya tenía una cuenta activa, el enlace de restablecimiento ya quedó programado. Revisa tu correo y spam.`,
        )
      } else {
        setResetNotice(
          payload.deliveryStatus === 'queued'
            ? `El reset para ${payload.email} quedó en outbox. El equipo puede sacarlo desde infraestructura o reenviarlo desde Admin.`
            : `Se envió reset para ${payload.email} por ${payload.deliveryMode} el ${new Date(payload.deliveryAt).toLocaleString()}. Revisa tu correo para continuar.`,
        )
      }
    } catch (passwordResetError) {
      const code = passwordResetError.payload?.error
      const nextMessage =
        code === 'INVALID_EMAIL'
          ? 'Necesito un correo valido.'
          : code === 'EMAIL_DELIVERY_FAILED'
            ? 'Registré la solicitud, pero no pude enviar el correo de restablecimiento.'
            : 'No pude iniciar el restablecimiento de password.'
      setResetError(nextMessage)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <>
      <main className="login-shell">
        <section className="login-card login-card--wide">
          <div className="login-hero">
            <div>
              <p className="eyebrow">Portal privado / atlas studio</p>
              <h1>Mexico Security Study</h1>
            </div>
            <p className="login-copy">
              Dashboard, metodologia y documentacion tecnica del atlas estatal con acceso
              controlado por correo.
            </p>
          </div>

          <div className="login-mode-tabs">
            <button
              className={mode === 'login' ? 'nav-button is-active' : 'nav-button'}
              onClick={() => setMode('login')}
              type="button"
            >
              Entrar
            </button>
            <button
              className={mode === 'request' ? 'nav-button is-active' : 'nav-button'}
              onClick={() => setMode('request')}
              type="button"
            >
              Solicitar acceso
            </button>
            <button
              className={mode === 'reset' ? 'nav-button is-active' : 'nav-button'}
              onClick={() => setMode('reset')}
              type="button"
            >
              Olvide mi password
            </button>
          </div>

          {mode === 'login' ? (
            <form className="login-form" onSubmit={handleLogin}>
              <label className="form-field">
                <span>Correo</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <label className="form-field">
                <span>Password</span>
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="password"
                  required
                  type="password"
                  value={password}
                />
              </label>

              {error ? <p className="login-error">{error}</p> : null}

              <div className="form-actions">
                <span className="login-hint">
                  El portal protege UI, API y documentos. Password minimo: {minimumLength}{' '}
                  caracteres.
                </span>
                <div className="inline-actions">
                  <button className="link-button" onClick={() => setMode('reset')} type="button">
                    Olvide mi password
                  </button>
                  <button className="nav-button is-active" disabled={loading} type="submit">
                    {loading ? 'Entrando...' : 'Entrar'}
                  </button>
                </div>
              </div>
            </form>
          ) : mode === 'request' ? (
            <form className="login-form" onSubmit={handleRequestAccess}>
              <label className="form-field">
                <span>Correo</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setRequestEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  type="email"
                  value={requestEmail}
                />
              </label>

              <label className="form-field">
                <span>Nombre o referencia</span>
                <input
                  autoComplete="name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Nombre completo / empresa"
                  type="text"
                  value={displayName}
                />
              </label>

              <div className="consent-card">
                <div>
                  <span className="consent-label">Terminos y promociones</span>
                  <p>
                    Para entrar necesitas aceptar las condiciones de visualizacion del portal
                    y el uso operativo, comercial y promocional del correo.
                  </p>
                </div>

                <button className="nav-button" onClick={() => setShowTerms(true)} type="button">
                  {termsAccepted ? 'Terminos aceptados' : 'Leer y aceptar terminos'}
                </button>
              </div>

              <div className={termsAccepted ? 'consent-status is-accepted' : 'consent-status'}>
                <strong>{termsAccepted ? 'Aceptacion registrada' : 'Aceptacion pendiente'}</strong>
                <span>
                  {termsAccepted
                    ? `Version ${termsVersion}. Tambien aceptaste comunicaciones comerciales y promocionales.`
                    : 'Debes abrir el modal y aceptar antes de solicitar acceso.'}
                </span>
              </div>

              {requestError ? <p className="login-error">{requestError}</p> : null}
              {requestNotice ? <p className="login-notice">{requestNotice}</p> : null}

              <div className="form-actions">
                <span className="login-hint">{requestHint}</span>
                <button
                  className="nav-button is-active"
                  disabled={requestLoading || !termsAccepted || !marketingAccepted}
                  type="submit"
                >
                  {requestLoading ? 'Generando acceso...' : 'Solicitar acceso'}
                </button>
              </div>
            </form>
          ) : (
            <form className="login-form" onSubmit={handlePasswordResetRequest}>
              <label className="form-field">
                <span>Correo</span>
                <input
                  autoComplete="email"
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="nombre@empresa.com"
                  required
                  type="email"
                  value={resetEmail}
                />
              </label>

              <div className="consent-status">
                <strong>Reset por correo self-service</strong>
                <span>
                  Cualquier usuario activo puede pedirlo desde esta pantalla. Admin solo puede
                  reenviarlo si el correo no llego o si soporte necesita asistir.
                </span>
              </div>

              {resetError ? <p className="login-error">{resetError}</p> : null}
              {resetNotice ? <p className="login-notice">{resetNotice}</p> : null}

              <div className="form-actions">
                <span className="login-hint">{resetHint}</span>
                <button className="nav-button is-active" disabled={resetLoading} type="submit">
                  {resetLoading ? 'Enviando reset...' : 'Enviar reset por correo'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      {showTerms ? (
        <TermsModal
          onAccept={() => {
            setTermsAccepted(true)
            setMarketingAccepted(true)
            setShowTerms(false)
          }}
          onClose={() => setShowTerms(false)}
          termsVersion={termsVersion}
        />
      ) : null}
    </>
  )
}
