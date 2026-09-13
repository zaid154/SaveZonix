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
import LegalPage from './components/LegalPage';

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
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

  // Listen for browser back / forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(path) {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  }

  function handleLogout() {
    localStorage.removeItem('savezonix_token');
    localStorage.removeItem('savezonix_user');
    setUser(null);
  }

  const isLegalRoute = ['/privacy', '/terms', '/dmca', '/disclaimer'].includes(currentPath);
  const legalType = isLegalRoute ? currentPath.replace('/', '') : 'privacy';

  return (
    <div className="app-wrapper">
      <Navbar
        appConfig={appConfig}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenAdmin={() => navigate('/admin')}
        onNavigate={navigate}
        currentPath={currentPath}
      />

      <main>
        {currentPath === '/admin' ? (
          <AdminDashboard user={user} onBack={() => navigate('/')} />
        ) : isLegalRoute ? (
          <LegalPage type={legalType} onNavigate={navigate} />
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

      {currentPath !== '/admin' && (
        <Footer
          onOpenAdmin={() => navigate('/admin')}
          onOpenLegal={(type) => navigate(`/${type}`)}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />
    </div>
  );
}
