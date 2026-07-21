/**
 * src/lib/kabarakCourses.ts
 * Complete catalogue of courses offered at Kabarak University.
 * Organized by the 7 academic schools.
 *
 * Each course has:
 *  - code: e.g. "COMP 101"
 *  - name: full course title
 *  - department: department within the school
 *  - school: one of the 7 Kabarak schools
 *  - mode: 'physical' | 'online' | 'hybrid'
 *  - year: year of study (1–6)
 *  - semester: trimester (1, 2, 3)
 */

export interface KabarakCourse {
  code: string;
  name: string;
  department: string;
  school: string;
  mode: 'physical' | 'online' | 'hybrid';
  year?: number;
  semester?: number;
}

export const KABARAK_SCHOOLS = [
  'School of Engineering & Technology (SET)',
  'School of Business & Economics (SBE)',
  'School of Education, Humanities & Social Sciences (SEHSS)',
  'School of Music & Media (SMM)',
  'School of Pure & Applied Sciences (SPAS)',
  'School of Pharmacy & Health Sciences (SPHS)',
  'School of Law (SOL)',
] as const;

export const KABARAK_COURSES: KabarakCourse[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF ENGINEERING & TECHNOLOGY (SET)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Computer Science ──────────────────────────────────────────────────────
  { code: 'COMP 101', name: 'Introduction to Computer Science', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'COMP 102', name: 'Introduction to Programming', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 2 },
  { code: 'COMP 103', name: 'Discrete Mathematics', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 2 },
  { code: 'COMP 201', name: 'Data Structures & Algorithms', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 1 },
  { code: 'COMP 202', name: 'Object-Oriented Programming', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'COMP 203', name: 'Computer Architecture & Organisation', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'COMP 210', name: 'Database Management Systems', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'COMP 301', name: 'Operating Systems', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'COMP 302', name: 'Software Engineering', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'COMP 303', name: 'Computer Networks', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'COMP 304', name: 'Artificial Intelligence', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'COMP 305', name: 'Theory of Computation', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'COMP 310', name: 'Web Technologies', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'hybrid', year: 3, semester: 2 },
  { code: 'COMP 401', name: 'Machine Learning', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'COMP 402', name: 'Distributed Systems', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'COMP 403', name: 'Information Security', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 2 },
  { code: 'COMP 404', name: 'Cloud Computing', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'hybrid', year: 4, semester: 2 },
  { code: 'COMP 410', name: 'Final Year Project I', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },
  { code: 'COMP 411', name: 'Final Year Project II', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },
  { code: 'COMP 420', name: 'Industrial Attachment', department: 'Computer Science', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },

  // ── Information Technology ────────────────────────────────────────────────
  { code: 'ICT 101', name: 'Introduction to ICT', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'ICT 102', name: 'Introduction to Programming & Logic', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 2 },
  { code: 'ICT 201', name: 'Systems Analysis & Design', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 1 },
  { code: 'ICT 202', name: 'Database Administration', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'ICT 203', name: 'Computer Hardware & Networking', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'ICT 301', name: 'IT Project Management', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'ICT 302', name: 'Enterprise Systems', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'ICT 303', name: 'IT Governance & Ethics', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'online', year: 3, semester: 2 },
  { code: 'ICT 401', name: 'IT Strategy & Innovation', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'ICT 410', name: 'Final Year Project I', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },
  { code: 'ICT 411', name: 'Final Year Project II', department: 'Information Technology', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },

  // ── Electrical & Electronics Engineering ──────────────────────────────────
  { code: 'EEE 101', name: 'Introduction to Electrical Engineering', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'EEE 102', name: 'Engineering Mathematics I', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'EEE 103', name: 'Engineering Physics', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 2 },
  { code: 'EEE 201', name: 'Circuit Theory I', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 1 },
  { code: 'EEE 202', name: 'Electromagnetic Theory', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 1 },
  { code: 'EEE 203', name: 'Analogue Electronics', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'EEE 301', name: 'Digital Electronics', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'EEE 302', name: 'Signals & Systems', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'EEE 303', name: 'Power Systems I', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'EEE 304', name: 'Control Systems', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'EEE 401', name: 'Power Systems II', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'EEE 402', name: 'Communication Systems', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'EEE 410', name: 'Final Year Project I', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },
  { code: 'EEE 411', name: 'Final Year Project II', department: 'Electrical & Electronics Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },

  // ── Mechanical Engineering ────────────────────────────────────────────────
  { code: 'MEC 101', name: 'Introduction to Mechanical Engineering', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'MEC 102', name: 'Engineering Mathematics I', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 1, semester: 1 },
  { code: 'MEC 201', name: 'Engineering Mechanics', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 1 },
  { code: 'MEC 202', name: 'Thermodynamics I', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'MEC 203', name: 'Strength of Materials', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 2, semester: 2 },
  { code: 'MEC 301', name: 'Fluid Mechanics', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'MEC 302', name: 'Manufacturing Processes', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 1 },
  { code: 'MEC 303', name: 'Machine Design', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 3, semester: 2 },
  { code: 'MEC 401', name: 'Thermodynamics II', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 1 },
  { code: 'MEC 410', name: 'Final Year Project I', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },
  { code: 'MEC 411', name: 'Final Year Project II', department: 'Mechanical Engineering', school: 'School of Engineering & Technology (SET)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF BUSINESS & ECONOMICS (SBE)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Commerce / Business Administration ────────────────────────────────────
  { code: 'BCA 101', name: 'Introduction to Business', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'BCA 102', name: 'Principles of Management', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 2 },
  { code: 'BCA 201', name: 'Financial Accounting I', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'BCA 202', name: 'Business Law', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'BCA 203', name: 'Cost Accounting', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 2 },
  { code: 'BCA 204', name: 'Business Statistics', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 2 },
  { code: 'BCA 301', name: 'Financial Accounting II', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'BCA 302', name: 'Corporate Finance', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'BCA 303', name: 'Strategic Management', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'BCA 304', name: 'Marketing Management', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'BCA 401', name: 'Entrepreneurship', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'BCA 402', name: 'Business Research Methods', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'BCA 410', name: 'Final Year Project', department: 'Commerce', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ── Economics ─────────────────────────────────────────────────────────────
  { code: 'ECN 101', name: 'Principles of Microeconomics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'ECN 102', name: 'Principles of Macroeconomics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 2 },
  { code: 'ECN 201', name: 'Intermediate Microeconomics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'ECN 202', name: 'Intermediate Macroeconomics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 2 },
  { code: 'ECN 301', name: 'Econometrics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'ECN 302', name: 'Development Economics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'ECN 401', name: 'International Economics', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'ECN 410', name: 'Research Project', department: 'Economics', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ── Finance ───────────────────────────────────────────────────────────────
  { code: 'FIN 101', name: 'Introduction to Finance', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'FIN 201', name: 'Financial Markets & Institutions', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'FIN 301', name: 'Investment Analysis', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'FIN 302', name: 'Risk Management & Insurance', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'FIN 401', name: 'Banking & Financial Services', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'FIN 410', name: 'Research Project', department: 'Finance', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ── Human Resource Management ────────────────────────────────────────────
  { code: 'HRM 101', name: 'Introduction to Human Resource Management', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'HRM 201', name: 'Recruitment & Selection', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'HRM 202', name: 'Training & Development', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 2 },
  { code: 'HRM 301', name: 'Compensation & Benefits', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'HRM 302', name: 'Employee Relations', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'HRM 401', name: 'Strategic HRM', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'HRM 410', name: 'Research Project', department: 'Human Resource Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ── Hospitality & Tourism Management ──────────────────────────────────────
  { code: 'HTM 101', name: 'Introduction to Hospitality & Tourism', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'HTM 201', name: 'Food & Beverage Management', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'HTM 202', name: 'Tourism Planning & Development', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 2 },
  { code: 'HTM 301', name: 'Hotel Operations Management', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'HTM 302', name: 'Event Management', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'HTM 401', name: 'Hospitality Law & Ethics', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'HTM 410', name: 'Research Project', department: 'Hospitality & Tourism Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ── Supply Chain Management ───────────────────────────────────────────────
  { code: 'SCM 101', name: 'Introduction to Supply Chain Management', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 1, semester: 1 },
  { code: 'SCM 201', name: 'Procurement & Inventory Management', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 2, semester: 1 },
  { code: 'SCM 301', name: 'Logistics & Distribution', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 1 },
  { code: 'SCM 302', name: 'Operations Management', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 3, semester: 2 },
  { code: 'SCM 401', name: 'Global Supply Chain Strategy', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 1 },
  { code: 'SCM 410', name: 'Research Project', department: 'Supply Chain Management', school: 'School of Business & Economics (SBE)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF EDUCATION, HUMANITIES & SOCIAL SCIENCES (SEHSS)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Education ─────────────────────────────────────────────────────────────
  { code: 'EDU 101', name: 'Foundations of Education', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'EDU 102', name: 'Educational Psychology', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'EDU 201', name: 'Curriculum Design & Development', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'EDU 202', name: 'Teaching Methods & Strategies', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'EDU 301', name: 'Educational Research Methods', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'EDU 302', name: 'Classroom Management', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'EDU 401', name: 'Educational Leadership', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 4, semester: 1 },
  { code: 'EDU 410', name: 'Teaching Practice & Research Project', department: 'Education', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 4, semester: 3 },

  // ── Language & Literature ─────────────────────────────────────────────────
  { code: 'ELL 101', name: 'Introduction to Language & Literature', department: 'Language & Literature', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'ELL 201', name: 'African Literature', department: 'Language & Literature', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'ELL 202', name: 'English Grammar & Composition', department: 'Language & Literature', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'ELL 301', name: 'Literary Theory & Criticism', department: 'Language & Literature', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'ELL 410', name: 'Research Project', department: 'Language & Literature', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 4, semester: 3 },

  // ── Sociology ─────────────────────────────────────────────────────────────
  { code: 'SOC 101', name: 'Introduction to Sociology', department: 'Sociology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'SOC 201', name: 'Social Research Methods', department: 'Sociology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'SOC 301', name: 'Social Policy & Development', department: 'Sociology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'SOC 410', name: 'Research Project', department: 'Sociology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 4, semester: 3 },

  // ── Psychology ────────────────────────────────────────────────────────────
  { code: 'PSY 101', name: 'Introduction to Psychology', department: 'Psychology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'PSY 201', name: 'Developmental Psychology', department: 'Psychology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'PSY 301', name: 'Abnormal Psychology', department: 'Psychology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'PSY 410', name: 'Research Project', department: 'Psychology', school: 'School of Education, Humanities & Social Sciences (SEHSS)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF MUSIC & MEDIA (SMM)
  // ═══════════════════════════════════════════════════════════════════════════

  { code: 'MDA 101', name: 'Introduction to Media & Digital Arts', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 1, semester: 1 },
  { code: 'MDA 102', name: 'Introduction to Music', department: 'Music', school: 'School of Music & Media (SMM)', mode: 'physical', year: 1, semester: 1 },
  { code: 'MDA 201', name: 'Media Production', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 2, semester: 1 },
  { code: 'MDA 202', name: 'Broadcast Journalism', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 2, semester: 2 },
  { code: 'MDA 203', name: 'Audio Production & Sound Engineering', department: 'Music', school: 'School of Music & Media (SMM)', mode: 'physical', year: 2, semester: 2 },
  { code: 'MDA 301', name: 'Film & Video Production', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 3, semester: 1 },
  { code: 'MDA 302', name: 'Digital Media & Animation', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 3, semester: 2 },
  { code: 'MDA 303', name: 'Music Performance & Ensemble', department: 'Music', school: 'School of Music & Media (SMM)', mode: 'physical', year: 3, semester: 2 },
  { code: 'MDA 401', name: 'Media Ethics & Law', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 4, semester: 1 },
  { code: 'MDA 410', name: 'Final Year Project', department: 'Media Studies', school: 'School of Music & Media (SMM)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF PURE & APPLIED SCIENCES (SPAS)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Mathematics ───────────────────────────────────────────────────────────
  { code: 'MATH 101', name: 'Calculus I', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'MATH 102', name: 'Calculus II', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'MATH 201', name: 'Linear Algebra', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'MATH 202', name: 'Differential Equations', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'MATH 301', name: 'Real Analysis', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'MATH 302', name: 'Abstract Algebra', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'MATH 410', name: 'Research Project', department: 'Mathematics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 4, semester: 3 },

  // ── Physics ───────────────────────────────────────────────────────────────
  { code: 'PHY 101', name: 'General Physics I', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'PHY 102', name: 'General Physics II', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'PHY 201', name: 'Mechanics & Waves', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'PHY 202', name: 'Electromagnetism', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'PHY 301', name: 'Quantum Mechanics', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'PHY 410', name: 'Research Project', department: 'Physics', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 4, semester: 3 },

  // ── Chemistry ─────────────────────────────────────────────────────────────
  { code: 'CHM 101', name: 'General Chemistry I', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'CHM 102', name: 'General Chemistry II', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'CHM 201', name: 'Organic Chemistry I', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'CHM 202', name: 'Inorganic Chemistry', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'CHM 301', name: 'Physical Chemistry', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'CHM 302', name: 'Analytical Chemistry', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'CHM 410', name: 'Research Project', department: 'Chemistry', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 4, semester: 3 },

  // ── Biological Sciences ───────────────────────────────────────────────────
  { code: 'BIO 101', name: 'General Biology I', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'BIO 102', name: 'General Biology II', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'BIO 201', name: 'Cell Biology', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'BIO 202', name: 'Genetics', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'BIO 301', name: 'Ecology & Environment', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'BIO 302', name: 'Microbiology', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'BIO 410', name: 'Research Project', department: 'Biological Sciences', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 4, semester: 3 },

  // ── Agriculture ───────────────────────────────────────────────────────────
  { code: 'AGR 101', name: 'Introduction to Agriculture', department: 'Agriculture', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'AGR 201', name: 'Crop Science', department: 'Agriculture', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'AGR 202', name: 'Animal Science', department: 'Agriculture', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'AGR 301', name: 'Agricultural Economics', department: 'Agriculture', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'AGR 410', name: 'Research Project', department: 'Agriculture', school: 'School of Pure & Applied Sciences (SPAS)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF PHARMACY & HEALTH SCIENCES (SPHS)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Pharmacy ──────────────────────────────────────────────────────────────
  { code: 'PHR 101', name: 'Introduction to Pharmacy', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'PHR 102', name: 'Pharmaceutical Chemistry I', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 1, semester: 2 },
  { code: 'PHR 201', name: 'Pharmacology I', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'PHR 202', name: 'Pharmaceutics I', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'PHR 301', name: 'Pharmacology II', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'PHR 302', name: 'Pharmaceutical Chemistry II', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'PHR 401', name: 'Clinical Pharmacy', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 1 },
  { code: 'PHR 402', name: 'Drug Information & Therapeutics', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 2 },
  { code: 'PHR 501', name: 'Hospital Pharmacy Practice', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 5, semester: 1 },
  { code: 'PHR 510', name: 'Research Project', department: 'Pharmacy', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 5, semester: 3 },

  // ── Nursing ───────────────────────────────────────────────────────────────
  { code: 'NSG 101', name: 'Introduction to Nursing', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'NSG 102', name: 'Anatomy & Physiology I', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'NSG 201', name: 'Fundamentals of Nursing', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'NSG 202', name: 'Medical-Surgical Nursing I', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 2, semester: 2 },
  { code: 'NSG 301', name: 'Community Health Nursing', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'NSG 302', name: 'Maternal & Child Health', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'NSG 401', name: 'Psychiatric Nursing', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 1 },
  { code: 'NSG 410', name: 'Research Project & Clinical Placement', department: 'Nursing', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 3 },

  // ── Public Health ─────────────────────────────────────────────────────────
  { code: 'PUB 101', name: 'Introduction to Public Health', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 1, semester: 1 },
  { code: 'PUB 201', name: 'Epidemiology & Biostatistics', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 2, semester: 1 },
  { code: 'PUB 301', name: 'Environmental Health', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 1 },
  { code: 'PUB 302', name: 'Health Policy & Management', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 3, semester: 2 },
  { code: 'PUB 401', name: 'Health Promotion & Education', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 1 },
  { code: 'PUB 410', name: 'Research Project', department: 'Public Health', school: 'School of Pharmacy & Health Sciences (SPHS)', mode: 'physical', year: 4, semester: 3 },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SCHOOL OF LAW (SOL)
  // ═══════════════════════════════════════════════════════════════════════════

  { code: 'LAW 101', name: 'Introduction to Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 1, semester: 1 },
  { code: 'LAW 102', name: 'Legal System & Method', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 1, semester: 1 },
  { code: 'LAW 103', name: 'Constitutional Law I', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 1, semester: 2 },
  { code: 'LAW 201', name: 'Law of Contract', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 2, semester: 1 },
  { code: 'LAW 202', name: 'Criminal Law I', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 2, semester: 1 },
  { code: 'LAW 203', name: 'Constitutional Law II', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 2, semester: 2 },
  { code: 'LAW 204', name: 'Tort Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 2, semester: 2 },
  { code: 'LAW 301', name: 'Land Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 3, semester: 1 },
  { code: 'LAW 302', name: 'Criminal Law II', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 3, semester: 1 },
  { code: 'LAW 303', name: 'Commercial Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 3, semester: 2 },
  { code: 'LAW 304', name: 'Family Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 3, semester: 2 },
  { code: 'LAW 401', name: 'Administrative Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 4, semester: 1 },
  { code: 'LAW 402', name: 'International Law', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 4, semester: 1 },
  { code: 'LAW 403', name: 'Law of Evidence', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 4, semester: 2 },
  { code: 'LAW 404', name: 'Legal Ethics & Professional Practice', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 4, semester: 2 },
  { code: 'LAW 410', name: 'Research Project', department: 'Law', school: 'School of Law (SOL)', mode: 'physical', year: 4, semester: 3 },
];
