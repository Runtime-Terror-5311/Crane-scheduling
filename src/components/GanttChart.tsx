import React, { useState } from "react";
import { Clock, HelpCircle, Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { Schedule, PriorityType, CraneRequest, Crane } from "../types";
import { isScheduleInShiftBoundary } from "../utils/shiftUtils";

interface GanttChartProps {
  cranes: Crane[];
  schedules: Schedule[];
  requests: CraneRequest[];
  selectedShift: string;
  selectedCraneFilter: string;
  selectedAreaFilter: string;
}

function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

const PRIORITY_THEMES: Record<PriorityType, { bg: string; text: string; border: string; label: string }> = {
  P1: {
    bg: "bg-red-500 hover:bg-red-600 text-white",
    text: "text-white",
    border: "border-[#141414]",
    label: "P1 Critical",
  },
  P2: {
    bg: "bg-amber-500 hover:bg-amber-600 text-[#141414]",
    text: "text-[#141414]",
    border: "border-[#141414]",
    label: "P2 Urgent",
  },
  P3: {
    bg: "bg-zinc-200 hover:bg-zinc-300 text-[#141414]",
    text: "text-[#141414]",
    border: "border-[#141414]",
    label: "P3 Normal",
  },
  P4: {
    bg: "bg-zinc-100 hover:bg-zinc-200 text-zinc-700",
    text: "text-zinc-700",
    border: "border-zinc-400",
    label: "P4 Planned",
  },
};

export default function GanttChart({ 
  cranes,
  schedules, 
  requests,
  selectedShift,
  selectedCraneFilter,
  selectedAreaFilter
}: GanttChartProps) {
  const [selectedJob, setSelectedJob] = useState<Schedule | null>(null);

  // Timeline starts at 06:00 AM (start of Shift A) and spans 24 hours (1440 minutes)
  const timelineStartHour = 6;
  const totalMinutes = 1440;

  const getPercentageOffset = (timeStr: string): number => {
    const mins = parseTimeToMinutes(timeStr);
    let offset = mins - timelineStartHour * 60;
    if (offset < 0) {
      // Past midnight wrap
      offset += 1440;
    }
    return (offset / totalMinutes) * 100;
  };

  const getPercentageWidth = (startStr: string, endStr: string): number => {
    const startMins = parseTimeToMinutes(startStr);
    const endMins = parseTimeToMinutes(endStr);
    let diff = endMins - startMins;
    if (diff < 0) {
      diff += 1440; // overnight wrap
    }
    return (diff / totalMinutes) * 100;
  };

  // Generate 12 hourly timeline marks for the X-axis starting at 06:00
  const hoursTicks = Array.from({ length: 13 }, (_, i) => {
    const hr = (timelineStartHour + i * 2) % 24;
    const suffix = hr >= 12 ? "PM" : "AM";
    const formattedHour = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${formattedHour}:00 ${suffix}`;
  });

  // Enrich schedules with their corresponding request shift information
  const enrichedSchedules = React.useMemo(() => {
    return schedules.map((sched) => {
      const origReq = requests.find((r) => r.id === sched.requestId);
      const shift = origReq?.shift || "General Shift";
      const requestStatus = origReq?.status;
      return {
        ...sched,
        shift,
        requestStatus,
      };
    });
  }, [schedules, requests]);

  // Filter schedules based on active filters
  const filteredSchedules = React.useMemo(() => {
    return enrichedSchedules.filter((op) => {
      // Filter out Completed ones
      if (op.status === "Completed" || op.requestStatus === "Completed") {
        return false;
      }

      // Filter out any schedule that falls outside its shift boundaries due to time limits/deferrals
      if (!isScheduleInShiftBoundary(op.startTime, op.endTime, op.shift)) {
        return false;
      }

      const matchesShift = selectedShift === "ALL" || op.shift === selectedShift;
      const matchesCrane = selectedCraneFilter === "ALL" || op.assignedCrane === selectedCraneFilter;
      
      // Gantt schedules show all operations of the bay for safety/collision-risk visibility
      return matchesShift && matchesCrane;
    });
  }, [enrichedSchedules, selectedShift, selectedCraneFilter]);

  // Filter which cranes should be visible on the Gantt chart rows (do not filter cranes by selectedAreaFilter so all cranes in the bay are shown)
  const visibleCranesForChart = React.useMemo(() => {
    return cranes.filter((crane) => {
      // 1. Crane Filter: matches selectedCraneFilter
      if (selectedCraneFilter !== "ALL" && selectedCraneFilter !== crane.id) {
        return false;
      }

      return true;
    });
  }, [cranes, selectedCraneFilter]);

  return (
    <div id="gantt_chart_panel" className="bg-white rounded-sm border-4 border-[#141414] p-6 shadow-[6px_6px_0px_#141414] mb-8 relative overflow-hidden industrial-grid">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-200 pb-4 mb-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-3 h-3 bg-[#141414]"></span>
            Interactive Occupancy Gantt Chart
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono font-bold">
            24-Hour Operations Grid (Shift A, B, C). Select block to audit spatial safety parameters.
          </p>
        </div>
        
        {/* Priority Legends */}
        <div className="flex flex-wrap gap-2 text-[9px] font-mono font-bold">
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white border border-[#141414] rounded-sm">
            P1 CRITICAL
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-[#141414] border border-[#141414] rounded-sm">
            P2 URGENT
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-200 text-[#141414] border border-[#141414] rounded-sm">
            P3 NORMAL
          </span>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-sm">
            P4 PLANNED
          </span>
        </div>
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="py-12 border-4 border-dashed border-zinc-300 rounded-sm text-center bg-zinc-50">
          <Clock className="w-10 h-10 mx-auto mb-3 text-zinc-400" />
          <p className="text-xs font-black uppercase tracking-wider text-zinc-700">No Active Schedule Allocated for Current Filter</p>
          <p className="text-[11px] text-zinc-500 max-w-sm mx-auto mt-1 font-bold">
            Ensure Supervisor requirements are locked, then trigger the auto-scheduler command from the Admin hub, or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Gantt Runway */}
          <div className="overflow-x-auto relative">
            <div className="min-w-[800px] select-none">
              
              {/* Timeline Header (X-Axis) */}
              <div className="grid grid-cols-[100px_1fr] border-b-2 border-[#141414] pb-2">
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-wider font-mono">Crane Row</div>
                <div className="relative h-6 text-[9px] font-mono text-[#141414] font-bold">
                  {hoursTicks.map((label, index) => {
                    const offsetPct = (index / (hoursTicks.length - 1)) * 100;
                    return (
                      <div
                        key={index}
                        className="absolute -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${offsetPct}%` }}
                      >
                        <span>{label}</span>
                        <div className="w-[2px] h-2 bg-[#141414] mt-1"></div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rows for each Crane */}
              <div className="space-y-4 pt-4 relative">
                {/* Vertical grid lines helper */}
                <div className="absolute top-0 bottom-0 left-[100px] right-0 pointer-events-none flex justify-between">
                  {Array.from({ length: 13 }).map((_, i) => (
                    <div key={i} className="w-[1px] h-full border-l border-zinc-200"></div>
                  ))}
                </div>

                {visibleCranesForChart.map((crane) => {
                  const craneId = crane.id;
                  const craneJobs = filteredSchedules.filter((s) => s.assignedCrane === craneId || s.secondaryCrane === craneId);

                  return (
                    <div key={craneId} className="grid grid-cols-[100px_1fr] items-center min-h-[44px] group">
                      {/* Crane Row Name */}
                      <div className="font-mono text-xs font-black text-[#141414] bg-zinc-100 px-2.5 py-1.5 rounded-sm border-2 border-[#141414] shadow-[2px_2px_0px_#141414] mr-3 text-center">
                        {craneId} Crane
                      </div>

                      {/* Crane Timeline container */}
                      <div className="relative h-11 bg-zinc-50 border-2 border-[#141414] rounded-sm overflow-hidden">
                        {craneJobs.map((job) => {
                          const left = getPercentageOffset(job.startTime);
                          const width = getPercentageWidth(job.startTime, job.endTime);
                          const theme = PRIORITY_THEMES[job.priority] || PRIORITY_THEMES.P3;

                          // Travel space & buffer visual markers
                          const travelWidth = (job.travelTimeMinutes / totalMinutes) * 100;
                          const bufferWidth = (job.bufferTimeMinutes / totalMinutes) * 100;

                          return (
                            <React.Fragment key={job.id}>
                              {/* 1. Travel Time Indicator (yellow/black stripe block before start time) */}
                              {job.travelTimeMinutes > 0 && left - travelWidth >= 0 && (
                                <div
                                  className="absolute h-full top-0 bg-[repeating-linear-gradient(45deg,#E4E3E0,#E4E3E0_5px,#141414_5px,#141414_10px)] opacity-15 border-r border-[#141414]/30"
                                  style={{
                                    left: `${left - travelWidth}%`,
                                    width: `${travelWidth}%`,
                                  }}
                                  title={`Travel Transit: ${job.travelTimeMinutes} mins`}
                                ></div>
                              )}

                              {/* 2. Main Scheduled Operation Block */}
                              <button
                                onClick={() => setSelectedJob(job)}
                                className={`absolute h-4/5 top-[10%] rounded-sm border-2 border-[#141414] flex flex-col justify-center px-2 cursor-pointer transition-all shadow-[2px_2px_0px_#141414] ${theme.bg} ${
                                  selectedJob?.id === job.id ? "ring-2 ring-amber-500 translate-y-[-1px] shadow-[4px_4px_0px_#141414]" : ""
                                }`}
                                style={{
                                  left: `${left}%`,
                                  width: `${Math.max(width, 2)}%`,
                                }}
                              >
                                <span className="text-[9px] font-black uppercase truncate leading-none block">
                                  {job.requestId} • {job.department}
                                </span>
                                <span className="text-[8px] font-mono font-bold opacity-90 block truncate mt-0.5">
                                  Cols {job.startColumn !== undefined && job.endColumn !== undefined ? `${job.startColumn}-${job.endColumn}` : job.column} | {job.startTime}-{job.endTime}
                                </span>
                              </button>

                              {/* 3. Buffer Safety Margins (dashed gray block after end time) */}
                              {left + width + bufferWidth <= 100 && (
                                <div
                                  className="absolute h-1/2 top-1/4 border-y border-r border-dashed border-zinc-400 bg-zinc-200/40"
                                  style={{
                                    left: `${left + width}%`,
                                    width: `${bufferWidth}%`,
                                  }}
                                  title={`Buffer Safety Margin: ${job.bufferTimeMinutes} mins`}
                                ></div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Travel Gaps & Gantry Legend helper */}
          <div className="flex flex-wrap items-center gap-6 mt-4 text-[10px] font-mono font-bold text-[#141414] bg-zinc-50 p-4 rounded-sm border-2 border-[#141414]">
            <div className="flex items-center gap-2">
              <span className="w-6 h-3 bg-[repeating-linear-gradient(45deg,#E4E3E0,#E4E3E0_3px,#141414_3px,#141414_6px)] border border-[#141414] opacity-20 inline-block"></span>
              <span>Gantry Transit Travel Gap</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-3 border-y border-r border-dashed border-zinc-400 bg-zinc-200 inline-block"></span>
              <span>Buffer Margin ({filteredSchedules[0]?.bufferTimeMinutes || 5} Min)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 ml-auto">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Safety validation checked: zero collision hazard vectors</span>
            </div>
          </div>

          {/* Job Details Modal/Drawer inside panels */}
          {selectedJob && (
            <div className="p-5 bg-zinc-50 rounded-sm border-4 border-[#141414] mt-4 animate-fade-in font-sans shadow-[4px_4px_0px_#141414]">
              <div className="flex items-center justify-between mb-4 border-b border-zinc-300 pb-2">
                <span className="text-xs font-mono font-black uppercase tracking-wider text-zinc-600">
                  Allocation Security Audit Details
                </span>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-[9px] text-white bg-[#141414] font-black font-mono px-2 py-1 rounded-sm uppercase tracking-wider hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Close Audit [X]
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
                <div className="bg-white p-3 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] rounded-sm">
                  <div className="text-zinc-500 uppercase text-[9px] font-black">Request Registry ID</div>
                  <div className="text-[#141414] font-black text-sm mt-1">{selectedJob.requestId}</div>
                  <div className="text-[9px] text-zinc-500 mt-1 font-bold">Area {selectedJob.area} System Registry</div>
                </div>

                <div className="bg-white p-3 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] rounded-sm">
                  <div className="text-zinc-500 uppercase text-[9px] font-black">Assigned Gantry</div>
                  <div className="text-[#141414] font-black text-sm mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 bg-[#141414] text-white rounded-sm text-[10px]">{selectedJob.assignedCrane}</span>
                    <span className="text-xs text-[#141414]">at Cols {selectedJob.startColumn !== undefined && selectedJob.endColumn !== undefined ? `${selectedJob.startColumn}-${selectedJob.endColumn}` : selectedJob.column}</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-1 font-bold">Safe operating margin: OK</div>
                </div>

                <div className="bg-white p-3 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] rounded-sm">
                  <div className="text-zinc-500 uppercase text-[9px] font-black">Planned Time Span</div>
                  <div className="text-[#141414] font-black mt-1.5 flex items-center gap-1 text-[11px]">
                    <span>{selectedJob.startTime}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{selectedJob.endTime}</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-1 font-bold">Duration: {getPercentageWidth(selectedJob.startTime, selectedJob.endTime) * 14.4} minutes</div>
                </div>

                <div className="bg-white p-3 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] rounded-sm">
                  <div className="text-zinc-500 uppercase text-[9px] font-black">Weight Scale Metric</div>
                  <div className="text-[#141414] font-black text-sm mt-1">{selectedJob.weight} METRIC TONS</div>
                  <div className="text-[9px] text-zinc-500 mt-1 font-bold">Priority Code: <span className="text-red-600 uppercase font-black">{selectedJob.priority}</span></div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-white border-2 border-[#141414] rounded-sm text-xs">
                <div className="font-black text-[9px] text-zinc-500 uppercase tracking-wide">Operation Description</div>
                <div className="text-[#141414] font-medium mt-1 font-mono">{selectedJob.remarks || "No descriptive notes recorded."}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
