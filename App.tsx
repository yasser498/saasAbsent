
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import SchoolLanding from './pages/SchoolLanding';
import Submission from './pages/Submission';
import Inquiry from './pages/Inquiry';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Requests from './pages/admin/Requests';
import Students from './pages/admin/Students';
import Users from './pages/admin/Users';
import AttendanceReports from './pages/admin/AttendanceReports';
import AttendanceStats from './pages/admin/AttendanceStats';
import StaffLogin from './pages/staff/Login';
import StaffHome from './pages/staff/Home';
import Attendance from './pages/staff/Attendance';
import StaffReports from './pages/staff/Reports';
import StaffRequests from './pages/staff/Requests';
import StaffStudents from './pages/staff/Students';
import StaffDeputy from './pages/staff/Deputy';
import StaffObservations from './pages/staff/Observations';
import GateScanner from './pages/staff/GateScanner'; 
import ExitPermissions from './pages/staff/ExitPermissions'; 
import ClassManagement from './pages/staff/ClassManagement';
import DailyFollowup from './pages/staff/DailyFollowup';
import ClassRoom from './pages/staff/ClassRoom';
import TeacherAnalysis from './pages/staff/TeacherAnalysis';
import { StaffUser } from './types';
import { getActiveSchool, logoutUserSession } from './services/storage';

const { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } = ReactRouterDOM as any;

// Protected Route for Admin
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const session = localStorage.getItem('ozr_admin_session');
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
};

// Protected Route for Staff with Permission Check
const ProtectedStaffRoute = ({ 
    children, 
    requiredPermission 
}: { 
    children?: React.ReactNode, 
    requiredPermission?: string 
}) => {
  const session = localStorage.getItem('ozr_staff_session');
  
  if (!session) {
    return <Navigate to="/staff/login" replace />;
  }

  // Allow access if requiredPermission is not set OR user has it OR user is admin_staff/teacher implied
  if (requiredPermission) {
    const user: StaffUser = JSON.parse(session);
    const perms = user.permissions || [];
    
    // Some basic routes are always allowed for staff
    if (!perms.includes(requiredPermission)) {
        // Fallback check for new roles
        if (user.role === 'teacher' && ['attendance', 'daily_followup'].includes(requiredPermission)) {
            return <>{children}</>;
        }
        return <Navigate to="/staff/home" replace />;
    }
  }

  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine Role Logic
  const isAdminRoute = location.pathname.startsWith('/admin') && location.pathname !== '/admin/login';
  const isStaffRoute = location.pathname.startsWith('/staff') && location.pathname !== '/staff/login';
  
  let role: 'admin' | 'staff' | 'public' = 'public';
  if (isAdminRoute) role = 'admin';
  if (isStaffRoute) role = 'staff';

  const handleLogout = () => {
    // Determine target based on current school context
    const activeSchool = getActiveSchool();
    const redirectPath = activeSchool ? `/s/${activeSchool.schoolCode}` : '/';

    logoutUserSession(); // Clears sessions but keeps school
    
    // Redirect
    navigate(redirectPath);
  };

  return (
    <Layout role={role} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:schoolCode" element={<SchoolLanding />} />
        <Route path="/submit" element={<Submission />} />
        <Route path="/inquiry" element={<Inquiry />} />
        
        {/* Login Pages */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/staff/login" element={<StaffLogin />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/attendance-stats" element={<ProtectedRoute><AttendanceStats /></ProtectedRoute>} />
        <Route path="/admin/attendance-reports" element={<ProtectedRoute><AttendanceReports /></ProtectedRoute>} />
        <Route path="/admin/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/admin/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        
        {/* Staff Routes */}
        <Route path="/staff/home" element={<ProtectedStaffRoute><StaffHome /></ProtectedStaffRoute>} />
        <Route path="/staff/attendance" element={<ProtectedStaffRoute requiredPermission="attendance"><Attendance /></ProtectedStaffRoute>} />
        <Route path="/staff/reports" element={<ProtectedStaffRoute requiredPermission="reports"><StaffReports /></ProtectedStaffRoute>} />
        <Route path="/staff/requests" element={<ProtectedStaffRoute requiredPermission="requests"><StaffRequests /></ProtectedStaffRoute>} />
        <Route path="/staff/students" element={<ProtectedStaffRoute requiredPermission="students"><StaffStudents /></ProtectedStaffRoute>} />
        <Route path="/staff/directory" element={<ProtectedStaffRoute requiredPermission="contact_directory"><StaffStudents /></ProtectedStaffRoute>} />
        <Route path="/staff/deputy" element={<ProtectedStaffRoute requiredPermission="deputy"><StaffDeputy /></ProtectedStaffRoute>} />
        <Route path="/staff/observations" element={<ProtectedStaffRoute requiredPermission="observations"><StaffObservations /></ProtectedStaffRoute>} />
        
        {/* NEW TEACHER ROUTES */}
        <Route path="/staff/classes" element={<ProtectedStaffRoute><ClassManagement /></ProtectedStaffRoute>} />
        <Route path="/staff/daily-followup" element={<ProtectedStaffRoute requiredPermission="daily_followup"><DailyFollowup /></ProtectedStaffRoute>} />
        <Route path="/staff/classroom" element={<ProtectedStaffRoute requiredPermission="daily_followup"><ClassRoom /></ProtectedStaffRoute>} />
        <Route path="/staff/teacher-analysis" element={<ProtectedStaffRoute requiredPermission="daily_followup"><TeacherAnalysis /></ProtectedStaffRoute>} />

        <Route path="/staff/gate" element={<ProtectedStaffRoute requiredPermission="gate_security"><GateScanner /></ProtectedStaffRoute>} />
        <Route path="/staff/exit-permissions" element={<ProtectedStaffRoute requiredPermission="exit_perms"><ExitPermissions /></ProtectedStaffRoute>} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;
