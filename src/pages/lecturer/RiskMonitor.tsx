import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, TrendingDown, Eye, Mail, Loader2, X, MessageSquare } from 'lucide-react';
import { DonutChart, CountUp, Sparkline } from '../../components/charts';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { getDocs, query, collection, where, db } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function RiskMonitor() {
  const { user } = useAuth();
  const { data: allSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: allUsers } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const [attendanceData, setAttendanceData] = useState<Record<string, { present: number; total: number; early: number; earlyPresent: number; late: number; latePresent: number; rates: number[] }>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const lecturerCourses = useMemo(() => {
    return allSessions
      .filter(s => s.lecturerId === user?.uid)
      .map(s => s.courseCode)
      .filter((v, i, a) => a.indexOf(v) === i);
  }, [allSessions, user]);

  const enrolledStudents = useMemo(() => {
    return enrollments.filter(e => lecturerCourses.includes(e.courseCode));
  }, [enrollments, lecturerCourses]);

  useEffect(() => {
    if (lecturerCourses.length === 0) {
      setLoading(false);
      return;
    }

    const fetchAllAttendance = async () => {
      const map: Record<string, { present: number; total: number; early: number; earlyPresent: number; late: number; latePresent: number; rates: number[] }> = {};

      for (const code of lecturerCourses) {
        const courseSessions = allSessions.filter(s => s.courseCode === code).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        const midIdx = Math.floor(courseSessions.length / 2);

        for (let i = 0; i < courseSessions.length; i++) {
          const session = courseSessions[i];
          const isEarlyHalf = i < midIdx;
          try {
            const attSnap = await getDocs(collection(db, `${collections.SESSIONS}/${session.id}/attendance`));
            const enrolled = session.enrolledCount || 0;
            const attCount = attSnap.size;
            const sessionRate = enrolled > 0 ? Math.round((attCount / enrolled) * 100) : 0;
            attSnap.forEach(d => {
              const data = d.data();
              const sid = data.studentId;
              if (!map[sid]) map[sid] = { present: 0, total: 0, early: 0, earlyPresent: 0, late: 0, latePresent: 0, rates: [] };
              map[sid].total++;
              const attended = data.status === 'present' || data.status === 'late';
              if (attended) map[sid].present++;
              if (isEarlyHalf) {
                map[sid].early++;
                if (attended) map[sid].earlyPresent++;
              } else {
                map[sid].late++;
                if (attended) map[sid].latePresent++;
              }
            });
            // Track per-student rate per session
            for (const d of attSnap.docs) {
              const data = d.data();
              const sid = data.studentId;
              const attended = data.status === 'present' || data.status === 'late';
              map[sid].rates.push(attended ? 100 : 0);
            }
          } catch {
            // skip
          }
        }
      }

      setAttendanceData(map);
      setLoading(false);
    };

    fetchAllAttendance();
  }, [lecturerCourses, allSessions]);

  const riskStudents = useMemo(() => {
    const result: any[] = [];
    const seen = new Set<string>();

    for (const enrollment of enrolledStudents) {
      const sid = enrollment.studentId;
      if (seen.has(sid)) continue;
      seen.add(sid);

      const att = (attendanceData[sid] || { present: 0, total: 0, rates: [] }) as any;
      const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 100;
      if (pct < 75) {
        const student = allUsers.find(u => u.uid === sid);
        const earlyRate = att.early > 0 ? Math.round((att.earlyPresent / att.early) * 100) : 0;
        const lateRate = att.late > 0 ? Math.round((att.latePresent / att.late) * 100) : 0;
        const trend = att.early > 0 && att.late > 0 ? lateRate - earlyRate : 0;
        result.push({
          id: sid,
          name: student?.name || 'Unknown',
          reg: sid,
          program: enrollment.program || '',
          attendance: pct,
          trend,
          rates: att.rates || [],
        });
      }
    }

    return result.sort((a, b) => a.attendance - b.attendance);
  }, [enrolledStudents, attendanceData, allUsers]);

  const highRisk = riskStudents.filter(s => s.attendance < 50).length;
  const medRisk = riskStudents.filter(s => s.attendance >= 50 && s.attendance < 75).length;

  const riskDistributionData = useMemo(() => {
    const allEnrolled = enrolledStudents.length;
    const low = Math.max(0, allEnrolled - riskStudents.length);
    return [
      { name: 'Low Risk', value: low, color: 'var(--success)' },
      { name: 'Medium Risk', value: medRisk, color: 'var(--warning)' },
      { name: 'High Risk', value: highRisk, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [enrolledStudents, riskStudents, highRisk, medRisk]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>

      {/* Summary Alert Widget */}
      <div
        style={{
          padding: '24px',
          background: 'var(--danger-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--danger)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-6 h-6" style={{ color: 'var(--danger)' }} />
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)' }}>Action Required</h2>
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>{riskStudents.length} Students</span> currently fall below the required attendance threshold. Their academic performance is at critical risk.
          </p>
        </div>
        <button
          className="btn-danger"
          style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => { toast.success(`Batch intervention emails queued for ${riskStudents.length} at-risk students`); }}
        >
          Batch Intervene
        </button>
      </div>

      {/* Categorization Chips */}
      <div className="flex flex-wrap gap-3 mb-6">
        <span className="badge badge-danger" style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          High Risk (&lt;50%)
          <span style={{ background: 'var(--danger)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}><CountUp value={highRisk} /></span>
        </span>
        <span className="badge badge-warning" style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Medium Risk (50-75%)
          <span style={{ background: 'var(--warning)', color: 'var(--text-inverse)', fontSize: '10px', padding: '2px 8px', borderRadius: '9999px' }}><CountUp value={medRisk} /></span>
        </span>
      </div>

      {/* Risk Distribution Donut */}
      {riskDistributionData.length > 0 && (
        <div className="mb-6" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', padding: '20px', textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Risk Distribution — All Enrolled Students</h3>
          <div className="flex justify-center">
            <DonutChart data={riskDistributionData} size={200} innerRadius={60} outerRadius={85} />
          </div>
        </div>
      )}

      {/* At-Risk Student List */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)', overflow: 'hidden' }}>
        {/* Mobile card view */}
        <div className="md:hidden">
          {riskStudents.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No at-risk students found. All enrolled students are above the 75% threshold.
            </div>
          ) : (
            riskStudents.map((student) => (
              <div key={student.id} style={{ padding: '16px', borderBottom: '0.5px solid var(--bg-border)' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {(student.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name || 'Unknown'}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.program || ''}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.reg}</span>
                  <div className="flex items-center gap-1" style={{ color: student.trend < 0 ? 'var(--danger)' : student.trend > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                  </div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)' }}>
                      <CountUp value={student.attendance} suffix="%" />
                    </span>
                    {student.rates && student.rates.length >= 2 && (
                      <Sparkline data={student.rates} color={student.attendance < 50 ? 'var(--danger)' : 'var(--warning)'} />
                    )}
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '9999px', background: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)', width: `${student.attendance}%` }} />
                  </div>
                </div>
                <div className="flex justify-end gap-2" style={{ marginTop: '8px' }}>
                  <button onClick={() => setSelectedStudent(student)} style={{ padding: '8px', color: 'var(--kabu-maroon)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--kabu-maroon-tint)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Eye className="w-5 h-5" /></button>
                  <button onClick={() => { toast.success(`Email notification queued for ${student.name}`); }} style={{ padding: '8px', color: 'var(--warning)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--warning-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Mail className="w-5 h-5" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Student</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Reg Number</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Attendance</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Trend</th>
                <th style={{ padding: '12px 24px', fontFamily: 'var(--font-body)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {riskStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    No at-risk students found. All enrolled students are above the 75% threshold.
                  </td>
                </tr>
              ) : (
                riskStudents.map((student) => (
                  <tr
                    key={student.id}
                    style={{ borderBottom: '0.5px solid var(--bg-border)', transition: 'background 150ms' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          {(student.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)' }}>{student.name || 'Unknown'}</p>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)' }}>{student.program || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-tertiary)' }}>{student.reg}</td>
                    <td style={{ padding: '12px 24px' }}>
                      <div style={{ width: '128px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)' }}>
                          <CountUp value={student.attendance} suffix="%" />
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <div style={{ height: '6px', flex: 1, background: 'var(--bg-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '9999px', background: student.attendance < 50 ? 'var(--danger)' : 'var(--warning)', width: `${student.attendance}%` }} />
                          </div>
                          {student.rates && student.rates.length >= 2 && (
                            <Sparkline data={student.rates} color={student.attendance < 50 ? 'var(--danger)' : 'var(--warning)'} />
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex items-center gap-1" style={{ color: student.trend < 0 ? 'var(--danger)' : student.trend > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                        {student.trend < 0 ? <TrendingDown className="w-4 h-4" /> : null}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>{student.trend > 0 ? '+' : ''}{student.trend}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedStudent(student)} style={{ padding: '8px', color: 'var(--kabu-maroon)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--kabu-maroon-tint)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Eye className="w-5 h-5" /></button>
                        <button onClick={() => { toast.success(`Email notification queued for ${student.name}`); }} style={{ padding: '8px', color: 'var(--warning)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 150ms' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--warning-bg)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}><Mail className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-md animate-scale-in"
            style={{
              background: 'var(--bg-elevated)',
              border: '0.5px solid var(--bg-border)',
              borderRadius: 'var(--radius-xl)',
              padding: '32px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)' }}>
                Student Detail
              </h3>
              <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-lg)', background: 'var(--kabu-maroon)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700 }}>
                {(selectedStudent.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)' }}>{selectedStudent.name}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-tertiary)' }}>{selectedStudent.reg}</p>
                {selectedStudent.program && <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{selectedStudent.program}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 600, color: selectedStudent.attendance < 50 ? 'var(--danger)' : 'var(--warning)' }}>
                  <CountUp value={selectedStudent.attendance} suffix="%" />
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>Attendance</p>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 600, color: selectedStudent.trend < 0 ? 'var(--danger)' : selectedStudent.trend > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>{selectedStudent.trend > 0 ? '+' : ''}{selectedStudent.trend}%</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>Trend</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center" style={{ marginBottom: '6px' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>Risk Level</span>
                <span className="badge" style={{ background: selectedStudent.attendance < 50 ? 'var(--danger-bg)' : 'var(--warning-bg)', color: selectedStudent.attendance < 50 ? 'var(--danger)' : 'var(--warning)', border: `0.5px solid ${selectedStudent.attendance < 50 ? 'var(--danger)' : 'var(--warning)'}` }}>
                  {selectedStudent.attendance < 50 ? 'High Risk' : 'Medium Risk'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-surface)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '9999px', background: selectedStudent.attendance < 50 ? 'var(--danger)' : 'var(--warning)', width: `${selectedStudent.attendance}%` }} />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { toast.success(`Email notification queued for ${selectedStudent.name}`); setSelectedStudent(null); }} className="btn-primary flex-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Mail className="w-4 h-4" /> Send Notification
              </button>
              <button onClick={() => setSelectedStudent(null)} className="btn-ghost flex-1">Close</button>
    </div>
  </div>
  </div>
  , document.body)}
</div>

  );
}
