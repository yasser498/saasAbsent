
import React, { useState, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Lock, ArrowRight, ShieldCheck, Loader2, KeyRound, LayoutGrid } from 'lucide-react';
import { verifySchoolAdminPassword, getActiveSchool } from '../../services/storage';

const { useNavigate } = ReactRouterDOM as any;

const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const activeSchool = getActiveSchool();
  const SCHOOL_NAME = activeSchool?.name || "النظام المدرسي";
  const SCHOOL_LOGO = activeSchool?.logoUrl;

  useEffect(() => {
      if (!activeSchool) {
          navigate('/');
      }
  }, [activeSchool, navigate]);

  useEffect(() => {
      const session = localStorage.getItem('ozr_admin_session');
      if (session) {
          navigate('/admin/dashboard', { replace: true });
      }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchool) return;
    
    setIsLoading(true);
    setError('');
    
    try {
        const isValid = await verifySchoolAdminPassword(activeSchool.id, password);
        
        if (isValid) {
            localStorage.setItem('ozr_admin_session', 'true');
            navigate('/admin/dashboard', { replace: true });
        } else {
            setError('كلمة المرور غير صحيحة');
        }
    } catch (e) {
        setError('حدث خطأ في التحقق.');
    } finally {
        setIsLoading(false);
    }
  };

  if (!activeSchool) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-6xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] animate-fade-in border border-slate-100">
        
        {/* Left Side: Visual Identity */}
        <div className="md:w-1/2 bg-slate-900 relative p-12 flex flex-col justify-between text-white overflow-hidden">
            {/* Animated Background */}
            <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-blob"></div>
            <div className="absolute bottom-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

            <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 mb-8 shadow-lg">
                    <LayoutGrid size={32} className="text-blue-300" />
                </div>
                <h2 className="text-4xl font-black mb-4 leading-tight">مركز القيادة <br/>والتحكم المدرسي</h2>
                <p className="text-slate-400 text-lg leading-relaxed max-w-md font-light">
                    منصة متكاملة لإدارة العمليات المدرسية، تحليل البيانات، واتخاذ القرارات المدعومة بالذكاء الاصطناعي.
                </p>
            </div>

            <div className="relative z-10 mt-12 md:mt-0 flex items-center gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                {SCHOOL_LOGO ? (
                    <img src={SCHOOL_LOGO} alt="School Logo" className="w-12 h-12 object-contain bg-white rounded-xl p-1" />
                ) : (
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-900 font-bold">
                        {SCHOOL_NAME.charAt(0)}
                    </div>
                )}
                <div>
                    <p className="font-bold text-sm text-white">{SCHOOL_NAME}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">الإصدار المؤسسي V3.0</p>
                </div>
            </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white relative">
            <div className="max-w-sm mx-auto w-full">
                <div className="mb-10 text-center md:text-right">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">تسجيل دخول المدير</h1>
                    <p className="text-slate-500 text-sm">مرحباً بك، يرجى إدخال كلمة المرور للمتابعة.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider block">كلمة المرور</label>
                        <div className="relative group">
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className="w-full pl-4 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:bg-white focus:border-slate-900 focus:ring-0 outline-none transition-all text-lg font-bold text-slate-800 placeholder:text-slate-300 tracking-widest text-center"
                                placeholder="••••••••"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
                                <KeyRound size={20} />
                            </div>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-xs font-bold bg-red-50 p-3 rounded-xl animate-fade-in border border-red-100">
                                <ShieldCheck size={14} />
                                {error}
                            </div>
                        )}
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <>الدخول للنظام <ArrowRight size={20} className="group-hover:-translate-x-1 transition-transform" /></>}
                    </button>
                </form>

                <div className="mt-12 text-center border-t border-slate-50 pt-6">
                    <button onClick={() => navigate('/inquiry')} className="text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors flex items-center justify-center gap-2 mx-auto group">
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform rotate-180" /> 
                        العودة للبوابة الرئيسية
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
