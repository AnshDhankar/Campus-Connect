import React, { useState } from 'react';
import { 
  KeyRound, Lock, Eye, EyeOff, Check, X, ShieldCheck, 
  ArrowLeft, AlertCircle, CheckCircle2, Loader2, Shield
} from 'lucide-react';
import { apiFetch } from '../utils/csrf';

interface ChangePasswordProps {
  user: any;
  token: string;
  isDarkMode: boolean;
  onBack: () => void;
  onSuccess?: () => void;
}

export default function ChangePassword({
  user,
  token,
  isDarkMode,
  onBack,
  onSuccess
}: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password requirements validation checklist
  const requirements = {
    length: newPassword.length >= 6,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };

  const isPasswordValid = Object.values(requirements).every(Boolean);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormReady = currentPassword.length > 0 && isPasswordValid && isMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submission

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!isPasswordValid) {
      setError('Please satisfy all password security requirements.');
      return;
    }

    if (!isMatch) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Authentication server returned unexpected status HTTP ${res.status}.`);
      }

      if (res.ok && data.success) {
        setSuccess(data.message || 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(data.error || 'Failed to change password. Please verify your current credentials.');
      }
    } catch (err: any) {
      console.error('[CLIENT CHANGE PASSWORD ERROR]', err);
      setError(err.message || 'A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      
      {/* Breadcrumb & Navigation Back Action */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider py-2 px-3.5 rounded-lg border transition-all cursor-pointer ${
            isDarkMode 
              ? 'border-charcoal-700 bg-charcoal-900 hover:bg-charcoal-800 text-slate-300 hover:text-white' 
              : 'border-paper-300 bg-white hover:bg-paper-100 text-slate-700 hover:text-navy-950 shadow-2xs'
          }`}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Workspace</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>Security</span>
          <span>/</span>
          <span className="text-gold-500 font-semibold">Change Password</span>
        </div>
      </div>

      {/* Main Card Container */}
      <div className={`rounded-2xl border shadow-xl p-6 sm:p-8 space-y-6 transition-colors ${
        isDarkMode ? 'bg-charcoal-900 border-charcoal-800 text-slate-100' : 'bg-white border-paper-300 text-navy-950'
      }`}>

        {/* Header Lockup */}
        <div className={`pb-6 border-b flex items-start gap-4 ${
          isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
        }`}>
          <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/30 text-gold-500 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                user?.role === 'superadmin'
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800'
                  : user?.role === 'staff'
                    ? 'bg-sky-950/40 text-sky-300 border-sky-800'
                    : 'bg-gold-950/40 text-gold-300 border-gold-800'
              }`}>
                {user?.role === 'superadmin' ? 'Administrator' : user?.role === 'staff' ? 'Staff Coordinator' : 'Student Account'}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Verified Session
              </span>
            </div>

            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight mt-1 ${
              isDarkMode ? 'text-white' : 'text-navy-950'
            }`}>
              Change Security Password
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Update your account credentials. You must provide your current password for verification before a new password can be stored.
            </p>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {success && (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl space-y-3 animate-fade-in">
            <div className="flex items-center gap-2.5 font-bold text-sm text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Password Changed Successfully</span>
            </div>
            <p className="text-slate-300 leading-relaxed font-sans">
              {success} Your new credentials are active immediately for future sign-ins.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onBack}
                className="py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Return to Workspace
              </button>
            </div>
          </div>
        )}

        {/* Change Password Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Field 1: Current Password */}
            <div className="space-y-1.5">
              <label 
                htmlFor="current-password-input"
                className="block text-xs font-bold uppercase tracking-wider font-mono text-slate-400"
              >
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="current-password-input"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter your existing password"
                  autoComplete="current-password"
                  className={`w-full text-xs py-2.5 pl-3.5 pr-10 rounded-xl border outline-none font-mono transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-700 text-white placeholder-slate-500 focus:border-gold-400' 
                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-gold-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field 2: New Password */}
            <div className="space-y-1.5">
              <label 
                htmlFor="new-password-input"
                className="block text-xs font-bold uppercase tracking-wider font-mono text-slate-400"
              >
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="new-password-input"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Create a strong new password"
                  autoComplete="new-password"
                  className={`w-full text-xs py-2.5 pl-3.5 pr-10 rounded-xl border outline-none font-mono transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-700 text-white placeholder-slate-500 focus:border-gold-400' 
                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-gold-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Security Policy Requirements Indicator */}
              <div className={`p-4 rounded-xl border text-xs space-y-2 mt-2 ${
                isDarkMode ? 'bg-charcoal-950/70 border-charcoal-800' : 'bg-paper-50 border-paper-200'
              }`}>
                <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-slate-400 block">
                  Password Complexity Criteria
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className={`flex items-center gap-1.5 ${requirements.length ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                    {requirements.length ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                    <span>At least 6 characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${requirements.uppercase ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                    {requirements.uppercase ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                    <span>One uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${requirements.lowercase ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                    {requirements.lowercase ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                    <span>One lowercase letter (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${requirements.number ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                    {requirements.number ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                    <span>At least one number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 sm:col-span-2 ${requirements.special ? 'text-emerald-500 font-semibold' : 'text-slate-400'}`}>
                    {requirements.special ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-slate-500" />}
                    <span>One special character (!, @, #, $, %, etc.)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Field 3: Confirm New Password */}
            <div className="space-y-1.5">
              <label 
                htmlFor="confirm-password-input"
                className="block text-xs font-bold uppercase tracking-wider font-mono text-slate-400"
              >
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirm-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Re-type your new password"
                  autoComplete="new-password"
                  className={`w-full text-xs py-2.5 pl-3.5 pr-10 rounded-xl border outline-none font-mono transition-all focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    isDarkMode 
                      ? 'bg-charcoal-950 border-charcoal-700 text-white placeholder-slate-500 focus:border-gold-400' 
                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-gold-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
                  aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {confirmPassword.length > 0 && (
                <div className="text-[11px] font-mono pt-1">
                  {isMatch ? (
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-400 font-medium flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className={`pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDarkMode ? 'border-charcoal-800' : 'border-paper-200'
            }`}>
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className={`w-full sm:w-auto py-2.5 px-5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer text-center ${
                  isDarkMode 
                    ? 'border-charcoal-700 text-slate-400 hover:text-white hover:bg-charcoal-800' 
                    : 'border-paper-300 text-slate-600 hover:text-navy-950 hover:bg-paper-100'
                }`}
              >
                Cancel
              </button>

              <button
                type="submit"
                id="submit-change-password-btn"
                disabled={!isFormReady || loading}
                className={`w-full sm:w-auto py-2.5 px-7 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                  isFormReady && !loading
                    ? 'bg-gold-400 hover:bg-gold-300 active:bg-gold-500 text-navy-950 focus-visible:ring-2 focus-visible:ring-gold-400'
                    : 'bg-slate-300 dark:bg-charcoal-800 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-70'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-navy-950" />
                    <span>Verifying & Updating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
