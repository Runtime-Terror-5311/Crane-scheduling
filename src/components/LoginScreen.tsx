import React, { useState } from "react";
import { Shield, Key, Landmark, Eye, EyeOff, Mail, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { User } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forgot password flow states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !password) {
      setError("Please fill in all credentials.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Connection error to crane telemetry server.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please specify your registered Email ID.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");
    setDebugOtp("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate OTP code.");
      }

      setSuccessMessage(data.message);
      if (data.mocked && data.otp) {
        setDebugOtp(data.otp);
      }
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to dispatch security challenge code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || !newPassword || !confirmNewPassword) {
      setError("Please input all authentication and credential fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Credentials do not match. Verify your security key entry.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed. Access denied.");
      }

      setSuccessMessage(data.message);
      // Automatically prefill password and switch back to login screen
      setPassword(newPassword);
      // Wait a moment so the user sees the success state
      setTimeout(() => {
        setForgotMode(false);
        setForgotStep(1);
        setEmail("");
        setOtp("");
        setNewPassword("");
        setConfirmNewPassword("");
        setDebugOtp("");
        setSuccessMessage("Your credential key was updated successfully. You may now login.");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Error finalizing password reset sequence.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setForgotMode(false);
    setForgotStep(1);
    setError("");
    setSuccessMessage("");
    setDebugOtp("");
  };

  return (
    <div id="login_container" className="min-h-screen flex items-center justify-center bg-[#E4E3E0] px-4 py-12 relative overflow-hidden font-sans industrial-grid">
      <div className="w-full max-w-md bg-white border-4 border-[#141414] shadow-[8px_8px_0px_#141414] p-8 z-10 rounded-sm">
        <div className="flex flex-col items-center mb-8 border-b-2 border-zinc-200 pb-6">
          <div className="p-3 bg-amber-500 text-white border-2 border-[#141414] rounded-sm mb-3 shadow-[3px_3px_0px_#141414]">
            <Landmark className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-[#141414] font-sans text-center uppercase">
            CRANE-OPS <span className="text-amber-600">v1.00</span>
          </h1>
          <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest font-mono font-bold">
            Crane Scheduling & Shift Planning System

          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-100 border-2 border-red-500 text-red-900 text-xs font-mono font-bold flex items-start gap-2">
            <span className="text-red-600">ALERT:</span> {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3 bg-emerald-50 border-2 border-emerald-500 text-emerald-900 text-xs font-mono font-bold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-emerald-600">SYSTEM STATE:</span> {successMessage}
            </div>
          </div>
        )}

        {debugOtp && (
          <div className="mb-6 p-3 bg-amber-50 border-2 border-amber-500 text-[#141414] text-xs font-mono font-bold">
            <div className="flex items-center gap-1.5 text-amber-800 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span>TEST ENVIRONMENT SIMULATOR</span>
            </div>
            <p className="text-zinc-700 font-sans mb-2">
              The Brevo API key is not configured. We have automatically intercepted the transactional alert and provided your system OTP code:
            </p>
            <div className="text-lg bg-white border-2 border-[#141414] px-3 py-1.5 text-center tracking-[0.3em] font-black shadow-[2px_2px_0px_#141414]">
              {debugOtp}
            </div>
          </div>
        )}

        {!forgotMode ? (
          /* Login Mode Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
                Operator Badge ID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]">
                  <Shield className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. EMP101"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-white transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold">
                  Security Authorization Key
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotStep(1);
                    setError("");
                    setSuccessMessage("");
                    setDebugOtp("");
                  }}
                  className="text-[10px] font-mono text-amber-700 hover:text-amber-900 font-black uppercase underline transition-colors cursor-pointer"
                >
                  Forgot Key?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-white transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-[#141414]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-[0.2em] border-2 border-[#141414] shadow-[4px_4px_0px_#141414] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#141414] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer"
              disabled={loading}
            >
              {loading ? "Loading..." : "AUTHENTICATE BADGE"}
            </button>
          </form>
        ) : (
          /* Forgot Password Mode Form */
          <div>
            <div className="mb-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-[#141414] font-black border-l-4 border-amber-500 pl-2">
                CREDENTIAL SECURITY RECOVERY
              </h2>
            </div>

            {forgotStep === 1 ? (
              /* Forgot Step 1: Request OTP code */
              <form onSubmit={handleRequestOtp} className="space-y-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
                    Registered Email ID
                  </label>
                  <p className="text-[10px] text-zinc-500 mb-2 font-mono uppercase">
                    Provide the email address linked to your terminal account.
                  </p>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. admin@crane-ops.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-white transition-colors"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="flex-1 py-3 bg-white text-[#141414] font-black text-xs uppercase tracking-wider border-2 border-[#141414] shadow-[4px_4px_0px_#141414] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#141414] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    disabled={loading}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-[0.1em] border-2 border-[#141414] shadow-[4px_4px_0px_#141414] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#141414] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "SENDING ALERT..." : "DISPATCH OTP CODE"}
                  </button>
                </div>
              </form>
            ) : (
              /* Forgot Step 2: Input OTP & Input New Password */
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
                    Security Verification Code (OTP)
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full px-4 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono tracking-[0.2em] font-bold text-center placeholder:text-zinc-400 placeholder:tracking-normal focus:outline-none focus:bg-white transition-colors"
                    disabled={loading}
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
                    New Security Authorization Key
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-white transition-colors"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-[#141414]"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
                    Confirm New Security Key
                  </label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-2.5 bg-zinc-50 border-2 border-[#141414] text-[#141414] text-sm font-mono placeholder:text-zinc-400 focus:outline-none focus:bg-white transition-colors"
                    disabled={loading}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex-1 py-3 bg-white text-[#141414] font-black text-xs uppercase tracking-wider border-2 border-[#141414] shadow-[4px_4px_0px_#141414] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#141414] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    disabled={loading}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-amber-600 text-white font-black text-xs uppercase tracking-[0.1em] border-2 border-[#141414] shadow-[4px_4px_0px_#141414] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0px_#141414] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "RESETTING KEY..." : "SAVE & CONFIRM"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
