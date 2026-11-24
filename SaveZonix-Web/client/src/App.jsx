import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DownloadStudio from './components/DownloadStudio';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import SupportedPlatforms from './components/SupportedPlatforms';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import LegalPage from './components/LegalPage';
import UpgradeVipModal from './components/UpgradeVipModal';
import FeedbackPage from './components/FeedbackPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import UserDashboard from './components/UserDashboard';
import PricingPage from './components/PricingPage';
import YouTubeDownloaderPage from './components/landing/YouTubeDownloaderPage';
import YouTubeToMp3Page from './components/landing/YouTubeToMp3Page';
import InstagramReelsDownloaderPage from './components/landing/InstagramReelsDownloaderPage';
import PlaylistDownloaderPage from './components/landing/PlaylistDownloaderPage';
import ExtensionInstallModal from './components/ExtensionInstallModal';
import FreeTrialGatekeeperModal from './components/FreeTrialGatekeeperModal';
import SEOHead from './components/SEOHead';
import { setMaxFreeTrials } from './utils/trialManager';

export default function App() {
  const [isAuthOpen, setIsAuthOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get('verify_email') || params.get('reset_email'));
    }
    return false;
  });
  const [isVipOpen, setIsVipOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isGatekeeperOpen, setIsGatekeeperOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [user, setUser] = useState(null);
  const [appConfig, setAppConfig] = useState(null);

  const CHROME_STORE_DEFAULT = 'https://chromewebstore.google.com/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=en&pli=1';

  useEffect(() => {
    // Check local storage for logged-in user
    const storedUser = localStorage.getItem('savezonix_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {}
    }

    // Ping Render backend in background to wake up cold container immediately
    try {
      fetch('/api/health').catch(() => {});
    } catch {}

    // Fetch dynamic app config
    fetch('/api/app-config')
      .then((res) => res.json())
      .then((data) => {
        setAppConfig(data);
        if (data.freeDailyLimit) {
          setMaxFreeTrials(data.freeDailyLimit);
        }
      })
      .catch(() => {
        setAppConfig({
          latestAppVersion: '2.6.1',
          freeDailyLimit: 3,
          vipMonthlyPriceINR: 99,
          chromeWebStoreUrl: CHROME_STORE_DEFAULT
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
  const isAboutRoute = currentPath === '/about';
  const isContactRoute = currentPath === '/contact';
  const isDashboardRoute = currentPath === '/dashboard';
  const isPricingRoute = currentPath === '/pricing';
  const isYouTubeDownloader = currentPath === '/youtube-downloader';
  const isYouTubeToMp3 = currentPath === '/youtube-to-mp3';
  const isInstagramReels = currentPath === '/instagram-reels-downloader';
  const isPlaylistDownloader = currentPath === '/playlist-downloader';
  const legalType = isLegalRoute ? currentPath.replace('/', '') : 'privacy';

  return (
    <div className="app-wrapper">
      <Navbar
        appConfig={appConfig}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenVip={() => setIsVipOpen(true)}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
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
        ) : isAboutRoute ? (
          <AboutPage onNavigate={navigate} />
        ) : isContactRoute ? (
          <ContactPage onNavigate={navigate} />
        ) : isDashboardRoute ? (
          <UserDashboard
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onNavigate={navigate}
          />
        ) : isPricingRoute ? (
          <PricingPage
            user={user}
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigate={navigate}
          />
        ) : isYouTubeDownloader ? (
          <YouTubeDownloaderPage
            user={user}
            appConfig={appConfig}
            onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onNavigate={navigate}
          />
        ) : isYouTubeToMp3 ? (
          <YouTubeToMp3Page
            user={user}
            appConfig={appConfig}
            onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onNavigate={navigate}
          />
        ) : isInstagramReels ? (
          <InstagramReelsDownloaderPage
            user={user}
            appConfig={appConfig}
            onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onNavigate={navigate}
          />
        ) : isPlaylistDownloader ? (
          <PlaylistDownloaderPage
            user={user}
            appConfig={appConfig}
            onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
            onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            onOpenVip={() => setIsVipOpen(true)}
            onNavigate={navigate}
          />
        ) : (
          <>
            <SEOHead />
            <Hero
              appConfig={appConfig}
              onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
            />
            <div id="studio">
              <DownloadStudio
                user={user}
                appConfig={appConfig}
                onOpenGatekeeper={() => setIsGatekeeperOpen(true)}
                onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
                onOpenVip={() => setIsVipOpen(true)}
              />
            </div>
            <SupportedPlatforms />
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
          onNavigate={navigate}
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
        appConfig={appConfig}
        onSuccess={(u) => setUser(u)}
      />

      <ExtensionInstallModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
      />

      <FreeTrialGatekeeperModal
        isOpen={isGatekeeperOpen}
        appConfig={appConfig}
        onClose={() => setIsGatekeeperOpen(false)}
        onOpenExtension={() => setIsExtensionModalOpen(true)}
        onOpenVip={() => setIsVipOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />
    </div>
  );
}
