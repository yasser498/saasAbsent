
import React, { useEffect, useState, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Home, FileText, Search, ShieldCheck, LogOut, Menu, X, Users, ClipboardCheck, BarChart2, MessageSquare, BookUser, LayoutGrid, Briefcase, ChevronLeft, ChevronRight, Settings, Sparkles, UserCircle, ScanLine, LogOut as ExitIcon, Download, Share, BellRing, Loader2, School as SchoolIcon, BookOpen, TrendingUp, Presentation } from 'lucide-react';
import { StaffUser, AppNotification, School } from '../types';
import { getPendingRequestsCountForStaff, getNotifications, getParentChildren, getActiveSchool, logoutSchool, getActiveSchoolId } from '../services/storage';
import ChatBot from './ChatBot';
import InstallPrompt from './InstallPrompt';
import { supabase } from '../supabaseClient';

const { Link, useLocation, useNavigate } = ReactRouterDOM as any;

interface LayoutProps {
  children: React.ReactNode;
  role?: 'admin' | 'staff' | 'public';
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, role = 'public', onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [staffPermissions, setStaffPermissions] = useState<string[]>([]);
  
  // School Context State
  const [activeSchool, setActiveSchool] = useState<School | null>(null);

  // Install Logic State
  const [isInstalled, setIsInstalled] = useState(false);

  // Notification Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isActive = (path: string) => location.pathname === path;

  // Load School Context
  useEffect(() => {
      const school = getActiveSchool();
      setActiveSchool(school);
      
      const isPublicRoute = location.pathname === '/' || location.pathname.startsWith('/s/');
      if (!isPublicRoute && !school) {
          navigate('/');
      }
  }, [location.pathname]);

