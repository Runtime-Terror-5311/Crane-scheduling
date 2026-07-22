import React, { useState } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  MapPin, 
  Smartphone, 
  Mail, 
  Shield, 
  Hammer,
  Key
} from "lucide-react";
import { User, Crane } from "../types";
import { getBayForArea } from "../utils/shiftUtils";

interface ManageUsersProps {
  users: User[];
  cranes: Crane[];
  onAddUser: (newUser: any) => Promise<boolean | void> | void;
  onUpdateUser: (employeeId: string, updatedFields: any) => Promise<boolean>;
  onDeleteUser: (employeeId: string) => void;
}

export default function ManageUsers({
  users,
  cranes,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}: ManageUsersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form state
  const [newEmpId, setNewEmpId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Area User">("Area User");
  const [newArea, setNewArea] = useState<number>(1);
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [selectedCranes, setSelectedCranes] = useState<string[]>([]);

  // Edit form state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"Admin" | "Area User">("Area User");
  const [editArea, setEditArea] = useState<number>(1);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPass, setEditPass] = useState("");
  const [editSelectedCranes, setEditSelectedCranes] = useState<string[]>([]);

  // Filter users based on search
  const filteredUsers = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(s) ||
      u.employeeId.toLowerCase().includes(s) ||
      (u.email || "").toLowerCase().includes(s) ||
      (u.phone || "").toLowerCase().includes(s) ||
      (u.craneNo || "").toLowerCase().includes(s)
    );
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newEmpId.trim() || !newName.trim()) {
      setError("Employee ID and Name are required.");
      return;
    }

    if (users.some((u) => u.employeeId.toUpperCase() === newEmpId.trim().toUpperCase())) {
      setError(`Employee ID "${newEmpId}" already exists in the registry.`);
      return;
    }

    const payload = {
      employeeId: newEmpId.trim().toUpperCase(),
      name: newName.trim(),
      role: newRole,
      area: newRole === "Admin" ? null : Number(newArea),
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      password: newPass.trim() || "factory123", // fallback
      craneNo: selectedCranes.join(", "),
      planningPoints: 100
    };

    const res = await onAddUser(payload);
    if (res !== false) {
      // Reset state
      setNewEmpId("");
      setNewName("");
      setNewPass("");
      setNewPhone("");
      setNewEmail("");
      setSelectedCranes([]);
      
      setSuccess("Staff member successfully registered and saved to database.");
      setTimeout(() => setSuccess(""), 4000);
    } else {
      setError("Failed to create staff account in database. Check server logs or duplicate employee ID.");
    }
  };

  const startEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditArea(u.area || 1);
    setEditPhone(u.phone || "");
    setEditEmail(u.email || "");
    setEditPass("");
    
    const assigned = u.craneNo 
      ? u.craneNo.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) 
      : [];
    setEditSelectedCranes(assigned);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError("");
    setSuccess("");

    const payload: any = {
      name: editName.trim(),
      role: editRole,
      area: editRole === "Admin" ? null : Number(editArea),
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      craneNo: editSelectedCranes.join(", ")
    };

    if (editPass.trim()) {
      payload.password = editPass.trim();
    }

    const ok = await onUpdateUser(editingUser.employeeId, payload);
    if (ok) {
      setSuccess(`Profile of ${editName} updated successfully.`);
      setEditingUser(null);
      setTimeout(() => setSuccess(""), 4000);
    } else {
      setError("Failed to save changes. Please try again.");
    }
  };

  const handleDelete = (empId: string, name: string) => {
    if (window.confirm(`Are you absolutely sure you want to delete ${name} (${empId}) from the roster?`)) {
      onDeleteUser(empId);
      setSuccess(`Removed ${name} from the database.`);
      setTimeout(() => setSuccess(""), 4000);
    }
  };

  const toggleCraneSelection = (craneId: string, mode: "create" | "edit") => {
    if (mode === "create") {
      if (selectedCranes.includes(craneId)) {
        setSelectedCranes(selectedCranes.filter((c) => c !== craneId));
      } else {
        setSelectedCranes([...selectedCranes, craneId]);
      }
    } else {
      if (editSelectedCranes.includes(craneId)) {
        setEditSelectedCranes(editSelectedCranes.filter((c) => c !== craneId));
      } else {
        setEditSelectedCranes([...editSelectedCranes, craneId]);
      }
    }
  };

  return (
    <div id="manage_users_view" className="space-y-6 font-sans">
      
      {/* Banner */}
      <div className="bg-[#141414] text-white p-6 rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Users className="w-48 h-48 text-white" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider font-mono shadow-[1px_1px_0px_white]">
              ADMIN SECURITY
            </span>
            <span className="text-zinc-500 font-mono text-xs">•</span>
            <span className="text-zinc-400 font-mono text-[11px] font-bold uppercase tracking-widest flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-amber-500" /> Plant Access &amp; Fleet Supervision Console
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">
            Supervisors &amp; Staff Directory
          </h1>
          <p className="text-[11px] md:text-xs text-zinc-400 font-mono mt-1 font-bold leading-relaxed max-w-3xl">
            Register and manage shop floor managers, assign precise area authorization, and map multiple overhead gantry cranes directly to their operational scope.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border-2 border-red-500 text-red-950 text-xs font-mono font-bold rounded-sm shadow-[2px_2px_0px_#7f1d1d] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-500 text-emerald-950 text-xs font-mono font-bold rounded-sm shadow-[2px_2px_0px_#064e3b] flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-700 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle: Users List & Search */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border-2 border-[#141414] p-4 rounded-sm shadow-[3px_3px_0px_#141414] font-mono text-xs">
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search staff by Employee ID, Name, Crane, Area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-2 border-[#141414] rounded-sm bg-zinc-50 font-sans font-bold text-xs text-[#141414] focus:outline-none"
              />
            </div>
            <div className="text-[10px] text-zinc-400 font-bold uppercase">
              Registered Roster: {filteredUsers.length} of {users.length} staff members listed
            </div>
          </div>

          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-sm font-mono text-xs">
                <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2 animate-bounce" />
                <span className="font-black text-zinc-600 uppercase">No Staff Members Match Search</span>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const assigned = u.craneNo 
                  ? u.craneNo.split(",").map(c => c.trim().toUpperCase()).filter(Boolean) 
                  : [];
                
                return (
                  <div 
                    key={u.employeeId} 
                    className="bg-white border-2 border-[#141414] rounded-sm shadow-[3px_3px_0px_#141414] p-4 font-sans flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-amber-500/80 transition-colors"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono bg-[#141414] text-white px-2 py-0.5 rounded-sm text-[10px] font-black border border-[#141414]">
                          {u.employeeId}
                        </span>
                        <h3 className="font-sans font-black text-sm text-zinc-950 uppercase tracking-tight">
                          {u.name}
                        </h3>
                        <span className={`text-[9px] font-mono font-black border border-current px-2 py-0.5 rounded-sm uppercase ${
                          u.role === "Admin" 
                            ? "text-rose-700 bg-rose-50" 
                            : "text-amber-700 bg-amber-50"
                        }`}>
                          {u.role}
                        </span>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-[11px] text-zinc-500 font-mono font-bold uppercase">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" /> 
                          {u.role === "Admin" ? "ALL BAYS (Admin)" : `Primary Area ${u.area || 1}`}
                        </span>
                        {(u.phone) && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> {u.phone}
                          </span>
                        )}
                        {(u.email) && (
                          <span className="flex items-center gap-1 normal-case font-semibold">
                            <Mail className="w-3.5 h-3.5 text-zinc-400" /> {u.email}
                          </span>
                        )}
                      </div>

                      {/* Crane Multi Assignments */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[9px] font-mono text-zinc-400 uppercase font-black mr-1 flex items-center gap-1">
                          <Hammer className="w-3 h-3" /> Supervision Scope:
                        </span>
                        {assigned.length === 0 ? (
                          <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase italic">
                            No Cranes Mapped
                          </span>
                        ) : (
                          assigned.map((c) => (
                            <span 
                              key={c}
                              className="px-2 py-0.5 bg-zinc-100 text-zinc-800 border border-zinc-300 font-mono font-black text-[10px] rounded-sm uppercase hover:bg-amber-100 hover:border-amber-500 transition-colors"
                            >
                              🏗️ Crane {c}
                            </span>
                          ))
                        )}
                        {u.planningPoints !== undefined && (
                          <div className="ml-auto text-right flex flex-col items-end gap-0.5">
                            <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 font-extrabold rounded-sm uppercase">
                              Score: {u.planningPoints}/100 pts
                            </span>
                            {u.role === "Area User" && (
                              <span className="text-[9px] font-mono text-zinc-500 font-semibold uppercase">
                                P1: {u.p1Count ?? 0} | P2: {u.p2Count ?? 0} | Instant: {u.instantCount ?? 0}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 w-full md:w-auto flex-shrink-0">
                      <button
                        onClick={() => startEdit(u)}
                        className="flex-1 md:flex-none px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-[#141414] border-2 border-[#141414] text-xs font-black uppercase tracking-wider rounded-sm active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title="Edit profile & crane mapping"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-zinc-600" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u.employeeId, u.name)}
                        className="flex-1 md:flex-none px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-300 hover:border-red-500 text-xs font-black uppercase tracking-wider rounded-sm active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        title="Delete staff account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Create or Edit Forms */}
        <div className="space-y-6">
          
          {editingUser ? (
            /* Edit User Panel */
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-sm uppercase tracking-tight border-b-2 border-zinc-200 pb-2 flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4 text-amber-500" /> Edit Profile
                </span>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </h3>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Staff Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] bg-white text-xs font-sans font-bold text-[#141414]"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Override Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={editPass}
                    onChange={(e) => setEditPass(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] bg-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 98765 43210"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. name@factory.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs normal-case"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Role / Clearance</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                      className="w-full p-2 border-2 border-[#141414] bg-white font-sans text-xs font-bold"
                    >
                      <option value="Area User">Area User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Primary Area</label>
                    <select
                      disabled={editRole === "Admin"}
                      value={editArea}
                      onChange={(e) => setEditArea(Number(e.target.value))}
                      className="w-full p-2 border-2 border-[#141414] bg-white font-sans text-xs font-bold disabled:bg-zinc-100"
                    >
                      {Array.from({ length: 22 }, (_, i) => i + 1).map((areaNum) => (
                        <option key={areaNum} value={areaNum}>Area {areaNum}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Crane Multi Checkboxes (Critical User Request) */}
                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-2 flex items-center gap-1">
                    <Hammer className="w-3 h-3 text-amber-500" /> Map Supervised Cranes (Check Multiple)
                  </label>
                  <div className="border-2 border-[#141414] rounded-sm p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2 bg-zinc-50">
                    {cranes.map((c) => {
                      const isChecked = editSelectedCranes.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCraneSelection(c.id, "edit")}
                          className={`p-1.5 border-2 rounded-sm text-center font-black uppercase text-[10px] cursor-pointer active:translate-y-[1px] transition-all ${
                            isChecked
                              ? "bg-amber-500 border-slate-900 text-slate-950"
                              : "bg-white border-zinc-300 text-zinc-600 hover:border-[#141414]"
                          }`}
                        >
                          🏗️ Crane {c.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="w-1/3 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-sm font-sans font-black text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2 bg-amber-500 hover:bg-amber-600 border-2 border-[#141414] text-slate-950 rounded-sm font-sans font-black text-xs uppercase shadow-[2px_2px_0px_#141414] cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Register User Panel */
            <div className="bg-white rounded-sm border-2 border-[#141414] shadow-[4px_4px_0px_#141414] p-5 space-y-4">
              <h3 className="font-black text-[#141414] text-sm uppercase tracking-tight border-b-2 border-zinc-200 pb-2 flex items-center gap-1.5">
                <UserPlus className="w-5 h-5 text-amber-500" />
                Register Staff Profile
              </h3>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-mono font-bold">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP120"
                      value={newEmpId}
                      onChange={(e) => setNewEmpId(e.target.value.toUpperCase())}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs placeholder:text-zinc-400 font-bold uppercase text-[#141414]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Smith"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs placeholder:text-zinc-400 font-sans font-bold text-[#141414]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Portal Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Set private access key"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full p-2 border-2 border-[#141414] bg-white text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +91 99999 88888"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. jsmith@factory.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full p-2 border-2 border-[#141414] bg-white text-xs normal-case"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">System Clearance</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as any)}
                      className="w-full p-2 border-2 border-[#141414] bg-white font-sans text-xs font-bold"
                    >
                      <option value="Area User">Area User</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase font-black text-zinc-500 mb-1">Primary Area</label>
                    <select
                      disabled={newRole === "Admin"}
                      value={newArea}
                      onChange={(e) => {
                        const areaNum = Number(e.target.value);
                        setNewArea(areaNum);
                        // Auto select cranes for this area's bay
                        const assocBay = getBayForArea(areaNum);
                        const bayLetters: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "6": "F", "7": "G" };
                        const letter = bayLetters[assocBay] || "A";
                        const areaCranes = cranes.filter(c => c.id.toUpperCase().startsWith(assocBay) || c.id.toUpperCase().startsWith(letter)).map(c => c.id);
                        if (areaCranes.length > 0) {
                          setSelectedCranes(areaCranes);
                        }
                      }}
                      className="w-full p-2 border-2 border-[#141414] bg-white font-sans text-xs font-bold disabled:bg-zinc-100"
                    >
                      {Array.from({ length: 22 }, (_, i) => i + 1).map((areaNum) => (
                        <option key={areaNum} value={areaNum}>Area {areaNum}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Crane Multi Checkboxes (Critical User Request) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[9px] uppercase font-black text-zinc-500 flex items-center gap-1">
                      <Hammer className="w-3 h-3 text-amber-500" /> Area {newArea} Crane Controls
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const assocBay = getBayForArea(newArea);
                        const bayLetters: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E", "6": "F", "7": "G" };
                        const letter = bayLetters[assocBay] || "A";
                        const areaCranes = cranes.filter(c => c.id.toUpperCase().startsWith(assocBay) || c.id.toUpperCase().startsWith(letter)).map(c => c.id);
                        setSelectedCranes(areaCranes.length > 0 ? areaCranes : [`${letter}1`, `${letter}2`]);
                      }}
                      className="text-[9px] font-mono text-amber-700 underline font-bold hover:text-amber-900 cursor-pointer"
                    >
                      Auto-Assign Area {newArea} Controls
                    </button>
                  </div>
                  <div className="border-2 border-[#141414] rounded-sm p-3 max-h-40 overflow-y-auto grid grid-cols-2 gap-2 bg-zinc-50">
                    {cranes.map((c) => {
                      const isChecked = selectedCranes.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCraneSelection(c.id, "create")}
                          className={`p-1.5 border-2 rounded-sm text-center font-black uppercase text-[10px] cursor-pointer active:translate-y-[1px] transition-all ${
                            isChecked
                              ? "bg-amber-500 border-slate-900 text-slate-950"
                              : "bg-white border-zinc-300 text-zinc-600 hover:border-[#141414]"
                          }`}
                        >
                          🏗️ Crane {c.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 border-2 border-[#141414] text-slate-950 rounded-sm font-sans font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#141414] transition-all active:translate-y-[1px] cursor-pointer"
                >
                  Create Supervisor Account
                </button>
              </form>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
