
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Save, CheckCircle, XCircle, Star, BookOpen, Loader2, 
  Zap, AlertCircle, Clock, CheckSquare, RotateCcw, Tag, MoreHorizontal, 
  ChevronDown, ChevronUp, Mic, Image as ImageIcon, Users, LayoutGrid, 
  List, Medal, Timer, Shuffle, Volume2, Plus, Trash2, Camera, MapPin,
  Sparkles, X, GraduationCap, ArrowRight, PenTool, Lock, Wand2, BarChart2
} from 'lucide-react';
import { getStudents, saveClassPerformance, getClassPerformance, addStudentPoints, getAttendanceRecordForClass, generateSmartContent } from '../../services/storage';
import { Student, StaffUser, ClassPerformance, ClassAssignment, AttendanceStatus } from '../../types';

// --- Types & Constants ---

const QUICK_TAGS = [
    { label: 'مشارك بفعالية', type: 'positive', color: 'bg-emerald-100 text-emerald-700' },
    { label: 'تفكير إبداعي', type: 'positive', color: 'bg-blue-100 text-blue-700' },
    { label: 'مساعدة زملائه', type: 'positive', color: 'bg-purple-100 text-purple-700' },
    { label: 'نسيان الأدوات', type: 'negative', color: 'bg-amber-100 text-amber-700' },
    { label: 'حديث جانبي', type: 'negative', color: 'bg-orange-100 text-orange-700' },
];

const BADGES = [
    { id: 'quiet_hero', label: 'بطل الهدوء', icon: '🤫', points: 3 },
    { id: 'super_helper', label: 'المساعد الخارق', icon: '🦸‍♂️', points: 5 },
    { id: 'best_handwriting', label: 'أجمل خط', icon: '✍️', points: 2 },
    { id: 'creative_mind', label: 'المفكر المبدع', icon: '💡', points: 4 },
];

interface StudentGroup {
    id: string;
    name: string;
    members: string[]; // Student IDs
}

