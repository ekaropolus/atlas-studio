import { useState } from 'react'
import { formatDateTimeValue } from '../lib/format'

function getLifecycleTone(user) {
  if (user.status === 'active') {
    return 'good'
  }

  if (user.latestActivation?.deliveryStatus === 'failed') {
    return 'risk'
  }

  return 'neutral'
}

function getLifecycleLabel(user) {
  if (user.status === 'active') {
    return 'Activo'
  }

  if (user.latestActivation?.deliveryStatus === 'failed') {
    return 'Pendiente con fallo'
  }

  return 'Pendiente'
}

function getDeliveryTone(activation) {
  if (!activation) {
    return 'neutral'
  }

  if (activation.deliveryStatus === 'failed') {
    return 'risk'
  }

  if (activation.deliveryStatus === 'sent') {
    return 'good'
  }

  return 'neutral'
}

function getDeliveryLabel(activation) {
  if (!activation) {
    return 'Sin envio'
  }

  if (activation.deliveryStatus === 'failed') {
    return 'Fallo SMTP'
  }

  if (activation.deliveryStatus === 'sent') {
    return 'Correo enviado'
  }

  if (activation.deliveryStatus === 'queued') {
    return 'Outbox'
  }

  return 'Pendiente'
}

function getViewerTone(user) {
  return user.isActiveViewer ? 'good' : 'neutral'
}

function getViewerLabel(user) {
  return user.isActiveViewer ? 'Activo ahora' : 'Sin presencia reciente'
}

function getLatestMailIssue(user) {
  const candidates = [
    {
      source: 'Activacion',
      token: user.latestActivation,
    },
    {
      source: 'Reset',
      token: user.latestPasswordReset,
    },
  ].filter((candidate) => candidate.token?.lastDeliveryError?.message)

  candidates.sort(
    (left, right) =>
      Date.parse(right.token?.lastDeliveryAttemptAt ?? '') -
      Date.parse(left.token?.lastDeliveryAttemptAt ?? ''),
  )

  return candidates[0] ?? null
}

