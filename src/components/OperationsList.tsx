import React, { useState, useMemo } from "react";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Layers, 
  HardHat, 
  CalendarDays, 
  Info, 
  X, 
  ArrowRight,
  ShieldCheck,
  Ban,
  Tag,
  Wrench,
  Construction,
  Download,
  History,
  Zap,
  Hammer
} from "lucide-react";
import { Schedule, CraneRequest, PriorityType, ShiftType, Crane } from "../types";
import { isScheduleInShiftBoundary, getAreasForBay, getColumnsForArea, formatTimeTo12Hr, getBayForArea, getBayForCrane } from "../utils/shiftUtils";
import { generateDateWisePDF, generateCraneWorkingHoursPDF } from "../utils/pdfGenerator";

interface OperationsListProps {
  cranes: Crane[];
  schedules: Schedule[];
  requests: CraneRequest[];
  selectedShift: string;
  setSelectedShift: (val: string) => void;
  selectedCraneFilter: string;
  setSelectedCraneFilter: (val: string) => void;
  selectedAreaFilter: string;
  setSelectedAreaFilter: (val: string) => void;
  selectedBay: string;
  user?: any;
  onCancelSchedule?: (id: string) => void;
  onInstantSchedule?: (formData: any) => Promise<{ success: boolean; data?: any; error?: string }>;
}


