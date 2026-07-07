import { Request, Response } from "express";
import { readDB, writeDB, logActivity, forceSeedDB } from "../db/db.js";
import { scheduleRequests } from "../services/schedulingEngine.js";
import { ShiftType, PriorityType, ShiftReport } from "../../types.js";

const SHIFT_WINDOWS: Record<ShiftType, [number, number]> = {
  "Shift A":       [6 * 60,       14 * 60],      // 06:00–14:00
  "Shift B":       [14 * 60,      22 * 60],      // 14:00–22:00
  "Shift C":       [22 * 60,      30 * 60],      // 22:00–06:00 next day
  "General Shift": [9 * 60,       18 * 60 + 30], // 09:00–18:30
};

function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mins = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function verifyShiftBoundary(startTimeStr: string, endTimeStr: string, shift: ShiftType): { isValid: boolean; message?: string } {
  const sMins = parseTimeToMinutes(startTimeStr);
  let eMins = parseTimeToMinutes(endTimeStr);
  
  const window = SHIFT_WINDOWS[shift];
  if (!window) return { isValid: true };
  const [wStart, wEnd] = window;
  
  if (shift === "Shift C") {
    const normStart = sMins < 12 * 60 ? sMins + 24 * 60 : sMins;
    const normEnd = eMins < 12 * 60 ? eMins + 24 * 60 : eMins;
    
    if (normStart < wStart || normEnd > wEnd) {
      return {
        isValid: false,
        message: `Requested window ${startTimeStr}-${endTimeStr} falls outside Shift C window (22:00-06:00 next day).`,
      };
    }
  } else {
    if (eMins < sMins) {
       return { isValid: false, message: "Estimated end time cannot be earlier than start time." };
    }
    if (sMins < wStart || eMins > wEnd) {
      return {
        isValid: false,
        message: `Requested window ${startTimeStr}-${endTimeStr} falls outside Shift ${shift} window (${formatMinutesToTime(wStart)}-${formatMinutesToTime(wEnd)}).`,
      };
    }
  }
  return { isValid: true };
}

export const getSchedules = (req: Request, res: Response): void => {
  try {
    const db = readDB();
    res.json(db.schedules);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to retrieve schedules",
      detail: err.message || String(err),
      code: "SCHEDULE_FETCH_FAILED"
    });
  }
};

