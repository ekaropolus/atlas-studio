import { useEffect, useMemo, useState } from 'react'
import BudgetChapterDetailTable from './BudgetChapterDetailTable'
import BudgetFineConceptTable from './BudgetFineConceptTable'
import BudgetSourceTable from './BudgetSourceTable'
import BudgetTable from './BudgetTable'
import PortalNavbar from './PortalNavbar'
import BudgetChapterDeltaChart from './charts/BudgetChapterDeltaChart'
import BudgetFineConceptChart from './charts/BudgetFineConceptChart'
import BudgetChapterHeatmapChart from './charts/BudgetChapterHeatmapChart'
import BudgetCompositionChart from './charts/BudgetCompositionChart'
import StateRankingChart from './charts/StateRankingChart'
import { formatCurrencyValue, formatMetricValue, formatPercentValue } from '../lib/format'
import { buildBudgetChapterRows, buildBudgetSourceRows } from '../lib/budget'

function InlineLoading({ label }) {
  return (
    <div className="loading-screen is-compact">
      <div className="loading-badge" />
      <p>{label}</p>
    </div>
  )
}

function HelpPopover({ body, title }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="help-popover">
      <button
        aria-expanded={isOpen}
        className={isOpen ? 'help-popover-button is-active' : 'help-popover-button'}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {title}
      </button>
      {isOpen ? (
        <div className="help-popover-card">
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
      ) : null}
    </div>
  )
}

