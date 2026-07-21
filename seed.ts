import { db, collection, doc, setDoc, serverTimestamp } from './src/lib/firebase';
import { hashPassword } from './src/lib/auth';

async function seedAdmin() {
  try {
    const adminDoc = doc(db, 'users', 'admin_default');
    await setDoc(adminDoc, {
      uid: 'admin_default',
      name: 'System Administrator',
      email: 'admin@kabarak.ac.ke',
      password: hashPassword('Mwahanga@1'),
      role: 'admin',
      status: 'active',
      createdAt: serverTimestamp()
    }, { merge: true });
    console.log('Admin account seeded successfully.');
  } catch (err) {
    console.error('Failed to seed admin:', err);
  }
}

seedAdmin();
