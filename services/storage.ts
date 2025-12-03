import { supabase } from '../supabaseClient';
import { 
  Appointment, AppointmentSlot, School,
  SchoolNews, Student, ExcuseRequest, RequestStatus, StaffUser, AttendanceRecord, AttendanceStatus, ClassAssignment, ResolvedAlert, BehaviorRecord, AdminInsight, Referral, StudentObservation, GuidanceSession, StudentPoint, ParentLink, AppNotification, ExitPermission, ClassPerformance 
} from "../types";
import { GoogleGenAI } from "@google/genai";

// --- CONSTANTS ---
export const MINISTRY_LOGO_URL = "https://www.raed.net/img?id=1476894"; // شعار الوزارة الموحد الجديد

// --- School Context Helpers ---
export const getActiveSchoolId = (): string | null => {
    const school = localStorage.getItem('active_school');
    if (school) {
        try {
            return JSON.parse(school).id;
        } catch (e) {
            return null;
        }
    }
    return null;
};

export const getActiveSchool = (): School | null => {
    const school = localStorage.getItem('active_school');
    try {
        return school ? JSON.parse(school) : null;
    } catch (e) {
        return null;
    }
};

export const setActiveSchool = (school: School) => {
    localStorage.setItem('active_school', JSON.stringify(school));
    // Set legacy localStorage items for compatibility
    localStorage.setItem('school_name', school.name);
    if(school.logoUrl) localStorage.setItem('school_logo', school.logoUrl);
    else localStorage.removeItem('school_logo');
};

// Full Logout (Change School)
export const logoutSchool = () => {
    localStorage.removeItem('active_school');
    localStorage.removeItem('school_name');
    localStorage.removeItem('school_logo');
    logoutUserSession(); // Clear user sessions as well
};

// User Logout (Keep School Context)
export const logoutUserSession = () => {
    localStorage.removeItem('ozr_admin_session');
    localStorage.removeItem('ozr_staff_session');
    localStorage.removeItem('ozr_parent_id');
};

// --- School Management ---
export const registerSchool = async (name: string, code: string, password: string, logoUrl?: string) => {
    const { data, error } = await supabase.from('schools').insert({
        name,
        school_code: code,
        password: password, // In production, hash this!
        logo_url: logoUrl,
        plan: 'free'
    }).select().single();
    
    if (error) {
        if (error.code === '23505') throw new Error('كود المدرسة مستخدم مسبقاً، يرجى اختيار كود آخر.');
        throw new Error(error.message);
    }
    
    const newSchool = { 
        id: data.id, 
        name: data.name, 
        schoolCode: data.school_code, 
        logoUrl: data.logo_url,
        managerName: data.manager_name,
        plan: data.plan, 
        createdAt: data.created_at 
    } as School;
    
    return newSchool;
};

export const loginSchool = async (code: string): Promise<School | null> => {
    const { data, error } = await supabase.from('schools').select('*').eq('school_code', code).single();
    if (error || !data) return null;
    return { 
        id: data.id, 
        name: data.name, 
        schoolCode: data.school_code, 
        logoUrl: data.logo_url,
        managerName: data.manager_name,
        plan: data.plan, 
        createdAt: data.created_at 
    } as School;
};

export const updateSchoolManager = async (managerName: string) => {
    const school = getActiveSchool();
    if (!school) return;
    
    const { error } = await supabase.from('schools').update({ manager_name: managerName }).eq('id', school.id);
    if (error) throw new Error(error.message);
    
    // Update local context
    const updatedSchool = { ...school, managerName };
    setActiveSchool(updatedSchool);
};

// Function to fetch public school info without full login logic if needed (e.g. for landing page preview)
export const getSchoolByCodePublic = async (code: string): Promise<School | null> => {
    return await loginSchool(code);
};

export const verifySchoolAdminPassword = async (schoolId: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.from('schools').select('password').eq('id', schoolId).single();
    if (error || !data) return false;
    return data.password === password; // In production, compare hashes
};

// --- AI Configuration ---
export interface AIConfig { provider: 'google' | 'openai_compatible'; apiKey: string; baseUrl?: string; model: string; }

export const getAIConfig = (): AIConfig => {
  const stored = localStorage.getItem('ozr_ai_config');
  if (stored) return JSON.parse(stored);
  
  let apiKey = '';
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
        // @ts-ignore
        apiKey = process.env.API_KEY;
    }
  } catch (e) { console.debug('process.env not available'); }

  if (!apiKey) {
    try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_AI_KEY) {
            // @ts-ignore
            apiKey = import.meta.env.VITE_GOOGLE_AI_KEY;
        }
    } catch (e) { console.debug('import.meta.env not available'); }
  }

  return { provider: 'google', apiKey, model: 'gemini-3-pro-preview' };
};

export const generateSmartContent = async (prompt: string, systemInstruction?: string): Promise<string> => {
  const config = getAIConfig();
  // Using the key from config or directly from process.env if available
  const apiKey = config.apiKey || process.env.API_KEY;
  
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    // Use Thinking Mode for complex generation
    const response = await ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt, 
        config: { 
            systemInstruction,
            thinkingConfig: { thinkingBudget: 32768 }
        } 
    });
    return response.text || "";
  } catch (error: any) { 
      console.error("AI Error:", error);
      return "تعذر الاتصال بخدمة الذكاء الاصطناعي."; 
  }
};

// Helper to get Counselor Name
const getCounselorName = async () => {
    const schoolId = getActiveSchoolId();
    if (!schoolId) return "الموجه الطلابي";
    const { data } = await supabase.from('staff').select('name, permissions').eq('school_id', schoolId);
    if (!data) return "الموجه الطلابي";
    const counselors = data.filter((u: any) => u.permissions && u.permissions.includes('students'));
    if (counselors.length > 0) {
        const randomCounselor = counselors[Math.floor(Math.random() * counselors.length)];
        return randomCounselor.name;
    }
    return "الموجه الطلابي";
};

// ... AI Reports functions ...
export const generateExecutiveReport = async (stats: any) => {
    const prompt = `
    بصفتك مستشاراً تربويًا وإداريًا خبيراً، قم بإعداد "تقرير تنفيذي شامل" لإدارة المدرسة بناءً على البيانات التالية:
    - نسبة الحضور العامة: ${stats.attendanceRate}%
    - نسبة الغياب: ${stats.absenceRate}%
    - نسبة التأخر: ${stats.latenessRate}%
    - إجمالي المخالفات السلوكية: ${stats.totalViolations}
    - عدد الطلاب في دائرة الخطر (غياب متكرر): ${stats.riskCount}
    - الصف الأكثر غياباً: ${stats.mostAbsentGrade}
    
    المطلوب:
    1. ملخص تنفيذي لحالة الانضباط في المدرسة.
    2. تحليل نقاط الضعف (أين تكمن المشكلة الأكبر؟).
    3. ثلاث توصيات عملية ومحددة للإدارة لتحسين الوضع الأسبوع القادم.
    
    الصيغة: تقرير رسمي مهني، نقاط واضحة، لغة عربية فصحى قوية.
    `;
    return await generateSmartContent(prompt);
};

