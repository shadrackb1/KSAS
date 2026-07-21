// src/lib/csvExport.ts

export interface AttendanceCsvRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  regNumber: string;
  status: string;
  date: string;
  timeIn: string;
  courseCode: string;
  courseName: string;
  room: string;
  lecturerName: string;
  topicOfDay: string;
  deviceFingerprint: string;
}

export function formatTimeIn(timestamp: any): string {
  if (!timestamp) return '—';

  try {
    const date =
      typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

export function formatDateExact(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeExact(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${min}:${s}`;
}

export function formatTimestampExact(timestamp: any): { date: string; time: string } {
  if (!timestamp) return { date: '—', time: '—' };
  try {
    const date =
      typeof timestamp?.toDate === 'function'
        ? timestamp.toDate()
        : new Date(timestamp);
    return { date: formatDateExact(date), time: formatTimeExact(date) };
  } catch {
    return { date: '—', time: '—' };
  }
}

export function buildAttendanceCsv(
  rows: AttendanceCsvRow[]
): string {
  const headers = [
    'Student ID',
    'Full Name',
    'Email',
    'Reg Number',
    'Status',
    'Date',
    'Time In',
    'Course Code',
    'Course Name',
    'Room / Venue',
    'Lecturer',
    'Topic of Day',
    'Device Fingerprint',
  ];

  const escape = (value: unknown) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const csvRows = rows.map((row) =>
    [
      row.studentId,
      row.studentName,
      row.studentEmail,
      row.regNumber,
      row.status,
      row.date,
      row.timeIn,
      row.courseCode,
      row.courseName,
      row.room,
      row.lecturerName,
      row.topicOfDay,
      row.deviceFingerprint,
    ]
      .map(escape)
      .join(',')
  );

  return [headers.map(escape).join(','), ...csvRows].join('\n');
}

export function downloadCsv(
  filename: string,
  csvContent: string
): void {
  const isMobileShareSupported =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof File !== 'undefined';

  if (isMobileShareSupported) {
    const file = new File(
      [csvContent] as BlobPart[],
      filename,
      { type: 'text/csv;charset=utf-8;' }
    );
    if (
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      navigator
        .share({ files: [file], title: filename })
        .catch(() => {
          const url = URL.createObjectURL(file);
          window.open(url, '_blank');
        });
      return;
    }
  }

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportSessionCSV(session: any, attendanceRecords: any[]): void {
  const rows: AttendanceCsvRow[] = attendanceRecords.map((r: any) => {
    const ts = formatTimestampExact(r.timestamp);
    return {
      studentId: r.studentId || '',
      studentName: r.studentName || '',
      studentEmail: r.studentEmail || '',
      regNumber: r.studentId || '',
      status: r.status || 'present',
      date: ts.date,
      timeIn: ts.time,
      courseCode: session.courseCode || '',
      courseName: session.courseName || '',
      room: session.room || '',
      lecturerName: session.lecturerName || '',
      topicOfDay: session.topicOfDay || '',
      deviceFingerprint: r.deviceFingerprint || '',
    };
  });

  const csv = buildAttendanceCsv(rows);

  const safeCourse = (session.courseName || 'session').replace(/[^a-zA-Z0-9]/g, '_');
  const safeDate = (session.date || formatDateExact(new Date()));
  const sessionId = (session.id || '').slice(0, 8);
  const filename = `KSAS_${safeCourse}_${safeDate}_${sessionId}.csv`;

  downloadCsv(filename, csv);
}
