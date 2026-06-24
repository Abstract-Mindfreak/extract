import React, { useRef, useEffect } from "react";
import { Crosshair } from "lucide-react";

export function XYPad({ x, y, onChange }: { x: number, y: number, onChange: (x: number, y: number) => void }) {
  const padRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    updatePosition(e);
    window.addEventListener("mousemove", handleGlobalMove);
    window.addEventListener("mouseup", handleGlobalUp);
    window.addEventListener("touchmove", handleGlobalMove);
    window.addEventListener("touchend", handleGlobalUp);
  };

  const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
    updatePosition(e);
  };

  const handleGlobalUp = () => {
    window.removeEventListener("mousemove", handleGlobalMove);
    window.removeEventListener("mouseup", handleGlobalUp);
    window.removeEventListener("touchmove", handleGlobalMove);
    window.removeEventListener("touchend", handleGlobalUp);
  };

  const updatePosition = (e: any) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const newX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newY = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(newX, newY);
  };

  return (
    <div className="bg-[#2b2b2b] border border-[#404040] p-3 rounded-sm flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold text-[#888] uppercase flex items-center gap-1">
          <Crosshair size={10} /> Spatial Vector Map
        </span>
        <span className="text-[8px] text-[#555]">X: {x.toFixed(2)} Y: {y.toFixed(2)}</span>
      </div>
      
      <div 
        ref={padRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        className="relative flex-1 min-h-[140px] bg-[#1a1a1a] border border-[#222] rounded-sm cursor-crosshair overflow-hidden"
      >
        {/* Grid lines */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="w-full h-px bg-white absolute top-1/2" />
          <div className="h-full w-px bg-white absolute left-1/2" />
        </div>

        {/* Handle */}
        <div 
          className="absolute w-3 h-3 border-2 border-[#ffcc00] rounded-full -translate-x-1/2 translate-y-1/2 pointer-events-none shadow-[0_0_8px_rgba(255,204,0,0.5)]"
          style={{ 
            left: `${x * 100}%`, 
            bottom: `${y * 100}%` 
          }}
        />
      </div>
      <div className="flex justify-between text-[8px] text-[#555] uppercase">
        <span>Resonance</span>
        <span>Complexity</span>
      </div>
    </div>
  );
}