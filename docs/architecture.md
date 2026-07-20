# Arquitectura

## Objetivo de plataforma

`Atlas Studio` no es solo una pagina de demo. La base actual esta pensada como una plataforma para micrositios de datos con cuatro propiedades:

- frontend interactivo y denso, orientado a tablero;
- API propia con payloads listos para visualizacion;
- pipeline reproducible de ingest, normalizacion y derivacion;
- control de acceso por correo con activacion y consentimiento;
- despliegue simple en un solo contenedor.

El estudio actual es `mexico-security`, pero la arquitectura ya separa:

- el runtime de la plataforma;
- la logica del estudio;
- el dataset generado;
- la presentacion visual.

## Stack actual

- `React 19.2.4` para orquestacion del cliente.
- `D3 7.9.0` para todas las graficas y transiciones.
- `Express 5.2.1` para API y entrega del build compilado.
- `Vite 8.0.1` para desarrollo y empaquetado del frontend.
- `Node 22` en build y runtime de contenedor.

## Vista por capas

### 1. Build-time data pipeline

El dataset base no se edita a mano. Se genera con:

- [scripts/build-security-data.mjs](scripts/build-security-data.mjs)

Ese script:

- descarga fuentes oficiales si no existen en cache;
- guarda los CSV en `.cache/sources/`;
- agrega las 32 entidades para seguridad y presupuesto;
- convierte conteos a tasas por 100 mil;
- deriva gasto per capita, shares y quality flags para presupuesto;
- reconstruye una capa fina de cuenta publica estatal con granularidad heterogenea;
- emite [server/data/generated/stateCrimeData.mjs](server/data/generated/stateCrimeData.mjs).
- emite [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs).
- emite [server/data/generated/stateBudgetFineData.mjs](server/data/generated/stateBudgetFineData.mjs).

### 2. Data layer

La capa de datos en runtime vive en:

- [server/data/mexicoSecurityStudy.mjs](server/data/mexicoSecurityStudy.mjs)
- [server/data/generated/stateCrimeData.mjs](server/data/generated/stateCrimeData.mjs)
- [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs)
- [server/data/generated/stateBudgetFineData.mjs](server/data/generated/stateBudgetFineData.mjs)

`generated/stateCrimeData.mjs` contiene el agregado crudo ya normalizado a tasas.

`generated/stateBudgetData.mjs` contiene la capa presupuestal 2024 por entidad, con capitulos 1000-9000, fondos federales, aportacion privada, plataformas tecnologicas y flags de calidad.

`generated/stateBudgetFineData.mjs` contiene pilotos finos de cuenta publica. La estructura ya soporta varios patrones:

- `capitulo-concepto`
- `programa-presupuestario-capitulo`
- `clasificacion-administrativa-cluster`

La decision de arquitectura aqui es explicita: la capa fina no obliga a todos los estados a verse iguales. Preserva la granularidad real que publica cada fuente oficial.

`mexicoSecurityStudy.mjs` agrega metadatos de negocio y visualizacion:

- id del estudio;
- titulo y subtitulo;
- dimensiones;
- pesos operativos;
- pesos del atlas score;
- fuentes;
- pasos del pipeline;
- chart guide;
- principios visuales;
- estado default.
- configuracion del budget layer.

### 3. Service layer

La logica de derivacion para la API vive en:

- [server/services/studyService.mjs](server/services/studyService.mjs)

Responsabilidades:

- calcular bounds por dimension;
- normalizar metricas;
- construir el `score operativo`;
- construir el `atlas score` integrando presupuesto;
- recalcular `score operativo` mensual por estado;
- producir benchmarks nacionales;
- generar rankings;
- construir narrativa, comparaciones y drivers;
- construir benchmarks presupuestales, rankings por monto/share y quality notes;
- puentear la capa fina contra el presupuesto estatal cuando el alcance si es comparable;
- desactivar ese puente cuando el piloto cubre un cluster institucional mas amplio;
- exponer payloads curados para overview y detalle.

La regla aqui es clara: el frontend no recibe dump bruto. Recibe datos ya listos para tabla, ranking, serie y explicabilidad.

### 4. API layer

La API HTTP esta en:

- [server/index.mjs](server/index.mjs)
- [server/auth/authService.mjs](server/auth/authService.mjs)

Expone:

- `GET /api/health`
- `GET /api/auth/config`
- `POST /api/auth/register-request`
- `GET /api/auth/activation/:token`
- `POST /api/auth/activate`
- `POST /api/auth/password-reset-request`
- `GET /api/auth/password-reset/:token`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/admin/users`
- `GET /api/auth/admin/overview`
- `POST /api/auth/admin/users/:userId/password-reset`
- `GET /api/study`
- `GET /api/states/:stateId`
- `GET /api/states/:stateId/cities/:cityId`

Hoy el endpoint de ciudad es stub y responde `404 CITY_NOT_FOUND`.

Los endpoints `/api/study` y `/api/states/:stateId` ya incluyen una lectura integrada y una auditoria detallada:

- atlas score;
- score operativo;
- presupuesto estatal comparable.

La capa de auth ahora persiste:

- usuarios por correo y rol;
- tokens de activacion y reset hasheados;
- consentimiento de terminos y marketing;
- auditoria de solicitudes, reseteos, entrega de correo, login y trazabilidad de vistas.

### 5. Frontend layer

El shell del cliente esta en:

- [src/main.jsx](src/main.jsx)
- [src/App.jsx](src/App.jsx)
- [src/lib/api.js](src/lib/api.js)

Organizacion:

- `App.jsx`: routing ligero, fetch de overview/detalle, auth flows y drilldown.
- `lib/api.js`: cliente HTTP minimo.
- `components/`: piezas UI, auth flows, admin, comparativo, inversion y metodologia.
- `components/charts/`: charts D3 encapsulados.

Superficies actuales:

- `Comparativo`: tablero integrado de presion operativa + inversion.
- `Inversion`: tablero presupuestal separado, centrado en gasto ejercido, per capita, fondos, tecnologia, capitulos, detalle fino por estado y pilotos de cuenta publica institucional.
- `Inversion`: ahora tambien soporta pilotos finos con semantica heterogenea por estado, sin romper la shell comun.
- `Metodologia`: explicacion tecnica desacoplada.
- `Docs`: lector interno de markdown.
- `Admin`: accesos, actividad y telemetria.

Charts actuales relevantes:

- `StateMatrixChart`
- `StateRankingChart`
- `StateTrendChart`
- `BudgetChapterHeatmapChart`
- `BudgetChapterDeltaChart`
- `BudgetFineConceptChart`
- `BudgetCompositionChart`
- `DriverBarChart`
- `StatesTable`
- `BudgetTable`
- `BudgetChapterDetailTable`
- `BudgetFineConceptTable`
- `BudgetSourceTable`
- `MethodologyWeightChart`
- `PipelineFlowChart`

Tambien existen piezas de scaffold o futuras capas:

- `CityScatterChart`
- `DimensionStripChart`
- `TrendLinesChart`

## Flujo de datos end-to-end

1. `npm run build:data` descarga y transforma fuentes oficiales.
2. El script escribe `server/data/generated/stateCrimeData.mjs` y `server/data/generated/stateBudgetData.mjs`.
3. `mexicoSecurityStudy.mjs` usa esos modulos generados y les agrega metadata editorial/metodologica.
4. `studyService.mjs` deriva scores, rankings, benchmarks y payloads para score integrado, operacion y presupuesto.
5. `server/index.mjs` publica esos payloads en `/api`.
6. `src/lib/api.js` consume la API.
7. `App.jsx` distribuye el estado a los charts D3.

## Topologia de runtime

En produccion hay un solo proceso HTTP de Node:

- Express sirve `/api/*`;
- Express sirve `dist/` como contenido estatico;
- cualquier ruta no-API responde `dist/index.html`.

Esto evita separar frontend y backend en dos despliegues distintos.

## Extension points

La plataforma ya permite crecer en cuatro direcciones sin reescribir el dashboard:

### Repository real

Hoy la fuente es modulo local generado. Manana se puede introducir:

- `Postgres`
- `DuckDB`
- archivos parquet
- API externa propia

La frontera natural para ese cambio es `server/data/` y, si hiciera falta, una capa `repositories/`.

### Multi-study

Hoy el proyecto monta un estudio hardcodeado. El siguiente paso natural es introducir:

- un registry de estudios;
- routing por `studyId` o `slug`;
- adaptadores por estudio.

### Multi-geo

Hoy la capa operativa real es estatal. La interfaz ya deja espacio para:

- ciudades;
- zonas metropolitanas;
- municipios.

La ausencia principal no es visual sino de fuente y servicio.

### Persistencia editorial

Si luego hace falta panel editorial o control de versiones de estudios:

- se agrega base de datos;
- se separa configuracion editable del bundle de codigo.

La autenticacion base ya existe; el siguiente salto real seria separar auth store y estudio hacia un repositorio durable como Postgres.

## Limitaciones actuales

- solo hay un estudio cableado;
- solo hay 32 estados, no hay capa urbana funcional;
- la auth actual ya soporta multiusuario ligero, activacion y reset, pero aun sin roles granulares ni repositorio durable;
- el endpoint de ciudad es placeholder;
- la metadata metodologica vive en codigo, no en CMS;
- el deploy sigue el modelo de un solo contenedor, no orquestacion.

## Archivos clave

- [README.md](README.md)
- [server/index.mjs](server/index.mjs)
- [server/services/studyService.mjs](server/services/studyService.mjs)
- [server/data/mexicoSecurityStudy.mjs](server/data/mexicoSecurityStudy.mjs)
- [scripts/build-security-data.mjs](scripts/build-security-data.mjs)
- [src/App.jsx](src/App.jsx)
