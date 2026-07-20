import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const cacheDir = path.join(rootDir, '.cache', 'sources')
const outputDir = path.join(rootDir, 'server', 'data', 'generated')
const outputFile = path.join(outputDir, 'stateBudgetFineData.mjs')

const chapterCatalog = [
  { code: '1000', label: 'Servicios personales' },
  { code: '2000', label: 'Materiales y suministros' },
  { code: '3000', label: 'Servicios generales' },
  { code: '4000', label: 'Transferencias, asignaciones, subsidios y otras ayudas' },
  { code: '5000', label: 'Bienes muebles, inmuebles e intangibles' },
  { code: '6000', label: 'Inversion publica' },
  { code: '7000', label: 'Inversiones financieras y otras provisiones' },
  { code: '8000', label: 'Participaciones y aportaciones' },
  { code: '9000', label: 'Deuda publica' },
]

const defaultFineLabels = {
  scope: 'Dependencia',
  group: 'Capitulo',
  groups: 'Capitulos',
  item: 'Concepto',
  items: 'Conceptos',
  topItem: 'Top concepto',
  tableTitle: 'Tabla por concepto',
}

const cdmxProgramLabelById = {
  '123009E168': 'Sistema Penitenciario',
  '171063E169': 'Prevención del delito y seguridad ciudadana',
  '123322E194': 'Atención a Personas Sujetas al Sistema Integral de Justicia para Adolescentes',
  '123009K019': 'Construcción, mantenimiento y operación de la infraestructura del Sistema Penitenciario',
  '171313M001': 'Actividades de Apoyo Administrativo',
  '171298M002': 'Provisiones para contingencias',
  '172002N001': 'Cumplimiento de los Programas de Protección Civil',
  '171055U047': 'Acciones del Consejo Ciudadano para la Seguridad y Justicia',
}

const fineSourceSpecs = [
  {
    key: 'queretaroSscCog',
    stateId: 'queretaro',
    stateName: 'Querétaro',
    year: 2024,
    dependencyLabel: 'Secretaría de Seguridad Ciudadana',
    granularity: 'Clasificación por objeto del gasto (capítulo y concepto)',
    url: 'https://cuentapublica2024.queretaro.gob.mx/sites/default/files/CUENTA_PUBLICA/EJECUTIVO/cogPEEQ_Dependencia.pdf',
    file: 'queretaro-cogPEEQ_Dependencia-2024.pdf',
    parser: parseQueretaroSecurityCitizenConcepts,
  },
  {
    key: 'cdmxSscCuentaPublica',
    stateId: 'ciudad-de-mexico',
    stateName: 'Ciudad de México',
    year: 2024,
    dependencyLabel: '11C001 Secretaría de Seguridad Ciudadana',
    granularity: 'Cuenta pública por capítulo de gasto y programa presupuestario',
    url: 'https://data.ssc.cdmx.gob.mx/TransparenciaSSP/sitio_sspdf/LTAPRCCDMX2018/art_123/fraccion_xvii/VINCULOS/CUENTA_PUBLICA_SSC_2024.pdf',
    file: 'cdmx-ssc-cuenta-publica-2024.pdf',
    insecureTls: true,
    parser: parseCdmxSecurityCitizenBudget,
  },
  {
    key: 'oaxacaSecurityClusterAdministrative',
    stateId: 'oaxaca',
    stateName: 'Oaxaca',
    year: 2024,
    dependencyLabel: 'Cluster estatal de seguridad y protección',
    granularity: 'Clasificación administrativa del cluster de seguridad pública',
    url: 'https://ceaco.finanzasoaxaca.gob.mx/pdf/ejecutivo/2024/cuenta-publica/Estado%20Analitico%20-%20LDF%20%28Clasificacion%20Administrativa%29.pdf',
    file: 'oaxaca-cuenta-publica-2024-administrativa.pdf',
    parser: parseOaxacaSecurityClusterAdministrative,
  },
]

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

function parseMoney(rawValue) {
  const normalized = String(rawValue ?? '')
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .trim()

  if (!normalized || normalized === '-') {
    return 0
  }

  return Number(normalized)
}

