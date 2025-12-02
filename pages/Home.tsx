
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  ShieldCheck, ArrowLeft, School, Plus, LogIn, Search, CheckCircle, 
  LayoutGrid, Users, Activity, BarChart2, Briefcase, Globe, Lock, Sparkles, AlertTriangle
} from 'lucide-react';
import { loginSchool, registerSchool, setActiveSchool } from '../services/storage';
import { isConfigured } from '../supabaseClient';

const { useNavigate } = ReactRouterDOM as any;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'landing' | 'find' | 'register'>('landing');
  
  // Find School State
  const [schoolCode, setSchoolCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleFindSchool = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError('');
      try {
          const school = await loginSchool(schoolCode.trim());
          if (school) {
              setActiveSchool(school);
              navigate(`/s/${school.schoolCode}`); 
          } else {
              setError('كود المدرسة غير صحيح.');
          }
      } catch (err) {
          setError('حدث خطأ في الاتصال.');
      } finally {
          setLoading(false);
      }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regCode || !regPassword) return;
      setRegLoading(true);
      setError('');
      try {
          const school = await registerSchool(regName, regCode, regPassword);
          setActiveSchool(school);
          alert(`تم إنشاء مدرسة "${school.name}" بنجاح!`);
          navigate(`/s/${school.schoolCode}`);
      } catch (err: any) {
          setError(err.message || 'فشل إنشاء المدرسة.');
      } finally {
          setRegLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-white relative overflow-hidden selection:bg-purple-500 selection:text-white">
      
      {!isConfigured && (
        <div className="bg-amber-500 text-black font-bold text-center p-3 text-sm flex items-center justify-center gap-2 sticky top-0 z-[100]">
            <AlertTriangle size={18}/>
            <span>تنبيه: لم يتم ربط قاعدة البيانات Supabase. يرجى إضافة المفاتيح في ملف <code>supabaseClient.ts</code> لتفعيل النظام.</span>
        </div>
      )}

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-50 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('landing')}>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ShieldCheck size={24} className="text-white"/>
              </div>
              <span className="font-bold text-xl tracking-wide">نظام عذر</span>
          </div>
          <div className="flex gap-4">
              {view === 'landing' && (
                  <>
                    <button onClick={() => setView('find')} className="text-sm font-bold text-slate-300 hover:text-white transition-colors">ابحث عن مدرستك</button>
                    <button onClick={() => setView('register')} className="bg-white text-slate-900 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-200 transition-colors">اشترك الآن</button>
                  </>
              )}
              {view !== 'landing' && (
                  <button onClick={() => setView('landing')} className="text-sm font-bold text-slate-400 hover:text-white flex items-center gap-2"><ArrowLeft size={16}/> عودة</button>
              )}
          </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-20 flex flex-col items-center justify-center min-h-[80vh]">
          
          {/* VIEW: LANDING */}
          {view === 'landing' && (
              <div className="text-center max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-purple-300 backdrop-blur-sm">
                      <Sparkles size={14}/> <span>منصة SaaS التعليمية المتكاملة</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
                      إدارة مدرسية ذكية <br/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">بلمسة واحدة</span>
                  </h1>
                  <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
                      أنشئ نظام مدرستك الخاص في ثوانٍ. بوابة موحدة للموظفين، الطلاب، وأولياء الأمور مع تحليلات ذكية.
                  </p>
                  
                  <div className="flex flex-wrap gap-4 justify-center pt-8">
                      <button onClick={() => setView('register')} className="group bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all hover:bg-blue-500 hover:scale-105 shadow-lg shadow-blue-600/30">
                          <Plus size={20}/> <span>سجل مدرستك مجاناً</span>
                      </button>
                      <button onClick={() => setView('find')} className="group bg-white/10 text-white border border-white/10 px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all hover:bg-white/20 backdrop-blur-sm">
                          <Search size={20}/> <span>ابحث عن مدرستك</span>
                      </button>
                  </div>

                  {/* Feature Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-20">
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                          <div className="bg-blue-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-blue-400 mb-4"><Activity size={24}/></div>
                          <h3 className="font-bold text-lg mb-2">رصد ذكي</h3>
                          <p className="text-sm text-slate-400">متابعة الحضور والغياب والسلوك لحظياً مع إشعارات تلقائية.</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                          <div className="bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-purple-400 mb-4"><Globe size={24}/></div>
                          <h3 className="font-bold text-lg mb-2">رابط موحد</h3>
                          <p className="text-sm text-slate-400">صفحة هبوط خاصة لكل مدرسة (YourSchool.com/s/Code).</p>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors">
                          <div className="bg-pink-500/20 w-12 h-12 rounded-xl flex items-center justify-center text-pink-400 mb-4"><BarChart2 size={24}/></div>
                          <h3 className="font-bold text-lg mb-2">تقارير AI</h3>
                          <p className="text-sm text-slate-400">تحليلات مدعومة بالذكاء الاصطناعي لصنع القرار.</p>
                      </div>
                  </div>
              </div>
          )}

          {/* VIEW: FIND SCHOOL */}
          {view === 'find' && (
              <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl animate-fade-in shadow-2xl">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/40">
                          <School size={32} className="text-white"/>
                      </div>
                      <h2 className="text-2xl font-bold">ابحث عن مدرستك</h2>
                      <p className="text-slate-400 text-sm mt-1">أدخل كود المدرسة للذهاب لصفحتها الرئيسية</p>
                  </div>

                  <form onSubmit={handleFindSchool} className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">كود المدرسة</label>
                          <div className="relative">
                              <input 
                                  value={schoolCode}
                                  onChange={e => setSchoolCode(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-4 px-4 pl-12 text-center font-mono text-xl font-bold tracking-widest outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 uppercase"
                                  placeholder="CODE"
                                  autoFocus
                              />
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20}/>
                          </div>
                      </div>

                      {error && <p className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}

                      <button disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                          {loading ? 'جاري البحث...' : 'الذهاب للمدرسة'}
                      </button>
                  </form>
              </div>
          )}

          {/* VIEW: REGISTER */}
          {view === 'register' && (
              <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl animate-fade-in shadow-2xl">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/40">
                          <Plus size={32} className="text-white"/>
                      </div>
                      <h2 className="text-2xl font-bold">إنشاء مدرسة جديدة</h2>
                      <p className="text-slate-400 text-sm mt-1">ابدأ رحلتك الرقمية الآن مجاناً</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">اسم المدرسة</label>
                          <input 
                              value={regName}
                              onChange={e => setRegName(e.target.value)}
                              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                              placeholder="مثال: مدارس الأفق العالمية"
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">كود الدخول (إنجليزي)</label>
                              <input 
                                  value={regCode}
                                  onChange={e => setRegCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 font-mono outline-none focus:border-emerald-500 transition-all text-center uppercase"
                                  placeholder="CODE"
                                  maxLength={8}
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">كلمة مرور المدير</label>
                              <input 
                                  type="password" 
                                  value={regPassword}
                                  onChange={e => setRegPassword(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:border-emerald-500 transition-all text-center"
                                  placeholder="••••••"
                              />
                          </div>
                      </div>

                      <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-xs text-emerald-200">
                          <p>سيكون رابط مدرستك: <strong>YourApp.com/s/{regCode || 'CODE'}</strong></p>
                      </div>

                      {error && <p className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}

                      <button disabled={regLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                          {regLoading ? 'جاري الإنشاء...' : 'تأكيد التسجيل'}
                      </button>
                  </form>
              </div>
          )}

      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-slate-500 text-xs font-bold border-t border-white/5">
          <p>© {new Date().getFullYear()} نظام عذر للإدارة المدرسية الذكية. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
};

export default Home;
