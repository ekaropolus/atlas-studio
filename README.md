# Atlas Studio

> [!IMPORTANT]
> Este repositorio es publicamente visible, pero **no es open source**. El codigo propio se distribuye bajo una licencia propietaria; consulta [LICENSE](LICENSE) y [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Framework full-stack para micrositios de datos con:

- frontend `React + Vite`;
- charts `D3` puros;
- backend `Express`;
- pipeline de ingestión reproducible para datasets oficiales;
- auth por sesion para proteger portal y API;
- API desacoplada para luego conectar base de datos real;
- empaquetado Docker para subir directo a VPS.

## Documentacion tecnica

- [docs/CONCEPT_NOTE.md](docs/CONCEPT_NOTE.md): concept note in English covering the product vision, users, current capabilities, architecture, methodology, security, maturity, limits, roadmap, and proprietary governance.
- [docs/architecture.md](docs/architecture.md): arquitectura de la plataforma, topologia por capas y puntos de extension.
- [docs/commercial-overview.md](docs/commercial-overview.md): que es Atlas, como funciona y que compra realmente el cliente.
- [docs/commercial-methodology.md](docs/commercial-methodology.md): metodo comercial para client briefing, one-pager y narrativa de venta.
- [docs/api-reference.md](docs/api-reference.md): contratos HTTP, respuestas y errores.
- [docs/data-contracts.md](docs/data-contracts.md): modelo de datos, metadatos y reglas de derivacion.
- [docs/operations.md](docs/operations.md): desarrollo local, build y Docker.
- [docs/security-spending-roadmap.md](docs/security-spending-roadmap.md): capa tecnica para gasto en seguridad por estado, capitulo, fondos y plataformas.

## Decisiones

La primera iteracion con Astro sirvio para probar el lenguaje visual, pero no era la base correcta para una familia grande de estudios con API, explicabilidad, drilldown y posible persistencia. Este pivot deja el proyecto en una arquitectura mas directa:

- `Vite` para desarrollo rapido del frontend;
- `React` para orquestar estado, drill y carga de datos;
- `D3` para absolutamente todas las graficas;
- `Express` como API y servidor del build final;
- `cookie auth` para cerrar el portal y la API al publico;
- `Docker` para despliegue simple.

## Estructura

- `server/`: API, servicios y datasets.
- `src/`: cliente React y componentes D3.
- `docs/architecture.md`: criterios de arquitectura.
- `docs/commercial-overview.md`: base comercial del producto.
- `docs/commercial-methodology.md`: metodologia comercial reusable.
- `docs/api-reference.md`: referencia tecnica de la API.
- `docs/data-contracts.md`: contratos de datos y metadata.
- `docs/operations.md`: runbook tecnico.
- `docs/security-spending-roadmap.md`: implementacion de la capa presupuestal.
- `Dockerfile`: imagen de produccion.
- `compose.yaml`: arranque local o en VPS.

## Scripts

```bash
npm install
npm run build:data
npm run build:data:fine
npm run dev
npm run dev:api
npm run build
npm run start
```

El snapshot publico no incluye credenciales ni scripts ligados a un proveedor.
El despliegue productivo debe realizarse mediante el proceso controlado del
operador, inyectando secretos fuera del repositorio.

## Docker

Construir imagen:

```bash
docker build -t atlas-studio:test .
```

Correr contenedor:

```bash
docker run --rm -p 4185:4173 atlas-studio:test
```

O con compose:

```bash
docker compose up --build -d
```

El `compose.yaml` publica el puerto `4185` por defecto; puede cambiarse con
`ATLAS_HOST_PORT`. El servicio escucha en el puerto `4173` dentro del contenedor.

## Endpoints demo

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/health`
- `GET /api/study`
- `GET /api/states/:stateId`
- `GET /api/states/:stateId/cities/:cityId`

## Datos

La ingestión actual genera dos agregados estatales y una capa fina heterogenea de cuentas publicas:

- `SESNSP incidencia delictiva estatal`;
- `INEGI CNSPE 2025 recursos presupuestales`;
- `Proyecciones demográficas 2025`.

Pilotos finos actualmente cableados:

- `Querétaro -> Secretaría de Seguridad Ciudadana -> capítulo y concepto`
- `Ciudad de México -> Secretaría de Seguridad Ciudadana -> capítulo y programa presupuestario`
- `Oaxaca -> cluster estatal de seguridad y protección -> clasificación administrativa`

Para regenerar el dataset:

```bash
npm run build:data
npm run build:data:fine
```

## Objetivo del starter

Que un nuevo micrositio de datos arranque con:

1. uno o mas datasets oficiales generados en el servidor;
2. una pagina React ya conectada a API;
3. primitives D3 reutilizables para ranking, tendencia, composicion y explicabilidad.

## Desarrollo local

Usar dos terminales:

```bash
npm run dev
npm run dev:api
```

El cliente corre en `http://localhost:5173` y la API en `http://localhost:4173`.