function GuideModal({ onClose, onOpenSection, steps }) {
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <section
        aria-labelledby="investment-guide-title"
        aria-modal="true"
        className="modal-card modal-card--guide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">Guia de lectura</p>
            <h2 id="investment-guide-title">Recorrido de 30 segundos</h2>
            <p className="docs-page-note">
              Lee la vista de arriba hacia abajo: primero mezcla nacional, luego estado, luego capa
              fina y al final auditoría exacta.
            </p>
          </div>
          <button className="nav-button nav-button--ghost" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <div className="guide-grid guide-grid--walkthrough">
          {steps.map((step) => (
            <article className="guide-card" key={step.id}>
              <span>{step.kicker}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
              <div className="meta-actions">
                <button className="link-button" onClick={() => onOpenSection(step.targetId)} type="button">
                  Ir a esta parte
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function InvestmentDashboardPage({
  activeBudgetMetric,
  activeBudgetState,
  filteredBudgetStates,
  onNavigateAdmin,
  onNavigateDashboard,
  onNavigateDocs,
  onNavigateMethodology,
  onLogout,
  onSearchChange,
  onSelectState,
  onSetActiveBudgetMetricId,
  overview,
  searchValue,
  selectedStateId,
  session,
  stateLoading,
}) {
  const [guideOpen, setGuideOpen] = useState(false)
  const chapterRows = buildBudgetChapterRows(
    activeBudgetState,
    overview.budgetLayer.states,
    overview.budgetLayer.benchmarks,
  )
  const federalRows = buildBudgetSourceRows(activeBudgetState.federalFunds, activeBudgetState.federalFundsTotal)
  const techRows = buildBudgetSourceRows(activeBudgetState.techPlatforms, activeBudgetState.techPlatformSpend)
  const overweightChapters = [...chapterRows]
    .filter((row) => Number.isFinite(row.shareGap) && row.shareGap > 0.015)
    .sort((left, right) => right.shareGap - left.shareGap)
    .slice(0, 2)
  const underweightChapters = [...chapterRows]
    .filter((row) => Number.isFinite(row.shareGap) && row.shareGap < -0.015)
    .sort((left, right) => left.shareGap - right.shareGap)
    .slice(0, 2)
  const topFund = federalRows.find((row) => Number.isFinite(row.amount) && row.amount > 0)
  const topPlatform = techRows.find((row) => Number.isFinite(row.amount) && row.amount > 0)
  const fineDetail = activeBudgetState.fineDetail ?? null
  const fineLabels = fineDetail?.labels ?? {
    scope: 'Dependencia',
    group: 'Capitulo',
    groups: 'Capitulos',
    item: 'Concepto',
    items: 'Conceptos',
    topItem: 'Top concepto',
    tableTitle: 'Tabla por concepto',
  }
  const fineCoverageStates = overview.budgetLayer.fineCoverage.states
  const fineCoverageState =
    overview.budgetLayer.fineCoverage.states.find((item) => item.stateId === selectedStateId) ??
    overview.budgetLayer.fineCoverage.states[0] ??
    null
  const fineBridgeValue =
    fineDetail?.bridgeMetric?.kind === 'percent'
      ? formatPercentValue(fineDetail.bridgeMetric.value)
      : Number.isFinite(fineDetail?.bridgeMetric?.value)
        ? formatMetricValue(fineDetail.bridgeMetric.value, 'score')
        : 'Sin dato'
  const fineSummaryRows =
    fineDetail?.chapterBreakdown?.length > 0 ? fineDetail.chapterBreakdown.slice(0, 4) : fineDetail?.groups?.slice(0, 4) ?? []
  const walkthroughSteps = useMemo(
    () => [
      {
        id: 'scan',
        kicker: 'Paso 1',
        title: 'Barrido nacional',
        body:
          'Empieza en "Capitulos por estado". Cada celda es participacion dentro del gasto del propio estado, no monto total. Sirve para ver mezcla.',
        targetId: 'matriz-inversion',
      },
      {
        id: 'state',
        kicker: 'Paso 2',
        title: `Aterriza en ${activeBudgetState.name}`,
        body:
          'A la derecha revisa ejercido, per capita, fondos federales y peso tecnológico. Con eso ya sabes tamaño, intensidad y composición básica.',
        targetId: 'matriz-inversion',
      },
      {
        id: 'fine',
        kicker: 'Paso 3',
        title: 'Abre la cuenta publica fina',
        body: fineDetail
          ? `En ${activeBudgetState.name} sí hay una capa fina publicada. Léela según su alcance real: ${fineDetail.granularity}.`
          : 'Si el estado no tiene capa fina, usa los botones del panel para abrir uno de los pilotos vivos y entender hasta dónde baja la fuente oficial.',
        targetId: 'cuenta-fina-inversion',
      },
      {
        id: 'audit',
        kicker: 'Paso 4',
        title: 'Valida con auditoría',
        body:
          'Termina en las tablas. Ahí se confirma si el patrón visto arriba realmente se sostiene en montos, shares, per capita y subcomponentes.',
        targetId: 'auditoria-estatal-inversion',
      },
    ],
    [activeBudgetState.name, fineDetail],
  )

  function scrollToSection(targetId) {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  function scrollToStateDetail() {
    scrollToSection('detalle-estatal-inversion')
  }

  return (
    <main className="dashboard-shell dashboard-shell--docs">
      <PortalNavbar
        activeRoute="investment"
        onNavigateAdmin={onNavigateAdmin}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDocs={onNavigateDocs}
        onNavigateInvestment={() => {}}
        onNavigateMethodology={onNavigateMethodology}
        onLogout={onLogout}
        session={session}
      />

      <header className="page-hero page-hero--dashboard">
        <div className="page-hero-copy">
          <p className="eyebrow">Inversion publica / seguridad estatal</p>
          <h1>Atlas de inversion</h1>
          <p className="page-hero-note">
            Capa presupuestal dedicada para leer el gasto en seguridad publica estatal con el mayor
            detalle comparable que hoy permite la publicacion abierta nacional: ejercido, per capita,
            fondos, tecnologia y capitulos 1000-9000.
          </p>
        </div>

        <div className="page-hero-actions">
          <label className="search-box">
            <span>Buscar estado o region</span>
            <input
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Yucatan, Bajio, Frontera..."
              type="search"
              value={searchValue}
            />
          </label>

          <div className="meta-actions meta-actions--hero">
            <button className="link-button" onClick={() => setGuideOpen(true)} type="button">
              Guia de lectura
            </button>
            <button className="link-button" onClick={() => scrollToSection('cuenta-fina-inversion')} type="button">
              Ir a cuenta publica fina
            </button>
          </div>

          <div className="hero-kicker-grid">
            <article className="hero-kicker">
              <span>Capa publica actual</span>
              <strong>Capitulos 1000-9000</strong>
              <p>Comparable entre estados y ya auditada dentro del portal.</p>
            </article>
            <article className="hero-kicker">
              <span>Siguiente profundidad</span>
              <strong>Cuentas publicas</strong>
              <p>Ruta preparada para bajar a partidas y clasificadores locales.</p>
            </article>
          </div>
        </div>
      </header>

      <section className="summary-strip">
        {overview.budgetLayer.summaryCards.map((card) => (
          <article className="summary-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.note}</p>
          </article>
        ))}

        <article className="summary-card summary-card--source">
          <span>Corte presupuestal</span>
          <strong>{overview.budgetLayer.updatedAt}</strong>
          <p>
            {overview.budgetLayer.sources[0]?.name}. Estado actual: {overview.budgetLayer.sources[0]?.status}.
          </p>
        </article>
      </section>

      <section className="guide-grid guide-grid--orientation">
        <article className="guide-card">
          <span>Como usarlo</span>
          <strong>1. Mira mezcla, no monto</strong>
          <p>
            La matriz nacional responde en qué se reparte el gasto de cada estado. No compara tamaño,
            compara estructura.
          </p>
        </article>
        <article className="guide-card">
          <span>Como usarlo</span>
          <strong>2. Luego baja al estado</strong>
          <p>
            Ejercido, per capita, fondos y peso tecnológico te dicen si el estado gasta mucho,
            poco, o distinto al patrón nacional.
          </p>
        </article>
        <article className="guide-card">
          <span>Como usarlo</span>
          <strong>3. Usa la capa fina</strong>
          <p>
            La cuenta pública fina cambia por fuente. A veces baja a concepto, a veces a programa y
            a veces a dependencia.
          </p>
        </article>
        <article className="guide-card">
          <span>Como usarlo</span>
          <strong>4. Cierra con auditoría</strong>
          <p>
            Las tablas al final son la validación dura: montos exactos, shares, ranks y
            subcomponentes auditables.
          </p>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--primary detail-anchor" id="matriz-inversion">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Matriz detallada</p>
              <h2>Capitulos por estado</h2>
            </div>
            <div className="panel-head-actions">
              <p>
                La celda muestra la participacion de cada capitulo dentro del ejercido estatal.
                El header usa solo el codigo para que la matriz se lea rapido; la clave completa
                queda abajo.
              </p>
              <HelpPopover
                title="¿Que ves aqui?"
                body="Una lectura de mezcla. Si un estado aparece muy intenso en 1000, significa que ese capítulo pesa mucho dentro de su propio ejercido."
              />
            </div>
          </div>

          <BudgetChapterHeatmapChart
            chapters={overview.budgetLayer.chapters}
            data={filteredBudgetStates}
            onSelectState={onSelectState}
            selectedStateId={selectedStateId}
          />

          <div className="chapter-legend-grid">
            {overview.budgetLayer.chapters.map((chapter) => (
              <article className="chapter-legend-card" key={chapter.id}>
                <span>{chapter.code}</span>
                <strong>{chapter.label}</strong>
              </article>
            ))}
          </div>
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Estado seleccionado</p>
              <h2>{activeBudgetState.name}</h2>
            </div>
            <p>{activeBudgetState.region}</p>
          </div>

          {stateLoading ? <InlineLoading label="Actualizando lectura de inversion..." /> : null}

          <p className="state-copy">{activeBudgetState.lede}</p>
          <p className="state-copy state-copy--muted">{activeBudgetState.caution}</p>

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
              <strong>{formatPercentValue(activeBudgetState.federalFundsShare)}</strong>
              <small>{formatCurrencyValue(activeBudgetState.federalFundsTotal)}</small>
            </article>
            <article className="metric-card metric-card--neutral">
              <span>Peso tecnologico</span>
              <strong>{formatPercentValue(activeBudgetState.techPlatformShare)}</strong>
              <small>{formatCurrencyValue(activeBudgetState.techPlatformSpend)}</small>
            </article>
          </div>

          <div className="rule-stack">
            <article className="rule-card">
              <strong>Capitulo dominante</strong>
              <p>
                {activeBudgetState.topChapterLabel
                  ? `${activeBudgetState.topChapterCode} ${activeBudgetState.topChapterLabel}: ${formatPercentValue(activeBudgetState.topChapterShare)} del ejercido.`
                  : 'Sin capitulo dominante legible en esta capa publica.'}
              </p>
            </article>
            <article className="rule-card">
              <strong>Cobertura del desglose</strong>
              <p>
                {Number.isFinite(activeBudgetState.chapterCoverageRatio)
                  ? `${formatPercentValue(activeBudgetState.chapterCoverageRatio)} del ejercido visible por capitulos.`
                  : 'Sin cobertura suficiente para resumir el desglose por capitulo.'}
              </p>
            </article>
          </div>

          <div className="meta-actions">
            <button className="link-button" onClick={scrollToStateDetail} type="button">
              Bajar al detalle estatal
            </button>
          </div>
        </aside>
      </section>

      <section className="dashboard-grid dashboard-grid--primary detail-anchor" id="cuenta-fina-inversion">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Cuenta publica fina</p>
              <h2>
                {fineDetail
                  ? `${fineDetail.institutionName} · ${fineDetail.stateName}`
                  : 'Piloto institucional'}
              </h2>
            </div>
            <div className="panel-head-actions">
              <p>
                Esta tercera capa baja al mayor nivel público explotable por estado. La granularidad
                cambia por fuente: concepto, programa o dependencia. No sustituye al CNSPE; lo
                complementa donde la cuenta pública abre una capa adicional útil.
              </p>
              <HelpPopover
                title="¿Como leerla?"
                body="Primero identifica el alcance: dependencia, programa o cluster. Luego mira el top item y la tabla; no todos los estados publican el mismo nivel de detalle."
              />
            </div>
          </div>

          {stateLoading && activeBudgetState.id === fineCoverageState?.stateId && !fineDetail ? (
            <InlineLoading label="Cargando cuenta publica fina..." />
          ) : fineDetail ? (
            <>
              <div className="summary-strip summary-strip--compact">
                <article className="summary-card">
                  <span>Devengado del alcance</span>
                  <strong>{formatCurrencyValue(fineDetail.totals.devengado, { compact: true })}</strong>
                  <p>Corte {fineDetail.year} para el alcance fino seleccionado.</p>
                </article>
                <article className="summary-card">
                  <span>{fineDetail.bridgeMetric.label}</span>
                  <strong>{fineBridgeValue}</strong>
                  <p>{fineDetail.bridgeMetric.note}</p>
                </article>
                <article className="summary-card">
                  <span>
                    {fineLabels.groups} / {fineLabels.items}
                  </span>
                  <strong>
                    {fineDetail.groupCount} / {fineDetail.itemCount}
                  </strong>
                  <p>Granularidad real ya publicada para este piloto vivo.</p>
                </article>
                <article className="summary-card">
                  <span>{fineLabels.topItem}</span>
                  <strong>{fineDetail.topItems[0]?.label ?? 'Sin dato'}</strong>
                  <p>{formatCurrencyValue(fineDetail.topItems[0]?.devengado, { compact: true })}</p>
                </article>
              </div>

              <BudgetFineConceptChart
                itemLabel={fineLabels.item}
                items={fineDetail.topItems}
                scopeName={fineDetail.institutionName}
              />
            </>
          ) : (
            <div className="empty-panel empty-panel--dense">
              <p>
                {fineCoverageState
                  ? `${activeBudgetState.name} todavia no tiene capa fina institucional cableada. El piloto vivo actual esta en ${fineCoverageState.stateName} con ${fineCoverageState.institutionName}.`
                  : 'Todavia no hay pilotos de cuenta publica fina visibles en este corte.'}
              </p>
              {fineCoverageStates.length ? (
                <div className="meta-actions">
                  {fineCoverageStates.slice(0, 3).map((item) => (
                    <button className="link-button" key={item.stateId} onClick={() => onSelectState(item.stateId)} type="button">
                      {item.stateName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Cobertura fina</p>
              <h2>Estado actual</h2>
            </div>
          </div>

          {fineDetail ? (
            <div className="rule-stack">
              <article className="rule-card">
                <strong>Granularidad real</strong>
                <p>{fineDetail.granularity}</p>
              </article>
              <article className="rule-card">
                <strong>{fineLabels.scope}</strong>
                <p>{fineDetail.institutionName}</p>
              </article>
              {fineDetail.notes.map((note) => (
                <article className="rule-card" key={note}>
                  <strong>Piloto vivo</strong>
                  <p>{note}</p>
                </article>
              ))}
              <article className="rule-card">
                <strong>Fuente oficial</strong>
                <p>{fineDetail.source.name}</p>
                <p className="table-inline-note">{fineDetail.source.dependencyLabel}</p>
              </article>
            </div>
          ) : (
            <div className="rule-stack">
              <article className="rule-card">
                <strong>Sin capa fina para esta entidad</strong>
                <p>
                  El tablero nacional sigue llegando a capitulo comparable. La capa institucional
                  depende de cuentas publicas estatales por dependencia y su calidad varia por estado.
                </p>
              </article>
              {fineCoverageStates.length ? (
                <article className="rule-card">
                  <strong>Pilotos disponibles</strong>
                  <div className="rule-stack">
                    {fineCoverageStates.map((item) => (
                      <article className="rule-card" key={item.stateId}>
                        <strong>{item.stateName}</strong>
                        <p>
                          {item.institutionName} · {item.granularity}
                        </p>
                        <div className="meta-actions">
                          <button className="link-button" onClick={() => onSelectState(item.stateId)} type="button">
                            Abrir piloto
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </aside>
      </section>

      {fineDetail ? (
        <section className="dashboard-grid">
          <article className="panel panel-main">
            <div className="panel-head panel-head--split">
              <div>
                <p className="eyebrow">Cuenta publica institucional</p>
                <h2>{fineLabels.tableTitle}</h2>
              </div>
              <p>
                Devengado, pagado y subejercicio para el alcance fino seleccionado. Esta sección usa
                el nivel público más bajo que realmente publica cada estado en su fuente oficial.
              </p>
            </div>

            <BudgetFineConceptTable groups={fineDetail.groups} labels={fineLabels} />
          </article>

          <aside className="panel panel-side">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Puente analitico</p>
                <h2>Lecturas utiles</h2>
              </div>
            </div>

            <div className="rule-stack">
              {fineSummaryRows.map((row) => (
                <article className="rule-card" key={row.id}>
                  <strong>
                    {row.code ? `${row.code} ` : ''}
                    {row.label}
                  </strong>
                  <p>
                    {formatPercentValue(row.shareOfScope)} del alcance fino.
                    {Number.isFinite(row.stateBudgetShare)
                      ? ` Gap contra mezcla estatal: ${formatPercentValue(row.shareGapVsState)}.`
                      : ''}
                    {Number.isFinite(row.itemCount)
                      ? ` ${row.itemCount} ${fineLabels.items.toLowerCase()} visibles.`
                      : ''}
                    {row.topItemLabel ? ` Top ${fineLabels.item.toLowerCase()}: ${row.topItemLabel}.` : ''}
                  </p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      ) : null}

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Orden nacional</p>
              <h2>Ranking de inversion</h2>
            </div>
            <div className="panel-head-actions">
              <p>
                Cambia el eje para ordenar por monto, per capita, fondos federales o peso
                tecnologico sin salir de la misma superficie.
              </p>
              <HelpPopover
                title="¿Para que sirve?"
                body="Aquí respondes quién gasta más, quién gasta más por habitante y quién depende más de fondos o tecnología."
              />
            </div>
          </div>

          <div className="metric-tabs">
            {overview.budgetLayer.metrics.map((metric) => (
              <button
                className={metric.id === activeBudgetMetric.id ? 'metric-tab is-active' : 'metric-tab'}
                key={metric.id}
                onClick={() => onSetActiveBudgetMetricId(metric.id)}
                type="button"
              >
                {metric.shortLabel}
              </button>
            ))}
          </div>

          <StateRankingChart
            data={filteredBudgetStates}
            metric={activeBudgetMetric}
            onSelectState={onSelectState}
            selectedStateId={selectedStateId}
          />
        </article>

        <article className="panel">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Composicion</p>
              <h2>{activeBudgetState.name} vs mezcla nacional</h2>
            </div>
            <p>
              Monto y share por capitulo para detectar si el estado se carga a personal, operacion,
              inversion fisica o tecnologia.
            </p>
          </div>

          <BudgetCompositionChart
            budgetBenchmarks={overview.budgetLayer.benchmarks}
            chapters={activeBudgetState.chapters}
            stateName={activeBudgetState.name}
          />
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--primary detail-anchor" id="detalle-estatal-inversion">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Detalle estatal fino</p>
              <h2>{activeBudgetState.name} vs mezcla nacional</h2>
            </div>
            <div className="panel-head-actions">
              <p>
                La brecha se lee en puntos porcentuales contra la mezcla nacional del ejercido. Aqui
                ya se ve donde el estado sobrecarga personal, operacion, inversion fisica o rubros
                residuales.
              </p>
              <HelpPopover
                title="¿Que significa gap?"
                body="Gap positivo significa que el estado dedica más proporción a ese capítulo que el promedio nacional; gap negativo, menos."
              />
            </div>
          </div>

          <BudgetChapterDeltaChart chapterRows={chapterRows} stateName={activeBudgetState.name} />
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Lectura rapida</p>
              <h2>Que hace distinto a {activeBudgetState.name}</h2>
            </div>
          </div>

          <div className="rule-stack">
            <article className="rule-card">
              <strong>Sobrepeso principal</strong>
              <p>
                {overweightChapters.length
                  ? `${overweightChapters.map((row) => `${row.code} ${row.label}`).join(' y ')} aparecen por arriba de la mezcla nacional.`
                  : 'No hay capitulos con sobrepeso claro frente al patron nacional.'}
              </p>
            </article>
            <article className="rule-card">
              <strong>Hueco principal</strong>
              <p>
                {underweightChapters.length
                  ? `${underweightChapters.map((row) => `${row.code} ${row.label}`).join(' y ')} quedan por debajo del patron nacional.`
                  : 'No hay huecos fuertes por capitulo frente al patron nacional.'}
              </p>
            </article>
            <article className="rule-card">
              <strong>Fondo dominante</strong>
              <p>
                {topFund
                  ? `${topFund.label} concentra ${formatPercentValue(topFund.shareOfParent)} del bloque federal visible.`
                  : 'No hay fondo federal positivo legible en la capa abierta.'}
              </p>
            </article>
            <article className="rule-card">
              <strong>Vector tecnologico</strong>
              <p>
                {topPlatform
                  ? `${topPlatform.label} es la plataforma con mayor peso dentro del gasto tecnologico visible.`
                  : 'No hay plataforma tecnologica dominante visible en el abierto.'}
              </p>
            </article>
          </div>
        </aside>
      </section>

      <section className="dashboard-grid detail-anchor" id="auditoria-estatal-inversion">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Auditoria estatal</p>
              <h2>Tabla fina por capitulo</h2>
            </div>
            <div className="panel-head-actions">
              <p>
                Monto, share, per capita y ranks por capitulo para la entidad seleccionada. Este es
                el puente util entre la capa nacional comparable y la futura bajada a cuentas
                publicas estatales.
              </p>
              <HelpPopover
                title="¿Cuando bajo aqui?"
                body="Cuando ya viste un patrón arriba y quieres confirmar si realmente se sostiene en montos exactos y posiciones relativas."
              />
            </div>
          </div>

          <BudgetChapterDetailTable rows={chapterRows} />
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Subcomponentes</p>
              <h2>Fondos y plataformas</h2>
            </div>
          </div>

          <BudgetSourceTable
            description="FASP, FOFISP y otros subsidios visibles dentro del ejercido estatal."
            rows={federalRows}
            title="Fondos federales"
          />

          <BudgetSourceTable
            description="Plataformas reportadas para combate a la delincuencia y soporte operativo."
            rows={techRows}
            title="Plataformas tecnologicas"
          />

          <article className="rule-card">
            <strong>Aportacion privada</strong>
            <p>
              {Number.isFinite(activeBudgetState.privateContributionTotal)
                ? `${formatCurrencyValue(activeBudgetState.privateContributionTotal)} reportados como aportacion privada para 2024.`
                : 'La fuente abierta no resuelve con claridad la aportacion privada para esta entidad.'}
            </p>
          </article>
        </aside>
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-main">
          <div className="panel-head panel-head--split">
            <div>
              <p className="eyebrow">Auditoria nacional</p>
              <h2>Tabla exacta de estados</h2>
            </div>
            <p>
              Exactos por entidad, shares y montos auditables. Esta sigue siendo la base nacional
              comparable para barrer el pais antes de bajar a un estado especifico.
            </p>
          </div>

          <BudgetTable
            activeMetricId={activeBudgetMetric.id}
            chapters={overview.budgetLayer.chapters}
            data={filteredBudgetStates}
            onSelectState={onSelectState}
            selectedStateId={selectedStateId}
          />
        </article>

        <aside className="panel panel-side">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Como leer esta capa</p>
              <h2>Reglas y siguiente profundidad</h2>
            </div>
          </div>

          <div className="rule-stack">
            {overview.budgetLayer.rules.map((rule) => (
              <article className="rule-card" key={rule.title}>
                <strong>{rule.title}</strong>
                <p>{rule.body}</p>
              </article>
            ))}
            <article className="rule-card">
              <strong>Partida especifica</strong>
              <p>
                La siguiente fase de atlas de inversion debe bajar a cuentas publicas estatales y
                armonizacion CONAC para llegar a partidas y conceptos locales homologados.
              </p>
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

      {guideOpen ? (
        <GuideModal
          onClose={() => setGuideOpen(false)}
          onOpenSection={(targetId) => {
            setGuideOpen(false)
            window.setTimeout(() => {
              scrollToSection(targetId)
            }, 80)
          }}
          steps={walkthroughSteps}
        />
      ) : null}
    </main>
  )
}
