import { mexicoSecurityStudy } from '../data/mexicoSecurityStudy.mjs'
import { stateBudgetFineData } from '../data/generated/stateBudgetFineData.mjs'

function isNumber(value) {
  return Number.isFinite(value)
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits))
}

function average(values, digits = 1) {
  const numbers = values.filter(isNumber)

  if (!numbers.length) {
    return null
  }

  return round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, digits)
}

function sum(values) {
  return values.reduce((total, value) => total + (isNumber(value) ? value : 0), 0)
}

const dashboardDimensions = mexicoSecurityStudy.dimensions
const budgetLayer = mexicoSecurityStudy.budgetLayer
const budgetFinePilotsByState = new Map(stateBudgetFineData.pilots.map((pilot) => [pilot.stateId, pilot]))
const operationalWeights = mexicoSecurityStudy.operationalWeights
const atlasWeights = mexicoSecurityStudy.atlasWeights
const operationalMetricIds = operationalWeights.map((weight) => weight.id)
const monthlyMetricIds = dashboardDimensions.filter((dimension) => dimension.hasMonthly).map((dimension) => dimension.id)
const matrixDimensionIds = mexicoSecurityStudy.matrixDimensionIds
const detailMetricIds = mexicoSecurityStudy.detailMetricIds
const comparisonMetricIds = mexicoSecurityStudy.comparisonMetricIds
const metricMap = new Map([
  ...dashboardDimensions.map((dimension) => [dimension.id, dimension]),
  ...budgetLayer.metrics.map((metric) => [metric.id, metric]),
])

const narrativeLabel = {
  score: 'atlas score',
  operationalScore: 'score operativo',
  homicideRate: 'homicidio doloso',
  extortionRate: 'extorsion',
  robberyViolenceRate: 'robo con violencia',
  violenceFamilyRate: 'violencia familiar',
  narcomenudeoRate: 'narcomenudeo',
  totalCrimeRate: 'incidencia total',
  budgetExercised: 'presupuesto ejercido',
  budgetPerCapita: 'gasto per capita',
  techPlatformShare: 'peso tecnologico',
}

function getMetric(metricId) {
  return metricMap.get(metricId) ?? { id: metricId, label: metricId, higherIsBetter: true }
}

function buildBounds(states, metricIds) {
  const bounds = {}

  metricIds.forEach((metricId) => {
    const values = states.map((state) => state?.[metricId]).filter(isNumber)

    if (!values.length) {
      return
    }

    bounds[metricId] = {
      min: Math.min(...values),
      max: Math.max(...values),
    }
  })

  return bounds
}

function normalizeMetric(value, metricId, bounds) {
  if (!isNumber(value)) {
    return null
  }

  const metricBounds = bounds[metricId]

  if (!metricBounds || metricBounds.max === metricBounds.min) {
    return 50
  }

  const ratio = (value - metricBounds.min) / (metricBounds.max - metricBounds.min)
  const normalized = getMetric(metricId).higherIsBetter ? ratio : 1 - ratio
  return round(normalized * 100, 1)
}

function buildWeightedScore(state, bounds, weights) {
  const weighted = weights.reduce(
    (accumulator, weight) => {
      const normalized = normalizeMetric(state[weight.id], weight.id, bounds)

      if (!isNumber(normalized)) {
        return accumulator
      }

      return {
        total: accumulator.total + normalized * weight.weight,
        weight: accumulator.weight + weight.weight,
      }
    },
    { total: 0, weight: 0 },
  )

  if (!weighted.weight) {
    return null
  }

  return round(weighted.total / weighted.weight, 0)
}

function decorateOperationalStates(rawStates) {
  const bounds = buildBounds(rawStates, operationalMetricIds)

  return rawStates.map((state) => {
    const normalized = {}

    operationalMetricIds.forEach((metricId) => {
      normalized[metricId] = normalizeMetric(state[metricId], metricId, bounds)
    })

    return {
      ...state,
      normalized,
      operationalScore: buildWeightedScore(state, bounds, operationalWeights),
    }
  })
}

function monthArrayFromState(state) {
  return state.monthly ?? []
}

function decorateMonthlyOperationalScores(states) {
  const referenceMonths = monthArrayFromState(states[0])

  if (!referenceMonths.length) {
    return states
  }

  const monthlyBounds = referenceMonths.map((_month, index) =>
    buildBounds(
      states
        .map((state) => state.monthly[index])
        .filter(Boolean),
      operationalMetricIds,
    ),
  )

  return states.map((state) => ({
    ...state,
    monthly: state.monthly.map((month, index) => ({
      ...month,
      operationalScore: buildWeightedScore(month, monthlyBounds[index], operationalWeights),
    })),
  }))
}

