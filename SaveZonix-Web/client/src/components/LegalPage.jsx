import React, { useEffect } from 'react';

export default function LegalPage({ type = 'privacy', onNavigate }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  const policies = {
    privacy: {
      title: 'Privacy Policy',
      tag: 'DATA PROTECTION & SECURITY',
      date: 'September 13, 2026',
      content: (
        <>
          <p className="legal-lead">
            SaveZonix ("we", "our", or "the platform") is dedicated to safeguarding user confidentiality and maintaining an uncompromising zero-log architecture for media downloads.
          </p>

          <section className="legal-block">
            <h3>1. Zero URL &amp; Stream Logging</h3>
            <p>
              We believe your media consumption is strictly private. SaveZonix operates as a direct client-side stream parser. Our servers do <strong>not</strong> intercept, log, record, or track:
            </p>
            <ul>
              <li>The URLs, video links, or playlists you analyze or download.</li>
              <li>The metadata, video titles, or author information extracted.</li>
              <li>Your destination files or downloaded media contents.</li>
            </ul>
            <p>
              All video chunk transfers occur directly between your device and the content delivery network (CDN) hosting the media stream.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. User Account Data</h3>
            <p>
              If you register for an optional free or VIP account, we collect only the minimal data required to maintain your authentication state:
            </p>
            <ul>
              <li><strong>Name:</strong> For displaying your profile badge and account settings.</li>
              <li><strong>Email Address:</strong> Used solely for delivering one-time passcodes (OTP) and account security notices.</li>
              <li><strong>Encrypted Credentials:</strong> Passwords are secured using salted bcrypt hashing. We never store plaintext passwords.</li>
            </ul>
          </section>

          <section className="legal-block">
            <h3>3. Local Storage &amp; No Tracking Cookies</h3>
            <p>
              We do not use advertising trackers, marketing pixels, or third-party profiling cookies. We utilize browser <code>localStorage</code> purely to store your JWT session token and today's guest quota counter.
            </p>
          </section>

          <section className="legal-block">
            <h3>4. Inquiries &amp; Data Rights</h3>
            <p>
              You have the right to request deletion of your account and associated profile data at any time. For questions regarding our privacy practices, reach us directly:
            </p>
            <div className="legal-contact-card">
              <span>📧 Privacy Officer:</span>
              <a href="mailto:savezonix@gmail.com">savezonix@gmail.com</a>
            </div>
          </section>
        </>
      )
    },
    terms: {
      title: 'Terms of Service',
      tag: 'TERMS & CONDITIONS',
      date: 'September 13, 2026',
      content: (
        <>
          <p className="legal-lead">
            Please review these Terms of Service carefully before utilizing SaveZonix software, desktop applications, or browser companions.
          </p>

          <section className="legal-block">
            <h3>1. Agreement to Terms</h3>
            <p>
              By accessing our website, installing the SaveZonix desktop client, or using the extension, you agree to comply with and be bound by these terms. If you disagree with any part, you must refrain from using the software.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. Permitted Personal &amp; Archival Use</h3>
            <p>
              SaveZonix is engineered as a productivity utility for personal offline archiving, fair use analysis, and educational research. You agree:
            </p>
            <ul>
              <li>To download only media that you hold the legal authority, intellectual rights, or explicit permission to access offline.</li>
              <li>Not to commercially redistribute, broadcast, or resell proprietary content obtained via the software.</li>
              <li>To comply with all relevant copyright legislation applicable in your home territory.</li>
            </ul>
          </section>

          <section className="legal-block">
            <h3>3. VIP Pro Subscriptions</h3>
            <p>
              VIP Pro memberships unlock uncapped concurrency (up to 256 connections), unrestricted 4K HDR stream parsing, and priority assistance. Subscriptions are billed at ₹99/month and may be managed or cancelled at any time through your account portal.
            </p>
          </section>

          <section className="legal-block">
            <h3>4. Warranty &amp; Service Availability</h3>
            <p>
              SaveZonix is provided on an "AS IS" and "AS AVAILABLE" basis. As third-party platforms update their streaming architectures, we strive to update our parsers promptly, but do not warrant perpetual compatibility with every external media provider.
            </p>
          </section>
        </>
      )
    },
    dmca: {
      title: 'DMCA & Copyright Policy',
      tag: 'INTELLECTUAL PROPERTY',
      date: 'September 13, 2026',
      content: (
        <>
          <p className="legal-lead">
            SaveZonix respects the intellectual property rights of content creators, rights holders, and digital artists. We maintain a strict notice-and-takedown protocol in accordance with the Digital Millennium Copyright Act (DMCA).
          </p>

          <section className="legal-block">
            <h3>1. Pure Client-Side Architecture</h3>
            <p>
              SaveZonix is a software utility and stream analyzer, not a hosting provider. We do not maintain, host, upload, re-encode, or cache any video or audio files on our servers. The software operates entirely on the end-user's local computer.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. Submitting a Takedown Notice</h3>
            <p>
              If you represent an intellectual property owner and believe that material accessible via our platform infringes your copyrights, please send a written notification containing:
            </p>
            <ul>
              <li>A physical or electronic signature of a person authorized to act on behalf of the copyright owner.</li>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Specific identification of the URL or technical stream details.</li>
              <li>Your contact information including full name, address, telephone number, and official email.</li>
              <li>A statement affirming your good-faith belief that the use of the material is unauthorized.</li>
              <li>A statement that the information provided in the notice is accurate under penalty of perjury.</li>
            </ul>
          </section>

          <section className="legal-block">
            <h3>3. Designated Copyright Contact</h3>
            <p>
              All infringement notifications must be directed to our designated compliance contact:
            </p>
            <div className="legal-contact-card">
              <span>📧 DMCA Agent:</span>
              <a href="mailto:savezonix@gmail.com">savezonix@gmail.com</a>
            </div>
          </section>
        </>
      )
    },
    disclaimer: {
      title: 'Legal Disclaimer',
      tag: 'FAIR USE & LEGAL STATUS',
      date: 'September 13, 2026',
      content: (
        <>
          <p className="legal-lead">
            This disclaimer clarifies the legal status, brand affiliations, and research &amp; educational focus of the SaveZonix project.
          </p>

          <section className="legal-block">
            <h3>1. Non-Affiliation Statement</h3>
            <p>
              SaveZonix is an independent software application developed with Microsoft .NET and standard web technologies. SaveZonix is not affiliated, associated, authorized, endorsed by, or in any way officially connected with YouTube, Google LLC, Meta Platforms (Instagram/Facebook), ByteDance (TikTok), X Corp (Twitter), Vimeo, or any of their subsidiaries or affiliates.
            </p>
            <p>
              All product names, logos, and brands are the property of their respective owners. Their mention does not imply endorsement or partnership.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. Research &amp; Development (R&amp;D) and Educational Purpose</h3>
            <p>
              SaveZonix is strictly a Research &amp; Development (R&amp;D) and educational project engineered for academic learning into high-throughput network streaming, HTTP Range requests, multi-threaded TCP socket multiplexing, and FFmpeg workflows. It is NOT intended or licensed for commercial enterprise or professional business use. While the software is closed-source/proprietary personal work of the authors, all builds are distributed solely for educational exploration and personal non-commercial study. Unauthorized resale or commercial exploitation is strictly prohibited.
            </p>
          </section>

          <section className="legal-block">
            <h3>3. End-User Compliance</h3>
            <p>
              Users must ensure that their use of SaveZonix complies with all local laws, regulations, and third-party terms of service applicable in their region.
            </p>
          </section>
        </>
      )
    }
  };

  const current = policies[type] || policies.privacy;

  return (
    <div className="legal-page-container">
      {/* Top Breadcrumb Header */}
      <div className="legal-header-wrapper">
        <div className="legal-breadcrumb">
          <button onClick={() => onNavigate('/')} className="breadcrumb-link">Home</button>
          <span>/</span>
          <span className="breadcrumb-current">Legal &amp; Policies</span>
          <span>/</span>
          <span className="breadcrumb-active">{current.title}</span>
        </div>

        <div className="legal-title-section">
          <span className="legal-tag">{current.tag}</span>
          <h1 className="legal-title">{current.title}</h1>
          <p className="legal-meta">Effective Date: {current.date} • SaveZonix Universal Engine</p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="legal-layout-grid">
        {/* Left Sticky Sidebar */}
        <aside className="legal-sidebar">
          <div className="sidebar-card">
            <h4 className="sidebar-heading">Legal Documents</h4>
            <nav className="sidebar-nav">
              <button
                onClick={() => onNavigate('/privacy')}
                className={`sidebar-link ${type === 'privacy' ? 'active' : ''}`}
              >
                🔒 Privacy Policy
              </button>
              <button
                onClick={() => onNavigate('/terms')}
                className={`sidebar-link ${type === 'terms' ? 'active' : ''}`}
              >
                📜 Terms of Service
              </button>
              <button
                onClick={() => onNavigate('/dmca')}
                className={`sidebar-link ${type === 'dmca' ? 'active' : ''}`}
              >
                🛡️ DMCA &amp; Copyright
              </button>
              <button
                onClick={() => onNavigate('/disclaimer')}
                className={`sidebar-link ${type === 'disclaimer' ? 'active' : ''}`}
              >
                ⚖️ Legal Disclaimer
              </button>
            </nav>

            <div className="sidebar-contact-box">
              <p className="sidebar-contact-title">Have legal questions?</p>
              <a href="mailto:savezonix@gmail.com" className="sidebar-contact-email">
                savezonix@gmail.com
              </a>
            </div>

            <button onClick={() => onNavigate('/')} className="btn-back-home">
              ← Back to Main Website
            </button>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="legal-content-card">
          {current.content}
        </main>
      </div>
    </div>
  );
}
