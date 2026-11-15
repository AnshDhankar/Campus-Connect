import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Send, HelpCircle, AlertTriangle, Search, Filter, Calendar, 
  User, CheckCircle2, Clock, XCircle, Eye, Phone, Mail, ShieldAlert,
  Bell, Check, Upload, ArrowRight, ShieldCheck, RefreshCw, Paperclip,
  ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import { Department, HelpComplaintRequest, Notification } from '../types';
import { ImageViewer } from './ImageViewer';
import { readAndOptimizeFileAsDataUrl } from '../utils/imageCompression';
import {
  downloadAnnouncementAttachment,
  fetchAnnouncementImagePreviewUrl,
  formatAttachmentSize
} from '../utils/announcementAttachment';

interface StudentDashboardProps {
  user: any;
  departments: Department[];
  token: string;
  isDarkMode: boolean;
  externalActiveNav?: string;
  onNavChange?: (nav: string) => void;
  onOpenProfileModal?: () => void;
  onTicketCountChange?: (count: number) => void;
  onUnreadNotifsChange?: (count: number) => void;
}

export default function StudentDashboard({ 
  user, 
  departments, 
  token, 
  isDarkMode,
  externalActiveNav,
  onNavChange,
  onOpenProfileModal,
  onTicketCountChange,
  onUnreadNotifsChange
}: StudentDashboardProps) {
  // Page state
  const [tickets, setTickets] = useState<HelpComplaintRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewAllAnnouncements, setViewAllAnnouncements] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronize counts to parent sidebar
  useEffect(() => {
    onTicketCountChange?.(tickets.length);
  }, [tickets.length, onTicketCountChange]);

  useEffect(() => {
    onUnreadNotifsChange?.(notifications.length);
  }, [notifications.length, onUnreadNotifsChange]);

  // Synchronize sidebar navigation jumps
  useEffect(() => {
    if (!externalActiveNav) return;
    if (externalActiveNav === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (externalActiveNav === 'file-grievance') {
      const el = document.getElementById('student-filing-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (externalActiveNav === 'my-tickets') {
      const el = document.getElementById('student-cases-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (externalActiveNav === 'notices') {
      const el = document.getElementById('announcement-board-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (externalActiveNav === 'directory') {
      const el = document.getElementById('student-directory-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (externalActiveNav === 'my-profile') {
      onOpenProfileModal?.();
    }
  }, [externalActiveNav, onOpenProfileModal]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);
  
  // Loaders
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);

  // Form Fields
  const [requestType, setRequestType] = useState<'complaint' | 'help'>('complaint');
  const [studentName, setStudentName] = useState(user?.name || '');
  const [enrollmentNumber, setEnrollmentNumber] = useState(user?.enrollmentNumber || '');
  const [mobileNumber, setMobileNumber] = useState(user?.contactNumber || '');
  const [selectedDept, setSelectedDept] = useState('');
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [selectedSubDeptId, setSelectedSubDeptId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [hasManuallySelected, setHasManuallySelected] = useState(false);
  const [suggestedDeptName, setSuggestedDeptName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [base64File, setBase64File] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  // Notifications / Alert messages
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Selected ticket for side-panel detail / timeline tracking view
  const [selectedTicket, setSelectedTicket] = useState<HelpComplaintRequest | null>(null);
  const [reopenRemarks, setReopenRemarks] = useState('');
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');
  const [reopenSuccess, setReopenSuccess] = useState('');

  // Dynamic MongoDB departments local state
  const [localDepartments, setLocalDepartments] = useState<Department[]>(departments);

  // Active full screen image viewer state
  const [activeViewerImage, setActiveViewerImage] = useState<string | null>(null);

  // Department directory search and accordion expand states
  const [deptSearchQuery, setDeptSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  // Automatically expand parent departments if they contain a matching sub-department
  useEffect(() => {
    if (!deptSearchQuery.trim()) return;
    const query = deptSearchQuery.toLowerCase().trim();
    const newExpanded = { ...expandedDepts };
    let changed = false;

    localDepartments.forEach((dept) => {
      const deptSubs = subDepartments.filter(sub => sub.departmentKey === dept.key);
      const hasMatchingSub = deptSubs.some(sub => 
        sub.name.toLowerCase().includes(query) ||
        (sub.headName && sub.headName.toLowerCase().includes(query)) ||
        (sub.officialEmail && sub.officialEmail.toLowerCase().includes(query)) ||
        (sub.contactNumber && sub.contactNumber.toLowerCase().includes(query)) ||
        (sub.officeLocation && sub.officeLocation.toLowerCase().includes(query))
      );
      if (hasMatchingSub && !newExpanded[dept.key]) {
        newExpanded[dept.key] = true;
        changed = true;
      }
    });

    if (changed) {
      setExpandedDepts(newExpanded);
    }
  }, [deptSearchQuery, localDepartments, subDepartments]);

  // Student noticeboard announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementCategory, setAnnouncementCategory] = useState('');
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    try {
      setIsAnnouncementsLoading(true);
      const res = await fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Students see published, unarchived, and active (non-expired) notices
        const filtered = data.filter((a: any) => {
          if (!a.isPublished || a.isArchived) return false;
          if (a.expiryDate && new Date(a.expiryDate) < new Date()) return false;
          return true;
        });
        setAnnouncements(filtered);
      }
    } catch (err) {
      console.warn('Failed to fetch announcements for student noticeboard:', err);
    } finally {
      setIsAnnouncementsLoading(false);
    }
  };

  const fetchLocalDepartments = async () => {
    try {
      const activeInstId = user?.institutionId || 'default';
      const res = await fetch(`/api/departments?institutionId=${activeInstId}`);
      if (res.ok) {
        const data = await res.json();
        setLocalDepartments(data);
      }
    } catch (err) {
      console.warn('Could not update department directory list.');
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      console.warn('Failed to retrieve notification center feeds.');
    }
  };

  const clearNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications([]);
        setShowNotifications(false);
      }
    } catch {
      console.warn('Failed to clear notifications.');
    }
  };

  const fetchSubDepartments = async () => {
    try {
      const res = await fetch('/api/subdepartments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubDepartments(data);
      }
    } catch (err) {
      console.warn('Failed to fetch sub-departments:', err);
    }
  };

  useEffect(() => {
    fetchTickets(false);
    fetchNotifications();
    fetchLocalDepartments();
    fetchAnnouncements();
    fetchSubDepartments();
    const intervalId = setInterval(() => {
      fetchTickets(true);
      fetchNotifications();
      fetchLocalDepartments();
      fetchAnnouncements();
      fetchSubDepartments();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [token, statusFilter, typeFilter]);

  const fetchTickets = async (silent = false) => {
    try {
      if (!silent) setIsTicketsLoading(true);
      const url = new URL('/api/requests', window.location.origin);
      if (statusFilter) url.searchParams.append('status', statusFilter);
      if (typeFilter) url.searchParams.append('type', typeFilter);
      if (searchQuery) url.searchParams.append('search', searchQuery);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        
        // Maintain selection reference if detail panel is active by fetching direct details to prevent status filter-out issues
        if (selectedTicket) {
          const detailRes = await fetch(`/api/requests/${selectedTicket.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setSelectedTicket(detailData);
          }
        }
      }
    } catch {
      console.warn('Could not update tickets dashboard logs.');
    } finally {
      if (!silent) setIsTicketsLoading(false);
    }
  };

  const handleReopenTicket = async (ticketId: string, reason: string) => {
    if (!reason || reason.trim().length < 5) {
      setReopenError('Please provide a valid reason for reopening (minimum 5 characters).');
      return;
    }
    try {
      setIsReopening(true);
      setReopenError('');
      setReopenSuccess('');
      const res = await fetch(`/api/requests/${ticketId}/reopen`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to reopen ticket.');
      }
      setReopenRemarks('');
      setReopenSuccess('Ticket successfully reopened. The department officers have been notified.');
      fetchTickets(true);
    } catch (err: any) {
      setReopenError(err.message || 'Error reopening ticket.');
    } finally {
      setIsReopening(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setFormError('Attachment size must not exceed 4MB.');
        return;
      }
      setFileName(file.name);
      try {
        const optimizedDataUrl = await readAndOptimizeFileAsDataUrl(file, {
          maxDimension: 1600,
          maxTargetBytes: 1.2 * 1024 * 1024,
          quality: 0.82
        });
        setBase64File(optimizedDataUrl);
      } catch {
        setFormError('Could not process the selected attachment.');
      }
    }
  };

  const getSmartSuggestedDept = (subj: string, desc: string): string => {
    const text = `${subj} ${desc}`.toLowerCase();
    
    if (/\b(bus|transport|shuttle|route|driver|vehicle|cab)\b/.test(text)) return 'transport';
    if (/\b(exam|exams|test|marks|grade|grades|re-evaluation|marksheet|results|assessment|re-evaluations)\b/.test(text)) return 'examination';
    if (/\b(placement|placements|interview|job|recruitment|career|resume|cv|recruiter)\b/.test(text)) return 'placement';
    if (/\b(attendance|course|curriculum|syllabus|professor|class|classes|registration|faculty|academic)\b/.test(text)) return 'academic';
    if (/\b(fee|fees|tuition|payment|scholarship|finance|bill|clearances|receipt|receipts|accounts)\b/.test(text)) return 'accounts';
    if (/\b(book|library|fine|journal|journals|borrow|librarian|card)\b/.test(text)) return 'library';
    if (/\b(hostel|room|mess|boarding|warden|food|rent|laundry)\b/.test(text)) return 'hostel';
    if (/\b(wifi|wi-fi|network|internet|portal|password|login|email|credentials|server|itsupport|computer|software|outage)\b/.test(text)) return 'itsupport';
    if (/\b(parking|security|safety|decal|building|facilities|facility|admin|administration|document|certification)\b/.test(text)) return 'administration';

    return '';
  };

  const handleTextChangeAndRoute = (subjVal: string, descVal: string) => {
    if (hasManuallySelected) {
      // Do not override user's explicit manual department/category choice
      return;
    }
    const suggestedKey = getSmartSuggestedDept(subjVal, descVal);
    if (suggestedKey) {
      const match = localDepartments.find(d => d.key === suggestedKey);
      if (match) {
        setSelectedDept(suggestedKey);
        setSuggestedDeptName(match.name);
      }
    } else {
      setSuggestedDeptName('');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!selectedDept || !subject || !description || !studentName || !enrollmentNumber || !mobileNumber) {
      setFormError('Please fill in all requested fields (including student identifiers).');
      return;
    }

    try {
      setIsSubmitLoading(true);
      
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-idempotency-key': typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random()}`
        },
        body: JSON.stringify({
          departmentKey: selectedDept,
          subDepartmentId: selectedSubDeptId || undefined,
          requestType,
          subject,
          description,
          attachments: base64File ? [base64File] : []
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to submit college ticket.');
      }

      setFormSuccess(`Successfully dispatched your ${requestType} ticket! Ticket Code: ${resData.id}`);
      
      // Zero out form inputs
      setSelectedDept('');
      setSelectedSubDeptId('');
      setSelectedCategory('');
      setHasManuallySelected(false);
      setSubject('');
      setDescription('');
      setBase64File('');
      setFileName('');
      
      fetchTickets();
    } catch (err: any) {
      setFormError(err.message || 'Error processing ticket upload.');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setTypeFilter('');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': 
        return isDarkMode 
          ? 'bg-amber-950/40 text-amber-300 border-amber-900/60' 
          : 'bg-amber-50 text-amber-800 border-amber-200';
      case 'assigned': 
        return isDarkMode 
          ? 'bg-navy-900/40 text-navy-300 border-navy-800' 
          : 'bg-navy-50 text-navy-800 border-navy-200';
      case 'under_review': 
        return isDarkMode 
          ? 'bg-blue-950/40 text-blue-300 border-blue-900/60' 
          : 'bg-blue-50 text-blue-800 border-blue-200';
      case 'in_progress': 
        return isDarkMode 
          ? 'bg-indigo-950/40 text-indigo-300 border-indigo-900/60' 
          : 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'resolved': 
        return isDarkMode 
          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60' 
          : 'bg-emerald-50 text-emerald-850 text-emerald-800 border-emerald-200';
      case 'rejected': 
        return isDarkMode 
          ? 'bg-red-950/40 text-red-300 border-red-900/60' 
          : 'bg-red-50 text-red-800 border-red-200';
      case 'closed': 
        return isDarkMode 
          ? 'bg-charcoal-800 text-charcoal-300 border-charcoal-700' 
          : 'bg-charcoal-50 text-charcoal-700 border-charcoal-200';
      default: 
        return isDarkMode 
          ? 'bg-charcoal-800 text-charcoal-300 border-charcoal-700' 
          : 'bg-charcoal-50 text-charcoal-700 border-charcoal-200';
    }
  };

  const getDepartmentName = (key: string) => {
    return localDepartments.find(d => d.key === key)?.name || key;
  };

  // Stats Counters
  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress' || t.status === 'assigned' || t.status === 'under_review').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected').length;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-charcoal-950 text-charcoal-50' 
        : 'bg-paper-100 text-charcoal-900'
    }`}>


      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Student Welcome Header & Utility Controls */}
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b transition-colors ${
          isDarkMode ? 'border-charcoal-800' : 'border-paper-300'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] uppercase font-bold tracking-wider font-mono ${
                isDarkMode ? 'text-gold-400' : 'text-navy-700'
              }`}>
                Student Services Portal
              </span>
              <span className="text-slate-400" aria-hidden="true">·</span>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                Ref {user?.enrollmentNumber || 'STU'}
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 ${
              isDarkMode ? 'text-white' : 'text-navy-950'
            }`}>
              Welcome back, {user?.name || 'Student'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              File academic or administrative grievances, route requests to college desks, and track incident progress in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end">
            {/* Notification alert counter */}
            <div className="relative" ref={dropdownRef}>
              <button
                id="notification-bell"
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2.5 relative cursor-pointer flex items-center justify-center h-10 w-10 rounded-lg border transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  isDarkMode 
                    ? 'bg-charcoal-900 hover:bg-charcoal-800 border-charcoal-700 text-charcoal-100' 
                    : 'bg-white hover:bg-paper-100 border-paper-300 text-charcoal-800 shadow-2xs'
                }`}
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                {notifications.length > 0 && (
                  <span 
                    id="notification-count"
                    className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white dark:border-charcoal-900 tabular-nums shadow-xs"
                  >
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification dropdown overlay */}
              {showNotifications && (
                <div 
                  id="notification-dropdown"
                  className={`absolute right-0 mt-2 w-80 sm:w-96 shadow-xl z-50 p-4 border rounded-xl transition-all ${
                    isDarkMode 
                      ? 'bg-charcoal-900 border-charcoal-700 text-slate-100' 
                      : 'bg-white border-paper-300 text-navy-950'
                  }`}
                >
                  <div className={`flex items-center justify-between pb-2.5 mb-3 border-b ${
                    isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider font-mono ${
                      isDarkMode ? 'text-gold-400' : 'text-navy-900'
                    }`}>
                      Notification Center
                    </span>
                    {notifications.length > 0 && (
                      <button 
                        id="clear-notifications-btn"
                        onClick={clearNotifications}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-mono">
                      No unread notifications at this time.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          className={`p-3 rounded-lg border text-xs leading-relaxed space-y-1 transition-colors ${
                            isDarkMode 
                              ? 'bg-charcoal-950/70 border-charcoal-800 hover:border-charcoal-700' 
                              : 'bg-paper-50 border-paper-200 hover:border-paper-300'
                          }`}
                        >
                          <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{notif.title}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">{notif.message}</p>
                          <span className="text-[10px] text-slate-400 block font-mono tabular-nums pt-0.5">
                            {new Date(notif.createdAt).toLocaleDateString()} · {new Date(notif.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              id="sync-button"
              onClick={fetchTickets}
              className={`py-2 px-3.5 text-xs font-semibold uppercase tracking-wider rounded-lg border flex items-center gap-2 cursor-pointer h-10 transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                isDarkMode 
                  ? 'bg-charcoal-900 hover:bg-charcoal-800 border-charcoal-700 text-charcoal-200' 
                  : 'bg-white hover:bg-paper-50 border-paper-300 text-charcoal-800 shadow-2xs'
              }`}
              title="Refresh Case List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTicketsLoading ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Student Services Portal Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Student Profile Card & Stats */}
          <div id="student-profile-card" className={`rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-colors ${
            isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                  isDarkMode 
                    ? 'bg-navy-950/50 text-navy-300 border border-navy-800' 
                    : 'bg-navy-50 text-navy-800 border border-navy-150'
                }`}>
                  Verified Student
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {user?.enrollmentNumber || 'N/A'}
                </span>
              </div>
              <h3 className={`text-lg font-bold leading-tight mb-3 ${
                isDarkMode ? 'text-white' : 'text-navy-950'
              }`}>
                {user?.name || 'Verified Student'}
              </h3>
              <div className="space-y-2 text-xs">
                <div className={`flex justify-between items-center border-b pb-1.5 ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
                  <span className="text-slate-400">Enrollment ID:</span>
                  <strong className="font-mono font-semibold text-slate-700 dark:text-slate-200">{user?.enrollmentNumber || 'N/A'}</strong>
                </div>
                <div className={`flex justify-between items-center border-b pb-1.5 ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
                  <span className="text-slate-400">Contact Number:</span>
                  <strong className="font-mono font-semibold text-slate-700 dark:text-slate-200">{user?.contactNumber || 'N/A'}</strong>
                </div>
                <div className={`flex justify-between items-center border-b pb-1.5 ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
                  <span className="text-slate-400">Official Email:</span>
                  <strong className="truncate max-w-[170px] font-medium text-slate-700 dark:text-slate-200">
                    {user?.email || `${user?.studentId || 'student'}@campusconnect.edu`}
                  </strong>
                </div>
              </div>
            </div>
            
            <div className={`pt-3 border-t grid grid-cols-2 gap-3 text-center ${
              isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
            }`}>
              <div className={`p-2.5 rounded-lg border ${
                isDarkMode ? 'bg-charcoal-950/50 border-charcoal-800' : 'bg-paper-50 border-paper-200'
              }`}>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Active Cases</span>
                <strong className={`text-xl font-bold font-mono tabular-nums ${isDarkMode ? 'text-gold-400' : 'text-navy-950'}`}>
                  {tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed' && t.status !== 'rejected').length}
                </strong>
              </div>
              <div className={`p-2.5 rounded-lg border ${
                isDarkMode ? 'bg-charcoal-950/50 border-charcoal-800' : 'bg-paper-50 border-paper-200'
              }`}>
                <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Filed</span>
                <strong className="text-xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {tickets.length}
                </strong>
              </div>
            </div>
          </div>

          {/* Compact Announcement Board */}
          <div id="announcement-board-card" className={`rounded-xl border p-5 shadow-xs space-y-4 flex flex-col justify-between transition-colors ${
            isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
          }`}>
            <div>
              <div className={`flex items-center justify-between border-b pb-2.5 mb-3 ${
                isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
              }`}>
                <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 font-mono ${
                  isDarkMode ? 'text-gold-400' : 'text-navy-900'
                }`}>
                  <Bell className="w-4 h-4 text-gold-500" />
                  Campus Announcements
                </h2>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {announcements.length} Published
                </span>
              </div>

              {isAnnouncementsLoading && announcements.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-mono">
                  Syncing notices...
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 space-y-1 text-xs">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No active notices.</p>
                  <p className="text-[11px] text-slate-400">Your campus circular board is clear.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[170px] overflow-y-auto pr-1">
                  {(viewAllAnnouncements ? announcements : announcements.slice(0, 2)).map((ann) => {
                    const isExpanded = expandedAnnouncement === ann.id;
                    return (
                      <div 
                        key={ann.id} 
                        className={`p-3 rounded-lg border transition-all text-xs space-y-2 ${
                          ann.isPinned 
                            ? isDarkMode 
                              ? 'border-gold-500/40 bg-gold-950/20'
                              : 'border-gold-400/60 bg-gold-50/40' 
                            : isDarkMode 
                              ? 'border-charcoal-800 bg-charcoal-950/40 hover:bg-charcoal-800/60'
                              : 'border-paper-200 bg-paper-50 hover:bg-paper-100/60'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                              {ann.isPinned && (
                                <span className="font-bold text-gold-600 dark:text-gold-400">PINNED</span>
                              )}
                              {ann.isPinned && <span aria-hidden="true">·</span>}
                              <span>{ann.category}</span>
                            </div>
                            <h4 
                              onClick={() => setExpandedAnnouncement(isExpanded ? null : ann.id)}
                              className={`font-semibold tracking-tight mt-1 hover:text-gold-500 cursor-pointer text-xs leading-snug transition-colors ${
                                isDarkMode ? 'text-slate-100' : 'text-slate-900'
                              }`}
                            >
                              {ann.title}
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                            {new Date(ann.publishDate).toLocaleDateString()}
                          </span>
                        </div>

                        {isExpanded && (
                          <div className={`pt-2 border-t text-xs leading-relaxed space-y-2 ${
                            isDarkMode ? 'border-charcoal-800 text-slate-300' : 'border-paper-200 text-slate-700'
                          }`}>
                            <p className="whitespace-pre-line">{ann.description}</p>
                            {ann.attachmentUrl && (
                              <div className={`pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t ${
                                isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
                              }`}>
                                <span className="font-mono text-slate-400 flex items-center gap-1 min-w-0">
                                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-[180px]">{ann.attachmentName || 'Circular File'}</span>
                                  {ann.attachmentSize ? (
                                    <span className="text-[10px] opacity-80 shrink-0">
                                      ({formatAttachmentSize(ann.attachmentSize)})
                                    </span>
                                  ) : null}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {ann.attachmentMimeType?.startsWith('image/') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void fetchAnnouncementImagePreviewUrl(ann.attachmentUrl, token)
                                          .then((previewUrl) => setActiveViewerImage(previewUrl))
                                          .catch(() => {});
                                      }}
                                      className={`font-semibold hover:underline text-[11px] cursor-pointer ${
                                        isDarkMode ? 'text-slate-300' : 'text-slate-700'
                                      }`}
                                    >
                                      Preview
                                    </button>
                                  )}
                                  {ann.attachmentUrl.startsWith('/api/') ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void downloadAnnouncementAttachment(ann.attachmentUrl, token, ann.attachmentName).catch(() => {});
                                      }}
                                      className={`font-semibold hover:underline text-[11px] cursor-pointer ${
                                        isDarkMode ? 'text-gold-400' : 'text-navy-900'
                                      }`}
                                    >
                                      Download File
                                    </button>
                                  ) : (
                                    <a 
                                      href={ann.attachmentUrl} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className={`font-semibold hover:underline text-[11px] ${
                                        isDarkMode ? 'text-gold-400' : 'text-navy-900'
                                      }`}
                                    >
                                      Download File
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {announcements.length > 2 && (
              <button
                onClick={() => setViewAllAnnouncements(!viewAllAnnouncements)}
                className={`w-full mt-2 py-2 text-center rounded-lg border text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-all ${
                  isDarkMode 
                    ? 'bg-charcoal-800 border-charcoal-700 text-slate-300 hover:bg-charcoal-750' 
                    : 'bg-paper-50 border-paper-250 text-slate-700 hover:bg-paper-100'
                }`}
              >
                {viewAllAnnouncements ? 'Show Recent Only' : `View All (${announcements.length})`}
              </button>
            )}
          </div>

          {/* Department Quick Directory */}
          <div className={`rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-colors ${
            isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
          }`}>
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wider font-mono px-2 py-0.5 rounded ${
                  isDarkMode 
                    ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800' 
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  Academic Directory
                </span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {localDepartments.length} Desks
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                Identify the responsible department desk for direct case routing and faster response.
              </p>
              
              <div className="space-y-2 max-h-[145px] overflow-y-auto pr-1">
                {localDepartments.slice(0, 4).map((dept) => (
                  <div 
                    key={dept.key} 
                    className={`flex items-center justify-between text-xs border-b pb-2 ${
                      isDarkMode ? 'border-charcoal-800' : 'border-paper-150'
                    }`}
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[170px]">{dept.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{dept.key}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`text-[11px] font-mono pt-3 border-t flex justify-between items-center ${
              isDarkMode ? 'border-charcoal-800 text-slate-400' : 'border-paper-200 text-slate-500'
            }`}>
              <span>Active Portals</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">All Desks Online</span>
            </div>
          </div>
        </div>
        
        {/* Visual Key Stat Metric Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className={`rounded-xl border p-5 shadow-xs transition-all ${
            isDarkMode 
              ? 'bg-charcoal-900 border-charcoal-800 hover:border-charcoal-700' 
              : 'bg-white border-paper-300 hover:border-paper-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Pending Desk Caseload
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
              <span className="text-xs text-slate-400">cases</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting initial departmental intake</p>
          </div>

          <div className={`rounded-xl border p-5 shadow-xs transition-all ${
            isDarkMode 
              ? 'bg-charcoal-900 border-charcoal-800 hover:border-charcoal-700' 
              : 'bg-white border-paper-300 hover:border-paper-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Active Processing
              </span>
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <RefreshCw className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono tabular-nums ${
                isDarkMode ? 'text-sky-400' : 'text-sky-600'
              }`}>
                {inProgressCount}
              </span>
              <span className="text-xs text-slate-400">cases</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Under formal investigation or resolution</p>
          </div>

          <div className={`rounded-xl border p-5 shadow-xs transition-all ${
            isDarkMode 
              ? 'bg-charcoal-900 border-charcoal-800 hover:border-charcoal-700' 
              : 'bg-white border-paper-300 hover:border-paper-400'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                Resolved & Cleared
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {resolvedCount}
              </span>
              <span className="text-xs text-slate-400">cases</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Closed with documented feedback</p>
          </div>
        </div>

        {/* Form & List Columns */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Column A: Complaint Submission Form */}
          <div id="student-filing-card" className={`lg:col-span-5 rounded-xl border shadow-xs p-6 space-y-6 transition-colors ${
            isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
          }`}>
            <div className={`pb-4 border-b ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
              <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                isDarkMode ? 'text-gold-400' : 'text-navy-700'
              }`}>
                Incident Intake
              </span>
              <h2 className={`text-xl font-bold tracking-tight mt-0.5 ${
                isDarkMode ? 'text-white' : 'text-navy-950'
              }`}>
                File Incident or Assistance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Submit an academic or campus facility grievance with automatic department routing.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Request Classification
                </label>
                <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-lg border ${
                  isDarkMode ? 'bg-charcoal-950 border-charcoal-800' : 'bg-paper-100 border-paper-250'
                }`}>
                  <button
                    type="button"
                    onClick={() => setRequestType('complaint')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      requestType === 'complaint'
                        ? isDarkMode 
                          ? 'bg-charcoal-800 text-white shadow-xs' 
                          : 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Complaint File
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestType('help')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                      requestType === 'help'
                        ? isDarkMode 
                          ? 'bg-charcoal-800 text-white shadow-xs' 
                          : 'bg-white text-navy-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Help Request
                  </button>
                </div>
              </div>

              {/* Student identification fields */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                    Student Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Alex Rivera"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                      isDarkMode 
                        ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-gold-500' 
                        : 'bg-paper-50 border-paper-300 text-slate-900 focus:border-navy-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                    Enrollment ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. STU1001"
                    value={enrollmentNumber}
                    onChange={(e) => setEnrollmentNumber(e.target.value)}
                    className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none uppercase font-mono transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                      isDarkMode 
                        ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-gold-500' 
                        : 'bg-paper-50 border-paper-300 text-slate-900 focus:border-navy-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Contact Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g. +1 (555) 0123"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none font-mono transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-gold-500' 
                      : 'bg-paper-50 border-paper-300 text-slate-900 focus:border-navy-900'
                  }`}
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Category Quick-Route Selector
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const catVal = e.target.value;
                    setSelectedCategory(catVal);
                    if (catVal) {
                      setSelectedDept(catVal);
                      setHasManuallySelected(true);
                      const match = localDepartments.find(d => d.key === catVal);
                      if (match) {
                        setSuggestedDeptName(match.name);
                      }
                    } else {
                      setSuggestedDeptName('');
                      setHasManuallySelected(false);
                    }
                  }}
                  className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-200 focus:border-gold-500' 
                      : 'bg-paper-50 border-paper-300 text-slate-800 focus:border-navy-900'
                  }`}
                >
                  <option value="">-- Choose Category Topic for Auto-Routing --</option>
                  <option value="academic">Academic & Courses (Attendance, Registrations, Syllabus)</option>
                  <option value="examination">Examinations & Cell (Terminal tests, Marksheets, Re-evaluations)</option>
                  <option value="accounts">Accounts & Fees (Tuition schedules, Scholarships, Receipts)</option>
                  <option value="library">Library & Card Issues (Book reservations, Archive, Fines)</option>
                  <option value="hostel">Hostel Block & Mess (Room allocation, Maintenance, Warden logs)</option>
                  <option value="transport">Campus Transport & Buses (Passes, Shuttle routes, Delay logs)</option>
                  <option value="placement">Training & Placement Cell (Corporate schedules, Resumes, Career)</option>
                  <option value="itsupport">IT Infrastructure Desk (Campus Wi-Fi, Email lockouts, Portal)</option>
                  <option value="administration">Campus Facilities & Safety (ID cards, Parking decals, Security)</option>
                </select>
              </div>

              {/* Department selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Target Recipient Department
                </label>
                <select
                  required
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setHasManuallySelected(true);
                    const match = localDepartments.find(d => d.key === e.target.value);
                    if (match) {
                      setSuggestedDeptName(match.name);
                    } else {
                      setSuggestedDeptName('');
                    }
                  }}
                  className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none cursor-pointer font-medium transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-gold-300 focus:border-gold-500' 
                      : 'bg-white border-paper-300 text-navy-950 focus:border-navy-900'
                  }`}
                >
                  <option value="" disabled>-- Select Recipient Department Desk --</option>
                  {localDepartments.map((dept) => (
                    <option key={dept.key} value={dept.key}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {suggestedDeptName && (
                  <div className={`mt-2 p-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                    isDarkMode 
                      ? 'bg-navy-950/40 border-navy-800 text-navy-200' 
                      : 'bg-blue-50 border-blue-150 text-blue-900'
                  }`}>
                    <span>⚡ Category Auto-Route: <strong>{suggestedDeptName}</strong> matched.</span>
                  </div>
                )}
              </div>

              {/* Conditional Sub-Department Selection */}
              {selectedDept && subDepartments.filter(s => s.departmentKey === selectedDept && s.status !== 'inactive').length > 0 && (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                    Select Sub-Department Unit (Optional)
                  </label>
                  <select
                    value={selectedSubDeptId}
                    onChange={(e) => setSelectedSubDeptId(e.target.value)}
                    className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none cursor-pointer font-medium transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                      isDarkMode 
                        ? 'bg-charcoal-950 border-charcoal-800 text-gold-300 focus:border-gold-500' 
                        : 'bg-white border-paper-300 text-navy-950 focus:border-navy-900'
                    }`}
                  >
                    <option value="">-- Choose Sub-Department (Optional) --</option>
                    {subDepartments
                      .filter(s => s.departmentKey === selectedDept && s.status !== 'inactive')
                      .map((sub: any) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} (HOD: {sub.headName})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Hostel water heater failure / Grade mismatch report"
                  value={subject}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubject(val);
                    handleTextChangeAndRoute(val, description);
                  }}
                  className={`w-full text-xs py-2.5 px-3 rounded-lg border outline-none font-medium transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-gold-500' 
                      : 'bg-paper-50 border-paper-300 text-slate-900 focus:border-navy-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Detailed Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide precise details, campus coordinates, and any relevant dates to expedite routing."
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescription(val);
                    handleTextChangeAndRoute(subject, val);
                  }}
                  className={`w-full text-xs p-3 rounded-lg border outline-none leading-relaxed transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-gold-500' 
                      : 'bg-paper-50 border-paper-300 text-slate-900 focus:border-navy-900'
                  }`}
                />
              </div>

              {/* Attachment upload */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase font-mono tracking-wider">
                  Evidence Attachment (Optional)
                </label>
                <div className={`rounded-xl border border-dashed p-4 text-center transition-colors ${
                  isDarkMode 
                    ? 'bg-charcoal-950/60 border-charcoal-800 hover:border-charcoal-700' 
                    : 'bg-paper-50 border-paper-300 hover:border-paper-400'
                }`}>
                  <input
                    type="file"
                    id="student-evidence-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="student-evidence-file" className="cursor-pointer space-y-1 block">
                    <Upload className="w-5 h-5 mx-auto text-slate-400" />
                    <p className={`text-xs font-semibold ${
                      isDarkMode ? 'text-gold-400' : 'text-navy-900'
                    }`}>
                      Click to upload artifact file
                    </p>
                    <p className="text-[10px] text-slate-400">PNG, JPG, JPEG up to 4MB</p>
                  </label>
                  {fileName && (
                    <div className={`mt-3 p-2 rounded-lg border flex items-center justify-between text-xs font-mono ${
                      isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-paper-100 border-paper-250'
                    }`}>
                      <span className="truncate flex items-center gap-1.5 font-medium">
                        <Paperclip className="w-3.5 h-3.5" /> {fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setBase64File(''); setFileName(''); }}
                        className="text-rose-600 font-bold px-2 hover:underline cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitLoading}
                className={`w-full py-3 text-white font-semibold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-gold-400 ${
                  isDarkMode 
                    ? 'bg-gold-600 hover:bg-gold-500 active:bg-gold-700' 
                    : 'bg-navy-950 hover:bg-navy-900 active:bg-slate-900'
                }`}
              >
                {isSubmitLoading ? 'Dispatching Incident...' : 'Submit Incident Request'}
              </button>
            </form>
          </div>

          {/* Column B: My Requests & Specific Tracking view */}
          <div id="student-cases-card" className="lg:col-span-7 space-y-6">
            
            {/* Filter Panel */}
            <div className={`rounded-xl border p-4 shadow-xs flex flex-wrap gap-4 items-center justify-between transition-colors ${
              isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
            }`}>
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                  isDarkMode ? 'text-gold-400' : 'text-navy-700'
                }`}>
                  Tracking Ledger
                </span>
                <h3 className={`font-bold text-sm tracking-tight ${
                  isDarkMode ? 'text-white' : 'text-navy-950'
                }`}>
                  My Submitted Incidents ({tickets.length})
                </h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`text-xs py-1.5 px-3 rounded-lg border outline-none cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-200' 
                      : 'bg-paper-50 border-paper-250 text-slate-700'
                  }`}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={`text-xs py-1.5 px-3 rounded-lg border outline-none cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-800 text-slate-200' 
                      : 'bg-paper-50 border-paper-250 text-slate-700'
                  }`}
                >
                  <option value="">All Types</option>
                  <option value="complaint">Complaints</option>
                  <option value="help">Help Requests</option>
                </select>

                {(statusFilter || typeFilter) && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs text-rose-600 hover:underline font-semibold px-1 cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* List Table/Stack */}
            <div className={`rounded-xl border shadow-xs overflow-hidden transition-colors ${
              isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
            }`}>
              {isTicketsLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 font-mono">
                  Synchronizing incident ledger...
                </div>
              ) : tickets.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No active incidents found.</p>
                  <p className="text-xs">Your submitted help calls and complaint logs will appear here once filed.</p>
                </div>
              ) : (
                <div className={`divide-y ${isDarkMode ? 'divide-charcoal-800' : 'divide-paper-200'}`}>
                  {tickets.map((t) => (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-4 transition-all cursor-pointer flex justify-between items-center gap-4 ${
                        selectedTicket?.id === t.id 
                          ? isDarkMode 
                            ? 'bg-gold-950/20 ring-1 ring-gold-400/30' 
                            : 'bg-gold-50/40 ring-1 ring-gold-400/40' 
                          : isDarkMode 
                            ? 'hover:bg-charcoal-800/50' 
                            : 'hover:bg-paper-50'
                      }`}
                    >
                      <div className="space-y-1 truncate min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${
                            isDarkMode ? 'text-gold-400' : 'text-navy-900'
                          }`}>{t.id}</span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className={`text-[10px] uppercase font-mono font-semibold tracking-wider px-1.5 py-0.2 rounded border ${
                            t.requestType === 'complaint' 
                              ? isDarkMode 
                                ? 'bg-rose-950/40 border-rose-900/60 text-rose-300' 
                                : 'bg-rose-50 border-rose-200 text-rose-800' 
                              : isDarkMode 
                                ? 'bg-sky-950/40 border-sky-900/60 text-sky-300' 
                                : 'bg-sky-50 border-sky-200 text-sky-800'
                          }`}>
                            {t.requestType}
                          </span>
                        </div>
                        <h4 className="font-semibold text-sm truncate text-slate-900 dark:text-slate-100">{t.subject}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span className="truncate">{getDepartmentName(t.departmentKey)}{t.subDepartmentName ? ` ➔ ${t.subDepartmentName}` : ''}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right space-y-1">
                        <span className={`inline-block text-[10px] uppercase font-semibold px-2 py-0.5 rounded border ${getStatusStyle(t.status)}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        <span className={`block text-[11px] font-semibold uppercase tracking-wider ${
                          isDarkMode ? 'text-gold-400' : 'text-navy-900'
                        }`}>
                          Track →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic Timeline Tracker Panel */}
            {selectedTicket && (
              <div className={`rounded-xl border p-6 shadow-md space-y-6 transition-all ${
                isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
              }`}>
                
                <div className={`flex justify-between items-start pb-4 border-b ${
                  isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
                }`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                        isDarkMode ? 'text-gold-400' : 'text-navy-700'
                      }`}>
                        Incident Tracking Ledger
                      </span>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">Ref: {selectedTicket.id}</span>
                    </div>
                    <h3 className={`text-base font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>
                      {selectedTicket.subject}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-charcoal-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold transition-colors"
                    aria-label="Close tracking view"
                  >
                    ✕
                  </button>
                </div>

                <div className={`p-3.5 rounded-lg border text-xs leading-relaxed space-y-1 ${
                  isDarkMode ? 'bg-charcoal-950/60 border-charcoal-800 text-slate-300' : 'bg-paper-50 border-paper-200 text-slate-700'
                }`}>
                  <span className="font-semibold block text-[11px] text-slate-400 uppercase font-mono">Incident Description</span>
                  <p className="whitespace-pre-line">{selectedTicket.description}</p>
                </div>

                {/* Vertical Timeline implementation for 5 tracking phases */}
                <div className="space-y-4">
                  <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                    Pipeline Progression
                  </h4>

                  <div className="space-y-6 pl-4 relative">
                    
                    {/* Vertical guideline */}
                    <div className={`absolute top-2 bottom-2 left-1.5 w-0.5 ${
                      isDarkMode ? 'bg-charcoal-800' : 'bg-paper-200'
                    }`} />

                    {[
                      { step: 'pending', title: 'Submitted', subtitle: 'The incident has been officially logged in the system.', active: true },
                      { step: 'received', title: `Received by ${getDepartmentName(selectedTicket.departmentKey)}`, subtitle: 'The designated desk coordinator has admitted the ticket.', active: selectedTicket.status !== 'pending' },
                      { step: 'under_review', title: 'Under Review', subtitle: 'Compliance officers are reviewing documentation and evidence.', active: ['assigned', 'in_progress', 'resolved', 'closed', 'rejected'].includes(selectedTicket.status) },
                      { step: 'in_progress', title: 'Action Taken', subtitle: 'Resolution processes or corrective actions are actively ongoing.', active: ['in_progress', 'resolved', 'closed', 'rejected'].includes(selectedTicket.status) },
                      { step: 'resolved', title: 'Resolved / Final Decision', subtitle: 'Official resolution status posted and docket is closed.', active: ['resolved', 'closed', 'rejected'].includes(selectedTicket.status) }
                    ].map((st) => {
                      const isActive = st.active;

                      return (
                        <div key={st.step} className="flex gap-4 relative">
                          <div className={`w-3.5 h-3.5 rounded-full z-10 -ml-1 flex items-center justify-center transition-all ${
                            isActive 
                              ? isDarkMode 
                                ? 'bg-gold-500 ring-4 ring-gold-950/60' 
                                : 'bg-navy-900 ring-4 ring-navy-50' 
                              : 'bg-white border-2 border-slate-300 dark:border-charcoal-700 dark:bg-charcoal-900'
                          }`}>
                            {isActive && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div>
                            <h5 className={`text-xs font-semibold ${
                              isActive 
                                ? isDarkMode ? 'text-gold-300' : 'text-navy-950' 
                                : 'text-slate-400'
                            }`}>{st.title}</h5>
                            <p className="text-[11px] text-slate-400 mt-0.5">{st.subtitle}</p>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>

                {/* Evidence Screenshot rendering */}
                {selectedTicket.attachments?.length ? (
                  <div className={`pt-4 border-t ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
                    <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider font-mono block mb-2">
                      Attached Artifacts
                    </span>
                    <div className={`p-2 rounded-lg border max-w-xs ${
                      isDarkMode ? 'bg-charcoal-950/60 border-charcoal-800' : 'bg-paper-50 border-paper-250'
                    }`}>
                      <img 
                        src={selectedTicket.attachments[0]} 
                        alt="Evidence panel" 
                        referrerPolicy="no-referrer"
                        className="max-h-36 rounded object-contain bg-slate-50 dark:bg-charcoal-900 cursor-zoom-in mx-auto transition-transform hover:scale-[1.02]"
                        onClick={() => setActiveViewerImage(selectedTicket.attachments[0])}
                      />
                    </div>
                  </div>
                ) : null}

                {/* Officer Remarks display (Resolution History) */}
                <div className={`p-4 rounded-lg border text-xs space-y-1 ${
                  isDarkMode 
                    ? 'bg-navy-950/30 border-navy-800/60' 
                    : 'bg-blue-50/70 border-blue-200'
                }`}>
                  <span className={`font-semibold uppercase text-[10px] tracking-wider font-mono block ${
                    isDarkMode ? 'text-navy-300' : 'text-navy-900'
                  }`}>
                    Academic Administration Remarks
                  </span>
                  {selectedTicket.remarks ? (
                    <p className="italic font-medium text-slate-800 dark:text-slate-200">"{selectedTicket.remarks}"</p>
                  ) : (
                    <p className="text-slate-400 italic">No administrative feedback has been appended to this ticket yet.</p>
                  )}
                  {selectedTicket.resolvedAt && (
                    <span className="text-[10px] text-slate-400 block pt-1 font-mono tabular-nums">
                      Cleared: {new Date(selectedTicket.resolvedAt).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Reopen Action Panel */}
                {(selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') && (
                  <div className={`p-4 rounded-lg border mt-4 text-xs space-y-3 ${
                    isDarkMode ? 'bg-rose-950/20 border-rose-950/50' : 'bg-rose-50/50 border-rose-200'
                  }`}>
                    <span className={`font-bold uppercase text-[10px] tracking-wider font-mono block ${
                      isDarkMode ? 'text-rose-300' : 'text-rose-800'
                    }`}>
                      Reopen Resolved Ticket
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      If the issue is still unresolved or the corrective action was insufficient, you may reopen this ticket for further departmental attention.
                    </p>
                    
                    {reopenError && (
                      <div className="text-[11px] text-rose-600 font-medium">{reopenError}</div>
                    )}
                    {reopenSuccess && (
                      <div className="text-[11px] text-emerald-600 font-medium">{reopenSuccess}</div>
                    )}

                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        required
                        placeholder="Provide a clear, detailed reason for reopening (minimum 5 characters)..."
                        value={reopenRemarks}
                        onChange={(e) => {
                          setReopenRemarks(e.target.value);
                          setReopenError('');
                          setReopenSuccess('');
                        }}
                        className={`w-full text-xs p-2.5 rounded-lg border focus:outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-charcoal-950 border-charcoal-800 text-slate-100 focus:border-rose-700' 
                            : 'bg-white border-paper-300 text-slate-800 focus:border-rose-500'
                        }`}
                      />
                      <button
                        type="button"
                        disabled={isReopening}
                        onClick={() => handleReopenTicket(selectedTicket.id, reopenRemarks)}
                        className={`py-2 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider text-white transition-all cursor-pointer ${
                          isReopening 
                            ? 'bg-rose-400 cursor-not-allowed' 
                            : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-xs'
                        }`}
                      >
                        {isReopening ? 'Reopening...' : 'Reopen Ticket'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>

        {/* Department Directory Section */}
        <div id="student-directory-card" className={`rounded-xl border p-6 space-y-5 shadow-xs transition-colors ${
          isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
        }`}>
          <div className={`border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider font-mono ${
                  isDarkMode ? 'text-gold-400' : 'text-navy-700'
                }`}>
                  Campus Directory
                </span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {localDepartments.length} Desks Active
                </span>
              </div>
              <h2 className={`text-lg font-bold tracking-tight mt-0.5 flex items-center gap-2 ${
                isDarkMode ? 'text-white' : 'text-navy-950'
              }`}>
                <ShieldCheck className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-navy-900'}`} />
                Institutional Department Desk Directory
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Direct desk contacts and sub-department coordinators for academic and campus facilities.
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              Live Registry Synced
            </span>
          </div>

          {/* Department Directory Search Bar */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search departments or sub-departments..."
              value={deptSearchQuery}
              onChange={(e) => setDeptSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-14 py-2.5 text-xs rounded-lg border transition-all outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                isDarkMode 
                  ? 'bg-charcoal-950/60 border-charcoal-800 text-white focus:border-gold-400' 
                  : 'bg-paper-50 border-paper-300 text-slate-800 focus:border-navy-900'
              }`}
            />
            {deptSearchQuery && (
              <button
                onClick={() => setDeptSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {localDepartments.filter((dept) => {
              if (!deptSearchQuery.trim()) return true;
              const query = deptSearchQuery.toLowerCase().trim();
              
              const mainMatches = 
                dept.name.toLowerCase().includes(query) ||
                (dept.head && dept.head.toLowerCase().includes(query)) ||
                (dept.officialEmail && dept.officialEmail.toLowerCase().includes(query)) ||
                (dept.officialPhone && dept.officialPhone.toLowerCase().includes(query));
                
              if (mainMatches) return true;

              const deptSubs = subDepartments.filter(sub => sub.departmentKey === dept.key);
              const subMatches = deptSubs.some(sub => 
                sub.name.toLowerCase().includes(query) ||
                (sub.headName && sub.headName.toLowerCase().includes(query)) ||
                (sub.officialEmail && sub.officialEmail.toLowerCase().includes(query)) ||
                (sub.contactNumber && sub.contactNumber.toLowerCase().includes(query)) ||
                (sub.officeLocation && sub.officeLocation.toLowerCase().includes(query))
              );

              return subMatches;
            }).map((dept) => {
              const deptSubs = subDepartments.filter(sub => sub.departmentKey === dept.key);
              const hasSubs = deptSubs.length > 0;
              const isExpanded = !!expandedDepts[dept.key];

              return (
                <div 
                  key={dept.key} 
                  className={`p-5 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                    isDarkMode 
                      ? 'bg-charcoal-950/60 border-charcoal-800 hover:border-charcoal-700' 
                      : 'bg-paper-50 border-paper-250 hover:border-paper-300'
                  }`}
                >
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between border-b pb-2.5 ${
                      isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
                    }`}>
                      <div className="flex items-center gap-2 truncate">
                        {dept.logo && (
                          <img src={dept.logo} alt="" className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                        )}
                        <h3 className={`font-semibold text-xs uppercase tracking-tight truncate ${
                          isDarkMode ? 'text-white' : 'text-navy-950'
                        }`} title={dept.name}>
                          {dept.name}
                        </h3>
                      </div>
                      {hasSubs && (
                        <button
                          onClick={() => setExpandedDepts(prev => ({ ...prev, [dept.key]: !prev[dept.key] }))}
                          className={`p-1 hover:bg-slate-200 dark:hover:bg-charcoal-800 transition-colors rounded ${
                            isDarkMode ? 'text-gold-400' : 'text-navy-900'
                          }`}
                          title={isExpanded ? 'Collapse Sub-Departments' : 'Expand Sub-Departments'}
                          aria-label={`Toggle sub-departments for ${dept.name}`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Head: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>{dept.head || 'N/A'}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">Email: <a href={`mailto:${dept.officialEmail}`} className={`font-medium hover:underline select-all ${
                          isDarkMode ? 'text-gold-400' : 'text-navy-900'
                        }`}>{dept.officialEmail}</a></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>Contact: <a href={`tel:${dept.officialPhone}`} className={`font-medium hover:underline font-mono ${
                          isDarkMode ? 'text-gold-400' : 'text-navy-900'
                        }`}>{dept.officialPhone}</a></span>
                      </div>
                    </div>
                  </div>

                  {hasSubs && (
                    <div className={`pt-2.5 border-t mt-2.5 ${isDarkMode ? 'border-charcoal-800' : 'border-paper-200'}`}>
                      <button
                        onClick={() => setExpandedDepts(prev => ({ ...prev, [dept.key]: !prev[dept.key] }))}
                        className={`w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider py-1.5 px-2.5 rounded-lg transition-all ${
                          isDarkMode 
                            ? 'bg-charcoal-900 hover:bg-charcoal-800 text-gold-400' 
                            : 'bg-white hover:bg-paper-100 text-navy-900 border border-paper-200'
                        }`}
                      >
                        <span>{isExpanded ? 'Hide Sub-Departments' : `View Sub-Departments (${deptSubs.length})`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className={`space-y-2 mt-3 pt-3 border-t border-dashed ${
                          isDarkMode ? 'border-charcoal-800' : 'border-paper-250'
                        }`}>
                          <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400 block mb-1">
                            Units Under {dept.name}
                          </span>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {deptSubs.map((sub) => {
                              // Check if this sub-department matches the active search query to highlight it
                              const isMatched = deptSearchQuery.trim() !== '' && (
                                sub.name.toLowerCase().includes(deptSearchQuery.toLowerCase().trim()) ||
                                (sub.headName && sub.headName.toLowerCase().includes(deptSearchQuery.toLowerCase().trim())) ||
                                (sub.officialEmail && sub.officialEmail.toLowerCase().includes(deptSearchQuery.toLowerCase().trim())) ||
                                (sub.contactNumber && sub.contactNumber.toLowerCase().includes(deptSearchQuery.toLowerCase().trim())) ||
                                (sub.officeLocation && sub.officeLocation.toLowerCase().includes(deptSearchQuery.toLowerCase().trim()))
                              );

                              return (
                                <div 
                                  key={sub.id} 
                                  className={`p-2.5 rounded-lg border transition-all space-y-1.5 ${
                                    isMatched
                                      ? isDarkMode
                                        ? 'border-gold-400 bg-gold-950/20 ring-1 ring-gold-400/30'
                                        : 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/20'
                                      : isDarkMode
                                        ? 'bg-charcoal-900/60 border-charcoal-800'
                                        : 'bg-white border-paper-200'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className={`font-semibold text-xs tracking-tight ${
                                      isMatched 
                                        ? isDarkMode ? 'text-gold-400' : 'text-blue-900' 
                                        : isDarkMode ? 'text-slate-100' : 'text-slate-900'
                                    }`}>
                                      {sub.name}
                                    </h4>
                                    <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded border font-mono tracking-wider shrink-0 ${
                                      sub.status === 'active'
                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-800'
                                        : 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/20 dark:border-rose-800'
                                    }`}>
                                      {sub.status === 'active' ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>

                                  {sub.description && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                      {sub.description}
                                    </p>
                                  )}

                                  <div className="grid grid-cols-1 gap-y-1 text-[11px] mt-1 pt-1 border-t border-slate-100 dark:border-charcoal-800">
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                      <span className="truncate">Coordinator: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{sub.headName || 'N/A'}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                                      <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                      <span className="truncate">
                                        Email: <a href={`mailto:${sub.officialEmail}`} className={`font-medium hover:underline ${isDarkMode ? 'text-gold-400' : 'text-navy-900'}`}>{sub.officialEmail}</a>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                      <span className="truncate">
                                        Phone: <a href={`tel:${sub.contactNumber}`} className={`font-medium hover:underline font-mono ${isDarkMode ? 'text-gold-400' : 'text-navy-900'}`}>{sub.contactNumber}</a>
                                      </span>
                                    </div>
                                    {sub.officeLocation && (
                                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                        <span className="truncate">Office: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{sub.officeLocation}</strong></span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {localDepartments.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-slate-400 font-mono">
                No active departments configured for this institution.
              </div>
            )}
            {localDepartments.length > 0 && localDepartments.filter((dept) => {
              if (!deptSearchQuery.trim()) return true;
              const query = deptSearchQuery.toLowerCase().trim();
              
              const mainMatches = 
                dept.name.toLowerCase().includes(query) ||
                (dept.head && dept.head.toLowerCase().includes(query)) ||
                (dept.officialEmail && dept.officialEmail.toLowerCase().includes(query)) ||
                (dept.officialPhone && dept.officialPhone.toLowerCase().includes(query));
                
              if (mainMatches) return true;

              const deptSubs = subDepartments.filter(sub => sub.departmentKey === dept.key);
              const subMatches = deptSubs.some(sub => 
                sub.name.toLowerCase().includes(query) ||
                (sub.headName && sub.headName.toLowerCase().includes(query)) ||
                (sub.officialEmail && sub.officialEmail.toLowerCase().includes(query)) ||
                (sub.contactNumber && sub.contactNumber.toLowerCase().includes(query)) ||
                (sub.officeLocation && sub.officeLocation.toLowerCase().includes(query))
              );

              return subMatches;
            }).length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-charcoal-400 font-medium">
                No departments or sub-departments match your search criteria.
              </div>
            )}
          </div>
        </div>

      </main>

      <ImageViewer src={activeViewerImage} onClose={() => setActiveViewerImage(null)} />
    </div>
  );
}