export const generateSmartStudentReport = async (studentName: string, attendance: any[], behavior: any[], points: number) => {
    const absentDays = attendance.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendance.filter(a => a.status === 'LATE').length;
    const behaviorCount = behavior.length;
    const counselorName = await getCounselorName();
    const prompt = `
    اكتب رسالة تربوية موجهة لولي أمر الطالب "${studentName}".
    البيانات:
    - الغياب: ${absentDays} أيام.
    - التأخر: ${lateDays} أيام.
    - المخالفات السلوكية: ${behaviorCount}.
    - نقاط التميز: ${points}.
    
    الأسلوب:
    - إذا كان الأداء ممتازاً (غياب قليل، نقاط عالية): كن مشجعاً جداً وفخوراً.
    - إذا كان هناك ملاحظات: كن لطيفاً ولكن واضحاً في التنبيه على ضرورة التحسن بأسلوب تربوي غير منفر.
    - اختم بنصيحة قصيرة.
    
    التوقيع في نهاية الرسالة يجب أن يكون حرفياً كالتالي:
    الموجه الطلابي
    ${counselorName}
    `;
    return await generateSmartContent(prompt);
};

export const suggestBehaviorAction = async (violationName: string, historyCount: number) => {
    const prompt = `
    طالب قام بمخالفة: "${violationName}".
    هذه هي المرة رقم ${historyCount + 1} التي يرتكب فيها مخالفة.
    بناءً على قواعد السلوك والمواظبة المدرسية العامة:
    1. ما هو الإجراء النظامي المقترح؟ (تدرج في العقوبة إذا كان مكرراً).
    2. نصيحة قصيرة يمكن توجيهها للطالب أثناء التحقيق.
    `;
    return await generateSmartContent(prompt);
};

export const generateGuidancePlan = async (studentName: string, history: any) => {
    const counselorName = await getCounselorName();
    const prompt = `
    بصفتك خبيراً تربوياً، قم بإعداد "خطة علاجية فردية" رسمية وجاهزة للطباعة للطالب: ${studentName}.
    
    سياق الحالة والملاحظات: ${history}.
    
    المطلوب:
    اكتب الخطة مباشرة بصيغة رسمية (بدون مقدمات مثل "إليك المسودة").
    الهيكل المطلوب:
    1. التشخيص التربوي (صياغة مهنية للمشكلة).
    2. الأهداف السلوكية (ما نريد تحقيقه).
    3. الإجراءات العلاجية (خطوات عملية محددة للمعلم وولي الأمر والطالب).
    4. التوصيات الختامية.

    استخدم لغة عربية فصحى رسمية جداً، بصيغة المتكلم (الموجه الطلابي).
    `;
    return await generateSmartContent(prompt);
};

export const generateUserSpecificBotContext = async (): Promise<{role: string, context: string}> => {
    const news = await getSchoolNews();
    const generalInfo = await getBotContext();
    const newsText = news.slice(0, 3).map(n => `- خبر: ${n.title} (${n.content})`).join('\n');
    let baseContext = `
    معلومات عامة عن المدرسة:
    ${generalInfo || "الدوام: 7:00 ص - 1:15 م."}
    آخر الأخبار:
    ${newsText}
    `;
    const adminSession = localStorage.getItem('ozr_admin_session');
    const staffSession = localStorage.getItem('ozr_staff_session');
    const parentId = localStorage.getItem('ozr_parent_id');

    if (adminSession) {
        const requests = await getRequests();
        const pendingCount = requests.filter(r => r.status === 'PENDING').length;
        const risks = await getConsecutiveAbsences();
        return {
            role: 'مدير النظام (Admin)',
            context: `
            ${baseContext}
            أنت مساعد شخصي لمدير المدرسة.
            حالة النظام الحالية:
            - يوجد ${pendingCount} طلب عذر معلق يحتاج للمراجعة.
            - يوجد ${risks.length} طلاب في دائرة الخطر (غياب متصل لأكثر من 3 أيام).
            - جميع الصلاحيات متاحة لك في لوحة التحكم.
            الطلاب في دائرة الخطر:
            ${risks.map(r => `${r.studentName} (${r.days} أيام)`).join(', ')}
            `
        };
    }
    if (staffSession) {
        const user: StaffUser = JSON.parse(staffSession);
        const perms = user.permissions || [];
        let roleName = 'معلم';
        let specificData = '';
        if (perms.includes('deputy')) {
            roleName = 'وكيل شؤون الطلاب';
            const behaviors = await getBehaviorRecords();
            const todayViolations = behaviors.filter(b => b.date === new Date().toISOString().split('T')[0]).length;
            const risks = await getConsecutiveAbsences();
            specificData = `
            - مخالفات اليوم المسجلة: ${todayViolations}.
            - طلاب في خطر الغياب المتصل: ${risks.length}.
            - يمكنك تسجيل مخالفات واستدعاء أولياء الأمور.`;
        } else if (perms.includes('students')) {
            roleName = 'الموجه الطلابي';
            const referrals = await getReferrals();
            const pendingRefs = referrals.filter(r => r.status === 'pending').length;
            specificData = `- لديك ${pendingRefs} إحالة جديدة من المعلمين/الوكيل تحتاج لمعالجة.\n- يمكنك تسجيل جلسات إرشادية.`;
        } else {
            const assignments = user.assignments || [];
            const classesText = assignments.map(a => `${a.grade} ${a.className}`).join(', ');
            specificData = `- الفصول المسندة إليك: ${classesText}.\n- يمكنك رصد الغياب ورفع الملاحظات السلوكية لطلاب هذه الفصول.`;
        }
        return {
            role: roleName,
            context: `
            ${baseContext}
            أنت مساعد شخصي لـ ${roleName} واسمه ${user.name}.
            بيانات خاصة بمهامه:
            ${specificData}
            `
        };
    }
    if (parentId) {
        const children = await getParentChildren(parentId);
        let childrenDetails = "";
        for (const child of children) {
            const history = await getStudentAttendanceHistory(child.studentId, child.grade, child.className);
            const absentDays = history.filter(h => h.status === 'ABSENT').length;
            const points = (await getStudentPoints(child.studentId)).total;
            childrenDetails += `- الابن: ${child.name} (الصف: ${child.grade}). غياب: ${absentDays} يوم. نقاط تميز: ${points}.\n`;
        }
        return {
            role: 'ولي أمر',
            context: `
            ${baseContext}
            أنت مساعد لولي أمر.
            بيانات أبنائه:
            ${childrenDetails || "لا يوجد أبناء مرتبطين حالياً. ساعده في طريقة ربط الأبناء عبر رقم الهوية."}
            إذا سأل عن ابنه، أجب بناءً على البيانات أعلاه.
            `
        };
    }
    return {
        role: 'زائر',
        context: `
        ${baseContext}
        أنت مساعد لزوار الموقع العام.
        ساعدهم في معرفة طريقة التسجيل، تقديم الأعذار، أو معلومات عن المدرسة.
        `
    };
};

