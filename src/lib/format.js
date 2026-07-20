const integerFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

const decimalFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const compactFormatter = new Intl.NumberFormat('es-MX', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('es-MX', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isMissing(value) {
  return value === null || value === undefined || Number.isNaN(value)
}

function formatCompactCurrencyValue(value) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absolute >= 1000000000) {
    return `${sign}$${decimalFormatter.format(absolute / 1000000000)} mil M`
  }

  if (absolute >= 1000000) {
    return `${sign}$${decimalFormatter.format(absolute / 1000000)} M`
  }

  if (absolute >= 1000) {
    return `${sign}$${decimalFormatter.format(absolute / 1000)} mil`
  }

  return `${sign}${currencyFormatter.format(absolute)}`
}

export function formatCurrencyValue(value, { compact = false } = {}) {
  if (isMissing(value)) {
    return 'Sin dato'
  }

  return compact ? formatCompactCurrencyValue(value) : currencyFormatter.format(value)
}

export function formatPercentValue(value) {
  if (isMissing(value)) {
    return 'Sin dato'
  }

  return percentFormatter.format(value)
}

export function formatMetricValue(value, metricId) {
  if (isMissing(value)) {
    return 'Sin dato'
  }

  if (metricId === 'score' || metricId === 'operationalScore' || metricId === 'capacityScore') {
    return integerFormatter.format(value)
  }

  if (metricId === 'population') {
    return integerFormatter.format(value)
  }

  if (metricId === 'perceptionRate' || metricId === 'trustRate') {
    return `${integerFormatter.format(value)}%`
  }

  if (metricId === 'budgetExercised' || metricId === 'budgetApproved' || metricId === 'budgetProjected') {
    return formatCurrencyValue(value, { compact: true })
  }

  if (metricId === 'federalFundsTotal' || metricId === 'techPlatformSpend' || metricId === 'privateContributionTotal') {
    return formatCurrencyValue(value, { compact: true })
  }

  if (metricId === 'budgetPerCapita') {
    return formatCurrencyValue(value)
  }

  if (metricId.endsWith('Share')) {
    return formatPercentValue(value)
  }

  if (metricId.endsWith('Count')) {
    return integerFormatter.format(value)
  }

  return decimalFormatter.format(value)
}

export function formatDriverValue(value) {
  return `${integerFormatter.format(value)} pts`
}

export function formatCompactValue(value) {
  return compactFormatter.format(value)
}

export function formatAxisMetricValue(value, metricId) {
  if (metricId === 'score' || metricId === 'operationalScore' || metricId === 'capacityScore') {
    return integerFormatter.format(value)
  }

  if (metricId === 'budgetExercised' || metricId === 'budgetApproved' || metricId === 'budgetProjected') {
    return formatCurrencyValue(value, { compact: true })
  }

  if (metricId === 'federalFundsTotal' || metricId === 'techPlatformSpend' || metricId === 'privateContributionTotal') {
    return formatCurrencyValue(value, { compact: true })
  }

  if (metricId === 'budgetPerCapita') {
    return formatCurrencyValue(value)
  }

  if (metricId.endsWith('Share')) {
    return formatPercentValue(value)
  }

  return formatMetricValue(value, metricId)
}

export function formatDateTimeValue(value) {
  if (!value) {
    return 'Sin dato'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Sin dato'
  }

  return dateTimeFormatter.format(parsed)
}
