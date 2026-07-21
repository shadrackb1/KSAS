import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db, collection, collectionGroup, query, where, orderBy, limit, getDocs, getDoc, doc, runTransaction, serverTimestamp, increment, writeBatch, updateDoc, addDoc, deleteDoc } from '../lib/firebase';
import { collections } from '../lib/collections';
import { queryKeys, mutationKeys } from '../lib/queryClient';
import { logger } from '../lib/env';
import { checkRateLimit, withRetry, deduplicateRequest } from '../lib/rateLimit';
import { useAuth } from './useAuth';
import { hashPassword } from '../lib/auth';

// ============================================================
// USER HOOKS
// ============================================================

export function useCurrentUser() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.user.current(),
    queryFn: async () => {
      if (!user) return null;
      const userDoc = await getDoc(doc(db, collections.USERS, user.uid));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.user.profile(userId),
    queryFn: async () => {
      const userDoc = await getDoc(doc(db, collections.USERS, userId));
      return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.auth.updateProfile(),
    mutationFn: async ({ name, email }: { name: string; email: string }) => {
      if (!user) throw new Error('Not logged in');
      
      const usersRef = collection(db, collections.USERS);
      const q = query(usersRef, where('email', '==', user.email));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) throw new Error('User record not found');
      
      const userDocRef = snapshot.docs[0].ref;
      await updateDoc(userDocRef, { name, email, updatedAt: serverTimestamp() });
      
      return { name, email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(user?.uid || '') });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationKey: mutationKeys.auth.changePassword(),
    mutationFn: async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) => {
      const { user } = useAuth();
      if (!user) throw new Error('Not logged in');
      
      const usersRef = collection(db, collections.USERS);
      const q = query(usersRef, where('email', '==', user.email));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) throw new Error('User record not found');
      
      const userData = snapshot.docs[0].data();
      const oldHash = hashPassword(oldPassword);
      
      if (userData.password !== oldHash) {
        throw new Error('Current password is incorrect');
      }
      
      const newHash = hashPassword(newPassword);
      await updateDoc(snapshot.docs[0].ref, { password: newHash, updatedAt: serverTimestamp() });
    },
  });
}

// ============================================================
// COURSE HOOKS
// ============================================================

