import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, FileText, Send, ClipboardList, Building2, Megaphone, 
  User, UserCheck, Users, BarChart4, Landmark, FileSearch, Settings, 
  LogOut, Key, ChevronLeft, ChevronRight, X, Shield, ShieldCheck, 
  HelpCircle, ClipboardCheck, Download, ChevronDown, ChevronUp, Database,
  Sun, Moon, ExternalLink, Bell, AlertTriangle
} from 'lucide-react';
import { Department } from '../types';

export interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface AppSidebarProps {
  user: any;
  departments: Department[];
  isDarkMode: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  activeNav: string;
  onSelectNav: (navId: string) => void;
  onOpenProfileModal: () => void;
  onNavigateChangePassword: () => void;
  onLogout: () => void;
  dbStatus?: any;
  onOpenDbStatus?: () => void;
  studentTicketCount?: number;
  unreadNotifsCount?: number;
}

export default function AppSidebar({
  user,
  departments,
  isDarkMode,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  activeNav,
  onSelectNav,
  onOpenProfileModal,
  onNavigateChangePassword,
  onLogout,
  dbStatus,
  onOpenDbStatus,
  studentTicketCount,
  unreadNotifsCount
}: AppSidebarProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (isProfileMenuOpen) {
          setIsProfileMenuOpen(false);
        } else if (isMobileOpen) {
          onCloseMobile();
        }
      }
      // Shortcut Ctrl+B or Cmd+B to toggle sidebar on desktop
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        onToggleCollapse();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, isProfileMenuOpen, onCloseMobile, onToggleCollapse]);

  if (!user) return null;

  const role = user.role || 'student';
  const isAdmin = role === 'superadmin';
  const isStaff = role === 'staff';
  const isStudent = role === 'student';

  // Find department profile for staff
  const staffDept = departments.find(d => d.key === user.departmentKey);

  // User initials
  const initials = (user.name || user.email || 'CC')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Role-based Navigation Configuration
  const studentNavItems: NavItemConfig[] = [
    {
      id: 'overview',
      label: 'Portal Overview',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />
    },
    {
      id: 'file-grievance',
      label: 'File Grievance / Request',
      icon: <Send className="w-4 h-4 shrink-0" />
    },
    {
      id: 'my-tickets',
      label: 'My Filed Cases',
      icon: <ClipboardList className="w-4 h-4 shrink-0" />,
      badge: studentTicketCount !== undefined && studentTicketCount > 0 ? studentTicketCount : undefined
    },
    {
      id: 'notices',
      label: 'Official Noticeboard',
      icon: <Megaphone className="w-4 h-4 shrink-0" />
    },
    {
      id: 'directory',
      label: 'Department Directory',
      icon: <Building2 className="w-4 h-4 shrink-0" />
    },
    {
      id: 'my-profile',
      label: 'My Student Profile',
      icon: <UserCheck className="w-4 h-4 shrink-0" />
    }
  ];

  const adminNavItems: NavItemConfig[] = [
    {
      id: 'analytics',
      label: 'Dashboard & Analytics',
      icon: <BarChart4 className="w-4 h-4 shrink-0" />
    },
    {
      id: 'profile',
      label: 'Institution Profile',
      icon: <Landmark className="w-4 h-4 shrink-0" />
    },
    {
      id: 'departments',
      label: 'Manage Departments',
      icon: <Building2 className="w-4 h-4 shrink-0" />
    },
    {
      id: 'staff',
      label: 'Manage Staff',
      icon: <Users className="w-4 h-4 shrink-0" />
    },
    {
      id: 'students',
      label: 'Enrolled Students',
      icon: <UserCheck className="w-4 h-4 shrink-0" />
    },
    {
      id: 'tickets',
      label: 'Master Ticket Ledger',
      icon: <FileSearch className="w-4 h-4 shrink-0" />
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: <Megaphone className="w-4 h-4 shrink-0" />
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: <Settings className="w-4 h-4 shrink-0" />
    },
    {
      id: 'admin-profile',
      label: 'Administrator Profile',
      icon: <User className="w-4 h-4 shrink-0" />
    }
  ];

  const staffNavItems: NavItemConfig[] = [
    {
      id: 'complaints',
      label: 'Assigned Complaints',
      icon: <ClipboardCheck className="w-4 h-4 shrink-0" />
    },
    {
      id: 'help',
      label: 'Help Requests',
      icon: <HelpCircle className="w-4 h-4 shrink-0" />
    },
    {
      id: 'announcements',
      label: 'Department Noticeboard',
      icon: <Megaphone className="w-4 h-4 shrink-0" />
    },
    {
      id: 'department-info',
      label: 'Department Dossier',
      icon: <Building2 className="w-4 h-4 shrink-0" />
    },
    {
      id: 'export-report',
      label: 'Export Incident Report',
      icon: <Download className="w-4 h-4 shrink-0" />
    },
    {
      id: 'my-profile',
      label: 'My Officer Profile',
      icon: <User className="w-4 h-4 shrink-0" />
    }
  ];

  const currentNavItems = isAdmin 
    ? adminNavItems 
    : isStaff 
      ? staffNavItems 
      : studentNavItems;

  const handleNavClick = (id: string) => {
    if (id === 'my-profile' || id === 'admin-profile') {
      onOpenProfileModal();
    } else {
      onSelectNav(id);
    }
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  // Reusable Sidebar Content (shared between Desktop and Mobile Drawer)
  const renderSidebarContent = (isDrawer = false) => {
    const collapsed = isDrawer ? false : isCollapsed;

    return (
      <div className={`flex flex-col h-full select-none transition-colors ${
        isDarkMode 
          ? 'bg-charcoal-900 border-charcoal-800 text-slate-100' 
          : 'bg-white border-paper-300 text-navy-950'
      }`}>
        
        {/* Top Branding & Workspace Zone */}
        <div className={`h-16 px-4 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'border-charcoal-800 bg-charcoal-950/40' : 'border-paper-200 bg-paper-50/60'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            {/* CampusConnect Crest Icon */}
            <div className="w-9 h-9 rounded-xl bg-gold-500 text-navy-950 font-black text-sm flex items-center justify-center shadow-xs shrink-0 font-mono tracking-tight">
              CC
            </div>

            {(!collapsed || isDrawer) && (
              <div className="min-w-0">
                <span className={`font-bold text-sm tracking-tight block truncate ${
                  isDarkMode ? 'text-white' : 'text-navy-950'
                }`}>
                  CampusConnect
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wider block font-semibold ${
                  isAdmin 
                    ? 'text-rose-500' 
                    : isStaff 
                      ? 'text-sky-500' 
                      : 'text-gold-600 dark:text-gold-400'
                }`}>
                  {isAdmin ? 'Admin Console' : isStaff ? 'Staff Portal' : 'Student Portal'}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Mobile Close Button */}
          {isDrawer ? (
            <button
              onClick={onCloseMobile}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'border-charcoal-700 hover:bg-charcoal-800 text-slate-400 hover:text-white' 
                  : 'border-paper-300 hover:bg-paper-100 text-slate-600 hover:text-slate-900'
              }`}
              title="Close Drawer"
              aria-label="Close navigation drawer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer hidden lg:flex items-center justify-center focus-visible:ring-2 focus-visible:ring-gold-400 ${
                isDarkMode 
                  ? 'border-charcoal-700 hover:bg-charcoal-800 text-slate-400 hover:text-white' 
                  : 'border-paper-300 hover:bg-paper-100 text-slate-600 hover:text-slate-900'
              }`}
              title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Universal User Identity Card & Dropdown Profile Menu */}
        <div className={`p-3 border-b shrink-0 relative ${
          isDarkMode ? 'border-charcoal-800 bg-charcoal-950/20' : 'border-paper-200 bg-paper-50/40'
        }`} ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`w-full p-2 rounded-xl border transition-all text-left flex items-center gap-3 cursor-pointer group focus-visible:ring-2 focus-visible:ring-gold-400 ${
              isProfileMenuOpen 
                ? isDarkMode ? 'border-gold-500/60 bg-charcoal-800/80' : 'border-gold-500/60 bg-gold-50/50'
                : isDarkMode 
                  ? 'border-charcoal-800 hover:border-charcoal-700 bg-charcoal-900 hover:bg-charcoal-800/70' 
                  : 'border-paper-300 hover:border-paper-400 bg-white hover:bg-paper-50 shadow-2xs'
            }`}
            title={collapsed ? `${user.name} (${role}) - Open Profile Menu` : undefined}
            aria-label="User account and profile menu"
            aria-expanded={isProfileMenuOpen}
          >
            {/* Avatar Initials with Role indicator */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 font-mono shadow-2xs ${
              isAdmin 
                ? 'bg-rose-900 text-rose-100' 
                : isStaff 
                  ? 'bg-sky-900 text-sky-100' 
                  : 'bg-gold-500 text-navy-950 font-black'
            }`}>
              {initials}
            </div>

            {(!collapsed || isDrawer) && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate block ${
                    isDarkMode ? 'text-white' : 'text-navy-950'
                  }`}>
                    {user.name || 'CampusConnect User'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
                    isProfileMenuOpen ? 'rotate-180 text-gold-500' : ''
                  }`} />
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {isStudent && (user.enrollmentNumber ? `Ref ${user.enrollmentNumber}` : 'Student')}
                  {isStaff && (staffDept?.name ? `${staffDept.name}` : `${user.departmentKey?.toUpperCase()} Desk`)}
                  {isAdmin && 'Administrator'}
                </div>
              </div>
            )}
          </button>

          {/* User Profile Menu Dropdown */}
          {isProfileMenuOpen && (
            <div className={`absolute z-50 left-3 right-3 mt-1.5 p-1.5 rounded-xl border shadow-xl transition-all duration-150 ${
              collapsed && !isDrawer 
                ? 'w-60 left-16 top-2' 
                : 'top-full'
            } ${
              isDarkMode 
                ? 'bg-charcoal-900 border-charcoal-700 text-slate-100' 
                : 'bg-white border-paper-300 text-navy-950'
            }`}>
              {/* Profile Card Header in Dropdown */}
              <div className={`px-3 py-2 border-b mb-1 ${
                isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
              }`}>
                <div className="text-xs font-bold truncate">{user.name}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
                <div className="text-[10px] text-gold-500 font-semibold uppercase tracking-wider font-mono mt-0.5">
                  {isAdmin ? 'System Administrator' : isStaff ? 'Department Staff' : 'Student'}
                </div>
              </div>

              {/* Menu Options */}
              <div className="space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenProfileModal();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left font-medium transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-charcoal-800 text-slate-200 hover:text-white' : 'hover:bg-paper-100 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-gold-500" />
                  <span>My Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (isAdmin) {
                      onSelectNav('settings');
                    } else {
                      onOpenProfileModal();
                    }
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left font-medium transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-charcoal-800 text-slate-200 hover:text-white' : 'hover:bg-paper-100 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onNavigateChangePassword();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left font-medium transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-charcoal-800 text-slate-200 hover:text-white' : 'hover:bg-paper-100 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Change Password</span>
                </button>

                <div className={`border-t my-1 ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`} />

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2.5 text-left font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Independently Scrollable Navigation List */}
        <nav 
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1 min-h-0 focus:outline-none"
          aria-label="Dashboard navigation"
        >
          {(!collapsed || isDrawer) && (
            <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
              Workspace Navigation
            </div>
          )}

          {currentNavItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  collapsed && !isDrawer ? 'justify-center px-2' : 'justify-between'
                } ${
                  isActive
                    ? isDarkMode 
                      ? 'bg-charcoal-800 text-gold-400 shadow-xs border-l-2 border-gold-400 font-bold' 
                      : 'bg-navy-950 text-white shadow-xs border-l-2 border-gold-400 font-bold'
                    : isDarkMode 
                      ? 'text-slate-400 hover:text-slate-100 hover:bg-charcoal-800/60' 
                      : 'text-slate-600 hover:text-navy-950 hover:bg-paper-100'
                }`}
                title={collapsed && !isDrawer ? item.label : undefined}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`${isActive ? (isDarkMode ? 'text-gold-400' : 'text-gold-300') : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  {(!collapsed || isDrawer) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </div>

                {(!collapsed || isDrawer) && item.badge !== undefined && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold tabular-nums ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gold-500/20 text-gold-600 dark:text-gold-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Fixed Bottom / Footer Section */}
        <div className={`p-3 border-t shrink-0 space-y-2 ${
          isDarkMode ? 'border-charcoal-800 bg-charcoal-950/40' : 'border-paper-200 bg-paper-50/70'
        }`}>
          {/* Database Connectivity Status Indicator */}
          {dbStatus && (
            <div 
              onClick={isAdmin && onOpenDbStatus ? onOpenDbStatus : undefined}
              className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 transition-colors ${
                isAdmin && onOpenDbStatus ? 'cursor-pointer hover:border-gold-500/50' : ''
              } ${
                isDarkMode ? 'bg-charcoal-950/60 border-charcoal-800' : 'bg-white border-paper-200'
              }`}
              title={`Database Status: ${dbStatus.mode || 'Active'} (${dbStatus.isMongoConnected ? 'Connected' : 'Offline / Reconnecting'})`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Database className={`w-3.5 h-3.5 shrink-0 ${
                  dbStatus.isMongoConnected ? 'text-emerald-500' : 'text-amber-500 animate-pulse'
                }`} />
                {(!collapsed || isDrawer) && (
                  <span className="font-mono text-[10px] truncate text-slate-400">
                    {dbStatus.isMongoConnected ? 'Atlas DB Active' : 'DB Reconnecting'}
                  </span>
                )}
              </div>

              {(!collapsed || isDrawer) && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  dbStatus.isMongoConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
              )}
            </div>
          )}

          {/* Quick Sign Out Action */}
          <button
            type="button"
            onClick={onLogout}
            className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
              collapsed && !isDrawer ? 'justify-center px-1' : ''
            } ${
              isDarkMode 
                ? 'border-charcoal-800 hover:bg-rose-950/30 text-rose-400 border-rose-900/30' 
                : 'border-paper-300 hover:bg-rose-50 text-rose-600 border-rose-200'
            }`}
            title="Sign Out"
            aria-label="Sign out from session"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {(!collapsed || isDrawer) && <span>Sign Out</span>}
          </button>
        </div>

      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Fixed Left Sidebar */}
      <aside 
        className={`hidden lg:block fixed inset-y-0 left-0 z-40 transition-all duration-200 ease-in-out border-r ${
          isCollapsed ? 'w-18' : 'w-64'
        } ${
          isDarkMode ? 'border-charcoal-800' : 'border-paper-300'
        }`}
        aria-label="Desktop application sidebar"
      >
        {renderSidebarContent(false)}
      </aside>

      {/* 2. Responsive Mobile Drawer (<1024px) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-50 lg:hidden flex animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation drawer"
        >
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Slide-in drawer container */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 transition-transform duration-200 transform translate-x-0">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
