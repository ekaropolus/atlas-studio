# API reference

## Base URL

En local:

- frontend: `http://localhost:5173`
- API directa: `http://localhost:4173`
- contenedor integrado: `http://localhost:4185`

En despliegue actual:

- `https://atlas.polisplexity.tech`

Todos los endpoints regresan `application/json`, salvo el frontend estatico.

## Auth

La aplicacion usa:

- sesion por cookie `HttpOnly`
- usuarios persistentes por correo
- activacion por token
- consentimiento versionado para terminos y marketing

### `GET /api/auth/config`

Entrega configuracion publica del flujo de acceso.

Respuesta:

```json
{
  "termsVersion": "2026-03-20-portal-access-v1",
  "passwordMinimumLength": 12,
  "activationTokenTtlHours": 72,
  "passwordResetTokenTtlHours": 6,
  "mailMode": "smtp"
}
```

### `POST /api/auth/register-request`

Body:

```json
{
  "email": "contacto@empresa.com",
  "displayName": "Contacto institucional",
  "acceptedTerms": true,
  "acceptedMarketing": true
}
```

Respuestas:

- `202` con `{ "status": "activation_requested", "email": "to***@empresa.com", "deliveryMode": "smtp|sendmail|outbox", "deliveryStatus": "sent|queued", "deliveryAt": "ISO-8601" }`
- `202` con `{ "status": "activation_delivery_failed", "email": "to***@empresa.com", "deliveryMode": "smtp|sendmail", "deliveryStatus": "failed", "lastDeliveryError": { "code", "message", "responseCode", "command" } }`
- `202` con `{ "status": "already_active", "email": "to***@empresa.com" }`
- `400 { "error": "INVALID_EMAIL" }`
- `400 { "error": "TERMS_ACCEPTANCE_REQUIRED" }`
- `400 { "error": "MARKETING_CONSENT_REQUIRED" }`

### `GET /api/auth/activation/:token`

Inspecciona el token antes de crear password.

Respuestas:

- `200` con email, expiracion y metadata de consentimiento
- `404 { "error": "ACTIVATION_TOKEN_INVALID" }`
- `410 { "error": "ACTIVATION_TOKEN_EXPIRED" }`
- `409 { "error": "ACCOUNT_ALREADY_ACTIVE" }`

### `POST /api/auth/activate`

Body:

```json
{
  "token": "raw-token",
  "password": "<strong-password>"
}
```

Respuestas:

- `201` con `{ "user": { ... } }`
- `400 { "error": "PASSWORD_TOO_SHORT" }`
- `404 { "error": "ACTIVATION_TOKEN_INVALID" }`
- `410 { "error": "ACTIVATION_TOKEN_EXPIRED" }`

### `POST /api/auth/password-reset-request`

Body:

```json
{
  "email": "contacto@empresa.com"
}
```

Respuestas:

- `202` con `{ "status": "password_reset_requested", "email": "to***@empresa.com", "deliveryMode": "smtp|sendmail|outbox|null", "deliveryStatus": "sent|queued|accepted", "deliveryAt": "ISO-8601|null", "expiresAt": "ISO-8601|null" }`
- `202` con `{ "status": "password_reset_delivery_failed", "email": "to***@empresa.com", "deliveryMode": "smtp|sendmail", "deliveryStatus": "failed", "lastDeliveryError": { "code", "message", "responseCode", "command" } }`
- `400 { "error": "INVALID_EMAIL" }`

Notas:

- cuando `deliveryStatus = accepted`, el endpoint responde de forma no enumerativa si el correo no existe o no esta activo;
- si el correo ya estaba activo, se genera y envia un token de reset real.

### `GET /api/auth/password-reset/:token`

Inspecciona el token de reset antes de guardar un password nuevo.

Respuestas:

- `200` con email y expiracion
- `404 { "error": "PASSWORD_RESET_TOKEN_INVALID" }`
- `410 { "error": "PASSWORD_RESET_TOKEN_EXPIRED" }`
- `410 { "error": "PASSWORD_RESET_TOKEN_CONSUMED" }`
- `409 { "error": "ACCOUNT_NOT_ACTIVE" }`

