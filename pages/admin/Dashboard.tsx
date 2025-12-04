import React, { useMemo, useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  FileText, Clock, Sparkles, AlertTriangle, Loader2, BrainCircuit, 
  Search, Settings, BarChart2, ShieldAlert, Send, Megaphone, Activity, 
  LayoutGrid, Plus, UserCheck, CalendarCheck, Users, LogOut, MessageSquare, Bell, Copy, Link as LinkIcon, Save
} from 'lucide-react';
import { 
  getRequests, getStudents, getBehaviorRecords, 
  getAttendanceRecords, generateSmartContent, 
  getSchoolNews, addSchoolNews, deleteSchoolNews,
  getAvailableSlots, getDailyAppointments, getStaffUsers,
  getExitPermissions, generateDefaultAppointmentSlots,
  getAdminInsights, sendAdminInsight,
  sendBatchNotifications,
  getActiveSchool,
  updateSchoolManager,
  resetSchoolSystem // Import reset function
} from '../../services/storage';
import { ExcuseRequest, Student, BehaviorRecord, AttendanceRecord, SchoolNews, Appointment, AppointmentSlot, StaffUser, ExitPermission, AdminInsight } from '../../types';

const { useNavigate } = ReactRouterDOM as any;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Navigation & View State
  const [activeView, setActiveView] = useState<'overview' | 'notifications' | 'news' | 'settings'>('overview');
  
  // Core Data
  const [requests, setRequests] = useState<ExcuseRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [behaviorRecords, setBehaviorRecords] = useState<BehaviorRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [todaysExits, setTodaysExits] = useState<ExitPermission[]>([]);
  const [appointmentsList, setAppointmentsList] = useState<Appointment[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [newsList, setNewsList] = useState<SchoolNews[]>([]);
  
  const [dataLoading, setDataLoading] = useState(true);
  
  // School Identity
  const activeSchool = getActiveSchool();
  const [schoolName, setSchoolName] = useState(activeSchool?.name || 'المدرسة');
  const [schoolLogo, setSchoolLogo] = useState(activeSchool?.logoUrl || '');
  const [managerName, setManagerName] = useState(activeSchool?.managerName || '');
  
  // Alerts & AI
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Notifications Logic
  const [notifTargetGroup, setNotifTargetGroup] = useState<'all' | 'teachers' | 'admins'>('all');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // Reset System State
  const [isResetting, setIsResetting] = useState(false);

  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
      setDataLoading(true);
      try {
        const [reqs, studs, behaviors, atts, news, apps, exits, users] = await Promise.all([
            getRequests(), 
            getStudents(), 
            getBehaviorRecords(),
            getAttendanceRecords(),
            getSchoolNews(),
            getDailyAppointments(apptDate),
            getExitPermissions(apptDate),
            getStaffUsers()
        ]);
        setRequests(reqs);
        setStudents(studs);
        setBehaviorRecords(behaviors);
        setAttendanceRecords(atts);
        setNewsList(news);
        setAppointmentsList(apps);
        setTodaysExits(exits);
        setStaffUsers(users);

      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setDataLoading(false);
      }
  };

  useEffect(() => { fetchData(); }, [apptDate]);

  // --- STATS LOGIC ---
  const stats = useMemo(() => { 
      const todayStr = apptDate;
      const todaysAttendance = attendanceRecords.filter(r => r.date === todayStr);
      let present = 0, absent = 0, late = 0;
      todaysAttendance.forEach(record => record.records.forEach(stu => {
          if (stu.status === 'PRESENT') present++;
          else if (stu.status === 'ABSENT') absent++;
          else if (stu.status === 'LATE') late++;
      }));

      const todayViolations = behaviorRecords.filter(r => r.date === todayStr).length;
      const todayExits = todaysExits.length;
      const todayVisits = appointmentsList.filter(a => a.status === 'completed').length;

      return { 
          total: requests.length, 
          pending: requests.filter(r => r.status === 'PENDING').length, 
          studentsCount: students.length, 
          present, absent, late,
          todayViolations,
          todayExits,
          todayVisits
      }; 
  }, [requests, students, attendanceRecords, behaviorRecords, todaysExits, appointmentsList, apptDate]);

  const handleGenerateBriefing = async () => {
      setIsGenerating(true);
      try {
          const prompt = `بصفتك مدير مدرسة، حلل التالي ليوم ${apptDate}:
          - الغياب: ${stats.absent} طالب.
          - التأخر: ${stats.late} طالب.
          - المخالفات السلوكية: ${stats.todayViolations}.
          - الخروج أثناء الدوام: ${stats.todayExits}.
          
          المطلوب:
          1. تقييم عام للانضباط (ممتاز/جيد/ضعيف).
          2. توجيه واحد مباشر للطاقم بناءً على الأرقام.
          `;
          const res = await generateSmartContent(prompt);
          setAiBriefing(res);
      } catch(e) { alert("تعذر الاتصال بالمساعد الذكي"); } finally { setIsGenerating(false); }
  };

  const handleSendCustomNotification = async () => {
      if (!notifTitle || !notifMessage) {
          alert("يرجى تعبئة العنوان والرسالة.");
          return;
      }
      setIsSendingNotif(true);
      try {
          let targetIds: string[] = [];
          if (notifTargetGroup === 'all') {
              targetIds = staffUsers.map(u => u.id);
          } else if (notifTargetGroup === 'teachers') {
              targetIds = staffUsers.filter(u => !u.permissions?.includes('students') && !u.permissions?.includes('deputy')).map(u => u.id);
          } else if (notifTargetGroup === 'admins') {
              targetIds = staffUsers.filter(u => u.permissions?.includes('students') || u.permissions?.includes('deputy')).map(u => u.id);
          }

          if (targetIds.length === 0) {
              alert("لا يوجد مستخدمين في الفئة المستهدفة.");
              return;
          }

          await sendBatchNotifications(targetIds, 'info', notifTitle, notifMessage);
          alert(`تم إرسال الإشعار لـ ${targetIds.length} مستخدم.`);
          setNotifTitle(''); setNotifMessage('');
      } catch (e) {
          alert("فشل الإرسال.");
      } finally {
          setIsSendingNotif(false);
      }
  };

  const handleSaveSettings = async () => {
      try {
          await updateSchoolManager(managerName);
          alert('تم حفظ الإعدادات بنجاح');
      } catch (error) {
          alert('حدث خطأ أثناء الحفظ');
      }
  };

  const copySchoolLink = () => {
      if (!activeSchool) return;
      const baseUrl = window.location.origin + window.location.pathname.replace('/admin/dashboard', '');
      const link = `${baseUrl}#/s/${activeSchool.schoolCode}`;
      navigator.clipboard.writeText(link);
      alert("تم نسخ رابط المدرسة الموحد!");
  };

  const handleResetSystem = async () => {
      if (window.confirm("تحذير: هل أنت متأكد من تصفير النظام بالكامل؟ سيتم حذف جميع بيانات الطلاب والحضور والسلوك والإحصائيات نهائياً. لا يمكن التراجع عن هذا الإجراء.")) {
          if (window.confirm("تأكيد نهائي: هل تريد حقاً حذف كل شيء؟")) {
              setIsResetting(true);
              try {
                  await resetSchoolSystem();
                  alert("تم تصفير النظام بنجاح.");
                  window.location.reload(); // Refresh to clear local state
              } catch (e) {
                  alert("حدث خطأ أثناء التصفير. يرجى المحاولة مرة أخرى.");
              } finally {
                  setIsResetting(false);
              }
          }
      }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-lg transition-all hover:-translate-y-1">
          <div>
              <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-wider">{title}</p>
              <h3 className={`text-3xl font-black ${color}`}>{value}</h3>
          </div>
          <div className={`p-4 rounded-2xl ${color.replace('text-', 'bg-').replace('600', '50')} ${color} group-hover:scale-110 transition-transform`}>
              <Icon size={24} />
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-20 relative font-sans bg-slate-50 min-h-screen">
      
      {/* 1. HEADER */}
      <header className="bg-white sticky top-0 z-40 no-print border-b border-slate-100 px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-lg shadow-slate-900/20"><LayoutGrid size={24} /></div>
              <div><h1 className="text-xl font-extrabold text-slate-900">مركز القيادة</h1><p className="text-xs text-slate-500 font-bold">لوحة التحكم المركزية - {schoolName}</p></div>
          </div>
          <div className="flex gap-3 items-center w-full md:w-auto bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <button onClick={() => setActiveView('overview')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'overview' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>نظرة عامة</button>
              <button onClick={() => setActiveView('notifications')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'notifications' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>الإشعارات</button>
              <button onClick={() => setActiveView('settings')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'settings' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>الإعدادات</button>
          </div>
      </header>

      {/* === OVERVIEW (DAILY PULSE) === */}
      {activeView === 'overview' && (
          <div className="px-6 space-y-6 animate-fade-in">
              {/* AI Insight */}
              <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  
                  <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center">
                      <div className="md:col-span-2">
                          <h2 className="text-2xl font-bold flex items-center gap-3 mb-2"><Sparkles className="text-amber-400 fill-amber-400" /> الموجز الصباحي الذكي</h2>
                          <p className="text-indigo-200 text-sm font-light leading-relaxed max-w-lg mb-6">
                              {aiBriefing || "اضغط على زر التحليل للحصول على قراءة فورية لبيانات المدرسة اليومية مدعومة بالذكاء الاصطناعي."}
                          </p>
                          <button onClick={handleGenerateBriefing} disabled={isGenerating} className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-lg">
                              {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <BrainCircuit size={18}/>} 
                              {aiBriefing ? 'تحديث التحليل' : 'تحليل بيانات اليوم'}
                          </button>
                      </div>
                      
                      {/* Mini Live Stats in Header */}
                      <div className="grid grid-cols-2 gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                          <div className="text-center">
                              <span className="text-xs text-indigo-200 font-bold uppercase">الغياب</span>
                              <p className="text-2xl font-black text-white">{stats.absent}</p>
                          </div>
                          <div className="text-center">
                              <span className="text-xs text-indigo-200 font-bold uppercase">التأخر</span>
                              <p className="text-2xl font-black text-white">{stats.late}</p>
                          </div>
                          <div className="text-center">
                              <span className="text-xs text-indigo-200 font-bold uppercase">الاستئذان</span>
                              <p className="text-2xl font-black text-white">{stats.todayExits}</p>
                          </div>
                          <div className="text-center">
                              <span className="text-xs text-indigo-200 font-bold uppercase">المخالفات</span>
                              <p className="text-2xl font-black text-white">{stats.todayViolations}</p>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Vital Stats Grid */}
              <h3 className="font-bold text-slate-800 text-lg">المؤشرات التشغيلية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="حضور اليوم" value={stats.present} icon={UserCheck} color="text-emerald-600" />
                  <StatCard title="طلبات الأعذار" value={stats.pending} icon={MessageSquare} color="text-amber-600" />
                  <StatCard title="زوار اليوم" value={stats.todayVisits} icon={Users} color="text-blue-600" />
                  <StatCard title="إجمالي الطلاب" value={stats.studentsCount} icon={UserCheck} color="text-purple-600" />
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert size={20} className="text-red-500"/> أحدث المخالفات</h3>
                          <button onClick={() => navigate('/staff/deputy')} className="text-xs bg-slate-50 px-3 py-1 rounded-lg hover:bg-slate-100 font-bold text-slate-600">عرض الكل</button>
                      </div>
                      <div className="space-y-3">
                          {behaviorRecords.slice(0, 3).map((rec, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs">{rec.studentName.charAt(0)}</div>
                                      <div><p className="font-bold text-sm text-slate-800">{rec.studentName}</p><p className="text-[10px] text-slate-500">{rec.violationName}</p></div>
                                  </div>
                                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-red-100 font-bold text-red-700">{rec.violationDegree}</span>
                              </div>
                          ))}
                          {behaviorRecords.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">لا توجد مخالفات مسجلة.</p>}
                      </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><LogOut size={20} className="text-orange-500"/> حركة الخروج</h3>
                          <button onClick={() => navigate('/staff/exit-permissions')} className="text-xs bg-slate-50 px-3 py-1 rounded-lg hover:bg-slate-100 font-bold text-slate-600">عرض الكل</button>
                      </div>
                      <div className="space-y-3">
                          {todaysExits.slice(0, 3).map((ex, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-orange-50/50 border border-orange-100 rounded-xl">
                                  <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xs">{ex.studentName.charAt(0)}</div>
                                      <div><p className="font-bold text-sm text-slate-800">{ex.studentName}</p><p className="text-[10px] text-slate-500">{ex.reason}</p></div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${ex.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-white border border-orange-200 text-orange-700'}`}>{ex.status==='completed'?'خرج':'انتظار'}</span>
                              </div>
                          ))}
                          {todaysExits.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">لا يوجد خروج اليوم.</p>}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* === NOTIFICATIONS VIEW === */}
      {activeView === 'notifications' && (
          <div className="px-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-xl text-blue-600"><Bell size={24} /></div>
                      إرسال إشعار فوري
                  </h2>
                  
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-500 block mb-3 uppercase tracking-wider">لمن تريد إرسال الرسالة؟</label>
                          <div className="grid grid-cols-3 gap-3">
                              {[
                                  {id: 'all', label: 'الكل (طاقم العمل)'}, 
                                  {id: 'teachers', label: 'المعلمين فقط'}, 
                                  {id: 'admins', label: 'الإداريين والموجهين'}
                              ].map(opt => (
                                  <button 
                                      key={opt.id} 
                                      onClick={() => setNotifTargetGroup(opt.id as any)}
                                      className={`py-3 rounded-xl text-sm font-bold transition-all border-2 ${notifTargetGroup === opt.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                                  >
                                      {opt.label}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 block mb-2">عنوان الإشعار</label>
                          <input 
                              value={notifTitle} 
                              onChange={e => setNotifTitle(e.target.value)} 
                              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-500 transition-colors" 
                              placeholder="مثال: اجتماع طارئ في غرفة المعلمين"
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-slate-500 block mb-2">نص الرسالة</label>
                          <textarea 
                              value={notifMessage} 
                              onChange={e => setNotifMessage(e.target.value)} 
                              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-medium min-h-[120px] focus:outline-none focus:border-blue-500 transition-colors resize-none" 
                              placeholder="اكتب تفاصيل الرسالة هنا..."
                          ></textarea>
                      </div>

                      <button 
                          onClick={handleSendCustomNotification} 
                          disabled={isSendingNotif} 
                          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
                      >
                          {isSendingNotif ? <Loader2 className="animate-spin" /> : <Send size={20} />} إرسال للجميع
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* === SETTINGS VIEW === */}
      {activeView === 'settings' && (
          <div className="px-6 space-y-6 animate-fade-in max-w-2xl mx-auto">
              {/* General Settings */}
              <div className="bg-white border border-slate-200 p-6 rounded-[2rem] shadow-sm">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><Settings size={20} className="text-blue-600"/> إعدادات المدرسة</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 block mb-2">اسم مدير المدرسة (يظهر في التقارير)</label>
                          <input 
                              value={managerName}
                              onChange={e => setManagerName(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-blue-500"
                              placeholder="الاسم الثلاثي..."
                          />
                      </div>
                      <button onClick={handleSaveSettings} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 w-full hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                          <Save size={18}/> حفظ التغييرات
                      </button>
                  </div>
              </div>

              {/* Share Link Card */}
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 relative z-10"><LinkIcon size={24}/> رابط المدرسة الموحد</h2>
                  <p className="text-emerald-100 mb-6 relative z-10 text-sm opacity-90">
                      هذا الرابط يتيح للجميع (معلمين، طلاب، أولياء أمور) الوصول لصفحة مدرستك الرئيسية دون الحاجة لإدخال كود المدرسة.
                  </p>
                  <button onClick={copySchoolLink} className="w-full bg-white text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-50 shadow-sm transition-all relative z-10">
                      <Copy size={18}/> نسخ الرابط للمشاركة
                  </button>
              </div>

              {/* Danger Zone */}
              <div className="bg-white border-2 border-red-50 p-6 rounded-[2rem]">
                  <h3 className="font-bold text-red-900 flex items-center gap-2 mb-4"><AlertTriangle size={20} className="text-red-500"/> منطقة الخطر</h3>
                  <p className="text-xs text-slate-500 mb-4">الإجراءات هنا لا يمكن التراجع عنها. يرجى الحذر.</p>
                  <button onClick={handleResetSystem} disabled={isResetting} className="w-full border-2 border-red-100 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                      {isResetting ? <Loader2 className="animate-spin"/> : 'تصفير النظام بالكامل'}
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;