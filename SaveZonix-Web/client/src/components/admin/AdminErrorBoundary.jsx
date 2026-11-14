import React from 'react';
import { IconAlertCircle, IconRefresh } from './AdminIcons';

export default class AdminErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[AdminModule Error] ${this.props.moduleName || 'Component'} failed:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          margin: '16px 0',
          color: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <IconAlertCircle size={18} color="#f87171" />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f87171' }}>
              Module Recovery Guard: {this.props.moduleName || 'Section'}
            </h4>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#94a3b8', lineHeight: '1.5' }}>
            This individual module encountered an isolated rendering error. The rest of your admin console and session remains secure and functional.
          </p>
          <div style={{
            padding: '10px 12px',
            background: '#060a12',
            border: '1px solid #1a2333',
            borderRadius: '6px',
            fontSize: '11.5px',
            color: '#fca5a5',
            fontFamily: 'monospace',
            marginBottom: '14px',
            overflowX: 'auto'
          }}>
            {this.state.error?.message || 'Unknown runtime exception'}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#131b2c',
              border: '1px solid #1e293b',
              borderRadius: '6px',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <IconRefresh size={12} color="#38bdf8" />
            Reload Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