### `POST /api/auth/password-reset/confirm`

Body:

```json
{
  "token": "raw-token",
  "password": "<strong-password>"
}
```

Respuestas:

- `201` con `{ "user": { ... } }`
- `400 { "error": "PASSWORD_TOO_SHORT" }`
- `404 { "error": "PASSWORD_RESET_TOKEN_INVALID" }`
- `410 { "error": "PASSWORD_RESET_TOKEN_EXPIRED" }`
- `410 { "error": "PASSWORD_RESET_TOKEN_CONSUMED" }`

### `GET /api/auth/session`

Devuelve la sesion activa.

Respuestas:

- `200` con `{ "user": { ... } }`
- `401 { "error": "AUTH_REQUIRED" }`

### `POST /api/auth/login`

Body:

```json
{
  "email": "edgar@hadox.org",
  "password": "********"
}
```

Respuestas:

- `200` con `{ "user": { "id", "email", "displayName", "role" } }`
- `401 { "error": "INVALID_CREDENTIALS" }`
- `403 { "error": "ACCOUNT_NOT_ACTIVE" }`

### `POST /api/auth/logout`

Cierra la sesion activa y limpia la cookie.

Respuesta:

- `200 { "status": "ok" }`

### `GET /api/auth/admin/users`

Requiere usuario `admin`.

Respuesta:

- `200` con `{ "users": [{ "id", "email", "displayName", "role", "status", "requestCount", "latestActivation": { ... }, "latestPasswordReset": { "deliveryStatus", "deliveryMode", "deliveryAt", "lastDeliveryAttemptAt", "deliveryAttempts", "lastDeliveryError" } }] }`
- `403 { "error": "ADMIN_REQUIRED" }`

### `GET /api/auth/admin/overview`

Requiere usuario `admin`.

Entrega el payload agregado para la pagina de administracion:

- `summary`
- `users`
- `routeBreakdown`
- `topStates`
- `topDocs`
- `recentActivity`

Cada usuario incluye presencia y ultima vista:

- `lastSeenAt`
- `isActiveViewer`
- `views24h`
- `latestView`

El summary ya agrega tambien:

- `passwordResetRequests24h`
- `passwordResetEmailsSent24h`
- `passwordResetEmailsFailed24h`
- `passwordResetCompleted24h`

### `POST /api/auth/admin/users/:userId/password-reset`

Requiere usuario `admin`.

Dispara o reenvia un reset de password para un usuario activo desde el panel admin.

Respuestas:

- `202` con `{ "status": "password_reset_requested", "email": "to***@empresa.com", "deliveryMode": "smtp|sendmail|outbox", "deliveryStatus": "sent|queued", "deliveryAt": "ISO-8601" }`
- `202` con `{ "status": "password_reset_delivery_failed", "email": "to***@empresa.com", "deliveryStatus": "failed", "lastDeliveryError": { ... } }`
- `404 { "error": "USER_NOT_FOUND" }`
- `409 { "error": "ACCOUNT_NOT_ACTIVE" }`

### `POST /api/auth/track`

Requiere sesion valida.

Body:

```json
{
  "route": "dashboard",
  "stateId": "yucatan",
  "stateName": "Yucatan",
  "metricId": "score",
  "metricLabel": "Atlas score"
}
```

Usos tipicos:

- `dashboard`: manda `stateId`, `stateName`, `metricId`, `metricLabel`
- `investment`: manda `stateId`, `stateName`, `metricId`, `metricLabel`
- `docs`: manda `docId`, `docTitle`
- `methodology`: solo `route`
- `admin`: solo `route`

Respuesta:

- `202 { "status": "ok", "tracked": true|false, "lastSeenAt": "ISO-8601" }`

## Endpoints

### `GET /api/health`

Healthcheck minimo para monitoreo y despliegue.

Respuesta:

```json
{
  "status": "ok",
  "service": "atlas-studio",
  "timestamp": "2026-03-20T14:09:10.000Z"
}
```

Semantica:

