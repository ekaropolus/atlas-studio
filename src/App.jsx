import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import ActivationPage from './components/ActivationPage'
import AdminPage from './components/AdminPage'
import BudgetTable from './components/BudgetTable'
import DocsPage from './components/DocsPage'
import DriverBarChart from './components/charts/DriverBarChart'
import InvestmentDashboardPage from './components/InvestmentDashboardPage'
import LoginPage from './components/LoginPage'
import MethodologyPage from './components/MethodologyPage'
import PortalNavbar from './components/PortalNavbar'
import PasswordResetPage from './components/PasswordResetPage'
import BudgetCompositionChart from './components/charts/BudgetCompositionChart'
import StateMatrixChart from './components/charts/StateMatrixChart'
import StateRankingChart from './components/charts/StateRankingChart'
import StateTrendChart from './components/charts/StateTrendChart'
import StatesTable from './components/StatesTable'
import { docsLibrary } from './content/docs'
import { api } from './lib/api'
import { formatCurrencyValue, formatMetricValue, formatPercentValue } from './lib/format'

function LoadingScreen({ label, compact = false }) {
  return (
    <div className={compact ? 'loading-screen is-compact' : 'loading-screen'}>
      <div className="loading-badge" />
      <p>{label}</p>
    </div>
  )
}

function readRoute(pathname, search) {
  if (pathname.startsWith('/activar')) {
    const params = new URLSearchParams(search)
    return {
      name: 'activate',
      docId: null,
      token: params.get('token') ?? '',
    }
  }

  if (pathname.startsWith('/restablecer')) {
    const params = new URLSearchParams(search)
    return {
      name: 'reset',
      docId: null,
      token: params.get('token') ?? '',
    }
  }

  if (pathname.startsWith('/metodologia')) {
    return { name: 'methodology', docId: null, token: '' }
  }

  if (pathname.startsWith('/inversion')) {
    return { name: 'investment', docId: null, token: '' }
  }

  if (pathname.startsWith('/docs')) {
    const params = new URLSearchParams(search)
    return {
      name: 'docs',
      docId: params.get('doc') ?? docsLibrary[0]?.id ?? 'overview',
      token: '',
    }
  }

  if (pathname.startsWith('/admin')) {
    return { name: 'admin', docId: null, token: '' }
  }

  return { name: 'dashboard', docId: null, token: '' }
}

