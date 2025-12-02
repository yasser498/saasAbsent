
import React, { useEffect, useState } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { getSchoolByCodePublic, setActiveSchool } from '../services/storage';
import { School } from '../types';
import { Loader2, ArrowRight, ShieldCheck, Users, Briefcase, School as SchoolIcon, Share2 } from 'lucide-react';

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
                    setError('المدرسة غير موجودة');
                }
            } catch (err) {
                setError('حدث خطأ في الاتصال');
            } finally {
                setLoading(false);
            }
        };
        fetchSchool();
    }, [schoolCode]);

    const copyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        alert('تم نسخ رابط المدرسة');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={48} />
            </div>
        );
    }

    if (error || !school) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <SchoolIcon size={40} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">عفواً</h1>
                    <p className="text-slate-500 mb-6">{error || 'لم يتم العثور على المدرسة'}</p>
                    <button onClick={() => navigate('/')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold w-full">
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-b-[3rem] shadow-2xl z-0"></div>
            <div className="absolute top-20 right-20 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl"></div>
            <div className="absolute top-40 left-10 w-40 h-40 bg-purple-500 opacity-20 rounded-full blur-3xl"></div>

            <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-20">
                
                {/* Header Section */}
                <div className="text-center mb-12 animate-fade-in-up">
                    <div className="w-32 h-32 bg-white rounded-3xl shadow-xl mx-auto mb-6 flex items-center justify-center p-4 border-4 border-white/20 backdrop-blur-sm relative group">
                        {school.logoUrl ? (
                            <img src={school.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <SchoolIcon size={64} className="text-slate-300" />
                        )}
                        <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={copyLink}>
                            <Share2 className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight drop-shadow-md">{school.name}</h1>
                    <p className="text-blue-200 text-lg font-medium">بوابة الخدمات الإلكترونية الموحدة</p>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up animation-delay-2000">
                    
                    {/* Staff Portal */}
                    <div 
                        onClick={() => navigate('/staff/login')}
                        className="bg-white/90 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group flex flex-col items-center text-center h-64 justify-center"
                    >
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Briefcase size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">بوابة المنسوبين</h2>
                        <p className="text-sm text-slate-500">دخول المعلمين والإداريين</p>
                    </div>

                    {/* Parents Portal */}
                    <div 
                        onClick={() => navigate('/inquiry')}
                        className="bg-white/90 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group flex flex-col items-center text-center h-64 justify-center relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Users size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">بوابة أولياء الأمور</h2>
                        <p className="text-sm text-slate-500">متابعة الأبناء وتقديم الأعذار</p>
                    </div>

                    {/* Admin Portal */}
                    <div 
                        onClick={() => navigate('/admin/login')}
                        className="bg-white/90 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group flex flex-col items-center text-center h-64 justify-center"
                    >
                        <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                            <ShieldCheck size={32} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">الإدارة المدرسية</h2>
                        <p className="text-sm text-slate-500">لوحة التحكم والتقارير</p>
                    </div>

                </div>

                <div className="mt-12 text-center">
                    <p className="text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
                        <SchoolIcon size={14} /> نظام سحابي لإدارة المدارس الذكية
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SchoolLanding;
