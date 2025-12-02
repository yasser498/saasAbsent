
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight, KeyRound, Loader2, Briefcase, School as SchoolIcon, Search, AlertCircle } from 'lucide-react';
import { authenticateStaff, getActiveSchool, loginSchool, setActiveSchool } from '../../services/storage';
import { School } from '../../types';

const { useNavigate, useSearchParams } = ReactRouterDOM as any;

const StaffLogin: React.FC = () => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [currentSchool, setCurrentSchool] = useState<School | null>(null);
  const [searchCode, setSearchCode] = useState(''); // For manual school search
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 1. Detect School from Context or URL
  useEffect(() => {
      const initSchool = async () => {
          setSchoolLoading(true);
          
          // A. Check URL for Magic Link (?code=ZENKI)
          const urlCode = searchParams.get('code');
          if (urlCode) {
              try {
                  const school = await loginSchool(urlCode);
                  if (school) {
                      setActiveSchool(school);
                      setCurrentSchool(school);
                      setSchoolLoading(false);
                      return;
                  }
              } catch (e) {
                  console.error("Invalid magic link");
              }
          }

          // B. Check Local Storage
          const active = getActiveSchool();
          if (active) {
              setCurrentSchool(active);
          }
          
          setSchoolLoading(false);
      };

      initSchool();
  }, [searchParams]);

  // Check if already logged in as staff
  useEffect(() => {
      const session = localStorage.getItem('ozr_staff_session');
      if (session) {
          navigate('/staff/home', { replace: true });
      }
  }, [navigate]);

  const handleManualSchoolSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      setSchoolLoading(true);
      setError('');
      try {
          const school = await loginSchool(searchCode.trim());
          if (school) {
              setActiveSchool(school);
              setCurrentSchool(school);
          } else {
              setError('لم يتم العثور على مدرسة بهذا الكود.');
          }
      } catch (err) {
          setError('حدث خطأ في الاتصال.');
      } finally {
          setSchoolLoading(false);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      const user = await authenticateStaff(passcode.trim());
      if (user) {
        localStorage.setItem('ozr_staff_session', JSON.stringify(user));
        navigate('/staff/home', { replace: true });
      } else {
        setError('رمز الدخول غير صحيح');
      }
    } catch (e) {
      setError('حدث خطأ في الاتصال، حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeSchool = () => {
      localStorage.removeItem('active_school');
      localStorage.removeItem('school_name');
      localStorage.removeItem('school_logo');
      setCurrentSchool(null);
      setSearchCode('');
  };

  if (schoolLoading) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={32}/>
          </div>
      );
  }

  // --- VIEW 1: NO SCHOOL SELECTED (Search View) ---
  if (!currentSchool) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans relative">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
            </div>
            
            <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <SchoolIcon size={32} className="text-blue-900"/>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">بوابة المنسوبين</h1>
                <p className="text-blue-200 text-sm mb-8">يرجى تحديد المدرسة للمتابعة</p>

                <form onSubmit={handleManualSchoolSearch} className="space-y-4">
                    <div className="relative">
                        <input 
                            value={searchCode}
                            onChange={e => setSearchCode(e.target.value)}
                            className="w-full py-4 pl-4 pr-12 bg-slate-800/50 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold tracking-widest text-lg"
                            placeholder="أدخل كود المدرسة"
                            autoFocus
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                    </div>
                    {error && <p className="text-red-400 text-xs bg-red-900/20 py-2 rounded-lg">{error}</p>}
                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg">
                        متابعة
                    </button>
                </form>
                
                <p className="text-xs text-slate-500 mt-6">
                    نصيحة: اطلب من مدير النظام إرسال "رابط الدخول المباشر" لتجنب هذه الخطوة مستقبلاً.
                </p>
            </div>
        </div>
      );
  }

  // --- VIEW 2: SCHOOL SELECTED (Login View) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
          <div className="absolute top-1/2 -right-20 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
          {/* Dynamic Logo Area */}
          <div className="text-center mb-8 animate-fade-in-up">
              <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl mx-auto mb-6 flex items-center justify-center p-4 border border-slate-100 rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img src={currentSchool.logoUrl || "https://www.raed.net/img?id=1471924"} alt="School Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-800">{currentSchool.name}</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-slate-500 text-sm">بوابة المنسوبين</span>
                  <button onClick={handleChangeSchool} className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">تغيير</button>
              </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-8 md:p-10 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
              
              <div className="flex items-center gap-3 mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="bg-white p-2 rounded-xl text-emerald-600 shadow-sm">
                      <Briefcase size={20} />
                  </div>
                  <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase">منطقة آمنة</p>
                      <p className="text-[10px] text-emerald-600">أهلاً بك، يرجى إدخال رمزك التعريفي</p>
                  </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                      <div className="relative">
                          <input 
                              type="password" 
                              value={passcode}
                              onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                              className="w-full py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-center text-3xl font-bold text-slate-800 tracking-[0.5em] font-mono placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans shadow-inner placeholder:text-sm"
                              placeholder="الرمز السري"
                              maxLength={20}
                              autoFocus
                              disabled={loading}
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                              <KeyRound size={20} />
                          </div>
                      </div>
                      {error && (
                          <div className="flex items-center gap-2 text-red-500 text-xs font-bold justify-center bg-red-50 py-2 rounded-lg animate-pulse">
                              <AlertCircle size={14}/> {error}
                          </div>
                      )}
                  </div>

                  <button 
                      type="submit"
                      disabled={loading || !passcode}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all hover:shadow-xl hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                      {loading ? <Loader2 className="animate-spin" /> : 'تسجيل الدخول'}
                  </button>
              </form>
          </div>

          <div className="mt-8 text-center">
             <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-600 text-sm font-bold flex items-center justify-center gap-2 w-full transition-colors">
               <ArrowRight size={16}/> العودة للصفحة الرئيسية
             </button>
          </div>
      </div>
    </div>
  );
};

export default StaffLogin;
