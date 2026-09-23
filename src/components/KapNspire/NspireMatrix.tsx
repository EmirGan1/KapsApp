import React, { useState } from "react";
import { create, all } from "mathjs";
import KaTeXView from "./KaTeXView";
import { resultToLatex } from "../../utils/useNspireEngine";

const math = create(all, {});

// Gauss-Jordan RREF helper
function computeRREF(mat: number[][]): number[][] {
  const A = mat.map((row) => [...row]);
  const rows = A.length;
  const cols = A[0].length;
  let lead = 0;

  for (let r = 0; r < rows; r++) {
    if (cols <= lead) break;
    let i = r;
    while (Math.abs(A[i][lead]) < 1e-10) {
      i++;
      if (rows === i) {
        i = r;
        lead++;
        if (cols === lead) return A;
      }
    }

    // Swap rows i and r
    const temp = A[i];
    A[i] = A[r];
    A[r] = temp;

    // Divide row r by A[r][lead]
    const lv = A[r][lead];
    if (Math.abs(lv) > 1e-10) {
      for (let j = 0; j < cols; j++) {
        A[r][j] /= lv;
      }
    }

    // Eliminate other rows
    for (let j = 0; j < rows; j++) {
      if (j !== r) {
        const factor = A[j][lead];
        for (let k = 0; k < cols; k++) {
          A[j][k] -= factor * A[r][k];
        }
      }
    }
    lead++;
  }

  // Clean tiny floating precision values
  return A.map((row) => row.map((val) => (Math.abs(val) < 1e-9 ? 0 : Number(val.toFixed(4)))));
}

