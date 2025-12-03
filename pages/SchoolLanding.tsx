
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getSchoolByCodePublic, setActiveSchool } from '../services/storage';
import { School } from '../types';
import { Loader2, ShieldCheck, Users, Briefcase, School as SchoolIcon, Share2, ArrowLeft } from 'lucide-react';

const { useParams, useNavigate } = ReactRouterDOM as any;

const SchoolLanding: React.FC = () => {
    const { schoolCode } = useParams();
    const navigate = useNavigate();
    const [school, setSchool] = useState<School | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSchool = async () => {
            if (!schoolCode) return;
            try {
                const data = await getSchoolByCodePublic(schoolCode.toUpperCase());
                if (data) {
                    setSchool(data);
                    setActiveSchool(data); // Set context immediately
                } else {
                    setError('المدرسة غير موجودة، تأكد من الكود.');
                }
            } catch (err) {
                setError('حدث خطأ أثناء الاتصال بالخادم.');
            } finally {
                setLoading(false);
            }
        };
        fetchSchool();
    }, [schoolCode]);

    const copyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        alert('تم نسخ رابط المدرسة، يمكنك مشاركته الآن.');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="text-slate-500 font-bold animate-pulse">جاري تحميل بوابة المدرسة...</p>
            </div>
        );
    }

    if (error || !school) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-md w-full border border-slate-100">
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500 animate-bounce">
                        <SchoolIcon size={48} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 mb-2">عفواً</h1>
                    <p className="text-slate-500 mb-8 font-medium">{error || 'لم يتم العثور على المدرسة'}</p>
                    <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold w-full hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft size={20}/> العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans relative overflow-hidden flex flex-col">
            {/* Background Header */}
            <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-b-[4rem] shadow-2xl z-0 overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            </div>

            <div className="relative z-10 flex-1 flex flex-col justify-center max-w-5xl mx-auto px-6 py-12 w-full">
                
                {/* School Identity */}
                <div className="text-center mb-16 animate-fade-in-up">
                    <div className="w-36 h-36 bg-white rounded-[2.5rem] shadow-2xl mx-auto mb-8 flex items-center justify-center p-6 border-4 border-white/10 backdrop-blur-md relative group rotate-3 hover:rotate-0 transition-transform duration-500">
                        {school.logoUrl ? (
                            <img src={school.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <SchoolIcon size={64} className="text-slate-300" />
                        )}
                        <button 
                            className="absolute -bottom-4 -right-4 bg-white text-slate-800 p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-50 hover:text-blue-600 hover:scale-110" 
                            onClick={copyLink}
                            title="مشاركة الرابط"
                        >
                            <Share2 size={20} />
                        </button>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight drop-shadow-lg">{school.name}</h1>
                    <p className="text-blue-200 text-lg md:text-xl font-medium opacity-90">بوابة الخدمات الإلكترونية الموحدة</p>
                </div>

                {/* Portals Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-2000">
                    
                    {/* Staff Portal */}
                    <div 
                        onClick={() => navigate('/staff/login')}
                        className="bg-white rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl border border-slate-100 cursor-pointer group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-100 transition-colors"></div>
                        <div className="relative z-10 flex flex-col items-center text-center h-full justify-center gap-4">
                            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-blue-200">
                                <Briefcase size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">بوابة المنسوبين</h2>
                                <p className="text-sm text-slate-500 font-medium">المعلمين والإداريين</p>
                            </div>
                        </div>
                    </div>

                    {/* Parents Portal (Featured) */}
                    <div 
                        onClick={() => navigate('/inquiry')}
                        className="bg-gradient-to-b from-white to-purple-50 rounded-[2.5rem] p-8 shadow-2xl hover:shadow-purple-200/50 border-2 border-purple-100 cursor-pointer group hover:-translate-y-3 transition-all duration-300 relative overflow-hidden transform md:-mt-8"
                    >
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                        <div className="relative z-10 flex flex-col items-center text-center h-full justify-center gap-5">
                            <div className="w-24 h-24 bg-white text-purple-600 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-purple-100">
                                <Users size={40} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-purple-700 transition-colors">بوابة أولياء الأمور</h2>
                                <p className="text-sm text-slate-500 font-bold">متابعة الأبناء وتقديم الأعذار</p>
                            </div>
                            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1 rounded-full">الأكثر استخداماً</span>
                        </div>
                    </div>

                    {/* Admin Portal */}
                    <div 
                        onClick={() => navigate('/admin/login')}
                        className="bg-white rounded-[2.5rem] p-8 shadow-xl hover:shadow-2xl border border-slate-100 cursor-pointer group hover:-translate-y-2 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -ml-16 -mb-16 group-hover:bg-slate-200 transition-colors"></div>
                        <div className="relative z-10 flex flex-col items-center text-center h-full justify-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-all duration-300 shadow-sm">
                                <ShieldCheck size={32} />
                            </div>
                            <div>
                                <h2 className="text-xl font-extrabold text-slate-800 mb-1 group-hover:text-slate-900 transition-colors">الإدارة المدرسية</h2>
                                <p className="text-sm text-slate-500 font-medium">لوحة التحكم والتقارير</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer */}
            <div className="py-6 text-center text-slate-400 text-xs font-bold bg-white/50 backdrop-blur-sm">
                <p className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                    <SchoolIcon size={14} /> نظام سحابي لإدارة المدارس الذكية v3.0
                </p>
            </div>
        </div>
    );
};

export default SchoolLanding;
