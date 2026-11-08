import React from "react";
import { Users, Armchair } from "lucide-react";

export type TableShapeType = "SQUARE" | "ROUND" | "RECT" | "RECTANGLE" | "BOOTH" | "LONG" | string;
export type TableStatusType = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLING" | "DIRTY" | string;

export interface TableChairsVisualProps {
  label: string;
  shape: TableShapeType;
  capacity: number; // e.g., 4 for 4-seater, 6 for 6-seater, or custom N
  status?: TableStatusType;
  occupiedSeats?: number[]; // list of occupied seat numbers (1-indexed)
  selectedChair?: number | null;
  onChairClick?: (chairNumber: number) => void;
  onTableClick?: () => void;
  isSelected?: boolean;
  size?: "sm" | "md" | "lg";
  showChairLabels?: boolean;
  className?: string;
}

interface ChairPosition {
  seatNumber: number;
  xPct: number; // 0 to 100% relative to container
  yPct: number; // 0 to 100% relative to container
  side: "top" | "bottom" | "left" | "right" | "radial";
  rotationDeg: number;
}

/**
 * Calculates perimeter docking coordinates for chairs around the table.
 */
function calculateChairPositions(
  capacity: number,
  shape: TableShapeType,
  isRound: boolean
): ChairPosition[] {
  const count = Math.max(1, capacity);
  const positions: ChairPosition[] = [];

  if (isRound) {
    // Distribute chairs evenly around the circle perimeter
    for (let i = 0; i < count; i++) {
      // Start from top (-90 degrees)
      const angleRad = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const radiusPct = 42; // distance from center (50, 50)
      const xPct = 50 + radiusPct * Math.cos(angleRad);
      const yPct = 50 + radiusPct * Math.sin(angleRad);
      const rotationDeg = (angleRad * 180) / Math.PI + 90;

      positions.push({
        seatNumber: i + 1,
        xPct,
        yPct,
        side: "radial",
        rotationDeg,
      });
    }
    return positions;
  }

  const isRect =
    shape.toUpperCase().includes("RECT") ||
    shape.toUpperCase().includes("LONG") ||
    shape.toUpperCase().includes("BOOTH");

  if (count === 2) {
    // 2-Seater: 1 Top, 1 Bottom (or left/right for rect)
    positions.push({ seatNumber: 1, xPct: 50, yPct: 8, side: "top", rotationDeg: 0 });
    positions.push({ seatNumber: 2, xPct: 50, yPct: 92, side: "bottom", rotationDeg: 180 });
    return positions;
  }

  if (count === 4) {
    if (isRect) {
      // 4-Seater Rectangular: 2 Top, 2 Bottom
      positions.push({ seatNumber: 1, xPct: 30, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 70, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 3, xPct: 30, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 4, xPct: 70, yPct: 92, side: "bottom", rotationDeg: 180 });
    } else {
      // 4-Seater Square: 1 Top, 1 Right, 1 Bottom, 1 Left
      positions.push({ seatNumber: 1, xPct: 50, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 92, yPct: 50, side: "right", rotationDeg: 90 });
      positions.push({ seatNumber: 3, xPct: 50, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 4, xPct: 8, yPct: 50, side: "left", rotationDeg: 270 });
    }
    return positions;
  }

  if (count === 6) {
    if (isRect) {
      // 6-Seater Rectangular: 3 Top, 3 Bottom
      positions.push({ seatNumber: 1, xPct: 22, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 50, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 3, xPct: 78, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 4, xPct: 22, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 5, xPct: 50, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 6, xPct: 78, yPct: 92, side: "bottom", rotationDeg: 180 });
    } else {
      // 6-Seater Square: 2 Top, 1 Right, 2 Bottom, 1 Left
      positions.push({ seatNumber: 1, xPct: 32, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 68, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 3, xPct: 92, yPct: 50, side: "right", rotationDeg: 90 });
      positions.push({ seatNumber: 4, xPct: 68, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 5, xPct: 32, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 6, xPct: 8, yPct: 50, side: "left", rotationDeg: 270 });
    }
    return positions;
  }

  if (count === 8) {
    if (isRect) {
      // 8-Seater Rectangular: 3 Top, 1 Right, 3 Bottom, 1 Left
      positions.push({ seatNumber: 1, xPct: 25, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 50, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 3, xPct: 75, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 4, xPct: 93, yPct: 50, side: "right", rotationDeg: 90 });
      positions.push({ seatNumber: 5, xPct: 75, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 6, xPct: 50, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 7, xPct: 25, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 8, xPct: 7, yPct: 50, side: "left", rotationDeg: 270 });
    } else {
      // 8-Seater Square: 2 on each of 4 sides
      positions.push({ seatNumber: 1, xPct: 32, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 2, xPct: 68, yPct: 8, side: "top", rotationDeg: 0 });
      positions.push({ seatNumber: 3, xPct: 92, yPct: 32, side: "right", rotationDeg: 90 });
      positions.push({ seatNumber: 4, xPct: 92, yPct: 68, side: "right", rotationDeg: 90 });
      positions.push({ seatNumber: 5, xPct: 68, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 6, xPct: 32, yPct: 92, side: "bottom", rotationDeg: 180 });
      positions.push({ seatNumber: 7, xPct: 8, yPct: 68, side: "left", rotationDeg: 270 });
      positions.push({ seatNumber: 8, xPct: 8, yPct: 32, side: "left", rotationDeg: 270 });
    }
    return positions;
  }

  // Custom N seats: distribute across Top, Right, Bottom, Left perimeter
  const topCount = Math.ceil(count / 4);
  const bottomCount = Math.floor(count / 4);
  const sideRemaining = count - topCount - bottomCount;
  const rightCount = Math.ceil(sideRemaining / 2);
  const leftCount = Math.floor(sideRemaining / 2);

  let currentSeat = 1;

  // Top side
  for (let i = 0; i < topCount; i++) {
    const xPct = ((i + 1) * 100) / (topCount + 1);
    positions.push({
      seatNumber: currentSeat++,
      xPct,
      yPct: 8,
      side: "top",
      rotationDeg: 0,
    });
  }

  // Right side
  for (let i = 0; i < rightCount; i++) {
    const yPct = ((i + 1) * 100) / (rightCount + 1);
    positions.push({
      seatNumber: currentSeat++,
      xPct: 92,
      yPct,
      side: "right",
      rotationDeg: 90,
    });
  }

  // Bottom side
  for (let i = 0; i < bottomCount; i++) {
    const xPct = 100 - ((i + 1) * 100) / (bottomCount + 1);
    positions.push({
      seatNumber: currentSeat++,
      xPct,
      yPct: 92,
      side: "bottom",
      rotationDeg: 180,
    });
  }

  // Left side
  for (let i = 0; i < leftCount; i++) {
    const yPct = 100 - ((i + 1) * 100) / (leftCount + 1);
    positions.push({
      seatNumber: currentSeat++,
      xPct: 8,
      yPct,
      side: "left",
      rotationDeg: 270,
    });
  }

  return positions;
}

