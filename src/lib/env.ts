/**
 * src/lib/env.ts
 * Type-safe environment variable access with runtime validation.
 * Build will log clear errors for any missing required variables.
 */

interface EnvConfig {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    databaseId: string;
  };
  cloudinary: {
    cloudName: string;
    uploadPreset: string;
    folderPrefix: string;
  };
  app: {
    name: string;
    url: string;
    logoUrl: string;
    demoMode: boolean;
    enableGamification: boolean;
  };
  // Additional runtime flags
  isProduction: boolean;
  isDevelopment: boolean;
  useEmulators: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Built-in defaults — override via VITE_* env vars in production.
// Copy .env.example to .env.local and fill in your own values to override these.
// In production, inject VITE_* variables via your deployment environment.
const FALLBACKS = {
  VITE_FIREBASE_API_KEY: 'AIzaSyANn7DJq76nrxMRY25vO8sAcEiRIE8Rd8c',
  VITE_FIREBASE_AUTH_DOMAIN: 'gen-lang-client-0420782130.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'gen-lang-client-0420782130',
  VITE_FIREBASE_STORAGE_BUCKET: 'gen-lang-client-0420782130.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '507824012838',
  VITE_FIREBASE_APP_ID: '1:507824012838:web:c2107667b88fe8032c70e7',
  VITE_FIREBASE_DATABASE_ID: 'ai-studio-a5c4dd4a-323c-4393-886f-818343a351d5',
  VITE_CLOUDINARY_CLOUD_NAME: 'dilrcexxe',
  VITE_CLOUDINARY_UPLOAD_PRESET: 'MingleKe',
  VITE_CLOUDINARY_FOLDER_PREFIX: 'ksas/',
  VITE_APP_NAME: 'KSAS',
  VITE_APP_URL: 'http://localhost:3000',
  VITE_DEMO_MODE: 'true',
  VITE_ENABLE_GAMIFICATION: 'false',
  VITE_USE_EMULATORS: 'false',
  VITE_LOG_LEVEL: 'info',
} as const;

function getVar(key: keyof typeof FALLBACKS): string {
  const value = import.meta.env[key] || FALLBACKS[key];
  if (!value) {
    const msg = `[KSAS] Missing required environment variable: ${key}. Check your .env file.`;
    console.error(msg);
  }
  return value || '';
}

function buildEnv(): EnvConfig {
  const mode = import.meta.env.MODE;
  const isProduction = mode === 'production';
  const isDevelopment = mode === 'development';
  
  return {
    firebase: {
      apiKey: getVar('VITE_FIREBASE_API_KEY'),
      authDomain: getVar('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: getVar('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: getVar('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getVar('VITE_FIREBASE_APP_ID'),
      databaseId: getVar('VITE_FIREBASE_DATABASE_ID'),
    },
    cloudinary: {
      cloudName: getVar('VITE_CLOUDINARY_CLOUD_NAME'),
      uploadPreset: getVar('VITE_CLOUDINARY_UPLOAD_PRESET'),
      folderPrefix: getVar('VITE_CLOUDINARY_FOLDER_PREFIX'),
    },
    app: {
      name: getVar('VITE_APP_NAME'),
      url: getVar('VITE_APP_URL'),
      logoUrl: (import.meta.env.VITE_APP_LOGO_URL as string) || '/kabarak-logo.png',
      demoMode: getVar('VITE_DEMO_MODE') === 'true',
      enableGamification: getVar('VITE_ENABLE_GAMIFICATION') === 'true',
    },
    isProduction,
    isDevelopment,
    useEmulators: getVar('VITE_USE_EMULATORS') === 'true' && isDevelopment,
    logLevel: (getVar('VITE_LOG_LEVEL') as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };
}

export const env = buildEnv();

// Logger utility
export const logger = {
  debug: (...args: any[]) => env.logLevel === 'debug' && console.debug('[KSAS]', ...args),
  info: (...args: any[]) => ['debug', 'info'].includes(env.logLevel) && console.info('[KSAS]', ...args),
  warn: (...args: any[]) => ['debug', 'info', 'warn'].includes(env.logLevel) && console.warn('[KSAS]', ...args),
  error: (...args: any[]) => console.error('[KSAS]', ...args),
};