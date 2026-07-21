/**
 * School code mapping — reads/writes the `school_codes` Firestore collection.
 * Each document ID is the uppercase prefix (e.g. "LAW") and has a `name` field.
 */
import { db, collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from './firebase';
import { collections } from './collections';

export interface SchoolCode {
  code: string;
  name: string;
}

let cachedSchoolCodes: Map<string, string> | null = null;

export async function fetchSchoolCodes(): Promise<Map<string, string>> {
  if (cachedSchoolCodes) return cachedSchoolCodes;

  const snap = await getDocs(collection(db, collections.SCHOOL_CODES));
  const map = new Map<string, string>();
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.name) map.set(d.id.toUpperCase(), data.name);
  });
  cachedSchoolCodes = map;
  return map;
}

export function invalidateSchoolCodeCache() {
  cachedSchoolCodes = null;
}

export async function setSchoolCode(code: string, name: string): Promise<void> {
  const key = code.toUpperCase().trim();
  if (!key) throw new Error('School code cannot be empty');
  await setDoc(doc(db, collections.SCHOOL_CODES, key), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  invalidateSchoolCodeCache();
}

export async function removeSchoolCode(code: string): Promise<void> {
  const key = code.toUpperCase().trim();
  await deleteDoc(doc(db, collections.SCHOOL_CODES, key));
  invalidateSchoolCodeCache();
}

export async function getSchoolName(schoolCode: string): Promise<string | null> {
  if (!schoolCode) return null;
  const codes = await fetchSchoolCodes();
  return codes.get(schoolCode.toUpperCase()) || null;
}