function round(value, digits = 4) {
  return Number(value.toFixed(digits))
}

function writeGeneratedModule(exportName, payload) {
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputFile, `export const ${exportName} = ${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function ensureBinary(command) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' })

  if (probe.error && probe.error.code === 'ENOENT') {
    throw new Error(`${command.toUpperCase()}_NOT_FOUND`)
  }
}

function ensurePdfToText() {
  const probe = spawnSync('pdftotext', ['-v'], {
    encoding: 'utf8',
  })

  if (probe.error && probe.error.code === 'ENOENT') {
    throw new Error('PDFTOTEXT_NOT_FOUND')
  }
}

function curlArgs(spec) {
  return spec.insecureTls ? ['-k'] : []
}

function ensureDownload(spec) {
  const targetFile = path.join(cacheDir, spec.file)

  if (fs.existsSync(targetFile)) {
    return targetFile
  }

  fs.mkdirSync(cacheDir, { recursive: true })
  execFileSync('curl', [...curlArgs(spec), '-L', '--fail', '-o', targetFile, spec.url], {
    stdio: 'inherit',
  })
  return targetFile
}

function getRemoteMetadata(spec, localFile) {
  try {
    const headers = execFileSync('curl', [...curlArgs(spec), '-sI', '-L', spec.url], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 4,
    })

    const lastModified = headers.match(/^last-modified:\s*(.+)$/im)?.[1]?.trim() ?? null
    const contentLengthHeader = headers.match(/^content-length:\s*(\d+)$/im)?.[1] ?? null

    return {
      lastModified,
      contentLength: contentLengthHeader ? Number(contentLengthHeader) : fs.statSync(localFile).size,
    }
  } catch {
    return {
      lastModified: null,
      contentLength: fs.statSync(localFile).size,
    }
  }
}

function extractText(pdfFile) {
  return execFileSync('pdftotext', ['-layout', pdfFile, '-'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  })
}

function amountRecord(approved, adjustments, modified, devengado, pagado, subexercise) {
  return {
    approved: parseMoney(approved),
    adjustments: parseMoney(adjustments),
    modified: parseMoney(modified),
    devengado: parseMoney(devengado),
    pagado: parseMoney(pagado),
    subexercise: parseMoney(subexercise),
  }
}

function decorateGroupItems(groups, totalDevengado) {
  return groups.map((group) => {
    const items = group.items.map((item) => ({
      ...item,
      shareOfScope: totalDevengado > 0 ? round(item.devengado / totalDevengado) : null,
      shareOfGroup: group.devengado > 0 ? round(item.devengado / group.devengado) : null,
    }))

    const topItem = [...items].sort((left, right) => right.devengado - left.devengado)[0]

    return {
      ...group,
      shareOfScope: totalDevengado > 0 ? round(group.devengado / totalDevengado) : null,
      itemCount: items.length,
      topItemId: topItem?.id ?? null,
      topItemLabel: topItem?.label ?? null,
      topItemDevengado: topItem?.devengado ?? null,
      items,
    }
  })
}

function buildFineLabels(overrides = {}) {
  return {
    ...defaultFineLabels,
    ...overrides,
  }
}

function chapterBreakdownFromGroups(groups) {
  return groups.map(({ items, ...group }) => ({
    ...group,
  }))
}

function buildTopItemsFromGroups(groups, limit = 12) {
  return groups
    .flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupId: group.id,
        groupCode: group.code ?? null,
        groupLabel: group.label,
      })),
    )
    .sort((left, right) => right.devengado - left.devengado)
    .slice(0, limit)
}

function parseQueretaroSecurityCitizenConcepts(text, spec) {
  const lines = text.split(/\r?\n/)
  let collecting = false
  let pending = ''
  let total = null
  const rows = []
  const rowPattern = /^(.*?)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s+(-?[\d,]+)\s*$/
  const skipPattern =
    /^(PODER EJECUTIVO|EJERCICIO|ESTADO ANALÍTICO|CLASIFICACIÓN POR OBJETO|DEL 01|\(PESOS\)|EGRESOS|CONCEPTO|AMPLIACIONES|SUBEJERCICIO|APROBADO|MODIFICADO|DEVENGADO|PAGADO|1\s+2\s+3|Pág\.)/
  const continuationOnly = new Set(['ARTÍCULOS OFICIALES', 'COMERCIALIZACIÓN', 'DEPORTIVOS', 'CONSERVACIÓN', 'SERVICIOS'])
  const chapterLookup = new Map(chapterCatalog.map((chapter) => [chapter.label.toUpperCase(), chapter]))

  for (const rawLine of lines) {
    const line = rawLine.replace(/\f/g, '').trimEnd()
    const trimmed = line.trim()

    if (!collecting) {
      if (trimmed === 'SECRETARÍA DE SEGURIDAD CIUDADANA') {
        collecting = true
      }
      continue
    }

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('TOTAL DEL GASTO')) {
      const match = line.match(rowPattern)
      if (match) {
        total = amountRecord(match[2], match[3], match[4], match[5], match[6], match[7])
      }
      break
    }

    if (skipPattern.test(trimmed)) {
      continue
    }

    if (continuationOnly.has(trimmed) && rows.length) {
      rows[rows.length - 1].label = `${rows[rows.length - 1].label} ${trimmed}`.replace(/\s+/g, ' ').trim()
      continue
    }

    const rowMatch = line.match(rowPattern)
    if (rowMatch) {
      const label = `${pending} ${rowMatch[1]}`.replace(/\s+/g, ' ').trim()
      const canonicalLabel = label.toUpperCase()
      const catalogChapter = chapterLookup.get(canonicalLabel)

      rows.push({
        type: catalogChapter ? 'chapter' : 'item',
        chapterCode: catalogChapter?.code ?? null,
        label,
        ...amountRecord(rowMatch[2], rowMatch[3], rowMatch[4], rowMatch[5], rowMatch[6], rowMatch[7]),
      })
      pending = ''
      continue
    }

    pending = `${pending} ${trimmed}`.trim()
  }

  if (!rows.length || !total) {
    throw new Error('QRO_SSC_PARSE_FAILED')
  }

  const rawGroups = []
  let activeGroup = null

  rows.forEach((row) => {
    if (row.type === 'chapter') {
      activeGroup = {
        id: `qro-ssc-${row.chapterCode}`,
        code: row.chapterCode,
        label: row.label,
        approved: row.approved,
        adjustments: row.adjustments,
        modified: row.modified,
        devengado: row.devengado,
        pagado: row.pagado,
        subexercise: row.subexercise,
        items: [],
      }
      rawGroups.push(activeGroup)
      return
    }

    if (!activeGroup) {
      return
    }

    activeGroup.items.push({
      id: `${activeGroup.code}-${slugify(row.label)}`,
      code: null,
      chapterCode: activeGroup.code,
      label: row.label,
      approved: row.approved,
      adjustments: row.adjustments,
      modified: row.modified,
      devengado: row.devengado,
      pagado: row.pagado,
      subexercise: row.subexercise,
    })
  })

  const groups = decorateGroupItems(rawGroups, total.devengado)

  return {
    id: 'queretaro-ssc-2024',
    stateId: spec.stateId,
    stateName: spec.stateName,
    year: spec.year,
    granularity: 'capitulo-concepto',
    institutionId: 'secretaria-seguridad-ciudadana',
    institutionName: 'Secretaría de Seguridad Ciudadana',
    scopeKind: 'institution',
    stateBudgetBridgeComparable: true,
    labels: buildFineLabels(),
    source: {
      name: 'Cuenta Pública 2024 Querétaro · COG por dependencia',
      file: spec.file,
      url: spec.url,
      dependencyLabel: spec.dependencyLabel,
    },
    totals: total,
    chapterBreakdown: chapterBreakdownFromGroups(groups),
    groups,
    topItems: buildTopItemsFromGroups(groups),
    notes: [
      'La cuenta pública de Querétaro sí permite bajar de capítulo a concepto dentro de la Secretaría de Seguridad Ciudadana.',
      'Esta capa sigue siendo institucional y se usa como puente analítico contra el gasto estatal visible en CNSPE.',
      'La siguiente bajada natural sería partida genérica y partida específica armonizada.',
    ],
  }
}

function parseCdmxChapterTotals(text) {
  const lines = text.split(/\r?\n/)
  let collecting = false
  let total = null
  const chapters = []
  const totalPattern =
    /^\s*Total URG\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/
  const chapterPattern =
    /^\s*(\d{4})\s*(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/
  const chapterLabelByCode = new Map(chapterCatalog.map((chapter) => [chapter.code, chapter.label]))

  for (const rawLine of lines) {
    const line = rawLine.replace(/\f/g, '').trimEnd()
    const trimmed = line.trim()

    if (!collecting) {
      if (trimmed.includes('ECG EGRESOS POR CAPÍTULO DE GASTO')) {
        collecting = true
      }
      continue
    }

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('E-RAA Egresos con Recursos de Aplicación Automática')) {
      break
    }

    const totalMatch = line.match(totalPattern)
    if (totalMatch) {
      const approved = parseMoney(totalMatch[1])
      const modified = parseMoney(totalMatch[2])
      const devengado = parseMoney(totalMatch[4])
      const pagado = parseMoney(totalMatch[6])

      total = {
        approved,
        adjustments: round(modified - approved, 2),
        modified,
        devengado,
        pagado,
        subexercise: round(modified - devengado, 2),
      }
      continue
    }

    const chapterMatch = line.match(chapterPattern)
    if (chapterMatch && chapterLabelByCode.has(chapterMatch[1])) {
      const approved = parseMoney(chapterMatch[3])
      const modified = parseMoney(chapterMatch[4])
      const devengado = parseMoney(chapterMatch[6])
      const pagado = parseMoney(chapterMatch[8])

      chapters.push({
        id: `cdmx-ssc-${chapterMatch[1]}`,
        code: chapterMatch[1],
        label: chapterLabelByCode.get(chapterMatch[1]),
        approved,
        adjustments: round(modified - approved, 2),
        modified,
        devengado,
        pagado,
        subexercise: round(modified - devengado, 2),
      })
    }
  }

  const normalizedChapters = chapters.map((chapter) => ({
    ...chapter,
    shareOfScope: total?.devengado > 0 ? round(chapter.devengado / total.devengado) : null,
    itemCount: 0,
    items: [],
  }))
    .sort((left, right) => Number(left.code) - Number(right.code))

  return {
    total,
    chapters: normalizedChapters,
  }
}

function parseCdmxProgramTotals(text) {
  const lines = text.split(/\r?\n/)
  let collecting = false
  const amountPattern = '(?:-|[\\d,]+\\.\\d{2})'
  const rowPattern = new RegExp(
    `^\\s*(\\d{6}[A-Z]\\d{3})\\s*(.*?)\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+([\\d.]+%)\\s+([\\d.]+%)\\s*$`,
  )
  const totalPattern = new RegExp(
    `^\\s*TOTAL\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+(${amountPattern})\\s+([\\d.]+%)\\s+([\\d.]+%)\\s*$`,
  )
  const programs = []
  let total = null

  for (const rawLine of lines) {
    const line = rawLine.replace(/\f/g, '').trimEnd()
    const trimmed = line.trim()

    if (!collecting) {
      if (trimmed.includes('AP-PP AVANCE PRESUPUESTAL POR PROGRAMA PRESUPUESTARIO')) {
        collecting = true
      }
      continue
    }

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('Elaboró:')) {
      break
    }

    const totalMatch = line.match(totalPattern)
    if (totalMatch) {
      const approved = parseMoney(totalMatch[1])
      const modified = parseMoney(totalMatch[2])
      const devengado = parseMoney(totalMatch[4])
      const pagado = parseMoney(totalMatch[6])

      total = {
        approved,
        adjustments: round(modified - approved, 2),
        modified,
        devengado,
        pagado,
        subexercise: round(modified - devengado, 2),
      }
      continue
    }

    const rowMatch = line.match(rowPattern)
    if (!rowMatch) {
      continue
    }

    const programId = rowMatch[1]
    const label = cdmxProgramLabelById[programId] ?? rowMatch[2].replace(/\s+/g, ' ').trim() ?? programId
    const approved = parseMoney(rowMatch[3])
    const modified = parseMoney(rowMatch[4])
    const committed = parseMoney(rowMatch[5])
    const devengado = parseMoney(rowMatch[6])
    const ejercido = parseMoney(rowMatch[7])
    const pagado = parseMoney(rowMatch[8])

    programs.push({
      id: slugify(programId),
      code: programId,
      label,
      approved,
      adjustments: round(modified - approved, 2),
      modified,
      committed,
      devengado,
      pagado,
      ejercido,
      subexercise: round(modified - devengado, 2),
    })
  }

  if (!programs.length || !total) {
    throw new Error('CDMX_SSC_PROGRAM_PARSE_FAILED')
  }

  return {
    total,
    programs,
  }
}

function parseCdmxSecurityCitizenBudget(text, spec) {
  const chapterSection = parseCdmxChapterTotals(text)
  const programSection = parseCdmxProgramTotals(text)
  const programGroup = decorateGroupItems(
    [
      {
        id: 'cdmx-programas',
        code: null,
        label: 'Programas presupuestarios',
        approved: programSection.total.approved,
        adjustments: round(programSection.total.modified - programSection.total.approved, 2),
        modified: programSection.total.modified,
        devengado: programSection.total.devengado,
        pagado: programSection.total.pagado,
        subexercise: round(programSection.total.modified - programSection.total.devengado, 2),
        items: programSection.programs.map((program) => ({
          id: program.id,
          code: program.code,
          label: program.label,
          approved: program.approved,
          adjustments: program.adjustments,
          modified: program.modified,
          devengado: program.devengado,
          pagado: program.pagado,
          subexercise: program.subexercise,
        })),
      },
    ],
    programSection.total.devengado,
  )

  return {
    id: 'cdmx-ssc-2024',
    stateId: spec.stateId,
    stateName: spec.stateName,
    year: spec.year,
    granularity: 'programa-presupuestario-capitulo',
    institutionId: 'secretaria-seguridad-ciudadana',
    institutionName: 'Secretaría de Seguridad Ciudadana',
    scopeKind: 'institution',
    stateBudgetBridgeComparable: true,
    labels: buildFineLabels({
      group: 'Bloque',
      groups: 'Bloques',
      item: 'Programa',
      items: 'Programas',
      topItem: 'Top programa',
      tableTitle: 'Tabla por programa',
    }),
    source: {
      name: 'Cuenta Pública 2024 SSC CDMX · informe institucional',
      file: spec.file,
      url: spec.url,
      dependencyLabel: spec.dependencyLabel,
    },
    totals: chapterSection.total ?? programSection.total,
    chapterBreakdown: chapterSection.chapters,
    groups: programGroup,
    topItems: buildTopItemsFromGroups(programGroup),
    notes: [
      'La SSC CDMX publica con claridad el gasto por capítulo y el avance presupuestal por programa.',
      'En esta fuente la bajada pública útil llega a programa presupuestario, no a partida específica homogénea.',
      'La capa sigue siendo plenamente comparable con el total estatal publicado en Atlas porque el corte coincide con la SSC.',
    ],
  }
}

function parseOaxacaAdministrativeRows(text) {
  const lines = text.split(/\r?\n/)
  const rows = []
  let section = null
  let currentRow = null
  const rowPattern =
    /^\s*(\d{3})\s+(.*?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/

  for (const rawLine of lines) {
    const line = rawLine.replace(/\f/g, '').trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('I. Gasto No Etiquetado')) {
      section = 'Gasto no etiquetado'
      currentRow = null
      continue
    }

    if (trimmed.startsWith('II. Gasto Etiquetado')) {
      section = 'Gasto etiquetado'
      currentRow = null
      continue
    }

    if (
      /P[aá]gina\s+\d+/i.test(trimmed) ||
      trimmed.startsWith('CUENTA PUBLICA') ||
      trimmed.startsWith('ESTADO ANALITICO') ||
      trimmed.startsWith('CLASIFICACIÓN') ||
      trimmed.startsWith('PERIODO DEL') ||
      trimmed.startsWith('FORMATO') ||
      trimmed.startsWith('Cve') ||
      trimmed.startsWith('Reducciones') ||
      trimmed === '1                  2                      3 = (1+2)                 4                     5                    6 = (3-4)' ||
      trimmed === '1                  2                     3 = (1+2)             4                    5                    6 = (3-4)'
    ) {
      continue
    }

    const rowMatch = line.match(rowPattern)
    if (rowMatch) {
      currentRow = {
        id: `${section}-${rowMatch[1]}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        section,
        code: rowMatch[1],
        label: rowMatch[2].replace(/\s+/g, ' ').trim(),
        ...amountRecord(rowMatch[3], rowMatch[4], rowMatch[5], rowMatch[6], rowMatch[7], rowMatch[8]),
      }
      rows.push(currentRow)
      continue
    }

    if (currentRow && /^\s{5,}\S/.test(line)) {
      currentRow.label = `${currentRow.label} ${trimmed}`
        .replace(/\s+/g, ' ')
        .replace(/\s+1 2 3 = \(1\+2\) 4 5 6 = \(3-4\).*$/i, '')
        .trim()
    }
  }

  return rows
}

