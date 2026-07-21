import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3, Loader2, Download, X, TrendingUp, TrendingDown, Users, Calendar,
  AlertTriangle, Clock, Target, Brain, MapPin, BookOpen, Activity, Zap,
  Star, ChevronDown, Info, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, Legend, AreaChart, Area,
} from 'recharts';
import {
  DonutChart, XP_TIER_COLORS, CountUp, ChartTooltip, HorizontalBarLabel, VerticalBarLabel, Sparkline,
} from '../../components/charts';
import {
  fetchAllSessionData, AllAnalyticsData,
  computeLecturerEffectiveness, computeTimeHeatmap, computePredictiveRisk,
  computeDepartmentStats, computeFeedbackCorrelation, computeGeoCompliance,
  computeCohortAnalytics, computeOperationalMetrics, detectAnomalies,
  computeGoalProgress,
  LecturerEffectiveness, TimeHeatmapCell, PredictiveRisk,
  DepartmentStats, FeedbackCorrelation, GeoCompliance,
  CohortAnalytics, OperationalMetrics, Anomaly, GoalProgress,
} from '../../lib/analytics';

type TabId = 'overview' | 'lecturers' | 'time' | 'departments' | 'correlations' | 'predictive' | 'cohort' | 'operations' | 'anomalies' | 'goals';

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'lecturers', label: 'Lecturers', icon: Users },
  { id: 'time', label: 'Time Patterns', icon: Clock },
  { id: 'departments', label: 'Departments', icon: BookOpen },
  { id: 'correlations', label: 'Correlations', icon: Activity },
  { id: 'predictive', label: 'Predictive Risk', icon: Brain },
  { id: 'cohort', label: 'Cohort', icon: Users },
  { id: 'operations', label: 'Operations', icon: Zap },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { id: 'goals', label: 'Goals', icon: Target },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Analytics() {
  const [data, setData] = useState<AllAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedStudent, setSelectedStudent] = useState<PredictiveRisk | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fetched = await fetchAllSessionData();
        setData(fetched);
      } catch (err) {
        console.error('Failed to load analytics data', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute all analytics
  const lecturerData = useMemo(() => data ? computeLecturerEffectiveness(data) : [], [data]);
  const timeHeatmap = useMemo(() => data ? computeTimeHeatmap(data) : [], [data]);
  const predictiveRisk = useMemo(() => data ? computePredictiveRisk(data) : [], [data]);
  const departmentData = useMemo(() => data ? computeDepartmentStats(data) : [], [data]);
  const feedbackCorrelation = useMemo(() => data ? computeFeedbackCorrelation(data) : [], [data]);
  const geoCompliance = useMemo(() => data ? computeGeoCompliance(data) : null, [data]);
  const cohortData = useMemo(() => data ? computeCohortAnalytics(data) : [], [data]);
  const operationalData = useMemo(() => data ? computeOperationalMetrics(data) : null, [data]);
  const anomalies = useMemo(() => data ? detectAnomalies(data) : [], [data]);
  const goalProgress = useMemo(() => data ? computeGoalProgress(data, 85) : null, [data]);

  // Overview computations
  const overviewStats = useMemo(() => {
    if (!data) return null;
    const totalSessions = data.sessions.length;
    const totalStudents = data.users.filter(u => u.role === 'student').length;
    const atRiskCount = predictiveRisk.filter(r => r.riskLevel === 'high' || r.riskLevel === 'medium').length;

    let totalRate = 0;
    let rateCount = 0;
    for (const session of data.sessions) {
      if (session.enrolledCount === 0) continue;
      const att = data.attendanceMap.get(session.id) || [];
      const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
      totalRate += Math.round((present / session.enrolledCount) * 100);
      rateCount++;
    }
    const avgRate = rateCount > 0 ? Math.round(totalRate / rateCount) : 0;

    return { totalSessions, totalStudents, atRiskCount, avgRate };
  }, [data, predictiveRisk]);

  const trendData = useMemo(() => {
    if (!data) return [];
    const dateMap = new Map<string, { date: string; rate: number; count: number }>();
    for (const session of data.sessions) {
      const d = session.date || '';
      if (!d) continue;
      const att = data.attendanceMap.get(session.id) || [];
      const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
      const rate = session.enrolledCount > 0 ? Math.round((present / session.enrolledCount) * 100) : 0;
      const existing = dateMap.get(d);
      if (existing) { existing.rate += rate; existing.count++; }
      else { dateMap.set(d, { date: d, rate, count: 1 }); }
    }
    return Array.from(dateMap.values())
      .map(d => ({ ...d, rate: Math.round(d.rate / d.count) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [data]);

  const attendanceBreakdown = useMemo(() => {
    if (!data) return [];
    let present = 0; let late = 0; let absent = 0;
    for (const att of data.attendanceMap.values()) {
      for (const r of att) {
        if (r.status === 'present') present++;
        else if (r.status === 'late') late++;
        else absent++;
      }
    }
    return [
      { name: 'Present', value: present, color: 'var(--success)' },
      { name: 'Late', value: late, color: 'var(--warning)' },
      { name: 'Absent', value: absent, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [data]);

  const tierDistribution = useMemo(() => {
    if (!data) return [];
    const studentRates = new Map<string, { total: number; attended: number }>();
    for (const session of data.sessions) {
      const att = data.attendanceMap.get(session.id) || [];
      for (const r of att) {
        const s = studentRates.get(r.studentId) || { total: 0, attended: 0 };
        s.total++;
        if (r.status === 'present' || r.status === 'late') s.attended++;
        studentRates.set(r.studentId, s);
      }
    }
    let bronze = 0; let silver = 0; let gold = 0; let diamond = 0;
    for (const v of studentRates.values()) {
      const rate = v.total > 0 ? (v.attended / v.total) * 100 : 0;
      if (rate >= 90) diamond++;
      else if (rate >= 75) gold++;
      else if (rate >= 50) silver++;
      else bronze++;
    }
    return [
      { name: 'Diamond (90%+)', value: diamond, color: XP_TIER_COLORS[3] },
      { name: 'Gold (75-89%)', value: gold, color: XP_TIER_COLORS[2] },
      { name: 'Silver (50-74%)', value: silver, color: XP_TIER_COLORS[1] },
      { name: 'Bronze (<50%)', value: bronze, color: XP_TIER_COLORS[0] },
    ].filter(d => d.value > 0);
  }, [data]);

  const riskTierDistribution = useMemo(() => {
    if (!data) return [];
    let high = 0; let medium = 0; let low = 0;
    const seenStudents = new Set<string>();
    for (const session of data.sessions) {
      const att = data.attendanceMap.get(session.id) || [];
      for (const r of att) {
        seenStudents.add(r.studentId);
      }
    }
    for (const r of predictiveRisk) {
      if (r.riskLevel === 'high') high++;
      else if (r.riskLevel === 'medium') medium++;
    }
    const safeCount = Math.max(0, seenStudents.size - high - medium);
    if (safeCount > 0) low = safeCount;
    return [
      { name: 'Low Risk', value: low, color: 'var(--success)' },
      { name: 'Medium Risk', value: medium, color: 'var(--warning)' },
      { name: 'High Risk', value: high, color: 'var(--danger)' },
    ].filter(d => d.value > 0);
  }, [data, predictiveRisk]);

  const riskStudentRateHistory = useMemo(() => {
    if (!data) return new Map<string, number[]>();
    const map = new Map<string, { total: number; attended: number; rates: number[] }>();
    const sessionDates = data.sessions.map(s => s.date || '').sort();
    for (const session of data.sessions) {
      const att = data.attendanceMap.get(session.id) || [];
      for (const r of att) {
        const key = `${r.studentId}-${session.courseCode}`;
        const existing = map.get(key) || { total: 0, attended: 0, rates: [] };
        existing.total++;
        if (r.status === 'present' || r.status === 'late') existing.attended++;
        map.set(key, existing);
      }
    }
    const result = new Map<string, number[]>();
    for (const [key, v] of map) {
      if (v.total > 0) result.set(key, [Math.round((v.attended / v.total) * 100)]);
    }
    return result;
  }, [data]);

  const lecturerRateHistory = useMemo(() => {
    if (!data) return new Map<string, number[]>();
    const map = new Map<string, { rates: number[] }>();
    for (const session of data.sessions) {
      if (!session.lecturerId) continue;
      const att = data.attendanceMap.get(session.id) || [];
      const enrolled = session.enrolledCount || 0;
      if (enrolled === 0) continue;
      const present = att.filter(a => a.status === 'present' || a.status === 'late').length;
      const rate = Math.round((present / enrolled) * 100);
      const existing = map.get(session.lecturerId) || { rates: [] };
      existing.rates.push(rate);
      map.set(session.lecturerId, existing);
    }
    const result = new Map<string, number[]>();
    for (const [k, v] of map) result.set(k, v.rates);
    return result;
  }, [data]);

  const riskStudents = useMemo(() => {
    if (!data) return [];
    const studentMap = new Map<string, { name: string; regNumber: string; course: string; total: number; attended: number }>();
    for (const session of data.sessions) {
      const att = data.attendanceMap.get(session.id) || [];
      for (const record of att) {
        const key = `${record.studentId}-${session.courseCode}`;
        const existing = studentMap.get(key);
        if (existing) {
          existing.total++;
          if (record.status === 'present' || record.status === 'late') existing.attended++;
        } else {
          studentMap.set(key, {
            name: record.studentName,
            regNumber: record.studentId,
            course: `${session.courseName} (${session.courseCode})`,
            total: 1,
            attended: record.status === 'present' || record.status === 'late' ? 1 : 0,
          });
        }
      }
    }
    const risk: { name: string; regNumber: string; course: string; totalSessions: number; attended: number; rate: number }[] = [];
    studentMap.forEach(v => {
      const rate = v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0;
      if (rate < 75) risk.push({ name: v.name, regNumber: v.regNumber, course: v.course, totalSessions: v.total, attended: v.attended, rate });
    });
    return risk.sort((a, b) => a.rate - b.rate);
  }, [data]);

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const handleExportCSV = (rows: any[], filename: string) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
        <div className="mb-8">
          <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Analytics</h1>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gold-primary)' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 48px' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Analytics
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 300, marginTop: '4px' }}>
          Institution-wide attendance intelligence and predictive insights.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-1" style={{ minWidth: 'max-content' }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 whitespace-nowrap transition-all"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--gold-subtle)' : 'transparent',
                  border: isActive ? '0.5px solid var(--gold-muted)' : '0.5px solid transparent',
                  color: isActive ? 'var(--gold-primary)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: isActive ? 500 : 400,
                  cursor: 'pointer',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          stats={overviewStats}
          trendData={trendData}
          attendanceBreakdown={attendanceBreakdown}
          tierDistribution={tierDistribution}
          riskTierDistribution={riskTierDistribution}
          riskStudents={riskStudents}
          riskStudentRateHistory={riskStudentRateHistory}
          getRateColor={getRateColor}
          onExportCSV={handleExportCSV}
          onSelectStudent={setSelectedStudent}
        />
      )}
      {activeTab === 'lecturers' && <LecturersTab data={lecturerData} lecturerRateHistory={lecturerRateHistory} getRateColor={getRateColor} />}
      {activeTab === 'time' && <TimeTab heatmap={timeHeatmap} />}
      {activeTab === 'departments' && <DepartmentsTab data={departmentData} getRateColor={getRateColor} />}
      {activeTab === 'correlations' && <CorrelationsTab data={feedbackCorrelation} />}
      {activeTab === 'predictive' && <PredictiveTab data={predictiveRisk} riskTierDistribution={riskTierDistribution} onSelect={setSelectedStudent} onExportCSV={handleExportCSV} />}
      {activeTab === 'cohort' && <CohortTab data={cohortData} getRateColor={getRateColor} />}
      {activeTab === 'operations' && <OperationsTab data={operationalData} geo={geoCompliance} />}
      {activeTab === 'anomalies' && <AnomaliesTab data={anomalies} />}
      {activeTab === 'goals' && <GoalsTab data={goalProgress} />}

      {/* Student Detail Modal */}
      {selectedStudent && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 md:pt-24 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="w-full max-w-lg"
            style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-xl)', padding: '32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {selectedStudent.name}
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedStudent.studentId} · {selectedStudent.courseCode}
                </p>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--text-primary)', fontWeight: 500 }}>{selectedStudent.currentRate}%</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Current</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: getRateColor(selectedStudent.projectedRate), fontWeight: 500 }}>{selectedStudent.projectedRate}%</p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Projected</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: selectedStudent.riskLevel === 'high' ? 'var(--danger)' : selectedStudent.riskLevel === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                  {selectedStudent.riskLevel.toUpperCase()}
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Risk</p>
              </div>
            </div>
            {selectedStudent.sessionsToThreshold > 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--danger)', textAlign: 'center', padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '0.5px solid var(--danger)' }}>
                Projected to fall below 75% in ~{selectedStudent.sessionsToThreshold} sessions.
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats, trendData, attendanceBreakdown, tierDistribution, riskTierDistribution, riskStudents, riskStudentRateHistory, getRateColor, onExportCSV, onSelectStudent }: {
  stats: { totalSessions: number; totalStudents: number; atRiskCount: number; avgRate: number } | null;
  trendData: any[];
  attendanceBreakdown: any[];
  tierDistribution: any[];
  riskTierDistribution: any[];
  riskStudents: any[];
  riskStudentRateHistory: Map<string, number[]>;
  getRateColor: (r: number) => string;
  onExportCSV: (rows: any[], filename: string) => void;
  onSelectStudent: (s: any) => void;
}) {
  return (
    <>
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Sessions', value: stats.totalSessions, icon: Calendar },
            { label: 'Total Students', value: stats.totalStudents, icon: Users },
            { label: 'Avg Attendance', value: `${stats.avgRate}%`, icon: BarChart3, color: getRateColor(stats.avgRate) },
            { label: 'At-Risk Students', value: stats.atRiskCount, icon: AlertTriangle, color: stats.atRiskCount > 0 ? 'var(--danger)' : 'var(--success)' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div className="flex items-center justify-between">
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.label}</p>
                <stat.icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, marginTop: '4px', color: stat.color || 'var(--text-primary)' }}>
                {typeof stat.value === 'number' && stat.label !== 'Avg Attendance' ? <CountUp value={stat.value as number} /> : stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Donut Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {attendanceBreakdown.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Attendance Status</h3>
            <div className="flex justify-center">
              <DonutChart data={attendanceBreakdown} size={200} innerRadius={60} outerRadius={85} />
            </div>
          </div>
        )}
        {tierDistribution.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Performance Tiers</h3>
            <div className="flex justify-center">
              <DonutChart data={tierDistribution} size={200} innerRadius={60} outerRadius={85} />
            </div>
          </div>
        )}
        {riskTierDistribution.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Risk Distribution</h3>
            <div className="flex justify-center">
              <DonutChart data={riskTierDistribution} size={200} innerRadius={60} outerRadius={85} />
            </div>
          </div>
        )}
      </div>

      {/* Attendance Trend */}
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Attendance Rate Trend</h2>
          {trendData.length > 0 && (
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 500, color: getRateColor(trendData[trendData.length - 1]?.rate || 0) }}>
                {trendData[trendData.length - 1]?.rate}%
              </span>
              <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px', color: 'var(--text-tertiary)' }}>latest</span>
            </div>
          )}
        </div>
        {trendData.length > 1 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false}
                tickFormatter={v => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} width={40} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
              <Line
                type="monotone" dataKey="rate" stroke="var(--gold-primary)" strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--gold-primary)', stroke: 'var(--bg-void)', strokeWidth: 2 }}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>Not enough data for a trend line.</p>
        )}
      </div>

      {/* At-Risk Students */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>At-Risk Students</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--danger)', marginTop: '2px' }}>{riskStudents.length} student{riskStudents.length !== 1 ? 's' : ''} below 75%</p>
          </div>
          {riskStudents.length > 0 && (
            <button onClick={() => onExportCSV(riskStudents, `KSAS_AtRisk_${new Date().toISOString().split('T')[0]}.csv`)} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          )}
        </div>
        {riskStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
            <TrendingUp className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--success)', opacity: 0.6 }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px' }}>No at-risk students. All rates above 75%.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                  {['Student', 'Reg No', 'Course', 'Sessions', 'Attended', 'Rate', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riskStudents.slice(0, 50).map((s, i) => (
                  <tr key={`${s.regNumber}-${i}`} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>{s.regNumber}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '13px', color: 'var(--text-secondary)' }}>{s.course}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{s.totalSessions}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{s.attended}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(s.rate), fontWeight: 500 }}>{s.rate}%</span>
                        <Sparkline data={riskStudentRateHistory.get(`${s.regNumber}-${s.course.split('(')[1]?.replace(')','') || ''}`) || [s.rate]} color={getRateColor(s.rate)} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => onSelectStudent({ name: s.name, studentId: s.regNumber, courseCode: s.course, currentRate: s.rate, projectedRate: s.rate, riskLevel: s.rate < 50 ? 'high' : 'medium', sessionsToThreshold: -1 })} className="btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Lecturers Tab ────────────────────────────────────────────────────────────

