import readmeMarkdown from '../../README.md?raw'
import apiReferenceMarkdown from '../../docs/api-reference.md?raw'
import accessControlMarkdown from '../../docs/access-control.md?raw'
import architectureMarkdown from '../../docs/architecture.md?raw'
import commercialMethodologyMarkdown from '../../docs/commercial-methodology.md?raw'
import commercialOverviewMarkdown from '../../docs/commercial-overview.md?raw'
import dataContractsMarkdown from '../../docs/data-contracts.md?raw'
import operationsMarkdown from '../../docs/operations.md?raw'
import portalTermsMarkdown from '../../docs/portal-terms.md?raw'
import securitySpendingMarkdown from '../../docs/security-spending-roadmap.md?raw'

export const docsLibrary = [
  {
    id: 'overview',
    title: 'Platform overview',
    category: 'General',
    description: 'Entrada rapida al proyecto, stack, rutas y estructura principal.',
    sourcePath: 'README.md',
    markdown: readmeMarkdown,
  },
  {
    id: 'architecture',
    title: 'Architecture',
    category: 'Platform',
    description: 'Capas tecnicas de Atlas Studio y flujo completo de datos a UI.',
    sourcePath: 'docs/architecture.md',
    markdown: architectureMarkdown,
  },
  {
    id: 'commercial-overview',
    title: 'Commercial overview',
    category: 'Commercial',
    description: 'Que es Atlas, como funciona y que compra realmente el cliente.',
    sourcePath: 'docs/commercial-overview.md',
    markdown: commercialOverviewMarkdown,
  },
  {
    id: 'commercial-methodology',
    title: 'Commercial methodology',
    category: 'Commercial',
    description: 'Metodo para convertir Atlas en propuesta, briefing y narrativa de venta.',
    sourcePath: 'docs/commercial-methodology.md',
    markdown: commercialMethodologyMarkdown,
  },
  {
    id: 'access-control',
    title: 'Access control',
    category: 'Backend',
    description: 'Flujo de acceso por correo, tokens, consentimiento, storage y mailer.',
    sourcePath: 'docs/access-control.md',
    markdown: accessControlMarkdown,
  },
  {
    id: 'api-reference',
    title: 'API reference',
    category: 'Backend',
    description: 'Contratos HTTP, auth, respuestas y errores de la API del portal.',
    sourcePath: 'docs/api-reference.md',
    markdown: apiReferenceMarkdown,
  },
  {
    id: 'data-contracts',
    title: 'Data contracts',
    category: 'Data',
    description: 'Esquemas, metadata, derivaciones y lineaje del dataset del estudio.',
    sourcePath: 'docs/data-contracts.md',
    markdown: dataContractsMarkdown,
  },
  {
    id: 'operations',
    title: 'Operations',
    category: 'DevOps',
    description: 'Runbook de desarrollo local, build, Docker y despliegue.',
    sourcePath: 'docs/operations.md',
    markdown: operationsMarkdown,
  },
  {
    id: 'portal-terms',
    title: 'Portal terms',
    category: 'Legal',
    description: 'Terminos y condiciones de visualizacion y uso promocional del correo.',
    sourcePath: 'docs/portal-terms.md',
    markdown: portalTermsMarkdown,
  },
  {
    id: 'security-spending',
    title: 'Security spending layer',
    category: 'Data',
    description: 'Implementacion tecnica de gasto estatal por capitulo, fondos y plataformas.',
    sourcePath: 'docs/security-spending-roadmap.md',
    markdown: securitySpendingMarkdown,
  },
]

export function getDocById(docId) {
  return docsLibrary.find((doc) => doc.id === docId) ?? docsLibrary[0]
}