function matchesState(state, query) {
  if (!query) {
    return true
  }

  const haystack = `${state.name} ${state.region}`.toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function sortStates(states, metric) {
  const sortValue = (value) =>
    Number.isFinite(value)
      ? value
      : metric.higherIsBetter
        ? Number.NEGATIVE_INFINITY
        : Number.POSITIVE_INFINITY

  return [...states].sort((left, right) =>
    metric.higherIsBetter
      ? sortValue(right[metric.id]) - sortValue(left[metric.id])
      : sortValue(left[metric.id]) - sortValue(right[metric.id]),
  )
}

export default function App() {
  const initialRoute = readRoute(window.location.pathname, window.location.search)

  const [route, setRoute] = useState(initialRoute.name)
  const [activeDocId, setActiveDocId] = useState(initialRoute.docId ?? docsLibrary[0]?.id ?? 'overview')
  const [routeToken, setRouteToken] = useState(initialRoute.token ?? '')
  const [session, setSession] = useState(null)
  const [authConfig, setAuthConfig] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [overview, setOverview] = useState(null)
  const [stateDetail, setStateDetail] = useState(null)
  const [activeMetricId, setActiveMetricId] = useState('score')
  const [activeBudgetMetricId, setActiveBudgetMetricId] = useState('budgetPerCapita')
  const [selectedStateId, setSelectedStateId] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [stateLoading, setStateLoading] = useState(false)
  const [error, setError] = useState('')
  const [adminOverview, setAdminOverview] = useState(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState('')

  const deferredMetricId = useDeferredValue(activeMetricId)
  const deferredSearchValue = useDeferredValue(searchValue)

  useEffect(() => {
    function syncRoute() {
      const nextRoute = readRoute(window.location.pathname, window.location.search)
      setRoute(nextRoute.name)
      setRouteToken(nextRoute.token ?? '')
      if (nextRoute.docId) {
        setActiveDocId(nextRoute.docId)
      }
    }

    window.addEventListener('popstate', syncRoute)

    return () => {
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  function navigate(nextRoute, options = {}) {
    const nextPath =
      nextRoute === 'methodology'
        ? '/metodologia'
        : nextRoute === 'investment'
          ? '/inversion'
        : nextRoute === 'docs'
          ? '/docs'
          : nextRoute === 'admin'
            ? '/admin'
            : nextRoute === 'activate'
            ? '/activar'
            : nextRoute === 'reset'
              ? '/restablecer'
              : '/'
    const search =
      nextRoute === 'docs' && options.docId
        ? `?doc=${options.docId}`
        : (nextRoute === 'activate' || nextRoute === 'reset') && options.token
          ? `?token=${encodeURIComponent(options.token)}`
          : ''
    const nextUrl = `${nextPath}${search}`

    if (`${window.location.pathname}${window.location.search}` === nextUrl) {
      return
    }

    window.history.pushState({}, '', nextUrl)
    setRoute(nextRoute)
    setRouteToken(options.token ?? '')
    if (nextRoute === 'docs') {
      setActiveDocId(options.docId ?? docsLibrary[0]?.id ?? 'overview')
    }
  }

  function openAdminPage() {
    navigate('admin')
  }

  useEffect(() => {
    let ignore = false

    async function loadAuthBootstrap() {
      setAuthLoading(true)

      try {
        const [configResult, sessionResult] = await Promise.allSettled([
          api.getAuthConfig(),
          api.getSession(),
        ])

        if (!ignore && configResult.status === 'fulfilled') {
          setAuthConfig(configResult.value)
        }

        if (ignore) {
          return
        }

        if (sessionResult.status === 'fulfilled') {
          setSession(sessionResult.value.user)
          setAuthError('')
          return
        }

        const requestError = sessionResult.reason
        if (requestError?.status === 401) {
          setSession(null)
        } else {
          setAuthError('No pude validar la sesion.')
        }
      } catch (requestError) {
        if (!ignore) {
          setAuthError('No pude validar la sesion.')
        }
      } finally {
        if (!ignore) {
          setAuthLoading(false)
        }
      }
    }

    loadAuthBootstrap()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setOverview(null)
      setStateDetail(null)
      setSelectedStateId('')
      setAdminOverview(null)
      setAdminError('')
      return undefined
    }

    let ignore = false

    async function loadStudy() {
      setLoading(true)

      try {
        const payload = await api.getStudy()
        if (ignore) {
          return
        }

        setOverview(payload)
        setError('')
        startTransition(() => {
          setSelectedStateId((currentStateId) => currentStateId || payload.defaultStateId)
          setActiveMetricId((currentMetricId) => currentMetricId || payload.dimensions[0]?.id || 'score')
          setActiveBudgetMetricId(
            (currentMetricId) => currentMetricId || payload.budgetLayer?.defaultMetricId || 'budgetPerCapita',
          )
        })
      } catch (requestError) {
        if (!ignore) {
          if (requestError.status === 401) {
            setSession(null)
            setAuthError('La sesion expiro. Entra otra vez.')
          } else {
            setError('No pude cargar el tablero.')
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadStudy()

    return () => {
      ignore = true
    }
  }, [session])

  async function refreshAdminOverview() {
    if (session?.role !== 'admin') {
      return
    }

    setAdminLoading(true)
    setAdminError('')

    try {
      const payload = await api.getAdminOverview()
      setAdminOverview(payload)
    } catch (requestError) {
      if (requestError.status === 401) {
        setSession(null)
        setAuthError('La sesion expiro. Entra otra vez.')
        return
      }

      if (requestError.status === 403) {
        setAdminOverview(null)
        setAdminError('Tu sesion no tiene permisos de admin para ver accesos.')
        return
      }

      setAdminError('No pude cargar la trazabilidad de accesos.')
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    if (session?.role !== 'admin' || route !== 'admin') {
      setAdminOverview(null)
      setAdminError('')
      return undefined
    }

    let ignore = false

    async function loadAdminOverview() {
      setAdminLoading(true)
      setAdminError('')

      try {
        const payload = await api.getAdminOverview()
        if (ignore) {
          return
        }

        setAdminOverview(payload)
      } catch (requestError) {
        if (ignore) {
          return
        }

        if (requestError.status === 401) {
          setSession(null)
          setAuthError('La sesion expiro. Entra otra vez.')
          return
        }

        if (requestError.status === 403) {
          setAdminOverview(null)
          setAdminError('Tu sesion no tiene permisos de admin para ver accesos.')
          return
        }

        setAdminError('No pude cargar la trazabilidad de accesos.')
      } finally {
        if (!ignore) {
          setAdminLoading(false)
        }
      }
    }

    loadAdminOverview()

    return () => {
      ignore = true
    }
  }, [route, session])

  useEffect(() => {
    if (!session) {
      return undefined
    }

    const activeDoc = docsLibrary.find((doc) => doc.id === activeDocId) ?? docsLibrary[0]
    let payload = null

    if (route === 'dashboard') {
      if (!overview) {
        return undefined
      }

      const activeStateForTrack =
        overview.states.find((state) => state.id === selectedStateId) ?? overview.states[0] ?? null
      const activeMetricForTrack =
        overview.dimensions.find((dimension) => dimension.id === activeMetricId) ??
        overview.dimensions[0] ??
        null

      payload = {
        route: 'dashboard',
        stateId: activeStateForTrack?.id ?? null,
        stateName: activeStateForTrack?.name ?? null,
        metricId: activeMetricForTrack?.id ?? null,
        metricLabel: activeMetricForTrack?.label ?? null,
      }
    }

    if (route === 'investment') {
      if (!overview) {
        return undefined
      }

      const activeStateForTrack =
        overview.budgetLayer.states.find((state) => state.id === selectedStateId) ??
        overview.budgetLayer.states[0] ??
        null
      const activeMetricForTrack =
        overview.budgetLayer.metrics.find((metric) => metric.id === activeBudgetMetricId) ??
        overview.budgetLayer.metrics[0] ??
        null

      payload = {
        route: 'investment',
        stateId: activeStateForTrack?.id ?? null,
        stateName: activeStateForTrack?.name ?? null,
        metricId: activeMetricForTrack?.id ?? null,
        metricLabel: activeMetricForTrack?.label ?? null,
      }
    }

    if (route === 'docs') {
      payload = {
        route: 'docs',
        docId: activeDoc?.id ?? null,
        docTitle: activeDoc?.title ?? null,
      }
    }

    if (route === 'methodology') {
      payload = {
        route: 'methodology',
      }
    }

    if (route === 'admin' && session.role === 'admin') {
      payload = {
        route: 'admin',
      }
    }

    if (!payload) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      api.trackPortalView(payload).catch(() => {})
    }, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [session, route, activeDocId, overview, selectedStateId, activeMetricId, activeBudgetMetricId])

  useEffect(() => {
    if (!session || !selectedStateId) {
      return undefined
    }

    let ignore = false

    async function loadState() {
      setStateLoading(true)

      try {
        const payload = await api.getStateDetail(selectedStateId)
        if (ignore) {
          return
        }

        setStateDetail(payload)
        setError('')
      } catch (requestError) {
        if (!ignore) {
          if (requestError.status === 401) {
            setSession(null)
            setAuthError('La sesion expiro. Entra otra vez.')
          } else {
            setError('No pude cargar el detalle del estado.')
          }
        }
      } finally {
        if (!ignore) {
          setStateLoading(false)
        }
      }
    }

    loadState()

    return () => {
      ignore = true
    }
  }, [selectedStateId, session])

  async function handleLogin(credentials) {
    setLoginLoading(true)
    setAuthError('')

    try {
      const payload = await api.login(credentials)
      setSession(payload.user)
      navigate('dashboard')
    } catch (requestError) {
      setAuthError(
        requestError.payload?.error === 'ACCOUNT_NOT_ACTIVE'
          ? 'Tu correo aun no esta activado. Revisa el enlace o solicita acceso.'
          : requestError.status === 401
            ? 'Correo o password incorrectos.'
            : 'No pude iniciar sesion.',
      )
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRequestAccess(payload) {
    return api.requestAccess(payload)
  }

  async function handleRequestPasswordReset(payload) {
    return api.requestPasswordReset(payload)
  }

  async function handleSendPasswordReset(user) {
    return api.sendPasswordResetForUser(user.id)
  }

  function handleActivated(user) {
    setSession(user)
    setAuthError('')
    navigate('dashboard')
  }

  function handlePasswordReset(user) {
    setSession(user)
    setAuthError('')
    navigate('dashboard')
  }

  async function handleLogout() {
    try {
      await api.logout()
    } finally {
      setSession(null)
      setOverview(null)
      setStateDetail(null)
      setSelectedStateId('')
      setError('')
      setAuthError('')
      navigate('dashboard')
    }
  }

  if (authLoading) {
    return (
      <main className="dashboard-shell">
        <LoadingScreen label="Validando acceso..." />
      </main>
    )
  }

  if (route === 'activate') {
    return (
      <ActivationPage
        initialToken={routeToken}
        onActivated={handleActivated}
        onNavigateLogin={() => navigate('dashboard')}
      />
    )
  }

  if (route === 'reset') {
    return (
      <PasswordResetPage
        initialToken={routeToken}
        onNavigateLogin={() => navigate('dashboard')}
        onPasswordReset={handlePasswordReset}
      />
    )
  }

  if (!session) {
    return (
      <LoginPage
        authConfig={authConfig}
        error={authError}
        loading={loginLoading}
        onRequestAccess={handleRequestAccess}
        onRequestPasswordReset={handleRequestPasswordReset}
        onSubmit={handleLogin}
      />
    )
  }

  if (loading || !overview) {
    return (
      <main className="dashboard-shell">
        <LoadingScreen label={error || 'Cargando atlas...'} />
      </main>
    )
  }

  const activeMetric =
    overview.dimensions.find((dimension) => dimension.id === deferredMetricId) ??
    overview.dimensions[0]
  const activeBudgetMetric =
    overview.budgetLayer.metrics.find((metric) => metric.id === activeBudgetMetricId) ??
    overview.budgetLayer.metrics[0]

  const filteredStates = sortStates(
    overview.states.filter((state) => matchesState(state, deferredSearchValue)),
    activeMetric,
  )
  const filteredBudgetStates = sortStates(
    overview.budgetLayer.states.filter((state) => matchesState(state, deferredSearchValue)),
    activeBudgetMetric,
  )

  const matrixMetrics = overview.matrixDimensionIds
    .map((metricId) => overview.dimensions.find((dimension) => dimension.id === metricId))
    .filter(Boolean)
  const tableColumns = overview.tableDimensionIds
    .map((metricId) => overview.dimensions.find((dimension) => dimension.id === metricId))
    .filter(Boolean)
  const activeStateSummary =
    overview.states.find((state) => state.id === selectedStateId) ??
    filteredStates[0] ??
    overview.states[0]
  const activeState = stateDetail?.state ?? activeStateSummary
  const activeBudgetStateSummary =
    overview.budgetLayer.states.find((state) => state.id === selectedStateId) ??
    filteredBudgetStates[0] ??
    overview.budgetLayer.states[0]
  const activeBudgetState = stateDetail?.budget ?? activeBudgetStateSummary
  const activeTrendMetric =
    (activeMetric?.hasMonthly ? activeMetric : null) ??
    overview.dimensions.find((dimension) => dimension.id === overview.defaultTrendMetricId) ??
    overview.dimensions.find((dimension) => dimension.hasMonthly) ??
    activeMetric

  if (route === 'methodology') {
    return (
      <MethodologyPage
        onNavigateAdmin={openAdminPage}
        onNavigateDashboard={() => navigate('dashboard')}
        onNavigateInvestment={() => navigate('investment')}
        onNavigateDocs={() => navigate('docs', { docId: activeDocId })}
        onLogout={handleLogout}
        overview={overview}
        session={session}
      />
    )
  }

  if (route === 'docs') {
    return (
      <DocsPage
        activeDocId={activeDocId}
        docs={docsLibrary}
        onNavigateAdmin={openAdminPage}
        onNavigateDashboard={() => navigate('dashboard')}
        onNavigateInvestment={() => navigate('investment')}
        onNavigateMethodology={() => navigate('methodology')}
        onOpenDoc={(docId) => navigate('docs', { docId })}
        onLogout={handleLogout}
        session={session}
      />
    )
  }

  if (route === 'admin' && session.role === 'admin') {
    return (
      <AdminPage
        error={adminError}
        loading={adminLoading}
        onNavigateDashboard={() => navigate('dashboard')}
        onNavigateDocs={() => navigate('docs', { docId: activeDocId })}
        onNavigateInvestment={() => navigate('investment')}
        onNavigateMethodology={() => navigate('methodology')}
        onLogout={handleLogout}
        onRefresh={refreshAdminOverview}
        onSendPasswordReset={handleSendPasswordReset}
        overview={adminOverview}
        session={session}
      />
    )
  }

  if (route === 'investment') {
    return (
      <InvestmentDashboardPage
        activeBudgetMetric={activeBudgetMetric}
        activeBudgetState={activeBudgetState}
        filteredBudgetStates={filteredBudgetStates}
        onNavigateAdmin={openAdminPage}
        onNavigateDashboard={() => navigate('dashboard')}
        onNavigateDocs={() => navigate('docs', { docId: activeDocId })}
        onNavigateMethodology={() => navigate('methodology')}
        onLogout={handleLogout}
        onSearchChange={setSearchValue}
        onSelectState={(stateId) => {
          startTransition(() => {
            setSelectedStateId(stateId)
          })
        }}
        onSetActiveBudgetMetricId={setActiveBudgetMetricId}
        overview={overview}
        searchValue={searchValue}
        selectedStateId={selectedStateId}
        session={session}
        stateLoading={stateLoading}
      />
    )
  }

  return (
    <main className="dashboard-shell dashboard-shell--docs">
      <PortalNavbar
        activeRoute="dashboard"
        onNavigateAdmin={openAdminPage}
        onNavigateDashboard={() => navigate('dashboard')}
        onNavigateDocs={() => navigate('docs', { docId: activeDocId })}
        onNavigateInvestment={() => navigate('investment')}
        onNavigateMethodology={() => navigate('methodology')}
        onLogout={handleLogout}
        session={session}
      />

      <header className="page-hero page-hero--dashboard">
        <div className="page-hero-copy">
          <p className="eyebrow">Seguridad publica comparada / Mexico</p>
          <h1>Atlas comparativo estatal 2025</h1>
          <p className="page-hero-note">{overview.subtitle}</p>
        </div>

        <div className="page-hero-actions">
          <label className="search-box">
            <span>Buscar estado o region</span>
            <input
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Yucatan, Bajio, Frontera..."
              type="search"
              value={searchValue}
            />
          </label>

          <div className="hero-kicker-grid">
            <article className="hero-kicker">
              <span>Vista 1</span>
              <strong>Comparativo</strong>
              <p>Riesgo operativo e inversion integrados en un mismo ranking nacional.</p>
            </article>
            <article className="hero-kicker">
              <span>Vista 2</span>
              <strong>Inversion</strong>
              <p>Superficie separada para leer gasto estatal con mucho mas detalle.</p>
            </article>
          </div>
        </div>
      </header>

      <section className="summary-strip">
        {overview.summaryCards.map((card) => (
          <article className="summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.note}</p>
          </article>
        ))}

        <article className="summary-card summary-card--source">
          <span>Corte integrado</span>
          <strong>{overview.lastUpdated}</strong>
          <p>
            SESNSP 2025 para resultado operativo y CNSPE 2025 con ejercicio 2024 para
            presupuesto estatal comparable.
          </p>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--primary">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Vista nacional</p>
              <h2>Matriz estatal</h2>
            </div>
            <p>{activeMetric.description}</p>
          </div>

          <div className="metric-tabs">
            {overview.dimensions.map((dimension) => (
              <button
                className={dimension.id === activeMetric.id ? 'metric-tab is-active' : 'metric-tab'}
                key={dimension.id}
                onClick={() => {
                  startTransition(() => {
                    setActiveMetricId(dimension.id)
                  })
                }}
                type="button"
              >
                {dimension.shortLabel}
              </button>
            ))}
          </div>

          {filteredStates.length ? (
            <StateMatrixChart
              data={filteredStates}
              metrics={matrixMetrics}
              onSelectState={(stateId) => {
                startTransition(() => {
                  setSelectedStateId(stateId)
                })
              }}
              selectedStateId={selectedStateId}
            />
          ) : (
            <div className="empty-panel">
              <p>No hay estados para ese filtro.</p>
            </div>
          )}
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Estado seleccionado</p>
              <h2>{activeState.name}</h2>
            </div>
            <p>{activeState.region}</p>
          </div>

          {stateLoading ? <LoadingScreen compact label="Actualizando estado..." /> : null}

          <p className="state-copy">{activeState.lede}</p>
          <p className="state-copy state-copy--muted">{activeState.caution}</p>

          <div className="metric-grid">
            {activeState.metricCards?.slice(0, 6).map((card) => (
              <article className={`metric-card tone-${card.benchmarkTone}`} key={card.id}>
                <span>{card.label}</span>
                <strong>{card.displayValue}</strong>
                <small>Rank #{card.rank}</small>
              </article>
            ))}
          </div>

          <div className="comparison-list">
            {activeState.comparisons?.map((item) => (
              <article className={`comparison-chip tone-${item.tone}`} key={item.id}>
                <span>{item.label}</span>
                <strong>{item.displayValue}</strong>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Orden nacional</p>
              <h2>Ranking por dimension</h2>
            </div>
            <p>
              {filteredStates.length} estados visibles. El ranking principal ya integra
              operacion y presupuesto en una misma lectura.
            </p>
          </div>

          {filteredStates.length ? (
            <StateRankingChart
              data={filteredStates}
              metric={activeMetric}
              onSelectState={(stateId) => {
                startTransition(() => {
                  setSelectedStateId(stateId)
                })
              }}
              selectedStateId={selectedStateId}
            />
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Pulso mensual</p>
              <h2>{activeState.name} vs promedio nacional</h2>
            </div>
            <p>
              {activeMetric.hasMonthly
                ? `Serie 2025 de ${activeMetric.label.toLowerCase()} para leer aceleracion y distancia relativa.`
                : `La metrica seleccionada es anual. Para el pulso se muestra ${activeTrendMetric.label.toLowerCase()} con serie mensual 2025.`}
            </p>
          </div>

          {activeState.monthly ? (
            <StateTrendChart
              metric={activeTrendMetric}
              nationalMonthly={overview.nationalMonthly}
              selectedMonthly={activeState.monthly}
              stateName={activeState.name}
            />
          ) : (
            <LoadingScreen compact label="Preparando serie..." />
          )}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Auditoria numerica</p>
              <h2>Tabla estatal</h2>
            </div>
            <p>
              Cifras exactas, rank activo y presupuesto visible sin abrir otra vista.
            </p>
          </div>

          <StatesTable
            activeMetricId={activeMetric.id}
            columns={tableColumns}
            data={filteredStates}
            onSelectState={(stateId) => {
              startTransition(() => {
                setSelectedStateId(stateId)
              })
            }}
            selectedStateId={selectedStateId}
          />
        </article>

        <article className="panel panel-stack">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Explicabilidad</p>
              <h2>Drivers del atlas score</h2>
            </div>
            <p>
              El tablero separa presion operativa y capacidad financiera para que el
              ranking no se vuelva caja negra.
            </p>
          </div>

          {activeState.drivers ? (
            <DriverBarChart
              drivers={activeState.drivers}
              title={`Drivers del estado ${activeState.name}`}
            />
          ) : (
            <LoadingScreen compact label="Calculando drivers..." />
          )}

          <div className="meta-panel">
            <span>Cobertura nacional</span>
            <strong>{formatMetricValue(overview.benchmarks.population, 'population')}</strong>
            <p>
              Habitantes cubiertos por el corte actual. El cierre mensual nacional de{' '}
              {activeTrendMetric.label.toLowerCase()} queda en{' '}
              {formatMetricValue(
                overview.nationalMonthly.at(-1)?.[activeTrendMetric.id] ?? 0,
                activeTrendMetric.id,
              )}
              .
            </p>
            <div className="meta-actions">
              <button className="link-button" onClick={() => navigate('methodology')} type="button">
                Abrir metodologia
              </button>
              <button
                className="link-button"
                onClick={() => navigate('docs', { docId: 'commercial-overview' })}
                type="button"
              >
                Ver posicionamiento comercial
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Composicion presupuestal</p>
              <h2>{activeBudgetState.name} vs mezcla nacional</h2>
            </div>
            <p>
              El detalle por capitulo sigue separado para auditoria, pero ahora alimenta
              la lectura principal del portal.
            </p>
          </div>

          <BudgetCompositionChart
            budgetBenchmarks={overview.budgetLayer.benchmarks}
            chapters={activeBudgetState.chapters}
            stateName={activeBudgetState.name}
          />
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Lectura rapida</p>
              <h2>Fondos y calidad</h2>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card metric-card--neutral">
              <span>Ejercido</span>
              <strong>{formatCurrencyValue(activeBudgetState.budgetExercised)}</strong>
              <small>Rank #{activeBudgetState.ranks?.budgetExercised}</small>
            </article>
            <article className="metric-card metric-card--neutral">
              <span>Per capita</span>
              <strong>{formatMetricValue(activeBudgetState.budgetPerCapita, 'budgetPerCapita')}</strong>
              <small>Rank #{activeBudgetState.ranks?.budgetPerCapita}</small>
            </article>
            <article className="metric-card metric-card--neutral">
              <span>Fondos federales</span>
              <strong>{formatCurrencyValue(activeBudgetState.federalFundsTotal)}</strong>
              <small>{formatPercentValue(activeBudgetState.federalFundsShare)} del ejercido</small>
            </article>
            <article className="metric-card metric-card--neutral">
              <span>Plataformas</span>
              <strong>{formatCurrencyValue(activeBudgetState.techPlatformSpend)}</strong>
              <small>{formatPercentValue(activeBudgetState.techPlatformShare)} del ejercido</small>
            </article>
          </div>

          <div className="rule-stack">
            <article className="rule-card">
              <strong>Capitulo dominante</strong>
              <p>
                {activeBudgetState.topChapterLabel
                  ? `${activeBudgetState.topChapterCode} ${activeBudgetState.topChapterLabel}: ${formatPercentValue(activeBudgetState.topChapterShare)} del ejercido.`
                  : 'Sin capitulo dominante visible.'}
              </p>
            </article>
            <article className="rule-card">
              <strong>Comparacion rapida</strong>
              <p>{activeBudgetState.comparisons?.[0]?.displayValue ?? 'Sin comparacion disponible'}</p>
            </article>
          </div>

          {activeBudgetState.qualityNotes?.length ? (
            <div className="rule-stack">
              {activeBudgetState.qualityNotes.map((note) => (
                <article className="rule-card" key={note}>
                  <strong>Quality flag</strong>
                  <p>{note}</p>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Auditoria presupuestal</p>
              <h2>Tabla por capitulo</h2>
            </div>
            <p>
              Exactos por entidad, shares y montos auditables sin salir del portal.
            </p>
          </div>

          <div className="metric-tabs">
            {overview.budgetLayer.metrics.map((metric) => (
              <button
                className={metric.id === activeBudgetMetric.id ? 'metric-tab is-active' : 'metric-tab'}
                key={metric.id}
                onClick={() => setActiveBudgetMetricId(metric.id)}
                type="button"
              >
                {metric.shortLabel}
              </button>
            ))}
          </div>

          <BudgetTable
            activeMetricId={activeBudgetMetric.id}
            chapters={overview.budgetLayer.chapters}
            data={filteredBudgetStates}
            onSelectState={(stateId) => {
              startTransition(() => {
                setSelectedStateId(stateId)
              })
            }}
            selectedStateId={selectedStateId}
          />
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Fuente y reglas</p>
              <h2>Como leerla</h2>
            </div>
          </div>

          <div className="rule-stack">
            {overview.budgetLayer.rules.map((rule) => (
              <article className="rule-card" key={rule.title}>
                <strong>{rule.title}</strong>
                <p>{rule.body}</p>
              </article>
            ))}
          </div>

          <div className="meta-panel">
            <span>CNSPE 2025</span>
            <strong>{overview.budgetLayer.updatedAt}</strong>
            <p>
              Datos presupuestales 2024 por entidad, con capitulos 1000-9000, fondos
              federales y plataformas tecnologicas.
            </p>
            <div className="meta-actions">
              <button className="link-button" onClick={() => navigate('methodology')} type="button">
                Abrir metodologia
              </button>
              <button
                className="link-button"
                onClick={() => navigate('docs', { docId: 'security-spending' })}
                type="button"
              >
                Ver documentacion tecnica
              </button>
            </div>
          </div>
        </aside>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}
    </main>
  )
}