function matchesOaxacaSecurityCluster(label) {
  return /SECRETAR[IÍ]A DE SEGURIDAD|SECRETARIADO EJECUTIVO DEL SISTEMA ESTATAL DE SEGURIDAD|FISCAL[IÍ]A GENERAL|PROTECCI[ÓO]N CIVIL|DELEGADOS DE PAZ SOCIAL|ATENCI[ÓO]N INTEGRAL A V[ÍI]CTIMAS|B[ÚU]SQUEDA DE PERSONAS DESAPARECIDAS|INTELIGENCIA PATRIMONIAL/i.test(
    label,
  )
}

function aggregateRowsByLabel(rows) {
  const aggregated = new Map()

  rows.forEach((row) => {
    const existing = aggregated.get(row.label)
    if (existing) {
      existing.approved += row.approved
      existing.adjustments += row.adjustments
      existing.modified += row.modified
      existing.devengado += row.devengado
      existing.pagado += row.pagado
      existing.subexercise += row.subexercise
      existing.sections.push(row.section)
      return
    }

    aggregated.set(row.label, {
      id: slugify(row.label),
      code: row.code,
      label: row.label,
      approved: row.approved,
      adjustments: row.adjustments,
      modified: row.modified,
      devengado: row.devengado,
      pagado: row.pagado,
      subexercise: row.subexercise,
      sections: [row.section],
    })
  })

  return [...aggregated.values()]
    .map((item) => ({
      ...item,
      sections: [...new Set(item.sections)],
    }))
    .sort((left, right) => right.devengado - left.devengado)
}