export const TableChairsVisual: React.FC<TableChairsVisualProps> = ({
  label,
  shape,
  capacity,
  status = "AVAILABLE",
  occupiedSeats = [],
  selectedChair = null,
  onChairClick,
  onTableClick,
  isSelected = false,
  size = "md",
  showChairLabels = true,
  className = "",
}) => {
  const normShape = (shape || "SQUARE").toUpperCase();
  const isRound = normShape === "ROUND";
  const isRect =
    normShape.includes("RECT") || normShape.includes("LONG") || normShape.includes("BOOTH");

  const chairPositions = calculateChairPositions(capacity, normShape, isRound);

  // Status visual themes
  const statusConfig: Record<
    string,
    {
      tableBg: string;
      tableBorder: string;
      chairFree: string;
      chairOccupied: string;
      badge: string;
    }
  > = {
    AVAILABLE: {
      tableBg: "bg-emerald-500/10 dark:bg-emerald-950/20",
      tableBorder: "border-emerald-500/50",
      chairFree:
        "border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      chairOccupied: "border-emerald-600 bg-emerald-600 text-white",
      badge: "text-emerald-700 dark:text-emerald-300",
    },
    OCCUPIED: {
      tableBg: "bg-blue-500/10 dark:bg-blue-950/20",
      tableBorder: "border-blue-500/50",
      chairFree:
        "border-blue-500/40 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
      chairOccupied: "border-blue-600 bg-blue-600 text-white",
      badge: "text-blue-700 dark:text-blue-300",
    },
    RESERVED: {
      tableBg: "bg-purple-500/10 dark:bg-purple-950/20",
      tableBorder: "border-purple-500/50",
      chairFree:
        "border-purple-500/40 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
      chairOccupied: "border-purple-600 bg-purple-600 text-white",
      badge: "text-purple-700 dark:text-purple-300",
    },
    BILLING: {
      tableBg: "bg-amber-500/10 dark:bg-amber-950/20",
      tableBorder: "border-amber-500/50",
      chairFree:
        "border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      chairOccupied: "border-amber-600 bg-amber-600 text-white",
      badge: "text-amber-700 dark:text-amber-400",
    },
    DIRTY: {
      tableBg: "bg-slate-500/10 dark:bg-slate-900/40",
      tableBorder: "border-slate-500/50",
      chairFree:
        "border-slate-400/40 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      chairOccupied: "border-slate-600 bg-slate-600 text-white",
      badge: "text-slate-700 dark:text-slate-300",
    },
  };

  const currentTheme = statusConfig[status.toUpperCase()] || statusConfig.AVAILABLE;

  // Size scalers
  const sizeStyles = {
    sm: {
      container: isRect ? "w-36 h-28" : "w-28 h-28",
      table: isRect ? "w-20 h-14" : "w-14 h-14",
      chair: "w-5 h-5 text-[9px]",
      label: "text-xs",
      subLabel: "text-[9px]",
    },
    md: {
      container: isRect ? "w-48 h-36" : "w-36 h-36",
      table: isRect ? "w-28 h-18" : "w-20 h-20",
      chair: "w-6 h-6 text-[10px]",
      label: "text-sm",
      subLabel: "text-[10px]",
    },
    lg: {
      container: isRect ? "w-60 h-44" : "w-44 h-44",
      table: isRect ? "w-36 h-24" : "w-24 h-24",
      chair: "w-7 h-7 text-xs",
      label: "text-base",
      subLabel: "text-xs",
    },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${sizeStyles.container} ${className}`}
      data-testid={`table-visual-${label}`}
    >
      {/* Central Table Surface */}
      <button
        type="button"
        onClick={onTableClick}
        aria-label={`Table ${label}, ${capacity} seats, ${status}`}
        className={`relative z-10 flex flex-col items-center justify-center border-2 transition-all cursor-pointer ${
          sizeStyles.table
        } ${isRound ? "rounded-full" : isRect ? "rounded-xl" : "rounded-2xl"} ${
          currentTheme.tableBg
        } ${currentTheme.tableBorder} ${
          isSelected
            ? "ring-4 ring-[#FF6A00]/50 shadow-lg scale-105"
            : "hover:scale-102 hover:shadow-md"
        }`}
      >
        <span className={`font-mono font-black text-foreground ${sizeStyles.label}`}>{label}</span>
        <div className="flex items-center gap-1 text-muted-foreground font-semibold">
          <Users className="w-2.5 h-2.5" />
          <span className={sizeStyles.subLabel}>{capacity}</span>
        </div>
      </button>

      {/* Docked Perimeter Chairs */}
      {chairPositions.map((pos) => {
        const isOccupied =
          occupiedSeats.includes(pos.seatNumber) ||
          (status.toUpperCase() === "OCCUPIED" && occupiedSeats.length === 0);
        const isChairSelected = selectedChair === pos.seatNumber;

        return (
          <button
            key={pos.seatNumber}
            type="button"
            aria-label={`Seat ${pos.seatNumber} (${isOccupied ? "Occupied" : "Available"})`}
            title={`Seat ${pos.seatNumber}: ${isOccupied ? "Occupied" : "Available"}`}
            onClick={(e) => {
              e.stopPropagation();
              onChairClick?.(pos.seatNumber);
            }}
            style={{
              position: "absolute",
              left: `${pos.xPct}%`,
              top: `${pos.yPct}%`,
              transform: "translate(-50%, -50%)",
            }}
            className={`z-20 flex items-center justify-center font-bold rounded-full border shadow-xs transition-all ${
              sizeStyles.chair
            } ${
              isChairSelected
                ? "ring-2 ring-[#FF6A00] ring-offset-1 scale-125 z-30 font-black"
                : "hover:scale-115"
            } ${
              isOccupied ? currentTheme.chairOccupied : currentTheme.chairFree
            } ${onChairClick ? "cursor-pointer" : "cursor-default"}`}
          >
            {showChairLabels ? <span>{pos.seatNumber}</span> : <Armchair className="w-2.5 h-2.5" />}
          </button>
        );
      })}
    </div>
  );
};