export function useCourses(filters?: { lecturerId?: string; department?: string }) {
  return useQuery({
    queryKey: queryKeys.courses.list(filters),
    queryFn: async () => {
      let q = query(collection(db, collections.COURSES), orderBy('courseCode'));
      
      if (filters?.lecturerId) {
        q = query(q, where('lecturerId', '==', filters.lecturerId));
      }
      if (filters?.department) {
        q = query(q, where('department', '==', filters.department));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  });
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: queryKeys.courses.detail(courseId),
    queryFn: async () => {
      const docSnap = await getDoc(doc(db, collections.COURSES, courseId));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },
    enabled: !!courseId,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.courses.create(),
    mutationFn: async (courseData: any) => {
      const docRef = await addDoc(collection(db, collections.COURSES), {
        ...courseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id, ...courseData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

export function useUpdateCourse(courseId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.courses.update(courseId),
    mutationFn: async (updates: any) => {
      await updateDoc(doc(db, collections.COURSES, courseId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.detail(courseId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses.all() });
    },
  });
}

// ============================================================
// SESSION HOOKS
// ============================================================

export function useSessions(filters?: { 
  lecturerId?: string; 
  courseCode?: string; 
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  return useQuery({
    queryKey: queryKeys.sessions.list(filters),
    queryFn: async () => {
      let q = query(collection(db, collections.SESSIONS), orderBy('date', 'desc'));
      
      if (filters?.lecturerId) {
        q = query(q, where('lecturerId', '==', filters.lecturerId));
      }
      if (filters?.courseCode) {
        q = query(q, where('courseCode', '==', filters.courseCode));
      }
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters?.dateFrom) {
        q = query(q, where('date', '>=', filters.dateFrom));
      }
      if (filters?.dateTo) {
        q = query(q, where('date', '<=', filters.dateTo));
      }
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  });
}

export function useSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.detail(sessionId),
    queryFn: async () => {
      const docSnap = await getDoc(doc(db, collections.SESSIONS, sessionId));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },
    enabled: !!sessionId,
  });
}

export function useLiveSession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessions.live(sessionId),
    queryFn: async () => {
      const docSnap = await getDoc(doc(db, collections.SESSIONS, sessionId));
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5 seconds for live updates
    staleTime: 0,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.sessions.create(),
    mutationFn: async (sessionData: any) => {
      const rateLimit = checkRateLimit(user?.uid || 'anonymous', 'sessionCreate');
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Try again in ${Math.ceil((rateLimit.retryAfter || 1000) / 1000)}s`);
      }
      
      const docRef = await addDoc(collection(db, collections.SESSIONS), {
        ...sessionData,
        lecturerId: user?.uid,
        lecturerName: user?.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        attendanceCount: 0,
      });
      return { id: docRef.id, ...sessionData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.byLecturer(user?.uid || '') });
    },
  });
}

export function useUpdateSession(sessionId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.sessions.update(sessionId),
    mutationFn: async (updates: any) => {
      await updateDoc(doc(db, collections.SESSIONS, sessionId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all() });
    },
  });
}

export function useCloseSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.sessions.close(''),
    mutationFn: async (sessionId: string) => {
      await updateDoc(doc(db, collections.SESSIONS, sessionId), {
        status: 'closed',
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all() });
    },
  });
}

export function useArchiveSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.sessions.archive(''),
    mutationFn: async (sessionId: string) => {
      // This would call the archive function from db.ts
      const { archiveSession } = await import('../lib/db');
      await archiveSession(sessionId);
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all() });
    },
  });
}

// ============================================================
// ATTENDANCE HOOKS
// ============================================================

export function useAttendanceBySession(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.bySession(sessionId),
    queryFn: async () => {
      const attendanceRef = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
      const q = query(attendanceRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!sessionId,
    refetchInterval: 10000, // 10 seconds for live attendance
  });
}

export function useAttendanceStats(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.stats(sessionId),
    queryFn: async () => {
      const sessionDoc = await getDoc(doc(db, collections.SESSIONS, sessionId));
      if (!sessionDoc.exists()) return null;
      
      const data = sessionDoc.data();
      const attendanceRef = collection(db, `${collections.SESSIONS}/${sessionId}/attendance`);
      const snapshot = await getDocs(attendanceRef);
      
      const present = snapshot.docs.filter(d => d.data().status === 'present').length;
      const late = snapshot.docs.filter(d => d.data().status === 'late').length;
      const total = present + late;
      const enrolled = data.enrolledCount || 0;
      const absent = Math.max(0, enrolled - total);
      
      return { present, late, total, enrolled, absent, rate: enrolled > 0 ? (total / enrolled) * 100 : 0 };
    },
    enabled: !!sessionId,
    refetchInterval: 10000,
  });
}

export function useStudentAttendance(studentId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.byStudent(studentId),
    queryFn: async () => {
      const attendanceRef = collectionGroup(db, 'attendance');
      const q = query(attendanceRef, where('studentId', '==', studentId), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!studentId,
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.attendance.checkIn(''),
    mutationFn: async ({ sessionId, token, deviceFingerprint, securityContext }: {
      sessionId: string;
      token: string;
      deviceFingerprint: string;
      securityContext?: any;
    }) => {
      // Rate limiting
      const rateLimit = checkRateLimit(user?.uid || 'anonymous', 'checkIn');
      if (!rateLimit.allowed) {
        throw new Error(`Too many check-in attempts. Try again in ${Math.ceil((rateLimit.retryAfter || 5000) / 1000)}s`);
      }
      
      // Deduplicate check-in requests
      return deduplicateRequest(
        `checkin:${sessionId}:${user?.uid}`,
        async () => {
          const { checkInStudent } = await import('../lib/db');
          return checkInStudent(sessionId, { uid: user?.uid, ...user }, token, deviceFingerprint, securityContext);
        }
      );
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.bySession(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.stats(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.live(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.detail(sessionId) });
    },
  });
}

export function useManualAttendance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.attendance.manual(''),
    mutationFn: async ({ sessionId, studentId, studentName }: {
      sessionId: string;
      studentId: string;
      studentName: string;
    }) => {
      const rateLimit = checkRateLimit(user?.uid || 'anonymous', 'manualAttendance');
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Try again in ${Math.ceil((rateLimit.retryAfter || 10000) / 1000)}s`);
      }
      
      const { markManualAttendance } = await import('../lib/db');
      return markManualAttendance(sessionId, studentId, studentName, user?.uid || '');
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.bySession(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendance.stats(sessionId) });
    },
  });
}

// ============================================================
// ENROLLMENT HOOKS
// ============================================================

export function useEnrollmentsByStudent(studentId: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.byStudent(studentId),
    queryFn: async () => {
      const q = query(
        collection(db, collections.ENROLLMENTS),
        where('studentId', '==', studentId),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!studentId,
  });
}

