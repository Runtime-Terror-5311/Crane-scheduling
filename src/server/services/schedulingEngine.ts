/**
 * CRANE SCHEDULING ALGORITHM — BAY-1
 *
 * Bay Layout: ~300m, 30 columns
 *   A1 crane → columns  1–10  (10T, Machine Shop)
 *   A2 crane → columns 11–20  (25T, Machine Shop)
 *   A3 crane → columns 21–30  (10T, Fabrication)
 *
 * Shifts:
 *   Shift A  → 06:00–14:00
 *   Shift B  → 14:00–22:00
 *   Shift C  → 22:00–06:00 (next day, times stored as 22:00–30:00 in minutes)
 *   General  → 09:00–18:30
 *
 * Borrow Rules:
 *   A1 needs help  → can borrow A2 only
 *   A2 needs help  → can borrow A1 and/or A3
 *   A3 needs help  → can borrow A2 only
 *
 * No-Crossing Rule:
 *   Physical order: A1 (left) < A2 (middle) < A3 (right)
 *   A crane's active column range must never overlap or cross another crane's range.
 *
 * Conflict Resolution Order:
 *   1. Priority (P1 > P2 > P3 > P4)
 *   2. If same priority → earlier form submission (createdAt) wins
 *   3. Loser gets rescheduled to next free slot in the same shift
 *   4. If no slot in same shift → deferred to next shift with a tag
 *   5. Reject only when: no crane has sufficient capacity, or mandatory crane is under maintenance
 *
 * Tandem Lift:
 *   If a job requires two cranes simultaneously (isTandemLift = true),
 *   both assigned cranes are blocked for the same time window.
 *
 * Travel Speed:
 *   Assumed 0.5 min per column (traversal between columns).
 *   Buffer time (default 5 min) added between consecutive jobs on same crane.
 */

import {
  Crane as GlobalCrane,
  CraneRequest as GlobalCraneRequest,
  Schedule as GlobalSchedule,
  PriorityType as GlobalPriorityType,
  ShiftType as GlobalShiftType
} from "../../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PriorityType = "P1" | "P2" | "P3" | "P4";
export type CraneId = "A1" | "A2" | "A3";
export type ShiftType = "A" | "B" | "C" | "General";
export type CraneStatus = "Available" | "Busy" | "Maintenance" | "Breakdown";
export type ScheduleStatus = "Approved" | "Deferred" | "Rejected" | "Rescheduled";
export type MandatoryCrane = CraneId | "Any";

export interface Crane {
  id: CraneId;
  capacity: number;           // in Tons
  status: CraneStatus;
  currentColumn: number;      // last known physical position
  allocatedMinColumn: number; // home range start
  allocatedMaxColumn: number; // home range end
}

export interface CraneRequest {
  id: string;
  area: CraneId;              // which area the job belongs to
  shift: ShiftType;
  createdAt: string;          // ISO timestamp — used as tiebreaker
  estimatedStartTime: string; // "HH:MM"
  estimatedEndTime: string;   // "HH:MM"
  startColumn: number;
  endColumn: number;
  priority: PriorityType;
  estimatedWeight: number;    // in Tons
  mandatoryCrane: MandatoryCrane;
  isTandemLift?: boolean;     // requires two cranes simultaneously
  department?: string;
  remarks?: string;
  status: "Submitted" | "Approved" | "Rejected" | "Deferred";
}

export interface Schedule {
  id: string;
  requestId: string;
  area: CraneId;
  assignedCrane: CraneId;
  secondaryCrane?: CraneId;  // for tandem lifts
  startColumn: number;
  endColumn: number;
  column: number;             // midpoint
  startTime: string;
  endTime: string;
  weight: number;
  priority: PriorityType;
  shift: ShiftType;
  status: ScheduleStatus;
  rescheduleReason?: string;
  travelTimeMinutes: number;
  bufferTimeMinutes: number;
  isTandemLift?: boolean;
  department?: string;
  remarks?: string;
}

