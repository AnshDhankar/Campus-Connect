import React, { useState, useEffect } from 'react';
import { 
  BarChart4, Users, ShieldAlert, FileSearch, Trash2, Plus, 
  Building2, Phone, Mail, UserCheck, CheckCircle2, 
  AlertTriangle, HelpCircle, ArrowUpRight, Check, Eye,
  RefreshCw, Landmark, Activity, Clock, ShieldCheck, Tag, Settings,
  Upload, X, Globe, ExternalLink, Megaphone, Pin, Archive, EyeOff, Bell,
  History, Paperclip
} from 'lucide-react';
import { Department, HelpComplaintRequest, Staff } from '../types';
import { ImageViewer } from './ImageViewer';
import { readAndOptimizeFileAsDataUrl } from '../utils/imageCompression';
import { AnnouncementAttachmentField } from './AnnouncementAttachmentField';
import { PendingAnnouncementFile, downloadAnnouncementAttachment } from '../utils/announcementAttachment';
import { apiFetch } from '../utils/csrf';

interface AdminDashboardProps {
  user: any;
  departments: Department[];
  token: string;
  isDarkMode: boolean;
  onRefreshDepartments?: () => void;
  onUpdateUser?: (updatedUser: any, updatedToken?: string) => void;
  onLogout?: () => void;
  externalActiveTab?: string;
  onTabChange?: (tab: string) => void;
  onOpenProfileModal?: () => void;
}