- `status`: estado operativo del proceso HTTP
- `service`: identificador del servicio
- `timestamp`: hora de respuesta en ISO-8601

### `GET /api/study`

Entrega el payload overview del estudio activo. Es el endpoint base que consume el dashboard al cargar.

Auth:

- requiere sesion valida;
- sin sesion responde `401 { "error": "AUTH_REQUIRED" }`.

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
- `defaultTrendMetricId`
- `sources`
- `pipeline`
- `chartGuide`
- `visualPrinciples`
- `budgetLayer`
- `summaryCards`
- `defaultStateId`
- `benchmarks`
- `nationalMonthly`
- `states`

Estructuras importantes:

#### `dimensions[]`

Cada dimension define una metrica visible en la UI:

- `id`
- `label`
- `shortLabel`
- `unit`
- `description`
- `color`
- `higherIsBetter`
- `hasMonthly`

#### `summaryCards[]`

Tarjetas del strip superior:

- `label`
- `value`
- `note`

#### `budgetLayer`

Contiene la capa presupuestal publicada dentro del dashboard.

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
- `fineCoverage`
- `defaultMetricId`
- `summaryCards`
- `benchmarks`
- `states`

#### `budgetLayer.metrics[]`

- `id`
- `label`
- `shortLabel`
- `unit`
- `description`
- `color`
- `higherIsBetter`

#### `budgetLayer.benchmarks`

- `statesReported`
- `budgetProjected`
- `budgetApproved`
- `budgetExercised`
- `budgetPerCapita`
- `federalFundsTotal`
- `federalFundsShare`
- `privateContributionTotal`
- `techPlatformSpend`
- `techPlatformShare`
- `chapterTotals`
- `chapterShares`

#### `budgetLayer.states[]`

- `id`
- `code`
- `name`
- `region`
- `population`
- `budgetProjected`
- `budgetApproved`
- `budgetExercised`
- `budgetPerCapita`
- `federalFundsTotal`
- `federalFundsShare`
- `privateContributionTotal`
- `privateContributionShare`
- `techPlatformSpend`
- `techPlatformShare`
- `chapterReportedAmount`
- `chapterCoverageRatio`
- `chapterDifference`
- `topChapterId`
- `topChapterCode`
- `topChapterLabel`
- `topChapterAmount`
- `topChapterShare`
- `chapters`
- `federalFunds`
- `techPlatforms`
- `quality`
- `ranks`

#### `budgetLayer.fineCoverage`

- `pilotCount`
- `stateIds`
- `states`

Cada item de `states[]` incluye:

- `stateId`
- `stateName`
- `institutionName`
- `granularity`
- `year`
- `sourceName`

#### `benchmarks`

Promedios o agregados nacionales usados como linea base:

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
- `population`
- `homicideCount`
- `extortionCount`
- `totalCrimeCount`

#### `nationalMonthly[]`

Serie nacional ya agregada para comparacion temporal:

- `monthIndex`
- `month`
- `operationalScore`
- `homicideRate`
- `extortionRate`
- `robberyViolenceRate`
- `violenceFamilyRate`
- `narcomenudeoRate`
- `totalCrimeRate`

#### `states[]`

Snapshot resumido por entidad:

- `id`
- `code`
- `name`
- `region`
- `population`
- `score`
- `operationalScore`
- `capacityScore`
- `budgetAvailable`
- `budgetExercised`
- `budgetPerCapita`
- `federalFundsTotal`
- `federalFundsShare`
- `techPlatformSpend`
- `techPlatformShare`
- `homicideRate`
- `extortionRate`
- `robberyViolenceRate`
- `violenceFamilyRate`
- `narcomenudeoRate`
- `totalCrimeRate`
- `homicideCount`
- `extortionCount`
- `robberyViolenceCount`
- `violenceFamilyCount`
- `narcomenudeoCount`
- `totalCrimeCount`
- `normalized`
- `ranks`

Ejemplo de consumo:

```bash
curl -b cookies.txt http://localhost:4173/api/study
```

### `GET /api/states/:stateId`

Entrega el payload detallado para una entidad.

