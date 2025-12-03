
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Award, AlertTriangle, School, BookOpen, Clock, ArrowUpRight, ArrowDownRight, LayoutDashboard } from 'lucide-react';
import { getTeacherPerformanceStats, getAttendanceRecords, getStaffUsers } from '../../services/storage';
import { StaffUser, AttendanceStatus } from '../../types';

const TeacherAnalysis: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison'>('overview');

  useEffect(() => {
    const loadStats = async () => {
        setLoading(true);
        const session = localStorage.getItem('ozr_staff_session');
        if (!session) return;
        const user: StaffUser = JSON.parse(session);
        const assignments = user.assignments || [];

        try {
            // 1. Fetch all historical data relevant to this teacher
            // We fetch all records and filter in memory for simplicity in this context
            const [allPerformance, allAttendance] = await Promise.all([
                getTeacherPerformanceStats(), // Fetches from class_performance table
                getAttendanceRecords()        // Fetches from attendance table
            ]);

            // 2. Aggregate Data per Class
            const classStats = assignments.map(cls => {
                // Filter Attendance Records for this class
                const classAttRecords = allAttendance.filter(r => r.grade === cls.grade && r.className === cls.className);
                
                let totalStudentsDays = 0;
                let presentCount = 0;
                let lateCount = 0;
                
                classAttRecords.forEach(r => {
                    r.records.forEach(stu => {
                        totalStudentsDays++;
                        if (stu.status === AttendanceStatus.PRESENT) presentCount++;
                        if (stu.status === AttendanceStatus.LATE) lateCount++;
                    });
                });

                // Filter Performance Records for this class
                const classPerfRecords = allPerformance.filter(r => r.grade === cls.grade && r.className === cls.className);
                
                let totalParticipationScore = 0;
                let homeworkCount = 0;
                let performanceEntries = classPerfRecords.length;

                classPerfRecords.forEach(p => {
                    totalParticipationScore += (p.participationScore || 0);
                    if (p.homeworkStatus) homeworkCount++;
                });

                // Calculate Metrics
                const attendanceRate = totalStudentsDays > 0 ? Math.round((presentCount / totalStudentsDays) * 100) : 0;
                const participationAvg = performanceEntries > 0 ? Math.round((totalParticipationScore / (performanceEntries * 5)) * 100) : 0; // Assuming 5 is max score
                const homeworkRate = performanceEntries > 0 ? Math.round((homeworkCount / performanceEntries) * 100) : 0;

                // Overall Score (Weighted)
                const overallScore = Math.round((attendanceRate * 0.4) + (participationAvg * 0.4) + (homeworkRate * 0.2));

                return {
                    id: `${cls.grade}-${cls.className}`,
                    name: `${cls.grade} (${cls.className})`,
                    attendanceRate,
                    participationAvg,
                    homeworkRate,
                    overallScore,
                    totalClasses: classAttRecords.length
                };
            });

            // 3. Find Top/Bottom Classes
            const sortedByScore = [...classStats].sort((a, b) => b.overallScore - a.overallScore);
            const topClass = sortedByScore[0];
            const lowestClass = sortedByScore[sortedByScore.length - 1];

            setAnalytics({
                classStats,
                topClass,
                lowestClass,
                totalClassesAssigned: assignments.length
            });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadStats();
  }, []);

  if (loading) return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
          <LayoutDashboard size={48} className="mb-4 animate-pulse opacity-20"/>
          <p className="font-bold">جاري معالجة البيانات وتحليل الأداء...</p>
      </div>
  );

  if (!analytics || analytics.classStats.length === 0) return (
      <div className="p-10 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
          <School size={48} className="mx-auto mb-4 opacity-20"/>
          <p>لا توجد بيانات كافية للتحليل بعد.</p>
          <p className="text-sm mt-2">ابدأ برصد الحضور والمتابعة اليومية لتظهر الإحصائيات هنا.</p>
      </div>
  );

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <TrendingUp className="text-emerald-400"/> لوحة التحليل الاستراتيجي
                        </h1>
                        <p className="text-slate-300 opacity-90 max-w-lg">
                            نظرة شاملة منفصلة عن السجلات اليومية، تساعدك على فهم اتجاهات الفصول وتحديد نقاط القوة والضعف بناءً على البيانات التاريخية.
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 hidden md:block">
                        <p className="text-xs text-slate-400 uppercase font-bold mb-1">الفصول الخاضعة للتحليل</p>
                        <p className="text-2xl font-black text-white">{analytics.totalClassesAssigned}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Top Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analytics.topClass && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">الفصل المتميز (الأعلى أداءً)</p>
                            <h3 className="text-2xl font-black text-slate-800">{analytics.topClass.name}</h3>
                        </div>
                        <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <Award size={28}/>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 w-fit px-3 py-1 rounded-lg">
                        <ArrowUpRight size={16}/> 
                        {analytics.topClass.overallScore}% إجمالي النقاط
                    </div>
                </div>
            )}

            {analytics.lowestClass && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">يحتاج إلى دعم (الأقل أداءً)</p>
                            <h3 className="text-2xl font-black text-slate-800">{analytics.lowestClass.name}</h3>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                            <AlertTriangle size={28}/>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-700 bg-amber-50 w-fit px-3 py-1 rounded-lg">
                        <ArrowDownRight size={16}/> 
                        {analytics.lowestClass.overallScore}% إجمالي النقاط
                    </div>
                </div>
            )}
        </div>

        {/* Detailed Analytics */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                    <Users className="text-indigo-600"/> مقارنة أداء الفصول الدراسية
                </h3>
                <div className="flex bg-slate-50 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>نظرة عامة</button>
                    <button onClick={() => setActiveTab('comparison')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'comparison' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>تفصيل المعايير</button>
                </div>
            </div>

            <div className="h-[350px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.classStats} barSize={30}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} domain={[0, 100]}/>
                        <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                            cursor={{fill: '#f8fafc'}}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} iconType="circle"/>
                        
                        {activeTab === 'overview' ? (
                            <Bar dataKey="overallScore" name="التقييم العام" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        ) : (
                            <>
                                <Bar dataKey="attendanceRate" name="نسبة الحضور" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="participationAvg" name="التفاعل الصفي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="homeworkRate" name="إنجاز الواجبات" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </>
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {analytics.classStats.map((cls: any, idx: number) => (
                <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-slate-800">{cls.name}</h4>
                        <div className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full font-bold text-xs text-slate-500">{idx + 1}</div>
                    </div>
                    
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1 font-medium">
                                <span className="text-slate-500">الحضور</span>
                                <span className="text-emerald-600">{cls.attendanceRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{width: `${cls.attendanceRate}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1 font-medium">
                                <span className="text-slate-500">التفاعل</span>
                                <span className="text-amber-600">{cls.participationAvg}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full" style={{width: `${cls.participationAvg}%`}}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1 font-medium">
                                <span className="text-slate-500">الواجبات</span>
                                <span className="text-blue-600">{cls.homeworkRate}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{width: `${cls.homeworkRate}%`}}></div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default TeacherAnalysis;
