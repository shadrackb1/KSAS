/**
 * src/lib/seed-admin.ts
 * Seeds the default admin account on first run.
 * The password hash is computed in-app and NEVER logged or displayed.
 */
import { db, collection, query, where, getDocs, doc, setDoc, serverTimestamp } from './firebase';
import { hashPassword } from './auth';

const ADMIN_EMAIL = 'admin@kabarak.ac.ke';
const ADMIN_PW_HASH = hashPassword('12345678');

interface AdminRoleEntry {
  role: string;
  uid: string;
  name: string;
  department?: string;
  faculty?: string;
}

const ADMIN_ROLES: AdminRoleEntry[] = [
  { role: 'admin', uid: 'admin_admin', name: 'System Administrator' },
  { role: 'dean', uid: 'admin_dean', name: 'University Dean', faculty: 'general' },
  { role: 'associate-dean', uid: 'admin_assoc-dean', name: 'Associate Dean', faculty: 'general' },
  { role: 'hod', uid: 'admin_hod', name: 'Head of Department', department: 'general' },
  { role: 'lecturer', uid: 'admin_lecturer', name: 'Academic Lecturer', department: 'general' },
  { role: 'student', uid: 'admin_student', name: 'Student User' },
];

export async function seedAdminIfNotExists() {
  try {
    for (const entry of ADMIN_ROLES) {
      const q = query(collection(db, 'users'), where('email', '==', ADMIN_EMAIL), where('role', '==', entry.role));
      const snap = await getDocs(q);

      if (snap.empty) {
        await setDoc(doc(db, 'users', entry.uid), {
          uid: entry.uid,
          name: entry.name,
          email: ADMIN_EMAIL,
          password: ADMIN_PW_HASH,
          role: entry.role,
          status: 'active',
          ...(entry.department && { department: entry.department }),
          ...(entry.faculty && { faculty: entry.faculty }),
          createdAt: serverTimestamp(),
        });
      } else {
        const docRef = snap.docs[0].ref;
        await setDoc(docRef, {
          name: entry.name,
          password: ADMIN_PW_HASH,
          ...(entry.department && { department: entry.department }),
          ...(entry.faculty && { faculty: entry.faculty }),
        }, { merge: true });
      }
    }
  } catch (err) {
    console.warn('[KSAS] Seed operation encountered an issue.');
  }
}
