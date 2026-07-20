# Data contracts and metadata

## Capas de datos

La plataforma maneja dos capas de datos distintas:

### 1. Dataset generado

Archivo:

- [server/data/generated/stateCrimeData.mjs](server/data/generated/stateCrimeData.mjs)
- [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs)

Es la capa base reproducible. Sale del pipeline de build y contiene:

- `generatedAt`
- `sourceCuts`
- `states`
- y, para presupuesto, tambien catálogos de `chapters`, `federalFunds` y `techPlatforms`

### 2. Estudio curado

Archivo:

- [server/data/mexicoSecurityStudy.mjs](server/data/mexicoSecurityStudy.mjs)

Esta capa combina:

- el dataset generado;
- la metadata metodologica;
- los pesos operativos;
- los pesos del atlas score;
- la descripcion de dimensiones;
- la configuracion del dashboard.

### 3. Payload de API

Archivo:

- [server/services/studyService.mjs](server/services/studyService.mjs)

Esta capa deriva:

- scores;
- benchmarks;
- rankings;
- narrativa;
- payloads listos para frontend.

## Contrato del dataset generado

### `stateCrimeData`

Campos top-level:

- `generatedAt`: fecha del corte visible en el dashboard
- `sourceCuts`: metadata minima de fuentes
- `states`: arreglo de 32 entidades

### `sourceCuts`

Subcampos por fuente:

- `name`
- `url`
- `file`
- `year`

Fuentes actuales:

- `crime`
- `population`
- `budget`

### `states[]`

Cada entidad generada incluye:

- `id`: slug de la entidad
- `code`: clave estatal de 2 digitos
- `name`
- `region`
- `population`
- `homicideCount`
- `homicideRate`
- `extortionCount`
- `extortionRate`
- `robberyViolenceCount`
- `robberyViolenceRate`
- `violenceFamilyCount`
- `violenceFamilyRate`
- `narcomenudeoCount`
- `narcomenudeoRate`
- `totalCrimeCount`
- `totalCrimeRate`
- `monthly`

### `states[].monthly[]`

Serie mensual por entidad:

- `monthIndex`
- `month`
- `homicideCount`
- `extortionCount`
- `robberyViolenceCount`
- `violenceFamilyCount`
- `narcomenudeoCount`
- `totalCrimeCount`
- `homicideRate`
- `extortionRate`
- `robberyViolenceRate`
- `violenceFamilyRate`
- `narcomenudeoRate`
- `totalCrimeRate`

### `stateBudgetData`

Campos top-level:

- `generatedAt`
- `sourceCuts`
- `chapters`
- `federalFunds`
- `techPlatforms`
- `states`

### `stateBudgetData.states[]`

Cada entidad incluye:

- `id`
- `code`
- `name`
- `region`
- `population`
- `budgetProjected`
- `budgetApproved`
- `budgetExercised`
- `budgetPerCapita`
- `chapters[]`
- `federalFundsTotal`
- `federalFundsStatus`
- `federalFunds[]`
- `privateContributionTotal`
- `privateContributionStatus`
- `privateContributionShare`
- `techPlatformSpend`
- `techPlatformStatus`
- `techPlatforms[]`
- `chapterReportedAmount`
- `chapterCoverageRatio`
- `chapterDifference`
- `topChapterId`
- `topChapterCode`
- `topChapterLabel`
- `topChapterAmount`
- `topChapterShare`
- `quality`

### `stateBudgetData.states[].chapters[]`

- `id`
- `code`
- `label`
- `amount`
- `status`
- `shareOfExercised`
- `perCapita`

## Contrato del estudio curado

`mexicoSecurityStudy` agrega metadata que no debe vivir en el dataset crudo.

Campos top-level:

- `id`
- `title`
- `subtitle`
- `lastUpdated`
- `methodology`
- `dimensions`
- `operationalWeights`
- `atlasWeights`
- `matrixDimensionIds`
- `tableDimensionIds`
- `sources`
- `pipeline`
- `chartGuide`
- `visualPrinciples`
- `budgetLayer`
- `defaultStateId`
- `rawStates`

### `budgetLayer`

Agrega metadata presupuestal que no debe vivir en el dataset crudo.

Campos:

- `title`
- `body`
- `year`
- `updatedAt`
- `modifiedAt`
- `metrics`
- `chapters`
- `federalFunds`
- `techPlatforms`
- `sources`
- `rules`
- `rawStates`

## Metadata de dimensiones

Cada dimension se describe con:

- `id`
- `label`
- `shortLabel`
- `unit`
- `description`
- `color`
- `higherIsBetter`

