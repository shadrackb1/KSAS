import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center max-w-md animate-fade-in">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '120px', lineHeight: 1, fontWeight: 900, color: 'var(--kabu-maroon)', opacity: 0.15 }}>
          404
        </h1>
        <div className="mt-4">
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Lost on Campus?
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '8px' }}>
            This page doesn't exist — but your attendance record does. Go back.
          </p>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 flex items-center justify-center gap-2 w-full h-12 btn-primary"
        >
          <Home className="w-5 h-5" />
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