export const analyzeSentiment = async (text: string): Promise<'positive' | 'negative' | 'neutral'> => {
    try {
        const config = getAIConfig();
        const apiKey = config.apiKey || process.env.API_KEY;
        // Use Flash for simple sentiment analysis to keep it fast and low cost
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the sentiment of this text (Student Report). Return ONLY one word: 'positive', 'negative', or 'neutral'. Text: "${text}"`
        });
        
        const res = response.text || "";
        const clean = res.trim().toLowerCase();
        if (clean.includes('positive')) return 'positive';
        if (clean.includes('negative')) return 'negative';
        return 'neutral';
    } catch (e) { return 'neutral'; }
};

// --- CORE CRUD (Updated with school_id) ---
// ... (Mappers unchanged) ...
const mapStudentFromDB = (s: any): Student => ({ id: s.id, schoolId: s.school_id, name: s.name, studentId: s.student_id, grade: s.grade, className: s.class_name, phone: s.phone || '' });
const mapStudentToDB = (s: Student) => ({ school_id: getActiveSchoolId(), name: s.name, student_id: s.studentId, grade: s.grade, class_name: s.className, phone: s.phone });
const mapRequestFromDB = (r: any): ExcuseRequest => ({ 
    id: r.id, 
    schoolId: r.school_id, 
    studentId: r.student_id, 
    studentName: r.student_name, 
    grade: r.grade, 
    className: r.class_name, 
    date: r.date, 
    reason: r.reason, 
    details: r.details, 
    attachmentName: r.attachment_name, 
    attachmentUrl: r.attachment_url, 
    status: r.status as RequestStatus, 
    submissionDate: r.submission_date 
});
const mapRequestToDB = (r: ExcuseRequest) => ({ school_id: getActiveSchoolId(), student_id: r.studentId, student_name: r.studentName, grade: r.grade, class_name: r.className, date: r.date, reason: r.reason, details: r.details, attachment_name: r.attachmentName, attachment_url: r.attachmentUrl, status: r.status, submission_date: r.submissionDate });
const mapStaffFromDB = (u: any): StaffUser => ({ id: u.id, schoolId: u.school_id, name: u.name, passcode: u.passcode, assignments: u.assignments || [], permissions: u.permissions || ['attendance', 'requests', 'reports'] });
const mapStaffToDB = (u: StaffUser) => ({ school_id: getActiveSchoolId(), name: u.name, passcode: u.passcode, assignments: u.assignments || [], permissions: u.permissions || [] });
const mapAttendanceFromDB = (a: any): AttendanceRecord => ({ id: a.id, schoolId: a.school_id, date: a.date, grade: a.grade, className: a.class_name, staffId: a.staff_id, records: a.records || [] });
const mapAttendanceToDB = (a: AttendanceRecord) => ({ school_id: getActiveSchoolId(), date: a.date, grade: a.grade, class_name: a.className, staff_id: a.staffId, records: a.records });
const mapBehaviorFromDB = (b: any): BehaviorRecord => ({ id: b.id, schoolId: b.school_id, studentId: b.student_id, studentName: b.student_name, grade: b.grade, className: b.class_name, date: b.date, violationDegree: b.violation_degree, violationName: b.violation_name, articleNumber: b.article_number, actionTaken: b.action_taken, notes: b.notes, staffId: b.staff_id, createdAt: b.created_at, parentViewed: b.parent_viewed, parentFeedback: b.parent_feedback, parentViewedAt: b.parent_viewed_at });
const mapBehaviorToDB = (b: BehaviorRecord) => ({ school_id: getActiveSchoolId(), student_id: b.studentId, student_name: b.studentName, grade: b.grade, class_name: b.className, date: b.date, violation_degree: b.violationDegree, violation_name: b.violationName, article_number: b.articleNumber, action_taken: b.actionTaken, notes: b.notes, staff_id: b.staffId, parent_viewed: b.parentViewed, parent_feedback: b.parentFeedback, parent_viewed_at: b.parentViewedAt });
const mapObservationFromDB = (o: any): StudentObservation => ({ id: o.id, schoolId: o.school_id, studentId: o.student_id, studentName: o.student_name, grade: o.grade, className: o.class_name, date: o.date, type: o.type, content: o.content, staffId: o.staff_id, staffName: o.staff_name, createdAt: o.created_at, parentViewed: o.parent_viewed, parentFeedback: o.parent_feedback, parentViewedAt: o.parent_viewed_at, sentiment: o.sentiment });
const mapObservationToDB = (o: StudentObservation) => ({ school_id: getActiveSchoolId(), student_id: o.studentId, student_name: o.studentName, grade: o.grade, class_name: o.className, date: o.date, type: o.type, content: o.content, staff_id: o.staffId, staff_name: o.staffName, parent_viewed: o.parentViewed, parent_feedback: o.parentFeedback, parent_viewed_at: o.parentViewedAt, sentiment: o.sentiment });
const mapReferralFromDB = (r: any): Referral => ({ id: r.id, schoolId: r.school_id, studentId: r.student_id, studentName: r.student_name, grade: r.grade, className: r.class_name, referralDate: r.referral_date, reason: r.reason, status: r.status, referredBy: r.referred_by, notes: r.notes, outcome: r.outcome, createdAt: r.created_at });
const mapReferralToDB = (r: Referral) => ({ school_id: getActiveSchoolId(), student_id: r.studentId, student_name: r.studentName, grade: r.grade, class_name: r.className, referral_date: r.referralDate, reason: r.reason, status: r.status, referred_by: r.referredBy, notes: r.notes, outcome: r.outcome });
const mapInsightFromDB = (i: any): AdminInsight => ({ id: i.id, schoolId: i.school_id, targetRole: i.target_role, content: i.content, isRead: i.is_read, createdAt: i.created_at });
const mapSessionFromDB = (s: any): GuidanceSession => ({ id: s.id, schoolId: s.school_id, studentId: s.student_id, studentName: s.student_name, date: s.date, sessionType: s.session_type, topic: s.topic, recommendations: s.recommendations, status: s.status });
const mapSessionToDB = (s: GuidanceSession) => ({ school_id: getActiveSchoolId(), student_id: s.studentId, student_name: s.studentName, date: s.date, session_type: s.sessionType, topic: s.topic, recommendations: s.recommendations, status: s.status });
const mapClassPerformanceFromDB = (cp: any): ClassPerformance => ({ id: cp.id, schoolId: cp.school_id, studentId: cp.student_id, studentName: cp.student_name, grade: cp.grade, className: cp.class_name, date: cp.date, subject: cp.subject, participationScore: cp.participation_score, homeworkStatus: cp.homework_status, behaviorNote: cp.behavior_note, createdBy: cp.created_by });
const mapClassPerformanceToDB = (cp: ClassPerformance) => ({ school_id: getActiveSchoolId(), student_id: cp.studentId, student_name: cp.studentName, grade: cp.grade, class_name: cp.className, date: cp.date, subject: cp.subject, participation_score: cp.participationScore, homework_status: cp.homeworkStatus, behavior_note: cp.behaviorNote, created_by: cp.createdBy });

export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string }> => { try { const { data, error } = await supabase.from('schools').select('count', { count: 'exact', head: true }); if (error) throw error; return { success: true, message: `Connected` }; } catch (error: any) { return { success: false, message: `Failed: ${error.message}` }; } };

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const uploadFile = async (file: File): Promise<string | null> => {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  
  try {
    // Try Supabase Storage first
    const { data, error } = await supabase.storage.from('excuses').upload(safeName, file);
    
    if (error) {
        throw new Error(error.message);
    }
    
    const { data: publicUrlData } = supabase.storage.from('excuses').getPublicUrl(safeName);
    return publicUrlData.publicUrl;

  } catch (err: any) {
    console.warn('Storage upload failed, attempting fallback to Base64:', err.message);
    try {
        return await fileToBase64(file);
    } catch (e) {
        console.error('Base64 conversion failed', e);
        return null;
    }
  }
};

// --- DATA ACCESS WITH SCHOOL ISOLATION ---
// All GET queries now filter by school_id if it exists in local storage context.

export const getStudents = async (force = false) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId); 
    if (error) { console.error(error); return []; } 
    return data.map(mapStudentFromDB); 
};
export const getStudentsSync = () => null;
export const getStudentByCivilId = async (id: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return null;
    const { data, error } = await supabase.from('students').select('*').eq('school_id', schoolId).eq('student_id', id).single(); 
    if (error) return null; 
    return mapStudentFromDB(data); 
};

// New Function: Search students by phone number
export const getStudentsByPhone = async (phone: string): Promise<Student[]> => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];

    // Normalize input (remove spaces, dashes)
    let cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
    
    // Create variations to check against DB (stored as 05... usually)
    // 1. If starts with 966, try replacing with 0
    let variations = [cleanPhone];
    if (cleanPhone.startsWith('966')) {
        variations.push('0' + cleanPhone.substring(3));
    } else if (cleanPhone.startsWith('05')) {
        variations.push('966' + cleanPhone.substring(1));
    }

    const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('school_id', schoolId)
        .in('phone', variations);

    if (error || !data) return [];
    return data.map(mapStudentFromDB);
};

export const addStudent = async (student: Student) => { const { data, error } = await supabase.from('students').insert(mapStudentToDB(student)).select().single(); if (error) throw new Error(error.message); return mapStudentFromDB(data); };
export const updateStudent = async (student: Student) => { const { error } = await supabase.from('students').update(mapStudentToDB(student)).eq('student_id', student.studentId).eq('school_id', getActiveSchoolId()); if (error) throw new Error(error.message); };
export const deleteStudent = async (id: string) => { const { error } = await supabase.from('students').delete().eq('id', id); if (error) throw new Error(error.message); };
export const syncStudentsBatch = async (toAdd: Student[], toUpdate: Student[], toDeleteIds: string[]) => {
    if (toDeleteIds.length) await supabase.from('students').delete().in('id', toDeleteIds);
    const upsertData = [...toAdd, ...toUpdate].map(mapStudentToDB);
    if (upsertData.length) {
        // Correct conflict target for multi-tenancy
        const { error } = await supabase.from('students').upsert(upsertData, { onConflict: 'school_id,student_id' }); 
        if (error) throw new Error(error.message);
    }
};
export const getRequests = async (force = false) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('requests').select('*').eq('school_id', schoolId).order('submission_date', { ascending: false }); 
    if (error) return []; return data.map(mapRequestFromDB); 
};
export const getRequestsByStudentId = async (studentId: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('requests').select('*').eq('school_id', schoolId).eq('student_id', studentId).order('submission_date', { ascending: false }); 
    if (error) return []; return data.map(mapRequestFromDB); 
};
export const getPendingRequestsCountForStaff = async (assignments: ClassAssignment[]) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return 0;
    const { data } = await supabase.from('requests').select('grade, class_name').eq('school_id', schoolId).eq('status', 'PENDING');
    if (!data) return 0;
    return data.filter(r => assignments.some(a => a.grade === r.grade && a.className === r.class_name)).length;
};
export const addRequest = async (request: ExcuseRequest) => { 
    const { error } = await supabase.from('requests').insert(mapRequestToDB(request)); 
    if (error) throw new Error(error.message); 
    await createNotification(request.studentId, 'info', 'تم استلام طلبك', 'تم استلام عذر الغياب وهو قيد المراجعة.');
};
export const updateRequestStatus = async (id: string, status: RequestStatus) => { 
    const { error } = await supabase.from('requests').update({ status }).eq('id', id); 
    if (error) throw new Error(error.message); 
    const { data: req } = await supabase.from('requests').select('student_id').eq('id', id).single();
    if (req) {
        const msg = status === 'APPROVED' ? 'تم قبول العذر المقدم.' : 'تم رفض العذر المقدم.';
        await createNotification(req.student_id, status === 'APPROVED' ? 'success' : 'alert', 'تحديث حالة الطلب', msg);
    }
};
export const clearRequests = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('requests').delete().eq('school_id', schoolId); };
export const clearStudents = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('students').delete().eq('school_id', schoolId); };
export const getStaffUsers = async (force = false) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('staff').select('*').eq('school_id', schoolId); 
    if (error) return []; return data.map(mapStaffFromDB); 
};
export const getStaffUsersSync = () => null; 
export const addStaffUser = async (user: StaffUser) => { const { error } = await supabase.from('staff').insert(mapStaffToDB(user)); if (error) throw new Error(error.message); };
export const updateStaffUser = async (user: StaffUser) => { const { error } = await supabase.from('staff').update(mapStaffToDB(user)).eq('id', user.id); if (error) throw new Error(error.message); };
export const deleteStaffUser = async (id: string) => { const { error } = await supabase.from('staff').delete().eq('id', id); if (error) throw new Error(error.message); };
export const authenticateStaff = async (passcode: string): Promise<StaffUser | undefined> => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return undefined;
    const { data, error } = await supabase.from('staff').select('*').eq('school_id', schoolId).eq('passcode', passcode).single(); 
    if (error || !data) return undefined; return mapStaffFromDB(data); 
};
export const getAvailableClassesForGrade = async (grade: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data } = await supabase.from('students').select('class_name').eq('school_id', schoolId).eq('grade', grade); 
    if (!data) return []; return Array.from(new Set(data.map((s: any) => s.class_name))).sort(); 
};

// --- NEW CLASS PERFORMANCE LOGIC ---
export const saveClassPerformance = async (records: ClassPerformance[]) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    
    // Upsert performance records
    // Since there's no unique constraint on (student_id, date, subject) yet in SQL provided, 
    // we should ideally delete existing for this day/class/subject then insert, or use upsert if constraint existed.
    // For now, let's delete existing records for these students on this date to avoid duplicates if re-submitting.
    if(records.length > 0) {
        const date = records[0].date;
        const studentIds = records.map(r => r.studentId);
        
        // Use subject if available to delete specific subject records, otherwise it might wipe other subjects for same day
        const subject = records[0].subject;
        let deleteQuery = supabase.from('class_performance')
            .delete()
            .eq('school_id', schoolId)
            .eq('date', date)
            .in('student_id', studentIds);
            
        if (subject) {
            deleteQuery = deleteQuery.eq('subject', subject);
        }

        await deleteQuery;
            
        const { error } = await supabase.from('class_performance').insert(records.map(mapClassPerformanceToDB));
        if (error) throw new Error(error.message);
    }
};

export const getClassPerformance = async (date: string, grade: string, className: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('class_performance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('date', date)
        .eq('grade', grade)
        .eq('class_name', className);
        
    if(error) return [];
    return data.map(mapClassPerformanceFromDB);
};

export const getStudentDailyPerformance = async (studentId: string, date: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('class_performance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_id', studentId)
        .eq('date', date);
        
    if(error) return [];
    return data.map(mapClassPerformanceFromDB);
};

export const getTeacherPerformanceStats = async (grade?: string, className?: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('class_performance').select('*').eq('school_id', schoolId);
    if(grade && className) {
        query = query.eq('grade', grade).eq('class_name', className);
    }
    const { data, error } = await query;
    if(error) return [];
    return data.map(mapClassPerformanceFromDB);
};

export const saveAttendanceRecord = async (record: AttendanceRecord) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) throw new Error("No school selected");

    // 1. Save or Update the Record (Database Op 1)
    const { data: existing } = await supabase.from('attendance').select('id').eq('school_id', schoolId).eq('date', record.date).eq('grade', record.grade).eq('class_name', record.className).single();
    if (existing) {
        const { error } = await supabase.from('attendance').update(mapAttendanceToDB(record)).eq('id', existing.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('attendance').insert(mapAttendanceToDB(record));
        if (error) throw new Error(error.message);
    }

    // 2. TRIGGER REAL-TIME NOTIFICATIONS
    const notificationBatch: any[] = [];
    
    // OPTIMIZATION: Fetch required data ONCE to prevent N+1 problem
    // A. Staff list for Admin alerts
    const staffList = await getStaffUsers(); 
    const riskStaff = staffList.filter(u => u.permissions?.includes('deputy') || u.permissions?.includes('students'));

    // B. Class Attendance History (for streak calculation)
    // We get all days for this class to calculate streaks locally
    const { data: classHistoryRaw } = await supabase.from('attendance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('grade', record.grade)
        .eq('class_name', record.className)
        .order('date', { ascending: false }); // Newest first
    
    const classHistory = classHistoryRaw ? classHistoryRaw.map(mapAttendanceFromDB) : [];

    // C. All Requests (to check excuses) - We fetch all requests for the school to allow local filtering
    // Optimized: In a real large app, we would filter by student IDs, but for this scale, fetching all or by IDs is fine.
    // Let's filter by the student IDs involved in this record for better performance if possible
    const studentIds = record.records.map(s => s.studentId);
    const { data: requestsData } = await supabase.from('requests')
        .select('*')
        .eq('school_id', schoolId)
        .in('student_id', studentIds);
    
    const relevantRequests = requestsData ? requestsData.map(mapRequestFromDB) : [];

    for (const stu of record.records) {
        if (stu.status === AttendanceStatus.ABSENT) {
            // A. Daily Absence Notification
            notificationBatch.push({
                school_id: schoolId,
                target_user_id: stu.studentId, 
                type: 'alert',
                title: 'تنبيه غياب',
                message: `نحيطكم علماً بأن الطالب ${stu.studentName} تغيب عن المدرسة بتاريخ ${record.date}. يرجى تقديم عذر عبر البوابة.`
            });

            // B. Check for Consecutive Absences (Threshold: 3)
            // Filter requests for this student
            const studentRequests = relevantRequests.filter(r => r.studentId === stu.studentId);

            let streak = 0;
            // Iterate through class history days
            for (const dayRecord of classHistory) {
                // Find student status in this day's record
                const studentDailyStatus = dayRecord.records.find(r => r.studentId === stu.studentId);
                
                if (studentDailyStatus && studentDailyStatus.status === AttendanceStatus.ABSENT) {
                    // Check if this specific day is excused
                    const hasExcuse = studentRequests.some(r => r.date === dayRecord.date && r.status !== RequestStatus.REJECTED);
                    if (!hasExcuse) {
                        streak++;
                    } else {
                        break; // Excused day breaks streak
                    }
                } else if (studentDailyStatus && studentDailyStatus.status === AttendanceStatus.PRESENT) {
                    break; // Present breaks streak
                }
                // If Late, we usually ignore or count as present for "absence streak", breaking it? 
                // Usually Late breaks Absence streak.
                else if (studentDailyStatus) {
                    break;
                }
            }

            // Trigger notification if streak reaches exactly 3
            if (streak === 3) {
                 // 1. Notify Parent
                 notificationBatch.push({
                     school_id: schoolId,
                     target_user_id: stu.studentId,
                     type: 'alert',
                     title: 'إنذار انقطاع (الدرجة الأولى)',
                     message: `تنبيه هام: تغيب الطالب ${stu.studentName} لليوم الثالث على التوالي بدون عذر. يرجى مراجعة المدرسة فوراً.`
                 });

                 // 2. Notify Staff
                 riskStaff.forEach(s => {
                     notificationBatch.push({
                         school_id: schoolId,
                         target_user_id: s.id,
                         type: 'alert',
                         title: 'مؤشر خطر غياب',
                         message: `الطالب ${stu.studentName} (${record.grade}) وصل لـ 3 أيام غياب متصل.`
                     });
                 });
            }

        } else if (stu.status === AttendanceStatus.LATE) {
            notificationBatch.push({
                school_id: schoolId,
                target_user_id: stu.studentId,
                type: 'info',
                title: 'تنبيه تأخر',
                message: `تم رصد تأخر الطالب ${stu.studentName} عن الطابور الصباحي بتاريخ ${record.date}.`
            });
        }
    }

    if (notificationBatch.length > 0) {
        const { error } = await supabase.from('notifications').insert(notificationBatch);
        if (error) console.error("Failed to send notifications:", error);
    }
};

export const getAttendanceRecordForClass = async (date: string, grade: string, className: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return null;
    const { data, error } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('date', date).eq('grade', grade).eq('class_name', className).single(); 
    if (error) return null; return mapAttendanceFromDB(data); 
};
export const getAttendanceRecords = async () => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('attendance').select('*').eq('school_id', schoolId); 
    if (error) return []; return data.map(mapAttendanceFromDB); 
};
export const getStudentAttendanceHistory = async (studentId: string, grade: string, className: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data: records } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('grade', grade).eq('class_name', className);
    if (!records) return [];
    const history: { date: string, status: AttendanceStatus }[] = [];
    records.forEach((rec: any) => {
        const studentRecord = rec.records.find((r: any) => r.studentId === studentId);
        if (studentRecord) {
            history.push({ date: rec.date, status: studentRecord.status });
        }
    });
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
export const getDailyAttendanceReport = async (date: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return { totalPresent: 0, totalAbsent: 0, totalLate: 0, details: [] };
    const { data: records } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('date', date);
    const details: any[] = [];
    let totalPresent = 0, totalAbsent = 0, totalLate = 0;
    if (records) {
        records.forEach((rec: any) => {
            rec.records.forEach((stu: any) => {
                if (stu.status === 'ABSENT') totalAbsent++;
                else if (stu.status === 'LATE') totalLate++;
                else totalPresent++;
                if (stu.status !== 'PRESENT') {
                    details.push({
                        studentId: stu.studentId,
                        studentName: stu.studentName,
                        grade: rec.grade,
                        className: rec.class_name,
                        status: stu.status
                    });
                }
            });
        });
    }
    return { totalPresent, totalAbsent, totalLate, details };
};
export const clearAttendance = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('attendance').delete().eq('school_id', schoolId); };
export const getConsecutiveAbsences = async () => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data: records } = await supabase.from('attendance').select('*').eq('school_id', schoolId).order('date', { ascending: false });
    if (!records) return [];
    const studentHistory: Record<string, {name: string, statuses: string[], dates: string[]}> = {};
    records.forEach((classRecord: any) => {
        classRecord.records.forEach((stu: any) => {
            if (!studentHistory[stu.studentId]) {
                studentHistory[stu.studentId] = { name: stu.studentName, statuses: [], dates: [] };
            }
            studentHistory[stu.studentId].statuses.push(stu.status);
            studentHistory[stu.studentId].dates.push(classRecord.date);
        });
    });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: actions } = await supabase
        .from('risk_actions')
        .select('student_id')
        .eq('school_id', schoolId)
        .gte('resolved_at', sevenDaysAgo.toISOString());
    const resolvedStudentIds = new Set(actions?.map((a: any) => a.student_id) || []);
    const alerts: any[] = [];
    Object.entries(studentHistory).forEach(([id, data]) => {
        let consecutive = 0;
        for (const status of data.statuses) {
            if (status === 'ABSENT') consecutive++;
            else break;
        }
        if (consecutive >= 3 && !resolvedStudentIds.has(id)) {
            alerts.push({
                studentId: id,
                studentName: data.name,
                days: consecutive,
                lastDate: data.dates[0]
            });
        }
    });
    return alerts;
};
export const resolveAbsenceAlert = async (studentId: string, action: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    await supabase.from('risk_actions').insert({
        school_id: schoolId,
        student_id: studentId,
        action_type: action,
        resolved_at: new Date().toISOString()
    });
};
export const getBehaviorRecords = async (studentId?: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('behaviors').select('*').eq('school_id', schoolId); 
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapBehaviorFromDB);
};
export const addBehaviorRecord = async (record: BehaviorRecord) => { 
    const { error } = await supabase.from('behaviors').insert(mapBehaviorToDB(record)); 
    if (error) throw new Error(error.message); 
    await createNotification(record.studentId, 'alert', 'مخالفة سلوكية', `تم تسجيل مخالفة: ${record.violationName} - ${record.actionTaken}`);
};
export const updateBehaviorRecord = async (record: BehaviorRecord) => { const { error } = await supabase.from('behaviors').update(mapBehaviorToDB(record)).eq('id', record.id); if (error) throw new Error(error.message); };
export const deleteBehaviorRecord = async (id: string) => { const { error } = await supabase.from('behaviors').delete().eq('id', id); if (error) throw new Error(error.message); };
export const acknowledgeBehavior = async (id: string, feedback: string) => { await supabase.from('behaviors').update({ parent_viewed: true, parent_feedback: feedback, parent_viewed_at: new Date().toISOString() }).eq('id', id); };
export const clearBehaviorRecords = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('behaviors').delete().eq('school_id', schoolId); };
export const getStudentObservations = async (studentId?: string, type?: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('observations').select('*').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    if (type) query = query.eq('type', type);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapObservationFromDB);
};
export const addStudentObservation = async (obs: StudentObservation) => { 
    const { error } = await supabase.from('observations').insert(mapObservationToDB(obs)); 
    if (error) throw new Error(error.message); 
    if (obs.type === 'positive') await createNotification(obs.studentId, 'success', 'تعزيز إيجابي', `رائع! ${obs.content}`);
    else if (obs.type === 'behavioral') await createNotification(obs.studentId, 'alert', 'ملاحظة سلوكية', obs.content);
    else await createNotification(obs.studentId, 'info', 'ملاحظة مدرسية', obs.content);
};
export const updateStudentObservation = async (id: string, content: string, type: any) => { await supabase.from('observations').update({ content, type }).eq('id', id); };
export const deleteStudentObservation = async (id: string) => { await supabase.from('observations').delete().eq('id', id); };
export const acknowledgeObservation = async (id: string, feedback: string) => { await supabase.from('observations').update({ parent_viewed: true, parent_feedback: feedback, parent_viewed_at: new Date().toISOString() }).eq('id', id); };
export const getAdminInsights = async (targetRole?: 'deputy' | 'counselor' | 'teachers') => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('admin_insights').select('*').eq('school_id', schoolId);
    if (targetRole) query = query.eq('target_role', targetRole);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapInsightFromDB);
};
export const sendAdminInsight = async (targetRole: 'deputy' | 'counselor' | 'teachers', content: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    const { error } = await supabase.from('admin_insights').insert({ school_id: schoolId, target_role: targetRole, content });
    if (error) throw new Error(error.message);
    // You might want to notify all staff of a certain role here, but that requires selecting all their IDs.
};
export const clearAdminInsights = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('admin_insights').delete().eq('school_id', schoolId); };
export const addReferral = async (referral: Referral) => { const { error } = await supabase.from('referrals').insert(mapReferralToDB(referral)); if (error) throw new Error(error.message); };
export const getReferrals = async (studentId?: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('referrals').select('*').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapReferralFromDB);
};
export const updateReferralStatus = async (id: string, status: string, outcome?: string) => {
    const updateData: any = { status };
    if (outcome) updateData.outcome = outcome;
    const { error } = await supabase.from('referrals').update(updateData).eq('id', id);
    if (error) throw new Error(error.message);
};
export const clearReferrals = async () => { const schoolId = getActiveSchoolId(); if(schoolId) await supabase.from('referrals').delete().eq('school_id', schoolId); };
export const addGuidanceSession = async (session: GuidanceSession) => { const { error } = await supabase.from('guidance_sessions').insert(mapSessionToDB(session)); if (error) throw new Error(error.message); };
export const updateGuidanceSession = async (session: GuidanceSession) => { const { error } = await supabase.from('guidance_sessions').update(mapSessionToDB(session)).eq('id', session.id); if (error) throw new Error(error.message); };
export const deleteGuidanceSession = async (id: string) => { const { error } = await supabase.from('guidance_sessions').delete().eq('id', id); if (error) throw new Error(error.message); };
export const getGuidanceSessions = async () => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('guidance_sessions').select('*').eq('school_id', schoolId).order('date', { ascending: false }); 
    if (error) return []; return data.map(mapSessionFromDB); 
};

export const saveBotContext = async (content: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    await supabase.from('admin_insights').delete().eq('school_id', schoolId).eq('target_role', 'bot_context');
    const { error } = await supabase.from('admin_insights').insert({
        school_id: schoolId,
        target_role: 'bot_context',
        content: content,
        is_read: false
    });
    if (error) throw new Error(error.message);
};

export const getBotContext = async () => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return "";
    const { data, error } = await supabase
        .from('admin_insights')
        .select('content')
        .eq('school_id', schoolId)
        .eq('target_role', 'bot_context')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error || !data) return "";
    return data.content;
};

// ... (Exit Permissions, Appointments, News, Parent Link, Student Points) ...
const mapExitFromDB = (e: any): ExitPermission => ({ id: e.id, schoolId: e.school_id, studentId: e.student_id, studentName: e.student_name, grade: e.grade, className: e.class_name, parentName: e.parent_name, parentPhone: e.parent_phone, reason: e.reason, createdBy: e.created_by, createdByName: e.created_by_name, status: e.status, createdAt: e.created_at, completedAt: e.completed_at });
export const addExitPermission = async (perm: Omit<ExitPermission, 'id' | 'status' | 'createdAt' | 'completedAt'>) => { const schoolId = getActiveSchoolId(); if(!schoolId) throw new Error('No school'); const { error } = await supabase.from('exit_permissions').insert({ school_id: schoolId, student_id: perm.studentId, student_name: perm.studentName, grade: perm.grade, class_name: perm.className, parent_name: perm.parentName, parent_phone: perm.parentPhone, reason: perm.reason, created_by: perm.createdBy, created_by_name: perm.createdByName, status: 'pending_pickup' }); if (error) throw new Error(error.message); };
export const getExitPermissions = async (date?: string, status?: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('exit_permissions').select('*').eq('school_id', schoolId); 
    if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`); 
    if (status) query = query.eq('status', status); 
    const { data, error } = await query.order('created_at', { ascending: false }); 
    if (error) return []; return data.map(mapExitFromDB); 
};
export const getExitPermissionById = async (id: string): Promise<ExitPermission | null> => { const { data, error } = await supabase.from('exit_permissions').select('*').eq('id', id).single(); if (error) return null; return mapExitFromDB(data); };
export const getMyExitPermissions = async (studentIds: string[]) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId || studentIds.length === 0) return []; 
    const { data, error } = await supabase.from('exit_permissions').select('*').eq('school_id', schoolId).in('student_id', studentIds).order('created_at', { ascending: false }); 
    if (error) return []; return data.map(mapExitFromDB); 
};
export const completeExitPermission = async (id: string) => { 
    const { error } = await supabase.from('exit_permissions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id); 
    if (error) throw new Error(error.message); 
    
    // Notify Parent
    const { data: perm } = await supabase.from('exit_permissions').select('student_id, student_name').eq('id', id).single();
    if (perm) {
        await createNotification(perm.student_id, 'info', 'خروج طالب', `تم تسجيل خروج الطالب ${perm.student_name} من البوابة الآن.`);
    }
};

export const getAvailableSlots = async (date?: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('appointment_slots').select('*').eq('school_id', schoolId); 
    if (date) query = query.eq('date', date); else { const today = new Date().toISOString().split('T')[0]; query = query.gte('date', today); } 
    const { data, error } = await query.order('date', { ascending: true }).order('start_time', { ascending: true }); 
    if (error) return []; return data.map((s: any) => ({ id: s.id, date: s.date, startTime: s.start_time, endTime: s.end_time, maxCapacity: s.max_capacity, currentBookings: s.current_bookings })); 
};
export const generateDefaultAppointmentSlots = async (date: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    const slots = []; 
    // Updated Logic: 8:00 AM to 11:00 AM, 30 min intervals, Capacity 3
    const startHour = 8; 
    const startMinute = 0; 
    const endHour = 11; 
    let current = new Date(`${date}T${startHour.toString().padStart(2,'0')}:${startMinute.toString().padStart(2,'0')}:00`); 
    const end = new Date(`${date}T${endHour.toString().padStart(2,'0')}:00:00`); 
    
    while (current < end) { 
        const startTime = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}); 
        current.setMinutes(current.getMinutes() + 30); 
        const endTime = current.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}); 
        slots.push({ school_id: schoolId, date: date, start_time: startTime, end_time: endTime, max_capacity: 3, current_bookings: 0 }); 
    } 
    const { error } = await supabase.from('appointment_slots').insert(slots); 
    if (error) throw new Error(error.message); 
};
export const addAppointmentSlot = async (slot: Omit<AppointmentSlot, 'id' | 'currentBookings'>) => { const schoolId = getActiveSchoolId(); if(!schoolId) return; const { error } = await supabase.from('appointment_slots').insert({ school_id: schoolId, date: slot.date, start_time: slot.startTime, end_time: slot.endTime, max_capacity: slot.maxCapacity }); if (error) throw new Error(error.message); };
export const updateAppointmentSlot = async (slot: AppointmentSlot) => { const { error } = await supabase.from('appointment_slots').update({ start_time: slot.startTime, end_time: slot.endTime, max_capacity: slot.maxCapacity }).eq('id', slot.id); if (error) throw new Error(error.message); };
export const deleteAppointmentSlot = async (id: string) => { const { error } = await supabase.from('appointment_slots').delete().eq('id', id); if (error) throw new Error(error.message); };
export const bookAppointment = async (appt: Omit<Appointment, 'id' | 'status' | 'createdAt'>) => { const schoolId = getActiveSchoolId(); if(!schoolId) throw new Error('No school'); const { data: slot, error: slotError } = await supabase.from('appointment_slots').select('*').eq('id', appt.slotId).single(); if (slotError || !slot) throw new Error("الموعد غير موجود"); if (slot.current_bookings >= slot.max_capacity) throw new Error("عفواً، اكتمل العدد لهذا الموعد"); const { data: newAppt, error: bookError } = await supabase.from('appointments').insert({ school_id: schoolId, slot_id: appt.slotId, student_id: appt.studentId, student_name: appt.studentName, parent_name: appt.parentName, parent_civil_id: appt.parentCivilId, visit_reason: appt.visitReason }).select().single(); if (bookError) throw new Error(bookError.message); await supabase.from('appointment_slots').update({ current_bookings: slot.current_bookings + 1 }).eq('id', appt.slotId); return { id: newAppt.id, slotId: newAppt.slot_id, studentId: newAppt.student_id, studentName: newAppt.student_name, parentName: newAppt.parent_name, parentCivilId: newAppt.parent_civil_id, visitReason: newAppt.visit_reason, status: newAppt.status, createdAt: newAppt.created_at, slot: { id: slot.id, date: slot.date, startTime: slot.start_time, endTime: slot.end_time, maxCapacity: slot.max_capacity, currentBookings: slot.current_bookings + 1 } }; };
export const getMyAppointments = async (parentCivilId: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('appointments').select(`*, slot:appointment_slots(*)`).eq('school_id', schoolId).eq('parent_civil_id', parentCivilId).order('created_at', { ascending: false }); 
    if (error) return []; 
    return data.map((a: any) => ({ id: a.id, slotId: a.slot_id, studentId: a.student_id, studentName: a.student_name, parentName: a.parent_name, parentCivilId: a.parent_civil_id, visitReason: a.visit_reason, status: a.status, arrivedAt: a.arrived_at, createdAt: a.created_at, slot: a.slot ? { id: a.slot.id, date: a.slot.date, startTime: a.slot.start_time, endTime: a.slot.end_time, maxCapacity: a.slot.max_capacity, currentBookings: a.slot.current_bookings } : undefined })); 
};
export const getDailyAppointments = async (date?: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    let query = supabase.from('appointments').select(`*, slot:appointment_slots(*)`).eq('school_id', schoolId); 
    const { data, error } = await query.order('created_at', { ascending: false }); 
    if (error) return []; 
    
    // Map with type safety for joined slot
    const mapped = data.map((a: any) => ({ 
        id: a.id, 
        slotId: a.slot_id, 
        studentId: a.student_id, 
        studentName: a.student_name, 
        parentName: a.parent_name, 
        parentCivilId: a.parent_civil_id, 
        visitReason: a.visit_reason, 
        status: a.status, 
        arrivedAt: a.arrived_at, // Ensure this field is mapped
        createdAt: a.created_at, 
        slot: a.slot ? { 
            id: a.slot.id, 
            date: a.slot.date, 
            startTime: a.slot.start_time, 
            endTime: a.slot.end_time 
        } : undefined 
    })); 
    
    if (date) { 
        return mapped.filter((a: Appointment) => a.slot?.date === date); 
    } 
    return mapped; 
};
export const checkInVisitor = async (appointmentId: string) => { 
    // Update status AND arrived_at timestamp
    const { error } = await supabase.from('appointments').update({ 
        status: 'completed', 
        arrived_at: new Date().toISOString() 
    }).eq('id', appointmentId); 
    
    if (error) throw new Error(error.message); 
    
    // Notify Parent/Student (using studentId for targeting)
    const { data: appt } = await supabase.from('appointments').select('student_id, parent_name').eq('id', appointmentId).single();
    if(appt) {
        await createNotification(appt.student_id, 'success', 'تسجيل دخول', `تم تسجيل دخول ولي الأمر ${appt.parent_name} للمدرسة.`);
    }
};

