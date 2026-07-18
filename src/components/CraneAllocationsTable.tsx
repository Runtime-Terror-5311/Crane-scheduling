import React from "react";
import { Hammer } from "lucide-react";
import { CraneRequest } from "../types";

interface CraneAllocationsTableProps {
  request: CraneRequest;
}

export default function CraneAllocationsTable({ request }: CraneAllocationsTableProps) {
  const allocations = request.craneAllocations || [];

  // Calculate duration helper
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    let startTotal = (startH || 0) * 60 + (startM || 0);
    let endTotal = (endH || 0) * 60 + (endM || 0);
    if (endTotal < startTotal) {
      endTotal += 24 * 60; // handle over midnight
    }
    return (endTotal - startTotal) / 60;
  };

  // Sum total hours needed
  const totalHours = allocations.reduce((sum, alloc) => {
    return sum + calculateHours(alloc.startTime, alloc.endTime);
  }, 0);

  if (allocations.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 p-3 bg-amber-50/40 border-2 border-[#141414] rounded-sm font-mono text-[11px] shadow-[2px_2px_0px_rgba(0,0,0,0.1)]">
      <div className="flex flex-wrap items-center justify-between border-b-2 border-[#141414] pb-1.5 mb-2 gap-2">
        <span className="font-black text-[#141414] uppercase tracking-wider flex items-center gap-1.5">
          <Hammer className="w-3.5 h-3.5 text-amber-600" />
          Crane Assignments & Duration History
        </span>
        <span className="bg-amber-100 border-2 border-[#141414] text-[#141414] font-black px-2 py-0.5 rounded-sm text-[10px] uppercase shadow-[1px_1px_0px_#141414]">
          Total Time: {totalHours.toFixed(1)} Hours
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-500 uppercase font-black tracking-tight">
              <th className="pb-1 pr-2">Gantry</th>
              <th className="pb-1 pr-2">Area</th>
              <th className="pb-1 pr-2">Track Range</th>
              <th className="pb-1 pr-2">Date</th>
              <th className="pb-1 pr-2">Time Slot</th>
              <th className="pb-1 text-right">Hours</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {allocations.map((alloc, idx) => {
              const hours = calculateHours(alloc.startTime, alloc.endTime);
              return (
                <tr key={idx} className="hover:bg-zinc-100/50">
                  <td className="py-1 text-[#141414] font-black pr-2">{alloc.craneId}</td>
                  <td className="py-1 pr-2">Area {alloc.area}</td>
                  <td className="py-1 pr-2">Cols {alloc.startColumn}–{alloc.endColumn}</td>
                  <td className="py-1 pr-2">{alloc.date}</td>
                  <td className="py-1 text-zinc-600 pr-2 font-black">{alloc.startTime} – {alloc.endTime}</td>
                  <td className="py-1 text-right font-black text-amber-800">{hours.toFixed(1)} hr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <p className="text-[9px] text-zinc-400 font-bold mt-1.5 text-right italic">
        * Tracked automatically on gantry scheduling, manual overrides, and instant planning.
      </p>
    </div>
  );
}
