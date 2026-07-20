import AccessControlPanel from './AccessControlPanel'
import { formatDateTimeValue } from '../lib/format'
import PortalNavbar from './PortalNavbar'

function RouteBreakdownList({ items }) {
  if (!items.length) {
    return <p className="empty-copy">Sin vistas registradas en la ventana reciente.</p>
  }

  return (
    <div className="rule-stack">
      {items.map((item) => (
        <article className="rule-card" key={item.id}>
          <span>{item.label}</span>
          <strong>{item.count}</strong>
          <p>Ultima actividad visible: {formatDateTimeValue(item.lastAt)}</p>
        </article>
      ))}
    </div>
  )
}

function HotspotList({ items, title, emptyLabel }) {
  return (
    <article className="panel panel-side">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>Hotspots</h2>
        </div>
      </div>

      {items.length ? (
        <div className="rule-stack">
          {items.map((item) => (
            <article className="rule-card" key={item.id}>
              <strong>{item.label}</strong>
              <p>
                {item.count} vista(s) en 24h. Ultimo evento: {formatDateTimeValue(item.lastAt)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{emptyLabel}</p>
      )}
    </article>
  )
}

export default function AdminPage({
  error,
  loading,
  onNavigateDashboard,
  onNavigateDocs,
  onNavigateInvestment,
  onNavigateMethodology,
  onLogout,
  onRefresh,
  onSendPasswordReset,
  overview,
  session,
}) {
  const summary = overview?.summary ?? {
    usersTotal: 0,
    activeViewers: 0,
    uniqueViewers24h: 0,
    views24h: 0,
    dashboardViews24h: 0,
    docsViews24h: 0,
    methodologyViews24h: 0,
    adminViews24h: 0,
    passwordResetRequests24h: 0,
    passwordResetEmailsSent24h: 0,
    passwordResetEmailsFailed24h: 0,
    passwordResetCompleted24h: 0,
  }
  const users = overview?.users ?? []
  const routeBreakdown = overview?.routeBreakdown ?? []
  const recentActivity = overview?.recentActivity ?? []
  const topStates = overview?.topStates ?? []
  const topDocs = overview?.topDocs ?? []

  return (
    <main className="dashboard-shell dashboard-shell--docs">
      <PortalNavbar
        activeRoute="admin"
        onNavigateAdmin={() => {}}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDocs={onNavigateDocs}
        onNavigateInvestment={onNavigateInvestment}
        onNavigateMethodology={onNavigateMethodology}
        onLogout={onLogout}
        session={session}
      />

      <header className="page-hero page-hero--reader">
        <div className="page-hero-copy">
          <p className="eyebrow">Admin / atlas studio</p>
          <h1>Control de accesos y actividad</h1>
          <p className="page-hero-note">
            Vista operativa separada del dashboard para saber quien entra, que pantalla
            consume y que foco analitico estuvo viendo.
          </p>
        </div>
      </header>

      <section className="summary-strip">
        <article className="summary-card">
          <span>Viewers activos</span>
          <strong>{summary.activeViewers}</strong>
          <p>Usuarios con presencia visible en los ultimos 15 minutos.</p>
        </article>
        <article className="summary-card">
          <span>Viewers unicos 24h</span>
          <strong>{summary.uniqueViewers24h}</strong>
          <p>Correos que navegaron el portal en la ventana de 24 horas.</p>
        </article>
        <article className="summary-card">
          <span>Vistas 24h</span>
          <strong>{summary.views24h}</strong>
          <p>Eventos deduplicados de dashboard, docs, metodologia y admin.</p>
        </article>
        <article className="summary-card">
          <span>Comparativo 24h</span>
          <strong>{summary.dashboardViews24h}</strong>
          <p>Inspecciones operativas y cambios de foco sobre el tablero.</p>
        </article>
        <article className="summary-card">
          <span>Inversion 24h</span>
          <strong>{summary.investmentViews24h}</strong>
          <p>Lecturas detalladas de gasto estatal y mezcla por capitulo.</p>
        </article>
        <article className="summary-card">
          <span>Docs 24h</span>
          <strong>{summary.docsViews24h}</strong>
          <p>Lecturas recientes sobre arquitectura, datos y operacion.</p>
        </article>
        <article className="summary-card">
          <span>Metodologia 24h</span>
          <strong>{summary.methodologyViews24h}</strong>
          <p>Consumo reciente de scoring, fuentes y comparabilidad.</p>
        </article>
        <article className="summary-card">
          <span>Resets solicitados 24h</span>
          <strong>{summary.passwordResetRequests24h}</strong>
          <p>Solicitudes de cambio de password disparadas por usuario o admin.</p>
        </article>
        <article className="summary-card">
          <span>Resets entregados 24h</span>
          <strong>{summary.passwordResetEmailsSent24h}</strong>
          <p>Correos de restablecimiento efectivamente enviados.</p>
        </article>
        <article className="summary-card">
          <span>Resets fallidos 24h</span>
          <strong>{summary.passwordResetEmailsFailed24h}</strong>
          <p>Intentos de reset con falla SMTP visible para soporte.</p>
        </article>
        <article className="summary-card">
          <span>Resets completados 24h</span>
          <strong>{summary.passwordResetCompleted24h}</strong>
          <p>Cambios de password concluidos dentro de la ventana reciente.</p>
        </article>
      </section>

      <AccessControlPanel
        error={error}
        loading={loading}
        onRefresh={onRefresh}
        onSendPasswordReset={onSendPasswordReset}
        showSummary={false}
        users={users}
      />

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Actividad reciente</p>
              <h2>Quien vio que</h2>
            </div>
            <p>
              Feed reciente de vistas deduplicadas por ruta y foco. La presencia activa se
              calcula con ultima señal dentro de 15 minutos.
            </p>
          </div>

          {recentActivity.length ? (
            <div className="table-wrap table-wrap--activity">
              <table className="state-table state-table--activity">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Usuario</th>
                    <th>Ruta</th>
                    <th>Foco</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDateTimeValue(item.at)}</td>
                      <td>
                        <strong>{item.displayName}</strong>
                        <span>{item.email}</span>
                      </td>
                      <td>
                        <span className="status-pill tone-neutral">{item.routeLabel}</span>
                      </td>
                      <td>
                        <strong>{item.focusLabel}</strong>
                        <span className="table-inline-note">{item.detailLabel}</span>
                      </td>
                      <td>
                        <strong>{item.ip ?? 'Sin IP'}</strong>
                        <span className="table-inline-note">
                          {item.userAgent ? item.userAgent.slice(0, 64) : 'Sin user-agent'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-copy">Todavia no hay actividad reciente registrada.</p>
          )}
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Rutas 24h</p>
              <h2>Distribucion de consumo</h2>
            </div>
          </div>

          <RouteBreakdownList items={routeBreakdown} />
        </aside>
      </section>

      <section className="dashboard-grid">
        <HotspotList
          emptyLabel="Nadie ha fijado foco en un estado especifico en la ventana reciente."
          items={topStates}
          title="Estados mas vistos"
        />
        <HotspotList
          emptyLabel="No hay documentos con lectura reciente todavia."
          items={topDocs}
          title="Docs mas leidos"
        />
      </section>
    </main>
  )
}
