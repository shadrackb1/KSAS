import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { QueryProvider } from './lib/queryClient';
import { logger, env } from './lib/env';

if (env.isProduction) {
  logger.info('KSAS Production Mode');
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    logger.debug('HMR update received');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>
);