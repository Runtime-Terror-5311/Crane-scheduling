import { ShiftType } from "../types.js";

export const BAY_AREA_MAPPING: Record<string, number[]> = {
  "1": [1, 8, 16],
  "2": [2, 9, 17],
  "3": [3, 10, 18],
  "4": [4, 12, 19],
  "5": [5, 13, 20],
  "6": [6, 14, 21],
  "7": [7, 15, 22]
};

export function getBayForArea(area: number): string {
  for (const [bay, areas] of Object.entries(BAY_AREA_MAPPING)) {
    if (areas.includes(area)) {
      return bay;
    }
  }
  return "1";
}

export function getColumnsForArea(area: number): { min: number; max: number } {
  for (const [bay, areas] of Object.entries(BAY_AREA_MAPPING)) {
    const idx = areas.indexOf(area);
    if (idx === 0) return { min: 1, max: 10 };
    if (idx === 1) return { min: 11, max: 20 };
    if (idx === 2) return { min: 21, max: 30 };
  }
  return { min: 1, max: 10 };
}

export function getAreasForBay(bay: string): number[] {
  return BAY_AREA_MAPPING[bay] || [1, 8, 16];
}

const SHIFT_WINDOWS: Record<ShiftType, [number, number]> = {
  "Shift A": [6 * 60, 14 * 60], // 06:00–14:00
  "Shift B": [14 * 60, 22 * 60], // 14:00–22:00
  "Shift C": [22 * 60, 30 * 60], // 22:00–06:00 next day
  "General Shift": [9 * 60, 18 * 60 + 30], // 09:00–18:30
};

export function parseTimeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getCurrentShift(date: Date): ShiftType {
  const mins = date.getHours() * 60 + date.getMinutes();
  if (mins >= 6 * 60 && mins < 14 * 60) {
    return "Shift A";
  } else if (mins >= 14 * 60 && mins < 22 * 60) {
    return "Shift B";
  } else {
    return "Shift C";
  }
}

export function isScheduleInShiftBoundary(startTimeStr: string, endTimeStr: string, shift: ShiftType): boolean {
  const sMins = parseTimeToMinutes(startTimeStr);
  const eMins = parseTimeToMinutes(endTimeStr);
  
  const window = SHIFT_WINDOWS[shift];
  if (!window) return true;
  const [wStart, wEnd] = window;
  
  if (shift === "Shift C") {
    const normStart = sMins < 12 * 60 ? sMins + 24 * 60 : sMins;
    const normEnd = eMins < 12 * 60 ? eMins + 24 * 60 : eMins;
    return normStart >= wStart && normEnd <= wEnd;
  } else {
    const normEnd = eMins < sMins ? eMins + 24 * 60 : eMins;
    return sMins >= wStart && normEnd <= wEnd;
  }
}

export function isTimeWithinRange(currentTime: Date, startTimeStr: string, endTimeStr: string): boolean {
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

export function formatTimeTo12Hr(timeStr: string): string {
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

export function getBayForCrane(craneId: string): string {
  if (!craneId) return "1";
  const char = craneId.trim().charAt(0).toUpperCase();
  const mapping: Record<string, string> = {
    "A": "1",
    "B": "2",
    "C": "3",
    "D": "4",
    "E": "5",
    "F": "6",
    "G": "7"
  };
  return mapping[char] || "1";
}

