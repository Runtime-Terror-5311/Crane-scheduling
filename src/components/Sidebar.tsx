import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Home, 
  Compass, 
  Info, 
  FileSpreadsheet, 
  PlusCircle, 
  ShieldAlert, 
  HardHat, 
  LogOut,
  Sliders
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  activePage: "home" | "bay_view" | "crane_specs" | "gantt" | "generate" | "admin";
  setActivePage: (page: "home" | "bay_view" | "crane_specs" | "gantt" | "generate" | "admin") => void;
  onLogout: () => void;
  selectedBay: string;
}

export default function Sidebar({
  isOpen,
  onClose,
  user,
  activePage,
  setActivePage,
  onLogout,
  selectedBay
}: SidebarProps) {
  
  const navItems = [
    {
      id: "home" as const,
      label: "Shift Timetable",
      description: "Scheduled ongoing shift timetable",
      icon: Home
    },
    {
      id: "bay_view" as const,
      label: "Bay Grid View",
      description: `Live spatial grid for Bay ${selectedBay}`,
      icon: Compass
    },
    {
      id: "crane_specs" as const,
      label: "Cranes Specifications",
      description: `All cranes in Bay ${selectedBay}`,
      icon: Info
    },
    {
      id: "gantt" as const,
      label: "Gantt Chart",
      description: "Visual occupancy timeline",
      icon: FileSpreadsheet
    },
    {
      id: "generate" as const,
      label: "Generate Requirements",
      description: "Log new crane requirements",
      icon: PlusCircle
    },
    ...(user.role === "Admin" ? [
      {
        id: "admin" as const,
        label: "Admin Panel",
        description: "Administrative console controls",
        icon: Sliders
      }
    ] : [])
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Black high-contrast glass overlay with fade transition */}
          <motion.div
            id="sidebar_backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 cursor-pointer"
          />

          {/* Sliding Industrial Sidebar Panel */}
          <motion.div
            id="sidebar_panel"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
            className="fixed top-0 bottom-0 left-0 w-[290px] bg-zinc-950 text-white z-50 flex flex-col border-r-4 border-amber-600 shadow-[4px_0px_20px_rgba(0,0,0,0.5)] font-mono"
          >
            {/* Header / Brand */}
            <div className="p-5 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-500 text-slate-950 border border-slate-950 rounded-sm font-black">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tighter text-white uppercase leading-none">
                    CRANE-OPS <span className="text-amber-500">v2.4</span>
                  </h2>
                  <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold tracking-wider">
                    Nav Console
                  </span>
                </div>
              </div>
              
              <button
                id="close_sidebar_btn"
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User operational badge */}
            <div className="p-4 bg-zinc-900/50 border-b border-zinc-800/80 text-[11px]">
              <div className="bg-zinc-900 px-3 py-2 border border-zinc-800 rounded-sm">
                <div className="text-zinc-500 font-extrabold uppercase text-[9px] tracking-wider">OPERATOR IDENTITY:</div>
                <div className="font-black text-white text-xs truncate mt-0.5">{user.name}</div>
                <div className="text-amber-500 text-[10px] font-black uppercase mt-1">
                  {user.role === "Admin" ? "Command Admin" : `Area ${user.area} Lead`}
                </div>
              </div>
            </div>

            {/* Navigation Options List */}
            <nav className="flex-grow p-4 space-y-2.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = activePage === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`nav_btn_${item.id}`}
                    onClick={() => {
                      setActivePage(item.id);
                      onClose();
                    }}
                    className={`w-full text-left p-3 border rounded-sm transition-all flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? "bg-amber-500 border-amber-600 text-slate-950 shadow-[3px_3px_0px_white]"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? "text-slate-950" : "text-amber-500"}`} />
                    <div className="font-sans">
                      <div className="font-black uppercase tracking-tight text-xs leading-snug">{item.label}</div>
                      <div className={`text-[10px] ${isActive ? "text-slate-900/80" : "text-zinc-500"} leading-tight font-medium font-mono mt-0.5`}>
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Footer / Disconnect Action */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 space-y-3">
              <button
                id="sidebar_disconnect_btn"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 hover:border-red-600 rounded-sm font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Terminal
              </button>
              
              <div className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                BAY 01 • SHIFT GATEWAY
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
