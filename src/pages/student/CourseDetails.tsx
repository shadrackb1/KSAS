import React, { useMemo, useState, useEffect } from 'react';
import { QrCode, CheckCircle, Clock, XCircle, Calendar, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs, query, where } from '../../lib/firebase';
import { collections } from '../../lib/db';

export default function CourseDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseCode = searchParams.get('code');
  const { user } = useAuth();

  const { data: courses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  const course = useMemo(() => {
    return courses.find(c => c.code === courseCode);
  }, [courses, courseCode]);

  const sessions = useMemo(() => {
    return allSessions.filter(s => s.courseCode === courseCode);
  }, [allSessions, courseCode]);

  useEffect(() => {
    if (!courseCode || !user?.uid || loadingSessions) return;

    const fetchAttendance = async () => {
      const list: any[] = [];

      for (const session of sessions) {
        try {
          const attQ = query(
            collection(db, `${collections.SESSIONS}/${session.id}/attendance`),
            where('studentId', '==', user.uid)
          );
          const attSnap = await getDocs(attQ);
          if (attSnap.size > 0) {
            const attData = attSnap.docs[0].data();
            list.push({
              id: attSnap.docs[0].id,
              sessionId: session.id,
              title: session.courseName || session.courseCode,
              date: session.date,
              startTime: session.startTime,
              status: attData.status || 'present',
              timestamp: attData.timestamp,
            });
          } else {
            list.push({
              id: `noatt_${session.id}`,
              sessionId: session.id,
              title: session.courseName || session.courseCode,
              date: session.date,
              startTime: session.startTime,
              status: 'absent',
              timestamp: null,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.startTime || '').localeCompare(a.startTime || ''));
      setAttendanceList(list);
      setLoadingAttendance(false);
    };

    fetchAttendance();
  }, [courseCode, user, sessions, loadingSessions]);

  const stats = useMemo(() => {
    const present = attendanceList.filter(a => a.status === 'present').length;
    const late = attendanceList.filter(a => a.status === 'late').length;
    const absent = attendanceList.filter(a => a.status === 'absent').length;
    const total = attendanceList.length;
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { present, late, absent, total, pct };
  }, [attendanceList]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-success-container/30 text-success';
      case 'late': return 'bg-secondary-container/30 text-secondary';
      default: return 'bg-error-container/30 text-error';
    }
  };

  if (!courseCode) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-24 py-8 text-center">
        <p className="font-title-lg text-on-surface-variant">No course selected.</p>
        <button onClick={() => navigate('/student/courses')} className="mt-4 text-primary font-label-md hover:underline">Back to Courses</button>
      </div>
    );
  }

  if (loadingSessions || loadingAttendance) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-24 py-8 animate-page-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

<section className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/30" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full font-label-md mb-2">{course?.code || courseCode}</span>
            <h2 className="font-headline-lg text-primary mb-2">{course?.name || courseCode}</h2>
            {course?.description && (
              <p className="font-body-md text-on-surface-variant">{course.description}</p>
            )}
          </div>
          <button
            onClick={() => navigate('/student/checkin')}
            className="w-full md:w-auto bg-primary-container text-on-primary-container font-label-md py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-container/90 transition-colors active:scale-95"
          >
            <QrCode className="w-5 h-5" />
            Scan for this Class
          </button>
        </div>
      </section>

<section className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="bg-surface-container-lowest p-5 border border-outline-variant/30 col-span-2 md:col-span-1 flex flex-col justify-between" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h3 className="font-label-md text-on-surface-variant mb-2">Overall Attendance</h3>
          <div className="flex items-end gap-2">
            <span className={`font-display-lg leading-none ${stats.pct < 50 ? 'text-error' : stats.pct < 75 ? 'text-secondary' : 'text-success'}`}>{stats.pct}%</span>
            <span className="font-body-sm text-on-surface-variant mb-1">{stats.pct < 50 ? 'Critical' : stats.pct < 75 ? 'At Risk' : 'Good'}</span>
          </div>
          <div className="w-full bg-surface-variant h-2 rounded-full mt-4 overflow-hidden">
            <div className={`h-full rounded-full ${stats.pct < 50 ? 'bg-error' : stats.pct < 75 ? 'bg-secondary' : 'bg-success'}`} style={{ width: `${stats.pct}%` }}></div>
          </div>
        </div>

<div className="bg-surface-container-lowest p-5 border border-outline-variant/30 flex flex-col justify-between" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
  <div className="flex items-center justify-between mb-2">
    <h3 className="font-label-md text-on-surface-variant">Present</h3>
    <CheckCircle className="w-5 h-5 text-success" />
  </div>
  <span className="font-headline-lg text-primary">{stats.present}</span>
  <span className="font-body-sm text-outline">Sessions</span>
</div>

<div className="bg-surface-container-lowest p-5 border border-outline-variant/30 flex flex-col justify-between" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
  <div className="flex items-center justify-between mb-2">
    <h3 className="font-label-md text-on-surface-variant">Late</h3>
    <Clock className="w-5 h-5 text-warning" />
  </div>
  <span className="font-headline-lg text-primary">{stats.late}</span>
  <span className="font-body-sm text-outline">Sessions</span>
</div>

<div className="bg-surface-container-lowest p-5 border border-outline-variant/30 flex flex-col justify-between" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label-md text-on-surface-variant">Absent</h3>
            <XCircle className="w-5 h-5 text-error" />
          </div>
          <span className="font-headline-lg text-primary">{stats.absent}</span>
          <span className="font-body-sm text-outline">Sessions</span>
        </div>
      </section>

<section className="bg-surface-container-lowest border border-outline-variant/30 overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
  <div className="p-4 border-b border-outline-variant/30 bg-surface-container-low flex justify-between items-center">
          <h3 className="font-title-lg text-primary">Attendance History</h3>
        </div>
<div className="divide-y divide-outline-variant/20">
  {attendanceList.length === 0 ? (
  <div className="p-4 text-center text-on-surface-variant font-body-md">No classes attended yet. Check in to your first session above.</div>
          ) : (
            attendanceList.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low transition-colors clickable-row">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-outline">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-body-md text-primary font-medium">{item.title}</p>
                  <p className="font-body-sm text-on-surface-variant">{item.date} {item.startTime ? `• ${item.startTime}` : ''}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full font-label-md ${statusColor(item.status)}`}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
            </div>
            ))
          )}
        </div>
      </section>

    </div>
  );
}
