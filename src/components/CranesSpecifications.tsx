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
    <div id="cranes_specifications_page" className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white/40 backdrop-blur-lg border border-white/50 p-6 rounded-2xl shadow-sm transition-all duration-300">
        <h2 className="text-base font-extrabold uppercase tracking-tight flex items-center gap-2 text-zinc-900">
          <span className="w-3.5 h-3.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
          Bay {selectedBay} — Gantry Cranes Specifications & Telemetries
        </h2>
        <p className="text-xs text-zinc-500 font-medium mt-1">
          Structural and physical engineering characteristics of active hoisting gantries on the runway gantry track.
        </p>
      </div>

      {/* Grid of specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cranes.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 border border-dashed border-zinc-300 bg-white/30 backdrop-blur-lg rounded-2xl">
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
                className={`bg-white/40 backdrop-blur-lg border border-white/50 rounded-2xl shadow-md overflow-hidden flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px] ${
                  isMaintenance ? "ring-2 ring-red-500/20 bg-red-50/10" : ""
                }`}
              >
                {/* Crane Header Indicator */}
                <div className="p-4 border-b border-zinc-200/50 bg-gradient-to-r from-zinc-800 to-zinc-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-sm uppercase tracking-tight text-white">{crane.name}</h3>
                    <span className="text-[10px] font-mono font-medium text-amber-400 uppercase tracking-wider">SYSTEM ID: {crane.id}</span>
                  </div>
                  <span
                    className={`text-[9px] px-2.5 py-1 font-extrabold rounded-full uppercase tracking-wider shadow-sm ${
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
                <div className="p-5 space-y-4 flex-grow">
                  <div className="space-y-2.5 text-xs">
                    <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-bold block border-b border-zinc-200/40 pb-1.5">
                      ⚙️ Mechanical Profile
                    </span>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-zinc-500 font-medium">Max Hoist Capacity:</span>
                      <span className="text-zinc-800 font-semibold bg-zinc-100/50 px-2 py-0.5 rounded-md text-xs font-mono">
                        {crane.auxCapacity ? `${crane.capacity}T (Main)` : `${crane.capacity} Tons`}
                      </span>
                    </div>
                    {crane.auxCapacity && (
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-zinc-500 font-medium">Aux Hoist Capacity:</span>
                        <span className="text-zinc-800 font-semibold bg-zinc-100/50 px-2 py-0.5 rounded-md text-xs font-mono">{crane.auxCapacity} Tons</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-zinc-500 font-medium">Operating Zone:</span>
                      <span className="text-zinc-800 font-semibold bg-zinc-100/50 px-2 py-0.5 rounded-md text-xs font-mono">
                        Cols {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : 1} -{" "}
                        {crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : 30}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-zinc-500 font-medium">Physical Travel Limits:</span>
                      <span className="text-zinc-500 font-medium bg-zinc-50/50 px-2 py-0.5 rounded-md text-xs font-mono">
                        Cols {crane.minColumn || 1} - {crane.maxColumn || 30}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-zinc-500 font-medium">Current Position:</span>
                      <span className="text-amber-950 font-semibold bg-amber-500/20 px-2 py-0.5 rounded-md text-xs font-mono">
                        Column {crane.currentColumn}
                      </span>
                    </div>
                  </div>

                  {/* Operator Badge Assignment */}
                  <div className="space-y-2 text-xs bg-white/50 backdrop-blur-sm p-4.5 border border-white/60 rounded-xl shadow-inner">
                    <span className="text-zinc-700 uppercase tracking-wider text-[10px] font-bold block border-b border-zinc-200/50 pb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-500" />
                      Assigned Field Operator
                    </span>
                    {assignedOperator ? (
                      <div className="space-y-1.5 mt-1 font-sans text-xs text-zinc-600">
                        <div className="font-extrabold text-zinc-800 uppercase text-xs">
                          {assignedOperator.name}
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span>Badge ID:</span>
                          <span className="font-mono font-bold text-zinc-900">{assignedOperator.employeeId}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span>Role:</span>
                          <span className="font-semibold text-amber-700">{assignedOperator.role} (Area {assignedOperator.area})</span>
                        </div>
                        {assignedOperator.phone && (
                          <div className="flex justify-between text-[11px]">
                            <span>Phone:</span>
                            <span className="text-zinc-800 font-medium">{assignedOperator.phone}</span>
                          </div>
                        )}
                        {assignedOperator.email && (
                          <div className="flex justify-between text-[11px] gap-2">
                            <span>Email:</span>
                            <span className="text-zinc-800 font-medium truncate max-w-[120px]">{assignedOperator.email}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400 italic mt-1 font-medium">
                        No active operator badge assigned.
                      </div>
                    )}
                  </div>

                  {/* Maintenance Log */}
                  {isMaintenance && (
                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl space-y-1 text-red-950">
                      <div className="text-[10px] font-extrabold uppercase flex items-center gap-1.5 text-red-700">
                        <Hammer className="w-3.5 h-3.5" />
                        Maintenance Hold Note
                      </div>
                      <p className="text-xs font-medium text-red-800 leading-snug">
                        {crane.maintenanceNotes || "Scheduled safety and electrical calibration. Track remains locked."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer specs */}
                <div className="p-3 bg-zinc-50/50 border-t border-zinc-200/30 text-center text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
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
