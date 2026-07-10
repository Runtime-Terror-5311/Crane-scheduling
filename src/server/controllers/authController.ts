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

  const salt = bcrypt.genSaltSync(4);
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
    const salt = bcrypt.genSaltSync(4);
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

const otpStore = new Map<string, { email: string; otp: string; expiresAt: number; employeeId: string }>();

async function sendOTPEmail(email: string, otp: string, userName: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn(`[Brevo API] BREVO_API_KEY is not defined. OTP for ${email} is ${otp}`);
    return { success: true, mocked: true, otp };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@crane-ops.com";
  const senderName = process.env.BREVO_SENDER_NAME || "Crane-Ops Security";

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: userName }],
        subject: "Crane-Ops OTP: Verification Code",
        htmlContent: `
          <div style="font-family: 'JetBrains Mono', monospace; border: 4px solid #141414; padding: 24px; background-color: #ffffff; max-width: 500px; margin: 0 auto; box-shadow: 6px 6px 0px #141414;">
            <div style="background-color: #f59e0b; padding: 12px; border-bottom: 4px solid #141414; font-weight: bold; font-size: 18px; text-transform: uppercase; text-align: center; color: #141414;">
              CRANE-OPS SECURITY SERVICE
            </div>
            <div style="padding: 20px 0; color: #141414;">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>A password reset request was initiated for your system operator account.</p>
              <p style="margin: 24px 0; text-align: center;">
                <span style="font-size: 32px; font-weight: 800; background: #ffffff; padding: 12px 24px; letter-spacing: 4px; border: 3px solid #141414; box-shadow: 4px 4px 0px #141414; display: inline-block;">
                  ${otp}
                </span>
              </p>
              <p style="font-size: 11px; color: #555555; text-transform: uppercase; font-weight: bold;">
                SECURITY WARNING: This OTP is confidential and will expire in 10 minutes. If you did not make this request, please contact your System Administrator immediately.
              </p>
            </div>
            <div style="border-top: 2px solid #e4e4e7; padding-top: 12px; font-size: 9px; color: #71717a; text-transform: uppercase; font-weight: bold; text-align: center;">
              SYSTEM TERMINAL BAY 01 &bull; AUTOMATED ALERTS
            </div>
          </div>
        `
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Brevo API Error]", errorText);
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[Brevo API Connection Error]", error);
    return { success: false, error: error.message || String(error) };
  }
}

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email address is required" });
    return;
  }

  const db = readDB();
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email && u.email.trim().toLowerCase() === normalizedEmail);

  if (!user) {
    res.status(404).json({ error: "No user found with the provided email address." });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    email: normalizedEmail,
    otp,
    expiresAt,
    employeeId: user.employeeId,
  });

  const emailResult = await sendOTPEmail(normalizedEmail, otp, user.name);

  if (!emailResult.success) {
    res.status(500).json({ error: `Failed to send security alert: ${emailResult.error}` });
    return;
  }

  logActivity(
    user.employeeId,
    user.name,
    "OTP Requested",
    `Requested password recovery OTP for email ${normalizedEmail}.`
  );

  res.json({
    success: true,
    message: emailResult.mocked
      ? "Brevo SMTP not configured. OTP generated locally for testing."
      : "Security OTP successfully dispatched to your email address.",
    mocked: emailResult.mocked,
    otp: emailResult.mocked ? otp : undefined,
  });
};

export const resetPassword = (req: Request, res: Response): void => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({ error: "Email, OTP, and new password are required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const record = otpStore.get(normalizedEmail);

  if (!record) {
    res.status(400).json({ error: "No OTP request found for this email." });
    return;
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail);
    res.status(400).json({ error: "Verification code has expired. Please request a new OTP." });
    return;
  }

  if (record.otp !== otp.trim()) {
    res.status(400).json({ error: "Invalid verification code. Access denied." });
    return;
  }

  const db = readDB();
  const userIndex = db.users.findIndex((u) => u.employeeId.toUpperCase() === record.employeeId.toUpperCase());

  if (userIndex === -1) {
    res.status(404).json({ error: "User account could not be found." });
    return;
  }

  const user = db.users[userIndex];
  const salt = bcrypt.genSaltSync(4);
  const passwordHash = bcrypt.hashSync(newPassword.trim(), salt);

  db.users[userIndex] = {
    ...user,
    passwordHash,
  };

  writeDB(db);
  otpStore.delete(normalizedEmail);

  logActivity(
    user.employeeId,
    user.name,
    "Password Reset",
    `Successfully recovered password via OTP verification.`
  );

  res.json({ success: true, message: "Your password has been securely reset. You can now login." });
};
