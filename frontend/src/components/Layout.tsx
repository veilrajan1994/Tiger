import React, { useState, useCallback, useMemo, memo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

// ─── Nav Item ────────────────────────────────────────────────────────────────

interface NavItemProps {
  label: string;
  path: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: (path: string) => void;
}

const NavItem = memo<NavItemProps>(({ label, path, icon, isActive, onClick }) => (
  <button
    className={`nav-item ${isActive ? 'active' : ''}`}
    onClick={() => onClick(path)}
    aria-current={isActive ? 'page' : undefined}
  >
    {icon}
    {label}
  </button>
));
NavItem.displayName = 'NavItem';

// ─── Top Bar ─────────────────────────────────────────────────────────────────

interface TopBarProps {
  userName: string;
  userRole: string;
  userInitials: string;
  onMenuToggle: () => void;
  onLogout: () => void;
}

const TopBar = memo<TopBarProps>(({ userName, userRole, userInitials, onMenuToggle, onLogout }) => (
  <header className="top-bar">
    <div className="top-bar-left">
      <button className="menu-toggle" onClick={onMenuToggle} aria-label="Toggle menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <span className="app-title">Retail Pricing Management</span>
    </div>
    <div className="top-bar-right">
      <div className="user-info">
        <div className="user-avatar">{userInitials}</div>
        <div className="user-details">
          <span className="user-name">{userName}</span>
          <span className="user-role">{userRole}</span>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Logout
      </button>
    </div>
  </header>
));
TopBar.displayName = 'TopBar';

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const PricingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Pricing Records', path: '/pricing', icon: <PricingIcon /> },
  { label: 'Upload CSV', path: '/upload', icon: <UploadIcon /> }
];

const Sidebar = memo<SidebarProps>(({ isOpen, currentPath, onNavigate, onClose }) => (
  <>
    {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span>Pricing Feed</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.path}
            label={item.label}
            path={item.path}
            icon={item.icon}
            isActive={currentPath.startsWith(item.path)}
            onClick={(path) => { onNavigate(path); onClose(); }}
          />
        ))}
      </nav>
    </aside>
  </>
));
Sidebar.displayName = 'Sidebar';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuToggle = useCallback(() => setMobileOpen((prev) => !prev), []);
  const handleCloseSidebar = useCallback(() => setMobileOpen(false), []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const userName = useMemo(
    () => `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User',
    [user?.firstName, user?.lastName]
  );

  const userInitials = useMemo(
    () => `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U',
    [user?.firstName, user?.lastName]
  );

  const userRole = useMemo(
    () => user?.role?.replace('_', ' ') || 'User',
    [user?.role]
  );

  return (
    <div className="app-layout">
      <TopBar
        userName={userName}
        userRole={userRole}
        userInitials={userInitials}
        onMenuToggle={handleMenuToggle}
        onLogout={logout}
      />
      <Sidebar
        isOpen={mobileOpen}
        currentPath={location.pathname}
        onNavigate={handleNavigate}
        onClose={handleCloseSidebar}
      />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