export const getSchoolNews = async () => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('news').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }); 
    if (error) return []; return data.map((n: any) => ({ id: n.id, title: n.title, content: n.content, author: n.author, isUrgent: n.is_urgent, createdAt: n.created_at })); 
};
export const addSchoolNews = async (news: Omit<SchoolNews, 'id' | 'createdAt'>) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) throw new Error('No school');
    const { error } = await supabase.from('news').insert({ school_id: schoolId, title: news.title, content: news.content, author: news.author, is_urgent: news.isUrgent }); 
    if (error) throw new Error(error.message); 
    
    // Auto-Notify for Urgent News
    if (news.isUrgent) {
        await createNotification('ALL', 'alert', 'خبر عاجل', `${news.title}: ${news.content}`);
    }
};
export const updateSchoolNews = async (news: SchoolNews) => { const { error } = await supabase.from('news').update({ title: news.title, content: news.content, is_urgent: news.isUrgent }).eq('id', news.id); if (error) throw new Error(error.message); };
export const deleteSchoolNews = async (id: string) => { const { error } = await supabase.from('news').delete().eq('id', id); if (error) throw new Error(error.message); };

export const linkParentToStudent = async (parentCivilId: string, studentId: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) throw new Error('No school');
    const { data } = await supabase.from('parent_links').select('*').eq('school_id', schoolId).eq('parent_civil_id', parentCivilId).eq('student_id', studentId); 
    if (data && data.length > 0) return; 
    const { error } = await supabase.from('parent_links').insert({ school_id: schoolId, parent_civil_id: parentCivilId, student_id: studentId }); 
    if (error) throw new Error(error.message); 
};
export const getParentChildren = async (parentCivilId: string): Promise<Student[]> => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data: links, error } = await supabase.from('parent_links').select('student_id').eq('school_id', schoolId).eq('parent_civil_id', parentCivilId); 
    if (error) return []; if (!links || links.length === 0) return []; 
    const studentIds = links.map((l: any) => l.student_id); 
    const { data: students, error: err2 } = await supabase.from('students').select('*').eq('school_id', schoolId).in('student_id', studentIds); 
    if (err2) return []; return students.map(mapStudentFromDB); 
};
export const addStudentPoints = async (studentId: string, points: number, reason: string, type: 'behavior' | 'attendance' | 'academic') => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) throw new Error('No school');
    const { error } = await supabase.from('student_points').insert({ school_id: schoolId, student_id: studentId, points, reason, type }); 
    if (error) throw new Error(error.message); await createNotification(studentId, 'info', 'نقاط جديدة', `تم إضافة ${points} نقطة لرصيدك: ${reason}`); 
};
export const getStudentPoints = async (studentId: string): Promise<{total: number, history: StudentPoint[]}> => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return { total: 0, history: [] };
    const { data, error } = await supabase.from('student_points').select('*').eq('school_id', schoolId).eq('student_id', studentId).order('created_at', { ascending: false }); 
    if (error) return { total: 0, history: [] }; const total = data.reduce((sum: number, item: any) => sum + item.points, 0); const history = data.map((p: any) => ({ id: p.id, studentId: p.student_id, points: p.points, reason: p.reason, type: p.type, createdAt: p.created_at })); return { total, history }; 
};
export const getTopStudents = async (limit = 5) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('student_points').select('student_id, points').eq('school_id', schoolId); 
    if (error) return []; const totals: Record<string, number> = {}; data.forEach((row: any) => { totals[row.student_id] = (totals[row.student_id] || 0) + row.points; }); const topIds = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, limit); const result = []; for (const [sid, score] of topIds) { const student = await getStudentByCivilId(sid); if (student) result.push({ ...student, points: score }); } return result; 
};
export const createNotification = async (targetId: string, type: 'alert'|'info'|'success', title: string, message: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return;
    await supabase.from('notifications').insert({ school_id: schoolId, target_user_id: targetId, type, title, message }); 
};
export const sendBatchNotifications = async (targetUserIds: string[], type: 'alert'|'info'|'success', title: string, message: string) => {
    const schoolId = getActiveSchoolId();
    if(!schoolId || targetUserIds.length === 0) return;
    const notifications = targetUserIds.map(id => ({
        school_id: schoolId,
        target_user_id: id,
        type,
        title,
        message
    }));
    await supabase.from('notifications').insert(notifications);
};
export const getNotifications = async (targetId: string) => { 
    const schoolId = getActiveSchoolId();
    if(!schoolId) return [];
    const { data, error } = await supabase.from('notifications').select('*').eq('school_id', schoolId).eq('target_user_id', targetId).order('created_at', { ascending: false }); 
    if (error) return []; return data.map((n: any) => ({ id: n.id, targetUserId: n.target_user_id, title: n.title, message: n.message, isRead: n.is_read, type: n.type, createdAt: n.created_at })); 
};
export const markNotificationRead = async (id: string) => { await supabase.from('notifications').update({ is_read: true }).eq('id', id); };