export default function NspireMatrix() {
  const [rowsA, setRowsA] = useState(2);
  const [colsA, setColsA] = useState(2);
  const [matrixA, setMatrixA] = useState<number[][]>([
    [1, 2],
    [3, 4],
  ]);

  const [rowsB, setRowsB] = useState(2);
  const [colsB, setColsB] = useState(2);
  const [matrixB, setMatrixB] = useState<number[][]>([
    [5, 6],
    [7, 8],
  ]);

  const [resultLatex, setResultLatex] = useState<string>("");
  const [resultLabel, setResultLabel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const updateMatrixCell = (isA: boolean, r: number, c: number, val: string) => {
    const num = parseFloat(val) || 0;
    if (isA) {
      setMatrixA((prev) => {
        const copy = prev.map((row) => [...row]);
        if (copy[r] && copy[r][c] !== undefined) copy[r][c] = num;
        return copy;
      });
    } else {
      setMatrixB((prev) => {
        const copy = prev.map((row) => [...row]);
        if (copy[r] && copy[r][c] !== undefined) copy[r][c] = num;
        return copy;
      });
    }
  };

  const handleResize = (isA: boolean, newR: number, newC: number) => {
    const rCount = Math.max(1, Math.min(5, newR));
    const cCount = Math.max(1, Math.min(5, newC));

    if (isA) {
      setRowsA(rCount);
      setColsA(cCount);
      setMatrixA((prev) => {
        return Array.from({ length: rCount }, (_, r) =>
          Array.from({ length: cCount }, (_, c) => (prev[r] && prev[r][c] !== undefined ? prev[r][c] : 0))
        );
      });
    } else {
      setRowsB(rCount);
      setColsB(cCount);
      setMatrixB((prev) => {
        return Array.from({ length: rCount }, (_, r) =>
          Array.from({ length: cCount }, (_, c) => (prev[r] && prev[r][c] !== undefined ? prev[r][c] : 0))
        );
      });
    }
  };

  const computeDet = (isA: boolean) => {
    setErrorMsg("");
    const mat = isA ? matrixA : matrixB;
    const r = isA ? rowsA : rowsB;
    const c = isA ? colsA : colsB;
    if (r !== c) {
      setErrorMsg("Determinant hesabı için kare matris (n × n) gereklidir.");
      return;
    }
    try {
      const d = math.det(mat);
      setResultLabel(`\\det(${isA ? "A" : "B"})`);
      setResultLatex(resultToLatex(d));
    } catch (e: any) {
      setErrorMsg(e.message || "Determinant hesaplanamadı.");
    }
  };

  const computeInv = (isA: boolean) => {
    setErrorMsg("");
    const mat = isA ? matrixA : matrixB;
    const r = isA ? rowsA : rowsB;
    const c = isA ? colsA : colsB;
    if (r !== c) {
      setErrorMsg("Ters matris (Inverse) için kare matris gereklidir.");
      return;
    }
    try {
      const inv = math.inv(mat);
      setResultLabel(`(${isA ? "A" : "B"})^{-1}`);
      setResultLatex(resultToLatex(inv));
    } catch (e: any) {
      setErrorMsg("Matrisin tersi tanımsız (Det = 0 / Tekil Matris).");
    }
  };

  const computeTranspose = (isA: boolean) => {
    setErrorMsg("");
    const mat = isA ? matrixA : matrixB;
    try {
      const tr = math.transpose(mat);
      setResultLabel(`(${isA ? "A" : "B"})^T`);
      setResultLatex(resultToLatex(tr));
    } catch (e: any) {
      setErrorMsg(e.message || "Transpoze alınamadı.");
    }
  };

  const computeRREFOperation = (isA: boolean) => {
    setErrorMsg("");
    const mat = isA ? matrixA : matrixB;
    try {
      const rref = computeRREF(mat);
      setResultLabel(`\\text{rref}(${isA ? "A" : "B"})`);
      setResultLatex(resultToLatex(rref));
    } catch (e: any) {
      setErrorMsg(e.message || "RREF hesaplanamadı.");
    }
  };

  const computeAdd = () => {
    setErrorMsg("");
    if (rowsA !== rowsB || colsA !== colsB) {
      setErrorMsg("Toplama için her iki matrisin boyutları eşit olmalıdır.");
      return;
    }
    try {
      const res = math.add(matrixA, matrixB);
      setResultLabel("A + B");
      setResultLatex(resultToLatex(res));
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const computeMultiply = () => {
    setErrorMsg("");
    if (colsA !== rowsB) {
      setErrorMsg("Çarpma için A'nın sütun sayısı ile B'nin satır sayısı eşit olmalıdır.");
      return;
    }
    try {
      const res = math.multiply(matrixA, matrixB);
      setResultLabel("A \\times B");
      setResultLatex(resultToLatex(res));
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-slate-100 p-4 overflow-y-auto space-y-4 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-blue-400">TI-Nspire Matris & Vektör Hesaplayıcı</h2>
          <p className="text-xs text-slate-400">Matris boyutlarını ayarlayın, elemanları girin ve cebirsel işlemleri uygulayın.</p>
        </div>
      </div>

      {/* Matrices Editor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Matrix A */}
        <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400">Matris [A]</span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">Boyut:</span>
              <select
                value={`${rowsA}x${colsA}`}
                onChange={(e) => {
                  const [r, c] = e.target.value.split("x").map(Number);
                  handleResize(true, r, c);
                }}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono"
              >
                <option value="1x2">1 × 2</option>
                <option value="1x3">1 × 3 (Vektör)</option>
                <option value="2x2">2 × 2</option>
                <option value="2x3">2 × 3</option>
                <option value="3x3">3 × 3</option>
                <option value="3x4">3 × 4</option>
                <option value="4x4">4 × 4</option>
              </select>
            </div>
          </div>

          {/* Matrix Input Table */}
          <div className="overflow-x-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800">
            <div
              className="grid gap-1.5 justify-center"
              style={{ gridTemplateColumns: `repeat(${colsA}, minmax(40px, 60px))` }}
            >
              {matrixA.map((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`a-${r}-${c}`}
                    type="number"
                    value={val}
                    onChange={(e) => updateMatrixCell(true, r, c, e.target.value)}
                    className="w-full h-8 text-center bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                ))
              )}
            </div>
          </div>

          {/* Actions for A */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              onClick={() => computeDet(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              det(A)
            </button>
            <button
              onClick={() => computeInv(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              A⁻¹
            </button>
            <button
              onClick={() => computeTranspose(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              Aᵀ
            </button>
            <button
              onClick={() => computeRREFOperation(true)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              rref(A)
            </button>
          </div>
        </div>

        {/* Matrix B */}
        <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-pink-400">Matris [B]</span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">Boyut:</span>
              <select
                value={`${rowsB}x${colsB}`}
                onChange={(e) => {
                  const [r, c] = e.target.value.split("x").map(Number);
                  handleResize(false, r, c);
                }}
                className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs font-mono"
              >
                <option value="1x2">1 × 2</option>
                <option value="1x3">1 × 3</option>
                <option value="2x2">2 × 2</option>
                <option value="2x3">2 × 3</option>
                <option value="3x3">3 × 3</option>
                <option value="3x4">3 × 4</option>
                <option value="4x4">4 × 4</option>
              </select>
            </div>
          </div>

          {/* Matrix Input Table */}
          <div className="overflow-x-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800">
            <div
              className="grid gap-1.5 justify-center"
              style={{ gridTemplateColumns: `repeat(${colsB}, minmax(40px, 60px))` }}
            >
              {matrixB.map((row, r) =>
                row.map((val, c) => (
                  <input
                    key={`b-${r}-${c}`}
                    type="number"
                    value={val}
                    onChange={(e) => updateMatrixCell(false, r, c, e.target.value)}
                    className="w-full h-8 text-center bg-slate-800 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-pink-500"
                  />
                ))
              )}
            </div>
          </div>

          {/* Actions for B */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              onClick={() => computeDet(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              det(B)
            </button>
            <button
              onClick={() => computeInv(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              B⁻¹
            </button>
            <button
              onClick={() => computeTranspose(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              Bᵀ
            </button>
            <button
              onClick={() => computeRREFOperation(false)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition-all cursor-pointer"
            >
              rref(B)
            </button>
          </div>
        </div>
      </div>

      {/* Binary Matrix Operations (A + B, A × B) */}
      <div className="flex items-center gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
        <span className="text-xs font-bold text-slate-400">İkili İşlemler:</span>
        <button
          onClick={computeAdd}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold text-white transition-all cursor-pointer"
        >
          A + B
        </button>
        <button
          onClick={computeMultiply}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold text-white transition-all cursor-pointer"
        >
          A × B
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 bg-red-950/40 border border-red-900 rounded-xl text-xs text-red-400 font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Computation Output Result Box */}
      {resultLatex && (
        <div className="p-4 bg-slate-950 rounded-2xl border border-blue-900/50 space-y-2">
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>Sonuç:</span>
            {resultLabel && <KaTeXView math={`${resultLabel} = `} />}
          </div>
          <div className="text-base text-blue-300 overflow-x-auto py-2">
            <KaTeXView math={resultLatex} block />
          </div>
        </div>
      )}
    </div>
  );
}
