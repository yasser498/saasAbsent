
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { School, CheckSquare, Square, Save, Loader2, BookOpen, Trash2, Plus } from 'lucide-react';
import { updateStaffUser, getAvailableClassesForGrade } from '../../services/storage';
import { StaffUser, ClassAssignment } from '../../types';
import { GRADES } from '../../constants';

const ClassManagement: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  
  // New Assignment Form State
  const [subjectName, setSubjectName] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(GRADES[0]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]); // Classes selected for current subject
  
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) { navigate('/staff/login'); return; }
    const u = JSON.parse(session);
    setUser(u);
    setAssignments(u.assignments || []);
  }, [navigate]);

  useEffect(() => {
    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const classes = await getAvailableClassesForGrade(selectedGrade);
        setAvailableClasses(classes as string[]);
        setSelectedClasses([]); // Reset selections when grade changes
      } catch(e) { console.error(e); }
      finally { setLoadingClasses(false); }
    };
    loadClasses();
  }, [selectedGrade]);

  const toggleClassSelection = (className: string) => {
    if (selectedClasses.includes(className)) {
        setSelectedClasses(prev => prev.filter(c => c !== className));
    } else {
        setSelectedClasses(prev => [...prev, className]);
    }
  };

  const addAssignments = () => {
      if (!subjectName.trim()) { alert("يرجى كتابة اسم المادة"); return; }
      if (selectedClasses.length === 0) { alert("يرجى اختيار فصل واحد على الأقل"); return; }

      const newAssignments = selectedClasses.map(cls => ({
          grade: selectedGrade,
          className: cls,
          subject: subjectName.trim()
      }));

      // Merge avoiding exact duplicates (Grade + Class + Subject)
      const updated = [...assignments];
      newAssignments.forEach(n => {
          if (!updated.some(e => e.grade === n.grade && e.className === n.className && e.subject === n.subject)) {
              updated.push(n);
          }
      });

      setAssignments(updated);
      // Don't reset subject name as teacher might want to add same subject to another grade
      setSelectedClasses([]); 
      alert(`تم إضافة مادة ${subjectName} للفصول المختارة.`);
  };

  const removeAssignment = (index: number) => {
      const updated = [...assignments];
      updated.splice(index, 1);
      setAssignments(updated);
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedUser = { ...user, assignments };
      await updateStaffUser(updatedUser);
      localStorage.setItem('ozr_staff_session', JSON.stringify(updatedUser));
      alert("تم حفظ التغييرات بنجاح!");
      navigate('/staff/home');
    } catch (e) {
      alert("فشل الحفظ");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24 animate-fade-in">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <School className="text-indigo-600"/> إدارة فصولي وموادي
            </h1>
            <button onClick={() => navigate('/staff/home')} className="text-sm text-slate-500 font-bold">عودة</button>
        </div>

        {/* 1. Add New Assignments Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus className="text-emerald-600"/> إضافة فصول جديدة
            </h2>

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">1. اكتب اسم المادة</label>
                <div className="relative">
                    <input 
                        value={subjectName}
                        onChange={e => setSubjectName(e.target.value)}
                        placeholder="مثال: رياضيات، لغتي، علوم..."
                        className="w-full p-3 pl-10 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-bold text-slate-800"
                    />
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">2. اختر المرحلة الدراسية</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {GRADES.map(g => (
                        <button 
                            key={g} 
                            onClick={() => setSelectedGrade(g)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedGrade === g ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
                        >
                            {g}
                    </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">3. حدد الفصول لهذه المادة</label>
                {loadingClasses ? <Loader2 className="animate-spin mx-auto text-indigo-600"/> : (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {availableClasses.map(cls => {
                            const isSelected = selectedClasses.includes(cls);
                            return (
                                <button
                                    key={cls}
                                    onClick={() => toggleClassSelection(cls)}
                                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-white text-slate-500 hover:border-emerald-200'}`}
                                >
                                    {isSelected ? <CheckSquare size={20}/> : <Square size={20}/>}
                                    <span className="font-bold text-sm">{cls}</span>
                                </button>
                            );
                        })}
                        {availableClasses.length === 0 && <p className="col-span-full text-center text-slate-400 text-xs">لا توجد فصول مسجلة لهذا الصف.</p>}
                    </div>
                )}
            </div>

            <button onClick={addAssignments} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
                إضافة للقائمة
            </button>
        </div>

        {/* 2. Current Assignments List */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BookOpen size={20} className="text-blue-600"/> الفصول والمواد المسجلة ({assignments.length})
            </h3>
            
            {assignments.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <p>لم تقم بإضافة أي فصول بعد.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {assignments.map((assign, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg">
                                    {assign.className}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{assign.subject || 'مادة عامة'}</h4>
                                    <p className="text-xs text-slate-500">{assign.grade}</p>
                                </div>
                            </div>
                            <button onClick={() => removeAssignment(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={18}/>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex justify-center z-20">
            <button onClick={handleSave} disabled={loading} className="w-full max-w-md bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 disabled:opacity-70 transform active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin"/> : <Save size={20}/>} حفظ التغييرات النهائية
            </button>
        </div>
    </div>
  );
};

export default ClassManagement;