export interface SchedulerResult {
  schedules: Schedule[];
  updatedCranes: Crane[];
  rejectedIds: string[];
  deferredIds: string[];
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_SCORES: Record<PriorityType, number> = {
  P1: 1000, // Critical
  P2: 500,  // Urgent
  P3: 100,  // Normal
  P4: 10,   // Planned / Routine
};

/** Shift windows in minutes from midnight. Shift C uses 22:00–30:00 (next-day wrap). */
const SHIFT_WINDOWS: Record<ShiftType, [number, number]> = {
  A:       [6 * 60,       14 * 60],      // 06:00–14:00
  B:       [14 * 60,      22 * 60],      // 14:00–22:00
  C:       [22 * 60,      30 * 60],      // 22:00–06:00 next day
  General: [9 * 60,       18 * 60 + 30], // 09:00–18:30
};

/** Borrow rules: who a crane can borrow from when its home crane is busy/unavailable */
const BORROW_PRIORITY: Record<CraneId, CraneId[]> = {
  A1: ["A2"],           // A1 can only borrow A2
  A2: ["A1", "A3"],     // A2 can borrow A1 or A3 (or both for tandem)
  A3: ["A2"],           // A3 can only borrow A2
};

/** Physical left-to-right order used for crossing constraint */
const CRANE_ORDER: Record<CraneId, number> = { A1: 0, A2: 1, A3: 2 };

// mins per column traversal
const TRAVEL_SPEED_MIN_PER_COL = 0.5;

// How far ahead (in minutes) we try to reschedule within a shift
const MAX_RESCHEDULE_LOOKAHEAD = 480; // 8 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTime(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatTime(mins: number): string {
  // Support >24h for shift C
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function midCol(start: number, end: number): number {
  return Math.round((start + end) / 2);
}

function travelTime(colA: number, colB: number): number {
  return Math.round(Math.abs(colA - colB) * TRAVEL_SPEED_MIN_PER_COL * 10) / 10;
}

/** Returns true if [aStart, aEnd) and [bStart, bEnd) overlap */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Crossing constraint check.
 *
 * Rule: cranes must maintain left-to-right order (A1 < A2 < A3).
 * If crane X (leftOf Y) is at columns [xS, xE] and crane Y is at [yS, yE],
 * they must not have xE >= yS (X would be at or to the right of Y's start).
 *
 * Returns true if placing `thisCrane` at [reqStartCol, reqEndCol] during
 * [currStart, currEnd] would cause a crossing with any already-scheduled task.
 */
function wouldCross(
  thisCraneId: CraneId,
  reqStartCol: number,
  reqEndCol: number,
  currStart: number,
  currEnd: number,
  craneSchedules: Record<CraneId, Schedule[]>
): boolean {
  const thisOrder = CRANE_ORDER[thisCraneId];

  for (const [otherId, tasks] of Object.entries(craneSchedules) as [CraneId, Schedule[]][]) {
    if (otherId === thisCraneId) continue;
    const otherOrder = CRANE_ORDER[otherId];

    for (const task of tasks) {
      const taskStart = parseTime(task.startTime);
      const taskEnd   = parseTime(task.endTime);

      if (!overlaps(currStart, currEnd, taskStart, taskEnd)) continue;

      const otherStartCol = task.startColumn;
      const otherEndCol   = task.endColumn;

      if (thisOrder < otherOrder) {
        // This crane is LEFT of other — this crane's rightmost col must be < other's leftmost col
        if (reqEndCol >= otherStartCol) return true;
      } else {
        // This crane is RIGHT of other — this crane's leftmost col must be > other's rightmost col
        if (reqStartCol <= otherEndCol) return true;
      }
    }
  }
  return false;
}

/**
 * Returns the earliest start time >= wantedStart at which `craneId`
 * is free for `duration` minutes without conflicts, travel issues,
 * crossing violations, or capacity violations.
 * Returns null if no slot found within the shift window.
 */
function findEarliestSlot(
  craneId: CraneId,
  crane: Crane,
  reqStartCol: number,
  reqEndCol: number,
  reqWeight: number,
  wantedStart: number,
  duration: number,
  shiftEnd: number,
  craneSchedules: Record<CraneId, Schedule[]>,
  bufferMin: number
): { start: number; end: number; travel: number } | null {
  if (crane.status === "Maintenance" || crane.status === "Breakdown") return null;
  if (reqWeight > crane.capacity) return null;

  const reqMid = midCol(reqStartCol, reqEndCol);
  let tryStart = wantedStart;

  while (tryStart + duration <= shiftEnd + MAX_RESCHEDULE_LOOKAHEAD) {
    const tryEnd = tryStart + duration;

    const tasks = craneSchedules[craneId] || [];
    let conflict = false;
    let refCol = crane.currentColumn;
    let lastEnd = 0;
    let nextStart = Infinity;
    let nextCol = crane.currentColumn;

    for (const t of tasks) {
      const ts = parseTime(t.startTime);
      const te = parseTime(t.endTime);
      const tm = midCol(t.startColumn, t.endColumn);

      if (overlaps(tryStart, tryEnd, ts, te)) { conflict = true; break; }

      if (te <= tryStart && te > lastEnd) {
        lastEnd = te;
        refCol = tm;
      }
      if (ts >= tryEnd && ts < nextStart) {
        nextStart = ts;
        nextCol = tm;
      }
    }

    if (conflict) { tryStart += 5; continue; }

    // Travel + buffer from previous task
    const travelFromPrev = travelTime(refCol, reqMid);
    if (lastEnd > 0 && tryStart - lastEnd < travelFromPrev + bufferMin) {
      tryStart += 5;
      continue;
    }

    // Travel + buffer to next task
    const travelToNext = travelTime(reqMid, nextCol);
    if (nextStart !== Infinity && nextStart - tryEnd < travelToNext + bufferMin) {
      tryStart += 5;
      continue;
    }

    // Crossing check
    if (wouldCross(craneId, reqStartCol, reqEndCol, tryStart, tryEnd, craneSchedules)) {
      tryStart += 5;
      continue;
    }

    return { start: tryStart, end: tryEnd, travel: travelFromPrev };
  }

  return null;
}

// ─── Main Scheduler ───────────────────────────────────────────────────────────

function scheduleRequestsInternal(
  requests: CraneRequest[],
  cranes: Crane[],
  bufferTimeMinutes: number = 5
): SchedulerResult {
  const warnings: string[] = [];
  const rejectedIds: string[] = [];
  const deferredIds: string[] = [];
  const schedules: Schedule[] = [];

  // Only process Submitted requests
  const submitted = requests.filter((r) => r.status === "Submitted");

  /**
   * Sort order:
   * 1. Priority score (descending)
   * 2. createdAt (ascending) — first-come-first-served tiebreaker
   * 3. estimatedStartTime (ascending)
   * 4. estimatedWeight (descending — heavier jobs harder to defer)
   */
  const sorted = [...submitted].sort((a, b) => {
    const pa = PRIORITY_SCORES[a.priority] ?? 0;
    const pb = PRIORITY_SCORES[b.priority] ?? 0;
    if (pa !== pb) return pb - pa;

    const ca = new Date(a.createdAt || 0).getTime();
    const cb = new Date(b.createdAt || 0).getTime();
    if (ca !== cb) return ca - cb;

    const ta = parseTime(a.estimatedStartTime);
    const tb = parseTime(b.estimatedStartTime);
    if (ta !== tb) return ta - tb;

    return b.estimatedWeight - a.estimatedWeight;
  });

  // Working copies so we can update positions
  const workingCranes = {} as Record<CraneId, Crane>;
  for (const c of cranes) workingCranes[c.id as CraneId] = { ...c };

  // Per-crane schedule log for conflict/crossing checks
  const craneSchedules: Record<CraneId, Schedule[]> = { A1: [], A2: [], A3: [] };

  // ── Process each request ──────────────────────────────────────────────────

  for (const req of sorted) {
    const wantedStart = parseTime(req.estimatedStartTime);
    const wantedEnd   = parseTime(req.estimatedEndTime);
    const duration    = wantedEnd - wantedStart;

    if (duration <= 0) {
      warnings.push(`Request ${req.id}: invalid time range (start >= end). Skipped.`);
      rejectedIds.push(req.id);
      continue;
    }

    // Limit check: Shift duration limit (8 hours / 480 minutes)
    if (duration > 480) {
      warnings.push(`Request ${req.id} REJECTED: requested timeline duration (${(duration / 60).toFixed(1)} hours) exceeds the maximum shift duration limit of 8 hours (480 mins).`);
      rejectedIds.push(req.id);
      continue;
    }

    // Limit check: Weight exceeds specified/max crane capacity
    const reqWeight   = req.estimatedWeight;
    if (req.mandatoryCrane !== "Any") {
      const craneObj = workingCranes[req.mandatoryCrane];
      const cap = craneObj ? craneObj.capacity : 50;
      if (reqWeight > cap) {
        warnings.push(`Request ${req.id} REJECTED: requested weight (${reqWeight} Tons) exceeds the capacity of selected crane ${req.mandatoryCrane} (${cap} Tons).`);
        rejectedIds.push(req.id);
        continue;
      }
    } else {
      const homeCrane = req.area as CraneId;
      const borrowList = BORROW_PRIORITY[homeCrane] || [];
      const candidates = [homeCrane, ...borrowList];
      const maxCap = Math.max(...candidates.map(cid => workingCranes[cid]?.capacity || 0));
      if (reqWeight > maxCap) {
        warnings.push(`Request ${req.id} REJECTED: requested weight (${reqWeight} Tons) exceeds the maximum capacity of any available candidate crane in area/borrow set (${maxCap} Tons).`);
        rejectedIds.push(req.id);
        continue;
      }
    }

    const [shiftStart, shiftEnd] = SHIFT_WINDOWS[req.shift];
    const reqStartCol = req.startColumn;
    const reqEndCol   = req.endColumn;
    const reqMid      = midCol(reqStartCol, reqEndCol);

    // ── Build candidate crane list ──────────────────────────────────────────
    // Order: home crane first, then borrow list
    const homeCrane  = req.area as CraneId;
    const borrowList = BORROW_PRIORITY[homeCrane];

    let candidateOrder: CraneId[];
    if (req.mandatoryCrane !== "Any") {
      // Operator pinned a specific crane
      candidateOrder = [req.mandatoryCrane as CraneId];
    } else {
      candidateOrder = [homeCrane, ...borrowList];
    }

    // ── Capacity pre-check: is there ANY crane that can handle the weight? ──
    const capableExists = candidateOrder.some(
      (cid) =>
        workingCranes[cid]?.status !== "Maintenance" &&
        workingCranes[cid]?.status !== "Breakdown" &&
        (workingCranes[cid]?.capacity ?? 0) >= reqWeight
    );

    if (!capableExists) {
      warnings.push(
        `Request ${req.id} REJECTED: no available crane with capacity >= ${reqWeight}T ` +
        `in candidate set [${candidateOrder.join(", ")}].`
      );
      rejectedIds.push(req.id);
      continue;
    }

    // ── Handle Tandem Lift separately ───────────────────────────────────────
    if (req.isTandemLift) {
      const result = scheduleTandemLift(
        req, candidateOrder, workingCranes, craneSchedules,
        wantedStart, duration, shiftEnd, bufferTimeMinutes, warnings
      );

      if (result) {
        schedules.push(...result.newSchedules);
        for (const s of result.newSchedules) {
          craneSchedules[s.assignedCrane].push(s);
        }
        // Update crane positions
        for (const s of result.newSchedules) {
          workingCranes[s.assignedCrane].currentColumn = midCol(s.startColumn, s.endColumn);
        }
        if (result.isDeferred) deferredIds.push(req.id);
      } else {
        warnings.push(`Request ${req.id} REJECTED: tandem lift could not be scheduled.`);
        rejectedIds.push(req.id);
      }
      continue;
    }

    // ── Standard single-crane scheduling ────────────────────────────────────
    let assigned: { craneId: CraneId; start: number; end: number; travel: number } | null = null;
    let isDeferred = false;

    for (const cid of candidateOrder) {
      const crane = workingCranes[cid];
      if (!crane) continue;

      // For borrowed cranes, add an extra warning if the crane's home area
      // might need it — we only borrow if the donor is idle in that window
      if (cid !== homeCrane) {
        const donorBusy = (craneSchedules[cid] || []).some((t) =>
          overlaps(wantedStart, wantedEnd, parseTime(t.startTime), parseTime(t.endTime))
        );
        if (donorBusy) continue; // Donor is busy — try next candidate
      }

      // Try to fit at the requested time first, then within the shift
      const slot = findEarliestSlot(
        cid, crane,
        reqStartCol, reqEndCol, reqWeight,
        wantedStart, duration,
        shiftEnd,
        craneSchedules,
        bufferTimeMinutes
      );

      if (slot) {
        if (slot.start > wantedStart) {
          isDeferred = true; // Had to push to a later time
        }
        assigned = { craneId: cid, ...slot };
        break;
      }
    }

    // ── Still no slot — try outside shift window (flag as strongly deferred) ─
    if (!assigned) {
      for (const cid of candidateOrder) {
        const crane = workingCranes[cid];
        if (!crane) continue;

        const slot = findEarliestSlot(
          cid, crane,
          reqStartCol, reqEndCol, reqWeight,
          shiftEnd, duration,
          shiftEnd + MAX_RESCHEDULE_LOOKAHEAD,
          craneSchedules,
          bufferTimeMinutes
        );

        if (slot) {
          isDeferred = true;
          assigned = { craneId: cid, ...slot };
          warnings.push(
            `Request ${req.id} (${req.priority}) deferred beyond shift ${req.shift} ` +
            `→ scheduled at ${formatTime(slot.start)} on ${cid}.`
          );
          break;
        }
      }
    }

    // ── Still nothing — reject ────────────────────────────────────────────
    if (!assigned) {
      warnings.push(
        `Request ${req.id} REJECTED: no valid slot found in any candidate crane ` +
        `[${candidateOrder.join(", ")}] even after lookahead.`
      );
      rejectedIds.push(req.id);
      continue;
    }

    const scheduleStatus: ScheduleStatus = isDeferred ? "Deferred" : "Approved";
    if (isDeferred) deferredIds.push(req.id);

    const newSchedule: Schedule = buildSchedule(
      req, assigned.craneId, reqStartCol, reqEndCol, reqMid,
      assigned.start, assigned.end, assigned.travel,
      bufferTimeMinutes, scheduleStatus,
      isDeferred && assigned.start > wantedStart
        ? `Rescheduled from ${req.estimatedStartTime} due to conflict`
        : req.remarks
    );

    schedules.push(newSchedule);
    craneSchedules[assigned.craneId].push(newSchedule);
    workingCranes[assigned.craneId].currentColumn = reqMid;
    workingCranes[assigned.craneId].status = "Busy";
  }

  // Reset cranes that have no scheduled tasks to Available
  for (const [cid, crane] of Object.entries(workingCranes) as [CraneId, Crane][]) {
    if (crane.status === "Busy" && craneSchedules[cid].length === 0) {
      workingCranes[cid].status = "Available";
    }
  }

  return {
    schedules,
    updatedCranes: Object.values(workingCranes),
    rejectedIds,
    deferredIds,
    warnings,
  };
}

// ─── Tandem Lift ──────────────────────────────────────────────────────────────

/**
 * For a tandem lift we need TWO cranes simultaneously.
 * Both must be free, must not cross each other, and both are blocked
 * for the full job window.
 *
 * Strategy: pick the two best cranes from the candidate list that
 * can both fit in the same time window.
 */
function scheduleTandemLift(
  req: CraneRequest,
  candidateOrder: CraneId[],
  workingCranes: Record<CraneId, Crane>,
  craneSchedules: Record<CraneId, Schedule[]>,
  wantedStart: number,
  duration: number,
  shiftEnd: number,
  bufferMin: number,
  warnings: string[]
): { newSchedules: Schedule[]; isDeferred: boolean } | null {
  const reqStartCol = req.startColumn;
  const reqEndCol   = req.endColumn;
  const reqWeight   = req.estimatedWeight;
  const reqMid      = midCol(reqStartCol, reqEndCol);

  // We need at least 2 capable cranes
  const capable = candidateOrder.filter(
    (cid) =>
      workingCranes[cid]?.status !== "Maintenance" &&
      workingCranes[cid]?.status !== "Breakdown" &&
      (workingCranes[cid]?.capacity ?? 0) >= reqWeight / 2 // each crane carries half
  );

  if (capable.length < 2) {
    warnings.push(`Tandem lift ${req.id}: not enough capable cranes.`);
    return null;
  }

  // Try each pair
  for (let i = 0; i < capable.length - 1; i++) {
    for (let j = i + 1; j < capable.length; j++) {
      const cid1 = capable[i];
      const cid2 = capable[j];

      const slot1 = findEarliestSlot(
        cid1, workingCranes[cid1],
        reqStartCol, reqEndCol, reqWeight / 2,
        wantedStart, duration, shiftEnd + MAX_RESCHEDULE_LOOKAHEAD,
        craneSchedules, bufferMin
      );

      const slot2 = findEarliestSlot(
        cid2, workingCranes[cid2],
        reqStartCol, reqEndCol, reqWeight / 2,
        wantedStart, duration, shiftEnd + MAX_RESCHEDULE_LOOKAHEAD,
        craneSchedules, bufferMin
      );

      if (!slot1 || !slot2) continue;

      // Align to the later of the two starts
      const alignedStart = Math.max(slot1.start, slot2.start);
      const alignedEnd   = alignedStart + duration;
      const isDeferred   = alignedStart > wantedStart;

      // Final crossing check with both cranes at same time
      const tempCraneSchedules: Record<CraneId, Schedule[]> = {
        A1: craneSchedules.A1,
        A2: craneSchedules.A2,
        A3: craneSchedules.A3,
      };

      if (
        wouldCross(cid1, reqStartCol, reqEndCol, alignedStart, alignedEnd, tempCraneSchedules) ||
        wouldCross(cid2, reqStartCol, reqEndCol, alignedStart, alignedEnd, tempCraneSchedules)
      ) {
        continue;
      }

      const s1 = buildSchedule(
        req, cid1, reqStartCol, reqEndCol, reqMid,
        alignedStart, alignedEnd, slot1.travel, bufferMin,
        isDeferred ? "Deferred" : "Approved",
        `Tandem lift with ${cid2}`
      );
      s1.secondaryCrane = cid2;
      s1.isTandemLift = true;

      const s2 = buildSchedule(
        req, cid2, reqStartCol, reqEndCol, reqMid,
        alignedStart, alignedEnd, slot2.travel, bufferMin,
        isDeferred ? "Deferred" : "Approved",
        `Tandem lift with ${cid1}`
      );
      s2.id = s2.id + "-B";
      s2.secondaryCrane = cid1;
      s2.isTandemLift = true;

      return { newSchedules: [s1, s2], isDeferred };
    }
  }

  return null;
}

// ─── Schedule Builder ─────────────────────────────────────────────────────────

function buildSchedule(
  req: CraneRequest,
  craneId: CraneId,
  startCol: number,
  endCol: number,
  colMid: number,
  start: number,
  end: number,
  travel: number,
  bufferMin: number,
  status: ScheduleStatus,
  remarks?: string
): Schedule {
  return {
    id: `SCH-${req.id}-${craneId}`,
    requestId: req.id,
    area: req.area,
    assignedCrane: craneId,
    startColumn: startCol,
    endColumn: endCol,
    column: colMid,
    startTime: formatTime(start),
    endTime: formatTime(end),
    weight: req.estimatedWeight,
    priority: req.priority,
    shift: req.shift,
    status,
    rescheduleReason: status !== "Approved" ? remarks : undefined,
    travelTimeMinutes: travel,
    bufferTimeMinutes: bufferMin,
    isTandemLift: req.isTandemLift,
    department: req.department,
    remarks: remarks ?? req.remarks,
  };
}

// ─── Type Adapter Wrapper ─────────────────────────────────────────────────────

function mapGlobalRequestToInternal(gr: GlobalCraneRequest): CraneRequest {
  let shift: ShiftType = "General";
  if (gr.shift === "Shift A") shift = "A";
  else if (gr.shift === "Shift B") shift = "B";
  else if (gr.shift === "Shift C") shift = "C";

  let area: CraneId = "A1";
  if (gr.area === 2) area = "A2";
  else if (gr.area === 3) area = "A3";

  return {
    id: gr.id,
    area,
    shift,
    createdAt: gr.createdAt,
    estimatedStartTime: gr.estimatedStartTime,
    estimatedEndTime: gr.estimatedEndTime,
    startColumn: gr.startColumn,
    endColumn: gr.endColumn,
    priority: gr.priority,
    estimatedWeight: gr.estimatedWeight,
    mandatoryCrane: gr.mandatoryCrane as any,
    isTandemLift: gr.isTandemLift,
    department: gr.department,
    remarks: gr.remarks,
    status: gr.status === "Submitted" ? "Submitted" : "Approved",
  };
}

function mapGlobalCraneToInternal(gc: GlobalCrane): Crane {
  const cid = gc.id as CraneId;
  return {
    id: cid,
    capacity: gc.capacity,
    status: gc.status as CraneStatus,
    currentColumn: gc.currentColumn,
    allocatedMinColumn: gc.allocatedMinColumn !== undefined ? gc.allocatedMinColumn : (cid === "A1" ? 1 : cid === "A2" ? 11 : 21),
    allocatedMaxColumn: gc.allocatedMaxColumn !== undefined ? gc.allocatedMaxColumn : (cid === "A1" ? 10 : cid === "A2" ? 20 : 30),
  };
}

function mapInternalScheduleToGlobal(s: Schedule): GlobalSchedule {
  let area = 1;
  if (s.area === "A2") area = 2;
  else if (s.area === "A3") area = 3;

  return {
    id: s.id,
    requestId: s.requestId,
    area,
    assignedCrane: s.assignedCrane,
    secondaryCrane: s.secondaryCrane,
    column: s.column,
    startColumn: s.startColumn,
    endColumn: s.endColumn,
    startTime: s.startTime,
    endTime: s.endTime,
    weight: s.weight,
    priority: s.priority,
    status: s.status,
    travelTimeMinutes: s.travelTimeMinutes,
    bufferTimeMinutes: s.bufferTimeMinutes,
    remarks: s.remarks,
    department: s.department,
    isTandemLift: s.isTandemLift,
  };
}

function mapInternalCraneToGlobal(ic: Crane, originalCranes: GlobalCrane[]): GlobalCrane {
  const orig = originalCranes.find((c) => c.id === ic.id);
  return {
    id: ic.id,
    name: orig?.name || `Crane ${ic.id}`,
    capacity: ic.capacity,
    minColumn: orig?.minColumn || (ic.id === "A1" ? 1 : ic.id === "A2" ? 11 : 21),
    maxColumn: orig?.maxColumn || (ic.id === "A1" ? 10 : ic.id === "A2" ? 20 : 30),
    allocatedMinColumn: ic.allocatedMinColumn,
    allocatedMaxColumn: ic.allocatedMaxColumn,
    currentColumn: ic.currentColumn,
    status: ic.status as any,
    maintenanceNotes: orig?.maintenanceNotes || "",
  };
}

export interface PublicSchedulerResult {
  schedules: GlobalSchedule[];
  updatedCranes: GlobalCrane[];
  rejectedIds: string[];
  deferredIds: string[];
  warnings: string[];
}

export function scheduleRequests(
  requests: GlobalCraneRequest[],
  cranes: GlobalCrane[],
  bufferTimeMinutes: number = 5
): PublicSchedulerResult {
  const bays = ["A", "B", "C", "D", "E", "F", "G"];
  
  const allSchedules: GlobalSchedule[] = [];
  const allUpdatedCranes: GlobalCrane[] = [];
  const allRejectedIds: string[] = [];
  const allDeferredIds: string[] = [];
  const allWarnings: string[] = [];
  
  // Working copy of cranes to update throughout processing
  const workingCranes = [...cranes];
  
  for (const bay of bays) {
    // Filter cranes belonging to this bay
    const bayCranes = workingCranes.filter((c) => c.id.toUpperCase().startsWith(bay));
    if (bayCranes.length === 0) continue;
    
    // Sort alphabetically to maintain physical order (e.g. B1 < B2 < B3)
    bayCranes.sort((a, b) => a.id.localeCompare(b.id));
    
    // Filter requests belonging to this bay
    const bayRequests = requests.filter((r) => {
      const rBay = r.bay || (r.mandatoryCrane && r.mandatoryCrane !== "Any" ? r.mandatoryCrane.toUpperCase().charAt(0) : "A");
      const rBayLetterMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "6": "F", "7": "G" };
      const normalizedRBay = rBayLetterMap[rBay.toUpperCase()] || rBay.toUpperCase();
      return normalizedRBay === bay;
    });
    
    if (bayRequests.length === 0) {
      // No active requests for this bay; cranes remain as is
      allUpdatedCranes.push(...bayCranes);
      continue;
    }
    
    // Build virtualization maps
    const virtualIds = ["A1", "A2", "A3"] as const;
    const realToVirtual = new Map<string, "A1" | "A2" | "A3">();
    const virtualToReal = new Map<"A1" | "A2" | "A3", GlobalCrane>();
    
    bayCranes.forEach((crane, idx) => {
      if (idx < 3) {
        const vId = virtualIds[idx];
        realToVirtual.set(crane.id, vId);
        virtualToReal.set(vId, crane);
      }
    });
    
    // Map requests to virtual requests (A1, A2, A3 compatible)
    const virtualRequests = bayRequests.map((r) => {
      let vMandatory: "Any" | "A1" | "A2" | "A3" = "Any";
      if (r.mandatoryCrane && r.mandatoryCrane !== "Any") {
        const mapped = realToVirtual.get(r.mandatoryCrane);
        if (mapped) vMandatory = mapped;
      }
      
      let virtualArea = 1;
      if (r.mandatoryCrane && r.mandatoryCrane !== "Any") {
        const vId = realToVirtual.get(r.mandatoryCrane);
        if (vId === "A2") virtualArea = 2;
        else if (vId === "A3") virtualArea = 3;
      } else {
        virtualArea = Math.min(Math.max(r.area, 1), Math.min(bayCranes.length, 3));
      }
      
      return {
        ...r,
        area: virtualArea,
        mandatoryCrane: vMandatory,
      };
    });
    
    // Map cranes to virtual cranes
    const virtualCranes = bayCranes.map((crane, idx) => {
      const vId = virtualIds[idx] || "A1";
      return {
        ...crane,
        id: vId,
        allocatedMinColumn: idx === 0 ? 1 : idx === 1 ? 11 : 21,
        allocatedMaxColumn: idx === 0 ? 10 : idx === 1 ? 20 : 30,
      };
    });
    
    // Run core scheduling logic
    const internalRequests = virtualRequests.map(mapGlobalRequestToInternal);
    const internalCranes = virtualCranes.map(mapGlobalCraneToInternal);
    
    const result = scheduleRequestsInternal(internalRequests, internalCranes, bufferTimeMinutes);
    
    // Map virtual schedules back to real-world names and properties
    const baySchedules = result.schedules.map((s) => {
      const realCrane = virtualToReal.get(s.assignedCrane);
      const realSecondaryCrane = s.secondaryCrane ? virtualToReal.get(s.secondaryCrane) : undefined;
      const orig = bayRequests.find((r) => r.id === s.requestId);
      
      return {
        ...mapInternalScheduleToGlobal(s),
        bay,
        area: orig ? orig.area : (s.area === "A2" ? 2 : s.area === "A3" ? 3 : 1),
        assignedCrane: realCrane ? realCrane.id : s.assignedCrane,
        secondaryCrane: realSecondaryCrane ? realSecondaryCrane.id : s.secondaryCrane,
        department: orig ? orig.department : s.department,
        remarks: s.remarks,
      };
    });
    
    // Map virtual updated cranes back
    const bayUpdatedCranes = result.updatedCranes.map((ic) => {
      const realCrane = virtualToReal.get(ic.id);
      if (realCrane) {
        return {
          ...realCrane,
          currentColumn: ic.currentColumn,
          status: ic.status as any,
        };
      }
      return mapInternalCraneToGlobal(ic, bayCranes);
    });
    
    allSchedules.push(...baySchedules);
    allUpdatedCranes.push(...bayUpdatedCranes);
    allRejectedIds.push(...result.rejectedIds);
    allDeferredIds.push(...result.deferredIds);
    
    const bayWarnings = result.warnings.map((w) => `[Bay ${bay}] ${w}`);
    allWarnings.push(...bayWarnings);
  }
  
  // Include any other cranes from other bays that weren't updated
  const processedSet = new Set(allUpdatedCranes.map((c) => c.id));
  const remainingCranes = workingCranes.filter((c) => !processedSet.has(c.id));
  allUpdatedCranes.push(...remainingCranes);
  allUpdatedCranes.sort((a, b) => a.id.localeCompare(b.id));
  
  return {
    schedules: allSchedules,
    updatedCranes: allUpdatedCranes,
    rejectedIds: allRejectedIds,
    deferredIds: allDeferredIds,
    warnings: allWarnings,
  };
}