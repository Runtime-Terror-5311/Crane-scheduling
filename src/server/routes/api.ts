import { Router } from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { databaseLockMiddleware } from "../middleware/dbLock.js";
import {
  login,
  getMe,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import {
  getCranes,
  updateCrane,
  createCrane,
  deleteCrane,
} from "../controllers/craneController.js";
import {
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  submitAllRequests,
  reopenRequest,
} from "../controllers/requestController.js";
import {
  getSchedules,
  generateSchedule,
  clearSchedule,
  overrideSchedule,
  getSettings,
  updateSettings,
  getLogs,
  getReports,
  createShiftReport,
  completeShift,
  resetDatabase,
  cancelSchedule,
  instantSchedule,
} from "../controllers/scheduleController.js";

const router = Router();

// DB Lock Middleware is applied to all API endpoints
router.use(databaseLockMiddleware);

// Authentication
router.post("/auth/login", login);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.get("/auth/me", authenticateToken, getMe);

// Cranes
router.get("/cranes", authenticateToken, getCranes);
router.post("/cranes", authenticateToken, createCrane);
router.put("/cranes/:id", authenticateToken, updateCrane);
router.delete("/cranes/:id", authenticateToken, deleteCrane);

// Users Management
router.get("/users", authenticateToken, requireAdmin, getUsers);
router.post("/users", authenticateToken, requireAdmin, createUser);
router.put("/users/:employeeId", authenticateToken, requireAdmin, updateUser);
router.delete("/users/:employeeId", authenticateToken, requireAdmin, deleteUser);

// Requests / Jobs Log
router.get("/requests", authenticateToken, getRequests);
router.get("/requests/:id", authenticateToken, getRequestById);
router.post("/requests", authenticateToken, createRequest);
router.put("/requests/:id", authenticateToken, updateRequest);
router.delete("/requests/:id", authenticateToken, deleteRequest);
router.post("/requests/submit-all", authenticateToken, submitAllRequests);
router.post("/requests/:id/reopen", authenticateToken, requireAdmin, reopenRequest);

// Scheduling Engine
router.get("/schedules", authenticateToken, getSchedules);
router.post("/schedules/generate", authenticateToken, requireAdmin, generateSchedule);
router.post("/schedules/clear", authenticateToken, requireAdmin, clearSchedule);
router.patch("/schedules/:id/override", authenticateToken, requireAdmin, overrideSchedule);
router.post("/schedules/complete", authenticateToken, requireAdmin, completeShift);
router.delete("/schedules/:id", authenticateToken, cancelSchedule);
router.post("/schedules/instant", authenticateToken, instantSchedule);

// Settings
router.get("/settings", authenticateToken, getSettings);
router.put("/settings", authenticateToken, requireAdmin, updateSettings);
router.post("/admin/reset-db", authenticateToken, requireAdmin, resetDatabase);

// Audit Logs
router.get("/logs", authenticateToken, requireAdmin, getLogs);

// Reports & Analytics
router.get("/reports", authenticateToken, getReports);
router.post("/reports", authenticateToken, createShiftReport);

export default router;
