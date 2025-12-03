
import React from 'react';
import { getActiveSchool, MINISTRY_LOGO_URL } from '../services/storage';

interface PrintLayoutProps {
  title: string;
  children: React.ReactNode;
}

const PrintLayout: React.FC<PrintLayoutProps> = ({ title, children }) => {
  const school = getActiveSchool();
  const SCHOOL_NAME = school?.name || "المدرسة";
  const MANAGER_NAME = school?.managerName || "مدير المدرسة";

  return (
    <div className="print-page-a4" dir="rtl">
        {/* Header */}
        <div className="print-header">
            <div className="print-header-right">
                <p>المملكة العربية السعودية</p>
                <p>وزارة التعليم</p>
                <p>إدارة التعليم ....................</p>
                <p>{SCHOOL_NAME}</p>
            </div>
            <div className="print-header-center flex flex-col items-center">
                {/* Ministry Logo is Primary */}
                <img src={MINISTRY_LOGO_URL} alt="وزارة التعليم" className="h-24 mb-2 object-contain" />
            </div>
            <div className="print-header-left">
                <p>Kingdom of Saudi Arabia</p>
                <p>Ministry of Education</p>
                <div className="mt-2 text-center text-xs font-bold border-2 border-black p-1 inline-block">
                    {new Date().toLocaleDateString('en-GB')}
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="print-content px-8 pt-6 relative z-10">
            <h1 className="official-title mb-8">{title}</h1>
            {children}
        </div>

        {/* Footer / Signatures */}
        <div className="footer-signatures mt-16 px-10">
            <div className="signature-box">
                <p className="signature-title">الموظف المختص / الوكيل</p>
                <p className="mt-8">.............................</p>
            </div>
            <div className="signature-box">
                <p className="signature-title">مدير المدرسة</p>
                <p className="font-bold text-lg mt-4">{MANAGER_NAME}</p>
                <div className="text-gray-400 text-xs mt-4">(الختم)</div>
            </div>
        </div>
        
        {/* Watermark */}
        <img src={MINISTRY_LOGO_URL} className="print-watermark" alt="Watermark" />
    </div>
  );
};

export default PrintLayout;