import { Request, Response } from "express";
import { readDB, writeDB, logActivity } from "../db/db.js";
import { Crane } from "../../types.js";

function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isTimeWithinRange(currentTime: Date, startTimeStr: string, endTimeStr: string): boolean {
  const currMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const startMins = parseTimeToMinutes(startTimeStr);
  const endMins = parseTimeToMinutes(endTimeStr);

  if (endMins < startMins) {
    // Spans across midnight
    return currMins >= startMins || currMins <= endMins;
  } else {
    // Normal daytime schedule
    return currMins >= startMins && currMins <= endMins;
  }
}

export function resolveAllCranesPositions(allCranes: Crane[], modifiedId?: string): void {
  // Group cranes by bay (first character of ID)
  const baysMap = new Map<string, Crane[]>();
  for (const c of allCranes) {
    const bay = c.id.charAt(0).toUpperCase();
    if (!baysMap.has(bay)) {
      baysMap.set(bay, []);
    }
    baysMap.get(bay)!.push(c);
  }

  for (const [bay, cranes] of baysMap.entries()) {
    cranes.sort((a, b) => a.id.localeCompare(b.id));
    if (cranes.length < 2) continue;

    // We do multiple passes to make sure any ripple shift is resolved
    let changed = true;
    let passes = 0;
    while (changed && passes < 10) {
      changed = false;
      passes++;

      for (let i = 0; i < cranes.length - 1; i++) {
        const left = cranes[i];
        const right = cranes[i + 1];

        if (left.currentColumn >= right.currentColumn) {
          // Conflict! We need to shift them apart.
          if (left.id === modifiedId) {
            // We cannot shift left, so we must shift right!
            right.currentColumn = Math.min(30, left.currentColumn + 1);
            changed = true;
          } else if (right.id === modifiedId) {
            // We cannot shift right, so we must shift left!
            left.currentColumn = Math.max(1, right.currentColumn - 1);
            changed = true;
          } else {
            // Default shift left to left, right to right
            left.currentColumn = Math.max(1, right.currentColumn - 1);
            changed = true;
          }
        }
      }
    }
  }
}

export const getCranes = (req: Request, res: Response): void => {
  const db = readDB();
  const now = new Date();
  let changed = false;

  db.cranes.forEach((crane) => {
    if (crane.status === "Maintenance" || crane.status === "Breakdown") return;

    const hasActiveSchedule = db.schedules.some((s) => {
      if (s.assignedCrane !== crane.id && s.secondaryCrane !== crane.id) return false;
      if (s.status === "Completed" || s.status === "Rejected" || s.status === "Deferred") return false;
      return isTimeWithinRange(now, s.startTime, s.endTime);
    });

    const expectedStatus = hasActiveSchedule ? "Busy" : "Available";
    if (crane.status !== expectedStatus) {
      crane.status = expectedStatus as any;
      changed = true;
    }
  });

  if (changed) {
    writeDB(db);
  }

  res.json(db.cranes);
};

