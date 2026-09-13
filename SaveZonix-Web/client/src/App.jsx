import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import LegalModal from './components/LegalModal';

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalType, setLegalType] = useState('privacy');
  const [isAdminView, setIsAdminView] = useState(
    window.location.pathname === '/admin' || window.location.search.includes('admin')
  );
  const [user, setUser] = useState(null);
  const [appConfig, setAppConfig] = useState(null);

  const DIRECT_EXE_URL = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe';

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
          appDownloadUrl: DIRECT_EXE_URL
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

  function openLegal(type) {
    setLegalType(type);
    setIsLegalOpen(true);
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
            <HowItWorks />
            <Pricing
              appConfig={appConfig}
              onSelectVip={() => {
                if (!user) {
                  setIsAuthOpen(true);
                } else {
                  alert('Redirecting to secure VIP checkout...');
                }
              }}
            />
            <FAQ />
          </>
        )}
      </main>

      {!isAdminView && (
        <Footer onOpenAdmin={openAdmin} onOpenLegal={openLegal} />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />

      <LegalModal
        isOpen={isLegalOpen}
        type={legalType}
        onClose={() => setIsLegalOpen(false)}
        onSwitchType={(t) => setLegalType(t)}
      />
    </div>
  );
}
