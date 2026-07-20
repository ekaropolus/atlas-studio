# Security spending layer

## Estado actual

La capa de gasto en seguridad ya esta implementada en `Atlas Studio`.

No es una simulacion ni un placeholder. El portal ahora integra esta capa en el tablero principal y mantiene auditoria detallada con:

- presupuesto ejercido estatal 2024;
- gasto per capita;
- desglose por capitulo `1000-9000`;
- fondos federales (`FASP`, `FOFISP`, otros);
- aportacion privada;
- gasto en plataformas tecnologicas;
- quality flags cuando hay diferencias o faltantes.

Ademas, el atlas ya tiene una tercera capa fina con tres pilotos vivos y granularidad heterogenea:

- `Querétaro -> Secretaría de Seguridad Ciudadana -> capítulo y concepto`
- `Ciudad de México -> Secretaría de Seguridad Ciudadana -> capítulo y programa presupuestario`
- `Oaxaca -> cluster estatal de seguridad y protección -> clasificación administrativa`

Uso:

- bajar del comparativo nacional por capitulo a una lectura estatal mucho mas fina;
- aprovechar el máximo nivel publico explotable sin fingir homogeneidad entre estados;
- preparar la siguiente fase hacia partida generica y partida especifica.

## Fuente oficial cableada

### INEGI CNSPE 2025

Archivo abierto usado en el build:

- `https://www.inegi.org.mx/contenidos/programas/cnspe/2025/datosabiertos/m1/conjunto_de_datos_rec_presup_cnspe2025_csv.zip`

Metadato tecnico:

- programa: `Censo Nacional de Seguridad Publica Estatal 2025`
- referencia temporal: `2024`
- actualizacion relevante del abierto: `2026-03-17`
- cobertura: `32 entidades`

Tablas usadas del ZIP:

- `m1s4p1`: proyecto, aprobado y ejercido
- `m1s4p2`: presupuesto ejercido por capitulo del COG
- `m1s4p3`: fondos y subsidios federales
- `m1s4p4`: aportacion del sector privado
- `m1s4p5`: gasto en plataformas tecnologicas

Denominador per capita:

- `05_indicadores_demograficos_proyecciones.csv`
- ano usado para esta capa: `2024`

## Pipeline

Script:

- [scripts/build-security-data.mjs](scripts/build-security-data.mjs)

Salidas generadas:

- [server/data/generated/stateCrimeData.mjs](server/data/generated/stateCrimeData.mjs)
- [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs)
- [server/data/generated/stateBudgetFineData.mjs](server/data/generated/stateBudgetFineData.mjs)

Pasos:

1. descarga el ZIP oficial de presupuesto del CNSPE;
2. lee las tablas CSV internas del ZIP;
3. parsea montos y codigos especiales (`NA`, `NSS`, `ND`, `NP`, `NULL`);
4. deriva gasto per capita y shares sobre presupuesto ejercido;
5. genera flags de calidad cuando:
   - falta el ejercido;
   - faltan capitulos;
   - la suma de capitulos no cuadra razonablemente con el total ejercido.

## Modelo publicado en runtime

Dataset generado:

- [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs)

Campos top-level:

- `generatedAt`
- `sourceCuts`
- `chapters`
- `federalFunds`
- `techPlatforms`
- `states`

Cada `state` incluye:

- `budgetProjected`
- `budgetApproved`
- `budgetExercised`
- `budgetPerCapita`
- `chapters[]`
- `federalFundsTotal`
- `federalFundsShare`
- `privateContributionTotal`
- `privateContributionShare`
- `techPlatformSpend`
- `techPlatformShare`
- `chapterReportedAmount`
- `chapterCoverageRatio`
- `chapterDifference`
- `topChapter*`
- `quality`

## API expuesta

El budget layer no vive en un endpoint aislado. Se monta dentro de los payloads principales:

- `GET /api/study` -> `budgetLayer`
- `GET /api/states/:stateId` -> `budget`

Desde el piloto fino:

- `GET /api/study` -> `budgetLayer.fineCoverage`
- `GET /api/states/:stateId` -> `budget.fineDetail`

Esto permite que el portal comparta seleccion de estado, filtro de busqueda y shell de login entre score, detalle operativo y auditoria presupuestal.

## UI entregada

La vista actual integra presupuesto en tres niveles:

- `atlas score` con capacidad financiera dentro del ranking principal;
- `matriz estatal` con presupuesto total y gasto per capita visibles arriba del fold;
- `auditoria presupuestal` abajo del fold con composicion por capitulo, quality flags y tabla exacta.
- `cuenta publica fina` para entidades piloto con lectura al maximo nivel util publicado por la fuente estatal.

Componentes principales:

- [src/App.jsx](src/App.jsx)
- [src/components/charts/BudgetCompositionChart.jsx](src/components/charts/BudgetCompositionChart.jsx)
- [src/components/BudgetTable.jsx](src/components/BudgetTable.jsx)

## Reglas de lectura

- si entra al atlas score, entra como capacidad y no como promesa de causalidad;
- `mas gasto` no se presenta como `mejor seguridad`;
- la comparacion nacional se hace a nivel capitulo, no partida fina;
- los shares se leen contra el presupuesto ejercido reportado;
- los faltantes no se imputan ni se esconden.

## Capa fina actual

Hoy la capa fina soporta tres patrones distintos:

- `capitulo-concepto`: cuando la cuenta publica baja una dependencia hasta conceptos reales;
- `programa-presupuestario-capitulo`: cuando el abierto institucional publica programas y capitulos;
- `clasificacion-administrativa-cluster`: cuando el mayor detalle util es el ente o dependencia dentro de un cluster de seguridad.

Esto implica una regla operativa importante:

- Atlas no fuerza una taxonomia falsa para que todos los estados “se vean iguales”;
- Atlas expone la granularidad real de cada fuente y documenta cuando el puente con CNSPE es comparable o solo orientativo.

## Lo que todavia no hace

- no baja a `partida especifica` homologada entre estados;
- no cruza todavia con una fuente externa de gasto federalizado fuera del propio CNSPE;
- no tiene serie historica multi-ano;
- no incorpora gasto municipal ni metropolitano.

## Siguiente paso tecnico razonable

Si se quiere una tercera capa mas profunda, el siguiente build debe abrir:

- presupuestos estatales de egresos;
- cuentas publicas estatales;
- homologacion `capitulo -> concepto -> partida generica -> partida especifica`;
- versionado de equivalencias por estado.

Los pilotos actuales ya cubren la primera parte de esa arquitectura: validan que el portal puede convivir con capas institucionales heterogeneas de cuenta publica sin romper la comparabilidad nacional.
