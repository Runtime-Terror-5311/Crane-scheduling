import { Request, Response } from "express";
import { readDB, writeDB, logActivity } from "../db/db.js";
import { CraneRequest, PriorityType, ShiftType } from "../../types.js";

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

export function matchesRequestId(storedId: string, queryId: string): boolean {
  const sClean = storedId.replace(/^REQ-/, "");
  const qClean = queryId.replace(/^REQ-/, "");
  return sClean === qClean;
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
    
    if (normEnd <= normStart) {
      return {
        isValid: false,
        message: "Estimated end time must be strictly after start time.",
      };
    }
    
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

export const getRequests = (req: Request, res: Response): void => {
  try {
    const db = readDB();
    res.json(db.requests);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to retrieve requests",
      detail: err.message || String(err),
      code: "REQUEST_FETCH_FAILED"
    });
  }
};

export const getRequestById = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const db = readDB();
    
    const request = db.requests.find((r) => matchesRequestId(r.id, id));
    if (!request) {
      res.status(404).json({
        error: "Request not found",
        detail: `No request matches ID: ${id}`,
        code: "REQUEST_NOT_FOUND"
      });
      return;
    }
    res.json(request);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to query request",
      detail: err.message || String(err),
      code: "REQUEST_QUERY_FAILED"
    });
  }
};

