import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Schedule, CraneRequest } from "../types.js";
import { isScheduleInShiftBoundary } from "./shiftUtils.js";

const SHIFT_WINDOWS: Record<string, [number, number]> = {
  "Shift A": [6 * 60, 14 * 60], // 06:00–14:00
  "Shift B": [14 * 60, 22 * 60], // 14:00–22:00
  "Shift C": [22 * 60, 30 * 60], // 22:00–06:00 next day
  "General Shift": [9 * 60, 18 * 60 + 30], // 09:00–18:30
};

function parseTimeToMinutes(t: string): number {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const getShiftDuration = (shift: string): number => {
  if (shift.includes("Shift A")) return 480;
  if (shift.includes("Shift B")) return 480;
  if (shift.includes("Shift C")) return 480;
  if (shift.includes("General")) return 570;
  return 480; // default to 8 hours
};

const formatMinutes = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

function getNormalizedMins(timeStr: string, shiftStr: string): number {
  const mins = parseTimeToMinutes(timeStr);
  if (shiftStr === "Shift C" && mins < 12 * 60) {
    return mins + 24 * 60;
  }
  return mins;
}

function getNowMinsInShift(dateStr: string, shiftStr: string, now: Date): number {
  const [startMins, endMins] = SHIFT_WINDOWS[shiftStr] || [360, 840];
  
  const nowOnlyDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dateStr.split("-").map(Number);
  const shiftStartDate = new Date(y, m - 1, d);
  
  const diffTime = nowOnlyDate.getTime() - shiftStartDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    // Future shift
    return startMins;
  } else if (diffDays > 1 || (diffDays === 1 && shiftStr !== "Shift C")) {
    // Past shift
    return endMins;
  } else if (diffDays === 1 && shiftStr === "Shift C") {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    if (currentMins >= 6 * 60) {
      return endMins; // Past shift
    }
    return currentMins + 24 * 60; // Currently in progress
  } else {
    const currentMins = now.getHours() * 60 + now.getMinutes();
    if (shiftStr === "Shift C") {
      if (currentMins < 12 * 60) {
        return startMins; // Future
      }
      return currentMins;
    } else {
      return currentMins;
    }
  }
}

