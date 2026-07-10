import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  HardHat, 
  Download, 
  Filter, 
  Search, 
  Weight, 
  Layers, 
  Building2, 
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { Schedule, CraneRequest, Crane, PriorityType } from "../types";
import { generateScheduledHistoryPDF } from "../utils/pdfGenerator";
import { formatTimeTo12Hr } from "../utils/shiftUtils";

interface CraneCalendarProps {
  schedules: Schedule[];
  requests: CraneRequest[];
  cranes: Crane[];
}

export default function CraneCalendar({ schedules, requests, cranes }: CraneCalendarProps) {
  // Filter states
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default to 30 days ago
    return d.toISOString().split("T")[0];
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0]; // Default to today
  });

  const [selectedShift, setSelectedShift] = useState<string>("ALL");
  const [selectedCrane, setSelectedCrane] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Map schedules to include full request attributes
  const mappedHistory = useMemo(() => {
    return schedules.map((sched) => {
      const req = requests.find((r) => r.id === sched.requestId);
      const dateStr = req?.date || (req?.createdAt ? req.createdAt.split("T")[0] : new Date().toISOString().split("T")[0]);
      return {
        ...sched,
        date: dateStr,
        shift: req?.shift || "General Shift",
        department: req?.department || sched.department || "Production",
        priority: req?.priority || sched.priority || "P3",
        weight: req?.estimatedWeight || sched.weight || 0,
        remarks: req?.remarks || sched.remarks || "",
        status: req?.status || sched.status || "Scheduled",
        bay: req?.bay || sched.bay || "A",
      };
    }).sort((a, b) => b.date.localeCompare(a.date)); // Newest first
  }, [schedules, requests]);

  // Apply filters to mapped history
  const filteredHistory = useMemo(() => {
    return mappedHistory.filter((job) => {
      // Date filter
      if (startDate && job.date < startDate) return false;
      if (endDate && job.date > endDate) return false;

      // Shift filter
      if (selectedShift !== "ALL" && job.shift !== selectedShift) return false;

      // Crane filter
      if (selectedCrane !== "ALL" && job.assignedCrane !== selectedCrane && job.secondaryCrane !== selectedCrane) {
        return false;
      }

      // Search term (Dept, Gantry, Remarks, ID)
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          job.department.toLowerCase().includes(term) ||
          job.assignedCrane.toLowerCase().includes(term) ||
          (job.secondaryCrane || "").toLowerCase().includes(term) ||
          job.remarks.toLowerCase().includes(term) ||
          job.id.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [mappedHistory, startDate, endDate, selectedShift, selectedCrane, searchTerm]);

  // Summary statistics metrics
  const stats = useMemo(() => {
    const totalJobs = filteredHistory.length;
    const totalWeight = filteredHistory.reduce((sum, job) => sum + (job.weight || 0), 0);
    const criticalLifts = filteredHistory.filter(job => job.priority === "P1" || job.isTandemLift).length;
    
    const uniqueCranes = new Set<string>();
    filteredHistory.forEach(job => {
      if (job.assignedCrane) uniqueCranes.add(job.assignedCrane);
      if (job.secondaryCrane) uniqueCranes.add(job.secondaryCrane);
    });

    return {
      totalJobs,
      totalWeight,
      criticalLifts,
      activeCranes: uniqueCranes.size
    };
  }, [filteredHistory]);

  const getPriorityBadgeClass = (priority: PriorityType) => {
    switch (priority) {
      case "P1":
        return "bg-red-50 border-2 border-red-500 text-red-950 font-black";
      case "P2":
        return "bg-orange-50 border-2 border-orange-500 text-orange-950 font-black";
      case "P3":
        return "bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black";
      default:
        return "bg-zinc-100 border-2 border-zinc-500 text-zinc-900";
    }
  };

  const handleDownloadPDF = () => {
    generateScheduledHistoryPDF(filteredHistory, startDate, endDate, selectedShift);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-zinc-900 border-4 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500 text-slate-950 border-2 border-slate-950 rounded-sm">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white font-mono">
              Scheduled Jobs History
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Comprehensive audit registry of scheduled, active, and completed crane requirements.
          </p>
        </div>

        <button
          id="btn_download_history_pdf"
          onClick={handleDownloadPDF}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 border-2 border-[#141414] text-slate-950 rounded-sm text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_#141414] active:translate-y-0.5 transition-all font-mono"
          title="Download PDF report of current filtered registry history"
        >
          <Download className="w-4 h-4" />
          Generate PDF Report
        </button>
      </div>

      {/* Dynamic Filters Form */}
      <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-4 font-mono text-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Filter className="w-4 h-4 text-amber-500" />
          <span className="font-black text-zinc-900 uppercase">Filters & Query Parameters</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
            />
          </div>

          {/* Shift Select */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
              Shift Option
            </label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
            >
              <option value="ALL">All Shifts (ALL)</option>
              <option value="Shift A">Shift A (06:00 AM - 02:00 PM)</option>
              <option value="Shift B">Shift B (02:00 PM - 10:00 PM)</option>
              <option value="Shift C">Shift C (10:00 PM - 06:00 AM)</option>
              <option value="General Shift">General Shift (09:00 AM - 06:30 PM)</option>
            </select>
          </div>

          {/* Crane/Gantry Select */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
              Gantry/Crane
            </label>
            <select
              value={selectedCrane}
              onChange={(e) => setSelectedCrane(e.target.value)}
              className="w-full p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
            >
              <option value="ALL">All Cranes (ALL)</option>
              {cranes.map((crane) => (
                <option key={crane.id} value={crane.id}>
                  Gantry {crane.id} ({crane.capacity} Ton)
                </option>
              ))}
            </select>
          </div>

          {/* Live Search */}
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">
              Search Remarks / Dept
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 p-2 bg-white border-2 border-[#141414] rounded-sm text-zinc-900 font-black"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bento Statistics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-zinc-50 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] p-4 rounded-sm flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 text-amber-400 border border-zinc-700 rounded-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Filtered Jobs</span>
            <span className="text-xl font-black font-mono text-zinc-900">{stats.totalJobs} Tasks</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-zinc-50 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] p-4 rounded-sm flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 text-amber-400 border border-zinc-700 rounded-sm">
            <Weight className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Total Weight</span>
            <span className="text-xl font-black font-mono text-zinc-900">{stats.totalWeight} Tons</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-zinc-50 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] p-4 rounded-sm flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 text-amber-400 border border-zinc-700 rounded-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Critical Lifts</span>
            <span className="text-xl font-black font-mono text-zinc-900">{stats.criticalLifts} High</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-zinc-50 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] p-4 rounded-sm flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 text-amber-400 border border-zinc-700 rounded-sm">
            <HardHat className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-black text-zinc-500 uppercase">Active Assets</span>
            <span className="text-xl font-black font-mono text-zinc-900">{stats.activeCranes} Gantries</span>
          </div>
        </div>
      </div>

      {/* Main Table / List Box */}
      <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] overflow-hidden">
        <div className="bg-zinc-950 p-3 px-4 border-b-2 border-[#141414] flex justify-between items-center text-white font-mono text-xs">
          <div className="flex items-center gap-2 font-black">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>ARCHIVED LOGS ({filteredHistory.length} ENTRIES FOUND)</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-bold hidden sm:inline">
            A4 Landcape Export Optimized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans">
            <thead>
              <tr className="bg-zinc-100 border-b-2 border-[#141414] text-[#141414] font-mono text-[11px] font-black uppercase">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Gantry/Crane</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Dept</th>
                <th className="py-3 px-4">Time Window</th>
                <th className="py-3 px-4">Bay & Column</th>
                <th className="py-3 px-4 text-right">Weight</th>
                <th className="py-3 px-4 text-center">Priority</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((job) => {
                  const isTandem = job.isTandemLift || !!job.secondaryCrane;
                  return (
                    <tr 
                      key={job.id} 
                      className={`hover:bg-amber-50/10 transition-colors ${
                        isTandem ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-4 font-mono font-black text-zinc-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{job.date}</span>
                        </div>
                      </td>

                      {/* Gantry/Crane */}
                      <td className="py-3 px-4 font-mono">
                        {isTandem ? (
                          <div className="space-y-0.5">
                            <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-black border border-slate-950 text-[10px] rounded-sm mr-1">Tandem</span>
                            <span className="font-extrabold text-[#141414]">{job.assignedCrane} + {job.secondaryCrane}</span>
                          </div>
                        ) : (
                          <span className="font-black text-[#141414] bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded-sm">
                            Gantry {job.assignedCrane}
                          </span>
                        )}
                      </td>

                      {/* Shift */}
                      <td className="py-3 px-4 font-mono text-zinc-600 font-bold whitespace-nowrap">
                        {job.shift}
                      </td>

                      {/* Dept */}
                      <td className="py-3 px-4">
                        <span className="bg-zinc-100 text-zinc-800 border border-zinc-300 px-2 py-0.5 text-[10px] font-black font-mono uppercase rounded-sm whitespace-nowrap">
                          {job.department}
                        </span>
                      </td>

                      {/* Time Window */}
                      <td className="py-3 px-4 font-mono text-zinc-900 font-black whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{formatTimeTo12Hr(job.startTime)}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-zinc-400 shrink-0" />
                          <span>{formatTimeTo12Hr(job.endTime)}</span>
                        </div>
                      </td>

                      {/* Location (Bay & Column) */}
                      <td className="py-3 px-4 font-mono font-bold text-zinc-800">
                        Bay {job.bay || "A"} : Col {job.startColumn !== undefined && job.endColumn !== undefined ? `${job.startColumn}-${job.endColumn}` : job.column}
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-4 font-mono font-black text-zinc-900 text-right whitespace-nowrap">
                        {job.weight} Ton
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase border ${getPriorityBadgeClass(job.priority)}`}>
                          {job.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className={`px-2 py-0.5 rounded-sm text-[9px] font-black uppercase border ${
                          job.status === "Completed" ? "bg-emerald-100 border-emerald-400 text-emerald-950" :
                          job.status === "In Progress" ? "bg-amber-100 border-amber-400 text-amber-950" :
                          "bg-blue-100 border-blue-400 text-blue-950"
                        }`}>
                          {job.status}
                        </span>
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 text-zinc-600 max-w-[200px] truncate" title={job.remarks}>
                        {job.remarks || "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-zinc-400 font-mono text-xs">
                    No scheduled operations matched the selected filters. Change date ranges or shift selections above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
