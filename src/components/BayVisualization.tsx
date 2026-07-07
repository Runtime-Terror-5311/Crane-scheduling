import React, { useState, useEffect, useMemo } from "react";
import { Activity, AlertTriangle, Hammer, ShieldAlert, Compass } from "lucide-react";
import { Crane, Schedule, CraneRequest } from "../types";
import { isScheduleInShiftBoundary, isTimeWithinRange } from "../utils/shiftUtils";

interface BayVisualizationProps {
  cranes: Crane[];
  schedules: Schedule[];
  requests: CraneRequest[];
  selectedShift: string;
  selectedCraneFilter: string;
  selectedAreaFilter: string;
}

export default function BayVisualization({ 
  cranes, 
  schedules, 
  requests,
  selectedShift,
  selectedCraneFilter,
  selectedAreaFilter
}: BayVisualizationProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 5000); // Tick every 5 seconds for precise updates
    return () => clearInterval(timer);
  }, []);

  // Filter cranes based on selectedCraneFilter (do not filter out other cranes in the same bay by selectedAreaFilter to allow all operators to see all cranes)
  const visibleCranes = useMemo(() => {
    return cranes.filter((crane) => {
      // 1. Crane Filter: matches selectedCraneFilter
      if (selectedCraneFilter !== "ALL" && selectedCraneFilter !== crane.id) {
        return false;
      }

      return true;
    });
  }, [cranes, selectedCraneFilter]);

  // Check if there are any physical position conflicts dynamically based on sorted crane IDs on the runway track
  const sortedCranes = [...visibleCranes].sort((a, b) => a.id.localeCompare(b.id));
  const conflicts: string[] = [];
  for (let i = 0; i < sortedCranes.length - 1; i++) {
    const leftCrane = sortedCranes[i];
    const rightCrane = sortedCranes[i + 1];
    if (leftCrane.currentColumn >= rightCrane.currentColumn) {
      conflicts.push(`CRITICAL COLLISION RISK: Crane ${leftCrane.name || leftCrane.id} (Col ${leftCrane.currentColumn}) has crossed or blocked Crane ${rightCrane.name || rightCrane.id} (Col ${rightCrane.currentColumn})!`);
    }
  }

  // Find active or upcoming schedule for each crane to show what they are working on
  const getActiveJobDesc = (craneId: string) => {
    const craneJobs = schedules.filter((s) => {
      if (s.assignedCrane !== craneId && s.secondaryCrane !== craneId) return false;
      const origReq = requests.find((r) => r.id === s.requestId);
      const reqShift = origReq?.shift || "General Shift";
      if (!isScheduleInShiftBoundary(s.startTime, s.endTime, reqShift)) {
        return false;
      }
      if (selectedShift && selectedShift !== "ALL") {
        if (!origReq || origReq.shift !== selectedShift) return false;
      }
      return true;
    });

    if (craneJobs.length === 0) return "No Active Jobs Scheduled";
    const nextJob = craneJobs[0];
    const sCol = nextJob.startColumn !== undefined ? nextJob.startColumn : nextJob.column;
    const eCol = nextJob.endColumn !== undefined ? nextJob.endColumn : nextJob.column;
    const colStr = sCol === eCol ? `Col ${sCol}` : `Cols ${sCol}-${eCol}`;
    return `${colStr} (${nextJob.startTime}-${nextJob.endTime}): ${nextJob.remarks || "Material Transposition"}`;
  };

  // 1. Mobile Vertical Layout Representation
  if (isMobile) {
    return (
      <div id="bay_visualization" className="bg-white text-[#141414] rounded-sm border-4 border-[#141414] p-4 shadow-[4px_4px_0px_#141414] mb-6 relative overflow-hidden font-mono">
        {/* Header */}
        <div className="border-b-2 border-zinc-200 pb-3 mb-4">
          <h2 className="text-xs font-black uppercase tracking-tighter flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-600 border border-[#141414]"></span>
            Shop Floor Runway Array (Vertical Feed)
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5 font-bold">
            Live spatial telemetry feed. Scale ratio: 1 Column = 10 Meters.
          </p>
        </div>

        {/* Conflicts Banner */}
        {conflicts.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-sm text-xs space-y-1 text-red-950 shadow-[2px_2px_0px_#141414]">
            <div className="flex items-center gap-1.5 font-black text-red-600 uppercase tracking-tight">
              <ShieldAlert className="w-4 h-4 animate-bounce" />
              GEOMETRY COLLISION RISK DETECTED
            </div>
            <ul className="list-disc list-inside space-y-1 text-[10px] font-bold">
              {conflicts.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Vertical Track Layout */}
        <div className="relative flex bg-zinc-50 rounded-sm border-2 border-[#141414] p-2 min-h-[500px] overflow-hidden">
          
          {/* Steel Track Gantry (Vertical) */}
          <div className="absolute top-2 bottom-2 left-20 w-3 bg-zinc-200 border-x-2 border-[#141414] rounded-sm"></div>
          <div className="absolute top-2 bottom-2 left-21 w-1 bg-[repeating-linear-gradient(0deg,transparent,transparent_10px,#141414_10px,#141414_12px)] opacity-35"></div>

          {/* Column indicators rendered vertically on the left side */}
          <div className="flex flex-col justify-between w-16 text-right font-black border-r-2 border-zinc-200 pr-2.5 py-4 text-[9px] text-zinc-500">
            {Array.from({ length: 7 }, (_, i) => {
              const colNum = Math.round((30 * (6 - i)) / 6);
              const isColOne = colNum <= 1 ? 1 : colNum;
              return (
                <div key={i} className="flex items-center justify-end gap-1 font-bold">
                  <span>Col {isColOne}</span>
                  <span className="text-[7px]">◀</span>
                </div>
              );
            })}
          </div>

          {/* Live Crane Carriages Overlay (Vertical) */}
          <div className="relative flex-grow h-full min-h-[460px]">
            {visibleCranes.map((crane) => {
              // Percentage from top (Col 1 at top, Col 30 at bottom)
              const percentage = ((crane.currentColumn - 1) / 29) * 100;
              
              const isBusy = schedules.some((s) => {
                if (s.assignedCrane !== crane.id && s.secondaryCrane !== crane.id) return false;
                if (s.status === "Completed") return false;
                const origReq = requests.find((r) => r.id === s.requestId);
                if (origReq?.status === "Completed") return false;
                const reqShift = origReq?.shift || "General Shift";
                if (!isScheduleInShiftBoundary(s.startTime, s.endTime, reqShift)) {
                  return false;
                }
                if (!isTimeWithinRange(currentTime, s.startTime, s.endTime)) {
                  return false;
                }
                if (selectedShift && selectedShift !== "ALL") {
                  return origReq && origReq.shift === selectedShift;
                }
                return true;
              });
              const currentStatus = crane.status === "Maintenance" ? "Maintenance" : isBusy ? "Busy" : "Available";

              const statusBg = 
                currentStatus === "Maintenance"
                  ? "bg-red-600 text-white"
                  : currentStatus === "Busy"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-emerald-600 text-white";

              return (
                <div
                  key={crane.id}
                  className="absolute transition-all duration-1000 ease-in-out left-[16px] -translate-y-1/2 flex items-center z-10"
                  style={{ top: `${percentage}%` }}
                >
                  {/* Hook Line Connecting from the Track to Crane box */}
                  <div className="w-5 h-0.5 bg-[#141414] relative">
                    <div className="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-[#141414]"></div>
                  </div>

                  {/* Crane Visual Card */}
                  <div className={`px-2 py-1 rounded-sm ${statusBg} border-2 border-[#141414] shadow-[2px_2px_0px_#141414] text-center w-24`}>
                    <div className="text-[10px] font-black tracking-tight">{crane.id}</div>
                    <div className="text-[8px] uppercase font-black opacity-90 leading-tight">{currentStatus}</div>
                    <div className="text-[8px] font-bold">COL {crane.currentColumn}</div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Labels indicating area brackets */}
        <div className="flex flex-col gap-1.5 mt-4 text-[10px] font-black uppercase text-center">
          <div className="border border-[#141414] py-1 bg-zinc-100 text-zinc-900 shadow-[1px_1px_0px_#141414]">
            AREA 1 (COLUMNS 1-10)
          </div>
          <div className="border border-[#141414] py-1 bg-amber-500/10 text-amber-950 shadow-[1px_1px_0px_#141414]">
            AREA 2 (COLUMNS 11-20)
          </div>
          <div className="border border-[#141414] py-1 bg-zinc-200 text-zinc-900 shadow-[1px_1px_0px_#141414]">
            AREA 3 (COLUMNS 21-30)
          </div>
        </div>

        {/* Crane Health Details Summary Cards */}
        <div className="mt-4 space-y-3">
          {visibleCranes.map((crane) => {
            const isBusy = schedules.some((s) => {
              if (s.assignedCrane !== crane.id && s.secondaryCrane !== crane.id) return false;
              if (s.status === "Completed") return false;
              const origReq = requests.find((r) => r.id === s.requestId);
              if (origReq?.status === "Completed") return false;
              const reqShift = origReq?.shift || "General Shift";
              if (!isScheduleInShiftBoundary(s.startTime, s.endTime, reqShift)) {
                return false;
              }
              if (!isTimeWithinRange(currentTime, s.startTime, s.endTime)) {
                return false;
              }
              if (selectedShift && selectedShift !== "ALL") {
                return origReq && origReq.shift === selectedShift;
              }
              return true;
            });
            const currentStatus = crane.status === "Maintenance" ? "Maintenance" : isBusy ? "Busy" : "Available";

            const statusBg = 
              currentStatus === "Maintenance"
                ? "bg-red-50 border-red-500 text-red-950"
                : currentStatus === "Busy"
                ? "bg-amber-50 border-amber-600 text-amber-950"
                : "bg-emerald-50 border-emerald-600 text-emerald-950";

            return (
              <div key={crane.id} className={`p-3 rounded-sm border-2 border-[#141414] shadow-[2px_2px_0px_#141414] ${statusBg} flex flex-col gap-1`}>
                <div className="flex items-center justify-between border-b border-current/25 pb-1 font-bold">
                  <span className="font-black text-xs text-[#141414] uppercase">{crane.name}</span>
                  <span className="text-[8px] px-1 bg-zinc-900 text-white font-black rounded-sm uppercase">
                    {crane.capacity}T CAP
                  </span>
                </div>
                <div className="text-[10px] space-y-0.5 font-semibold">
                  <div className="flex justify-between">
                    <span>Physical Bounds:</span>
                    <span className="text-zinc-600 font-bold">Cols {crane.minColumn || 1}-{crane.maxColumn || 30}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Position:</span>
                    <span className="text-[#141414] font-black">Col {crane.currentColumn}</span>
                  </div>
                  {crane.status === "Maintenance" ? (
                    <div className="text-[9px] text-red-900 flex items-start gap-1 mt-1 p-1 bg-red-100 border border-red-400 rounded-sm">
                      <Hammer className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span>{crane.maintenanceNotes || "Scheduled Safety Audit."}</span>
                    </div>
                  ) : (
                    <div className="text-[9px] text-zinc-800 flex items-start gap-1 mt-1 p-1 bg-white border border-zinc-300 rounded-sm">
                      <Activity className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#141414]" />
                      <span className="truncate font-semibold">{getActiveJobDesc(crane.id)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Desktop Horizontal Layout Representation
  return (
    <div id="bay_visualization" className="bg-white text-[#141414] rounded-sm border-4 border-[#141414] p-6 shadow-[6px_6px_0px_#141414] mb-8 relative overflow-hidden industrial-grid">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-zinc-200 pb-4 mb-6">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-600 border border-[#141414]"></span>
            Shop Floor Runway Array (Columns 1-30)
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5 font-bold">
            Live spatial telemetry feed. Scale ratio: 1 Column = 10 Meters.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-mono font-bold">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-300">
            <span className="status-led led-green"></span>
            AVAILABLE
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-300">
            <span className="status-led led-orange animate-pulse"></span>
            ACTIVE HOIST
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-zinc-50 border border-zinc-300">
            <span className="status-led led-red"></span>
            MAINTENANCE
          </span>
        </div>
      </div>

      {/* Conflicts Banner */}
      {conflicts.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-sm text-xs space-y-2 text-red-950 font-mono shadow-[2px_2px_0px_#141414]">
          <div className="flex items-center gap-2 font-black text-red-600 uppercase tracking-tight">
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            CRITICAL GEOMETRY COLLISION OVERRIDE
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] font-bold">
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Runway Layout Container */}
      <div className="relative mt-12 mb-10 px-2 pt-14 pb-4 bg-zinc-50 rounded-sm border-2 border-[#141414]">
        
        {/* Crane Tracks Steel Structure Line */}
        <div className="absolute top-18 left-2 right-2 h-3 bg-zinc-200 border-y-2 border-[#141414] rounded-sm"></div>
        <div className="absolute top-19 left-2 right-2 h-1 bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,#141414_10px,#141414_12px)] opacity-35"></div>

        {/* Live Crane Carriages Overlay */}
        <div className="relative h-16">
          {visibleCranes.map((crane) => {
            const percentage = ((crane.currentColumn - 0.5) / 30) * 100;
            
            const isBusy = schedules.some((s) => {
              if (s.assignedCrane !== crane.id && s.secondaryCrane !== crane.id) return false;
              if (s.status === "Completed") return false;
              const origReq = requests.find((r) => r.id === s.requestId);
              if (origReq?.status === "Completed") return false;
              const reqShift = origReq?.shift || "General Shift";
              if (!isScheduleInShiftBoundary(s.startTime, s.endTime, reqShift)) {
                return false;
              }
              if (!isTimeWithinRange(currentTime, s.startTime, s.endTime)) {
                return false;
              }
              if (selectedShift && selectedShift !== "ALL") {
                return origReq && origReq.shift === selectedShift;
              }
              return true;
            });
            const currentStatus = crane.status === "Maintenance" ? "Maintenance" : isBusy ? "Busy" : "Available";

            const statusBg = 
              currentStatus === "Maintenance"
                ? "bg-red-600 text-white"
                : currentStatus === "Busy"
                ? "bg-amber-500 text-slate-950"
                : "bg-emerald-600 text-white";

            return (
              <div
                key={crane.id}
                className="absolute transition-all duration-1000 ease-in-out -top-14 -translate-x-1/2 flex flex-col items-center z-10"
                style={{ left: `${percentage}%` }}
              >
                {/* Crane Visual Card */}
                <div className={`px-2.5 py-1.5 rounded-sm ${statusBg} border-2 border-[#141414] shadow-[3px_3px_0px_#141414] text-center font-mono select-none w-20 crane-box-shape`}>
                  <div className="text-[12px] font-black tracking-tight">{crane.id}</div>
                  <div className="text-[8px] uppercase font-black opacity-90">{currentStatus}</div>
                  <div className="text-[8px] font-bold">COL {crane.currentColumn}</div>
                </div>
                {/* Visual Connection Hook */}
                <div className="w-1 bg-[#141414] h-10 -mt-0.5 relative">
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-[#141414] border border-white flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">&#8226;</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Runway Column Indicators 1-30 */}
        <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0 border-t-2 border-[#141414] pt-3 text-[10px] font-mono text-zinc-700">
          {Array.from({ length: 30 }, (_, i) => {
            const colNum = i + 1;
            const isArea1 = colNum <= 10;
            const isArea2 = colNum > 10 && colNum <= 20;
            const bgClass = isArea1 
              ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-r border-zinc-200" 
              : isArea2 
              ? "bg-amber-100/30 hover:bg-amber-100 text-amber-950 border-r border-zinc-200" 
              : "bg-zinc-200/30 hover:bg-zinc-200 text-zinc-900 border-r border-zinc-200";

            return (
              <div
                key={colNum}
                className={`flex flex-col items-center py-2 last:border-r-0 ${bgClass} transition-colors`}
                title={`Column ${colNum} | Area ${isArea1 ? 1 : isArea2 ? 2 : 3}`}
              >
                <div className="font-extrabold">{colNum}</div>
                {colNum % 5 === 0 && <span className="text-[8px] text-[#141414]">▲</span>}
              </div>
            );
          })}
        </div>

        {/* Labels underneath the areas */}
        <div className="grid grid-cols-3 text-center mt-3 text-[10px] font-mono font-bold">
          <div className="border-2 border-[#141414] py-1.5 bg-zinc-100 text-zinc-900 shadow-[2px_2px_0px_#141414]">AREA 1 (COLUMNS 1-10)</div>
          <div className="border-y-2 border-r-2 border-[#141414] py-1.5 bg-amber-500/20 text-amber-950 shadow-[2px_2px_0px_#141414]">AREA 2 (COLUMNS 11-20)</div>
          <div className="border-y-2 border-r-2 border-[#141414] py-1.5 bg-zinc-200 text-zinc-900 shadow-[2px_2px_0px_#141414]">AREA 3 (COLUMNS 21-30)</div>
        </div>
      </div>

      {/* Crane Health & Active Load Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        {visibleCranes.map((crane) => {
          const isBusy = schedules.some((s) => {
            if (s.assignedCrane !== crane.id && s.secondaryCrane !== crane.id) return false;
            if (s.status === "Completed") return false;
            const origReq = requests.find((r) => r.id === s.requestId);
            if (origReq?.status === "Completed") return false;
            const reqShift = origReq?.shift || "General Shift";
            if (!isScheduleInShiftBoundary(s.startTime, s.endTime, reqShift)) {
              return false;
            }
            if (!isTimeWithinRange(currentTime, s.startTime, s.endTime)) {
              return false;
            }
            if (selectedShift && selectedShift !== "ALL") {
              return origReq && origReq.shift === selectedShift;
            }
            return true;
          });
          const currentStatus = crane.status === "Maintenance" ? "Maintenance" : isBusy ? "Busy" : "Available";

          const statusBg = 
            currentStatus === "Maintenance"
              ? "bg-red-50 border-red-500 text-red-950"
              : currentStatus === "Busy"
              ? "bg-amber-50 border-amber-600 text-amber-950"
              : "bg-emerald-50 border-emerald-600 text-emerald-950";

          return (
            <div key={crane.id} className={`p-4 rounded-sm border-2 border-[#141414] shadow-[3px_3px_0px_#141414] ${statusBg} flex flex-col gap-2`}>
              <div className="flex items-center justify-between border-b border-current/20 pb-1.5">
                <span className="font-black text-xs text-[#141414] uppercase">{crane.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-zinc-900 text-white font-black rounded-sm">
                  {crane.capacity} TON CAP
                </span>
              </div>
              <div className="text-[10px] space-y-1 mt-1 font-bold">
                <div className="flex justify-between">
                  <span>Allocated Area:</span>
                  <span className="text-[#141414]">Col {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : (crane.id === "A1" ? 1 : crane.id === "A2" ? 11 : 21)}-{crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : (crane.id === "A1" ? 10 : crane.id === "A2" ? 20 : 30)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Physical Range:</span>
                  <span className="text-zinc-600 font-extrabold">Columns {crane.minColumn || 1}-{crane.maxColumn || 30}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Position:</span>
                  <span className="text-[#141414]">Column {crane.currentColumn}</span>
                </div>
                {crane.status === "Maintenance" ? (
                  <div className="text-[10px] text-red-900 flex items-start gap-1 mt-2 p-1.5 bg-red-100 border border-red-400 rounded-sm">
                    <Hammer className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{crane.maintenanceNotes || "Scheduled Safety Audit."}</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-800 flex items-start gap-1 mt-2 p-1.5 bg-white border border-zinc-300 rounded-sm">
                    <Activity className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#141414]" />
                    <span className="truncate font-medium">{getActiveJobDesc(crane.id)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