function parseOaxacaSecurityClusterAdministrative(text, spec) {
  const rows = parseOaxacaAdministrativeRows(text).filter((row) => matchesOaxacaSecurityCluster(row.label))

  if (!rows.length) {
    throw new Error('OAXACA_SECURITY_CLUSTER_PARSE_FAILED')
  }

  const groups = ['Gasto no etiquetado', 'Gasto etiquetado']
    .map((sectionLabel) => {
      const sectionRows = rows.filter((row) => row.section === sectionLabel)

      if (!sectionRows.length) {
        return null
      }

      const total = sectionRows.reduce(
        (accumulator, row) => ({
          approved: accumulator.approved + row.approved,
          adjustments: accumulator.adjustments + row.adjustments,
          modified: accumulator.modified + row.modified,
          devengado: accumulator.devengado + row.devengado,
          pagado: accumulator.pagado + row.pagado,
          subexercise: accumulator.subexercise + row.subexercise,
        }),
        amountRecord(0, 0, 0, 0, 0, 0),
      )

      return {
        id: slugify(sectionLabel),
        code: sectionLabel.startsWith('Gasto no') ? 'NO-ETQ' : 'ETQ',
        label: sectionLabel,
        approved: total.approved,
        adjustments: total.adjustments,
        modified: total.modified,
        devengado: total.devengado,
        pagado: total.pagado,
        subexercise: total.subexercise,
        items: sectionRows.map((row) => ({
          id: row.id,
          code: row.code,
          label: row.label,
          approved: row.approved,
          adjustments: row.adjustments,
          modified: row.modified,
          devengado: row.devengado,
          pagado: row.pagado,
          subexercise: row.subexercise,
        })),
      }
    })
    .filter(Boolean)

  const total = groups.reduce(
    (accumulator, group) => ({
      approved: accumulator.approved + group.approved,
      adjustments: accumulator.adjustments + group.adjustments,
      modified: accumulator.modified + group.modified,
      devengado: accumulator.devengado + group.devengado,
      pagado: accumulator.pagado + group.pagado,
      subexercise: accumulator.subexercise + group.subexercise,
    }),
    amountRecord(0, 0, 0, 0, 0, 0),
  )

  const decoratedGroups = decorateGroupItems(groups, total.devengado)
  const aggregatedInstitutions = aggregateRowsByLabel(rows).map((item) => ({
    ...item,
    shareOfScope: total.devengado > 0 ? round(item.devengado / total.devengado) : null,
    shareOfGroup: null,
    groupId: 'cluster',
    groupCode: null,
    groupLabel: 'Cluster estatal de seguridad y protección',
  }))

  return {
    id: 'oaxaca-security-cluster-2024',
    stateId: spec.stateId,
    stateName: spec.stateName,
    year: spec.year,
    granularity: 'clasificacion-administrativa-cluster',
    institutionId: 'cluster-seguridad-proteccion',
    institutionName: 'Cluster estatal de seguridad y protección',
    scopeKind: 'cluster',
    stateBudgetBridgeComparable: false,
    labels: buildFineLabels({
      scope: 'Cluster',
      group: 'Bloque',
      groups: 'Bloques',
      item: 'Dependencia',
      items: 'Dependencias',
      topItem: 'Top dependencia',
      tableTitle: 'Tabla por dependencia',
    }),
    source: {
      name: 'Cuenta Pública 2024 Oaxaca · clasificación administrativa',
      file: spec.file,
      url: spec.url,
      dependencyLabel: spec.dependencyLabel,
    },
    totals: total,
    chapterBreakdown: [],
    groups: decoratedGroups,
    topItems: aggregatedInstitutions.slice(0, 12),
    notes: [
      'Oaxaca publica un corte administrativo útil para reconstruir un cluster de seguridad y protección con varias dependencias relevantes.',
      'Esta capa suma SSPC, Secretariado Ejecutivo, Fiscalía, Protección Civil, Víctimas, Búsqueda, Paz Social e Inteligencia Patrimonial.',
      'El cluster no se compara 1:1 contra el total CNSPE estatal porque su alcance institucional es más amplio que la capa policial estándar.',
    ],
  }
}

function buildSourceCut(spec, metadata) {
  return {
    stateId: spec.stateId,
    year: spec.year,
    url: spec.url,
    file: spec.file,
    dependencyLabel: spec.dependencyLabel,
    granularity: spec.granularity,
    lastModified: metadata.lastModified,
    contentLength: metadata.contentLength,
  }
}

async function main() {
  ensureBinary('curl')
  ensurePdfToText()

  const sourceCuts = {}
  const pilots = []

  for (const spec of fineSourceSpecs) {
    const localFile = ensureDownload(spec)
    const metadata = getRemoteMetadata(spec, localFile)
    const pdfText = extractText(localFile)
    const pilot = spec.parser(pdfText, spec)

    sourceCuts[spec.key] = buildSourceCut(spec, metadata)
    pilots.push(pilot)
  }

  writeGeneratedModule('stateBudgetFineData', {
    generatedAt: currentMexicoDate(),
    sourceCuts,
    pilots,
  })

  console.log(`Generated ${pilots.length} fine-budget pilots into ${outputFile}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
