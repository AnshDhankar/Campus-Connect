import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Sun, Moon, LogOut, User, LayoutPanelLeft, ShieldAlert,
  HelpCircle, Building2, BellRing, Settings, RefreshCw, Database, 
  ShieldCheck, AlertTriangle, Menu, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import LandingPage from './components/LandingPage';
import DatabaseStatus from './components/DatabaseStatus';
import AuthModal from './components/AuthModal';
import AppSidebar from './components/AppSidebar';
import { Department } from './types';

// Lazy-loaded code-split dashboard modules for initial bundle optimization
const StudentDashboard = lazy(() => import('./components/StudentDashboard'));
const StaffDashboard = lazy(() => import('./components/StaffDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const ChangePassword = lazy(() => import('./components/ChangePassword'));
const UserProfileModal = lazy(() => import('./components/UserProfileModal'));

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Session global states
  const [token, setToken] = useState<string>(localStorage.getItem('token') || sessionStorage.getItem('token') || '');
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null'));
  const [departments, setDepartments] = useState<Department[]>([]);
  const [viewingDbStatus, setViewingDbStatus] = useState<boolean>(false);
  const [dbStatus, setDbStatus] = useState<{ isMongoConnected: boolean; isReconnecting: boolean; status: string; mode: string } | null>(null);
  
  // Pending auth state for "Keep me signed in" popup
  const [pendingAuth, setPendingAuth] = useState<{ user: any, token: string } | null>(null);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false); // University Light Portal by default

  // Auth Dialog state
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [selectedRole, setSelectedRole] = useState<'student' | 'department' | 'admin'>('student');

  // Universal Sidebar & Profile States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>(() => {
    const role = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null')?.role;
    if (role === 'superadmin') return 'analytics';
    if (role === 'staff') return 'complaints';
    return 'overview';
  });
  const [studentTicketsCount, setStudentTicketsCount] = useState<number>(0);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Sync activeNav with role
  useEffect(() => {
    if (user?.role === 'superadmin') {
      setActiveNav((prev) => (['analytics', 'departments', 'staff', 'students', 'tickets', 'settings', 'profile', 'announcements'].includes(prev) ? prev : 'analytics'));
    } else if (user?.role === 'staff') {
      setActiveNav((prev) => (['complaints', 'help', 'announcements', 'department-info', 'export-report'].includes(prev) ? prev : 'complaints'));
    } else if (user?.role === 'student') {
      setActiveNav((prev) => (['overview', 'file-grievance', 'my-tickets', 'notices', 'directory'].includes(prev) ? prev : 'overview'));
    }
  }, [user?.role]);

  // Synchronize router paths to auth modal open states
  useEffect(() => {
    const path = location.pathname;
    if (token) {
      setIsAuthOpen(false);
      if (path === '/student-login' || path === '/department-login' || path === '/admin-login') {
        navigate('/');
      }
      if (path === '/database-status') {
        if (!user || user.role !== 'superadmin') {
          setViewingDbStatus(false);
          navigate('/');
        } else {
          setViewingDbStatus(true);
        }
      }
      return;
    }
    if (path === '/student-login') {
      setSelectedRole('student');
      setIsAuthOpen(true);
      setViewingDbStatus(false);
    } else if (path === '/department-login') {
      setSelectedRole('department');
      setIsAuthOpen(true);
      setViewingDbStatus(false);
    } else if (path === '/admin-login') {
      setSelectedRole('admin');
      setIsAuthOpen(true);
      setViewingDbStatus(false);
    } else if (path === '/database-status') {
      setViewingDbStatus(false);
      navigate('/');
    } else if (path === '/reset-password') {
      setIsAuthOpen(false);
      setViewingDbStatus(false);
    } else if (path === '/change-password') {
      setIsAuthOpen(false);
      setViewingDbStatus(false);
      if (!token) {
        navigate('/');
      }
    } else if (path === '/') {
      setIsAuthOpen(false);
      setViewingDbStatus(false);
    }
  }, [location.pathname, token, user, navigate]);

  // Fetch departments list and check for database reset state
  useEffect(() => {
    const checkResetState = async () => {
      try {
        const res = await fetch('/api/institutions');
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length === 0) {
            console.log('[RESET DETECTION] No institutions exist. Clearing all cached sessions and tokens.');
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            document.cookie = 'token=; max-age=0; path=/; SameSite=Strict; Secure';
            setUser(null);
            setToken('');
          }
        }
      } catch (err) {
        console.warn('[RESET DETECTION] Database check deferred:', (err as any)?.message || err);
      }
    };
    checkResetState();
  }, []);

  // Re-fetch departments whenever the authenticated user or their institution changes
  useEffect(() => {
    fetchDepartments();
  }, [user]);

  const fetchDepartments = async () => {
    try {
      const activeInstId = (user && user.institutionId) || 'default';
      const res = await fetch(`/api/departments?institutionId=${activeInstId}`);
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch {
      console.warn('Could not sync departments list from server. Using fallback profiles.');
    }
  };

  // Periodic check of database connection status
  useEffect(() => {
    const checkDbHealth = async () => {
      try {
        const res = await fetch('/api/system/database-status');
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setDbStatus(data);
        }
      } catch {
        // network error, ignore
      }
    };
    checkDbHealth();
    const timer = setInterval(checkDbHealth, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleAuthSuccess = (userData: any, userToken: string) => {
    // Show "Keep me signed in" prompt upon successful authentication
    setPendingAuth({ user: userData, token: userToken });
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    document.cookie = 'token=; max-age=0; path=/; SameSite=Strict; Secure';
    setIsAuthOpen(false);
    setSessionError('');
  };

  const handleUpdateUser = (updatedUser: any, updatedToken?: string) => {
    setUser(updatedUser);
    if (localStorage.getItem('user')) {
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (updatedToken) {
        localStorage.setItem('token', updatedToken);
        setToken(updatedToken);
      }
    }
    if (sessionStorage.getItem('user')) {
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      if (updatedToken) {
        sessionStorage.setItem('token', updatedToken);
        setToken(updatedToken);
      }
    }
    if (updatedToken) {
      document.cookie = `token=${updatedToken}; path=/; SameSite=Strict; Secure`;
    }
  };

  const setUserRoleGreeting = (profile: any) => {
    // Just a helpful notification logger
    console.log(`[CampusConnect Auth] Welcoming user ${profile.name} with role: ${profile.role}`);
  };

  // Toggle Dark Mode
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-charcoal-950 text-slate-100' 
        : 'bg-paper-100 text-navy-950'
    }`}>
      
      {/* Database Connection Recovery Banner */}
      {dbStatus && dbStatus.mode?.includes('MongoDB Atlas') && (!dbStatus.isMongoConnected || dbStatus.isReconnecting) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 border-b border-amber-600 shadow-xs z-50 sticky top-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-slate-950 animate-bounce" />
          <span>Database connection recovering: CampusConnect is reconnecting to MongoDB Atlas. Live database operations will resume automatically once connected.</span>
        </div>
      )}

      {/* Universal Collapsible Left Sidebar (rendered when user is logged in) */}
      {token && user && (
        <AppSidebar
          user={user}
          departments={departments}
          isDarkMode={isDarkMode}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onNavigateChangePassword={() => navigate('/change-password')}
          onLogout={handleLogout}
          dbStatus={dbStatus}
          onOpenDbStatus={() => {
            setViewingDbStatus(true);
            navigate('/database-status');
          }}
          studentTicketCount={studentTicketsCount}
          unreadNotifsCount={unreadNotifsCount}
        />
      )}

      {/* Universal Personal Profile & Account Modal */}
      {token && user && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
            user={user}
            departments={departments}
            isDarkMode={isDarkMode}
            onLogout={handleLogout}
            onUpdateUser={handleUpdateUser}
            onNavigateChangePassword={() => {
              setIsProfileModalOpen(false);
              navigate('/change-password');
            }}
          />
        </Suspense>
      )}

      {/* Main Content Viewport with dynamic left padding adapting to sidebar state */}
      <div className={`transition-all duration-200 ease-in-out ${
        token && user 
          ? (isSidebarCollapsed ? 'lg:pl-18' : 'lg:pl-64') 
          : ''
      }`}>

        {/* Universal Sticky Header (rendered only when user is logged in) */}
        {token && user && (
          <nav className={`sticky top-0 left-0 right-0 z-30 border-b shadow-xs transition-colors backdrop-blur-md ${
            isDarkMode 
              ? 'bg-charcoal-900/95 border-charcoal-800 text-white' 
              : 'bg-navy-950/95 border-navy-800 text-white'
          }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              
              {/* Left Controls & Context Zone */}
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Mobile Drawer Hamburger Button */}
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className={`lg:hidden p-2 rounded-lg border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'border-charcoal-700 text-slate-200 hover:bg-charcoal-800 bg-charcoal-950/40' 
                      : 'border-navy-800 text-slate-200 hover:bg-navy-900 bg-navy-900/40'
                  }`}
                  aria-label="Open navigation drawer"
                  title="Open Navigation"
                >
                  <Menu className="w-5 h-5 text-gold-400" />
                </button>

                {/* Desktop Sidebar Collapse Toggle */}
                <button
                  type="button"
                  onClick={toggleSidebarCollapse}
                  className={`hidden lg:flex p-2 rounded-lg border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'border-charcoal-700 text-slate-200 hover:bg-charcoal-800 bg-charcoal-950/40' 
                      : 'border-navy-800 text-slate-200 hover:bg-navy-900 bg-navy-900/40'
                  }`}
                  title={isSidebarCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
                  aria-label="Toggle sidebar collapse"
                >
                  {isSidebarCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4 text-gold-400" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4 text-slate-300" />
                  )}
                </button>

                {/* Logo & Context zone */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gold-500 text-navy-950 font-bold text-sm flex items-center justify-center shadow-xs shrink-0 font-mono">
                    CC
                  </div>
                  <span className={`font-bold text-base tracking-tight shrink-0 hidden sm:inline ${
                    isDarkMode ? 'text-white' : 'text-gold-100'
                  }`}>
                    CampusConnect
                  </span>
                  
                  {/* Context Tag indicator */}
                  <span className={`py-0.5 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider rounded-md border truncate ${
                    user.role === 'superadmin' 
                      ? 'bg-rose-950/40 text-rose-300 border-rose-850'
                      : user.role === 'staff' 
                        ? 'bg-sky-950/40 text-sky-300 border-sky-850' 
                        : 'bg-gold-950/40 text-gold-300 border-gold-850'
                  }`}>
                    {user.role} workspace
                  </span>
                </div>
              </div>

              {/* Controls panel */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">

                {/* Database Status Link */}
                {user.role === 'superadmin' && (
                  <button
                    onClick={() => {
                      setViewingDbStatus(true);
                      navigate('/database-status');
                    }}
                    className={`py-1.5 px-2.5 sm:px-3 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-gold-400 ${
                      isDarkMode 
                        ? 'border-charcoal-700 text-slate-200 hover:bg-charcoal-800 bg-charcoal-950/40' 
                        : 'border-navy-800 text-slate-200 hover:bg-navy-900 bg-navy-900/40'
                    }`}
                    title="Verify Database Connectivity"
                  >
                    <Database className="w-3.5 h-3.5 text-gold-400" />
                    <span className="hidden md:inline">Database Status</span>
                  </button>
                )}
                
                {/* Theme toggle switch */}
                <button
                  onClick={toggleTheme}
                  id="theme-toggle-btn"
                  className={`p-2 rounded-lg border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'border-charcoal-700 text-slate-200 hover:bg-charcoal-800 bg-charcoal-950/40' 
                      : 'border-navy-800 text-slate-200 hover:bg-navy-900 bg-navy-900/40'
                  }`}
                  title="Toggle Contrast Theme"
                  aria-label="Toggle Color Theme"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-gold-400" />}
                </button>

                {/* Clickable Personal Profile button */}
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className={`hidden sm:flex items-center gap-2 py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer text-xs focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'border-charcoal-700 hover:bg-charcoal-800 bg-charcoal-950/40 text-slate-200' 
                      : 'border-navy-800 hover:bg-navy-900 bg-navy-900/40 text-slate-200'
                  }`}
                  title="Open Personal Profile & Settings"
                >
                  <User className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                  <span className="text-slate-400 hidden lg:inline">User:</span>
                  <strong className={`font-semibold max-w-[120px] truncate ${isDarkMode ? 'text-white' : 'text-gold-200'}`}>
                    {user.name}
                  </strong>
                </button>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  id="logout-btn"
                  className="py-1.5 px-3 sm:px-4 text-xs font-semibold uppercase tracking-wider text-navy-950 bg-gold-400 hover:bg-gold-300 active:bg-gold-500 rounded-lg transition-colors duration-150 cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-gold-400 whitespace-nowrap"
                >
                  Sign Out
                </button>
              </div>

            </div>
          </nav>
        )}

        {/* Floating Theme Button for the Landing Page only */}
        {!token && (
          <button
            onClick={toggleTheme}
            id="theme-toggle-floating"
            className={`fixed bottom-6 right-6 z-50 p-3 h-12 w-12 flex items-center justify-center rounded-full shadow-2xl transition-all cursor-crosshair border focus:outline-none ${
              isDarkMode ? 'bg-charcoal-900 border-charcoal-850 text-white' : 'bg-white border-paper-300 text-navy-950'
            }`}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-gold-600" />}
          </button>
        )}

        {/* Main Core Router */}
        <main>
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading workspace...</p>
            </div>
          }>
            {location.pathname === '/reset-password' ? (
            <ResetPassword isDarkMode={isDarkMode} />
          ) : location.pathname === '/change-password' ? (
            token && user ? (
              <ChangePassword
                user={user}
                token={token}
                isDarkMode={isDarkMode}
                onBack={() => navigate('/')}
                onSuccess={() => {
                  setTimeout(() => navigate('/'), 2000);
                }}
              />
            ) : (
              <ResetPassword isDarkMode={isDarkMode} />
            )
          ) : viewingDbStatus ? (
            <DatabaseStatus 
              onBack={() => {
                setViewingDbStatus(false);
                navigate('/');
              }}
              isDarkMode={isDarkMode}
              token={token}
            />
          ) : !token ? (
            // Public facing portal
            <LandingPage 
              initialTab={location.pathname === '/forgot-password' ? 'forgot' : 'login'}
              onOpenAuth={(role) => {
                if (role === 'student') navigate('/student-login');
                else if (role === 'department') navigate('/department-login');
                else if (role === 'admin') navigate('/admin-login');
                else navigate('/');
              }} 
              onOpenDbStatus={undefined}
              departments={departments}
              isDarkMode={isDarkMode}
              onSuccess={handleAuthSuccess}
            />
          ) : user.role === 'student' ? (
            // Student operational view
            <StudentDashboard 
              user={user} 
              departments={departments} 
              token={token}
              isDarkMode={isDarkMode}
              externalActiveNav={activeNav}
              onNavChange={setActiveNav}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
              onTicketCountChange={setStudentTicketsCount}
              onUnreadNotifsChange={setUnreadNotifsCount}
            />
          ) : user.role === 'staff' ? (
            // Officer query resolver
            <StaffDashboard 
              user={user} 
              departments={departments} 
              token={token}
              isDarkMode={isDarkMode}
              externalActiveTab={activeNav}
              onTabChange={setActiveNav}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
            />
          ) : user.role === 'superadmin' ? (
            // Principal ledger analytics manager
            <AdminDashboard 
              user={user} 
              departments={departments} 
              token={token}
              isDarkMode={isDarkMode}
              onRefreshDepartments={fetchDepartments}
              onUpdateUser={handleUpdateUser}
              onLogout={handleLogout}
              externalActiveTab={activeNav}
              onTabChange={setActiveNav}
              onOpenProfileModal={() => setIsProfileModalOpen(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-screen space-y-4">
              <ShieldAlert className="w-12 h-12 text-rose-500 animate-bounce" />
              <h3 className="font-bold text-lg text-red-400">Restricted Workspace Context</h3>
              <p className="text-slate-400 text-xs text-center">Your profile role is unrecognized. Try logging out and signing in again.</p>
              <button
                onClick={handleLogout}
                className="py-1.5 px-4 bg-navy-950 hover:bg-slate-800 hover:text-white rounded-lg cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
          </Suspense>
        </main>
      </div>

      {/* Authentication form dialog overlay */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => {
          setIsAuthOpen(false);
          navigate('/');
        }} 
        onSuccess={handleAuthSuccess}
        isDarkMode={isDarkMode}
        initialRole={selectedRole}
      />

      {/* Keep me signed in prompt */}
      {pendingAuth && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`p-6 max-w-sm w-full border border-paper-300 shadow-2xl rounded-xl space-y-4 ${isDarkMode ? 'bg-charcoal-900 text-white border-charcoal-800' : 'bg-white text-navy-950'}`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-navy-50 text-navy-950 rounded-full flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-gold-600" />
              </div>
              <div>
                <h3 className="font-serif font-extrabold text-sm tracking-wide">Remember Session</h3>
                <p className="text-xs text-slate-400">Keep me signed in on this device?</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              If you select <strong>Yes</strong>, your session will be saved securely for 30 days so you won't need to sign in again. Select <strong>No</strong> for shared devices.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  const { user: u, token: t } = pendingAuth;
                  setUser(u);
                  setToken(t);
                  
                  // Persistent storage + 30 day cookie
                  localStorage.setItem('user', JSON.stringify(u));
                  localStorage.setItem('token', t);
                  document.cookie = `token=${t}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict; Secure`;
                  
                  setPendingAuth(null);
                  setUserRoleGreeting(u);
                }}
                className="flex-1 py-2 bg-navy-950 hover:bg-navy-900 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors text-center rounded"
              >
                Yes
              </button>
              <button
                onClick={() => {
                  const { user: u, token: t } = pendingAuth;
                  setUser(u);
                  setToken(t);
                  
                  // Session-only storage
                  sessionStorage.setItem('user', JSON.stringify(u));
                  sessionStorage.setItem('token', t);
                  document.cookie = `token=${t}; path=/; SameSite=Strict; Secure`;
                  
                  setPendingAuth(null);
                  setUserRoleGreeting(u);
                }}
                className="flex-1 py-2 bg-paper-200 hover:bg-paper-300 text-navy-950 font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors text-center border border-paper-300 rounded"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