export default function OperationsList({ 
  cranes,
  schedules, 
  requests,
  selectedShift,
  setSelectedShift,
  selectedCraneFilter,
  setSelectedCraneFilter,
  selectedAreaFilter,
  setSelectedAreaFilter,
  selectedBay,
  user,
  onCancelSchedule,
  onInstantSchedule
}: OperationsListProps) {
  const getCraneDisplayDetails = (cid: string) => {
    if (cid === "Any") {
      return {
        name: "General / Unspecified",
        capacity: "Any Crane",
        range: "Plant Wide",
        color: "border-zinc-500 text-zinc-700",
        bg: "bg-zinc-100"
      };
    }

    const found = cranes.find(c => c.id.toUpperCase() === cid.toUpperCase());
    const isHeavy = found ? found.capacity >= 50 : (cid.endsWith("1") || cid.toUpperCase() === "D4");
    const isMedium = found ? (found.capacity >= 20 && found.capacity < 50) : cid.endsWith("2");
    
    let capStr = "";
    if (found) {
      if (found.auxCapacity) {
        capStr = `Main: ${found.capacity}T / Aux: ${found.auxCapacity}T`;
      } else {
        capStr = `${found.capacity} Tons`;
      }
    } else {
      if (cid.toUpperCase() === "D4") {
        capStr = "Main: 63T / Aux: 10T";
      } else if (cid.toUpperCase() === "A1") {
        capStr = "10 Tons (Light Utility)";
      } else if (cid.toUpperCase() === "A2") {
        capStr = "25 Tons (Medium Duty)";
      } else if (cid.toUpperCase() === "A3") {
        capStr = "10 Tons (Light Utility)";
      } else {
        capStr = "10 Tons";
      }
    }
    
    let rangeStr = found 
      ? `Cols ${found.allocatedMinColumn !== undefined ? found.allocatedMinColumn : (found.minColumn || 1)} - ${found.allocatedMaxColumn !== undefined ? found.allocatedMaxColumn : (found.maxColumn || 30)}`
      : (cid.toUpperCase() === "A1" ? "Bay Cols 1 - 10" : cid.toUpperCase() === "A2" ? "Bay Cols 11 - 20" : "Bay Cols 21 - 30");
    
    return {
      name: found ? found.name : `Gantry ${cid}`,
      capacity: capStr,
      range: rangeStr,
      color: isHeavy ? "border-red-500 text-red-700" : isMedium ? "border-amber-500 text-amber-700" : "border-blue-500 text-blue-700",
      bg: isHeavy ? "bg-red-50" : isMedium ? "bg-amber-50" : "bg-blue-50"
    };
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"scheduled" | "conflicts" | "history">("scheduled");
  const [isInstantModalOpen, setIsInstantModalOpen] = useState(false);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  // Instant Scheduling form state
  const [instantShift, setInstantShift] = useState<string>("Shift A");
  const [instantArea, setInstantArea] = useState<number>(1);
  const [instantBay, setInstantBay] = useState<string>("A");
  const [instantDept, setInstantDept] = useState<string>("Assembly Operations");
  const [instantCol, setInstantCol] = useState<number>(15);
  const [instantStartCol, setInstantStartCol] = useState<number>(10);
  const [instantEndCol, setInstantEndCol] = useState<number>(20);
  const [startHour, setStartHour] = useState("08");
  const [startMinute, setStartMinute] = useState("00");
  const [startAmpm, setStartAmpm] = useState("AM");

  const [endHour, setEndHour] = useState("10");
  const [endMinute, setEndMinute] = useState("00");
  const [endAmpm, setEndAmpm] = useState("AM");

  const convert12HrTo24Hr = (time12: string): string => {
    const match = time12.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) return time12;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const [instantWeight, setInstantWeight] = useState<number>(5);
  const [instantPriority, setInstantPriority] = useState<PriorityType>("P3");
  const [instantCrane, setInstantCrane] = useState<string>("");
  const [instantRemarks, setInstantRemarks] = useState<string>("");
  const [instantError, setInstantError] = useState<string>("");
  const [isInstantSubmitting, setIsInstantSubmitting] = useState(false);

  const [historyStartDate, setHistoryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to 30 days ago
    return d.toISOString().split("T")[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]; // Default to today
  });
  const [historyShiftFilter, setHistoryShiftFilter] = useState<string>("ALL");

  // Helper to parse HH:MM to numerical minutes for sorting
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Helper to calculate request duration in minutes
  const getRequestDurationMinutes = (start: string, end: string): number => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    return endMins >= startMins ? (endMins - startMins) : (1440 - startMins + endMins);
  };

  // Helper to check if a request violates crane capacity or shift duration limits
  const getRequestExclusionReason = (req: CraneRequest): string | null => {
    // 1. Check shift duration limit (8 hours / 480 minutes, or 9.5 hours / 570 minutes for General Shift)
    const duration = getRequestDurationMinutes(req.estimatedStartTime, req.estimatedEndTime);
    const maxMins = req.shift === "General Shift" ? 570 : 480;
    const maxHours = req.shift === "General Shift" ? "9.5" : "8";
    if (duration > maxMins) {
      return `Duration of requested timeline (${Math.round((duration / 60) * 10) / 10} hours) exceeds the maximum shift duration limit of ${maxHours} hours.`;
    }

    // 2. Check if requested times fall within shift operating hours
    if (!isScheduleInShiftBoundary(req.estimatedStartTime, req.estimatedEndTime, req.shift)) {
      return `Requested times (${req.estimatedStartTime}–${req.estimatedEndTime}) fall outside the operating hours of ${req.shift}.`;
    }

    // 3. Check estimated weight against crane capacity
    const getCraneCapacity = (id: string): number => {
      if (id === "Any") {
        if (cranes && cranes.length > 0) {
          return Math.max(...cranes.map(c => c.capacity));
        }
        return 25; // default max
      }
      const matched = cranes?.find(c => c.id.toUpperCase() === id.toUpperCase());
      if (matched) return matched.capacity;
      if (id.endsWith("2")) return 25;
      return 10;
    };
    const weight = req.estimatedWeight;
    const mandatory = req.mandatoryCrane || "Any";

    if (mandatory !== "Any") {
      const cap = getCraneCapacity(mandatory);
      if (weight > cap) {
        return `Requested weight (${weight} Tons) exceeds the capacity of selected crane ${mandatory} (${cap} Tons).`;
      }
    } else {
      const maxCap = getCraneCapacity("Any");
      if (weight > maxCap) {
        return `Requested weight (${weight} Tons) exceeds the maximum capacity of any gantry crane on the shop floor (${maxCap} Tons).`;
      }
    }

    return null;
  };

  // 1. Process "Scheduled" work to be done when
  const scheduledOperations = useMemo(() => {
    return schedules.map((sched) => {
      const origReq = requests.find((r) => r.id === sched.requestId);
      const shift = origReq?.shift || "General Shift";
      const status = origReq?.status || "Scheduled";

      return {
        ...sched,
        shift,
        status,
        origReq,
      };
    }).filter((sched) => {
      // Filter out completed ones, and those outside shift boundaries
      if (sched.status === "Completed") return false;
      if (!isScheduleInShiftBoundary(sched.startTime, sched.endTime, sched.shift)) return false;
      
      // Filter out if request has limit violations!
      if (sched.origReq && getRequestExclusionReason(sched.origReq) !== null) {
        return false;
      }

      // Only store/show current day's scheduled operations
      const todayStr = new Date().toISOString().split("T")[0];
      const schedDate = sched.origReq?.date || (sched.origReq?.createdAt ? sched.origReq.createdAt.split("T")[0] : todayStr);
      if (schedDate !== todayStr) return false;

      return true;
    }).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [schedules, requests]);

  // 2. Process "Not Possible / Conflicts / Deferred" work
  const conflictingOperations = useMemo(() => {
    return requests.filter((req) => {
      // Only store/show current day's conflicts
      const todayStr = new Date().toISOString().split("T")[0];
      const reqDate = req.date || (req.createdAt ? req.createdAt.split("T")[0] : todayStr);
      if (reqDate !== todayStr) return false;

      // ONLY put those processes here which are not possible according to the slots / capacities / limits mentioned
      return getRequestExclusionReason(req) !== null;
    }).sort((a, b) => timeToMinutes(a.estimatedStartTime) - timeToMinutes(b.estimatedStartTime));
  }, [requests]);


  // 3. Process completed historical schedules
  const completedOperations = useMemo(() => {
    return requests.filter((req) => req.status === "Completed")
      .map((req) => {
        const sched = schedules.find((s) => s.requestId === req.id);
        return {
          id: req.id,
          requestId: req.id,
          shift: req.shift,
          priority: req.priority,
          department: req.department,
          assignedCrane: sched?.assignedCrane || req.mandatoryCrane || "A1",
          column: req.column,
          startColumn: req.startColumn,
          endColumn: req.endColumn,
          startTime: sched?.startTime || req.estimatedStartTime,
          endTime: sched?.endTime || req.estimatedEndTime,
          travelTimeMinutes: sched?.travelTimeMinutes || 0,
          bufferTimeMinutes: sched?.bufferTimeMinutes || 0,
          remarks: req.remarks,
          details: req.details,
          weight: req.estimatedWeight,
          createdAt: req.createdAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [requests, schedules]);



  // Filters application for scheduled operations
  const filteredScheduled = useMemo(() => {
    return scheduledOperations.filter((op) => {
      const matchesSearch = 
        op.requestId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.remarks || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.origReq?.details || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesShift = selectedShift === "ALL" || op.shift === selectedShift;
      const matchesPriority = selectedPriority === "ALL" || op.priority === selectedPriority;
      
      // Crane filter: matches assignedCrane OR secondaryCrane (for tandem lifts)
      const matchesCrane = selectedCraneFilter === "ALL" || 
        op.assignedCrane === selectedCraneFilter || 
        op.secondaryCrane === selectedCraneFilter;

      // Area filter: matches area
      const matchesArea = selectedAreaFilter === "ALL" || op.area?.toString() === selectedAreaFilter;

      return matchesSearch && matchesShift && matchesPriority && matchesCrane && matchesArea;
    });
  }, [scheduledOperations, searchTerm, selectedShift, selectedPriority, selectedCraneFilter, selectedAreaFilter]);

  // Filters application for conflict operations
  const filteredConflicts = useMemo(() => {
    return conflictingOperations.filter((op) => {
      const matchesSearch = 
        op.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.remarks || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.details || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesShift = selectedShift === "ALL" || op.shift === selectedShift;
      const matchesPriority = selectedPriority === "ALL" || op.priority === selectedPriority;
      
      const matchesCrane = selectedCraneFilter === "ALL" || 
        op.mandatoryCrane === selectedCraneFilter || 
        (op.mandatoryCrane === "Any" && selectedCraneFilter === "ALL");

      // Area filter: matches area
      const matchesArea = selectedAreaFilter === "ALL" || op.area?.toString() === selectedAreaFilter;

      return matchesSearch && matchesShift && matchesPriority && matchesCrane && matchesArea;
    });
  }, [conflictingOperations, searchTerm, selectedShift, selectedPriority, selectedCraneFilter, selectedAreaFilter]);

  // Filters application for completed operations
  const filteredCompleted = useMemo(() => {
    return completedOperations.filter((op) => {
      const matchesSearch = 
        op.requestId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.department || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.remarks || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.details || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesShift = historyShiftFilter === "ALL" || op.shift === historyShiftFilter;
      const matchesPriority = selectedPriority === "ALL" || op.priority === selectedPriority;
      
      const matchesCrane = selectedCraneFilter === "ALL" || 
        op.assignedCrane === selectedCraneFilter;

      // Date Range Filters
      const opDate = op.createdAt ? op.createdAt.split("T")[0] : "";
      const matchesStartDate = !historyStartDate || !opDate || opDate >= historyStartDate;
      const matchesEndDate = !historyEndDate || !opDate || opDate <= historyEndDate;

      // Area filter: matches area
      let matchesArea = true;
      if (selectedAreaFilter !== "ALL") {
        const startCol = op.startColumn !== undefined ? op.startColumn : op.column;
        if (selectedAreaFilter === "1") {
          matchesArea = startCol <= 10;
        } else if (selectedAreaFilter === "2") {
          matchesArea = startCol > 10 && startCol <= 20;
        } else if (selectedAreaFilter === "3") {
          matchesArea = startCol > 20;
        }
      }

      return matchesSearch && matchesShift && matchesPriority && matchesCrane && matchesArea && matchesStartDate && matchesEndDate;
    });
  }, [completedOperations, searchTerm, selectedPriority, selectedCraneFilter, selectedAreaFilter, historyStartDate, historyEndDate, historyShiftFilter]);

  // Group completed operations and compute total hours shift-wise for each crane
  const craneShiftSummary = useMemo(() => {
    const summary: Record<string, Record<string, { count: number; totalMins: number }>> = {};
    
    cranes.forEach((c) => {
      summary[c.id] = { 
        "Shift A": { count: 0, totalMins: 0 }, 
        "Shift B": { count: 0, totalMins: 0 }, 
        "Shift C": { count: 0, totalMins: 0 }, 
        "General Shift": { count: 0, totalMins: 0 } 
      };
    });

    filteredCompleted.forEach((op) => {
      const craneId = op.assignedCrane || (cranes[0]?.id || "A1");
      const shift = op.shift || "General Shift";

      const startMins = timeToMinutes(op.startTime);
      const endMins = timeToMinutes(op.endTime);
      const duration = endMins >= startMins ? (endMins - startMins) : (1440 - startMins + endMins);

      if (summary[craneId]) {
        if (!summary[craneId][shift]) {
          summary[craneId][shift] = { count: 0, totalMins: 0 };
        }
        summary[craneId][shift].count += 1;
        summary[craneId][shift].totalMins += duration;
      }
    });

    return summary;
  }, [filteredCompleted, cranes]);

  // Group scheduled operations by Crane
  const scheduledByCrane = useMemo(() => {
    const groups: Record<string, typeof filteredScheduled> = {};
    cranes.forEach((c) => {
      groups[c.id] = [];
    });
    
    filteredScheduled.forEach((op) => {
      if (groups[op.assignedCrane]) {
        groups[op.assignedCrane].push(op);
      } else {
        // Fallback or secondary crane grouping
        groups[op.assignedCrane] = [op];
      }
      
      // If it is a tandem lift, also list under the secondary crane's track if we are looking at specific crane views
      if (op.secondaryCrane && groups[op.secondaryCrane] && selectedCraneFilter === "ALL") {
        // To avoid double counting in "ALL" crane totals, we only add it here if it's not already primary
        // But for distinct lists, showing under both makes perfect logical sense!
      }
    });

    return groups;
  }, [filteredScheduled, selectedCraneFilter]);

  // Group conflicts by Preferred Crane
  const conflictsByCrane = useMemo(() => {
    const groups: Record<string, typeof filteredConflicts> = {
      Any: [],
    };
    cranes.forEach((c) => {
      groups[c.id] = [];
    });
    
    filteredConflicts.forEach((op) => {
      const key = op.mandatoryCrane || "Any";
      if (groups[key]) {
        groups[key].push(op);
      } else {
        groups[key] = [op];
      }
    });

    return groups;
  }, [filteredConflicts, cranes]);

  const handleInstantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstantError("");
    setIsInstantSubmitting(true);

    const sTime12 = `${startHour.padStart(2, "0")}:${startMinute} ${startAmpm}`;
    const eTime12 = `${endHour.padStart(2, "0")}:${endMinute} ${endAmpm}`;

    // Convert to 24hr format
    const sTime24 = convert12HrTo24Hr(sTime12);
    const eTime24 = convert12HrTo24Hr(eTime12);

    // Validate shift boundary
    const inBoundary = isScheduleInShiftBoundary(sTime24, eTime24, instantShift as ShiftType);
    if (!inBoundary) {
      let boundaryDesc = "";
      if (instantShift === "Shift A") boundaryDesc = "6:00 AM to 2:00 PM";
      else if (instantShift === "Shift B") boundaryDesc = "2:00 PM to 10:00 PM";
      else if (instantShift === "Shift C") boundaryDesc = "10:00 PM to 6:00 AM (next day)";
      else if (instantShift === "General Shift") boundaryDesc = "9:00 AM to 6:30 PM";

      setInstantError(
        `Shift Boundary Violation: You have selected ${instantShift} (${boundaryDesc}), but your scheduled time window (${sTime12} to ${eTime12}) is outside this boundary. Please adjust your start/end times to fit within the active list of shift hours.`
      );
      setIsInstantSubmitting(false);
      return;
    }

    if (!instantCrane) {
      setInstantError("Please select an Assigned Crane.");
      setIsInstantSubmitting(false);
      return;
    }

    const payload = {
      shift: instantShift,
      area: Number(instantArea),
      bay: getBayForArea(Number(instantArea)),
      department: instantDept,
      column: Number(instantCol),
      startColumn: Number(instantStartCol),
      endColumn: Number(instantEndCol),
      startTime: sTime24,
      endTime: eTime24,
      weight: Number(instantWeight),
      priority: instantPriority,
      remarks: instantRemarks,
      assignedCrane: instantCrane,
      isTandemLift: false,
    };

    const res = await onInstantSchedule?.(payload);
    setIsInstantSubmitting(false);
    if (res?.success) {
      setIsInstantModalOpen(false);
      // Reset form fields
      setInstantRemarks("");
      setInstantError("");
    } else {
      setInstantError(res?.error || "An error occurred while saving the instant schedule.");
    }
  };

  const getBaysForUser = (u: any): string[] => {
    if (!u) return ["1"];
    if (u.role === "Admin") return ["1", "2", "3", "4", "5", "6", "7"];
    
    const supervisedCranes = u.craneNo 
      ? u.craneNo.split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean) 
      : [];
    
    if (supervisedCranes.length === 0) {
      return [String(getBayForArea(u.area || 1))];
    }
    
    return Array.from(new Set(supervisedCranes.map((craneId: string) => getBayForCrane(craneId))));
  };

  return (
    <div id="shift_master_operations_list" className="bg-white rounded-sm border-4 border-[#141414] p-6 shadow-[6px_6px_0px_#141414] font-sans relative overflow-hidden mb-8">
      
      {/* Industrial Visual Accents */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(45deg,#E4E3E0,#E4E3E0_10px,#141414_10px,#141414_20px)]"></div>
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b-4 border-[#141414] pb-5 mb-6 pt-2">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-amber-600" />
            Crane-Wise Shift Operations &amp; Conflict Registry (Today)
          </h2>
          <p className="text-xs font-mono font-bold text-zinc-500 uppercase mt-1">
            Gantry-Wise Timetable • Today's Crane Allocations &amp; Workability Exceptions
          </p>
        </div>

        {/* Tab Toggle & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-full">
          <div className="flex flex-nowrap bg-zinc-100 p-1 border-2 border-[#141414] rounded-sm shadow-[2px_2px_0px_#141414] overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeTab === "scheduled"
                  ? "bg-[#141414] text-white shadow-sm"
                  : "text-zinc-600 hover:text-[#141414]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 animate-pulse" />
              Today's Timetables ({scheduledOperations.length})
            </button>
            <button
              onClick={() => setActiveTab("conflicts")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeTab === "conflicts"
                  ? "bg-red-950 text-white shadow-sm"
                  : "text-zinc-600 hover:text-[#141414]"
              }`}
            >
              <Ban className="w-4 h-4" />
              Today's Exclusions ({conflictingOperations.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-sm transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                activeTab === "history"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-600 hover:text-[#141414]"
              }`}
            >
              <History className="w-4 h-4" />
              Archives ({completedOperations.length})
            </button>
          </div>

          <button
            onClick={() => generateDateWisePDF(schedules, requests)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            title="Download PDF report of all scheduled works date wise"
          >
            <Download className="w-4 h-4" />
            Download Master PDF
          </button>

          <button
            onClick={() => setIsInstantModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            title="Instantly deploy a hoisting job directly to the timetable (-5 planning points penalty)"
          >
            <Zap className="w-4 h-4 text-yellow-300 animate-pulse" />
            Instant Scheduling
          </button>
        </div>
      </div>

      {/* Supervisor Supervision Station Banner */}
      {user && user.role === "Area User" && (
        <div id="supervisor_access_banner" className="mb-6 bg-amber-50 border-2 border-amber-500 p-4 rounded-sm font-mono text-xs text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_#f59e0b]">
          <div className="space-y-0.5">
            <span className="font-black uppercase text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-sm">
              SUPERVISOR AUTHORIZED ACCESS STATION
            </span>
            <div className="font-sans font-bold text-sm text-zinc-900 mt-1 uppercase">
              {user.name} ({user.employeeId}) — STATION AREA {user.area || 1}
            </div>
            <p className="text-[11px] text-amber-900 font-bold">
              Your crane assignments map to: <span className="font-extrabold text-amber-950 underline">{user.craneNo || "None"}</span> 
              {" | "} Supervised Bays: <span className="font-extrabold text-amber-950 underline">{getBaysForUser(user).map(b => `Bay ${b}`).join(", ") || "None"}</span>
            </p>
          </div>
          <div className="bg-white border-2 border-amber-500 px-3 py-1.5 rounded-sm font-black text-center text-[10px] uppercase text-amber-950 shadow-sm">
            🛜 ACTIVE SUPERVISION ENFORCED
          </div>
        </div>
      )}

      {/* Control / Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-zinc-50 p-4 border-2 border-[#141414] rounded-sm mb-6">
        
        {/* Search */}
        <div className="relative">
          <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
            Search Operation / Dept / ID
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter by keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border-2 border-[#141414] rounded-sm text-xs font-mono font-bold placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Crane Wise Selector (Critical User Request) */}
        <div>
          <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
            Gantry Filter (Crane-Wise)
          </label>
          <select
            value={selectedCraneFilter}
            onChange={(e) => setSelectedCraneFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border-2 border-[#141414] rounded-sm text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">ALL CRANES</option>
            {cranes.map((c) => {
              const isHeavy = c.id.endsWith("1");
              const isMedium = c.id.endsWith("2");
              const label = isHeavy ? "50-Ton Heavy" : isMedium ? "32-Ton Medium" : "16-Ton Light";
              return (
                <option key={c.id} value={c.id}>
                  Crane {c.id} ({label})
                </option>
              );
            })}
          </select>
        </div>

        {/* Bay Area Filter (Area-Wise) (Critical User Request) */}
        <div>
          <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
            Bay Area Filter (Area-Wise)
          </label>
          <select
            value={selectedAreaFilter}
            onChange={(e) => setSelectedAreaFilter(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border-2 border-[#141414] rounded-sm text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">ALL BAY AREAS</option>
            {getAreasForBay(selectedBay).map((areaNum) => {
              const range = getColumnsForArea(areaNum);
              return (
                <option key={areaNum} value={String(areaNum)}>
                  Bay Area {areaNum} (Cols {range.min} - {range.max})
                </option>
              );
            })}
          </select>
        </div>

        {/* Shift Filter */}
        <div>
          <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
            Shift Assignment
          </label>
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border-2 border-[#141414] rounded-sm text-xs font-mono font-bold focus:outline-none text-ellipsis"
          >
            <option value="ALL">ALL SHIFTS</option>
            <option value="Shift A">Shift A (06:00 AM - 02:00 PM)</option>
            <option value="Shift B">Shift B (02:00 PM - 10:00 PM)</option>
            <option value="Shift C">Shift C (10:00 PM - 06:00 AM)</option>
            <option value="General Shift">General Shift (09:00 AM - 06:30 PM)</option>
          </select>
        </div>

        {/* Priority Filter */}
        <div>
          <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
            Priority Tier
          </label>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border-2 border-[#141414] rounded-sm text-xs font-mono font-bold focus:outline-none"
          >
            <option value="ALL">ALL PRIORITIES</option>
            <option value="P1">P1 Critical</option>
            <option value="P2">P2 Urgent</option>
            <option value="P3">P3 Normal</option>
            <option value="P4">P4 Planned</option>
          </select>
        </div>

      </div>

      {/* TAB CONTENT: 1. Scheduled Crane-Wise Work */}
      {activeTab === "scheduled" && (
        <div className="space-y-8">
          {(() => {
            const visibleCranes = cranes.map(c => c.id).filter((craneId) => {
              if (selectedCraneFilter !== "ALL" && selectedCraneFilter !== craneId) {
                return false;
              }
              // Always show all cranes of the bay so operators have full visibility
              return true;
            });

            if (visibleCranes.length === 0) {
              return (
                <div className="py-12 border-4 border-dashed border-zinc-200 rounded-sm text-center bg-zinc-50">
                  <Construction className="w-10 h-10 mx-auto mb-3 text-zinc-300 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-700">No active gantry timetables</p>
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono font-bold">
                    All cranes are either idle or scheduled in other shifts based on current filters.
                  </p>
                </div>
              );
            }

            return visibleCranes.map((craneId) => {
              const ops = scheduledByCrane[craneId] || [];
              const details = getCraneDisplayDetails(craneId);

              return (
                <div key={craneId} className="border-2 border-[#141414] rounded-sm overflow-hidden shadow-[3px_3px_0px_#141414]">
                  {/* Crane Header Banner */}
                  <div className={`p-4 border-b-2 border-[#141414] ${details.bg} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2`}>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-zinc-900 text-white rounded-sm text-xs font-mono font-black uppercase tracking-wider">
                        {craneId}
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-tight text-[#141414]">
                          {details.name} Schedule Timetable
                        </h3>
                        <p className="text-[10px] font-mono text-zinc-500 font-bold uppercase mt-0.5">
                          Capacity Limit: {details.capacity} • Allocated Track: {details.range}
                        </p>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono font-black uppercase text-zinc-700 bg-white px-2 py-1 border border-zinc-300 rounded-sm">
                      {ops.length} Active {ops.length === 1 ? "Job" : "Jobs"} Assigned
                    </div>
                  </div>

                  {/* Crane Table Content */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[750px] text-xs">
                      <thead>
                        <tr className="bg-zinc-100 text-[#141414] font-mono uppercase text-[9px] tracking-wider border-b border-zinc-300">
                          <th className="py-2.5 px-4 font-black w-36">Time Window</th>
                          <th className="py-2.5 px-4 font-black">Target Department</th>
                          <th className="py-2.5 px-4 font-black w-24">Load Weight</th>
                          <th className="py-2.5 px-4 font-black w-28">Bay Location</th>
                          <th className="py-2.5 px-4 font-black w-24">Priority</th>
                          <th className="py-2.5 px-4 font-black w-28">Job Registry</th>
                          <th className="py-2.5 px-4 font-black">Remarks & Instructions</th>
                          <th className="py-2.5 px-4 font-black w-32 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 font-mono font-bold">
                        {ops.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-zinc-400 bg-zinc-50/50 font-bold uppercase tracking-wider text-[11px]">
                              No active operations scheduled for this gantry in the current shift.
                            </td>
                          </tr>
                        ) : (
                          ops.map((op) => {
                            const isTandem = op.isTandemLift || Boolean(op.secondaryCrane);
                            return (
                              <tr 
                                key={op.id} 
                                className={`hover:bg-amber-50/30 transition-colors ${
                                  isTandem ? "bg-amber-50/15 border-l-4 border-amber-500" : ""
                                }`}
                              >
                              {/* Time Window */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 text-[#141414] font-extrabold text-[12px]">
                                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>{formatTimeTo12Hr(op.startTime)}</span>
                                  <ArrowRight className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>{formatTimeTo12Hr(op.endTime)}</span>
                                </div>
                                <div className="text-[9px] text-zinc-500 uppercase mt-0.5 font-bold">
                                  {op.shift}
                                </div>
                              </td>

                              {/* Department */}
                              <td className="py-3 px-4 text-[#141414] font-black uppercase text-xs">
                                {op.department || "General Operation"}
                              </td>

                              {/* Weight */}
                              <td className="py-3 px-4 text-zinc-700 text-xs font-black">
                                {op.weight} Tons
                              </td>

                              {/* Column Span */}
                              <td className="py-3 px-4 text-xs font-black">
                                <span className="bg-zinc-100 px-2 py-0.5 border border-zinc-200 rounded-sm">
                                  {op.origReq?.bay ? `Bay ${op.origReq.bay}` : "Bay A"}: {op.startColumn !== undefined && op.endColumn !== undefined ? `${op.startColumn}–${op.endColumn}` : op.column}
                                </span>
                              </td>

                              {/* Priority */}
                              <td className="py-3 px-4">
                                <span className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded-sm uppercase ${
                                  op.priority === "P1" 
                                    ? "bg-red-100 text-red-800 border border-red-200"
                                    : op.priority === "P2"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-zinc-100 text-zinc-800 border border-zinc-200"
                                }`}>
                                  {op.priority}
                                </span>
                              </td>

                              {/* Registry ID */}
                              <td className="py-3 px-4 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                                #{op.requestId.substring(0, 8)}
                              </td>

                              {/* Remarks & Instructions */}
                              <td className="py-3 px-4 text-zinc-600 text-xs font-sans font-semibold leading-relaxed max-w-xs hover:whitespace-normal">
                                {isTandem && (
                                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase mr-2 font-mono">
                                    Tandem with {op.secondaryCrane || "A2"}
                                  </span>
                                )}
                                {op.origReq?.details && (
                                  <div className="mb-1 text-zinc-900 font-bold bg-amber-50/50 border border-amber-200/50 rounded-sm p-1.5 text-[11px] leading-snug">
                                    <span className="text-[9px] uppercase font-mono font-black text-amber-800 block mb-0.5">Work:</span>
                                    {op.origReq.details}
                                  </div>
                                )}
                                {op.remarks ? (
                                  <div className="text-zinc-500 text-[11px] italic">
                                    "{op.remarks}"
                                  </div>
                                ) : (
                                  !op.origReq?.details && <span className="italic text-zinc-400 text-[11px]">No remarks/details.</span>
                                )}
                              </td>

                              {/* Actions Column */}
                              <td className="py-3 px-4 text-center">
                                {confirmingCancelId === op.id ? (
                                  <div className="flex flex-col gap-1 w-full min-w-[100px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onCancelSchedule?.(op.id);
                                        setConfirmingCancelId(null);
                                      }}
                                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 w-full"
                                    >
                                      Confirm Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmingCancelId(null)}
                                      className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-[#141414] text-[9px] font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 w-full"
                                    >
                                      No, Keep
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmingCancelId(op.id);
                                    }}
                                    className="px-2 py-1.5 bg-red-50 hover:bg-red-100 border-2 border-red-300 text-red-700 text-[10px] font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 w-full"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    Cancel/Resched
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* TAB CONTENT: 2. Exclusions / Conflicts (What is not possible in that shift) */}
      {activeTab === "conflicts" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-l-4 border-amber-600 p-4 rounded-sm text-xs text-amber-950 font-bold leading-relaxed">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold uppercase text-[11px] text-amber-800 tracking-wider">Crane Expatriation &amp; Shift Boundary Rejections</p>
                <p className="mt-1 font-medium">
                  The following hoist requests are **not possible** for execution in their submitted shifts. This registry records mechanical clearance conflicts, shift boundary violations, or overlap hazards where safety criteria prevented allocation.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {[...cranes.map(c => c.id), "Any"].map((craneId) => {
              // If the user filtered by a specific crane, we only show that crane or "Any" crane conflicts
              if (selectedCraneFilter !== "ALL" && selectedCraneFilter !== craneId) {
                return null;
              }

              const ops = conflictsByCrane[craneId] || [];
              if (ops.length === 0) return null;

              const details = getCraneDisplayDetails(craneId);

              return (
                <div key={craneId} className="border-2 border-red-900 rounded-sm overflow-hidden bg-white shadow-[2px_2px_0px_#7f1d1d]">
                  {/* Category Header */}
                  <div className="bg-red-50 p-3 border-b-2 border-red-900 flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-red-950 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-800 animate-pulse" />
                      {craneId === "Any" ? "General / Unspecified Crane Exclusions" : `Crane ${craneId} Exclusions`}
                    </span>
                    <span className="text-[10px] font-mono font-black bg-red-100 text-red-900 px-2 py-0.5 rounded-sm uppercase">
                      {ops.length} Excluded Requests
                    </span>
                  </div>

                  {/* List of Crane Conflicts */}
                  <div className="divide-y divide-zinc-200">
                    {ops.map((op) => {
                      return (
                        <div key={op.id} className="p-4 hover:bg-zinc-50/50 transition-colors">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-red-950 text-white font-mono text-[9px] font-black rounded-sm">
                                REGISTRY #{op.id.substring(0, 8)}
                              </span>
                              <span className="text-zinc-300 font-bold">|</span>
                              <span className="text-xs font-mono font-bold text-zinc-500 uppercase">{op.shift}</span>
                            </div>

                            <span className="text-[10px] font-mono font-black uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-sm">
                              {op.status === "Deferred" ? "DEFERRED FOR CONFLICT" : "OUTSIDE BOUNDS / REJECTED"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono font-bold bg-zinc-50 p-3 border border-zinc-300 rounded-sm mb-3">
                            <div>
                              <span className="text-[9px] text-zinc-400 block uppercase">Requested Window</span>
                              <span className="text-[#141414] font-black">{op.estimatedStartTime} - {op.estimatedEndTime}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 block uppercase">Section Dept</span>
                              <span className="text-[#141414] font-black uppercase text-ellipsis overflow-hidden block">{op.department}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 block uppercase">Working Span</span>
                              <span className="text-[#141414] font-black">Cols {op.startColumn}–{op.endColumn}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 block uppercase">Load Weight</span>
                              <span className="text-[#141414] font-black">{op.estimatedWeight} Tons</span>
                            </div>
                          </div>

                          {/* Conflict explanation */}
                          <div className="space-y-2">
                            {op.details && (
                              <div className="text-xs leading-relaxed font-sans font-semibold">
                                <span className="text-[9px] font-mono font-black text-zinc-400 uppercase block">Shift Work Details</span>
                                <p className="text-zinc-800 bg-amber-50/40 border border-amber-200/50 p-2 rounded-sm font-bold">
                                  {op.details}
                                </p>
                              </div>
                            )}

                            <div className="text-xs leading-relaxed font-sans font-semibold">
                              <span className="text-[9px] font-mono font-black text-zinc-400 uppercase block">Submission Remarks</span>
                              <p className="text-zinc-600 bg-white border border-zinc-200 p-2 rounded-sm italic">
                                "{op.remarks || "No descriptive remarks provided."}"
                              </p>
                            </div>

                            {(() => {
                              const reason = getRequestExclusionReason(op);
                              return (
                                <div className="text-[11px] font-sans font-semibold text-red-900 bg-red-50/40 p-2 rounded-sm border border-red-200/50 flex gap-2 items-start">
                                  <Ban className="w-4 h-4 text-red-800 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-extrabold uppercase text-[10px] text-red-950 block">Exclusion Resolution Detail:</span>
                                    <p className="mt-0.5 font-bold text-red-900">
                                      {reason ? (
                                        <span>⚠️ LIMIT VIOLATION: {reason}</span>
                                      ) : op.status === "Rejected" ? (
                                        "Rejected on manual administrative review due to shift timeline violation or priority override."
                                      ) : (
                                        `Excluded from this shift's allocation to prevent overlap collision hazards on adjacent tracks with higher priority orders.`
                                      )}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {filteredConflicts.length === 0 && (
              <div className="py-12 border-4 border-dashed border-zinc-200 rounded-sm text-center bg-zinc-50">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                <p className="text-xs font-black uppercase tracking-wider text-zinc-700">All submitted jobs are workable</p>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono font-bold">
                  Excellent! There are no excluded or non-possible requests recorded for this crane/gantry selection.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety Certificate Badge footer */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-2 border-amber-500/30 p-4 rounded-sm flex items-start gap-3">
            <History className="w-5 h-5 text-amber-800 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold text-amber-950 uppercase tracking-wide block mb-0.5">Completed Operations Archives</span>
              <p className="text-amber-800 font-medium font-sans leading-relaxed">
                Below are the works that have been marked as Completed and moved to history logs. To archive and clear current active scheduled works, use the **Shift Completion / Archival** action panel inside the admin dashboard.
              </p>
            </div>
          </div>

          {/* History Date & Shift Filter Bar */}
          <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-4 font-mono text-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
              <CalendarDays className="w-4 h-4 text-amber-600" />
              <span className="font-black text-zinc-900 uppercase">Select Start Date, End Date, and Shift for Exporting / Filtering History</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
                  Shift Option
                </label>
                <select
                  value={historyShiftFilter}
                  onChange={(e) => setHistoryShiftFilter(e.target.value)}
                  className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
                >
                  <option value="ALL">All Shifts (ALL)</option>
                  <option value="Shift A">Shift A (06:00 AM - 02:00 PM)</option>
                  <option value="Shift B">Shift B (02:00 PM - 10:00 PM)</option>
                  <option value="Shift C">Shift C (10:00 PM - 06:00 AM)</option>
                  <option value="General Shift">General Shift (09:00 AM - 06:30 PM)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Crane Shift-wise Working Hours Summary */}
          <div className="bg-zinc-900 text-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 font-sans space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Gantry Shift-wise Cumulative Working Hours & Performance
                </h4>
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Calculated based on completed operations filtered dynamically by your selections.
                </p>
              </div>

              <button
                onClick={() => generateCraneWorkingHoursPDF(filteredCompleted, historyStartDate, historyEndDate, historyShiftFilter)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 border border-[#141414] text-slate-950 rounded-sm text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                title="Download comprehensive PDF filtered by start, end date and shift"
              >
                <Download className="w-4 h-4" />
                Download PDF Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {cranes.map(c => c.id).map((craneId) => {
                const shiftsData = (craneShiftSummary[craneId] || {}) as Record<string, { count: number; totalMins: number }>;
                const totalWorkingMins = Object.values(shiftsData).reduce((sum, d) => sum + d.totalMins, 0);
                const totalWorkingHours = (totalWorkingMins / 60).toFixed(1);
                const totalJobs = Object.values(shiftsData).reduce((sum, d) => sum + d.count, 0);

                return (
                  <div key={craneId} className="bg-zinc-950 border border-zinc-800 rounded-sm p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                      <span className="text-xs font-black text-amber-400 uppercase">Gantry {craneId}</span>
                      <span className="text-[10px] font-mono font-black text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-sm">
                        Total: {totalWorkingHours} Hrs
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      {Object.entries(shiftsData).map(([shiftStr, data]) => {
                        const hrVal = (data.totalMins / 60).toFixed(1);
                        return (
                          <div key={shiftStr} className="flex justify-between items-center text-[11px] text-zinc-300 font-bold">
                            <span>{shiftStr}:</span>
                            <span className="text-white font-extrabold">
                              {hrVal} hrs <span className="text-[9px] text-zinc-500 font-bold">({data.count} jobs)</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-zinc-800 pt-2 flex justify-between text-[10px] font-mono font-bold text-zinc-500">
                      <span>CUMULATIVE JOBS:</span>
                      <span className="text-amber-400 font-extrabold">{totalJobs} Completed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {filteredCompleted.map((op) => (
              <div
                key={op.id}
                className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-4 font-mono text-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between hover:bg-zinc-50 transition-all"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-[#141414] text-white px-2 py-0.5 text-[10px] font-black rounded-sm uppercase">
                      ID: {op.id}
                    </span>
                    <span className="bg-emerald-100 border border-emerald-300 text-emerald-950 px-2 py-0.5 text-[9px] font-black rounded-sm uppercase">
                      Completed
                    </span>
                    <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 text-[9px] font-black rounded-sm uppercase border border-zinc-300">
                      Shift: {op.shift}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-sm uppercase border ${
                      op.priority === "P1" ? "bg-red-50 border-red-300 text-red-950" :
                      op.priority === "P2" ? "bg-orange-50 border-orange-300 text-orange-950" :
                      op.priority === "P3" ? "bg-blue-50 border-blue-300 text-blue-950" :
                      "bg-zinc-50 border-zinc-300 text-zinc-700"
                    }`}>
                      Priority: {op.priority}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-zinc-600 font-bold">
                    <div>Gantry: <span className="text-[#141414] font-black">{op.assignedCrane}</span></div>
                    <div>Columns: <span className="text-[#141414] font-black">{(op.startColumn !== undefined ? op.startColumn : op.column)} - {(op.endColumn !== undefined ? op.endColumn : op.column)}</span></div>
                    <div>Time Window: <span className="text-[#141414] font-black">{formatTimeTo12Hr(op.startTime)} - {formatTimeTo12Hr(op.endTime)}</span></div>
                    <div>Dept/Cost Center: <span className="text-[#141414] font-black">{op.department}</span></div>
                  </div>

                  {op.details && (
                    <div className="text-[10px] text-zinc-900 font-bold bg-amber-50/50 p-2 rounded-sm border border-amber-200/50">
                      <span className="text-[8px] font-mono font-black text-amber-800 uppercase block mb-0.5">Shift Work Details:</span>
                      {op.details}
                    </div>
                  )}

                  {op.remarks && (
                    <div className="text-[10px] text-zinc-500 italic bg-zinc-50 p-2 rounded-sm border border-zinc-200">
                      <span className="text-[8px] font-mono font-black text-zinc-400 uppercase block mb-0.5">Remarks:</span>
                      "{op.remarks}"
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col items-end justify-between border-t md:border-t-0 border-zinc-100 pt-2.5 md:pt-0 gap-1.5 font-bold text-[10px]">
                  <div className="text-zinc-500 font-bold">EST. WEIGHT: <span className="text-[#141414] font-black text-xs">{op.weight} T</span></div>
                  {op.createdAt && (
                    <div className="text-[9px] text-zinc-400">Archived on {new Date(op.createdAt).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ))}

            {filteredCompleted.length === 0 && (
              <div className="py-12 border-4 border-dashed border-zinc-200 rounded-sm text-center bg-zinc-50">
                <History className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
                <p className="text-xs font-black uppercase tracking-wider text-zinc-700">No archived completed works found</p>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono font-bold">
                  There are no completed works matching your current query or shift filter in the archive log.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safety Certificate Badge footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 border-t-2 border-zinc-200 pt-4 mt-6 text-[10px] font-mono text-zinc-500 font-bold uppercase justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>All gantry-wise shift allocations and exclusions verified by safety override logs.</span>
        </div>
        <span>SYSTEM CLASSIFICATION: COOPERATIVE PUBLIC DIRECTORY</span>
      </div>

      {/* INSTANT GANTRY SCHEDULING OVERLAY WINDOW */}
      {isInstantModalOpen && (
        <div id="instant_scheduling_modal" className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-[#141414] shadow-[8px_8px_0px_#141414] w-full max-w-2xl p-6 relative font-sans space-y-4 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Title Banner */}
            <div className="flex items-start justify-between border-b-4 border-[#141414] pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500 font-mono flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                  Fast-Track Scheduling System
                </h3>
                <h2 className="text-xl font-black text-[#141414] uppercase tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  Instant Gantry Allocation Terminal
                </h2>
              </div>
              <button 
                type="button" 
                onClick={() => setIsInstantModalOpen(false)}
                className="p-1.5 hover:bg-zinc-100 border-2 border-[#141414] rounded-sm transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Score Impact Warning Panel */}
            <div className="bg-amber-50 border-2 border-amber-600 p-3 rounded-sm flex gap-2 text-xs text-amber-950 font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="uppercase font-black tracking-wider text-amber-950">Managerial Planning Skill Penalty Active (-5 Points)</p>
                <p className="font-semibold text-[11px] mt-0.5">
                  Bypassing the standard planning pipeline will instantly deduct <strong className="text-amber-900 font-black">5 points</strong> from your current monthly balance ({user?.planningPoints ?? 100}/100 pts remaining). This tracks real-time lead planning performance.
                </p>
              </div>
            </div>

            {/* Error Message Panel */}
            {instantError && (
              <div className="bg-red-50 border-2 border-red-600 p-3.5 rounded-sm flex gap-2 text-xs text-red-950 font-bold font-mono">
                <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="uppercase font-black text-red-900">Allocation Rejected</p>
                  <p className="text-[11px] mt-1 whitespace-pre-wrap">{instantError}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleInstantSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Shift selection */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Target Shift *
                  </label>
                  <select
                    value={instantShift}
                    onChange={(e) => setInstantShift(e.target.value)}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  >
                    <option value="Shift A">Shift A (06:00 AM – 02:00 PM)</option>
                    <option value="Shift B">Shift B (02:00 PM – 10:00 PM)</option>
                    <option value="Shift C">Shift C (10:00 PM – 06:00 AM)</option>
                    <option value="General Shift">General Shift (09:00 AM – 06:30 PM)</option>
                  </select>
                </div>

                {/* 2. Target Crane selection */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Assigned Gantry Crane *
                  </label>
                  <select
                    value={instantCrane}
                    onChange={(e) => setInstantCrane(e.target.value)}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Active Crane --</option>
                    {cranes.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.status === "Breakdown" || c.status === "Maintenance"}>
                        {c.name} ({c.id}) - Capacity {c.capacity}T [{c.status}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Shop Floor Area */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Shop Floor Area (1-22 Lead Areas) *
                  </label>
                  <select
                    value={instantArea}
                    onChange={(e) => setInstantArea(Number(e.target.value))}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  >
                    {Array.from({ length: 22 }, (_, idx) => idx + 1).map((a) => (
                      <option key={a} value={a}>Area {a} (Bay Runway {getBayForArea(a)})</option>
                    ))}
                  </select>
                </div>

                {/* 4. Target Department */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Cost Center / Department *
                  </label>
                  <input
                    type="text"
                    value={instantDept}
                    onChange={(e) => setInstantDept(e.target.value)}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  />
                </div>

                {/* 5. Start / End Columns */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Operations Columns (1-30) *
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={instantStartCol}
                      onChange={(e) => setInstantStartCol(Number(e.target.value))}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                      placeholder="Min Col"
                      required
                    />
                    <span className="font-mono font-bold">to</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={instantEndCol}
                      onChange={(e) => setInstantEndCol(Number(e.target.value))}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                      placeholder="Max Col"
                      required
                    />
                  </div>
                </div>

                {/* 6. Crane Center Point Column */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Gantry Operating Column (1-30) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={instantCol}
                    onChange={(e) => setInstantCol(Number(e.target.value))}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  />
                </div>

                {/* 7. Start Time picker (12 hr format) */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Scheduled Start Time (12-Hr format) *
                  </label>
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={startHour}
                      onChange={(e) => setStartHour(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="font-bold">:</span>
                    <select
                      value={startMinute}
                      onChange={(e) => setStartMinute(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={startAmpm}
                      onChange={(e) => setStartAmpm(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* 8. End Time picker (12 hr format) */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Scheduled End Time (12-Hr format) *
                  </label>
                  <div className="flex gap-1.5 items-center">
                    <select
                      value={endHour}
                      onChange={(e) => setEndHour(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="font-bold">:</span>
                    <select
                      value={endMinute}
                      onChange={(e) => setEndMinute(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      {["00", "15", "30", "45"].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={endAmpm}
                      onChange={(e) => setEndAmpm(e.target.value)}
                      className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* 9. Load weight */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Load Weight (Tons) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={instantWeight}
                    onChange={(e) => setInstantWeight(Number(e.target.value))}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  />
                </div>

                {/* 10. Job Priority */}
                <div>
                  <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                    Job Allocation Priority *
                  </label>
                  <select
                    value={instantPriority}
                    onChange={(e) => setInstantPriority(e.target.value as PriorityType)}
                    className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none"
                    required
                  >
                    <option value="P1">P1 (Immediate Production Shutdown Threat)</option>
                    <option value="P2">P2 (Furnace / Melt Line Crucial Feed)</option>
                    <option value="P3">P3 (Routine Departmental Logistics)</option>
                    <option value="P4">P4 (Low Priority Maintenance / Relocation)</option>
                  </select>
                </div>

              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-mono font-black uppercase text-zinc-500 mb-1">
                  Specific Remarks & Safety Handshake Instructions
                </label>
                <textarea
                  value={instantRemarks}
                  onChange={(e) => setInstantRemarks(e.target.value)}
                  className="w-full bg-white border-2 border-[#141414] p-2 rounded-sm font-mono font-bold focus:outline-none h-16 resize-none"
                  placeholder="Enter custom remarks / instructions for gantry operator..."
                />
              </div>

              {/* Submit / Cancel Footer Buttons */}
              <div className="flex justify-end gap-3 pt-2 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsInstantModalOpen(false)}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm font-black uppercase tracking-wider cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInstantSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-[#141414] shadow-[2px_2px_0px_#141414] rounded-sm font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-yellow-300 animate-pulse" />
                  {isInstantSubmitting ? "Deploying Allocation..." : "Instantly Deploy Hoist Job (-5 Pts)"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