export const generateSchedule = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const db = readDB();

    // 1. Sanitize and apply default fallback values for all requests before running the scheduler
    db.requests = db.requests.map((r) => {
      const shift = r.shift || "General Shift";
      const startColumn = r.startColumn !== undefined ? Number(r.startColumn) : (r.column !== undefined ? Number(r.column) : 1);
      const endColumn = r.endColumn !== undefined ? Number(r.endColumn) : (r.column !== undefined ? Number(r.column) : 1);
      const isTandemLift = r.isTandemLift !== undefined ? Boolean(r.isTandemLift) : false;
      const mandatoryCrane = r.mandatoryCrane || "Any";
      const status = r.status || "Submitted";
      return {
        ...r,
        shift,
        startColumn,
        endColumn,
        isTandemLift,
        mandatoryCrane,
        status: status as any,
      };
    });

    // 2. Validate shift boundaries & check crane availability warnings
    const warnings: string[] = [];
    
    // Add warning for any crane currently in Maintenance
    db.cranes.forEach((c) => {
      if (c.status === "Maintenance") {
        warnings.push(`Crane ${c.id} is currently under maintenance. (CraneUnavailable)`);
      }
    });

    const submittedRequests = db.requests.filter((r) => r.status === "Submitted");

    if (submittedRequests.length === 0) {
      res.status(400).json({
        error: "No active requests",
        detail: "No Submitted requests found. Areas must submit draft logs first.",
        code: "NO_SUBMITTED_REQUESTS"
      });
      return;
    }

    // Filter requests for boundary compliance, warning and rejecting violators
    const compliantRequests = db.requests.map((r) => {
      if (r.status === "Submitted") {
        const boundaryCheck = verifyShiftBoundary(r.estimatedStartTime, r.estimatedEndTime, r.shift);
        if (!boundaryCheck.isValid) {
          warnings.push(`Request ${r.id} violates shift boundaries: ${boundaryCheck.message}`);
          return { ...r, status: "Rejected" as const };
        }
      }
      return r;
    });

    // Run the scheduler with compliant requests and the cranes
    const schedulerResult = scheduleRequests(
      compliantRequests,
      db.cranes,
      db.settings.bufferTimeMinutes
    );

    // Merge in any of our initial warnings (e.g. shift boundary rejections or maintenance warnings)
    const combinedWarnings = [...warnings, ...schedulerResult.warnings];

    // 3. Update requests statuses based on schedule results
    db.requests = db.requests.map((r) => {
      // If it was already marked rejected due to shift boundaries:
      const processed = compliantRequests.find((cr) => cr.id === r.id);
      if (processed && processed.status === "Rejected") {
        return { ...r, status: "Rejected" as const };
      }

      if (r.status === "Submitted") {
        const isScheduled = schedulerResult.schedules.some((s) => s.requestId === r.id);
        const isDeferred = schedulerResult.deferredIds.includes(r.id);
        const isRejected = schedulerResult.rejectedIds.includes(r.id);

        if (isDeferred) {
          return { ...r, status: "Deferred" as const };
        } else if (isRejected) {
          return { ...r, status: "Rejected" as const };
        } else if (isScheduled) {
          return { ...r, status: "Scheduled" as const };
        }
      }
      return r;
    });

    // 4. Reset idle cranes back to "Available" at shift/scheduler changeover
    const activeCranesThisShift = new Set<string>();
    schedulerResult.schedules.forEach((s) => {
      activeCranesThisShift.add(s.assignedCrane);
      if (s.secondaryCrane) {
        activeCranesThisShift.add(s.secondaryCrane);
      }
    });

    const updatedCranes = schedulerResult.updatedCranes.map((crane) => {
      if (!activeCranesThisShift.has(crane.id) && crane.status !== "Maintenance") {
        return { ...crane, status: "Available" as const };
      }
      return crane;
    });

    // Update schedules and cranes
    db.schedules = [...db.schedules, ...schedulerResult.schedules];
    db.cranes = updatedCranes;

    writeDB(db);

    logActivity(
      user.employeeId,
      user.name,
      "Schedule Generated",
      `Auto-assigned ${schedulerResult.schedules.length} jobs. ${schedulerResult.rejectedIds.length} rejected, ${schedulerResult.deferredIds.length} deferred.`
    );

    // Return the full SchedulerResult type:
    // { schedules[], updatedCranes[], rejectedIds[], deferredIds[], warnings[] }
    res.json({
      message: "Scheduling complete",
      allocatedCount: schedulerResult.schedules.length,
      rejectedCount: schedulerResult.rejectedIds.length,
      deferredCount: schedulerResult.deferredIds.length,
      schedules: schedulerResult.schedules,
      updatedCranes: updatedCranes,
      rejectedIds: schedulerResult.rejectedIds,
      deferredIds: schedulerResult.deferredIds,
      warnings: combinedWarnings,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Scheduling execution failed",
      detail: err.message || String(err),
      code: "SCHEDULER_CRASH"
    });
  }
};

export const clearSchedule = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const db = readDB();

    db.requests = db.requests.map((r) => {
      if (r.status === "Scheduled" || r.status === "Rejected" || r.status === "Deferred") {
        return { ...r, status: "Submitted" as const };
      }
      return r;
    });

    db.schedules = [];
    db.cranes.forEach((c) => {
      if (c.status !== "Maintenance") {
        c.status = "Available";
      }
    });

    writeDB(db);
    logActivity(user.employeeId, user.name, "Schedule Cleared", `Schedules wiped. All jobs reverted to Submitted.`);

    res.json({ success: true, message: "Schedules cleared successfully." });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to clear schedules",
      detail: err.message || String(err),
      code: "SCHEDULE_CLEAR_FAILED"
    });
  }
};

export const overrideSchedule = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { assignedCrane, startTime, endTime, column, startColumn, endColumn, remarks } = req.body;

    const db = readDB();
    const schedIndex = db.schedules.findIndex((s) => s.id === id);
    if (schedIndex === -1) {
      res.status(404).json({
        error: "Schedule not found",
        detail: `No schedule exists with ID: ${id}`,
        code: "SCHEDULE_NOT_FOUND"
      });
      return;
    }

    const original = db.schedules[schedIndex];
    const updated = {
      ...original,
      assignedCrane: assignedCrane || original.assignedCrane,
      startTime: startTime || original.startTime,
      endTime: endTime || original.endTime,
      column: column !== undefined ? Number(column) : original.column,
      startColumn: startColumn !== undefined ? Number(startColumn) : original.startColumn,
      endColumn: endColumn !== undefined ? Number(endColumn) : original.endColumn,
      remarks: remarks !== undefined ? remarks : original.remarks,
      status: "Approved" as const,
    };

    db.schedules[schedIndex] = updated;

    logActivity(
      user.employeeId,
      user.name,
      "Manual Override",
      `Supervisor manual override on schedule ${id}: assigned crane ${updated.assignedCrane}, time ${updated.startTime}-${updated.endTime}.`
    );

    writeDB(db);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({
      error: "Override failed",
      detail: err.message || String(err),
      code: "SCHEDULE_OVERRIDE_FAILED"
    });
  }
};