function LecturersTab({ data, lecturerRateHistory, getRateColor }: { data: LecturerEffectiveness[]; lecturerRateHistory: Map<string, number[]>; getRateColor: (r: number) => string }) {
  if (data.length === 0) {
    return <EmptyState icon={Users} message="No lecturer data available." />;
  }

  return (
    <>
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Lecturer Effectiveness — Attendance Rate</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 100, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
            <Bar dataKey="avgAttendanceRate" radius={[0, 6, 6, 0]} barSize={20} isAnimationActive animationDuration={800} animationEasing="ease-out"
              label={<HorizontalBarLabel />}>
              {data.map((entry, i) => <Cell key={i} fill={getRateColor(entry.avgAttendanceRate)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                {['Lecturer', 'Department', 'Sessions', 'Students', 'Avg Rate', 'Feedback', 'Trend'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((lecturer) => (
                <tr key={lecturer.lecturerId} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{lecturer.name}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '13px', color: 'var(--text-secondary)' }}>{lecturer.department}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{lecturer.sessionCount}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{lecturer.totalStudents}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(lecturer.avgAttendanceRate), fontWeight: 500 }}>{lecturer.avgAttendanceRate}%</span>
                      <Sparkline data={lecturerRateHistory.get(lecturer.lecturerId) || [lecturer.avgAttendanceRate]} color={getRateColor(lecturer.avgAttendanceRate)} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold-primary)' }}>
                      <Star className="w-3.5 h-3.5" style={{ fill: 'var(--gold-primary)' }} />
                      {lecturer.avgFeedbackScore > 0 ? lecturer.avgFeedbackScore : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: lecturer.trend > 0 ? 'var(--success)' : lecturer.trend < 0 ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                      {lecturer.trend > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : lecturer.trend < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                      {lecturer.trend > 0 ? '+' : ''}{lecturer.trend}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Time Patterns Tab ────────────────────────────────────────────────────────

function TimeTab({ heatmap }: { heatmap: TimeHeatmapCell[] }) {
  if (heatmap.length === 0) {
    return <EmptyState icon={Clock} message="No time pattern data available." />;
  }

  const getRateColor = (rate: number) => {
    if (rate >= 75) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 6AM to 9PM
  const maxCount = Math.max(...heatmap.map(c => c.count), 1);

  const getCellColor = (count: number) => {
    if (count === 0) return 'var(--bg-elevated)';
    const intensity = count / maxCount;
    if (intensity > 0.7) return 'var(--gold-primary)';
    if (intensity > 0.4) return 'var(--gold-muted)';
    return 'var(--gold-subtle)';
  };

  const getCellTextColor = (count: number) => {
    if (count === 0) return 'var(--text-tertiary)';
    const intensity = count / maxCount;
    return intensity > 0.5 ? 'var(--text-inverse)' : 'var(--text-primary)';
  };

  // Day-of-week aggregated data
  const dayOfWeekData = DAY_LABELS.map((day, idx) => {
    const dayCells = heatmap.filter(c => c.day === idx);
    const totalSessions = dayCells.reduce((s, c) => s + c.count, 0);
    const avgRate = dayCells.length > 0 ? Math.round(dayCells.reduce((s, c) => s + (c.avgRate || 0), 0) / dayCells.length) : 0;
    return { day, sessions: totalSessions, avgRate };
  });

  return (
    <>
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Session Frequency Heatmap</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Number of sessions by day and hour. Darker = more sessions.</p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px', fontFamily: 'Outfit', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'left', minWidth: '50px' }}></th>
                {hours.map(h => (
                  <th key={h} style={{ padding: '4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)', textAlign: 'center', minWidth: '40px' }}>
                    {h.toString().padStart(2, '0')}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((day, dayIdx) => (
                <tr key={day}>
                  <td style={{ padding: '4px 8px', fontFamily: 'Outfit', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{day}</td>
                  {hours.map(hour => {
                    const cell = heatmap.find(c => c.day === dayIdx && c.hour === hour);
                    const count = cell?.count || 0;
                    return (
                      <td key={hour} style={{ padding: '2px' }}>
                        <div
                          style={{
                            width: '100%',
                            height: '32px',
                            borderRadius: 'var(--radius-sm)',
                            background: getCellColor(count),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '10px',
                            color: getCellTextColor(count),
                            cursor: count > 0 ? 'pointer' : 'default',
                          }}
                          title={count > 0 ? `${day} ${hour}:00 — ${count} sessions, avg ${cell?.avgRate || 0}%` : `${day} ${hour}:00 — No sessions`}
                        >
                          {count > 0 ? count : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day-of-week aggregated bar chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Sessions by Day of Week</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayOfWeekData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="dowBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="sessions" fill="url(#dowBarGrad)" radius={[6, 6, 0, 0]} barSize={28}
                isAnimationActive animationDuration={800} animationEasing="ease-out"
                label={<VerticalBarLabel />} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Attendance Rate by Day</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayOfWeekData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
              <Bar dataKey="avgRate" radius={[6, 6, 0, 0]} barSize={28} isAnimationActive animationDuration={800}
                label={<VerticalBarLabel unit="%" />}>
                {dayOfWeekData.map((entry, i) => <Cell key={i} fill={getRateColor(entry.avgRate)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hour distribution */}
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Sessions by Hour</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hours.map(h => {
            const count = heatmap.filter(c => c.hour === h).reduce((s, c) => s + c.count, 0);
            return { hour: `${h}:00`, count };
          })} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="hourBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--gold-primary)" stopOpacity={0.9} />
                <stop offset="100%" stopColor="var(--gold-primary)" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" fill="url(#hourBarGrad)" radius={[6, 6, 0, 0]} barSize={24}
              isAnimationActive animationDuration={800} animationEasing="ease-out"
              label={<VerticalBarLabel />} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

// ─── Departments Tab ──────────────────────────────────────────────────────────

function DepartmentsTab({ data, getRateColor }: { data: DepartmentStats[]; getRateColor: (r: number) => string }) {
  if (data.length === 0) {
    return <EmptyState icon={BookOpen} message="No department data available." />;
  }

  return (
    <>
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Attendance by Department</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 100, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="department" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} width={95} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
            <Bar dataKey="avgAttendanceRate" radius={[0, 6, 6, 0]} barSize={20} isAnimationActive animationDuration={800} animationEasing="ease-out"
              label={<HorizontalBarLabel />}>
              {data.map((entry, i) => <Cell key={i} fill={getRateColor(entry.avgAttendanceRate)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                {['Department', 'Students', 'Courses', 'Sessions', 'Avg Rate'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.department} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.department}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.totalStudents}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.courseCount}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.totalSessions}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(d.avgAttendanceRate), fontWeight: 500 }}>{d.avgAttendanceRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Correlations Tab ─────────────────────────────────────────────────────────

function CorrelationsTab({ data }: { data: FeedbackCorrelation[] }) {
  if (data.length === 0) {
    return <EmptyState icon={Activity} message="No correlation data. Need sessions with both attendance and feedback." />;
  }

  const scatterData = data.map(d => ({
    course: d.courseCode,
    attendance: d.avgAttendance,
    feedback: d.avgFeedback,
    sessions: d.sessionCount,
  }));

  return (
    <>
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Attendance vs Feedback Correlation</h2>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Each dot represents a course. Does higher attendance correlate with better feedback?</p>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
            <XAxis type="number" dataKey="attendance" name="Attendance" domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} label={{ value: 'Attendance Rate %', position: 'bottom', fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'Outfit', offset: -10 }} />
            <YAxis type="number" dataKey="feedback" name="Feedback" domain={[0, 5]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} label={{ value: 'Feedback Score', angle: -90, position: 'insideLeft', fill: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'Outfit', offset: 10 }} />
            <Tooltip content={<ChartTooltip />} />
            <Scatter data={scatterData} fill="var(--gold-primary)" shape={(props: any) => {
              const { cx, cy, payload } = props;
              return (
                <g>
                  <circle cx={cx} cy={cy} r={7} fill="var(--gold-primary)" fillOpacity={0.8} stroke="var(--bg-void)" strokeWidth={2} />
                  <text x={cx} y={cy - 12} textAnchor="middle" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '9px', fill: 'var(--text-tertiary)', fontWeight: 500 }}>
                    {payload.course}
                  </text>
                </g>
              );
            }} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                {['Course', 'Sessions', 'Attendance Rate', 'Feedback Score'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.courseCode} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.courseName || d.courseCode}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.sessionCount}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.avgAttendance}%</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold-primary)' }}>
                      <Star className="w-3.5 h-3.5" style={{ fill: 'var(--gold-primary)' }} />
                      {d.avgFeedback}/5
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Predictive Risk Tab ──────────────────────────────────────────────────────

function PredictiveTab({ data, riskTierDistribution, onSelect, onExportCSV }: { data: PredictiveRisk[]; riskTierDistribution: any[]; onSelect: (s: PredictiveRisk) => void; onExportCSV: (rows: any[], filename: string) => void }) {
  if (data.length === 0) {
    return <EmptyState icon={Brain} message="No predictive risk data. Need at least 2 sessions per student-course." />;
  }

  const highRisk = data.filter(r => r.riskLevel === 'high');
  const medRisk = data.filter(r => r.riskLevel === 'medium');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div style={{ background: 'var(--danger-bg)', border: '0.5px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--danger)' }}><CountUp value={highRisk.length} /></p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>High Risk</p>
        </div>
        <div style={{ background: 'var(--warning-bg)', border: '0.5px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--warning)' }}><CountUp value={medRisk.length} /></p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--warning)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Medium Risk</p>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)' }}><CountUp value={data.length} /></p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Total Flagged</p>
        </div>
        {riskTierDistribution.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '12px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>Risk Distribution</p>
            <div className="flex justify-center">
              <DonutChart data={riskTierDistribution} size={140} innerRadius={40} outerRadius={60} />
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Predictive Risk Forecast</h2>
          <button onClick={() => onExportCSV(data.map(d => ({ name: d.name, studentId: d.studentId, course: d.courseCode, currentRate: d.currentRate, projectedRate: d.projectedRate, riskLevel: d.riskLevel })), `KSAS_PredictiveRisk_${new Date().toISOString().split('T')[0]}.csv`)} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                {['Student', 'Course', 'Current', 'Projected', 'Risk', 'Sessions to 75%', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 100).map((r, i) => (
                <tr key={`${r.studentId}-${r.courseCode}-${i}`} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.courseCode}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.currentRate}%</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: r.projectedRate < 75 ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 500 }}>{r.projectedRate}%</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontFamily: 'Outfit', fontSize: '10px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: r.riskLevel === 'high' ? 'var(--danger-bg)' : r.riskLevel === 'medium' ? 'var(--warning-bg)' : 'var(--success-bg)',
                      color: r.riskLevel === 'high' ? 'var(--danger)' : r.riskLevel === 'medium' ? 'var(--warning)' : 'var(--success)',
                      border: `0.5px solid ${r.riskLevel === 'high' ? 'var(--danger)' : r.riskLevel === 'medium' ? 'var(--warning)' : 'var(--success)'}`,
                    }}>{r.riskLevel}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {r.sessionsToThreshold > 0 ? `~${r.sessionsToThreshold}` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button onClick={() => onSelect(r)} className="btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Cohort Tab ───────────────────────────────────────────────────────────────

function CohortTab({ data, getRateColor }: { data: CohortAnalytics[]; getRateColor: (r: number) => string }) {
  if (data.length === 0) {
    return <EmptyState icon={Users} message="No cohort data. Need enrollments with program field." />;
  }

  return (
    <>
      <div className="mb-6" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Attendance by Program</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 120, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="program" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'Outfit' }} tickLine={false} axisLine={false} width={115} />
            <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}%`} />} />
            <Bar dataKey="avgAttendanceRate" radius={[0, 6, 6, 0]} barSize={20} isAnimationActive animationDuration={800} animationEasing="ease-out"
              label={<HorizontalBarLabel />}>
              {data.map((entry, i) => <Cell key={i} fill={getRateColor(entry.avgAttendanceRate)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--bg-border)' }}>
                {['Program', 'Students', 'Sessions', 'Avg Rate'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'Outfit', fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.program} style={{ borderBottom: '0.5px solid var(--bg-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'Outfit', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{d.program}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.studentCount}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-primary)' }}>{d.sessionCount}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '14px', color: getRateColor(d.avgAttendanceRate), fontWeight: 500 }}>{d.avgAttendanceRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── Operations Tab ───────────────────────────────────────────────────────────

function OperationsTab({ data, geo }: { data: OperationalMetrics | null; geo: GeoCompliance | null }) {
  if (!data) {
    return <EmptyState icon={Zap} message="No operational data available." />;
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Sessions" value={String(data.totalSessions)} icon={Calendar} />
        <StatCard label="Avg Duration" value={`${data.avgSessionDurationMinutes}m`} icon={Clock} />
        <StatCard label="Peak Day" value={data.peakDay} icon={Calendar} />
        <StatCard label="Peak Hour" value={`${data.peakHour}:00`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Sessions Per Week</h2>
          {data.sessionsPerWeek.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.sessionsPerWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }}
                  tickFormatter={v => new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} />
                <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'Outfit' }} tickLine={false} axisLine={{ stroke: 'var(--bg-border)' }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke="var(--gold-primary)" fill="var(--gold-subtle)" strokeWidth={2} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0' }}>No weekly data.</p>
          )}
        </div>

        {geo && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Security Compliance</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>GPS Compliance</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold-primary)' }}>{geo.gpsComplianceRate}%</span>
                </div>
                <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${geo.gpsComplianceRate}%`, height: '100%', background: 'var(--gold-primary)', borderRadius: '9999px', transition: 'width 500ms ease' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{geo.gpsCheckins} of {geo.totalCheckins} check-ins</p>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>IP Compliance</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--gold-primary)' }}>{geo.ipComplianceRate}%</span>
                </div>
                <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${geo.ipComplianceRate}%`, height: '100%', background: 'var(--gold-muted)', borderRadius: '9999px', transition: 'width 500ms ease' }} />
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{geo.ipCheckins} of {geo.totalCheckins} check-ins</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Session Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 text-center" style={{ background: 'var(--success-bg)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--success)' }}>{data.closedSessions}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Completed</p>
          </div>
          <div className="p-4 text-center" style={{ background: 'var(--info-bg)', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, color: 'var(--info)' }}>{data.openSessions}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Active Now</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Anomalies Tab ────────────────────────────────────────────────────────────

function AnomaliesTab({ data }: { data: Anomaly[] }) {
  if (data.length === 0) {
    return <EmptyState icon={AlertTriangle} message="No anomalies detected. System is running normally." />;
  }

  const highAnomalies = data.filter(a => a.severity === 'high');
  const medAnomalies = data.filter(a => a.severity === 'medium');
  const lowAnomalies = data.filter(a => a.severity === 'low');

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'zero_attendance': return AlertTriangle;
      case 'sudden_drop': return TrendingDown;
      case 'high_late': return Clock;
      case 'device_reuse': return MapPin;
      case 'perfect_session': return Star;
      default: return Info;
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'high') return 'var(--danger)';
    if (severity === 'medium') return 'var(--warning)';
    return 'var(--success)';
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div style={{ background: 'var(--danger-bg)', border: '0.5px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--danger)' }}>{highAnomalies.length}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>High Severity</p>
        </div>
        <div style={{ background: 'var(--warning-bg)', border: '0.5px solid var(--warning)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--warning)' }}>{medAnomalies.length}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--warning)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Medium Severity</p>
        </div>
        <div style={{ background: 'var(--success-bg)', border: '0.5px solid var(--success)', borderRadius: 'var(--radius-lg)', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 500, color: 'var(--success)' }}>{lowAnomalies.length}</p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>Low Severity</p>
        </div>
      </div>

      <div className="space-y-3">
        {data.slice(0, 50).map((anomaly, i) => {
          const Icon = getSeverityIcon(anomaly.type);
          const color = getSeverityColor(anomaly.severity);
          return (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', borderLeft: `3px solid ${color}` }}>
              <div className="flex items-start gap-3">
                <div className="p-2 shrink-0" style={{ background: `${color}15`, borderRadius: 'var(--radius-md)' }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontFamily: 'Outfit', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{anomaly.description}</span>
                    <span style={{
                      fontFamily: 'Outfit', fontSize: '9px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                      background: `${color}15`, color, border: `0.5px solid ${color}`,
                    }}>{anomaly.severity}</span>
                  </div>
                  {anomaly.details && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{anomaly.details}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    {anomaly.courseCode && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{anomaly.courseCode}</span>}
                    {anomaly.date && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>{anomaly.date}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab({ data }: { data: GoalProgress | null }) {
  if (!data) {
    return <EmptyState icon={Target} message="No goal data available." />;
  }

  const circumference = 2 * Math.PI * 80;
  const offset = circumference - (data.percentage / 100) * circumference;

  return (
    <div className="max-w-xl mx-auto">
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '22px', color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '32px' }}>
          Institutional Attendance Goal
        </h2>

        {/* Circular Gauge */}
        <div className="relative mx-auto mb-8" style={{ width: '200px', height: '200px' }}>
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="100" cy="100" r="80" stroke="var(--bg-elevated)" strokeWidth="12" fill="transparent" />
            <circle
              cx="100" cy="100" r="80"
              stroke={data.percentage >= 100 ? 'var(--success)' : data.percentage >= 80 ? 'var(--gold-primary)' : 'var(--warning)'}
              strokeWidth="12" fill="transparent"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 800ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '36px', fontWeight: 500, color: 'var(--text-primary)' }}>{data.current}%</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>of {data.target}% target</span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {data.trend === 'improving' ? (
            <>
              <ArrowUpRight className="w-5 h-5" style={{ color: 'var(--success)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--success)', fontWeight: 500 }}>Trending upward</span>
            </>
          ) : data.trend === 'declining' ? (
            <>
              <ArrowDownRight className="w-5 h-5" style={{ color: 'var(--danger)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--danger)', fontWeight: 500 }}>Trending downward</span>
            </>
          ) : (
            <>
              <Minus className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>Stable</span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full" style={{ background: 'var(--bg-elevated)', borderRadius: '9999px', height: '12px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, data.percentage)}%`,
                height: '100%',
                background: data.percentage >= 100 ? 'var(--success)' : data.percentage >= 80 ? 'var(--gold-primary)' : 'var(--warning)',
                borderRadius: '9999px',
                transition: 'width 800ms ease',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>0%</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-tertiary)' }}>Target: {data.target}%</span>
          </div>
        </div>

        {data.percentage >= 100 ? (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--success)', fontWeight: 500 }}>
            Target achieved! Attendance goal has been met.
          </p>
        ) : (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {data.target - data.current > 0 ? `${data.target - data.current}% remaining to reach target.` : 'Target exceeded!'}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
      <Icon className="w-10 h-10 mx-auto mb-3" style={{ opacity: 0.5 }} />
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 400 }}>{message}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
      <div className="flex items-center justify-between">
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
        <Icon className="w-4 h-4" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', fontWeight: 500, marginTop: '4px', color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
