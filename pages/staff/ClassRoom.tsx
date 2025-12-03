
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shuffle, Timer, Trophy, TrendingDown, TrendingUp, Grid, List, Sparkles, Eye, EyeOff, RefreshCw, HelpCircle, BookOpen, User, Star, Plus, Check, BrainCircuit, MessageCircle, Gavel, FileQuestion, Baby, Lightbulb, X, Send, Loader2, Settings, ToggleLeft, ToggleRight, CheckCircle, Lock, GraduationCap, ArrowRight } from 'lucide-react';
import { getStudents, getStudentPoints, generateSmartContent, getClassPerformance, addStudentPoints, saveClassPerformance, getStudentDailyPerformance } from '../../services/storage';
import { Student, StaffUser, ClassPerformance } from '../../types';

// --- Tool Interfaces ---
type AiToolType = 'none' | 'guess' | 'debate' | 'persona' | 'whatif' | 'simplify' | 'quiz';

const ClassRoom: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  
  // --- Selection State ---
  const [selectedClassId, setSelectedClassId] = useState<string>(''); // Format: "Grade|ClassName"
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [lessonTopic, setLessonTopic] = useState('');

  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsWithPoints, setStudentsWithPoints] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'tools' | 'stats'>('tools');
  
  // Tools State - Random Picker & Questions
  const [randomStudent, setRandomStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [generateQuestionWithPick, setGenerateQuestionWithPick] = useState(true); // Toggle State
  
  // Question AI State
  const [currentQuestion, setCurrentQuestion] = useState<{q: string, a: string} | null>(null);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // Rating State
  const [ratingLoading, setRatingLoading] = useState(false);
  const [lastRatedId, setLastRatedId] = useState<string | null>(null); // For visual feedback
  const [lastRatedPoints, setLastRatedPoints] = useState<number | null>(null);

  // Timer State
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // --- NEW AI TOOLS STATE ---
  const [activeAiTool, setActiveAiTool] = useState<AiToolType>('none');
  const [toolLoading, setToolLoading] = useState(false);
  
  // 1. Guess Game State
  const [guessData, setGuessData] = useState<{concept: string, hints: string[]} | null>(null);
  const [revealedHints, setRevealedHints] = useState<number>(0);

  // 2. Debate State
  const [debateData, setDebateData] = useState<{topic: string, pro: string[], con: string[]} | null>(null);

  // 3. Persona State
  const [personaName, setPersonaName] = useState('');
  const [personaChat, setPersonaChat] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [personaInput, setPersonaInput] = useState('');

  // 4. What If State
  const [whatIfScenario, setWhatIfScenario] = useState<string>('');

  // 5. Simplify State
  const [simplifyInput, setSimplifyInput] = useState('');
  const [simplifyOutput, setSimplifyOutput] = useState('');

  // 6. Quiz State
  const [quizData, setQuizData] = useState<{question: string, options: string[], answerIdx: number} | null>(null);
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizSelectedIdx, setQuizSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) { navigate('/staff/login'); return; }
    const u = JSON.parse(session);
    setUser(u);
    // Auto select first class if available
    if (u.assignments && u.assignments.length > 0) {
        const first = u.assignments[0];
        setSelectedClassId(`${first.grade}|${first.className}`);
        if(first.subject) setSelectedSubject(first.subject);
    }
  }, [navigate]);

  // Derived Lists for Dropdowns
  const uniqueClasses = useMemo(() => {
      if (!user?.assignments) return [];
      const seen = new Set();
      return user.assignments.filter(a => {
          const key = `${a.grade}|${a.className}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
      });
  }, [user]);

  const availableSubjects = useMemo(() => {
      if (!selectedClassId || !user?.assignments) return [];
      const [grade, className] = selectedClassId.split('|');
      const matches = user.assignments.filter(a => a.grade === grade && a.className === className);
      return Array.from(new Set(matches.map(a => a.subject).filter(Boolean))) as string[];
  }, [selectedClassId, user]);

  const isSessionReady = selectedClassId && selectedSubject && lessonTopic.trim();

  // Load Data and Lesson Topic
  useEffect(() => {
    if (!selectedClassId) return;
    const [grade, className] = selectedClassId.split('|');

    const load = async () => {
      const all = await getStudents();
      const clsStudents = all.filter(s => s.grade === grade && s.className === className);
      setStudents(clsStudents);
      
      const withPoints = await Promise.all(clsStudents.map(async s => {
          const pts = await getStudentPoints(s.studentId);
          return { ...s, points: pts.total };
      }));
      setStudentsWithPoints(withPoints.sort((a,b) => b.points - a.points));

      // Attempt to load existing lesson topic for today to sync with DailyFollowup
      try {
          const today = new Date().toISOString().split('T')[0];
          const perf = await getClassPerformance(today, grade, className);
          // Try to find a record with the current subject
          const topicRecord = perf.find((p: any) => p.subject === selectedSubject);
          if (topicRecord) {
              // Try to extract topic from behaviorNote if stored as [درس: ...]
              const match = topicRecord.behaviorNote?.match(/\[درس: (.*?)\]/);
              if (match) setLessonTopic(match[1]);
              else if (topicRecord.subject && topicRecord.subject !== 'عام') setLessonTopic(topicRecord.subject);
          }
      } catch (e) {}
    };
    load();
  }, [selectedClassId, selectedSubject]); // Reload if class or subject changes

  // --- AI Logic for Tools ---

  const handleToolSelect = (tool: AiToolType) => {
      setActiveAiTool(tool);
      // Reset specific tool states
      setGuessData(null); setRevealedHints(0);
      setDebateData(null);
      setPersonaChat([]); setPersonaName('');
      setWhatIfScenario('');
      setSimplifyInput(''); setSimplifyOutput('');
      setQuizData(null); setQuizRevealed(false); setQuizSelectedIdx(null);
  };

  const executeAiTool = async () => {
      setToolLoading(true);
      try {
          const seed = Math.floor(Math.random() * 9999);
          let prompt = '';
          
          switch (activeAiTool) {
              case 'guess':
                  prompt = `عن درس "${lessonTopic}"، اختر مفهوماً أو شخصية أو مصطلحاً رئيسياً.
                  ثم اكتب 3 تلميحات (Hints) عنه، ابدأ بالتلميح الصعب جداً، ثم المتوسط، ثم السهل المباشر.
                  الصيغة المطلوبة JSON فقط:
                  {"concept": "الاسم المخفي", "hints": ["تلميح صعب", "تلميح متوسط", "تلميح سهل"]}
                  Seed: ${seed}`;
                  const guessRes = await generateSmartContent(prompt);
                  try {
                      const json = JSON.parse(guessRes.replace(/```json|```/g, '').trim());
                      setGuessData(json);
                  } catch(e) { alert("حدث خطأ في التنسيق، حاول مرة أخرى."); }
                  break;

              case 'debate':
                  prompt = `عن درس "${lessonTopic}"، اختر قضية جدلية أو وجهة نظر تحتمل النقاش.
                  أعطني 3 حجج قوية للمؤيدين (Team A) و 3 حجج قوية للمعارضين (Team B).
                  الصيغة المطلوبة JSON فقط:
                  {"topic": "عنوان القضية الجدلية", "pro": ["حجة 1", "حجة 2", "حجة 3"], "con": ["ضد 1", "ضد 2", "ضد 3"]}
                  Seed: ${seed}`;
                  const debateRes = await generateSmartContent(prompt);
                  try {
                      const json = JSON.parse(debateRes.replace(/```json|```/g, '').trim());
                      setDebateData(json);
                  } catch(e) { alert("حدث خطأ في التنسيق."); }
                  break;

              case 'persona':
                  prompt = `من هي أهم شخصية تاريخية أو علمية (أو حتى شيء جماد متحدث مثل "الذرة") مرتبطة بدرس "${lessonTopic}"؟
                  أعطني الاسم فقط.`;
                  const persona = await generateSmartContent(prompt);
                  setPersonaName(persona.trim());
                  setPersonaChat([{role: 'ai', text: `أهلاً بكم يا طلاب. أنا ${persona.trim()}. اسألوني أي شيء عن الدرس!`}]);
                  break;

              case 'whatif':
                  prompt = `تخيل سيناريو "ماذا لو" خيالي ولكنه مبني على حقائق علمية عن درس "${lessonTopic}".
                  اجعل السيناريو مثيراً للتفكير والعصف الذهني للطلاب.
                  ابدأ بعبارة "ماذا لو..." واشرح التبعات.
                  Seed: ${seed}`;
                  const whatif = await generateSmartContent(prompt);
                  setWhatIfScenario(whatif);
                  break;

              case 'quiz':
                  prompt = `اكتب سؤال اختيار من متعدد (صعب قليلاً) عن درس "${lessonTopic}".
                  مع 4 خيارات (واحد صحيح و3 مشتتات ذكية).
                  الصيغة JSON:
                  {"question": "نص السؤال", "options": ["أ", "ب", "ج", "د"], "answerIdx": 0}
                  (answerIdx هو رقم الخيار الصحيح بدءاً من 0)
                  Seed: ${seed}`;
                  const quizRes = await generateSmartContent(prompt);
                  try {
                      const json = JSON.parse(quizRes.replace(/```json|```/g, '').trim());
                      setQuizData(json);
                  } catch(e) { alert("حدث خطأ."); }
                  break;
          }
      } catch (e) {
          alert("تعذر الاتصال بالذكاء الاصطناعي.");
      } finally {
          setToolLoading(false);
      }
  };

  const handlePersonaChat = async () => {
      if (!personaInput.trim()) return;
      const userText = personaInput;
      setPersonaChat(prev => [...prev, {role: 'user', text: userText}]);
      setPersonaInput('');
      
      setToolLoading(true);
      try {
          const prompt = `أنت تتقمص شخصية "${personaName}" في درس عن "${lessonTopic}".
          سألك طالب: "${userText}".
          أجب عليه بأسلوب الشخصية (مرح أو جاد حسب الشخصية) وبمعلومات صحيحة. اختصر الإجابة.`;
          const reply = await generateSmartContent(prompt);
          setPersonaChat(prev => [...prev, {role: 'ai', text: reply}]);
      } catch (e) {
      } finally {
          setToolLoading(false);
      }
  };

  const handleSimplify = async () => {
      if (!simplifyInput.trim()) return;
      setToolLoading(true);
      try {
          const prompt = `اشرح النص التالي بأسلوب مبسط جداً (كأنك تشرح لطفل عمره 5 سنوات) واستخدم تشبيهات من واقع الحياة (ألعاب، رياضة، طعام):
          "${simplifyInput}"`;
          const res = await generateSmartContent(prompt);
          setSimplifyOutput(res);
      } catch(e) {} finally { setToolLoading(false); }
  };

  // --- Regular Random Picker Logic ---
  const generateRandomPickerQuestion = async () => {
      // Must allow generating even if no explicit topic (using Subject as topic fallback or general)
      const topic = lessonTopic || selectedSubject || "ثقافة عامة";
      
      setIsGeneratingQuestion(true);
      setShowAnswer(false);
      setCurrentQuestion(null); 
      setLastRatedId(null); 
      
      try {
          const seed = Math.floor(Math.random() * 10000);
          const prompt = `اكتب سؤالاً قصيراً ومباشراً عن: "${topic}". ثم اكتب الإجابة. Seed: ${seed}.
          يجب أن يكون الرد بصيغة JSON فقط، بدون أي نصوص إضافية:
          {"q": "نص السؤال هنا", "a": "نص الإجابة هنا"}`;
          const response = await generateSmartContent(prompt);
          
          try {
              const json = JSON.parse(response.replace(/```json|```/g, '').trim());
              setCurrentQuestion(json);
          } catch (parseError) {
              // Fallback parsing
              const qMatch = response.match(/"q":\s*"([^"]+)"/i);
              const aMatch = response.match(/"a":\s*"([^"]+)"/i);
              if (qMatch) {
                  setCurrentQuestion({ q: qMatch[1].trim(), a: aMatch ? aMatch[1].trim() : '...' });
              } else {
                  setCurrentQuestion({ q: "سؤال عن " + topic, a: "..." });
              }
          }
      } catch (e) { setCurrentQuestion({ q: "حدث خطأ في التوليد", a: "" }); } finally { setIsGeneratingQuestion(false); }
  };

  const handleRateStudent = async (points: number) => {
      if (!randomStudent || !user || !selectedClassId) return;
      const [grade, className] = selectedClassId.split('|');
      
      setRatingLoading(true);
      setLastRatedId(null);
      
      try {
          // 1. Gamification Points
          await addStudentPoints(randomStudent.studentId, points, `مشاركة: ${lessonTopic || selectedSubject}`, 'academic');
          
          // 2. Daily Follow-up Sync (ClassPerformance)
          const today = new Date().toISOString().split('T')[0];
          
          // Fetch existing to preserve other data (homework, etc)
          const existingRecords = await getStudentDailyPerformance(randomStudent.studentId, today);
          // Look for record with current subject OR a general one if we don't have a topic
          const currentRecord = existingRecords.find(r => r.subject === selectedSubject) || existingRecords[0];

          const perfRecord: ClassPerformance = {
              id: currentRecord?.id || '',
              schoolId: user.schoolId,
              studentId: randomStudent.studentId,
              studentName: randomStudent.name,
              grade: grade,
              className: className,
              date: today,
              subject: selectedSubject, // Use selectedSubject to align with DailyFollowup
              participationScore: points, // Update the score
              homeworkStatus: currentRecord ? currentRecord.homeworkStatus : false, // Preserve
              behaviorNote: currentRecord ? currentRecord.behaviorNote : '', // Preserve
              createdBy: user.id
          };

          await saveClassPerformance([perfRecord]);

          // Update Local State
          setStudentsWithPoints(prev => prev.map(s => s.id === randomStudent.id ? { ...s, points: s.points + points } : s).sort((a,b) => b.points - a.points));
          
          // Visual Feedback Logic
          setLastRatedId(randomStudent.id);
          setLastRatedPoints(points);
          setTimeout(() => setLastRatedId(null), 2500); 

      } catch (e) { 
          alert("حدث خطأ في الاتصال."); 
      } finally { 
          setRatingLoading(false); 
      }
  };

  const pickRandom = () => {
      if (students.length === 0) return;
      setIsSpinning(true);
      setLastRatedId(null);
      if (generateQuestionWithPick) {
          setShowAnswer(false); 
          setCurrentQuestion(null);
      }
      
      let count = 0;
      const interval = setInterval(() => {
          setRandomStudent(students[Math.floor(Math.random() * students.length)]);
          count++;
          if (count > 15) {
              clearInterval(interval);
              setIsSpinning(false);
              // Only generate if toggle is ON
              if (generateQuestionWithPick) {
                  setTimeout(() => generateRandomPickerQuestion(), 100);
              }
          }
      }, 80);
  };

  // Timer Effect
  useEffect(() => {
      let interval: any;
      if (isTimerRunning && timer > 0) interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      else if (timer === 0) setIsTimerRunning(false);
      return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  if (!user) return null;

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-4xl mx-auto">
        
        {/* Header with 3-Step Selection */}
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-lg relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
                
                {/* Titles */}
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
                        <Sparkles className="text-yellow-400"/> الفصل الذكي
                    </h1>
                    <p className="text-slate-400 text-xs font-bold">بوابة الأدوات التعليمية التفاعلية</p>
                </div>

                {/* 3-Step Inputs */}
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    {/* 1. Class */}
                    <div className="relative group min-w-[160px]">
                        <select 
                            value={selectedClassId} 
                            onChange={e => { setSelectedClassId(e.target.value); setSelectedSubject(''); }} 
                            className="w-full bg-white/10 text-white border border-white/20 rounded-xl py-2.5 px-3 text-sm font-bold outline-none cursor-pointer hover:bg-white/20 transition-colors appearance-none pr-8"
                        >
                            <option value="">اختر الفصل</option>
                            {uniqueClasses.map((a, i) => <option key={i} value={`${a.grade}|${a.className}`}>{a.grade} - {a.className}</option>)}
                        </select>
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/>
                    </div>

                    {/* 2. Subject */}
                    <div className="relative group min-w-[160px]">
                        <select 
                            value={selectedSubject} 
                            onChange={e => setSelectedSubject(e.target.value)} 
                            disabled={!selectedClassId}
                            className="w-full bg-white/10 text-white border border-white/20 rounded-xl py-2.5 px-3 text-sm font-bold outline-none cursor-pointer hover:bg-white/20 transition-colors appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">اختر المادة</option>
                            {availableSubjects.map((sub, i) => <option key={i} value={sub}>{sub}</option>)}
                        </select>
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={16}/>
                    </div>

                    {/* 3. Topic */}
                    <div className="relative flex-1 min-w-[200px]">
                        <input 
                            value={lessonTopic} 
                            onChange={e => setLessonTopic(e.target.value)} 
                            placeholder="عنوان الدرس (مطلوب)" 
                            className="w-full bg-white/10 text-white placeholder:text-white/40 border border-white/20 rounded-xl py-2.5 px-4 text-sm font-bold outline-none focus:bg-white/20 focus:border-yellow-400 transition-colors"
                        />
                        {!lessonTopic && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                    </div>
                </div>
            </div>
        </div>

        {/* --- MAIN CONTENT (CONDITIONAL) --- */}
        {!isSessionReady ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 animate-fade-in">
                <div className="bg-slate-50 p-6 rounded-full">
                    <Lock size={48} className="text-slate-300"/>
                </div>
                <div className="max-w-md px-6">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">الفصل مغلق مؤقتاً</h3>
                    <p className="text-slate-500 leading-relaxed">
                        للبدء في استخدام الأدوات الذكية وقائمة الطلاب، يرجى إكمال البيانات في الشريط العلوي بالترتيب:
                        <br/>
                        <span className="font-bold text-indigo-600">1. الفصل</span> <ArrowRight className="inline w-3 h-3"/> <span className="font-bold text-indigo-600">2. المادة</span> <ArrowRight className="inline w-3 h-3"/> <span className="font-bold text-indigo-600">3. عنوان الدرس</span>
                    </p>
                </div>
            </div>
        ) : (
            <div className="animate-fade-in">
                
                {/* Tabs */}
                <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <button onClick={() => setActiveTab('tools')} className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${activeTab === 'tools' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Shuffle size={18}/> الأدوات التفاعلية</button>
                    <button onClick={() => setActiveTab('stats')} className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Trophy size={18}/> التقرير والتميز</button>
                </div>

                {activeTab === 'tools' && (
                    <div className="space-y-6">
                        
                        {/* AI Tools Grid */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {[
                                {id: 'guess', label: 'من أنا؟', icon: HelpCircle, color: 'text-amber-500', bg: 'bg-amber-50'},
                                {id: 'debate', label: 'مناظرة', icon: Gavel, color: 'text-emerald-500', bg: 'bg-emerald-50'},
                                {id: 'persona', label: 'المحاكي', icon: User, color: 'text-purple-500', bg: 'bg-purple-50'},
                                {id: 'whatif', label: 'ماذا لو', icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-50'},
                                {id: 'simplify', label: 'بسطها', icon: Baby, color: 'text-pink-500', bg: 'bg-pink-50'},
                                {id: 'quiz', label: 'اختبار', icon: FileQuestion, color: 'text-red-500', bg: 'bg-red-50'},
                            ].map(tool => (
                                <button 
                                    key={tool.id} 
                                    onClick={() => handleToolSelect(tool.id as AiToolType)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border-2 ${activeAiTool === tool.id ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-md' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                                >
                                    <div className={`${tool.bg} p-2 rounded-full mb-1 ${tool.color}`}><tool.icon size={20}/></div>
                                    <span className="text-[10px] font-bold text-slate-700">{tool.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* ACTIVE AI TOOL DISPLAY */}
                        {activeAiTool !== 'none' && (
                            <div className="bg-white rounded-[2rem] border-2 border-indigo-100 p-6 shadow-xl relative overflow-hidden animate-fade-in-up">
                                <button onClick={() => setActiveAiTool('none')} className="absolute top-4 left-4 p-2 bg-slate-100 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-500 transition-colors"><X size={20}/></button>
                                
                                {/* 1. GUESS GAME */}
                                {activeAiTool === 'guess' && (
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-amber-600 mb-6 flex items-center justify-center gap-2"><HelpCircle/> لعبة: من أنا؟</h3>
                                        {!guessData ? (
                                            <button onClick={executeAiTool} disabled={toolLoading} className="bg-amber-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-amber-600 transition-all flex items-center gap-2 mx-auto">
                                                {toolLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} ابدأ اللعبة
                                            </button>
                                        ) : (
                                            <div className="space-y-4 max-w-md mx-auto">
                                                {[0, 1, 2].map((idx) => (
                                                    <div 
                                                        key={idx} 
                                                        onClick={() => idx <= revealedHints && setRevealedHints(prev => Math.max(prev, idx + 1))}
                                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${revealedHints > idx ? 'bg-white border-amber-200 text-slate-800' : 'bg-slate-100 border-dashed border-slate-300 text-slate-400 hover:bg-slate-200'}`}
                                                    >
                                                        {revealedHints > idx ? (
                                                            <p className="font-bold text-lg">{guessData.hints[idx]}</p>
                                                        ) : (
                                                            <p className="font-bold text-sm">اضغط لكشف التلميح {idx === 0 ? 'الأصعب' : idx === 1 ? 'المتوسط' : 'السهل'}</p>
                                                        )}
                                                    </div>
                                                ))}
                                                {revealedHints >= 3 && (
                                                    <div className="mt-6 bg-green-100 text-green-800 p-4 rounded-2xl font-black text-2xl animate-bounce">
                                                        🎉 الإجابة: {guessData.concept}
                                                    </div>
                                                )}
                                                <button onClick={executeAiTool} className="mt-4 text-xs text-slate-400 underline">جولة جديدة</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 2. DEBATE */}
                                {activeAiTool === 'debate' && (
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-emerald-600 mb-4 flex items-center justify-center gap-2"><Gavel/> المناظرة الذكية</h3>
                                        {!debateData ? (
                                            <button onClick={executeAiTool} disabled={toolLoading} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto">
                                                {toolLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} إنشاء موضوع مناظرة
                                            </button>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className="bg-slate-100 p-3 rounded-xl inline-block font-bold text-slate-700 text-lg border border-slate-200">{debateData.topic}</div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-green-50 p-4 rounded-2xl border border-green-200">
                                                        <h4 className="font-bold text-green-700 mb-3 text-lg">👍 الفريق المؤيد</h4>
                                                        <ul className="text-right space-y-2">
                                                            {debateData.pro.map((p, i) => <li key={i} className="text-sm font-medium text-green-900 bg-white p-2 rounded-lg shadow-sm">✅ {p}</li>)}
                                                        </ul>
                                                    </div>
                                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                                                        <h4 className="font-bold text-red-700 mb-3 text-lg">👎 الفريق المعارض</h4>
                                                        <ul className="text-right space-y-2">
                                                            {debateData.con.map((c, i) => <li key={i} className="text-sm font-medium text-red-900 bg-white p-2 rounded-lg shadow-sm">❌ {c}</li>)}
                                                        </ul>
                                                    </div>
                                                </div>
                                                <button onClick={executeAiTool} className="mt-4 text-xs text-slate-400 underline">موضوع جديد</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 3. PERSONA */}
                                {activeAiTool === 'persona' && (
                                    <div className="flex flex-col h-[400px]">
                                        <h3 className="text-lg font-bold text-purple-600 mb-2 flex items-center justify-center gap-2"><User/> المحاكي التاريخي/العلمي</h3>
                                        {personaName ? (
                                            <>
                                                <div className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full font-bold text-center mb-4 self-center text-sm">أنت تتحدث الآن مع: {personaName}</div>
                                                <div className="flex-1 overflow-y-auto bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4 space-y-3 custom-scrollbar">
                                                    {personaChat.map((msg, idx) => (
                                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'}`}>
                                                                {msg.text}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {toolLoading && <div className="text-xs text-slate-400 animate-pulse">جاري الكتابة...</div>}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input 
                                                        value={personaInput} 
                                                        onChange={e => setPersonaInput(e.target.value)} 
                                                        onKeyDown={e => e.key === 'Enter' && handlePersonaChat()}
                                                        placeholder="اسأل الشخصية سؤالاً..." 
                                                        className="flex-1 bg-white border border-slate-300 rounded-xl px-4 outline-none focus:border-purple-500"
                                                    />
                                                    <button onClick={handlePersonaChat} disabled={toolLoading} className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700"><Send size={18}/></button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center">
                                                <button onClick={executeAiTool} disabled={toolLoading} className="bg-purple-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2">
                                                    {toolLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} استحضار الشخصية
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 4. WHAT IF */}
                                {activeAiTool === 'whatif' && (
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-blue-600 mb-6 flex items-center justify-center gap-2"><Lightbulb/> ماذا لو؟</h3>
                                        {!whatIfScenario ? (
                                            <button onClick={executeAiTool} disabled={toolLoading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 mx-auto">
                                                {toolLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} توليد سيناريو خيالي
                                            </button>
                                        ) : (
                                            <div className="max-w-xl mx-auto">
                                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100 text-lg font-medium text-slate-800 leading-loose shadow-inner relative">
                                                    <Sparkles className="absolute top-4 right-4 text-blue-300 opacity-50" size={48}/>
                                                    "{whatIfScenario}"
                                                </div>
                                                <button onClick={executeAiTool} className="mt-6 text-sm bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200">سيناريو آخر</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 5. SIMPLIFY */}
                                {activeAiTool === 'simplify' && (
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-pink-600 mb-6 flex items-center justify-center gap-2"><Baby/> المترجم المبسط (اشرح لي كأن عمري 5 سنوات)</h3>
                                        <div className="flex flex-col gap-4 max-w-lg mx-auto">
                                            <textarea 
                                                value={simplifyInput} 
                                                onChange={e => setSimplifyInput(e.target.value)} 
                                                placeholder="الصق النص المعقد أو المفهوم الصعب هنا..." 
                                                className="w-full p-4 border-2 border-slate-200 rounded-2xl outline-none focus:border-pink-400 min-h-[100px] text-sm font-medium"
                                            ></textarea>
                                            <button onClick={handleSimplify} disabled={toolLoading || !simplifyInput} className="bg-pink-500 text-white py-3 rounded-xl font-bold hover:bg-pink-600 transition-all shadow-md">
                                                {toolLoading ? <Loader2 className="animate-spin mx-auto"/> : 'بسطها لي!'}
                                            </button>
                                            {simplifyOutput && (
                                                <div className="bg-pink-50 p-5 rounded-2xl border border-pink-100 text-pink-900 text-sm leading-relaxed font-medium text-right shadow-sm mt-2 animate-fade-in">
                                                    {simplifyOutput}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 6. QUIZ */}
                                {activeAiTool === 'quiz' && (
                                    <div className="text-center">
                                        <h3 className="text-lg font-bold text-red-600 mb-6 flex items-center justify-center gap-2"><FileQuestion/> تحدي السرعة</h3>
                                        {!quizData ? (
                                            <button onClick={executeAiTool} disabled={toolLoading} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all flex items-center gap-2 mx-auto">
                                                {toolLoading ? <Loader2 className="animate-spin"/> : <Sparkles size={18}/>} سؤال جديد
                                            </button>
                                        ) : (
                                            <div className="max-w-xl mx-auto">
                                                <h2 className="text-xl font-black text-slate-800 mb-6 leading-relaxed">{quizData.question}</h2>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {quizData.options.map((opt, idx) => (
                                                        <button 
                                                            key={idx} 
                                                            onClick={() => { setQuizSelectedIdx(idx); setQuizRevealed(true); }}
                                                            disabled={quizRevealed}
                                                            className={`p-4 rounded-xl font-bold text-lg border-2 transition-all ${
                                                                quizRevealed 
                                                                    ? idx === quizData.answerIdx 
                                                                        ? 'bg-green-500 text-white border-green-600 scale-105 shadow-lg' 
                                                                        : idx === quizSelectedIdx ? 'bg-red-100 text-red-800 border-red-300' : 'bg-slate-50 text-slate-400 border-slate-100'
                                                                    : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700'
                                                            }`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                                {quizRevealed && (
                                                    <div className="mt-6">
                                                        {quizSelectedIdx === quizData.answerIdx ? 
                                                            <p className="text-green-600 font-black text-xl animate-bounce">إجابة صحيحة! 👏</p> : 
                                                            <p className="text-red-500 font-bold">حظاً أوفر! الإجابة هي: {quizData.options[quizData.answerIdx]}</p>
                                                        }
                                                        <button onClick={executeAiTool} className="mt-4 text-xs bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">سؤال آخر</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Legacy Tools: Random Picker & Timer */}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Random Picker */}
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
                                <h3 className="font-bold text-slate-400 mb-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"><Shuffle size={14}/> الاختيار العشوائي</h3>
                                <div className={`h-32 flex flex-col items-center justify-center bg-slate-50 rounded-3xl mb-4 transition-all border-4 ${isSpinning ? 'scale-105 bg-indigo-50 border-indigo-200' : 'border-slate-100'}`}>
                                    {randomStudent ? (
                                        <>
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl font-bold text-indigo-600 shadow-sm mb-2 border-2 border-indigo-50">{randomStudent.name.charAt(0)}</div>
                                            <h2 className="text-2xl font-black text-slate-800">{randomStudent.name}</h2>
                                        </>
                                    ) : (
                                        <div className="text-slate-300 flex flex-col items-center"><User size={40} className="mb-2 opacity-50"/><span className="font-bold">جاهز</span></div>
                                    )}
                                </div>
                                
                                {/* Question Display */}
                                {randomStudent && !isSpinning && !activeAiTool && generateQuestionWithPick && (
                                    <div className="mb-4">
                                        {isGeneratingQuestion ? <p className="text-xs text-purple-500 animate-pulse">جاري تحضير سؤال...</p> : currentQuestion ? (
                                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-sm text-right">
                                                <p className="font-bold text-blue-900 mb-2">{currentQuestion.q}</p>
                                                <button onClick={() => setShowAnswer(!showAnswer)} className="text-xs text-blue-600 underline">{showAnswer ? currentQuestion.a : 'إظهار الإجابة'}</button>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                {/* Rating with Visual Feedback Overlay */}
                                {randomStudent && !isSpinning && (
                                    <div className="mb-4 flex flex-col items-center relative">
                                        {lastRatedId === randomStudent.id ? (
                                            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl animate-fade-in">
                                                <div className="flex items-center gap-2 text-emerald-600 font-black text-lg bg-emerald-50 px-4 py-2 rounded-full border-2 border-emerald-100 shadow-sm">
                                                    <CheckCircle size={24}/> تم التقييم ({lastRatedPoints}) ✅
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="flex gap-2">
                                            {[1,2,3,4,5].map(s=><button key={s} onClick={()=>handleRateStudent(s)} disabled={ratingLoading} className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-500 font-bold hover:bg-yellow-400 hover:text-white transition-all">{s}</button>)}
                                        </div>
                                    </div>
                                )}

                                {/* Control Buttons */}
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => pickRandom()} disabled={isSpinning} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">{isSpinning ? '...' : 'اختر طالباً'}</button>
                                    <label className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 cursor-pointer p-2 hover:bg-slate-50 rounded-xl select-none">
                                        <div className={`w-10 h-5 rounded-full relative transition-colors ${generateQuestionWithPick ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${generateQuestionWithPick ? 'left-6' : 'left-1'}`}></div>
                                        </div>
                                        <input type="checkbox" checked={generateQuestionWithPick} onChange={e => setGenerateQuestionWithPick(e.target.checked)} className="hidden" />
                                        توليد سؤال تلقائي مع القرعة
                                    </label>
                                </div>
                            </div>

                            {/* Timer */}
                            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                                <h3 className="font-bold text-slate-400 mb-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest"><Timer size={14}/> المؤقت</h3>
                                <div className="text-5xl font-mono font-black text-slate-800 mb-6 tracking-wider bg-slate-50 py-4 rounded-3xl shadow-inner">
                                    {Math.floor(timer / 60).toString().padStart(2, '0')}:{ (timer % 60).toString().padStart(2, '0') }
                                </div>
                                <div className="flex gap-2 justify-center mb-4">
                                    {[1, 5, 10].map(m => <button key={m} onClick={() => setTimer(m * 60)} className="bg-white border-2 border-slate-100 px-4 py-2 rounded-xl font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all">{m}د</button>)}
                                </div>
                                <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${isTimerRunning ? 'bg-red-500 shadow-red-200' : 'bg-emerald-500 shadow-emerald-200'}`}>{isTimerRunning ? 'إيقاف' : 'بدء'}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Tab */}
                {activeTab === 'stats' && (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 text-lg"><Trophy className="text-yellow-500"/> لوحة الشرف</h3>
                            <div className="space-y-3">
                                {studentsWithPoints.slice(0, 5).map((s, i) => (
                                    <div key={s.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-yellow-50 to-white rounded-2xl border border-yellow-100 shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-sm ${i===0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i+1}</div>
                                            <p className="font-bold text-slate-800 text-lg">{s.name}</p>
                                        </div>
                                        <span className="font-black text-yellow-600 bg-white px-4 py-1 rounded-full shadow-sm">{s.points} 🌟</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default ClassRoom;
