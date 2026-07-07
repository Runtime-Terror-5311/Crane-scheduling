import { Request, Response } from "express";
import { readDB, writeDB, logActivity } from "../db/db.js";
import { Crane } from "../../types.js";

export const getCranes = (req: Request, res: Response): void => {
  const db = readDB();
  res.json(db.cranes);
};

export const updateCrane = (req: Request, res: Response): void => {
  const { id } = req.params;
  const { name, capacity, minColumn, maxColumn, allocatedMinColumn, allocatedMaxColumn, currentColumn, status, maintenanceNotes } = req.body;
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
  };

  db.cranes[craneIndex] = updatedCrane;
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
  const { id, name, capacity, minColumn, maxColumn, allocatedMinColumn, allocatedMaxColumn, currentColumn } = req.body;
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
  };

  db.cranes.push(newCrane);
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
