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
import UpgradeVipModal from './components/UpgradeVipModal';
import FeedbackPage from './components/FeedbackPage';

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get('verify_email') || params.get('reset_email'));
    }
    return false;
  });
  const [isVipOpen, setIsVipOpen] = useState(false);
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

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');
  const isLegalRoute = ['/privacy', '/terms', '/dmca', '/disclaimer'].includes(currentPath);
  const isFeedbackRoute = currentPath === '/feedback' || currentPath === '/uninstall';
  const legalType = isLegalRoute ? currentPath.replace('/', '') : 'privacy';

  return (
    <div className="app-wrapper">
      <Navbar
        appConfig={appConfig}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenVip={() => setIsVipOpen(true)}
        onLogout={handleLogout}
        onOpenAdmin={() => navigate('/admin/overview')}
        onNavigate={navigate}
        currentPath={currentPath}
      />

      <main>
        {isAdminRoute ? (
          <AdminDashboard
            user={user}
            currentPath={currentPath}
            onNavigate={navigate}
            onBack={() => navigate('/')}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
          />
        ) : isLegalRoute ? (
          <LegalPage type={legalType} onNavigate={navigate} />
        ) : isFeedbackRoute ? (
          <FeedbackPage onNavigate={navigate} />
        ) : (
          <>
            <Hero appConfig={appConfig} />
            <Features />
            <HowItWorks />
            <Pricing
              appConfig={appConfig}
              onSelectVip={() => setIsVipOpen(true)}
            />
            <FAQ />
          </>
        )}
      </main>

      {!isAdminRoute && (
        <Footer
          onOpenAdmin={() => navigate('/admin/overview')}
          onOpenLegal={(type) => navigate(`/${type}`)}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
      />

      <UpgradeVipModal
        isOpen={isVipOpen}
        onClose={() => setIsVipOpen(false)}
        user={user}
        onSuccess={(u) => setUser(u)}
      />
    </div>
  );
}
