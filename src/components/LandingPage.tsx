import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, Landmark, Users, Lock, Mail, Eye, EyeOff, 
  Check, Globe, MapPin, User, ArrowRight, ArrowLeft, GraduationCap, ShieldCheck,
  Sparkles, AlertCircle, CheckCircle2, Upload, X
} from 'lucide-react';
import { Department } from '../types';
import { apiFetch } from '../utils/csrf';
import { readAndOptimizeFileAsDataUrl } from '../utils/imageCompression';

interface LandingPageProps {
  onOpenAuth: (role?: 'student' | 'department' | 'admin') => void;
  onOpenDbStatus?: () => void;
  departments: Department[];
  isDarkMode: boolean;
  onSuccess?: (userData: any, token: string) => void;
  initialTab?: 'login' | 'register' | 'forgot';
}

interface Institution {
  id: string;
  name: string;
  type: string;
  city: string;
  country: string;
  website: string;
}

export default function LandingPage({ onOpenDbStatus, onSuccess, departments, isDarkMode, onOpenAuth, initialTab = 'login' }: LandingPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(initialTab);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  useEffect(() => {
    const msg = localStorage.getItem('cc_delete_success');
    if (msg) {
      setDeleteSuccessMsg(msg);
      localStorage.removeItem('cc_delete_success');
    }
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  // Selected Institution
  const [selectedInst, setSelectedInst] = useState<Institution | null>(null);
  const [selectedInstId, setSelectedInstId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Login State
  const [loginRole, setLoginRole] = useState<'student' | 'department' | 'admin'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Institution Registration State (Onboarding Wizard)
  const [regStep, setRegStep] = useState(1);
  const [instName, setInstName] = useState('');
  const [instType, setInstType] = useState('University');
  const [instAddress, setInstAddress] = useState('');
  const [instCity, setInstCity] = useState('');
  const [instState, setInstState] = useState('');
  const [instCountry, setInstCountry] = useState('United States');
  const [instWebsite, setInstWebsite] = useState('');
  const [instLogo, setInstLogo] = useState('');
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');

  const handleLogoFileSelect = async (file: File) => {
    setLogoError('');
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setLogoError('Unsupported file type. Only JPG, PNG, and WEBP are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('File size exceeds the 5MB limit.');
      return;
    }

    try {
      const optimizedDataUrl = await readAndOptimizeFileAsDataUrl(file, {
        maxDimension: 1024,
        maxTargetBytes: 512 * 1024,
        quality: 0.85
      });
      setInstLogo(optimizedDataUrl);
    } catch {
      setLogoError('Could not parse image file.');
    }
  };
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Student Sign Up State
  const [isStudentSignUp, setIsStudentSignUp] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEnrollment, setStudentEnrollment] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentContact, setStudentContact] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentInstId, setStudentInstId] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentLoading, setStudentLoading] = useState(false);
  
  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [simulatedEmail, setSimulatedEmail] = useState<any>(null);

  const [forgotStep, setForgotStep] = useState<'email' | 'otp' | 'password'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Registered Institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const res = await fetch('/api/institutions');
      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setInstitutions(data);
        if (data.length > 0) {
          setStudentInstId(data[0].id);
          // Do not pre-select selectedInstId so the autocomplete select starts empty and the button is disabled initially
          setSelectedInstId('');
        }
      } else if (!res.ok && contentType && contentType.includes('application/json')) {
        const errData = await res.json().catch(() => null);
        if (errData?.isDatabaseUnavailable) {
          console.warn('[LandingPage] Database unavailable while loading institutions:', errData.error);
        }
      }
    } catch (err) {
      console.warn('Deferred institution retrieval:', (err as any)?.message || err);
    }
  };

  // Auto-fill test credentials helper
  const handleAutoFill = async (role: 'student' | 'department' | 'admin') => {
    setLoginRole(role);
    setLoginError('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('Please submit all login fields.');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const activeInstId = selectedInst?.id || institutions[0]?.id || 'default';
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, institutionId: activeInstId, role: loginRole })
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.warn('[CLIENT LOGIN] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(text || `Authentication service returned HTTP ${res.status}. Please refresh and try again.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Authentication rejected. Please check your credentials.');
      }

      if (onSuccess) {
        onSuccess(data.user, data.token);
      }
    } catch (err: any) {
      console.warn('[CLIENT LOGIN] Authentication rejected:', err.message || err);
      setLoginError(err.message || 'Connecting failure to secure portal.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess(false);
    setIsSandbox(false);

    try {
      const activeInstId = selectedInst?.id || institutions[0]?.id || 'default';
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          institutionId: activeInstId
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
        if (data.isSandbox) {
          setIsSandbox(true);
        }
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
      const activeInstId = selectedInst?.id || institutions[0]?.id || 'default';
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          institutionId: activeInstId,
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

  const handleStudentRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEnrollment || !studentEmail || !studentContact || !studentPassword || !studentInstId) {
      setStudentError('Please complete all registration inputs.');
      return;
    }

    setStudentLoading(true);
    setStudentError('');

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName,
          enrollmentNumber: studentEnrollment,
          email: studentEmail,
          contactNumber: studentContact,
          password: studentPassword,
          institutionId: studentInstId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      if (onSuccess) {
        onSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setStudentError(err.message || 'Registration failure.');
    } finally {
      setStudentLoading(false);
    }
  };

  const handleInstitutionRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName || !instType || !adminName || !adminEmail || !adminPassword) {
      setRegError('Please supply all required institution and administrator fields.');
      return;
    }

    setRegLoading(true);
    setRegError('');

    try {
      const res = await apiFetch('/api/institutions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: instName,
          type: instType,
          address: instAddress,
          city: instCity,
          state: instState,
          country: instCountry,
          website: instWebsite,
          logo: instLogo,
          adminName,
          adminEmail,
          adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Onboarding registration failed.');
      }

      if (onSuccess) {
        onSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setRegError(err.message || 'Failed to complete registration.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between selection:bg-navy-500 selection:text-white font-sans transition-colors duration-200 ${isDarkMode ? 'bg-charcoal-950 text-slate-100' : 'bg-paper-100 text-navy-950'}`}>
      
      {/* Brand Navigation Header */}
      <header className={`px-6 py-5 border-b backdrop-blur-md transition-colors duration-200 ${isDarkMode ? 'border-charcoal-800 bg-charcoal-900/40' : 'border-paper-300 bg-white/70 shadow-sm'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg flex items-center justify-center shadow-md transition-colors ${isDarkMode ? 'bg-gold-500 text-charcoal-950' : 'bg-navy-950 text-gold-400'}`}>
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-xl font-bold tracking-tight block ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>
                CampusConnect
              </span>
              <span className={`text-[10px] font-bold block tracking-wider uppercase ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`}>
                Unified Institutional Grievance Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {onOpenDbStatus && (
              <button
                type="button"
                onClick={onOpenDbStatus}
                className={`text-xs font-bold transition-colors uppercase tracking-wider flex items-center gap-1.5 px-3 py-1.5 border cursor-pointer rounded-md ${
                  isDarkMode 
                    ? 'text-slate-400 hover:text-white border-charcoal-800 bg-charcoal-900 hover:border-charcoal-700' 
                    : 'text-navy-700 hover:text-navy-950 border-paper-300 bg-white hover:border-navy-450'
                }`}
              >
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Status
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-5xl grid md:grid-cols-12 gap-8 items-center">
          
          {/* Informational Column */}
          <div className="md:col-span-5 space-y-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              isDarkMode ? 'bg-charcoal-900/60 border-charcoal-800 text-gold-400' : 'bg-white border-paper-300 text-navy-800 shadow-sm'
            }`}>
              <ShieldCheck className={`w-4 h-4 ${isDarkMode ? 'text-gold-400' : 'text-gold-500'}`} />
              <span>Multi-Tenant Grievance Infrastructure</span>
            </div>

            <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight leading-none ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>
              Any Institution. <br />
              <span className={isDarkMode ? 'text-gold-400' : 'text-gold-600 font-semibold'}>Zero Configuration.</span>
            </h1>

            <p className={`text-sm leading-relaxed font-sans ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>
              CampusConnect provides private, enterprise-grade isolated helpdesks for universities and colleges worldwide. Submit academic tickets, write complaints securely, and resolve operations instantly.
            </p>

            <div className={`p-5 border rounded-xl space-y-3 transition-colors ${
              isDarkMode ? 'bg-charcoal-900/40 border-charcoal-800' : 'bg-white border-paper-300 shadow-sm'
            }`}>
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-navy-900'}`}>Onboarding Guidelines</h4>
              <ul className={`space-y-2.5 text-xs ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>
                <li className="flex items-start gap-2">
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-gold-500' : 'text-emerald-600'}`} />
                  <span>Register your educational institution dynamically in under 60 seconds.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-gold-500' : 'text-emerald-600'}`} />
                  <span>Add unlimited customized administrative and academic departments.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-gold-500' : 'text-emerald-600'}`} />
                  <span>Complete end-to-end client database isolation and secure role boundaries.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Form Hub */}
          <div className="md:col-span-7">
            <div className={`border rounded-2xl shadow-xl relative transition-colors ${
              isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-300'
            }`}>
              
              {/* Tab Selector */}
              <div className={`flex border-b p-2 gap-1 rounded-t-2xl transition-colors ${
                isDarkMode ? 'border-charcoal-800 bg-charcoal-950/60' : 'border-paper-300 bg-paper-100/60'
              }`}>
                <button
                  onClick={() => { setActiveTab('login'); setIsStudentSignUp(false); }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'login'
                      ? (isDarkMode ? 'bg-charcoal-800 text-white border border-charcoal-700 shadow-sm' : 'bg-navy-950 text-white shadow-sm')
                      : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-navy-700 hover:text-navy-950')
                  }`}
                >
                  Gateway Login
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'register'
                      ? (isDarkMode ? 'bg-charcoal-800 text-white border border-charcoal-700 shadow-sm' : 'bg-navy-950 text-white shadow-sm')
                      : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-navy-700 hover:text-navy-950')
                  }`}
                >
                  Register Institution
                </button>
              </div>

              {/* Form Content */}
              <div className="p-6 md:p-8">
                
                {deleteSuccessMsg && (
                  <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 animate-fade-in text-xs font-medium border ${
                    isDarkMode 
                      ? 'bg-emerald-950/40 border-emerald-850 text-emerald-400' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm'
                  }`}>
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                    <div>
                      <p className={`font-extrabold uppercase tracking-wider text-[10px] mb-0.5 ${isDarkMode ? 'text-white' : 'text-emerald-900'}`}>Removal Successful</p>
                      <p className={`font-sans leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-emerald-800/80'}`}>{deleteSuccessMsg}</p>
                    </div>
                  </div>
                )}
                
                {/* INSTITUTION SELECTION BEFORE LOGIN OR FORGOT PASSWORD */}
                {(activeTab === 'login' || activeTab === 'forgot') && !selectedInst ? (
                  <div className="space-y-6 animate-fade-in relative z-20">
                    <div className="space-y-1">
                      <h3 className={`text-base font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>Select Your Institution</h3>
                      <p className={`text-xs font-sans ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>Search and choose your university or college portal to proceed to your secure gateway.</p>
                    </div>

                    {/* Autocomplete Search input & dropdown overlay */}
                    <div className="relative" ref={dropdownRef}>
                      <div className="relative">
                        <Building className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gold-450' : 'text-navy-700'}`} />
                        <input
                          type="text"
                          value={searchQuery}
                          onFocus={() => setIsDropdownOpen(true)}
                          onClick={() => setIsDropdownOpen(true)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSearchQuery(val);
                            setIsDropdownOpen(true);
                            // If the typed query exactly matches an institution's name, set selectedInstId, otherwise clear it
                            const found = institutions.find(i => i.name.toLowerCase() === val.toLowerCase());
                            if (found) {
                              setSelectedInstId(found.id);
                            } else {
                              setSelectedInstId('');
                            }
                          }}
                          placeholder="Search and select your institution..."
                          className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-xs font-semibold transition-all focus:outline-none focus:ring-1 ${
                            isDarkMode
                              ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                              : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                          }`}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedInstId('');
                              setIsDropdownOpen(true);
                            }}
                            className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full cursor-pointer transition-colors ${
                              isDarkMode ? 'text-slate-500 hover:text-white hover:bg-charcoal-800' : 'text-slate-400 hover:text-navy-950 hover:bg-paper-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Overlay */}
                      {isDropdownOpen && (
                        <div className={`absolute left-0 right-0 top-full mt-1.5 z-50 border rounded-xl overflow-hidden shadow-2xl animate-fade-in divide-y ${
                          isDarkMode 
                            ? 'bg-charcoal-950 border-charcoal-800 divide-charcoal-900/50' 
                            : 'bg-white border border-paper-300 divide-paper-200'
                        }`}>
                          <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                            {institutions.filter(inst => inst.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                              <div className={`p-5 text-center text-xs font-sans ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>
                                No institutions match your search.
                              </div>
                            ) : (
                              institutions
                                .filter(inst => inst.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(inst => {
                                  const isSelected = selectedInstId === inst.id;
                                  return (
                                    <button
                                      key={inst.id}
                                      type="button"
                                      onClick={() => {
                                        setSearchQuery(inst.name);
                                        setSelectedInstId(inst.id);
                                        setIsDropdownOpen(false);
                                      }}
                                      className={`w-full p-2.5 flex items-center justify-between text-left transition-all cursor-pointer ${
                                        isSelected
                                          ? (isDarkMode ? 'bg-charcoal-900 border-l-2 border-gold-500 text-white' : 'bg-navy-50 border-l-2 border-navy-900 text-navy-950')
                                          : `border-l-2 border-transparent ${isDarkMode ? 'text-slate-300 hover:bg-charcoal-900/40' : 'text-navy-800 hover:bg-paper-100/50'}`
                                      }`}
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                          isSelected 
                                            ? (isDarkMode ? 'bg-gold-500 text-charcoal-950 shadow-sm' : 'bg-navy-950 text-white shadow-sm') 
                                            : (isDarkMode ? 'bg-charcoal-900 border border-charcoal-800 text-slate-400' : 'bg-paper-100 border border-paper-200 text-navy-600')
                                        }`}>
                                          <Landmark className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className={`text-xs font-bold leading-tight truncate ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>{inst.name}</h4>
                                          <p className={`text-[10px] font-medium mt-0.5 truncate uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>
                                            {inst.type} <span className="text-slate-700">•</span> {inst.city}, {inst.country}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {inst.website && (
                                          <span className={`hidden sm:inline text-[9px] font-mono max-w-[120px] truncate ${isDarkMode ? 'text-slate-600' : 'text-navy-500/50'}`}>
                                            {inst.website.replace(/^https?:\/\//, '')}
                                          </span>
                                        )}
                                        {isSelected && (
                                          <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-sm ${isDarkMode ? 'bg-gold-500 text-charcoal-950' : 'bg-navy-950'}`}>
                                            <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={!selectedInstId}
                      onClick={async () => {
                        const found = institutions.find(i => i.id === selectedInstId);
                        if (found) {
                          setSelectedInst(found);
                          setStudentInstId(found.id);
                          setLoginError('');
                          setLoginRole('student');
                        }
                      }}
                      className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-40 ${
                        isDarkMode
                          ? 'bg-gold-500 hover:bg-gold-655 text-charcoal-950'
                          : 'bg-navy-950 hover:bg-navy-900 text-white'
                      }`}
                    >
                      <span>Continue to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Selected Institution Banner */}
                    {(activeTab === 'login' || activeTab === 'forgot') && selectedInst && (
                      <div className={`mb-4 p-3 border rounded-xl flex items-center justify-between animate-fade-in ${
                        isDarkMode
                          ? 'bg-charcoal-950/80 border-charcoal-850'
                          : 'bg-navy-50/70 border border-navy-100'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md ${isDarkMode ? 'bg-gold-500 text-charcoal-950' : 'bg-navy-950 text-white'}`}>
                            <Landmark className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <p className={`text-[9px] font-extrabold uppercase tracking-wider ${isDarkMode ? 'text-gold-400' : 'text-navy-700'}`}>Secure Workspace</p>
                            <h3 className={`text-xs font-bold leading-tight mt-0.5 ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>{selectedInst.name}</h3>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedInst(null);
                            setSelectedInstId('');
                            setSearchQuery('');
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-colors cursor-pointer ${
                            isDarkMode
                              ? 'text-slate-400 hover:text-white hover:bg-charcoal-900 border-charcoal-800'
                              : 'text-navy-600 hover:text-navy-950 hover:bg-paper-100 border-paper-200'
                          }`}
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {/* 1. LOGIN TAB */}
                    {activeTab === 'login' && !isStudentSignUp && (
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <h3 className={`text-base font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>Access Secure Gateway</h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>Choose your operational role and enter your authorization credentials.</p>
                    </div>

                    {/* Role selector pills */}
                    <div className={`grid grid-cols-3 gap-2 p-1 border rounded-lg ${isDarkMode ? 'bg-charcoal-950 border-charcoal-850' : 'bg-paper-100 border-paper-200'}`}>
                      <button
                        type="button"
                        onClick={() => handleAutoFill('student')}
                        className={`py-2 text-xs font-bold rounded transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          loginRole === 'student' 
                            ? (isDarkMode ? 'bg-charcoal-800 text-white shadow-sm border border-charcoal-700' : 'bg-navy-950 text-white shadow-sm') 
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-navy-650 hover:text-navy-950')
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAutoFill('department')}
                        className={`py-2 text-xs font-bold rounded transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          loginRole === 'department' 
                            ? (isDarkMode ? 'bg-charcoal-800 text-white shadow-sm border border-charcoal-700' : 'bg-navy-950 text-white shadow-sm') 
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-navy-650 hover:text-navy-950')
                        }`}
                      >
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Department</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAutoFill('admin')}
                        className={`py-2 text-xs font-bold rounded transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          loginRole === 'admin' 
                            ? (isDarkMode ? 'bg-charcoal-800 text-white shadow-sm border border-charcoal-700' : 'bg-navy-950 text-white shadow-sm') 
                            : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-navy-650 hover:text-navy-950')
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Admin</span>
                      </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      {loginError && (
                        <div className={`p-3 border text-xs font-semibold rounded-lg ${
                          isDarkMode 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' 
                            : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                        }`}>
                          {loginError}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>
                          {loginRole === 'student' ? 'Enrollment ID or Email Address' : 'Officer Email Address'}
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={loginRole === 'student' ? 'e.g., STU1001' : 'e.g., academic@campusconnect.edu'}
                            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Secret Security Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password..."
                            className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('forgot');
                            setForgotError('');
                            setForgotSuccess(false);
                          }}
                          className={`text-[11px] font-semibold hover:underline cursor-pointer ${
                            isDarkMode ? 'text-gold-400 hover:text-gold-300' : 'text-navy-700 hover:text-navy-950'
                          }`}
                        >
                          Forgot Password?
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loginLoading}
                        className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 ${
                          isDarkMode
                            ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950'
                            : 'bg-navy-950 hover:bg-navy-900 text-white'
                        }`}
                      >
                        {loginLoading ? 'Authenticating...' : 'Sign In to Secure Workspace'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Student self registration trigger */}
                    {loginRole === 'student' && (
                      <div className={`pt-4 border-t text-center ${isDarkMode ? 'border-charcoal-850' : 'border-paper-200'}`}>
                        <button
                          onClick={() => { setIsStudentSignUp(true); setStudentError(''); }}
                          className={`text-xs font-bold hover:underline cursor-pointer ${
                            isDarkMode ? 'text-gold-450 hover:text-gold-305' : 'text-navy-800 hover:text-navy-950'
                          }`}
                        >
                          New student? Register under your institution →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* STUDENT SIGN UP SUBVIEW */}
                {activeTab === 'login' && isStudentSignUp && (
                  <div className="space-y-6 animate-fade-in">
                    <div className={`flex items-center gap-2 pb-3 border-b ${isDarkMode ? 'border-charcoal-850' : 'border-paper-200'}`}>
                      <button
                        onClick={() => setIsStudentSignUp(false)}
                        className={`p-1.5 rounded transition-colors cursor-pointer ${
                          isDarkMode ? 'hover:bg-charcoal-800 text-slate-400 hover:text-white' : 'hover:bg-paper-100 text-navy-700 hover:text-navy-950'
                        }`}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className={`text-sm font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>Student Self Enrollment</h3>
                        <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>Submit your local credentials to establish your student dashboard.</p>
                      </div>
                    </div>

                    <form onSubmit={handleStudentRegisterSubmit} className="space-y-4">
                      {studentError && (
                        <div className={`p-3 border text-xs font-semibold rounded-lg ${
                          isDarkMode 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' 
                            : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                        }`}>
                          {studentError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Full Name</label>
                          <input
                            type="text"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            placeholder="John Doe"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Enrollment Number</label>
                          <input
                            type="text"
                            value={studentEnrollment}
                            onChange={(e) => setStudentEnrollment(e.target.value)}
                            placeholder="e.g. STU1005"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Select Educational Institution</label>
                        <select
                          value={studentInstId}
                          onChange={(e) => setStudentInstId(e.target.value)}
                          className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                            isDarkMode
                              ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                              : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm shadow-inner'
                          }`}
                          required
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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Official Email</label>
                          <input
                            type="email"
                            value={studentEmail}
                            onChange={(e) => setStudentEmail(e.target.value)}
                            placeholder="student@campus.edu"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Contact Number</label>
                          <input
                            type="text"
                            value={studentContact}
                            onChange={(e) => setStudentContact(e.target.value)}
                            placeholder="+1 (555) 0123"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                              isDarkMode
                                ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                            }`}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/80'}`}>Access Password</label>
                        <input
                          type="password"
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`w-full px-3 py-2 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                            isDarkMode
                              ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                              : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                          }`}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={studentLoading}
                        className={`w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 ${
                          isDarkMode
                            ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950'
                            : 'bg-navy-950 hover:bg-navy-900 text-white'
                        }`}
                      >
                        {studentLoading ? 'Enrolling...' : 'Submit Student Registration'}
                      </button>
                    </form>
                  </div>
                )}

                {/* 3. FORGOT PASSWORD TAB */}
                {activeTab === 'forgot' && (
                  <div className="space-y-6 py-4 animate-fade-in">
                    <div className="text-center space-y-2">
                      <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center border ${
                        isDarkMode 
                          ? 'bg-charcoal-900 border-charcoal-850 text-gold-450' 
                          : 'bg-navy-50 border-navy-100 text-navy-900'
                      }`}>
                        <Lock className="w-5 h-5 animate-pulse" />
                      </div>
                      <h3 className={`text-base font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>Recover Credentials</h3>
                      <p className={`text-xs leading-relaxed max-w-sm mx-auto ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>
                        {forgotStep === 'email' && 'Enter your registered email address to receive a secure, time-limited OTP code.'}
                        {forgotStep === 'otp' && 'Enter the 6-digit verification code sent to your registered email.'}
                        {forgotStep === 'password' && 'Enter and confirm your new secure password.'}
                      </p>
                    </div>

                    {forgotError && (
                      <div className={`p-3.5 border rounded-lg text-xs font-semibold flex items-start gap-2 max-w-sm mx-auto ${
                        isDarkMode 
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' 
                          : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                      }`}>
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    {forgotSuccess ? (
                      <div className="space-y-5 max-w-sm mx-auto text-center">
                        <div className={`mx-auto w-12 h-12 rounded-full border flex items-center justify-center ${
                          isDarkMode 
                            ? 'bg-emerald-950/40 border-emerald-850 text-emerald-400' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        } animate-bounce`}>
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-emerald-400' : 'text-emerald-850'}`}>Reset Successful</h4>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-navy-800/80'}`}>
                            {forgotMessage}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            setActiveTab('login');
                            setForgotSuccess(false);
                            setForgotStep('email');
                          }}
                          className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all border-0 ${
                            isDarkMode
                              ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950'
                              : 'bg-navy-950 hover:bg-navy-900 text-white'
                          }`}
                        >
                          Sign In Now
                        </button>
                      </div>
                    ) : (
                      <>
                        {forgotStep === 'email' && (
                          <form onSubmit={handleForgotSubmit} className="space-y-4 max-w-sm mx-auto">
                            <div>
                              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>
                                Selected Educational Institution
                              </label>
                              <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                                isDarkMode 
                                  ? 'border-charcoal-850 bg-charcoal-950/40 text-white' 
                                  : 'border-paper-300 bg-paper-100/50 text-navy-950 shadow-inner'
                              }`}>
                                <Landmark className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-gold-450' : 'text-navy-700'}`} />
                                <span className="truncate">{selectedInst ? selectedInst.name : 'Central Directory (General)'}</span>
                              </div>
                            </div>

                            <div>
                              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>
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
                                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                    isDarkMode
                                      ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                  }`}
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={forgotLoading}
                              className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950 disabled:opacity-40'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white disabled:opacity-40'
                              }`}
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
                            <div className="text-center">
                              <p className={`text-xs ${isDarkMode ? 'text-slate-300' : 'text-navy-800'}`}>
                                OTP dispatched to <strong className={isDarkMode ? 'text-gold-400' : 'text-navy-950 font-bold'}>{forgotEmail}</strong>
                              </p>
                            </div>

                            <div>
                              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-center ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>
                                Enter 6-Digit Code
                              </label>
                              <input
                                type="text"
                                maxLength={6}
                                required
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="e.g. 123456"
                                className={`w-full text-center py-2.5 tracking-[0.5em] font-extrabold text-sm rounded-lg border transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'border-charcoal-850 bg-charcoal-950/60 text-gold-450 focus:border-gold-500 focus:ring-gold-500'
                                    : 'border-paper-300 bg-paper-50 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={forgotLoading}
                              className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950 disabled:opacity-40'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white disabled:opacity-40'
                              }`}
                            >
                              {forgotLoading ? (
                                <span>Verifying Secure Code...</span>
                              ) : (
                                <span>Verify Security OTP</span>
                              )}
                            </button>

                            <div className="text-center pt-1.5">
                              {otpCountdown > 0 ? (
                                <p className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>
                                  Resend available in <span className="font-semibold">{otpCountdown}s</span>
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleForgotSubmit}
                                  className={`text-[11px] font-bold underline cursor-pointer bg-transparent border-0 p-0 ${
                                    isDarkMode ? 'text-gold-450 hover:text-gold-300' : 'text-navy-800 hover:text-navy-950'
                                  }`}
                                >
                                  Resend Verification Code
                                </button>
                              )}
                            </div>

                            {isSandbox && (
                              <div className={`p-3.5 border rounded-xl text-left space-y-2 shadow-xl ${
                                isDarkMode ? 'bg-charcoal-950 border-charcoal-850' : 'bg-amber-50 border-amber-250 text-amber-900'
                              }`}>
                                <div className={`flex items-center justify-between border-b pb-1.5 ${isDarkMode ? 'border-charcoal-900' : 'border-amber-200'}`}>
                                  <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${isDarkMode ? 'text-gold-400' : 'text-amber-850'}`}>
                                    <Sparkles className="w-3 h-3" />
                                    Resend Local Sandbox Interceptor
                                  </span>
                                  <span className={`text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-amber-700/60'}`}>Local Dev Only</span>
                                </div>
                                <p className={`text-[10px] leading-normal ${isDarkMode ? 'text-slate-400' : 'text-amber-800/80'}`}>
                                  RESEND_API_KEY is not configured. We intercepted the reset request. Enter the default secure sandbox code to verify and proceed:
                                </p>
                                <div className={`py-1 text-center rounded border ${
                                  isDarkMode ? 'bg-charcoal-900 border-charcoal-850 text-gold-400' : 'bg-white border-amber-300 text-amber-900 font-bold'
                                }`}>
                                  <span className="font-mono text-sm font-extrabold tracking-wider">123456</span>
                                </div>
                              </div>
                            )}
                          </form>
                        )}

                        {forgotStep === 'password' && (
                          <form onSubmit={handleResetPasswordSubmit} className="space-y-4 max-w-sm mx-auto">
                            <div className="text-center">
                              <p className={`text-xs font-semibold flex items-center justify-center gap-1.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                                <Check className="w-4 h-4" /> OTP Code Verified Successfully
                              </p>
                            </div>

                            <div>
                              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>
                                New Secure Password
                              </label>
                              <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className={`w-full px-4 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>

                            <div>
                              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>
                                Confirm New Password
                              </label>
                              <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className={`w-full px-4 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={forgotLoading}
                              className={`w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950 disabled:opacity-40'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white disabled:opacity-40'
                              }`}
                            >
                              {forgotLoading ? (
                                <span>Updating Password...</span>
                              ) : (
                                <span>Apply New Password</span>
                              )}
                            </button>
                          </form>
                        )}
                      </>
                    )}

                    <div className="text-center pt-2">
                      <button
                        onClick={() => {
                          setActiveTab('login');
                          setForgotStep('email');
                          setForgotError('');
                          setForgotSuccess(false);
                          setOtpCode('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        className={`text-xs font-bold hover:underline cursor-pointer bg-transparent border-0 p-0 ${
                          isDarkMode ? 'text-gold-450 hover:text-gold-300' : 'text-navy-800 hover:text-navy-950'
                        }`}
                      >
                        ← Back to Secure Portal Login
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

                {/* 2. REGISTER INSTITUTION TAB (Setup Wizard) */}
                {activeTab === 'register' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className={`text-base font-bold uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-950'}`}>Onboard Institution</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-navy-700/60'}`}>Complete the setup checklist to activate your isolated tenant workspace.</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                        isDarkMode 
                          ? 'text-gold-450 bg-gold-950/20 border-gold-950/40' 
                          : 'text-navy-900 bg-navy-50 border-navy-100/50'
                      }`}>
                        Step {regStep} of 3
                      </span>
                    </div>

                    {/* Progress dots bar */}
                    <div className="flex gap-2">
                      <div className={`h-1 flex-1 rounded-full ${
                        regStep >= 1 
                          ? (isDarkMode ? 'bg-gold-500' : 'bg-navy-950') 
                          : (isDarkMode ? 'bg-charcoal-850' : 'bg-paper-200')
                      }`} />
                      <div className={`h-1 flex-1 rounded-full ${
                        regStep >= 2 
                          ? (isDarkMode ? 'bg-gold-500' : 'bg-navy-950') 
                          : (isDarkMode ? 'bg-charcoal-850' : 'bg-paper-200')
                      }`} />
                      <div className={`h-1 flex-1 rounded-full ${
                        regStep >= 3 
                          ? (isDarkMode ? 'bg-gold-500' : 'bg-navy-950') 
                          : (isDarkMode ? 'bg-charcoal-850' : 'bg-paper-200')
                      }`} />
                    </div>

                    <form onSubmit={handleInstitutionRegisterSubmit} className="space-y-4">
                      {regError && (
                        <div className={`p-3 border text-xs font-semibold rounded-lg ${
                          isDarkMode 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' 
                            : 'bg-rose-50 border-rose-200 text-rose-800 shadow-sm'
                        }`}>
                          {regError}
                        </div>
                      )}

                      {/* STEP 1: INSTITUTION PROFILE */}
                      {regStep === 1 && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Institution Name</label>
                              <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="text"
                                  value={instName}
                                  onChange={(e) => setInstName(e.target.value)}
                                  placeholder="e.g. Oxford University"
                                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                    isDarkMode
                                      ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Institution Type</label>
                              <select
                                value={instType}
                                onChange={(e) => setInstType(e.target.value)}
                                className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              >
                                <option value="University">University</option>
                                <option value="College">College</option>
                                <option value="School">School / Institute</option>
                                <option value="Academy">Academy</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Official Website URL</label>
                              <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="url"
                                  value={instWebsite}
                                  onChange={(e) => setInstWebsite(e.target.value)}
                                  placeholder="https://oxford.edu"
                                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                    isDarkMode
                                      ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                  }`}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Institution Logo / Emblem</label>
                              {instLogo ? (
                                <div className={`relative flex items-center gap-3 p-2 border rounded-lg ${
                                  isDarkMode ? 'bg-charcoal-950 border-charcoal-850' : 'bg-paper-100 border-paper-300 shadow-inner'
                                }`}>
                                  <img 
                                    src={instLogo} 
                                    alt="Logo Preview" 
                                    className={`w-10 h-10 object-contain rounded-md p-1 border ${
                                      isDarkMode ? 'bg-charcoal-900 border-charcoal-800' : 'bg-white border-paper-200'
                                    }`}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-gold-450' : 'text-navy-950'}`}>Custom Logo Loaded</p>
                                    <p className={`text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-navy-700/60'}`}>Will be processed on submit</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setInstLogo('')}
                                    className={`p-1 rounded-md transition-colors cursor-pointer border ${
                                      isDarkMode 
                                        ? 'bg-charcoal-900 border-charcoal-800 text-slate-400 hover:text-white hover:bg-rose-950/40 hover:border-rose-900/40' 
                                        : 'bg-white border-paper-300 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                    }`}
                                    title="Remove image"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
                                  onDragLeave={() => setIsDraggingLogo(false)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDraggingLogo(false);
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) handleLogoFileSelect(file);
                                  }}
                                  onClick={() => document.getElementById('inst-logo-upload')?.click()}
                                  className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-all ${
                                    isDraggingLogo 
                                      ? (isDarkMode ? 'border-gold-500 bg-gold-950/10' : 'border-navy-900 bg-navy-50/50') 
                                      : (isDarkMode ? 'border-charcoal-800 hover:border-gold-500 bg-charcoal-950/40 hover:bg-charcoal-950/60' : 'border-paper-300 hover:border-navy-900 bg-paper-100/30 hover:bg-paper-100/60')
                                  }`}
                                >
                                  <input
                                    id="inst-logo-upload"
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleLogoFileSelect(file);
                                    }}
                                    className="hidden"
                                  />
                                  <Upload className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                                  <span className={`block text-[10px] font-bold ${isDarkMode ? 'text-slate-300' : 'text-navy-950'}`}>
                                    Click or drag &amp; drop to upload logo
                                  </span>
                                  <span className={`block text-[9px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-navy-700/50'}`}>
                                    JPG, PNG, WEBP (Max 5MB), or leave empty to auto-scout from web
                                  </span>
                                </div>
                              )}
                              {logoError && (
                                <p className="text-[10px] text-rose-500 font-semibold">{logoError}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                  if (!instName) {
                                    setRegError('Please submit the institution name.');
                                    return;
                                  }
                                  setRegError('');
                                  setRegStep(2);
                              }}
                              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white'
                              }`}
                            >
                              <span>Next: Location Details</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 2: LOCATION DETAILS */}
                      {regStep === 2 && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1.5">
                            <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Street Address</label>
                            <div className="relative">
                              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="text"
                                value={instAddress}
                                onChange={(e) => setInstAddress(e.target.value)}
                                placeholder="123 Academic Drive"
                                className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>City</label>
                              <input
                                type="text"
                                value={instCity}
                                onChange={(e) => setInstCity(e.target.value)}
                                placeholder="Oxford"
                                className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>State / Region</label>
                              <input
                                type="text"
                                value={instState}
                                onChange={(e) => setInstState(e.target.value)}
                                placeholder="Oxfordshire"
                                className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Country</label>
                              <input
                                type="text"
                                value={instCountry}
                                onChange={(e) => setInstCountry(e.target.value)}
                                placeholder="United Kingdom"
                                className={`w-full px-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between pt-2">
                            <button
                              type="button"
                              onClick={() => setRegStep(1)}
                              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 border cursor-pointer ${
                                isDarkMode 
                                  ? 'border-charcoal-800 bg-transparent text-slate-400 hover:text-white hover:bg-charcoal-900' 
                                  : 'border-paper-300 bg-white text-navy-800 hover:text-navy-950 hover:bg-paper-100 shadow-sm'
                              }`}
                            >
                              <ArrowLeft className="w-4 h-4" />
                              <span>Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRegStep(3)}
                              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white'
                              }`}
                            >
                              <span>Next: Administrator Setup</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* STEP 3: ADMINISTRATOR ACCOUNT */}
                      {regStep === 3 && (
                        <div className="space-y-4 animate-fade-in">
                          <div className="space-y-1.5">
                            <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Central Admin Full Name</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                              <input
                                type="text"
                                value={adminName}
                                onChange={(e) => setAdminName(e.target.value)}
                                placeholder="Professor Michael Smith"
                                className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                  isDarkMode
                                    ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                    : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                }`}
                                required
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Admin Email Address</label>
                              <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="email"
                                  value={adminEmail}
                                  onChange={(e) => setAdminEmail(e.target.value)}
                                  placeholder="admin@oxford.edu"
                                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                    isDarkMode
                                      ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-navy-800/85'}`}>Admin Account Password</label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                  type="password"
                                  value={adminPassword}
                                  onChange={(e) => setAdminPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className={`w-full pl-9 pr-3 py-2.5 border rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-1 ${
                                    isDarkMode
                                      ? 'bg-charcoal-950 border-charcoal-850 text-white placeholder-charcoal-600 focus:border-gold-500 focus:ring-gold-500'
                                      : 'bg-paper-50 border-paper-300 text-navy-950 placeholder-slate-400 focus:border-navy-900 focus:ring-navy-900 shadow-sm'
                                  }`}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-between pt-2">
                            <button
                              type="button"
                              onClick={() => setRegStep(2)}
                              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-2 border cursor-pointer animate-fade-in ${
                                isDarkMode 
                                  ? 'border-charcoal-800 bg-transparent text-slate-400 hover:text-white hover:bg-charcoal-900' 
                                  : 'border-paper-300 bg-white text-navy-800 hover:text-navy-950 hover:bg-paper-100 shadow-sm'
                              }`}
                            >
                              <ArrowLeft className="w-4 h-4" />
                              <span>Back</span>
                            </button>
                            <button
                              type="submit"
                              disabled={regLoading}
                              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-md cursor-pointer transition-all flex items-center gap-2 border-0 ${
                                isDarkMode
                                  ? 'bg-gold-500 hover:bg-gold-600 text-charcoal-950 disabled:opacity-40'
                                  : 'bg-navy-950 hover:bg-navy-900 text-white disabled:opacity-40'
                              }`}
                            >
                              {regLoading ? 'Deploying Tenant...' : 'Initialize Isolated Tenant Portal'}
                            </button>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>
                )}

              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className={`px-6 py-6 border-t font-sans font-medium text-xs ${
        isDarkMode 
          ? 'border-charcoal-900 bg-charcoal-950/25 text-slate-550' 
          : 'border-paper-250 bg-paper-50 text-navy-800/70 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} CampusConnect Academic Platform. All rights reserved.</span>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-wider">
            <span className="hover:text-gold-450 transition-colors cursor-default">Isolated Tenant Workspace</span>
            <span className="text-slate-400">&middot;</span>
            <span className="hover:text-gold-450 transition-colors cursor-default">Role-Based Access Control</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
