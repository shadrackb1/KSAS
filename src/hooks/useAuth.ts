import { useState, useEffect } from 'react';
import { seedAdminIfNotExists } from '../lib/seed-admin';
import { db, collection, query, where, getDocs, doc, setDoc } from '../lib/firebase';
import { hashPassword } from '../lib/auth';

let seeded = false;

const getCachedUser = () => {
  const cachedUser = localStorage.getItem('ksas_current_user');
  if (cachedUser) {
    try { return JSON.parse(cachedUser); } catch (e) { return null; }
  }
  return null;
};

export function useAuth() {
  const [user, setUser] = useState<any>(getCachedUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!seeded) {
      seeded = true;
      seedAdminIfNotExists().catch(e => console.error('Failed to seed admin', e));
    }
  }, []);

  const login = (userData: any) => {
    localStorage.setItem('ksas_current_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ksas_current_user');
    setUser(null);
    window.location.href = '/';
  };

  // Update display name and email in Firestore + localStorage
  const updateProfile = async (name: string, email: string): Promise<void> => {
    if (!user) throw new Error('Not logged in');

    // Find the user's Firestore document
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error('User record not found');

    const userDocRef = snapshot.docs[0].ref;
    await setDoc(userDocRef, { name, email }, { merge: true });

    const updated = { ...user, name, email };
    localStorage.setItem('ksas_current_user', JSON.stringify(updated));
    setUser(updated);
  };

  // Change password: verify old, write new hash
  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    if (!user) throw new Error('Not logged in');
    if (newPassword.length < 6) throw new Error('New password must be at least 6 characters');

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', user.email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) throw new Error('User record not found');

    const userData = snapshot.docs[0].data();
    const oldHash = hashPassword(oldPassword);

    if (userData.password !== oldHash) {
      throw new Error('Current password is incorrect');
    }

    const newHash = hashPassword(newPassword);
    await setDoc(snapshot.docs[0].ref, { password: newHash }, { merge: true });
  };

  return { user, loading, login, logout, updateProfile, changePassword };
}