export default function AccessControlPanel({
  users,
  loading,
  error,
  onRefresh,
  onSendPasswordReset,
  showSummary = true,
}) {
  const [resetActions, setResetActions] = useState({})
  const summary = users.reduce(
    (accumulator, user) => {
      if (user.status === 'active') {
        accumulator.active += 1
      } else {
        accumulator.pending += 1
      }

      if (user.latestActivation?.deliveryStatus === 'failed') {
        accumulator.failed += 1
      }

      if (user.latestActivation?.deliveryStatus === 'sent') {
        accumulator.sent += 1
      }

      return accumulator
    },
    {
      active: 0,
      pending: 0,
      failed: 0,
      sent: 0,
    },
  )

  async function handleSendPasswordReset(user) {
    if (!onSendPasswordReset || user.status !== 'active') {
      return
    }

    setResetActions((current) => ({
      ...current,
      [user.id]: {
        loading: true,
        tone: 'neutral',
        message: 'Enviando reset...',
      },
    }))

    try {
      const payload = await onSendPasswordReset(user)
      setResetActions((current) => ({
        ...current,
        [user.id]: {
          loading: false,
          tone: payload.deliveryStatus === 'failed' ? 'risk' : 'good',
          message:
            payload.deliveryStatus === 'queued'
              ? 'Reset en outbox.'
              : payload.deliveryStatus === 'failed'
                ? 'Falló el envío del reset.'
                : `Reset enviado ${formatDateTimeValue(payload.deliveryAt)}.`,
        },
      }))
      onRefresh?.()
    } catch (requestError) {
      const code = requestError.payload?.error
      const message =
        code === 'ACCOUNT_NOT_ACTIVE'
          ? 'Solo aplica para usuarios activos.'
          : code === 'USER_NOT_FOUND'
            ? 'No encontré al usuario.'
            : 'No pude enviar el reset.'

      setResetActions((current) => ({
        ...current,
        [user.id]: {
          loading: false,
          tone: 'risk',
          message,
        },
      }))
    }
  }

  return (
    <section className="dashboard-grid dashboard-grid--admin" id="admin-panel">
      <article className="panel panel-main">
        <div className="panel-head panel-head--split">
          <div>
            <p className="eyebrow">Admin / accesos</p>
            <h2>Control de activacion y correo</h2>
          </div>
          <div className="panel-head-actions">
            <p>
              Vista operativa para revisar usuarios, ultima entrega de activacion y ultimo error
              SMTP sin abrir logs.
            </p>
            <button className="link-button" onClick={onRefresh} type="button">
              Refrescar
            </button>
          </div>
        </div>

        {showSummary ? (
          <div className="access-summary-grid">
            <article className="summary-card">
              <span>Usuarios activos</span>
              <strong>{summary.active}</strong>
              <p>Correos con acceso habilitado y password ya definido.</p>
            </article>
            <article className="summary-card">
              <span>Pendientes</span>
              <strong>{summary.pending}</strong>
              <p>Solicitudes capturadas que aun esperan activacion final.</p>
            </article>
            <article className="summary-card">
              <span>Correos enviados</span>
              <strong>{summary.sent}</strong>
              <p>Activaciones entregadas por transporte real en el ultimo corte visible.</p>
            </article>
            <article className="summary-card">
              <span>Fallos de entrega</span>
              <strong>{summary.failed}</strong>
              <p>Solicitudes registradas con ultimo intento SMTP fallido.</p>
            </article>
          </div>
        ) : null}

        {loading ? (
          <div className="loading-screen is-compact">
            <div className="loading-badge" />
            <p>Cargando trazabilidad de accesos...</p>
          </div>
        ) : error ? (
          <p className="login-error">{error}</p>
        ) : (
          <div className="table-wrap table-wrap--admin">
            <table className="state-table state-table--admin">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Estado</th>
                  <th>Ultima vista</th>
                  <th>Foco</th>
                  <th>Ultima presencia</th>
                  <th>Activacion</th>
                  <th>Reset password</th>
                  <th>Error visible</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const latestMailIssue = getLatestMailIssue(user)

                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.displayName || user.email}</strong>
                        <span>{user.email}</span>
                      </td>
                      <td>
                        <span className={`status-pill tone-${getLifecycleTone(user)}`}>
                          {getLifecycleLabel(user)}
                        </span>
                        <small className="status-note">
                          {user.role} · {user.requestCount} solicitud(es)
                        </small>
                      </td>
                      <td>
                        <span className={`status-pill tone-${getViewerTone(user)}`}>
                          {user.latestView?.routeLabel ?? 'Sin ruta'}
                        </span>
                        <small className="status-note">{getViewerLabel(user)}</small>
                      </td>
                      <td>
                        <strong>{user.latestView?.focusLabel ?? 'Sin vista registrada'}</strong>
                        <span className="table-inline-note">
                          {user.latestView?.detailLabel ?? 'Sin foco visible'}
                        </span>
                      </td>
                      <td>
                        <strong>{formatDateTimeValue(user.lastSeenAt)}</strong>
                        <span className="table-inline-note">
                          {user.views24h} vista(s) en 24h
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill tone-${getDeliveryTone(user.latestActivation)}`}
                        >
                          {getDeliveryLabel(user.latestActivation)}
                        </span>
                        <small className="status-note">
                          {user.latestActivation?.deliveryMode ?? 'sin transporte'} ·{' '}
                          {user.latestActivation?.deliveryAttempts ?? 0} intento(s)
                        </small>
                        <span className="table-inline-note">
                          {formatDateTimeValue(user.latestActivation?.lastDeliveryAttemptAt)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-pill tone-${getDeliveryTone(user.latestPasswordReset)}`}
                        >
                          {user.status !== 'active'
                            ? 'No habilitado'
                            : getDeliveryLabel(user.latestPasswordReset)}
                        </span>
                        <small className="status-note">
                          {user.status !== 'active'
                            ? 'Requiere acceso activo'
                            : `${user.latestPasswordReset?.deliveryMode ?? 'sin transporte'} · ${user.latestPasswordReset?.deliveryAttempts ?? 0} intento(s)`}
                        </small>
                        <span className="table-inline-note">
                          {formatDateTimeValue(user.latestPasswordReset?.lastDeliveryAttemptAt)}
                        </span>
                        {user.status === 'active' ? (
                          <div className="access-inline-actions">
                            <button
                              className="link-button"
                              disabled={resetActions[user.id]?.loading}
                              onClick={() => handleSendPasswordReset(user)}
                              type="button"
                            >
                              {resetActions[user.id]?.loading ? 'Enviando...' : 'Reenviar reset'}
                            </button>
                            {resetActions[user.id]?.message ? (
                              <span
                                className={
                                  resetActions[user.id]?.tone === 'risk'
                                    ? 'table-inline-note access-inline-note access-inline-note--risk'
                                    : 'table-inline-note access-inline-note'
                                }
                              >
                                {resetActions[user.id].message}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {latestMailIssue?.token?.lastDeliveryError?.message ? (
                          <>
                            <span className="access-error-copy">
                              {latestMailIssue.token.lastDeliveryError.message}
                            </span>
                            <span className="table-inline-note">
                              {latestMailIssue.source} ·{' '}
                              {formatDateTimeValue(latestMailIssue.token.lastDeliveryAttemptAt)}
                            </span>
                          </>
                        ) : (
                          'Sin error'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="table-footnote">
          La vista toma la ultima activacion y el ultimo reset por correo para cada usuario, con
          timestamp, modo de entrega e incidente SMTP persistido en `auth-store.json`.
        </p>
      </article>
    </section>
  )
}
