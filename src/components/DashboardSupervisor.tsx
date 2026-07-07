import React, { useState, useEffect } from "react";
import { Plus, Trash2, Send, Lock, FileSpreadsheet, Eye, RefreshCw, AlertCircle, Clock, ClipboardList, Cpu, Hammer, AlertTriangle } from "lucide-react";
import { CraneRequest, User, ShiftType, PriorityType, Crane } from "../types";
import { getCurrentShift } from "../utils/shiftUtils";

interface DashboardSupervisorProps {
  user: User;
  requests: CraneRequest[];
  cranes: Crane[];
  onRequestAdded: (newReq: CraneRequest) => void;
  onRequestDeleted: (id: string) => void;
  onRequestSubmittedBulk: (area: number) => void;
  onRefresh: () => void;
  initialSubView?: "logboards" | "new-request" | "cranes";
  onUpdateCrane?: (craneId: string, updatedFields: Partial<Crane>) => void;
  onCreateCrane?: (craneData: any) => Promise<boolean>;
  onDeleteCrane?: (craneId: string) => void;
}

export default function DashboardSupervisor({
  user,
  requests,
  cranes,
  onRequestAdded,
  onRequestDeleted,
  onRequestSubmittedBulk,
  onRefresh,
  initialSubView,
  onUpdateCrane,
  onCreateCrane,
  onDeleteCrane,
}: DashboardSupervisorProps) {
  // Navigation sub-views: "logboards" vs "new-request" vs "cranes"
  const [currentSubView, setCurrentSubView] = useState<"logboards" | "new-request" | "cranes">(
    initialSubView || "logboards"
  );
  
  useEffect(() => {
    if (initialSubView) {
      setCurrentSubView(initialSubView);
    }
  }, [initialSubView]);

  // Crane CRUD state
  const [showAddCrane, setShowAddCrane] = useState(false);
  const [craneError, setCraneError] = useState("");
  const [editingCraneId, setEditingCraneId] = useState<string | null>(null);

  const [addCraneId, setAddCraneId] = useState("");
  const [addCraneName, setAddCraneName] = useState("");
  const [addCraneCap, setAddCraneCap] = useState<number>(10);
  const [addCraneAuxCap, setAddCraneAuxCap] = useState<string>("");
  const [addCraneCol, setAddCraneCol] = useState<number>(5);
  const [addCraneMinCol, setAddCraneMinCol] = useState<number>(1);
  const [addCraneMaxCol, setAddCraneMaxCol] = useState<number>(30);
  const [addCraneAllocatedMin, setAddCraneAllocatedMin] = useState<number>(1);
  const [addCraneAllocatedMax, setAddCraneAllocatedMax] = useState<number>(30);

  const [craneName, setCraneName] = useState("");
  const [craneCap, setCraneCap] = useState<number>(10);
  const [craneAuxCap, setCraneAuxCap] = useState<string>("");
  const [craneCol, setCraneCol] = useState<number>(5);
  const [craneStatus, setCraneStatus] = useState<"Available" | "Maintenance" | "Busy">("Available");
  const [craneNotes, setCraneNotes] = useState("");
  const [craneMinCol, setCraneMinCol] = useState<number>(1);
  const [craneMaxCol, setCraneMaxCol] = useState<number>(30);
  const [craneAllocMin, setCraneAllocMin] = useState<number | undefined>(undefined);
  const [craneAllocMax, setCraneAllocMax] = useState<number | undefined>(undefined);

  const startEditingCrane = (crane: Crane) => {
    setEditingCraneId(crane.id);
    setCraneName(crane.name || crane.id);
    setCraneCap(crane.capacity);
    setCraneAuxCap(crane.auxCapacity !== undefined ? String(crane.auxCapacity) : "");
    setCraneCol(crane.currentColumn);
    setCraneStatus(crane.status);
    setCraneNotes(crane.maintenanceNotes || "");
    setCraneMinCol(crane.minColumn);
    setCraneMaxCol(crane.maxColumn);
    setCraneAllocMin(crane.allocatedMinColumn);
    setCraneAllocMax(crane.allocatedMaxColumn);
  };

  const handleCreateCraneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCraneError("");
    if (!addCraneId || !addCraneName || !addCraneCap) {
      setCraneError("ID, Name, and Capacity are required.");
      return;
    }
    if (!onCreateCrane) return;

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
      setAddCraneCap(10);
      setAddCraneAuxCap("");
      setAddCraneCol(15);
      setAddCraneMinCol(1);
      setAddCraneMaxCol(30);
      setAddCraneAllocatedMin(1);
      setAddCraneAllocatedMax(30);
      setShowAddCrane(false);
      onRefresh();
    }
  };

  const handleEditCraneSubmit = async (e: React.FormEvent, craneId: string) => {
    e.preventDefault();
    setCraneError("");
    if (!craneName || !craneCap) {
      setCraneError("Name and Capacity are required.");
      return;
    }
    if (!onUpdateCrane) return;

    await onUpdateCrane(craneId, {
      name: craneName,
      capacity: Number(craneCap),
      auxCapacity: craneAuxCap !== "" ? Number(craneAuxCap) : null as any,
      currentColumn: Number(craneCol),
      minColumn: Number(craneMinCol),
      maxColumn: Number(craneMaxCol),
      allocatedMinColumn: craneAllocMin,
      allocatedMaxColumn: craneAllocMax,
      status: craneStatus,
      maintenanceNotes: craneNotes,
    });

    setEditingCraneId(null);
    onRefresh();
  };
  
  // Form States for adding new jobs
  const [selectedFormArea, setSelectedFormArea] = useState<number>(user.role === "Admin" ? 1 : Number(user.area || 1));
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [bypassWindow, setBypassWindow] = useState<boolean>(() => {
    return localStorage.getItem("crane_bypass_window") === "true";
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleBypass = (val: boolean) => {
    setBypassWindow(val);
    localStorage.setItem("crane_bypass_window", val ? "true" : "false");
  };

  const checkIsWithinWindow = (date: Date): boolean => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // Windows are active during the first 10 minutes of the hour (0 to 9 minutes inclusive)
    // 06:00 - 06:10
    if (hours === 6 && minutes >= 0 && minutes < 10) return true;
    // 09:00 - 09:10 (AM)
    if (hours === 9 && minutes >= 0 && minutes < 10) return true;
    // 14:00 - 14:10 (2:00 - 2:10 PM)
    if (hours === 14 && minutes >= 0 && minutes < 10) return true;
    // 21:00 - 21:10 (9:00 - 9:10 PM)
    if (hours === 21 && minutes >= 0 && minutes < 10) return true;
    // 22:00 - 22:10 (10:00 - 10:10 PM)
    if (hours === 22 && minutes >= 0 && minutes < 10) return true;

    return false;
  };

  const getForcedShiftForWindow = (date: Date): ShiftType | null => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    if (hours === 6 && minutes >= 0 && minutes < 10) return "Shift A";
    if (hours === 9 && minutes >= 0 && minutes < 10) return "General Shift";
    if (hours === 14 && minutes >= 0 && minutes < 10) return "Shift B";
    if ((hours === 21 || hours === 22) && minutes >= 0 && minutes < 10) return "Shift C";
    
    return null;
  };

  const getLockoutStatusDetails = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    
    const activeHours = [6, 9, 14, 21, 22];
    const isCurrentlyActive = activeHours.includes(hours) && minutes >= 0 && minutes < 10;
    
    if (isCurrentlyActive) {
      const minsLeft = 9 - minutes;
      const secsLeft = 59 - seconds;
      return {
        state: "active" as const,
        text: `${minsLeft}m ${secsLeft}s left`,
        label: "LOCKOUT IMMINENT",
        badgeColor: "bg-emerald-500",
      };
    }
    
    // Calculate countdown to next handover window
    const totalMinsNow = hours * 60 + minutes;
    const windowMinsList = activeHours.map(h => h * 60);
    const futureWindowMins = windowMinsList.find(m => m > totalMinsNow);
    
    let diffMins = 0;
    if (futureWindowMins !== undefined) {
      diffMins = futureWindowMins - totalMinsNow;
    } else {
      // Wrap to tomorrow 06:00
      diffMins = (24 * 60 - totalMinsNow) + (6 * 60);
    }
    
    const hLeft = Math.floor(diffMins / 60);
    const mLeft = diffMins % 60;
    const secsLeft = 59 - seconds;
    
    return {
      state: "locked" as const,
      text: `${hLeft > 0 ? `${hLeft}h ` : ""}${mLeft}m ${secsLeft}s`,
      label: "AUTO-LOCKOUT ACTIVE",
      badgeColor: "bg-red-500",
    };
  };

  const statusDetails = getLockoutStatusDetails();
  const formatTimeDigit = (val: number) => String(val).padStart(2, "0");
  const hoursStr = formatTimeDigit(currentTime.getHours());
  const minutesStr = formatTimeDigit(currentTime.getMinutes());
  const secondsStr = formatTimeDigit(currentTime.getSeconds());

  const isWindowOpen = bypassWindow || user.role === "Admin" || checkIsWithinWindow(currentTime);
  const [bay, setBay] = useState<string>("A");
  const [shift, setShift] = useState<ShiftType>(() => getCurrentShift(new Date()));
  const [department, setDepartment] = useState("");
  const [startColumn, setStartColumn] = useState<number>(3);
  const [endColumn, setEndColumn] = useState<number>(5);
  const [startHour, setStartHour] = useState("08");
  const [startMinute, setStartMinute] = useState("00");
  const [endHour, setEndHour] = useState("09");
  const [endMinute, setEndMinute] = useState("00");

  const startTime = `${startHour || "00"}:${startMinute || "00"}`;
  const endTime = `${endHour || "00"}:${endMinute || "00"}`;
  const [weight, setWeight] = useState<number>(5);
  const [priority, setPriority] = useState<PriorityType>("P3");
  const [remarks, setRemarks] = useState("");
  const [mandatoryCrane, setMandatoryCrane] = useState<string>("Any");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const forcedShift = getForcedShiftForWindow(currentTime);
    if (forcedShift) {
      setShift(forcedShift);
    } else if (currentSubView === "logboards") {
      setShift(getCurrentShift(currentTime));
    }
  }, [currentTime, currentSubView]);

  const handleOpenForm = (areaNum: number) => {
    setSelectedFormArea(areaNum);
    // Auto preset column range based on area range
    if (areaNum === 1) {
      setStartColumn(3);
      setEndColumn(5);
    }
    if (areaNum === 2) {
      setStartColumn(13);
      setEndColumn(15);
    }
    if (areaNum === 3) {
      setStartColumn(23);
      setEndColumn(25);
    }
    setFormError("");
    setCurrentSubView("new-request");
  };

  const handleAddOperationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!isWindowOpen) {
      setFormError("Form closed. Outside the 10-minute shift transition window.");
      return;
    }

    const sCol = Math.min(startColumn, endColumn);
    const eCol = Math.max(startColumn, endColumn);

    // Validate Columns limits
    if (selectedFormArea === 1 && (sCol < 1 || eCol > 10)) {
      setFormError("Area 1 operations must occur entirely between Columns 1 and 10.");
      return;
    }
    if (selectedFormArea === 2 && (sCol < 11 || eCol > 20)) {
      setFormError("Area 2 operations must occur entirely between Columns 11 and 20.");
      return;
    }
    if (selectedFormArea === 3 && (sCol < 21 || eCol > 30)) {
      setFormError("Area 3 operations must occur entirely between Columns 21 and 30.");
      return;
    }

    // Validate weight limit
    if (weight <= 0) {
      setFormError("Weight must be greater than 0 tons.");
      return;
    }

    // Validate times
    const startMins = parseTimeToMins(startTime);
    const endMins = parseTimeToMins(endTime);
    if (endMins <= startMins) {
      setFormError("Estimated End Time must be strictly after Start Time.");
      return;
    }

    if (!department.trim()) {
      setFormError("Department field is required.");
      return;
    }

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("crane_token")}`,
        },
        body: JSON.stringify({
          area: selectedFormArea,
          bay: bay.toUpperCase(),
          shift,
          department,
          column: Math.round((sCol + eCol) / 2),
          startColumn: sCol,
          endColumn: eCol,
          estimatedStartTime: startTime,
          estimatedEndTime: endTime,
          estimatedWeight: weight,
          priority,
          remarks,
          mandatoryCrane,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create crane request.");
      }

      onRequestAdded(data);
      // Reset form
      setDepartment("");
      setRemarks("");
      setMandatoryCrane("Any");
      setFormError("");
      setCurrentSubView("logboards");
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const parseTimeToMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const isEditable = (areaNum: number) => {
    // Admin can edit everything. Area users can only edit their own area.
    if (user.role === "Admin") return true;
    return user.area === areaNum;
  };

  const areas = [1, 2, 3];
  const bays = ["A", "B", "C", "D", "E", "F", "G"];

  return (
    <div id="supervisor_dashboard" className="space-y-8 font-sans">
      
      {/* Title & Top Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b-2 border-[#141414] pb-4 gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-amber-500 border border-[#141414]"></span>
            Supervisor Requirements Log & Submission Workflow
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-1 font-bold uppercase">
            Station Console: {user.name} ({user.role === "Admin" ? "Full Access Override" : `Area ${user.area} Supervisor`})
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Main Subview Navigation Toggles */}
          <button
            onClick={() => setCurrentSubView("logboards")}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
              currentSubView === "logboards"
                ? "bg-[#141414] text-white"
                : "bg-white text-[#141414] hover:bg-zinc-50"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Area Logboards
          </button>
          
          <button
            onClick={() => {
              setSelectedFormArea(user.role === "Admin" ? 1 : Number(user.area || 1));
              setFormError("");
              setCurrentSubView("new-request");
            }}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
              currentSubView === "new-request"
                ? "bg-amber-500 text-slate-950"
                : "bg-white text-[#141414] hover:bg-zinc-50"
            }`}
          >
            <Plus className="w-4 h-4" />
            New Requirement Form
          </button>

          <button
            onClick={() => {
              setCurrentSubView("cranes");
            }}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
              currentSubView === "cranes"
                ? "bg-sky-500 text-slate-950"
                : "bg-white text-[#141414] hover:bg-zinc-50"
            }`}
          >
            <Cpu className="w-4 h-4" />
            Manage Cranes
          </button>
        </div>
      </div>

      {/* Lockout Control System Simulation Banner */}
      <div className="bg-zinc-50 border-4 border-[#141414] p-5 rounded-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 shadow-[6px_6px_0px_#141414] relative overflow-hidden industrial-grid">
        
        {/* Section 1: Lockout & Dynamic Clock (Tamper-proof Colons) */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 border-2 border-[#141414] rounded-sm shadow-[2px_2px_0px_#141414] flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-800" />
          </div>
          <div className="space-y-1.5">
            <div className="text-xs font-black uppercase text-[#141414] flex flex-wrap items-center gap-2">
              Lockout Control
              <span className={`inline-block w-2 h-2 rounded-full ${checkIsWithinWindow(currentTime) ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
            </div>
            
            {/* Tamper-Proof Digital LED Clock Display */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 bg-[#141414] text-amber-500 border-2 border-amber-600 px-2.5 py-1 rounded-sm font-bold font-mono text-xs select-none shadow-[2px_2px_0px_rgba(0,0,0,0.15)] uppercase tracking-wide">
                <span>{hoursStr}</span>
                <span className="animate-pulse text-amber-400 font-black" style={{ userSelect: "none" }}>:</span>
                <span>{minutesStr}</span>
                <span className="animate-pulse text-amber-400 font-black" style={{ userSelect: "none" }}>:</span>
                <span>{secondsStr}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Handover Periods (Beside Section 1) */}
        <div className="border-l-0 lg:border-l-2 border-zinc-200 pl-0 lg:pl-5 space-y-1.5">
          <div className="text-[10px] font-black uppercase text-zinc-500 font-mono tracking-wider">
            HANDOVER WINDOWS
          </div>
          <div className="grid grid-cols-2 gap-1 text-[9px] font-mono font-bold">
            <div className={`px-1.5 py-0.5 rounded-sm border ${currentTime.getHours() === 6 ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-black" : "bg-white border-zinc-200 text-zinc-500"}`}>🌅 06:00-06:10</div>
            <div className={`px-1.5 py-0.5 rounded-sm border ${currentTime.getHours() === 9 ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-black" : "bg-white border-zinc-200 text-zinc-500"}`}>☀️ 09:00-09:10</div>
            <div className={`px-1.5 py-0.5 rounded-sm border ${currentTime.getHours() === 14 ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-black" : "bg-white border-zinc-200 text-zinc-500"}`}>🌆 14:00-14:10</div>
            <div className={`px-1.5 py-0.5 rounded-sm border ${currentTime.getHours() === 21 ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-black" : "bg-white border-zinc-200 text-zinc-500"}`}>🌃 21:00-21:10</div>
            <div className={`px-1.5 py-0.5 rounded-sm border ${currentTime.getHours() === 22 ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-black" : "bg-white border-zinc-200 text-zinc-500"}`}>🌌 22:00-22:10</div>
          </div>
        </div>

        {/* Section 3: Lockout Status & Countdown Controller (Beside Section 2) */}
        <div className="border-l-0 lg:border-l-2 border-zinc-200 pl-0 lg:pl-5 space-y-1.5">
          <div className="text-[10px] font-black uppercase text-zinc-500 font-mono tracking-wider">
            SECURITY SYSTEM STATUS
          </div>
          <div className="bg-white border-2 border-[#141414] px-2.5 py-1.5 rounded-sm shadow-[2px_2px_0px_#141414] flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isWindowOpen ? "bg-emerald-500 animate-pulse" : "bg-red-500 animate-ping"}`}></span>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase text-zinc-900 leading-none">
                {bypassWindow ? "OVERRIDDEN" : statusDetails.label}
              </div>
              <div className="text-[9px] font-mono font-bold text-zinc-500 mt-1 leading-none select-none">
                {bypassWindow ? "Bypass Active" : statusDetails.text}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Dev Override Control (Right-most) */}
        <div className="border-l-0 lg:border-l-2 border-zinc-200 pl-0 lg:pl-5 flex items-center justify-start lg:justify-end">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs font-black uppercase font-mono bg-white px-3 py-2 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414] hover:bg-zinc-50 select-none transition-all active:translate-y-[1px] active:shadow-[2px_2px_0px_#141414] w-full lg:w-auto">
            <input
              type="checkbox"
              checked={bypassWindow}
              onChange={(e) => handleToggleBypass(e.target.checked)}
              className="accent-[#141414] w-4 h-4 cursor-pointer flex-shrink-0"
            />
            <span className="truncate">Bypass Lockout (Dev Override)</span>
          </label>
        </div>
        
      </div>

      {/* SUB-VIEW 1: Logboards Layout */}
      {currentSubView === "logboards" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {areas.map((areaNum) => {
            const currentActiveShift = getCurrentShift(currentTime);
            const areaReqs = requests.filter((r) => r.area === areaNum && r.status !== "Completed" && r.shift === currentActiveShift);
            const drafts = areaReqs.filter((r) => r.status === "Draft");
            const submitted = areaReqs.filter((r) => r.status === "Submitted");
            const scheduled = areaReqs.filter((r) => r.status === "Scheduled");
            const hasDrafts = drafts.length > 0;
            const allowed = isEditable(areaNum);

            return (
              <div
                key={areaNum}
                className={`bg-white rounded-sm border-2 p-5 flex flex-col justify-between transition-all ${
                  allowed
                    ? "border-[#141414] shadow-[4px_4px_0px_#141414]"
                    : "border-zinc-300 bg-zinc-50/50 opacity-90 shadow-none"
                }`}
              >
                <div>
                  {/* Panel Header */}
                  <div className="flex items-center justify-between border-b-2 border-zinc-200 pb-3 mb-4">
                    <div>
                      <h3 className="font-black text-[#141414] text-xs uppercase tracking-tight flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${allowed ? "bg-[#141414]" : "bg-zinc-400"}`}></span>
                        Area {areaNum} Panel (Cols {areaNum === 1 ? "1-10" : areaNum === 2 ? "11-20" : "21-30"})
                      </h3>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5 font-bold">
                        {drafts.length} Drafts | {submitted.length} Sent | {scheduled.length} Active
                      </div>
                    </div>

                    {!allowed && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-200 border border-zinc-400 text-zinc-700 rounded-sm text-[9px] font-mono uppercase font-black">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>

                  {/* Operations Table */}
                  <div className="space-y-3 mb-5 max-h-[300px] overflow-y-auto pr-1">
                    {areaReqs.length === 0 ? (
                      <div className="py-12 border-2 border-dashed border-zinc-300 rounded-sm text-center text-zinc-400 text-xs bg-zinc-50">
                        <FileSpreadsheet className="w-6 h-6 mx-auto mb-1.5 text-zinc-400" />
                        No requirements logged yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {areaReqs.map((req) => (
                          <div
                            key={req.id}
                            className={`p-3 rounded-sm border-2 text-xs font-mono flex flex-col gap-1.5 relative ${
                              req.status === "Draft"
                                ? "bg-amber-50/50 border-amber-400 text-amber-950 font-bold"
                                : req.status === "Submitted"
                                ? "bg-zinc-50 border-zinc-400 text-zinc-700 font-semibold"
                                : "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-black text-[#141414]">{req.id} {req.bay ? `(Bay ${req.bay})` : ""}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase border ${
                                  req.status === "Draft"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : req.status === "Submitted"
                                    ? "bg-zinc-200 text-zinc-800 border-zinc-400"
                                    : req.status === "Scheduled"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : "bg-red-100 text-red-800 border-red-200"
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-bold">
                              <div>Dept: <span className="text-zinc-900 font-sans font-bold">{req.department}</span></div>
                              <div>Cols: <span className="font-black text-[#141414]">{req.startColumn !== undefined && req.endColumn !== undefined ? `${req.startColumn}-${req.endColumn}` : req.column}</span></div>
                              <div>Shift: <span className="text-zinc-800">{req.shift}</span></div>
                              <div>Time: <span className="text-zinc-900 font-black">{req.estimatedStartTime}-{req.estimatedEndTime}</span></div>
                              <div>Load: <span className="text-zinc-900 font-black">{req.estimatedWeight} Ton</span></div>
                              <div>Gantry: <span className="text-amber-800 font-black">{req.mandatoryCrane}</span></div>
                            </div>

                            {req.remarks && (
                              <div className="text-[10px] text-zinc-600 italic mt-0.5 border-t border-zinc-200 pt-1 font-sans font-bold">
                                "{req.remarks}"
                              </div>
                            )}

                            {/* Row Deletion Action */}
                            {req.status === "Draft" && allowed && (
                              <button
                                onClick={() => onRequestDeleted(req.id)}
                                className="absolute top-2 right-2 text-zinc-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                                title="Delete Draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Panel Actions / Triggers */}
                <div className="space-y-3">
                  {allowed && (
                    <>
                      {!isWindowOpen ? (
                        <div className="p-3.5 bg-amber-50 border-2 border-[#141414] rounded-sm text-zinc-900 font-mono text-[11px] font-bold space-y-2 shadow-[2px_2px_0px_#141414]">
                          <div className="flex items-center gap-1.5 text-amber-800 font-black uppercase text-xs">
                            <Lock className="w-4 h-4 flex-shrink-0" />
                            Form Closed
                          </div>
                          <p className="font-sans text-xs font-semibold leading-relaxed">
                            Crane requirements entry is locked. Logs and submissions are restricted to the handover windows:
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-white p-2 border border-zinc-300 rounded-sm">
                            <div className="font-bold text-zinc-700">🌅 Shift A: 06:00-06:10</div>
                            <div className="font-bold text-zinc-700">☀️ Gen Shift: 09:00-09:10</div>
                            <div className="font-bold text-zinc-700">🌆 Shift B: 14:00-14:10</div>
                            <div className="font-bold text-zinc-700">🌃 Gen Night: 21:00-21:10</div>
                            <div className="font-bold text-zinc-700">🌌 Shift C: 22:00-22:10</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenForm(areaNum)}
                            className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] shadow-[3px_3px_0px_#141414] text-xs font-black rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-y-[2px] active:shadow-[1px_1px_0px_#141414]"
                          >
                            <Plus className="w-4 h-4" />
                            Add Operation to Area {areaNum}
                          </button>

                          {hasDrafts && (
                            <button
                              onClick={() => onRequestSubmittedBulk(areaNum)}
                              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-[#141414] border-2 border-[#141414] shadow-[3px_3px_0px_#141414] text-xs font-black rounded-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer uppercase tracking-wider active:translate-y-[2px] active:shadow-[1px_1px_0px_#141414]"
                            >
                              <Send className="w-3.5 h-3.5" />
                              SUBMIT ALL REQUESTS ({drafts.length})
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {!allowed && (
                    <div className="p-3 bg-zinc-100 border-2 border-dashed border-zinc-300 rounded-sm text-zinc-500 text-center text-[10px] flex items-center justify-center gap-1.5 font-bold font-mono">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>View-Only: Assigned to Area {areaNum} supervisor.</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-VIEW 2: Dedicated Full-Page Form Submission */}
      {currentSubView === "new-request" && (
        <div className="max-w-3xl mx-auto bg-white border-4 border-[#141414] p-8 shadow-[6px_6px_0px_#141414] relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-2 bg-amber-500"></div>

          <div className="border-b-2 border-zinc-200 pb-4 mb-6">
            <h3 className="text-md font-black uppercase tracking-tight text-[#141414] flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              Register New Crane Operation Requirement
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-1 font-bold">
              Complete all fields to queue draft. It will appear on your Area Logboard to review and bulk submit.
            </p>
          </div>

          {!isWindowOpen ? (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-sm text-red-950 font-mono text-xs font-bold space-y-3 mb-6">
              <div className="flex items-center gap-1.5 text-red-700 font-black uppercase">
                <Lock className="w-5 h-5" />
                Submission Lockout Engaged
              </div>
              <p className="font-sans font-semibold">
                Requirements entry forms are completely closed outside the 10-minute shift handover windows. You can use the Dev Override checkbox in the header banner to bypass this lockout.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAddOperationSubmit} className="space-y-6 font-sans text-xs font-bold">
              
              {formError && (
                <div className="p-3 bg-red-50 border-2 border-red-500 text-red-950 rounded-sm flex items-center gap-2 font-bold font-mono text-xs">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Area Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Bay Selector (Critical 7 Bay Requirement) */}
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Target Bay Runway</label>
                  <select
                    value={bay}
                    onChange={(e) => setBay(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black uppercase font-mono"
                  >
                    {bays.map((b) => (
                      <option key={b} value={b}>Bay {b}</option>
                    ))}
                  </select>
                </div>

                {/* Area Selector */}
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Shop Floor Area</label>
                  <select
                    disabled={user.role !== "Admin"}
                    value={selectedFormArea}
                    onChange={(e) => {
                      const areaNum = Number(e.target.value);
                      setSelectedFormArea(areaNum);
                      if (areaNum === 1) { setStartColumn(3); setEndColumn(5); }
                      if (areaNum === 2) { setStartColumn(13); setEndColumn(15); }
                      if (areaNum === 3) { setStartColumn(23); setEndColumn(25); }
                    }}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
                  >
                    <option value={1}>Area 1 (Cols 1-10)</option>
                    <option value={2}>Area 2 (Cols 11-20)</option>
                    <option value={3}>Area 3 (Cols 21-30)</option>
                  </select>
                  {user.role !== "Admin" && (
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono font-semibold">Locked to your assigned supervisor Area {user.area}.</p>
                  )}
                </div>

                {/* Shift Selector */}
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Working Shift</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as ShiftType)}
                    disabled={!!getForcedShiftForWindow(currentTime)}
                    className={`w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black ${getForcedShiftForWindow(currentTime) ? 'opacity-70 bg-zinc-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="Shift A">Shift A (06:00-14:00)</option>
                    <option value="Shift B">Shift B (14:00-22:00)</option>
                    <option value="Shift C">Shift C (22:00-06:00)</option>
                    <option value="General Shift">General Shift (09:00-18:30)</option>
                  </select>
                  {getForcedShiftForWindow(currentTime) && (
                    <p className="text-[10px] text-amber-600 mt-1.5 font-mono font-bold">⚠️ Locked to {getForcedShiftForWindow(currentTime)} during handover window.</p>
                  )}
                </div>
              </div>

              {/* Department and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Department / Cost Center Costing</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mechanical Machining Shop"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Operations Priority Rating</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityType)}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
                  >
                    <option value="P1">P1 Critical </option>
                    <option value="P2">P2 Urgent</option>
                    <option value="P3">P3 Normal</option>
                    <option value="P4">P4 Planned</option>
                  </select>
                </div>
              </div>

              {/* Columns and Weight Limits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Start Runway Column (1-30)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    value={startColumn}
                    onChange={(e) => setStartColumn(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm font-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">End Runway Column (1-30)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    value={endColumn}
                    onChange={(e) => setEndColumn(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm font-black font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Max Weight Load (Tons)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm font-black font-mono"
                  />
                </div>
              </div>

              {/* Time Span Windows and Preferred Crane */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Estimated Start (HH:MM)</label>
                  <div className="flex items-center justify-between bg-white border-2 border-[#141414] rounded-sm p-1 shadow-[2px_2px_0px_#141414]">
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="HH"
                      value={startHour}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val === "" || (Number(val) >= 0 && Number(val) <= 23)) {
                          setStartHour(val);
                        }
                      }}
                      onBlur={() => {
                        if (startHour && startHour.length === 1) {
                          setStartHour("0" + startHour);
                        }
                      }}
                      className="w-full text-center font-black font-mono text-xs text-zinc-900 border-0 outline-none focus:outline-none focus:ring-0 bg-transparent p-1.5"
                    />
                    <span className="font-black text-[#141414] text-sm select-none px-1" style={{ userSelect: "none" }}>:</span>
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="MM"
                      value={startMinute}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val === "" || (Number(val) >= 0 && Number(val) <= 59)) {
                          setStartMinute(val);
                        }
                      }}
                      onBlur={() => {
                        if (startMinute && startMinute.length === 1) {
                          setStartMinute("0" + startMinute);
                        }
                      }}
                      className="w-full text-center font-black font-mono text-xs text-zinc-900 border-0 outline-none focus:outline-none focus:ring-0 bg-transparent p-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Estimated End (HH:MM)</label>
                  <div className="flex items-center justify-between bg-white border-2 border-[#141414] rounded-sm p-1 shadow-[2px_2px_0px_#141414]">
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="HH"
                      value={endHour}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val === "" || (Number(val) >= 0 && Number(val) <= 23)) {
                          setEndHour(val);
                        }
                      }}
                      onBlur={() => {
                        if (endHour && endHour.length === 1) {
                          setEndHour("0" + endHour);
                        }
                      }}
                      className="w-full text-center font-black font-mono text-xs text-zinc-900 border-0 outline-none focus:outline-none focus:ring-0 bg-transparent p-1.5"
                    />
                    <span className="font-black text-[#141414] text-sm select-none px-1" style={{ userSelect: "none" }}>:</span>
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="MM"
                      value={endMinute}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val === "" || (Number(val) >= 0 && Number(val) <= 59)) {
                          setEndMinute(val);
                        }
                      }}
                      onBlur={() => {
                        if (endMinute && endMinute.length === 1) {
                          setEndMinute("0" + endMinute);
                        }
                      }}
                      className="w-full text-center font-black font-mono text-xs text-zinc-900 border-0 outline-none focus:outline-none focus:ring-0 bg-transparent p-1.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Preferred Crane Pinned Asset</label>
                  <select
                    value={mandatoryCrane}
                    onChange={(e) => setMandatoryCrane(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-[#141414] rounded-sm text-amber-800 font-black"
                  >
                    <option value="Any">Any Available Gantry</option>
                    {cranes.filter(c => c.id.toUpperCase().startsWith(bay.toUpperCase())).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || `Crane ${c.id}`} ({c.id}) Only
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remarks Box */}
              <div>
                <label className="block text-[10px] uppercase font-mono font-black text-zinc-500 mb-1.5">Special Instruction Notes / Hoisting Objectives</label>
                <textarea
                  placeholder="e.g., Relocate stamping die B4 from columns 4 to 8. Safe gantry buffer cleared."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-[#141414] rounded-sm font-sans font-medium h-24 text-zinc-800"
                />
              </div>

              {/* Form Submit buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t-2 border-zinc-100 font-sans">
                <button
                  type="button"
                  onClick={() => setCurrentSubView("logboards")}
                  className="px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-zinc-400 font-black rounded-sm uppercase cursor-pointer"
                >
                  Back to Logboards
                </button>
                
                <button
                  type="submit"
                  className="px-8 py-2.5 bg-[#141414] hover:bg-zinc-800 text-white border-4 border-[#141414] shadow-[4px_4px_0px_#141414] font-black rounded-sm uppercase tracking-wider cursor-pointer active:translate-y-[2px] active:shadow-[2px_2px_0px_#141414]"
                >
                  Create Draft Requirement
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {currentSubView === "cranes" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b-2 border-[#141414] pb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-600" />
                Active Crane Gantry Fleet & Resource Administration
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5 font-bold uppercase">
                Configure physical limits, hoisting capacities, and real-time statuses
              </p>
            </div>
            <button
              onClick={() => setShowAddCrane(!showAddCrane)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-slate-950 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black uppercase tracking-wide text-xs rounded-sm transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto font-mono"
            >
              <Plus className="w-4 h-4" />
              {showAddCrane ? "Hide Form" : "Register New Crane"}
            </button>
          </div>

          {craneError && (
            <div className="p-3 bg-red-100 border-2 border-red-500 text-red-950 rounded-sm font-mono text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{craneError}</span>
            </div>
          )}

          {/* Create Crane Form */}
          {showAddCrane && (
            <div className="bg-zinc-50 border-4 border-[#141414] p-6 rounded-sm shadow-[6px_6px_0px_#141414] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-sky-500"></div>
              <h4 className="text-xs font-black uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2 flex items-center gap-1.5 font-mono">
                <Hammer className="w-4 h-4 text-zinc-600" />
                Register New Crane Asset
              </h4>
              <form onSubmit={handleCreateCraneSubmit} className="space-y-4 font-mono text-xs font-bold">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      placeholder="None (Leave empty if no Aux Hoist)"
                      value={addCraneAuxCap}
                      onChange={(e) => setAddCraneAuxCap(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Current Column Position</label>
                    <input
                      type="number"
                      value={addCraneCol}
                      onChange={(e) => setAddCraneCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Min Column</label>
                    <input
                      type="number"
                      value={addCraneAllocatedMin}
                      onChange={(e) => setAddCraneAllocatedMin(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Max Column</label>
                    <input
                      type="number"
                      value={addCraneAllocatedMax}
                      onChange={(e) => setAddCraneAllocatedMax(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 font-sans">
                  <button
                    type="button"
                    onClick={() => setShowAddCrane(false)}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm text-zinc-700 text-xs font-bold font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white rounded-sm font-black text-xs uppercase"
                  >
                    Register Asset
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Cranes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cranes.map((crane) => (
              <div key={crane.id} className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4 relative overflow-hidden">
                <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-2">
                  <h3 className="font-black text-[#141414] text-xs uppercase tracking-tight font-mono">
                    {crane.name || `Crane ${crane.id}`} ({crane.id})
                  </h3>
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

                    <div className="grid grid-cols-2 gap-2">
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
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Aux Cap (T, Optional)</label>
                        <input
                          type="number"
                          placeholder="None"
                          value={craneAuxCap}
                          onChange={(e) => setCraneAuxCap(e.target.value)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Current Col</label>
                        <input
                          type="number"
                          value={craneCol}
                          onChange={(e) => setCraneCol(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Status</label>
                        <select
                          value={craneStatus}
                          onChange={(e) => setCraneStatus(e.target.value as any)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        >
                          <option value="Available">Available</option>
                          <option value="Busy">Busy</option>
                          <option value="Maintenance">Maintenance</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Min</label>
                        <input
                          type="number"
                          value={craneMinCol}
                          onChange={(e) => setCraneMinCol(Number(e.target.value))}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Max</label>
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
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Min</label>
                        <input
                          type="number"
                          value={craneAllocMin !== undefined ? craneAllocMin : ""}
                          onChange={(e) => setCraneAllocMin(e.target.value !== "" ? Number(e.target.value) : undefined)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Max</label>
                        <input
                          type="number"
                          value={craneAllocMax !== undefined ? craneAllocMax : ""}
                          onChange={(e) => setCraneAllocMax(e.target.value !== "" ? Number(e.target.value) : undefined)}
                          className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Maintenance Log notes</label>
                      <textarea
                        value={craneNotes}
                        onChange={(e) => setCraneNotes(e.target.value)}
                        placeholder="e.g. Scheduled cable safety check"
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
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Crane Details */
                  <div className="space-y-3 font-mono text-xs text-zinc-700 font-bold">
                    <div className="flex justify-between">
                      <span>Hoist Configuration:</span>
                      <span className="font-black text-[#141414]">
                        {crane.auxCapacity ? `Main: ${crane.capacity}T / Aux: ${crane.auxCapacity}T` : `${crane.capacity}T Single`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Position Status:</span>
                      <span className="font-black text-[#141414]">Column {crane.currentColumn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Physical limits:</span>
                      <span className="text-[#141414]">Cols {crane.minColumn}-{crane.maxColumn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Allocated Bounds:</span>
                      <span className="text-[#141414]">
                        Cols {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : 1}-
                        {crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : 30}
                      </span>
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
                        Modify Parameters
                      </button>
                      <button
                        onClick={() => {
                          if (onDeleteCrane && window.confirm(`Are you sure you want to permanently delete Crane ${crane.name || crane.id} (${crane.id})?`)) {
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
    </div>
  );
}
