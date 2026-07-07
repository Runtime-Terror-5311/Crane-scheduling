import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { readDB, writeDB, logActivity } from "../db/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "CRANE_SECRET_SECURE_JWT_KEY_2026";

export const login = (req: Request, res: Response): void => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    res.status(400).json({ error: "Employee ID and Password are required" });
    return;
  }

  const db = readDB();
  const user = db.users.find((u) => u.employeeId.toUpperCase() === employeeId.trim().toUpperCase());

  if (!user) {
    res.status(401).json({ error: "Invalid Employee ID or Password" });
    return;
  }

  const isPasswordValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ error: "Invalid Employee ID or Password" });
    return;
  }

  const token = jwt.sign(
    { employeeId: user.employeeId, name: user.name, role: user.role, area: user.area },
    JWT_SECRET,
    { expiresIn: "12h" }
  );

  logActivity(user.employeeId, user.name, "User Login", `Logged in from terminal interface.`);

  res.json({
    token,
    user: {
      employeeId: user.employeeId,
      name: user.name,
      role: user.role,
      area: user.area,
    },
  });
};

export const getMe = (req: Request, res: Response): void => {
  const u = (req as any).user;
  res.json({ user: u });
};

export const getUsers = (req: Request, res: Response): void => {
  const db = readDB();
  // Don't expose password hashes
  const safeUsers = db.users.map(({ employeeId, name, role, area, phone, email, craneNo }) => ({
    employeeId,
    name,
    role,
    area,
    phone: phone || "",
    email: email || "",
    craneNo: craneNo || "",
  }));
  res.json(safeUsers);
};

export const createUser = (req: Request, res: Response): void => {
  const { employeeId, name, role, area, password, phone, email, craneNo } = req.body;
  const adminUser = (req as any).user;

  if (!employeeId || !name || !role || !password) {
    res.status(400).json({ error: "Missing required user fields" });
    return;
  }

  const db = readDB();
  if (db.users.some((u) => u.employeeId.toUpperCase() === employeeId.toUpperCase())) {
    res.status(400).json({ error: "Employee ID already exists" });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const newUser = {
    employeeId: employeeId.trim().toUpperCase(),
    name: name.trim(),
    role: role as "Admin" | "Area User",
    area: role === "Admin" ? null : (area !== undefined && area !== null ? Number(area) : null),
    phone: phone ? phone.trim() : "",
    email: email ? email.trim() : "",
    craneNo: craneNo ? craneNo.trim().toUpperCase() : "",
    passwordHash,
  };

  db.users.push(newUser);

  // If a craneNo is specified, auto-create the crane if it doesn't exist
  const upperCraneNo = newUser.craneNo;
  if (upperCraneNo) {
    const craneExists = db.cranes.some((c) => c.id.toUpperCase() === upperCraneNo);
    if (!craneExists) {
      db.cranes.push({
        id: upperCraneNo,
        name: `Crane ${upperCraneNo}`,
        capacity: 50,
        minColumn: 1,
        maxColumn: 30,
        currentColumn: 15,
        status: "Available",
        maintenanceNotes: `Created automatically for operator ${newUser.name}`,
      });
      db.cranes.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  writeDB(db);

  logActivity(
    adminUser.employeeId,
    adminUser.name,
    "User Created",
    `Created user ${newUser.name} (${newUser.employeeId}) as ${newUser.role}`
  );

  res.status(201).json({
    employeeId: newUser.employeeId,
    name: newUser.name,
    role: newUser.role,
    area: newUser.area,
    phone: newUser.phone,
    email: newUser.email,
    craneNo: newUser.craneNo,
  });
};

export const updateUser = (req: Request, res: Response): void => {
  const { employeeId } = req.params;
  const { name, role, area, password, phone, email, craneNo } = req.body;
  const adminUser = (req as any).user;

  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.employeeId.toUpperCase() === employeeId.toUpperCase());

  if (userIndex === -1) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existingUser = db.users[userIndex];

  let passwordHash = existingUser.passwordHash;
  if (password && password.trim() !== "") {
    const salt = bcrypt.genSaltSync(10);
    passwordHash = bcrypt.hashSync(password, salt);
  }

  const updatedUser = {
    ...existingUser,
    name: name !== undefined ? name.trim() : existingUser.name,
    role: role !== undefined ? role : existingUser.role,
    area: role === "Admin" ? null : (area !== undefined ? (area !== null ? Number(area) : null) : existingUser.area),
    phone: phone !== undefined ? phone.trim() : (existingUser.phone || ""),
    email: email !== undefined ? email.trim() : (existingUser.email || ""),
    craneNo: craneNo !== undefined ? craneNo.trim().toUpperCase() : (existingUser.craneNo || ""),
    passwordHash,
  };

  db.users[userIndex] = updatedUser;

  // If a craneNo is specified, auto-create the crane if it doesn't exist
  const upperCraneNo = updatedUser.craneNo;
  if (upperCraneNo) {
    const craneExists = db.cranes.some((c) => c.id.toUpperCase() === upperCraneNo);
    if (!craneExists) {
      db.cranes.push({
        id: upperCraneNo,
        name: `Crane ${upperCraneNo}`,
        capacity: 50,
        minColumn: 1,
        maxColumn: 30,
        currentColumn: 15,
        status: "Available",
        maintenanceNotes: `Created automatically for operator ${updatedUser.name}`,
      });
      db.cranes.sort((a, b) => a.id.localeCompare(b.id));
    }
  }

  writeDB(db);

  logActivity(
    adminUser.employeeId,
    adminUser.name,
    "User Updated",
    `Updated user ${updatedUser.name} (${updatedUser.employeeId}).`
  );

  res.json({
    employeeId: updatedUser.employeeId,
    name: updatedUser.name,
    role: updatedUser.role,
    area: updatedUser.area,
    phone: updatedUser.phone,
    email: updatedUser.email,
    craneNo: updatedUser.craneNo,
  });
};

export const deleteUser = (req: Request, res: Response): void => {
  const { employeeId } = req.params;
  const adminUser = (req as any).user;

  if (adminUser.employeeId === employeeId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const db = readDB();
  const originalLength = db.users.length;
  db.users = db.users.filter((u) => u.employeeId.toUpperCase() !== employeeId.toUpperCase());

  if (db.users.length === originalLength) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  writeDB(db);
  logActivity(adminUser.employeeId, adminUser.name, "User Deleted", `Deleted user account ${employeeId}`);
  res.json({ success: true, message: `User ${employeeId} deleted successfully.` });
};
