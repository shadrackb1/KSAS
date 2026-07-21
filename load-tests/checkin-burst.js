import http from 'http';
import { URL } from 'url';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>0'],
  },
};

const BASE_URL = __ENV.KSAS_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api';

const COURSES = [
  { code: 'CSC 101', name: 'Intro to Programming', group: 'A' },
  { code: 'CSC 201', name: 'Data Structures', group: 'B' },
  { code: 'CSC 301', name: 'Algorithms', group: 'A' },
  { code: 'CSC 401', name: 'Database Systems', group: 'B' },
  { code: 'CSC 501', name: 'Machine Learning', group: 'A' },
  { code: 'MAT 101', name: 'Calculus I', group: 'A' },
  { code: 'STA 201', name: 'Statistics', group: 'B' },
  { code: 'PHY 101', name: 'Physics I', group: 'A' },
  { code: 'BIO 201', name: 'Biology II', group: 'B' },
  { code: 'HIS 101', name: 'World History', group: 'A' },
];

const LECTURERS = [
  'Dr. Kamau', 'Dr. Mwangi', 'Dr. Ochieng', 'Dr. Wanjiku',
  'Dr. Kipchoge', 'Dr. Achieng', 'Prof. Njeri', 'Dr. Otieno',
];

const VENUES = [
  'Lecture Hall A', 'Lecture Hall B', 'Lab 201', 'Lab 301',
  'Auditorium', 'Room 104', 'Classroom C1', 'Classroom C2',
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const STATUSES = ['open', 'closed', 'open', 'open'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSessionId(prefix, index) {
  return `${prefix}-${Date.now().toString(36)}-${index.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateStudentId(group, index) {
  const regNo = `A${new Date().getFullYear()}${String(index).padStart(4, '0')}`;
  return regNo;
}

function generateDeviceHash() {
  return 'device_' + Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function generateGeoData() {
  return {
    lat: -0.0917 + (Math.random() - 0.5) * 0.04,
    lng: 37.0352 + (Math.random() - 0.5) * 0.04,
    accuracy: Math.floor(20 + Math.random() * 80),
  };
}

// Session pool - shared between VUs to simulate real concurrent usage
const sessionPool = new Map();

export function setup() {
  // Pre-generate sessions that will be used by all VUs
  const sessions = [];
  for (let i = 0; i < 20; i++) {
    const course = randomItem(COURSES);
    const sessionId = generateSessionId('sess', i);
    sessions.push({
      sessionId,
      courseCode: course.code,
      courseName: course.name,
      lecturer: randomItem(LECTURERS),
      venue: randomItem(VENUES),
      time: randomItem(TIME_SLOTS),
      status: randomItem(STATUSES),
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });
    sessionPool.set(sessionId, sessions[sessions.length - 1]);
  }
  return { sessions, sessionPool };
}

export default function(data) {
  const { sessions, sessionPool } = data;
  const vuId = __VU;
  const iteration = __ITER;

  // Each VU gets a consistent student identity
  const studentId = `A${new Date().getFullYear()}${String(vuId).padStart(4, '0')}`;
  const studentName = `Student ${vuId}`;
  const deviceHash = generateDeviceHash();

  // Pick a session to check into
  const sessionIndex = (vuId + iteration) % sessions.length;
  const session = sessions[sessionIndex];
  const { sessionId, courseCode } = session;

  // Simulate the check-in process
  const startTime = Date.now();

  // Step 1: Verify TOTP token
  const totpToken = '123456';
  const totpCheck = Date.now() - startTime;

  // Step 2: Check enrollment (simulated)
  const enrollmentCheck = Date.now() - startTime;

  // Step 3: Submit check-in
  const checkInPayload = {
    studentId,
    studentName,
    studentEmail: `student${vuId}@kabarak.ac.ke`,
    courseCode,
    sessionId,
    token: totpToken,
    deviceFingerprint: deviceHash,
    status: Math.random() > 0.2 ? 'present' : 'late',
    latitude: -0.0917 + (Math.random() - 0.5) * 0.02,
    longitude: 37.0352 + (Math.random() - 0.5) * 0.02,
  };

  // Make the actual HTTP request
  const url = new URL(BASE_URL);
  const path = `/api/checkin/${sessionId}`;

  const postData = JSON.stringify(checkInPayload);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 300;

        if (!success) {
          console.error(`Check-in failed for VU ${vuId}: ${res.statusCode} - ${data}`);
        }

        resolve({
          status: res.statusCode,
          duration,
          success,
          studentId,
          sessionId,
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      console.error(`Request error for VU ${vuId}: ${error.message}`);
      resolve({
        status: 0,
        duration,
        success: false,
        error: error.message,
        studentId,
        sessionId,
      });
    });

    req.write(postData);
    req.end();
  });
}

export function teardown(data) {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}