  const SCHOOL_LOGO = activeSchool?.logoUrl || null;
  const SCHOOL_NAME = activeSchool?.name || "نظام عذر المدرسي";

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  // --- GLOBAL REALTIME NOTIFICATIONS (System Level) ---
  useEffect(() => {
    const parentId = localStorage.getItem('ozr_parent_id');
    const staffSession = localStorage.getItem('ozr_staff_session');
    let userId = '';
    let childrenIds: string[] = [];
    const schoolId = getActiveSchoolId();

    if (!schoolId) return;

    const setupListener = async () => {
        if (parentId) {
            userId = parentId;
            const children = await getParentChildren(parentId);
            childrenIds = children.map(c => c.studentId);
        } else if (staffSession) {
            const user = JSON.parse(staffSession);
            userId = user.id;
        } else {
            return; 
        }

        const watchedIds = [userId, ...childrenIds, 'ALL'];

        const channel = supabase.channel(`school_${schoolId}_notifications`)
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications',
                    filter: `school_id=eq.${schoolId}` 
                },
                async (payload: any) => {
                    const newNotif = payload.new as AppNotification;
                    
                    if (newNotif.schoolId === schoolId && watchedIds.includes(newNotif.targetUserId)) {
                        if (audioRef.current) {
                            audioRef.current.play().catch(() => {});
                        }

                        if (Notification.permission === 'granted') {
                            new Notification(newNotif.title, {
                                body: newNotif.message,
                                icon: SCHOOL_LOGO || undefined,
                            });
                        }
                        
                        if (role === 'staff') {
                            setNotificationCount(prev => prev + 1);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    };

    setupListener();
  }, [role, activeSchool]);

  // Fetch Pending Count & Notifications for Staff
  useEffect(() => {
    if (role === 'staff') {
      const fetchStaffData = async () => {
        const session = localStorage.getItem('ozr_staff_session');
        if (session) {
          const user: StaffUser = JSON.parse(session);
          setStaffPermissions(user.permissions || ['attendance', 'requests', 'reports']);

          if (!user.permissions || user.permissions.includes('requests')) {
              const count = await getPendingRequestsCountForStaff(user.assignments || []);
              setPendingCount(count);
          }

          const notifs = await getNotifications(user.id);
          const unread = notifs.filter((n: any) => !n.isRead).length;
          setNotificationCount(unread);
        }
      };
      fetchStaffData();
      const interval = setInterval(fetchStaffData, 60000);
      return () => clearInterval(interval);
    }
  }, [role]);

  const hasPermission = (key: string) => staffPermissions.includes(key);
  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);
  const showChatBot = ['/inquiry', '/staff/home', '/admin/dashboard'].includes(location.pathname);

  if (location.pathname === '/' || location.pathname.startsWith('/s/')) {
      return <>{children}</>;
  }

  const NavItem = ({ to, icon: Icon, label, badge, activeColor = 'blue' }: { to: string, icon: any, label: string, badge?: number, activeColor?: string }) => (
    <Link 
      to={to} 
      className={`
        flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 font-bold relative group mb-1
        ${isActive(to) 
          ? `bg-slate-900 text-white shadow-lg shadow-slate-900/20` 
          : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'}
        ${isSidebarCollapsed ? 'justify-center px-2' : ''}
      `}
      title={isSidebarCollapsed ? label : ''}
    >
      <Icon size={20} className={`shrink-0 transition-colors ${isActive(to) ? `text-white` : 'text-slate-400 group-hover:text-slate-600'}`} />
      
      {!isSidebarCollapsed && (
        <span className="truncate text-sm">{label}</span>
      )}

      {badge !== undefined && badge > 0 && (
        <span className={`
          absolute bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm border border-white
          ${isSidebarCollapsed 
            ? 'top-2 right-2 w-3 h-3' 
            : 'left-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 min-w-[18px]'}
        `}>
          {badge}
        </span>
      )}
    </Link>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    !isSidebarCollapsed ? (
      <div className="px-4 py-2 mt-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2 opacity-70">
        {label}
      </div>
    ) : <div className="my-2 border-t border-slate-200/50 mx-4"></div>
  );

  const handleGlobalLogout = () => {
      if (onLogout) onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row h-screen overflow-hidden font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-200/50 p-4 flex justify-between items-center sticky top-0 z-50 shadow-sm shrink-0 h-16">
        <div className="flex items-center gap-3 font-bold text-slate-800 text-sm">
          {SCHOOL_LOGO ? (
              <img src={SCHOOL_LOGO} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
              <SchoolIcon size={24} className="text-blue-600"/>
          )}
          <span className="text-blue-900 truncate max-w-[200px]">{SCHOOL_NAME}</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
          className="text-slate-600 p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:relative top-0 h-full bg-slate-100/50 backdrop-blur-xl border-l border-white/50 z-40
        transition-all duration-300 ease-in-out flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0 w-72 bg-white shadow-2xl' : 'translate-x-full md:translate-x-0'}
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
        right-0 md:shadow-none
      `}>
        {/* Mobile Close Button */}
        <div className="md:hidden p-4 flex justify-end">
           <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 p-2 bg-slate-50 rounded-full">
             <X size={20} />
           </button>
        </div>

        {/* Desktop Toggle Button */}
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex absolute -left-3 top-10 bg-white border border-slate-200 rounded-full p-1.5 text-slate-400 hover:text-blue-900 hover:border-blue-300 shadow-sm z-50 transition-all hover:scale-110"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Header Section */}
        <div className={`p-6 hidden md:flex flex-col items-center text-center gap-3 shrink-0 transition-all ${isSidebarCollapsed ? 'py-6 px-2' : ''}`}>
          <div className="relative group cursor-pointer" onClick={() => navigate(activeSchool ? `/s/${activeSchool.schoolCode}` : '/')}>
             {SCHOOL_LOGO ? (
                 <img src={SCHOOL_LOGO} alt="School Logo" className={`relative object-contain drop-shadow-sm transition-all duration-500 ${isSidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20 group-hover:scale-105'}`} />
             ) : (
                 <div className={`relative bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm ${isSidebarCollapsed ? 'w-10 h-10' : 'w-20 h-20'}`}>
                     <SchoolIcon size={isSidebarCollapsed ? 20 : 32}/>
                 </div>
             )}
          </div>
          {!isSidebarCollapsed && (
            <div className="animate-fade-in">
              <h1 className="font-extrabold text-slate-800 text-sm leading-tight px-2">{SCHOOL_NAME}</h1>
              <p className="text-[10px] text-slate-400 font-mono mt-1">{activeSchool?.schoolCode}</p>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-200 space-y-1">
          
          {role === 'public' && (
            <>
              <SectionLabel label="الخدمات العامة" />
              <NavItem to="/inquiry" icon={UserCircle} label="بوابة ولي الأمر" activeColor="purple" />
              <NavItem to="/submit" icon={FileText} label="تقديم عذر غياب" activeColor="emerald" />
              <SectionLabel label="تسجيل الدخول" />
              <NavItem to="/staff/login" icon={Users} label="المعلمون والموظفون" />
              <NavItem to="/admin/login" icon={ShieldCheck} label="الإدارة المدرسية" />
            </>
          )}

          {role === 'admin' && (
            <>
              <NavItem to="/admin/dashboard" icon={LayoutGrid} label="مركز القيادة" activeColor="indigo" />
              <SectionLabel label="إدارة العمليات" />
              <NavItem to="/admin/requests" icon={FileText} label="طلبات الأعذار" activeColor="amber" />
              <NavItem to="/admin/attendance-reports" icon={BarChart2} label="سجل الغياب" activeColor="emerald" />
              <SectionLabel label="التكوين" />
              <NavItem to="/admin/attendance-stats" icon={Sparkles} label="التحليل الذكي" activeColor="purple" />
              <NavItem to="/admin/students" icon={Search} label="الطلاب" />
              <NavItem to="/admin/users" icon={Users} label="المستخدمين" />
              
              <div className="my-4 border-t border-slate-200/50 mx-2"></div>
              
              <button 
                onClick={handleGlobalLogout}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <LogOut size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm">خروج</span>}
              </button>
            </>
          )}

          {role === 'staff' && (
            <>
               <NavItem to="/staff/home" icon={Home} label="الرئيسية" activeColor="blue" badge={notificationCount} />

               {/* Teacher Specific Academic Tools */}
               {hasPermission('daily_followup') && (
                 <>
                   <SectionLabel label="الأدوات الأكاديمية" />
                   <NavItem to="/staff/classes" icon={Settings} label="إدارة الفصول" activeColor="slate" />
                   <NavItem to="/staff/daily-followup" icon={BookOpen} label="المتابعة اليومية" activeColor="indigo" />
                   <NavItem to="/staff/classroom" icon={Presentation} label="الفصل الذكي" activeColor="violet" />
                   <NavItem to="/staff/teacher-analysis" icon={TrendingUp} label="تحليل الأداء" activeColor="teal" />
                 </>
               )}

               <SectionLabel label="المهام اليومية" />
               {hasPermission('attendance') && <NavItem to="/staff/attendance" icon={ClipboardCheck} label="رصد الغياب" activeColor="emerald" />}
               {hasPermission('observations') && <NavItem to="/staff/observations" icon={FileText} label="الملاحظات" activeColor="pink" />}
               {hasPermission('requests') && <NavItem to="/staff/requests" icon={MessageSquare} label="الأعذار" badge={pendingCount} activeColor="amber" />}

               {(hasPermission('gate_security') || hasPermission('exit_perms')) && <SectionLabel label="الأمن والسلامة" />}
               {hasPermission('gate_security') && <NavItem to="/staff/gate" icon={ScanLine} label="ماسح البوابة" activeColor="teal" />}
               {hasPermission('exit_perms') && <NavItem to="/staff/exit-permissions" icon={ExitIcon} label="الاستئذان" activeColor="orange" />}

               {(hasPermission('students') || hasPermission('deputy')) && <SectionLabel label="الإدارة" />}
               {hasPermission('students') && <NavItem to="/staff/students" icon={BookUser} label="الموجه الطلابي" activeColor="purple" />}
               {hasPermission('deputy') && <NavItem to="/staff/deputy" icon={Briefcase} label="وكيل الشؤون" activeColor="red" />}

               <SectionLabel label="أخرى" />
               {hasPermission('contact_directory') && !hasPermission('students') && <NavItem to="/staff/directory" icon={BookUser} label="الدليل" />}
               {hasPermission('reports') && <NavItem to="/staff/reports" icon={BarChart2} label="التقارير" />}

              <div className="my-4 border-t border-slate-200/50 mx-2"></div>
              
              <button 
                onClick={handleGlobalLogout}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors duration-200 font-bold shrink-0 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <LogOut size={20} className="shrink-0" />
                {!isSidebarCollapsed && <span className="text-sm">خروج</span>}
              </button>
            </>
          )}
        </nav>

        {/* Footer Info */}
        {!isSidebarCollapsed && (
          <div className="p-4 text-center text-[10px] text-slate-400 border-t border-slate-200/50 hidden md:block">
            <p className="font-bold opacity-50">نظام الإدارة المدرسية الذكية</p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto h-full relative w-full custom-scrollbar">
        <div className="max-w-7xl mx-auto pb-20 md:pb-10">
          {children}
        </div>
      </main>

      {showChatBot && <ChatBot />}
      <InstallPrompt />

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
