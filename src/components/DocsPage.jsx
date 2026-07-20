import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getDocById } from '../content/docs'
import PortalNavbar from './PortalNavbar'

export default function DocsPage({
  activeDocId,
  docs,
  onNavigateAdmin,
  onNavigateDashboard,
  onNavigateInvestment,
  onNavigateMethodology,
  onOpenDoc,
  onLogout,
  session,
}) {
  const activeDoc = getDocById(activeDocId)

  function renderMarkdownLink({ href, children }) {
    if (!href) {
      return <span>{children}</span>
    }

    const matchedDoc = docs.find((doc) => href.endsWith(doc.sourcePath))

    if (matchedDoc) {
      return (
        <a
          href={`/docs?doc=${matchedDoc.id}`}
          onClick={(event) => {
            event.preventDefault()
            onOpenDoc(matchedDoc.id)
          }}
        >
          {children}
        </a>
      )
    }

    if (href.startsWith('/home/')) {
      return <code>{children}</code>
    }

    if (/^https?:/i.test(href)) {
      return (
        <a href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      )
    }

    return <a href={href}>{children}</a>
  }

  return (
    <main className="dashboard-shell dashboard-shell--docs">
      <PortalNavbar
        activeRoute="docs"
        onNavigateAdmin={onNavigateAdmin}
        onNavigateDashboard={onNavigateDashboard}
        onNavigateDocs={() => {}}
        onNavigateInvestment={onNavigateInvestment}
        onNavigateMethodology={onNavigateMethodology}
        onLogout={onLogout}
        session={session}
      />

      <header className="page-hero page-hero--reader">
        <div className="page-hero-copy">
          <p className="eyebrow">Docs / atlas studio</p>
          <h1>Documentacion del producto</h1>
          <p className="page-hero-note">
            Lector interno para arquitectura, API, datos, operacion y narrativa
            comercial. Aqui la prioridad es leer, no decorar.
          </p>
        </div>
      </header>

      <section className="docs-layout">
        <aside className="panel docs-sidebar">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Indice</p>
              <h2>Secciones</h2>
            </div>
          </div>

          <div className="doc-list">
            {docs.map((doc) => (
              <button
                className={doc.id === activeDoc.id ? 'doc-button is-active' : 'doc-button'}
                key={doc.id}
                onClick={() => onOpenDoc(doc.id)}
                type="button"
              >
                <span>{doc.category}</span>
                <strong>{doc.title}</strong>
                <p>{doc.description}</p>
              </button>
            ))}
          </div>
        </aside>

        <article className="panel docs-panel">
          <div className="docs-panel-head">
            <div>
              <p className="eyebrow">{activeDoc.category}</p>
              <p className="docs-panel-summary">{activeDoc.description}</p>
            </div>

            <div className="docs-meta">
              <span className="docs-meta-chip">{activeDoc.title}</span>
              <span className="docs-meta-chip">{activeDoc.sourcePath}</span>
              <span className="docs-meta-chip">Markdown original</span>
            </div>
          </div>

          <div className="docs-markdown">
            <ReactMarkdown
              components={{
                a: renderMarkdownLink,
              }}
              remarkPlugins={[remarkGfm]}
            >
              {activeDoc.markdown}
            </ReactMarkdown>
          </div>
        </article>
      </section>
    </main>
  )
}
