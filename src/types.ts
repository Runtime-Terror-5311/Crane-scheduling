export type UserRole = "Admin" | "Area User";

export interface User {
  employeeId: string;
  name: string;
  role: UserRole;
  area: number | null; // 1, 2, 3, or null for Admin
  phone?: string;
  email?: string;
  craneNo?: string;
  planningPoints?: number; // 0-100 planning/managerial skill points
}

export type ShiftType = "Shift A" | "Shift B" | "Shift C" | "General Shift";

export type PriorityType = "P1" | "P2" | "P3" | "P4"; // P1 Critical, P2 Urgent, P3 Normal, P4 Planned

export type RequestStatus = "Draft" | "Submitted" | "Scheduled" | "Rejected" | "Deferred" | "Rescheduled" | "Completed";

export type CraneStatus = "Available" | "Maintenance" | "Busy" | "Breakdown";

export interface Crane {
  id: string; // "A1", "A2", "A3"
  name: string;
  capacity: number; // in Ton
  auxCapacity?: number; // auxiliary hoist capacity in Ton
  minColumn: number; // range min
  maxColumn: number; // range max
  allocatedMinColumn?: number;
  allocatedMaxColumn?: number;
  currentColumn: number;
  status: CraneStatus;
  maintenanceNotes: string;
  breakdownStartCol?: number;
  breakdownEndCol?: number;
}

export interface CraneAllocationHistory {
  craneId: string;
  area: number;
  startColumn: number;
  endColumn: number;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date: string;      // "YYYY-MM-DD"
  assignedAt: string; // ISO timestamp
}

export interface CraneRequest {
  id: string; // Auto-generated Request ID
  shift: ShiftType;
  area: number; // 1, 2, or 3
  bay?: string; // "A", "B", etc.
  department: string;
  column: number; // Fallback or primary column
  startColumn: number; // Start of column range for the job
  endColumn: number;   // End of column range for the job
  estimatedStartTime: string; // "HH:MM" or datetime string
  estimatedEndTime: string;   // "HH:MM" or datetime string
  estimatedWeight: number;    // Ton
  priority: PriorityType;
  remarks: string;
  mandatoryCrane: string; // Dynamic crane ID or "Any"
  isTandemLift?: boolean;
  status: RequestStatus;
  createdAt: string;
  machineName?: string; // The name of the machine which will be manufactured
  date?: string; // "YYYY-MM-DD" target date of the requirement
  jobType?: "New" | "Continuation";
  parentJobId?: string;
  details?: string;
  completionPercentage?: number; // 0-100% completion rating
  isVerified?: boolean;
  verificationTime?: string;
  verifiedBy?: string;
  craneAllocations?: CraneAllocationHistory[];
}

export interface Schedule {
  id: string;
  requestId: string;
  area: number;
  bay?: string; // "A", "B", etc.
  assignedCrane: string; // e.g. "A1", "B1"
  column: number; // Fallback or primary column
  startColumn: number; // Start of column range for the job
  endColumn: number;   // End of column range for the job
  startTime: string; // "HH:MM" or ISO string
  endTime: string;   // "HH:MM" or ISO string
  weight: number;
  priority: PriorityType;
  status: string;
  travelTimeMinutes: number;
  bufferTimeMinutes: number;
  remarks?: string;
  department?: string;
  secondaryCrane?: string;
  isTandemLift?: boolean;
}

export interface ShiftReport {
  id: string;
  shift: ShiftType;
  date: string; // "YYYY-MM-DD"
  totalRequests: number;
  scheduledRequests: number;
  rejectedRequests: number;
  craneA1Util: number; // percentage
  craneA2Util: number; // percentage
  craneA3Util: number; // percentage
  areaDemand: Record<number, number>; // area -> count
  priorityBreakdown: Record<PriorityType, number>;
  averageWaitingTimeMinutes: number;
  summary: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  employeeId: string;
  userName: string;
  action: string;
  details: string;
}

export interface SystemSettings {
  bufferTimeMinutes: number; // Default 5 minutes
  maxCranes: number;
  maintenanceWindowOpen: boolean;
  systemLocked: boolean;
  lastPointsResetMonth?: string; // "YYYY-MM"
}
