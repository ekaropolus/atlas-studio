import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parse } from 'csv-parse'
import { parse as parseSync } from 'csv-parse/sync'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const cacheDir = path.join(rootDir, '.cache', 'sources')
const outputDir = path.join(rootDir, 'server', 'data', 'generated')

const crimeUrl =
  'https://repodatos.atdt.gob.mx/api_update/sesnsp/incidencia_delictiva/INM_estatal_dic25.csv'
const populationUrl =
  'https://www.datos.gob.mx/dataset/f2b9b220-3ef7-4e3a-bde6-87e1dac78c6a/resource/b4fe49a8-c86a-4c32-8450-8f3c4cc83125/download/05_indicadores_demograficos_proyecciones.csv'
const budgetUrl =
  'https://www.inegi.org.mx/contenidos/programas/cnspe/2025/datosabiertos/m1/conjunto_de_datos_rec_presup_cnspe2025_csv.zip'

const crimeFile = path.join(cacheDir, 'INM_estatal_dic25.csv')
const populationFile = path.join(cacheDir, '05_indicadores_demograficos_proyecciones.csv')
const budgetFile = path.join(cacheDir, 'conjunto_de_datos_rec_presup_cnspe2025_csv.zip')
const crimeOutputFile = path.join(outputDir, 'stateCrimeData.mjs')
const budgetOutputFile = path.join(outputDir, 'stateBudgetData.mjs')

const regionByCode = {
  '01': 'Bajio',
  '02': 'Frontera norte',
  '03': 'Noroeste',
  '04': 'Peninsula',
  '05': 'Frontera norte',
  '06': 'Occidente',
  '07': 'Sur',
  '08': 'Frontera norte',
  '09': 'Centro',
  '10': 'Noroeste',
  '11': 'Bajio',
  '12': 'Sur',
  '13': 'Centro',
  '14': 'Occidente',
  '15': 'Centro',
  '16': 'Occidente',
  '17': 'Centro',
  '18': 'Occidente',
  '19': 'Frontera norte',
  '20': 'Sur',
  '21': 'Centro',
  '22': 'Bajio',
  '23': 'Peninsula',
  '24': 'Bajio',
  '25': 'Noroeste',
  '26': 'Noroeste',
  '27': 'Golfo',
  '28': 'Frontera norte',
  '29': 'Centro',
  '30': 'Golfo',
  '31': 'Peninsula',
  '32': 'Bajio',
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const missingCodes = new Set(['', 'NA', 'NSS', 'ND', 'NP', 'NULL'])

const trackedMetrics = [
  {
    key: 'homicide',
    label: 'Homicidio doloso',
    match: (row) => row.tipo_delito === 'Homicidio' && row.subtipo_delito === 'Homicidio doloso',
  },
  {
    key: 'extortion',
    label: 'Extorsion',
    match: (row) => row.tipo_delito === 'Extorsión',
  },
  {
    key: 'robberyViolence',
    label: 'Robo con violencia',
    match: (row) => row.tipo_delito === 'Robo' && /Con violencia/i.test(row.modalidad || ''),
  },
  {
    key: 'violenceFamily',
    label: 'Violencia familiar',
    match: (row) => row.tipo_delito === 'Violencia familiar',
  },
  {
    key: 'narcomenudeo',
    label: 'Narcomenudeo',
    match: (row) => row.tipo_delito === 'Narcomenudeo',
  },
]

const chapterDefinitions = [
  { id: 'capobg1', code: '1000', label: 'Servicios personales' },
  { id: 'capobg2', code: '2000', label: 'Materiales y suministros' },
  { id: 'capobg3', code: '3000', label: 'Servicios generales' },
  { id: 'capobg4', code: '4000', label: 'Transferencias y subsidios' },
  { id: 'capobg5', code: '5000', label: 'Bienes muebles e intangibles' },
  { id: 'capobg6', code: '6000', label: 'Inversion publica' },
  { id: 'capobg7', code: '7000', label: 'Inversiones financieras' },
  { id: 'capobg8', code: '8000', label: 'Participaciones y aportaciones' },
  { id: 'capobg9', code: '9000', label: 'Deuda publica' },
]

const federalFundDefinitions = [
  { id: 'ssubsi1', label: 'FASP' },
  { id: 'ssubsi2', label: 'FOFISP' },
  { id: 'ssubsi3', label: 'Otro fondo o subsidio' },
]

const techPlatformDefinitions = [
  { id: 'prplte1', label: 'Plataforma Mexico' },
  { id: 'prplte2', label: 'Red nacional de radiocomunicacion' },
  { id: 'prplte3', label: 'REPUVE' },
  { id: 'prplte4', label: 'Videovigilancia y geolocalizacion' },
  { id: 'prplte5', label: 'Otras plataformas' },
  { id: 'prpltene', label: 'No especificado' },
]

function round(value, digits = 1) {
  return Number(value.toFixed(digits))
}

function sum(values) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0)
}

function currentMexicoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
  }).format(new Date())
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readZipEntry(zipPath, entryPath) {
  const output = spawnSync('unzip', ['-p', zipPath, entryPath], {
    encoding: 'utf8',
  })

  if (output.status !== 0) {
    throw new Error(`ZIP_ENTRY_READ_FAILED:${entryPath}`)
  }

  return output.stdout
}

function parseNumericCell(rawValue, options = {}) {
  const normalized = String(rawValue ?? '').trim()

  if (!normalized) {
    return { value: null, status: 'missing' }
  }

  if (normalized === 'NA') {
    return { value: options.naAsZero ? 0 : null, status: 'na' }
  }

  if (normalized === 'NSS') {
    return { value: null, status: 'nss' }
  }

  if (normalized === 'ND') {
    return { value: null, status: 'nd' }
  }

  if (normalized === 'NP') {
    return { value: null, status: 'np' }
  }

  if (normalized === 'NULL') {
    return { value: null, status: 'null' }
  }

  const numericValue = Number(normalized)
  return {
    value: Number.isFinite(numericValue) ? numericValue : null,
    status: Number.isFinite(numericValue) ? 'reported' : 'invalid',
  }
}

function parseYesNoCode(rawValue) {
  const normalized = String(rawValue ?? '').trim()

  if (normalized === '1') {
    return 'yes'
  }

  if (normalized === '2') {
    return 'no'
  }

  if (normalized === '0') {
    return 'not-applicable'
  }

  if (missingCodes.has(normalized)) {
    return 'missing'
  }

  return 'unknown'
}