export const updateCrane = (req: Request, res: Response): void => {
  const { id } = req.params;
  const { name, capacity, minColumn, maxColumn, allocatedMinColumn, allocatedMaxColumn, currentColumn, status, maintenanceNotes, auxCapacity, breakdownStartCol, breakdownEndCol } = req.body;
  const adminUser = (req as any).user;

  const db = readDB();
  const craneIndex = db.cranes.findIndex((c) => c.id === id);

  if (craneIndex === -1) {
    res.status(404).json({ error: "Crane not found" });
    return;
  }

  const oldCrane = db.cranes[craneIndex];
  const updatedCrane: Crane = {
    ...oldCrane,
    name: name !== undefined ? name.trim() : oldCrane.name,
    capacity: typeof capacity === "number" ? capacity : oldCrane.capacity,
    minColumn: typeof minColumn === "number" ? minColumn : oldCrane.minColumn,
    maxColumn: typeof maxColumn === "number" ? maxColumn : oldCrane.maxColumn,
    allocatedMinColumn: typeof allocatedMinColumn === "number" ? allocatedMinColumn : oldCrane.allocatedMinColumn,
    allocatedMaxColumn: typeof allocatedMaxColumn === "number" ? allocatedMaxColumn : oldCrane.allocatedMaxColumn,
    currentColumn: typeof currentColumn === "number" ? currentColumn : oldCrane.currentColumn,
    status: status || oldCrane.status,
    maintenanceNotes: typeof maintenanceNotes === "string" ? maintenanceNotes : oldCrane.maintenanceNotes,
    auxCapacity: typeof auxCapacity === "number" ? auxCapacity : (auxCapacity === null ? undefined : oldCrane.auxCapacity),
    breakdownStartCol: status === "Breakdown" 
      ? (breakdownStartCol !== undefined && breakdownStartCol !== null && !isNaN(Number(breakdownStartCol))
          ? Number(breakdownStartCol)
          : (oldCrane.breakdownStartCol !== undefined && oldCrane.breakdownStartCol !== null
              ? oldCrane.breakdownStartCol
              : Math.max(1, (typeof currentColumn === "number" ? currentColumn : oldCrane.currentColumn) - 1)))
      : undefined,
    breakdownEndCol: status === "Breakdown" 
      ? (breakdownEndCol !== undefined && breakdownEndCol !== null && !isNaN(Number(breakdownEndCol))
          ? Number(breakdownEndCol)
          : (oldCrane.breakdownEndCol !== undefined && oldCrane.breakdownEndCol !== null
              ? oldCrane.breakdownEndCol
              : Math.min(30, (typeof currentColumn === "number" ? currentColumn : oldCrane.currentColumn) + 1)))
      : undefined,
  };

  db.cranes[craneIndex] = updatedCrane;
  // Resolve physical positions to avoid crossing/collision alerts
  resolveAllCranesPositions(db.cranes, updatedCrane.id);
  // Sort cranes alphabetically by ID to keep rail order preserved
  db.cranes.sort((a, b) => a.id.localeCompare(b.id));
  writeDB(db);

  logActivity(
    adminUser.employeeId,
    adminUser.name,
    "Crane Updated",
    `Crane ${id} modified. Capacity: ${updatedCrane.capacity}T, Col: ${updatedCrane.currentColumn}, Status: ${updatedCrane.status}`
  );

  res.json(updatedCrane);
};

export const createCrane = (req: Request, res: Response): void => {
  const { id, name, capacity, minColumn, maxColumn, allocatedMinColumn, allocatedMaxColumn, currentColumn, auxCapacity } = req.body;
  const adminUser = (req as any).user;

  if (!id || !name || !capacity) {
    res.status(400).json({ error: "ID, Name, and Capacity are required for a Crane" });
    return;
  }

  const db = readDB();
  const upperId = id.trim().toUpperCase();
  if (db.cranes.some((c) => c.id.toUpperCase() === upperId)) {
    res.status(400).json({ error: `Crane with ID ${upperId} already exists.` });
    return;
  }

  const newCrane: Crane = {
    id: upperId,
    name: name.trim(),
    capacity: Number(capacity),
    minColumn: minColumn !== undefined ? Number(minColumn) : 1,
    maxColumn: maxColumn !== undefined ? Number(maxColumn) : 30,
    allocatedMinColumn: allocatedMinColumn !== undefined ? Number(allocatedMinColumn) : undefined,
    allocatedMaxColumn: allocatedMaxColumn !== undefined ? Number(allocatedMaxColumn) : undefined,
    currentColumn: currentColumn !== undefined ? Number(currentColumn) : 15,
    status: "Available",
    maintenanceNotes: "",
    auxCapacity: auxCapacity !== undefined && auxCapacity !== null ? Number(auxCapacity) : undefined,
  };

  db.cranes.push(newCrane);
  // Resolve physical positions to avoid crossing/collision alerts
  resolveAllCranesPositions(db.cranes, newCrane.id);
  db.cranes.sort((a, b) => a.id.localeCompare(b.id));
  writeDB(db);

  logActivity(
    adminUser.employeeId,
    adminUser.name,
    "Crane Created",
    `Created Crane ${newCrane.name} (${newCrane.id}) with ${newCrane.capacity}T capacity.`
  );

  res.status(201).json(newCrane);
};

export const deleteCrane = (req: Request, res: Response): void => {
  const { id } = req.params;
  const adminUser = (req as any).user;

  const db = readDB();
  const originalLength = db.cranes.length;
  db.cranes = db.cranes.filter((c) => c.id.toUpperCase() !== id.toUpperCase());

  if (db.cranes.length === originalLength) {
    res.status(404).json({ error: "Crane not found" });
    return;
  }

  writeDB(db);

  logActivity(
    adminUser.employeeId,
    adminUser.name,
    "Crane Deleted",
    `Deleted Crane ${id} from the system registry.`
  );

  res.json({ success: true, message: `Crane ${id} deleted successfully.` });
};