export const createRequest = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    if (user.role !== "Admin" && !user.area) {
      res.status(403).json({
        error: "Forbidden",
        detail: "Area User must be assigned to an area to request cranes.",
        code: "USER_AREA_UNASSIGNED"
      });
      return;
    }

    // Apply defaults and fallbacks for request creation
    const shift = (req.body.shift || "General") as ShiftType;
    const department = (req.body.department || "General Operation").trim();
    const columnVal = req.body.column !== undefined && req.body.column !== null ? Number(req.body.column) : 1;
    
    const rawStartCol = req.body.startColumn !== undefined ? Number(req.body.startColumn) : columnVal;
    const rawEndCol = req.body.endColumn !== undefined ? Number(req.body.endColumn) : columnVal;
    
    const finalStartCol = Math.min(rawStartCol, rawEndCol);
    const finalEndCol = Math.max(rawStartCol, rawEndCol);
    const finalCol = Math.round((finalStartCol + finalEndCol) / 2);

    const estimatedStartTime = req.body.estimatedStartTime || "09:00";
    const estimatedEndTime = req.body.estimatedEndTime || "09:30";
    const estimatedWeight = req.body.estimatedWeight !== undefined ? Number(req.body.estimatedWeight) : 1;
    const priority = (req.body.priority || "P4") as PriorityType;
    const remarks = req.body.remarks || "";
    const mandatoryCrane = (req.body.mandatoryCrane || "Any") as "Any" | "A1" | "A2" | "A3";
    const isTandemLift = req.body.isTandemLift !== undefined ? Boolean(req.body.isTandemLift) : false;
    const status = req.body.status || "Submitted"; // Default to Submitted as per guidelines/tests
    const machineName = req.body.machineName || "";

    // Enforce shift boundary check
    const boundaryCheck = verifyShiftBoundary(estimatedStartTime, estimatedEndTime, shift);
    if (!boundaryCheck.isValid) {
      res.status(400).json({
        error: "Shift boundary violation",
        detail: boundaryCheck.message || "The requested time is outside shift hours.",
        code: "SHIFT_BOUNDARY_VIOLATION"
      });
      return;
    }

    const area = user.role === "Admin" ? Number(req.body.area || 1) : Number(user.area);
    const db = readDB();
    const jobType = req.body.jobType === "Continuation" ? "Continuation" : "New";
    const parentJobId = req.body.parentJobId || undefined;
    const reqId = jobType === "Continuation" && parentJobId
  ? `${parentJobId}-CONT-${Math.floor(10 + Math.random() * 90)}`
  : `REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let bay = (req.body.bay || "A").trim().toUpperCase();
    if (mandatoryCrane && mandatoryCrane !== "Any") {
      bay = mandatoryCrane.charAt(0).toUpperCase();
    }

    const newRequest: CraneRequest = {
      id: reqId,
      shift,
      area,
      bay,
      department,
      column: finalCol,
      startColumn: finalStartCol,
      endColumn: finalEndCol,
      estimatedStartTime,
      estimatedEndTime,
      estimatedWeight,
      priority,
      remarks,
      mandatoryCrane,
      isTandemLift,
      status: status as any,
      createdAt: new Date().toISOString(),
      machineName,
      date: req.body.date || new Date().toISOString().split("T")[0],
      jobType,
      parentJobId,
      details: req.body.details || undefined,
      completionPercentage: req.body.completionPercentage !== undefined ? Number(req.body.completionPercentage) : undefined,
      isVerified: req.body.isVerified || false,
      verificationTime: req.body.verificationTime || undefined,
      verifiedBy: req.body.verifiedBy || undefined,
    };

    db.requests.push(newRequest);
    writeDB(db);

    logActivity(
      user.employeeId,
      user.name,
      "Request Created",
      `Created job ${reqId} (${status}) in Area ${area}, Columns ${finalStartCol}-${finalEndCol}.${jobType === "Continuation" ? ` Continuation of ${parentJobId}` : ""}`
    );

    res.status(201).json(newRequest);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to create request",
      detail: err.message || String(err),
      code: "REQUEST_CREATION_FAILED"
    });
  }
};

export const updateRequest = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const db = readDB();

    const reqIndex = db.requests.findIndex((r) => matchesRequestId(r.id, id));
    if (reqIndex === -1) {
      res.status(404).json({
        error: "Request not found",
        detail: `No request found matching ID: ${id}`,
        code: "REQUEST_NOT_FOUND"
      });
      return;
    }

    const existingReq = db.requests[reqIndex];

    if (user.role !== "Admin") {
      if (existingReq.area !== user.area) {
        res.status(403).json({
          error: "Forbidden",
          detail: "Cannot edit requests for other areas.",
          code: "REQUEST_EDIT_FORBIDDEN"
        });
        return;
      }
      if (existingReq.status !== "Draft") {
        res.status(403).json({
          error: "Forbidden",
          detail: "Cannot edit requests that have already been submitted.",
          code: "REQUEST_NOT_DRAFT"
        });
        return;
      }
    }

    const shift = (req.body.shift || existingReq.shift) as ShiftType;
    const estimatedStartTime = req.body.estimatedStartTime || existingReq.estimatedStartTime;
    const estimatedEndTime = req.body.estimatedEndTime || existingReq.estimatedEndTime;

    // Enforce shift boundary check if shift or times are being updated
    const boundaryCheck = verifyShiftBoundary(estimatedStartTime, estimatedEndTime, shift);
    if (!boundaryCheck.isValid) {
      res.status(400).json({
        error: "Shift boundary violation",
        detail: boundaryCheck.message || "The requested time is outside shift hours.",
        code: "SHIFT_BOUNDARY_VIOLATION"
      });
      return;
    }

    const rawStartCol = req.body.startColumn !== undefined ? Number(req.body.startColumn) : (req.body.column !== undefined ? Number(req.body.column) : existingReq.startColumn);
    const rawEndCol = req.body.endColumn !== undefined ? Number(req.body.endColumn) : (req.body.column !== undefined ? Number(req.body.column) : existingReq.endColumn);
    const finalStartCol = Math.min(rawStartCol, rawEndCol);
    const finalEndCol = Math.max(rawStartCol, rawEndCol);
    const finalCol = Math.round((finalStartCol + finalEndCol) / 2);

    let bay = req.body.bay || existingReq.bay || "A";
    const mandatoryCrane = req.body.mandatoryCrane || existingReq.mandatoryCrane;
    if (req.body.mandatoryCrane && req.body.mandatoryCrane !== "Any") {
      bay = req.body.mandatoryCrane.charAt(0).toUpperCase();
    }

    const updatedReq: CraneRequest = {
      ...existingReq,
      shift,
      bay: bay.toUpperCase(),
      department: req.body.department || existingReq.department,
      column: finalCol,
      startColumn: finalStartCol,
      endColumn: finalEndCol,
      estimatedStartTime,
      estimatedEndTime,
      estimatedWeight: req.body.estimatedWeight !== undefined ? Number(req.body.estimatedWeight) : existingReq.estimatedWeight,
      priority: req.body.priority || existingReq.priority,
      remarks: req.body.remarks !== undefined ? req.body.remarks : existingReq.remarks,
      mandatoryCrane: req.body.mandatoryCrane || existingReq.mandatoryCrane,
      isTandemLift: req.body.isTandemLift !== undefined ? Boolean(req.body.isTandemLift) : (existingReq.isTandemLift || false),
      status: req.body.status ? req.body.status : existingReq.status,
      date: req.body.date || existingReq.date || existingReq.createdAt.split("T")[0],
      machineName: req.body.machineName !== undefined ? req.body.machineName : existingReq.machineName,
      jobType: req.body.jobType !== undefined ? req.body.jobType : existingReq.jobType,
      parentJobId: req.body.parentJobId !== undefined ? req.body.parentJobId : existingReq.parentJobId,
      details: req.body.details !== undefined ? req.body.details : existingReq.details,
      completionPercentage: req.body.completionPercentage !== undefined ? Number(req.body.completionPercentage) : existingReq.completionPercentage,
      isVerified: req.body.isVerified !== undefined ? Boolean(req.body.isVerified) : existingReq.isVerified,
      verificationTime: req.body.verificationTime !== undefined ? req.body.verificationTime : existingReq.verificationTime,
      verifiedBy: req.body.verifiedBy !== undefined ? req.body.verifiedBy : existingReq.verifiedBy,
    };

    db.requests[reqIndex] = updatedReq;
    writeDB(db);

    logActivity(user.employeeId, user.name, "Request Updated", `Modified job ${existingReq.id}. Current status: ${updatedReq.status}.`);

    res.json(updatedReq);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to update request",
      detail: err.message || String(err),
      code: "REQUEST_UPDATE_FAILED"
    });
  }
};

export const deleteRequest = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const db = readDB();

    const reqIndex = db.requests.findIndex((r) => matchesRequestId(r.id, id));
    if (reqIndex === -1) {
      res.status(404).json({
        error: "Request not found",
        detail: `No request found matching ID: ${id}`,
        code: "REQUEST_NOT_FOUND"
      });
      return;
    }

    const existingReq = db.requests[reqIndex];

    if (user.role !== "Admin") {
      if (existingReq.area !== user.area) {
        res.status(403).json({
          error: "Forbidden",
          detail: "Cannot delete requests from other areas.",
          code: "REQUEST_DELETE_FORBIDDEN"
        });
        return;
      }
      if (existingReq.status !== "Draft" && existingReq.status !== "Submitted") {
        res.status(403).json({
          error: "Forbidden",
          detail: "Cannot delete requests that are already scheduled or completed.",
          code: "REQUEST_NOT_DRAFT_OR_SUBMITTED"
        });
        return;
      }
    }

    db.requests.splice(reqIndex, 1);
    writeDB(db);

    logActivity(user.employeeId, user.name, "Request Deleted", `Deleted job ${existingReq.id}.`);

    res.json({ success: true, message: `Request ${existingReq.id} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to delete request",
      detail: err.message || String(err),
      code: "REQUEST_DELETE_FAILED"
    });
  }
};

