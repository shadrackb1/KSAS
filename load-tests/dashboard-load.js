import http from 'http';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>10'],
  },
};

const BASE_URL = __ENV.KSAS_BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api';

const FIRESTORE_PROJECT = __ENV.FIRESTORE_PROJECT_ID || 'gen-lang-client-0420782130';

const ROLES = ['student', 'lecturer', 'admin', 'hod', 'dean'];
const CAMPUSES = ['Main Campus', 'Town Campus', 'Health Sciences Campus'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genUserId(role, idx) {
  const prefix = role === 'student' ? 'stu' : role === 'lecturer' ? 'lec' : role;
  return `${prefix}_${new Date().getFullYear()}_${String(idx).padStart(4, '0')}`;
}

function genSessionId(idx) {
  return `dash_test_sess_${idx.toString(36)}_${Date.now().toString(36)}`;
}

function buildUserProfile(role, index) {
  const coursePool = ['CSC 101', 'CSC 201', 'CSC 301', 'MAT 101', 'STA 201', 'PHY 101'];
  const sessionCount = role === 'student' ? 3 : role === 'lecturer' ? 5 : 10;
  const sessions = [];
  for (let j = 0; j < sessionCount; j++) {
    sessions.push(genSessionId(index * sessionCount + j));
  }

  return {
    userId: genUserId(role, index),
    role,
    campus: randomItem(CAMPUSES),
    email: `${role}.${index}@kabarak.ac.ke`,
    courses: coursePool.slice(0, Math.floor(2 + Math.random() * 4)),
    sessions,
  };
}

const TOTAL_USERS = 2000;
const userPool = {};

for (const role of ROLES) {
  userPool[role] = [];
  for (let i = 0; i < Math.floor(TOTAL_USERS / ROLES.length); i++) {
    userPool[role].push({
      profile: buildUserProfile(role, i),
      token: `sim_jwt_${role}_${i}_${Date.now().toString(36)}`,
    });
  }
}

export function setup() {
  const total = Object.values(userPool).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`[setup] Dashboard load test initialized with ${total} user profiles`);

  return {
    baseUrl: BASE_URL,
    apiPrefix: API_PREFIX,
    firestoreProject: FIRESTORE_PROJECT,
    users: userPool,
  };
}

export const dashboardLoad = {
  executor: 'constant-vus',
  vus: 2000,
  duration: '60s',
  exec: 'loadDashboard',
};

export const mixedReadPattern = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '60s', target: 2000 },
    { duration: '30s', target: 2000 },
    { duration: '30s', target: 0 },
  ],
  exec: 'execMixedReadPattern',
};

export const optionsCombined = {
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
  },
  scenarios: {
    dashboard: dashboardLoad,
    mixed: mixedReadPattern,
  },
};

export function loadDashboard(data) {
  const ctx = data;
  const role = randomItem(ROLES);
  const users = ctx.users[role];
  const user = randomItem(users);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
    'X-User-Role': role,
    'X-User-Id': user.profile.userId,
    'X-Campus': user.profile.campus,
  };

  http.get(`${ctx.baseUrl}/dashboard`, {
    tags: { name: 'DashboardHome' },
    headers,
  });

  const sessUrl = `https://firestore.googleapis.com/v1/projects/${ctx.firestoreProject}/databases/(default)/documents/sessions`;
  http.get(sessUrl, {
    tags: { name: 'FirebaseSessionsList' },
    headers,
  });

  const attUrl = `https://firestore.googleapis.com/v1/projects/${ctx.firestoreProject}/databases/(default)/documents/attendance_summary`;
  http.get(attUrl, {
    tags: { name: 'FirebaseAttendanceSummary' },
    headers,
  });
}

export function execMixedReadPattern(data) {
  const ctx = data;
  const role = randomItem(ROLES);
  const users = ctx.users[role];
  const user = randomItem(users);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`,
    'X-User-Role': role,
  };

  const roll = Math.random();

  const fbHeaders = {
    ...headers,
    Authorization: `Bearer ${__ENV.SERVICE_ACCOUNT_TOKEN || 'test_token'}`,
  };

  function firestoreUrl(collection, documentId) {
    const path = documentId
      ? `databases/(default)/documents/${collection}/${documentId}`
      : `databases/(default)/documents/${collection}`;
    return `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/${path}`;
  }

  if (roll < 0.4) {
    const pageSize = Math.max(10, Math.min(100, Math.floor(Math.random() * 50) + 10));
    const q = encodeURIComponent(JSON.stringify({
      from: ['sessions'],
      where: [
        { fieldPath: 'campus', opString: 'EQUAL', value: { stringValue: user.profile.campus } },
      ],
      orderBy: [{ fieldPath: 'createdAt', direction: 'DESCENDING' }],
      limit: { integerValue: pageSize },
    }));
    const url = `https://firestore.googleapis.com/v1/projects/${ctx.firestoreProject}/databases/(default)/documents:runQuery?q=${q}`;
    http.post(url, JSON.stringify({}), {
      tags: { name: 'FirebaseRunQuerySessions' },
      headers: fbHeaders,
    });
  } else if (roll < 0.7) {
    const sessionId = randomItem(user.profile.sessions);
    const attUrl = firestoreUrl(`sessions/${sessionId}/attendance`);
    http.get(attUrl, {
      tags: { name: 'FirebaseAttendanceRead' },
      headers: fbHeaders,
    });
  } else if (roll < 0.85) {
    const coursesUrl = firestoreUrl('courses');
    http.get(coursesUrl, {
      tags: { name: 'FirebaseCoursesRead' },
      headers: fbHeaders,
    });
  } else if (roll < 0.95) {
    const sessionId = randomItem(user.profile.sessions);
    const sessUrl = firestoreUrl('sessions', sessionId);
    http.patch(sessUrl, JSON.stringify({
      fields: {
        lastAccessedAt: { timestampValue: new Date().toISOString() },
      },
    }), {
      tags: { name: 'FirebaseSessionWrite' },
      headers: fbHeaders,
    });
  } else {
    const auditUrl = firestoreUrl('audit_logs');
    http.post(auditUrl, JSON.stringify({
      fields: {
        userId: { stringValue: user.profile.userId },
        actionType: { stringValue: 'dashboard_view' },
        timestamp: { timestampValue: new Date().toISOString() },
        ipAddress: { stringValue: 'simulated' },
      },
    }), {
      tags: { name: 'FirebaseAuditWrite' },
      headers: fbHeaders,
    });
  }
}
