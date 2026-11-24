import { useEffect } from 'react';

/**
 * Dynamic SEO Head Manager for SaveZonix SPA
 * Updates document title, meta tags, canonical link, and JSON-LD schema on route changes
 */
export default function SEOHead({
  title = 'SaveZonix: Free Video Downloader — YouTube 4K, MP3 & Reels',
  description = 'Download YouTube videos in 4K & 1080p, extract 320kbps MP3 audio, and save Instagram Reels with SaveZonix. 100% free, fast, and no registration required!',
  canonical = 'https://savezonix-pro.vercel.app/',
  keywords,
  ogType = 'website',
  ogImage = 'https://savezonix-pro.vercel.app/og-image.png',
  schema = null
}) {
  useEffect(() => {
    // 1. Update Document Title
    document.title = title;

    // Helper to update or create meta tags
    const setMetaTag = (selector, attribute, value, content) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attribute, value);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 2. Primary Meta Tags
    setMetaTag('meta[name="description"]', 'name', 'description', description);
    if (keywords) {
      setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);
    }

    // 3. Canonical Link
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonical);

    // 4. OpenGraph Tags
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage);

    // 5. Twitter Card Tags
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage);

    // 6. Dynamic JSON-LD Structured Data
    const SCRIPT_ID = 'seo-dynamic-jsonld';
    let scriptEl = document.getElementById(SCRIPT_ID);

    if (schema) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = SCRIPT_ID;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schema);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    // Cleanup on unmount (revert or keep)
    return () => {
      // Clean script on navigate
    };
  }, [title, description, canonical, keywords, ogType, ogImage, schema]);

  return null;
}
