import MethodologyWeightChart from './charts/MethodologyWeightChart'
import PipelineFlowChart from './charts/PipelineFlowChart'
import PortalNavbar from './PortalNavbar'

export default function MethodologyPage({
  onNavigateDashboard,
  onNavigateAdmin,
  onNavigateInvestment,
  onNavigateDocs,
  onLogout,
  overview,
  session,
}) {
  return (
    <main className="dashboard-shell dashboard-shell--docs">
      <PortalNavbar
        activeRoute="methodology"
        onNavigateAdmin={onNavigateAdmin}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDocs={onNavigateDocs}
        onNavigateInvestment={onNavigateInvestment}
        onNavigateMethodology={() => {}}
        onLogout={onLogout}
        session={session}
      />

      <header className="page-hero page-hero--reader">
        <div className="page-hero-copy">
          <p className="eyebrow">Metodologia / atlas estatal</p>
          <h1>Metodologia y fuentes</h1>
          <p className="page-hero-note">
            Capa de lectura tecnica para scoring, pipeline, comparabilidad y presupuesto
            sin inflar el tablero principal.
          </p>
        </div>
      </header>

      <section className="summary-strip">
        {overview.methodology.map((item) => (
          <article className="summary-card" key={item}>
            <span>Principio</span>
            <strong>Metodo</strong>
            <p>{item}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-stack">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Scoring</p>
              <h2>Pesos del atlas</h2>
            </div>
            <p>
              El ranking principal ya integra resultado operativo y capacidad
              presupuestal, pero ambas capas siguen auditables por separado.
            </p>
          </div>

          <article className="rule-card">
            <strong>Atlas score</strong>
            <p>
              Integra el score operativo con gasto per capita, bolsa ejercida y peso
              tecnologico para que el ranking principal no esconda la inversion.
            </p>
          </article>
          <MethodologyWeightChart weights={overview.atlasWeights} />

          <article className="rule-card">
            <strong>Score operativo</strong>
            <p>
              Mantiene la logica original de incidencia para leer presion delictiva
              sin mezclarla directamente con presupuesto.
            </p>
          </article>
          <MethodologyWeightChart weights={overview.operationalWeights} />
        </article>

        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Pipeline</p>
              <h2>Del dato al tablero</h2>
            </div>
            <p>
              El dashboard no lee dumps crudos en runtime. La ingestion deja un
              agregado estatal limpio y listo para API.
            </p>
          </div>
          <PipelineFlowChart steps={overview.pipeline} />
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Fuentes</p>
              <h2>Matriz de uso</h2>
            </div>
            <p>
              La capa de score y la capa presupuestal usan fuentes oficiales
              cableadas. Lo no integrado se documenta de forma explicita para no
              volver caja negra el producto.
            </p>
          </div>

          <div className="source-table">
            <div className="source-row source-row--head">
              <span>Fuente</span>
              <span>Cobertura</span>
              <span>Frecuencia</span>
              <span>Sirve para</span>
              <span>URL</span>
            </div>
            {overview.sources.map((source) => (
              <div className="source-row" key={source.id}>
                <strong>{source.name}</strong>
                <span>{source.coverage}</span>
                <span>{source.cadence}</span>
                <span>{source.bestFor}</span>
                <a href={source.url} rel="noreferrer" target="_blank">
                  Abrir fuente
                </a>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Principios visuales</p>
              <h2>Reglas de producto</h2>
            </div>
          </div>

          <div className="rule-stack">
            {overview.visualPrinciples.map((principle) => (
              <article className="rule-card" key={principle.title}>
                <strong>{principle.title}</strong>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Chart fit</p>
              <h2>Que vista responde que pregunta</h2>
            </div>
            <p>
              El tablero escoge visualizacion por pregunta analitica: comparar,
              ordenar, seguir trayectoria y auditar cifras.
            </p>
          </div>

          <div className="guide-grid">
            {overview.chartGuide.map((item) => (
              <article className="guide-card" key={item.question}>
                <span>{item.chart}</span>
                <strong>{item.question}</strong>
                <p>{item.why}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Reglas duras</p>
              <h2>Comparabilidad</h2>
            </div>
          </div>

          <div className="rule-stack">
            <article className="rule-card">
              <strong>Tasas antes que conteos</strong>
              <p>La lectura comparativa se hace con tasas por 100 mil habitantes.</p>
            </article>
            <article className="rule-card">
              <strong>Corte visible</strong>
              <p>Cada build expone fecha de generacion y fuentes exactas consumidas.</p>
            </article>
            <article className="rule-card">
              <strong>Score auditado</strong>
              <p>El atlas score ordena, pero nunca sustituye la lectura por dimension y por partida comparable.</p>
            </article>
            <article className="rule-card">
              <strong>Dashboard primero</strong>
              <p>La herramienta privilegia densidad analitica arriba del fold y no scrollytelling.</p>
            </article>
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Presupuesto</p>
              <h2>{overview.budgetLayer.title}</h2>
            </div>
            <p>{overview.budgetLayer.body}</p>
          </div>

          <div className="source-table source-table--budget">
            <div className="source-row source-row--head source-row--budget">
              <span>Fuente</span>
              <span>Granularidad</span>
              <span>Uso</span>
              <span>Status</span>
              <span>URL</span>
            </div>
            {overview.budgetLayer.sources.map((source) => (
              <div className="source-row source-row--budget" key={source.id}>
                <strong>{source.name}</strong>
                <span>{source.granularity}</span>
                <span>{source.use}</span>
                <span>{source.status}</span>
                <a href={source.url} rel="noreferrer" target="_blank">
                  Abrir fuente
                </a>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Gasto comparable</p>
              <h2>Reglas de lectura</h2>
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
        </aside>
      </section>
    </main>
  )
}
