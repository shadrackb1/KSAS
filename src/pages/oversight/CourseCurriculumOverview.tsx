// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, User, Loader2, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';

interface CourseWithOutline {
  id: string;
  code: string;
  name: string;
  department: string;
  faculty: string;
  lecturerId: string;
  lecturerName: string;
  outline: string;
  topics: string[];
}

interface FullCourseDetails {
  enrolledCount: number;
  sessionCount: number;
  avgAttendance: number;
}

export default function CourseCurriculumOverview() {
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: sessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;

  const scopeCourses = useMemo(() => {
    if (!scopeFilter || !user) return courses;
    return courses.filter((c: any) => !c[scopeFilter] || c[scopeFilter] === (user as any)[scopeFilter]);
  }, [courses, scopeFilter, user]);

  const scopeCourseCodes = useMemo(() => new Set(scopeCourses.map((c: any) => c.code)), [scopeCourses]);

  const lecturerMap = useMemo(() => {
    const map = new Map<string, any>();
    users.filter((u: any) => u.role === 'lecturer').forEach((l: any) => map.set(l.uid, l));
    return map;
  }, [users]);

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [courseDetails, setCourseDetails] = useState<Record<string, FullCourseDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchDetails = async (courseCode: string) => {
    if (courseDetails[courseCode]) return;
    setLoadingDetails(true);
    try {
      const courseSess = sessions.filter((s: any) => s.courseCode === courseCode);
      const sessionCount = courseSess.length;
      const courseEnroll = enrollments.filter((e: any) => e.courseCode === courseCode);
      const enrolledCount = courseEnroll.length;
      let totalRate = 0;
      courseSess.forEach((s: any) => {
        const pct = s.enrolledCount > 0 ? Math.round(((s.attendanceCount || 0) / s.enrolledCount) * 100) : 0;
        totalRate += pct;
      });
      const avgAttendance = sessionCount > 0 ? Math.round(totalRate / sessionCount) : 0;
      setCourseDetails(prev => ({ ...prev, [courseCode]: { enrolledCount, sessionCount, avgAttendance } }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleToggle = (courseId: string, courseCode: string) => {
    setExpandedCourse(prev => prev === courseId ? null : courseId);
    if (expandedCourse !== courseId) fetchDetails(courseCode);
  };

  if (loadingCourses) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B1538' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-10" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <section className="mb-6">
        <h1 style={{ fontFamily: 'Gloock, serif', fontSize: 'clamp(20px,3vw,28px)', color: '#1A0508', letterSpacing: '-0.01em' }}>
          Course Curriculum Overview
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
          Scope: {user ? ((user as any)[scopeFilter || ''] || 'All') : 'All'} · Read-Only View
        </p>
      </section>

      {/* Course List */}
      {scopeCourses.length === 0 ? (
        <div className="p-10 text-center" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
          <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: '#E8D8DA' }} />
          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B4A50' }}>No courses in scope.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scopeCourses.map((course: any) => {
            const isExpanded = expandedCourse === course.id;
            const details = courseDetails[course.code];
            const lecturer = lecturerMap.get(course.lecturerId);
            const outline = course.outline || course.description || 'No outline provided.';
            const topics = course.topics || [];
            return (
              <div key={course.id} className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#8B1538', background: '#F9E8EA', padding: '2px 8px', borderRadius: '6px' }}>
                        {course.code}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '15px', fontWeight: 600, color: '#1A0508', marginBottom: '4px' }}>
                      {course.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {lecturer?.name || course.lecturerName || 'Unassigned'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {topics.length} topic{topics.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(course.id, course.code)}
                    className="flex items-center justify-center shrink-0 transition-colors hover:bg-primary-container active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F9E8EA', border: 'none', cursor: 'pointer', color: '#8B1538' }}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid #E8D8DA' }}>
                    {loadingDetails && !details ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: '#8B1538' }} /></div>
                    ) : (
                      <>
                        {/* Details Row */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {[
                            { label: 'Enrolled', value: details?.enrolledCount ?? '—' },
                            { label: 'Sessions', value: details?.sessionCount ?? '—' },
                            { label: 'Avg Attendance', value: details?.avgAttendance != null ? `${details.avgAttendance}%` : '—' },
                          ].map((d) => (
                            <div key={d.label} className="p-3 text-center" style={{ background: '#F9E8EA', borderRadius: '12px' }}>
                              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '18px', fontWeight: 600, color: '#1A0508' }}>{d.value}</p>
                              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px', color: '#6B4A50', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{d.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Course Outline */}
                        <div className="mb-4">
                          <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#1A0508', marginBottom: '8px' }}>
                            Course Outline
                          </h4>
                          <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', lineHeight: 1.6, padding: '12px', background: '#FDF8F8', borderRadius: '10px', border: '0.5px solid #E8D8DA' }}>
                            {outline}
                          </p>
                        </div>

                        {/* Topics */}
                        {topics.length > 0 && (
                          <div>
                            <h4 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#1A0508', marginBottom: '8px' }}>
                              Topics Covered
                            </h4>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                              {topics.map((topic: string, i: number) => (
                                <li key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: i < topics.length - 1 ? '0.5px solid #E8D8DA' : 'none' }}>
                                  <span className="shrink-0" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B1538' }} />
                                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#1A0508' }}>{topic}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
