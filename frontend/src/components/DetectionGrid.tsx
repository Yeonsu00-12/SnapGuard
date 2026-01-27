"use client";

import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";

interface DetectionGridProps {
  rows?: number;
  cols?: number;
  initialGrid?: boolean[][];
  snapshotUrl?: string;
  sensitivity?: number;
  onGridChange?: (grid: boolean[][]) => void;
  onSensitivityChange?: (sensitivity: number) => void;
  disabled?: boolean;
}

export default function DetectionGrid({
  rows = 15,
  cols = 22,
  initialGrid,
  snapshotUrl,
  sensitivity = 60,
  onGridChange,
  onSensitivityChange,
  disabled = false,
}: DetectionGridProps) {
  // 그리드 초기화 (모두 true로 시작)
  const initGrid = useCallback(() => {
    if (initialGrid) return initialGrid;
    return Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(true));
  }, [initialGrid, rows, cols]);

  const [grid, setGrid] = useState<boolean[][]>(initGrid);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<"add" | "remove">("add");
  const [localSensitivity, setLocalSensitivity] = useState(sensitivity);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialGrid) {
      setGrid(initialGrid);
    }
  }, [initialGrid]);

  // 셀 토글
  const toggleCell = useCallback(
    (row: number, col: number, mode?: "add" | "remove") => {
      if (disabled) return;

      setGrid((prev) => {
        const newGrid = prev.map((r) => [...r]);
        const targetMode = mode || drawMode;
        newGrid[row][col] = targetMode === "add";
        onGridChange?.(newGrid);
        return newGrid;
      });
    },
    [disabled, drawMode, onGridChange]
  );

  // 마우스 이벤트
  const handleMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      // 현재 셀 상태에 따라 모드 결정
      const mode = grid[row][col] ? "remove" : "add";
      setDrawMode(mode);
      setIsDrawing(true);
      toggleCell(row, col, mode);
    },
    [disabled, grid, toggleCell]
  );

  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (isDrawing && !disabled) {
        toggleCell(row, col, drawMode);
      }
    },
    [isDrawing, disabled, drawMode, toggleCell]
  );

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // 터치 이벤트
  const handleTouchStart = useCallback(
    (row: number, col: number, e: React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      const mode = grid[row][col] ? "remove" : "add";
      setDrawMode(mode);
      setIsDrawing(true);
      toggleCell(row, col, mode);
    },
    [disabled, grid, toggleCell]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDrawing || disabled || !gridRef.current) return;

      const touch = e.touches[0];
      const rect = gridRef.current.getBoundingClientRect();
      const cellWidth = rect.width / cols;
      const cellHeight = rect.height / rows;

      const col = Math.floor((touch.clientX - rect.left) / cellWidth);
      const row = Math.floor((touch.clientY - rect.top) / cellHeight);

      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        toggleCell(row, col, drawMode);
      }
    },
    [isDrawing, disabled, cols, rows, drawMode, toggleCell]
  );

  // 전체 선택/해제
  const selectAll = () => {
    if (disabled) return;
    const newGrid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(true));
    setGrid(newGrid);
    onGridChange?.(newGrid);
  };

  const clearAll = () => {
    if (disabled) return;
    const newGrid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    setGrid(newGrid);
    onGridChange?.(newGrid);
  };

  // 민감도 변경
  const handleSensitivityChange = (value: number) => {
    setLocalSensitivity(value);
    onSensitivityChange?.(value);
  };

  return (
    <div className="space-y-4">
      {/* 스냅샷 + 그리드 오버레이 */}
      <div className="relative rounded-2xl overflow-hidden bg-black">
        {/* 스냅샷 배경 */}
        {snapshotUrl ? (
          <Image
            src={snapshotUrl}
            alt="Camera snapshot"
            className="w-full aspect-video object-cover opacity-70"
            width={400}
            height={400}
          />
        ) : (
          <div className="w-full aspect-video bg-slate-800 flex items-center justify-center">
            <p className="text-slate-500 text-sm">No snapshot available</p>
          </div>
        )}

        {/* 그리드 오버레이 */}
        <div
          ref={gridRef}
          className="absolute inset-0 grid select-none"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchEnd={handleMouseUp}
          onTouchMove={handleTouchMove}
        >
          {grid.map((row, rowIdx) =>
            row.map((cell, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`border border-white/20 cursor-pointer transition-colors ${
                  cell
                    ? "bg-blue-500/50 hover:bg-blue-500/70"
                    : "bg-transparent hover:bg-white/10"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                onMouseDown={(e) => handleMouseDown(rowIdx, colIdx, e)}
                onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                onTouchStart={(e) => handleTouchStart(rowIdx, colIdx, e)}
              />
            ))
          )}
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={disabled}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            전체 선택
          </button>
          <button
            onClick={clearAll}
            disabled={disabled}
            className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors disabled:opacity-50"
          >
            전체 해제
          </button>
        </div>

        {/* 민감도 조절 */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500">민감도</label>
          <input
            type="range"
            min="0"
            max="100"
            value={localSensitivity}
            onChange={(e) => handleSensitivityChange(parseInt(e.target.value))}
            disabled={disabled}
            className="w-24 accent-blue-600"
          />
          <span className="text-sm font-bold text-slate-700 w-8">
            {localSensitivity}
          </span>
        </div>
      </div>

      {/* 안내 */}
      <p className="text-xs text-slate-400 text-center">
        파란색 영역에서만 움직임이 감지됩니다. 드래그하여 영역을 지정하세요.
      </p>
    </div>
  );
}
