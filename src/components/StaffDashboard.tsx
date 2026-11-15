import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Calendar, ClipboardCheck, MessageSquare, 
  UserCheck, Phone, Mail, Clock, CheckCircle2, HelpCircle, 
  AlertTriangle, Eye, ShieldAlert, Check, RefreshCw, Paperclip, 
  User, Activity, ArrowRight, ShieldCheck, Download, AlertCircle,
  XCircle, CheckSquare, X, Megaphone, Pin, Archive, EyeOff, Trash2, Plus
} from 'lucide-react';
import { Department, HelpComplaintRequest } from '../types';
import { ImageViewer } from './ImageViewer';
import { AnnouncementAttachmentField } from './AnnouncementAttachmentField';
import { PendingAnnouncementFile, downloadAnnouncementAttachment } from '../utils/announcementAttachment';
import { apiFetch } from '../utils/csrf';

interface StaffDashboardProps {
  user: any;
  departments: Department[];
  token: string;
  isDarkMode: boolean;
  externalActiveTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenProfileModal?: () => void;
}

export default function StaffDashboard({ 
  user, 
  departments, 
  token, 
  isDarkMode,
  externalActiveTab,
  onTabChange,
  onOpenProfileModal
}: StaffDashboardProps) {
  const [tickets, setTickets] = useState<HelpComplaintRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [subDeptFilter, setSubDeptFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'complaints' | 'help' | 'announcements'>('complaints');

  // Synchronize sidebar navigation changes
  useEffect(() => {
    if (!externalActiveTab) return;
    if (externalActiveTab === 'complaints' || externalActiveTab === 'help' || externalActiveTab === 'announcements') {
      setActiveTab(externalActiveTab);
      setSelectedTicket(null);
    } else if (externalActiveTab === 'department-info') {
      const el = document.getElementById('department-dossier-card');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (externalActiveTab === 'export-report') {
      const btn = document.getElementById('export-analytical-report-btn');
      if (btn) btn.click();
    } else if (externalActiveTab === 'my-profile') {
      onOpenProfileModal?.();
    }
  }, [externalActiveTab, onOpenProfileModal]);

  const fetchSubDepartments = async () => {
    try {
      const deptKey = user?.departmentKey || '';
      const url = deptKey ? `/api/subdepartments?departmentKey=${deptKey}` : '/api/subdepartments';
      const res = await fetch(url, {
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
  
  // Selected Ticket for resolution process
  const [selectedTicket, setSelectedTicket] = useState<HelpComplaintRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusSuccess, setStatusSuccess] = useState('');
  const [updating, setUpdating] = useState(false);

  // Dynamic MongoDB departments local state
  const [localDepartments, setLocalDepartments] = useState<Department[]>(departments);

  // Active full screen image viewer state
  const [activeViewerImage, setActiveViewerImage] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  
  // Create/Edit form states for department
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState<any | null>(null);
  const [annFormTitle, setAnnFormTitle] = useState('');
  const [annFormDesc, setAnnFormDesc] = useState('');
  const [annFormCat, setAnnFormCat] = useState('Academic');
  const [annFormPri, setAnnFormPri] = useState('Medium');
  const [annFormPubDate, setAnnFormPubDate] = useState(new Date().toISOString().slice(0, 10));
  const [annFormExpDate, setAnnFormExpDate] = useState('');
  const [annFormAttach, setAnnFormAttach] = useState('');
  const [annPendingFile, setAnnPendingFile] = useState<PendingAnnouncementFile | null>(null);
  const [annRemoveAttach, setAnnRemoveAttach] = useState(false);
  const [annFormNotifyStud, setAnnFormNotifyStud] = useState(true);
  const [annFormNotifyStaff, setAnnFormNotifyStaff] = useState(true);
  const [annFormPublished, setAnnFormPublished] = useState(true);
  const [annFormPinned, setAnnFormPinned] = useState(false);
  const [annError, setAnnError] = useState('');
  const [annSuccess, setAnnSuccess] = useState('');

  const fetchLocalDepartments = async () => {
    try {
      const activeInstId = user?.institutionId || 'default';
      const res = await fetch(`/api/departments?institutionId=${activeInstId}`);
      if (res.ok) {
        const data = await res.json();
        setLocalDepartments(data);
      }
    } catch (err) {
      console.warn('Could not update department database.');
    }
  };

  const deptKey = user?.departmentKey || 'academic';
  const deptProfile = localDepartments.find(d => d.key === deptKey);

  const fetchAnnouncements = async () => {
    try {
      setIsAnnouncementsLoading(true);
      const res = await fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter to only this department's announcements
        setAnnouncements(data.filter((a: any) => a.departmentId === deptKey));
      }
    } catch (err) {
      console.warn('Failed to fetch announcements:', err);
    } finally {
      setIsAnnouncementsLoading(false);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAnnError('');
      setAnnSuccess('');
      const payload: any = {
        title: annFormTitle,
        description: annFormDesc,
        category: annFormCat,
        priority: annFormPri,
        publishDate: annFormPubDate ? new Date(annFormPubDate).toISOString() : new Date().toISOString(),
        expiryDate: annFormExpDate ? new Date(annFormExpDate).toISOString() : undefined,
        attachmentUrl: annPendingFile ? undefined : (annFormAttach || undefined),
        attachmentFile: annPendingFile || undefined,
        removeAttachment: annRemoveAttach || undefined,
        targetAudience: 'selected_departments',
        targetDepartments: [deptKey],
        departmentId: deptKey, // Scoped to this department
        notifyStudents: annFormNotifyStud,
        notifyStaff: annFormNotifyStaff,
        isPublished: annFormPublished,
        isPinned: annFormPinned,
      };

      const isEditing = isEditingAnnouncement && isEditingAnnouncement.id;
      const url = isEditing ? `/api/announcements/${isEditingAnnouncement.id}` : '/api/announcements';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save announcement.');
      }

      setAnnSuccess(isEditing ? 'Announcement updated successfully!' : 'Announcement published successfully!');
      
      // Reset form states
      setIsEditingAnnouncement(null);
      setAnnFormTitle('');
      setAnnFormDesc('');
      setAnnFormCat('Academic');
      setAnnFormPri('Medium');
      setAnnFormPubDate(new Date().toISOString().slice(0, 10));
      setAnnFormExpDate('');
      setAnnFormAttach('');
      setAnnPendingFile(null);
      setAnnRemoveAttach(false);
      setAnnFormNotifyStud(true);
      setAnnFormNotifyStaff(true);
      setAnnFormPublished(true);
      setAnnFormPinned(false);

      fetchAnnouncements();
    } catch (err: any) {
      setAnnError(err.message || 'Error saving announcement.');
    }
  };

  const handleToggleAnnouncementState = async (id: string, field: 'isPublished' | 'isPinned' | 'isArchived') => {
    try {
      setAnnError('');
      setAnnSuccess('');
      const res = await apiFetch(`/api/announcements/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ field })
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to toggle status.');
      }
      fetchAnnouncements();
      setAnnSuccess(`Successfully updated state of announcement "${resData.title}".`);
    } catch (err: any) {
      setAnnError(err.message || 'Error updating status.');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      setAnnError('');
      setAnnSuccess('');
      const res = await apiFetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to delete announcement.');
      }
      fetchAnnouncements();
      setAnnSuccess('Announcement deleted successfully.');
    } catch (err: any) {
      setAnnError(err.message || 'Error deleting announcement.');
    }
  };

  const handleStartEditAnnouncement = (ann: any) => {
    setIsEditingAnnouncement(ann);
    setAnnFormTitle(ann.title);
    setAnnFormDesc(ann.description);
    setAnnFormCat(ann.category);
    setAnnFormPri(ann.priority ? ann.priority.charAt(0).toUpperCase() + ann.priority.slice(1) : 'Medium');
    setAnnFormPubDate(ann.publishDate ? new Date(ann.publishDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setAnnFormExpDate(ann.expiryDate ? new Date(ann.expiryDate).toISOString().slice(0, 10) : '');
    setAnnFormAttach(ann.attachmentUrl || '');
    setAnnPendingFile(null);
    setAnnRemoveAttach(false);
    setAnnFormNotifyStud(ann.notifyStudents !== undefined ? ann.notifyStudents : true);
    setAnnFormNotifyStaff(ann.notifyStaff !== undefined ? ann.notifyStaff : true);
    setAnnFormPublished(ann.isPublished !== undefined ? ann.isPublished : true);
    setAnnFormPinned(ann.isPinned !== undefined ? ann.isPinned : false);
    setActiveTab('announcements');
  };

  const handleStartCreateAnnouncement = () => {
    setIsEditingAnnouncement({ id: null }); // trigger create view
    setAnnFormTitle('');
    setAnnFormDesc('');
    setAnnFormCat('Academic');
    setAnnFormPri('Medium');
    setAnnFormPubDate(new Date().toISOString().slice(0, 10));
    setAnnFormExpDate('');
    setAnnFormAttach('');
    setAnnPendingFile(null);
    setAnnRemoveAttach(false);
    setAnnFormNotifyStud(true);
    setAnnFormNotifyStaff(true);
    setAnnFormPublished(true);
    setAnnFormPinned(false);
  };

  useEffect(() => {
    fetchDepartmentTickets(false);
    fetchLocalDepartments();
    fetchAnnouncements();
    fetchSubDepartments();
    const intervalId = setInterval(() => {
      fetchDepartmentTickets(true);
      fetchLocalDepartments();
      fetchAnnouncements();
      fetchSubDepartments();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [token]);

  const fetchDepartmentTickets = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const url = new URL('/api/requests', window.location.origin);
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
        
        // Sync currently opened ticket details by pulling directly to bypass active status filter exclusions
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
    } catch (error) {
      console.warn('Could not load department logs:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const executeStatusChange = async (targetStatus: string, requireRemarks: boolean = false) => {
    if (!selectedTicket) return;
    
    if (requireRemarks && !remarks.trim()) {
      setStatusError('Officer remarks/reason are mandatory for this action.');
      return;
    }

    try {
      setUpdating(true);
      setStatusError('');
      setStatusSuccess('');

      const res = await apiFetch(`/api/requests/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: targetStatus,
          remarks: remarks
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket status.');
      }

      setStatusSuccess(`Grievance [${selectedTicket.id}] marked as [${targetStatus.toUpperCase()}] successfully.`);
      setSelectedTicket(data);
      fetchDepartmentTickets();
    } catch (err: any) {
      setStatusError(err.message || 'Error updating status details.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddRemarksOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    if (!remarks.trim()) {
      setStatusError('Remarks field cannot be empty.');
      return;
    }

    try {
      setUpdating(true);
      setStatusError('');
      setStatusSuccess('');

      const res = await apiFetch(`/api/requests/${selectedTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: selectedTicket.status,
          remarks: remarks
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to append remarks.');
      }

      setStatusSuccess(`Successfully updated remarks for ticket [${selectedTicket.id}].`);
      setSelectedTicket(data);
      fetchDepartmentTickets();
    } catch (err: any) {
      setStatusError(err.message || 'Error saving remarks.');
    } finally {
      setUpdating(false);
    }
  };

  const loadTicketDetails = (ticket: HelpComplaintRequest) => {
    setSelectedTicket(ticket);
    setRemarks(ticket.remarks || '');
    setStatusError('');
    setStatusSuccess('');
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-800 border-yellow-250';
      case 'assigned': return 'bg-indigo-50 text-indigo-800 border-indigo-250';
      case 'under_review': return 'bg-sky-50 text-sky-805 text-sky-800 border-sky-200';
      case 'in_progress': return 'bg-blue-50 text-blue-800 border-blue-250';
      case 'resolved': return 'bg-emerald-50 text-emerald-800 border-emerald-250';
      case 'rejected': return 'bg-rose-50 text-rose-800 border-rose-250';
      case 'closed': return 'bg-slate-100 text-slate-800 border-slate-350';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Live db stats linked to the fetched request logs
  const subDeptFilteredTickets = subDeptFilter === ''
    ? tickets
    : tickets.filter(t => t.subDepartmentId === subDeptFilter);

  const pendingCount = subDeptFilteredTickets.filter(t => t.status === 'pending').length;
  const assignedCount = subDeptFilteredTickets.filter(t => t.status === 'assigned').length;
  const progressCount = subDeptFilteredTickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = subDeptFilteredTickets.filter(t => t.status === 'resolved').length;
  const rejectedCount = subDeptFilteredTickets.filter(t => t.status === 'rejected').length;

  const totalComplaints = subDeptFilteredTickets.filter(t => t.requestType === 'complaint');
  const totalHelpRequests = subDeptFilteredTickets.filter(t => t.requestType === 'help');

  // Search filter
  const applyFilters = (list: HelpComplaintRequest[]) => {
    return list.filter(t => {
      const matchSearch = search.trim() === '' || 
        t.studentName.toLowerCase().includes(search.toLowerCase()) ||
        t.enrollmentNumber.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());
        
      const matchStatus = statusFilter === '' || t.status === statusFilter;
      const matchSubDept = subDeptFilter === '' || t.subDepartmentId === subDeptFilter;
      return matchSearch && matchStatus && matchSubDept;
    });
  };

  const filteredComplaints = applyFilters(totalComplaints);
  const filteredHelpRequests = applyFilters(totalHelpRequests);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>

      
      {/* Official Header bar */}
      <div className={`border-b py-6 px-4 sm:px-6 lg:px-8 transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs backdrop-blur-xs'}`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Official Coordinator Desk</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold py-0.5 px-2 rounded-md uppercase font-mono border border-blue-200 dark:border-blue-900">
                {deptKey.toUpperCase()} DESK
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              {deptProfile?.name || `${deptKey.toUpperCase()} Department`} Portal
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Active Coordinator: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{user?.name}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Department Verified</span>
            </p>
          </div>

          {/* Department Information Card */}
          <div className={`p-4 border rounded-xl max-w-sm w-full lg:w-80 shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
            <div className="border-b pb-2 mb-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-blue-400' : 'text-blue-900'}`}>Department Contact</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800 rounded-md font-mono uppercase">ONLINE</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className={`font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{deptProfile?.name || `${deptKey.toUpperCase()} Department`}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between"><span className="text-slate-400">Head:</span> <strong className={`font-sans font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{deptProfile?.head || 'N/A'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Email:</span> <strong className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{deptProfile?.officialEmail || 'N/A'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-400">Phone:</span> <strong className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{deptProfile?.officialPhone || 'N/A'}</strong></div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={() => fetchDepartmentTickets(false)}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Queue
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Department Profile and Operational Statistics */}
        <div id="department-dossier-card" className={`p-6 border rounded-xl shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-5 border-slate-100 dark:border-slate-800 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900 inline-block">
                Department Dossier Profile
              </span>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-1.5">
                {deptProfile?.name || `${deptKey.toUpperCase()} Department`}
              </h2>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Department Code: <span className="font-bold text-blue-600 dark:text-blue-400">{deptKey.toUpperCase()}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1">
              <span className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-bold block">Department Head</span>
              <div className="flex items-center gap-2 text-xs">
                <User className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">{deptProfile?.head || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-bold block">Official Email</span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="select-all text-slate-800 dark:text-slate-200">{deptProfile?.officialEmail || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-bold block">Official Contact</span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800 dark:text-slate-200">{deptProfile?.officialPhone || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] uppercase text-slate-400 dark:text-slate-500 font-bold block">Workload Summary</span>
              <div className="text-xs flex flex-wrap gap-2">
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 tabular-nums">
                  Total: {tickets.length}
                </span>
                <span className="font-mono bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-900 tabular-nums">
                  Pending: {pendingCount}
                </span>
                <span className="font-mono bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-900 tabular-nums">
                  Resolved: {resolvedCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Sub-Department Filter Control */}
        {subDepartments.length > 0 && (
          <div className={`p-5 border rounded-xl shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-300">
                  Sub-Department Scope
                </span>
              </div>
              {subDeptFilter && (
                <button
                  onClick={() => setSubDeptFilter('')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear Scope (Show All)
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSubDeptFilter('')}
                className={`py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  subDeptFilter === ''
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDarkMode
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Scope ({tickets.length})
              </button>
              {subDepartments.map((sub) => {
                const count = tickets.filter(t => t.subDepartmentId === sub.id).length;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSubDeptFilter(sub.id)}
                    className={`py-2 px-3.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      subDeptFilter === sub.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isDarkMode
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sub.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Analytics & Charts for Selected Sub-Department */}
        <div className={`p-6 border rounded-xl shadow-xs ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-900 inline-block">
                Sub-Department Analytics
              </span>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white mt-1.5">
                {subDeptFilter === '' ? 'All Sub-Departments' : subDepartments.find(s => s.id === subDeptFilter)?.name || 'Filtered'} Performance Index
              </h3>
            </div>
            {/* Export Report Button */}
            <button
              onClick={() => {
                const selectedSubName = subDeptFilter === '' ? 'All' : subDepartments.find(s => s.id === subDeptFilter)?.name || 'Filtered';
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Grievance Report - ${selectedSubName}</title>
                        <style>
                          body { font-family: monospace; padding: 40px; color: #1e293b; }
                          h1 { border-bottom: 2px solid #0f172a; padding-bottom: 10px; font-size: 20px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
                          th { background-color: #f1f5f9; }
                          .meta { margin-bottom: 20px; font-size: 11px; color: #64748b; line-height: 1.6; }
                        </style>
                      </head>
                      <body>
                        <h1>GRIEVANCE RESOLUTION REPORT</h1>
                        <div class="meta">
                          Department: ${deptProfile?.name || deptKey.toUpperCase()}<br/>
                          Sub-Department Focus: ${selectedSubName}<br/>
                          Generated On: ${new Date().toLocaleString()}<br/>
                          Total Logged Records: ${subDeptFilteredTickets.length}
                        </div>
                        <h3>WORKLOAD DISTRIBUTION</h3>
                        <ul>
                          <li>Pending: ${pendingCount}</li>
                          <li>Assigned/Routed: ${assignedCount}</li>
                          <li>In Progress: ${progressCount}</li>
                          <li>Resolved: ${resolvedCount}</li>
                          <li>Rejected: ${rejectedCount}</li>
                        </ul>
                        <h3>DETAILED RECORD LEDGER</h3>
                        <table>
                          <thead>
                            <tr>
                              <th>TICKET ID</th>
                              <th>STUDENT</th>
                              <th>ENROLLMENT</th>
                              <th>SUBJECT</th>
                              <th>SUB-DEPT</th>
                              <th>STATUS</th>
                              <th>DATE</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${subDeptFilteredTickets.map(t => `
                              <tr>
                                <td>${t.id}</td>
                                <td>${t.studentName}</td>
                                <td>${t.enrollmentNumber}</td>
                                <td>${t.subject}</td>
                                <td>${t.subDepartmentName || 'Main'}</td>
                                <td>${t.status.toUpperCase()}</td>
                                <td>${new Date(t.createdAt).toLocaleDateString()}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <script>window.print();</script>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }
              }}
              id="export-analytical-report-btn"
              className="py-1.5 px-3 bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer border border-slate-950 transition-colors"
            >
              <Download className="w-3 h-3" />
              Generate Analytical Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Chart 1: Status Distribution Bar Chart (Custom SVG) */}
            <div className="bg-slate-50 p-4 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-3">Status Breakdown</span>
              {(() => {
                const maxVal = Math.max(pendingCount, assignedCount, progressCount, resolvedCount, rejectedCount, 1);
                const stats = [
                  { label: 'Pending', count: pendingCount, color: 'bg-yellow-500' },
                  { label: 'Assigned', count: assignedCount, color: 'bg-indigo-500' },
                  { label: 'In Progress', count: progressCount, color: 'bg-blue-600' },
                  { label: 'Resolved', count: resolvedCount, color: 'bg-emerald-600' },
                  { label: 'Rejected', count: rejectedCount, color: 'bg-rose-500' },
                ];
                return (
                  <div className="space-y-3">
                    {stats.map(s => {
                      const pct = (s.count / maxVal) * 100;
                      return (
                        <div key={s.label} className="text-xs">
                          <div className="flex justify-between items-center mb-1 text-slate-600">
                            <span className="font-semibold">{s.label}</span>
                            <span className="font-mono font-bold">{s.count}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-none overflow-hidden">
                            <div className={`h-full ${s.color}`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Chart 2: Grievance vs Help Request ratio */}
            <div className="bg-slate-50 p-4 border border-slate-200 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-2">Category Ratio</span>
              <div className="flex justify-center items-center py-4">
                {(() => {
                  const total = subDeptFilteredTickets.length || 1;
                  const complaintsPct = Math.round((totalComplaints.length / total) * 100);
                  const helpPct = 100 - complaintsPct;
                  const radius = 24;
                  const circ = 2 * Math.PI * radius;
                  const strokeDash = (complaintsPct / 100) * circ;

                  return (
                    <div className="flex items-center gap-4">
                      <svg width="60" height="60" viewBox="0 0 60 60" className="transform -rotate-90">
                        <circle cx="30" cy="30" r={radius} fill="none" stroke="#0ea5e9" strokeWidth="8" />
                        <circle cx="30" cy="30" r={radius} fill="none" stroke="#dc2626" strokeWidth="8"
                          strokeDasharray={`${strokeDash} ${circ}`} />
                      </svg>
                      <div className="space-y-1 font-mono text-[9px] text-slate-600">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-rose-600 inline-block"></span>
                          <span>Grievance ({complaintsPct}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-sky-500 inline-block"></span>
                          <span>Help ({helpPct}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <span className="text-[9.5px] text-slate-400 block font-mono text-center">Relative type distribution</span>
            </div>

            {/* Analytics: Resolution & Quality Indicators */}
            <div className="bg-slate-50 p-4 border border-slate-200 space-y-4">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Quality KPIs</span>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-3 border border-slate-150">
                  <span className="text-slate-400 text-[9px] block uppercase font-bold">Clearance Rate</span>
                  <span className="text-xl font-black text-slate-800">
                    {subDeptFilteredTickets.length > 0 
                      ? `${Math.round((resolvedCount / subDeptFilteredTickets.length) * 100)}%` 
                      : '100%'}
                  </span>
                </div>
                <div className="bg-white p-3 border border-slate-150">
                  <span className="text-slate-400 text-[9px] block uppercase font-bold">Response Index</span>
                  <span className="text-xl font-black text-blue-900">
                    {subDeptFilteredTickets.length > 0 
                      ? (pendingCount === 0 ? 'Optimal' : 'Active') 
                      : 'Optimal'}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono italic">
                Performance indicators scaled dynamically for current scope focus.
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Linked Stats Counters Block */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">New Pending</span>
              <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-semibold font-mono border border-amber-200 dark:border-amber-900 rounded-md">NEW</span>
            </div>
            <div className="pt-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">{pendingCount}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Awaiting triage</p>
            </div>
          </div>

          <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Assigned</span>
              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 font-semibold font-mono border border-indigo-200 dark:border-indigo-900 rounded-md">ROUTED</span>
            </div>
            <div className="pt-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">{assignedCount}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Routed to staff</p>
            </div>
          </div>

          <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">In Progress</span>
              <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-semibold font-mono border border-blue-200 dark:border-blue-900 rounded-md">ACTIVE</span>
            </div>
            <div className="pt-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">{progressCount}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Under processing</p>
            </div>
          </div>

          <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Resolved</span>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-semibold font-mono border border-emerald-200 dark:border-emerald-900 rounded-md">SOLVED</span>
            </div>
            <div className="pt-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">{resolvedCount}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Cleared cases</p>
            </div>
          </div>

          <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 col-span-2 sm:col-span-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Rejected</span>
              <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-semibold font-mono border border-rose-200 dark:border-rose-900 rounded-md">REJECTED</span>
            </div>
            <div className="pt-2">
              <span className="text-2xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">{rejectedCount}</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Invalid submissions</p>
            </div>
          </div>
        </div>

        {/* Filters and Tab Selection workspace */}
        <div className="space-y-4">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            {/* Table switching tabs */}
            <div className={`inline-flex p-1 rounded-xl border font-sans text-xs select-none gap-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              <button
                onClick={() => { setActiveTab('complaints'); setSelectedTicket(null); }}
                className={`py-2 px-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'complaints'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Complaints</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-700 tabular-nums">
                  {totalComplaints.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('help'); setSelectedTicket(null); }}
                className={`py-2 px-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'help'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Help Requests</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-700 tabular-nums">
                  {totalHelpRequests.length}
                </span>
              </button>
              <button
                onClick={() => { setActiveTab('announcements'); setSelectedTicket(null); }}
                className={`py-2 px-3.5 rounded-lg font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'announcements'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Noticeboard</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-700 tabular-nums">
                  {announcements.length}
                </span>
              </button>
            </div>

            {/* In-table filters */}
            {activeTab !== 'announcements' && (
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 md:w-64">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search name, enrollment, subject..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full text-xs py-2 pl-9 pr-3 border rounded-lg shadow-xs outline-none transition-colors focus:ring-2 focus:ring-blue-500/20 ${
                      isDarkMode 
                        ? 'border-slate-800 bg-slate-900 text-white placeholder-slate-500' 
                        : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'
                    }`}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`text-xs py-2 px-3 border rounded-lg shadow-xs outline-none cursor-pointer transition-colors ${
                    isDarkMode 
                      ? 'border-slate-800 bg-slate-900 text-slate-300' 
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>

                {subDepartments.length > 0 && (
                  <select
                    value={subDeptFilter}
                    onChange={(e) => setSubDeptFilter(e.target.value)}
                    className={`text-xs py-2 px-3 border rounded-lg shadow-xs outline-none cursor-pointer transition-colors ${
                      isDarkMode 
                        ? 'border-slate-800 bg-slate-900 text-slate-300' 
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <option value="">All Sub-Departments</option>
                    {subDepartments.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Master Queue Layout grid */}
          {activeTab !== 'announcements' ? (
            <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Table View Component */}
            <div className={`lg:col-span-8 border rounded-xl overflow-hidden shadow-xs transition-colors ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b font-semibold uppercase tracking-wider text-[11px] ${
                      isDarkMode ? 'bg-slate-950/60 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      <th className="py-3 px-4">Ticket ID</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Enrollment</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/80 text-slate-300' : 'divide-slate-100 text-slate-800'}`}>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400 font-medium font-mono">Syncing queue records...</td>
                      </tr>
                    ) : (activeTab === 'complaints' ? filteredComplaints : filteredHelpRequests).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400">
                          <ClipboardCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                          <p className="font-bold text-slate-700 dark:text-slate-300 tracking-wider">Queue is clear</p>
                          <p className="text-xs text-slate-400 mt-0.5">No entries match your search criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'complaints' ? filteredComplaints : filteredHelpRequests).map((t) => (
                        <tr 
                          key={t.id} 
                          onClick={() => loadTicketDetails(t)}
                          className={`cursor-pointer transition-colors ${
                            selectedTicket?.id === t.id 
                              ? isDarkMode ? 'bg-blue-950/40 font-medium' : 'bg-blue-50/70 font-medium'
                              : isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">{t.id}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{t.studentName}</td>
                          <td className="py-3.5 px-4 font-mono uppercase text-slate-500 dark:text-slate-400">{t.enrollmentNumber}</td>
                          <td className="py-3.5 px-4 truncate max-w-[150px]" title={t.subject}>{t.subject}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                            {t.departmentKey}
                            {t.subDepartmentName ? ` › ${t.subDepartmentName}` : ''}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 tabular-nums">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[10px] uppercase font-semibold py-0.5 px-2 rounded-md border leading-none tracking-wide ${getStatusStyle(t.status)}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Process →</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Details Card */}
            <div className="lg:col-span-4">
              {selectedTicket ? (
                <div className={`p-6 border rounded-xl shadow-xs space-y-5 transition-colors ${
                  isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  
                  {/* Card head details */}
                  <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Ticket Processing</span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5" id="ticket-title-label">{selectedTicket.subject}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 font-mono text-[11px] text-slate-400">
                        <span>ID: {selectedTicket.id}</span>
                        {selectedTicket.subDepartmentName && (
                          <>
                            <span>•</span>
                            <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 uppercase font-semibold text-[10px] rounded-sm">
                              {selectedTicket.subDepartmentName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedTicket(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Student contact block */}
                  <div className={`p-4 border rounded-lg space-y-2.5 ${
                    isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                    <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      Student Profile
                    </h4>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">Full Name</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">{selectedTicket.studentName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">Enrollment ID</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-mono text-xs uppercase font-semibold">{selectedTicket.enrollmentNumber}</strong>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">Contact Details</span>
                        <div className="flex justify-between items-center text-[11px] flex-wrap gap-1">
                          <a href={`tel:${selectedTicket.contactNumber}`} className="text-blue-600 dark:text-blue-400 font-semibold font-mono hover:underline flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {selectedTicket.contactNumber}
                          </a>
                          <span className="text-slate-500 font-mono text-[10.5px] truncate max-w-[150px]" title={`${selectedTicket.studentId}@campusconnect.edu`}>
                            {selectedTicket.studentId}@campusconnect.edu
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Incident full statement description */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Statement Description</span>
                    <p className={`text-xs p-3 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line rounded-lg border ${
                      isDarkMode ? 'bg-slate-950/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}>
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Attachment evidence */}
                  {selectedTicket.attachments?.length ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Attached Proof</span>
                      <div className={`p-2 border rounded-lg max-w-xs ${isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <img 
                          src={selectedTicket.attachments[0]} 
                          alt="Grievance evidence" 
                          referrerPolicy="referrer"
                          className="max-h-36 rounded-md object-contain mx-auto cursor-zoom-in transition-transform hover:scale-[1.02]"
                          onClick={() => setActiveViewerImage(selectedTicket.attachments[0])}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Current Remarks Display */}
                  {selectedTicket.remarks && (
                    <div className={`p-3 rounded-lg border text-xs ${
                      isDarkMode ? 'bg-blue-950/30 border-blue-900/60 text-slate-300' : 'bg-blue-50/70 border-blue-200 text-slate-800'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider block mb-1">Coordinator Remarks</span>
                      <p className="italic font-medium">"{selectedTicket.remarks}"</p>
                    </div>
                  )}

                  {/* Core Actions resolved status handlers */}
                  <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Workflow Actions</span>

                    {statusError && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-lg flex items-center gap-1.5 leading-tight">
                        <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <span>{statusError}</span>
                      </div>
                    )}

                    {statusSuccess && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-1.5 leading-tight">
                        <CheckSquare className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>{statusSuccess}</span>
                      </div>
                    )}

                    {/* Officer Text Remarks Area */}
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 tracking-wider">Action Remarks</label>
                      <textarea
                        rows={2}
                        placeholder="Add remarks, instructions, or rejection reasons here. (Shown to student)"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className={`w-full text-xs py-2 px-3 border rounded-lg outline-none transition-colors leading-normal ${
                          isDarkMode 
                            ? 'border-slate-800 bg-slate-950 text-white placeholder-slate-500 focus:border-blue-500' 
                            : 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* Operational action button grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={updating || selectedTicket.status === 'assigned'}
                        onClick={() => executeStatusChange('assigned')}
                        className="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold text-xs rounded-lg text-center cursor-pointer transition-all disabled:opacity-40"
                        title="Route and assign internally"
                      >
                        Assign
                      </button>

                      <button
                        type="button"
                        disabled={updating || selectedTicket.status === 'in_progress'}
                        onClick={() => executeStatusChange('in_progress')}
                        className="py-2.5 px-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs rounded-lg text-center cursor-pointer transition-all disabled:opacity-40"
                        title="Accept/Move ticket into action block"
                      >
                        Accept
                      </button>

                      <button
                        type="button"
                        disabled={updating || selectedTicket.status === 'resolved'}
                        onClick={() => executeStatusChange('resolved')}
                        className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs rounded-lg text-center cursor-pointer transition-all disabled:opacity-40"
                        title="Mark case as successfully solved"
                      >
                        Resolve
                      </button>

                      <button
                        type="button"
                        disabled={updating || selectedTicket.status === 'rejected'}
                        onClick={() => executeStatusChange('rejected', true)}
                        className="py-2.5 px-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-semibold text-xs rounded-lg text-center cursor-pointer transition-all disabled:opacity-40"
                        title="Reject: Mandatory remarks are required"
                      >
                        Reject (Mnd.)
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={handleAddRemarksOnly}
                        disabled={updating}
                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-semibold text-xs rounded-lg text-center cursor-pointer transition-colors shadow-xs"
                      >
                        {updating ? 'Processing...' : 'Save Remarks Only'}
                      </button>
                    </div>

                  </div>

                </div>
              ) : (
                <div className={`border border-dashed rounded-xl p-12 text-center text-slate-400 space-y-2 transition-colors ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <Clock className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">No Ticket Selected</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">Click any row in the queue to inspect student details, attachments, and update workflow status.</p>
                </div>
              )}
            </div>

          </div>
          ) : (
            <div className="space-y-6 animate-fade-in text-xs">
              {/* Statistics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`p-4 border rounded-xl shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">Total Notices</span>
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-800 dark:text-white tabular-nums mt-1 block">{announcements.length}</span>
                </div>
                <div className={`p-4 border rounded-xl shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider">Active & Published</span>
                  <span className="text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 block">
                    {announcements.filter(a => a.isPublished && !a.isArchived).length}
                  </span>
                </div>
                <div className={`p-4 border rounded-xl shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[11px] uppercase font-bold text-amber-600 dark:text-amber-400 block tracking-wider">Pinned Alerts</span>
                  <span className="text-2xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 tabular-nums mt-1 block">
                    {announcements.filter(a => a.isPinned && !a.isArchived).length}
                  </span>
                </div>
                <div className={`p-4 border rounded-xl shadow-xs transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">Archived Notices</span>
                  <span className="text-2xl font-bold font-mono tracking-tight text-slate-500 tabular-nums mt-1 block">
                    {announcements.filter(a => a.isArchived).length}
                  </span>
                </div>
              </div>

              {/* If in Create or Edit view */}
              {isEditingAnnouncement ? (
                <form onSubmit={handleSaveAnnouncement} className={`border p-6 space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                  <div className={`border-b pb-3 flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div>
                      <h3 className={`font-extrabold text-sm uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {isEditingAnnouncement.id ? 'Modify Announcement Parameters' : 'Publish Departmental Announcement'}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Publish notice for your department: <span className="uppercase font-bold text-blue-900">{deptKey}</span>.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingAnnouncement(null)}
                      className={`py-1.5 px-3 font-bold uppercase tracking-wider cursor-pointer text-[10px] ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-150 hover:bg-slate-200 text-slate-700'}`}
                    >
                      Back to Registry
                    </button>
                  </div>

                  {annError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                      {annError}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Announcement Title</label>
                      <input
                        type="text"
                        required
                        value={annFormTitle}
                        onChange={(e) => setAnnFormTitle(e.target.value)}
                        placeholder="e.g. End Semester Exam Timetable - Fall 2026"
                        className={`w-full text-xs py-2 px-3 border outline-none font-bold ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Category</label>
                        <select
                          value={annFormCat}
                          onChange={(e) => setAnnFormCat(e.target.value)}
                          className={`w-full text-xs py-2 px-3 border outline-none cursor-pointer font-bold ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                        >
                          <option value="Academic">Academic</option>
                          <option value="Administrative">Administrative</option>
                          <option value="Hostel">Hostel</option>
                          <option value="Fee">Fee</option>
                          <option value="General">General</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Priority Level</label>
                        <select
                          value={annFormPri}
                          onChange={(e) => setAnnFormPri(e.target.value)}
                          className={`w-full text-xs py-2 px-3 border outline-none cursor-pointer font-bold ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Notice Description</label>
                    <textarea
                      required
                      rows={4}
                      value={annFormDesc}
                      onChange={(e) => setAnnFormDesc(e.target.value)}
                      placeholder="Enter the complete detailed notice content here..."
                      className={`w-full text-xs py-2 px-3 border outline-none font-medium leading-relaxed ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Publish Date</label>
                      <input
                        type="date"
                        required
                        value={annFormPubDate}
                        onChange={(e) => setAnnFormPubDate(e.target.value)}
                        className={`w-full text-xs py-2 px-3 border outline-none font-mono ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Expiry Date (Optional)</label>
                      <input
                        type="date"
                        value={annFormExpDate}
                        onChange={(e) => setAnnFormExpDate(e.target.value)}
                        className={`w-full text-xs py-2 px-3 border outline-none font-mono ${isDarkMode ? 'border-slate-800 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                      />
                    </div>
                  </div>

                  <AnnouncementAttachmentField
                    inputId="staff-announcement-file-upload"
                    isDarkMode={isDarkMode}
                    attachmentUrl={annFormAttach}
                    existingAttachmentName={isEditingAnnouncement?.attachmentName}
                    existingAttachmentSize={isEditingAnnouncement?.attachmentSize}
                    pendingFile={annPendingFile}
                    onSelectFile={(file) => {
                      setAnnPendingFile(file);
                      setAnnRemoveAttach(false);
                    }}
                    onChangeUrl={(url) => {
                      setAnnFormAttach(url);
                      setAnnRemoveAttach(false);
                    }}
                    onRemoveAttachment={() => {
                      setAnnPendingFile(null);
                      setAnnFormAttach('');
                      setAnnRemoveAttach(true);
                    }}
                  />

                  {/* Broadcast Channels */}
                  <div className={`border p-4 grid sm:grid-cols-2 gap-4 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-blue-50/50 border-blue-100'}`}>
                    <div>
                      <span className="font-extrabold text-[10px] text-indigo-900 uppercase tracking-wider block mb-2">Automated Alert Dispatch</span>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={annFormNotifyStud}
                            onChange={(e) => setAnnFormNotifyStud(e.target.checked)}
                            className="cursor-pointer"
                          />
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-850'}>Notify All Enrolled Students (In-App + Email Alert)</span>
                        </label>
                        <label className="flex items-center gap-2 font-bold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={annFormNotifyStaff}
                            onChange={(e) => setAnnFormNotifyStaff(e.target.checked)}
                            className="cursor-pointer"
                          />
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-850'}>Notify Departmental Staff (In-App + Email Alert)</span>
                        </label>
                      </div>
                    </div>

                    <div className="sm:border-l sm:pl-4 flex flex-col justify-center space-y-2 border-slate-800">
                      <label className="flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={annFormPublished}
                          onChange={(e) => setAnnFormPublished(e.target.checked)}
                          className="cursor-pointer"
                        />
                        <span className={isDarkMode ? 'text-slate-300' : 'text-slate-850'}>Immediately Published & Live</span>
                      </label>
                      <label className="flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={annFormPinned}
                          onChange={(e) => setAnnFormPinned(e.target.checked)}
                          className="cursor-pointer"
                        />
                        <span className="text-amber-800">Pin Notice to Top of Board</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingAnnouncement(null)}
                      className={`py-2 px-4 font-extrabold uppercase tracking-wider cursor-pointer text-[10px] ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-150 hover:bg-slate-200 text-slate-700'}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold uppercase tracking-wider cursor-pointer shadow-md text-[10px]"
                    >
                      {isEditingAnnouncement.id ? 'Save Changes' : 'Broadcast Announcement'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className={`flex justify-between items-center p-4 border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200'}`}>
                    <div>
                      <h3 className="font-black text-sm uppercase text-slate-900">Department Noticeboard Registry</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Broadcast and coordinate administrative directives for the <span className="uppercase font-bold text-blue-900">{deptKey}</span> department.</p>
                    </div>
                    <button
                      onClick={handleStartCreateAnnouncement}
                      className="py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      New Announcement
                    </button>
                  </div>

                  {annSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-bold">
                      {annSuccess}
                    </div>
                  )}

                  {isAnnouncementsLoading && announcements.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium">
                      Loading notice logs...
                    </div>
                  ) : announcements.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 space-y-2 border border-slate-200 border-dashed rounded-none">
                      <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                      <p>No department announcements or notices broadcasted yet.</p>
                    </div>
                  ) : (
                    <div className={`border overflow-x-auto ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`text-[10px] font-black uppercase border-b ${isDarkMode ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-50 text-slate-550 border-slate-200'}`}>
                            <th className="p-3">Title & Category</th>
                            <th className="p-3 font-mono">Date Published</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Status Flags</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {announcements.map((ann) => {
                            const isExpired = ann.expiryDate && new Date(ann.expiryDate) < new Date();
                            return (
                              <tr key={ann.id} className={`border-b ${isDarkMode ? 'border-slate-800 hover:bg-slate-950/50' : 'border-slate-200 hover:bg-slate-50/50'}`}>
                                <td className="p-3 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    {ann.isPinned && (
                                      <span className="bg-amber-50 text-amber-700 px-1 border border-amber-200 text-[8px] font-black uppercase flex items-center gap-0.5">
                                        <Pin className="w-2.5 h-2.5 fill-amber-500 animate-pulse" /> PINNED
                                      </span>
                                    )}
                                    <span className={`font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{ann.title}</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-slate-100 border text-slate-650">
                                      {ann.category}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      By {ann.createdBy} ({ann.creatorRole.toUpperCase()})
                                    </span>
                                    {ann.attachmentUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void downloadAnnouncementAttachment(ann.attachmentUrl, token, ann.attachmentName).catch((err: any) =>
                                            setAnnError(err?.message || 'Could not download attachment.')
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                                        title={ann.attachmentName || 'Download attached file'}
                                      >
                                        <Paperclip className="w-3 h-3" />
                                        <span className="max-w-[160px] truncate">{ann.attachmentName || 'Attachment'}</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className={`p-3 font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-850'}`}>
                                  {new Date(ann.publishDate).toLocaleDateString()}
                                </td>
                                <td className="p-3">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase border ${
                                    ann.priority === 'urgent'
                                      ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                                      : ann.priority === 'high'
                                        ? 'bg-orange-50 border-orange-200 text-orange-700 font-bold'
                                        : ann.priority === 'medium'
                                          ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold'
                                          : 'bg-slate-50 border-slate-200 text-slate-650 font-bold'
                                  }`}>
                                    {ann.priority}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {ann.isPublished ? (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 text-[9px] font-bold uppercase">LIVE</span>
                                    ) : (
                                      <span className="bg-slate-100 text-slate-500 border px-1 text-[9px] font-bold uppercase">DRAFT</span>
                                    )}
                                    {ann.isArchived && (
                                      <span className="bg-slate-200 text-slate-700 border px-1 text-[9px] font-bold uppercase">ARCHIVED</span>
                                    )}
                                    {isExpired && (
                                      <span className="bg-rose-100 text-rose-700 border px-1 text-[9px] font-bold uppercase">EXPIRED</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleToggleAnnouncementState(ann.id, 'isPublished')}
                                      className={`p-1 border cursor-pointer ${ann.isPublished ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                                      title={ann.isPublished ? "Unpublish Announcement" : "Publish Announcement"}
                                    >
                                      {ann.isPublished ? <Eye className="w-3.5 h-3.5 text-emerald-700" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                                    </button>
                                    <button
                                      onClick={() => handleToggleAnnouncementState(ann.id, 'isPinned')}
                                      className={`p-1 border cursor-pointer ${ann.isPinned ? 'bg-amber-50 hover:bg-amber-100 border-amber-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                                      title={ann.isPinned ? "Unpin Notice" : "Pin Notice"}
                                    >
                                      <Pin className={`w-3.5 h-3.5 ${ann.isPinned ? 'text-amber-650 fill-amber-500' : 'text-slate-500'}`} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleAnnouncementState(ann.id, 'isArchived')}
                                      className={`p-1 border cursor-pointer ${ann.isArchived ? 'bg-slate-200 border-slate-300' : 'bg-slate-50 hover:bg-slate-100'}`}
                                      title={ann.isArchived ? "Unarchive Notice" : "Archive Notice"}
                                    >
                                      <Archive className={`w-3.5 h-3.5 ${ann.isArchived ? 'text-slate-800' : 'text-slate-500'}`} />
                                    </button>
                                    <button
                                      onClick={() => handleStartEditAnnouncement(ann)}
                                      className="p-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAnnouncement(ann.id)}
                                      className="p-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 cursor-pointer"
                                      title="Delete Notice"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </main>

      <ImageViewer src={activeViewerImage} onClose={() => setActiveViewerImage(null)} />
    </div>
  );
}
