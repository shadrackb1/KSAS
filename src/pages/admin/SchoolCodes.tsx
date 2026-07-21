import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Save, Loader2, Building, RefreshCw, Users } from 'lucide-react';
import { fetchSchoolCodes, setSchoolCode, removeSchoolCode, invalidateSchoolCodeCache, type SchoolCode } from '../../lib/schoolCodes';
import { backfillSchoolCodes } from '../../lib/backfillSchoolCodes';

export default function AdminSchoolCodes() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState<SchoolCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const map = await fetchSchoolCodes();
      const list: SchoolCode[] = [];
      map.forEach((name, code) => list.push({ code, name }));
      list.sort((a, b) => a.code.localeCompare(b.code));
      setCodes(list);
    } catch (err) {
      console.error('Failed to load school codes', err);
      toast.error('Failed to load school codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) {
      toast.error('Both code and school name are required.');
      return;
    }
    if (codes.some(c => c.code === code)) {
      toast.error(`Code "${code}" already exists. Edit it instead.`);
      return;
    }
    setSaving(true);
    try {
      await setSchoolCode(code, name);
      setNewCode('');
      setNewName('');
      invalidateSchoolCodeCache();
      await load();
      toast.success(`Added ${code} → ${name}`);
    } catch (err) {
      toast.error('Failed to save school code.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (oldCode: string, newNameValue: string) => {
    const name = newNameValue.trim();
    if (!name) return;
    setSaving(true);
    try {
      await setSchoolCode(oldCode, name);
      invalidateSchoolCodeCache();
      await load();
      toast.success(`Updated ${oldCode}`);
    } catch (err) {
      toast.error('Failed to update.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Remove mapping for "${code}"? Students with this prefix will fall back to enrollment-only filtering.`)) return;
    setSaving(true);
    try {
      await removeSchoolCode(code);
      invalidateSchoolCodeCache();
      await load();
      toast.success(`Removed ${code}`);
    } catch (err) {
      toast.error('Failed to delete.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-page-in px-4 py-6 sm:px-6 md:px-8 lg:px-12 lg:py-10" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', background: 'none', border: 'none', cursor: 'pointer' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Admin Dashboard
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--kabu-maroon-tint)' }}>
          <Building className="w-5 h-5" style={{ color: 'var(--kabu-maroon)' }} />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '24px', color: 'var(--text-primary)' }}>School Code Mappings</h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--text-secondary)' }}>Map registration number prefixes to school names. Used for session filtering and student account derivation.</p>
        </div>
      </div>

      {/* Add new mapping */}
      <div className="p-5 mb-6" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
        <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Add New Mapping</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newCode}
            onChange={e => setNewCode(e.target.value.toUpperCase())}
            placeholder="e.g. LAW"
            maxLength={10}
            className="flex-1 sm:max-w-[120px] px-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
          />
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. School of Law"
            className="flex-1 px-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newCode.trim() || !newName.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'var(--kabu-maroon)', color: '#fff', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving || !newCode.trim() || !newName.trim() ? 0.5 : 1 }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* Backfill existing students */}
      <div className="p-5 mb-6" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Backfill Existing Students</h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Parse school codes from registration numbers for all existing student accounts that don't have one yet.
            </p>
          </div>
          <button
            onClick={async () => {
              if (!confirm('This will scan all student accounts and add schoolCode based on their registration number. Continue?')) return;
              setBackfilling(true);
              try {
                const result = await backfillSchoolCodes();
                toast.success(`Updated ${result.updated} of ${result.total} students. ${result.skipped} already had codes.`);
                if (result.errors.length > 0) {
                  toast(`${result.errors.length} errors occurred. Check console for details.`, { icon: '⚠️' });
                  console.warn('Backfill errors:', result.errors);
                }
              } catch (err) {
                toast.error('Backfill failed. Check console.');
                console.error(err);
              } finally {
                setBackfilling(false);
              }
            }}
            disabled={backfilling}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--bg-border)', cursor: backfilling ? 'wait' : 'pointer', opacity: backfilling ? 0.5 : 1 }}
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {backfilling ? 'Running...' : 'Backfill Now'}
          </button>
        </div>
      </div>

      {/* Existing mappings */}
      <div className="p-5" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '0.5px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Existing Mappings ({codes.length})</h3>
          <button onClick={() => { invalidateSchoolCodeCache(); load(); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--kabu-maroon)' }} />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontSize: '14px' }}>
            No school codes configured yet. Add one above.
          </p>
        ) : (
          <div className="space-y-2">
            {codes.map(c => (
              <SchoolCodeRow key={c.code} code={c.code} name={c.name} saving={saving} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolCodeRow({ code, name, saving, onUpdate, onDelete }: { code: string; name: string; saving: boolean; onUpdate: (code: string, name: string) => void; onDelete: (code: string) => void }) {
  const [editName, setEditName] = useState(name);
  const [dirty, setDirty] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--bg-border)' }}>
      <span className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'var(--kabu-maroon-tint)', color: 'var(--kabu-maroon)', fontFamily: 'var(--font-mono)' }}>
        {code}
      </span>
      <input
        value={editName}
        onChange={e => { setEditName(e.target.value); setDirty(e.target.value !== name); }}
        className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent"
        style={{ border: dirty ? '1px solid var(--gold-primary)' : '1px solid transparent', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
      />
      {dirty && (
        <button
          onClick={() => { onUpdate(code, editName); setDirty(false); }}
          disabled={saving}
          className="shrink-0 p-1.5 rounded-lg transition-all"
          style={{ background: 'var(--success-bg)', color: 'var(--success)', border: 'none', cursor: 'pointer' }}
        >
          <Save className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => onDelete(code)}
        disabled={saving}
        className="shrink-0 p-1.5 rounded-lg transition-all"
        style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: 'none', cursor: 'pointer' }}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
