import React, { useState, useMemo, useCallback } from 'react';
import { Code, Play, Loader2, BookOpen, ChevronDown, ChevronUp, Save, Clock, MapPin, Shield, Calendar, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { db, doc, setDoc } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { uploadJSONToCloudinary } from '../../lib/cloudinary';
import { CAMPUSES } from '../../lib/campuses';
import { WeeklyScheduleEntry, generateEmptySchedule, getCurrentWeek } from '../../lib/weeklySchedule';
import toast from 'react-hot-toast';

export interface CourseDefaults {
  outline: string[];
  defaultRoom: string;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultCampusId: string;
  semesterStart: string;
  weeklySchedule: WeeklyScheduleEntry[];
  outlineDocumentUrl: string;
  antiFraudDefaults: {
    requireGps: boolean;
    requireIpRange: boolean;
    allowedRadiusMeters: number;
  };
}

export default function CourseManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: courses, loading: loadingCourses } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: enrollments, loading: loadingEnrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);
  const { data: allSessions, loading: loadingSessions } = useFirestoreRealtimeCollection(collections.SESSIONS);

  const myCourses = useMemo(() => {
    return (courses || []).filter((c: any) => c.lecturer === user?.uid);
  }, [courses, user]);

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [savingDefaults, setSavingDefaults] = useState<string | null>(null);
  const [defaultsDraft, setDefaultsDraft] = useState<Record<string, CourseDefaults>>({});

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const courseStats = useMemo(() => {
    return myCourses.map((c: any) => {
      const courseEnrollments = (enrollments || []).filter((e: any) => e.courseCode === c.code);
      const courseSessions = (allSessions || []).filter((s: any) => s.courseCode === c.code);
      const todaySessions = courseSessions.filter((s: any) => s.date === todayStr);
      const enrolledCount = courseEnrollments.length;
      let totalPresent = 0;
      let totalEnrolled = 0;
      for (const session of courseSessions) {
        const sessionEnrolled = session.enrolledCount || enrolledCount;
        const sessionPresent = session.attendanceCount || 0;
        totalEnrolled += sessionEnrolled;
        totalPresent += sessionPresent;
      }
      const compliance = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;
      const nextSession = todaySessions.find((s: any) => s.status === 'open' || s.status === 'scheduled') || todaySessions[0];
      return {
        ...c,
        enrolledCount,
        sessionCount: courseSessions.length,
        compliance,
        nextSession: nextSession || null,
        todaySessions: todaySessions.length,
      };
    });
  }, [myCourses, enrollments, allSessions, todayStr]);

  const totalStudents = useMemo(() => {
    return (enrollments || []).filter((e: any) => (myCourses || []).some((c: any) => c.code === e.courseCode)).length;
  }, [enrollments, myCourses]);

  const totalSessionsToday = useMemo(() => {
    return (allSessions || []).filter((s: any) => s.date === todayStr && (myCourses || []).some((c: any) => c.code === s.courseCode)).length;
  }, [allSessions, todayStr, myCourses]);

  const openExpanded = useCallback((code: string) => {
    if (expandedCourse === code) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(code);
      const c = (courses || []).find((x: any) => x.code === code);
      if (c && !defaultsDraft[code]) {
        setDefaultsDraft(prev => ({
          ...prev,
          [code]: {
            outline: c.outline || [],
            defaultRoom: c.defaultRoom || '',
            defaultStartTime: c.defaultStartTime || '08:00',
            defaultEndTime: c.defaultEndTime || '10:00',
            defaultCampusId: c.defaultCampusId || '',
            semesterStart: c.semesterStart || '',
            weeklySchedule: c.weeklySchedule || generateEmptySchedule(16),
            outlineDocumentUrl: c.outlineDocumentUrl || '',
            antiFraudDefaults: c.antiFraudDefaults || {
              requireGps: true,
              requireIpRange: true,
              allowedRadiusMeters: 500,
            },
          },
        }));
      }
    }
  }, [expandedCourse, defaultsDraft, courses]);

  const updateDraft = useCallback((code: string, patch: Partial<CourseDefaults>) => {
    setDefaultsDraft(prev => {
      const current = prev[code] || {
        outline: [],
        defaultRoom: '',
        defaultStartTime: '08:00',
        defaultEndTime: '10:00',
        defaultCampusId: '',
        semesterStart: '',
        weeklySchedule: [],
        outlineDocumentUrl: '',
        antiFraudDefaults: { requireGps: true, requireIpRange: true, allowedRadiusMeters: 500 },
      };
      return { ...prev, [code]: { ...current, ...patch } };
    });
  }, []);

  const updateAntiFraud = useCallback((code: string, field: string, value: any) => {
    setDefaultsDraft(prev => {
      const current = prev[code];
      if (!current) return prev;
      return {
        ...prev,
        [code]: {
          ...current,
          antiFraudDefaults: { ...current.antiFraudDefaults, [field]: value },
        },
      };
    });
  }, []);

  const saveDefaults = useCallback(async (code: string) => {
    const draft = defaultsDraft[code];
    if (!draft) return;
    setSavingDefaults(code);
    try {
      const docRef = doc(db, collections.COURSES, code);
      const payload: any = {
        outline: draft.outline,
        defaultRoom: draft.defaultRoom,
        defaultStartTime: draft.defaultStartTime,
        defaultEndTime: draft.defaultEndTime,
        defaultCampusId: draft.defaultCampusId,
        semesterStart: draft.semesterStart,
        weeklySchedule: draft.weeklySchedule,
        outlineDocumentUrl: draft.outlineDocumentUrl,
        antiFraudDefaults: draft.antiFraudDefaults,
      };
      await setDoc(docRef, payload, { merge: true });
      const allCourses = [...(courses || [])];
      const idx = allCourses.findIndex((c: any) => c.code === code);
      if (idx >= 0) {
        allCourses[idx] = { ...allCourses[idx], ...payload };
      }
      try {
        await uploadJSONToCloudinary('courses.json', allCourses);
      } catch { /* non-blocking */ }
      toast.success('Course defaults saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save defaults');
    } finally {
      setSavingDefaults(null);
    }
  }, [defaultsDraft, courses]);

  if (loadingCourses || loadingEnrollments || loadingSessions) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
      </div>
    );
  }

  return (
    <div className="animate-page-in" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Course Management
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 300, fontStyle: 'italic' }}>
          Manage your assigned courses and track student engagement.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {courseStats.length === 0 ? (
          <div
            className="lg:col-span-12"
            style={{
              padding: '24px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--bg-border)',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
            }}
          >
            <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ opacity: 0.3 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No courses assigned yet.</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Contact administration to get course access.</p>
          </div>
        ) : (
          <>
            {/* Primary Course Card */}
            {courseStats.slice(0, 1).map((course: any) => (
              <div key={course.code} className="lg:col-span-8">
                <div
                  style={{
                    padding: '24px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '0.5px solid var(--bg-border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {course.nextSession && (
                    <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                      <span className="badge badge-info">Next: {course.nextSession.startTime || 'Today'}</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: 'var(--radius-lg)',
                          background: 'var(--kabu-maroon)',
                          color: 'var(--text-inverse)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Code className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--text-primary)' }}>
                          {course.code}
                        </h3>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {course.name}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 my-4">
                      <div>
                        <p className="form-label">Enrollment</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {course.enrolledCount}{' '}
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                            Students
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="form-label">Sessions</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--success)' }}>
                          {course.sessionCount}
                        </p>
                      </div>
                      <div>
                        <p className="form-label">Attendance Target</p>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            background: 'var(--bg-elevated)',
                            borderRadius: '9999px',
                            overflow: 'hidden',
                            marginTop: '6px',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: '9999px',
                              background:
                                course.compliance >= 75
                                  ? 'var(--success)'
                                  : course.compliance >= 50
                                  ? 'var(--warning)'
                                  : 'var(--danger)',
                              width: `${course.compliance}%`,
                              transition: 'width 500ms ease',
                            }}
                          />
                        </div>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          {course.compliance}%
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                      <button
                        onClick={() => navigate('/lecturer')}
                        className="btn-primary w-full sm:w-auto"
                        style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Play className="w-4 h-4" /> Start Session
                      </button>
                      <button
                        onClick={() => openExpanded(course.code)}
                        className="btn-ghost w-full sm:w-auto"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          padding: '10px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <BookOpen className="w-4 h-4" />
                        Outline & Defaults
                        {expandedCourse === course.code ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Outline & Defaults Editor (inline, only when a course is expanded) */}
            {expandedCourse && defaultsDraft[expandedCourse] && (
              <div className="lg:col-span-12">
                {(() => {
                  const course = courseStats.find((c: any) => c.code === expandedCourse);
                  const draft = defaultsDraft[expandedCourse];
                  if (!course || !draft) return null;
                  return (
                    <div
                      style={{
                        padding: '24px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--bg-border)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                        animation: 'slideUp 0.2s ease-out',
                      }}
                    >
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--kabu-maroon-tint)',
                              color: 'var(--kabu-maroon)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '18px', color: 'var(--text-primary)' }}>
                              {course.code} — Outline & Session Defaults
                            </h3>
                            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              These values prefill the "Start Session" form automatically.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => saveDefaults(course.code)}
                          disabled={savingDefaults === course.code}
                          className="btn-primary"
                          style={{ fontSize: '13px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {savingDefaults === course.code ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                          ) : (
                            <><Save className="w-4 h-4" /> Save Defaults</>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Semester Start Date */}
                        <div className="md:col-span-2">
                          <label className="form-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                            Semester Start Date
                          </label>
                          <input
                            type="date"
                            value={draft.semesterStart}
                            onChange={(e) => {
                              const newStart = e.target.value;
                              updateDraft(course.code, { semesterStart: newStart });
                              // Auto-generate weekly schedule if empty
                              if (draft.weeklySchedule.every(w => !w.topic)) {
                                updateDraft(course.code, { weeklySchedule: generateEmptySchedule(16) });
                              }
                            }}
                            className="input-base"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', maxWidth: '300px' }}
                          />
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            Used to auto-detect the current week and pre-fill topics when starting sessions.
                          </p>
                        </div>

                        {/* Weekly Schedule Grid */}
                        <div className="md:col-span-2">
                          <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                            Weekly Schedule <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: '0' }}>(plan topics for each week of the semester)</span>
                          </label>
                          <div style={{
                            border: '0.5px solid var(--bg-border)',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            background: 'var(--bg-surface)',
                          }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 1fr 1fr',
                              gap: '0',
                              borderBottom: '0.5px solid var(--bg-border)',
                              background: 'var(--bg-elevated)',
                            }}>
                              <div style={{ padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Week</div>
                              <div style={{ padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Title</div>
                              <div style={{ padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Topic</div>
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                              {draft.weeklySchedule.map((entry, idx) => {
                                const currentWeek = draft.semesterStart ? getCurrentWeek(draft.semesterStart) : null;
                                const isCurrentWeek = currentWeek === entry.week;
                                return (
                                  <div
                                    key={entry.week}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '60px 1fr 1fr',
                                      gap: '0',
                                      borderBottom: idx < draft.weeklySchedule.length - 1 ? '0.5px solid var(--bg-border)' : 'none',
                                      background: isCurrentWeek ? 'var(--kabu-maroon-tint)' : 'transparent',
                                      transition: 'background 150ms',
                                    }}
                                  >
                                    <div style={{
                                      padding: '8px 12px',
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '12px',
                                      fontWeight: isCurrentWeek ? 600 : 400,
                                      color: isCurrentWeek ? 'var(--kabu-maroon)' : 'var(--text-tertiary)',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}>
                                      {isCurrentWeek && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--kabu-maroon)', marginRight: '6px' }} />}
                                      W{entry.week}
                                    </div>
                                    <div style={{ padding: '4px 8px' }}>
                                      <input
                                        value={entry.title}
                                        onChange={(e) => {
                                          const newSchedule = [...draft.weeklySchedule];
                                          newSchedule[idx] = { ...newSchedule[idx], title: e.target.value };
                                          updateDraft(course.code, { weeklySchedule: newSchedule });
                                        }}
                                        placeholder={`Week ${entry.week}`}
                                        className="input-base"
                                        style={{ fontSize: '12px', padding: '6px 8px', border: 'none', background: 'transparent' }}
                                      />
                                    </div>
                                    <div style={{ padding: '4px 8px' }}>
                                      <input
                                        value={entry.topic}
                                        onChange={(e) => {
                                          const newSchedule = [...draft.weeklySchedule];
                                          newSchedule[idx] = { ...newSchedule[idx], topic: e.target.value };
                                          updateDraft(course.code, { weeklySchedule: newSchedule });
                                        }}
                                        placeholder="e.g. Introduction to Arrays"
                                        className="input-base"
                                        style={{ fontSize: '12px', padding: '6px 8px', border: 'none', background: 'transparent' }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            {draft.weeklySchedule.filter(w => w.topic).length} of {draft.weeklySchedule.length} weeks planned
                            {draft.semesterStart && getCurrentWeek(draft.semesterStart) && (
                              <span style={{ color: 'var(--kabu-maroon)', marginLeft: '8px' }}>
                                · Currently week {getCurrentWeek(draft.semesterStart)}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Room */}
                        <div>
                          <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Default Room / Venue</label>
                          <input
                            value={draft.defaultRoom}
                            onChange={(e) => updateDraft(course.code, { defaultRoom: e.target.value })}
                            placeholder="e.g. LT-201"
                            className="input-base"
                          />
                        </div>

                        {/* Campus */}
                        <div>
                          <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>Default Campus</label>
                          <select
                            value={draft.defaultCampusId}
                            onChange={(e) => updateDraft(course.code, { defaultCampusId: e.target.value })}
                            className="input-base cursor-pointer"
                            style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}
                          >
                            <option value="">Select campus...</option>
                            {CAMPUSES.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Start time */}
                        <div>
                          <label className="form-label" style={{ marginBottom: '6px', display: 'block', alignItems: 'center', gap: '6px' }}>
                            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} /> Default Start Time
                          </label>
                          <input
                            type="time"
                            value={draft.defaultStartTime}
                            onChange={(e) => updateDraft(course.code, { defaultStartTime: e.target.value })}
                            className="input-base"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
                          />
                        </div>

                        {/* End time */}
                        <div>
                          <label className="form-label" style={{ marginBottom: '6px', display: 'block', alignItems: 'center', gap: '6px' }}>
                            <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} /> Default End Time
                          </label>
                          <input
                            type="time"
                            value={draft.defaultEndTime}
                            onChange={(e) => updateDraft(course.code, { defaultEndTime: e.target.value })}
                            className="input-base"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: '14px' }}
                          />
                        </div>

                        {/* Anti-fraud defaults */}
                        <div className="md:col-span-2">
                          <div
                            style={{
                              padding: '16px',
                              background: 'var(--bg-surface)',
                              borderRadius: 'var(--radius-md)',
                              border: '0.5px solid var(--bg-border)',
                            }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Shield className="w-4 h-4" style={{ color: 'var(--kabu-maroon)' }} />
                              <span className="font-label-md" style={{ color: 'var(--text-secondary)' }}>Anti-Fraud Defaults</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>GPS Proximity Check</span>
                                <input
                                  type="checkbox"
                                  checked={draft.antiFraudDefaults.requireGps}
                                  onChange={(e) => updateAntiFraud(course.code, 'requireGps', e.target.checked)}
                                  className="w-4 h-4"
                                  style={{ accentColor: 'var(--kabu-maroon)' }}
                                />
                              </label>
                              <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>IP Range Validation</span>
                                <input
                                  type="checkbox"
                                  checked={draft.antiFraudDefaults.requireIpRange}
                                  onChange={(e) => updateAntiFraud(course.code, 'requireIpRange', e.target.checked)}
                                  className="w-4 h-4"
                                  style={{ accentColor: 'var(--kabu-maroon)' }}
                                />
                              </label>
                              <div className="sm:col-span-2">
                                <label className="text-xs" style={{ color: 'var(--text-tertiary)', marginBottom: '4px', display: 'block' }}>
                                  <MapPin className="w-3.5 h-3.5 inline" /> Allowed GPS Radius (meters)
                                </label>
                                <input
                                  type="number"
                                  min="50"
                                  max="2000"
                                  value={draft.antiFraudDefaults.allowedRadiusMeters}
                                  onChange={(e) => updateAntiFraud(course.code, 'allowedRadiusMeters', parseInt(e.target.value) || 500)}
                                  className="input-base"
                                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', maxWidth: '200px' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Today's Overview */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div
                style={{
                  padding: '24px',
                  background: 'var(--kabu-maroon-tint)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--bg-border)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <h4
                  style={{ fontFamily: 'var(--font-editorial)', fontSize: '20px', color: 'var(--kabu-maroon)', marginBottom: '16px' }}
                >
                  Today's Overview
                </h4>
                <div className="space-y-4">
                  <div
                    className="flex justify-between items-center"
                    style={{ paddingBottom: '8px', borderBottom: '0.5px solid var(--bg-border)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Scheduled Lectures
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {totalSessionsToday}
                    </span>
                  </div>
                  <div
                    className="flex justify-between items-center"
                    style={{ paddingBottom: '8px', borderBottom: '0.5px solid var(--bg-border)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Total Students
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {totalStudents}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Assigned Courses
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {courseStats.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* All Assigned Courses Grid */}
            <div className="lg:col-span-12 mt-2">
              <h3
                style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: '20px',
                  color: 'var(--text-primary)',
                  marginBottom: '16px',
                }}
              >
                All Assigned Courses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courseStats.map((course: any) => (
                  <div
                    key={course.code}
                    style={{
                      padding: '20px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-lg)',
                      border: '0.5px solid var(--bg-border)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 0.5px var(--bg-border)',
                      transition: 'box-shadow 150ms ease',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-elevated)',
                          color: 'var(--kabu-maroon)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Code className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 style={{ fontFamily: 'var(--font-editorial)', fontSize: '16px', color: 'var(--text-primary)' }}>
                          {course.code}
                        </h4>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {course.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between mb-4" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>{course.enrolledCount} enrolled</span>
                      <span>{course.sessionCount} sessions</span>
                    </div>
                    {(course.outline || course.defaultRoom) && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--kabu-maroon)',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <BookOpen className="w-3 h-3" /> {course.outline?.length || 0} topics · Room: {course.defaultRoom || 'not set'}
                      </div>
                    )}
                    <button
                      onClick={() => navigate('/lecturer')}
                      className="btn-ghost w-full"
                      style={{ fontSize: '13px', padding: '8px 16px' }}
                    >
                      Start Session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