function mergeIntegratedStates(crimeStates, budgetStates) {
  const budgetById = new Map(budgetStates.map((state) => [state.id, state]))
  const mergedBase = crimeStates.map((state) => ({
    ...state,
    ...(budgetById.get(state.id) ?? {}),
  }))
  const atlasBounds = buildBounds(
    mergedBase,
    atlasWeights.map((weight) => weight.id),
  )
  const capacityWeights = atlasWeights.filter((weight) => weight.id !== 'operationalScore')

  return mergedBase.map((state) => {
    const atlasNormalized = {}

    atlasWeights.forEach((weight) => {
      atlasNormalized[weight.id] = normalizeMetric(state[weight.id], weight.id, atlasBounds)
    })

    return {
      ...state,
      atlasNormalized,
      capacityScore: buildWeightedScore(state, atlasBounds, capacityWeights),
      score: buildWeightedScore(state, atlasBounds, atlasWeights),
      budgetAvailable: isNumber(state.budgetExercised),
    }
  })
}

function buildBenchmarks(states) {
  const benchmarks = {}

  dashboardDimensions.forEach((dimension) => {
    benchmarks[dimension.id] = average(states.map((state) => state[dimension.id]))
  })

  benchmarks.population = sum(states.map((state) => state.population))
  benchmarks.homicideCount = sum(states.map((state) => state.homicideCount))
  benchmarks.extortionCount = sum(states.map((state) => state.extortionCount))
  benchmarks.totalCrimeCount = sum(states.map((state) => state.totalCrimeCount))
  benchmarks.budgetReportedCount = states.filter((state) => isNumber(state.budgetExercised)).length
  benchmarks.budgetExercisedTotal = sum(states.map((state) => state.budgetExercised))
  benchmarks.techPlatformSpendTotal = sum(states.map((state) => state.techPlatformSpend))

  return benchmarks
}

function rankedValue(state, metricId) {
  if (isNumber(state[metricId])) {
    return state[metricId]
  }

  return getMetric(metricId).higherIsBetter ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
}

function buildRankMap(states, metricId) {
  const metric = getMetric(metricId)

  return new Map(
    [...states]
      .sort((left, right) =>
        metric.higherIsBetter
          ? rankedValue(right, metricId) - rankedValue(left, metricId)
          : rankedValue(left, metricId) - rankedValue(right, metricId),
      )
      .map((state, index) => [state.id, index + 1]),
  )
}

function buildRankings(states, metricIds) {
  return Object.fromEntries(metricIds.map((metricId) => [metricId, buildRankMap(states, metricId)]))
}

function buildNationalMonthly(states) {
  const referenceMonths = monthArrayFromState(states[0])

  return referenceMonths.map((month, index) => {
    const payload = {
      monthIndex: month.monthIndex,
      month: month.month,
    }

    monthlyMetricIds.forEach((metricId) => {
      payload[metricId] = round(
        average(states.map((state) => state.monthly[index]?.[metricId])) ?? 0,
        metricId.endsWith('Score') ? 0 : 1,
      )
    })

    return payload
  })
}

