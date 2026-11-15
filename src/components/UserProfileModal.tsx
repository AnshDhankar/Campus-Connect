import React, { useState } from 'react';
import { 
  User, ShieldCheck, Mail, Phone, Building2, Key, LogOut, 
  X, Check, AlertCircle, Calendar, Hash, Shield, BadgeAlert
} from 'lucide-react';
import { Department } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  departments: Department[];
  isDarkMode: boolean;
  onLogout: () => void;
  onUpdateUser?: (updatedUser: any, updatedToken?: string) => void;
  onNavigateChangePassword: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  user,
  departments,
  isDarkMode,
  onLogout,
  onUpdateUser,
  onNavigateChangePassword
}: UserProfileModalProps) {
  if (!isOpen || !user) return null;

  // Local state for editing name (supported for admin)
  const isAdmin = user.role === 'superadmin';
  const isStaff = user.role === 'staff';
  const isStudent = user.role === 'student';

  const [editName, setEditName] = useState(user.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Find department profile if staff
  const staffDept = departments.find(d => d.key === user.departmentKey);

  // User initials for avatar
  const initials = (user.name || user.email || 'CC')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Handle save name (for student or general profile updates)
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setSaveError('Name cannot be empty.');
      return;
    }

    try {
      if (user.role === 'student') {
        const csrfToken = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='))?.split('=')[1];
        await fetch('/api/students/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
          },
          body: JSON.stringify({ name: editName.trim() })
        });
      }

      const updatedUser = { ...user, name: editName.trim() };
      if (onUpdateUser) {
        onUpdateUser(updatedUser);
      }
      setIsEditing(false);
      setSaveSuccess('Display name updated successfully.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch {
      setSaveError('Failed to update profile name.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div 
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 ${
          isDarkMode 
            ? 'bg-charcoal-900 border-charcoal-700 text-slate-100' 
            : 'bg-white border-paper-300 text-navy-950'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`p-6 border-b flex items-start justify-between gap-4 ${
          isDarkMode ? 'border-charcoal-800 bg-charcoal-950/40' : 'border-paper-200 bg-paper-50/70'
        }`}>
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar Initials with Role Accent */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold font-mono shadow-xs shrink-0 ${
              isAdmin 
                ? 'bg-rose-900 text-rose-100 border-2 border-rose-700' 
                : isStaff 
                  ? 'bg-sky-900 text-sky-100 border-2 border-sky-700' 
                  : 'bg-gold-500 text-navy-950 border-2 border-gold-400 font-extrabold'
            }`}>
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  isAdmin 
                    ? 'bg-rose-950/40 text-rose-300 border-rose-800' 
                    : isStaff 
                      ? 'bg-sky-950/40 text-sky-300 border-sky-800' 
                      : 'bg-gold-950/40 text-gold-300 border-gold-800'
                }`}>
                  {isAdmin ? 'System Administrator' : isStaff ? 'Staff Coordinator' : 'Verified Student'}
                </span>
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Active Session
                </span>
              </div>

              <h2 id="profile-modal-title" className={`text-xl font-bold tracking-tight mt-1 truncate ${
                isDarkMode ? 'text-white' : 'text-navy-950'
              }`}>
                {user.name || 'CampusConnect User'}
              </h2>
              <p className="text-xs text-slate-400 font-mono truncate">
                {user.email || `${user.id || 'account'}@campusconnect.edu`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isDarkMode 
                ? 'border-charcoal-700 hover:bg-charcoal-800 text-slate-400 hover:text-white' 
                : 'border-paper-300 hover:bg-paper-100 text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Close profile modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Information Grid */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Identity & Account Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${
                isDarkMode ? 'text-gold-400' : 'text-navy-900'
              }`}>
                Account Identity & Credentials
              </h3>
              {isAdmin && !isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-semibold text-gold-500 hover:text-gold-400 cursor-pointer"
                >
                  Edit Display Name
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveName} className="space-y-3 p-3 rounded-xl border border-gold-500/30 bg-gold-500/5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none font-medium ${
                      isDarkMode 
                        ? 'bg-charcoal-950 border-charcoal-700 text-white focus:border-gold-400' 
                        : 'bg-white border-paper-300 text-slate-900 focus:border-gold-500'
                    }`}
                    placeholder="Enter full name"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(user.name || '');
                    }}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-600 text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className={`p-4 rounded-xl border divide-y text-xs ${
                isDarkMode ? 'bg-charcoal-950/60 border-charcoal-800 divide-charcoal-800' : 'bg-paper-50 border-paper-200 divide-paper-200'
              }`}>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Full Legal Name
                  </span>
                  <strong className="font-semibold">{user.name || 'N/A'}</strong>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Authorized Email
                  </span>
                  <span className="font-mono text-slate-300 select-all">{user.email || 'N/A'}</span>
                </div>

                {isStudent && (
                  <>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        Enrollment Number
                      </span>
                      <strong className="font-mono font-bold text-gold-400">{user.enrollmentNumber || 'N/A'}</strong>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Registered Phone
                      </span>
                      <span className="font-mono">{user.contactNumber || 'N/A'}</span>
                    </div>
                  </>
                )}

                {isStaff && (
                  <>
                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        Assigned Department
                      </span>
                      <strong className="font-semibold text-sky-400">
                        {staffDept?.name || user.departmentKey?.toUpperCase() || 'General Department'}
                      </strong>
                    </div>

                    <div className="py-2 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        Department Desk Code
                      </span>
                      <strong className="font-mono text-xs">{user.departmentKey?.toUpperCase() || 'ACAD'}</strong>
                    </div>

                    {user.employeeId && (
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Employee ID
                        </span>
                        <strong className="font-mono">{user.employeeId}</strong>
                      </div>
                    )}
                  </>
                )}

                {user.institutionId && (
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Institution Reference
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{user.institutionId}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Security & Actions */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${
              isDarkMode ? 'text-gold-400' : 'text-navy-900'
            }`}>
              Account Security & Access Control
            </h3>

            <div className={`p-4 rounded-xl border space-y-3 ${
              isDarkMode ? 'bg-charcoal-950/60 border-charcoal-800' : 'bg-paper-50 border-paper-200'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold">Security Password</p>
                  <p className="text-[11px] text-slate-400">Manage or update your campus login credentials</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateChangePassword();
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 text-white border-slate-600"
                >
                  <Key className="w-3.5 h-3.5 text-gold-400" />
                  <span>Change Password</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-700/40 text-[11px] text-slate-400 leading-relaxed font-sans">
                {isStudent ? (
                  <span>
                    Enrollment credentials and registered contact numbers are certified by the institutional registrar. To request an update to your official records, please file a request to the Academic Records desk.
                  </span>
                ) : isStaff ? (
                  <span>
                    Department coordinator assignments and privileged desks are managed by the Institution Administration office. Contact your institutional superadmin for department role modifications.
                  </span>
                ) : (
                  <span>
                    You are logged in with Master Administrative Privileges. To reconfigure institution details, consult the Institution Profile and System Settings modules.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 ${
          isDarkMode ? 'border-charcoal-800 bg-charcoal-950/80' : 'border-paper-200 bg-paper-50'
        }`}>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="py-2 px-3.5 rounded-lg text-xs font-bold uppercase tracking-wider text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-lg text-xs font-bold uppercase tracking-wider bg-gold-400 hover:bg-gold-300 text-navy-950 transition-colors cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
