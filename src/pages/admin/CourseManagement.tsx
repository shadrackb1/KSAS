import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, Plus, Loader2, Edit, Trash2, Users, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from '../../lib/firebase';
import { collections } from '../../lib/db';
import { useFirestoreRealtimeCollection } from '../../hooks/useFirestoreRealtime';
import { uploadJSONToCloudinary } from '../../lib/cloudinary';
import { fetchSchoolCodes } from '../../lib/schoolCodes';
import { KABARAK_COURSES } from '../../lib/kabarakCourses';

export default function AdminCourseManagement() {
  const { data: courses, loading } = useFirestoreRealtimeCollection(collections.COURSES);
  const { data: users } = useFirestoreRealtimeCollection(collections.USERS);
  const { data: enrollments } = useFirestoreRealtimeCollection(collections.ENROLLMENTS);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState<any>(null);
  const [newCourse, setNewCourse] = useState({ code: '', name: '', department: '', school: '', mode: 'physical', lecturer: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [schoolCodes, setSchoolCodes] = useState<Map<string, string>>(new Map());

  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    fetchSchoolCodes().then(setSchoolCodes).catch(() => {});
  }, []);

const handleSaveCourse = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  try {
    const cId = newCourse.code.toUpperCase().replace(/\s+/g, '');
    const courseData = {
      code: newCourse.code,
      name: newCourse.name,
      department: newCourse.department,
      school: newCourse.school || undefined,
      mode: newCourse.mode || 'physical',
      lecturer: newCourse.lecturer,
      description: newCourse.description || '',
    };
    await setDoc(doc(db, collections.COURSES, cId), courseData);

    await uploadJSONToCloudinary('courses.json', [...courses.filter(c => c.code !== newCourse.code), courseData]);

    setShowAddModal(false);
    setNewCourse({ code: '', name: '', department: '', school: '', mode: 'physical', lecturer: '', description: '' });
    toast.success("Course saved");
  } catch (err: any) {
    toast.error(`Failed to save: ${err.message}`);
  } finally {
    setSaving(false);
  }
};

  const handleDelete = async (courseId: string) => {
      if(!confirm("Delete this course?")) return;
      setDeletingId(courseId);
      try {
          await deleteDoc(doc(db, collections.COURSES, courseId));
          toast.success("Course deleted");
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setDeletingId(null);
      }
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeedAllCourses = async () => {
    if (!confirm(`This will seed ${KABARAK_COURSES.length} courses from the Kabarak catalogue. Existing courses will be skipped. Continue?`)) return;
    setSeeding(true);
    let added = 0;
    let skipped = 0;
    try {
      for (const kc of KABARAK_COURSES) {
        const docId = kc.code.toUpperCase().replace(/\s+/g, '');
        const existing = courses.find((c: any) => c.code === kc.code);
        if (existing) { skipped++; continue; }
        await setDoc(doc(db, collections.COURSES, docId), {
          code: kc.code,
          name: kc.name,
          department: kc.department,
          school: kc.school,
          mode: kc.mode,
          lecturer: '',
          description: '',
        });
        added++;
      }
      await uploadJSONToCloudinary('courses.json', courses.concat(KABARAK_COURSES.map(kc => ({ id: kc.code.toUpperCase().replace(/\s+/g, ''), ...kc }))));
      toast.success(`Seeded ${added} courses (${skipped} already existed).`);
    } catch (err: any) {
      toast.error(`Seed failed: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!showEnrollModal || !selectedStudent) return;
      setSaving(true);
      try {
          const courseCode = showEnrollModal.code;
          const stu = users.find(u => u.uid === selectedStudent);
          if (!stu) throw new Error("Student not found");
          
          const enrollId = `${courseCode}_${stu.uid}`;
          await setDoc(doc(db, collections.ENROLLMENTS, enrollId), {
              courseCode,
              studentId: stu.uid,
              studentName: stu.name,
              enrolledAt: new Date().toISOString()
          });
          toast.success("Enrolled successfully");
          setShowEnrollModal(null);
      } catch (err: any) {
          toast.error(err.message);
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;

  return (
    <div className="px-4 md:px-6 max-w-7xl mx-auto w-full space-y-6 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
         <div>
            <h1 className="font-headline-lg font-bold text-primary">Course Management</h1>
            <p className="text-on-surface-variant">Create and manage courses, assign lecturers and enroll students.</p>
         </div>
          <div className="flex gap-2">
            <button onClick={handleSeedAllCourses} disabled={seeding} className="flex gap-2 items-center px-4 py-2 bg-secondary text-on-secondary font-bold rounded-lg hover:opacity-90 disabled:opacity-50">
              {seeding ? <Loader2 className="w-5 h-5 animate-spin"/> : <Database className="w-5 h-5"/>}
              {seeding ? 'Seeding…' : 'Seed Kabarak Courses'}
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex gap-2 items-center px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90">
              <Plus className="w-5 h-5"/> Add Course
            </button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {courses.length === 0 && (
           <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
             <Book className="w-10 h-10 mb-3 text-outline" />
             <p className="font-bold text-on-surface mb-1">No courses yet</p>
             <p className="text-sm text-on-surface-variant">Create a course to get started.</p>
           </div>
         )}
         {courses.map(c => {
             const courseEnrolls = enrollments.filter(e => e.courseCode === c.code);
             return (
                 <div key={c.id} className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                           <div className="w-10 h-10 bg-primary-container text-primary rounded-lg flex items-center justify-center">
                              <Book className="w-5 h-5" />
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => handleDelete(c.id)} disabled={deletingId === c.id} className="text-error hover:bg-error-container p-1 rounded disabled:opacity-50">
                                {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4"/>}
                              </button>
                           </div>
                        </div>
                        <h3 className="font-title-lg text-primary">{c.code}</h3>
                        <p className="font-body-md font-bold mb-1">{c.name}</p>
                        <p className="font-body-sm text-on-surface-variant mb-4">{c.description || 'No description'}</p>
                    </div>
                    <div>
                        <div className="flex justify-between items-center text-sm border-t border-outline-variant/30 pt-4 mb-4">
                           <span className="text-on-surface-variant">Lecturer:</span>
                           <span className="font-bold">{users.find(u => u.uid === c.lecturer)?.name || c.lecturer || 'Unassigned'}</span>
                        </div>
                        <button onClick={() => setShowEnrollModal(c)} className="w-full flex items-center justify-center gap-2 py-2 bg-secondary-container text-on-secondary-container font-bold rounded-lg hover:brightness-95">
                           <Users className="w-4 h-4"/> Enroll Students ({courseEnrolls.length})
                        </button>
                    </div>
                 </div>
             )
         })}
      </div>

{showAddModal && createPortal(
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <h3 className="font-headline-md text-primary mb-4">Add New Course</h3>
            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Course Code</label>
                <input required value={newCourse.code} onChange={e=>setNewCourse({...newCourse, code: e.target.value})} className="input-base" placeholder="e.g. COMP 201" />
              </div>
              <div className="form-group">
                <label className="form-label">Course Name</label>
                <input required value={newCourse.name} onChange={e=>setNewCourse({...newCourse, name: e.target.value})} className="input-base" />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input required value={newCourse.department} onChange={e=>setNewCourse({...newCourse, department: e.target.value})} className="input-base" />
              </div>
  <div className="form-group">
    <label className="form-label">School</label>
    <select value={newCourse.school} onChange={e=>setNewCourse({...newCourse, school: e.target.value})} className="input-base cursor-pointer">
      <option value="">Select a school...</option>
      {[...schoolCodes.entries()].map(([code, name]) => (
        <option key={code} value={name}>{code} — {name}</option>
      ))}
    </select>
  </div>
  <div className="form-group">
    <label className="form-label">Delivery Mode</label>
    <select value={newCourse.mode} onChange={e=>setNewCourse({...newCourse, mode: e.target.value})} className="input-base cursor-pointer">
      <option value="physical">Physical / In-Person</option>
      <option value="online">Fully Online</option>
      <option value="hybrid">Hybrid</option>
    </select>
  </div>
  <div className="form-group">
    <label className="form-label">Assign Lecturer</label>
    <select required value={newCourse.lecturer} onChange={e=>setNewCourse({...newCourse, lecturer: e.target.value})} className="input-base cursor-pointer">
                   <option value="">Select a lecturer...</option>
                   {users.filter(u => u.role === 'lecturer').map(l => (
                       <option key={l.uid} value={l.uid}>{l.name} ({l.uid})</option>
                   ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea value={newCourse.description} onChange={e=>setNewCourse({...newCourse, description: e.target.value})} className="input-base min-h-[80px] resize-y" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-colors text-sm border border-outline-variant/30">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 h-12 text-sm disabled:opacity-60">
                   {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Course'}
                </button>
</div>
</form>
</div>
</div>
  , document.body)}

{showEnrollModal && createPortal(
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <h3 className="font-headline-md text-primary mb-1">Enroll Student</h3>
            <p className="text-on-surface-variant text-sm mb-6">Enrolling into {showEnrollModal.code} - {showEnrollModal.name}</p>
            <form onSubmit={handleEnroll} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Select Student</label>
                <select required value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} className="input-base cursor-pointer">
                   <option value="">Select a student...</option>
                   {users.filter(u => u.role === 'student').map(s => (
                       <option key={s.uid} value={s.uid}>{s.name} ({s.uid})</option>
                   ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEnrollModal(null)} className="flex-1 py-3 font-bold text-on-surface-variant hover:bg-surface-variant rounded-xl transition-colors text-sm border border-outline-variant/30">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 h-12 text-sm disabled:opacity-60">
                   {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Enrolling...</> : 'Enroll'}
                </button>
              </div>
            </form>
            
            <div className="mt-6 pt-4 border-t border-outline-variant/20">
                <h4 className="font-label-md text-on-surface-variant mb-3">Currently enrolled</h4>
                <div className="max-h-48 overflow-y-auto bg-surface-container rounded-xl p-3 space-y-1">
                    {enrollments.filter(e => e.courseCode === showEnrollModal.code).map(e => (
                        <div key={e.id} className="text-sm py-2 px-2 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface">
                          {e.studentName} <span className="text-on-surface-variant font-mono text-xs ml-1">({e.studentId})</span>
                        </div>
                    ))}
                    {enrollments.filter(e => e.courseCode === showEnrollModal.code).length === 0 && (
                      <div className="text-sm text-on-surface-variant text-center py-4">
                        No students enrolled yet
                      </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
