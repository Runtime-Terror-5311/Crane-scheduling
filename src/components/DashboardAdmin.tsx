import React, { useState } from "react";
import {
  Sparkles,
  Users,
  Wrench,
  Settings,
  History,
  FileText,
  TrendingUp,
  Sliders,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Database,
  Download,
} from "lucide-react";
import { Crane, User, CraneRequest, Schedule, AuditLog, ShiftReport, PriorityType } from "../types";
import { getBayForArea, getColumnsForArea, getAreasForBay } from "../utils/shiftUtils";
import { generateDateWisePDF } from "../utils/pdfGenerator";

interface DashboardAdminProps {
  user: User;
  cranes: Crane[];
  requests: CraneRequest[];
  schedules: Schedule[];
  auditLogs: AuditLog[];
  shiftReports: ShiftReport[];
  settings: any;
  users: User[];
  onRefreshAll: () => void;
  onUpdateCrane: (craneId: string, updatedFields: Partial<Crane>) => void;
  onCreateCrane: (craneData: any) => Promise<boolean>;
  onDeleteCrane: (craneId: string) => void;
  onUpdateSettings: (updatedSettings: any) => void;
  onGenerateSchedule: () => void;
  onClearSchedule: () => void;
  onCreateShiftReport: (shift: string, summary: string, date?: string) => void;
  onCompleteShift: (shift: string, date: string) => void;
  onAddUser: (newUser: any) => void;
  onUpdateUser: (employeeId: string, updatedFields: any) => Promise<boolean>;
  onDeleteUser: (employeeId: string) => void;
  onReopenRequest: (id: string) => void;
}

