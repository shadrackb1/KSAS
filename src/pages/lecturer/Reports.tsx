/**
 * src/pages/lecturer/Reports.tsx
 * Lecturer-specific attendance reporting and CSV export.
 * Pulls sessions belonging to the logged-in lecturer + their attendance subcollections.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Download, Loader2, FileText, Filter, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { buildAttendanceCsv, downloadCsv, formatTimeIn, formatTimestampExact, AttendanceCsvRow } from '../../lib/csvExport';
import { useAuth } from '../../hooks/useAuth';

interface FlatRecord extends AttendanceCsvRow {
  sessionId: string;
}

export default function Reports() {
  const { user } = useAuth();
  const [records, setRecords] = useState<FlatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadAttendance = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const sessionsQ = query(collection(db, collections.SESSIONS), where('lecturerId', '==', user.uid));
      const sessionsSnap = await getDocs(sessionsQ);
      const flat: FlatRecord[] = [];

      for (const sDoc of sessionsSnap.docs) {
        const session = sDoc.data();
        const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${sDoc.id}/attendance`));
        attSnap.forEach((aDoc) => {
          const a = aDoc.data();
          const ts = formatTimestampExact(a.timestamp);
          flat.push({
            sessionId: sDoc.id,
            studentId: a.studentId || '',
            studentName: a.studentName || '',
            studentEmail: a.studentEmail || '',
            regNumber: a.regNumber || a.studentId || '',
            status: a.status || 'present',
            date: ts.date,
            timeIn: ts.time,
            courseCode: session.courseCode || '',
            courseName: session.courseName || '',
            room: session.room || '',
            lecturerName: session.lecturerName || '',
            topicOfDay: session.topicOfDay || '',
            deviceFingerprint: a.deviceFingerprint || '',
          });
        });
      }

      flat.sort((a, b) => (a.date < b.date ? 1 : -1));
      setRecords(flat);
    } catch (err) {
      console.error('Failed to load attendance records', err);
      toast.error('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAttendance(); }, [user?.uid]);

  const courseOptions = useMemo(() => {
    const set = new Set(records.map(r => r.courseCode).filter(Boolean));
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (courseFilter !== 'all' && r.courseCode !== courseFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [records, courseFilter, dateFrom, dateTo]);

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast('No attendance records match the current filters.', { icon: '🔍' });
      return;
    }
    const csv = buildAttendanceCsv(filteredRecords);
    const stamp = new Date().toISOString().split('T')[0];
    const coursePart = courseFilter === 'all' ? 'all_courses' : courseFilter.replace(/[^a-zA-Z0-9]/g, '_');
    downloadCsv(`ksas_lecturer_report_${coursePart}_${stamp}.csv`, csv);
  };

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Attendance Reports
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
            View and export attendance records for your courses.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="btn-ghost flex items-center gap-2"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={loading || filteredRecords.length === 0}
            className="btn-primary flex items-center gap-2"
            style={{ fontSize: '13px', padding: '8px 20px' }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '20px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          marginBottom: '24px',
        }}
      >
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Filter className="w-3.5 h-3.5" /> Course
            </label>
            <select
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
            >
              <option value="all">All Courses</option>
              {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Calendar className="w-3.5 h-3.5" /> From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex-1">
            <label style={{ fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Calendar className="w-3.5 h-3.5" /> To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input-base"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '0.5px solid var(--bg-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <FileText className="w-10 h-10 mx-auto mb-3" style={{ opacity: 0.3 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>No attendance records found</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px' }}>Start a session and collect check-ins to generate reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  {['Student', 'Course', 'Date', 'Time In', 'Room', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 200).map((r, i) => (
                  <tr
                    key={`${r.sessionId}-${r.studentId}-${i}`}
                    style={{ borderBottom: '0.5px solid var(--bg-border)', transition: 'background 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 20px' }}>
                      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 500, color: 'var(--text-primary)' }}>{r.studentName}</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{r.studentId}</p>
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.courseCode}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.date}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.timeIn}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.room}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <span
                        className="badge"
                        style={{
                          background: r.status === 'late' ? 'var(--warning-bg)' : 'var(--success-bg)',
                          color: r.status === 'late' ? 'var(--warning)' : 'var(--success)',
                          border: `0.5px solid ${r.status === 'late' ? 'var(--warning)' : 'var(--success)'}`,
                          fontSize: '10px',
                          textTransform: 'capitalize',
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecords.length > 200 && (
              <p style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', padding: '12px 0', borderTop: '0.5px solid var(--bg-border)' }}>
                Showing first 200 of {filteredRecords.length} records. Export CSV for the full list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