export default function AdminDashboard({ 
  user, 
  departments, 
  token, 
  isDarkMode, 
  onRefreshDepartments,
  onUpdateUser,
  onLogout,
  externalActiveTab,
  onTabChange,
  onOpenProfileModal
}: AdminDashboardProps) {
  // Page states
  const [activeTab, setActiveTab] = useState<'analytics' | 'departments' | 'staff' | 'students' | 'tickets' | 'settings' | 'profile' | 'announcements'>('analytics');

  // Synchronize with external sidebar navigation
  useEffect(() => {
    if (!externalActiveTab) return;
    if (['analytics', 'departments', 'staff', 'students', 'tickets', 'settings', 'profile', 'announcements'].includes(externalActiveTab)) {
      setActiveTab(externalActiveTab as any);
      setError('');
      setSuccess('');
      if (externalActiveTab === 'profile') {
        fetchInstitutionProfile();
      }
    } else if (externalActiveTab === 'admin-profile') {
      onOpenProfileModal?.();
    }
  }, [externalActiveTab, onOpenProfileModal]);
  
  // Database States
  const [analytics, setAnalytics] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [studentList, setStudentList] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<HelpComplaintRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active full screen image viewer state
  const [activeViewerImage, setActiveViewerImage] = useState<string | null>(null);

  // Institution Profile Management State
  const [instProfile, setInstProfile] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profName, setProfName] = useState('');
  const [profWebsite, setProfWebsite] = useState('');
  const [profOfficialEmail, setProfOfficialEmail] = useState('');
  const [profContactNumber, setProfContactNumber] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [profCity, setProfCity] = useState('');
  const [profState, setProfState] = useState('');
  const [profCountry, setProfCountry] = useState('');
  const [profPostalCode, setProfPostalCode] = useState('');
  const [profCategory, setProfCategory] = useState('');
  const [profDescription, setProfDescription] = useState('');
  const [profLogo, setProfLogo] = useState('');
  const [profSocialTwitter, setProfSocialTwitter] = useState('');
  const [profSocialLinkedin, setProfSocialLinkedin] = useState('');
  const [profSocialFacebook, setProfSocialFacebook] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [draggingProfileLogo, setDraggingProfileLogo] = useState(false);
  const [profileLogoError, setProfileLogoError] = useState('');
  const [adminName, setAdminName] = useState(user?.name || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (user?.name && !isEditingProfile) {
      setAdminName(user.name);
    }
  }, [user?.name, isEditingProfile]);

  const fetchInstitutionProfile = async () => {
    if (!user?.institutionId || user.institutionId === 'default') return;
    try {
      const res = await fetch(`/api/institutions/${user.institutionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstProfile(data);
        // Initialize form fields
        setProfName(data.name || '');
        setProfWebsite(data.website || '');
        setProfOfficialEmail(data.officialEmail || '');
        setProfContactNumber(data.contactNumber || '');
        setProfAddress(data.address || '');
        setProfCity(data.city || '');
        setProfState(data.state || '');
        setProfCountry(data.country || '');
        setProfPostalCode(data.postalCode || '');
        setProfCategory(data.category || '');
        setProfDescription(data.description || '');
        setProfLogo(data.logo || '');
        setProfSocialTwitter(data.socialTwitter || '');
        setProfSocialLinkedin(data.socialLinkedin || '');
        setProfSocialFacebook(data.socialFacebook || '');
      }
    } catch (err) {
      console.error('Failed to fetch institution profile:', err);
    }
  };

  const handleProfileLogoSelect = (file: File) => {
    setProfileLogoError('');
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setProfileLogoError('Unsupported file type. Only JPG, PNG, and WEBP are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileLogoError('File size exceeds the 5MB limit.');
      return;
    }

    readAndOptimizeFileAsDataUrl(file, {
      maxDimension: 1024,
      maxTargetBytes: 512 * 1024,
      quality: 0.85
    })
      .then((optimizedDataUrl) => setProfLogo(optimizedDataUrl))
      .catch(() => setProfileLogoError('Could not parse image file.'));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName) {
      setError('Institution Name is required.');
      return;
    }

    setIsSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiFetch(`/api/institutions/${user.institutionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profName,
          website: profWebsite,
          officialEmail: profOfficialEmail,
          contactNumber: profContactNumber,
          address: profAddress,
          city: profCity,
          state: profState,
          country: profCountry,
          postalCode: profPostalCode,
          category: profCategory,
          description: profDescription,
          logo: profLogo,
          socialTwitter: profSocialTwitter,
          socialLinkedin: profSocialLinkedin,
          socialFacebook: profSocialFacebook,
          adminName: adminName,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update institution profile.');
      }

      setSuccess('Institution profile updated successfully!');
      setInstProfile(data.institution);
      
      if (onUpdateUser && data.user) {
        onUpdateUser(data.user, data.token || undefined);
      }

      setIsEditingProfile(false);
    } catch (err: any) {
      setError(err.message || 'Error updating institution profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteInstitution = async () => {
    if (deleteConfirmInput !== instProfile?.name && deleteConfirmInput !== 'DELETE') {
      setDeleteError(`Please type "${instProfile?.name || 'DELETE'}" or "DELETE" to confirm.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await apiFetch(`/api/institutions/${user.institutionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete institution.');
      }

      setShowDeleteModal(false);
      localStorage.setItem('cc_delete_success', 'Your institution has been successfully removed from CampusConnect.');
      if (onLogout) {
        onLogout();
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Error occurred while deleting institution.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering states
  const [staffFilterDept, setStaffFilterDept] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');

  // System Settings state
  const [univName, setUnivName] = useState(localStorage.getItem('sys_univ_name') || 'State University');
  const [sysAcademicYear, setSysAcademicYear] = useState(localStorage.getItem('sys_academic_year') || '2026-2027');
  const [sysSemester, setSysSemester] = useState(localStorage.getItem('sys_semester') || 'Fall Semester');
  const [sysRegAllowed, setSysRegAllowed] = useState(localStorage.getItem('sys_reg_allowed') || 'yes');
  const [sysMaintenanceMode, setSysMaintenanceMode] = useState(localStorage.getItem('sys_maintenance_mode') || 'no');

  // Form Fields: Staff Management (Simplified)
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmployeeId, setNewStaffEmployeeId] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffDept, setNewStaffDept] = useState('');
  const [newStaffDesignation, setNewStaffDesignation] = useState('');
  const [newStaffStatus, setNewStaffStatus] = useState<'active' | 'inactive'>('active');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isStaffSubmitting, setIsStaffSubmitting] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Form Fields: Department Creation
  const [newDeptKey, setNewDeptKey] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptPhone, setNewDeptPhone] = useState('');
  const [newDeptEmail, setNewDeptEmail] = useState('');
  const [newDeptAdditionalEmails, setNewDeptAdditionalEmails] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [newDeptHead, setNewDeptHead] = useState('');
  const [newDeptStatus, setNewDeptStatus] = useState<'active' | 'inactive'>('active');
  const [newDeptLogo, setNewDeptLogo] = useState('');
  const [newDeptUsername, setNewDeptUsername] = useState('');
  const [newDeptPassword, setNewDeptPassword] = useState('');
  const [isDeptSubmitting, setIsDeptSubmitting] = useState(false);

  // Selected ticket for side-drawer modal view
  const [selectedTicket, setSelectedTicket] = useState<HelpComplaintRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [reassignDeptKey, setReassignDeptKey] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Advanced Operations State
  const [opsSearchQuery, setOpsSearchQuery] = useState('');
  const [opsStatusFilter, setOpsStatusFilter] = useState('all');
  const [opsPriorityFilter, setOpsPriorityFilter] = useState('all');
  const [opsDeptFilter, setOpsDeptFilter] = useState('all');
  const [opsStartDate, setOpsStartDate] = useState('');
  const [opsEndDate, setOpsEndDate] = useState('');
  const [internalNotesText, setInternalNotesText] = useState('');
  const [updatingStatusTicketId, setUpdatingStatusTicketId] = useState('');
  const [newRemarksText, setNewRemarksText] = useState('');

  const handleAssignOfficer = async (ticketId: string, officerId: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/requests/${ticketId}/assign-officer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ officerId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to assign officer.');
      }
      setSuccess(`Successfully assigned officer to ticket [${ticketId}].`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data);
      }
      fetchAllTickets();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error executing officer assignment.');
    }
  };

  const handleUpdatePriority = async (ticketId: string, priority: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/requests/${ticketId}/priority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update priority.');
      }
      setSuccess(`Successfully updated ticket priority to ${priority.toUpperCase()}.`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data);
      }
      fetchAllTickets();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error updating ticket priority.');
    }
  };

  const handleUpdateInternalNotes = async (ticketId: string, internalNotes: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/requests/${ticketId}/internal-notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ internalNotes })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update internal notes.');
      }
      setSuccess(`Internal notes saved on ticket [${ticketId}].`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data);
      }
      fetchAllTickets();
    } catch (err: any) {
      setError(err.message || 'Error updating internal notes.');
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: string, remarks: string = '') => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/requests/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, remarks })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket status.');
      }
      setSuccess(`Ticket [${ticketId}] status successfully updated to [${status.toUpperCase()}].`);
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(data);
      }
      fetchAllTickets();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error updating status.');
    }
  };

  const handleExportTicket = (ticket: HelpComplaintRequest) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ticket, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ticket_${ticket.id}_export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSuccess(`Successfully exported ticket payload for reference ID: ${ticket.id}`);
  };

  const handlePrintTicket = (ticket: HelpComplaintRequest) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Popup blocker prevented print layout window.');
      return;
    }
    const timelineHtml = (ticket.timeline || []).map((ev: any) => `
      <div style="border-left: 2px solid #0f172a; padding-left: 15px; margin-bottom: 15px; position: relative;">
        <div style="width: 10px; height: 10px; background: #0f172a; border-radius: 50%; position: absolute; left: -6px; top: 4px;"></div>
        <div style="font-weight: bold; font-size: 13px;">${ev.title} - ${ev.actor || 'System'}</div>
        <div style="font-size: 11px; color: #64748b; font-family: monospace; margin: 2px 0;">${new Date(ev.timestamp).toLocaleString()}</div>
        <div style="font-size: 12px; color: #334155;">${ev.subtitle || ''}</div>
        ${ev.remarks ? `<div style="font-size: 12px; font-style: italic; color: #475569; margin-top: 4px;">Remarks: "${ev.remarks}"</div>` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>CAMPUSCONNECT DOSSIER: ${ticket.id}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; padding: 40px; line-height: 1.5; }
            .header { border-bottom: 3px double #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .section { margin-bottom: 25px; border: 1px solid #e2e8f0; padding: 20px; }
            .section-title { font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; }
            .label { font-weight: 600; color: #64748b; }
            .badge { font-weight: bold; text-transform: uppercase; font-size: 10px; padding: 3px 8px; border: 1px solid #000; display: inline-block; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">CAMPUSCONNECT</h1>
              <div style="font-size: 12px; color: #64748b; font-family: monospace; margin-top: 4px;">OFFICIAL SYSTEM DOCUMENT RECORD</div>
            </div>
            <div style="text-align: right; font-family: monospace; font-size: 11px; color: #64748b;">
              PRINTED: ${new Date().toLocaleString()}<br>
              TICKET REFERENCE ID: ${ticket.id}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Ticket Classification</div>
            <div class="grid">
              <div><span class="label">Request Category:</span> <strong style="text-transform: uppercase;">${ticket.requestType}</strong></div>
              <div><span class="label">Current Status:</span> <span class="badge">${ticket.status}</span></div>
              <div><span class="label">Priority Urgency:</span> <strong style="text-transform: uppercase; color: ${ticket.priority === 'urgent' ? '#dc2626' : ticket.priority === 'high' ? '#ea580c' : '#1e3a8a'}">${ticket.priority || 'medium'}</strong></div>
              <div><span class="label">Assigned Department:</span> <strong>${ticket.departmentKey.toUpperCase()}</strong></div>
              <div><span class="label">Submission Date:</span> ${new Date(ticket.createdAt).toLocaleString()}</div>
              <div><span class="label">Assigned Officer:</span> ${ticket.officerName || 'UNASSIGNED'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Student Submitter Details</div>
            <div class="grid">
              <div><span class="label">Full Name:</span> ${ticket.studentName}</div>
              <div><span class="label">Enrollment Roll No:</span> ${ticket.enrollmentNumber || 'N/A'}</div>
              <div><span class="label">Contact Telephone:</span> ${ticket.contactNumber || 'N/A'}</div>
              <div><span class="label">Student Registered E-mail:</span> ${ticket.studentId}@campusconnect.edu</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dossier Subject & Description</div>
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 800;">${ticket.subject}</h3>
            <p style="font-size: 13.5px; white-space: pre-wrap; color: #1e293b; background: #f8fafc; padding: 15px; border-left: 4px solid #475569; margin: 0;">${ticket.description}</p>
          </div>

          ${ticket.feedback ? `
          <div class="section" style="background-color: #f0fdf4; border-color: #bbf7d0;">
            <div class="section-title" style="color: #15803d; border-color: #bbf7d0;">Student Satisfaction Feedback</div>
            <div style="font-size: 13.5px;">
              <strong>Rating Metric:</strong> ${ticket.feedback.rating} / 5 Stars<br>
              <strong>Review Commentary:</strong> "${ticket.feedback.remarks || 'No written commentary provided.'}"
            </div>
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">System Audit Timeline Logs</div>
            <div style="margin-top: 10px;">
              ${timelineHtml || '<div style="font-size: 13px; color: #64748b;">No chronological logs loaded on this ticket instance.</div>'}
            </div>
          </div>

          <div style="text-align: center; font-size: 10px; color: #94a3b8; font-family: monospace; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            End of Official Document - Digital Signature Enforced by CampusConnect Audit Engine.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Form Fields: Department Editing
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Form Fields: Staff Password Reset
  const [resettingStaffId, setResettingStaffId] = useState<string | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  // Ticket ledger filters
  const [ledgerDeptFilter, setLedgerDeptFilter] = useState('');
  const [ledgerTab, setLedgerTab] = useState<'complaints' | 'help'>('complaints');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sys_univ_name', univName);
    localStorage.setItem('sys_academic_year', sysAcademicYear);
    localStorage.setItem('sys_semester', sysSemester);
    localStorage.setItem('sys_reg_allowed', sysRegAllowed);
    localStorage.setItem('sys_maintenance_mode', sysMaintenanceMode);
    setSuccess('System settings successfully saved in database registry context.');
  };

  const handleReassign = async (ticketId: string) => {
    if (!reassignDeptKey) {
      setError('Please select a valid destination department.');
      return;
    }
    try {
      setReassigning(true);
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/requests/${ticketId}/reassign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ departmentKey: reassignDeptKey })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reassign request.');
      }
      setSuccess(`Successfully reassigned request [${ticketId}] to ${getDepartmentName(reassignDeptKey)}.`);
      setSelectedTicket(data);
      fetchAllTickets();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error executing ticket reassignment.');
    } finally {
      setReassigning(false);
    }
  };

  // Sub-departments state
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [isSubDeptsLoading, setIsSubDeptsLoading] = useState(false);
  const [selectedDeptForSubDepts, setSelectedDeptForSubDepts] = useState<string | null>(null);

  // Sub-department form state
  const [isEditingSubDept, setIsEditingSubDept] = useState<any | null>(null);
  const [subDeptName, setSubDeptName] = useState('');
  const [subDeptHeadName, setSubDeptHeadName] = useState('');
  const [subDeptEmail, setSubDeptEmail] = useState('');
  const [subDeptPhone, setSubDeptPhone] = useState('');
  const [subDeptLocation, setSubDeptLocation] = useState('');
  const [subDeptDesc, setSubDeptDesc] = useState('');
  const [subDeptStatus, setSubDeptStatus] = useState<'active' | 'inactive'>('active');
  const [isSubFormOpen, setIsSubFormOpen] = useState(false);

  const fetchSubDepartments = async () => {
    try {
      setIsSubDeptsLoading(true);
      const res = await fetch('/api/subdepartments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubDepartments(data);
      }
    } catch (err) {
      console.warn('Failed to fetch sub-departments:', err);
    } finally {
      setIsSubDeptsLoading(false);
    }
  };

  const handleCreateOrUpdateSubDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptForSubDepts) return;

    try {
      setError('');
      setSuccess('');
      const payload = {
        name: subDeptName,
        headName: subDeptHeadName,
        officialEmail: subDeptEmail,
        contactNumber: subDeptPhone,
        officeLocation: subDeptLocation,
        description: subDeptDesc,
        status: subDeptStatus,
        departmentKey: selectedDeptForSubDepts
      };

      const url = isEditingSubDept 
        ? `/api/admin/subdepartments/${isEditingSubDept.id}` 
        : '/api/admin/subdepartments';
      
      const method = isEditingSubDept ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save sub-department.');
      }

      setSuccess(`Sub-department ${isEditingSubDept ? 'updated' : 'created'} successfully.`);
      // Reset form
      setSubDeptName('');
      setSubDeptHeadName('');
      setSubDeptEmail('');
      setSubDeptPhone('');
      setSubDeptLocation('');
      setSubDeptDesc('');
      setSubDeptStatus('active');
      setIsEditingSubDept(null);
      setIsSubFormOpen(false);

      // Refresh list
      fetchSubDepartments();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error saving sub-department.');
    }
  };

  const handleEditSubDeptStart = (sub: any) => {
    setIsEditingSubDept(sub);
    setSubDeptName(sub.name);
    setSubDeptHeadName(sub.headName);
    setSubDeptEmail(sub.officialEmail);
    setSubDeptPhone(sub.contactNumber);
    setSubDeptLocation(sub.officeLocation || '');
    setSubDeptDesc(sub.description || '');
    setSubDeptStatus(sub.status || 'active');
    setIsSubFormOpen(true);
  };

  const handleDeleteSubDept = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the sub-department "${name}"?`)) return;

    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/subdepartments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete sub-department.');
      }
      setSuccess('Sub-department deleted successfully.');
      fetchSubDepartments();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error deleting sub-department.');
    }
  };

  const handleToggleSubDeptStatus = async (sub: any) => {
    try {
      setError('');
      setSuccess('');
      const newStatus = sub.status === 'active' ? 'inactive' : 'active';
      const res = await apiFetch(`/api/admin/subdepartments/${sub.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle status.');
      }
      setSuccess(`Sub-department status changed successfully.`);
      fetchSubDepartments();
    } catch (err: any) {
      setError(err.message || 'Error toggling sub-department status.');
    }
  };

  // Announcements Management state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  
  // Create/Edit form states
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState<any | null>(null); // if null, in list view. If object, in create/edit view.
  const [annFormTitle, setAnnFormTitle] = useState('');
  const [annFormDesc, setAnnFormDesc] = useState('');
  const [annFormCat, setAnnFormCat] = useState('Academic');
  const [annFormPri, setAnnFormPri] = useState('Medium');
  const [annFormPubDate, setAnnFormPubDate] = useState(new Date().toISOString().slice(0, 10));
  const [annFormExpDate, setAnnFormExpDate] = useState('');
  const [annFormAttach, setAnnFormAttach] = useState('');
  const [annPendingFile, setAnnPendingFile] = useState<PendingAnnouncementFile | null>(null);
  const [annRemoveAttach, setAnnRemoveAttach] = useState(false);
  const [annFormAudience, setAnnFormAudience] = useState<'all' | 'institution' | 'selected_departments'>('all');
  const [annFormDepts, setAnnFormDepts] = useState<string[]>([]);
  const [annFormNotifyStud, setAnnFormNotifyStud] = useState(true);
  const [annFormNotifyStaff, setAnnFormNotifyStaff] = useState(true);
  const [annFormPublished, setAnnFormPublished] = useState(true);
  const [annFormPinned, setAnnFormPinned] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      setIsAnnouncementsLoading(true);
      const res = await fetch('/api/announcements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.warn('Failed to fetch announcements:', err);
    } finally {
      setIsAnnouncementsLoading(false);
    }
    fetchDeletedAnnouncements();
  };

  const [deletedAnnouncements, setDeletedAnnouncements] = useState<any[]>([]);
  const [isDeletedAnnouncementsLoading, setIsDeletedAnnouncementsLoading] = useState(false);

  const fetchDeletedAnnouncements = async () => {
    try {
      setIsDeletedAnnouncementsLoading(true);
      const res = await fetch('/api/announcements?deleted=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDeletedAnnouncements(data);
      }
    } catch (err) {
      console.warn('Failed to fetch deleted announcements:', err);
    } finally {
      setIsDeletedAnnouncementsLoading(false);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
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
        targetAudience: annFormAudience,
        targetDepartments: annFormAudience === 'selected_departments' ? annFormDepts : [],
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
        throw new Error(resData.error || 'Failed to persist announcement.');
      }

      setSuccess(isEditing ? 'Announcement updated successfully!' : 'Announcement published successfully!');
      
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
      setAnnFormAudience('all');
      setAnnFormDepts([]);
      setAnnFormNotifyStud(true);
      setAnnFormNotifyStaff(true);
      setAnnFormPublished(true);
      setAnnFormPinned(false);

      fetchAnnouncements();
    } catch (err: any) {
      setError(err.message || 'Error saving announcement.');
    }
  };

  const handleToggleAnnouncementState = async (id: string, field: 'isPublished' | 'isPinned' | 'isArchived') => {
    try {
      setError('');
      setSuccess('');
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
      setSuccess(`Successfully updated state of announcement "${resData.title}".`);
    } catch (err: any) {
      setError(err.message || 'Error updating status.');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to delete announcement.');
      }
      fetchAnnouncements();
      setSuccess('Announcement soft-deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Error deleting announcement.');
    }
  };

  const handleRestoreAnnouncement = async (id: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/announcements/${id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to restore announcement.');
      }
      fetchAnnouncements();
      setSuccess('Announcement restored successfully.');
    } catch (err: any) {
      setError(err.message || 'Error restoring announcement.');
    }
  };

  const handlePermanentlyDeleteAnnouncement = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to PERMANENTLY delete this announcement? This action cannot be undone.')) return;
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/announcements/${id}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to permanently delete announcement.');
      }
      fetchAnnouncements();
      setSuccess('Announcement permanently deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Error permanently deleting announcement.');
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
    setAnnFormAudience(ann.targetAudience || 'all');
    setAnnFormDepts(ann.targetDepartments || []);
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
    setAnnFormAudience('all');
    setAnnFormDepts([]);
    setAnnFormNotifyStud(true);
    setAnnFormNotifyStaff(true);
    setAnnFormPublished(true);
    setAnnFormPinned(false);
  };

  useEffect(() => {
    fetchAnalytics();
    fetchStaff();
    fetchStudents();
    fetchAuditLogs();
    fetchAllTickets(false);
    fetchInstitutionProfile();
    fetchAnnouncements();
    fetchSubDepartments();
    const intervalId = setInterval(() => {
      fetchAnalytics();
      fetchAllTickets(true);
      fetchAuditLogs();
      fetchStudents();
      fetchStaff();
      fetchAnnouncements();
      fetchSubDepartments();
    }, 8000);
    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    if (selectedTicket) {
      setInternalNotesText(selectedTicket.internalNotes || '');
    } else {
      setInternalNotesText('');
    }
  }, [selectedTicket]);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch {
      console.warn('Could not refresh security audit logs.');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      console.warn('Could not refresh university meters.');
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/admin/staff', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch {
      console.warn('Could not read authorized staff directories.');
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/admin/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudentList(data);
      }
    } catch {
      console.warn('Could not read academic student register.');
    }
  };

  const fetchAllTickets = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/requests', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllTickets(data);
        
        // Sync currently opened ticket details by pulling directly
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
      console.warn('Failed to retrieve aggregate logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newStaffName || !newStaffEmail || !newStaffDept || !newStaffEmployeeId || !newStaffDesignation) {
      setError('Please fill out all required staff fields (Name, Employee ID, Email, Department, Designation).');
      return;
    }

    try {
      setIsStaffSubmitting(true);
      const isEditing = !!editingStaffId;
      const url = isEditing ? `/api/admin/staff/${editingStaffId}` : '/api/admin/staff';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newStaffName,
          email: newStaffEmail,
          departmentKey: newStaffDept,
          employeeId: newStaffEmployeeId,
          phone: newStaffPhone,
          designation: newStaffDesignation,
          status: newStaffStatus
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || `Failed to ${isEditing ? 'update' : 'create'} staff member.`);
      }

      setSuccess(`Staff member "${newStaffName}" ${isEditing ? 'updated' : 'created'} successfully.`);
      
      // Clear form
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffEmployeeId('');
      setNewStaffPhone('');
      setNewStaffDept('');
      setNewStaffDesignation('');
      setNewStaffStatus('active');
      setEditingStaffId(null);
      
      fetchStaff();
      fetchAuditLogs();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message || 'Error processing staff operation.');
    } finally {
      setIsStaffSubmitting(false);
    }
  };

  const startEditStaff = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setNewStaffName(staff.name);
    setNewStaffEmail(staff.email);
    setNewStaffDept(staff.departmentKey);
    setNewStaffEmployeeId(staff.employeeId || '');
    setNewStaffPhone(staff.phone || '');
    setNewStaffDesignation(staff.designation || '');
    setNewStaffStatus(staff.status || 'active');
  };

  const cancelEditStaff = () => {
    setEditingStaffId(null);
    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffDept('');
    setNewStaffEmployeeId('');
    setNewStaffPhone('');
    setNewStaffDesignation('');
    setNewStaffStatus('active');
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newDeptKey || !newDeptName || !newDeptPhone || !newDeptEmail || !newDeptUsername || !newDeptPassword) {
      setError('Please fill in complete department details, including login credentials.');
      return;
    }

    try {
      setIsDeptSubmitting(true);
      const res = await apiFetch('/api/admin/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          key: newDeptKey.toLowerCase().trim(),
          name: newDeptName,
          officialPhone: newDeptPhone,
          officialEmail: newDeptEmail,
          description: newDeptDesc,
          head: newDeptHead,
          status: newDeptStatus,
          logo: newDeptLogo,
          username: newDeptUsername,
          password: newDeptPassword,
          additionalEmails: newDeptAdditionalEmails,
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to establish custom department.');
      }

      setSuccess(`Custom Department "${newDeptName}" configured successfully.`);
      setNewDeptKey('');
      setNewDeptName('');
      setNewDeptPhone('');
      setNewDeptEmail('');
      setNewDeptAdditionalEmails('');
      setNewDeptDesc('');
      setNewDeptHead('');
      setNewDeptStatus('active');
      setNewDeptLogo('');
      setNewDeptUsername('');
      setNewDeptPassword('');
      fetchAnalytics();
      
      if (onRefreshDepartments) {
        onRefreshDepartments();
      }
    } catch (err: any) {
      setError(err.message || 'Error configuring custom channel.');
    } finally {
      setIsDeptSubmitting(false);
    }
  };

  const startEditDepartment = (dept: Department) => {
    setEditingDept(dept);
    setNewDeptKey(dept.key);
    setNewDeptName(dept.name);
    setNewDeptPhone(dept.officialPhone);
    setNewDeptEmail(dept.officialEmail);
    setNewDeptAdditionalEmails(dept.additionalEmails || '');
    setNewDeptDesc(dept.description);
    setNewDeptHead(dept.head || '');
    setNewDeptStatus(dept.status || 'active');
    setNewDeptLogo(dept.logo || '');
    setNewDeptUsername(dept.username || '');
    setNewDeptPassword(''); // Keep blank to indicate no change unless edited
    setActiveTab('departments'); // switch to departments tab to view inputs
  };

  const handleEditDepartmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setError('');
    setSuccess('');
    try {
      setIsDeptSubmitting(true);
      const res = await apiFetch(`/api/admin/departments/${editingDept.key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newDeptName,
          officialPhone: newDeptPhone,
          officialEmail: newDeptEmail,
          description: newDeptDesc,
          head: newDeptHead,
          status: newDeptStatus,
          logo: newDeptLogo,
          username: newDeptUsername,
          password: newDeptPassword || undefined,
          additionalEmails: newDeptAdditionalEmails,
        })
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to update department.');
      }
      setSuccess(`Department "${newDeptName}" updated successfully.`);
      setEditingDept(null);
      setNewDeptKey('');
      setNewDeptName('');
      setNewDeptPhone('');
      setNewDeptEmail('');
      setNewDeptAdditionalEmails('');
      setNewDeptDesc('');
      setNewDeptHead('');
      setNewDeptStatus('active');
      setNewDeptLogo('');
      setNewDeptUsername('');
      setNewDeptPassword('');
      fetchAnalytics();
      if (onRefreshDepartments) {
        onRefreshDepartments();
      }
    } catch (err: any) {
      setError(err.message || 'Error updating department details.');
    } finally {
      setIsDeptSubmitting(false);
    }
  };

  const handleResetStaffPassword = async (staffId: string, officerName: string, customPassword?: string, forceChange?: boolean, passType?: 'temporary' | 'permanent') => {
    const passwordToUse = customPassword || resetPasswordInput;
    const forceVal = forceChange !== undefined ? forceChange : true;
    const typeVal = passType || 'temporary';

    if (!passwordToUse || passwordToUse.trim().length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/staff/${staffId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          password: passwordToUse,
          forcePasswordChange: forceVal,
          passwordType: typeVal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }
      setSuccess(`Successfully reset password for ${officerName} (${typeVal} password).`);
      setResettingStaffId(null);
      setResetPasswordInput('');
      fetchStaff();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Error executing password reset.');
    }
  };

  const handleToggleDisableStaff = async (staffId: string, officerName: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/staff/${staffId}/toggle-disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle account condition.');
      }
      setSuccess(`Portal access successfully ${data.disabled ? 'suspended/disabled' : 'enabled/safeguarded'} for ${officerName}.`);
      fetchStaff();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Error toggling suspend flag.');
    }
  };

  const handleUnlockStaff = async (staffId: string, officerName: string) => {
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/staff/${staffId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unlock account.');
      }
      setSuccess(`Account unlocked successfully for ${officerName}.`);
      fetchStaff();
      fetchAuditLogs();
    } catch (err: any) {
      setError(err.message || 'Error unlocking account.');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to suspend and delete officer credentials for ${name}?`)) return;
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/staff/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess(`Revoked security access for ${name}.`);
        fetchStaff();
        fetchAuditLogs();
        fetchAnalytics();
      } else {
        setError('Failed to drop staff access.');
      }
    } catch {
      setError('Database connectivity lost.');
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove the registration account for student "${name}"?`)) return;
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess(`De-registered student "${name}".`);
        fetchStudents();
        fetchAnalytics();
      } else {
        setError('Failed to retract student account.');
      }
    } catch {
      setError('Database connectivity failure.');
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (!confirm(`Warning: Deleting department "${name}" might disorganize assigned tickets. Proceed anyway?`)) return;
    try {
      setError('');
      setSuccess('');
      const res = await apiFetch(`/api/admin/departments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuccess(`De-configured department "${name}".`);
        if (onRefreshDepartments) {
          onRefreshDepartments();
        }
      } else {
        setError('Failed to drop department record.');
      }
    } catch {
      setError('Database connection error.');
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'assigned': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'under_review': return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'in_progress': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'resolved': return 'bg-emerald-50 text-emerald-800 border-emerald-250';
      case 'rejected': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'closed': return 'bg-slate-50 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getDepartmentName = (key: string) => {
    return departments.find(d => d.key === key)?.name || key;
  };

  // Simple counters as fallback if analytics endpoint hasn't computed yet
  const totalMeters = analytics || {
    totalRequests: allTickets.length,
    pendingCount: allTickets.filter(t => t.status === 'pending').length,
    progressCount: allTickets.filter(t => t.status === 'in_progress' || t.status === 'assigned').length,
    resolvedCount: allTickets.filter(t => t.status === 'resolved' || t.status === 'closed' || t.status === 'rejected').length,
    totalStudentsCount: studentList.length,
    complaintsCount: allTickets.filter(t => t.requestType === 'complaint').length,
    helpRequestsCount: allTickets.filter(t => t.requestType === 'help').length,
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Secondary Administration Header */}
      <div className={`border-b py-6 px-4 sm:px-6 lg:px-8 transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs backdrop-blur-xs'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Administration Operations</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-semibold py-0.5 px-2 rounded-md uppercase font-mono border border-blue-200 dark:border-blue-900">
                MASTER PRIVILEGES
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              University Operations Center
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Authority ID: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{user?.email}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Session Verified</span>
            </p>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                fetchAnalytics();
                fetchStaff();
                fetchStudents();
                fetchAllTickets();
              }}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Base
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel layout container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Tabs Bar */}
        <div className={`p-1.5 rounded-xl border flex flex-wrap gap-1 transition-colors ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          {[
            { id: 'analytics', label: 'Dashboard & Analytics', icon: <BarChart4 className="w-4 h-4" /> },
            { id: 'profile', label: 'Institution Profile', icon: <Landmark className="w-4 h-4" /> },
            { id: 'departments', label: 'Manage Departments', icon: <Building2 className="w-4 h-4" /> },
            { id: 'staff', label: 'Manage Staff', icon: <Users className="w-4 h-4" /> },
            { id: 'students', label: 'Enrolled Students', icon: <UserCheck className="w-4 h-4" /> },
            { id: 'tickets', label: 'Master Ticket Ledger', icon: <FileSearch className="w-4 h-4" /> },
            { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
            { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                onTabChange?.(tab.id);
                setError('');
                setSuccess('');
                if (tab.id === 'profile') {
                  fetchInstitutionProfile();
                }
              }}
              className={`py-2 px-3.5 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Action status outputs */}
        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-lg flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ----------------- TAB: ANALYTICS HUB ----------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-fade-in text-xs text-slate-800">
            
            {/* Top Operational Executive Counters */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Total Workload</span>
                  <Activity className="w-4 h-4 text-slate-400" />
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight tabular-nums">{totalMeters.totalRequests}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Complaints & Help desk</p>
                </div>
              </div>
              
              <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">Pending Triage</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">{totalMeters.pendingCount}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Awaiting assignment</p>
                </div>
              </div>

              <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">Active Cases</span>
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 tabular-nums">{totalMeters.progressCount}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Assigned & in progress</p>
                </div>
              </div>

              <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">Resolved Rate</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">{totalMeters.resolvedCount}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Successfully cleared</p>
                </div>
              </div>

              <div className={`p-4 border rounded-xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 col-span-2 lg:col-span-1 ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Students</span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">{totalMeters.totalStudentsCount}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Enrolled & verified</p>
                </div>
              </div>
            </div>

            {/* Main Bento Layout: Live Feed & Operational Logs Timeline */}
            <div className="grid lg:grid-cols-12 gap-8">
              
              {/* Section 1: Live Activity Feed (8 columns on large screen) */}
              <div className={`lg:col-span-8 p-6 border rounded-xl shadow-xs space-y-4 transition-colors ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-500" />
                      Live Activity Feed
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Real-time incoming student complaint and help queues</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Showing {allTickets.slice(0, 4).length} Recent Activities</span>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {allTickets.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border border-dashed rounded-lg border-slate-200 dark:border-slate-800">
                      No active submissions registered in the system.
                    </div>
                  ) : (
                    allTickets.slice(0, 4).map((ticket) => {
                      const ageInHours = Math.round((new Date().getTime() - new Date(ticket.createdAt).getTime()) / 3600000);
                      const expectedResolution = ticket.expectedResolutionTime || (ticket.createdAt 
                        ? new Date(new Date(ticket.createdAt).getTime() + 48 * 3600000).toLocaleString() 
                        : '48 Hours');

                      return (
                        <div 
                          key={ticket.id} 
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setIsDetailModalOpen(true);
                          }}
                          className={`p-4 border rounded-xl transition-all cursor-pointer group space-y-2.5 ${
                            isDarkMode 
                              ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40' 
                              : 'bg-slate-50 border-slate-200/80 hover:border-blue-300 hover:bg-white shadow-xs'
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-start gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                  ticket.requestType === 'complaint' 
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900' 
                                    : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-900'
                                }`}>
                                  {ticket.requestType}
                                </span>
                                <span className={`text-[10px] font-mono tracking-wider font-semibold uppercase px-2 py-0.5 rounded-md border ${
                                  ticket.priority === 'urgent' 
                                    ? 'bg-rose-600 text-white border-rose-700 font-bold'
                                    : ticket.priority === 'high'
                                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                                      : ticket.priority === 'low'
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
                                }`}>
                                  {ticket.priority || 'medium'} urgency
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">ID: {ticket.id}</span>
                              </div>
                              <h4 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mt-1">{ticket.subject}</h4>
                            </div>

                            <span className={`px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider font-extrabold border ${
                              ticket.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                : ticket.status === 'in_progress' || ticket.status === 'assigned'
                                  ? 'bg-blue-900 text-white border-blue-950'
                                  : ticket.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-250'
                                    : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </div>

                          <p className="text-slate-600 leading-normal text-xs line-clamp-2">
                            {ticket.description}
                          </p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-150 text-[10.5px] text-slate-500 font-mono">
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Student Submitter</span>
                              <strong className="text-slate-800 font-sans">{ticket.studentName}</strong>
                              <span className="block text-[9.5px]">{ticket.enrollmentNumber || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Destination</span>
                              <strong className="text-blue-900 font-sans">{getDepartmentName(ticket.departmentKey)}</strong>
                              <span className="block uppercase">[{ticket.departmentKey}]</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Assigned Officer</span>
                              <strong className="text-slate-800 font-sans">{ticket.officerName || 'Unassigned Queue'}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[9px] uppercase">Expected Resolution</span>
                              <span className="text-slate-700 font-sans font-bold">{expectedResolution}</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1">
                            <span>Submitted: {new Date(ticket.createdAt).toLocaleString()}</span>
                            <span>{ageInHours === 0 ? 'Submitted just now' : `${ageInHours} hours elapsed`}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Section 2: Live System Notifications Feed (4 columns) */}
              <div className="lg:col-span-4 bg-white border border-slate-200 p-6 flex flex-col justify-between">
                <div>
                  <div className="border-b pb-3 mb-4">
                    <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-slate-500" />
                      Operations System Log
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 font-semibold">Consolidated timeline activities audit feed</p>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[380px] pr-1">
                    {(() => {
                      const allLogs: any[] = [];
                      allTickets.forEach(t => {
                        if (Array.isArray(t.timeline)) {
                          t.timeline.forEach((ev: any) => {
                            allLogs.push({
                              ...ev,
                              ticketId: t.id,
                              ticketSubject: t.subject,
                              ticketType: t.requestType
                            });
                          });
                        }
                      });

                      // Sort reverse chronological
                      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                      if (allLogs.length === 0) {
                        return (
                          <div className="text-center py-12 text-slate-405 italic">
                            No operations logs compiled yet.
                          </div>
                        );
                      }

                      return allLogs.slice(0, 6).map((log, index) => {
                        const dateObj = new Date(log.timestamp);
                        return (
                          <div key={index} className="relative pl-5 border-l border-slate-200 pb-3 last:pb-0 text-[11px]">
                            {/* Bullet dot */}
                            <span className={`absolute -left-[5.5px] top-1.5 w-2.5 h-2.5 rounded-full border border-white ${
                              log.step === 'submitted'
                                ? 'bg-sky-500'
                                : log.step === 'assigned'
                                  ? 'bg-yellow-500'
                                  : log.step === 'resolved'
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400'
                            }`} />
                            
                            <div className="flex justify-between items-start font-semibold text-slate-800">
                              <span className="font-bold text-slate-900">{log.title}</span>
                              <span className="text-[9px] font-mono text-slate-400">{dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="text-[10px] text-slate-550 italic mt-0.5">"{log.subtitle}"</p>
                            
                            <div className="flex justify-between items-center text-[9.5px] font-mono text-slate-400 mt-1">
                              <span>Actor: <strong className="text-slate-650">{log.actor}</strong></span>
                              <span>Ref: #{log.ticketId.substring(0, 6)}</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 mt-4 text-[10px] text-slate-500 leading-normal">
                  <strong>Network Reconcilation</strong>: System status metrics refresh silently in the background. Submit feedback loops to automatically finalize resolved tickets.
                </div>
              </div>

            </div>

            {/* Analytical Visualization Charts Section */}
            <div className="bg-white border border-slate-200 p-6 space-y-6">
              <div className="border-b pb-3 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider">Institution Analytical Indicators</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Custom SVG real-time visual trends</p>
                </div>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500"><Check className="w-3.5 h-3.5 text-emerald-600" /> Auto-Generated</span>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-6">
                
                {/* Chart 1: Daily Ticket Trend Area SVG */}
                <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-2">Daily Submission Trend</span>
                  
                  {(() => {
                    const days = Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      return d.toISOString().split('T')[0];
                    }).reverse();

                    const trend = days.map(dayStr => {
                      const count = allTickets.filter(t => t.createdAt && t.createdAt.startsWith(dayStr)).length;
                      return { label: dayStr.split('-')[2], count };
                    });

                    const maxCount = Math.max(...trend.map(t => t.count), 4);
                    const width = 240;
                    const height = 100;
                    
                    const points = trend.map((t, i) => {
                      const x = (i / 6) * (width - 20) + 10;
                      const y = height - 15 - (t.count / maxCount) * (height - 30);
                      return `${x},${y}`;
                    }).join(' ');

                    const fillPoints = `10,${height - 15} ${points} ${width - 10},${height - 15}`;

                    return (
                      <div className="space-y-2">
                        <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
                          {/* Grid line */}
                          <line x1="10" y1="15" x2={width - 10} y2="15" stroke="#e2e8f0" strokeDasharray="2" />
                          <line x1="10" y1={height - 15} x2={width - 10} y2={height - 15} stroke="#cbd5e1" />
                          
                          {/* Area Fill */}
                          <polygon points={fillPoints} fill="#dbeafe" fillOpacity="0.6" />
                          {/* Polyline path */}
                          <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          
                          {/* Dots */}
                          {trend.map((t, i) => {
                            const x = (i / 6) * (width - 20) + 10;
                            const y = height - 15 - (t.count / maxCount) * (height - 30);
                            return (
                              <g key={i}>
                                <circle cx={x} cy={y} r="3" fill="#1e3a8a" />
                                <text x={x} y={y - 6} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0f172a">{t.count}</text>
                              </g>
                            );
                          })}
                        </svg>
                        
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          {trend.map((t, i) => (
                            <span key={i}>{t.label}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <span className="text-[9.5px] text-slate-400 block mt-2 font-mono">7-day active load curves</span>
                </div>

                {/* Chart 2: Complaints vs Help Desk categories */}
                <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-2">Category Ratio</span>
                  <div className="flex justify-center items-center py-2">
                    {/* SVG Donut */}
                    {(() => {
                      const total = totalMeters.totalRequests || 1;
                      const complaintsPct = Math.round(((totalMeters.complaintsCount || 0) / total) * 100);
                      const helpPct = 100 - complaintsPct;
                      const radius = 30;
                      const circ = 2 * Math.PI * radius;
                      const strokeDash = (complaintsPct / 100) * circ;

                      return (
                        <div className="flex items-center gap-4">
                          <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
                            {/* Background Circle */}
                            <circle cx="40" cy="40" r={radius} fill="none" stroke="#0ea5e9" strokeWidth="12" />
                            {/* Foreground Circle */}
                            <circle cx="40" cy="40" r={radius} fill="none" stroke="#dc2626" strokeWidth="12"
                              strokeDasharray={`${strokeDash} ${circ}`} />
                          </svg>
                          <div className="space-y-1 font-mono text-[9px]">
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
                  <span className="text-[9.5px] text-slate-400 block mt-2 font-mono">Distribution of logged types</span>
                </div>

                {/* Chart 3: Satisfaction Gauge SVG Radial */}
                <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-2">Satisfaction Score</span>
                  
                  {(() => {
                    // Compute global average satisfaction
                    let totalRating = 0;
                    let count = 0;
                    allTickets.forEach(t => {
                      if (t.feedback && typeof t.feedback.rating === 'number') {
                        totalRating += t.feedback.rating;
                        count++;
                      }
                    });
                    const avgRating = count > 0 ? parseFloat((totalRating / count).toFixed(1)) : 4.5;
                    const ratingPct = (avgRating / 5) * 100;
                    
                    const circ = 2 * Math.PI * 30;
                    const strokeDash = (ratingPct / 100) * circ;

                    return (
                      <div className="flex items-center justify-around">
                        <div className="relative flex items-center justify-center">
                          <svg width="70" height="70" viewBox="0 0 80 80" className="transform -rotate-90">
                            <circle cx="40" cy="40" r="30" fill="none" stroke="#cbd5e1" strokeWidth="6" />
                            <circle cx="40" cy="40" r="30" fill="none" stroke="#059669" strokeWidth="6"
                              strokeDasharray={`${strokeDash} ${circ}`} />
                          </svg>
                          <span className="absolute text-sm font-black text-slate-800">{avgRating}★</span>
                        </div>
                        <div className="text-[10px] font-sans text-slate-600">
                          <strong className="block text-emerald-700">Excellent resolution</strong>
                          <span>Based on {count} reviews</span>
                        </div>
                      </div>
                    );
                  })()}
                  <span className="text-[9.5px] text-slate-400 block mt-2 font-mono">Students verified feedback index</span>
                </div>

                {/* Chart 4: Department Case Load Distribution SVG Bar */}
                <div className="bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider mb-2">Top Active Channels</span>
                  
                  <div className="space-y-1.5">
                    {analytics?.departmentStats?.slice(0, 3).map((dept: any, i: number) => {
                      const total = totalMeters.totalRequests || 1;
                      const pct = Math.round((dept.total / total) * 100);
                      return (
                        <div key={i} className="text-[9px]">
                          <div className="flex justify-between font-mono text-slate-500">
                            <span className="truncate max-w-[120px] font-sans font-bold">{dept.name}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 mt-0.5">
                            <div className="h-full bg-blue-900" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[9.5px] text-slate-400 block mt-2 font-mono">Workloads ranking representation</span>
                </div>

              </div>
            </div>

            {/* Department Performance Dashboard Section */}
            <div className="bg-white border border-slate-200 p-6 space-y-4">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider">Department Performance Directory</h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Performance index and service response velocity of university blocks</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase border-b border-slate-200">
                      <th className="p-3">Department block</th>
                      <th className="p-3 text-center">Grievances</th>
                      <th className="p-3 text-center">Help request</th>
                      <th className="p-3 text-center">Awaiting Action</th>
                      <th className="p-3 text-center">Assigned status</th>
                      <th className="p-3 text-center">Successfully Cleared</th>
                      <th className="p-3 text-right">Avg Response Speed</th>
                      <th className="p-3 text-right">Avg Resolution Speed</th>
                      <th className="p-3 text-center">Student Score</th>
                      <th className="p-3 text-right">Last System Sync</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {analytics?.departmentStats ? (
                      analytics.departmentStats.map((dept: any) => {
                        const hasExcessivePending = dept.pending > 3;
                        return (
                          <tr 
                            key={dept.key} 
                            className={`hover:bg-slate-50/50 transition-colors ${
                              hasExcessivePending ? 'bg-amber-50/40 border-l-2 border-amber-500' : ''
                            }`}
                          >
                            <td className="p-3">
                              <span className="font-black text-slate-900 block">{dept.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 uppercase">Slug key: {dept.key}</span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold">{dept.totalComplaints || 0}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-500">{dept.totalHelp || 0}</td>
                            <td className="p-3 text-center font-mono">
                              <span className={`px-1.5 py-0.5 font-bold ${
                                hasExcessivePending 
                                  ? 'bg-rose-100 text-rose-800 animate-pulse font-black' 
                                  : dept.pending > 0 
                                    ? 'bg-yellow-100 text-yellow-800' 
                                    : 'bg-slate-100 text-slate-400'
                              }`}>
                                {dept.pending} {hasExcessivePending && '⚠️ CRITICAL'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-blue-900">{dept.inProgress || 0}</td>
                            <td className="p-3 text-center font-mono">
                              <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 font-bold border border-emerald-100">
                                {dept.resolved}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">{dept.avgResponseTime || '4.0'} hrs</td>
                            <td className="p-3 text-right font-mono text-slate-600 font-bold">{dept.avgResolutionTime || '12.5'} hrs</td>
                            <td className="p-3 text-center">
                              <span className="text-amber-500 font-bold">
                                {dept.satisfactionRating > 0 ? `★ ${dept.satisfactionRating}` : '★ 4.8'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {dept.lastActivityTime ? new Date(dept.lastActivityTime).toLocaleDateString() : 'ActiveSync'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-slate-400 font-mono">
                          Loading active department performance registries...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Complaint Overview Searchable Table / Ledger */}
            <div className="bg-white border-2 border-slate-900 p-6 space-y-4">
              <div className="border-b pb-3 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider">Student Complaint & Help Ledger</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Audit master control directory representing every logged event</p>
                </div>
                
                {/* Advanced Quick Filters */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                  <select 
                    value={opsStatusFilter}
                    onChange={(e) => setOpsStatusFilter(e.target.value)}
                    className="border border-slate-300 bg-slate-50 px-2 py-1 outline-none font-sans font-bold"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  <select 
                    value={opsPriorityFilter}
                    onChange={(e) => setOpsPriorityFilter(e.target.value)}
                    className="border border-slate-300 bg-slate-50 px-2 py-1 outline-none font-sans font-bold"
                  >
                    <option value="all">All Urgency Levels</option>
                    <option value="low">Low Urgency</option>
                    <option value="medium">Medium Urgency</option>
                    <option value="high">High Urgency</option>
                    <option value="urgent">Urgent Escalations</option>
                  </select>

                  <select 
                    value={opsDeptFilter}
                    onChange={(e) => setOpsDeptFilter(e.target.value)}
                    className="border border-slate-300 bg-slate-50 px-2 py-1 outline-none font-sans font-bold uppercase"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(d => (
                      <option key={d.key} value={d.key}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic search and date range row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] font-mono">
                <div className="md:col-span-2 relative">
                  <input
                    type="text"
                    placeholder="Search by Student Name, Subject, Ticket reference ID, assigned staff..."
                    value={opsSearchQuery}
                    onChange={(e) => setOpsSearchQuery(e.target.value)}
                    className="w-full text-xs py-2 pl-3 pr-8 border border-slate-250 bg-slate-50 outline-none font-sans"
                  />
                  <FileSearch className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                </div>
                <div>
                  <div className="flex items-center bg-slate-50 border border-slate-250 px-2">
                    <span className="text-[9px] text-slate-400 uppercase mr-1.5">Start</span>
                    <input
                      type="date"
                      value={opsStartDate}
                      onChange={(e) => setOpsStartDate(e.target.value)}
                      className="w-full text-[10px] py-1 bg-transparent outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center bg-slate-50 border border-slate-250 px-2">
                    <span className="text-[9px] text-slate-400 uppercase mr-1.5">End</span>
                    <input
                      type="date"
                      value={opsEndDate}
                      onChange={(e) => setOpsEndDate(e.target.value)}
                      className="w-full text-[10px] py-1 bg-transparent outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="overflow-x-auto border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-mono text-[10px] uppercase border-b border-slate-200">
                      <th className="p-3">Reference ID</th>
                      <th className="p-3">Student Submitter</th>
                      <th className="p-3">Grievance / Subject</th>
                      <th className="p-3">Channel / Dept</th>
                      <th className="p-3 text-center">Urgency</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3">Assigned staff</th>
                      <th className="p-3">Logged Date</th>
                      <th className="p-3 text-right">Actions Panel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {(() => {
                      let filtered = [...allTickets];

                      // Search filter
                      if (opsSearchQuery) {
                        const q = opsSearchQuery.toLowerCase();
                        filtered = filtered.filter(t => 
                          t.id.toLowerCase().includes(q) ||
                          t.studentName.toLowerCase().includes(q) ||
                          t.subject.toLowerCase().includes(q) ||
                          (t.officerName && t.officerName.toLowerCase().includes(q)) ||
                          t.departmentKey.toLowerCase().includes(q)
                        );
                      }

                      // Status filter
                      if (opsStatusFilter !== 'all') {
                        filtered = filtered.filter(t => t.status === opsStatusFilter);
                      }

                      // Priority filter
                      if (opsPriorityFilter !== 'all') {
                        filtered = filtered.filter(t => t.priority === opsPriorityFilter);
                      }

                      // Dept filter
                      if (opsDeptFilter !== 'all') {
                        filtered = filtered.filter(t => t.departmentKey === opsDeptFilter);
                      }

                      // Date range filters
                      if (opsStartDate) {
                        filtered = filtered.filter(t => t.createdAt && t.createdAt.substring(0, 10) >= opsStartDate);
                      }
                      if (opsEndDate) {
                        filtered = filtered.filter(t => t.createdAt && t.createdAt.substring(0, 10) <= opsEndDate);
                      }

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="p-6 text-center text-slate-405 italic">
                              No tickets matched the search criteria or filters.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">{t.id.substring(0, 8)}...</td>
                          <td className="p-3">
                            <span className="font-extrabold text-slate-900 block">{t.studentName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{t.studentId}@campusconnect.edu</span>
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[8.5px] uppercase font-bold px-1 ${
                                t.requestType === 'complaint' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                              }`}>{t.requestType}</span>
                              <strong className="text-slate-850 truncate block">{t.subject}</strong>
                            </div>
                            <span className="text-slate-500 line-clamp-1 mt-0.5">{t.description}</span>
                          </td>
                          <td className="p-3 font-mono uppercase font-bold text-blue-900">{t.departmentKey}</td>
                          <td className="p-3 text-center">
                            <span className={`px-1.5 py-0.2 text-[9px] uppercase font-bold border ${
                              t.priority === 'urgent'
                                ? 'bg-rose-600 text-white border-rose-700'
                                : t.priority === 'high'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : t.priority === 'low'
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-150'
                            }`}>
                              {t.priority || 'medium'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-1.5 py-0.2 text-[9px] uppercase tracking-wider font-extrabold border ${
                              t.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800 border-yellow-250'
                                : t.status === 'in_progress' || t.status === 'assigned'
                                  ? 'bg-blue-900 text-white border-blue-950'
                                  : t.status === 'resolved'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-250'
                                    : 'bg-slate-200 text-slate-650 border-slate-300'
                            }`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {t.officerName ? (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-blue-900" /> {t.officerName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Queue Pending</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedTicket(t);
                                  setIsDetailModalOpen(true);
                                }}
                                className="p-1 text-slate-800 hover:bg-slate-200 border border-slate-300"
                                title="View Dossier Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Dropdown / Selection actions for Super Admin */}
                              <select
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  if (val.startsWith('assign:')) {
                                    handleAssignOfficer(t.id, val.replace('assign:', ''));
                                  } else if (val.startsWith('dept:')) {
                                    setReassignDeptKey(val.replace('dept:', ''));
                                    handleReassign(t.id);
                                  } else if (val.startsWith('priority:')) {
                                    handleUpdatePriority(t.id, val.replace('priority:', ''));
                                  }
                                  e.target.value = '';
                                }}
                                className="text-[10px] border border-slate-300 bg-white font-mono rounded-none outline-none max-w-[100px]"
                              >
                                <option value="">Actions</option>
                                <optgroup label="Assign Officer">
                                  {staffList
                                    .filter(s => s.role === 'staff' && s.departmentKey === t.departmentKey)
                                    .map(s => (
                                      <option key={s.id} value={`assign:${s.id}`}>Assign to {s.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Reassign Dept">
                                  {departments
                                    .filter(d => d.key !== t.departmentKey)
                                    .map(d => (
                                      <option key={d.key} value={`dept:${d.key}`}>{d.name}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Mark Priority">
                                  <option value="priority:low">Set Low</option>
                                  <option value="priority:medium">Set Medium</option>
                                  <option value="priority:high">Set High</option>
                                  <option value="priority:urgent">Set Urgent</option>
                                </optgroup>
                              </select>

                              <button
                                onClick={() => handleExportTicket(t)}
                                className="p-1 text-slate-600 hover:bg-blue-50 border border-slate-200"
                                title="Export Dossier Payload"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handlePrintTicket(t)}
                                className="p-1 text-slate-600 hover:bg-blue-50 border border-slate-200"
                                title="Print Document"
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Department Officer Activity Directory */}
            <div className="bg-white border border-slate-200 p-6 space-y-4">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-wider flex items-center gap-2">
                  <UserCheck className="w-4.5 h-4.5 text-blue-900" />
                  Department Officer Activity
                </h3>
                <p className="text-[10px] text-slate-405 font-mono mt-0.5">Assigned workloads and performance directory of individual department coordinators</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics?.officerStats && analytics.officerStats.length > 0 ? (
                  analytics.officerStats.map((officer: any) => (
                    <div key={officer.id} className="bg-slate-50 border border-slate-200 p-4 space-y-3 relative">
                      <div className="flex justify-between items-start border-b pb-2">
                        <div>
                          <strong className="text-slate-900 font-extrabold text-xs block">{officer.name}</strong>
                          <span className="text-[9.5px] font-mono uppercase text-slate-405 block mt-0.5">
                            Dept: {officer.departmentKey.toUpperCase()} ({getDepartmentName(officer.departmentKey)})
                          </span>
                        </div>
                        <span className="text-[9.5px] bg-blue-50 text-blue-900 px-1 border border-blue-200 font-mono font-bold">
                          {officer.assignedTicketsCount} Cases
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-[10.5px] font-mono">
                        <div className="bg-white p-1.5 border border-slate-150">
                          <span className="text-slate-400 block text-[8px] uppercase">Pending</span>
                          <strong className="text-yellow-600">{officer.pendingTicketsCount}</strong>
                        </div>
                        <div className="bg-white p-1.5 border border-slate-150">
                          <span className="text-slate-400 block text-[8px] uppercase">Resolved</span>
                          <strong className="text-emerald-600">{officer.completedTicketsCount}</strong>
                        </div>
                        <div className="bg-white p-1.5 border border-slate-150">
                          <span className="text-slate-400 block text-[8px] uppercase">Avg Speed</span>
                          <strong className="text-slate-700">{officer.avgResolutionTime || '8.5'}h</strong>
                        </div>
                      </div>

                      <div className="text-[9.5px] text-slate-405 font-mono pt-1 space-y-0.5">
                        <div className="flex justify-between">
                          <span>Last login:</span>
                          <span className="text-slate-700">{officer.lastLogin ? new Date(officer.lastLogin).toLocaleString() : 'Recent Session'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Active:</span>
                          <span className="text-slate-700">{officer.lastActivity ? new Date(officer.lastActivity).toLocaleString() : 'Syncing'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-6 text-slate-400 italic">
                    No active staff officer metrics registered in the system.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ----------------- TAB: DEPARTMENTS MANAGER ----------------- */}
        {activeTab === 'departments' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start animate-fade-in">
            
            {/* View List */}
            <div className="lg:col-span-7 bg-white border border-slate-200 p-6 space-y-4">
              <h3 className="font-extrabold text-sm uppercase text-slate-900 border-b pb-2">Active Channels (Departments)</h3>
              
              <div className="divide-y divide-slate-150">
                {departments.map((dept) => (
                  <div key={dept.key} className="py-4 space-y-2">
                    <div className="flex justify-between items-start gap-4 text-xs">
                      <div className="space-y-1 max-w-md">
                        <div className="flex items-center gap-2">
                          {dept.logo && (
                            <img src={dept.logo} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                          )}
                          <h4 className="font-black text-sm text-blue-900">{dept.name}</h4>
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            dept.status === 'inactive' 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {dept.status || 'active'}
                          </span>
                        </div>
                        <p className="text-slate-500 leading-normal">{dept.description}</p>
                        
                        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-slate-600 pt-1">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {dept.officialPhone}</span>
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {dept.officialEmail}</span>
                          {dept.additionalEmails && (
                            <span className="flex items-center gap-1 text-[10.5px] text-slate-500 font-sans">
                              <strong>Additional CC:</strong> {dept.additionalEmails}
                            </span>
                          )}
                          {dept.head && (
                            <span className="text-slate-500 font-sans font-semibold">Head: {dept.head}</span>
                          )}
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-200 p-2 mt-2 space-y-0.5 max-w-sm rounded-none font-mono text-[10.5px]">
                          <span className="block text-[8.5px] uppercase font-bold text-slate-400 tracking-wider">Department Credentials</span>
                          <div className="flex gap-4">
                            <span>Username: <strong className="text-slate-800">{dept.username || 'Not set'}</strong></span>
                            <span>Password: <span className="text-emerald-700 font-bold italic">●●●●●●●● (Encrypted)</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => startEditDepartment(dept)}
                          className="py-1 px-2.5 text-blue-800 bg-blue-50 border border-blue-200 text-[10px] font-bold uppercase tracking-wider hover:bg-blue-100 transition-colors"
                        >
                          Edit Details
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept.id || dept.key, dept.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-250 transition-colors"
                          title="De-configure Channel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Toggle button to manage Sub-departments */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDeptForSubDepts === dept.key) {
                            setSelectedDeptForSubDepts(null);
                          } else {
                            setSelectedDeptForSubDepts(dept.key);
                            // Clear form states
                            setSubDeptName('');
                            setSubDeptHeadName('');
                            setSubDeptEmail('');
                            setSubDeptPhone('');
                            setSubDeptLocation('');
                            setSubDeptDesc('');
                            setSubDeptStatus('active');
                            setIsEditingSubDept(null);
                            setIsSubFormOpen(false);
                          }
                        }}
                        className="py-1 px-2.5 text-indigo-850 bg-indigo-50 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Settings className="w-3.5 h-3.5 text-indigo-650 animate-spin-slow" />
                        {selectedDeptForSubDepts === dept.key ? 'Hide Sub-Departments' : 'Manage Sub-Departments'}
                      </button>
                    </div>

                    {selectedDeptForSubDepts === dept.key && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 space-y-4 animate-fade-in w-full">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                          <h5 className="font-extrabold text-xs uppercase tracking-wider text-indigo-950">
                            Sub-Departments of {dept.name}
                          </h5>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSubFormOpen(!isSubFormOpen);
                              if (isSubFormOpen) {
                                setIsEditingSubDept(null);
                                setSubDeptName('');
                                setSubDeptHeadName('');
                                setSubDeptEmail('');
                                setSubDeptPhone('');
                                setSubDeptLocation('');
                                setSubDeptDesc('');
                                setSubDeptStatus('active');
                              }
                            }}
                            className="py-1 px-2 text-[10px] uppercase font-extrabold tracking-wider bg-indigo-600 text-white hover:bg-indigo-750 transition-colors"
                          >
                            {isSubFormOpen ? 'View List' : '+ Add Sub-Department'}
                          </button>
                        </div>

                        {isSubFormOpen ? (
                          <form onSubmit={handleCreateOrUpdateSubDept} className="space-y-3 bg-white p-3 border border-slate-200">
                            <h6 className="font-extrabold text-[11px] uppercase text-indigo-900">
                              {isEditingSubDept ? 'Edit Sub-Department' : 'Create Sub-Department'}
                            </h6>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Name</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="E.g. Computer Science Engineering"
                                  value={subDeptName}
                                  onChange={e => setSubDeptName(e.target.value)}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Head of Sub-Dept (HOD/Section In-charge)</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="E.g. Dr. Jane Smith"
                                  value={subDeptHeadName}
                                  onChange={e => setSubDeptHeadName(e.target.value)}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Official Email</label>
                                <input
                                  type="email"
                                  required
                                  placeholder="E.g. cse.hod@college.edu"
                                  value={subDeptEmail}
                                  onChange={e => setSubDeptEmail(e.target.value)}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Contact Number</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="E.g. +91 9876543210"
                                  value={subDeptPhone}
                                  onChange={e => setSubDeptPhone(e.target.value)}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Office Location</label>
                                <input
                                  type="text"
                                  placeholder="E.g. Block C, 3rd Floor"
                                  value={subDeptLocation}
                                  onChange={e => setSubDeptLocation(e.target.value)}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Status</label>
                                <select
                                  value={subDeptStatus}
                                  onChange={e => setSubDeptStatus(e.target.value as 'active' | 'inactive')}
                                  className="w-full p-2 border border-slate-200 font-sans focus:outline-indigo-600 text-slate-800"
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Disabled (Inactive)</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Description / Notes</label>
                              <textarea
                                placeholder="Describe the responsibilities or sections of this sub-department..."
                                value={subDeptDesc}
                                onChange={e => setSubDeptDesc(e.target.value)}
                                className="w-full p-2 border border-slate-200 font-sans text-xs focus:outline-indigo-600 h-16 text-slate-800"
                              />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSubFormOpen(false);
                                  setIsEditingSubDept(null);
                                  setSubDeptName('');
                                  setSubDeptHeadName('');
                                  setSubDeptEmail('');
                                  setSubDeptPhone('');
                                  setSubDeptLocation('');
                                  setSubDeptDesc('');
                                  setSubDeptStatus('active');
                                }}
                                className="py-1 px-3 text-[10px] uppercase font-bold text-slate-500 hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="py-1 px-3 text-[10px] uppercase font-extrabold tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                {isEditingSubDept ? 'Save Changes' : 'Create'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="space-y-2">
                            {subDepartments.filter(s => s.departmentKey === dept.key).length === 0 ? (
                              <p className="text-slate-400 italic text-[11px] py-2 text-center">
                                No sub-departments defined yet. Create one to organize this channel.
                              </p>
                            ) : (
                              <div className="border border-slate-200 bg-white divide-y divide-slate-150">
                                {subDepartments
                                  .filter(s => s.departmentKey === dept.key)
                                  .map((sub: any) => (
                                    <div key={sub.id} className="p-3 flex justify-between items-start gap-4 hover:bg-slate-50 transition-colors text-[11px]">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <strong className="text-slate-900 text-xs">{sub.name}</strong>
                                          <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                            sub.status === 'inactive' 
                                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {sub.status || 'active'}
                                          </span>
                                        </div>
                                        {sub.description && (
                                          <p className="text-slate-500 italic max-w-lg leading-relaxed">{sub.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-slate-600 pt-1">
                                          <span><strong>Head:</strong> {sub.headName}</span>
                                          <span><strong>Location:</strong> {sub.officeLocation || 'N/A'}</span>
                                          <span><strong>Email:</strong> {sub.officialEmail}</span>
                                          <span><strong>Phone:</strong> {sub.contactNumber}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSubDeptStatus(sub)}
                                          className={`px-2 py-1 border text-[9px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer ${
                                            sub.status === 'inactive'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                          }`}
                                        >
                                          {sub.status === 'inactive' ? 'Enable' : 'Disable'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleEditSubDeptStart(sub)}
                                          className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold uppercase tracking-wider hover:bg-blue-100 cursor-pointer"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSubDept(sub.id, sub.name)}
                                          className="text-rose-600 hover:bg-rose-50 p-1 rounded border border-transparent hover:border-rose-200 cursor-pointer"
                                          title="Delete Sub-Department"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Spawn Form */}
            <div className="lg:col-span-5 bg-white border-2 border-slate-900 p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-extrabold text-sm uppercase text-blue-900">
                  {editingDept ? 'Edit Channel Details' : 'Create Custom Channel'}
                </h3>
                {editingDept && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDept(null);
                      setNewDeptKey('');
                      setNewDeptName('');
                      setNewDeptPhone('');
                      setNewDeptEmail('');
                      setNewDeptAdditionalEmails('');
                      setNewDeptDesc('');
                    }}
                    className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              
              <form onSubmit={editingDept ? handleEditDepartmentSubmit : handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Department Slug Key (unique)</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingDept}
                    placeholder="E.g. library or sports block"
                    value={newDeptKey}
                    onChange={(e) => setNewDeptKey(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none uppercase font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Official Office Name</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Library Department"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Official Phone Contact</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. +1 (555) 0122"
                    value={newDeptPhone}
                    onChange={(e) => setNewDeptPhone(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Official Email Channel</label>
                  <input
                    type="email"
                    required
                    placeholder="E.g. library@campusconnect.edu"
                    value={newDeptEmail}
                    onChange={(e) => setNewDeptEmail(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Additional Notification Emails (comma-separated, optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. hod@institution.edu, coordinator@institution.edu"
                    value={newDeptAdditionalEmails}
                    onChange={(e) => setNewDeptAdditionalEmails(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Short Functional Description</label>
                  <textarea
                    rows={2}
                    placeholder="E.g. Handles borrowing queries, fine structures, digital archive clearances, and portal lockouts."
                    value={newDeptDesc}
                    onChange={(e) => setNewDeptDesc(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Department Head</label>
                  <input
                    type="text"
                    placeholder="E.g. Dr. Jane Smith"
                    value={newDeptHead}
                    onChange={(e) => setNewDeptHead(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Department Login Username</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. library_dept"
                    value={newDeptUsername}
                    onChange={(e) => setNewDeptUsername(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider flex justify-between items-center">
                    <span>{editingDept ? 'Change Password (leave empty to keep current)' : 'Department Login Password'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = Array.from({length: 10}, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'.charAt(Math.floor(Math.random() * 70))).join('');
                        setNewDeptPassword(suggested);
                      }}
                      className="text-[9px] text-blue-800 hover:underline font-bold uppercase cursor-pointer"
                    >
                      Generate Password
                    </button>
                  </label>
                  <input
                    type="text"
                    required={!editingDept}
                    placeholder={editingDept ? "Minimum 4 characters or blank" : "Minimum 4 characters"}
                    value={newDeptPassword}
                    onChange={(e) => setNewDeptPassword(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Channel Status (Login Enabled)</label>
                  <select
                    value={newDeptStatus}
                    onChange={(e) => setNewDeptStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none cursor-pointer text-slate-900"
                  >
                    <option value="active">Active (Login enabled)</option>
                    <option value="inactive">Inactive (Login disabled)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Logo URL or Base64 (optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. https://url/to/logo.png"
                    value={newDeptLogo}
                    onChange={(e) => setNewDeptLogo(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isDeptSubmitting}
                  className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-none shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isDeptSubmitting ? (editingDept ? 'Saving Changes...' : 'Establishing Channel...') : (editingDept ? 'Save Channel Changes' : 'Publish Department')}
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ----------------- TAB: MANAGE STAFF ----------------- */}
        {activeTab === 'staff' && (
          <div className="space-y-8 animate-fade-in text-xs text-slate-800">
            
            {/* Real-time Status Counters & Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4">
              <div className="bg-white p-3 border border-slate-200 shadow-xs">
                <span className="block text-[9px] uppercase font-black text-slate-400">Total Registered Staff</span>
                <span className="text-xl font-extrabold text-slate-900">{staffList.length}</span>
              </div>
              <div className="bg-white p-3 border border-slate-200 shadow-xs">
                <span className="block text-[9px] uppercase font-black text-slate-400">Active Staff</span>
                <span className="text-xl font-extrabold text-emerald-700">{staffList.filter(s => s.status !== 'inactive').length}</span>
              </div>
              
              {/* Search input */}
              <div className="flex flex-col justify-center bg-white p-3 border border-slate-200 shadow-xs">
                <label className="text-[9px] uppercase font-black text-slate-400 mb-1">Search Staff Directory</label>
                <input
                  type="text"
                  placeholder="Search by name, ID or email..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="w-full text-xs py-1 px-2 border border-slate-250 bg-white outline-none text-slate-900 font-mono"
                />
              </div>

              {/* Department filter */}
              <div className="flex flex-col justify-center bg-white p-3 border border-slate-200 shadow-xs">
                <label className="text-[9px] uppercase font-black text-slate-400 mb-1">Filter by Department</label>
                <select
                  value={staffFilterDept}
                  onChange={(e) => setStaffFilterDept(e.target.value)}
                  className="w-full text-xs py-1 px-2 border border-slate-250 bg-white outline-none cursor-pointer text-slate-850 font-mono"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.key} value={dept.key}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Side: Staff Registry */}
              <div className="lg:col-span-8 bg-white border border-slate-200 p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-900" />
                    Department Staff Registry
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 uppercase tracking-wider font-extrabold text-[10px] text-slate-455">
                        <th className="py-2.5">Staff Member</th>
                        <th className="py-2.5">Employee ID</th>
                        <th className="py-2.5">Contact Details</th>
                        <th className="py-2.5">Department</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {staffList
                        .filter(s => {
                          const matchesDept = !staffFilterDept || s.departmentKey === staffFilterDept;
                          const query = staffSearchQuery.toLowerCase().trim();
                          const matchesQuery = !query || 
                            s.name.toLowerCase().includes(query) || 
                            s.email.toLowerCase().includes(query) || 
                            (s.employeeId && s.employeeId.toLowerCase().includes(query)) ||
                            (s.designation && s.designation.toLowerCase().includes(query));
                          return matchesDept && matchesQuery;
                        })
                        .map((staff) => {
                          const filteredDept = departments.find(d => d.key === staff.departmentKey);
                          
                          return (
                            <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 pr-2">
                                <div className="font-bold text-slate-900">{staff.name}</div>
                                <div className="text-[10px] text-slate-500">{staff.designation || 'Staff'}</div>
                              </td>
                              <td className="py-3 font-mono text-[11px] pr-2 text-slate-800">
                                {staff.employeeId || 'N/A'}
                              </td>
                              <td className="py-3 pr-2 space-y-0.5 text-slate-700">
                                <div>{staff.email}</div>
                                {staff.phone && <div className="text-[10px] text-slate-500 font-mono">{staff.phone}</div>}
                              </td>
                              <td className="py-3 pr-2">
                                <span className="bg-blue-50 text-blue-900 border border-blue-200 font-bold px-1.5 py-0.5 text-[9.5px] uppercase font-mono">
                                  {filteredDept ? filteredDept.name : staff.departmentKey}
                                </span>
                              </td>
                              <td className="py-3 pr-2">
                                <span className={`px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase border rounded-xs ${
                                  staff.status === 'inactive' 
                                    ? 'bg-rose-100 text-rose-800 border-rose-200' 
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}>
                                  {staff.status || 'active'}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => startEditStaff(staff)}
                                    className="py-1 px-2 text-blue-850 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold uppercase cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                    className="py-1 px-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold uppercase cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {staffList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                            No staff profiles registered yet. Start by filling the form on the right.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Create or Edit Staff Form */}
              <div className="lg:col-span-4 bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-extrabold text-sm uppercase text-blue-900">
                    {editingStaffId ? 'Edit Staff Profile' : 'Register New Staff'}
                  </h3>
                  {editingStaffId && (
                    <button
                      type="button"
                      onClick={cancelEditStaff}
                      className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                
                <form onSubmit={handleSaveStaff} className="space-y-4">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Dr. Robert Vance"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Employee ID (unique)</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. EMP-2026-99"
                      value={newStaffEmployeeId}
                      onChange={(e) => setNewStaffEmployeeId(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Official Email</label>
                    <input
                      type="email"
                      required
                      placeholder="E.g. robert@campusconnect.edu"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Phone Number</label>
                    <input
                      type="text"
                      placeholder="E.g. +1 (555) 0199"
                      value={newStaffPhone}
                      onChange={(e) => setNewStaffPhone(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Assigned Department</label>
                    <select
                      required
                      value={newStaffDept}
                      onChange={(e) => setNewStaffDept(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none cursor-pointer text-slate-900"
                    >
                      <option value="" disabled>-- Select Department --</option>
                      {departments.map((dept) => (
                        <option key={dept.key} value={dept.key}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Designation / Role Description</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Senior Librarian"
                      value={newStaffDesignation}
                      onChange={(e) => setNewStaffDesignation(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-455 mb-1 tracking-wider">Employment Status</label>
                    <select
                      value={newStaffStatus}
                      onChange={(e) => setNewStaffStatus(e.target.value as 'active' | 'inactive')}
                      className="w-full text-xs py-2 px-3 border border-slate-250 bg-slate-50 outline-none cursor-pointer text-slate-900"
                    >
                      <option value="active">Active (On Duty)</option>
                      <option value="inactive">Inactive (Suspended)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isStaffSubmitting}
                    className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-none shadow-md disabled:opacity-50 cursor-pointer"
                  >
                    {isStaffSubmitting ? 'Processing...' : (editingStaffId ? 'Update Staff Member' : 'Register Staff Member')}
                  </button>
                </form>
              </div>

            </div>

            {/* Bottom Row: Full-width live security logs and audit trails */}
            <div className="bg-white border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-2">
                <div>
                  <h3 className="font-extrabold text-sm uppercase text-slate-900 tracking-tight flex items-center gap-1.5 font-mono">
                    <Activity className="w-4 h-4 text-slate-700" />
                    Administrative Security Audit Logs
                  </h3>
                  <p className="text-[10px] text-slate-400">Chronological history of account adjustments, credential resets, lockouts, and compliance.</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-450 uppercase font-extrabold">Filter action:</span>
                  <select
                    value={auditFilterAction}
                    onChange={(e) => setAuditFilterAction(e.target.value)}
                    className="text-[11px] py-1 px-2 border border-slate-200 bg-white shadow-xs rounded-none outline-none cursor-pointer text-slate-750"
                  >
                    <option value="">All Security Events</option>
                    <option value="CREATE_OFFICER">CREATE_OFFICER</option>
                    <option value="RESET_PASSWORD">RESET_PASSWORD</option>
                    <option value="DISABLE_OFFICER">DISABLE_OFFICER</option>
                    <option value="ENABLE_OFFICER">ENABLE_OFFICER</option>
                    <option value="UNLOCK_OFFICER">UNLOCK_OFFICER</option>
                    <option value="DELETE_OFFICER">DELETE_OFFICER</option>
                    <option value="FORCE_CHANGE_PASSWORD">FORCE_CHANGE_PASSWORD</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-150">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                    <tr className="uppercase tracking-wider font-extrabold text-[9px] text-slate-455">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Administrator</th>
                      <th className="py-2.5 px-3">Action type</th>
                      <th className="py-2.5 px-3">Target Department</th>
                      <th className="py-2.5 px-3">Operation Details</th>
                      <th className="py-2.5 px-3 font-mono">Terminal IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-sans text-[11px]">
                    {auditLogs
                      .filter(log => !auditFilterAction || log.actionType === auditFilterAction)
                      .map((log) => {
                        let actionBadgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
                        if (log.actionType === 'CREATE_OFFICER') actionBadgeColor = 'bg-green-100 text-green-800 border-green-200';
                        else if (log.actionType === 'RESET_PASSWORD') actionBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                        else if (log.actionType === 'DISABLE_OFFICER') actionBadgeColor = 'bg-red-100 text-red-800 border-red-200';
                        else if (log.actionType === 'UNLOCK_OFFICER') actionBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        else if (log.actionType === 'FORCE_CHANGE_PASSWORD') actionBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';

                        return (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 whitespace-nowrap text-slate-500 text-[10.5px]">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-800">{log.adminName}</td>
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.2 text-[8.5px] font-extrabold uppercase tracking-wide border rounded-sm ${actionBadgeColor}`}>
                                {log.actionType}
                              </span>
                            </td>
                            <td className="py-2 px-3 uppercase font-bold text-blue-900 font-mono text-[10px]">{log.departmentKey || 'ALL'}</td>
                            <td className="py-2 px-3 text-slate-600 max-w-[280px] truncate" title={log.details}>{log.details}</td>
                            <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                          </tr>
                        );
                      })}
                    {auditLogs.filter(log => !auditFilterAction || log.actionType === auditFilterAction).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          No audit trail events captured matching action filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ----------------- TAB: ENROLLED STUDENTS ----------------- */}
        {activeTab === 'students' && (
          <div className="bg-white border border-slate-200 p-6 space-y-4 animate-fade-in text-xs">
            <h3 className="font-extrabold text-sm uppercase text-slate-900 border-b pb-2">Verified Enrolled Directory</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-slate-705">
                <thead>
                  <tr className="border-b border-slate-200 uppercase tracking-wider font-extrabold text-[10px] text-slate-455">
                    <th className="py-2.5">Student Enrollment ID</th>
                    <th className="py-2.5">Student Full Name</th>
                    <th className="py-2.5">Primary College Email</th>
                    <th className="py-2.5">Mobile Contact Phone</th>
                    <th className="py-2.5 text-right">Account Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150">
                  {studentList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">No students registered. Use guest page to register dummy student accounts.</td>
                    </tr>
                  ) : (
                    studentList.map((stud) => (
                      <tr key={stud.id} className="hover:bg-slate-50 font-sans">
                        <td className="py-3 font-mono font-black text-blue-900 uppercase">{stud.enrollmentNumber}</td>
                        <td className="py-3 font-bold text-slate-800">{stud.name}</td>
                        <td className="py-3 font-mono text-slate-500">{stud.email}</td>
                        <td className="py-3 font-mono text-slate-550">{stud.contactNumber || 'N/A'}</td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteStudent(stud.id, stud.name)}
                            className="text-rose-600 hover:text-rose-800 font-bold hover:underline"
                          >
                            Revoke Student
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ----------------- TAB: MASTER TICKETS LEDGER ----------------- */}
        {activeTab === 'tickets' && (
          <div className="grid lg:grid-cols-12 gap-8 items-start animate-fade-in text-xs">
            
            {/* Tickets Table feed */}
            <div className="lg:col-span-7 bg-white border border-slate-200 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
                <h3 className="font-extrabold text-sm uppercase text-slate-900">Master Ledger Logbook</h3>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Filter Dept:</span>
                  <select
                    value={ledgerDeptFilter}
                    onChange={(e) => { setLedgerDeptFilter(e.target.value); setSelectedTicket(null); }}
                    className="text-[11px] py-1 px-2 border border-slate-200 bg-white shadow-xs rounded-none text-slate-750 outline-none cursor-pointer"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.key} value={d.key}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dual Subtabs for separation */}
              <div className="flex border border-slate-200 p-0.5 bg-slate-50 text-[10.5px] font-sans">
                <button
                  type="button"
                  onClick={() => { setLedgerTab('complaints'); setSelectedTicket(null); }}
                  className={`flex-1 py-1.5 px-3 font-bold uppercase transition select-none ${ledgerTab === 'complaints' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Student Complaints ({allTickets.filter(t => t.requestType === 'complaint' && (!ledgerDeptFilter || t.departmentKey === ledgerDeptFilter)).length})
                </button>
                <button
                  type="button"
                  onClick={() => { setLedgerTab('help'); setSelectedTicket(null); }}
                  className={`flex-1 py-1.5 px-3 font-bold uppercase transition select-none ${ledgerTab === 'help' ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Help Requests ({allTickets.filter(t => t.requestType === 'help' && (!ledgerDeptFilter || t.departmentKey === ledgerDeptFilter)).length})
                </button>
              </div>
              
              <div className="space-y-4">
                {loading ? (
                  <p className="text-center py-10 text-slate-400">Syncing college ledger...</p>
                ) : allTickets.filter(t => t.requestType === ledgerTab && (!ledgerDeptFilter || t.departmentKey === ledgerDeptFilter)).length === 0 ? (
                  <p className="py-8 text-center text-slate-400">No tickets found matching current department/type criteria.</p>
                ) : (
                  <div className="divide-y divide-slate-150">
                    {allTickets
                      .filter(t => t.requestType === ledgerTab && (!ledgerDeptFilter || t.departmentKey === ledgerDeptFilter))
                      .map((t) => (
                        <div 
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          className={`p-4 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-center gap-4 ${
                            selectedTicket?.id === t.id ? 'bg-blue-50/50 border-l-4 border-blue-900 font-semibold' : ''
                          }`}
                        >
                          <div className="truncate space-y-11 animate-fade-in">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-blue-900 uppercase">{t.id}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 border uppercase rounded-xs ${
                                t.requestType === 'complaint' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-cyan-50 border-cyan-100 text-cyan-800'
                              }`}>
                                {t.requestType}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 text-xs truncate">{t.subject}</h4>
                            <span className="text-[10px] text-slate-450 block font-mono">
                              Dept: {getDepartmentName(t.departmentKey)} ({t.departmentKey.toUpperCase()}) • Student: {t.studentName}
                            </span>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <span className={`text-[9.5px] uppercase font-extrabold py-0.5 px-2 border leading-none rounded-none tracking-wide ${getStatusStyle(t.status)}`}>
                              {t.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ticket details sidebar */}
            <div className="lg:col-span-5">
              {selectedTicket ? (
                <div className="bg-white border-2 border-slate-950 p-6 shadow-md space-y-5">
                  <div className="flex justify-between items-start pb-3 border-b border-slate-150">
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-900 tracking-wider">GRIEVANCE RECORD SHEET</span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{selectedTicket.subject}</h4>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">Reference: {selectedTicket.id}</p>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
                  </div>

                  {/* Student identifiers block */}
                  <div className="bg-slate-100 p-3 border border-slate-200 space-y-1.5 leading-relaxed">
                    <span className="text-[9px] uppercase font-black text-slate-455 block">Student Submitter Profile</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>Name: <strong className="text-slate-800">{selectedTicket.studentName}</strong></div>
                      <div>ID: <strong className="text-slate-800 uppercase font-mono">{selectedTicket.enrollmentNumber}</strong></div>
                      <div>Phone: <a href={`tel:${selectedTicket.contactNumber}`} className="text-blue-900 font-bold hover:underline font-mono">{selectedTicket.contactNumber}</a></div>
                      <div>E-mail: <span className="text-slate-500 font-mono select-all truncate">{selectedTicket.studentId}@campusconnect.edu</span></div>
                    </div>
                  </div>

                  {/* Incident descriptor */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider block">Grievance Payload</span>
                    <p className="p-3 bg-slate-50 border border-slate-150 text-[11.5px] leading-relaxed select-all text-slate-705">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Artifact display */}
                  {selectedTicket.attachments?.length ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider block">Evidence Files</span>
                      <img 
                        src={selectedTicket.attachments[0]} 
                        alt="Evidence image" 
                        className="max-h-36 object-contain rounded border border-slate-150 p-1 bg-white cursor-zoom-in transition-transform hover:scale-[1.02]"
                        onClick={() => setActiveViewerImage(selectedTicket.attachments[0])}
                      />
                    </div>
                  ) : null}

                  {/* Current resolution timeline values */}
                  <div className="bg-blue-50 border border-blue-200 p-3.5 space-y-1">
                    <span className="text-[9px] uppercase font-black text-blue-900 tracking-wide block">Coordinating Action State</span>
                    <div className="flex justify-between items-center text-[10px]">
                      <span>Present Status:</span>
                      <span className={`uppercase font-bold text-[9px] py-0.4 px-2.5 border ${getStatusStyle(selectedTicket.status)}`}>
                        {selectedTicket.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="pt-2">
                      <span className="text-[9px] text-slate-400 block pb-0.5">Assigned Department Office:</span>
                      <strong className="text-blue-950 block">{getDepartmentName(selectedTicket.departmentKey)} ({selectedTicket.departmentKey.toUpperCase()})</strong>
                    </div>

                    <div className="pt-2">
                      <span className="text-[9px] text-slate-400 block pb-0.5 font-sans">Coordinating Remarks:</span>
                      {selectedTicket.remarks ? (
                        <p className="italic text-slate-705">"{selectedTicket.remarks}"</p>
                      ) : (
                        <p className="italic text-slate-400">No remarks posted by department yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Reassignment Panel (Complaint Reassignment - strictly for admin) */}
                  <div className="pt-4 border-t border-slate-205 space-y-3">
                    <span className="text-[10px] uppercase font-black text-slate-900 tracking-wider block">Complaint Reassignment</span>
                    <div>
                      <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Target Department</label>
                      <select
                        value={reassignDeptKey || selectedTicket.departmentKey}
                        onChange={(e) => setReassignDeptKey(e.target.value)}
                        className="w-full text-xs py-2 px-2.5 border border-slate-250 bg-slate-50 outline-none font-bold text-slate-850 cursor-pointer"
                      >
                        {departments.map((dept) => (
                          <option key={dept.key} value={dept.key}>
                            {dept.name} ({dept.key.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={reassigning || reassignDeptKey === selectedTicket.departmentKey}
                      onClick={() => handleReassign(selectedTicket.id)}
                      className="w-full py-2 bg-blue-900 hover:bg-blue-850 disabled:bg-slate-200 disabled:text-slate-450 text-white font-extrabold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {reassigning ? 'Reassigning...' : 'Execute Reassignment'}
                    </button>
                  </div>

                </div>
              ) : (
                <div className="hidden lg:block bg-slate-150 border border-dashed text-slate-400 p-12 text-center rounded-none border-slate-300">
                  <ShieldCheck className="w-10 h-10 text-slate-350 mx-auto" />
                  <p className="text-sm font-bold mt-2">No active ticket</p>
                  <p className="text-xs">Click any entry on the ledger feed to audit full payload structures, attachments, and remarks.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------- TAB: SYSTEM SETTINGS ----------------- */}
        {activeTab === 'settings' && (
          <div className="bg-white border-2 border-slate-100 p-6 max-w-2xl mx-auto space-y-6 animate-fade-in text-xs border-t-4 border-t-slate-800">
            <h3 className="font-extrabold text-sm uppercase text-slate-950 border-b pb-2 flex items-center gap-2">
              <Settings className="w-4.5 h-4.5" />
              University System Settings
            </h3>
            
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Institution Name</label>
                  <input
                    type="text"
                    required
                    value={univName}
                    onChange={(e) => setUnivName(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Academic Calendar Year</label>
                  <input
                    type="text"
                    required
                    value={sysAcademicYear}
                    onChange={(e) => setSysAcademicYear(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Current Term Semester</label>
                  <select
                    value={sysSemester}
                    onChange={(e) => setSysSemester(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                  >
                    <option value="Fall Semester">Fall Semester</option>
                    <option value="Spring Semester">Spring Semester</option>
                    <option value="Summer Term">Summer Term</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Enable Student Registration</label>
                  <select
                    value={sysRegAllowed}
                    onChange={(e) => setSysRegAllowed(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                  >
                    <option value="yes">Enabled (Public Student Register)</option>
                    <option value="no">Disabled (Restricted Mode)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">System Maintenance Flag</label>
                  <select
                    value={sysMaintenanceMode}
                    onChange={(e) => setSysMaintenanceMode(e.target.value)}
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                  >
                    <option value="no">Normal Operations Mode</option>
                    <option value="yes">Maintenance Status Board</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 text-xs">
                <span className="font-bold text-[10px] text-blue-900 uppercase block tracking-wider mb-1">Administrative Access Guidelines</span>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                  Changing institutional parameters modifies headers, student enrollment registration gateways, and background audit parameters. Please store database modifications prior to semester transitions.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-none shadow-md transition-colors cursor-pointer"
              >
                Save System Settings
              </button>
            </form>
          </div>
        )}

        {/* ----------------- TAB: ANNOUNCEMENTS MANAGEMENT ----------------- */}
        {activeTab === 'announcements' && (
          <div className="space-y-6 animate-fade-in text-xs">
            {/* Statistics Row */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border p-4 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Notices</span>
                <span className="text-2xl font-black text-slate-800">{announcements.length}</span>
              </div>
              <div className="bg-white border p-4 shadow-2xs border-l-4 border-l-emerald-600">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Active & Published</span>
                <span className="text-2xl font-black text-emerald-750">
                  {announcements.filter(a => a.isPublished && !a.isArchived).length}
                </span>
              </div>
              <div className="bg-white border p-4 shadow-2xs border-l-4 border-l-yellow-600">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Pinned Board Alerts</span>
                <span className="text-2xl font-black text-yellow-600">
                  {announcements.filter(a => a.isPinned && !a.isArchived).length}
                </span>
              </div>
              <div className="bg-white border p-4 shadow-2xs border-l-4 border-l-slate-400">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Archived Announcements</span>
                <span className="text-2xl font-black text-slate-500">
                  {announcements.filter(a => a.isArchived).length}
                </span>
              </div>
            </div>

            {/* If in Create or Edit view */}
            {isEditingAnnouncement ? (
              <form onSubmit={handleSaveAnnouncement} className="bg-white border p-6 space-y-6 border-slate-200">
                <div className="border-b pb-3 flex justify-between items-center border-slate-200">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase text-slate-900">
                      {isEditingAnnouncement.id ? 'Modify Announcement Parameters' : 'Publish Institutional Announcement'}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Configure target audiences, category types, and broadcast parameters.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingAnnouncement(null)}
                    className="py-1.5 px-3 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-wider cursor-pointer text-[10px]"
                  >
                    Back to Registry
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Announcement Title</label>
                    <input
                      type="text"
                      required
                      value={annFormTitle}
                      onChange={(e) => setAnnFormTitle(e.target.value)}
                      placeholder="e.g. End Semester Exam Timetable - Fall 2026"
                      className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Category</label>
                      <select
                        value={annFormCat}
                        onChange={(e) => setAnnFormCat(e.target.value)}
                        className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none cursor-pointer font-bold"
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
                        className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none cursor-pointer font-bold"
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
                    className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium leading-relaxed"
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
                      className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={annFormExpDate}
                      onChange={(e) => setAnnFormExpDate(e.target.value)}
                      className="w-full text-xs py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-mono"
                    />
                  </div>
                </div>

                <AnnouncementAttachmentField
                  inputId="admin-announcement-file-upload"
                  isDarkMode={false}
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

                {/* Visibility Controls */}
                <div className="border p-4 bg-slate-50 space-y-4">
                  <span className="font-extrabold text-[10px] text-blue-900 uppercase tracking-wider block">Target Visibility Audience</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="targetAudience"
                        value="all"
                        checked={annFormAudience === 'all'}
                        onChange={() => setAnnFormAudience('all')}
                        className="cursor-pointer"
                      />
                      <span>Institution-wide (All departments)</span>
                    </label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="targetAudience"
                        value="selected_departments"
                        checked={annFormAudience === 'selected_departments'}
                        onChange={() => setAnnFormAudience('selected_departments')}
                        className="cursor-pointer"
                      />
                      <span>Specific Departments Only</span>
                    </label>
                  </div>

                  {annFormAudience === 'selected_departments' && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[9px] uppercase font-extrabold text-slate-550 mb-2 tracking-wider">Select Target Departments</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {departments.map((dept) => (
                          <label key={dept.key} className="flex items-center gap-1.5 p-1.5 bg-white border text-[11px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={annFormDepts.includes(dept.key)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAnnFormDepts([...annFormDepts, dept.key]);
                                } else {
                                  setAnnFormDepts(annFormDepts.filter(k => k !== dept.key));
                                }
                              }}
                              className="cursor-pointer"
                            />
                            <span className="font-bold uppercase">{dept.key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Broadcast Channels */}
                <div className="border p-4 bg-blue-50/50 grid sm:grid-cols-2 gap-4">
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
                        <span>Notify All Enrolled Students (In-App + Email Alert)</span>
                      </label>
                      <label className="flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={annFormNotifyStaff}
                          onChange={(e) => setAnnFormNotifyStaff(e.target.checked)}
                          className="cursor-pointer"
                        />
                        <span>Notify Departmental Staff (In-App + Email Alert)</span>
                      </label>
                    </div>
                  </div>

                  <div className="sm:border-l sm:pl-4 flex flex-col justify-center space-y-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={annFormPublished}
                        onChange={(e) => setAnnFormPublished(e.target.checked)}
                        className="cursor-pointer"
                      />
                      <span>Immediately Published & Live</span>
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
                    className="py-2 px-4 bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    {isEditingAnnouncement.id ? 'Save Changes' : 'Broadcast Announcement'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 border border-slate-200">
                  <div>
                    <h3 className="font-black text-sm uppercase text-slate-900">Official Noticeboard Registry</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Broadcast and coordinate administrative directives across CampusConnect portals.</p>
                  </div>
                  <button
                    onClick={handleStartCreateAnnouncement}
                    className="py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    New Announcement
                  </button>
                </div>

                {isAnnouncementsLoading && announcements.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 text-slate-400 font-medium">
                    Loading notice logs...
                  </div>
                ) : announcements.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-slate-200 text-slate-400 space-y-2">
                    <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
                    <p>No announcements or notices broadcasted yet.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-550 border-b">
                          <th className="p-3">Title & Category</th>
                          <th className="p-3">Audience Scope</th>
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
                            <tr key={ann.id} className="border-b hover:bg-slate-50/50">
                              <td className="p-3 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  {ann.isPinned && (
                                    <span className="bg-amber-50 text-amber-700 px-1 border border-amber-200 text-[8px] font-black uppercase flex items-center gap-0.5">
                                      <Pin className="w-2.5 h-2.5 fill-amber-500 animate-pulse" /> PINNED
                                    </span>
                                  )}
                                  <span className="font-extrabold text-slate-900">{ann.title}</span>
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
                                          setError(err?.message || 'Could not download attachment.')
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                                      title={ann.attachmentName || 'Download attached file'}
                                    >
                                      <Paperclip className="w-3 h-3" />
                                      <span className="max-w-[160px] truncate">{ann.attachmentName || 'Attachment'}</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                {ann.departmentId ? (
                                  <span className="font-bold text-blue-900 uppercase">DEPT: {ann.departmentId}</span>
                                ) : ann.targetAudience === 'all' || ann.targetAudience === 'institution' ? (
                                  <span className="font-bold text-slate-600 uppercase">INSTITUTION-WIDE</span>
                                ) : (
                                  <span className="font-bold text-indigo-700 uppercase" title={ann.targetDepartments?.join(', ')}>
                                    DEPTS: {ann.targetDepartments?.join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-mono">
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
                                    <Pin className={`w-3.5 h-3.5 ${ann.isPinned ? 'text-amber-600 fill-amber-500' : 'text-slate-500'}`} />
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

                {/* Deleted Announcements History Section */}
                <div className="bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase text-slate-900 flex items-center gap-2">
                      <History className="w-4.5 h-4.5 text-slate-500" />
                      Deleted Announcements History
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      View soft-deleted notices. Restoring a notice will immediately make it visible across all dashboards again.
                    </p>
                  </div>

                  {isDeletedAnnouncementsLoading && deletedAnnouncements.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 font-medium bg-slate-50 border border-dashed border-slate-250">
                      Loading deleted notice history...
                    </div>
                  ) : deletedAnnouncements.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50 font-medium">
                      No deleted announcements in history.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-550 border-b">
                            <th className="p-3">Announcement Title</th>
                            <th className="p-3">Department</th>
                            <th className="p-3 font-mono">Created By</th>
                            <th className="p-3 font-mono">Created Date</th>
                            <th className="p-3">Deleted By</th>
                            <th className="p-3 font-mono">Deleted Date</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deletedAnnouncements.map((ann) => {
                            return (
                              <tr key={ann.id} className="border-b hover:bg-slate-50/50">
                                <td className="p-3 font-extrabold text-slate-900">{ann.title}</td>
                                <td className="p-3 font-medium">
                                  {ann.departmentId ? (
                                    <span className="font-bold text-blue-900 uppercase">DEPT: {ann.departmentId}</span>
                                  ) : ann.targetAudience === 'all' || ann.targetAudience === 'institution' ? (
                                    <span className="font-bold text-slate-600 uppercase">INSTITUTION-WIDE</span>
                                  ) : (
                                    <span className="font-bold text-indigo-700 uppercase">
                                      DEPTS: {ann.targetDepartments?.join(', ')}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-600 font-mono text-[10px]">
                                  {ann.createdBy} ({ann.creatorRole?.toUpperCase()})
                                </td>
                                <td className="p-3 font-mono text-slate-500 text-[10px]">
                                  {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="p-3 text-slate-600 font-medium font-mono text-[10px]">{ann.deletedBy || 'N/A'}</td>
                                <td className="p-3 font-mono text-slate-500 text-[10px]">
                                  {ann.deletedAt ? new Date(ann.deletedAt).toLocaleDateString() + ' ' + new Date(ann.deletedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                                </td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase border bg-rose-50 border-rose-200 text-rose-700">
                                    Soft Deleted
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleRestoreAnnouncement(ann.id)}
                                      className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-black uppercase tracking-wider text-[9px] cursor-pointer flex items-center gap-1 shadow-2xs"
                                      title="Restore Notice"
                                    >
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin-reverse" /> Restore
                                    </button>
                                    <button
                                      onClick={() => handlePermanentlyDeleteAnnouncement(ann.id)}
                                      className="px-2.5 py-1 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-black uppercase tracking-wider text-[9px] cursor-pointer flex items-center gap-1 shadow-2xs"
                                      title="Delete Permanently"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" /> Permanent Delete
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
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB: INSTITUTION PROFILE ----------------- */}
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in text-xs">
            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="bg-white border p-6 space-y-6 border-slate-200">
                <div className="border-b pb-3 flex justify-between items-center border-slate-200">
                  <div>
                    <h3 className="font-extrabold text-sm uppercase text-slate-900">Edit Institution Details</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Modify profile fields and upload emblem/logo.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="py-1.5 px-3 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-wider cursor-pointer text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer text-[10px]"
                    >
                      {isSavingProfile && <RefreshCw className="w-3 h-3 animate-spin" />}
                      {isSavingProfile ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Left Column: Logo Drag-and-Drop */}
                  <div className="space-y-4">
                    <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Institution Emblem/Logo</label>
                    {profLogo ? (
                      <div className="relative border border-slate-200 p-4 bg-slate-55 flex flex-col items-center justify-center text-center space-y-3">
                        <img 
                          src={profLogo} 
                          alt="Logo Preview" 
                          className="w-32 h-32 object-contain bg-white border border-slate-200 p-2"
                          referrerPolicy="no-referrer"
                        />
                        <div className="w-full">
                          <p className="text-[10px] text-emerald-600 font-bold uppercase">Logo Loaded Successfully</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 truncate">Ready to be updated on submit</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProfLogo('')}
                          className="w-full py-1.5 bg-rose-50 hover:bg-rose-105 border border-rose-200 text-rose-700 font-bold uppercase tracking-wider transition-colors cursor-pointer text-[9px]"
                        >
                          Remove Image
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setDraggingProfileLogo(true); }}
                        onDragLeave={() => setDraggingProfileLogo(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDraggingProfileLogo(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleProfileLogoSelect(file);
                        }}
                        onClick={() => document.getElementById('profile-logo-upload')?.click()}
                        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px] ${
                          draggingProfileLogo 
                            ? 'border-indigo-500 bg-indigo-50/50' 
                            : 'border-slate-300 hover:border-slate-450 bg-slate-50 hover:bg-slate-100/70'
                        }`}
                      >
                        <input
                          id="profile-logo-upload"
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleProfileLogoSelect(file);
                          }}
                          className="hidden"
                        />
                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="block text-xs font-bold text-slate-700">Click to upload or drag logo here</span>
                        <span className="block text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-normal">
                          Supports JPEG, PNG, WEBP formats up to 5MB. Or leave blank to query logo from your website!
                        </span>
                      </div>
                    )}
                    {profileLogoError && (
                      <p className="text-[10px] text-rose-600 font-bold">{profileLogoError}</p>
                    )}
                  </div>

                  {/* Right Column: Profile Input Form Fields */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Institution Name *</label>
                        <input
                          type="text"
                          required
                          value={profName}
                          onChange={(e) => setProfName(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-bold text-xs"
                          placeholder="State University"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Institution Admin Name *</label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-bold text-xs"
                          placeholder="Admin Name"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Category / Tier</label>
                        <input
                          type="text"
                          value={profCategory}
                          onChange={(e) => setProfCategory(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="e.g. Tier-1 College, Autonomous"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Official Website</label>
                        <input
                          type="text"
                          value={profWebsite}
                          onChange={(e) => setProfWebsite(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="https://example.edu"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Official Email</label>
                        <input
                          type="email"
                          value={profOfficialEmail}
                          onChange={(e) => setProfOfficialEmail(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="info@example.edu"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Contact Phone Number</label>
                        <input
                          type="text"
                          value={profContactNumber}
                          onChange={(e) => setProfContactNumber(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="+1-123-456-7890"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Physical Street Address</label>
                        <input
                          type="text"
                          value={profAddress}
                          onChange={(e) => setProfAddress(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="123 Academic Way"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Postal Code</label>
                        <input
                          type="text"
                          value={profPostalCode}
                          onChange={(e) => setProfPostalCode(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                          placeholder="10001"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">City</label>
                        <input
                          type="text"
                          value={profCity}
                          onChange={(e) => setProfCity(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">State / Province</label>
                        <input
                          type="text"
                          value={profState}
                          onChange={(e) => setProfState(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Country</label>
                        <input
                          type="text"
                          value={profCountry}
                          onChange={(e) => setProfCountry(e.target.value)}
                          className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-extrabold text-slate-550 mb-1 tracking-wider">Description / About</label>
                      <textarea
                        rows={3}
                        value={profDescription}
                        onChange={(e) => setProfDescription(e.target.value)}
                        className="w-full py-2 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-xs resize-none text-slate-800"
                        placeholder="Brief overview describing the history, values, and accomplishments of the institution."
                      />
                    </div>

                    {/* Social links */}
                    <div className="border-t pt-4 space-y-3 border-slate-200">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Official Social Media Profiles</span>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Twitter / X URL</label>
                          <input
                            type="url"
                            value={profSocialTwitter}
                            onChange={(e) => setProfSocialTwitter(e.target.value)}
                            className="w-full py-1.5 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-[11px]"
                            placeholder="https://twitter.com/institution"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">LinkedIn Page URL</label>
                          <input
                            type="url"
                            value={profSocialLinkedin}
                            onChange={(e) => setProfSocialLinkedin(e.target.value)}
                            className="w-full py-1.5 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-[11px]"
                            placeholder="https://linkedin.com/school/institution"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">Facebook Page URL</label>
                          <input
                            type="url"
                            value={profSocialFacebook}
                            onChange={(e) => setProfSocialFacebook(e.target.value)}
                            className="w-full py-1.5 px-3 border border-slate-200 bg-slate-50 outline-none font-medium text-[11px]"
                            placeholder="https://facebook.com/institution"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 p-6 space-y-8">
                {/* View Mode Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border border-slate-200 bg-slate-50 flex items-center justify-center p-2 flex-shrink-0">
                      <img 
                        src={instProfile?.logo || '/uploads/default-institution.svg'} 
                        alt="Logo" 
                        className="max-w-full max-h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.src = '/uploads/default-institution.svg'; }}
                      />
                    </div>
                    <div>
                      <h2 className="text-base font-black uppercase text-blue-900 tracking-tight">{instProfile?.name}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 border text-slate-700 px-1.5 py-0.2">{instProfile?.type || 'Institution'}</span>
                        {instProfile?.category && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-800 px-1.5 py-0.2">{instProfile.category}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="py-2 px-4 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    Edit Profile
                  </button>
                </div>

                {/* Grid details */}
                <div className="grid md:grid-cols-3 gap-8">
                  {/* General details */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Description / About</span>
                      <p className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50 p-4 border border-slate-150 rounded-sm italic">
                        {instProfile?.description || 'No description provided yet. Click "Edit Profile" to add details describing your institution.'}
                      </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Official Contact</span>
                        <div className="space-y-2 font-medium">
                          <div className="flex items-center gap-2 text-slate-750">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>Email: <strong className="text-slate-900 font-bold">{instProfile?.officialEmail || 'Not configured'}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-750">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>Phone: <strong className="text-slate-900 font-bold">{instProfile?.contactNumber || 'Not configured'}</strong></span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-750">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span>Website: {instProfile?.website ? (
                              <a href={instProfile.website.startsWith('http') ? instProfile.website : `https://${instProfile.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-900 font-black hover:underline inline-flex items-center gap-1">
                                {instProfile.website.replace(/^https?:\/\//i, '')}
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            ) : (
                              <strong className="text-slate-500 font-bold">Not configured</strong>
                            )}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Physical Location</span>
                        <div className="space-y-2 font-medium">
                          <div className="text-slate-750">
                            <span className="text-slate-500">Street:</span> <strong className="text-slate-900 font-bold">{instProfile?.address || 'Not configured'}</strong>
                          </div>
                          <div className="text-slate-750">
                            <span className="text-slate-500">City/State:</span> <strong className="text-slate-900 font-bold">{[instProfile?.city, instProfile?.state].filter(Boolean).join(', ') || 'Not configured'}</strong>
                          </div>
                          <div className="text-slate-750">
                            <span className="text-slate-500">Country/Postal:</span> <strong className="text-slate-900 font-bold">{[instProfile?.country, instProfile?.postalCode].filter(Boolean).join(' - ') || 'Not configured'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar stats & social */}
                  <div className="bg-slate-50 p-5 border border-slate-200 space-y-6">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Administrative Info</span>
                      <div className="space-y-1.5 text-[11px] font-mono font-medium text-slate-600">
                        <div>Institution ID: <strong className="text-slate-900 font-bold">{instProfile?.id}</strong></div>
                        <div>Admin Name: <strong className="text-slate-900 font-bold">{user?.name || 'Super Admin'}</strong></div>
                        <div>Admin Email: <strong className="text-slate-900 font-bold">{user?.email || 'N/A'}</strong></div>
                        <div>Registered on: <strong className="text-slate-900 font-bold">{instProfile?.createdAt ? new Date(instProfile.createdAt).toLocaleDateString() : 'N/A'}</strong></div>
                        {instProfile?.updatedAt && (
                          <div>Last Modified: <strong className="text-slate-900 font-bold">{new Date(instProfile.updatedAt).toLocaleDateString()}</strong></div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Official Handles</span>
                      <div className="space-y-2 text-[11px]">
                        {instProfile?.socialTwitter ? (
                          <a href={instProfile.socialTwitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-900 font-bold hover:underline">
                            <span>𝕏 Twitter Profile</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 block font-sans italic">No Twitter handle saved</span>
                        )}

                        {instProfile?.socialLinkedin ? (
                          <a href={instProfile.socialLinkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-900 font-bold hover:underline">
                            <span>💼 LinkedIn Institution Page</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 block font-sans italic">No LinkedIn profile saved</span>
                        )}

                        {instProfile?.socialFacebook ? (
                          <a href={instProfile.socialFacebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-900 font-bold hover:underline">
                            <span>📘 Facebook Page</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 block font-sans italic">No Facebook page saved</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
                <div className="bg-rose-50/10 border border-rose-200 p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-rose-850 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                        Danger Zone: Permanent Removal
                      </h4>
                      <p className="text-[10px] text-slate-500 max-w-xl leading-normal font-medium">
                        Warning: This action is permanent. Deleting your institution will remove all associated departments, staff accounts, students, complaints, announcements, and institution data. This action cannot be undone.
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmInput('');
                          setDeleteError('');
                          setShowDeleteModal(true);
                        }}
                        className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                      >
                        Delete Institution
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Institution Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <div className="bg-white border-2 border-rose-900 w-full max-w-md p-6 relative shadow-2xl animate-fade-in text-xs text-slate-800">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                  <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0 animate-bounce" />
                  <div>
                    <h3 className="font-extrabold text-sm uppercase text-slate-900">Confirm Permanent Removal</h3>
                    <p className="text-[10px] text-rose-700 mt-0.5 font-bold">This action is absolutely irreversible.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-slate-650 leading-relaxed bg-rose-50/50 border border-rose-150 p-4 font-medium">
                    Warning: This action is permanent. Deleting your institution will remove all associated departments, staff accounts, students, complaints, announcements, and institution data. This action cannot be undone.
                  </p>
                  <p className="text-slate-700 font-bold">
                    To confirm, please type <span className="bg-slate-100 px-1.5 py-0.5 font-mono border border-slate-300 text-rose-800 font-bold">{instProfile?.name}</span> or <span className="bg-slate-100 px-1.5 py-0.5 font-mono border border-slate-300 text-rose-800 font-bold">DELETE</span> below:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => {
                      setDeleteConfirmInput(e.target.value);
                      setDeleteError('');
                    }}
                    placeholder="Type to confirm"
                    className="w-full py-2 px-3 border border-slate-300 bg-slate-50 outline-none font-bold text-xs"
                  />
                  {deleteError && (
                    <p className="text-[10px] text-rose-600 font-bold">{deleteError}</p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteModal(false)}
                    className="py-2 px-4 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-wider cursor-pointer text-[10px] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting || (deleteConfirmInput !== instProfile?.name && deleteConfirmInput !== 'DELETE')}
                    onClick={handleDeleteInstitution}
                    className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-extrabold uppercase tracking-wider text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Details Immersive Overlay Modal */}
        {isDetailModalOpen && selectedTicket && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white border-2 border-slate-900 w-full max-w-4xl max-h-[90vh] flex flex-col relative shadow-2xl animate-fade-in text-xs text-slate-800">
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 flex justify-between items-start gap-4 bg-slate-50 flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase text-blue-900 tracking-wider">CAMPUSCONNECT DOSSIER OVERVIEW</span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold bg-white px-2 border">ID: {selectedTicket.id}</span>
                    <span className={`px-2 py-0.2 text-[9px] uppercase font-bold border ${
                      selectedTicket.requestType === 'complaint' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}>
                      {selectedTicket.requestType}
                    </span>
                    <span className={`px-2 py-0.2 text-[9px] uppercase font-bold border ${
                      selectedTicket.priority === 'urgent' ? 'bg-rose-600 text-white border-rose-700 animate-pulse' : 'bg-slate-100 text-slate-650'
                    }`}>
                      {selectedTicket.priority || 'medium'} urgency
                    </span>
                  </div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight leading-snug">{selectedTicket.subject}</h2>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handlePrintTicket(selectedTicket)}
                    className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 font-mono text-[10px] font-bold flex items-center gap-1"
                    title="Print Document"
                  >
                    <Landmark className="w-3.5 h-3.5" /> PRINT
                  </button>
                  <button
                    onClick={() => handleExportTicket(selectedTicket)}
                    className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 font-mono text-[10px] font-bold flex items-center gap-1"
                    title="Export Payload JSON"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> EXPORT
                  </button>
                  <button 
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setSelectedTicket(null);
                    }} 
                    className="p-1.5 bg-slate-900 hover:bg-rose-600 text-white hover:text-white transition-colors"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Upper Details Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* Left Column: Identifiers & Assignments */}
                  <div className="space-y-4">
                    
                    {/* Student Profile Info */}
                    <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Student Submitter Profile</h4>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Full Name</span>
                          <strong className="text-slate-800 text-[11px]">{selectedTicket.studentName}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Enrollment Number</span>
                          <strong className="text-slate-800 font-mono text-[11px]">{selectedTicket.enrollmentNumber || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Contact Number</span>
                          <strong className="text-slate-800 font-mono text-[11px]">{selectedTicket.contactNumber || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Student email</span>
                          <strong className="text-slate-800 font-mono text-[11px] truncate block">{selectedTicket.studentId}@campusconnect.edu</strong>
                        </div>
                      </div>
                    </div>

                    {/* Department Allocation Info */}
                    <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                      <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Department Allocation & SLA</h4>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Assigned Block</span>
                          <strong className="text-blue-900 text-[11px]">{getDepartmentName(selectedTicket.departmentKey)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Channel Slug</span>
                          <strong className="text-slate-800 uppercase font-mono text-[11px]">{selectedTicket.departmentKey}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Coordinating Officer</span>
                          <strong className="text-slate-800 text-[11px]">{selectedTicket.officerName || 'UNASSIGNED QUEUE'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase">Expected Resolution SLA</span>
                          <strong className="text-slate-850 font-mono text-[11px]">
                            {selectedTicket.expectedResolutionTime || new Date(new Date(selectedTicket.createdAt).getTime() + 48 * 3600000).toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Interactive State Operations Controls */}
                  <div className="space-y-4">
                    
                    {/* Status Management Update Form */}
                    <div className="border border-slate-200 bg-blue-50/30 p-4 space-y-3">
                      <h4 className="font-bold text-[10px] uppercase text-slate-600 tracking-wider">Administrative Status Override</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 mb-1">State transition</label>
                          <select
                            value={selectedTicket.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              setUpdatingStatusTicketId(selectedTicket.id);
                              handleUpdateStatus(selectedTicket.id, newStatus, newRemarksText);
                            }}
                            className="w-full bg-white border border-slate-300 py-1 px-2 text-[10px] font-bold"
                          >
                            <option value="pending">Pending Review</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved (Cleared)</option>
                            <option value="closed">Closed Archive</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 mb-1">Urgency escalation</label>
                          <select
                            value={selectedTicket.priority || 'medium'}
                            onChange={(e) => handleUpdatePriority(selectedTicket.id, e.target.value)}
                            className="w-full bg-white border border-slate-300 py-1 px-2 text-[10px] font-bold"
                          >
                            <option value="low">Low Urgency</option>
                            <option value="medium">Medium Urgency</option>
                            <option value="high">High Urgency</option>
                            <option value="urgent">Urgent Escalation</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[9px] uppercase text-slate-400">Coordinating Remarks (Sent to student notification log)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add action description or remarks update..."
                            value={newRemarksText}
                            onChange={(e) => setNewRemarksText(e.target.value)}
                            className="w-full bg-white border border-slate-300 px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateStatus(selectedTicket.id, selectedTicket.status, newRemarksText);
                              setNewRemarksText('');
                            }}
                            className="px-3 py-1 bg-slate-900 text-white hover:bg-slate-800 font-extrabold uppercase text-[9px]"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Department Allocation / Officer assignment dropdowns */}
                    <div className="border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <h4 className="font-bold text-[10px] uppercase text-slate-600 tracking-wider">SLA Queue Delegation</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 mb-1">Delegate Department</label>
                          <select
                            value={reassignDeptKey || selectedTicket.departmentKey}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReassignDeptKey(val);
                              // Auto trigger reassignment
                              setTimeout(() => {
                                handleReassign(selectedTicket.id);
                              }, 100);
                            }}
                            className="w-full bg-white border border-slate-300 py-1 px-2 text-[10px] font-bold"
                          >
                            {departments.map((dept) => (
                              <option key={dept.key} value={dept.key}>
                                {dept.name} ({dept.key.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[9px] uppercase text-slate-400 mb-1">Delegate Officer Staff</label>
                          <select
                            value={selectedTicket.officerId || ''}
                            onChange={(e) => handleAssignOfficer(selectedTicket.id, e.target.value)}
                            className="w-full bg-white border border-slate-300 py-1 px-2 text-[10px] font-bold"
                          >
                            <option value="">Unassigned</option>
                            {staffList
                              .filter(s => s.role === 'staff' && s.departmentKey === selectedTicket.departmentKey)
                              .map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* Subject & Description Details */}
                <div className="space-y-2 border-t pt-4">
                  <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Dossier Subject & Core Description</h4>
                  <div className="p-4 bg-slate-50 border border-slate-200 select-all leading-relaxed whitespace-pre-wrap text-slate-700 text-xs">
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Evidence Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-2 border-t pt-4">
                    <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Evidence Artifact Files</h4>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedTicket.attachments.map((url: string, i: number) => (
                        <div key={i} className="relative group border border-slate-200 bg-white p-1">
                          <img
                            src={url}
                            alt="Incident Artifact"
                            referrerPolicy="no-referrer"
                            className="max-h-36 object-contain cursor-zoom-in group-hover:opacity-90 transition-all hover:scale-[1.02]"
                            onClick={() => setActiveViewerImage(url)}
                          />
                          <div className="absolute bottom-1 right-1 bg-slate-900/80 px-1 text-[8px] text-white font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to expand
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Private Administrative Internal Notes Section */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[10px] uppercase text-rose-800 tracking-wider">Private Executive Internal Notes (Confidential)</h4>
                    <span className="text-[9px] font-mono text-slate-400">Strictly visible to Super Admins</span>
                  </div>
                  <div className="space-y-2">
                    <textarea
                      placeholder="Write administrative reviews, investigation coordinates, or disciplinary logs. This content is completely private and is NEVER dispatched to the student..."
                      value={internalNotesText}
                      onChange={(e) => setInternalNotesText(e.target.value)}
                      className="w-full min-h-[70px] bg-amber-50/20 border border-amber-200/60 p-3 outline-none text-xs leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleUpdateInternalNotes(selectedTicket.id, internalNotesText)}
                        className="px-4 py-1.5 bg-slate-900 text-white hover:bg-slate-800 font-extrabold uppercase text-[9px] tracking-wider"
                      >
                        Commit Confidential Note
                      </button>
                    </div>
                  </div>
                </div>

                {/* Student Satisfaction Feedback */}
                {selectedTicket.feedback && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 space-y-2 border-t pt-4">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                      <Check className="w-4 h-4" /> STUDENT SATISFACTION VERIFIED
                    </div>
                    <div className="text-[11px] leading-normal text-emerald-900">
                      <div>
                        <strong>Rating index:</strong> <span className="text-amber-500 font-black text-xs">{'★'.repeat(selectedTicket.feedback.rating)}{'☆'.repeat(5 - selectedTicket.feedback.rating)}</span> ({selectedTicket.feedback.rating}/5 Stars)
                      </div>
                      <div className="mt-1">
                        <strong>Student Commentary:</strong> <span className="italic">"{selectedTicket.feedback.remarks || 'No written commentary provided.'}"</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Detailed Step Timeline */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Audit Investigation Timeline History</h4>
                  
                  <div className="relative pl-6 border-l border-slate-200 space-y-4 pt-2">
                    {(selectedTicket.timeline || []).map((ev: any, idx: number) => (
                      <div key={idx} className="relative text-[11px]">
                        <span className="absolute -left-[30px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-white" />
                        <div className="font-bold text-slate-850 flex items-center gap-2">
                          <span>{ev.title}</span>
                          <span className="font-mono text-[9px] text-slate-400 font-bold font-semibold bg-slate-100 px-1.5">BY: {ev.actor || 'System'}</span>
                        </div>
                        <div className="text-[10px] text-slate-450 font-mono mt-0.5">{new Date(ev.timestamp).toLocaleString()}</div>
                        <p className="text-slate-650 italic mt-1 font-medium">"{ev.subtitle || 'No subtitle provided.'}"</p>
                        {ev.remarks && (
                          <div className="mt-1 bg-slate-50 p-2 border border-slate-150 text-[10.5px] leading-relaxed text-slate-700 italic">
                            Remarks: "{ev.remarks}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0">
                <span className="text-[9px] font-mono text-slate-400 font-bold">Document compiled by CampusConnect Audit Engine.</span>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setSelectedTicket(null);
                  }}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-extrabold uppercase tracking-wider text-[10px]"
                >
                  Close Dossier File
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      <ImageViewer src={activeViewerImage} onClose={() => setActiveViewerImage(null)} />
    </div>
  );
}
