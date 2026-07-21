// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Filter, Download, Loader2, FileBarChart, Users, GraduationCap, BookOpen } from 'lucide-react';
import { CountUp, DonutChart } from '../../components/charts';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where, orderBy } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { buildAttendanceCsv, downloadCsv, formatTimestampExact } from '../../lib/csvExport';
import toast from 'react-hot-toast';

export default function Reports() {
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: users, loading: loadingUsers } = useFirestoreRealtimeCollection(collections.USERS);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;

  const scopeCourses = useMemo(() => {
    if (!scopeFilter || !user) return courses;
    return courses.filter((c: any) => !c[scopeFilter] || c[scopeFilter] === (user as any)[scopeFilter]);
  }, [courses, scopeFilter, user]);

  const scopeCourseCodes = useMemo(() => new Set(scopeCourses.map((c: any) => c.code)), [scopeCourses]);
  const lecturersInScope = useMemo(() => {
    if (!scopeFilter || !user) return users.filter((u: any) => u.role === 'lecturer');
    return users.filter((u: any) => u.role === 'lecturer' && (u as any)[scopeFilter] === (user as any)[scopeFilter]);
  }, [users, scopeFilter, user]);

  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const departments = useMemo(() => {
    const depts = new Set(scopeCourses.map((c: any) => c.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [scopeCourses]);

  const filteredSessions = useMemo(() => {
    let result = sessions.filter((s: any) => scopeCourseCodes.has(s.courseCode));
    if (deptFilter !== 'all') {
      result = result.filter((s: any) => {
        const c = courses.find((co: any) => co.code === s.courseCode);
        return c && c.department === deptFilter;
      });
    }
    if (courseFilter !== 'all') {
      result = result.filter((s: any) => s.courseCode === courseFilter);
    }
    if (dateFrom) {
      result = result.filter((s: any) => s.date && s.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((s: any) => s.date && s.date <= dateTo);
    }
    return result;
  }, [sessions, scopeCourseCodes, deptFilter, courseFilter, dateFrom, dateTo, courses]);

  const filteredCourseCodes = useMemo(() => new Set(filteredSessions.map((s: any) => s.courseCode)), [filteredSessions]);
  const filteredEnrollments = useMemo(() => enrollments.filter((e: any) => filteredCourseCodes.has(e.courseCode)), [enrollments, filteredCourseCodes]);
  const filteredStudents = useMemo(() => new Set(filteredEnrollments.map((e: any) => e.studentId)).size, [filteredEnrollments]);
  const filteredLecturers = useMemo(() => new Set(filteredSessions.map((s: any) => s.lecturerId)).size, [filteredSessions]);

  const avgAttendance = useMemo(() => {
    let totalPresent = 0;
    let totalEnrolled = 0;
    filteredSessions.forEach((s: any) => {
      totalEnrolled += s.enrolledCount || 0;
      totalPresent += s.attendanceCount || 0;
    });
    return totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;
  }, [filteredSessions]);

  const [reportRows, setReportRows] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingReport(true);
      try {
        const rows: any[] = [];
        for (const s of filteredSessions) {
          try {
            const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${s.id}/attendance`));
            const studentMap = new Map(attSnap.docs.map(d => {
              const dd: any = d.data();
              return [dd.studentId, { studentName: dd.studentName || '', status: dd.status || 'present', timestamp: dd.timestamp }];
            }));
            for (const e of enrollments.filter((en: any) => en.courseCode === s.courseCode)) {
              const att = studentMap.get(e.studentId);
              const status = att ? att.status : 'absent';
              const ts = formatTimestampExact(att?.timestamp);
              rows.push({
                date: s.date,
                startTime: s.startTime,
                endTime: s.endTime,
                courseCode: s.courseCode,
                courseName: s.courseName,
                room: s.room,
                lecturerName: s.lecturerName,
                studentId: e.studentId,
                studentName: att?.studentName || e.studentName || '',
                status,
                timeIn: ts.time,
              });
            }
          } catch { /* skip session */ }
        }
        setReportRows(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingReport(false);
      }
    })();
  }, [filteredSessions, scopeCourseCodes, deptFilter, courseFilter, dateFrom, dateTo]);

  // Status breakdown from report rows
  const statusBreakdown = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const r of reportRows) {
      if (r.status === 'present') present++;
      else if (r.status === 'late') late++;
      else absent++;
    }
    return [
      { name: 'Present', value: present, color: 'var(--success)' },
      { name: 'Late', value: late, color: 'var(--warning)' },
      { name: 'Absent', value: absent, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [reportRows]);

  const handleExportCsv = () => {
    if (reportRows.length === 0) {
      toast.error('No data to export.');
      return;
    }
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Date', 'Start Time', 'End Time', 'Course Code', 'Course Name', 'Room', 'Lecturer', 'Student ID', 'Student Name', 'Status', 'Time In'];
    const rows = reportRows.map((r) => [r.date, r.startTime, r.endTime, r.courseCode, r.courseName, r.room, r.lecturerName, r.studentId, r.studentName, r.status, r.timeIn].map(escape).join(','));
    const csv = [headers.map(escape).join(','), ...rows].join('\n');
    const filename = `KSAS_Report_${dateFrom || 'all'}_${dateTo || 'all'}.csv`;
    downloadCsv(filename, csv);
    toast.success('Report exported as CSV.');
  };

  const isLoading = loadingUsers || loadingCourses || loadingSessions || loadingEnrollments;

  if (isLoading) {
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
          Reports
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
          Scope: {user ? ((user as any)[scopeFilter || ''] || 'All') : 'All'} · Read-Only
        </p>
      </section>

      {/* Summary Stat Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: filteredSessions.length, isNum: true, icon: Calendar, color: '#8B1538' },
          { label: 'Avg Attendance', value: avgAttendance, suffix: '%', isNum: true, icon: FileBarChart, color: avgAttendance >= 75 ? '#2d8a56' : '#8B1538' },
          { label: 'Total Students', value: filteredStudents, isNum: true, icon: Users, color: '#8B1538' },
          { label: 'Total Lecturers', value: filteredLecturers, isNum: true, icon: GraduationCap, color: '#6B4A50' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 sm:p-5 flex flex-col gap-3" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50' }}>{stat.label}</span>
              <div className="flex items-center justify-center" style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F9E8EA' }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
            </div>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 500, color: '#1A0508' }}>
              {stat.isNum ? <CountUp value={stat.value} suffix={stat.suffix || ''} decimals={0} /> : stat.value}
            </p>
          </div>
        ))}
      </section>

      {/* Status Breakdown Donut */}
      {statusBreakdown.length > 0 && (
        <section className="mb-8 p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Attendance Status Breakdown
          </h2>
          <div className="flex justify-center">
            <DonutChart data={statusBreakdown} size={200} innerRadius={60} outerRadius={85} />
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {statusBreakdown.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50' }}>{s.name}: <strong style={{ color: '#1A0508' }}>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="mb-6 p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: '#8B1538' }} />
          <h2 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Filters
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {departments.length > 0 && (
            <div>
              <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: '#6B4A50', marginBottom: '6px', display: 'block' }}>Department</label>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', background: '#FDF8F8', border: '1px solid #E8D8DA', borderRadius: '10px', color: '#1A0508', outline: 'none', cursor: 'pointer' }}>
                <option value="all">All Departments</option>
                {departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: '#6B4A50', marginBottom: '6px', display: 'block' }}>Course</label>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', background: '#FDF8F8', border: '1px solid #E8D8DA', borderRadius: '10px', color: '#1A0508', outline: 'none', cursor: 'pointer' }}>
              <option value="all">All Courses</option>
              {scopeCourses.map((c: any) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: '#6B4A50', marginBottom: '6px', display: 'block' }}>Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', background: '#FDF8F8', border: '1px solid #E8D8DA', borderRadius: '10px', color: '#1A0508', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', fontWeight: 500, color: '#6B4A50', marginBottom: '6px', display: 'block' }}>Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '8px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', background: '#FDF8F8', border: '1px solid #E8D8DA', borderRadius: '10px', color: '#1A0508', outline: 'none' }} />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleExportCsv}
            disabled={reportRows.length === 0}
            className="flex items-center gap-2"
            style={{ padding: '10px 20px', borderRadius: '10px', background: reportRows.length === 0 ? '#E8D8DA' : '#8B1538', border: 'none', cursor: reportRows.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: '13px', fontWeight: 600, color: '#fff' }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </section>

      {/* Report Table */}
      <section style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA', overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Date</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Course</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Student</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Status</th>
                <th style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B4A50', textAlign: 'left', borderBottom: '1px solid #E8D8DA' }}>Time In</th>
              </tr>
            </thead>
            <tbody>
              {loadingReport ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}>
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: '#8B1538' }} />
                  </td>
                </tr>
              ) : reportRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B4A50' }}>
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, i) => {
                  const statusColors: Record<string, { bg: string; color: string }> = {
                    present: { bg: '#e8f5ed', color: '#2d8a56' },
                    late: { bg: '#fef3cd', color: '#8a6d0f' },
                    absent: { bg: '#fde8e8', color: '#8B1538' },
                  };
                  const colors = statusColors[row.status] || statusColors.absent;
                  return (
                    <tr key={`${row.courseCode}-${row.studentId}-${i}`} style={{ borderBottom: '0.5px solid #E8D8DA' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#1A0508' }}>{row.date}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#8B1538' }}>{row.courseCode}</span>
                        <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: '#6B4A50', marginLeft: '6px' }}>{row.courseName}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#1A0508' }}>{row.studentName || row.studentId}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '8px', background: colors.bg, color: colors.color, fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#6B4A50' }}>{row.timeIn}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