// System Settings
export const getSettings = (req: Request, res: Response): void => {
  try {
    const db = readDB();
    res.json(db.settings);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to query settings",
      detail: err.message || String(err),
      code: "SETTINGS_FETCH_FAILED"
    });
  }
};

export const updateSettings = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { bufferTimeMinutes, systemLocked, maintenanceWindowOpen } = req.body;

    const db = readDB();
    db.settings = {
      bufferTimeMinutes: typeof bufferTimeMinutes === "number" ? bufferTimeMinutes : db.settings.bufferTimeMinutes,
      systemLocked: typeof systemLocked === "boolean" ? systemLocked : db.settings.systemLocked,
      maintenanceWindowOpen: typeof maintenanceWindowOpen === "boolean" ? maintenanceWindowOpen : db.settings.maintenanceWindowOpen,
      maxCranes: 3,
    };

    writeDB(db);
    logActivity(user.employeeId, user.name, "Settings Updated", `Config updated: Buffer=${db.settings.bufferTimeMinutes}m, Locked=${db.settings.systemLocked}`);

    res.json(db.settings);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to update settings",
      detail: err.message || String(err),
      code: "SETTINGS_UPDATE_FAILED"
    });
  }
};

// Logs
export const getLogs = (req: Request, res: Response): void => {
  try {
    const db = readDB();
    res.json(db.auditLogs);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to fetch audit logs",
      detail: err.message || String(err),
      code: "AUDIT_LOGS_FETCH_FAILED"
    });
  }
};

// Shift Reports & Admin Analytics
export const getReports = (req: Request, res: Response): void => {
  try {
    const db = readDB();

    const total = db.requests.length;
    const pending = db.requests.filter((r) => r.status === "Submitted").length;
    const scheduled = db.requests.filter((r) => r.status === "Scheduled").length;
    const draft = db.requests.filter((r) => r.status === "Draft").length;

    const calculateUtil = (craneId: string): number => {
      const craneJobs = db.schedules.filter((s) => s.assignedCrane === craneId || s.secondaryCrane === craneId);
      let totalMinutes = 0;
      craneJobs.forEach((j) => {
        const start = parseTimeToMinutes(j.startTime);
        const end = parseTimeToMinutes(j.endTime);
        totalMinutes += (end - start);
      });
      const percentage = Math.round((totalMinutes / 480) * 100);
      return Math.min(percentage, 100);
    };

    const craneA1Util = calculateUtil("A1");
    const craneA2Util = calculateUtil("A2");
    const craneA3Util = calculateUtil("A3");

    const areaDemand: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    db.requests.forEach((r) => {
      if (areaDemand[r.area] !== undefined) {
        areaDemand[r.area]++;
      }
    });

    const priorityBreakdown: Record<PriorityType, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    db.requests.forEach((r) => {
      if (priorityBreakdown[r.priority] !== undefined) {
        priorityBreakdown[r.priority]++;
      }
    });

    const averageWaitingTimeMinutes = db.schedules.length > 0 
      ? Math.round(db.schedules.reduce((acc, s) => acc + s.travelTimeMinutes + s.bufferTimeMinutes, 0) / db.schedules.length) 
      : 0;

    res.json({
      summary: {
        totalRequests: total,
        pendingRequests: pending,
        scheduledRequests: scheduled,
        draftRequests: draft,
        craneA1Util,
        craneA2Util,
        craneA3Util,
        areaDemand,
        priorityBreakdown,
        averageWaitingTimeMinutes,
      },
      shiftReports: db.shiftReports,
      cranes: db.cranes,
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to generate report summaries",
      detail: err.message || String(err),
      code: "REPORTS_FETCH_FAILED"
    });
  }
};

