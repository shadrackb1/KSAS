// OVERSIGHT TIER — READ-ONLY. No create, edit, or delete actions. All data is scoped read from Firestore.
import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ChartTooltip, Sparkline, CountUp, HorizontalBarLabel, VerticalBarLabel, getRateColor, DonutChart, SmallMultiples } from '../../components/charts';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, collection, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const iconTrendingUp = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);
const iconArrowUpRight = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
);
const iconArrowDownRight = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7L7 17"/><path d="M17 17H7V7"/></svg>
);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DayDatum {
  date: string;
  rate: number;
  sessions: number;
}

interface CourseDatum {
  course: string;
  name: string;
  rate: number;
  sessions: number;
}

export default function DepartmentAnalytics() {
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: sessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const scopeFilter = user?.role === 'hod' ? 'department' : user?.role === 'dean' ? 'faculty' : null;

  const scopeCourses = useMemo(() => {
    if (!scopeFilter || !user) return courses;
    return courses.filter((c: any) => !c[scopeFilter] || c[scopeFilter] === (user as any)[scopeFilter]);
  }, [courses, scopeFilter, user]);

  const scopeCourseCodes = useMemo(() => new Set(scopeCourses.map((c: any) => c.code)), [scopeCourses]);

  const scopeSessions = useMemo(() => sessions.filter((s: any) => scopeCourseCodes.has(s.courseCode) && (s.status === 'closed' || s.status === 'open')), [sessions, scopeCourseCodes]);

  const [trendData, setTrendData] = useState<DayDatum[]>([]);
  const [courseBarData, setCourseBarData] = useState<CourseDatum[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingDetail(true);
      try {
      const allSessionSnap = await getDocs(collection(db, collections.SESSIONS));
      const allSessList: any[] = allSessionSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => scopeCourseCodes.has(s.courseCode));
        const dayMap = new Map<string, { present: number; enrolled: number; sessions: number }>();
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().split('T')[0];
          dayMap.set(key, { present: 0, enrolled: 0, sessions: 0 });
        }
        for (const s of allSessList) {
          if (!s.date || !dayMap.has(s.date)) continue;
          const entry = dayMap.get(s.date)!;
          entry.enrolled += s.enrolledCount || 0;
          entry.present += s.attendanceCount || 0;
          entry.sessions += 1;
        }
        const trend: DayDatum[] = Array.from(dayMap.entries()).map(([date, v]) => ({
          date: new Date(date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
          rate: v.enrolled > 0 ? Math.round((v.present / v.enrolled) * 100) : 0,
          sessions: v.sessions,
        }));
        setTrendData(trend);

        const courseMap = new Map<string, { name: string; present: number; enrolled: number; sessions: number }>();
        for (const s of allSessList) {
          if (!s.courseCode) continue;
          const existing = courseMap.get(s.courseCode);
          if (existing) {
            existing.present += s.attendanceCount || 0;
            existing.enrolled += s.enrolledCount || 0;
            existing.sessions += 1;
          } else {
            courseMap.set(s.courseCode, {
              name: s.courseName || s.courseCode,
              present: s.attendanceCount || 0,
              enrolled: s.enrolledCount || 0,
              sessions: 1,
            });
          }
        }
        const barData: CourseDatum[] = Array.from(courseMap.entries())
          .map(([code, v]) => ({
            course: code,
            name: v.name,
            rate: v.enrolled > 0 ? Math.round((v.present / v.enrolled) * 100) : 0,
            sessions: v.sessions,
          }))
          .sort((a, b) => b.rate - a.rate);
        setCourseBarData(barData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [scopeCourseCodes]);

  const topPerformers = useMemo(() => courseBarData.slice(0, 5), [courseBarData]);
  const bottomPerformers = useMemo(() => [...courseBarData].reverse().slice(0, 5), [courseBarData]);

  const avgRate = useMemo(() => {
    if (courseBarData.length === 0) return 0;
    return Math.round(courseBarData.reduce((s, c) => s + c.rate, 0) / courseBarData.length);
  }, [courseBarData]);

  // ── NEW: Attendance status breakdown ────────────────────────────────────────
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<{ day: string; rate: number; sessions: number }[]>([]);
  const [lecturerPerf, setLecturerPerf] = useState<{ name: string; rate: number; sessions: number }[]>([]);
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [courseSparklines, setCourseSparklines] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    (async () => {
      try {
        const allSessionSnap = await getDocs(collection(db, collections.SESSIONS));
        const allSessList: any[] = allSessionSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((s: any) => scopeCourseCodes.has(s.courseCode));

        // Attendance status breakdown
        let present = 0, late = 0, absent = 0;
        for (const s of allSessList) {
          present += s.attendanceCount || 0;
          absent += Math.max(0, (s.enrolledCount || 0) - (s.attendanceCount || 0));
        }
        setStatusBreakdown([
          { name: 'Present', value: present, color: 'var(--success)' },
          { name: 'Absent', value: absent, color: 'var(--danger)' },
        ].filter(d => d.value > 0));

        // Day-of-week attendance rates
        const dayMap = new Map<number, { present: number; enrolled: number; count: number }>();
        for (let i = 0; i < 7; i++) dayMap.set(i, { present: 0, enrolled: 0, count: 0 });
        for (const s of allSessList) {
          if (!s.date) continue;
          const dow = new Date(s.date).getDay();
          const entry = dayMap.get(dow)!;
          entry.present += s.attendanceCount || 0;
          entry.enrolled += s.enrolledCount || 0;
          entry.count += 1;
        }
        setDayOfWeekData(
          Array.from(dayMap.entries()).map(([idx, v]) => ({
            day: DAY_NAMES[idx],
            rate: v.enrolled > 0 ? Math.round((v.present / v.enrolled) * 100) : 0,
            sessions: v.count,
          }))
        );

        // Lecturer effectiveness
        const lecMap = new Map<string, { name: string; present: number; enrolled: number; count: number }>();
        for (const s of allSessList) {
          if (!s.lecturerId) continue;
          const existing = lecMap.get(s.lecturerId);
          if (existing) {
            existing.present += s.attendanceCount || 0;
            existing.enrolled += s.enrolledCount || 0;
            existing.count += 1;
          } else {
            lecMap.set(s.lecturerId, {
              name: s.lecturerName || s.lecturerId,
              present: s.attendanceCount || 0,
              enrolled: s.enrolledCount || 0,
              count: 1,
            });
          }
        }
        setLecturerPerf(
          Array.from(lecMap.values())
            .map(v => ({ name: v.name, rate: v.enrolled > 0 ? Math.round((v.present / v.enrolled) * 100) : 0, sessions: v.count }))
            .sort((a, b) => b.rate - a.rate)
        );

        // Enrollment count
        const enrolls = await getDocs(collection(db, collections.ENROLLMENTS));
        const codes = new Set(scopeCourses.map((c: any) => c.code));
        setEnrollmentCount(enrolls.docs.filter(d => codes.has(d.data().courseCode)).length);

        // Course sparklines (last 5 sessions per course)
        const sparkMap = new Map<string, number[]>();
        const courseSessions = new Map<string, any[]>();
        for (const s of allSessList) {
          if (!s.courseCode) continue;
          if (!courseSessions.has(s.courseCode)) courseSessions.set(s.courseCode, []);
          courseSessions.get(s.courseCode)!.push(s);
        }
        for (const [code, sessList] of courseSessions) {
          const sorted = sessList.sort((a: any, b: any) => (a.date || '').localeCompare(b.date || '')).slice(-5);
          const rates = sorted.map((s: any) => s.enrolledCount > 0 ? Math.round(((s.attendanceCount || 0) / s.enrolledCount) * 100) : 0);
          sparkMap.set(code, rates);
        }
        setCourseSparklines(sparkMap);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [scopeCourseCodes, scopeCourses]);

  if (loadingCourses || loadingSessions) {
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
          Department Analytics
        </h1>
        <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', fontWeight: 300 }}>
          Scope: {user ? ((user as any)[scopeFilter || ''] || 'All') : 'All'} · Read-Only
        </p>
      </section>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Avg Attendance', value: avgRate, icon: iconTrendingUp, color: avgRate >= 75 ? '#2d8a56' : '#8B1538', suffix: '%', isRate: true },
          { label: 'Total Sessions', value: scopeSessions.length, icon: iconTrendingUp, color: '#8B1538', isRate: false },
          { label: 'Courses', value: scopeCourses.length, icon: iconTrendingUp, color: '#8B1538', isRate: false },
          { label: 'Lecturers', value: lecturerPerf.length, icon: iconTrendingUp, color: '#6B4A50', isRate: false },
          { label: 'Enrolled Students', value: enrollmentCount, icon: iconTrendingUp, color: '#6B4A50', isRate: false },
        ].map((stat) => (
          <div key={stat.label} className="p-4 sm:p-5" style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--bg-border)' }}>
            <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{stat.label}</span>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '28px', fontWeight: 500, color: stat.color, marginTop: '4px' }}>
              {stat.isRate ? (
                <><CountUp value={stat.value} suffix={stat.suffix} decimals={0} /></>
              ) : (
                <CountUp value={stat.value} decimals={0} />
              )}
            </p>
          </div>
        ))}
      </section>

      {loadingDetail ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: '#8B1538' }} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Attendance Status Donut */}
          {statusBreakdown.length > 0 && (
            <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Attendance Status
              </h3>
              <div className="flex justify-center">
                <DonutChart data={statusBreakdown} size={200} innerRadius={60} outerRadius={85} />
              </div>
            </div>
          )}

          {/* Day-of-Week Bar Chart */}
          {dayOfWeekData.length > 0 && (
            <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
              <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Attendance by Day of Week
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} formatter={(value: number) => [`${value}%`, 'Attendance']} />
                  <Bar dataKey="rate" radius={[6, 6, 0, 0]} animationDuration={800} label={<VerticalBarLabel unit="%" />}>
                    {dayOfWeekData.map((entry) => (
                      <Cell key={entry.day} fill={getRateColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trend Line Chart */}
          <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Attendance Trend (30 Days)
            </h3>
            {trendData.length === 0 ? (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', textAlign: 'center', padding: '40px 0' }}>No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} formatter={(value: number) => [`${value}%`, 'Attendance']} labelStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '12px', color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="rate" stroke="var(--accent-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: 'var(--accent-primary)', stroke: '#fff', strokeWidth: 2 }} animationDuration={1200} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bar Chart by Course */}
          <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Attendance by Course
            </h3>
            {courseBarData.length === 0 ? (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', textAlign: 'center', padding: '40px 0' }}>No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, courseBarData.length * 36)}>
                <BarChart data={courseBarData} layout="vertical" margin={{ left: 80, right: 40, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="course" tick={{ fill: 'var(--text-primary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={false} width={75} />
                  <Tooltip content={<ChartTooltip />} formatter={(value: number, _n: string, props: any) => [`${value}% (${props.payload.name})`]} />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} animationDuration={1000} label={<HorizontalBarLabel unit="%" />}>
                    {courseBarData.map((entry) => (
                      <Cell key={entry.course} fill={getRateColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Lecturer Effectiveness */}
          {lecturerPerf.length > 0 && (
            <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
              <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                Lecturer Effectiveness
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(160, lecturerPerf.length * 32)}>
                <BarChart data={lecturerPerf.slice(0, 10)} layout="vertical" margin={{ left: 100, right: 40, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-primary)', fontSize: 11, fontFamily: 'Outfit, sans-serif' }} tickLine={false} axisLine={false} width={95} />
                  <Tooltip content={<ChartTooltip />} formatter={(value: number) => [`${value}%`, 'Attendance']} />
                  <Bar dataKey="rate" radius={[0, 6, 6, 0]} animationDuration={800} label={<HorizontalBarLabel unit="%" />}>
                    {lecturerPerf.slice(0, 10).map((entry, i) => (
                      <Cell key={i} fill={getRateColor(entry.rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Performers */}
          <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Top Performers
            </h3>
            {topPerformers.length === 0 ? (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', textAlign: 'center', padding: '24px 0' }}>No data</p>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {topPerformers.map((c) => (
                  <div key={c.course} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: '0.5px solid #E8D8DA' }}>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#1A0508' }}>{c.course}</p>
                      <p className="truncate" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: '#6B4A50' }}>{c.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkline data={courseSparklines.get(c.course) || [c.rate]} color="#2d8a56" />
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: '#2d8a56', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {c.rate}% {iconArrowUpRight}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Performers */}
          <div className="p-5" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #E8D8DA' }}>
            <h3 style={{ fontFamily: 'Big Shoulders Display, sans-serif', fontSize: '16px', color: '#1A0508', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Needs Improvement
            </h3>
            {bottomPerformers.length === 0 ? (
              <p style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13px', color: '#6B4A50', textAlign: 'center', padding: '24px 0' }}>No data</p>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {bottomPerformers.map((c) => (
                  <div key={c.course} className="flex items-center justify-between gap-3 py-3" style={{ borderBottom: '0.5px solid #E8D8DA' }}>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 600, color: '#1A0508' }}>{c.course}</p>
                      <p className="truncate" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: '#6B4A50' }}>{c.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkline data={courseSparklines.get(c.course) || [c.rate]} color="#8B1538" />
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600, color: '#8B1538', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {c.rate}% {iconArrowDownRight}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