// --- Advanced Notification Logic ---

export const generateTeacherAbsenceSummary = async () => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return { success: false, message: 'مدرسة غير محددة' };
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceData } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('date', today);
    const users = await getStaffUsers();
    
    if (!attendanceData || attendanceData.length === 0) return { success: false, message: 'لا يوجد بيانات حضور لهذا اليوم بعد.' };

    const notificationsToSend: any[] = [];

    for (const teacher of users) {
        // Find records for this teacher's assigned classes
        let absentCount = 0;
        const myAssignments = teacher.assignments || [];
        
        myAssignments.forEach(assignment => {
            const classRecord = attendanceData.find((r: any) => r.grade === assignment.grade && r.class_name === assignment.className);
            if (classRecord && classRecord.records) {
                absentCount += classRecord.records.filter((stu: any) => stu.status === 'ABSENT').length;
            }
        });

        if (absentCount > 0) {
            notificationsToSend.push({
                school_id: schoolId,
                target_user_id: teacher.id,
                type: 'info',
                title: 'ملخص الغياب اليومي',
                message: `تم رصد غياب ${absentCount} طالب في الفصول المسندة إليك اليوم (${today}).`
            });
        }
    }

    if (notificationsToSend.length > 0) {
        await supabase.from('notifications').insert(notificationsToSend);
        return { success: true, message: `تم إرسال ${notificationsToSend.length} إشعار للمعلمين.` };
    }
    return { success: true, message: 'لم يتم العثور على حالات غياب تستدعي التنبيه.' };
};

