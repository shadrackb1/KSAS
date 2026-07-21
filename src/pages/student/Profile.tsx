import React, { useState } from 'react';
import {
  LogOut, Moon, Bell, Globe, HelpCircle, AlertOctagon,
  ChevronRight, Save, Lock, Eye, EyeOff, User, Mail,
  CheckCircle, X, ShieldCheck, Camera, Edit3, Volume2, Loader2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { isSoundEnabled, setSoundEnabled } from '../../lib/gamification-feedback';

type Tab = 'profile' | 'security' | 'preferences';

export default function Profile() {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile state
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password state
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const ROLE_LABELS: Record<string, string> = { student: 'Student', lecturer: 'Lecturer', admin: 'Administrator', hod: 'HOD', dean: 'Dean', 'associate-dean': 'Associate Dean' };

  const pwStrength = newPw.length === 0 ? 0 : newPw.length < 6 ? 1 : newPw.length < 10 ? 2 : newPw.length < 14 ? 3 : 4;
  const pwStrengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength];
  const pwStrengthColor = ['', 'bg-error', 'bg-secondary', 'bg-warning', 'bg-success'][pwStrength];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateProfile(editName.trim(), editEmail.trim());
      setProfileMsg({ type: 'ok', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMsg({ type: 'err', text: err.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'New passwords do not match.' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'err', text: 'Password must be at least 6 characters.' }); return; }
    setPwSaving(true);
    try {
      await changePassword(oldPw, newPw);
      setPwMsg({ type: 'ok', text: 'Password changed successfully!' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ type: 'err', text: err.message || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'preferences', label: 'Preferences' },
  ];

  return (
    <div className="page-container max-w-2xl animate-fade-in">
      {/* Header card */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="avatar-xl text-2xl">{initials}</div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="font-bold text-xl text-on-surface">{user?.name}</h1>
            <p className="text-on-surface-variant text-sm mt-0.5">{user?.email}</p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mt-2">
              <span className="badge badge-primary">
                <ShieldCheck className="w-3 h-3" />
                {ROLE_LABELS[user?.role] || user?.role}
              </span>
              <span className="badge badge-neutral">{user?.uid}</span>
            </div>
          </div>

          <button
            onClick={logout}
            className="btn-danger text-sm whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-3.5 text-sm font-semibold transition-all duration-150',
              activeTab === tab.id
                ? 'text-primary bg-primary-container/15 border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Edit3 className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-on-surface text-lg">Edit Profile</h2>
          </div>

          {profileMsg && (
            <div className={cn(
              'flex items-center gap-2.5 p-3.5 rounded-xl mb-5 text-sm font-medium animate-fade-in',
              profileMsg.type === 'ok' ? 'bg-success-container/30 text-success border border-success/30' : 'bg-error-container text-on-error-container'
            )}>
              {profileMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                <input
                  id="name"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Your full name"
                  className="input-with-icon-l"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="input-with-icon-l"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <input
                disabled
                value={ROLE_LABELS[user?.role] || user?.role || ''}
                className="input-base bg-surface-container-high/50 text-on-surface-variant cursor-not-allowed"
              />
              <p className="form-hint">Role is managed by the system administrator.</p>
            </div>

            <button type="submit" disabled={profileSaving} className="btn-primary w-full h-12 disabled:opacity-60">
              {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-on-surface text-lg">Change Password</h2>
          </div>

          {pwMsg && (
            <div className={cn(
              'flex items-center gap-2.5 p-3.5 rounded-xl mb-5 text-sm font-medium animate-fade-in',
              pwMsg.type === 'ok' ? 'bg-success-container/30 text-success border border-success/30' : 'bg-error-container text-on-error-container'
            )}>
              {pwMsg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
              {pwMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current password */}
            <div className="form-group">
              <label className="form-label" htmlFor="old-pw">Current Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                <input
                  id="old-pw"
                  type={showOld ? 'text' : 'password'}
                  required
                  value={oldPw}
                  onChange={e => setOldPw(e.target.value)}
                  placeholder="Current password"
                  className="input-with-icon-l pr-12"
                />
                <button type="button" onClick={() => setShowOld(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="form-group">
              <label className="form-label" htmlFor="new-pw">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                <input
                  id="new-pw"
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="At least 6 characters"
                  className="input-with-icon-l pr-12"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPw.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i <= pwStrength ? pwStrengthColor : 'bg-surface-container-highest')} />
                    ))}
                  </div>
                  <p className={cn('text-xs font-semibold', pwStrengthColor.replace('bg-', 'text-'))}>{pwStrengthLabel}</p>
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-pw">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
                <input
                  id="confirm-pw"
                  type="password"
                  required
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  className={cn(
                    'input-with-icon-l',
                    confirmPw && confirmPw !== newPw ? 'border-error focus:border-error focus:ring-error/20' : ''
                  )}
                />
              </div>
              {confirmPw && confirmPw !== newPw && (
                <p className="form-error"><X className="w-3 h-3" /> Passwords do not match</p>
              )}
            </div>

            <button type="submit" disabled={pwSaving} className="btn-primary w-full h-12 disabled:opacity-60">
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {pwSaving ? 'Changing…' : 'Change Password'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-outline-variant/20">
            <p className="font-label-md text-on-surface-variant mb-3">Account Actions</p>
            <button
              onClick={logout}
              className="btn-danger w-full h-11"
            >
              <LogOut className="w-4 h-4" />
              Sign Out of KSAS
            </button>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="divide-y divide-outline-variant/15">
            {[
              { icon: Moon, label: 'Dark Theme', desc: 'Adjust app appearance', toggle: true },
              { icon: Bell, label: 'Push Notifications', desc: 'Session alerts & reminders', toggle: true, defaultOn: true },
              { icon: Volume2, label: 'Sound Effects', desc: 'XP gains, badge unlocks, level-ups', toggle: true, defaultOn: isSoundEnabled(), onToggle: (v: boolean) => setSoundEnabled(v) },
            ].map(({ icon: Icon, label, desc, toggle, defaultOn, onToggle }) => (
              <label key={label} className="flex items-center justify-between px-5 py-4 hover:bg-surface-container/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 bg-primary-container/20 text-primary rounded-xl flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <p className="font-semibold text-on-surface text-sm">{label}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
                  </div>
                </div>
                {toggle && (
                  <div className="relative">
                    <input
                      type="checkbox"
                      defaultChecked={defaultOn}
                      className="sr-only peer"
                      onChange={e => onToggle?.(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-surface-container-highest peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                  </div>
                )}
              </label>
            ))}
            {[
              { icon: Globe, label: 'Language', desc: 'English (UK)' },
              { icon: HelpCircle, label: 'Help & FAQ', desc: 'Guides and support' },
              { icon: AlertOctagon, label: 'Report an Issue', desc: 'Send feedback to admin', danger: true },
            ].map(({ icon: Icon, label, desc, danger }) => (
              <button key={label} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-container/50 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', danger ? 'bg-error-container/20 text-error' : 'bg-primary-container/20 text-primary')}>
                    <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="text-left">
                    <p className={cn('font-semibold text-sm', danger ? 'text-error' : 'text-on-surface')}>{label}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-outline" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
