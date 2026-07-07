import React from "react";
import { Info, Hammer, AlertTriangle, UserCheck, ShieldAlert, Cpu } from "lucide-react";
import { Crane, User } from "../types";

interface CranesSpecificationsProps {
  cranes: Crane[];
  users: User[];
  selectedBay: string;
}

export default function CranesSpecifications({ cranes, users, selectedBay }: CranesSpecificationsProps) {
  return (
    <div id="cranes_specifications_page" className="space-y-6 font-mono">
      {/* Header */}
      <div className="bg-white border-4 border-[#141414] p-5 shadow-[4px_4px_0px_#141414]">
        <h2 className="text-sm font-black uppercase tracking-tighter flex items-center gap-2 text-zinc-900">
          <span className="w-3 h-3 bg-amber-500 border border-[#141414]"></span>
          Bay {selectedBay} — Gantry Cranes Specifications & Telemetries
        </h2>
        <p className="text-[11px] text-zinc-500 font-bold mt-1 uppercase">
          Structural and physical engineering characteristics of active hoisting gantries.
        </p>
      </div>

      {/* Grid of specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cranes.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 border-4 border-dashed border-[#141414] bg-white">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-zinc-400" />
            <div className="font-bold text-xs uppercase">No cranes found registered for Bay {selectedBay}</div>
          </div>
        ) : (
          cranes.map((crane) => {
            // Find active operator for this crane
            const assignedOperator = users.find(
              (u) => u.craneNo && u.craneNo.toUpperCase() === crane.id.toUpperCase()
            );

            const isMaintenance = crane.status === "Maintenance";

            return (
              <div
                key={crane.id}
                className={`bg-white border-4 border-[#141414] shadow-[4px_4px_0px_#141414] flex flex-col justify-between ${
                  isMaintenance ? "bg-red-50/20" : ""
                }`}
              >
                {/* Crane Header Indicator */}
                <div className="p-4 border-b-2 border-[#141414] bg-zinc-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-sm uppercase tracking-tight text-white">{crane.name}</h3>
                    <span className="text-[9px] font-bold text-amber-500 uppercase">SYSTEM ID: {crane.id}</span>
                  </div>
                  <span
                    className={`text-[9px] px-2 py-0.5 border-2 border-slate-950 font-black rounded-sm uppercase ${
                      isMaintenance
                        ? "bg-red-500 text-white"
                        : crane.status === "Busy"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-emerald-500 text-white"
                    }`}
                  >
                    {crane.status}
                  </span>
                </div>

                {/* Technical Specifications */}
                <div className="p-4 space-y-4 flex-grow">
                  <div className="space-y-2 text-[11px] font-bold">
                    <span className="text-zinc-500 uppercase tracking-wider text-[10px] block border-b border-zinc-200 pb-1">
                      ⚙️ Mechanical Profile
                    </span>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Max Hoist Capacity:</span>
                      <span className="text-[#141414] font-black">{crane.capacity} TONS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Operating Zone:</span>
                      <span className="text-[#141414] font-black">
                        Cols {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : 1} -{" "}
                        {crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : 30}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Physical Travel Limits:</span>
                      <span className="text-zinc-600">
                        Cols {crane.minColumn || 1} - {crane.maxColumn || 30}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Current Position:</span>
                      <span className="text-[#141414] font-black bg-amber-500/20 px-1.5 rounded-sm">
                        Column {crane.currentColumn}
                      </span>
                    </div>
                  </div>

                  {/* Operator Badge Assignment */}
                  <div className="space-y-2 text-[11px] font-bold bg-zinc-50 p-3 border-2 border-[#141414] rounded-sm">
                    <span className="text-[#141414] uppercase tracking-wider text-[10px] block border-b border-zinc-300 pb-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                      Assigned Field Operator
                    </span>
                    {assignedOperator ? (
                      <div className="space-y-1 mt-1 font-mono text-[10px] text-zinc-800">
                        <div className="font-extrabold text-[#141414] uppercase text-[11px]">
                          {assignedOperator.name}
                        </div>
                        <div>Badge ID: <span className="font-bold text-zinc-950">{assignedOperator.employeeId}</span></div>
                        <div>Role: <span className="text-amber-800 font-extrabold">{assignedOperator.role} (Area {assignedOperator.area})</span></div>
                        {assignedOperator.phone && <div>Phone: <span className="text-zinc-950">{assignedOperator.phone}</span></div>}
                        {assignedOperator.email && <div className="truncate">Email: <span className="text-zinc-950">{assignedOperator.email}</span></div>}
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-400 italic mt-1 font-sans font-bold">
                        No active operator badge assigned to this crane in system files.
                      </div>
                    )}
                  </div>

                  {/* Maintenance Log */}
                  {isMaintenance && (
                    <div className="p-3 bg-red-100/50 border border-red-300 rounded-sm space-y-1 text-red-950">
                      <div className="text-[10px] font-black uppercase flex items-center gap-1">
                        <Hammer className="w-3.5 h-3.5" />
                        Maintenance Hold Note
                      </div>
                      <p className="text-[10px] font-bold font-sans mt-0.5 leading-snug">
                        {crane.maintenanceNotes || "Scheduled safety and electrical calibration. Track remains locked."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer specs */}
                <div className="p-3.5 bg-zinc-100 border-t-2 border-[#141414] text-center text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                  Verified Safe Gantry Parameters
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
