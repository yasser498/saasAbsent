
import React, { useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { 
  ShieldCheck, ArrowLeft, School, Plus, Search, Sparkles, 
  BarChart2, Globe, Activity, CheckCircle, ArrowRight
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
      if (!schoolCode.trim()) return;
      setLoading(true);
      setError('');
      try {
          const school = await loginSchool(schoolCode.trim().toUpperCase());
          if (school) {
              setActiveSchool(school);
              navigate(`/s/${school.schoolCode}`); 
          } else {
              setError('كود المدرسة غير صحيح، يرجى التأكد والمحاولة مرة أخرى.');
          }
      } catch (err) {
          setError('حدث خطأ في الاتصال بالقاعدة.');
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
          const school = await registerSchool(regName, regCode.toUpperCase(), regPassword);
          setActiveSchool(school);
          navigate(`/s/${school.schoolCode}`);
      } catch (err: any) {
          setError(err.message || 'فشل إنشاء المدرسة، قد يكون الكود مستخدماً.');
      } finally {
          setRegLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-white relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      
      {!isConfigured && (
        <div className="bg-amber-500 text-black font-bold text-center p-3 text-sm sticky top-0 z-[100] animate-pulse">
            تنبيه: قاعدة البيانات غير مرتبطة. يرجى إعداد Supabase أولاً.
        </div>
      )}

      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-blob"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[120px] animate-blob animation-delay-2000"></div>
          <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000"></div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-50 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('landing')}>
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <ShieldCheck size={24} className="text-white"/>
              </div>
              <span className="font-bold text-2xl tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">نظام عذر</span>
          </div>
          <div className="flex gap-4">
              {view === 'landing' && (
                  <div className="flex gap-3">
                    <button onClick={() => setView('find')} className="hidden md:flex px-5 py-2.5 rounded-full text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                        تسجيل دخول
                    </button>
                    <button onClick={() => setView('register')} className="bg-white text-slate-900 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-indigo-500/20 transform hover:-translate-y-0.5">
                        ابدأ مجاناً
                    </button>
                  </div>
              )}
              {view !== 'landing' && (
                  <button onClick={() => setView('landing')} className="text-sm font-bold text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                      <ArrowLeft size={18}/> عودة للرئيسية
                  </button>
              )}
          </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-10 pb-20 flex flex-col items-center justify-center min-h-[75vh]">
          
          {/* VIEW: LANDING */}
          {view === 'landing' && (
              <div className="text-center max-w-5xl mx-auto space-y-8 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-indigo-300 backdrop-blur-md shadow-sm animate-float">
                      <Sparkles size={14}/> <span>الجيل الجديد من الإدارة المدرسية</span>
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
                      إدارة مدرسية ذكية، <br/>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">بدون تعقيد.</span>
                  </h1>
                  
                  <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto font-light">
                      منصة سحابية متكاملة تمنحك السيطرة الكاملة على الحضور، السلوك، والتواصل المدرسي في مكان واحد. صمم مدرستك الرقمية في ثوانٍ.
                  </p>
                  
                  <div className="flex flex-col md:flex-row gap-4 justify-center pt-8">
                      <button onClick={() => setView('register')} className="group bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all hover:bg-indigo-500 hover:scale-105 shadow-xl shadow-indigo-600/30">
                          <Plus size={20}/> <span>أنشئ مدرستك الآن</span> <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                      </button>
                      <button onClick={() => setView('find')} className="group bg-slate-800/50 text-white border border-white/10 px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all hover:bg-slate-800 hover:border-white/20 backdrop-blur-sm">
                          <Search size={20}/> <span>البحث عن مدرسة</span>
                      </button>
                  </div>

                  {/* Feature Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-right mt-24">
                      {[
                          {icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10', title: 'رصد لحظي', desc: 'متابعة الحضور والغياب والمخالفات بضغطة زر مع تنبيهات فورية.'},
                          {icon: Globe, color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'بوابة موحدة', desc: 'رابط خاص بمدرستك يجمع المعلمين، الطلاب، وأولياء الأمور.'},
                          {icon: BarChart2, color: 'text-pink-400', bg: 'bg-pink-500/10', title: 'تحليل ذكي', desc: 'تقارير مدعومة بالذكاء الاصطناعي تساعدك في اتخاذ القرار.'}
                      ].map((feature, idx) => (
                          <div key={idx} className="glass-card p-8 rounded-3xl hover:bg-white/5 transition-colors group text-center md:text-right">
                              <div className={`w-14 h-14 ${feature.bg} rounded-2xl flex items-center justify-center ${feature.color} mb-6 mx-auto md:mx-0 group-hover:scale-110 transition-transform duration-300`}>
                                  <feature.icon size={28}/>
                              </div>
                              <h3 className="font-bold text-xl mb-3 text-white">{feature.title}</h3>
                              <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* VIEW: FIND SCHOOL */}
          {view === 'find' && (
              <div className="w-full max-w-md glass-card p-10 rounded-[2.5rem] animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                  
                  <div className="text-center mb-10">
                      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-600/30 rotate-3">
                          <School size={40} className="text-white"/>
                      </div>
                      <h2 className="text-3xl font-bold mb-2">ابحث عن مدرستك</h2>
                      <p className="text-slate-400 text-sm">أدخل كود المدرسة للدخول إلى البوابة</p>
                  </div>

                  <form onSubmit={handleFindSchool} className="space-y-6">
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">كود المدرسة</label>
                          <div className="relative group">
                              <input 
                                  value={schoolCode}
                                  onChange={e => setSchoolCode(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-4 px-4 pl-12 text-center font-mono text-2xl font-bold tracking-[0.2em] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-700 uppercase text-white shadow-inner"
                                  placeholder="CODE"
                                  autoFocus
                              />
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={24}/>
                          </div>
                      </div>

                      {error && (
                          <div className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-pulse">
                              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                              {error}
                          </div>
                      )}

                      <button disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group">
                          {loading ? 'جاري البحث...' : <>الذهاب للمدرسة <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/></>}
                      </button>
                  </form>
              </div>
          )}

          {/* VIEW: REGISTER */}
          {view === 'register' && (
              <div className="w-full max-w-lg glass-card p-10 rounded-[2.5rem] animate-fade-in relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>

                  <div className="text-center mb-8">
                      <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-600/30 -rotate-3">
                          <Plus size={40} className="text-white"/>
                      </div>
                      <h2 className="text-3xl font-bold mb-2">تأسيس مدرسة جديدة</h2>
                      <p className="text-slate-400 text-sm">ابدأ رحلتك الرقمية الآن مجاناً</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-5">
                      <div className="space-y-1">
                          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">اسم المدرسة الرسمي</label>
                          <input 
                              value={regName}
                              onChange={e => setRegName(e.target.value)}
                              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3.5 px-5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                              placeholder="مثال: مدارس الأفق العالمية"
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">كود الدخول (إنجليزي)</label>
                              <input 
                                  value={regCode}
                                  onChange={e => setRegCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3.5 px-5 font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-center uppercase tracking-widest placeholder:text-slate-600"
                                  placeholder="CODE"
                                  maxLength={8}
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">كلمة مرور المدير</label>
                              <input 
                                  type="password" 
                                  value={regPassword}
                                  onChange={e => setRegPassword(e.target.value)}
                                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3.5 px-5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-center tracking-widest placeholder:text-slate-600"
                                  placeholder="••••••"
                              />
                          </div>
                      </div>

                      <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 flex items-start gap-3">
                          <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={18}/>
                          <div>
                              <p className="text-xs text-emerald-200 font-bold mb-1">رابط مدرستك سيكون:</p>
                              <p className="text-xs font-mono text-emerald-100 dir-ltr">app.domain.com/s/{regCode || 'CODE'}</p>
                          </div>
                      </div>

                      {error && (
                          <div className="flex items-center gap-3 text-red-400 text-sm bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-pulse">
                              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                              {error}
                          </div>
                      )}

                      <button disabled={regLoading} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2 group flex items-center justify-center gap-2">
                          {regLoading ? 'جاري الإنشاء...' : <>تأكيد وإنشاء المدرسة <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/></>}
                      </button>
                  </form>
              </div>
          )}

      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 text-slate-500 text-xs font-bold border-t border-white/5 bg-slate-900/50 backdrop-blur-xl">
          <p>© {new Date().getFullYear()} نظام عذر للإدارة المدرسية الذكية. جميع الحقوق محفوظة.</p>
      </footer>
    </div>
  );
};

export default Home;
