import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Hash, User, Phone, Lock, Eye, EyeOff, LayoutPanelLeft, ShieldAlert, GraduationCap, Landmark, Users, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../utils/csrf';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: any, token: string) => void;
  isDarkMode: boolean;
  initialRole?: 'student' | 'department' | 'admin';
}

export default function AuthModal({ isOpen, onClose, onSuccess, isDarkMode, initialRole = 'student' }: AuthModalProps) {
  const navigate = useNavigate();
  const [selectedRoleTab, setSelectedRoleTab] = useState<'student' | 'department' | 'admin'>('student');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Multi-Institution State
  interface Institution {
    id: string;
    name: string;
    type: string;
  }
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState('default');

  // Sign In inputs
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up inputs
  const [signupName, setSignupName] = useState('');
  const [signupEnrollment, setSignupEnrollment] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupContact, setSignupContact] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Inline Forgot Password state
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'password'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Fetch institutions
  useEffect(() => {
    if (isOpen) {
      const fetchInsts = async () => {
        try {
          const res = await fetch('/api/institutions');
          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            const data = await res.json();
            setInstitutions(data);
            if (data.length > 0) {
              setSelectedInstId(data[0].id);
            }
          }
        } catch (e) {
          console.warn('Deferred institutions load in modal:', (e as any)?.message || e);
        }
      };
      fetchInsts();
    }
  }, [isOpen]);

  const resetForgotStates = () => {
    setIsForgotMode(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
    setForgotMessage('');
    setForgotStep('email');
    setOtpCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Set active role tab when modal opens with an initial role parameter
  useEffect(() => {
    if (isOpen && initialRole) {
      const activeRole = initialRole === 'admin' ? 'admin' : initialRole === 'department' ? 'department' : 'student';
      setSelectedRoleTab(activeRole);
      setIsRegister(false);
      setError('');
      resetForgotStates();
    }
  }, [isOpen, initialRole]);

  // Handle manual role changing in modal
  const handleRoleTabChange = (role: 'student' | 'department' | 'admin') => {
    setSelectedRoleTab(role);
    setIsRegister(false);
    setError('');
    resetForgotStates();
  };

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      setError('Please fill in check credentials.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const effectiveInstId = (selectedInstId && selectedInstId !== 'default') ? selectedInstId : (institutions[0]?.id || selectedInstId);
      
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
          institutionId: effectiveInstId,
          role: selectedRoleTab,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let resData: any = null;
      if (contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        const text = await response.text();
        console.warn('[CLIENT AUTH LOGIN] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(text || `Authentication service returned HTTP ${response.status}. Please refresh and retry.`);
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Authentication credentials rejection. Please check your credentials.');
      }

      onSuccess(resData.user, resData.token);
      onClose();
    } catch (err: any) {
      console.error('[CLIENT AUTH LOGIN ERROR] Complete server error details:', err);
      setError(err.message || 'Connecting failure to university server.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName || !signupEnrollment || !signupEmail || !signupContact || !signupPassword) {
      setError('Complete all registration inputs.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          enrollmentNumber: signupEnrollment,
          email: signupEmail,
          contactNumber: signupContact,
          password: signupPassword,
          institutionId: selectedInstId,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let resData: any = null;
      if (contentType.includes('application/json')) {
        resData = await response.json();
      } else {
        const text = await response.text();
        console.warn('[CLIENT AUTH REGISTER] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(text || `Registration service returned HTTP ${response.status}. Please refresh and retry.`);
      }

      if (!response.ok) {
        throw new Error(resData.error || 'Invalid credentials format or registered credentials.');
      }

      onSuccess(resData.user, resData.token);
      onClose();
    } catch (err: any) {
      console.error('[CLIENT AUTH REGISTER ERROR] Complete server error details:', err);
      setError(err.message || 'Connecting failure to university server.');
    } finally {
      setLoading(false);
    }
  };

  // Inline Forgot Password Handlers
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess(false);

    try {
      const effectiveInstId = (selectedInstId && selectedInstId !== 'default') ? selectedInstId : (institutions[0]?.id || selectedInstId);
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          institutionId: effectiveInstId
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('[CLIENT FORGOT PASSWORD ERROR] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(`The security service returned an unexpected response (HTTP ${res.status}). Please verify service status.`);
      }

      if (res.ok && data.success) {
        setForgotStep('otp');
        setOtpCountdown(60);
        setForgotMessage(data.message);
      } else {
        setForgotError(data.error || 'Failed to dispatch OTP verification code.');
      }
    } catch (err: any) {
      console.error('[CLIENT FORGOT PASSWORD ERROR] Complete server error details:', err);
      setForgotError(err.message || 'A secure server connection could not be established.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const effectiveInstId = (selectedInstId && selectedInstId !== 'default') ? selectedInstId : (institutions[0]?.id || selectedInstId);
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          institutionId: effectiveInstId,
          otp: otpCode.trim()
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('[CLIENT VERIFY OTP ERROR] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(`Verification service returned an unexpected response (HTTP ${res.status}).`);
      }

      if (res.ok && data.success) {
        setResetToken(data.resetToken);
        setForgotStep('password');
      } else {
        setForgotError(data.error || 'Incorrect or expired verification code.');
      }
    } catch (err: any) {
      console.error('[CLIENT VERIFY OTP ERROR] Complete server error details:', err);
      setForgotError(err.message || 'A secure server connection could not be established.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setForgotError('Please complete all password inputs.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: resetToken,
          password: newPassword,
          confirmPassword: confirmPassword
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('[CLIENT RESET PASSWORD ERROR] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(`Reset password service returned an unexpected response (HTTP ${res.status}).`);
      }

      if (res.ok && data.success) {
        setForgotSuccess(true);
        setForgotMessage(data.message);
        setForgotStep('email');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setForgotError(data.error || 'Failed to update your password.');
      }
    } catch (err: any) {
      console.error('[CLIENT RESET PASSWORD ERROR] Complete server error details:', err);
      setForgotError(err.message || 'A secure server connection could not be established.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border transition-all ${
          isDarkMode 
            ? 'bg-slate-900 text-white border-slate-800' 
            : 'bg-white text-slate-800 border-slate-200'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50'}`}>
          <button 
            type="button"
            onClick={() => {
              if (isForgotMode) {
                setIsForgotMode(false);
              } else {
                onClose();
                navigate('/');
              }
            }} 
            className="flex items-center gap-1.5 py-1.5 px-3 border border-slate-300 bg-white hover:bg-slate-100 hover:text-blue-900 transition-colors text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isForgotMode ? 'Back to Sign In' : 'Back to Home'}</span>
          </button>
          
          <div className="text-right">
            <h3 className="font-extrabold text-sm uppercase tracking-tight text-slate-800 leading-none">
              {isForgotMode ? 'Recover Password' : 'CampusConnect'}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
              {isForgotMode ? `${selectedRoleTab.toUpperCase()} ACCOUNT` : 'University Grievance Portal'}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isForgotMode ? (
            <div className="space-y-6 py-2 animate-fade-in">
              <div className="text-center space-y-2">
                <div className="mx-auto w-11 h-11 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <h3 className={`text-base font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Recover Credentials</h3>
                <p className={`text-xs leading-relaxed max-w-sm mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {forgotStep === 'email' && 'Enter your registered email address to receive a secure, time-limited OTP code.'}
                  {forgotStep === 'otp' && 'Enter the 6-digit verification code sent to your registered email.'}
                  {forgotStep === 'password' && 'Enter and confirm your new secure password.'}
                </p>
              </div>

              {forgotError && (
                <div className={`p-3 rounded-lg mb-4 flex items-start gap-2.5 text-xs ${
                  isDarkMode ? 'bg-rose-950/40 border border-rose-900 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-850'
                }`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess ? (
                <div className="space-y-5 max-w-sm mx-auto text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 animate-bounce">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Reset Successful</h4>
                    <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {forgotMessage}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsForgotMode(false);
                      setForgotSuccess(false);
                      setForgotStep('email');
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all border-0"
                  >
                    Sign In Now
                  </button>
                </div>
              ) : (
                <>
                  {forgotStep === 'email' && (
                    <form onSubmit={handleForgotSubmit} className="space-y-4 max-w-sm mx-auto">
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Selected Educational Institution
                        </label>
                        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                          isDarkMode 
                            ? 'border-slate-800 bg-slate-950/40 text-slate-200' 
                            : 'border-slate-200 bg-slate-50 text-slate-800'
                        }`}>
                          <Landmark className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="truncate">
                            {institutions.find(i => i.id === selectedInstId)?.name || 'Central Directory (General)'}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Your Registered Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="e.g. student@institution.edu"
                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                              isDarkMode 
                                ? 'border-slate-800 bg-slate-950/60 text-slate-200' 
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 border-0"
                      >
                        {forgotLoading ? (
                          <span>Generating Security Code...</span>
                        ) : (
                          <span>Send OTP Verification Code</span>
                        )}
                      </button>
                    </form>
                  )}

                  {forgotStep === 'otp' && (
                    <form onSubmit={handleVerifyOtpSubmit} className="space-y-4 max-w-sm mx-auto">
                      <div className={`p-3 border rounded-lg text-xs leading-relaxed ${
                        isDarkMode 
                          ? 'bg-indigo-950/40 border-indigo-900 text-indigo-300' 
                          : 'bg-indigo-50 border-indigo-100 text-indigo-900'
                      }`}>
                        A secure OTP validation code has been generated and dispatched. Please check your inbox for <strong>{forgotEmail}</strong>.
                      </div>

                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          6-Digit OTP Code
                        </label>
                        <div className="relative">
                          <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            required
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 123456"
                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 tracking-[0.2em] font-mono transition-all ${
                              isDarkMode 
                                ? 'border-slate-800 bg-slate-950/60 text-slate-200' 
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 border-0"
                      >
                        {forgotLoading ? (
                          <span>Verifying Code...</span>
                        ) : (
                          <span>Verify OTP Security Code</span>
                        )}
                      </button>

                      <div className="text-center pt-2">
                        {otpCountdown > 0 ? (
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Resend security code in {otpCountdown}s
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleForgotSubmit}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 hover:underline uppercase tracking-wider cursor-pointer"
                          >
                            Resend security code
                          </button>
                        )}
                      </div>
                    </form>
                  )}

                  {forgotStep === 'password' && (
                    <form onSubmit={handleResetPasswordSubmit} className="space-y-4 max-w-sm mx-auto">
                      <div className={`p-3 border rounded-lg text-xs leading-relaxed flex items-start gap-2 ${
                        isDarkMode 
                          ? 'bg-amber-950/40 border-amber-900 text-amber-300' 
                          : 'bg-amber-50 border-amber-100 text-amber-900'
                      }`}>
                        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                        <span>Reset token verified successfully. Create a new secure password.</span>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          New Secure Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                              isDarkMode 
                                ? 'border-slate-800 bg-slate-950/60 text-slate-200' 
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password..."
                            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                              isDarkMode 
                                ? 'border-slate-800 bg-slate-950/60 text-slate-200' 
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2 border-0"
                      >
                        {forgotLoading ? (
                          <span>Updating Directory...</span>
                        ) : (
                          <span>Save & Apply New Password</span>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotMode(false)}
                  className={`text-xs font-bold cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}
                >
                  Cancel and Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Subheader or Main Gateway Selection tabs inside modal */}
              <div className="mb-6 space-y-2">
                <label className={`block text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Secured Gateway Selector
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-250">
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('student')}
                    className={`py-1.5 px-1 text-xs font-bold rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedRoleTab === 'student'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('department')}
                    className={`py-1.5 px-1 text-xs font-bold rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedRoleTab === 'department'
                        ? 'bg-indigo-700 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Department</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleTabChange('admin')}
                    className={`py-1.5 px-1 text-xs font-bold rounded flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      selectedRoleTab === 'admin'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              {/* If Student is selected, we can allow Sign In or Student Register tabs */}
              {selectedRoleTab === 'student' ? (
                <div className="flex rounded-lg p-1.5 mb-6 bg-slate-100">
                  <button
                    id="login-tab-btn"
                    type="button"
                    onClick={() => { setIsRegister(false); setError(''); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      !isRegister
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    id="signup-tab-btn"
                    type="button"
                    onClick={() => { setIsRegister(true); setError(''); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      isRegister
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Student Register
                  </button>
                </div>
              ) : (
                <div className="mb-6 p-2.5 bg-sky-50 border border-sky-100 rounded text-[11px] text-sky-900 flex items-center gap-2 leading-snug">
                  <span className="font-bold uppercase tracking-wider text-[8px] bg-sky-200 text-sky-850 px-1 py-0.5 rounded flex-shrink-0">Access Mode</span>
                  <span>Secure credential validation. Accounts for officers/administrators are pre-configured.</span>
                </div>
              )}

              {error && (
                <div className={`p-3 rounded-lg mb-4 flex items-start gap-2.5 text-xs ${
                  isDarkMode ? 'bg-rose-950/40 border border-rose-900 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Core Fields Form */}
              {!isRegister ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Select Educational Institution
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Landmark className="w-4.5 h-4.5" />
                      </span>
                      <select
                        value={selectedInstId}
                        onChange={(e) => setSelectedInstId(e.target.value)}
                        className={`w-full py-2.5 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all appearance-none cursor-pointer ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
                        }`}
                      >
                        {institutions.length === 0 ? (
                          <option value="default">State University</option>
                        ) : (
                          institutions.map(inst => (
                            <option key={inst.id} value={inst.id}>{inst.name} ({inst.type})</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      University Email or Enrollment Code
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Hash className="w-4.5 h-4.5" />
                      </span>
                      <input
                        id="login-username-input"
                        type="text"
                        required
                        placeholder="e.g. STU1001 or alex@campusconnect.edu"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className={`w-full py-2.5 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Access Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Lock className="w-4.5 h-4.5" />
                      </span>
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={`w-full py-2.5 pl-10 pr-10 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer w-4 h-4"
                      />
                      <span>Keep me signed in</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        setForgotStep('email');
                        setForgotError('');
                        setForgotSuccess(false);
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      id="login-submit-btn"
                      type="submit"
                      disabled={loading}
                      className={`w-full py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer transition-colors shadow-md disabled:opacity-50 ${
                        selectedRoleTab === 'student'
                          ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-600/10'
                          : selectedRoleTab === 'department'
                            ? 'bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 shadow-indigo-700/10'
                            : 'bg-slate-800 hover:bg-slate-900 active:bg-slate-950 shadow-slate-800/10'
                      }`}
                    >
                      {loading ? 'Processing System Logins...' : `Secure Sign In to ${selectedRoleTab === 'student' ? 'Student' : selectedRoleTab === 'department' ? 'Department' : 'Admin'} Portal`}
                    </button>
                  </div>

                  <div className="text-center pt-2 text-xs text-slate-500 leading-normal">
                    {selectedRoleTab === 'student' ? (
                      <span>Student credentials auto-filled. (IDs range: <strong>STU1001 - STU1005</strong>)</span>
                    ) : selectedRoleTab === 'department' ? (
                      <span>Officer credentials auto-filled. Change email input to switch departments (e.g. <strong>itsupport@campusconnect.edu</strong>).</span>
                    ) : (
                      <span>Super Admin credentials auto-filled. Access all tickets and system metrics.</span>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Educational Institution
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Landmark className="w-4.5 h-4.5" />
                      </span>
                      <select
                        value={selectedInstId}
                        onChange={(e) => setSelectedInstId(e.target.value)}
                        className={`w-full py-2 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all appearance-none cursor-pointer ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
                        }`}
                      >
                        {institutions.length === 0 ? (
                          <option value="default">State University</option>
                        ) : (
                          institutions.map(inst => (
                            <option key={inst.id} value={inst.id}>{inst.name} ({inst.type})</option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Full Name
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="signup-name-input"
                        type="text"
                        required
                        placeholder="e.g. Alex Rivera"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className={`w-full py-2 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Enrollment Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Hash className="w-4 h-4" />
                      </span>
                      <input
                        id="signup-enrollment-input"
                        type="text"
                        required
                        placeholder="e.g. STU1001"
                        value={signupEnrollment}
                        onChange={(e) => setSignupEnrollment(e.target.value)}
                        className={`w-full py-2 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      College Email
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        id="signup-email-input"
                        type="email"
                        required
                        placeholder="e.g. alex.rivera@campusconnect.edu"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className={`w-full py-2 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Contact Phone Number
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Phone className="w-4 h-4" />
                      </span>
                      <input
                        id="signup-contact-input"
                        type="tel"
                        required
                        placeholder="e.g. +1 (555) 9988"
                        value={signupContact}
                        onChange={(e) => setSignupContact(e.target.value)}
                        className={`w-full py-2 pl-10 pr-4 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold mb-1 uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Access Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                        <Lock className="w-4.5 h-4.5" />
                      </span>
                      <input
                        id="signup-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimum 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className={`w-full py-2 pl-10 pr-10 text-sm rounded-lg border outline-none transition-all ${
                          isDarkMode 
                            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      id="signup-submit-btn"
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg cursor-pointer transition-colors shadow-md shadow-indigo-600/10 disabled:opacity-50"
                    >
                      {loading ? 'Creating Student Credentials...' : 'Submit Register'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
