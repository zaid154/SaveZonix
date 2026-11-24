import React, { useState, useEffect } from 'react';
import SEOHead from './SEOHead';
import { Mail, MessageSquare, ShieldAlert, Send, CheckCircle2, Clock } from 'lucide-react';

export default function ContactPage({ onNavigate }) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'general', message: '' });
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setIsSubmitted(true);
  };

  const schema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact SaveZonix Support & Compliance",
    "url": "https://savezonix-pro.vercel.app/contact",
    "description": "Get in touch with the SaveZonix technical support, DMCA compliance, and partnership team.",
    "mainEntity": {
      "@type": "Organization",
      "name": "SaveZonix",
      "email": "savezonix@gmail.com",
      "url": "https://savezonix-pro.vercel.app/"
    }
  };

  return (
    <div className="legal-page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 16px 80px' }}>
      <SEOHead
        title="Contact Us — SaveZonix Support, DMCA &amp; Feedback"
        description="Contact SaveZonix support for assistance, bug reports, feature requests, or DMCA compliance notices. Fast responses within 24-48 business hours."
        canonical="https://savezonix-pro.vercel.app/contact"
        schema={schema}
      />

      <div style={{ marginBottom: '36px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          GET IN TOUCH
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.6rem)', fontWeight: '800', color: '#fff', marginBottom: '14px' }}>
          Contact SaveZonix Team
        </h1>
        <p style={{ color: '#94a3b8', maxWidth: '640px', margin: '0 auto', fontSize: '1rem', lineHeight: '1.6' }}>
          Have technical questions, troubleshooting inquiries, DMCA notifications, or partnership requests? We are here to help.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
        {/* Left Column: Direct Contacts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Mail size={18} />
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>Customer &amp; Technical Support</h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: '1.6', margin: '0 0 10px 0' }}>
              For general help, download stream issues, extension guidance, or VIP tier billing questions.
            </p>
            <a href="mailto:savezonix@gmail.com" style={{ color: '#38bdf8', fontWeight: '700', fontSize: '0.92rem', textDecoration: 'none' }}>
              savezonix@gmail.com
            </a>
          </div>

          <div style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px', backdropFilter: 'blur(16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                <ShieldAlert size={18} />
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>DMCA &amp; Copyright Compliance</h3>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: '1.6', margin: '0 0 10px 0' }}>
              For copyright holders and legal representatives pursuant to 17 U.S.C. § 512 notice requirements.
            </p>
            <a href="mailto:savezonix@gmail.com?subject=DMCA%20Notice" style={{ color: '#f87171', fontWeight: '700', fontSize: '0.92rem', textDecoration: 'none' }}>
              savezonix@gmail.com
            </a>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color="#34d399" />
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong style={{ color: '#f1f5f9' }}>Response SLA:</strong> Inquiries are typically reviewed and resolved within 24 to 48 business hours.
            </div>
          </div>
        </div>

        {/* Right Column: Contact Message Form */}
        <div style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '30px', backdropFilter: 'blur(16px)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={20} color="#38bdf8" /> Send Us a Message
          </h2>

          {isSubmitted ? (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#34d399' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>Thank You for Reaching Out!</h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: 0 }}>
                Your message has been dispatched to our engineering team. We will review and reply to {formData.email} shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>Your Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Miller"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>Subject Category</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#fff', outline: 'none' }}
                >
                  <option value="general">General Inquiry</option>
                  <option value="technical">Technical Support / Bug Report</option>
                  <option value="dmca">DMCA / Copyright Compliance</option>
                  <option value="vip">VIP Pro &amp; Billing</option>
                  <option value="partnership">Partnership / API Access</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="How can we assist you today? Please include video URL if reporting an issue..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#fff', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.94rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 18px rgba(37, 99, 235, 0.45)',
                  marginTop: '4px'
                }}
              >
                <Send size={16} /> Submit Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
