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
          <p className="legal-lead">SaveZonix ("we", "our", or "the platform") is dedicated to safeguarding user confidentiality and maintaining an uncompromising zero-log architecture for media downloads.
          </p>

          <section className="legal-block">
            <h3>1. Zero URL &amp; Stream Logging</h3>
            <p>We believe your media consumption is strictly private. SaveZonix operates as a direct client-side stream parser. Our servers do <strong>not</strong> intercept, log, record, or track:
            </p>
            <ul>
              <li>The URLs, video links, or playlists you analyze or download.</li>
              <li>The metadata, video titles, or author information extracted.</li>
              <li>Your destination files or downloaded media contents.</li>
            </ul>
            <p>All video chunk transfers occur directly between your device and the content delivery network (CDN) hosting the media stream.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. User Account Data</h3>
            <p>If you register for an optional free or VIP account, we collect only the minimal data required to maintain your authentication state:
            </p>
            <ul>
              <li><strong>Name:</strong>For displaying your profile badge and account settings.</li>
              <li><strong>Email Address:</strong>Used solely for delivering one-time passcodes (OTP) and account security notices.</li>
              <li><strong>Encrypted Credentials:</strong>Passwords are secured using salted bcrypt hashing. We never store plaintext passwords.</li>
            </ul>
          </section>

          <section className="legal-block">
            <h3>3. Local Storage &amp; No Tracking Cookies</h3>
            <p>We do not use advertising trackers, marketing pixels, or third-party profiling cookies. We utilize browser <code>localStorage</code> purely to store your JWT session token and today's guest quota counter.
            </p>
          </section>

          <section className="legal-block">
            <h3>4. Inquiries &amp; Data Rights</h3>
            <p>You have the right to request deletion of your account and associated profile data at any time. For questions regarding our privacy practices, reach us directly:
            </p>
            <div className="legal-contact-card">
              <span>Privacy Officer:</span>
              <a href="mailto:savezonix@gmail.com">savezonix@gmail.com</a>
            </div>
          </section>
        </>
      )
    },
    terms: {
      title: 'Terms of Service',
      tag: 'TERMS & CONDITIONS',
      date: 'October 19, 2026',
      content: (
        <>
          <p className="legal-lead">Please review these Terms of Service carefully before utilizing SaveZonix software, desktop applications, or browser companions. By installing or using the software, you enter into a legally binding agreement.
          </p>

          <section className="legal-block">
            <h3>1. Neutral Client-Side Technical Utility (Betamax Doctrine)</h3>
            <p>SaveZonix is an independent, general-purpose media transport protocol inspector and client-side stream remuxing tool. Under the established legal doctrine of <em>Sony Corp. of America v. Universal City Studios, Inc. (464 U.S. 417)</em>, technology capable of substantial, lawful, non-infringing uses does not constitute contributory copyright infringement. SaveZonix is engineered strictly for authorized personal archiving, public domain preservation, Creative Commons media, and lawful fair use (17 U.S.C. § 107).
            </p>
          </section>

          <section className="legal-block">
            <h3>2. User Sole Responsibility &amp; Warranty</h3>
            <p>You exclusively initiate, configure, and control every media download request. You warrant and represent that you possess all legal permissions, ownership rights, or statutory exemptions to download any media URL you submit. SaveZonix developers exercise zero oversight, verification, or control over the content you process.
            </p>
          </section>

          <section className="legal-block">
            <h3>3. Strict Anti-Piracy &amp; Anti-DRM Circumvention (DMCA § 1201)</h3>
            <p>SaveZonix strictly does NOT decrypt, defeat, tamper with, or circumvent any Digital Rights Management (DRM) technologies or Technological Protection Measures (TPMs), including Google Widevine, Apple FairPlay, Microsoft PlayReady, or encrypted HDCP. Commercial streams protected by hardware or software DRM cannot and will not be decrypted. Commercial piracy and unauthorized redistribution are strictly prohibited.
            </p>
          </section>

          <section className="legal-block">
            <h3>4. Zero Media Hosting &amp; Client-Side Isolation</h3>
            <p>The developers and operators of SaveZonix do NOT host, mirror, store, cache, relay, or broadcast any video or audio files. All downloads occur directly between your personal device and the remote third-party server hosting the stream. No media data passes through any central server operated by SaveZonix.
            </p>
          </section>

          <section className="legal-block">
            <h3>5. User Indemnification &amp; Hold Harmless</h3>
            <p>You agree to defend, indemnify, and hold harmless SaveZonix, its developers, authors, contributors, and hosting providers from and against any and all claims, lawsuits, liabilities, damages, losses, costs, and expenses (including reasonable attorney's fees) arising out of or related to your use of the software, your violation of these terms, or your infringement of any third-party intellectual property rights.
            </p>
          </section>

          <section className="legal-block">
            <h3>6. Absolute Limitation of Liability &amp; "AS IS" Warranty</h3>
            <p>SaveZonix is provided strictly "AS IS" and "AS AVAILABLE" without warranties of any kind. Under no circumstances shall the authors or maintainers be liable for any direct, indirect, incidental, or consequential damages. In all cases, our total aggregate liability is strictly capped at zero dollars ($0.00 USD).
            </p>
          </section>
        </>
      )
    },
    dmca: {
      title: 'DMCA & Copyright Policy',
      tag: 'INTELLECTUAL PROPERTY',
      date: 'October 19, 2026',
      content: (
        <>
          <p className="legal-lead">SaveZonix respects the intellectual property rights of content creators, rights holders, and digital artists. We maintain a strict notice-and-takedown protocol in accordance with 17 U.S.C. § 512.
          </p>

          <section className="legal-block">
            <h3>1. Pure Client-Side Architecture (No Hosting)</h3>
            <p>SaveZonix is a client-side stream inspector, not a hosting provider. We do not maintain, host, upload, re-encode, or cache any video or audio files on our servers. The software operates entirely on the end-user's local computer.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. Submitting a Legally Valid Takedown Notice</h3>
            <p>If you represent an intellectual property owner and believe that documentation or technical references on our site infringe your copyrights, please send a written notification containing:
            </p>
            <ul>
              <li>A physical or electronic signature of a person authorized to act on behalf of the copyright owner.</li>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Specific identification of the URL, documentation link, or technical reference.</li>
              <li>Your contact information including legal name, address, telephone number, and official corporate email.</li>
              <li>A statement affirming your good-faith belief that the use of the material is unauthorized.</li>
              <li>A statement under penalty of perjury that the information provided in the notice is accurate.</li>
            </ul>
          </section>

          <section className="legal-block">
            <h3>3. Designated Copyright Agent</h3>
            <p>All infringement notifications must be directed to our designated compliance contact:
            </p>
            <div className="legal-contact-card">
              <span>DMCA Agent:</span>
              <a href="mailto:savezonix@gmail.com">savezonix@gmail.com</a>
            </div>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>Response time: Within 24–48 business hours. We maintain a strict repeat infringer termination policy pursuant to 17 U.S.C. § 512(i).
            </p>
          </section>
        </>
      )
    },
    disclaimer: {
      title: 'Legal Disclaimer',
      tag: 'FAIR USE & LEGAL STATUS',
      date: 'October 19, 2026',
      content: (
        <>
          <p className="legal-lead">This disclaimer clarifies the legal status, brand affiliations, and neutral technical protocol focus of SaveZonix.
          </p>

          <section className="legal-block">
            <h3>1. Non-Affiliation Statement &amp; Nominative Fair Use</h3>
            <p>SaveZonix is an independent software application. SaveZonix is not affiliated, associated, authorized, endorsed by, or in any way officially connected with YouTube, Google LLC, Meta Platforms (Instagram/Facebook), ByteDance (TikTok), X Corp (Twitter), Vimeo, PixelFlix, Netflix, or any of their subsidiaries or affiliates.
            </p>
            <p>All product names, logos, and brands are the property of their respective owners. Mention of third-party platforms is made strictly under the doctrine of nominative fair use for descriptive technical compatibility.
            </p>
          </section>

          <section className="legal-block">
            <h3>2. Neutral Technical Protocol Tool</h3>
            <p>SaveZonix is engineered strictly as a neutral client-side technical utility for HTTP Range request analysis, stream remuxing, and authorized personal archiving. It does not provide any public catalog, torrent index, or library of copyrighted commercial media.
            </p>
          </section>

          <section className="legal-block">
            <h3>3. End-User Compliance &amp; Safe Harbor</h3>
            <p>Users must ensure that their use of SaveZonix complies with all local laws, regulations, and third-party terms of service applicable in their region. The authors disclaim all liability for any unauthorized or infringing use.
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
              >Privacy Policy
              </button>
              <button
                onClick={() => onNavigate('/terms')}
                className={`sidebar-link ${type === 'terms' ? 'active' : ''}`}
              >Terms of Service
              </button>
              <button
                onClick={() => onNavigate('/dmca')}
                className={`sidebar-link ${type === 'dmca' ? 'active' : ''}`}
              >DMCA &amp; Copyright
              </button>
              <button
                onClick={() => onNavigate('/disclaimer')}
                className={`sidebar-link ${type === 'disclaimer' ? 'active' : ''}`}
              >Legal Disclaimer
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
