import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: false,
      minify: true,
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/analytics'],
            'vendor-charts': ['recharts'],
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'motion'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-utils': ['date-fns', 'papaparse', 'clsx', 'tailwind-merge', 'crypto-js'],
            'vendor-icons': ['lucide-react'],
            'vendor-qr': ['qrcode.react'],
            'vendor-auth': ['otpauth'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'firebase/analytics',
        'date-fns',
        'lucide-react',
        'clsx',
      ],
      exclude: ['recharts'],
    },
  };
});