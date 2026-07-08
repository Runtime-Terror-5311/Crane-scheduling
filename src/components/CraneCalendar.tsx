import React, { useState, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  HardHat, 
  Tag, 
  Layers, 
  Building2, 
  Weight, 
  ArrowRightLeft,
  X,
  Filter
} from "lucide-react";
import { Schedule, CraneRequest, Crane, ShiftType } from "../types";

interface CraneCalendarProps {
  schedules: Schedule[];
  requests: CraneRequest[];
  cranes: Crane[];
}

export default function CraneCalendar({ schedules, requests, cranes }: CraneCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().split("T")[0]
  );
  
  // Filters
  const [selectedCrane, setSelectedCrane] = useState<string>("ALL");
  const [selectedShift, setSelectedShift] = useState<string>("ALL");

  // Get current year and month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Calendar math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Day of week (0-6)

  // Navigate months
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // List of all schedules with associated request details mapped
  const mappedSchedules = useMemo(() => {
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
      };
    });
  }, [schedules, requests]);

  // Filtered schedules for calendar cells and detail panel
  const filteredSchedules = useMemo(() => {
    return mappedSchedules.filter((s) => {
      if (selectedCrane !== "ALL" && s.assignedCrane !== selectedCrane && s.secondaryCrane !== selectedCrane) {
        return false;
      }
      if (selectedShift !== "ALL" && s.shift !== selectedShift) {
        return false;
      }
      return true;
    });
  }, [mappedSchedules, selectedCrane, selectedShift]);

  // Helper to group schedules by date for easy lookup in monthly grid
  const schedulesByDate = useMemo(() => {
    const map: Record<string, typeof filteredSchedules> = {};
    filteredSchedules.forEach((s) => {
      if (!map[s.date]) {
        map[s.date] = [];
      }
      map[s.date].push(s);
    });
    return map;
  }, [filteredSchedules]);

  // List of days in the current calendar page
  const calendarCells = useMemo(() => {
    const cells = [];
    
    // Previous month padding days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthDays - i);
      cells.push({
        date: prevDate,
        dateStr: prevDate.toISOString().split("T")[0],
        isCurrentMonth: false,
        dayNum: prevMonthDays - i,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(year, month, i);
      cells.push({
        date: currDate,
        dateStr: currDate.toISOString().split("T")[0],
        isCurrentMonth: true,
        dayNum: i,
      });
    }

    // Next month padding days to make perfect grid multiple of 7
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDate = new Date(year, month + 1, i);
      cells.push({
        date: nextDate,
        dateStr: nextDate.toISOString().split("T")[0],
        isCurrentMonth: false,
        dayNum: i,
      });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayIndex]);

  // Details for selected date
  const selectedDateSchedules = useMemo(() => {
    if (!selectedDate) return [];
    return filteredSchedules.filter((s) => s.date === selectedDate);
  }, [filteredSchedules, selectedDate]);

  // Priority color helper
  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case "P1":
        return "bg-red-100 text-red-800 border-red-300";
      case "P2":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "P3":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  // Crane color helper
  const getCraneColorClass = (craneId: string) => {
    const id = craneId.toUpperCase();
    if (id.startsWith("A1")) return "bg-[#1e1e1e] border-amber-500 text-amber-400";
    if (id.startsWith("A2")) return "bg-[#141414] border-emerald-500 text-emerald-400";
    if (id.startsWith("A3")) return "bg-[#18181b] border-blue-500 text-blue-400";
    return "bg-[#27272a] border-zinc-500 text-zinc-300";
  };

  const getShiftBadgeColor = (shift: string) => {
    switch (shift) {
      case "Shift A": return "bg-sky-50 text-sky-800 border-sky-300";
      case "Shift B": return "bg-amber-50 text-amber-800 border-amber-300";
      case "Shift C": return "bg-indigo-50 text-indigo-800 border-indigo-300";
      default: return "bg-purple-50 text-purple-800 border-purple-300";
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div id="crane_calendar_container" className="space-y-6">
      
      {/* Page Header */}
      <div className="bg-white border-4 border-[#141414] p-5 shadow-[4px_4px_0px_#141414] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xs font-black uppercase tracking-widest font-mono text-zinc-500 flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-amber-500" />
            Crane Gantry Calendar Log
          </h2>
          <p className="text-sm font-black text-zinc-900 uppercase">
            Visual month-wise registry of crane operations and planned shifts
          </p>
        </div>
        
        {/* Navigation / Actions */}
        <div className="flex gap-2.5">
          <button
            id="cal_prev_month"
            onClick={handlePrevMonth}
            className="p-2 border-2 border-[#141414] bg-white hover:bg-zinc-100 text-[#141414] shadow-[2px_2px_0px_#141414] active:translate-y-0.5 active:shadow-[1px_1px_0px_#141414] transition-all cursor-pointer rounded-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="px-4 py-2 border-2 border-[#141414] bg-[#141414] text-white font-black font-mono text-xs uppercase shadow-[2px_2px_0px_#141414] select-none text-center min-w-[150px]">
            {monthNames[month]} {year}
          </div>
          
          <button
            id="cal_next_month"
            onClick={handleNextMonth}
            className="p-2 border-2 border-[#141414] bg-white hover:bg-zinc-100 text-[#141414] shadow-[2px_2px_0px_#141414] active:translate-y-0.5 active:shadow-[1px_1px_0px_#141414] transition-all cursor-pointer rounded-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            id="cal_today"
            onClick={handleGoToToday}
            className="px-3.5 py-2 border-2 border-[#141414] bg-amber-500 hover:bg-amber-600 text-[#141414] font-black font-mono text-xs uppercase shadow-[2px_2px_0px_#141414] active:translate-y-0.5 active:shadow-[1px_1px_0px_#141414] transition-all cursor-pointer rounded-sm"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filter and Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* Main Monthly Calendar Card (3/4 Width) */}
        <div className="xl:col-span-3 bg-white border-4 border-[#141414] shadow-[6px_6px_0px_#141414] rounded-sm overflow-hidden flex flex-col">
          
          {/* Calendar Controller Filters Bar */}
          <div className="bg-zinc-50 border-b-2 border-[#141414] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-700">
              <Filter className="w-4 h-4 text-amber-600" />
              <span>FILTER CALENDAR MATRIX:</span>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {/* Crane filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-black uppercase text-zinc-500">Crane:</span>
                <select
                  value={selectedCrane}
                  onChange={(e) => setSelectedCrane(e.target.value)}
                  className="p-1.5 bg-white border-2 border-[#141414] text-xs font-black rounded-sm"
                >
                  <option value="ALL">All Cranes</option>
                  {cranes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                  ))}
                </select>
              </div>

              {/* Shift Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-black uppercase text-zinc-500">Shift:</span>
                <select
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value)}
                  className="p-1.5 bg-white border-2 border-[#141414] text-xs font-black rounded-sm"
                >
                  <option value="ALL">All Shifts</option>
                  <option value="Shift A">Shift A (06:00-14:00)</option>
                  <option value="Shift B">Shift B (14:00-22:00)</option>
                  <option value="Shift C">Shift C (22:00-06:00)</option>
                  <option value="General Shift">General Shift</option>
                </select>
              </div>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 border-b border-zinc-200 text-center bg-zinc-900 text-white font-mono text-xs font-black uppercase py-2">
            {weekdayNames.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 bg-zinc-200 gap-[1px]">
            {calendarCells.map((cell, index) => {
              const daySchedules = schedulesByDate[cell.dateStr] || [];
              const isSelected = selectedDate === cell.dateStr;
              const isToday = new Date().toISOString().split("T")[0] === cell.dateStr;

              return (
                <div
                  key={`${cell.dateStr}-${index}`}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  className={`min-h-[90px] md:min-h-[115px] p-2 flex flex-col justify-between transition-all cursor-pointer bg-white ${
                    !cell.isCurrentMonth ? "bg-zinc-50 text-zinc-400" : "text-zinc-900"
                  } ${isSelected ? "ring-4 ring-amber-500 bg-amber-50/50 z-10" : "hover:bg-zinc-50"}`}
                >
                  {/* Day number header */}
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded-sm ${
                      isToday 
                        ? "bg-[#141414] text-amber-400 font-extrabold" 
                        : isSelected 
                          ? "bg-amber-100 text-amber-950 font-black" 
                          : ""
                    }`}>
                      {cell.dayNum}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-[9px] font-mono font-black bg-zinc-100 text-[#141414] border border-[#141414] px-1 py-0.1 rounded-sm">
                        {daySchedules.length} {daySchedules.length === 1 ? "Job" : "Jobs"}
                      </span>
                    )}
                  </div>

                  {/* Schedules mini list */}
                  <div className="flex-grow space-y-1 overflow-y-auto max-h-[60px] md:max-h-[80px] scrollbar-thin">
                    {daySchedules.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className={`text-[8px] md:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#141414]/15 flex items-center justify-between truncate ${getCraneColorClass(s.assignedCrane)}`}
                        title={`${s.assignedCrane} (${s.startTime}-${s.endTime}): ${s.department}`}
                      >
                        <span className="font-extrabold flex items-center gap-0.5">
                          <HardHat className="w-2 h-2" />
                          {s.assignedCrane}
                        </span>
                        <span className="opacity-90">{s.startTime}</span>
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-[8px] font-mono text-zinc-500 font-bold text-center italic">
                        + {daySchedules.length - 3} more jobs
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Inspector Side-Panel (1/4 Width) */}
        <div className="bg-white border-4 border-[#141414] shadow-[6px_6px_0px_#141414] rounded-sm p-4 space-y-4">
          <div className="border-b-2 border-[#141414] pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-tight text-[#141414]">Day Inspector</h3>
                <p className="text-[10px] font-mono text-zinc-500 font-bold">{selectedDate || "Select a date"}</p>
              </div>
            </div>
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate(null)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Clear selected date"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!selectedDate ? (
            <div className="text-center py-10 font-mono text-xs text-zinc-400 italic">
              Click any calendar cell to view planned operations for that day.
            </div>
          ) : selectedDateSchedules.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <CalendarIcon className="w-10 h-10 mx-auto text-zinc-300" />
              <p className="font-mono text-xs text-zinc-500 font-bold">NO JOBS SCHEDULED</p>
              <p className="text-[10px] text-zinc-400">There are no crane schedules registered on {selectedDate}.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[450px] xl:max-h-[600px] overflow-y-auto pr-1">
              <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
                Planned operations ({selectedDateSchedules.length}):
              </p>
              
              {selectedDateSchedules.map((s) => (
                <div key={s.id} className="bg-zinc-50 border-2 border-[#141414] p-3.5 rounded-sm shadow-[2px_2px_0px_rgba(0,0,0,0.05)] space-y-3 font-sans">
                  
                  {/* Job Header */}
                  <div className="flex justify-between items-start border-b border-zinc-200 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 border text-[9px] font-mono font-black uppercase rounded-sm ${getCraneColorClass(s.assignedCrane)}`}>
                        🏗️ {s.assignedCrane}
                      </span>
                      {s.secondaryCrane && (
                        <span className={`px-2 py-0.5 border text-[9px] font-mono font-black uppercase rounded-sm ${getCraneColorClass(s.secondaryCrane)}`}>
                          🏗️ {s.secondaryCrane}
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 border text-[8px] font-mono font-black uppercase rounded-sm ${getPriorityBadgeClass(s.priority)}`}>
                      {s.priority}
                    </span>
                  </div>

                  {/* Job Details */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono font-bold text-zinc-700">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <span>{s.startTime} - {s.endTime}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <span className="capitalize">{s.shift}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <span className="truncate">{s.department}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Weight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      <span>{s.weight} Tons</span>
                    </div>
                  </div>

                  {/* Columns Range */}
                  <div className="bg-zinc-100 border border-zinc-200 px-2.5 py-1.5 rounded-sm text-[10px] font-mono flex items-center justify-between">
                    <span className="text-zinc-500 font-extrabold uppercase text-[9px]">COLUMN RANGE:</span>
                    <span className="font-black text-zinc-950 flex items-center gap-1.5">
                      Col {s.startColumn}
                      <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
                      Col {s.endColumn}
                    </span>
                  </div>

                  {/* Remarks */}
                  {s.remarks && (
                    <div className="border-t border-zinc-200 pt-2 text-[10px] font-sans font-medium text-zinc-600 bg-amber-50/40 p-2 border border-dashed border-amber-300/60 rounded">
                      <span className="font-extrabold text-zinc-700 block uppercase font-mono text-[8px] tracking-wide mb-0.5">Operator Remarks:</span>
                      "{s.remarks}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
