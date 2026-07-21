/**
 * src/lib/db.ts
 * Database operations for KSAS — built for 10K+ concurrent users.
 *
 * SCALABILITY CHANGES vs. original:
 * - Denormalized `attendanceCount` on session doc via increment(1)
 *   eliminates re-querying the attendance subcollection for the progress bar.
 * - Retry logic with exponential backoff for transient Firestore errors
 *   (RESOURCE_EXHAUSTED, UNAVAILABLE) that spike during 10K-scan bursts.
 * - Reduced reads per check-in by merging device validation into a single
 *   query (handled in security.ts).
 * - Consumed token cleanup via sharded structure (security.ts).
 */

import {
  db, collection, doc, setDoc, getDocs, getDoc, updateDoc,
  runTransaction, serverTimestamp, query, where, increment, writeBatch,
} from './firebase';
import { uploadJSONToCloudinary, fetchJSONFromCloudinary } from './cloudinary';
import {
  validateCheckIn,
  isDemoMode,
  CheckInSecurityContext,
  SessionSecurityConfig,
} from './security';
import { collections } from './collections';

// Re-export for backward compatibility (used by ~20 files)
export { collections };

// ── Retry Configuration ──────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

/**
 * Retry a Firestore operation with exponential backoff.
 * Handles transient errors: RESOURCE_EXHAUSTED, UNAVAILABLE, DEADLINE_EXCEEDED.
 * Non-transient errors (permission denied, not-found) are thrown immediately.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const code = err?.code || err?.message || '';
      const isTransient =
        code.includes('resource-exhausted') ||
        code.includes('unavailable') ||
        code.includes('deadline-exceeded') ||
        code.includes('14') ||  // UNAVAILABLE (gRPC code 14)
        code.includes('8');     // RESOURCE_EXHAUSTED (gRPC code 8)

      if (!isTransient || attempt === MAX_RETRIES) {
        throw err;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 100;
      console.warn(`[DB] ${label} attempt ${attempt + 1} failed (${code}), retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`${label}: max retries exceeded`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string | undefined | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = match[3]?.toUpperCase();
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export async function logAudit(
  user: any,
  actionType: string,
  entity: string,
  details: string
) {
  const logRef = doc(collection(db, collections.AUDIT_LOGS));
  await setDoc(logRef, {
    timestamp: serverTimestamp(),
    userId: user?.uid || 'unknown',
    userRole: user?.role || 'unknown',
    userEmail: user?.email || 'unknown',
    actionType,
    entity,
    details,
    ipAddress: 'device',
  });
}

// ── Check-In ─────────────────────────────────────────────────────────────────

export async function checkInStudent(
  sessionId: string,
  studentData: any,
  token: string,
  deviceFingerprint: string,
  securityContext?: CheckInSecurityContext
) {
  return withRetry(async () => {
    // 1. Fetch session (single read)
    const sessionDocRef = doc(db, collections.SESSIONS, sessionId);
    const sessionDoc = await getDoc(sessionDocRef);

    if (!sessionDoc.exists()) throw new Error('Session not found');
    const sessionData = sessionDoc.data();

    if (sessionData.status !== 'open' && !isDemoMode()) {
      throw new Error('Session is closed');
    }

    // 2. Identify student
    const studentId = studentData.uid || studentData.id;
    const studentName = studentData.name || 'Unknown Student';

    if (!studentId) {
      throw new Error('Student ID not found. Please log out and log in again.');
    }

    // 3. Verify enrollment (single query)
    const courseCode = sessionData.courseCode;
    if (courseCode) {
      const enrollQ = query(
        collection(db, collections.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('courseCode', '==', courseCode)
      );
      const enrollSnap = await getDocs(enrollQ);
      if (enrollSnap.empty) {
        throw new Error('You are not enrolled in this course. Please contact your administrator.');
      }
    }

    // 4. Security validation (5 layers — sharded tokens + combined device check)
    const ctx: CheckInSecurityContext = securityContext || { deviceFingerprint };
    const sessionConfig: Partial<SessionSecurityConfig> = {
      totpSecret: sessionData.totpSecret,
      campusLat: sessionData.campusLat,
      campusLng: sessionData.campusLng,
      allowedRadiusMeters: sessionData.allowedRadiusMeters,
      allowedIpPrefixes: sessionData.allowedIpPrefixes,
      requireGps: sessionData.requireGps || false,
      requireIpRange: sessionData.requireIpRange || false,
    };

    const securityResult = await validateCheckIn(sessionId, studentId, token, ctx, sessionConfig);
    if (!securityResult.allowed) {
      throw new Error(securityResult.error || 'Security validation failed');
    }

    // 5. Write attendance + increment denormalized count (single transaction)
    const attendanceDocId = studentId.replace(/\//g, '_').replace(/\s+/g, '_');
    const attendanceRef = doc(
      db,
      `${collections.SESSIONS}/${sessionId}/attendance`,
      attendanceDocId
    );
    const sessionRef = doc(db, collections.SESSIONS, sessionId);

    await runTransaction(db, async (transaction) => {
      const attendanceDoc = await transaction.get(attendanceRef);
      if (attendanceDoc.exists()) {
        throw new Error('You have already been marked present for this session');
      }

      // Determine present vs late
      let status = 'present';
      try {
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        const startMinutes = parseTimeToMinutes(sessionData.startTime);
        if (startMinutes !== null && (nowMinutes - startMinutes) > (sessionData.windowMinutes || 15)) {
          status = 'late';
        }
      } catch {
        // Default to present
      }

      // Write attendance record
      transaction.set(attendanceRef, {
        studentId,
        studentName,
        studentEmail: studentData.email || '',
        timestamp: serverTimestamp(),
        deviceFingerprint,
        status,
      });

      // Atomically increment denormalized attendance count on session doc.
      // This eliminates the need to re-query the attendance subcollection
      // every time the LiveSession progress bar updates.
      // FieldValue.increment is atomic and handles concurrent increments
      // without read-modify-write contention.
      transaction.update(sessionRef, {
        attendanceCount: increment(1),
      });
    });

    return { warnings: securityResult.warnings };
  }, `checkInStudent(${sessionId})`);
}

// ── Archive Session ──────────────────────────────────────────────────────────

export async function archiveSession(sessionId: string, csvData?: string) {
  const sessionDocRef = doc(db, collections.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionDocRef);
  if (!sessionDoc.exists()) return;

  const sessionData = sessionDoc.data();

  // Fetch all attendance records
  const attendanceQuery = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
  const attendanceSnapshot = await getDocs(attendanceQuery);
  const attendanceList = attendanceSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Compute stats
  const present = attendanceList.filter((a: any) => a.status === 'present').length;
  const late = attendanceList.filter((a: any) => a.status === 'late').length;
  const attended = present + late;
  const enrolled = sessionData.enrolledCount || 0;
  const absent = Math.max(0, enrolled - attended);
  const attendanceRate = enrolled > 0
    ? Math.round((attended / enrolled) * 1000) / 10
    : 0;

  // Upload individual session archive
  await uploadJSONToCloudinary(`session_${sessionId}.json`, {
    ...sessionData,
    attendance: attendanceList,
  });

  // Append to master archive
  const archiveKey = 'session-archive';
  let existingArchive: { sessions: any[] } = { sessions: [] };
  try {
    const existing = await fetchJSONFromCloudinary(`${archiveKey}.json`);
    if (existing && typeof existing === 'object' && Array.isArray((existing as any).sessions)) {
      existingArchive = existing as { sessions: any[] };
    }
  } catch {
    // Start fresh
  }

  const csvFileName = csvData
    ? `KSAS_${(sessionData.courseName || 'session').replace(/[^a-zA-Z0-9]/g, '_')}_${sessionData.date || ''}_${sessionId.slice(0, 8)}.csv`
    : '';

  const newEntry = {
    id: sessionId,
    courseName: sessionData.courseName || '',
    courseCode: sessionData.courseCode || '',
    lecturerName: sessionData.lecturerName || '',
    date: sessionData.date || '',
    startTime: sessionData.startTime || '',
    endTime: sessionData.endTime || '',
    topicOfDay: sessionData.topicOfDay || '',
    totalStudents: enrolled,
    present,
    late,
    absent,
    attendanceRate,
    csvFileName,
    csvData: csvData || '',
    createdAt: new Date().toISOString(),
  };

  existingArchive.sessions.unshift(newEntry);
  await uploadJSONToCloudinary(`${archiveKey}.json`, existingArchive);
}

// ── Close Session ────────────────────────────────────────────────────────────

export async function closeSession(sessionId: string) {
  const sessionRef = doc(db, collections.SESSIONS, sessionId);
  await updateDoc(sessionRef, { status: 'closed', endedAt: serverTimestamp() });
}

// ── Manual Attendance ────────────────────────────────────────────────────────

export async function markManualAttendance(
  sessionId: string,
  studentId: string,
  studentName: string,
  markedBy: string
) {
  // Verify session exists and is open
  const sessionRef = doc(db, collections.SESSIONS, sessionId);
  const sessionDoc = await getDoc(sessionRef);
  if (!sessionDoc.exists()) throw new Error('Session not found');
  const sessionData = sessionDoc.data();
  if (sessionData.status !== 'open' && !isDemoMode()) {
    throw new Error('Session is closed — cannot mark attendance');
  }

  // Verify student is enrolled in the course
  const courseCode = sessionData.courseCode;
  if (courseCode) {
    const enrollQ = query(
      collection(db, collections.ENROLLMENTS),
      where('studentId', '==', studentId),
      where('courseCode', '==', courseCode)
    );
    const enrollSnap = await getDocs(enrollQ);
    if (enrollSnap.empty) {
      throw new Error('Student is not enrolled in this course');
    }
  }

  const sanitized = studentId.replace(/\//g, '_').replace(/\s+/g, '_');
  const attendanceRef = doc(db, `${collections.SESSIONS}/${sessionId}/attendance`, sanitized);

  // Transaction: check duplicate then write + increment atomically
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(attendanceRef);
    if (existing.exists()) {
      throw new Error('This student is already marked present for this session');
    }

    transaction.set(attendanceRef, {
      studentId,
      studentName,
      timestamp: serverTimestamp(),
      status: 'manual',
      markedBy,
      deviceFingerprint: 'manual_override',
    });

    transaction.update(sessionRef, {
      attendanceCount: increment(1),
    });
  });
}

// ── Reset Student Device ─────────────────────────────────────────────────────

export async function resetStudentDevice(studentId: string, adminId: string) {
  const docId = studentId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const userRef = doc(db, collections.USERS, docId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Student not found');

  const oldFp = userSnap.data()?.deviceFingerprint || null;
  await updateDoc(userRef, {
    deviceFingerprint: null,
    devicePendingReset: true,
    deviceHistory: [
      ...(userSnap.data()?.deviceHistory || []),
      { fingerprint: oldFp, resetAt: new Date().toISOString(), resetBy: adminId },
    ],
  });
}