Dimensiones actuales:

- `score`
- `operationalScore`
- `budgetExercised`
- `budgetPerCapita`
- `homicideRate`
- `extortionRate`
- `robberyViolenceRate`
- `violenceFamilyRate`
- `narcomenudeoRate`
- `totalCrimeRate`

## Metadata de pesos

`operationalWeights[]` define el score operativo.

Campos:

- `id`
- `label`
- `weight`
- `accent`

Pesos actuales:

- `homicideRate`: 30
- `extortionRate`: 22
- `robberyViolenceRate`: 20
- `violenceFamilyRate`: 16
- `narcomenudeoRate`: 12

`totalCrimeRate` informa contexto pero no entra al score compuesto.

`atlasWeights[]` define el score integrado del portal.

Pesos actuales:

- `operationalScore`: 72
- `budgetPerCapita`: 16
- `budgetExercised`: 8
- `techPlatformShare`: 4

## Reglas de derivacion

### Tasas

Todas las tasas salen de:

```text
rate = (count / population) * 100000
```

La conversion sucede en:

- [scripts/build-security-data.mjs](scripts/build-security-data.mjs)

### Normalizacion relativa

Para cada metrica anual:

```text
ratio = (value - min) / (max - min)
normalized = ratio si higherIsBetter
normalized = 1 - ratio si higherIsBetter = false
score_dimension = normalized * 100
```

Esto sucede en:

- `buildBounds()`
- `normalizeMetric()`

### Score compuesto anual

El score anual es una suma ponderada de las dimensiones que entran al indice:

```text
score = sum(normalized_metric * (weight / 100))
```

Se redondea a entero.

### Score mensual

El score mensual no se hereda del anual. Se recalcula por mes usando bounds por mes:

- `decorateMonthlyScores()`

Esto permite comparar aceleracion mensual relativa entre estados.

### Benchmarks nacionales

`buildBenchmarks()` produce:

- promedio nacional simple de tasas y `score`
- suma nacional de `population`
- suma nacional de algunos conteos agregados

### Rankings

`buildRankMap()` ordena cada dimension:

- descendente si `higherIsBetter = true`
- ascendente si `higherIsBetter = false`

## Lineage actual

### Fuente 1: crimen estatal

- nombre: `SESNSP incidencia delictiva estatal`
- archivo esperado: `INM_estatal_dic25.csv`
- periodo: 2025
- uso: conteos mensuales y anuales por entidad

### Fuente 2: poblacion

- nombre: `Proyecciones de poblacion por entidad`
- archivo esperado: `05_indicadores_demograficos_proyecciones.csv`
- periodo: 2025
- uso: denominadores para tasas

### Fuente 3: presupuesto estatal

- nombre: `INEGI CNSPE 2025 recursos presupuestales`
- archivo esperado: `conjunto_de_datos_rec_presup_cnspe2025_csv.zip`
- periodo de referencia: 2024
- uso: presupuesto ejercido, capitulos 1000-9000, fondos federales, aportacion privada y plataformas tecnologicas

## Metadatos visibles en UI

Hay metadata puramente tecnica y metadata visible.

Metadata visible en UI:

- `lastUpdated`
- `sources`
- `pipeline`
- `chartGuide`
- `visualPrinciples`
- `budgetLayer.title`
- `budgetLayer.metrics`
- `budgetLayer.rules`

Metadata tecnica que no se expone completa:

- archivos cacheados
- URLs de descarga del build script
- reglas exactas de matching de delitos
- mapeo `regionByCode`

## Matching de delitos

La capa actual rastrea cinco metricas principales con reglas de matching en el CSV:

- `homicide`: `tipo_delito = Homicidio` y `subtipo_delito = Homicidio doloso`
- `extortion`: `tipo_delito = Extorsion`
- `robberyViolence`: `tipo_delito = Robo` y `modalidad` contiene `Con violencia`
- `violenceFamily`: `tipo_delito = Violencia familiar`
- `narcomenudeo`: `tipo_delito = Narcomenudeo`

Ademas, `totalCrimeCount` acumula todo el volumen del CSV filtrado al ano.

## Limitaciones del contrato actual

- solo hay nivel estatal;
- no existe una tabla de metadata versionada por estudio fuera del codigo;
- no se guardan revisiones historicas del dataset generado;
- la fuente letal fuerte de INEGI aun no esta integrada al calculo;
- el endpoint de ciudad no tiene dataset real detras.
- el budget layer llega a nivel capitulo comparable, no a partida especifica homologada.
