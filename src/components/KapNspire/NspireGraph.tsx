import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Plus, Trash2, 
  Activity, Crosshair, Table as TableIcon, Layers, Settings2, Sliders
} from "lucide-react";
import { create, all } from "mathjs";
import KaTeXView from "./KaTeXView";
import { exprToLatex } from "../../utils/useNspireEngine";

const math = create(all, {});

export interface GraphFunction {
  id: string;
  name: string;
  expr: string;
  color: string;
  visible: boolean;
  isValid: boolean;
}

const DEFAULT_COLORS = [
  "#2563eb", // Blue (TI standard)
  "#db2777", // Magenta / Pink
  "#059669", // Emerald Green
  "#d97706", // Amber / Orange
  "#7c3aed", // Purple
  "#dc2626", // Red
];

interface AnalysisResult {
  type: "root" | "min" | "max" | "intersection" | "integral" | "tangent";
  label: string;
  x: number;
  y: number;
  secondaryVal?: number;
}

export default function NspireGraph() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Functions list
  const [functions, setFunctions] = useState<GraphFunction[]>([
    { id: "f1", name: "f1(x)", expr: "x^2 - 4", color: "#2563eb", visible: true, isValid: true },
    { id: "f2", name: "f2(x)", expr: "2 * sin(x)", color: "#db2777", visible: true, isValid: true },
  ]);

  // Window bounds (Cartesian plane)
  const [bounds, setBounds] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -6.5,
    yMax: 6.5,
  });

  // Graph interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; mathX: number; mathY: number } | null>(null);
  const [traceMode, setTraceMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"graph" | "table" | "analysis">("graph");

  // Analysis tool state
  const [selectedAnalysis, setSelectedAnalysis] = useState<"roots" | "extrema" | "intersections" | "integral" | null>(null);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [integralRange, setIntegralRange] = useState<{ a: number; b: number; fnId: string }>({ a: -2, b: 2, fnId: "f1" });

  // Table parameters
  const [tableStart, setTableStart] = useState<number>(-5);
  const [tableStep, setTableStep] = useState<number>(1);
  const [tableRowsCount] = useState<number>(21);

  // Compile math functions
  const compiledFunctions = useMemo(() => {
    return functions.map((f) => {
      if (!f.visible || !f.expr.trim()) return { ...f, fn: null };
      try {
        let clean = f.expr
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/π/g, "pi")
          .replace(/θ/g, "theta")
          .replace(/√\(([^)]+)\)/g, "sqrt($1)")
          .replace(/√([0-9a-zA-Z]+)/g, "sqrt($1)");
        const compiled = math.compile(clean);
        return {
          ...f,
          fn: (x: number) => {
            try {
              const res = compiled.evaluate({ x, pi: Math.PI, e: Math.E });
              return typeof res === "number" && Number.isFinite(res) ? res : NaN;
            } catch {
              return NaN;
            }
          },
        };
      } catch {
        return { ...f, fn: null };
      }
    });
  }, [functions]);

  // Coordinate transformations
  const mathToScreen = useCallback((x: number, y: number, width: number, height: number) => {
    const sx = ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
    const sy = height - ((y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * height;
    return { x: sx, y: sy };
  }, [bounds]);

  const screenToMath = useCallback((sx: number, sy: number, width: number, height: number) => {
    const mx = bounds.xMin + (sx / width) * (bounds.xMax - bounds.xMin);
    const my = bounds.yMin + ((height - sy) / height) * (bounds.yMax - bounds.yMin);
    return { x: mx, y: my };
  }, [bounds]);

  // Redraw Cartesian plane
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background (TI-Nspire Clean LCD White / Dark Grid)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Grid lines
    const xSpan = bounds.xMax - bounds.xMin;
    const ySpan = bounds.yMax - bounds.yMin;

    // Determine nice step intervals
    const getGridStep = (span: number) => {
      const raw = span / 10;
      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
      const rel = raw / magnitude;
      if (rel < 1.5) return magnitude;
      if (rel < 3.5) return 2 * magnitude;
      if (rel < 7.5) return 5 * magnitude;
      return 10 * magnitude;
    };

    const xStep = getGridStep(xSpan);
    const yStep = getGridStep(ySpan);

    // Draw secondary light grid
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;

    const startX = Math.floor(bounds.xMin / xStep) * xStep;
    for (let x = startX; x <= bounds.xMax; x += xStep) {
      const { x: sx } = mathToScreen(x, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
      ctx.stroke();
    }

    const startY = Math.floor(bounds.yMin / yStep) * yStep;
    for (let y = startY; y <= bounds.yMax; y += yStep) {
      const { y: sy } = mathToScreen(0, y, width, height);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
      ctx.stroke();
    }

    // 3. Axes X and Y
    const origin = mathToScreen(0, 0, width, height);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;

    // X Axis
    if (origin.y >= 0 && origin.y <= height) {
      ctx.beginPath();
      ctx.moveTo(0, origin.y);
      ctx.lineTo(width, origin.y);
      ctx.stroke();
    }

    // Y Axis
    if (origin.x >= 0 && origin.x <= width) {
      ctx.beginPath();
      ctx.moveTo(origin.x, 0);
      ctx.lineTo(origin.x, height);
      ctx.stroke();
    }

    // 4. Axis Tick Numbers
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let x = startX; x <= bounds.xMax; x += xStep) {
      if (Math.abs(x) < 1e-9) continue;
      const { x: sx } = mathToScreen(x, 0, width, height);
      const labelY = Math.min(Math.max(origin.y + 4, 4), height - 16);
      ctx.fillText(Number(x.toFixed(4)).toString(), sx, labelY);
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = startY; y <= bounds.yMax; y += yStep) {
      if (Math.abs(y) < 1e-9) continue;
      const { y: sy } = mathToScreen(0, y, width, height);
      const labelX = Math.min(Math.max(origin.x - 4, 30), width - 4);
      ctx.fillText(Number(y.toFixed(4)).toString(), labelX, sy);
    }

    // 5. Integral Shading (if selected)
    if (selectedAnalysis === "integral") {
      const targetFn = compiledFunctions.find((f) => f.id === integralRange.fnId)?.fn;
      if (targetFn) {
        ctx.fillStyle = "rgba(37, 99, 235, 0.2)";
        ctx.beginPath();
        const basePt = mathToScreen(integralRange.a, 0, width, height);
        ctx.moveTo(basePt.x, basePt.y);

        const intStep = (integralRange.b - integralRange.a) / 100;
        for (let ix = integralRange.a; ix <= integralRange.b; ix += intStep) {
          const iy = targetFn(ix);
          if (!isNaN(iy)) {
            const pt = mathToScreen(ix, iy, width, height);
            ctx.lineTo(pt.x, pt.y);
          }
        }
        const endPt = mathToScreen(integralRange.b, 0, width, height);
        ctx.lineTo(endPt.x, endPt.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 6. Plot Active Curves
    compiledFunctions.forEach((item) => {
      if (!item.fn || !item.visible) return;

      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      const numSamples = width * 1.5;
      const step = xSpan / numSamples;
      let isFirst = true;

      for (let i = 0; i <= numSamples; i++) {
        const mx = bounds.xMin + i * step;
        const my = item.fn(mx);

        if (isNaN(my) || !Number.isFinite(my)) {
          isFirst = true;
          continue;
        }

        // Clip excessive vertical asymptotes
        if (my > bounds.yMax * 4 || my < bounds.yMin * 4) {
          isFirst = true;
          continue;
        }

        const { x: sx, y: sy } = mathToScreen(mx, my, width, height);
        if (isFirst) {
          ctx.moveTo(sx, sy);
          isFirst = false;
        } else {
          ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    });

    // 7. Draw Analysis Result Pins (Roots, Extrema, Intersections)
    analysisResults.forEach((res) => {
      const pt = mathToScreen(res.x, res.y, width, height);
      if (pt.x < 0 || pt.x > width || pt.y < 0 || pt.y > height) return;

      ctx.fillStyle = res.type === "root" ? "#16a34a" : res.type === "intersection" ? "#dc2626" : "#d97706";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Tooltip pill
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.font = "bold 10px monospace";
      const text = `${res.label}: (${res.x.toFixed(2)}, ${res.y.toFixed(2)})`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(pt.x + 8, pt.y - 18, textWidth + 8, 16);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, pt.x + 12, pt.y - 10);
    });

    // 8. Trace / Hover Cursor Crosshair
    if (mousePos && traceMode) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.6)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, 0);
      ctx.lineTo(mousePos.x, height);
      ctx.stroke();

      // Find function values at mousePos.mathX
      compiledFunctions.forEach((cf) => {
        if (cf.fn && cf.visible) {
          const valY = cf.fn(mousePos.mathX);
          if (!isNaN(valY)) {
            const pt = mathToScreen(mousePos.mathX, valY, width, height);
            ctx.fillStyle = cf.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Value badge
            ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
            const readout = `${cf.name}: ${valY.toFixed(3)}`;
            ctx.font = "10px monospace";
            ctx.fillRect(pt.x + 6, pt.y - 12, ctx.measureText(readout).width + 6, 14);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(readout, pt.x + 9, pt.y - 3);
          }
        }
      });
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [bounds, compiledFunctions, analysisResults, mousePos, traceMode, selectedAnalysis, integralRange, mathToScreen]);

  // Trigger render on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => renderCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderCanvas]);

  // Zoom controls
  const handleZoom = (factor: number) => {
    setBounds((prev) => {
      const cx = (prev.xMin + prev.xMax) / 2;
      const cy = (prev.yMin + prev.yMax) / 2;
      const halfW = ((prev.xMax - prev.xMin) * factor) / 2;
      const halfH = ((prev.yMax - prev.yMin) * factor) / 2;
      return {
        xMin: cx - halfW,
        xMax: cx + halfW,
        yMin: cy - halfH,
        yMax: cy + halfH,
      };
    });
  };

  const resetView = () => {
    setBounds({ xMin: -10, xMax: 10, yMin: -6.5, yMax: 6.5 });
    setAnalysisResults([]);
    setSelectedAnalysis(null);
  };

  // Mouse pan & drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mathCoords = screenToMath(sx, sy, rect.width, rect.height);

    setMousePos({ x: sx, y: sy, mathX: mathCoords.x, mathY: mathCoords.y });

    if (isDragging && dragStart) {
      const dxPixels = e.clientX - dragStart.x;
      const dyPixels = e.clientY - dragStart.y;

      const dxMath = (dxPixels / rect.width) * (bounds.xMax - bounds.xMin);
      const dyMath = (dyPixels / rect.height) * (bounds.yMax - bounds.yMin);

      setBounds((prev) => ({
        xMin: prev.xMin - dxMath,
        xMax: prev.xMax - dxMath,
        yMin: prev.yMin + dyMath,
        yMax: prev.yMax + dyMath,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.9 : 1.1;
    handleZoom(factor);
  };

  // Function list modifiers
  const addFunction = () => {
    if (functions.length >= 6) return;
    const nextIdx = functions.length + 1;
    const color = DEFAULT_COLORS[functions.length % DEFAULT_COLORS.length];
    setFunctions((prev) => [
      ...prev,
      {
        id: `f${Date.now()}`,
        name: `f${nextIdx}(x)`,
        expr: "",
        color,
        visible: true,
        isValid: true,
      },
    ]);
  };

  const updateFunctionExpr = (id: string, expr: string) => {
    setFunctions((prev) =>
      prev.map((f) => (f.id === id ? { ...f, expr } : f))
    );
  };

  const toggleFunctionVisibility = (id: string) => {
    setFunctions((prev) =>
      prev.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f))
    );
  };

  const removeFunction = (id: string) => {
    if (functions.length <= 1) return;
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  };

  // Mathematical Analysis Calculations (Roots, Extrema, Intersections)
  const runAnalysis = (type: "roots" | "extrema" | "intersections") => {
    setSelectedAnalysis(type);
    const active = compiledFunctions.filter((f) => f.fn && f.visible);
    if (active.length === 0) return;

    const results: AnalysisResult[] = [];
    const samples = 400;
    const step = (bounds.xMax - bounds.xMin) / samples;

    if (type === "roots") {
      active.forEach((cf) => {
        if (!cf.fn) return;
        for (let i = 0; i < samples; i++) {
          const x1 = bounds.xMin + i * step;
          const x2 = x1 + step;
          const y1 = cf.fn(x1);
          const y2 = cf.fn(x2);

          if (!isNaN(y1) && !isNaN(y2) && y1 * y2 <= 0) {
            // Linear interpolation root approximation
            const rootX = x1 - y1 * ((x2 - x1) / (y2 - y1));
            results.push({
              type: "root",
              label: `Zero (${cf.name})`,
              x: Number(rootX.toFixed(4)),
              y: 0,
            });
          }
        }
      });
    } else if (type === "extrema") {
      active.forEach((cf) => {
        if (!cf.fn) return;
        for (let i = 1; i < samples - 1; i++) {
          const x0 = bounds.xMin + (i - 1) * step;
          const x1 = bounds.xMin + i * step;
          const x2 = bounds.xMin + (i + 1) * step;
          const y0 = cf.fn(x0);
          const y1 = cf.fn(x1);
          const y2 = cf.fn(x2);

          if (!isNaN(y0) && !isNaN(y1) && !isNaN(y2)) {
            if (y1 > y0 && y1 > y2) {
              results.push({
                type: "max",
                label: `Max (${cf.name})`,
                x: Number(x1.toFixed(4)),
                y: Number(y1.toFixed(4)),
              });
            } else if (y1 < y0 && y1 < y2) {
              results.push({
                type: "min",
                label: `Min (${cf.name})`,
                x: Number(x1.toFixed(4)),
                y: Number(y1.toFixed(4)),
              });
            }
          }
        }
      });
    } else if (type === "intersections") {
      if (active.length >= 2) {
        const fnA = active[0].fn;
        const fnB = active[1].fn;
        if (fnA && fnB) {
          for (let i = 0; i < samples; i++) {
            const x1 = bounds.xMin + i * step;
            const x2 = x1 + step;
            const diff1 = fnA(x1) - fnB(x1);
            const diff2 = fnA(x2) - fnB(x2);

            if (!isNaN(diff1) && !isNaN(diff2) && diff1 * diff2 <= 0) {
              const rootX = x1 - diff1 * ((x2 - x1) / (diff2 - diff1));
              const rootY = fnA(rootX);
              results.push({
                type: "intersection",
                label: "Intersect",
                x: Number(rootX.toFixed(4)),
                y: Number(rootY.toFixed(4)),
              });
            }
          }
        }
      }
    }

    setAnalysisResults(results);
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden select-none">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "graph" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Layers size={14} /> Grafik
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "table" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <TableIcon size={14} /> Tablo
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "analysis" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Activity size={14} /> Analiz (CAS)
          </button>
        </div>

        {/* Zoom & View Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTraceMode(!traceMode)}
            title="İzleme Modu (Trace)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              traceMode ? "bg-amber-500 text-slate-900 font-bold" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            <Crosshair size={15} />
          </button>
          <button
            onClick={() => handleZoom(0.8)}
            title="Yakınlaştır"
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={() => handleZoom(1.25)}
            title="Uzaklaştır"
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={resetView}
            title="Görünümü Sıfırla"
            className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left/Top Canvas Section */}
        {activeTab === "graph" && (
          <div className="flex-1 relative flex flex-col min-h-[260px] bg-white">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className="w-full h-full cursor-crosshair touch-none"
            />
            {/* Live Coordinate Badge at bottom-left */}
            {mousePos && (
              <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-200 border border-slate-700 pointer-events-none">
                X: <span className="text-blue-400 font-bold">{mousePos.mathX.toFixed(3)}</span> | Y:{" "}
                <span className="text-emerald-400 font-bold">{mousePos.mathY.toFixed(3)}</span>
              </div>
            )}
          </div>
        )}

        {/* Table View Tab */}
        {activeTab === "table" && (
          <div className="flex-1 p-4 bg-slate-900 overflow-y-auto">
            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-slate-800 text-xs">
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Başlangıç:</span>
                <input
                  type="number"
                  value={tableStart}
                  onChange={(e) => setTableStart(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-slate-800 rounded border border-slate-700 text-white font-mono"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-slate-400">Adım (Δx):</span>
                <input
                  type="number"
                  step="0.1"
                  value={tableStep}
                  onChange={(e) => setTableStep(Math.max(0.01, Number(e.target.value)))}
                  className="w-16 px-2 py-1 bg-slate-800 rounded border border-slate-700 text-white font-mono"
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
                    <th className="p-2.5 border-r border-slate-700 text-center">x</th>
                    {compiledFunctions
                      .filter((f) => f.visible)
                      .map((f) => (
                        <th key={f.id} className="p-2.5 border-r border-slate-700" style={{ color: f.color }}>
                          {f.name}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: tableRowsCount }).map((_, idx) => {
                    const xVal = tableStart + idx * tableStep;
                    return (
                      <tr key={idx} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                        <td className="p-2 border-r border-slate-800 text-center font-bold text-slate-400">
                          {xVal.toFixed(2)}
                        </td>
                        {compiledFunctions
                          .filter((f) => f.visible)
                          .map((f) => {
                            const yVal = f.fn ? f.fn(xVal) : NaN;
                            return (
                              <td key={f.id} className="p-2 border-r border-slate-800 text-slate-200">
                                {isNaN(yVal) ? <span className="text-red-400">und</span> : yVal.toFixed(4)}
                              </td>
                            );
                          })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analysis Tab (CAS Tools) */}
        {activeTab === "analysis" && (
          <div className="flex-1 p-4 bg-slate-900 overflow-y-auto space-y-4">
            <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
              <Activity size={16} /> CAS Fonksiyon Analiz Araçları
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => runAnalysis("roots")}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-left transition-all cursor-pointer"
              >
                <div className="font-bold text-xs text-emerald-400">1: Kökleri Bul (Zero)</div>
                <div className="text-[11px] text-slate-400 mt-1">Eksen kestiği sıfır noktalarını hesapla ($f(x) = 0$)</div>
              </button>
              <button
                onClick={() => runAnalysis("extrema")}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-left transition-all cursor-pointer"
              >
                <div className="font-bold text-xs text-amber-400">2: Min / Max Ekstremum</div>
                <div className="text-[11px] text-slate-400 mt-1">Yerel minimum ve maksimum tepe noktaları</div>
              </button>
              <button
                onClick={() => runAnalysis("intersections")}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-left transition-all cursor-pointer"
              >
                <div className="font-bold text-xs text-pink-400">3: Kesişim Noktaları</div>
                <div className="text-[11px] text-slate-400 mt-1">$f_1(x) = f_2(x)$ ortak kesişimler</div>
              </button>
            </div>

            {/* Results Table */}
            {analysisResults.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">Analiz Sonuçları:</h4>
                <div className="space-y-1.5">
                  {analysisResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono p-2 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-slate-300 font-semibold">{r.label}</span>
                      <span className="text-blue-400 font-bold">
                        (x = {r.x.toFixed(4)}, y = {r.y.toFixed(4)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Function Input Sidebar */}
        <div className="w-full md:w-80 bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 p-3 overflow-y-auto space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fonksiyon Listesi</span>
            <button
              onClick={addFunction}
              disabled={functions.length >= 6}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-md flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={12} /> Ekle
            </button>
          </div>

          <div className="space-y-2">
            {functions.map((fnItem, index) => (
              <div
                key={fnItem.id}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fnItem.color }} />
                    <span className="text-xs font-bold text-slate-300">{fnItem.name} =</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleFunctionVisibility(fnItem.id)}
                      className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                      title={fnItem.visible ? "Gizle" : "Göster"}
                    >
                      {fnItem.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    {functions.length > 1 && (
                      <button
                        onClick={() => removeFunction(fnItem.id)}
                        className="p-1 text-slate-400 hover:text-red-400 rounded cursor-pointer"
                        title="Sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="örn: sin(x), x^2 - 4"
                  value={fnItem.expr}
                  onChange={(e) => updateFunctionExpr(fnItem.id, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />

                {fnItem.expr.trim() && (
                  <div className="text-[11px] text-slate-400 overflow-x-auto py-0.5">
                    <KaTeXView math={exprToLatex(fnItem.expr)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
