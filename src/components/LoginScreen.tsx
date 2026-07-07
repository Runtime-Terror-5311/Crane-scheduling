import React, { useState } from "react";
import { Shield, Key, Landmark, Eye, EyeOff } from "lucide-react";
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

  const fillCredentials = (empId: string, pass: string) => {
    setEmployeeId(empId);
    setPassword(pass);
    setError("");
  };

  return (
    <div id="login_container" className="min-h-screen flex items-center justify-center bg-[#E4E3E0] px-4 py-12 relative overflow-hidden font-sans industrial-grid">
      <div className="w-full max-w-md bg-white border-4 border-[#141414] shadow-[8px_8px_0px_#141414] p-8 z-10 rounded-sm">
        <div className="flex flex-col items-center mb-8 border-b-2 border-zinc-200 pb-6">
          <div className="p-3 bg-amber-500 text-white border-2 border-[#141414] rounded-sm mb-3 shadow-[3px_3px_0px_#141414]">
            <Landmark className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-[#141414] font-sans text-center uppercase">
            CRANE-OPS <span className="text-amber-600">v2.4</span>
          </h1>
          <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest font-mono font-bold">
            BAY 01 - NORTH WING SYSTEM TERMINAL
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-100 border-2 border-red-500 text-red-900 text-xs font-mono font-bold flex items-start gap-2">
            <span className="text-red-600">ALERT:</span> {error}
          </div>
        )}

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
            <label className="block text-xs font-mono uppercase tracking-wider text-[#141414] font-bold mb-2">
              Security Authorization Key
            </label>
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
            {loading ? "DECRYPTING CREDENTIALS..." : "AUTHENTICATE BADGE"}
          </button>
        </form>

        <div className="mt-8 border-t-2 border-zinc-200 pt-6">
          <p className="text-[10px] text-zinc-600 font-mono font-bold mb-3 text-center uppercase tracking-wider">
            FACILITY CREDENTIAL DIRECTORY
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <button
              onClick={() => fillCredentials("EMP001", "admin123")}
              className="p-2 text-left bg-zinc-50 border border-zinc-300 hover:border-[#141414] text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <div className="font-bold text-[10px] text-[#141414] uppercase flex items-center gap-1">
                <span className="status-led led-orange"></span> Admin Console
              </div>
              <div className="text-[9px] text-zinc-500 mt-0.5">ID: EMP001 / admin123</div>
            </button>
            <button
              onClick={() => fillCredentials("EMP101", "user101")}
              className="p-2 text-left bg-zinc-50 border border-zinc-300 hover:border-[#141414] text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <div className="font-bold text-[10px] text-[#141414] uppercase flex items-center gap-1">
                <span className="status-led led-green"></span> Supervisor Area 1
              </div>
              <div className="text-[9px] text-zinc-500 mt-0.5">ID: EMP101 / user101</div>
            </button>
            <button
              onClick={() => fillCredentials("EMP102", "user102")}
              className="p-2 text-left bg-zinc-50 border border-zinc-300 hover:border-[#141414] text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <div className="font-bold text-[10px] text-[#141414] uppercase flex items-center gap-1">
                <span className="status-led led-green"></span> Supervisor Area 2
              </div>
              <div className="text-[9px] text-zinc-500 mt-0.5">ID: EMP102 / user102</div>
            </button>
            <button
              onClick={() => fillCredentials("EMP103", "user103")}
              className="p-2 text-left bg-zinc-50 border border-zinc-300 hover:border-[#141414] text-zinc-800 hover:bg-zinc-100 transition-all cursor-pointer"
            >
              <div className="font-bold text-[10px] text-[#141414] uppercase flex items-center gap-1">
                <span className="status-led led-green"></span> Supervisor Area 3
              </div>
              <div className="text-[9px] text-zinc-500 mt-0.5">ID: EMP103 / user103</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
