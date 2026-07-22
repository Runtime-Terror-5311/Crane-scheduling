import React, { useState, useEffect } from "react";
import { LogOut, Landmark, HardHat, Compass, FileSpreadsheet, ShieldCheck, Cpu, RefreshCw, Menu } from "lucide-react";
import LoginScreen from "./components/LoginScreen";
import BayVisualization from "./components/BayVisualization";
import GanttChart from "./components/GanttChart";
import OperationsList from "./components/OperationsList";
import DashboardSupervisor from "./components/DashboardSupervisor";
import DashboardAdmin from "./components/DashboardAdmin";
import Sidebar from "./components/Sidebar";
import CranesSpecifications from "./components/CranesSpecifications";
import CraneCalendar from "./components/CraneCalendar";
import CraneManagement from "./components/CraneManagement";
import AdminJobsTracker from "./components/AdminJobsTracker";
import ManageUsers from "./components/ManageUsers";
import { User, Crane, CraneRequest, Schedule, AuditLog, ShiftReport } from "./types";
import { getCurrentShift, getBayForArea, getAreasForBay, getBayForCrane } from "./utils/shiftUtils";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("crane_token"));
  const [user, setUser] = useState<User | null>(null);

  // Pages layout state
  const [activePage, setActivePage] = useState<"home" | "bay_view" | "crane_specs" | "gantt" | "generate" | "admin" | "calendar" | "crane_management" | "jobs_tracker" | "manage_users">("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Core telemetries
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [requests, setRequests] = useState<CraneRequest[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [settings, setSettings] = useState<any>({ bufferTimeMinutes: 5 });
  const [users, setUsers] = useState<User[]>([]);

  // Lifted filters state for global synchronization
  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedCraneFilter, setSelectedCraneFilter] = useState<string>("ALL");
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>("ALL");
  const [selectedBay, setSelectedBay] = useState<string>("1");
  const baysList = ["1", "2", "3", "4", "5", "6", "7"];

  const getBayLetter = (b: string): string => {
    const bayLetters: Record<string, string> = {
      "1": "A",
      "2": "B",
      "3": "C",
      "4": "D",
      "5": "E",
      "6": "F",
      "7": "G"
    };
    return bayLetters[b] || "";
  };

  // Filter lists by selected bay
  const selectedBayLetter = getBayLetter(selectedBay);
  const filteredCranes = cranes.filter((c) => {
    return (
      c.id.startsWith(selectedBayLetter) ||
      c.id.startsWith(selectedBay + "-") ||
      c.id.startsWith(selectedBay)
    );
  });
  const filteredSchedules = schedules.filter((s) => {
    const craneMatch =
      s.assignedCrane.startsWith(selectedBayLetter) ||
      s.assignedCrane.startsWith(selectedBay + "-") ||
      s.assignedCrane.startsWith(selectedBay);
    const bayMatch = s.bay ? s.bay.toUpperCase() === selectedBay.toUpperCase() : false;
    return craneMatch || bayMatch;
  });
  const filteredRequests = requests.filter((r) => {
    if (r.bay) {
      return (
        r.bay.toUpperCase() === selectedBay.toUpperCase() ||
        r.bay.toUpperCase() === selectedBayLetter.toUpperCase()
      );
    }
    if (r.mandatoryCrane && r.mandatoryCrane !== "Any") {
      return (
        r.mandatoryCrane.startsWith(selectedBayLetter) ||
        r.mandatoryCrane.startsWith(selectedBay + "-") ||
        r.mandatoryCrane.startsWith(selectedBay)
      );
    }
    return selectedBay === "1";
  });

  // Filter for Gantt Chart and Bay Visualization specifically (current date and selected shift/ALL)
  const currentShiftAndDateSchedules = React.useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return filteredSchedules.filter((sched) => {
      const origReq = requests.find((r) => r.id === sched.requestId);
      const schedDate = origReq?.date || (origReq?.createdAt ? origReq.createdAt.split("T")[0] : todayStr);
      const schedShift = origReq?.shift || sched.shift || "General Shift";
      
      const dateMatches = schedDate === todayStr;
      const shiftMatches = selectedShift === "ALL" || schedShift === selectedShift;
      
      return dateMatches && shiftMatches;
    });
  }, [filteredSchedules, requests, selectedShift]);

  const currentShiftAndDateRequests = React.useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return filteredRequests.filter((req) => {
      const reqDate = req.date || (req.createdAt ? req.createdAt.split("T")[0] : todayStr);
      const reqShift = req.shift || "General Shift";
      
      const dateMatches = reqDate === todayStr;
      const shiftMatches = selectedShift === "ALL" || reqShift === selectedShift;
      
      return dateMatches && shiftMatches;
    });
  }, [filteredRequests, selectedShift]);

  // Loading / Error states
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState("");
  const [globalAlert, setGlobalAlert] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Auto alert dismisser
  useEffect(() => {
    if (globalAlert) {
      const timer = setTimeout(() => setGlobalAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [globalAlert]);

  const getBaysForUser = (u: User | null): string[] => {
    if (!u) return ["1"];
    if (u.role === "Admin") return ["1", "2", "3", "4", "5", "6", "7"];
    
    const supervisedCranes = u.craneNo 
      ? u.craneNo.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) 
      : [];
    
    if (supervisedCranes.length === 0) {
      return [String(getBayForArea(u.area || 1))];
    }
    
    // Get unique bays for their supervised cranes
    const bays = supervisedCranes.map(craneId => getBayForCrane(craneId));
    return Array.from(new Set(bays));
  };

  // Safety area/bays lockout enforcement for Area Users
  useEffect(() => {
    if (user && user.role === "Area User") {
      const allowedBays = getBaysForUser(user);
      if (!allowedBays.includes(selectedBay)) {
        setSelectedBay(allowedBays[0]);
      }
    }
  }, [user]);

  // Decode profile from JWT on mount/login
  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        await reloadDatabase(data.user);
        
        // Auto-restrict bay and area if they are an Area User
        if (data.user.role === "Area User") {
          const uBay = String(getBayForArea(data.user.area || 1));
          setSelectedBay(uBay);
          setSelectedAreaFilter(String(data.user.area));
        }
      } else {
        // Stale or invalid token
        handleLogout();
      }
    } catch (err) {
      setGlobalError("Failed to synchronize with plant servers.");
      setLoading(false);
    }
  };

  const reloadDatabase = async (profile: User) => {
    setLoading(true);
    setGlobalError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Parallelize fetches for extreme speed
      const [resCranes, resReqs, resScheds, resSettings, resReports, resMe] = await Promise.all([
        fetch("/api/cranes", { headers }),
        fetch("/api/requests", { headers }),
        fetch("/api/schedules", { headers }),
        fetch("/api/settings", { headers }),
        fetch("/api/reports", { headers }),
        fetch("/api/auth/me", { headers }),
      ]);

      const dataCranes = await resCranes.json();
      const dataReqs = await resReqs.json();
      const dataScheds = await resScheds.json();
      const dataSettings = await resSettings.json();
      const dataReports = await resReports.json();
      const dataMe = await resMe.json();

      setCranes(dataCranes);
      setRequests(dataReqs);
      setSchedules(dataScheds);
      setSettings(dataSettings);
      setShiftReports(dataReports.shiftReports || []);
      if (dataMe.user) {
        setUser(dataMe.user);
      }

      // If user is Admin, also fetch system audit logs and users roster
      if (profile.role === "Admin") {
        const [resLogs, resUsers] = await Promise.all([
          fetch("/api/logs", { headers }),
          fetch("/api/users", { headers }),
        ]);
        const dataLogs = await resLogs.json();
        const dataUsers = await resUsers.json();
        setAuditLogs(dataLogs);
        setUsers(dataUsers);
      }
    } catch (err) {
      setGlobalError("Database sync issue. Some metrics might be cached.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (newToken: string, loggedUser: User) => {
    localStorage.setItem("crane_token", newToken);
    setToken(newToken);
    setUser(loggedUser);
    
    // Auto-restrict bay and area if they are an Area User
    if (loggedUser.role === "Area User") {
      const uBay = String(getBayForArea(loggedUser.area || 1));
      setSelectedBay(uBay);
      setSelectedAreaFilter(String(loggedUser.area));
    }
    
    setGlobalAlert({ message: `Successfully authenticated operator badge: ${loggedUser.name}`, type: "success" });
  };

  const handleLogout = () => {
    localStorage.removeItem("crane_token");
    setToken(null);
    setUser(null);
    setCranes([]);
    setRequests([]);
    setSchedules([]);
    setAuditLogs([]);
    setUsers([]);
    setGlobalAlert({ message: "Operator badge logged out successfully.", type: "info" });
  };

  // Supervisors request actions
  const handleRequestAdded = (newReq: CraneRequest) => {
    setRequests((prev) => [newReq, ...prev]);
    setGlobalAlert({ message: `Draft operation ${newReq.id} recorded. Remember to click 'SUBMIT ALL REQUESTS' when done reviewing.`, type: "success" });
    if (user) reloadDatabase(user);
  };

  const handleRequestDeleted = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setGlobalAlert({ message: `Operation ${id} successfully removed from registry.`, type: "info" });
        if (user) reloadDatabase(user);
      } else {
        const d = await res.json();
        setGlobalAlert({ message: d.error || "Failed to delete request.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error during delete.", type: "error" });
    }
  };

  const handleRequestSubmittedBulk = async (area: number) => {
    try {
      const res = await fetch("/api/requests/submit-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ area }),
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: `Successfully locked & submitted all Drafts for Area ${area}!`, type: "success" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: d.error || "Bulk submission failed.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network connection lost.", type: "error" });
    }
  };

  // Admins CRUD overrides
  const handleUpdateCrane = async (craneId: string, updatedFields: Partial<Crane>) => {
    try {
      const res = await fetch(`/api/cranes/${craneId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        setGlobalAlert({ message: `Crane ${craneId} parameters updated successfully.`, type: "success" });
        if (user) reloadDatabase(user);
      } else {
        const d = await res.json();
        setGlobalAlert({ message: d.error || "Update failed.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network failure during crane update.", type: "error" });
    }
  };

  const handleUpdateSettings = async (updatedSettings: any) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedSettings),
      });
      if (res.ok) {
        setGlobalAlert({ message: "System-wide buffers committed to disk.", type: "success" });
        if (user) reloadDatabase(user);
      } else {
        const d = await res.json();
        setGlobalAlert({ message: d.error || "Failed to save settings.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Connection issue.", type: "error" });
    }
  };

  const handleGenerateSchedule = async () => {
    try {
      const res = await fetch("/api/schedules/generate", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalAlert({
          message: `Scheduler Complete: Assigned ${d.allocatedCount} crane hoisting operations. ${d.rejectedCount} requests deferred due to overlap/boundaries.`,
          type: "success",
        });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: d.error || "Could not generate schedules.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Schedule generation network error.", type: "error" });
    }
  };

  const handleClearSchedule = async () => {
    try {
      const res = await fetch("/api/schedules/clear", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGlobalAlert({ message: "All crane allocations wiped. Jobs reverted back to Submitted mode.", type: "info" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: "Failed to reset schedules.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network reset error.", type: "error" });
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: "Job cancelled and reverted to Draft successfully.", type: "success" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: data.detail || data.error || "Failed to cancel/reschedule job.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error during cancellation.", type: "error" });
    }
  };

  const handleInstantSchedule = async (formData: any) => {
    try {
      const res = await fetch("/api/schedules/instant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: `Job instantly scheduled! 5 points deducted. (Balance: ${data.planningPoints} pts)`, type: "success" });
        if (user) reloadDatabase(user);
        return { success: true, data };
      } else {
        setGlobalAlert({ message: data.detail || data.error || "Failed to instantly schedule job.", type: "error" });
        return { 
          success: false, 
          error: data.detail || data.error,
          isConflict: data.code === "CRANE_BUSY" || res.status === 409,
          busySchedules: data.busySchedules,
          availableGaps: data.availableGaps
        };
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error during instant scheduling.", type: "error" });
      return { success: false, error: "Network error" };
    }
  };

  const handleCreateShiftReport = async (shift: string, summary: string, date?: string) => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shift, summary, date }),
      });
      if (res.ok) {
        if (user) reloadDatabase(user);
        setGlobalAlert({ message: `Daily/Shift report for ${shift} successfully compiled!`, type: "success" });
      } else {
        setGlobalAlert({ message: "Failed to record Shift Planning Report.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error creating shift report.", type: "error" });
    }
  };

  const handleCompleteShift = async (shift: string, date: string) => {
    try {
      const res = await fetch("/api/schedules/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shift, date }),
      });
      if (res.ok) {
        const data = await res.json();
        if (user) reloadDatabase(user);
        setGlobalAlert({ message: data.message, type: "success" });
      } else {
        setGlobalAlert({ message: "Failed to archive completed shift.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error completing shift.", type: "error" });
    }
  };

  const handleAddUser = async (newUser: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => {
          const filtered = prev.filter((u) => u.employeeId.toUpperCase() !== data.employeeId.toUpperCase());
          return [...filtered, data];
        });
        setGlobalAlert({ message: `Roster Badge successfully generated: ${data.name} (${data.employeeId})`, type: "success" });
        if (user) reloadDatabase(user);
        return true;
      } else {
        setGlobalAlert({ message: data.error || "Failed to create new user in database.", type: "error" });
        return false;
      }
    } catch (err: any) {
      setGlobalAlert({ message: err.message || "Network error during user creation.", type: "error" });
      return false;
    }
  };

  const handleDeleteUser = async (employeeId: string) => {
    try {
      const res = await fetch(`/api/users/${employeeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.employeeId !== employeeId));
        setGlobalAlert({ message: `Staff badge ${employeeId} revoked from terminal files.`, type: "info" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: "Failed to delete user.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Badge deletion network failure.", type: "error" });
    }
  };

  const handleUpdateUser = async (employeeId: string, updatedFields: any) => {
    try {
      const res = await fetch(`/api/users/${employeeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedFields),
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: `User ${employeeId} updated successfully.`, type: "success" });
        if (user) reloadDatabase(user);
        return true;
      } else {
        setGlobalAlert({ message: d.error || "Failed to update user.", type: "error" });
        return false;
      }
    } catch (err) {
      setGlobalAlert({ message: "Network failure while updating user.", type: "error" });
      return false;
    }
  };

  const handleCreateCrane = async (craneData: any) => {
    try {
      const res = await fetch("/api/cranes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(craneData),
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: `Crane ${d.name} (${d.id}) added to the bay registry.`, type: "success" });
        if (user) reloadDatabase(user);
        return true;
      } else {
        setGlobalAlert({ message: d.error || "Failed to create crane.", type: "error" });
        return false;
      }
    } catch (err) {
      setGlobalAlert({ message: "Network error while creating crane.", type: "error" });
      return false;
    }
  };

  const handleDeleteCrane = async (craneId: string) => {
    try {
      const res = await fetch(`/api/cranes/${craneId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        setGlobalAlert({ message: `Crane ${craneId} removed from registry.`, type: "info" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: d.error || "Failed to remove crane.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Network failure while removing crane.", type: "error" });
    }
  };

  const handleReopenRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/requests/${id}/reopen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGlobalAlert({ message: `Request ${id} successfully reopened. Supervisor can now edit fields.`, type: "success" });
        if (user) reloadDatabase(user);
      } else {
        setGlobalAlert({ message: "Failed to reopen request.", type: "error" });
      }
    } catch (err) {
      setGlobalAlert({ message: "Reopen network issue.", type: "error" });
    }
  };

  // If no auth token, render high-fidelity credentials gateway
  if (!token || !user) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="full_app_layout" className="min-h-screen flex flex-col bg-transparent text-[#141414] font-sans selection:bg-amber-500/20">
      
      {/* Sliding Sidebar Menu */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        user={user}
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={handleLogout}
        selectedBay={selectedBay}
      />

      {/* Industrial Plant Top Navigation Bar */}
      <header className="bg-zinc-900 text-white border-b-4 border-amber-600 py-4 px-6 sticky top-0 z-40 no-print shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Sidebar Menu Hamburger & Bay Name */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <button
                id="sidebar_toggle_btn"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-amber-500 border-2 border-zinc-700 hover:border-amber-500 rounded-sm transition-all cursor-pointer shadow-[2px_2px_0px_rgba(255,255,255,0.15)] flex items-center justify-center mr-1"
                title="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="p-2 bg-amber-500 text-slate-950 border-2 border-slate-950 rounded-sm font-black tracking-tighter text-sm flex items-center justify-center select-none shadow-[2px_2px_0px_white]">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-md font-black tracking-tighter text-white font-sans uppercase">
                  CRANE-OPS <span className="text-amber-500">v1.00</span>
                </h1>
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none font-bold">
                  BAY {selectedBay} - OPERATION CORE SYSTEM TERMINAL
                </p>
              </div>
            </div>

            {/* Micro badge display for mobile layout */}
            <div className="md:hidden text-xs font-mono font-bold text-amber-500 bg-zinc-800 px-2.5 py-1 rounded-sm border border-zinc-700 uppercase">
              Area {user.role === "Admin" ? "HQ" : user.area}
            </div>
          </div>

          {/* User Badge Summary */}
          <div className="flex flex-wrap items-center gap-4 text-xs w-full md:w-auto justify-between md:justify-end">
            <div className="bg-zinc-800 px-3 py-1.5 border border-zinc-700 rounded-sm flex items-center gap-2 font-mono">
              <span className="status-led led-green animate-pulse"></span>
              <div>
                <span className="text-zinc-400 font-bold">OPERATOR ID: </span>
                <span className="font-extrabold text-white uppercase">{user.employeeId}</span>
                <span className="text-zinc-600"> | </span>
                <span className="text-amber-500 font-extrabold uppercase">
                  {user.role === "Admin" ? "Command Admin" : `Area ${user.area} Lead`}
                </span>
                <span className="text-zinc-600"> | </span>
                <span className="text-emerald-400 font-extrabold" title={`Active jobs count: P1: ${user.p1Count ?? 0}, P2: ${user.p2Count ?? 0}, Instant: ${user.instantCount ?? 0}`}>
                  {user.planningPoints !== undefined ? user.planningPoints : 100}/100 PLAN POINTS
                  {user.role === "Area User" && (
                    <span className="text-zinc-500 text-[10px] ml-1.5 font-normal font-mono">
                      (P1:{user.p1Count ?? 0} P2:{user.p2Count ?? 0} Inst:{user.instantCount ?? 0})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Logout Trigger */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950 text-red-300 border-2 border-[#141414] hover:bg-red-900 rounded-sm font-black text-xs uppercase tracking-wider transition-all shadow-[2px_2px_0px_white] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>
      </header>

      {/* Main Application Runway Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Dynamic Global Notification Alerts */}
        {globalAlert && (
          <div
            id="global_toast"
            className={`p-4 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] animate-fade-in flex items-start gap-3 text-xs font-mono font-bold ${
              globalAlert.type === "success"
                ? "bg-emerald-100 text-emerald-950"
                : globalAlert.type === "error"
                ? "bg-red-100 text-red-950"
                : "bg-amber-100 text-amber-950"
            }`}
          >
            <span className="uppercase tracking-wider font-extrabold border-r border-current pr-2">
              {globalAlert.type === "success" ? "TRANS COMPLETE" : "ALERT OVERRIDE"}
            </span>
            <span className="font-sans font-semibold">{globalAlert.message}</span>
          </div>
        )}

        {/* Global connection status error */}
        {globalError && (
          <div className="p-4 bg-red-100 border-2 border-red-500 text-red-950 text-xs rounded-sm font-bold font-mono shadow-[4px_4px_0px_#141414]">
            ALERT: {globalError}
          </div>
        )}

        {/* Loading Indicator Spinner */}
        {loading && (
          <div className="p-4 bg-white rounded-sm text-center text-xs font-mono font-bold text-zinc-700 flex items-center justify-center gap-2 border-2 border-[#141414] shadow-[4px_4px_0px_#141414]">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
            SYNCHRONIZING LIVE PLANT OPERATIONS DATABASES...
          </div>
        )}

        {/* Multi-Screen Navigation Views Content */}
        <div id="active_page_content" className="space-y-6 animate-fade-in">
          
          {/* Page 1: Ongoing Shift scheduled timetable list (Home Page) */}
          {activePage === "home" && (
            <div id="timetable_page" className="space-y-4">
              <OperationsList 
                schedules={filteredSchedules} 
                requests={filteredRequests} 
                cranes={filteredCranes}
                selectedShift={selectedShift}
                setSelectedShift={setSelectedShift}
                selectedCraneFilter={selectedCraneFilter}
                setSelectedCraneFilter={setSelectedCraneFilter}
                selectedAreaFilter={selectedAreaFilter}
                setSelectedAreaFilter={setSelectedAreaFilter}
                selectedBay={selectedBay}
                user={user}
                onCancelSchedule={handleCancelSchedule}
                onInstantSchedule={handleInstantSchedule}
              />
            </div>
          )}

          {/* Page 2: Shop Floor Bay Runway Grid Display (Bay View Page) */}
          {activePage === "bay_view" && (
            <div id="bay_visualization_page" className="space-y-6">
              
              {/* Dynamic Bay Selector Tab/Dropdown Panel */}
              {(() => {
                const allowedBays = getBaysForUser(user);
                if (user.role === "Admin" || allowedBays.length > 1) {
                  return (
                    <div id="bay_selector_panel" className="bg-white border-4 border-[#141414] p-5 shadow-[4px_4px_0px_#141414] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-xs font-black uppercase tracking-widest font-mono text-zinc-500 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-amber-500 border border-[#141414] animate-pulse"></span>
                          {user.role === "Admin" ? "Active Runway Bay" : "Supervised Runway Bays"}
                        </h2>
                        <p className="text-sm font-black text-zinc-900 uppercase">
                          {user.role === "Admin" 
                            ? "Select Bay Terminal to view live grid, timeline & requirements"
                            : "Select one of your assigned supervised bays to inspect runways"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allowedBays.map((b) => {
                          const isActive = selectedBay === b;
                          const letter = getBayLetter(b);
                          const bayCraneCount = cranes.filter((c) => 
                            c.id.toUpperCase().startsWith(b) || 
                            c.id.toUpperCase().startsWith(letter.toUpperCase())
                          ).length;
                          return (
                            <button
                              key={b}
                              id={`bay_btn_${b}`}
                              onClick={() => setSelectedBay(b)}
                              className={`px-4 py-2 border-2 border-[#141414] font-black font-mono text-xs uppercase transition-all shadow-[2px_2px_0px_#141414] hover:-translate-y-0.5 cursor-pointer active:translate-y-0 active:shadow-[1px_1px_0px_#141414] ${
                                isActive
                                  ? "bg-amber-500 text-slate-950 translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_#141414]"
                                  : "bg-zinc-100 text-[#141414] hover:bg-zinc-200"
                              }`}
                            >
                              Bay {b}
                              <span className="text-[10px] font-normal text-zinc-500 ml-1.5 font-sans font-bold">
                                ({bayCraneCount} {bayCraneCount === 1 ? "crane" : "cranes"})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div id="bay_selector_panel" className="bg-white border-4 border-[#141414] p-5 shadow-[4px_4px_0px_#141414] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-xs font-black uppercase tracking-widest font-mono text-zinc-500 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 bg-amber-500 border border-[#141414] animate-pulse"></span>
                          Active Runway Bay (Operational Station Locked)
                        </h2>
                        <p className="text-sm font-black text-zinc-900 uppercase">
                          Bay {selectedBay} — Restricted to Area {user.area} Operational Station
                        </p>
                      </div>
                      <div className="text-xs font-mono font-bold bg-amber-50 border-2 border-[#141414] px-4 py-2 rounded-sm shadow-[2px_2px_0px_#141414] text-amber-950 uppercase">
                        🛡️ Safety Enforced View
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Shop Floor Bay Runway Grid Display (Adaptive horizontal or mobile-friendly vertical layout) */}
              <BayVisualization 
                cranes={filteredCranes} 
                schedules={currentShiftAndDateSchedules} 
                requests={currentShiftAndDateRequests}
                selectedShift={selectedShift}
                selectedCraneFilter={selectedCraneFilter}
                selectedAreaFilter={selectedAreaFilter}
              />
            </div>
          )}

          {/* Page 3: Cranes Specifications details */}
          {activePage === "crane_specs" && (
            <CranesSpecifications
              cranes={filteredCranes}
              users={users}
              selectedBay={selectedBay}
            />
          )}

          {/* Page 4: Occupancy Timeline Gantt Chart */}
          {activePage === "gantt" && (
            <div id="gantt_chart_page">
              <GanttChart 
                schedules={currentShiftAndDateSchedules} 
                requests={currentShiftAndDateRequests}
                cranes={filteredCranes}
                selectedShift={selectedShift}
                selectedCraneFilter={selectedCraneFilter}
                selectedAreaFilter={selectedAreaFilter}
              />
            </div>
          )}

          {/* Page 5: Generate Requirement form page */}
          {activePage === "generate" && (
            <div id="generate_requirements_page">
              <DashboardSupervisor
                user={user}
                requests={requests}
                cranes={cranes}
                schedules={schedules}
                onRequestAdded={handleRequestAdded}
                onRequestDeleted={handleRequestDeleted}
                onRequestSubmittedBulk={handleRequestSubmittedBulk}
                onRefresh={() => { if (user) reloadDatabase(user); }}
                onInstantSchedule={handleInstantSchedule}
                initialSubView="new-request"
                onUpdateCrane={handleUpdateCrane}
                onCreateCrane={handleCreateCrane}
                onDeleteCrane={handleDeleteCrane}
              />
            </div>
          )}

          {/* Page 5.5: Dedicated Crane Management page */}
          {activePage === "crane_management" && (
            <div id="crane_management_page">
              <CraneManagement
                user={user}
                cranes={cranes}
                onUpdateCrane={handleUpdateCrane}
                onCreateCrane={handleCreateCrane}
                onDeleteCrane={handleDeleteCrane}
                onRefresh={() => { if (user) reloadDatabase(user); }}
              />
            </div>
          )}

          {/* Page 6: System Admin console overrides */}
          {activePage === "admin" && user.role === "Admin" && (
            <div id="admin_panel_page">
              <DashboardAdmin
                user={user}
                cranes={cranes}
                requests={requests}
                schedules={schedules}
                auditLogs={auditLogs}
                shiftReports={shiftReports}
                settings={settings}
                users={users}
                onRefreshAll={() => reloadDatabase(user)}
                onUpdateCrane={handleUpdateCrane}
                onCreateCrane={handleCreateCrane}
                onDeleteCrane={handleDeleteCrane}
                onUpdateSettings={handleUpdateSettings}
                onGenerateSchedule={handleGenerateSchedule}
                onClearSchedule={handleClearSchedule}
                onCreateShiftReport={handleCreateShiftReport}
                onCompleteShift={handleCompleteShift}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                onReopenRequest={handleReopenRequest}
              />
            </div>
          )}

          {/* Page 6.5: Admin Jobs & Crane Duration Tracker */}
          {activePage === "jobs_tracker" && user?.role === "Admin" && (
            <div id="admin_jobs_tracker_page">
              <AdminJobsTracker
                requests={requests}
                cranes={cranes}
              />
            </div>
          )}

          {/* Page 6.6: Admin Manage Users */}
          {activePage === "manage_users" && user?.role === "Admin" && (
            <div id="admin_manage_users_page">
              <ManageUsers
                users={users}
                cranes={cranes}
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
              />
            </div>
          )}

          {/* Page 7: Crane Calendar registry */}
          {activePage === "calendar" && (
            <div id="calendar_page">
              <CraneCalendar
                schedules={schedules}
                requests={requests}
                cranes={cranes}
              />
            </div>
          )}

        </div>

      </main>

      {/* Plain & Professional Footer */}
      <footer className="bg-zinc-900 border-t-4 border-amber-600 text-zinc-400 text-[10px] font-mono py-6 text-center no-print">
        <div className="font-bold">EOT CRANE OPERATIONS MANAGER & SHIFT CO-ORDINATOR</div>
        <div className="mt-1 opacity-75 uppercase tracking-wider font-bold">Coded for plant terminal consoles • Safety Clearance Verified</div>
      </footer>
    </div>
  );
}
