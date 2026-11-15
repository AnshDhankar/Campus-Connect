import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Lock, Check, X, Eye, EyeOff, ShieldAlert, KeyRound, 
  ArrowLeft, CheckCircle2, Loader2, Sparkles, AlertCircle 
} from 'lucide-react';

interface ResetPasswordProps {
  isDarkMode: boolean;
}

export default function ResetPassword({ isDarkMode }: ResetPasswordProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Get token from URL
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token') || '';

  // Page phases: 'validating' | 'invalid' | 'form' | 'success'
  const [phase, setPhase] = useState<'validating' | 'invalid' | 'form' | 'success'>('validating');
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);
  
  // Form input states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Validate reset token on load
  useEffect(() => {
    if (!token) {
      setPhase('invalid');
      setError('Missing secure password reset token.');
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch('/api/auth/validate-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const contentType = res.headers.get('content-type') || '';
        let data: any = null;
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          console.error('[CLIENT VALIDATE RESET TOKEN ERROR] Unexpected non-JSON response:', text.slice(0, 300));
          throw new Error(`Token validation returned an unexpected response (HTTP ${res.status}).`);
        }

        if (res.ok && data.success) {
          setUserProfile({ name: data.name, email: data.email });
          setPhase('form');
        } else {
          setError(data.error || 'This reset link is invalid or has expired.');
          setPhase('invalid');
        }
      } catch (err: any) {
        console.error('[CLIENT VALIDATE RESET TOKEN ERROR] Complete server error details:', err);
        setError(err.message || 'Could not connect to the authentication server.');
        setPhase('invalid');
      }
    };

    validateToken();
  }, [token]);

  // Password requirement checkers
  const requirements = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(requirements).every(Boolean);
  const isMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setError('Please meet all security requirements first.');
      return;
    }
    if (!isMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('[CLIENT SUBMIT RESET PASSWORD ERROR] Unexpected non-JSON response:', text.slice(0, 300));
        throw new Error(`Password reset service returned an unexpected response (HTTP ${res.status}).`);
      }

      if (res.ok && data.success) {
        setSuccessMessage(data.message);
        setPhase('success');
      } else {
        setError(data.error || 'Failed to reset password. Please request a new link.');
      }
    } catch (err: any) {
      console.error('[CLIENT SUBMIT RESET PASSWORD ERROR] Complete server error details:', err);
      setError(err.message || 'A connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Decorative ambient blobs for visual polish */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className={`relative w-full max-w-md p-8 rounded-2xl border transition-all duration-300 shadow-2xl ${
        isDarkMode 
          ? 'bg-slate-900/90 border-slate-800 shadow-slate-950/50' 
          : 'bg-white border-slate-200 shadow-slate-200/50'
      }`}>
        
        {/* HEADER BRANDING */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4 animate-pulse">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">CampusConnect</h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Secure Directory Credential Restoration
          </p>
        </div>

        {/* PHASE 1: VALIDATING */}
        {phase === 'validating' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className={`text-xs font-medium tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Authenticating secure reset token...
            </p>
          </div>
        )}

        {/* PHASE 2: INVALID / EXPIRED */}
        {phase === 'invalid' && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-bold uppercase tracking-tight text-rose-500">
                Invalid Security Link
              </h3>
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {error || 'This security link is invalid, has expired, or has already been used to restore credentials.'}
              </p>
            </div>

            <div className={`p-4 rounded-xl border text-left text-xs ${
              isDarkMode ? 'bg-slate-950/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <p className="font-bold mb-1.5">Troubleshooting Checklist:</p>
              <ul className="list-disc pl-4 space-y-1 font-sans">
                <li>Make sure you did not open an older reset link from a previous request.</li>
                <li>Ensure the link was opened within 20 minutes of dispatch.</li>
                <li>Go back to the homepage and initiate a new request.</li>
              </ul>
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Portal Home</span>
            </button>
          </div>
        )}

        {/* PHASE 3: ACTIVE RESET FORM */}
        {phase === 'form' && userProfile && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User Target Banner */}
            <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
              isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {userProfile.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{userProfile.name}</p>
                <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {userProfile.email}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-lg text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* PASSWORD INPUT */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create password..."
                  required
                  className={`w-full pl-10 pr-10 py-2.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
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

            {/* CONFIRM PASSWORD INPUT */}
            <div className="space-y-1.5">
              <label className={`block text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password..."
                  required
                  className={`w-full pl-10 pr-4 py-2.5 rounded-lg border text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-600 bg-white'
                  }`}
                />
              </div>
            </div>

            {/* SECURITY REQUIREMENTS LIST */}
            <div className={`p-4 rounded-xl border space-y-2 text-xs font-sans ${
              isDarkMode ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className="font-bold uppercase tracking-wide text-[10px] text-slate-500 mb-1">
                Password Security Checklist
              </p>
              
              <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  {requirements.length ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={requirements.length ? 'text-emerald-500' : 'text-slate-500'}>
                    At least 6 characters
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {requirements.uppercase ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={requirements.uppercase ? 'text-emerald-500' : 'text-slate-500'}>
                    One uppercase letter (A-Z)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {requirements.lowercase ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={requirements.lowercase ? 'text-emerald-500' : 'text-slate-500'}>
                    One lowercase letter (a-z)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {requirements.number ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={requirements.number ? 'text-emerald-500' : 'text-slate-500'}>
                    One numerical digit (0-9)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {requirements.special ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={requirements.special ? 'text-emerald-500' : 'text-slate-500'}>
                    One special symbol (!, @, #, $, etc.)
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-dashed border-slate-800 mt-1">
                  {isMatch ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={isMatch ? 'text-emerald-500' : 'text-slate-500'}>
                    Passwords match
                  </span>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={loading || !isPasswordValid || !isMatch}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Committing Changes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Reset Security Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* PHASE 4: SUCCESS & REDIRECT */}
        {phase === 'success' && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold uppercase tracking-tight text-emerald-400">
                Credentials Restored
              </h3>
              <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {successMessage || 'Your security password has been successfully updated on the CampusConnect directories.'}
              </p>
            </div>

            <div className={`p-4 rounded-xl border text-xs text-center ${
              isDarkMode ? 'bg-slate-950/30 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              You can now safely log back in to your secure institutional workspace.
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Go to Login Portal</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
