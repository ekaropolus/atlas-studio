function NavItem({ active, children, onClick }) {
  return (
    <button className={active ? 'nav-button is-active' : 'nav-button'} onClick={onClick} type="button">
      {children}
    </button>
  )
}

export default function PortalNavbar({
  activeRoute,
  onNavigateAdmin,
  onNavigateDashboard,
  onNavigateDocs,
  onNavigateInvestment,
  onNavigateMethodology,
  onLogout,
  session,
}) {
  return (
    <header className="portal-navbar">
      <div className="portal-brand">
        <div className="portal-brand-mark">ATLAS</div>
        <div className="portal-brand-copy">
          <p className="eyebrow">Polisplexity / secure portal</p>
          <strong>Atlas Suite</strong>
          <span>Comparativo estatal e inversion publica en seguridad</span>
        </div>
      </div>

      <div className="portal-navbar-actions">
        <nav className="nav-group portal-nav-group" aria-label="Navegacion principal">
          <NavItem active={activeRoute === 'dashboard'} onClick={onNavigateDashboard}>
            Comparativo
          </NavItem>
          <NavItem active={activeRoute === 'investment'} onClick={onNavigateInvestment}>
            Inversion
          </NavItem>
          <NavItem active={activeRoute === 'methodology'} onClick={onNavigateMethodology}>
            Metodologia
          </NavItem>
          <NavItem active={activeRoute === 'docs'} onClick={onNavigateDocs}>
            Docs
          </NavItem>
          {session.role === 'admin' ? (
            <NavItem active={activeRoute === 'admin'} onClick={onNavigateAdmin}>
              Admin
            </NavItem>
          ) : null}
        </nav>

        <div className="session-toolbar">
          <div className="session-chip">
            <span>Sesion activa</span>
            <strong>{session.displayName}</strong>
          </div>
          <button className="nav-button nav-button--ghost" onClick={onLogout} type="button">
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
