import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Check, Eye, EyeOff, RefreshCw, Shield, User, Mail, Hash, BookOpen, Building, Calendar, Key, AlertTriangle } from 'lucide-react';
import { hashPassword } from '../../lib/auth';
import { db, doc, setDoc, collection, query, where, getDocs } from '../../lib/firebase';
import { collections } from '../../lib/db';

const INTAKE_OPTIONS = ['January 2025', 'May 2025', 'September 2025', 'January 2026', 'May 2026', 'September 2026'];
import { uploadJSONToCloudinary } from '../../lib/cloudinary';
import { parseRegistrationNumber } from '../../lib/regNumberParser';
import { getSchoolName } from '../../lib/schoolCodes';

type UserRole = 'student' | 'lecturer' | 'admin' | 'hod' | 'dean' | 'associate-dean' | 'tvet';

interface UserForm {
  name: string;
  email: string;
  uid: string;
  role: UserRole;
  status: 'active' | 'inactive';
  course: string;
  year: string;
  department: string;
  faculty: string;
  intake: string;
  password: string;
  confirmPassword: string;
}

const INITIAL_FORM: UserForm = {
  name: '',
  email: '',
  uid: '',
  role: 'student',
  status: 'active',
  course: '',
  year: '',
  department: '',
  faculty: '',
  intake: '',
  password: '',
  confirmPassword: '',
};

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+'];

