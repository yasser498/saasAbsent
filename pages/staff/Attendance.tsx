
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Calendar, CheckCircle, Clock, XCircle, Save, Check, ListChecks, ChevronDown, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { getStudents, saveAttendanceRecord, getAttendanceRecordForClass } from '../../services/storage';
import { Student, StaffUser, AttendanceStatus, AttendanceRecord } from '../../types';

const { useNavigate } = ReactRouterDOM as any;

const Attendance: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  
  // Data State
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  
  // Filter State
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // UI State
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    const user = JSON.parse(session) as StaffUser;
    setCurrentUser(user);
    
    // Initial fetch
    const init = async () => {
        setLoading(true);
        try {
            const studentsData = await getStudents() as Student[];
            setAllStudents(studentsData);
            
            // Try to auto-select from assignment if matches DB
            if (user.assignments && user.assignments.length > 0) {
                const first = user.assignments[0];
                // Check if this assignment actually exists in DB to avoid empty screens
                const exists = studentsData.some(s => s.grade === first.grade && s.className === first.className);
                if (exists) {
                    setSelectedGrade(first.grade);
                    setSelectedClass(first.className);
                } else {
                    // If strict assignment doesn't match, maybe just grade matches?
                    // Or default to first available in DB
                    const grades = Array.from(new Set(studentsData.map(s => s.grade))).sort();
                    if (grades.length > 0) setSelectedGrade(grades[0]);
                }
            } else if (studentsData.length > 0) {
                 const grades = Array.from(new Set(studentsData.map(s => s.grade))).sort();
                 setSelectedGrade(grades[0]);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    init();
  }, [navigate]);

  // Derived Lists
  const uniqueGrades = useMemo(() => {
    const grades = new Set(allStudents.map(s => s.grade));
    return Array.from(grades).sort();
  }, [allStudents]);

  const availableClasses = useMemo(() => {
    if (!selectedGrade) return [];
    const classes = new Set(allStudents.filter(s => s.grade === selectedGrade).map(s => s.className));
    return Array.from(classes).sort();
  }, [allStudents, selectedGrade]);

  const currentStudents = useMemo(() => {
      return allStudents.filter(s => s.grade === selectedGrade && s.className === selectedClass);
  }, [allStudents, selectedGrade, selectedClass]);

  // Fetch Attendance Record when selection changes
  useEffect(() => {
    if (!selectedGrade || !selectedClass) return;
    
    const fetchRecord = async () => {
        // Don't set global loading to avoid flickering whole page, maybe just list?
        // Using a local var or just rely on react fast render.
        try {
            const existingRecord = await getAttendanceRecordForClass(selectedDate, selectedGrade, selectedClass);
            const initialMap: Record<string, AttendanceStatus> = {};
            
            if (existingRecord) {
                currentStudents.forEach(s => {
                    const record = existingRecord.records.find(r => r.studentId === s.studentId);
                    initialMap[s.id] = record ? record.status : AttendanceStatus.PRESENT;
                });
                setSaved(true);
            } else {
                currentStudents.forEach(s => initialMap[s.id] = AttendanceStatus.PRESENT);
                setSaved(false);
            }
            setAttendanceMap(initialMap);
        } catch(e) { console.error(e); }
    };
    fetchRecord();
  }, [selectedGrade, selectedClass, selectedDate, currentStudents]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    if (window.confirm(status === AttendanceStatus.ABSENT ? 'هل أنت متأكد من تغييب جميع الطلاب؟' : 'هل تريد تحضير الجميع؟')) {
       const newMap: Record<string, AttendanceStatus> = {};
       currentStudents.forEach(s => newMap[s.id] = status);
       setAttendanceMap(newMap);
       setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser || !selectedGrade || !selectedClass) return;
    setSaving(true);
    try {
      const record: AttendanceRecord = {
        id: '', 
        date: selectedDate,
        grade: selectedGrade,
        className: selectedClass,
        staffId: currentUser.id,
        records: currentStudents.map(s => ({
          studentId: s.studentId,
          studentName: s.name,
          status: attendanceMap[s.id] || AttendanceStatus.PRESENT
        }))
      };
      await saveAttendanceRecord(record);
      setSaved(true);
    } catch (e) {
      alert("حدث خطأ أثناء الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const values = Object.values(attendanceMap);
    return { 
        present: values.filter(s => s === AttendanceStatus.PRESENT).length,
        absent: values.filter(s => s === AttendanceStatus.ABSENT).length,
        late: values.filter(s => s === AttendanceStatus.LATE).length
    };
  }, [attendanceMap]);

  if (!currentUser) return null;

  return (
    <div className="pb-32 animate-fade-in relative max-w-4xl mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 rounded-b-3xl -mx-4 md:mx-0 md:rounded-3xl mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><ListChecks size={20}/></div>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">رصد الحضور</h1>
                    <p className="text-xs text-slate-500">{new Date(selectedDate).toLocaleDateString('ar-SA')}</p>
                </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-2 w-full md:w-auto justify-center">
                <div className="text-center px-4 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="block text-lg font-bold text-emerald-600 leading-none">{stats.present}</span>
                    <span className="text-[9px] text-emerald-400">حاضر</span>
                </div>
                <div className="text-center px-4 py-1 bg-red-50 rounded-lg border border-red-100">
                    <span className="block text-lg font-bold text-red-600 leading-none">{stats.absent}</span>
                    <span className="text-[9px] text-red-400">غائب</span>
                </div>
                <div className="text-center px-4 py-1 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="block text-lg font-bold text-amber-600 leading-none">{stats.late}</span>
                    <span className="text-[9px] text-amber-400">متأخر</span>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-blue-100"/>
            </div>
            <div className="md:col-span-3">
                <div className="relative">
                    <select 
                        value={selectedGrade} 
                        onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); }} 
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-sm outline-none appearance-none"
                    >
                        <option value="">اختر الصف</option>
                        {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
            </div>
            <div className="md:col-span-3">
                <div className="relative">
                    <select 
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(e.target.value)} 
                        disabled={!selectedGrade}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold py-2.5 px-4 rounded-xl text-sm outline-none appearance-none disabled:opacity-50"
                    >
                        <option value="">اختر الفصل</option>
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                </div>
            </div>
            
            <div className="md:col-span-3 flex gap-1">
                <button onClick={() => markAll(AttendanceStatus.PRESENT)} className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100">تحضير الكل</button>
                <button onClick={() => markAll(AttendanceStatus.ABSENT)} className="flex-1 bg-red-50 text-red-700 py-2 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100">تغييب الكل</button>
            </div>
        </div>
      </div>

      {/* Student List */}
      {loading ? (
         <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 mx-4 md:mx-0">
             <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
             <p className="font-bold">جاري تحميل البيانات...</p>
         </div>
      ) : !selectedGrade || !selectedClass ? (
         <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 mx-4 md:mx-0 p-6">
             <Filter className="mx-auto mb-4 text-blue-300" size={48} />
             <p className="font-bold text-lg mb-2">يرجى اختيار الصف والفصل</p>
             <p className="text-sm">للبدء في رصد الحضور</p>
         </div>
      ) : currentStudents.length === 0 ? (
         <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 mx-4 md:mx-0 p-6">
             <AlertTriangle className="mx-auto mb-4 text-amber-400" size={48} />
             <p className="font-bold text-lg mb-2">لا توجد بيانات طلاب</p>
             <p className="text-sm">لا يوجد طلاب مسجلين في هذا الفصل في قاعدة البيانات.</p>
         </div>
      ) : (
         <div className="grid gap-3 mx-4 md:mx-0">
            {currentStudents.map(student => {
                const status = attendanceMap[student.id];
                return (
                  <div key={student.id} className={`bg-white p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 shadow-sm
                       ${status === AttendanceStatus.ABSENT ? 'border-red-100 bg-red-50/10' : 
                         status === AttendanceStatus.LATE ? 'border-amber-100 bg-amber-50/10' : 
                         'border-transparent'}`}
                  >
                     <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0
                           ${status === AttendanceStatus.ABSENT ? 'bg-red-50 text-red-600 border-red-100' :
                             status === AttendanceStatus.LATE ? 'bg-amber-50 text-amber-600 border-amber-100' :
                             'bg-slate-100 text-slate-600 border-slate-200'}
                        `}>
                           {student.name.charAt(0)}
                        </div>
                        <div>
                           <h3 className={`font-bold text-sm ${status === AttendanceStatus.ABSENT ? 'text-red-900' : 'text-slate-800'}`}>
                              {student.name}
                           </h3>
                           <p className="text-[10px] text-slate-400 font-mono">{student.studentId}</p>
                        </div>
                     </div>

                     <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => handleStatusChange(student.id, AttendanceStatus.PRESENT)}
                          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1 text-xs font-bold ${status === AttendanceStatus.PRESENT ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400'}`}
                        >
                           <CheckCircle size={14} /> حاضر
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, AttendanceStatus.LATE)}
                          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1 text-xs font-bold ${status === AttendanceStatus.LATE ? 'bg-white text-amber-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400'}`}
                        >
                           <Clock size={14} /> متأخر
                        </button>
                        <button
                          onClick={() => handleStatusChange(student.id, AttendanceStatus.ABSENT)}
                          className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1 text-xs font-bold ${status === AttendanceStatus.ABSENT ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400'}`}
                        >
                           <XCircle size={14} /> غائب
                        </button>
                     </div>
                  </div>
                );
            })}
         </div>
      )}

      {/* Save Button */}
      <div className="fixed bottom-6 left-0 right-0 p-4 flex justify-center z-40 pointer-events-none">
         <button 
           onClick={handleSave}
           disabled={saving || currentStudents.length === 0}
           className={`pointer-events-auto flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-bold shadow-2xl transition-all transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:transform-none w-full max-w-sm justify-center border-4 border-white/20 backdrop-blur-sm
             ${saved ? 'bg-emerald-600' : ''}
           `}
         >
            {saving ? <Loader2 className="animate-spin" /> : saved ? <Check size={20} /> : <Save size={20} />}
            {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ بنجاح' : 'حفظ التغييرات'}
         </button>
      </div>
    </div>
  );
};

export default Attendance;