Auth:

- requiere sesion valida;
- sin sesion responde `401 { "error": "AUTH_REQUIRED" }`.

Parametros:

- `stateId`: slug de estado, por ejemplo `queretaro`, `yucatan`, `durango`

Respuesta top-level:

- `state`
- `budget`
- `benchmarks`
- `nationalMonthly`
- `budgetBenchmarks`

`state` incluye todo lo del overview estatal mas:

- `lede`
- `caution`
- `comparisons`
- `metricCards`
- `drivers`
- `monthly`

`budget` incluye:

- todos los campos del estado en `budgetLayer.states[]`
- `lede`
- `caution`
- `comparisons`
- `qualityNotes`
- `fineDetail`

#### `comparisons[]`

- `id`
- `label`
- `tone`
- `displayValue`

#### `metricCards[]`

- `id`
- `label`
- `value`
- `displayValue`
- `benchmarkLabel`
- `benchmarkTone`
- `rank`
- `note`

#### `drivers[]`

- `label`
- `direction`
- `value`
- `note`

#### `monthly[]`

Serie mensual del estado:

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
- `operationalScore`

#### `budget.comparisons[]`

- `id`
- `label`
- `tone`
- `displayValue`

#### `budget.qualityNotes[]`

Mensajes listos para UI cuando:

- falta presupuesto ejercido;
- faltan capitulos;
- la suma de capitulos no cuadra razonablemente con el ejercido;
- la capa de fondos no queda resuelta.

#### `budget.fineDetail`

Cuando existe una capa institucional mas profunda para el estado, el payload agrega:

- `id`
- `stateId`
- `stateName`
- `year`
- `granularity`
- `institutionId`
- `institutionName`
- `scopeKind`
- `source`
- `labels`
- `totals`
- `bridgeComparable`
- `bridgeMetric`
- `institutionShareOfStateBudget`
- `scopeEntityCount`
- `groupCount`
- `itemCount`
- `chapterBreakdown`
- `groups`
- `topItems`
- `chapterCount`
- `conceptCount`
- `chapters`
- `topConcepts`
- `notes`

Notas:

- `chapterBreakdown` existe cuando la fuente publica una mezcla por capitulo util para cruce con el atlas estatal.
- `groups` es la agrupacion principal visible en UI.
- `topItems` es la lista transversal mas intensa para chart principal.
- `chapters` y `topConcepts` hoy se mantienen como alias legacy para no romper consumidores viejos.
- cuando `bridgeComparable = false`, `institutionShareOfStateBudget` puede venir `null` porque el alcance fino cubre un cluster mas amplio que la capa estatal del CNSPE.

Si el estado no tiene piloto fino cableado, `fineDetail` llega como `null`.

Ejemplo:

```bash
curl http://localhost:4173/api/states/queretaro
```

Errores:

- `404 { "error": "STATE_NOT_FOUND" }`

### `GET /api/states/:stateId/cities/:cityId`

Contrato reservado para futura capa urbana.

Estado actual:

- existe la ruta;
- el servicio `getCityDetail()` regresa `null`;
- hoy responde `404`.
- la ruta tambien requiere sesion valida.

Error actual:

- `404 { "error": "CITY_NOT_FOUND" }`

## Routing no-API

Express sirve:

- `dist/` para el frontend;
- `index.html` para rutas SPA como `/`, `/metodologia` y `/docs`.

La proteccion principal vive en la API y en el guard del cliente React.

- archivos estaticos desde `dist/`
- `index.html` para cualquier ruta que no empiece con `/api/`

Esto permite soportar:

- `/`
- `/metodologia`

sin un servidor estatico separado.

## Notas de contrato

- El cliente no calcula `score`, `operationalScore`, `ranks` ni `benchmarks`; todo eso llega precalculado.
- El payload de `/api/study` ya es suficiente para dibujar overview, ranking, matriz y tabla.
- El payload de `/api/states/:stateId` completa la narrativa, explicabilidad y serie mensual.
- Los ids territoriales consumidos por la API son slugs, no claves numericas del INEGI.
