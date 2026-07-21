/**
 * src/pages/admin/Reports.tsx
 * Org-wide attendance reporting and CSV export.
 * Pulls every session + its attendance subcollection from Firestore,
 * lets the admin filter by course/date range, and exports to CSV.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Download, Loader2, FileText, Filter, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, collection, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { buildAttendanceCsv, downloadCsv, formatTimeIn, formatTimestampExact, AttendanceCsvRow } from '../../lib/csvExport';

interface FlatRecord extends AttendanceCsvRow {
  sessionId: string;
}

export default function Reports() {
  const [records, setRecords] = useState<FlatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadAllAttendance = async () => {
    setLoading(true);
    try {
      const sessionsSnap = await getDocs(collection(db, collections.SESSIONS));
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAllAttendance(); }, []);

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
    downloadCsv(`ksas_attendance_${coursePart}_${stamp}.csv`, csv);
  };

  return (
    <div className="px-4 md:px-6 max-w-7xl mx-auto w-full space-y-6 animate-page-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="font-headline-lg font-bold text-primary">Reports</h1>
          <p className="text-on-surface-variant">Export organised attendance records — date, time, location, and student details.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAllAttendance}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant rounded-xl text-sm font-semibold text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={loading || filteredRecords.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm p-4 flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> Course
          </label>
          <select
            value={courseFilter}
            onChange={e => setCourseFilter(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/50 text-sm focus:outline-none focus:border-primary transition-all"
          >
            <option value="all">All Courses</option>
            {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/50 text-sm focus:outline-none focus:border-primary transition-all"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-on-surface-variant mb-1.5 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 inline mr-1 -mt-0.5" /> To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant/50 text-sm focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-10 h-10 mx-auto text-outline mb-3" />
            <p className="font-bold text-on-surface mb-1">No attendance records found</p>
            <p className="text-sm text-on-surface-variant">No sessions recorded yet. The Kabarak family awaits.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-low border-b border-outline-variant/30">
                <tr>
                  <th className="px-4 py-3 font-label-md text-outline">Student</th>
                  <th className="px-4 py-3 font-label-md text-outline">Course</th>
                  <th className="px-4 py-3 font-label-md text-outline">Date</th>
                  <th className="px-4 py-3 font-label-md text-outline">Time In</th>
                  <th className="px-4 py-3 font-label-md text-outline">Location</th>
                  <th className="px-4 py-3 font-label-md text-outline">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/15">
                {filteredRecords.slice(0, 200).map((r, i) => (
                  <tr key={`${r.sessionId}-${r.studentId}-${i}`} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">{r.studentName}</p>
                      <p className="text-xs text-on-surface-variant">{r.studentId}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{r.courseCode}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{r.date}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{r.timeIn}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{r.room}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        r.status === 'late'
                          ? 'bg-secondary-container/30 text-on-secondary-container'
                          : 'bg-success-container/20 text-success'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRecords.length > 200 && (
              <p className="text-center text-xs text-on-surface-variant py-3 bg-surface-container-low border-t border-outline-variant/20">
                Showing first 200 of {filteredRecords.length} records. Export CSV for the full list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