export default function DashboardAdmin({
  user,
  cranes,
  requests,
  schedules,
  auditLogs,
  shiftReports,
  settings,
  users,
  onRefreshAll,
  onUpdateCrane,
  onCreateCrane,
  onDeleteCrane,
  onUpdateSettings,
  onGenerateSchedule,
  onClearSchedule,
  onCreateShiftReport,
  onCompleteShift,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onReopenRequest,
}: DashboardAdminProps) {
  const [activeTab, setActiveTab] = useState<"analytics" | "cranes" | "users" | "requests" | "reports" | "settings">("analytics");

  // User CRUD states
  const [newEmpId, setNewEmpId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Area User">("Area User");
  const [newArea, setNewArea] = useState<number>(1);
  const [newPass, setNewPass] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCraneNo, setNewCraneNo] = useState("");
  const [userError, setUserError] = useState("");

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"Admin" | "Area User">("Area User");
  const [editArea, setEditArea] = useState<number>(1);
  const [editPass, setEditPass] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCraneNo, setEditCraneNo] = useState("");

  // Crane creation states
  const [showAddCrane, setShowAddCrane] = useState(false);
  const [addCraneId, setAddCraneId] = useState("");
  const [addCraneName, setAddCraneName] = useState("");
  const [addCraneCap, setAddCraneCap] = useState<number>(15);
  const [addCraneAuxCap, setAddCraneAuxCap] = useState<string>("");
  const [addCraneCol, setAddCraneCol] = useState<number>(15);
  const [addCraneMinCol, setAddCraneMinCol] = useState<number>(1);
  const [addCraneMaxCol, setAddCraneMaxCol] = useState<number>(30);
  const [addCraneAllocatedMin, setAddCraneAllocatedMin] = useState<number>(1);
  const [addCraneAllocatedMax, setAddCraneAllocatedMax] = useState<number>(10);
  const [craneError, setCraneError] = useState("");

  // Crane Edit states
  const [editingCraneId, setEditingCraneId] = useState<string | null>(null);
  const [craneName, setCraneName] = useState("");
  const [craneCap, setCraneCap] = useState<number>(10);
  const [craneAuxCap, setCraneAuxCap] = useState<string>("");
  const [craneCol, setCraneCol] = useState<number>(5);
  const [craneStatus, setCraneStatus] = useState<"Available" | "Maintenance" | "Busy" | "Breakdown">("Available");
  const [craneNotes, setCraneNotes] = useState("");
  const [craneMinCol, setCraneMinCol] = useState<number>(1);
  const [craneMaxCol, setCraneMaxCol] = useState<number>(30);
  const [craneAllocMin, setCraneAllocMin] = useState<number | undefined>(undefined);
  const [craneAllocMax, setCraneAllocMax] = useState<number | undefined>(undefined);
  const [craneBreakdownStartCol, setCraneBreakdownStartCol] = useState<number | undefined>(undefined);
  const [craneBreakdownEndCol, setCraneBreakdownEndCol] = useState<number | undefined>(undefined);

  // Settings states
  const [bufferTime, setBufferTime] = useState<number>(settings.bufferTimeMinutes || 5);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  const handleForceSeedDatabase = async () => {
    if (!window.confirm("ARE YOU ABSOLUTELY SURE? This will permanently erase all active requests, shift logs, custom users, and restore the database to the initial factory dummy dataset (EMP001, EMP101, etc.).")) {
      return;
    }

    setSeeding(true);
    setSeedMessage("");

    try {
      const response = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("crane_token")}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to seed database.");
      }

      setSeedMessage("Database successfully reset and seeded with default dummy users.");
      onRefreshAll();
    } catch (err: any) {
      setSeedMessage(`ERROR: ${err.message}`);
    } finally {
      setSeeding(false);
    }
  };

  // Shift Report states
  const [reportShift, setReportShift] = useState("Shift A");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [reportSummary, setReportSummary] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const [completeSuccess, setCompleteSuccess] = useState("");

  // Analytics & Aggregates
  const total = requests.length;
  const pending = requests.filter((r) => r.status === "Submitted").length;
  const scheduled = requests.filter((r) => r.status === "Scheduled").length;
  const draft = requests.filter((r) => r.status === "Draft").length;

  const calculateUtil = (craneId: string): number => {
    const craneJobs = schedules.filter((s) => s.assignedCrane === craneId);
    let totalMinutes = 0;
    craneJobs.forEach((j) => {
      // simple minutes conversion
      const [sh, sm] = j.startTime.split(":").map(Number);
      const [eh, em] = j.endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      totalMinutes += diff > 0 ? diff : diff + 1440;
    });
    const percentage = Math.round((totalMinutes / 480) * 100);
    return Math.min(percentage, 100);
  };

  const craneUtils = cranes.map((c) => ({
    id: c.id,
    name: c.name,
    util: calculateUtil(c.id)
  })).sort((a, b) => b.util - a.util);

  const top3Cranes = craneUtils.slice(0, 3);

  const areaDemand: Record<number, number> = {};
  for (let i = 1; i <= 22; i++) {
    areaDemand[i] = 0;
  }
  requests.forEach((r) => {
    if (areaDemand[r.area] !== undefined) {
      areaDemand[r.area]++;
    } else {
      areaDemand[r.area] = 1;
    }
  });

  const topAreas = Object.entries(areaDemand)
    .map(([area, count]) => ({ area: Number(area), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const priorityBreakdown: Record<PriorityType, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  requests.forEach((r) => {
    if (priorityBreakdown[r.priority] !== undefined) {
      priorityBreakdown[r.priority]++;
    }
  });

  const averageWaitingTime = schedules.length > 0 
    ? Math.round(schedules.reduce((acc, s) => acc + s.travelTimeMinutes + s.bufferTimeMinutes, 0) / schedules.length) 
    : 0;

  // Handle Create User
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    if (!newEmpId || !newName || !newPass) {
      setUserError("All user fields are required.");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("crane_token")}`,
        },
        body: JSON.stringify({
          employeeId: newEmpId,
          name: newName,
          role: newRole,
          area: newRole === "Admin" ? null : Number(newArea),
          password: newPass,
          phone: newPhone,
          email: newEmail,
          craneNo: newCraneNo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "User generation failed.");
      }

      onAddUser(data);
      // Reset User fields
      setNewEmpId("");
      setNewName("");
      setNewPass("");
      setNewPhone("");
      setNewEmail("");
      setNewCraneNo("");
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  // Handle Edit Crane Submit
  const handleEditCraneSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    onUpdateCrane(id, {
      name: craneName,
      capacity: Number(craneCap),
      auxCapacity: craneAuxCap !== "" ? Number(craneAuxCap) : null as any,
      currentColumn: Number(craneCol),
      status: craneStatus,
      maintenanceNotes: craneNotes,
      minColumn: Number(craneMinCol),
      maxColumn: Number(craneMaxCol),
      allocatedMinColumn: craneAllocMin !== undefined ? Number(craneAllocMin) : undefined,
      allocatedMaxColumn: craneAllocMax !== undefined ? Number(craneAllocMax) : undefined,
      breakdownStartCol: craneStatus === "Breakdown" ? (craneBreakdownStartCol !== undefined ? craneBreakdownStartCol : Math.max(1, Number(craneCol) - 1)) : undefined,
      breakdownEndCol: craneStatus === "Breakdown" ? (craneBreakdownEndCol !== undefined ? craneBreakdownEndCol : Math.min(30, Number(craneCol) + 1)) : undefined,
    });
    setEditingCraneId(null);
  };

  const startEditingCrane = (crane: Crane) => {
    setEditingCraneId(crane.id);
    setCraneName(crane.name || crane.id);
    setCraneCap(crane.capacity);
    setCraneAuxCap(crane.auxCapacity !== undefined ? String(crane.auxCapacity) : "");
    setCraneCol(crane.currentColumn);
    setCraneStatus(crane.status);
    setCraneNotes(crane.maintenanceNotes);
    setCraneMinCol(crane.minColumn);
    setCraneMaxCol(crane.maxColumn);
    setCraneAllocMin(crane.allocatedMinColumn);
    setCraneAllocMax(crane.allocatedMaxColumn);
    setCraneBreakdownStartCol(crane.breakdownStartCol);
    setCraneBreakdownEndCol(crane.breakdownEndCol);
  };

  const handleCreateCraneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCraneError("");
    if (!addCraneId || !addCraneName || !addCraneCap) {
      setCraneError("ID, Name, and Capacity are required.");
      return;
    }

    const success = await onCreateCrane({
      id: addCraneId,
      name: addCraneName,
      capacity: Number(addCraneCap),
      auxCapacity: addCraneAuxCap !== "" ? Number(addCraneAuxCap) : undefined,
      currentColumn: Number(addCraneCol),
      minColumn: Number(addCraneMinCol),
      maxColumn: Number(addCraneMaxCol),
      allocatedMinColumn: Number(addCraneAllocatedMin),
      allocatedMaxColumn: Number(addCraneAllocatedMax),
    });

    if (success) {
      setAddCraneId("");
      setAddCraneName("");
      setAddCraneCap(15);
      setAddCraneAuxCap("");
      setAddCraneCol(15);
      setAddCraneMinCol(1);
      setAddCraneMaxCol(30);
      setAddCraneAllocatedMin(1);
      setAddCraneAllocatedMax(10);
      setShowAddCrane(false);
    }
  };

  // Handle Edit User
  const startEditingUser = (u: User) => {
    setEditingUserId(u.employeeId);
    setEditName(u.name);
    setEditRole(u.role);
    setEditArea(u.area || 1);
    setEditPass("");
    setEditPhone(u.phone || "");
    setEditEmail(u.email || "");
    setEditCraneNo(u.craneNo || "");
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    if (!editName) {
      setUserError("Name is required.");
      return;
    }

    const success = await onUpdateUser(editingUserId!, {
      name: editName,
      role: editRole,
      area: editRole === "Admin" ? null : Number(editArea),
      password: editPass.trim() !== "" ? editPass : undefined,
      phone: editPhone,
      email: editEmail,
      craneNo: editCraneNo,
    });

    if (success) {
      setEditingUserId(null);
      setEditName("");
      setEditPass("");
      setEditPhone("");
      setEditEmail("");
      setEditCraneNo("");
    }
  };

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({ bufferTimeMinutes: Number(bufferTime) });
  };

  // Handle Shift Report Submit
  const handleShiftReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReportSuccess("");
    if (!reportSummary.trim()) return;
    onCreateShiftReport(reportShift, reportSummary, reportDate);
    setReportSummary("");
    setReportSuccess("Daily/Shift report successfully registered to audit trail!");
  };

  // Handle Complete Shift Submit
  const handleCompleteShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompleteSuccess("");
    if (window.confirm(`Are you sure you want to complete and archive operations for ${reportShift} on ${reportDate}? This will move all Scheduled jobs to History/Archives.`)) {
      onCompleteShift(reportShift, reportDate);
      setCompleteSuccess(`Successfully completed and archived scheduled tasks for ${reportShift} on ${reportDate}!`);
    }
  };

  return (
    <div id="admin_dashboard" className="bg-white rounded-sm border-4 border-[#141414] p-6 shadow-[6px_6px_0px_#141414] mb-8 relative overflow-hidden font-sans">
      
      {/* Tab Navigation header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b-2 border-[#141414] pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-[#141414]"></span>
            Admin Workstation Command Console
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5 font-bold">
            Operational overrides, scheduler engine execution, telemetry, and security clearance.
          </p>
        </div>

        {/* Real-time scheduling triggers */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Activation status message */}
          <div className="text-[10px] font-mono font-bold uppercase tracking-tight px-2.5 py-1.5 bg-zinc-100 border border-zinc-300 text-zinc-700 rounded-sm">
            {pending === 0 && draft === 0 ? (
              <span className="text-zinc-500">No requests to schedule</span>
            ) : (
              <span className="text-emerald-700">✓ Ready to schedule ({pending + draft} pending)</span>
            )}
          </div>

          <button
            onClick={onGenerateSchedule}
            disabled={pending === 0 && draft === 0}
            className={`px-4 py-2 font-black text-xs rounded-sm border-2 border-[#141414] flex items-center gap-1.5 uppercase tracking-wider transition-all shadow-[3px_3px_0px_#141414] ${
              (pending > 0 || draft > 0)
                ? "bg-amber-500 hover:bg-amber-600 text-[#141414] cursor-pointer active:translate-y-[2px] active:shadow-[1px_1px_0px_#141414]"
                : "bg-zinc-200 border-zinc-400 text-zinc-400 shadow-none cursor-not-allowed opacity-60"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Generate Schedule
          </button>
          <button
            onClick={onClearSchedule}
            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black text-xs rounded-sm flex items-center gap-1.5 uppercase tracking-wider transition-all cursor-pointer active:translate-y-[2px] active:shadow-[1px_1px_0px_#141414]"
          >
            Clear Schedule
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap border-b-2 border-zinc-200 mb-6 gap-1 font-mono text-xs font-black">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "analytics"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          Telemetry & Logs
        </button>
        <button
          onClick={() => setActiveTab("cranes")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "cranes"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          <div className="flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5" /> Gantry Maintenance
          </div>
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "requests"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          Job Requests ({pending})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "users"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Staff Badges
          </div>
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "reports"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          <div className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Shift Reports
          </div>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 border-t-2 border-x-2 transition-colors rounded-t-sm ${
            activeTab === "settings"
              ? "border-[#141414] bg-zinc-100 text-[#141414] font-black"
              : "border-transparent text-zinc-500 hover:text-[#141414]"
          }`}
        >
          <div className="flex items-center gap-1">
            <Settings className="w-3.5 h-3.5" /> System Limits
          </div>
        </button>
      </div>

      {/* High Visibility Pending Jobs Monitor - Tells Whose Job Is Pending */}
      {(() => {
        const pendingJobs = requests.filter(r => r.status === "Submitted" || r.status === "Draft");
        if (pendingJobs.length === 0) return null;
        return (
          <div className="mb-6 p-4 bg-amber-50 border-4 border-[#141414] rounded-sm shadow-[4px_4px_0px_#141414] font-mono">
            <div className="flex items-center gap-2 border-b-2 border-[#141414] pb-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-tight">
                ⚠️ Live Operations Queue: Whos Job is Pending Schedule ({pendingJobs.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingJobs.map((job) => (
                <div key={job.id} className="p-3 bg-white border-2 border-[#141414] rounded-sm shadow-[2px_2px_0px_#141414] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b pb-1.5 mb-2 text-[10px]">
                      <span className="font-black text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-sm">
                        {job.id}
                      </span>
                      <span className={`font-black px-1.5 py-0.5 rounded-sm border ${
                        job.priority === "P1"
                          ? "bg-red-50 text-red-800 border-red-300"
                          : "bg-zinc-100 text-[#141414] border-zinc-200"
                      }`}>
                        {job.priority}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div>
                        <span className="text-zinc-400 uppercase font-black text-[9px] block">Requesting Shop Floor Dept (Owner)</span>
                        <span className="text-zinc-900 font-black text-xs block bg-zinc-50 border border-zinc-200 p-1.5 rounded-sm leading-tight font-sans">
                          💼 {job.department}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-bold">
                        <div>
                          <span className="text-zinc-400 text-[8px] uppercase block leading-none mb-0.5">Location</span>
                          <span className="text-[#141414]">Area {job.area} (Cols {job.startColumn}-{job.endColumn})</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[8px] uppercase block leading-none mb-0.5">Crane Hook</span>
                          <span className="text-amber-800">{job.mandatoryCrane || "Any Gantry"}</span>
                        </div>
                      </div>

                      <div className="pt-1.5">
                        <span className="text-zinc-400 uppercase font-black text-[9px] block">Workscope details</span>
                        <p className="text-zinc-600 font-sans font-semibold text-[10px] leading-snug mt-0.5">
                          {job.details || job.remarks || "No details provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500 font-black">🕒 {job.estimatedStartTime} - {job.estimatedEndTime}</span>
                    <span className="text-zinc-400 font-bold">{job.estimatedWeight} Tons</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Key Metrics Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-[#141414] font-mono">
            <div className="bg-white p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414]">
              <div className="text-[10px] text-zinc-500 uppercase font-black">Total logged</div>
              <div className="text-2xl font-black mt-1 text-[#141414]">{total}</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-bold">Jobs recorded</div>
            </div>
            <div className="bg-white p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414]">
              <div className="text-[10px] text-amber-600 uppercase font-black">Pending queue</div>
              <div className="text-2xl font-black mt-1 text-amber-600">{pending}</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-bold">Drafts submitted</div>
            </div>
            <div className="bg-white p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414]">
              <div className="text-[10px] text-emerald-600 uppercase font-black">Active scheduled</div>
              <div className="text-2xl font-black mt-1 text-emerald-600">{scheduled}</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-bold">Allotted cranes</div>
            </div>
            <div className="bg-white p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414]">
              <div className="text-[10px] text-zinc-500 uppercase font-black">Waiting margin</div>
              <div className="text-2xl font-black mt-1 text-[#141414]">{averageWaitingTime}m</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-bold">Gantry transit buffer</div>
            </div>
            <div className="bg-white p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414] col-span-2 lg:col-span-1">
              <div className="text-[10px] text-zinc-500 uppercase font-black">Draft mode</div>
              <div className="text-2xl font-black mt-1 text-[#141414]">{draft}</div>
              <div className="text-[9px] text-zinc-500 mt-1 font-bold">Saved drafts</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Visual Gantry Occupancy % Charts */}
            <div className="bg-white p-5 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] space-y-4">
              <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-200 pb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Gantry Workload Occupancy (Shift Capacity)
              </h3>
              <div className="space-y-4 font-mono text-xs">
                {top3Cranes.map((tc, idx) => (
                  <div key={tc.id}>
                    <div className="flex justify-between mb-1">
                      <span className="font-extrabold text-[#141414]">{tc.name}</span>
                      <span className="font-black">{tc.util}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 h-3 border-2 border-[#141414] overflow-hidden rounded-sm">
                      <div className={`h-full transition-all ${idx === 0 ? "bg-emerald-600" : idx === 1 ? "bg-amber-500" : "bg-zinc-800"}`} style={{ width: `${tc.util}%` }}></div>
                    </div>
                  </div>
                ))}
                {top3Cranes.length === 0 && (
                  <p className="text-zinc-500 text-xs">No cranes currently registered.</p>
                )}
              </div>
            </div>

            {/* Demands & Priorities */}
            <div className="bg-white p-5 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] grid grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-3 border-r-2 border-zinc-200 pr-2">
                <h4 className="font-black text-zinc-800 text-[11px] uppercase tracking-wider mb-2 border-b border-zinc-100 pb-1">Top Area Demands</h4>
                <div className="space-y-1.5 font-bold">
                  {topAreas.map((ta) => (
                    <div key={ta.area} className="flex justify-between">
                      <span>Area {ta.area}:</span> <span className="text-[#141414]">{ta.count} requests</span>
                    </div>
                  ))}
                  {topAreas.length === 0 && (
                    <p className="text-zinc-500 text-xs">No active demands recorded.</p>
                  )}
                </div>
              </div>
              <div className="space-y-3 pl-2">
                <h4 className="font-black text-zinc-800 text-[11px] uppercase tracking-wider mb-2 border-b border-zinc-100 pb-1">Priorities</h4>
                <div className="space-y-1.5 font-bold">
                  <div className="flex justify-between">
                    <span className="text-red-600">P1 (Critical):</span> <span>{priorityBreakdown.P1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">P2 (Urgent):</span> <span>{priorityBreakdown.P2}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#141414]">P3 (Normal):</span> <span>{priorityBreakdown.P3}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">P4 (Planned):</span> <span>{priorityBreakdown.P4}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live System Audit Logs */}
          <div className="bg-white p-5 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414]">
            <h3 className="font-bold text-[#141414] text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-zinc-200 pb-2">
              <History className="w-4 h-4 text-zinc-700" />
              Live Security & Operations Audit Logs
            </h3>
            <div className="overflow-y-auto max-h-[220px] border-2 border-[#141414] rounded-sm text-[10px] font-mono">
              <table className="w-full text-left">
                <thead className="bg-zinc-100 text-[#141414] border-b-2 border-[#141414] uppercase tracking-wider font-black">
                  <tr>
                    <th className="p-2.5">Timestamp</th>
                    <th className="p-2.5">Employee ID</th>
                    <th className="p-2.5">User</th>
                    <th className="p-2.5">Action</th>
                    <th className="p-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-[#141414] font-bold">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="p-2.5 text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="p-2.5 text-[#141414] font-black">{log.employeeId}</td>
                      <td className="p-2.5">{log.userName}</td>
                      <td className="p-2.5 font-black text-amber-700 uppercase">{log.action}</td>
                      <td className="p-2.5 text-zinc-600">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cranes Overrides */}
      {activeTab === "cranes" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-zinc-50 border-2 border-[#141414] p-4 shadow-[2px_2px_0px_#141414]">
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight">Gantry Crane Fleet Registry</h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5 font-bold">
                Configure physical limits, load profiles, allocated primary columns, and maintenance states.
              </p>
            </div>
            <button
              onClick={() => {
                setShowAddCrane(!showAddCrane);
                setCraneError("");
              }}
              className="px-3 py-1.5 bg-[#141414] hover:bg-zinc-800 text-white font-black text-xs uppercase flex items-center gap-1 border-2 border-[#141414] shadow-[2px_2px_0px_#141414]"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAddCrane ? "Hide Form" : "Register New Crane"}
            </button>
          </div>

          {/* Add Crane Form */}
          {showAddCrane && (
            <div className="bg-white border-4 border-[#141414] p-5 shadow-[4px_4px_0px_#141414] max-w-xl">
              <h4 className="font-black text-xs uppercase tracking-tight mb-3 border-b-2 border-zinc-200 pb-1">Register New Gantry Crane Asset</h4>
              {craneError && (
                <p className="text-xs text-red-600 bg-red-50 p-2 border-2 border-red-300 font-bold mb-3">{craneError}</p>
              )}
              <form onSubmit={handleCreateCraneSubmit} className="space-y-4 font-mono text-xs font-bold">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Unique ID (e.g. A4)</label>
                    <input
                      type="text"
                      placeholder="e.g. A4"
                      value={addCraneId}
                      onChange={(e) => setAddCraneId(e.target.value.toUpperCase())}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Crane A4"
                      value={addCraneName}
                      onChange={(e) => setAddCraneName(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Main Hoist Capacity (Tons)</label>
                    <input
                      type="number"
                      value={addCraneCap}
                      onChange={(e) => setAddCraneCap(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Aux Hoist Capacity (Tons, Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 10"
                      value={addCraneAuxCap}
                      onChange={(e) => setAddCraneAuxCap(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Initial position (Col 1-30)</label>
                    <input
                      type="number"
                      value={addCraneCol}
                      onChange={(e) => setAddCraneCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Min Column</label>
                    <input
                      type="number"
                      value={addCraneMinCol}
                      onChange={(e) => setAddCraneMinCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Max Column</label>
                    <input
                      type="number"
                      value={addCraneMaxCol}
                      onChange={(e) => setAddCraneMaxCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Primary Min Column</label>
                    <input
                      type="number"
                      value={addCraneAllocatedMin}
                      onChange={(e) => setAddCraneAllocatedMin(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Primary Max Column</label>
                    <input
                      type="number"
                      value={addCraneAllocatedMax}
                      onChange={(e) => setAddCraneAllocatedMax(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#141414] hover:bg-zinc-800 text-white font-black text-xs uppercase border-2 border-[#141414] shadow-[2px_2px_0px_#141414]"
                >
                  Confirm Asset Registration
                </button>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cranes.map((crane) => (
              <div key={crane.id} className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
                <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-2">
                  <h3 className="font-black text-[#141414] text-xs uppercase tracking-tight">{crane.name || `Crane ${crane.id}`} ({crane.id})</h3>
                  <span className="text-[9px] bg-[#141414] text-white px-2 py-0.5 rounded-sm font-mono font-black uppercase">
                    Cap: {crane.capacity}T
                  </span>
                </div>

                {editingCraneId === crane.id ? (
                  /* Edit Crane Form */
                  <form
                    onSubmit={(e) => handleEditCraneSubmit(e, crane.id)}
                    className="space-y-3 font-mono text-xs font-bold"
                  >
                    <div>
                      <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Crane Display Name</label>
                      <input
                        type="text"
                        value={craneName}
                        onChange={(e) => setCraneName(e.target.value)}
                        className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Main Cap (T)</label>
                        <input
                          type="number"
                          value={craneCap}
                          onChange={(e) => setCraneCap(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Aux Cap (T)</label>
                        <input
                          type="number"
                          placeholder="None"
                          value={craneAuxCap}
                          onChange={(e) => setCraneAuxCap(e.target.value)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Current Col</label>
                        <input
                          type="number"
                          value={craneCol}
                          onChange={(e) => setCraneCol(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Min Col</label>
                        <input
                          type="number"
                          value={craneMinCol}
                          onChange={(e) => setCraneMinCol(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Max Col</label>
                        <input
                          type="number"
                          value={craneMaxCol}
                          onChange={(e) => setCraneMaxCol(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Min Col</label>
                        <input
                          type="number"
                          value={craneAllocMin !== undefined ? craneAllocMin : ""}
                          onChange={(e) => setCraneAllocMin(e.target.value !== "" ? Number(e.target.value) : undefined)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Max Col</label>
                        <input
                          type="number"
                          value={craneAllocMax !== undefined ? craneAllocMax : ""}
                          onChange={(e) => setCraneAllocMax(e.target.value !== "" ? Number(e.target.value) : undefined)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Status</label>
                      <select
                        value={craneStatus}
                        onChange={(e) => {
                          const newStatus = e.target.value as any;
                          setCraneStatus(newStatus);
                          if (newStatus === "Breakdown") {
                            setCraneBreakdownStartCol(Math.max(1, craneCol - 1));
                            setCraneBreakdownEndCol(Math.min(30, craneCol + 1));
                          }
                        }}
                        className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                      >
                        <option value="Available">Available</option>
                        <option value="Busy">Busy</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Breakdown">Breakdown</option>
                      </select>
                    </div>

                    {craneStatus === "Breakdown" && (
                      <div className="grid grid-cols-2 gap-2 bg-red-50 p-2.5 rounded-sm border-2 border-red-500">
                        <div>
                          <label className="block text-[9px] uppercase font-black text-red-600 mb-1">BD Start Col</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={craneBreakdownStartCol !== undefined ? craneBreakdownStartCol : Math.max(1, craneCol - 1)}
                            onChange={(e) => setCraneBreakdownStartCol(Number(e.target.value))}
                            className="w-full p-1.5 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] uppercase font-black text-red-600 mb-1">BD End Col</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={craneBreakdownEndCol !== undefined ? craneBreakdownEndCol : Math.min(30, craneCol + 1)}
                            onChange={(e) => setCraneBreakdownEndCol(Number(e.target.value))}
                            className="w-full p-1.5 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-bold"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Maintenance Notes</label>
                      <textarea
                        value={craneNotes}
                        onChange={(e) => setCraneNotes(e.target.value)}
                        placeholder="e.g. Wire rope replacement"
                        className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-sans font-medium h-16"
                      />
                    </div>

                    <div className="flex gap-2 font-sans pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingCraneId(null)}
                        className="w-1/2 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm text-zinc-700 font-bold text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="w-1/2 py-2 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white rounded-sm font-black text-xs uppercase"
                      >
                        Save Override
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Crane override details */
                  <div className="space-y-3 font-mono text-xs text-zinc-700 font-bold">
                    <div className="flex justify-between">
                      <span>Position:</span>
                      <span className="font-black text-[#141414]">Column {crane.currentColumn}</span>
                    </div>
                    {crane.auxCapacity && (
                      <div className="flex justify-between">
                        <span>Aux Hoist:</span>
                        <span className="font-black text-[#141414]">{crane.auxCapacity} Tons</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Allocated Area:</span>
                      <span className="text-[#141414]">
                        Col {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : (crane.id === "A1" ? 1 : crane.id === "A2" ? 11 : 21)}-
                        {crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : (crane.id === "A1" ? 10 : crane.id === "A2" ? 20 : 30)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Physical Bounds:</span>
                      <span className="text-[#141414]">Columns {crane.minColumn || 1}-{crane.maxColumn || 30}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span
                        className={`font-black px-2 py-0.5 rounded-sm text-[9px] uppercase border ${
                          crane.status === "Available"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : crane.status === "Busy"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-red-50 text-red-800 border-red-300"
                        }`}
                      >
                        {crane.status}
                      </span>
                    </div>

                    {crane.maintenanceNotes && (
                      <div className="mt-2 p-2 bg-red-50 border-2 border-red-300 rounded-sm text-red-950 text-[10px] flex items-start gap-1 font-sans">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-600" />
                        <span>{crane.maintenanceNotes}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        onClick={() => startEditingCrane(crane)}
                        className="py-2 bg-zinc-50 hover:bg-zinc-100 border-2 border-[#141414] shadow-[1px_1px_0px_#141414] text-[#141414] text-xs font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer"
                      >
                        Modify
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to permanently delete Crane ${crane.name || crane.id} (${crane.id})?`)) {
                            onDeleteCrane(crane.id);
                          }
                        }}
                        className="py-2 bg-red-50 hover:bg-red-100 border-2 border-red-600 text-red-600 text-xs font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Requests Management Override */}
      {activeTab === "requests" && (
        <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] overflow-hidden font-mono text-xs">
          <div className="p-4 bg-zinc-100 border-b-2 border-[#141414] font-black uppercase text-[#141414]">
            Override Pending Operations Queue
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-black uppercase tracking-wide border-b-2 border-[#141414]">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Area</th>
                  <th className="p-3">Dept</th>
                  <th className="p-3">Cols</th>
                  <th className="p-3">Timeline</th>
                  <th className="p-3">Load</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Overrides</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-zinc-100 font-bold text-[#141414]">
                {requests.filter((r) => r.status !== "Completed").length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-zinc-400">
                      No active operations currently queued in factory registry.
                    </td>
                  </tr>
                ) : (
                  requests.filter((r) => r.status !== "Completed").map((req) => (
                    <tr key={req.id} className="hover:bg-zinc-50/50">
                      <td className="p-3 font-black text-[#141414]">{req.id}</td>
                      <td className="p-3 font-black text-zinc-600">Area {req.area}</td>
                      <td className="p-3 text-[#141414] font-sans font-bold">{req.department}</td>
                      <td className="p-3 font-black">
                        {req.startColumn !== undefined && req.endColumn !== undefined ? `${req.startColumn}-${req.endColumn}` : req.column}
                      </td>
                      <td className="p-3 text-zinc-500">{req.estimatedStartTime}-{req.estimatedEndTime}</td>
                      <td className="p-3 font-black">{req.estimatedWeight}T</td>
                      <td className="p-3">
                        <span
                          className={`font-black px-2 py-0.5 rounded-sm text-[9px] uppercase border ${
                            req.priority === "P1"
                              ? "bg-red-50 text-red-800 border-red-300"
                              : req.priority === "P2"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : req.priority === "P3"
                              ? "bg-zinc-100 text-[#141414] border-zinc-300"
                              : "bg-zinc-50 text-zinc-600 border-zinc-200"
                          }`}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-black px-2 py-0.5 rounded-sm text-[9px] uppercase border ${
                            req.status === "Draft"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : req.status === "Submitted"
                              ? "bg-zinc-100 text-zinc-800 border-zinc-400"
                              : req.status === "Scheduled"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : "bg-red-50 text-red-700 border-red-300"
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {req.status === "Submitted" && (
                          <button
                            onClick={() => onReopenRequest(req.id)}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 border border-[#141414] text-slate-950 rounded-sm text-[10px] font-sans font-black uppercase tracking-wider"
                            title="Allows supervisor to edit again"
                          >
                            Reopen to Draft
                          </button>
                        )}
                        {req.status === "Draft" && (
                          <span className="text-zinc-500 text-[10px] font-bold">Awaiting Submission</span>
                        )}
                        {req.status === "Scheduled" && (
                          <span className="text-emerald-700 font-black text-[10px] uppercase">Allotted</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create or Edit User Form */}
          {editingUserId ? (
            /* Edit User Form */
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 flex justify-between items-center">
                <span>Edit Staff Profile</span>
                <span className="text-[10px] bg-amber-500 px-1.5 py-0.5 rounded-sm font-bold text-white uppercase">{editingUserId}</span>
              </h3>

              {userError && (
                <div className="p-2.5 bg-red-50 border-2 border-red-300 text-red-950 text-[10px] rounded-sm font-bold font-mono">
                  {userError}
                </div>
              )}

              <form onSubmit={handleEditUserSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Staff Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans font-bold text-[#141414]"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Override Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editPass}
                    onChange={(e) => setEditPass(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. name@factory.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 font-bold">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">System Clearance</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs"
                    >
                      <option value="Area User">Area User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Crane No (Assigned)</label>
                    <input
                      type="text"
                      placeholder="e.g. F1, A1, A2"
                      value={editCraneNo}
                      onChange={(e) => setEditCraneNo(e.target.value.toUpperCase())}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-amber-700 font-bold uppercase"
                    />
                  </div>
                </div>

                {editRole === "Area User" && (
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Primary Area</label>
                    <select
                      value={editArea}
                      onChange={(e) => setEditArea(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-xs"
                    >
                      {Array.from({ length: 22 }, (_, i) => i + 1).map((areaNum) => (
                        <option key={areaNum} value={areaNum}>Area {areaNum}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="w-1/3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm font-sans font-black text-xs uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2 bg-[#141414] hover:bg-zinc-800 text-white font-black text-xs uppercase rounded-sm border-2 border-[#141414] shadow-[2px_2px_0px_#141414] font-sans"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Create User Form */
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2">
                Generate New Staff Credentials
              </h3>

              {userError && (
                <div className="p-2.5 bg-red-50 border-2 border-red-300 text-red-950 text-[10px] rounded-sm font-bold font-mono">
                  {userError}
                </div>
              )}

              <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Employee Clock ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP105"
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-black text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Staff Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Robert Kowalski"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans font-bold text-[#141414]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. name@factory.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Default Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 font-bold">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">System Clearance</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs"
                    >
                      <option value="Area User">Area User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Assign Crane No</label>
                    <input
                      type="text"
                      placeholder="e.g. F1, A1, A2"
                      value={newCraneNo}
                      onChange={(e) => setNewCraneNo(e.target.value.toUpperCase())}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-amber-700 font-bold uppercase"
                    />
                  </div>
                </div>

                {newRole === "Area User" && (
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Primary Area</label>
                    <select
                      value={newArea}
                      onChange={(e) => setNewArea(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-xs"
                    >
                      {Array.from({ length: 22 }, (_, i) => i + 1).map((areaNum) => (
                        <option key={areaNum} value={areaNum}>Area {areaNum}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] text-[#141414] font-black text-xs uppercase rounded-sm transition-all flex items-center justify-center gap-1 font-sans cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#141414]" />
                  Register Credentials
                </button>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 lg:col-span-2 space-y-4 font-mono text-xs">
            <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2">
              Staff Badge Registry
            </h3>

            <div className="overflow-y-auto max-h-[340px] border-2 border-[#141414] rounded-sm">
              <table className="w-full text-left">
                <thead className="bg-zinc-100 text-[#141414] font-black uppercase tracking-wide border-b-2 border-[#141414] text-[9px]">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Name / Contact</th>
                    <th className="p-2.5">Clearance</th>
                    <th className="p-2.5">Operating Station</th>
                    <th className="p-2.5">Crane No</th>
                    <th className="p-2.5 text-right font-black">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-zinc-100 text-[#141414] font-bold">
                  {users.map((u) => (
                    <tr key={u.employeeId} className="hover:bg-zinc-50">
                      <td className="p-2.5 font-black text-[#141414]">{u.employeeId}</td>
                      <td className="p-2.5 font-sans">
                        <div className="font-bold text-[#141414]">{u.name}</div>
                        <div className="text-[10px] text-zinc-500 font-medium">
                          {u.phone && <span>Ph: {u.phone}</span>}
                          {u.phone && u.email && <span className="mx-1">|</span>}
                          {u.email && <span>{u.email}</span>}
                          {!u.phone && !u.email && <span className="text-zinc-400">No contact info</span>}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[9px] font-black border uppercase ${
                            u.role === "Admin" ? "bg-purple-50 text-purple-800 border-purple-300" : "bg-sky-50 text-sky-800 border-sky-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-2.5 font-black">
                        {u.area ? `Area ${u.area}` : "Universal / Admin"}
                      </td>
                      <td className="p-2.5 font-mono font-black text-amber-700">
                        {u.craneNo || "—"}
                      </td>
                      <td className="p-2.5 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEditingUser(u)}
                          className="text-zinc-500 hover:text-amber-600 p-1 cursor-pointer"
                          title="Modify Credentials"
                        >
                          <Sliders className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to permanently delete user ${u.name} (${u.employeeId})?`)) {
                              onDeleteUser(u.employeeId);
                            }
                          }}
                          disabled={user.employeeId === u.employeeId}
                          className="text-zinc-500 hover:text-red-500 disabled:opacity-30 p-1 cursor-pointer"
                          title="Wipe Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create shift report form */}
          <div className="space-y-6 lg:col-span-1">
            {/* Form 1: Compile Report */}
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full inline-block"></span>
                Compile Planning Report
              </h3>

              {reportSuccess && (
                <div className="p-2.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-[10px] rounded-sm font-bold font-mono">
                  {reportSuccess}
                </div>
              )}

              <form onSubmit={handleShiftReportSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Operating Shift Scope</label>
                  <select
                    value={reportShift}
                    onChange={(e) => setReportShift(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Daily Summary">Daily Summary (All Shifts aggregated)</option>
                    <option value="Shift A">Shift A (06:00 AM - 02:00 PM)</option>
                    <option value="Shift B">Shift B (02:00 PM - 10:00 PM)</option>
                    <option value="Shift C">Shift C (10:00 PM - 06:00 AM)</option>
                    <option value="General Shift">General Shift (09:00 AM - 06:30 PM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Executive Summary / Gantry Gaps</label>
                  <textarea
                    required
                    placeholder="Record summary of crane utilization, breakdown risks, and critical priority jobs..."
                    value={reportSummary}
                    onChange={(e) => setReportSummary(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans font-bold h-24 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white font-black text-xs uppercase rounded-sm shadow-sm transition-all cursor-pointer"
                >
                  Log Daily/Shift Report
                </button>
              </form>
            </div>

            {/* Form 2: Complete and Archive Shift */}
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-zinc-700 rounded-full inline-block animate-pulse"></span>
                Shift Completion / Archival
              </h3>

              <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
                Once an operational shift is completed, archive the planned crane gantry schedules to permanent history log. This clears active grids while securing audit trails.
              </p>

              {completeSuccess && (
                <div className="p-2.5 bg-blue-50 border-2 border-blue-300 text-blue-950 text-[10px] rounded-sm font-bold font-mono">
                  {completeSuccess}
                </div>
              )}

              <form onSubmit={handleCompleteShiftSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div className="bg-zinc-50 p-3 border-2 border-[#141414] rounded-sm text-[10px] text-zinc-700 space-y-1">
                  <div>Date: <span className="font-black text-zinc-950">{reportDate}</span></div>
                  <div>Shift: <span className="font-black text-zinc-950">{reportShift === "Daily Summary" ? "All Shifts" : reportShift}</span></div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 border-2 border-[#141414] text-white font-black text-xs uppercase rounded-sm shadow-[2px_2px_0px_#141414] transition-all cursor-pointer"
                >
                  Complete & Archive Shift
                </button>
              </form>
            </div>
          </div>

          {/* Created Reports List */}
          <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 lg:col-span-2 space-y-4 font-mono text-xs">
            <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 flex items-center justify-between">
              <span>Shift Planning History</span>
              <div className="flex gap-2">
                <button
                  onClick={() => generateDateWisePDF(schedules, requests)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm text-[10px] font-sans font-black uppercase flex items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Date-Wise PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm text-[10px] font-sans font-black uppercase cursor-pointer"
                >
                  Print Full Page
                </button>
              </div>
            </h3>

            <div className="space-y-4 overflow-y-auto max-h-[340px] pr-1">
              {shiftReports.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-zinc-200 text-center text-zinc-400 bg-zinc-50">
                  No Shift Planning reports compiled in system history.
                </div>
              ) : (
                shiftReports.map((rep) => (
                  <div key={rep.id} className="p-4 rounded-sm bg-zinc-50 border-2 border-[#141414] shadow-[2px_2px_0px_#141414] space-y-2">
                    <div className="flex justify-between items-center border-b border-zinc-300 pb-1.5">
                      <span className="font-black text-[#141414] text-sm">{rep.shift} - {rep.date}</span>
                      <span className="text-[9px] text-[#141414] font-black bg-white px-2 py-0.5 border-2 border-[#141414] rounded-sm">ID: {rep.id}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-600 font-bold">
                      <div>Total Jobs: <span className="text-[#141414] font-black">{rep.totalRequests}</span></div>
                      <div>Scheduled: <span className="text-emerald-700 font-black">{rep.scheduledRequests}</span></div>
                      <div>Avg Waiting: <span className="text-[#141414] font-black">{rep.averageWaitingTimeMinutes} min</span></div>
                    </div>

                    <div className="text-[11px] text-zinc-700 font-sans border-t border-zinc-200 pt-2 italic font-bold">
                      "{rep.summary}"
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Settings Tab */}
      {activeTab === "settings" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5">
            <h3 className="font-black text-[#141414] text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 mb-4">
              Operations Buffer Margins
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-4 font-mono text-xs font-bold">
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">
                  Inter-Job Buffer Margin (Minutes)
                </label>
                <input
                  type="number"
                  value={bufferTime}
                  onChange={(e) => setBufferTime(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-[#141414] font-black text-sm"
                />
                <p className="text-[10px] text-zinc-500 font-sans mt-2.5 leading-normal font-bold">
                  Configures safety margin allocated to EOT cranes between scheduled hoisting operations. Default is 5 minutes.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white font-black text-xs uppercase rounded-sm shadow-sm transition-all font-sans cursor-pointer"
              >
                Commit Limits Config
              </button>
            </form>
          </div>

          <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5">
            <h3 className="font-black text-amber-600 text-xs uppercase tracking-wider border-b-2 border-zinc-200 pb-2 mb-4 flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              Database Control Panel
            </h3>

            <div className="space-y-4">
              <p className="text-[11px] font-bold text-zinc-600 leading-normal font-sans">
                This utility wipes the entire active state and re-populates the database (MongoDB or Local File) with all original dummy users (EMP001, EMP101, EMP102, EMP103), sample cranes, and initial schedule.
              </p>

              {seedMessage && (
                <div className={`p-2.5 border-2 rounded-sm text-[10px] font-mono font-bold ${
                  seedMessage.startsWith("ERROR") 
                    ? "bg-red-50 border-red-300 text-red-950" 
                    : "bg-emerald-50 border-emerald-300 text-emerald-950"
                }`}>
                  {seedMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleForceSeedDatabase}
                disabled={seeding}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 border-2 border-[#141414] text-[#141414] font-black text-xs uppercase rounded-sm shadow-[3px_3px_0px_#141414] transition-all cursor-pointer active:translate-y-[2px] active:shadow-[1px_1px_0px_#141414] flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin" : ""}`} />
                {seeding ? "Reseeding Database..." : "Reset & Seed Facility Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
