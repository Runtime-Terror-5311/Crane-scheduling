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

function formatTimeTo12Hr(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mFormatted = String(m).padStart(2, "0");
  return `${h}:${mFormatted} ${ampm}`;
}

function verifyShiftBoundary(startTimeStr: string, endTimeStr: string, shift: ShiftType): { isValid: boolean; message?: string } {
  const sMins = parseTimeToMinutes(startTimeStr);
  let eMins = parseTimeToMinutes(endTimeStr);
  
  const window = SHIFT_WINDOWS[shift];
  if (!window) return { isValid: true };
  const [wStart, wEnd] = window;
  
  const start12 = formatTimeTo12Hr(startTimeStr);
  const end12 = formatTimeTo12Hr(endTimeStr);
  const wStart12 = formatTimeTo12Hr(formatMinutesToTime(wStart));
  const wEnd12 = formatTimeTo12Hr(formatMinutesToTime(wEnd));

  if (shift === "Shift C") {
    const normStart = sMins < 12 * 60 ? sMins + 24 * 60 : sMins;
    const normEnd = eMins < 12 * 60 ? eMins + 24 * 60 : eMins;
    
    if (normStart < wStart || normEnd > wEnd) {
      return {
        isValid: false,
        message: `The selected time (${start12} to ${end12}) is not in the Shift C schedule list. Shift C is strictly from ${wStart12} to ${wEnd12} (next day).`,
      };
    }
  } else {
    if (eMins < sMins) {
       return { isValid: false, message: "Estimated end time cannot be earlier than start time." };
    }
    if (sMins < wStart || eMins > wEnd) {
      return {
        isValid: false,
        message: `The selected time (${start12} to ${end12}) is not in the ${shift} schedule list. ${shift} is strictly from ${wStart12} to ${wEnd12}.`,
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
      // Auto-submit draft requests when generating schedule
      const status = (r.status === "Draft" || !r.status) ? "Submitted" : r.status;
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
    
    // Add warning for any crane currently in Maintenance or Breakdown
    db.cranes.forEach((c) => {
      if (c.status === "Maintenance") {
        warnings.push(`Crane ${c.id} is currently under maintenance. (CraneUnavailable)`);
      } else if (c.status === "Breakdown") {
        warnings.push(`Crane ${c.id} is currently in BREAKDOWN. (CraneUnavailable)`);
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
        const foundSchedule = schedulerResult.schedules.find((s) => s.requestId === r.id);
        const isScheduled = !!foundSchedule;
        const isDeferred = schedulerResult.deferredIds.includes(r.id);
        const isRejected = schedulerResult.rejectedIds.includes(r.id);

        if (isDeferred) {
          return { 
            ...r, 
            status: "Deferred" as const,
            estimatedStartTime: foundSchedule ? foundSchedule.startTime : r.estimatedStartTime,
            estimatedEndTime: foundSchedule ? foundSchedule.endTime : r.estimatedEndTime
          };
        } else if (isRejected) {
          return { ...r, status: "Rejected" as const };
        } else if (isScheduled && foundSchedule) {
          return { 
            ...r, 
            status: "Scheduled" as const,
            estimatedStartTime: foundSchedule.startTime,
            estimatedEndTime: foundSchedule.endTime
          };
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
      if (!activeCranesThisShift.has(crane.id) && crane.status !== "Maintenance" && crane.status !== "Breakdown") {
        return { ...crane, status: "Available" as const };
      }
      return crane;
    });

    // Populate crane allocations history for requests
    schedulerResult.schedules.forEach((s) => {
      const req = db.requests.find((r) => r.id === s.requestId);
      if (req) {
        if (!req.craneAllocations) {
          req.craneAllocations = [];
        }
        const allocDate = req.date || new Date().toISOString().split("T")[0];
        
        // Avoid duplicate log of the same allocation in current batch or history
        const isDuplicate = req.craneAllocations.some(
          (a) =>
            a.craneId === s.assignedCrane &&
            a.startTime === s.startTime &&
            a.endTime === s.endTime &&
            a.date === allocDate
        );
        if (!isDuplicate) {
          req.craneAllocations.push({
            craneId: s.assignedCrane,
            area: s.area,
            startColumn: s.startColumn,
            endColumn: s.endColumn,
            startTime: s.startTime,
            endTime: s.endTime,
            date: allocDate,
            assignedAt: new Date().toISOString()
          });
        }
      }
    });

    // Update schedules and cranes
    db.schedules = [...db.schedules, ...schedulerResult.schedules];
    db.cranes = updatedCranes;

    // Reset or initialize planning points if needed monthly
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!db.settings.lastPointsResetMonth || db.settings.lastPointsResetMonth !== currentMonthStr) {
      db.users.forEach((u: any) => {
        u.planningPoints = 100;
      });
      db.settings.lastPointsResetMonth = currentMonthStr;
    }

    // Now calculate planning points and priority penalties for each Area User
    db.users.forEach((u: any) => {
      if (u.planningPoints === undefined) {
        u.planningPoints = 100;
      }
      
      if (u.role === "Area User" && u.area) {
        // Find all active schedules in db.schedules that belong to this user's area
        const userSchedules = db.schedules.filter((s: any) => 
          Number(s.area) === Number(u.area) && 
          s.status !== "Completed" && 
          s.status !== "Cancelled"
        );
        const p1Count = userSchedules.filter((s: any) => s.priority === "P1").length;
        const p2Count = userSchedules.filter((s: any) => s.priority === "P2").length;

        let penalty = 0;
        if (p1Count > 2) {
          penalty += (p1Count - 2) * 10;
        }
        if (p2Count > 3) {
          penalty += (p2Count - 3) * 5;
        }

        // Count how many instant schedules they created
        const instantCount = db.requests.filter((r: any) => 
          Number(r.area) === Number(u.area) && 
          (r.id.startsWith("REQ-INST-") || (r.remarks && r.remarks.includes("Instantly Scheduled")))
        ).length;

        u.planningPoints = Math.max(0, 100 - (instantCount * 5) - penalty);
      }
    });

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
      if (c.status !== "Maintenance" && c.status !== "Breakdown") {
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

    // Add override allocation to craneAllocations history
    const targetReq = db.requests.find((r) => r.id === updated.requestId);
    if (targetReq) {
      targetReq.estimatedStartTime = updated.startTime;
      targetReq.estimatedEndTime = updated.endTime;
      if (updated.startColumn !== undefined) targetReq.startColumn = updated.startColumn;
      if (updated.endColumn !== undefined) targetReq.endColumn = updated.endColumn;

      if (!targetReq.craneAllocations) {
        targetReq.craneAllocations = [];
      }
      const allocDate = targetReq.date || new Date().toISOString().split("T")[0];
      
      const isDuplicate = targetReq.craneAllocations.some(
        (a) =>
          a.craneId === updated.assignedCrane &&
          a.startTime === updated.startTime &&
          a.endTime === updated.endTime &&
          a.date === allocDate
      );
      if (!isDuplicate) {
        targetReq.craneAllocations.push({
          craneId: updated.assignedCrane,
          area: updated.area,
          startColumn: updated.startColumn,
          endColumn: updated.endColumn,
          startTime: updated.startTime,
          endTime: updated.endTime,
          date: allocDate,
          assignedAt: new Date().toISOString()
        });
      }
    }

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

export const cancelSchedule = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const db = readDB();
    const schedIndex = db.schedules.findIndex((s) => s.id === id);
    if (schedIndex === -1) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const sched = db.schedules[schedIndex];
    
    // Update corresponding request status to "Draft"
    const reqIndex = db.requests.findIndex((r) => r.id === sched.requestId);
    if (reqIndex !== -1) {
      db.requests[reqIndex].status = "Draft";
    }

    // Remove the schedule from the active list
    db.schedules.splice(schedIndex, 1);

    writeDB(db);

    logActivity(
      user.employeeId,
      user.name,
      "Schedule Cancelled/Rescheduled",
      `Cancelled schedule ${id} for request ${sched.requestId}. Job reverted to draft for rescheduling.`
    );

    res.json({ success: true, message: "Job cancelled and reverted to Draft successfully." });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to cancel/reschedule job",
      detail: err.message || String(err),
      code: "CANCEL_FAILED"
    });
  }
};

export const instantSchedule = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const db = readDB();

    // First check and initialize / reset points
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!db.settings.lastPointsResetMonth || db.settings.lastPointsResetMonth !== currentMonthStr) {
      db.users.forEach((u) => {
        u.planningPoints = 100;
      });
      db.settings.lastPointsResetMonth = currentMonthStr;
    }

    // Find current logged user in DB
    const dbUser = db.users.find((u) => u.employeeId.toUpperCase() === user.employeeId.toUpperCase());
    if (!dbUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (dbUser.planningPoints === undefined) {
      dbUser.planningPoints = 100;
    }

    if (dbUser.planningPoints < 5) {
      res.status(400).json({
        error: "Insufficient Planning Points",
        detail: `Instant scheduling requires at least 5 planning/managerial skill points. Your current balance is ${dbUser.planningPoints} points.`,
        code: "INSUFFICIENT_POINTS"
      });
      return;
    }

    const {
      shift,
      area,
      bay,
      department,
      column,
      startColumn,
      endColumn,
      startTime,
      endTime,
      weight,
      priority,
      remarks,
      assignedCrane,
      isTandemLift,
      secondaryCrane
    } = req.body;

    if (!startTime || !endTime || !assignedCrane) {
      res.status(400).json({ error: "Start time, end time, and assigned crane are required for instant scheduling." });
      return;
    }

    // Verify if there is a conflict on the selected crane
    const sMins = parseTimeToMinutes(startTime);
    const eMins = parseTimeToMinutes(endTime);

    // Check if crane is in Maintenance or Breakdown
    const craneObj = db.cranes.find((c) => c.id === assignedCrane);
    if (craneObj && (craneObj.status === "Maintenance" || craneObj.status === "Breakdown")) {
      res.status(400).json({
        error: "Crane Unavailable",
        detail: `Crane ${assignedCrane} is currently in status '${craneObj.status}' and cannot accept jobs.`,
        code: "CRANE_UNAVAILABLE"
      });
      return;
    }

    // Simple overlap check
    const hasOverlap = db.schedules.some((s) => {
      if (s.assignedCrane !== assignedCrane && s.secondaryCrane !== assignedCrane) return false;
      const existingS = parseTimeToMinutes(s.startTime);
      const existingE = parseTimeToMinutes(s.endTime);
      // Check overlapping intervals
      return (sMins < existingE && eMins > existingS);
    });

    if (hasOverlap) {
      res.status(400).json({
        error: "Scheduling Conflict",
        detail: `Crane ${assignedCrane} has an overlapping scheduled job during this time window. Please select another time or crane.`,
        code: "CRANE_CONFLICT"
      });
      return;
    }

    // Create CraneRequest
    const reqId = `REQ-INST-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const newRequest = {
      id: reqId,
      shift: shift || "General Shift",
      area: Number(area) || 1,
      bay: bay || "A",
      department: department || "General Operation",
      column: Number(column) || 15,
      startColumn: startColumn !== undefined ? Number(startColumn) : Number(column) || 10,
      endColumn: endColumn !== undefined ? Number(endColumn) : Number(column) || 20,
      estimatedStartTime: startTime,
      estimatedEndTime: endTime,
      estimatedWeight: Number(weight) || 5,
      priority: priority || "P3",
      remarks: remarks ? `${remarks} (Instantly Scheduled)` : "Instantly Scheduled",
      mandatoryCrane: assignedCrane,
      status: "Scheduled" as const,
      createdAt: new Date().toISOString(),
      craneAllocations: [
        {
          craneId: assignedCrane,
          area: Number(area) || 1,
          startColumn: startColumn !== undefined ? Number(startColumn) : Number(column) || 10,
          endColumn: endColumn !== undefined ? Number(endColumn) : Number(column) || 20,
          startTime,
          endTime,
          date: new Date().toISOString().split("T")[0],
          assignedAt: new Date().toISOString()
        }
      ]
    };

    // Create Schedule
    const schedId = `SCH-INST-${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const newSchedule = {
      id: schedId,
      requestId: reqId,
      area: Number(area) || 1,
      bay: bay || "A",
      assignedCrane,
      column: Number(column) || 15,
      startColumn: startColumn !== undefined ? Number(startColumn) : Number(column) || 10,
      endColumn: endColumn !== undefined ? Number(endColumn) : Number(column) || 20,
      startTime,
      endTime,
      weight: Number(weight) || 5,
      priority: priority || "P3",
      status: "Approved",
      travelTimeMinutes: 2,
      bufferTimeMinutes: 3,
      remarks: remarks || "Instant Scheduling",
      department: department || "General Operation",
      isTandemLift: !!isTandemLift,
      secondaryCrane: secondaryCrane || undefined
    };

    db.requests.push(newRequest);
    db.schedules.push(newSchedule);

    // Recompute planning points and priorities dynamic penalties self-correction for all supervisors
    db.users.forEach((u: any) => {
      if (u.role === "Area User" && u.area) {
        const userSchedules = db.schedules.filter((s: any) => 
          Number(s.area) === Number(u.area) && 
          s.status !== "Completed" && 
          s.status !== "Cancelled"
        );
        const p1Count = userSchedules.filter((s: any) => s.priority === "P1").length;
        const p2Count = userSchedules.filter((s: any) => s.priority === "P2").length;

        let penalty = 0;
        if (p1Count > 2) {
          penalty += (p1Count - 2) * 10;
        }
        if (p2Count > 3) {
          penalty += (p2Count - 3) * 5;
        }

        const instantCount = db.requests.filter((r: any) => 
          Number(r.area) === Number(u.area) && 
          (r.id.startsWith("REQ-INST-") || (r.remarks && r.remarks.includes("Instantly Scheduled")))
        ).length;

        u.planningPoints = Math.max(0, 100 - (instantCount * 5) - penalty);
      }
    });

    writeDB(db);

    logActivity(
      dbUser.employeeId,
      dbUser.name,
      "Instant Schedule Created",
      `User instantly scheduled request ${reqId} on crane ${assignedCrane} for time ${startTime}-${endTime}. Deducted 5 planning points (Remaining: ${dbUser.planningPoints}).`
    );

    res.json({
      success: true,
      message: `Job instantly scheduled! 5 points deducted. Remaining points: ${dbUser.planningPoints}`,
      request: newRequest,
      schedule: newSchedule,
      planningPoints: dbUser.planningPoints
    });
  } catch (err: any) {
    res.status(500).json({
      error: "Instant scheduling failed",
      detail: err.message || String(err),
      code: "INSTANT_SCHEDULING_FAILED"
    });
  }
};