export const createShiftReport = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { shift, summary, date: reqDate } = req.body;

    if (!shift || !summary) {
      res.status(400).json({
        error: "Invalid input",
        detail: "Shift and Summary are required.",
        code: "SHIFT_REPORT_PARAMS_MISSING"
      });
      return;
    }

    const db = readDB();
    const date = reqDate || new Date().toISOString().split("T")[0];

    // Filter active requests for this specific date and shift
    const activeRequests = db.requests.filter((r) => {
      const rDate = r.createdAt ? r.createdAt.split("T")[0] : "";
      const matchesDate = rDate === date;
      const matchesShift = shift === "Daily Summary" || r.shift === shift;
      return matchesDate && matchesShift;
    });

    const scheduledCount = activeRequests.filter((r) => r.status === "Scheduled" || r.status === "Completed").length;
    const rejectedCount = activeRequests.filter((r) => r.status === "Rejected" || r.status === "Deferred").length;

    // Calculate actual crane utilization based on active schedules for this date/shift
    const calculateUtil = (craneId: string): number => {
      const craneJobs = db.schedules.filter((s) => {
        const req = db.requests.find((r) => r.id === s.requestId);
        if (!req) return false;
        const rDate = req.createdAt ? req.createdAt.split("T")[0] : "";
        const matchesDate = rDate === date;
        const matchesShift = shift === "Daily Summary" || req.shift === shift;
        if (!matchesDate || !matchesShift) return false;
        return s.assignedCrane === craneId || s.secondaryCrane === craneId;
      });

      let totalMinutes = 0;
      craneJobs.forEach((j) => {
        const start = parseTimeToMinutes(j.startTime);
        const end = parseTimeToMinutes(j.endTime);
        totalMinutes += (end - start);
      });

      const maxMinutes = shift === "Daily Summary" ? 24 * 60 : 8 * 60;
      return Math.min(Math.round((totalMinutes / maxMinutes) * 100), 100);
    };

    const craneA1Util = calculateUtil("A1");
    const craneA2Util = calculateUtil("A2");
    const craneA3Util = calculateUtil("A3");

    // Dynamic Area Demand
    const areaDemand: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    activeRequests.forEach((r) => {
      if (areaDemand[r.area] !== undefined) {
        areaDemand[r.area]++;
      }
    });

    // Dynamic Priority Breakdown
    const priorityBreakdown: Record<PriorityType, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    activeRequests.forEach((r) => {
      if (priorityBreakdown[r.priority] !== undefined) {
        priorityBreakdown[r.priority]++;
      }
    });

    // Dynamic average waiting/setup time
    const activeSchedules = db.schedules.filter((s) => 
      activeRequests.some((r) => r.id === s.requestId)
    );
    const averageWaitingTimeMinutes = activeSchedules.length > 0 
      ? Math.round(activeSchedules.reduce((acc, s) => acc + s.travelTimeMinutes + s.bufferTimeMinutes, 0) / activeSchedules.length) 
      : 0;

    const newReport: ShiftReport = {
      id: `REP-${Date.now().toString().slice(-4)}`,
      shift: shift as any,
      date,
      totalRequests: activeRequests.length,
      scheduledRequests: scheduledCount,
      rejectedRequests: rejectedCount,
      craneA1Util,
      craneA2Util,
      craneA3Util,
      areaDemand,
      priorityBreakdown,
      averageWaitingTimeMinutes,
      summary,
      createdBy: user.employeeId,
    };

    db.shiftReports.unshift(newReport);
    writeDB(db);

    logActivity(
      user.employeeId,
      user.name,
      "Report Created",
      `Shift Planning Report completed for ${shift} on ${date}.`
    );

    res.status(201).json(newReport);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to create shift report",
      detail: err.message || String(err),
      code: "SHIFT_REPORT_CREATION_FAILED"
    });
  }
};

export const completeShift = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { shift, date } = req.body;

    if (!shift || !date) {
      res.status(400).json({
        error: "Invalid input",
        detail: "Shift and Date are required to complete operational shift.",
        code: "COMPLETE_SHIFT_PARAMS_MISSING"
      });
      return;
    }

    const db = readDB();

    let count = 0;
    const completedReqIds = new Set<string>();

    db.requests = db.requests.map((r) => {
      const rDate = r.createdAt ? r.createdAt.split("T")[0] : "";
      const matchesDate = rDate === date;
      const matchesShift = shift === "All Shifts" || r.shift === shift;
      if (matchesDate && matchesShift && r.status !== "Completed") {
        count++;
        completedReqIds.add(r.id);
        return { ...r, status: "Completed" as const };
      }
      return r;
    });

    // Also mark matching schedules as Completed
    if (completedReqIds.size > 0) {
      db.schedules = db.schedules.map((s) => {
        if (completedReqIds.has(s.requestId)) {
          return { ...s, status: "Completed" };
        }
        return s;
      });
    }

    if (count > 0) {
      writeDB(db);
      logActivity(
        user.employeeId,
        user.name,
        "Shift Completed",
        `Operational shift completed. Marked ${count} work(s) as Completed for ${shift} on date ${date}.`
      );
    }

    res.json({
      success: true,
      archivedCount: count,
      message: `${count} work(s) successfully marked as Completed and moved to history.`
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Complete shift failed",
      detail: err.message || String(err),
      code: "COMPLETE_SHIFT_FAILED"
    });
  }
};

export const resetDatabase = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    await forceSeedDB();
    logActivity(
      user?.employeeId || "SYSTEM",
      user?.name || "System Master",
      "Database Reset",
      "Complete database state wiped and reset to clean empty state."
    );
    res.json({ success: true, message: "Database successfully cleared of active states." });
  } catch (err: any) {
    console.error("Failed to reset database:", err);
    res.status(500).json({
      error: "Failed to reset database",
      detail: err.message || String(err),
      code: "DATABASE_RESET_FAILED"
    });
  }
};
