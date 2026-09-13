import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Pricing from './components/Pricing';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [appConfig, setAppConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(
    window.location.pathname === '/admin' || window.location.search.includes('admin')
  );

  useEffect(() => {
    // Check local storage for logged-in user
    const storedUser = localStorage.getItem('savezonix_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {}
    }

    // Fetch dynamic app config
    fetch('/api/app-config')
      .then((res) => res.json())
      .then((data) => setAppConfig(data))
      .catch(() => {
        setAppConfig({
          latestAppVersion: '2.5.0',
          freeDailyLimit: 10,
          vipMonthlyPriceINR: 99,
          appDownloadUrl: 'https://github.com/zaid154/SaveZonix/releases/latest'
        });
      });
  }, []);

  function handleLogout() {
    localStorage.removeItem('savezonix_token');
    localStorage.removeItem('savezonix_user');
    setUser(null);
  }

  // Handle browser back/forward for /admin
  useEffect(() => {
    window.onpopstate = () => {
      setIsAdminView(window.location.pathname === '/admin' || window.location.search.includes('admin'));
    };
  }, []);

  function openAdmin() {
    window.history.pushState({}, '', '/admin');
    setIsAdminView(true);
  }

  function closeAdmin() {
    window.history.pushState({}, '', '/');
    setIsAdminView(false);
  }

  return (
    <div className="app-wrapper">
      <Navbar
        appConfig={appConfig}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenAdmin={openAdmin}
      />

      <main>
        {isAdminView ? (
          <AdminDashboard user={user} onBack={closeAdmin} />
        ) : (
          <>
            <Hero appConfig={appConfig} />
            <Features />
            <Pricing
              appConfig={appConfig}
              onSelectVip={() => {
                if (!user) {
                  setIsAuthOpen(true);
                } else {
                  alert('Redirecting to secure payment checkout...');
                }
              }}
            />
          </>
        )}
      </main>

      <footer className="site-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <p>© 2026 SaveZonix Inc. Built in C# .NET &amp; MERN. All rights reserved.</p>
          <button
            onClick={openAdmin}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}
          >
            🛡️ Admin Portal
          </button>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  );
}
