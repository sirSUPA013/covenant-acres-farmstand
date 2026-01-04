import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';

// Components
import LockScreen from './components/LockScreen';

// Pages
import OrdersPage from './pages/OrdersPage';
import CustomersPage from './pages/CustomersPage';
import ConfigPage from './pages/ConfigPage';
import RecipesPage from './pages/RecipesPage';
import PrepSheetPage from './pages/PrepSheetPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

interface SyncStatus {
  isOnline: boolean;
  lastSync: string | null;
  pendingChanges: number;
  isSyncing: boolean;
}

interface AdminUser {
  id: string;
  name: string;
  isOwner: boolean;
}

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSync: null,
    pendingChanges: 0,
    isSyncing: false,
  });

  const location = useLocation();

  useEffect(() => {
    // Listen for sync updates
    const unsubscribe = window.api.onSyncUpdate((status) => {
      setSyncStatus(status as SyncStatus);
    });

    // Get initial status
    window.api.getSyncStatus().then((status) => {
      setSyncStatus(status as SyncStatus);
    });

    return unsubscribe;
  }, []);

  function handleUnlock(user: AdminUser) {
    setCurrentUser(user);
    setIsLocked(false);
  }

  async function handleLogout() {
    await window.api.adminLogout();
    setCurrentUser(null);
    setIsLocked(true);
  }

  if (isLocked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  const navItems = [
    { path: '/', label: 'Orders', icon: '📋' },
    { path: '/customers', label: 'Customers', icon: '👥' },
    { path: '/config', label: 'Configure', icon: '⚙️' },
    { path: '/recipes', label: 'Recipes', icon: '📖' },
    { path: '/prep', label: 'Prep Sheet', icon: '📝' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
  ];

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="./assets/logo.jpg" alt="Covenant Acres" className="app-logo" />
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {currentUser && (
            <div className="user-badge">
              <div className="user-avatar">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{currentUser.name}</div>
                <div className="user-role">{currentUser.isOwner ? 'Owner' : 'Admin'}</div>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Lock">
                🔒
              </button>
            </div>
          )}

          <NavLink to="/settings" className="nav-item settings-link">
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
          </NavLink>

          <div className={`sync-status ${syncStatus.isOnline ? 'online' : 'offline'}`}>
            <span className="sync-indicator"></span>
            <span className="sync-text">
              {syncStatus.isSyncing
                ? 'Syncing...'
                : syncStatus.isOnline
                  ? 'Online'
                  : 'Offline'}
            </span>
            {syncStatus.pendingChanges > 0 && (
              <span className="pending-badge">{syncStatus.pendingChanges}</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/prep" element={<PrepSheetPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
