import React, { useState } from "react";
import { Plus, Trash2, Cpu, Hammer, AlertTriangle, AlertCircle } from "lucide-react";
import { User, Crane } from "../types";
import { getBayForArea, getColumnsForArea } from "../utils/shiftUtils";

interface CraneManagementProps {
  user: User;
  cranes: Crane[];
  onUpdateCrane: (craneId: string, updatedFields: Partial<Crane>) => void;
  onCreateCrane: (craneData: any) => Promise<boolean>;
  onDeleteCrane: (craneId: string) => void;
  onRefresh: () => void;
}

export default function CraneManagement({
  user,
  cranes,
  onUpdateCrane,
  onCreateCrane,
  onDeleteCrane,
  onRefresh,
}: CraneManagementProps) {
  // Crane CRUD states
  const [showAddCrane, setShowAddCrane] = useState(false);
  const [craneError, setCraneError] = useState("");
  const [editingCraneId, setEditingCraneId] = useState<string | null>(null);

  // Breakdown custom inline reporting state
  const [reportingBreakdownId, setReportingBreakdownId] = useState<string | null>(null);
  const [bdStartCol, setBdStartCol] = useState<number>(5);
  const [bdEndCol, setBdEndCol] = useState<number>(10);

  const getBayLetter = (b: string): string => {
    const bayLetters: Record<string, string> = {
      "1": "A",
      "2": "B",
      "3": "C",
      "4": "D",
      "5": "E",
      "6": "F",
      "7": "G"
    };
    return bayLetters[b] || b;
  };

  const userArea = user.area || 1;
  const userBay = getBayForArea(userArea);
  const userBayLetter = getBayLetter(userBay);
  const areaCols = getColumnsForArea(userArea);

  // Add Crane state variables
  const [addCraneId, setAddCraneId] = useState(() => user.role === "Area User" ? userBayLetter : "");
  const [addCraneName, setAddCraneName] = useState("");
  const [addCraneCap, setAddCraneCap] = useState<number>(10);
  const [addCraneAuxCap, setAddCraneAuxCap] = useState<string>("");
  const [addCraneCol, setAddCraneCol] = useState<number>(() => user.role === "Area User" ? Math.floor((areaCols.min + areaCols.max) / 2) : 5);
  const [addCraneMinCol, setAddCraneMinCol] = useState<number>(1);
  const [addCraneMaxCol, setAddCraneMaxCol] = useState<number>(30);
  const [addCraneAllocatedMin, setAddCraneAllocatedMin] = useState<number>(() => user.role === "Area User" ? areaCols.min : 1);
  const [addCraneAllocatedMax, setAddCraneAllocatedMax] = useState<number>(() => user.role === "Area User" ? areaCols.max : 30);

  // Edit Crane state variables
  const [craneName, setCraneName] = useState("");
  const [craneCap, setCraneCap] = useState<number>(10);
  const [craneAuxCap, setCraneAuxCap] = useState<string>("");
  const [craneCol, setCraneCol] = useState<number>(5);
  const [craneStatus, setCraneStatus] = useState<"Available" | "Maintenance" | "Busy" | "Breakdown" | "Available">("Available");
  const [craneNotes, setCraneNotes] = useState("");
  const [craneMinCol, setCraneMinCol] = useState<number>(1);
  const [craneMaxCol, setCraneMaxCol] = useState<number>(30);
  const [craneAllocMin, setCraneAllocMin] = useState<number | undefined>(undefined);
  const [craneAllocMax, setCraneAllocMax] = useState<number | undefined>(undefined);
  const [craneBreakdownStartCol, setCraneBreakdownStartCol] = useState<number | undefined>(undefined);
  const [craneBreakdownEndCol, setCraneBreakdownEndCol] = useState<number | undefined>(undefined);

  const startEditingCrane = (crane: Crane) => {
    setEditingCraneId(crane.id);
    setCraneName(crane.name || crane.id);
    setCraneCap(crane.capacity);
    setCraneAuxCap(crane.auxCapacity !== undefined ? String(crane.auxCapacity) : "");
    setCraneCol(crane.currentColumn);
    setCraneStatus(crane.status);
    setCraneNotes(crane.maintenanceNotes || "");
    setCraneMinCol(crane.minColumn);
    setCraneMaxCol(crane.maxColumn);
    setCraneAllocMin(crane.allocatedMinColumn);
    setCraneAllocMax(crane.allocatedMaxColumn);
    setCraneBreakdownStartCol(crane.breakdownStartCol);
    setCraneBreakdownEndCol(crane.breakdownEndCol);
  };

  const handleCreateCraneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCraneError("");
    if (!addCraneId || !addCraneName || !addCraneCap) {
      setCraneError("ID, Name, and Capacity are required.");
      return;
    }

    if (user.role === "Area User") {
      const uppercaseId = addCraneId.trim().toUpperCase();
      if (!uppercaseId.startsWith(userBayLetter)) {
        setCraneError(`As Supervisor of Area ${user.area} (Bay ${userBay} - Runway ${userBayLetter}), your Crane ID must start with '${userBayLetter}' (e.g. ${userBayLetter}4).`);
        return;
      }
      if (Number(addCraneAllocatedMin) < areaCols.min || Number(addCraneAllocatedMax) > areaCols.max) {
        setCraneError(`Allocated columns must be strictly within your Area ${user.area} boundaries (${areaCols.min} to ${areaCols.max}).`);
        return;
      }
    }

    const success = await onCreateCrane({
      id: addCraneId.trim().toUpperCase(),
      name: addCraneName,
      capacity: Number(addCraneCap),
      auxCapacity: addCraneAuxCap !== "" ? Number(addCraneAuxCap) : undefined,
      currentColumn: Number(addCraneCol),
      minColumn: Number(addCraneMinCol),
      maxColumn: Number(addCraneMaxCol),
      allocatedMinColumn: Number(addCraneAllocatedMin),
      allocatedMaxColumn: Number(addCraneAllocatedMax),
    });

    if (success) {
      setAddCraneId(user.role === "Area User" ? userBayLetter : "");
      setAddCraneName("");
      setAddCraneCap(10);
      setAddCraneAuxCap("");
      setAddCraneCol(user.role === "Area User" ? Math.floor((areaCols.min + areaCols.max) / 2) : 15);
      setAddCraneMinCol(1);
      setAddCraneMaxCol(30);
      setAddCraneAllocatedMin(user.role === "Area User" ? areaCols.min : 1);
      setAddCraneAllocatedMax(user.role === "Area User" ? areaCols.max : 30);
      setShowAddCrane(false);
      onRefresh();
    }
  };

  const handleEditCraneSubmit = async (e: React.FormEvent, craneId: string) => {
    e.preventDefault();
    setCraneError("");
    if (!craneName || !craneCap) {
      setCraneError("Name and Capacity are required.");
      return;
    }

    if (user.role === "Area User") {
      if (craneAllocMin !== undefined && craneAllocMin < areaCols.min) {
        setCraneError(`Allocated min column cannot be less than your area minimum (${areaCols.min}).`);
        return;
      }
      if (craneAllocMax !== undefined && craneAllocMax > areaCols.max) {
        setCraneError(`Allocated max column cannot be greater than your area maximum (${areaCols.max}).`);
        return;
      }
    }

    await onUpdateCrane(craneId, {
      name: craneName,
      capacity: Number(craneCap),
      auxCapacity: craneAuxCap !== "" ? Number(craneAuxCap) : null as any,
      currentColumn: Number(craneCol),
      minColumn: Number(craneMinCol),
      maxColumn: Number(craneMaxCol),
      allocatedMinColumn: craneAllocMin,
      allocatedMaxColumn: craneAllocMax,
      status: craneStatus,
      maintenanceNotes: craneNotes,
      breakdownStartCol: craneStatus === "Breakdown" ? (craneBreakdownStartCol !== undefined ? craneBreakdownStartCol : Math.max(1, Number(craneCol) - 1)) : undefined,
      breakdownEndCol: craneStatus === "Breakdown" ? (craneBreakdownEndCol !== undefined ? craneBreakdownEndCol : Math.min(30, Number(craneCol) + 1)) : undefined,
    });

    setEditingCraneId(null);
    onRefresh();
  };

  return (
    <div id="crane_management_page_layout" className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b-2 border-[#141414] pb-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-600" />
            Active Crane Gantry Fleet & Resource Administration
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5 font-bold uppercase">
            Configure physical limits, hoisting capacities, and real-time statuses for Bay {userBay}
          </p>
        </div>
        <button
          onClick={() => setShowAddCrane(!showAddCrane)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 border-2 border-[#141414] shadow-[3px_3px_0px_#141414] font-black uppercase tracking-wide text-xs rounded-sm transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto font-mono"
        >
          <Plus className="w-4 h-4" />
          {showAddCrane ? "Hide Form" : "Register New Crane"}
        </button>
      </div>

      {craneError && (
        <div className="p-3 bg-red-100 border-2 border-red-500 text-red-950 rounded-sm font-mono text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#141414]">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{craneError}</span>
        </div>
      )}

      {/* Create Crane Form */}
      {showAddCrane && (
        <div className="bg-zinc-50 border-4 border-[#141414] p-6 rounded-sm shadow-[6px_6px_0px_#141414] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500 animate-pulse"></div>
          <h4 className="text-xs font-black uppercase tracking-wider mb-4 border-b border-zinc-200 pb-2 flex items-center gap-1.5 font-mono">
            <Hammer className="w-4 h-4 text-zinc-600" />
            Register New Crane Asset
          </h4>

          {user.role === "Area User" && (
            <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-400 text-amber-950 rounded-sm font-mono text-[11px] leading-relaxed font-bold">
              ⚠️ <strong>Area-Restricted Asset Registration:</strong> As the supervisor for <strong>Area {user.area}</strong>, you can only register cranes operating within <strong>Runway {userBayLetter}</strong> (Columns {areaCols.min} to {areaCols.max}). The crane ID must begin with <strong>{userBayLetter}</strong>.
            </div>
          )}

          <form onSubmit={handleCreateCraneSubmit} className="space-y-4 font-mono text-xs font-bold">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Unique ID (e.g. {user.role === "Area User" ? `${userBayLetter}4` : "A4"})</label>
                <input
                  type="text"
                  placeholder={`e.g. ${user.role === "Area User" ? `${userBayLetter}4` : "A4"}`}
                  value={addCraneId}
                  onChange={(e) => setAddCraneId(e.target.value.toUpperCase())}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Display Name</label>
                <input
                  type="text"
                  placeholder={`e.g. Crane ${user.role === "Area User" ? `${userBayLetter}4` : "A4"}`}
                  value={addCraneName}
                  onChange={(e) => setAddCraneName(e.target.value)}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Main Hoist Capacity (Tons)</label>
                <input
                  type="number"
                  value={addCraneCap}
                  onChange={(e) => setAddCraneCap(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Aux Hoist Capacity (Tons, Optional)</label>
                <input
                  type="number"
                  placeholder="None (Leave empty if no Aux Hoist)"
                  value={addCraneAuxCap}
                  onChange={(e) => setAddCraneAuxCap(e.target.value)}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Current Column Position</label>
                <input
                  type="number"
                  min={user.role === "Area User" ? areaCols.min : 1}
                  max={user.role === "Area User" ? areaCols.max : 30}
                  value={addCraneCol}
                  onChange={(e) => setAddCraneCol(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Min Column</label>
                <input
                  type="number"
                  value={addCraneMinCol}
                  onChange={(e) => setAddCraneMinCol(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold bg-zinc-100"
                  readOnly={user.role === "Area User"}
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Max Column</label>
                <input
                  type="number"
                  value={addCraneMaxCol}
                  onChange={(e) => setAddCraneMaxCol(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold bg-zinc-100"
                  readOnly={user.role === "Area User"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Min Column</label>
                <input
                  type="number"
                  min={user.role === "Area User" ? areaCols.min : 1}
                  max={user.role === "Area User" ? areaCols.max : 30}
                  value={addCraneAllocatedMin}
                  onChange={(e) => setAddCraneAllocatedMin(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Max Column</label>
                <input
                  type="number"
                  min={user.role === "Area User" ? areaCols.min : 1}
                  max={user.role === "Area User" ? areaCols.max : 30}
                  value={addCraneAllocatedMax}
                  onChange={(e) => setAddCraneAllocatedMax(Number(e.target.value))}
                  className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 font-sans">
              <button
                type="button"
                onClick={() => setShowAddCrane(false)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm text-zinc-700 text-xs font-bold font-mono"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white rounded-sm font-black text-xs uppercase"
              >
                Register Asset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cranes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cranes.filter((crane) => {
          if (user.role === "Area User") {
            // Show if explicitly assigned to this supervisor
            if (user.craneNo && crane.id === user.craneNo) {
              return true;
            }
            // Or if it is allocated to their specific area columns
            const matchesBay = crane.id.toUpperCase().startsWith(userBayLetter.toUpperCase());
            const matchesAllocatedCols = (
              crane.allocatedMinColumn !== undefined && 
              crane.allocatedMinColumn >= areaCols.min && 
              crane.allocatedMaxColumn !== undefined && 
              crane.allocatedMaxColumn <= areaCols.max
            );
            return matchesBay && matchesAllocatedCols;
          }
          return true; // Admin can see all
        }).map((crane) => (
          <div key={crane.id} className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4 relative overflow-hidden">
            <div className="flex justify-between items-center border-b-2 border-zinc-200 pb-2">
              <h3 className="font-black text-[#141414] text-xs uppercase tracking-tight font-mono">
                {crane.name || `Crane ${crane.id}`} ({crane.id})
              </h3>
              <span className="text-[9px] bg-[#141414] text-white px-2 py-0.5 rounded-sm font-mono font-black uppercase">
                Cap: {crane.capacity}T
              </span>
            </div>

            {editingCraneId === crane.id ? (
              /* Edit Crane Form */
              <form
                onSubmit={(e) => handleEditCraneSubmit(e, crane.id)}
                className="space-y-3 font-mono text-xs font-bold"
              >
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Crane Display Name</label>
                  <input
                    type="text"
                    value={craneName}
                    onChange={(e) => setCraneName(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Main Cap (T)</label>
                    <input
                      type="number"
                      value={craneCap}
                      onChange={(e) => setCraneCap(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Aux Cap (T, Optional)</label>
                    <input
                      type="number"
                      placeholder="None"
                      value={craneAuxCap}
                      onChange={(e) => setCraneAuxCap(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Current Column</label>
                    <input
                      type="number"
                      min={craneMinCol}
                      max={craneMaxCol}
                      value={craneCol}
                      onChange={(e) => setCraneCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Status</label>
                    <select
                      value={craneStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as any;
                        setCraneStatus(newStatus);
                        if (newStatus === "Breakdown") {
                          setCraneBreakdownStartCol(Math.max(1, craneCol - 1));
                          setCraneBreakdownEndCol(Math.min(30, craneCol + 1));
                        }
                      }}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    >
                      <option value="Available">Available</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Busy">Busy</option>
                      <option value="Breakdown">Breakdown</option>
                    </select>
                  </div>
                </div>

                {craneStatus === "Breakdown" && (
                  <div className="grid grid-cols-2 gap-2 bg-red-50 p-2.5 rounded-sm border-2 border-red-500">
                    <div>
                      <label className="block text-[9px] uppercase font-black text-red-600 mb-1">BD Start Col</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={craneBreakdownStartCol !== undefined ? craneBreakdownStartCol : Math.max(1, craneCol - 1)}
                        onChange={(e) => setCraneBreakdownStartCol(Number(e.target.value))}
                        className="w-full p-1.5 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase font-black text-red-600 mb-1">BD End Col</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={craneBreakdownEndCol !== undefined ? craneBreakdownEndCol : Math.min(30, craneCol + 1)}
                        onChange={(e) => setCraneBreakdownEndCol(Number(e.target.value))}
                        className="w-full p-1.5 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Min</label>
                    <input
                      type="number"
                      value={craneMinCol}
                      onChange={(e) => setCraneMinCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold bg-zinc-100"
                      readOnly={user.role === "Area User"}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Physical Max</label>
                    <input
                      type="number"
                      value={craneMaxCol}
                      onChange={(e) => setCraneMaxCol(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold bg-zinc-100"
                      readOnly={user.role === "Area User"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Min</label>
                    <input
                      type="number"
                      min={user.role === "Area User" ? areaCols.min : 1}
                      max={user.role === "Area User" ? areaCols.max : 30}
                      value={craneAllocMin !== undefined ? craneAllocMin : ""}
                      onChange={(e) => setCraneAllocMin(e.target.value !== "" ? Number(e.target.value) : undefined)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Allocated Max</label>
                    <input
                      type="number"
                      min={user.role === "Area User" ? areaCols.min : 1}
                      max={user.role === "Area User" ? areaCols.max : 30}
                      value={craneAllocMax !== undefined ? craneAllocMax : ""}
                      onChange={(e) => setCraneAllocMax(e.target.value !== "" ? Number(e.target.value) : undefined)}
                      className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Maintenance Log notes</label>
                  <textarea
                    value={craneNotes}
                    onChange={(e) => setCraneNotes(e.target.value)}
                    placeholder="e.g. Scheduled cable safety check"
                    className="w-full p-2 border-2 border-[#141414] rounded-sm bg-white text-zinc-900 font-sans font-medium h-16"
                  />
                </div>

                <div className="flex gap-2 font-sans pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingCraneId(null)}
                    className="w-1/2 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm text-zinc-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-[#141414] hover:bg-zinc-800 border-2 border-[#141414] text-white rounded-sm font-black text-xs uppercase"
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              /* Display Crane Details */
              <div className="space-y-3 font-mono text-xs text-zinc-700 font-bold">
                <div className="flex justify-between">
                  <span>Hoist Configuration:</span>
                  <span className="font-black text-[#141414]">
                    {crane.auxCapacity ? `Main: ${crane.capacity}T / Aux: ${crane.auxCapacity}T` : `${crane.capacity}T Single`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Position Status:</span>
                  <span className="font-black text-[#141414]">Column {crane.currentColumn}</span>
                </div>
                <div className="flex justify-between">
                  <span>Physical limits:</span>
                  <span className="text-[#141414]">Cols {crane.minColumn}-{crane.maxColumn}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allocated Bounds:</span>
                  <span className="text-[#141414]">
                    Cols {crane.allocatedMinColumn !== undefined ? crane.allocatedMinColumn : 1}-
                    {crane.allocatedMaxColumn !== undefined ? crane.allocatedMaxColumn : 30}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded-sm text-[9px] uppercase border ${
                      crane.status === "Available"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : crane.status === "Busy"
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : "bg-red-50 text-red-800 border-red-300"
                    }`}
                  >
                    {crane.status}
                  </span>
                </div>

                {crane.maintenanceNotes && crane.status !== "Breakdown" && (
                  <div className="mt-2 p-2 bg-red-50 border-2 border-red-300 rounded-sm text-red-950 text-[10px] flex items-start gap-1 font-sans">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-600" />
                    <span>{crane.maintenanceNotes}</span>
                  </div>
                )}

                {/* Breakdown Custom Management Option */}
                <div className="mt-3 border-t border-dashed border-zinc-200 pt-3">
                  {crane.status === "Breakdown" ? (
                    <div className="p-2.5 bg-red-50 border-2 border-red-500 rounded-sm text-red-950 text-xs font-mono space-y-1.5 shadow-[2px_2px_0px_#ef4444]">
                      <div className="flex items-center gap-1.5 font-extrabold text-red-600 uppercase">
                        <AlertTriangle className="w-4 h-4 text-red-600 animate-bounce" />
                        <span>Crane Breakdown active</span>
                      </div>
                      <div className="font-bold">
                        Blocked Track: Columns <span className="font-black text-red-600">{crane.breakdownStartCol || crane.currentColumn}</span> to <span className="font-black text-red-600">{crane.breakdownEndCol || crane.currentColumn}</span>.
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateCrane(crane.id, {
                            status: "Available",
                            breakdownStartCol: undefined,
                            breakdownEndCol: undefined,
                            maintenanceNotes: "",
                          });
                          onRefresh();
                        }}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 border-2 border-emerald-950 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-sm cursor-pointer shadow-[1px_1px_0px_#064e3b]"
                      >
                        ✅ Mark Recovered
                      </button>
                    </div>
                  ) : reportingBreakdownId === crane.id ? (
                    <div className="p-2.5 bg-red-50 border-2 border-red-500 rounded-sm text-red-950 text-xs font-mono space-y-2 shadow-[2px_2px_0px_#ef4444]">
                      <div className="font-extrabold text-red-600 uppercase tracking-tight text-[10px]">
                        ⚠️ Enter breakdown column range:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <label className="block text-[8px] uppercase font-black text-zinc-500 mb-0.5">Start Column</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={bdStartCol}
                            onChange={(e) => setBdStartCol(Number(e.target.value))}
                            className="w-full p-1 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-extrabold text-[10px]"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] uppercase font-black text-zinc-500 mb-0.5">End Column</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={bdEndCol}
                            onChange={(e) => setBdEndCol(Number(e.target.value))}
                            className="w-full p-1 border-2 border-red-600 rounded-sm bg-white text-zinc-900 font-extrabold text-[10px]"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setReportingBreakdownId(null)}
                          className="w-1/2 py-1 bg-zinc-200 hover:bg-zinc-300 border border-zinc-400 text-zinc-800 font-bold text-[9px] rounded-sm uppercase"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateCrane(crane.id, {
                              status: "Breakdown",
                              breakdownStartCol: bdStartCol,
                              breakdownEndCol: bdEndCol,
                              maintenanceNotes: `BREAKDOWN active between Column ${bdStartCol} and Column ${bdEndCol}.`,
                            });
                            setReportingBreakdownId(null);
                            onRefresh();
                          }}
                          className="w-1/2 py-1 bg-red-600 hover:bg-red-700 border-2 border-red-950 text-white font-extrabold text-[9px] rounded-sm uppercase"
                        >
                          Confirm BD
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setReportingBreakdownId(crane.id);
                        setBdStartCol(Math.max(1, crane.currentColumn - 1));
                        setBdEndCol(Math.min(30, crane.currentColumn + 1));
                      }}
                      className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white border-2 border-[#141414] shadow-[2px_2px_0px_#141414] text-center font-bold text-[10px] uppercase rounded-sm cursor-pointer flex items-center justify-center gap-1 hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-[1.5px_1.5px_0px_#141414]"
                    >
                      🚨 Report Breakdown
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => startEditingCrane(crane)}
                    className="py-2 bg-zinc-50 hover:bg-zinc-100 border-2 border-[#141414] shadow-[1px_1px_0px_#141414] text-[#141414] text-xs font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer"
                  >
                    Modify Parameters
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to permanently delete Crane ${crane.name || crane.id} (${crane.id})?`)) {
                        onDeleteCrane(crane.id);
                      }
                    }}
                    className="py-2 bg-red-50 hover:bg-red-100 border-2 border-red-600 text-red-600 text-xs font-black rounded-sm uppercase tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
