import { Component, ErrorInfo, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Real React error boundary — class component with getDerivedStateFromError
 * and componentDidCatch. Catches any render error in its subtree and shows
 * a recovery UI instead of letting the tree unmount to a blank page.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[KSAS ErrorBoundary] Render error caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #FAFAFB)',
            padding: '32px',
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              background: 'var(--bg-surface, #FFFFFF)',
              border: '1px solid var(--bg-border, #EAD8DB)',
              borderRadius: '20px',
              padding: '48px 36px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'var(--danger-bg, #FDF0EF)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <AlertTriangle style={{ width: '28px', height: '28px', color: 'var(--danger, #C0392B)' }} />
            </div>

            <h2
              style={{
                fontFamily: "'Gloock', serif",
                fontSize: '22px',
                color: 'var(--text-primary, #1A0508)',
                marginBottom: '8px',
                letterSpacing: '-0.01em',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '14px',
                fontWeight: 300,
                color: 'var(--text-secondary, #6B4A50)',
                marginBottom: '8px',
                lineHeight: 1.5,
              }}
            >
              An unexpected error occurred. Please try again.
            </p>

            {this.state.error && (
              <p
                style={{
                  fontSize: '11px',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--text-tertiary, #9A7A82)',
                  marginBottom: '28px',
                  padding: '12px',
                  background: 'var(--bg-elevated, #F8F7F5)',
                  borderRadius: '8px',
                  wordBreak: 'break-all',
                  lineHeight: 1.4,
                  maxHeight: '120px',
                  overflow: 'auto',
                }}
              >
                {this.state.error.message || String(this.state.error)}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1px solid var(--bg-border, #EAD8DB)',
                  background: 'var(--bg-void, #FFFFFF)',
                  color: 'var(--text-primary, #1A0508)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                <RefreshCw style={{ width: '14px', height: '14px' }} />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'var(--kabu-maroon, #7B1A2B)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
    }

    return this.props.children;
  }
}
