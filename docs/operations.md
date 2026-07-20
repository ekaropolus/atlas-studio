# Operations and runbook

## Requisitos

- Node.js 22 o compatible
- npm
- Docker y Docker Compose para contenedor
- `unzip` disponible en el host si se va a correr `build:data`
- `pdftotext` disponible en el host si se va a correr `build:data:fine`
- acceso de red para descargar fuentes oficiales si se corre `build:data` o `build:data:fine`

## Desarrollo local

Instalacion:

```bash
cd atlas-studio
npm install
```

Modo desarrollo en dos terminales:

```bash
npm run dev
```

```bash
npm run dev:api
```

Puertos:

- frontend Vite: `5173`
- API Express: `4173`

## Login y auth

La app protege API y portal con:

- sesion por cookie `HttpOnly`
- alta por correo
- activacion por token
- reset de password por token
- usuarios persistidos en `runtime-data/auth-store.json`
- outbox local en `runtime-data/mail-outbox/` si no hay SMTP

Variables principales:

- `ATLAS_BASE_URL`
- `ATLAS_RUNTIME_DIR`
- `ATLAS_SESSION_DURATION_HOURS`
- `ATLAS_ACTIVATION_TOKEN_TTL_HOURS`
- `ATLAS_PASSWORD_RESET_TOKEN_TTL_HOURS`
- `ATLAS_PASSWORD_MIN_LENGTH`
- `ATLAS_MAIL_FROM`
- `ATLAS_SMTP_HOST`
- `ATLAS_SMTP_PORT`
- `ATLAS_SMTP_SECURE`
- `ATLAS_SMTP_USER`
- `ATLAS_SMTP_PASS`
- `ATLAS_SENDMAIL_PATH`
- `ATLAS_COOKIE_SECURE`

Bootstrap de usuario funcional:

```bash
node scripts/bootstrap-auth-user.mjs \
  --email edgar@hadox.org \
  --password '<strong-password>' \
  --name 'Edgar Hadox' \
  --role admin
```

Recomendacion:

- en local usa el script para crear usuarios activos;
- en VPS monta `runtime-data` como volumen persistente;
- configura SMTP real cuando quieras que activaciones y resets salgan por correo sin fallback.

Si no existe SMTP, el sistema sigue generando tokens de activacion y reset y escribe el correo en outbox.

## Pipeline de datos

Regenerar el dataset estatal:

```bash
npm run build:data
npm run build:data:fine
```

Efectos:

- descarga fuentes si no existen en `.cache/sources/`
- escribe [server/data/generated/stateCrimeData.mjs](server/data/generated/stateCrimeData.mjs)
- escribe [server/data/generated/stateBudgetData.mjs](server/data/generated/stateBudgetData.mjs)
- escribe [server/data/generated/stateBudgetFineData.mjs](server/data/generated/stateBudgetFineData.mjs)

Cuando correrlo:

- al cambiar la fuente
- al cambiar el ano de corte
- al tocar reglas de matching o transformacion
- al actualizar el abierto presupuestal del CNSPE

## Build de frontend

Compilar cliente:

```bash
npm run build
```

Salida:

- `dist/`

## Runtime integrado

Levantar servidor integrado:

```bash
npm run start
```

Express sirve:

- `dist/`
- `/api/*`

Puerto por default:

- `4173`

Puede cambiarse con:

```bash
PORT=4180 npm run start
```

## Docker local

Build:

```bash
docker build -t atlas-studio:test .
```

Run:

```bash
docker run --rm -p 4185:4173 atlas-studio:test
```

Compose local:

```bash
docker compose up --build -d
```

Archivo:

- [compose.yaml](compose.yaml)

El compose ya monta `./runtime-data:/app/runtime-data`, asi que usuarios, tokens y outbox sobreviven reinicios.

## Imagen de produccion

El contenedor usa multi-stage build:

1. instala dependencias
2. compila `dist/`
3. hace `npm prune --omit=dev`
4. copia solo runtime necesario al stage final

Archivo:

- [Dockerfile](Dockerfile)

## Despliegue actual

Configuracion Hostinger:

- [compose.hostinger.yaml](compose.hostinger.yaml)
- [scripts/deploy_hostinger.sh](scripts/deploy_hostinger.sh)
- [scripts/publish_hostinger.sh](scripts/publish_hostinger.sh)
- [/.env.hostinger.example](.env.hostinger.example)

Modelo operativo:

- contenedor `atlas-polisplexity-tech`
- bind interno `127.0.0.1:4175 -> 4173`
- `nginx` hace reverse proxy
- el sitio publicado vive en `https://atlas.polisplexity.tech`

SMTP de produccion:

- el publish local debe hacerse con `scripts/publish_hostinger.sh` para proteger `.env.hostinger` durante el `rsync --delete`;
- el deploy remoto falla si falta `.env.hostinger` o si `ATLAS_SMTP_*` viene vacio;
- el ejemplo versionable vive en `.env.hostinger.example`;
- el secreto real no debe guardarse en el repo.

## Verificaciones utiles

Healthcheck:

```bash
curl http://localhost:4173/api/health
```

Overview:

```bash
curl -b cookies.txt http://localhost:4173/api/study
```

Detalle estatal:

```bash
curl -b cookies.txt http://localhost:4173/api/states/queretaro
```

Login:

```bash
curl -c cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"USER","password":"PASSWORD"}' \
  http://localhost:4173/api/auth/login
```

Solicitud de acceso:

```bash
curl -H 'Content-Type: application/json' \
  -d '{"email":"nuevo@empresa.com","displayName":"Nuevo contacto","acceptedTerms":true,"acceptedMarketing":true}' \
  http://localhost:4173/api/auth/register-request
```

## Troubleshooting

### El dashboard no carga

Revisar:

- `npm run dev:api`
- `GET /api/health`
- errores de consola del navegador

### El contenedor sirve datos viejos

Reconstruir imagen:

```bash
docker compose up --build -d
```

### El pulso mensual o el score salen raros

Revisar:

- que `build:data` haya regenerado `stateCrimeData.mjs`
- que `studyService.mjs` siga calculando `score` mensual
- que el contenedor no siga corriendo una imagen vieja

### La capa de presupuesto se ve vacia o incompleta

Revisar:

- que `build:data` haya regenerado `stateBudgetData.mjs`
- que `build:data:fine` haya regenerado `stateBudgetFineData.mjs` si falta el piloto institucional
- que el host tenga `unzip`
- que el host tenga `pdftotext` para reconstruir la capa fina piloto
- que el host tenga `curl`, porque `build:data:fine` descarga PDFs oficiales y CDMX requiere tolerancia TLS controlada
- que el ZIP oficial de `recursos presupuestales` del CNSPE siga disponible
- que `studyService.mjs` siga publicando `budgetLayer` y `budget`

### Hay cambios en fuentes oficiales

Revisar primero:

- URLs en [scripts/build-security-data.mjs](scripts/build-security-data.mjs)
- columnas del CSV
- reglas de matching por delito
- estructura interna del ZIP del CNSPE

## Limitaciones operativas actuales

- no hay tests automatizados;
- no hay versionado del dataset generado por release;
- no hay observabilidad mas alla de `health`;
- no hay migraciones porque no existe DB de aplicacion todavia;
- no hay cache HTTP ni CDN configurados dentro del proyecto.