export function generateDateWisePDF(schedules: Schedule[], requests: CraneRequest[]) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();

  // Structure: groups[date][shift][craneId] = { workingMinutes: number, jobCount: number }
  const groups: Record<string, Record<string, Record<string, { workingMinutes: number; jobCount: number }>>> = {};

  schedules.forEach((sched) => {
    const req = requests.find((r) => r.id === sched.requestId);
    
    // Only count active schedules (meaning the request is Scheduled, Completed, or Deferred)
    const isRequestActive = req && (req.status === "Scheduled" || req.status === "Completed" || req.status === "Deferred");
    if (!isRequestActive) {
      return;
    }

    const dateStr = req?.createdAt ? req.createdAt.split("T")[0] : new Date().toISOString().split("T")[0];
    const shiftStr = req?.shift || "General Shift";

    if (!isScheduleInShiftBoundary(sched.startTime, sched.endTime, shiftStr)) {
      return;
    }

    // Dynamic Active Time Calculation: compute overlapping schedule time up to current local time (now)
    const [shiftStartMins, shiftEndMins] = SHIFT_WINDOWS[shiftStr] || [360, 840];
    const nowMins = getNowMinsInShift(dateStr, shiftStr, now);

    const schedStartMins = getNormalizedMins(sched.startTime, shiftStr);
    const schedEndMins = getNormalizedMins(sched.endTime, shiftStr);

    // Overlap of the scheduled interval with the elapsed shift interval [shiftStartMins, nowMins]
    const elapsedWorking = Math.max(0, Math.min(schedEndMins, nowMins) - Math.max(schedStartMins, shiftStartMins));

    if (!groups[dateStr]) {
      groups[dateStr] = {};
    }
    if (!groups[dateStr][shiftStr]) {
      groups[dateStr][shiftStr] = {};
    }

    const cranesToProcess = [sched.assignedCrane];
    if (sched.secondaryCrane) {
      cranesToProcess.push(sched.secondaryCrane);
    }

    cranesToProcess.forEach((craneId) => {
      if (!groups[dateStr][shiftStr][craneId]) {
        groups[dateStr][shiftStr][craneId] = { workingMinutes: 0, jobCount: 0 };
      }
      groups[dateStr][shiftStr][craneId].workingMinutes += elapsedWorking;
      groups[dateStr][shiftStr][craneId].jobCount += 1;
    });
  });

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  // Document Title & Styling
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("CRANE SHIFT PERFORMANCE & UTILIZATION REPORT", 14, 20);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${now.toLocaleString()} | Dynamic summary based on current elapsed shift times`, 14, 26);

  // Decorative Steel Line
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);

  let currentY = 35;

  if (sortedDates.length === 0) {
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text("No active or completed scheduled crane timetables found.", 14, currentY);
    doc.save("crane_working_idle_report.pdf");
    return;
  }

  const tableRows: any[] = [];

  sortedDates.forEach((dateStr) => {
    const shifts = groups[dateStr];
    const sortedShifts = Object.keys(shifts).sort();

    sortedShifts.forEach((shiftStr) => {
      const cranesData = shifts[shiftStr];
      const allCranesSet = new Set<string>();
      schedules.forEach((s) => {
        if (s.assignedCrane) allCranesSet.add(s.assignedCrane);
        if (s.secondaryCrane) allCranesSet.add(s.secondaryCrane);
      });
      if (allCranesSet.size === 0) {
        allCranesSet.add("A1");
        allCranesSet.add("A2");
        allCranesSet.add("A3");
      }
      const allCranes = Array.from(allCranesSet).sort();

      const [shiftStartMins, shiftEndMins] = SHIFT_WINDOWS[shiftStr] || [360, 840];
      const nowMins = getNowMinsInShift(dateStr, shiftStr, now);
      const elapsedShiftDuration = Math.max(0, Math.min(shiftEndMins, nowMins) - shiftStartMins);
      const shiftDuration = shiftEndMins - shiftStartMins;

      // If the shift is future/not started, utilization shows based on planned full duration with 0 work
      const denom = elapsedShiftDuration > 0 ? elapsedShiftDuration : shiftDuration;

      allCranes.forEach((craneId) => {
        const stats = cranesData[craneId] || { workingMinutes: 0, jobCount: 0 };
        const workingMins = Math.min(stats.workingMinutes, denom);
        const idleMins = Math.max(0, denom - workingMins);
        const utilization = Math.min(Math.round((workingMins / denom) * 100), 100);

        tableRows.push([
          dateStr,
          shiftStr,
          craneId,
          formatMinutes(workingMins),
          formatMinutes(idleMins),
          `${utilization}%`
        ]);
      });
    });
  });

  const tableHeaders = ["Date", "Operational Shift", "Gantry/Crane", "Active Time (to current time)", "Idle Time (to current time)", "Utilization Rate"];

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      font: "Helvetica",
      textColor: [30, 30, 30],
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 25, fontStyle: "bold" }, // Date
      1: { cellWidth: 35 }, // Shift
      2: { cellWidth: 25, fontStyle: "bold", halign: "center" }, // Crane
      3: { cellWidth: 40, fontStyle: "bold" }, // Working Time
      4: { cellWidth: 40 }, // Idle Time
      5: { cellWidth: 27, fontStyle: "bold", halign: "center" } // Utilization
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, 14, 287);
    }
  });

  doc.save(`crane_operational_efficiency_report_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function generateCraneWorkingHoursPDF(
  completedOps: any[],
  startDate?: string,
  endDate?: string,
  shift?: string
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const summaryMap: Record<string, Record<string, { jobCount: number; totalMinutes: number }>> = {};
  
  const cranesInOps = Array.from(new Set(completedOps.map(op => op.assignedCrane).filter(Boolean)));
  if (cranesInOps.length === 0) {
    cranesInOps.push("A1", "A2", "A3");
  }

  cranesInOps.forEach((craneId) => {
    summaryMap[craneId] = {
      "Shift A": { jobCount: 0, totalMinutes: 0 },
      "Shift B": { jobCount: 0, totalMinutes: 0 },
      "Shift C": { jobCount: 0, totalMinutes: 0 },
      "General Shift": { jobCount: 0, totalMinutes: 0 }
    };
  });

  completedOps.forEach((op) => {
    const craneId = op.assignedCrane || (cranesInOps[0] || "A1");
    const opShift = op.shift || "General Shift";
    
    const startMins = parseTimeToMinutes(op.startTime);
    const endMins = parseTimeToMinutes(op.endTime);
    const duration = endMins >= startMins ? (endMins - startMins) : (1440 - startMins + endMins);

    if (!summaryMap[craneId]) {
      summaryMap[craneId] = {
        "Shift A": { jobCount: 0, totalMinutes: 0 },
        "Shift B": { jobCount: 0, totalMinutes: 0 },
        "Shift C": { jobCount: 0, totalMinutes: 0 },
        "General Shift": { jobCount: 0, totalMinutes: 0 }
      };
    }

    if (summaryMap[craneId][opShift]) {
      summaryMap[craneId][opShift].jobCount += 1;
      summaryMap[craneId][opShift].totalMinutes += duration;
    } else {
      summaryMap[craneId][opShift] = { jobCount: 1, totalMinutes: duration };
    }
  });

  // Document Title & Styling
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("CRANE SHIFT-WISE WORKING HOURS & HISTORY REPORT", 14, 20);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  let subtitle = "Historical Utilization & Performance Summary";
  if (startDate && endDate) {
    subtitle += ` | Filter: ${startDate} to ${endDate}`;
  }
  if (shift && shift !== "ALL") {
    subtitle += ` | Shift: ${shift}`;
  }

  doc.text(`Generated on: ${new Date().toLocaleString()} | ${subtitle}`, 14, 26);

  // Decorative Steel Line
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);

  // 1. Shift-wise Crane Summary Table
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("1. Crane Shift-wise Working Hours & Utilization Summary", 14, 36);

  const summaryRows: any[] = [];
  Object.keys(summaryMap).sort().forEach((craneId) => {
    const shifts = summaryMap[craneId];
    Object.keys(shifts).forEach((shiftStr) => {
      const data = shifts[shiftStr];
      const hours = (data.totalMinutes / 60).toFixed(2);
      summaryRows.push([
        craneId,
        shiftStr,
        data.jobCount.toString(),
        `${hours} Hours (${data.totalMinutes} mins)`,
        data.jobCount > 0 ? `${Math.round(data.totalMinutes / data.jobCount)} mins` : "N/A"
      ]);
    });
  });

  const summaryHeaders = ["Crane/Gantry ID", "Operational Shift", "Total Completed Tasks", "Total Accumulated Working Time", "Avg Task Duration"];

  autoTable(doc, {
    startY: 40,
    head: [summaryHeaders],
    body: summaryRows,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      font: "Helvetica",
      textColor: [30, 30, 30],
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate color header
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: "bold", halign: "center" },
      1: { cellWidth: 40 },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 50, fontStyle: "bold" },
      4: { cellWidth: 30, halign: "center" }
    },
    margin: { left: 14, right: 14 }
  });

  // 2. Detailed History Table
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("2. Detailed Archived Operations Log", 14, finalY);

  const detailHeaders = ["Task ID", "Gantry", "Shift", "Department", "Time Window", "Weight", "Duration"];
  const detailRows = completedOps.map((op) => {
    const startMins = parseTimeToMinutes(op.startTime);
    const endMins = parseTimeToMinutes(op.endTime);
    const duration = endMins >= startMins ? (endMins - startMins) : (1440 - startMins + endMins);
    return [
      op.id.substring(0, 8).toUpperCase(),
      op.assignedCrane || "A1",
      op.shift || "General Shift",
      op.department || "N/A",
      `${op.startTime} - ${op.endTime}`,
      `${op.weight} Tons`,
      `${duration} mins`
    ];
  });

  autoTable(doc, {
    startY: finalY + 4,
    head: [detailHeaders],
    body: detailRows.length > 0 ? detailRows : [["-", "-", "No archived operations records found", "-", "-", "-", "-"]],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      font: "Helvetica",
      textColor: [35, 35, 35],
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [15, 23, 42], // Deep Navy slate color header
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: "bold" },
      1: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 25, halign: "center" }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, 14, 287);
    }
  });

  doc.save(`crane_working_hours_summary_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function generateScheduledHistoryPDF(
  filteredJobs: any[],
  startDate: string,
  endDate: string,
  shift: string
) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();

  // Document Title & Styling
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("HISTORICAL SCHEDULED JOBS REPORT", 14, 20);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  let subtitle = "Historical Scheduled Crane Operations Log";
  if (startDate && endDate) {
    subtitle += ` | Date Range: ${startDate} to ${endDate}`;
  } else if (startDate) {
    subtitle += ` | From: ${startDate}`;
  } else if (endDate) {
    subtitle += ` | Up To: ${endDate}`;
  }
  if (shift && shift !== "ALL") {
    subtitle += ` | Filtered Shift: ${shift}`;
  } else {
    subtitle += ` | Shift: All Shifts`;
  }

  doc.text(`Generated on: ${now.toLocaleString()} | ${subtitle}`, 14, 26);

  // Decorative Steel Line
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.8);
  doc.line(14, 28, 283, 28);

  const detailHeaders = [
    "Date",
    "Gantry/Crane",
    "Shift",
    "Dept",
    "Time Window",
    "Bay & Column",
    "Weight",
    "Priority",
    "Status",
    "Remarks"
  ];

  const detailRows = filteredJobs.map((job) => {
    const craneDisplay = job.secondaryCrane 
      ? `${job.assignedCrane} + ${job.secondaryCrane} (Tandem)` 
      : job.assignedCrane;
    
    const locationDisplay = `${job.bay || "A"}: Col ${job.startColumn !== undefined && job.endColumn !== undefined ? `${job.startColumn}-${job.endColumn}` : job.column || "1"}`;

    return [
      job.date,
      craneDisplay || "N/A",
      job.shift || "General Shift",
      job.department || "Production",
      `${job.startTime} - ${job.endTime}`,
      locationDisplay,
      `${job.weight || 0} Tons`,
      job.priority || "P3",
      job.status || "Scheduled",
      job.remarks || "-"
    ];
  });

  autoTable(doc, {
    startY: 34,
    head: [detailHeaders],
    body: detailRows.length > 0 ? detailRows : [["-", "-", "No historical scheduled operations found matching filters", "-", "-", "-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      font: "Helvetica",
      textColor: [35, 35, 35],
      lineColor: [220, 220, 220],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 32 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28 },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 15, halign: "center", fontStyle: "bold" },
      8: { cellWidth: 20, halign: "center" },
      9: { cellWidth: 56 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${data.pageNumber}`, 14, 200);
    }
  });

  doc.save(`scheduled_jobs_history_${new Date().toISOString().split("T")[0]}.pdf`);
}

