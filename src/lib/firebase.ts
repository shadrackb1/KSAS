import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
  writeBatch,
  Firestore,
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { env } from './env';

const firebaseConfig = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  storageBucket: env.firebase.storageBucket,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with persistence
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Initialize Firestore with offline persistence
export const db = getFirestore(app);
const firestoreDb = db as Firestore;

try {
  if (typeof window !== 'undefined') {
    enableMultiTabIndexedDbPersistence(firestoreDb).catch(() => {
      enableIndexedDbPersistence(firestoreDb).catch(console.error);
    });
  }
} catch (e) {
  console.warn('Firestore persistence unavailable:', e);
}

// Initialize Storage
export const storage = getStorage(app);

// Initialize Analytics (only in production)
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined' && env.isProduction) {
  isSupported().then((yes) => {
    if (yes) analytics = getAnalytics(app);
  });
}

export const logAnalyticsEvent = (eventName: string, params?: Record<string, any>) => {
  if (analytics) logEvent(analytics, eventName, params);
};

// Emulator setup for development
if (env.useEmulators && typeof window !== 'undefined') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestoreDb, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

// Re-export Firestore functions
export {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
  writeBatch,
  type QueryConstraint,
  type DocumentData,
};

// Auth helpers
export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) =>
  onAuthStateChanged(auth, callback);

export const updateUserProfile = (data: { displayName?: string; photoURL?: string }) =>
  auth.currentUser ? updateProfile(auth.currentUser, data) : Promise.reject('No user');

export const changeUserPassword = (currentPassword: string, newPassword: string) => {
  const user = auth.currentUser;
  if (!user || !user.email) return Promise.reject('No user');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  return reauthenticateWithCredential(user, credential).then(() => updatePassword(user, newPassword));
};

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export const verifyEmail = () => auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.reject('No user');

// Cloudinary config
export const CLOUDINARY_CONFIG = {
  cloudName: env.cloudinary.cloudName,
  uploadPreset: env.cloudinary.uploadPreset,
  folderPrefix: env.cloudinary.folderPrefix,
};

// Collections are exported from collections.ts (imported via db.ts re-export)