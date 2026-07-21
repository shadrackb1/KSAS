import React, { useMemo, useState, useEffect } from 'react';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function StudentCourses() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const [attendanceMap, setAttendanceMap] = useState<Record<string, { present: number; total: number }>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [search, setSearch] = useState('');

  const studentEnrollments = useMemo(() => {
    return enrollments.filter(e => e.studentId === user?.uid);
  }, [enrollments, user]);

  const courseCodes = useMemo(() => {
    return studentEnrollments.map(e => e.courseCode);
  }, [studentEnrollments]);

  const myCourses = useMemo(() => {
    return courses.filter(c => courseCodes.includes(c.code));
  }, [courses, courseCodes]);

  useEffect(() => {
    if (!user?.uid || courseCodes.length === 0) {
      setLoadingAttendance(false);
      return;
    }
    if (loadingSessions) return;

    const fetchAttendance = async () => {
      const map: Record<string, { present: number; total: number }> = {};

      for (const courseCode of courseCodes) {
        const courseSessions = allSessions.filter(s => s.courseCode === courseCode);
        let present = 0;

        for (const session of courseSessions) {
          try {
            const attQ = query(
              collection(db, `${collections.SESSIONS}/${session.id}/attendance`),
              where('studentId', '==', user.uid)
            );
            const attSnap = await getDocs(attQ);
            if (attSnap.size > 0) {
              const status = attSnap.docs[0].data().status;
              if (status === 'present' || status === 'late') present++;
            }
          } catch (e) {
            // ignore individual session errors
          }
        }

        map[courseCode] = { present, total: courseSessions.length };
      }

      setAttendanceMap(map);
      setLoadingAttendance(false);
    };

    fetchAttendance();
  }, [user, courseCodes, allSessions, loadingSessions]);

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return myCourses;
    const s = search.toLowerCase();
    return myCourses.filter(c =>
      c.code?.toLowerCase().includes(s) ||
      c.name?.toLowerCase().includes(s)
    );
  }, [myCourses, search]);

  const getAttendance = (code: string) => {
    const att = attendanceMap[code];
    if (!att || att.total === 0) return { pct: 0, status: 'none', present: 0, total: 0 };
    const pct = Math.round((att.present / att.total) * 100);
    const status = pct < 50 ? 'critical' : pct < 75 ? 'warning' : 'good';
    return { pct, status, present: att.present, total: att.total };
  };

  const isLoading = loadingEnrollments || loadingCourses || loadingSessions || loadingAttendance;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-24 py-8 animate-page-in">

      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-headline-lg text-primary mb-sm">My Courses</h1>
        <p className="font-body-md text-on-surface-variant">Manage and track your academic progress.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search courses by name or code..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-body-md"
          />
        </div>
      </div>

      {filteredCourses.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <p className="font-title-lg mb-2">No courses enrolled yet</p>
          <p className="font-body-md">{search ? 'Try a different search term.' : 'Contact administration to get started with your courses.'}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {filteredCourses.map((course) => {
          const { pct, status } = getAttendance(course.code);
          const color = status === 'critical' ? 'bg-error-container text-on-error-container' : status === 'warning' ? 'bg-secondary-container text-on-secondary-container' : 'bg-success-container text-on-success-container';
          const arcColor = status === 'critical' ? 'text-error' : status === 'warning' ? 'text-secondary' : 'text-success';

          return (
          <div key={course.code} className="bg-surface-container-lowest rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0px_12px_24px_rgba(0,0,0,0.1)] transition-all duration-300 p-6 flex flex-col border border-outline-variant/20 clickable-card">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className={`inline-block px-2 py-1 rounded ${color} font-label-md mb-1`}>
                  {course.code}
                </span>
                <h3 className="font-title-lg font-semibold text-on-background line-clamp-2">{course.name}</h3>
              </div>
            </div>

            {course.description && (
              <p className="font-body-md text-on-surface-variant mb-4">{course.description}</p>
            )}

            <div className="mt-auto pt-4 border-t border-outline-variant/30 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-surface-variant"></circle>
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="125.6" strokeDashoffset={125.6 - (125.6 * pct) / 100} strokeLinecap="round" className={arcColor}></circle>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-label-md font-bold ${status === 'critical' ? 'text-error' : 'text-success'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <span className="font-body-sm text-on-surface-variant">Attendance</span>
              </div>
              <button
                onClick={() => navigate(`/student/course-details?code=${encodeURIComponent(course.code)}`)}
                className="px-4 py-2 rounded-lg bg-surface-container text-primary font-label-md hover:bg-surface-variant transition-colors flex items-center gap-1 active:scale-95"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>
      )}

    </div>
  );
}
