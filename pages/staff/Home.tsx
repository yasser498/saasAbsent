
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, MessageSquare, BookUser, BarChart2, ShieldCheck, LogOut, Briefcase, FileText, BellRing, Sparkles, X, Calendar, User, CheckCircle, Info, ScanLine, ArrowLeft, TrendingUp, Grid, Settings, BookOpen, Layers, PenTool, Layout } from 'lucide-react';
import { StaffUser, SchoolNews, AdminInsight, AppNotification } from '../../types';
import { getSchoolNews, getAdminInsights, getNotifications, markNotificationRead, getAttendanceRecords } from '../../services/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const StaffHome: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [news, setNews] = useState<SchoolNews[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) { navigate('/staff/login'); return; }
    const userData = JSON.parse(session);
    setUser(userData);

    const loadInfo = async () => {
        const [n, notifs, allRecords] = await Promise.all([
            getSchoolNews(),
            getNotifications(userData.id),
            getAttendanceRecords()
        ]);
        setNews(n);
        setNotifications(notifs.filter((n: any) => !n.isRead));

        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const stats = last7Days.map(date => {
            let relevantRecords = allRecords.filter(r => r.date === date);
            if (userData.assignments && userData.assignments.length > 0) {
                 relevantRecords = relevantRecords.filter(r => userData.assignments.some((a: any) => a.grade === r.grade && a.className === r.className));
            } else {
                 relevantRecords = relevantRecords.filter(r => r.staffId === userData.id);
            }
            let present = 0, absent = 0, late = 0;
            relevantRecords.forEach(r => {
                r.records.forEach(student => {
                    if (student.status === 'PRESENT') present++;
                    else if (student.status === 'ABSENT') absent++;
                    else if (student.status === 'LATE') late++;
                });
            });
            return { name: new Date(date).toLocaleDateString('ar-SA', { weekday: 'short' }), present, absent, late };
        });
        setChartData(stats);
    };
    loadInfo();
  }, [navigate]);

  const handleMarkRead = async (id: string) => {
      await markNotificationRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (!user) return null;
  const perms = user.permissions || [];
  const isTeacher = user.role === 'teacher' || (!user.role && perms.includes('attendance'));

  // --- Card Definition ---
  
  // 1. Official/Admin Tasks
  const adminCards = [
    { key: 'attendance', title: 'رصد الغياب', desc: 'التحضير الرسمي اليومي', icon: ClipboardCheck, path: '/staff/attendance', color: 'bg-emerald-600', textColor: 'text-emerald-700', bgLight: 'bg-emerald-50' },
    { key: 'requests', title: 'الأعذار', desc: 'مراجعة طلبات الغياب', icon: MessageSquare, path: '/staff/requests', color: 'bg-blue-600', textColor: 'text-blue-700', bgLight: 'bg-blue-50' },
    { key: 'observations', title: 'الملاحظات', desc: 'سلوك ومشاركات', icon: FileText, path: '/staff/observations', color: 'bg-pink-600', textColor: 'text-pink-700', bgLight: 'bg-pink-50' },
    { key: 'gate_security', title: 'أمن البوابة', desc: 'ماسح الخروج', icon: ScanLine, path: '/staff/gate', color: 'bg-slate-700', textColor: 'text-slate-800', bgLight: 'bg-slate-100' },
  ];

  // 2. Academic Tools (Teacher Only)
  const academicCards = [
    { key: 'daily_followup', title: 'المتابعة اليومية', desc: 'واجبات، مشاركة، تقييم', icon: BookOpen, path: '/staff/daily-followup', color: 'bg-indigo-600', textColor: 'text-indigo-700', bgLight: 'bg-indigo-50' },
    { key: 'class_room', title: 'الفصل الذكي', desc: 'قرعة، مؤقت، تحفيز', icon: Sparkles, path: '/staff/classroom', color: 'bg-violet-600', textColor: 'text-violet-700', bgLight: 'bg-violet-50' },
    { key: 'class_management', title: 'إدارة فصولي', desc: 'إعداد الفصول والشعب', icon: Settings, path: '/staff/classes', color: 'bg-slate-600', textColor: 'text-slate-700', bgLight: 'bg-slate-100' }
  ];

  // 3. Analytics & Strategy
  const analyticsCards = [
    { key: 'teacher_analysis', title: 'تحليل الأداء', desc: 'لوحة قياس المؤشرات', icon: TrendingUp, path: '/staff/teacher-analysis', color: 'bg-teal-600', textColor: 'text-teal-700', bgLight: 'bg-teal-50' },
    { key: 'reports', title: 'التقارير العامة', desc: 'أرشيف وسجلات', icon: BarChart2, path: '/staff/reports', color: 'bg-amber-600', textColor: 'text-amber-700', bgLight: 'bg-amber-50' }
  ];

  // 4. Specialized Roles
  const specializedCards = [
    { key: 'students', title: 'الموجه الطلابي', desc: 'إرشاد وتوجيه', icon: BookUser, path: '/staff/students', color: 'bg-purple-600', textColor: 'text-purple-700', bgLight: 'bg-purple-50' },
    { key: 'deputy', title: 'وكيل الشؤون', desc: 'انضباط ومخالفات', icon: Briefcase, path: '/staff/deputy', color: 'bg-red-600', textColor: 'text-red-700', bgLight: 'bg-red-50' },
  ];

  const renderCard = (card: any) => (
    <button key={card.key} onClick={() => navigate(card.path)} className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 text-right flex flex-col h-full hover:-translate-y-1 relative overflow-hidden">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${card.bgLight} ${card.textColor} group-hover:scale-110 transition-transform`}>
            <card.icon size={24} />
        </div>
        <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">{card.title}</h3>
        <p className="text-[10px] text-slate-400 mt-1">{card.desc}</p>
    </button>
  );

  return (
    <div className="space-y-8 animate-fade-in py-6 relative max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border border-slate-100 relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="relative z-10 text-center md:text-right">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">أهلاً، <span className="text-blue-600">{user.name}</span></h1>
            <p className="text-slate-500 font-medium">
                {isTeacher ? 'لوحة القيادة الصفية المتكاملة 📚' : 'إدارة العمليات المدرسية بكفاءة 🚀'}
            </p>
        </div>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm animate-fade-in-up">
              <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-3 text-sm"><BellRing size={18}/> تنبيهات هامة ({notifications.length})</h3>
              <div className="grid gap-2">{notifications.map(n => (<div key={n.id} className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center"><span className="text-sm font-bold text-slate-800">{n.message}</span><button onClick={() => handleMarkRead(n.id)} className="text-[10px] bg-amber-100 text-amber-800 px-3 py-1 rounded-lg">تم</button></div>))}</div>
          </div>
      )}

      {/* SECTION 1: ACADEMIC & CLASSROOM (TEACHER ONLY) */}
      {isTeacher && (
          <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
                  <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><PenTool size={18}/></div>
                  الإدارة الصفية والأكاديمية
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {academicCards.map(renderCard)}
              </div>
          </div>
      )}

      {/* SECTION 2: OFFICIAL TASKS */}
      <div className="animate-fade-in">
          <h2 className="text-lg font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
              <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600"><Layout size={18}/></div>
              المهام الإدارية واليومية
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {adminCards.filter(c => perms.includes(c.key) || isTeacher).map(renderCard)}
          </div>
      </div>

      {/* SECTION 3: ANALYTICS & STRATEGY */}
      {(isTeacher || perms.includes('reports')) && (
          <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
                  <div className="bg-teal-100 p-1.5 rounded-lg text-teal-600"><TrendingUp size={18}/></div>
                  التحليل والتقارير
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {analyticsCards.filter(c => 
                      (c.key === 'teacher_analysis' && isTeacher) || 
                      (c.key === 'reports' && perms.includes('reports'))
                  ).map(renderCard)}
              </div>
          </div>
      )}

      {/* SECTION 4: SPECIALIZED ROLES */}
      {specializedCards.some(c => perms.includes(c.key)) && (
          <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
                  <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600"><Layers size={18}/></div>
                  أدوات إدارية تخصصية
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {specializedCards.filter(c => perms.includes(c.key)).map(renderCard)}
              </div>
          </div>
      )}

      {/* Weekly Chart */}
      {chartData.some(d => d.present + d.absent > 0) && (
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mt-8">
              <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={20} className="text-blue-500"/> إحصائيات الأسبوع</h2>
              <div className="h-64 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barSize={20}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                          <XAxis dataKey="name" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)'}} cursor={{fill:'#f8fafc'}}/>
                          <Bar dataKey="present" fill="#10b981" radius={[4,4,0,0]} name="حضور"/>
                          <Bar dataKey="absent" fill="#ef4444" radius={[4,4,0,0]} name="غياب"/>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>
      )}
    </div>
  );
};

export default StaffHome;