function differenceLabel(value, suffix, digits = 1) {
  const rounded = round(value, digits)
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded} ${suffix}`
}

function relativeGapLabel(value, averageValue) {
  if (!isNumber(value) || !isNumber(averageValue) || averageValue === 0) {
    return 'sin brecha comparable'
  }

  const ratio = ((value - averageValue) / averageValue) * 100

  if (ratio === 0) {
    return 'al nivel del promedio'
  }

  return ratio > 0
    ? `${Math.abs(round(ratio, 0))}% por arriba del promedio`
    : `${Math.abs(round(ratio, 0))}% por debajo del promedio`
}

function formatMetricDisplay(value, metricId) {
  if (!isNumber(value)) {
    return 'Sin dato'
  }

  if (metricId === 'score' || metricId === 'operationalScore' || metricId === 'capacityScore') {
    return `${Math.round(value)}`
  }

  if (metricId === 'budgetExercised' || metricId === 'budgetApproved' || metricId === 'budgetProjected') {
    return `${Math.round(value / 1000000).toLocaleString('es-MX')} M`
  }

  if (metricId === 'budgetPerCapita') {
    return `${Math.round(value).toLocaleString('es-MX')} MXN`
  }

  if (metricId.endsWith('Share')) {
    return `${round(value * 100, 1)}%`
  }

  return `${round(value)}`
}

function buildMetricDifferenceLabel(metricId, stateValue, benchmarkValue) {
  if (!isNumber(stateValue) || !isNumber(benchmarkValue)) {
    return 'Sin dato comparable'
  }

  const difference = stateValue - benchmarkValue

  if (metricId === 'score' || metricId === 'operationalScore' || metricId === 'capacityScore') {
    return differenceLabel(difference, 'pts', 0)
  }

  if (metricId === 'budgetPerCapita') {
    const sign = difference > 0 ? '+' : ''
    return `${sign}${Math.round(difference).toLocaleString('es-MX')} MXN/hab`
  }

  if (
    metricId === 'budgetExercised' ||
    metricId === 'budgetApproved' ||
    metricId === 'budgetProjected' ||
    metricId === 'federalFundsTotal' ||
    metricId === 'techPlatformSpend'
  ) {
    const sign = difference > 0 ? '+' : ''
    return `${sign}${Math.round(difference / 1000000).toLocaleString('es-MX')} M MXN`
  }

  if (metricId.endsWith('Share')) {
    const sign = difference > 0 ? '+' : ''
    return `${sign}${round(difference * 100, 1)} pp`
  }

  return differenceLabel(difference, 'por 100 mil')
}

function buildMetricCard(state, metricId, benchmarks, rankings) {
  const metric = getMetric(metricId)
  const difference = isNumber(state[metricId]) && isNumber(benchmarks[metricId]) ? state[metricId] - benchmarks[metricId] : null
  const positiveForUser = difference === null ? true : metric.higherIsBetter ? difference >= 0 : difference <= 0

  return {
    id: metricId,
    label: metric.label,
    value: state[metricId],
    displayValue: formatMetricDisplay(state[metricId], metricId),
    benchmarkLabel: buildMetricDifferenceLabel(metricId, state[metricId], benchmarks[metricId]),
    benchmarkTone: positiveForUser ? 'good' : 'risk',
    rank: rankings[metricId].get(state.id),
    note: relativeGapLabel(state[metricId], benchmarks[metricId]),
  }
}

function buildAtlasDrivers(state, benchmarks) {
  const scoreDrivers = atlasWeights.map((weight) => {
    const metricId = weight.id
    const normalized = state.atlasNormalized[metricId]

    return {
      id: metricId,
      label: getMetric(metricId).label,
      normalized: isNumber(normalized) ? normalized : 50,
      note: `${getMetric(metricId).label}: ${relativeGapLabel(state[metricId], benchmarks[metricId])}.`,
    }
  })

  const positives = [...scoreDrivers]
    .sort((left, right) => right.normalized - left.normalized)
    .slice(0, 2)
    .map((driver) => ({
      label: driver.label,
      direction: 'positive',
      value: driver.normalized,
      note: driver.note,
    }))

  const risks = [...scoreDrivers]
    .sort((left, right) => left.normalized - right.normalized)
    .slice(0, 2)
    .map((driver) => ({
      label: driver.label,
      direction: 'risk',
      value: round(100 - driver.normalized, 1),
      note: driver.note,
    }))

  return [...positives, ...risks]
}

function buildStateNarrative(state, benchmarks, rankings) {
  const bestMetric = [...operationalWeights]
    .map((weight) => ({
      id: weight.id,
      gap: state[weight.id] - benchmarks[weight.id],
    }))
    .sort((left, right) => left.gap - right.gap)[0]

  const worstMetric = [...operationalWeights]
    .map((weight) => ({
      id: weight.id,
      gap: state[weight.id] - benchmarks[weight.id],
    }))
    .sort((left, right) => right.gap - left.gap)[0]

  const scoreRank = rankings.score.get(state.id)
  const budgetSentence = isNumber(state.budgetExercised)
    ? `En gasto per capita ocupa el lugar ${rankings.budgetPerCapita.get(state.id)} y ejercio ${Math.round(state.budgetExercised / 1000000).toLocaleString('es-MX')} millones de MXN en 2024.`
    : 'La fuente abierta no expone un presupuesto ejercido comparable para este estado.'

  return {
    lede: `${state.name} ocupa el lugar ${scoreRank} del atlas score nacional. Su mejor lectura operativa relativa esta en ${narrativeLabel[bestMetric.id]}.`,
    caution: `La principal presion actual aparece en ${narrativeLabel[worstMetric.id]}. ${budgetSentence}`,
  }
}

function buildOverviewState(state, rankings) {
  return {
    id: state.id,
    code: state.code,
    name: state.name,
    region: state.region,
    population: state.population,
    score: state.score,
    operationalScore: state.operationalScore,
    capacityScore: state.capacityScore,
    budgetAvailable: state.budgetAvailable,
    budgetProjected: state.budgetProjected,
    budgetApproved: state.budgetApproved,
    budgetExercised: state.budgetExercised,
    budgetPerCapita: state.budgetPerCapita,
    federalFundsTotal: state.federalFundsTotal,
    federalFundsShare: state.federalFundsShare,
    privateContributionTotal: state.privateContributionTotal,
    privateContributionShare: state.privateContributionShare,
    techPlatformSpend: state.techPlatformSpend,
    techPlatformShare: state.techPlatformShare,
    chapterReportedAmount: state.chapterReportedAmount,
    chapterCoverageRatio: state.chapterCoverageRatio,
    chapterDifference: state.chapterDifference,
    topChapterId: state.topChapterId,
    topChapterCode: state.topChapterCode,
    topChapterLabel: state.topChapterLabel,
    topChapterAmount: state.topChapterAmount,
    topChapterShare: state.topChapterShare,
    homicideRate: state.homicideRate,
    extortionRate: state.extortionRate,
    robberyViolenceRate: state.robberyViolenceRate,
    violenceFamilyRate: state.violenceFamilyRate,
    narcomenudeoRate: state.narcomenudeoRate,
    totalCrimeRate: state.totalCrimeRate,
    homicideCount: state.homicideCount,
    extortionCount: state.extortionCount,
    robberyViolenceCount: state.robberyViolenceCount,
    violenceFamilyCount: state.violenceFamilyCount,
    narcomenudeoCount: state.narcomenudeoCount,
    totalCrimeCount: state.totalCrimeCount,
    normalized: state.normalized,
    atlasNormalized: state.atlasNormalized,
    ranks: Object.fromEntries(dashboardDimensions.map((dimension) => [dimension.id, rankings[dimension.id].get(state.id)])),
  }
}

function buildSummaryCards(states, benchmarks, rankings, budgetBenchmarks) {
  const bestState = [...states].sort((left, right) => right.score - left.score)[0]
  const highestRiskState = [...states].sort((left, right) => right.homicideRate - left.homicideRate)[0]

  return [
    {
      label: 'Estados cubiertos',
      value: `${states.length}`,
      note: `${benchmarks.budgetReportedCount}/32 con gasto ejercido comparable.`,
    },
    {
      label: 'Atlas leader',
      value: bestState.name,
      note: `Lugar ${rankings.score.get(bestState.id)} del atlas score.`,
    },
    {
      label: 'Score medio',
      value: `${Math.round(benchmarks.score ?? 0)}`,
      note: 'Promedio integrado de desempeno y capacidad.',
    },
    {
      label: 'Ejercido nacional',
      value: `${Math.round(budgetBenchmarks.budgetExercised / 1000000).toLocaleString('es-MX')} M`,
      note: 'Suma estatal del presupuesto ejercido 2024.',
    },
    {
      label: 'Per capita promedio',
      value: `${Math.round(budgetBenchmarks.budgetPerCapita ?? 0).toLocaleString('es-MX')} MXN`,
      note: 'Pesos por habitante a escala estatal.',
    },
    {
      label: 'Mayor letalidad',
      value: highestRiskState.name,
      note: `${formatMetricDisplay(highestRiskState.homicideRate, 'homicideRate')} por 100 mil.`,
    },
  ]
}

function buildComparisonTiles(state, benchmarks) {
  return comparisonMetricIds.map((metricId) => {
    const metric = getMetric(metricId)
    const difference = state[metricId] - benchmarks[metricId]
    const tone = metric.higherIsBetter ? (difference >= 0 ? 'good' : 'risk') : difference <= 0 ? 'good' : 'risk'

    return {
      id: metricId,
      label: metric.label,
      tone,
      displayValue: buildMetricDifferenceLabel(metricId, state[metricId], benchmarks[metricId]),
    }
  })
}

function budgetRankValue(state, metricId) {
  return isNumber(state[metricId]) ? state[metricId] : Number.NEGATIVE_INFINITY
}

function buildBudgetBenchmarks(states) {
  const withBudget = states.filter((state) => isNumber(state.budgetExercised))
  const totalBudgetExercised = sum(withBudget.map((state) => state.budgetExercised))
  const totalFederalFunds = sum(states.map((state) => state.federalFundsTotal))
  const totalTechPlatformSpend = sum(states.map((state) => state.techPlatformSpend))
  const totalPrivateContribution = sum(states.map((state) => state.privateContributionTotal))

  const chapterTotals = Object.fromEntries(
    budgetLayer.chapters.map((chapter) => [
      chapter.id,
      sum(states.map((state) => state.chapters.find((item) => item.id === chapter.id)?.amount)),
    ]),
  )

  const chapterShares = Object.fromEntries(
    budgetLayer.chapters.map((chapter) => [
      chapter.id,
      totalBudgetExercised > 0 ? round(chapterTotals[chapter.id] / totalBudgetExercised, 4) : null,
    ]),
  )

  return {
    statesReported: withBudget.length,
    budgetProjected: sum(states.map((state) => state.budgetProjected)),
    budgetApproved: sum(states.map((state) => state.budgetApproved)),
    budgetExercised: totalBudgetExercised,
    budgetPerCapita: average(withBudget.map((state) => state.budgetPerCapita), 1),
    federalFundsTotal: totalFederalFunds,
    federalFundsShare: totalBudgetExercised > 0 ? round(totalFederalFunds / totalBudgetExercised, 4) : null,
    privateContributionTotal: totalPrivateContribution,
    techPlatformSpend: totalTechPlatformSpend,
    techPlatformShare: totalBudgetExercised > 0 ? round(totalTechPlatformSpend / totalBudgetExercised, 4) : null,
    chapterTotals,
    chapterShares,
  }
}

function buildBudgetRankings(states) {
  return Object.fromEntries(
    budgetLayer.metrics.map((metric) => [
      metric.id,
      new Map(
        [...states]
          .sort((left, right) => budgetRankValue(right, metric.id) - budgetRankValue(left, metric.id))
          .map((state, index) => [state.id, index + 1]),
      ),
    ]),
  )
}

function buildBudgetSummaryCards(states, benchmarks, rankings) {
  const perCapitaLeader = [...states].sort((left, right) => budgetRankValue(right, 'budgetPerCapita') - budgetRankValue(left, 'budgetPerCapita'))[0]
  const totalLeader = [...states].sort((left, right) => budgetRankValue(right, 'budgetExercised') - budgetRankValue(left, 'budgetExercised'))[0]
  const techLeader = [...states].sort((left, right) => budgetRankValue(right, 'techPlatformSpend') - budgetRankValue(left, 'techPlatformSpend'))[0]

  return [
    {
      label: 'Estados reportados',
      value: `${benchmarks.statesReported}/32`,
      note: 'Cobertura con presupuesto ejercido visible.',
    },
    {
      label: 'Ejercido nacional',
      value: `${Math.round(benchmarks.budgetExercised / 1000000).toLocaleString('es-MX')} M`,
      note: 'Suma del presupuesto ejercido 2024.',
    },
    {
      label: 'Per capita promedio',
      value: `${Math.round(benchmarks.budgetPerCapita ?? 0).toLocaleString('es-MX')}`,
      note: 'Pesos por habitante a escala estatal.',
    },
    {
      label: 'Lider per capita',
      value: perCapitaLeader.name,
      note: `Lugar ${rankings.budgetPerCapita.get(perCapitaLeader.id)} en gasto por habitante.`,
    },
    {
      label: 'Lider tecnologico',
      value: techLeader.name,
      note: `Lugar ${rankings.techPlatformSpend.get(techLeader.id)} en gasto en plataformas.`,
    },
    {
      label: 'Mayor bolsa ejercida',
      value: totalLeader.name,
      note: `Lugar ${rankings.budgetExercised.get(totalLeader.id)} en monto ejercido.`,
    },
  ]
}

function buildBudgetQualityNotes(state) {
  const notes = []

  if (!state.quality.hasBudgetExercised) {
    notes.push('Sin presupuesto ejercido visible en la fuente abierta para este estado.')
    return notes
  }

  if (state.quality.flags.includes('partial_chapter_breakdown')) {
    notes.push(`El desglose por capitulos reporta ${state.quality.chapterReportedCount} de ${state.quality.chapterTotalCount} capitulos.`)
  }

  if (isNumber(state.chapterCoverageRatio)) {
    notes.push(`La suma de capitulos cubre ${round(state.chapterCoverageRatio * 100, 1)}% del ejercido reportado.`)
  }

  if (state.quality.flags.includes('chapter_total_gap')) {
    notes.push('Hay una brecha relevante entre el ejercido total y la suma por capitulos reportados.')
  }

  if (state.federalFundsStatus === 'missing' || state.federalFundsStatus === 'unknown') {
    notes.push('La recepcion de fondos federales no esta completamente resuelta en la fuente abierta.')
  }

  return notes
}

function buildBudgetNarrative(state) {
  if (!isNumber(state.budgetExercised)) {
    return {
      lede: `${state.name} no expone presupuesto ejercido utilizable en la capa abierta de recursos presupuestales del CNSPE 2025.`,
      caution: 'El tablero mantiene el estado visible, pero lo trata como observacion de cobertura y no como comparacion fuerte.',
    }
  }

  const topChapterSentence = state.topChapterLabel
    ? `${state.topChapterLabel} concentra ${round((state.topChapterShare ?? 0) * 100, 1)}% del ejercido.`
    : 'No hay capitulo dominante legible en el abierto.'

  const federalSentence = isNumber(state.federalFundsShare)
    ? `Los fondos federales representan ${round(state.federalFundsShare * 100, 1)}% del ejercido.`
    : 'La capa de fondos federales no es concluyente para este estado.'

  return {
    lede: `${state.name} ejercio ${Math.round(state.budgetExercised / 1000000).toLocaleString('es-MX')} millones de MXN en 2024, equivalente a ${Math.round(state.budgetPerCapita ?? 0).toLocaleString('es-MX')} MXN por habitante.`,
    caution: `${topChapterSentence} ${federalSentence}`,
  }
}

function buildBudgetOverviewState(state, rankings) {
  return {
    id: state.id,
    code: state.code,
    name: state.name,
    region: state.region,
    population: state.population,
    budgetProjected: state.budgetProjected,
    budgetApproved: state.budgetApproved,
    budgetExercised: state.budgetExercised,
    budgetPerCapita: state.budgetPerCapita,
    federalFundsTotal: state.federalFundsTotal,
    federalFundsShare: state.federalFundsShare,
    privateContributionTotal: state.privateContributionTotal,
    privateContributionShare: state.privateContributionShare,
    techPlatformSpend: state.techPlatformSpend,
    techPlatformShare: state.techPlatformShare,
    chapterReportedAmount: state.chapterReportedAmount,
    chapterCoverageRatio: state.chapterCoverageRatio,
    chapterDifference: state.chapterDifference,
    topChapterId: state.topChapterId,
    topChapterCode: state.topChapterCode,
    topChapterLabel: state.topChapterLabel,
    topChapterAmount: state.topChapterAmount,
    topChapterShare: state.topChapterShare,
    chapters: state.chapters,
    federalFunds: state.federalFunds,
    techPlatforms: state.techPlatforms,
    quality: state.quality,
    federalFundsStatus: state.federalFundsStatus,
    privateContributionStatus: state.privateContributionStatus,
    techPlatformStatus: state.techPlatformStatus,
    ranks: Object.fromEntries(budgetLayer.metrics.map((metric) => [metric.id, rankings[metric.id].get(state.id)])),
  }
}

function buildBudgetComparisonTiles(state, benchmarks) {
  return ['budgetPerCapita', 'budgetExercised', 'federalFundsShare', 'techPlatformShare'].map((metricId) => ({
    id: metricId,
    label: getMetric(metricId).label,
    tone: 'neutral',
    displayValue: buildMetricDifferenceLabel(metricId, state[metricId], benchmarks[metricId]),
  }))
}

function buildBudgetFinePilot(pilot, budgetState) {
  if (!pilot) {
    return null
  }

  const totalDevengado = pilot.totals.devengado
  const bridgeComparable = pilot.stateBudgetBridgeComparable !== false
  const institutionShareOfStateBudget =
    bridgeComparable && isNumber(totalDevengado) && isNumber(budgetState?.budgetExercised) && budgetState.budgetExercised > 0
      ? round(totalDevengado / budgetState.budgetExercised, 4)
      : null
  const labels = {
    scope: 'Dependencia',
    group: 'Capitulo',
    groups: 'Capitulos',
    item: 'Concepto',
    items: 'Conceptos',
    topItem: 'Top concepto',
    tableTitle: 'Tabla por concepto',
    ...(pilot.labels ?? {}),
  }

  const chapterBreakdown = (pilot.chapterBreakdown ?? []).map((chapter) => {
    const stateChapter = budgetState?.chapters?.find((item) => item.code === chapter.code)

    return {
      ...chapter,
      shareOfScope: isNumber(chapter.shareOfScope)
        ? chapter.shareOfScope
        : isNumber(totalDevengado) && totalDevengado > 0
          ? round(chapter.devengado / totalDevengado, 4)
          : null,
      stateBudgetShare: stateChapter?.shareOfExercised ?? null,
      shareGapVsState: isNumber(stateChapter?.shareOfExercised) && isNumber(totalDevengado) && totalDevengado > 0
        ? round(chapter.devengado / totalDevengado - stateChapter.shareOfExercised, 4)
        : null,
    }
  })

  const groups = (pilot.groups ?? []).map((group) => {
    const stateChapter = group.code ? budgetState?.chapters?.find((item) => item.code === group.code) : null
    const items = (group.items ?? []).map((item) => ({
      ...item,
      shareOfScope: isNumber(item.shareOfScope)
        ? item.shareOfScope
        : isNumber(totalDevengado) && totalDevengado > 0
          ? round(item.devengado / totalDevengado, 4)
          : null,
      shareOfGroup: isNumber(item.shareOfGroup)
        ? item.shareOfGroup
        : isNumber(group.devengado) && group.devengado > 0
          ? round(item.devengado / group.devengado, 4)
          : null,
    }))
    const topItem = [...items].sort((left, right) => right.devengado - left.devengado)[0]

    return {
      ...group,
      shareOfScope: isNumber(group.shareOfScope)
        ? group.shareOfScope
        : isNumber(totalDevengado) && totalDevengado > 0
          ? round(group.devengado / totalDevengado, 4)
          : null,
      stateBudgetShare: stateChapter?.shareOfExercised ?? null,
      shareGapVsState: isNumber(stateChapter?.shareOfExercised) && isNumber(totalDevengado) && totalDevengado > 0
        ? round(group.devengado / totalDevengado - stateChapter.shareOfExercised, 4)
        : null,
      itemCount: items.length,
      topItemId: topItem?.id ?? null,
      topItemLabel: topItem?.label ?? null,
      topItemDevengado: topItem?.devengado ?? null,
      items,
    }
  })

  const topItems = (pilot.topItems ?? [])
    .map((item) => ({
      ...item,
      shareOfScope: isNumber(item.shareOfScope)
        ? item.shareOfScope
        : isNumber(totalDevengado) && totalDevengado > 0
          ? round(item.devengado / totalDevengado, 4)
          : null,
    }))
    .sort((left, right) => right.devengado - left.devengado)

  const itemCount = groups.reduce((total, group) => total + group.items.length, 0)
  const scopeEntityCount = new Set(groups.flatMap((group) => group.items.map((item) => item.label))).size
  const bridgeMetric = bridgeComparable
    ? {
        label: '% del ejercido estatal',
        kind: 'percent',
        value: institutionShareOfStateBudget,
        note: 'Puente analítico entre el alcance fino y la capa estatal publicada en Atlas.',
      }
    : {
        label: `${labels.items} incluidas`,
        kind: 'count',
        value: scopeEntityCount,
        note: 'Cluster expandido; no se compara 1:1 con el total policial estándar del abierto nacional.',
      }

  return {
    id: pilot.id,
    stateId: pilot.stateId,
    stateName: pilot.stateName,
    year: pilot.year,
    granularity: pilot.granularity,
    institutionId: pilot.institutionId,
    institutionName: pilot.institutionName,
    scopeKind: pilot.scopeKind ?? 'institution',
    source: pilot.source,
    labels,
    totals: pilot.totals,
    bridgeComparable,
    bridgeMetric,
    institutionShareOfStateBudget,
    scopeEntityCount,
    groupCount: groups.length,
    itemCount,
    chapterCount: chapterBreakdown.length,
    conceptCount: itemCount,
    chapterBreakdown,
    groups,
    topItems,
    chapters: groups,
    topConcepts: topItems,
    notes: pilot.notes ?? [],
  }
}

const operationalStates = decorateMonthlyOperationalScores(decorateOperationalStates(mexicoSecurityStudy.rawStates))
const budgetStates = budgetLayer.rawStates
const integratedStates = mergeIntegratedStates(operationalStates, budgetStates)
const benchmarks = buildBenchmarks(integratedStates)
const rankings = buildRankings(integratedStates, dashboardDimensions.map((dimension) => dimension.id))
const nationalMonthly = buildNationalMonthly(operationalStates)
const budgetBenchmarks = buildBudgetBenchmarks(budgetStates)
const budgetRankings = buildBudgetRankings(budgetStates)

export function getStudyOverview() {
  const overviewStates = integratedStates.map((state) => buildOverviewState(state, rankings))
  const budgetOverviewStates = budgetStates.map((state) => buildBudgetOverviewState(state, budgetRankings))
  const defaultState =
    overviewStates.find((state) => state.id === mexicoSecurityStudy.defaultStateId) ??
    [...overviewStates].sort((left, right) => right.score - left.score)[0]

  return {
    id: mexicoSecurityStudy.id,
    title: mexicoSecurityStudy.title,
    subtitle: mexicoSecurityStudy.subtitle,
    lastUpdated: mexicoSecurityStudy.lastUpdated,
    methodology: mexicoSecurityStudy.methodology,
    dimensions: dashboardDimensions,
    operationalWeights: mexicoSecurityStudy.operationalWeights,
    atlasWeights: mexicoSecurityStudy.atlasWeights,
    matrixDimensionIds,
    tableDimensionIds: mexicoSecurityStudy.tableDimensionIds,
    detailMetricIds,
    defaultTrendMetricId: mexicoSecurityStudy.defaultTrendMetricId,
    weights: mexicoSecurityStudy.operationalWeights,
    sources: mexicoSecurityStudy.sources,
    pipeline: mexicoSecurityStudy.pipeline,
    chartGuide: mexicoSecurityStudy.chartGuide,
    visualPrinciples: mexicoSecurityStudy.visualPrinciples,
    budgetLayer: {
      title: budgetLayer.title,
      body: budgetLayer.body,
      year: budgetLayer.year,
      updatedAt: budgetLayer.updatedAt,
      modifiedAt: budgetLayer.modifiedAt,
      metrics: budgetLayer.metrics,
      chapters: budgetLayer.chapters,
      federalFunds: budgetLayer.federalFunds,
      techPlatforms: budgetLayer.techPlatforms,
      sources: budgetLayer.sources,
      rules: budgetLayer.rules,
      fineCoverage: {
        pilotCount: stateBudgetFineData.pilots.length,
        stateIds: stateBudgetFineData.pilots.map((pilot) => pilot.stateId),
        states: stateBudgetFineData.pilots.map((pilot) => ({
          stateId: pilot.stateId,
          stateName: pilot.stateName,
          institutionName: pilot.institutionName,
          granularity: pilot.granularity,
          scopeKind: pilot.scopeKind ?? 'institution',
          comparableToStateBudget: pilot.stateBudgetBridgeComparable !== false,
          year: pilot.year,
          sourceName: pilot.source.name,
        })),
      },
      defaultMetricId: 'budgetPerCapita',
      summaryCards: buildBudgetSummaryCards(budgetStates, budgetBenchmarks, budgetRankings),
      benchmarks: budgetBenchmarks,
      states: budgetOverviewStates,
    },
    summaryCards: buildSummaryCards(integratedStates, benchmarks, rankings, budgetBenchmarks),
    defaultStateId: defaultState.id,
    benchmarks,
    nationalMonthly,
    states: overviewStates,
  }
}

export function getStateDetail(stateId) {
  const state = integratedStates.find((item) => item.id === stateId)
  const budgetState = budgetStates.find((item) => item.id === stateId)

  if (!state || !budgetState) {
    return null
  }

  const stateNarrative = buildStateNarrative(state, benchmarks, rankings)
  const budgetNarrative = buildBudgetNarrative(budgetState)
  const budgetFinePilot = buildBudgetFinePilot(budgetFinePilotsByState.get(stateId), budgetState)

  return {
    state: {
      ...buildOverviewState(state, rankings),
      lede: stateNarrative.lede,
      caution: stateNarrative.caution,
      comparisons: buildComparisonTiles(state, benchmarks),
      metricCards: detailMetricIds.map((metricId) => buildMetricCard(state, metricId, benchmarks, rankings)),
      drivers: buildAtlasDrivers(state, benchmarks),
      monthly: state.monthly,
    },
    budget: {
      ...buildBudgetOverviewState(budgetState, budgetRankings),
      lede: budgetNarrative.lede,
      caution: budgetNarrative.caution,
      comparisons: buildBudgetComparisonTiles(budgetState, budgetBenchmarks),
      qualityNotes: buildBudgetQualityNotes(budgetState),
      fineDetail: budgetFinePilot,
    },
    benchmarks,
    nationalMonthly,
    budgetBenchmarks,
  }
}

export function getCityDetail(_stateId, _cityId) {
  return null
}