export function useEnrollmentsByCourse(courseCode: string) {
  return useQuery({
    queryKey: queryKeys.enrollments.byCourse(courseCode),
    queryFn: async () => {
      const q = query(
        collection(db, collections.ENROLLMENTS),
        where('courseCode', '==', courseCode),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!courseCode,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.enrollments.create(),
    mutationFn: async ({ courseCode, studentId }: { courseCode: string; studentId: string }) => {
      const rateLimit = checkRateLimit(studentId, 'enrollment');
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Try again in ${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}s`);
      }
      
      const docRef = await addDoc(collection(db, collections.ENROLLMENTS), {
        studentId,
        courseCode,
        status: 'active',
        enrolledAt: serverTimestamp(),
      });
      return { id: docRef.id, courseCode, studentId };
    },
    onSuccess: (_, { studentId, courseCode }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent(studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byCourse(courseCode) });
    },
  });
}

export function useUpdateEnrollment(enrollmentId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.enrollments.update(enrollmentId),
    mutationFn: async (updates: any) => {
      await updateDoc(doc(db, collections.ENROLLMENTS, enrollmentId), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byStudent('') });
      queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.byCourse('') });
    },
  });
}

// ============================================================
// ANALYTICS HOOKS
// ============================================================

export function useDashboardAnalytics(role: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(role, userId),
    queryFn: async () => {
      // This would fetch aggregated analytics data
      // Implementation depends on your analytics structure
      return {};
    },
    enabled: !!role && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDepartmentAnalytics(department: string) {
  return useQuery({
    queryKey: queryKeys.analytics.department(department),
    queryFn: async () => {
      // Fetch department-level analytics
      return {};
    },
    enabled: !!department,
  });
}

// ============================================================
// USER MANAGEMENT HOOKS (Admin)
// ============================================================

export function useUsers(filters?: { role?: string; department?: string; search?: string }) {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      let q = query(collection(db, collections.USERS), orderBy('name'));
      
      if (filters?.role) {
        q = query(q, where('role', '==', filters.role));
      }
      if (filters?.department) {
        q = query(q, where('department', '==', filters.department));
      }
      
      const snapshot = await getDocs(q);
      let users = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      // Client-side search filtering (for name/email)
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        users = users.filter((u: any) => 
          u.name?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search)
        );
      }
      
      return users;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.users.create(),
    mutationFn: async (userData: any) => {
      const docRef = await addDoc(collection(db, collections.USERS), {
        ...userData,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...userData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useUpdateUser(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.users.update(userId),
    mutationFn: async (updates: any) => {
      await updateDoc(doc(db, collections.USERS, userId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.users.delete(''),
    mutationFn: async (userId: string) => {
      await deleteDoc(doc(db, collections.USERS, userId));
      // Also delete from Firebase Auth (would need admin SDK)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

export function useResetStudentDevice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.users.resetDevice(''),
    mutationFn: async (studentId: string) => {
      const { resetStudentDevice } = await import('../lib/db');
      return resetStudentDevice(studentId, 'admin');
    },
    onSuccess: (_, studentId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.list() });
    },
  });
}

// ============================================================
// FEEDBACK HOOKS
// ============================================================

export function useFeedbackByCourse(courseCode: string) {
  return useQuery({
    queryKey: queryKeys.feedback.byCourse(courseCode),
    queryFn: async () => {
      const q = query(
        collection(db, collections.FEEDBACK),
        where('courseCode', '==', courseCode),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    enabled: !!courseCode,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationKey: mutationKeys.feedback.create(),
    mutationFn: async (feedbackData: any) => {
      const rateLimit = checkRateLimit(user?.uid || 'anonymous', 'feedback');
      if (!rateLimit.allowed) {
        throw new Error(`Rate limited. Try again in ${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}s`);
      }
      
      const docRef = await addDoc(collection(db, collections.FEEDBACK), {
        ...feedbackData,
        studentId: user?.uid,
        anonymous: true,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...feedbackData };
    },
    onSuccess: (_, { courseCode, sessionId }) => {
      if (courseCode) queryClient.invalidateQueries({ queryKey: queryKeys.feedback.byCourse(courseCode) });
      if (sessionId) queryClient.invalidateQueries({ queryKey: queryKeys.feedback.bySession(sessionId) });
    },
  });
}

// ============================================================
// SCHOOL CODES HOOKS
// ============================================================

export function useSchoolCodes() {
  return useQuery({
    queryKey: queryKeys.schoolCodes.all(),
    queryFn: async () => {
      const snapshot = await getDocs(query(collection(db, collections.SCHOOL_CODES), orderBy('code')));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  });
}

export function useCreateSchoolCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.schoolCodes.create(),
    mutationFn: async (codeData: any) => {
      const docRef = await addDoc(collection(db, collections.SCHOOL_CODES), {
        ...codeData,
        createdAt: serverTimestamp(),
      });
      return { id: docRef.id, ...codeData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolCodes.all() });
    },
  });
}

export function useUpdateSchoolCode(codeId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.schoolCodes.update(codeId),
    mutationFn: async (updates: any) => {
      await updateDoc(doc(db, collections.SCHOOL_CODES, codeId), updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolCodes.all() });
    },
  });
}

export function useDeleteSchoolCode() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationKey: mutationKeys.schoolCodes.delete(''),
    mutationFn: async (codeId: string) => {
      await deleteDoc(doc(db, collections.SCHOOL_CODES, codeId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schoolCodes.all() });
    },
  });
}