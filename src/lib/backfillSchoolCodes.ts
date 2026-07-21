/**
 * One-time migration: backfill schoolCode on existing student accounts
 * by parsing their registration numbers.
 */
import { db, collection, getDocs, doc, updateDoc, query, where } from './firebase';
import { collections } from './collections';
import { parseRegistrationNumber } from './regNumberParser';

export interface BackfillResult {
  total: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function backfillSchoolCodes(): Promise<BackfillResult> {
  const result: BackfillResult = { total: 0, updated: 0, skipped: 0, errors: [] };

  try {
    const usersSnap = await getDocs(query(collection(db, collections.USERS), where('role', '==', 'student')));
    result.total = usersSnap.size;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const uid = data.uid || userDoc.id;

      // Skip if already has schoolCode
      if (data.schoolCode) {
        result.skipped++;
        continue;
      }

      const parsed = parseRegistrationNumber(uid);
      if (!parsed) {
        result.errors.push(`${uid}: could not parse registration number`);
        continue;
      }

      try {
        await updateDoc(doc(db, collections.USERS, userDoc.id), {
          schoolCode: parsed.schoolCode,
        });
        result.updated++;
      } catch (err) {
        result.errors.push(`${uid}: failed to update — ${err}`);
      }
    }
  } catch (err) {
    result.errors.push(`Migration failed: ${err}`);
  }

  return result;
}