export function generateJobsTrackerPDF(requests: CraneRequest[], reqIdToDownload: string) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();

  // Helper to calculate hours
  const getHoursDiff = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    let startTotal = (startH || 0) * 60 + (startM || 0);
    let endTotal = (endH || 0) * 60 + (endM || 0);
    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }
    return (endTotal - startTotal) / 60;
  };

  const getFormattedCranes = (reqItem: CraneRequest): string => {
    const allocs = reqItem.craneAllocations || [];
    const cranes = Array.from(new Set(allocs.map(a => a.craneId)));
    return cranes.length > 0 ? cranes.join(", ") : (reqItem.mandatoryCrane || "Any");
  };

  const getCompletionDateTime = (reqItem: CraneRequest) => {
    const allocs = reqItem.craneAllocations || [];
    if (allocs.length > 0) {
      const sorted = [...allocs].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.endTime.localeCompare(b.endTime);
      });
      const latest = sorted[sorted.length - 1];
      return {
        date: latest.date,
        time: latest.endTime
      };
    }
    return {
      date: reqItem.date || "",
      time: reqItem.estimatedEndTime || ""
    };
  };

  const getStartDateTime = (reqItem: CraneRequest) => {
    const allocs = reqItem.craneAllocations || [];
    if (allocs.length > 0) {
      const sorted = [...allocs].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.localeCompare(b.startTime);
      });
      const earliest = sorted[0];
      return {
        date: earliest.date,
        time: earliest.startTime
      };
    }
    return {
      date: reqItem.date || "",
      time: reqItem.estimatedStartTime || ""
    };
  };

  const getCompletionTimeRange = (reqItem: CraneRequest): string => {
    const allocs = reqItem.craneAllocations || [];
    if (allocs.length > 0) {
      const sortedByStart = [...allocs].sort((a, b) => a.startTime.localeCompare(b.startTime));
      const sortedByEnd = [...allocs].sort((a, b) => a.endTime.localeCompare(b.endTime));
      const start = sortedByStart[0]?.startTime || "N/A";
      const end = sortedByEnd[sortedByEnd.length - 1]?.endTime || "N/A";
      return `${start} - ${end}`;
    }
    const start = reqItem.estimatedStartTime || "N/A";
    const end = reqItem.estimatedEndTime || "N/A";
    if (start === "N/A" && end === "N/A") return "N/A";
    return `${start} - ${end}`;
  };

  const getSortTimestamp = (dateStr: string, timeStr: string): number => {
    if (!dateStr) return Infinity;
    const finalTime = timeStr || "00:00";
    const [hours, minutes] = finalTime.split(":").map(Number);
    const parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) return Infinity;
    parsedDate.setHours(hours || 0, minutes || 0, 0, 0);
    return parsedDate.getTime();
  };

  // Filter based on specific Req ID or All
  const isAll = reqIdToDownload === "ALL";
  const mainJobs = isAll 
    ? requests.filter(r => r.jobType !== "Continuation")
    : requests.filter(r => r.id === reqIdToDownload);

  // Sort mainJobs chronologically
  mainJobs.sort((a, b) => {
    const aInfo = getStartDateTime(a);
    const bInfo = getStartDateTime(b);
    const aTime = getSortTimestamp(aInfo.date, aInfo.time);
    const bTime = getSortTimestamp(bInfo.date, bInfo.time);
    return aTime - bTime;
  });

  // Document Title & Styling
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  const headingText = isAll 
    ? "MANUFACTURING JOBS TRACKER - MASTER REPORT"
    : `JOB TRACKER REPORT - REQ ID: ${reqIdToDownload}`;
  doc.text(headingText, 14, 20);
  
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Generated on: ${now.toLocaleString()} | Scope: ${isAll ? "All Registration Logs Grouped" : `Specific Req ID ${reqIdToDownload} Grouped`}`, 14, 25);

  // Decorative Steel Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, 27, 196, 27);

  let currentY = 32;

  // Render sections: one for each parent job
  mainJobs.forEach((mainJob, index) => {
    const childJobs = requests.filter(r => r.parentJobId === mainJob.id && r.jobType === "Continuation");
    const groupJobs = [mainJob, ...childJobs];

    // Sort this group's operations chronologically
    groupJobs.sort((a, b) => {
      const aInfo = getStartDateTime(a);
      const bInfo = getStartDateTime(b);
      const aTime = getSortTimestamp(aInfo.date, aInfo.time);
      const bTime = getSortTimestamp(bInfo.date, bInfo.time);
      return aTime - bTime;
    });

    // Calculate total hours and build breakdowns for this group of jobs
    let groupTotalHours = 0;
    const craneHoursMap: Record<string, number> = {};
    const jobHoursMap: Record<string, number> = {};

    groupJobs.forEach((item) => {
      let itemHours = 0;
      const allocs = item.craneAllocations || [];
      if (allocs.length > 0) {
        itemHours = allocs.reduce((sum, a) => sum + getHoursDiff(a.startTime, a.endTime), 0);
        allocs.forEach(a => {
          craneHoursMap[a.craneId] = (craneHoursMap[a.craneId] || 0) + getHoursDiff(a.startTime, a.endTime);
        });
      } else {
        itemHours = getHoursDiff(item.estimatedStartTime, item.estimatedEndTime);
        const defaultCrane = item.mandatoryCrane || "Any";
        craneHoursMap[defaultCrane] = (craneHoursMap[defaultCrane] || 0) + itemHours;
      }
      groupTotalHours += itemHours;
      jobHoursMap[item.id] = itemHours;
    });

    const jobHoursDetails = groupJobs.map(item => {
      const h = jobHoursMap[item.id] || 0;
      return `${item.id}: ${h.toFixed(1)}h`;
    }).join(", ");

    const craneHoursDetails = Object.entries(craneHoursMap)
      .map(([crane, hours]) => `${crane}: ${hours.toFixed(1)}h`)
      .join(", ");

    // Page Break calculation - if we don't have enough space left (e.g., less than 65mm), add a new page
    if (index > 0 && currentY > 190) {
      doc.addPage();
      currentY = 20;
    }

    // Section title container
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(14, currentY, 182, 11, "F");

    // Left border accent bar (dark slate)
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(14, currentY, 2.5, 11, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    const jobTitle = mainJob.machineName || mainJob.department || "General Gantry Job";
    const sectionTitle = `REQ ID: ${mainJob.id}   |   JOB NAME: ${jobTitle.toUpperCase()}`;
    doc.text(sectionTitle, 19, currentY + 7.5);

    currentY += 15;

    // Group info text with separate hourly details
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    
    // First line of details: operation counts and totals
    doc.text(`Total Operations under Registration: ${groupJobs.length}    |    Accumulated Active Crane Time: ${groupTotalHours.toFixed(1)} hrs`, 15, currentY);
    currentY += 4.5;
    
    // Second line of details: Separate working hours for different jobs and cranes
    doc.setFont("Helvetica", "normal");
    doc.text(`Individual Job Hours: [ ${jobHoursDetails} ]    |    Individual Crane Hours: [ ${craneHoursDetails} ]`, 15, currentY);
    currentY += 5;

    // Setup table data
    const tableHeaders = [
      "Job ID",
      "Operation Details",
      "Est. Weight",
      "Crane Allocated",
      "Crane Hours",
      "Completion Date",
      "Completion Time Range",
      "Job Type"
    ];

    const tableRows = groupJobs.map((item) => {
      const jobID = item.id || "N/A";
      const details = item.details || item.remarks || "N/A";
      const weight = `${item.estimatedWeight || 0} Tons`;
      const cranes = getFormattedCranes(item);
      const singleJobHours = (jobHoursMap[item.id] || 0).toFixed(1) + " hrs";
      
      const compInfo = getCompletionDateTime(item);
      const compDate = compInfo.date || "N/A";
      const compTimeRange = getCompletionTimeRange(item);
      const isCont = item.jobType === "Continuation" ? "Continuation" : "Root Job";

      return [
        jobID,
        details,
        weight,
        cranes,
        singleJobHours,
        compDate,
        compTimeRange,
        isCont
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: tableRows,
      theme: "striped",
      styles: { 
        fontSize: 7.5, 
        cellPadding: 2.2, 
        valign: "middle",
        lineColor: [226, 232, 240], // slate-200
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
        7: { cellWidth: 20, halign: "center" }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    currentY = finalY + 12; // Gap for the next section
  });

  // Global summary and footer
  let totalJobsAllGroups = 0;
  let totalHoursAllGroups = 0;
  mainJobs.forEach((job) => {
    const childJobs = requests.filter(r => r.parentJobId === job.id && r.jobType === "Continuation");
    const groupJobs = [job, ...childJobs];
    totalJobsAllGroups += groupJobs.length;
    groupJobs.forEach((item) => {
      const allocs = item.craneAllocations || [];
      if (allocs.length > 0) {
        totalHoursAllGroups += allocs.reduce((sum, a) => sum + getHoursDiff(a.startTime, a.endTime), 0);
      } else {
        totalHoursAllGroups += getHoursDiff(item.estimatedStartTime, item.estimatedEndTime);
      }
    });
  });

  if (currentY > 260) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(30, 41, 59); // slate-800
  doc.setLineWidth(0.5);
  doc.rect(14, currentY, 182, 13, "FD");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(`GRAND REPORT TOTALS: ${mainJobs.length} REQ ID(s) | ${totalJobsAllGroups} OPERATIONS | ${totalHoursAllGroups.toFixed(1)} TOTAL HOISTING HOURS`, 18, currentY + 8);

  // Footer
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on: ${now.toLocaleString()}  |  Heavy Fabrication Job Tracker Service`, 14, 287);

  doc.save(`manufacturing_jobs_tracker_${reqIdToDownload}_report.pdf`);
}