function writeGeneratedModule(outputFile, exportName, payload) {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputFile, `export const ${exportName} = ${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function ensureDownload(url, targetFile) {
  if (fs.existsSync(targetFile)) {
    return
  }

  fs.mkdirSync(path.dirname(targetFile), { recursive: true })

  const response = await fetch(url)

  if (!response.ok || !response.body) {
    throw new Error(`DOWNLOAD_FAILED:${url}`)
  }

  const writable = fs.createWriteStream(targetFile)

  await new Promise((resolve, reject) => {
    Readable.fromWeb(response.body).pipe(writable)
    writable.on('finish', resolve)
    writable.on('error', reject)
  })
}

async function loadPopulationsByYear() {
  await ensureDownload(populationUrl, populationFile)

  const populationsByYear = new Map()
  const parser = fs
    .createReadStream(populationFile)
    .pipe(parse({ columns: true, skip_empty_lines: true }))

  for await (const row of parser) {
    const code = String(row.CVE_GEO).padStart(2, '0')

    if (code === '00') {
      continue
    }

    const year = String(row.ANIO)
    const population = Number(row.POB_MIT_ANIO)

    if (!Number.isFinite(population)) {
      continue
    }

    if (!populationsByYear.has(year)) {
      populationsByYear.set(year, new Map())
    }

    populationsByYear.get(year).set(code, {
      code,
      name: row.ENTIDAD_FEDERATIVA,
      population,
    })
  }

  return populationsByYear
}

function emptyMonthlyRow(monthIndex) {
  return {
    monthIndex,
    month: monthNames[monthIndex - 1],
    homicideCount: 0,
    extortionCount: 0,
    robberyViolenceCount: 0,
    violenceFamilyCount: 0,
    narcomenudeoCount: 0,
    totalCrimeCount: 0,
  }
}

async function loadCrime(populations) {
  await ensureDownload(crimeUrl, crimeFile)

  const states = new Map()
  const parser = fs
    .createReadStream(crimeFile)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }))

  for await (const row of parser) {
    if (String(row.anio) !== '2025') {
      continue
    }

    const code = String(row.clave_ent).padStart(2, '0')
    const populationRow = populations.get(code)

    if (!populationRow) {
      continue
    }

    if (!states.has(code)) {
      states.set(code, {
        id: slugify(populationRow.name),
        code,
        name: populationRow.name,
        region: regionByCode[code] ?? 'Mexico',
        population: populationRow.population,
        homicideCount: 0,
        extortionCount: 0,
        robberyViolenceCount: 0,
        violenceFamilyCount: 0,
        narcomenudeoCount: 0,
        totalCrimeCount: 0,
        monthly: monthNames.map((_month, index) => emptyMonthlyRow(index + 1)),
      })
    }

    const state = states.get(code)
    const count = Number(row.incidencia_delictiva || 0)
    const monthIndex = Number(String(row.fecha).slice(5, 7))
    const monthly = state.monthly[monthIndex - 1]

    state.totalCrimeCount += count
    monthly.totalCrimeCount += count

    trackedMetrics.forEach((metric) => {
      if (!metric.match(row)) {
        return
      }

      const annualKey = `${metric.key}Count`
      const monthlyKey = `${metric.key}Count`
      state[annualKey] += count
      monthly[monthlyKey] += count
    })
  }

  return [...states.values()].sort((left, right) => left.code.localeCompare(right.code))
}

function enrichCrimeStates(states) {
  return states.map((state) => {
    const rateFor = (count) => round((count / state.population) * 100000, 1)

    const monthly = state.monthly.map((month) => ({
      ...month,
      homicideRate: rateFor(month.homicideCount),
      extortionRate: rateFor(month.extortionCount),
      robberyViolenceRate: rateFor(month.robberyViolenceCount),
      violenceFamilyRate: rateFor(month.violenceFamilyCount),
      narcomenudeoRate: rateFor(month.narcomenudeoCount),
      totalCrimeRate: rateFor(month.totalCrimeCount),
    }))

    return {
      id: state.id,
      code: state.code,
      name: state.name,
      region: state.region,
      population: state.population,
      homicideCount: state.homicideCount,
      homicideRate: rateFor(state.homicideCount),
      extortionCount: state.extortionCount,
      extortionRate: rateFor(state.extortionCount),
      robberyViolenceCount: state.robberyViolenceCount,
      robberyViolenceRate: rateFor(state.robberyViolenceCount),
      violenceFamilyCount: state.violenceFamilyCount,
      violenceFamilyRate: rateFor(state.violenceFamilyCount),
      narcomenudeoCount: state.narcomenudeoCount,
      narcomenudeoRate: rateFor(state.narcomenudeoCount),
      totalCrimeCount: state.totalCrimeCount,
      totalCrimeRate: rateFor(state.totalCrimeCount),
      monthly,
    }
  })
}

function baseBudgetState(populationRow) {
  return {
    id: slugify(populationRow.name),
    code: populationRow.code,
    name: populationRow.name,
    region: regionByCode[populationRow.code] ?? 'Mexico',
    population: populationRow.population,
    budgetProjected: null,
    budgetApproved: null,
    budgetExercised: null,
    chapters: chapterDefinitions.map((chapter) => ({
      ...chapter,
      amount: null,
      status: 'missing',
      shareOfExercised: null,
      perCapita: null,
    })),
    federalFundsTotal: null,
    federalFundsStatus: 'missing',
    federalFunds: federalFundDefinitions.map((fund) => ({
      ...fund,
      amount: null,
      status: 'missing',
      shareOfExercised: null,
    })),
    privateContributionTotal: null,
    privateContributionStatus: 'missing',
    privateContributionShare: null,
    techPlatformSpend: null,
    techPlatformStatus: 'missing',
    techPlatforms: techPlatformDefinitions.map((platform) => ({
      ...platform,
      amount: null,
      status: 'missing',
      shareOfExercised: null,
    })),
  }
}

async function loadBudget(populations) {
  await ensureDownload(budgetUrl, budgetFile)

  const totalsRows = parseSync(readZipEntry(budgetFile, 'conjunto_de_datos/m1s4p1_cnspe2025.csv'), {
    columns: true,
    skip_empty_lines: true,
  })
  const chaptersRows = parseSync(readZipEntry(budgetFile, 'conjunto_de_datos/m1s4p2_cnspe2025.csv'), {
    columns: true,
    skip_empty_lines: true,
  })
  const fundsRows = parseSync(readZipEntry(budgetFile, 'conjunto_de_datos/m1s4p3_cnspe2025.csv'), {
    columns: true,
    skip_empty_lines: true,
  })
  const privateRows = parseSync(readZipEntry(budgetFile, 'conjunto_de_datos/m1s4p4_cnspe2025.csv'), {
    columns: true,
    skip_empty_lines: true,
  })
  const techRows = parseSync(readZipEntry(budgetFile, 'conjunto_de_datos/m1s4p5_cnspe2025.csv'), {
    columns: true,
    skip_empty_lines: true,
  })

  const states = new Map(
    [...populations.values()].map((populationRow) => [populationRow.code, baseBudgetState(populationRow)]),
  )

  totalsRows.forEach((row) => {
    const code = String(row.cve_ent).padStart(2, '0')
    const state = states.get(code)

    if (!state) {
      return
    }

    state.budgetProjected = parseNumericCell(row.presup1).value
    state.budgetApproved = parseNumericCell(row.presup2).value
    state.budgetExercised = parseNumericCell(row.presup3).value
  })

  chaptersRows.forEach((row) => {
    const code = String(row.cve_ent).padStart(2, '0')
    const state = states.get(code)

    if (!state) {
      return
    }

    state.chapters = chapterDefinitions.map((chapter) => {
      const parsed = parseNumericCell(row[chapter.id])
      return {
        ...chapter,
        amount: parsed.value,
        status: parsed.status,
        shareOfExercised: null,
        perCapita: null,
      }
    })
  })

  fundsRows.forEach((row) => {
    const code = String(row.cve_ent).padStart(2, '0')
    const state = states.get(code)

    if (!state) {
      return
    }

    const receiptStatus = parseYesNoCode(row.rnsnni1)
    const total = parseNumericCell(row.ssubsitt, { naAsZero: receiptStatus === 'no' })

    state.federalFundsStatus = receiptStatus
    state.federalFundsTotal = total.value
    state.federalFunds = federalFundDefinitions.map((fund) => {
      const parsed = parseNumericCell(row[fund.id], { naAsZero: receiptStatus === 'no' })
      return {
        ...fund,
        amount: parsed.value,
        status: parsed.status,
        shareOfExercised: null,
      }
    })
  })

  privateRows.forEach((row) => {
    const code = String(row.cve_ent).padStart(2, '0')
    const state = states.get(code)

    if (!state) {
      return
    }

    const receiptStatus = parseYesNoCode(row.rnsnni1)
    const total = parseNumericCell(row.totalca1, { naAsZero: receiptStatus === 'no' })

    state.privateContributionStatus = receiptStatus
    state.privateContributionTotal = total.value
  })

  techRows.forEach((row) => {
    const code = String(row.cve_ent).padStart(2, '0')
    const state = states.get(code)

    if (!state) {
      return
    }

    const total = parseNumericCell(row.prpltett)
    state.techPlatformStatus = total.status
    state.techPlatformSpend = total.value
    state.techPlatforms = techPlatformDefinitions.map((platform) => {
      const parsed = parseNumericCell(row[platform.id])
      return {
        ...platform,
        amount: parsed.value,
        status: parsed.status,
        shareOfExercised: null,
      }
    })
  })

  return [...states.values()]
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((state) => enrichBudgetState(state))
}

function enrichBudgetState(state) {
  const budgetExercised = state.budgetExercised
  const budgetPerCapita =
    Number.isFinite(budgetExercised) && state.population ? round(budgetExercised / state.population, 1) : null

  const chapters = state.chapters.map((chapter) => ({
    ...chapter,
    shareOfExercised:
      Number.isFinite(chapter.amount) && Number.isFinite(budgetExercised) && budgetExercised > 0
        ? round(chapter.amount / budgetExercised, 4)
        : null,
    perCapita:
      Number.isFinite(chapter.amount) && state.population ? round(chapter.amount / state.population, 1) : null,
  }))

  const chapterReportedAmount = sum(chapters.map((chapter) => chapter.amount))
  const chapterReportedCount = chapters.filter((chapter) => Number.isFinite(chapter.amount)).length
  const topChapter = [...chapters]
    .filter((chapter) => Number.isFinite(chapter.amount))
    .sort((left, right) => right.amount - left.amount)[0]

  const federalFunds = state.federalFunds.map((fund) => ({
    ...fund,
    shareOfExercised:
      Number.isFinite(fund.amount) && Number.isFinite(budgetExercised) && budgetExercised > 0
        ? round(fund.amount / budgetExercised, 4)
        : null,
  }))

  const techPlatforms = state.techPlatforms.map((platform) => ({
    ...platform,
    shareOfExercised:
      Number.isFinite(platform.amount) && Number.isFinite(budgetExercised) && budgetExercised > 0
        ? round(platform.amount / budgetExercised, 4)
        : null,
  }))

  const federalFundsShare =
    Number.isFinite(state.federalFundsTotal) && Number.isFinite(budgetExercised) && budgetExercised > 0
      ? round(state.federalFundsTotal / budgetExercised, 4)
      : null

  const privateContributionShare =
    Number.isFinite(state.privateContributionTotal) && Number.isFinite(budgetExercised) && budgetExercised > 0
      ? round(state.privateContributionTotal / budgetExercised, 4)
      : null

  const techPlatformShare =
    Number.isFinite(state.techPlatformSpend) && Number.isFinite(budgetExercised) && budgetExercised > 0
      ? round(state.techPlatformSpend / budgetExercised, 4)
      : null

  const chapterCoverageRatio =
    Number.isFinite(chapterReportedAmount) && Number.isFinite(budgetExercised) && budgetExercised > 0
      ? round(chapterReportedAmount / budgetExercised, 4)
      : null

  const qualityFlags = []

  if (!Number.isFinite(budgetExercised)) {
    qualityFlags.push('missing_budget_exercised')
  }

  if (chapterReportedCount !== chapterDefinitions.length) {
    qualityFlags.push('partial_chapter_breakdown')
  }

  if (Number.isFinite(chapterCoverageRatio) && Math.abs(chapterCoverageRatio - 1) > 0.05) {
    qualityFlags.push('chapter_total_gap')
  }

  if (state.federalFundsStatus === 'missing' || state.federalFundsStatus === 'unknown') {
    qualityFlags.push('federal_funds_status_unresolved')
  }

  return {
    ...state,
    budgetPerCapita,
    chapters,
    chapterReportedAmount,
    chapterCoverageRatio,
    chapterDifference:
      Number.isFinite(chapterReportedAmount) && Number.isFinite(budgetExercised)
        ? chapterReportedAmount - budgetExercised
        : null,
    topChapterId: topChapter?.id ?? null,
    topChapterCode: topChapter?.code ?? null,
    topChapterLabel: topChapter?.label ?? null,
    topChapterAmount: topChapter?.amount ?? null,
    topChapterShare: topChapter?.shareOfExercised ?? null,
    federalFunds,
    federalFundsShare,
    privateContributionShare,
    techPlatforms,
    techPlatformShare,
    quality: {
      flags: qualityFlags,
      hasBudgetExercised: Number.isFinite(budgetExercised),
      chapterReportedCount,
      chapterTotalCount: chapterDefinitions.length,
    },
  }
}

function buildCrimePayload(states) {
  return {
    generatedAt: currentMexicoDate(),
    sourceCuts: {
      crime: {
        name: 'SESNSP incidencia delictiva estatal',
        url: crimeUrl,
        file: path.basename(crimeFile),
        year: 2025,
      },
      population: {
        name: 'Proyecciones de poblacion por entidad',
        url: populationUrl,
        file: path.basename(populationFile),
        year: 2025,
      },
    },
    states,
  }
}

function buildBudgetPayload(states) {
  return {
    generatedAt: currentMexicoDate(),
    sourceCuts: {
      budget: {
        name: 'INEGI CNSPE 2025 recursos presupuestales',
        url: budgetUrl,
        file: path.basename(budgetFile),
        year: 2024,
        modified: '2026-03-17',
      },
      population: {
        name: 'Proyecciones de poblacion por entidad',
        url: populationUrl,
        file: path.basename(populationFile),
        year: 2024,
      },
    },
    chapters: chapterDefinitions,
    federalFunds: federalFundDefinitions,
    techPlatforms: techPlatformDefinitions,
    states,
  }
}

async function main() {
  const populationsByYear = await loadPopulationsByYear()
  const populations2025 = populationsByYear.get('2025')
  const populations2024 = populationsByYear.get('2024')

  if (!populations2025 || !populations2024) {
    throw new Error('POPULATION_YEAR_MISSING')
  }

  const crimeStates = enrichCrimeStates(await loadCrime(populations2025))
  const budgetStates = await loadBudget(populations2024)

  writeGeneratedModule(crimeOutputFile, 'stateCrimeData', buildCrimePayload(crimeStates))
  writeGeneratedModule(budgetOutputFile, 'stateBudgetData', buildBudgetPayload(budgetStates))

  console.log(`Generated ${crimeStates.length} crime states into ${crimeOutputFile}`)
  console.log(`Generated ${budgetStates.length} budget states into ${budgetOutputFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
