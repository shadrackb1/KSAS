/**
 * src/pages/admin/StudentAttendance.tsx
 * Admin page to track individual student attendance across all units.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Loader2, Users, BookOpen, Calendar, CheckCircle, XCircle, Clock,
  Download, ChevronDown, ChevronUp, AlertCircle, GraduationCap,
} from 'lucide-react';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';

interface StudentRecord {
  uid: string;
  name: string;
  email: string;
  role: string;
  course?: string;
  department?: string;
}

interface CourseAttendance {
  courseCode: string;
  courseName: string;
  totalSessions: number;
  present: number;
  late: number;
  absent: number;
  rate: number;
  sessions: SessionDetail[];
}

interface SessionDetail {
  sessionId: string;
  date: string;
  topic: string;
  status: 'present' | 'late' | 'absent';
  timeIn?: string;
}

export default function StudentAttendance() {
  const { data: users, loading: loadingUsers } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: sessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [studentAttendance, setStudentAttendance] = useState<CourseAttendance[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const students = useMemo(() => {
    return (users || []).filter((u: any) => u.role === 'student');
  }, [users]);

  const filteredStudents = useMemo(() => {
    if (!search) return [];
    const s = search.toLowerCase();
    return students.filter((u: any) =>
      u.name?.toLowerCase().includes(s) ||
      u.uid?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    ).slice(0, 10);
  }, [students, search]);

  const fetchStudentAttendance = async (student: StudentRecord) => {
    setSelectedStudent(student);
    setLoadingAttendance(true);
    setStudentAttendance([]);

    try {
      // Get all sessions
      const allSessions = sessions || [];
      
      // For each session, check if this student has an attendance record
      const courseMap = new Map<string, CourseAttendance>();

      for (const session of allSessions) {
        const courseCode = session.courseCode;
        if (!courseCode) continue;

        // Initialize course entry if not exists
        if (!courseMap.has(courseCode)) {
          courseMap.set(courseCode, {
            courseCode,
            courseName: session.courseName || courseCode,
            totalSessions: 0,
            present: 0,
            late: 0,
            absent: 0,
            rate: 0,
            sessions: [],
          });
        }

        const courseAtt = courseMap.get(courseCode)!;
        courseAtt.totalSessions++;

        // Check attendance subcollection for this student
        const attendanceQuery = query(
          collection(db, `${collections.SESSIONS}/${session.id}/attendance`),
          where('studentId', '==', student.uid)
        );
        const attendanceSnap = await getDocs(attendanceQuery);

        if (attendanceSnap.empty) {
          // Student was absent
          courseAtt.absent++;
          courseAtt.sessions.push({
            sessionId: session.id,
            date: session.date || '',
            topic: session.topicOfDay || '',
            status: 'absent',
          });
        } else {
          // Student was present or late
          const attDoc = attendanceSnap.docs[0];
          const attData = attDoc.data();
          const status = attData.status === 'late' ? 'late' : 'present';
          
          if (status === 'late') {
            courseAtt.late++;
          } else {
            courseAtt.present++;
          }

          const timestamp = attData.timestamp?.toDate?.();
          courseAtt.sessions.push({
            sessionId: session.id,
            date: session.date || '',
            topic: session.topicOfDay || '',
            status,
            timeIn: timestamp ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          });
        }
      }

      // Calculate rates and sort sessions by date
      const result = Array.from(courseMap.values()).map(course => ({
        ...course,
        rate: course.totalSessions > 0 
          ? Math.round(((course.present + course.late) / course.totalSessions) * 100)
          : 0,
        sessions: course.sessions.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      }));

      // Sort by course code
      result.sort((a, b) => a.courseCode.localeCompare(b.courseCode));
      
      setStudentAttendance(result);
    } catch (err) {
      console.error('Failed to fetch student attendance:', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }} />;
      case 'late': return <Clock className="w-4 h-4" style={{ color: 'var(--warning)' }} />;
      case 'absent': return <XCircle className="w-4 h-4" style={{ color: 'var(--danger)' }} />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return { bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' };
      case 'late': return { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'var(--warning)' };
      case 'absent': return { bg: 'var(--danger-bg)', color: 'var(--danger)', border: 'var(--danger)' };
      default: return { bg: 'var(--bg-elevated)', color: 'var(--text-tertiary)', border: 'var(--bg-border)' };
    }
  };

  const overallStats = useMemo(() => {
    if (studentAttendance.length === 0) return null;
    let totalSessions = 0;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    for (const course of studentAttendance) {
      totalSessions += course.totalSessions;
      totalPresent += course.present;
      totalLate += course.late;
      totalAbsent += course.absent;
    }
    const overallRate = totalSessions > 0 ? Math.round(((totalPresent + totalLate) / totalSessions) * 100) : 0;
    return { totalSessions, totalPresent, totalLate, totalAbsent, overallRate };
  }, [studentAttendance]);

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Student Attendance Tracker
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          Search for a student to view their attendance across all enrolled units.
        </p>
      </div>

      {/* Search Section */}
      <div className="mb-8" style={{
        padding: '24px',
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '0.5px solid var(--bg-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
      }}>
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5" style={{ color: 'var(--kabu-maroon)' }} />
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)' }}>
            Find Student
          </h2>
        </div>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, student ID, or email..."
            className="input-base"
            style={{ paddingLeft: '16px', fontSize: '14px' }}
          />
          {search && filteredStudents.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 50,
              background: 'var(--bg-void)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              maxHeight: '300px',
              overflowY: 'auto',
              marginTop: '4px',
            }}>
              {filteredStudents.map((student: any) => (
                <button
                  key={student.uid}
                  onClick={() => {
                    setSearch(student.name);
                    fetchStudentAttendance(student);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '0.5px solid var(--bg-border)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                >
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--kabu-maroon)',
                      color: 'var(--text-inverse)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}>
                      {student.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {student.name}
                      </p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {student.uid} · {student.email}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loadingAttendance && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
        </div>
      )}

      {/* Student Results */}
      {selectedStudent && !loadingAttendance && (
        <>
          {/* Student Info Card */}
          <div className="mb-6" style={{
            padding: '24px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '0.5px solid var(--bg-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          }}>
            <div className="flex items-center gap-4">
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--kabu-maroon)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '20px',
              }}>
                {selectedStudent.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)' }}>
                  {selectedStudent.name}
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {selectedStudent.uid} · {selectedStudent.email}
                </p>
                {selectedStudent.course && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    Course: {selectedStudent.course}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Overall Stats */}
          {overallStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Total Sessions', value: overallStats.totalSessions, bg: 'var(--bg-elevated)', color: 'var(--text-primary)' },
                { label: 'Present', value: overallStats.totalPresent, bg: 'var(--success-bg)', color: 'var(--success)' },
                { label: 'Late', value: overallStats.totalLate, bg: 'var(--warning-bg)', color: 'var(--warning)' },
                { label: 'Absent', value: overallStats.totalAbsent, bg: 'var(--danger-bg)', color: 'var(--danger)' },
                { label: 'Overall Rate', value: `${overallStats.overallRate}%`, bg: 'var(--bg-elevated)', color: getRateColor(overallStats.overallRate) },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: '16px',
                  background: stat.bg,
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                    {stat.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Course Attendance Table */}
          {studentAttendance.length > 0 ? (
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--bg-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--bg-border)' }}>
                <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)' }}>
                  Attendance by Course
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                      {['Course', 'Sessions', 'Present', 'Late', 'Absent', 'Rate', ''].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentAttendance.map((course) => (
                      <React.Fragment key={course.courseCode}>
                        <tr 
                          style={{ borderBottom: '0.5px solid var(--bg-border)', cursor: 'pointer' }}
                          onClick={() => setExpandedCourse(expandedCourse === course.courseCode ? null : course.courseCode)}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-4 h-4" style={{ color: 'var(--kabu-maroon)' }} />
                              <div>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                  {course.courseName}
                                </p>
                                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                  {course.courseCode}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>
                            {course.totalSessions}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--success)' }}>
                            {course.present}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--warning)' }}>
                            {course.late}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--danger)' }}>
                            {course.absent}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '14px',
                              fontWeight: 500,
                              color: getRateColor(course.rate),
                            }}>
                              {course.rate}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {expandedCourse === course.courseCode ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>
                        {/* Expanded Session Details */}
                        {expandedCourse === course.courseCode && (
                          <tr>
                            <td colSpan={7} style={{ padding: '0', background: 'var(--bg-elevated)' }}>
                              <div style={{ padding: '16px 20px' }}>
                                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                  Session History
                                </p>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                  {course.sessions.map((session) => {
                                    const statusStyle = getStatusColor(session.status);
                                    return (
                                      <div
                                        key={session.sessionId}
                                        className="flex items-center justify-between"
                                        style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--bg-border)' }}
                                      >
                                        <div className="flex items-center gap-3">
                                          {getStatusIcon(session.status)}
                                          <div>
                                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-primary)' }}>
                                              {session.date ? new Date(session.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                            </p>
                                            {session.topic && (
                                              <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                                {session.topic}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {session.timeIn && (
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                              {session.timeIn}
                                            </span>
                                          )}
                                          <span style={{
                                            fontFamily: 'var(--font-body)',
                                            fontSize: '10px',
                                            fontWeight: 500,
                                            textTransform: 'capitalize',
                                            padding: '2px 8px',
                                            borderRadius: '9999px',
                                            background: statusStyle.bg,
                                            color: statusStyle.color,
                                            border: `0.5px solid ${statusStyle.border}`,
                                          }}>
                                            {session.status}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{
              padding: '40px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--bg-border)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}>
              <GraduationCap className="w-10 h-10 mx-auto mb-3" style={{ opacity: 0.3 }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No attendance records found for this student.</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
                They may not be enrolled in any courses yet.
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!selectedStudent && !loadingAttendance && (
        <div style={{
          padding: '60px 40px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}>
          <Search className="w-12 h-12 mx-auto mb-4" style={{ opacity: 0.3 }} />
          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Search for a student
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', opacity: 0.7 }}>
            Enter a name, student ID, or email to view their attendance records across all courses.
          </p>
        </div>
      )}
    </div>
  );
}