export default function CreateUser() {
  const navigate = useNavigate();
  const [form, setForm] = useState<UserForm>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errors, setErrors] = useState<Partial<Record<keyof UserForm, string>>>({});
  const [derivedSchoolCode, setDerivedSchoolCode] = useState('');
  const [derivedSchoolName, setDerivedSchoolName] = useState('');
  const [schoolConflict, setSchoolConflict] = useState(false);
  const [departmentTouched, setDepartmentTouched] = useState(false);

  const update = (field: keyof UserForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
    if (field === 'department') setDepartmentTouched(true);
  };

  // Auto-derive schoolCode from registration number
  useEffect(() => {
    if (form.role !== 'student' || !form.uid.trim()) {
      setDerivedSchoolCode('');
      setDerivedSchoolName('');
      setSchoolConflict(false);
      return;
    }
    const parsed = parseRegistrationNumber(form.uid);
    if (!parsed) {
      setDerivedSchoolCode('');
      setDerivedSchoolName('');
      setSchoolConflict(false);
      return;
    }
    setDerivedSchoolCode(parsed.schoolCode);
    getSchoolName(parsed.schoolCode).then(name => {
      setDerivedSchoolName(name || '');
      if (name && !departmentTouched) {
        setForm(prev => ({ ...prev, department: name }));
      }
      if (name && departmentTouched && form.department && form.department !== name) {
        setSchoolConflict(true);
      } else {
        setSchoolConflict(false);
      }
    }).catch(() => {
      setDerivedSchoolName('');
      setSchoolConflict(false);
    });
  }, [form.uid, form.role]);

  const validateStep1 = (): boolean => {
    const errs: Partial<Record<keyof UserForm, string>> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.uid.trim()) errs.uid = 'ID / Registration number is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Partial<Record<keyof UserForm, string>> = {};
    if (form.password && form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password && form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAutoGenerate = () => {
    const pw = generatePassword();
    setForm(prev => ({ ...prev, password: pw, confirmPassword: pw }));
  };

  const validateStep2 = (): boolean => {
    const errs: Partial<Record<keyof UserForm, string>> = {};
    if (form.role === 'lecturer' || form.role === 'hod') {
      if (!form.department.trim()) errs.department = 'Department is required for this role';
    }
    if (form.role === 'dean' || form.role === 'associate-dean') {
      if (!form.faculty.trim()) errs.faculty = 'Faculty is required for this role';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!validateStep1() || !validateStep2() || !validateStep3()) {
      toast.error('Please fix the highlighted errors before submitting.');
      return;
    }

    setSaving(true);
    try {
      const plainPw = form.password || generatePassword();
      const hashedPw = hashPassword(plainPw);

  const userObj = {
  uid: form.uid.trim(),
  name: form.name.trim(),
  email: form.email.toLowerCase().trim(),
  password: hashedPw,
  role: form.role,
  status: form.status,
  course: form.role === 'student' ? form.course.trim() || undefined : undefined,
  year: form.role === 'student' ? form.year.trim() || undefined : undefined,
  department: form.department.trim() || undefined,
  schoolCode: form.role === 'student' && derivedSchoolCode ? derivedSchoolCode : undefined,
  faculty: (form.role === 'dean' || form.role === 'associate-dean') ? form.faculty.trim() || undefined : undefined,
  intake: form.role === 'student' && form.intake ? form.intake : undefined,
  createdAt: new Date().toISOString(),
};

      const existingQuery = query(collection(db, collections.USERS), where('email', '==', userObj.email));
      const existingSnap = await getDocs(existingQuery);
      if (!existingSnap.empty) throw new Error('A user with this email already exists.');

      const docId = form.uid.toLowerCase().replace(/[^a-z0-9]/g, '');
      await setDoc(doc(db, collections.USERS, docId), userObj, { merge: true });

      let cloudinaryUsers: any[] = [];
      try {
        const { fetchJSONFromCloudinary } = await import('../../lib/cloudinary');
        cloudinaryUsers = (await fetchJSONFromCloudinary('users.json') as any[]) || [];
      } catch {}
      cloudinaryUsers = [...cloudinaryUsers.filter((u: any) => u.uid !== userObj.uid), userObj];
      await uploadJSONToCloudinary('users.json', cloudinaryUsers);

      toast.success(`${userObj.name} created successfully.`);
      navigate('/admin/users');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = form.name && form.email && form.uid;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 animate-page-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/admin/users')} className="btn-icon">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-headline-lg text-primary">Create User Account</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Manually register a student, lecturer, administrator, or oversight role.</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${s < step ? 'text-success' : s === step ? 'text-primary' : 'text-outline'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                s < step ? 'bg-success border-success text-white' :
                s === step ? 'border-primary text-primary' :
                'border-outline text-outline'
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className="text-xs font-semibold hidden sm:inline uppercase tracking-wider">
                {s === 1 ? 'Account' : s === 2 ? 'Academic' : 'Security'}
              </span>
            </div>
            {s < 3 && <div className={`flex-1 h-0.5 ${s < step ? 'bg-success' : 'bg-outline/30'}`} />}
          </React.Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Account Information */}
        {step === 1 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm p-6 md:p-8 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-title-lg text-primary">Account Information</h2>
                <p className="text-xs text-on-surface-variant">Basic login credentials and identity.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group md:col-span-2">
                <label className="form-label" htmlFor="name">Full Name <span className="text-danger">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    id="name"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="e.g. Jane Mwangi"
                    className={`input-with-icon-l ${errors.name ? 'border-danger' : ''}`}
                  />
                </div>
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label" htmlFor="email">Email Address <span className="text-danger">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="e.g. jane@kabarak.ac.ke"
                    className={`input-with-icon-l ${errors.email ? 'border-danger' : ''}`}
                  />
                </div>
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="uid">ID / Registration Number <span className="text-danger">*</span></label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    id="uid"
                    value={form.uid}
                    onChange={e => update('uid', e.target.value)}
                    placeholder="e.g. KAB/101/2023"
                    className={`input-with-icon-l ${errors.uid ? 'border-danger' : ''}`}
                  />
                </div>
                {errors.uid && <p className="form-error">{errors.uid}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role">Role <span className="text-danger">*</span></label>
                <select
                  id="role"
                  value={form.role}
                  onChange={e => update('role', e.target.value)}
                  className="input-base cursor-pointer"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Administrator</option>
                  <option value="hod">Head of Department (HOD)</option>
                  <option value="dean">Dean</option>
                  <option value="associate-dean">Associate Dean</option>
  <option value="tvet">TVET Student</option>
                </select>
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Account Status</label>
                <div className="flex gap-4">
                  {(['active', 'inactive'] as const).map(s => (
                    <label key={s} className={`flex items-center gap-3 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all flex-1 ${
                      form.status === s
                        ? s === 'active'
                          ? 'border-success bg-success-bg'
                          : 'border-danger bg-danger-bg'
                        : 'border-outline-variant bg-transparent'
                    }`}>
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={e => update('status', e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        form.status === s
                          ? s === 'active' ? 'border-success' : 'border-danger'
                          : 'border-outline'
                      }`}>
                        {form.status === s && <div className={`w-2 h-2 rounded-full ${s === 'active' ? 'bg-success' : 'bg-danger'}`} />}
                      </div>
                      <span className={`text-sm font-semibold capitalize ${form.status === s ? (s === 'active' ? 'text-success' : 'text-danger') : 'text-on-surface-variant'}`}>
                        {s}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="form-hint">Inactive users cannot log in until reactivated.</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-outline-variant/20">
              <button type="button" onClick={() => canProceed ? setStep(2) : toast.error('Please fill in all required fields.')} className="btn-primary px-8">
                Next — Academic Info
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Academic Information */}
        {step === 2 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm p-6 md:p-8 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-title-lg text-primary">Academic Information</h2>
                <p className="text-xs text-on-surface-variant">{form.role === 'student' ? 'Course enrollment details.' : form.role === 'dean' || form.role === 'associate-dean' ? 'Faculty affiliation.' : form.role === 'admin' ? 'Optional department affiliation.' : 'Department affiliation.'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {form.role === 'student' && (
                <>
                  <div className="form-group md:col-span-2">
                    <label className="form-label" htmlFor="course">Course / Programme</label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input
                        id="course"
                        value={form.course}
                        onChange={e => update('course', e.target.value)}
                        placeholder="e.g. BSc. Computer Science"
                        className="input-with-icon-l"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="year">Year of Study</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <select
                        id="year"
                        value={form.year}
                        onChange={e => update('year', e.target.value)}
                        className="input-with-icon-l cursor-pointer appearance-none"
                      >
                        <option value="">Select year</option>
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
      </div>
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor="intake">Intake</label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
        <select
          id="intake"
          value={form.intake}
          onChange={e => update('intake', e.target.value)}
          className="input-with-icon-l cursor-pointer appearance-none"
        >
          <option value="">Select intake</option>
          {INTAKE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor="dept-student">Department</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                      <input
                        id="dept-student"
                        value={form.department}
                        onChange={e => update('department', e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="input-with-icon-l"
                      />
                    </div>
                    {derivedSchoolCode && derivedSchoolName && !departmentTouched && (
                      <p className="form-hint" style={{ color: 'var(--success)' }}>
                        Auto-filled from reg number prefix "{derivedSchoolCode}" → {derivedSchoolName}
                      </p>
                    )}
                    {schoolConflict && (
                      <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--warning)' }}>
                          This registration number suggests <strong>{derivedSchoolName}</strong> ({derivedSchoolCode}), but you've selected "{form.department}". Continue anyway?
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(form.role === 'lecturer' || form.role === 'hod') && (
                <div className="form-group md:col-span-2">
                  <label className="form-label" htmlFor="dept">Department</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      id="dept"
                      value={form.department}
                      onChange={e => update('department', e.target.value)}
                      placeholder={form.role === 'hod' ? 'e.g. Computer Science Department' : 'e.g. Computer Science'}
                      className="input-with-icon-l"
                    />
                  </div>
                </div>
              )}

              {(form.role === 'dean' || form.role === 'associate-dean') && (
                <div className="form-group md:col-span-2">
                  <label className="form-label" htmlFor="faculty">Faculty / School</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      id="faculty"
                      value={form.faculty}
                      onChange={e => update('faculty', e.target.value)}
                      placeholder={form.role === 'dean' ? 'e.g. School of Computing & Informatics' : 'e.g. School of Business & Economics'}
                      className="input-with-icon-l"
                    />
                  </div>
                </div>
              )}

              {form.role === 'admin' && (
                <div className="form-group md:col-span-2">
                  <label className="form-label" htmlFor="dept-admin">Department / Directorate <span className="font-normal normal-case text-on-surface-variant">(optional)</span></label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      id="dept-admin"
                      value={form.department}
                      onChange={e => update('department', e.target.value)}
                      placeholder="e.g. ICT Directorate"
                      className="input-with-icon-l"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-outline-variant/20">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost px-6">Back</button>
              <button type="button" onClick={() => setStep(3)} className="btn-primary px-8">
                Next — Security
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Security */}
        {step === 3 && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm p-6 md:p-8 space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary-container text-primary flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-title-lg text-primary">Security</h2>
                <p className="text-xs text-on-surface-variant">Set an initial password or auto-generate one.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password
                  <span className="font-normal normal-case text-on-surface-variant ml-1">(optional)</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className={`input-with-icon-l pr-20 ${errors.password ? 'border-danger' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-9 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-outline hover:text-primary transition-colors"
                    title="Auto-generate password"
                    tabIndex={-1}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => update('confirmPassword', e.target.value)}
                    placeholder="Re-enter password"
                    className={`input-with-icon-l pr-10 ${errors.confirmPassword ? 'border-danger' : ''}`}
                    disabled={!form.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
                {!form.password && <p className="form-hint">A secure password will be auto-generated if left blank.</p>}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-bg-elevated rounded-xl p-5 border border-outline-variant/20 space-y-3">
              <p className="font-label-md text-on-surface-variant">Summary</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-on-surface-variant">Name:</span> <span className="font-medium text-primary">{form.name}</span></div>
                <div><span className="text-on-surface-variant">Email:</span> <span className="font-medium">{form.email}</span></div>
                <div><span className="text-on-surface-variant">ID:</span> <span className="font-mono text-xs">{form.uid}</span></div>
                <div><span className="text-on-surface-variant">Role:</span> <span className="font-medium capitalize">{form.role}</span></div>
                {form.role === 'student' && form.course && <div className="col-span-2"><span className="text-on-surface-variant">Course:</span> <span className="font-medium">{form.course}</span></div>}
                {form.role === 'student' && form.year && <div><span className="text-on-surface-variant">Year:</span> <span className="font-medium">{form.year}</span></div>}
                {form.department && <div><span className="text-on-surface-variant">Department:</span> <span className="font-medium">{form.department}</span></div>}
                {form.role === 'student' && derivedSchoolCode && <div><span className="text-on-surface-variant">School Code:</span> <span className="font-mono text-xs">{derivedSchoolCode}</span></div>}
                {form.faculty && <div><span className="text-on-surface-variant">Faculty:</span> <span className="font-medium">{form.faculty}</span></div>}
                <div><span className="text-on-surface-variant">Status:</span> <span className={`font-medium capitalize ${form.status === 'active' ? 'text-success' : 'text-danger'}`}>{form.status}</span></div>
                <div><span className="text-on-surface-variant">Password:</span> <span className="font-mono text-xs">{form.password ? '••••••••' : 'Auto-generated'}</span></div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-outline-variant/20">
              <button type="button" onClick={() => setStep(2)} className="btn-ghost px-6">Back</button>
              <button type="submit" disabled={saving} className="btn-primary px-8 h-12 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
