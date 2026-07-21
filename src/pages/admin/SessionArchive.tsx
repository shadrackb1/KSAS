import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Archive, Download, Search, X, Loader2, Eye, Calendar } from 'lucide-react';
import { fetchJSONFromCloudinary } from '../../lib/cloudinary';
import { exportSessionCSV } from '../../lib/csvExport';

interface SessionRecord {
  id: string;
  courseName: string;
  courseCode: string;
  lecturerName: string;
  date: string;
  startTime: string;
  endTime: string;
  topicOfDay: string;
  totalStudents: number;
  present: number;
  absent: number;
  attendanceRate: number;
  csvFileName: string;
  csvData: string;
  createdAt: string;
}

export default function SessionArchive() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [detailSession, setDetailSession] = useState<SessionRecord | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJSONFromCloudinary('session-archive.json') as any;
        if (data && Array.isArray(data.sessions)) {
          setSessions(data.sessions);
        }
      } catch {
        setSessions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const courses = [...new Set(sessions.map(s => s.courseCode))].sort();
  const uniqueCourses = courses;

  const filtered = sessions.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.courseName.toLowerCase().includes(q) && !s.lecturerName.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    if (courseFilter && s.courseCode !== courseFilter) return false;
    return true;
  });

  const totalStudentsAcc = filtered.reduce((sum, s) => sum + s.totalStudents, 0);
  const totalPresentSum = filtered.reduce((sum, s) => sum + s.present, 0);
  const avgAttendance = filtered.length > 0 ? Math.round((totalPresentSum / totalStudentsAcc) * 1000) / 10 : 0;

  const handleDownload = (session: SessionRecord) => {
    const records = session.csvData
      ? session.csvData.split('\n').slice(1).map(line => {
          const parts = line.split(',').map(s => s.replace(/^"|"$/g, ''));
          return {
            studentName: parts[0] || '',
            studentId: parts[1] || '',
            timestamp: parts[2] ? { toDate: () => new Date(parts[2]) } : null,
            status: parts[3] || '',
            deviceFingerprint: parts[4] || '',
          };
        })
      : [];
    const fakeSession = { ...session, id: session.id };
    exportSessionCSV(fakeSession, records);
  };

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Session Archive
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '4px' }}>
          All attendance sessions ever recorded across the institution.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Sessions', value: sessions.length },
          { label: 'Total Records', value: sessions.reduce((s, x) => s + x.totalStudents, 0) },
          { label: 'Institution Avg Attendance %', value: sessions.length > 0 ? `${Math.round(sessions.reduce((s, x) => s + x.attendanceRate, 0) / sessions.length)}%` : '0%' },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--bg-surface)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
            }}
          >
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{stat.label}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', color: 'var(--text-primary)', fontWeight: 500, marginTop: '4px' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-4"
        style={{
          background: 'var(--bg-surface)',
          border: '0.5px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search by course or lecturer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '14px',
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
          />
        </div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              padding: '8px 12px',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '14px',
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 200ms ease, box-shadow 200ms ease',
            }}
          />
        <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          style={{
            padding: '8px 12px',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            background: 'var(--bg-elevated)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
          }}
        />
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            background: 'var(--bg-elevated)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            cursor: 'pointer',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
          }}
        >
          <option value="">All Courses</option>
          {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setCourseFilter(''); }}
          className="btn-ghost"
          style={{ fontSize: '13px', padding: '8px 16px' }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <Archive className="w-10 h-10 mx-auto mb-3" style={{ opacity: 0.5 }} />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 400 }}>No sessions recorded yet. The Kabarak family awaits.</p>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '0.5px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                  {['Date', 'Course', 'Lecturer', 'Topic of Day', 'Students', 'Attendance %', 'Actions'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    className="clickable-row"
                    style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {s.date ? new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {s.courseName}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {s.lecturerName}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={s.topicOfDay}
                    >
                      {s.topicOfDay || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {s.present}/{s.totalStudents}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(s.attendanceRate) }}>
                      {s.attendanceRate}%
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(s)}
                          className="btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          title="Download CSV"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDetailSession(s)}
                          className="btn-icon"
                          style={{ width: '32px', height: '32px' }}
                          title="View Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {detailSession && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetailSession(null)}
        >
          <div
            className="w-full max-w-2xl"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '40px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '24px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {detailSession.courseName}
                </h2>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {detailSession.date} · {detailSession.lecturerName}
                </p>
              </div>
              <button
                onClick={() => setDetailSession(null)}
                className="btn-icon"
                style={{ width: '32px', height: '32px' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Present', value: detailSession.present, color: 'var(--success)' },
                { label: 'Absent', value: detailSession.absent, color: 'var(--danger)' },
                { label: 'Late', value: (detailSession as any).late || 0, color: 'var(--warning)' },
                { label: 'Rate', value: `${detailSession.attendanceRate}%`, color: getRateColor(detailSession.attendanceRate) },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: s.color, fontWeight: 500 }}>{s.value}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Topic */}
            {detailSession.topicOfDay && (
              <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--kabu-maroon-tint)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--kabu-maroon)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Topic of Day</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-primary)' }}>{detailSession.topicOfDay}</p>
              </div>
            )}

            {/* Time info */}
            <div style={{ marginBottom: '24px', fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {detailSession.startTime} — {detailSession.endTime}
            </div>

            {/* Student list from CSV data */}
            <div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 500 }}>Attendance Records</h3>
              {detailSession.csvData ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                        {['Student Name', 'Reg No', 'Check-In Time', 'Status', 'Device'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailSession.csvData.split('\n').slice(1).filter(Boolean).map((line, i) => {
                        const parts = line.split(',').map(s => s.replace(/^"|"$/g, ''));
                        return (
                          <tr key={i} style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                            <td style={{ padding: '8px 12px', fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: 'var(--text-primary)' }}>{parts[0] || ''}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{parts[1] || ''}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{parts[2] || ''}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '13px' }}>
                              <span className="badge" style={{ background: parts[3] === 'PRESENT' ? 'var(--success-bg)' : 'var(--danger-bg)', color: parts[3] === 'PRESENT' ? 'var(--success)' : 'var(--danger)', border: `0.5px solid ${parts[3] === 'PRESENT' ? 'var(--success)' : 'var(--danger)'}` }}>{parts[3] || ''}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parts[4] || ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)' }}>No CSV data archived for this session.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
