import React, { useState } from "react";
import { 
  Clock, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  SlidersHorizontal,
  Layers,
  Sparkles,
  CalendarDays,
  Gauge,
  BookOpen,
  FileText
} from "lucide-react";
import { CraneRequest, Crane } from "../types";
import CraneAllocationsTable from "./CraneAllocationsTable";

interface AdminJobsTrackerProps {
  requests: CraneRequest[];
  cranes: Crane[];
}

export default function AdminJobsTracker({ requests, cranes }: AdminJobsTrackerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "In-Progress" | "Completed">("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "P1" | "P2" | "P3" | "P4">("All");
  const [departmentFilter, setDepartmentFilter] = useState<string>("All");
  const [cardViews, setCardViews] = useState<Record<string, "grid" | "sheet">>({});

  // Get unique departments for filtering
  const departments = ["All", ...Array.from(new Set(requests.map((r) => r.department).filter(Boolean)))];

  // Helper to calculate total hours for an allocation
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    let startTotal = (startH || 0) * 60 + (startM || 0);
    let endTotal = (endH || 0) * 60 + (endM || 0);
    if (endTotal < startTotal) {
      endTotal += 24 * 60; // Handle over-midnight allocations
    }
    return (endTotal - startTotal) / 60;
  };

  // Compute metrics
  const completedJobs = requests.filter((r) => r.status === "Completed");
  const inProgressJobs = requests.filter((r) => r.status !== "Completed" && r.status !== "Rejected");

  let totalAllocatedHours = 0;
  requests.forEach((r) => {
    (r.craneAllocations || []).forEach((alloc) => {
      totalAllocatedHours += calculateHours(alloc.startTime, alloc.endTime);
    });
  });

  const totalCompletedWeight = completedJobs.reduce((sum, r) => sum + (Number(r.estimatedWeight) || 0), 0);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    // Hide continuation requests from the main list - they are listed as steps inside their parent
    if (req.jobType === "Continuation") return false;

    // Search query
    const sTerm = searchTerm.toLowerCase();
    const childJobs = requests.filter((r) => r.parentJobId === req.id && r.jobType === "Continuation");
    
    const matchesSearch = !searchTerm ||
      req.id.toLowerCase().includes(sTerm) ||
      (req.department || "").toLowerCase().includes(sTerm) ||
      (req.details || "").toLowerCase().includes(sTerm) ||
      (req.remarks || "").toLowerCase().includes(sTerm) ||
      (req.machineName || "").toLowerCase().includes(sTerm) ||
      childJobs.some(child => 
        child.id.toLowerCase().includes(sTerm) || 
        (child.details || "").toLowerCase().includes(sTerm)
      );

    // Status filter
    const isInProgress = req.status !== "Completed" && req.status !== "Rejected";
    const matchesStatus = statusFilter === "All" ||
      (statusFilter === "Completed" && req.status === "Completed") ||
      (statusFilter === "In-Progress" && isInProgress);

    // Priority filter
    const matchesPriority = priorityFilter === "All" || req.priority === priorityFilter;

    // Department filter
    const matchesDept = departmentFilter === "All" || req.department === departmentFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesDept;
  });

  return (
    <div id="admin_jobs_tracker_view" className="space-y-6 font-sans">
      
      {/* Visual Header */}
      <div className="bg-[#141414] text-white p-6 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Layers className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider font-mono shadow-[1px_1px_0px_white]">
              ADMIN VIEW
            </span>
            <span className="text-zinc-500 font-mono text-xs">•</span>
            <span className="text-zinc-400 font-mono text-[11px] font-bold uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Advanced Fleet Intelligence
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
            Manufacturing Jobs & Crane Hoisting Tracker
          </h1>
          <p className="text-[11px] md:text-xs text-zinc-400 font-mono mt-1 font-bold leading-relaxed max-w-3xl">
            Real-time control dashboard tracking active hoist cycles, total crane hours, gantry ranges, and heavy-tonnage logistics logs. Search, filter, and inspect physical allocations of active and completed fabrications.
          </p>
        </div>
      </div>

      {/* Aggregate Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        
        <div className="p-4 bg-emerald-50/70 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414]">
          <span className="text-zinc-500 text-[9px] uppercase font-black block leading-none mb-1">Completely Done</span>
          <div className="text-xl font-black text-emerald-800 flex items-baseline gap-1.5">
            {completedJobs.length}
            <span className="text-[10px] text-zinc-500 font-bold font-sans">jobs</span>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Fully Verified & Archived
          </p>
        </div>

        <div className="p-4 bg-amber-50/70 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414]">
          <span className="text-zinc-500 text-[9px] uppercase font-black block leading-none mb-1">In-Progress / Queue</span>
          <div className="text-xl font-black text-amber-800 flex items-baseline gap-1.5">
            {inProgressJobs.length}
            <span className="text-[10px] text-zinc-500 font-bold font-sans">jobs</span>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-600 animate-pulse" /> Active Fabrications
          </p>
        </div>

        <div className="p-4 bg-zinc-50 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414]">
          <span className="text-zinc-500 text-[9px] uppercase font-black block leading-none mb-1">Cumulative Crane Hours</span>
          <div className="text-xl font-black text-slate-900 flex items-baseline gap-1">
            {totalAllocatedHours.toFixed(1)}
            <span className="text-[10px] text-zinc-500 font-bold font-sans">hrs</span>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-600" /> Sum Gantry Active Duration
          </p>
        </div>

        <div className="p-4 bg-zinc-50 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414]">
          <span className="text-zinc-500 text-[9px] uppercase font-black block leading-none mb-1">Fabricated Weight</span>
          <div className="text-xl font-black text-amber-950 flex items-baseline gap-1">
            {totalCompletedWeight.toFixed(0)}
            <span className="text-[10px] text-zinc-500 font-bold font-sans">tons</span>
          </div>
          <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase flex items-center gap-1">
            <Gauge className="w-3 h-3 text-amber-700" /> Finished Crane Loads
          </p>
        </div>

      </div>

      {/* Control Filter Toolbar */}
      <div className="bg-zinc-100 p-4 border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414] space-y-3 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-zinc-200">
          <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-600" />
          <span className="font-black text-[10px] text-zinc-600 uppercase tracking-wider">Search Filter and Scope Controller</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Search text */}
          <div>
            <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Search Keyword / ID</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search Job ID, work, dept..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border-2 border-[#141414] rounded-sm bg-white text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Status Select */}
          <div>
            <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Job Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs font-semibold"
            >
              <option value="All">All Statuses</option>
              <option value="In-Progress">In Progress (Draft / Submitted / Scheduled)</option>
              <option value="Completed">Completely Done</option>
            </select>
          </div>

          {/* Priority Select */}
          <div>
            <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Priority Rank</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs font-semibold"
            >
              <option value="All">All Priorities</option>
              <option value="P1">P1 - Critical High</option>
              <option value="P2">P2 - Urgent Standard</option>
              <option value="P3">P3 - Normal Low</option>
              <option value="P4">P4 - Planned</option>
            </select>
          </div>

          {/* Department Select */}
          <div>
            <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white font-sans text-xs font-semibold"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === "All" ? "All Departments" : dept}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Clear Filters Button Row */}
        <div className="flex justify-between items-center pt-2 text-[10px] text-zinc-500 font-semibold">
          <span>Showing {filteredRequests.length} of {requests.length} total registered manufacturing tasks</span>
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("All");
              setPriorityFilter("All");
              setDepartmentFilter("All");
            }}
            className="px-3 py-1 bg-white hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] font-black uppercase text-[9px] rounded-sm active:translate-y-[1px] transition-all cursor-pointer"
          >
            Reset Tracker Filters
          </button>
        </div>
      </div>

      {/* Main Filtered Job List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-sm font-mono">
            <AlertTriangle className="w-10 h-10 text-zinc-400 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-black text-zinc-600 uppercase">No Matching Manufactured Jobs Found</p>
            <p className="text-[11px] text-zinc-400 font-bold mt-1 leading-relaxed">
              We couldn't locate any jobs with details matching "{searchTerm}" or your current filter preferences. Try resetting filters.
            </p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isFinished = req.status === "Completed";
            const allocations = req.craneAllocations || [];

            // Calculate total accumulated hours for this job request
            const totalJobHours = allocations.reduce((sum, a) => {
              return sum + calculateHours(a.startTime, a.endTime);
            }, 0);

            // Total time taken: actual logged hours if any, otherwise estimated duration
            const estimatedDuration = calculateHours(req.estimatedStartTime, req.estimatedEndTime);
            const totalTimeTaken = totalJobHours > 0 ? totalJobHours : estimatedDuration;

            // Completion %
            const pct = req.completionPercentage !== undefined 
              ? req.completionPercentage 
              : (isFinished ? 100 : 45);

            // Dynamic distinct fallback machine names so they aren't all named identically
            const getDisplayName = () => {
              if (req.machineName && req.machineName.trim() !== "") {
                return req.machineName;
              }
              return req.details || `Job #${req.id}`;
            };

            // Find all continuation child requests
            const childRequests = requests
              .filter((r) => r.parentJobId === req.id && r.jobType === "Continuation")
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            const formatDBTime = (r: CraneRequest) => {
              const timeRange = r.estimatedStartTime && r.estimatedEndTime 
                ? `${r.estimatedStartTime} – ${r.estimatedEndTime}`
                : "Shift Hours";
              const dateStr = r.date || r.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
              return `${timeRange} [${r.shift || "A"}] (${dateStr})`;
            };

            const formatStaggeredTime = (r: CraneRequest, stepIndex: number, totalSteps: number) => {
              const startStr = r.estimatedStartTime || "08:00";
              const endStr = r.estimatedEndTime || "16:00";
              const dateStr = r.date || r.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
              const shift = r.shift || "A";

              const parseTimeToMinutes = (time: string) => {
                const parts = time.split(":");
                if (parts.length >= 2) {
                  const h = parseInt(parts[0], 10);
                  const m = parseInt(parts[1], 10);
                  if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
                }
                return null;
              };

              const formatMinutesToTime = (mins: number) => {
                const h = Math.floor(mins / 60) % 24;
                const m = Math.round(mins % 60);
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              };

              const startMins = parseTimeToMinutes(startStr);
              const endMins = parseTimeToMinutes(endStr);

              if (startMins !== null && endMins !== null) {
                let diff = endMins - startMins;
                if (diff < 0) diff += 24 * 60; // handle overnight

                let stepStartPct = 0;
                let stepEndPct = 1;
                if (totalSteps === 3) {
                  if (stepIndex === 0) {
                    stepStartPct = 0;
                    stepEndPct = 0.5;
                  } else if (stepIndex === 1) {
                    stepStartPct = 0.5;
                    stepEndPct = 0.85;
                  } else {
                    stepStartPct = 0.85;
                    stepEndPct = 1.0;
                  }
                } else {
                  stepStartPct = stepIndex / totalSteps;
                  stepEndPct = (stepIndex + 1) / totalSteps;
                }

                const currentStartMins = Math.round((startMins + diff * stepStartPct) % (24 * 60));
                const currentEndMins = Math.round((startMins + diff * stepEndPct) % (24 * 60));

                const formattedStart = formatMinutesToTime(currentStartMins);
                const formattedEnd = formatMinutesToTime(currentEndMins);

                return `${formattedStart} – ${formattedEnd} [${shift}] (${dateStr})`;
              }

              return `${startStr} – ${endStr} [${shift}] (${dateStr})`;
            };

            // Helper to distribute overall completion rate across steps
            const getStepCompletion = (stepIndex: number, totalStepsCount: number, overallPct: number) => {
              if (overallPct >= 100) return 100;
              const stepWeight = 100 / totalStepsCount;
              const startWeight = stepIndex * stepWeight;
              const endWeight = (stepIndex + 1) * stepWeight;
              
              if (overallPct <= startWeight) return 0;
              if (overallPct >= endWeight) return 100;
              
              return Math.round(((overallPct - startWeight) / stepWeight) * 100);
            };

            // Compile steps for the tabular view
            let steps: Array<{
              num: string;
              stage: string;
              taskName: string;
              duration: number;
              weight: number;
              area: number;
              department: string;
              dbTime: string;
              completionRate: number;
            }> = [];

            if (childRequests.length > 0) {
              const pDur = calculateHours(req.estimatedStartTime, req.estimatedEndTime);
              steps.push({
                num: "①",
                stage: "Preparation",
                taskName: req.details || "Planning & Raw Material Setup",
                duration: pDur > 0 ? pDur : 5,
                weight: req.estimatedWeight,
                area: req.area,
                department: req.department,
                dbTime: formatDBTime(req),
                completionRate: req.completionPercentage !== undefined ? req.completionPercentage : (req.status === "Completed" ? 100 : 45)
              });

              childRequests.forEach((child, index) => {
                const cDur = calculateHours(child.estimatedStartTime, child.estimatedEndTime);
                const stageName = index === 0 ? "Fabrication" : index === 1 ? "Assembly" : "Testing";
                steps.push({
                  num: index === 0 ? "②" : index === 1 ? "③" : "④",
                  stage: stageName,
                  taskName: child.details || (index === 0 ? "Welding & Structuring" : "Inspection & Testing"),
                  duration: cDur > 0 ? cDur : 2,
                  weight: child.estimatedWeight,
                  area: child.area,
                  department: child.department || req.department,
                  dbTime: formatDBTime(child),
                  completionRate: child.completionPercentage !== undefined ? child.completionPercentage : (child.status === "Completed" ? 100 : 45)
                });
              });
            } else {
              // Generate realistic steps matching the image's structure exactly
              const totalD = totalTimeTaken;
              const w = req.estimatedWeight;
              
              const step1Dur = Number((totalD * 0.6).toFixed(1));
              const step2Dur = Number((totalD * 0.3).toFixed(1));
              const step3Dur = Number(Math.max(0.5, totalD - step1Dur - step2Dur).toFixed(1));

              steps = [
                {
                  num: "①",
                  stage: "Preparation",
                  taskName: "Planning & Setup",
                  duration: step1Dur,
                  weight: w,
                  area: req.area,
                  department: req.department,
                  dbTime: formatStaggeredTime(req, 0, 3),
                  completionRate: getStepCompletion(0, 3, pct)
                },
                {
                  num: "②",
                  stage: "Fabrication",
                  taskName: "Welding & Core Assembly",
                  duration: step2Dur,
                  weight: w,
                  area: req.area,
                  department: req.department,
                  dbTime: formatStaggeredTime(req, 1, 3),
                  completionRate: getStepCompletion(1, 3, pct)
                },
                {
                  num: "③",
                  stage: "Finishing & Testing",
                  taskName: "Inspection & Crane Tonnage Lift Test",
                  duration: step3Dur,
                  weight: w,
                  area: req.area,
                  department: req.department,
                  dbTime: formatStaggeredTime(req, 2, 3),
                  completionRate: getStepCompletion(2, 3, pct)
                }
              ];
            }

            return (
              <div 
                key={req.id}
                className={`bg-white rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414] overflow-hidden ${
                  isFinished ? "ring-2 ring-emerald-500/20 bg-emerald-50/5" : "bg-white"
                }`}
              >
                {/* Job Card Header */}
                <div className="p-4 border-b-2 border-[#141414] bg-zinc-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2.5">
                    <span className="font-mono font-black text-xs text-[#141414] bg-zinc-300 px-2.5 py-0.5 rounded-sm border-2 border-[#141414] w-fit">
                      {req.id}
                    </span>
                    <h3 className="font-sans font-black text-sm text-zinc-900 uppercase tracking-tight">
                      {getDisplayName()}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs border-2 border-[#141414] px-3 py-1 rounded-sm font-mono font-black shadow-[1.5px_1.5px_0px_#141414] ${
                      req.status === "Deferred"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-zinc-100 text-zinc-600"
                    }`}>
                      Deferred: {req.status === "Deferred" ? "YES" : "NO"}
                    </span>
                    <span className="text-xs bg-amber-100 text-amber-950 border-2 border-[#141414] px-3 py-1 rounded-sm font-mono font-black shadow-[1.5px_1.5px_0px_#141414]">
                      ⏱️ {totalTimeTaken.toFixed(1)} Hours Total
                    </span>
                  </div>
                </div>

                {/* Job Specifications Simple Tabular Form */}
                <div className="p-4 bg-white overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse border-2 border-[#141414]">
                    <thead>
                      <tr className="bg-zinc-100 border-b-2 border-[#141414]">
                        <th className="p-2.5 border-r-2 border-[#141414] font-black uppercase text-[#141414] text-[10px] w-16 text-center">
                          Sl.No
                        </th>
                        <th className="p-2.5 border-r-2 border-[#141414] font-black uppercase text-[#141414] text-[10px]">
                          Area No.
                        </th>
                        <th className="p-2.5 border-r-2 border-[#141414] font-black uppercase text-[#141414] text-[10px] w-28">
                          wt
                        </th>
                        <th className="p-2.5 font-black uppercase text-[#141414] text-[10px]">
                          Completion Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {steps.map((step, idx) => {
                        const stepCompPct = step.completionRate;
                        return (
                          <tr 
                            key={idx} 
                            className={`border-b-2 border-[#141414] last:border-b-0 hover:bg-zinc-50/50 transition-colors ${
                              stepCompPct === 100 ? "bg-emerald-50/10" : ""
                            }`}
                          >
                            <td className="p-2.5 border-r-2 border-[#141414] font-black text-zinc-900 text-center">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 border-r-2 border-[#141414] font-bold text-zinc-800">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-zinc-950 font-black uppercase text-[11px]">📍 Area {step.area} <span className="text-zinc-500 font-normal text-[9px]">({step.department})</span></span>
                                <span className="text-[10px] text-zinc-400 font-normal normal-case italic leading-tight">
                                  {req.machineName || req.details || step.taskName}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 border-r-2 border-[#141414] font-black text-zinc-900">
                              {step.weight} Tons
                            </td>
                            <td className="p-2.5">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="font-bold text-zinc-900 text-[10.5px]">📅 {step.dbTime}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-[11px] min-w-[36px] text-right ${
                                    stepCompPct === 100 ? "text-emerald-700" : stepCompPct > 0 ? "text-amber-700" : "text-zinc-400"
                                  }`}>
                                    {stepCompPct}%
                                  </span>
                                  <div className="w-16 bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-[#141414] flex-shrink-0">
                                    <div 
                                      className={`h-full ${stepCompPct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                                      style={{ width: `${stepCompPct}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
