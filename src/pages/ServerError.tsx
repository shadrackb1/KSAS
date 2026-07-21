import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RefreshCcw } from 'lucide-react';

export default function ServerError() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center max-w-md animate-fade-in">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '120px', lineHeight: 1, fontWeight: 900, color: 'var(--danger)', opacity: 0.2 }}>
          500
        </h1>
        <div className="mt-4">
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Server Error
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '8px' }}>
            Something went wrong on our end. Please try again later.
          </p>
        </div>
        <div className="flex gap-4 mt-8">
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 h-12 btn-ghost"
          >
            <RefreshCcw className="w-5 h-5" />
            Try Again
          </button>
          <button 
            onClick={() => navigate('/')}
            className="flex-1 flex items-center justify-center gap-2 h-12 btn-primary"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