export const sendPendingReferralReminders = async () => {
    const schoolId = getActiveSchoolId();
    if(!schoolId) return { success: false, message: 'مدرسة غير محددة' };
    const { data: pendingReferrals } = await supabase.from('referrals').select('*').eq('school_id', schoolId).eq('status', 'pending');
    if (!pendingReferrals || pendingReferrals.length === 0) return { success: true, message: 'لا توجد إحالات معلقة.' };

    const users = await getStaffUsers();
    // Target counselors and deputy (those with 'students' or 'deputy' permission)
    const targetStaff = users.filter(u => u.permissions?.includes('students') || u.permissions?.includes('deputy'));
    
    const notificationsToSend = targetStaff.map(staff => ({
        school_id: schoolId,
        target_user_id: staff.id,
        type: 'alert',
        title: 'تذكير: إحالات معلقة',
        message: `يوجد ${pendingReferrals.length} إحالة جديدة بانتظار المعالجة. يرجى مراجعة صندوق الوارد.`
    }));

    if (notificationsToSend.length > 0) {
        await supabase.from('notifications').insert(notificationsToSend);
        return { success: true, message: `تم تنبيه ${notificationsToSend.length} من المختصين.` };
    }
    return { success: false, message: 'لم يتم العثور على موجهين/وكلاء لإرسال التنبيه.' };
};