const DailyFollowup: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  
  // Selection State (Updated to split Grade/Class)
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Data States
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [currentStudents, setCurrentStudents] = useState<Student[]>([]);
  const [performanceData, setPerformanceData] = useState<Record<string, { participation: number, homework: boolean, note: string, badges: string[] }>>({});
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  
  // UI States & Views
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'seats' | 'groups'>('list');
  const [showTools, setShowTools] = useState(false);
  
  // Lesson Documentation
  const [lessonTopic, setLessonTopic] = useState(''); 
  const [smartTags, setSmartTags] = useState<string[]>([]);
  const [generatingTags, setGeneratingTags] = useState(false);
  
  // Groups
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  
  // Tools State
  const [timerVal, setTimerVal] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [randomWinner, setRandomWinner] = useState<Student | null>(null);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [isListeningNoise, setIsListeningNoise] = useState(false);
  
  // Voice Command State
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [ambiguousNames, setAmbiguousNames] = useState<Student[]>([]);

  // AI Spotlight
  const [aiSuggestion, setAiSuggestion] = useState<{studentId: string, reason: string} | null>(null);

  // Refs for Tools
  const timerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('ozr_staff_session');
    if (!session) { navigate('/staff/login'); return; }
    const u = JSON.parse(session);
    setUser(u);
    
    // Initial fetch of all students
    getStudents().then(data => {
        setAllStudents(data);
        // Try auto-select based on assignment
        if (u.assignments && u.assignments.length > 0) {
            const first = u.assignments[0];
            // Verify if this grade exists in DB to be safe
            if (data.some((s: Student) => s.grade === first.grade)) {
                setSelectedGrade(first.grade);
                setSelectedClass(first.className);
                if (first.subject) setSelectedSubject(first.subject);
            }
        }
    });
  }, [navigate]);

  // --- Dynamic Filtering Logic ---
  const uniqueGrades = useMemo(() => {
      const grades = new Set(allStudents.map(s => s.grade));
      return Array.from(grades).sort();
  }, [allStudents]);

  const availableClasses = useMemo(() => {
      if (!selectedGrade) return [];
      const classes = new Set(allStudents.filter(s => s.grade === selectedGrade).map(s => s.className));
      return Array.from(classes).sort();
  }, [allStudents, selectedGrade]);

  const availableSubjects = useMemo(() => {
      if (!user?.assignments) return ['عام', 'لغتي', 'رياضيات', 'علوم', 'دين', 'إنجليزي']; // Fallbacks
      // Filter assignments matching this class to find subjects
      const matches = user.assignments.filter(a => a.grade === selectedGrade && a.className === selectedClass);
      const subjects = Array.from(new Set(matches.map(a => a.subject).filter(Boolean))) as string[];
      return subjects.length > 0 ? subjects : ['عام'];
  }, [selectedGrade, selectedClass, user]);

  // Main Data Loader
  useEffect(() => {
    if (!selectedGrade || !selectedClass || !user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [savedPerf, attRecord] = await Promise.all([
            getClassPerformance(date, selectedGrade, selectedClass),
            getAttendanceRecordForClass(date, selectedGrade, selectedClass)
        ]);
        
        const filteredStudents = allStudents.filter(s => s.grade === selectedGrade && s.className === selectedClass);
        setCurrentStudents(filteredStudents);

        // --- Load Lesson Info ---
        if (savedPerf && savedPerf.length > 0) {
            const relevantRecord = selectedSubject 
                ? savedPerf.find((p: any) => p.subject === selectedSubject) 
                : savedPerf[0];
            
            if (relevantRecord && relevantRecord.behaviorNote) {
                 const topicMatch = relevantRecord.behaviorNote.match(/\[درس: (.*?)\]/);
                 if (topicMatch) setLessonTopic(topicMatch[1]);
                 else setLessonTopic('');
            } else {
                setLessonTopic('');
            }
        } else {
            setLessonTopic('');
        }

        // Init Groups
        if (groups.length === 0 && filteredStudents.length > 0) {
            const groupNames = ['الصقور', 'النجوم', 'العباقرة', 'المستقبل'];
            const newGroups: StudentGroup[] = groupNames.map((name, idx) => ({ id: `g-${idx}`, name, members: [] }));
            filteredStudents.forEach((s, i) => {
                newGroups[i % newGroups.length].members.push(s.id);
            });
            setGroups(newGroups);
        }

        // Map Attendance
        const attMap: Record<string, AttendanceStatus> = {};
        if (attRecord) {
            attRecord.records.forEach((r: any) => attMap[r.studentId] = r.status);
        }
        setAttendanceMap(attMap);

        // Map Performance
        const initialData: any = {};
        filteredStudents.forEach(s => {
            const saved = savedPerf.find((p: any) => p.studentId === s.studentId && (!selectedSubject || p.subject === selectedSubject));
            initialData[s.id] = {
                participation: saved ? saved.participationScore : 0,
                homework: saved ? saved.homeworkStatus : false,
                note: saved ? saved.behaviorNote || '' : '',
                badges: []
            };
        });
        setPerformanceData(initialData);

        // AI Spotlight
        if (filteredStudents.length > 0) {
            const randomStudent = filteredStudents[Math.floor(Math.random() * filteredStudents.length)];
            setAiSuggestion({
                studentId: randomStudent.id,
                reason: `الطالب ${randomStudent.name} أداؤه مستقر، جرب توجيه سؤال صعب له اليوم.`
            });
        }

      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadData();
  }, [selectedGrade, selectedClass, selectedSubject, date, user, allStudents]);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
      const presentCount = Object.values(attendanceMap).filter(s => s === AttendanceStatus.PRESENT).length;
      const totalStars = Object.values(performanceData).reduce((sum, d: any) => sum + (d.participation || 0), 0);
      const evaluatedCount = Object.values(performanceData).filter((d: any) => d.participation > 0 || d.homework).length;
      return { presentCount, totalStars, evaluatedCount };
  }, [attendanceMap, performanceData]);

  // --- Logic Helpers ---

  const updateStudentData = (id: string, field: string, value: any) => {
      setPerformanceData(prev => ({
          ...prev,
          [id]: { ...prev[id], [field]: value }
      }));
  };

  const toggleBadge = (studentId: string, badgeId: string) => {
      setPerformanceData(prev => {
          const currentBadges = prev[studentId].badges || [];
          const newBadges = currentBadges.includes(badgeId) 
              ? currentBadges.filter(b => b !== badgeId)
              : [...currentBadges, badgeId];
          return { ...prev, [studentId]: { ...prev[studentId], badges: newBadges } };
      });
  };

  const handleGroupEval = (groupId: string, field: 'participation' | 'homework', value: any) => {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;
      setPerformanceData(prev => {
          const newState = { ...prev };
          group.members.forEach(mId => {
              if (attendanceMap[currentStudents.find(s=>s.id===mId)?.studentId || ''] !== AttendanceStatus.ABSENT) {
                  newState[mId] = { ...newState[mId], [field]: value };
              }
          });
          return newState;
      });
  };

  const handleSave = async () => {
      if (!selectedGrade || !selectedClass || !user) return;
      if (!selectedSubject) { alert("يرجى اختيار المادة."); return; }
      if (!lessonTopic.trim()) { alert("عنوان الدرس إلزامي لتوثيق الحصة."); return; }

      setSaving(true);
      try {
          const records: ClassPerformance[] = currentStudents.map(s => {
              const data = performanceData[s.id];
              let finalNote = data.note;
              finalNote = `[درس: ${lessonTopic}] ${finalNote}`;
              if (data.badges.length > 0) finalNote = `${finalNote} [أوسمة: ${data.badges.map(b => BADGES.find(x=>x.id===b)?.label).join(', ')}]`;

              return {
                  id: '',
                  studentId: s.studentId,
                  studentName: s.name,
                  grade: selectedGrade,
                  className: selectedClass,
                  date,
                  subject: selectedSubject, 
                  participationScore: data.participation,
                  homeworkStatus: data.homework,
                  behaviorNote: finalNote,
                  createdBy: user.id
              };
          });
          
          await saveClassPerformance(records);
          alert("تم حفظ المتابعة بنجاح!");
      } catch (e) { alert("فشل الحفظ"); }
      finally { setSaving(false); }
  };

  // --- SMART TAGS LOGIC ---
  const generateSmartTags = async () => {
      if(!lessonTopic) return;
      setGeneratingTags(true);
      try {
          const prompt = `
          Generate 5 short, distinct, positive or neutral classroom observation tags (max 3 words each, in Arabic) 
          relevant for a student attending a class about "${lessonTopic}".
          Return ONLY a JSON array of strings. Example: ["Solved math problem", "Participated in reading"]
          `;
          const res = await generateSmartContent(prompt);
          try {
              const tags = JSON.parse(res.replace(/```json|```/g, '').trim());
              setSmartTags(tags);
          } catch(e) {
              setSmartTags(['تفاعل ممتاز', 'أجاب بذكاء', 'انتبه للشرح']); // Fallback
          }
      } catch(e) { console.error(e); }
      finally { setGeneratingTags(false); }
  };

  const generateSessionAnalysis = async () => {
      if(stats.evaluatedCount < 3) { alert("البيانات قليلة جداً للتحليل"); return; }
      setLoading(true);
      try {
          const prompt = `
          Analyze this class session:
          - Topic: ${lessonTopic}
          - Total Students: ${currentStudents.length}
          - Present: ${stats.presentCount}
          - Active Participants (Stars > 0): ${stats.evaluatedCount}
          - Total Stars Given: ${stats.totalStars}
          
          Give a 2 sentence summary for the teacher about the engagement level.
          `;
          const res = await generateSmartContent(prompt);
          alert(res);
      } catch(e) { alert("Error"); } finally { setLoading(false); }
  };

  // --- Tools Logic ---
  useEffect(() => {
      if (isTimerRunning && timerVal > 0) {
          timerRef.current = setInterval(() => setTimerVal(prev => prev - 1), 1000);
      } else if (timerVal === 0) {
          setIsTimerRunning(false);
          if (timerRef.current) clearInterval(timerRef.current);
      }
      return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timerVal]);

  const toggleNoiseMeter = async () => {
      if (isListeningNoise) {
          setIsListeningNoise(false);
          if (audioContextRef.current) audioContextRef.current.close();
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          setNoiseLevel(0);
          return;
      }
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
          microphoneRef.current.connect(analyserRef.current);
          analyserRef.current.fftSize = 256;
          const bufferLength = analyserRef.current.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          const updateVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b) / bufferLength;
              setNoiseLevel(average);
              animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          setIsListeningNoise(true);
          updateVolume();
      } catch (err) { alert("لا يمكن الوصول للميكروفون."); }
  };

  const pickRandom = () => {
      const presentStudents = currentStudents.filter(s => attendanceMap[s.studentId] !== AttendanceStatus.ABSENT);
      if (presentStudents.length === 0) return;
      let count = 0;
      const interval = setInterval(() => {
          setRandomWinner(presentStudents[Math.floor(Math.random() * presentStudents.length)]);
          count++;
          if (count > 10) clearInterval(interval);
      }, 100);
  };

  const startVoiceCommand = () => {
      if (!('webkitSpeechRecognition' in window)) { alert("المتصفح لا يدعم التعرف الصوتي."); return; }
      setIsVoiceListening(true);
      setAmbiguousNames([]);
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setVoiceTranscript(transcript);
          processVoiceCommand(transcript);
          setIsVoiceListening(false);
      };
      recognition.onerror = () => setIsVoiceListening(false);
      recognition.start();
  };

  const processVoiceCommand = (text: string) => {
      const words = text.split(' ');
      const keywords = { 'ممتاز': { field: 'participation', value: 5 }, 'جيد': { field: 'participation', value: 3 }, 'مشارك': { field: 'participation', value: 4 }, 'واجب': { field: 'homework', value: true }, 'نسي': { field: 'homework', value: false }, 'بطل': { badge: 'super_helper' } };
      let action: any = null;
      for (const [key, val] of Object.entries(keywords)) { if (text.includes(key)) action = val; }
      if (!action) { alert("لم يتم التعرف على الأمر."); return; }
      const matchedStudents = currentStudents.filter(s => text.includes(s.name.split(' ')[0])); 
      if (matchedStudents.length === 1) {
          const s = matchedStudents[0];
          if (action.field) updateStudentData(s.id, action.field, action.value);
          if (action.badge) toggleBadge(s.id, action.badge);
      } else if (matchedStudents.length > 1) { setAmbiguousNames(matchedStudents); } else { alert("لم يتم العثور على الطالب."); }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-28 animate-fade-in max-w-6xl mx-auto">
        
        {/* --- TOP BAR: DYNAMIC FILTERING --- */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto items-center">
                
                {/* 1. Grade Selector */}
                <div className="relative group w-full md:w-40">
                    <GraduationCap className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={20} />
                    <select
                        value={selectedGrade}
                        onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); }}
                        className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-800 font-bold py-3 pr-10 pl-4 rounded-2xl outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-white text-sm"
                    >
                        <option value="">الصف</option>
                        {uniqueGrades.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                {/* 2. Class Selector */}
                <div className="relative group w-full md:w-40">
                    <Users className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={20} />
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        disabled={!selectedGrade}
                        className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-800 font-bold py-3 pr-10 pl-4 rounded-2xl outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-white disabled:opacity-50 text-sm"
                    >
                        <option value="">الفصل</option>
                        {availableClasses.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                {/* 3. Subject Selector */}
                <div className="relative group w-full md:w-40">
                    <BookOpen className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={20} />
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        disabled={!selectedClass}
                        className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-800 font-bold py-3 pr-10 pl-4 rounded-2xl outline-none focus:border-blue-500 transition-all cursor-pointer hover:bg-white disabled:opacity-50 text-sm"
                    >
                        <option value="">المادة</option>
                        {availableSubjects.map((sub, idx) => <option key={idx} value={sub}>{sub}</option>)}
                    </select>
                    <ChevronDown className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                </div>

                {/* Date */}
                <div className="relative w-full md:w-auto">
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)} 
                        className="bg-slate-50 border-2 border-slate-200 text-slate-600 font-bold py-3 px-4 rounded-2xl outline-none focus:border-indigo-500 w-full"
                    />
                </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
                <div className="text-center px-4">
                    <p className="text-xs text-slate-400 font-bold uppercase">الحضور</p>
                    <p className="text-xl font-black text-emerald-600">{stats.presentCount}</p>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="text-center px-4">
                    <p className="text-xs text-slate-400 font-bold uppercase">نجوم</p>
                    <p className="text-xl font-black text-yellow-500">{stats.totalStars}</p>
                </div>
            </div>
        </div>

        {/* --- LESSON DOCUMENTATION & AI TAGS --- */}
        <div className="bg-gradient-to-r from-indigo-900 to-blue-900 p-6 rounded-[2rem] shadow-lg relative overflow-hidden text-white">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                <div className="flex-1 w-full">
                    <label className="text-xs text-indigo-200 font-bold uppercase mb-1 flex items-center gap-1">
                        عنوان الدرس <span className="text-red-400 text-[10px] bg-red-900/50 px-2 rounded">إلزامي للتوثيق</span>
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                value={lessonTopic} 
                                onChange={e => setLessonTopic(e.target.value)} 
                                placeholder="اكتب عنوان الدرس هنا..." 
                                className="text-xl font-bold text-white placeholder:text-indigo-300/50 bg-white/10 rounded-xl px-4 py-3 outline-none w-full border-2 border-indigo-400/30 focus:border-yellow-400 transition-colors shadow-inner"
                            />
                            {!lessonTopic && <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={20}/>}
                        </div>
                        <button 
                            onClick={generateSmartTags} 
                            disabled={generatingTags || !lessonTopic}
                            className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50"
                            title="توليد وسوم ذكية بناءً على الموضوع"
                        >
                            {generatingTags ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                            وسوم ذكية
                        </button>
                    </div>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto mt-6 md:mt-0">
                    <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-white/10 backdrop-blur-sm flex-1 md:flex-none justify-center">
                        <ImageIcon size={18}/> صورة
                    </button>
                    <button className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors border border-white/10 backdrop-blur-sm flex-1 md:flex-none justify-center">
                        <Mic size={18}/> صوتي
                    </button>
                </div>
            </div>
        </div>

        {/* --- AI SPOTLIGHT --- */}
        {aiSuggestion && (
            <div className="bg-white border-l-4 border-purple-500 rounded-xl p-4 shadow-sm flex justify-between items-center animate-fade-in-up">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-50 p-2 rounded-full"><Sparkles size={20} className="text-purple-600"/></div>
                    <div>
                        <p className="text-xs text-purple-600 font-bold uppercase mb-0.5">اقتراح المساعد الذكي</p>
                        <p className="text-sm font-medium text-slate-700">{aiSuggestion.reason}</p>
                    </div>
                </div>
                <button onClick={() => setAiSuggestion(null)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
            </div>
        )}

        {/* --- MAIN TOOLBAR --- */}
        <div className="sticky top-4 z-30 bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-lg border border-slate-200/50 flex flex-wrap justify-between items-center gap-3">
            <div className="flex bg-slate-100 p-1.5 rounded-xl">
                <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="قائمة"><List size={20}/></button>
                <button onClick={() => setViewMode('seats')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'seats' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="المقاعد"><LayoutGrid size={20}/></button>
                <button onClick={() => setViewMode('groups')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'groups' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`} title="مجموعات"><Users size={20}/></button>
            </div>

            <div className="flex gap-2 flex-1 justify-center md:justify-start">
                <button onClick={() => setShowTools(!showTools)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${showTools ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    <Zap size={18}/> <span className="hidden sm:inline">أدوات الفصل</span>
                </button>

                <button onClick={startVoiceCommand} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isVoiceListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                    <Mic size={18}/> <span className="hidden sm:inline">{isVoiceListening ? 'استماع...' : 'أمر صوتي'}</span>
                </button>
                
                <button onClick={generateSessionAnalysis} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all">
                    <BarChart2 size={18}/> تحليل الجلسة
                </button>
            </div>

            <button 
                onClick={handleSave} 
                disabled={saving || !lessonTopic.trim()} 
                className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 ${lessonTopic.trim() ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                title={!lessonTopic.trim() ? "يجب كتابة عنوان الدرس أولاً" : ""}
            >
                {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                {lessonTopic.trim() ? 'حفظ التقييم' : 'عنوان الدرس مطلوب'}
            </button>
        </div>

        {/* --- TOOLS SIDEBAR (Overlay) --- */}
        {showTools && (
            <div className="fixed right-4 top-32 bottom-4 w-72 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl p-5 z-40 animate-fade-in-up flex flex-col gap-6 overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-slate-800 text-lg">أدوات مساعدة</h3>
                    <button onClick={() => setShowTools(false)} className="bg-slate-100 p-1 rounded-full"><X size={20} className="text-slate-500"/></button>
                </div>
                
                {/* Timer */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 mb-3"><Timer size={20}/> <span className="text-sm font-bold">المؤقت</span></div>
                    <div className="text-4xl font-mono font-black text-slate-800 mb-4 bg-white py-2 rounded-xl shadow-inner">
                        {Math.floor(timerVal / 60).toString().padStart(2, '0')}:{ (timerVal % 60).toString().padStart(2, '0') }
                    </div>
                    <div className="flex gap-2 justify-center mb-3">
                        {[1, 5, 10].map(m => <button key={m} onClick={() => setTimerVal(m * 60)} className="bg-white border px-3 py-1.5 rounded-lg text-xs font-bold hover:border-indigo-300">{m}د</button>)}
                    </div>
                    <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`w-full py-3 rounded-xl text-sm font-bold text-white shadow-md transition-transform active:scale-95 ${isTimerRunning ? 'bg-red-500' : 'bg-emerald-500'}`}>{isTimerRunning ? 'إيقاف' : 'بدء'}</button>
                </div>

                {/* Random Picker */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 mb-3"><Shuffle size={20}/> <span className="text-sm font-bold">القرعة</span></div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 min-h-[60px] flex items-center justify-center font-bold text-indigo-700 text-lg mb-3 shadow-sm">
                        {randomWinner ? randomWinner.name : '???'}
                    </div>
                    <button onClick={() => {
                        let i = 0; const int = setInterval(() => { setRandomWinner(currentStudents[Math.floor(Math.random()*currentStudents.length)]); i++; if(i>15) clearInterval(int); }, 80);
                    }} className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-transform active:scale-95">اختيار طالب</button>
                </div>

                {/* Noise Meter */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-500 mb-3"><Volume2 size={20}/> <span className="text-sm font-bold">عداد الضجيج</span></div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden mb-3 border border-slate-300">
                        <div className={`h-full transition-all duration-100 ${noiseLevel > 150 ? 'bg-red-500' : noiseLevel > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width: `${(noiseLevel/255)*100}%`}}></div>
                    </div>
                    <button onClick={toggleNoiseMeter} className={`w-full py-3 rounded-xl text-sm font-bold border transition-colors ${isListeningNoise ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'}`}>{isListeningNoise ? 'إيقاف الاستماع' : 'تفعيل'}</button>
                </div>
            </div>
        )}

        {/* --- VOICE DISAMBIGUATION MODAL --- */}
        {ambiguousNames.length > 0 && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full animate-fade-in-up">
                    <h3 className="font-bold text-lg mb-4 text-center text-slate-800">أي طالب تقصد؟</h3>
                    <div className="grid gap-2">
                        {ambiguousNames.map(s => (
                            <button key={s.id} onClick={() => { setAmbiguousNames([]); alert(`تم اختيار ${s.name}`); }} className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-2xl font-bold text-right transition-colors text-slate-700 flex justify-between items-center group">
                                {s.name} <ArrowRight size={16} className="text-indigo-300 group-hover:text-indigo-600"/>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setAmbiguousNames([])} className="mt-6 w-full py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-colors">إلغاء</button>
                </div>
            </div>
        )}

        {/* --- MAIN CONTENT AREA --- */}
        <div className="min-h-[400px]">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40}/><p className="font-bold text-lg">جاري تحضير الفصل...</p>
                </div>
            ) : !selectedGrade || !selectedClass ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <BookOpen className="mb-4 opacity-50" size={64}/>
                    <p className="font-bold text-lg">يرجى اختيار الصف والفصل للبدء</p>
                </div>
            ) : (
                <>
                    {/* LIST VIEW */}
                    {viewMode === 'list' && (
                        <div className="grid gap-3">
                            {currentStudents.map(s => {
                                const data = performanceData[s.id] || { participation: 0, homework: false, note: '', badges: [] };
                                const isExpanded = activeNoteId === s.id;
                                const isAbsent = attendanceMap[s.studentId] === AttendanceStatus.ABSENT;

                                return (
                                    <div key={s.id} className={`bg-white rounded-2xl border p-4 transition-all ${isAbsent ? 'opacity-50 grayscale border-slate-100' : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shadow-sm">{s.name.charAt(0)}</div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-base">{s.name}</h3>
                                                    {data.badges.length > 0 && <div className="flex gap-1 mt-1 text-lg">{data.badges.map(b => <span key={b} title={BADGES.find(x=>x.id===b)?.label}>{BADGES.find(x=>x.id===b)?.icon}</span>)}</div>}
                                                </div>
                                            </div>
                                            
                                            <div className={`flex items-center gap-3 ${isAbsent ? 'pointer-events-none' : ''}`}>
                                                <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-200">
                                                    {[1,2,3,4,5].map(star => (
                                                        <button key={star} onClick={() => updateStudentData(s.id, 'participation', star)} className={`p-1.5 transition-transform hover:scale-110 ${data.participation >= star ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'}`}><Star size={20} fill="currentColor"/></button>
                                                    ))}
                                                </div>
                                                <button onClick={() => updateStudentData(s.id, 'homework', !data.homework)} className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${data.homework ? 'bg-emerald-100 text-emerald-600 border-emerald-200 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-200 hover:border-emerald-200'}`}><CheckSquare size={20}/></button>
                                                <button onClick={() => setActiveNoteId(isExpanded ? null : s.id)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><MoreHorizontal size={20}/></button>
                                            </div>
                                        </div>

                                        {isExpanded && !isAbsent && (
                                            <div className="mt-4 pt-4 border-t border-slate-50 animate-fade-in">
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {BADGES.map(b => (
                                                        <button key={b.id} onClick={() => toggleBadge(s.id, b.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${data.badges.includes(b.id) ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                            <span className="text-base">{b.icon}</span> {b.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                {/* Smart Tags Section */}
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {smartTags.map((tag, i) => (
                                                        <button key={`smart-${i}`} onClick={() => updateStudentData(s.id, 'note', (data.note ? data.note + ' - ' : '') + tag)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-transform hover:scale-105 bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                                                            <Sparkles size={10}/> {tag}
                                                        </button>
                                                    ))}
                                                    {QUICK_TAGS.map((t, i) => (
                                                        <button key={i} onClick={() => updateStudentData(s.id, 'note', (data.note ? data.note + ' - ' : '') + t.label)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-transform hover:scale-105 ${t.color}`}>{t.label}</button>
                                                    ))}
                                                </div>
                                                
                                                <input value={data.note} onChange={e => updateStudentData(s.id, 'note', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-300 outline-none" placeholder="ملاحظة يدوية..."/>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SEATING CHART VIEW */}
                    {viewMode === 'seats' && (
                        <div className="bg-slate-100 p-8 rounded-[2.5rem] border-4 border-slate-200 min-h-[600px] relative shadow-inner">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-4 bg-slate-300 rounded-b-xl shadow-md flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">منطقة السبورة</div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
                                {currentStudents.map(s => {
                                    const data = performanceData[s.id] || { participation: 0 };
                                    const isAbsent = attendanceMap[s.studentId] === AttendanceStatus.ABSENT;
                                    return (
                                        <div key={s.id} className={`bg-white p-4 rounded-2xl shadow-sm border-2 transition-all text-center group cursor-pointer relative ${isAbsent ? 'opacity-40 border-dashed border-slate-300' : 'border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'}`}>
                                            <div className="absolute top-2 right-2 text-slate-300 font-mono text-[10px] font-bold">A{s.id.substr(0,1)}</div>
                                            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold mx-auto mb-3 border-2 border-white shadow-md text-lg">{s.name.charAt(0)}</div>
                                            <p className="font-bold text-slate-800 text-sm truncate">{s.name}</p>
                                            
                                            {!isAbsent && (
                                                <div className="flex justify-center mt-3 gap-1.5">
                                                    {[1,2,3,4,5].map(st => <div key={st} className={`w-2 h-2 rounded-full transition-colors ${data.participation >= st ? 'bg-yellow-400' : 'bg-slate-200'}`}></div>)}
                                                </div>
                                            )}
                                            
                                            {!isAbsent && <button onClick={() => updateStudentData(s.id, 'participation', Math.min(5, (data.participation || 0) + 1))} className="absolute inset-0 w-full h-full opacity-0 z-10"></button>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* GROUP MODE */}
                    {viewMode === 'groups' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {groups.map(g => (
                                <div key={g.id} className="bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-gradient-to-r from-slate-50 to-white p-5 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Users size={18} className="text-indigo-500"/> {g.name}</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleGroupEval(g.id, 'participation', 5)} className="bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-100 hover:bg-yellow-100 transition-colors shadow-sm">★ الكل</button>
                                            <button onClick={() => handleGroupEval(g.id, 'homework', true)} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm">✓ واجب</button>
                                        </div>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 gap-3">
                                        {g.members.map(mId => {
                                            const st = currentStudents.find(s => s.id === mId);
                                            if(!st) return null;
                                            const data = performanceData[st.id];
                                            const isAbsent = attendanceMap[st.studentId] === AttendanceStatus.ABSENT;
                                            
                                            if (isAbsent) return null; // Hide absent from groups

                                            return (
                                                <div key={mId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer" onClick={() => updateStudentData(st.id, 'participation', Math.min(5, (data.participation || 0) + 1))}>
                                                    <div className="w-8 h-8 rounded-lg bg-white text-xs flex items-center justify-center font-bold border border-slate-200 text-slate-600 shadow-sm">{st.name.charAt(0)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-slate-700 truncate block">{st.name}</span>
                                                        <div className="flex gap-0.5 mt-1">
                                                            {[1,2,3,4,5].map(star => <div key={star} className={`w-1.5 h-1.5 rounded-full ${data.participation >= star ? 'bg-yellow-400' : 'bg-slate-200'}`}></div>)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
  );
};

export default DailyFollowup;