export const submitAllRequests = (req: Request, res: Response): void => {
  try {
    const user = (req as any).user;
    const { area } = req.body;

    const targetArea = user.role === "Admin" ? Number(area || 1) : Number(user.area);

    const db = readDB();
    let submittedCount = 0;

    db.requests = db.requests.map((r) => {
      if (r.area === targetArea && (r.status === "Draft" || !r.status)) {
        submittedCount++;
        return { ...r, status: "Submitted" };
      }
      return r;
    });

    if (submittedCount === 0) {
      res.status(400).json({
        error: "No drafts found",
        detail: `No Draft requests found in Area ${targetArea} to submit.`,
        code: "NO_DRAFTS_FOUND"
      });
      return;
    }

    writeDB(db);
    logActivity(user.employeeId, user.name, "Submit All Requests", `Submitted ${submittedCount} jobs together for Area ${targetArea}.`);

    res.json({ success: true, message: `Successfully submitted ${submittedCount} draft requests for Area ${targetArea}.` });
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to submit requests",
      detail: err.message || String(err),
      code: "REQUEST_SUBMIT_ALL_FAILED"
    });
  }
};

export const reopenRequest = (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const db = readDB();
    const reqIndex = db.requests.findIndex((r) => matchesRequestId(r.id, id));

    if (reqIndex === -1) {
      res.status(404).json({
        error: "Request not found",
        detail: `No request found matching ID: ${id}`,
        code: "REQUEST_NOT_FOUND"
      });
      return;
    }

    db.requests[reqIndex].status = "Draft";
    writeDB(db);

    logActivity(user.employeeId, user.name, "Request Reopened", `Reopened job ${db.requests[reqIndex].id} back to Draft mode.`);

    res.json(db.requests[reqIndex]);
  } catch (err: any) {
    res.status(500).json({
      error: "Failed to reopen request",
      detail: err.message || String(err),
      code: "REQUEST_REOPEN_FAILED"
    });
  }
};
