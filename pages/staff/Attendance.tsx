
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Calendar, CheckCircle, Clock, XCircle, Save, Check, School, Users, ListChecks, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { getStudents, saveAttendanceRecord, getAttendanceRecordForClass } from '../../services/storage';
import { Student, StaffUser, AttendanceStatus, AttendanceRecord, ClassAssignment } from '../../types';

const { useNavigate } = ReactRouterDOM as any;

const Attendance: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<ClassAssignment | null>(null);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  
  const [saved, setSaved] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) {
      navigate('/staff/login');
      return;
    }
    const user = JSON.parse(session) as StaffUser;
    setCurrentUser(user);
    if (user.assignments && user.assignments.length > 0) {
      setCurrentAssignment(user.assignments[0]);
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentUser || !currentAssignment) return;
    const fetchStudentsAndAttendance = async () => {
      setLoadingStudents(true);
      try {
        const allStudents = await getStudents();
        const classStudents = allStudents.filter(s => 
          s.grade === currentAssignment.grade && s.className === currentAssignment.className
        );
        setStudents(classStudents);

        const existingRecord = await getAttendanceRecordForClass(selectedDate, currentAssignment.grade, currentAssignment.className);
        const initialMap: Record<string, AttendanceStatus> = {};
        
        if (existingRecord) {
           classStudents.forEach(s => {
              const record = existingRecord.records.find(r => r.studentId === s.studentId);
              initialMap[s.id] = record ? record.status : AttendanceStatus.PRESENT;
           });
           setSaved(true);
        } else {
           classStudents.forEach(s => initialMap[s.id] = AttendanceStatus.PRESENT);
           setSaved(false);
        }
        setAttendanceMap(initialMap);
      } catch (error) {
        console.error("Failed to load students", error);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudentsAndAttendance();
  }, [currentUser, currentAssignment, selectedDate]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
    setSaved(false);
  };

  const markAll = (status: AttendanceStatus) => {
    if (window.confirm(status === AttendanceStatus.ABSENT ? 'هل أنت متأكد من تغييب جميع الطلاب؟' : 'هل تريد تحضير الجميع؟')) {
       const newMap: Record<string, AttendanceStatus> = {};
       students.forEach(s => newMap[s.id] = status);
       setAttendanceMap(newMap);
       setSaved(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser || !currentAssignment) return;
    setSaving(true);
    try {
      const record: AttendanceRecord = {
        id: '', 
        date: selectedDate,
        grade: currentAssignment.grade,
        className: currentAssignment.className,
        staffId: currentUser.id,
        records: students.map(s => ({
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
    const total = students.length;
    const values = Object.values(attendanceMap);
    const presentCount = values.filter(s => s === AttendanceStatus.PRESENT).length;
    const absentCount = values.filter(s => s === AttendanceStatus.ABSENT).length;
    const lateCount = values.filter(s => s === AttendanceStatus.LATE).length;
    return { present: presentCount, absent: absentCount, late: lateCount };
  }, [attendanceMap, students.length]);

  if (!currentUser) return null;

  return (
    <div className="pb-32 animate-fade-in relative max-w-3xl mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 rounded-b-3xl -mx-4 md:mx-0 md:rounded-3xl mb-6">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><ListChecks size={20}/></div>
                <div>
                    <h1 className="text-lg font-bold text-slate-800">رصد الحضور</h1>
                    <p className="text-xs text-slate-500">{new Date(selectedDate).toLocaleDateString('ar-SA')}</p>
                </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-2">
                <div className="text-center px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="block text-lg font-bold text-emerald-600 leading-none">{stats.present}</span>
                    <span className="text-[9px] text-emerald-400">حاضر</span>
                </div>
                <div className="text-center px-3 py-1 bg-red-50 rounded-lg border border-red-100">
                    <span className="block text-lg font-bold text-red-600 leading-none">{stats.absent}</span>
                    <span className="text-[9px] text-red-400">غائب</span>
                </div>
                <div className="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="block text-lg font-bold text-amber-600 leading-none">{stats.late}</span>
                    <span className="text-[9px] text-amber-400">متأخر</span>
                </div>
            </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex gap-2">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 w-full outline-none focus:ring-2 focus:ring-blue-100"/>
                {currentUser.assignments && currentUser.assignments.length > 0 && (
                    <div className="relative w-full">
                        <select
                            value={currentAssignment ? JSON.stringify(currentAssignment) : ''}
                            onChange={(e) => setCurrentAssignment(JSON.parse(e.target.value))}
                            className="w-full appearance-none bg-blue-50 border border-blue-100 text-blue-900 font-bold py-2 px-4 rounded-xl text-sm outline-none"
                        >
                            {currentUser.assignments.map((assign, idx) => (
                            <option key={idx} value={JSON.stringify(assign)}>{assign.grade} - {assign.className}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                    </div>
                )}
            </div>
            
            <div className="flex gap-2">
                <button onClick={() => markAll(AttendanceStatus.PRESENT)} className="flex-1 bg-emerald-50 text-emerald-700 py-2 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100">تحضير الكل</button>
                <button onClick={() => markAll(AttendanceStatus.ABSENT)} className="flex-1 bg-red-50 text-red-700 py-2 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100">تغييب الكل</button>
            </div>
        </div>
      </div>

      {/* Student List */}
      {loadingStudents ? (
         <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 mx-4 md:mx-0">
             <Loader2 className="mx-auto mb-4 animate-spin" size={32} />
             <p className="font-bold">جاري تحميل القائمة...</p>
         </div>
      ) : students.length === 0 ? (
         <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 mx-4 md:mx-0">
             <Users className="mx-auto mb-4 opacity-50" size={48} />
             <p className="font-bold">لا يوجد طلاب مسجلين</p>
         </div>
      ) : (
         <div className="grid gap-3 mx-4 md:mx-0">
            {students.map(student => {
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
           disabled={saving || students.length === 0}
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
