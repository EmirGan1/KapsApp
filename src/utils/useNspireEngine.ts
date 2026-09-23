import { useState, useCallback, useRef } from "react";
import { create, all } from "mathjs";

// Initialize mathjs instance
const math = create(all, {});

export interface HistoryItem {
  id: string;
  expression: string;
  latexInput: string;
  result: string;
  latexResult: string;
  isError?: boolean;
  timestamp: number;
}

export type AngleMode = "RAD" | "DEG";

// Numerical calculus helpers
function numericalDerivative(
  fn: (x: number) => number,
  x: number,
  h: number = 1e-6
): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

function numericalIntegral(
  fn: (x: number) => number,
  a: number,
  b: number,
  n: number = 1000
): number {
  if (a === b) return 0;
  if (a > b) return -numericalIntegral(fn, b, a, n);
  if (n % 2 !== 0) n++; // Ensure even number of intervals
  const h = (b - a) / n;
  let sum = fn(a) + fn(b);

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const y = fn(x);
    if (!Number.isFinite(y)) continue;
    sum += (i % 2 === 0 ? 2 : 4) * y;
  }
  return (h / 3) * sum;
}

// Comprehensive Input Sanitizer & Normalizer
export function sanitizeMathExpression(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let s = raw.trim();

  // 1. Unicode & Special symbol replacements
  s = s
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/–/g, "-")
    .replace(/π/g, "pi")
    .replace(/θ/g, "theta")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁴/g, "^4");

  // 2. Power notation fix: x² or x^2
  s = s.replace(/([a-zA-Z0-9_\)])\s*²/g, "$1^2");
  s = s.replace(/([a-zA-Z0-9_\)])\s*³/g, "$1^3");

  // 3. Square root: √(expr) or √expr
  s = s.replace(/√\s*\(([^)]+)\)/g, "sqrt($1)");
  s = s.replace(/√\s*([0-9a-zA-Z_]+)/g, "sqrt($1)");

  // 4. Logarithms: ln(x) -> log(x) [mathjs log is natural log]
  // log(x) or log10(x) -> log10(x)
  s = s.replace(/\bln\s*\(/g, "log(");
  s = s.replace(/\blog\s*\(/g, "log10(");
  s = s.replace(/\blog1010\s*\(/g, "log10("); // prevent double replace

  // 5. Implicit Multiplication Insertions:
  // e.g., 2x -> 2*x, 5pi -> 5*pi, 2(x+1) -> 2*(x+1), (x+1)(x-1) -> (x+1)*(x-1)
  // Number followed by variable / constant / function (avoid math keywords like log10, sin, cos)
  s = s.replace(/(\d)\s*([a-zA-Z_]\w*)/g, (match, p1, p2) => {
    // If it's something like 2e3 (scientific notation), don't break it
    if (/^e\d+$/i.test(p2)) return match;
    return `${p1}*${p2}`;
  });

  // Number followed by parenthesis: 2(3) -> 2*(3)
  s = s.replace(/(\d)\s*\(/g, "$1*(");

  // Closing paren followed by opening paren: (x+1)(x+2) -> (x+1)*(x+2)
  s = s.replace(/\)\s*\(/g, ")*(");

  // Closing paren followed by variable or number: (x+1)2 -> (x+1)*2, (x+1)x -> (x+1)*x
  s = s.replace(/\)\s*([0-9a-zA-Z_])/g, ")*$1");

  // Variable followed by function: x sin(x) -> x*sin(x)
  s = s.replace(/\b([a-zA-Z_])\s+(sin|cos|tan|asin|acos|atan|sqrt|log|log10|exp)\b/g, "$1*$2");

  return s;
}

// Convert expression string to clean KaTeX representation
export function exprToLatex(expr: string): string {
  if (!expr || !expr.trim()) return "";
  const cleaned = expr.trim();

  // Custom calculus patterns
  const derivMatch = cleaned.match(/^(?:deriv|diff|d\/dx)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z]+)\s*,\s*([^)]+)\s*\)$/i);
  if (derivMatch) {
    return `\\left. \\frac{d}{d${derivMatch[2]}} \\left( ${exprToLatex(derivMatch[1])} \\right) \\right|_{${derivMatch[2]}=${derivMatch[3]}}`;
  }

  const intMatch = cleaned.match(/^(?:integrate|integral|int)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i);
  if (intMatch) {
    return `\\int_{${intMatch[3]}}^{${intMatch[4]}} ${exprToLatex(intMatch[1])} \\, d${intMatch[2]}`;
  }

  const sumMatch = cleaned.match(/^(?:sum|sigma)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i);
  if (sumMatch) {
    return `\\sum_{${sumMatch[2]}=${sumMatch[3]}}^{${sumMatch[4]}} ${exprToLatex(sumMatch[1])}`;
  }

  // Check assignment notation: x := 5 or 5 -> x
  const stoMatch = cleaned.match(/^(.+?)\s*(?:->|sto->)\s*([a-zA-Z_]\w*)$/i);
  if (stoMatch) {
    return `${exprToLatex(stoMatch[1])} \\to ${stoMatch[2]}`;
  }
  const assignMatch = cleaned.match(/^([a-zA-Z_]\w*)\s*(?::=|=)\s*(.+)$/);
  if (assignMatch) {
    return `${assignMatch[1]} := ${exprToLatex(assignMatch[2])}`;
  }

  try {
    const sanitized = sanitizeMathExpression(cleaned);
    const node = math.parse(sanitized);
    return node.toTex({
      parenthesis: "auto",
      implicit: "hide",
    });
  } catch {
    // Fallback naive beautifier
    return cleaned
      .replace(/\*/g, " \\cdot ")
      .replace(/pi/g, "\\pi ")
      .replace(/theta/g, "\\theta ")
      .replace(/sqrt\(([^)]+)\)/g, "\\sqrt{$1}")
      .replace(/sin\(([^)]+)\)/g, "\\sin\\left($1\\right)")
      .replace(/cos\(([^)]+)\)/g, "\\cos\\left($1\\right)")
      .replace(/tan\(([^)]+)\)/g, "\\tan\\left($1\\right)")
      .replace(/\^([0-9a-zA-Z]+)/g, "^{$1}");
  }
}

// Convert result to KaTeX
export function resultToLatex(val: any): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "\\text{true}" : "\\text{false}";
  if (typeof val === "string") return `\\text{${val}}`;
  
  if (math.isMatrix(val) || Array.isArray(val)) {
    const arr = Array.isArray(val) ? val : val.toArray();
    if (!Array.isArray(arr[0])) {
      // 1D vector
      const rows = arr.map((v: any) => math.format(v, { precision: 6 })).join(" \\\\ ");
      return `\\begin{pmatrix} ${rows} \\end{pmatrix}`;
    }
    const rowStrings = arr.map((row: any[]) =>
      row.map((cell: any) => math.format(cell, { precision: 6 })).join(" & ")
    );
    return `\\begin{pmatrix} ${rowStrings.join(" \\\\ ")} \\end{pmatrix}`;
  }

  // Complex number support: 2 + 3i
  if (typeof val === "object" && val.isComplex) {
    const re = Number(val.re.toFixed(6));
    const im = Number(val.im.toFixed(6));
    if (im === 0) return String(re);
    if (re === 0) return `${im === 1 ? "" : im === -1 ? "-" : im}i`;
    return `${re} ${im > 0 ? "+" : "-"} ${Math.abs(im) === 1 ? "" : Math.abs(im)}i`;
  }

  try {
    const formatted = math.format(val, { precision: 10, lowerExp: -6, upperExp: 8 });
    if (typeof val === "number" && Number.isInteger(val)) {
      return String(val);
    }
    return formatted.replace(/e\+?(-?\d+)/g, " \\times 10^{$1}");
  } catch {
    return String(val);
  }
}

export function useNspireEngine() {
  const [angleMode, setAngleMode] = useState<AngleMode>("RAD");
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: "init-1",
      expression: "x := 5",
      latexInput: "x := 5",
      result: "x = 5 (Scope)",
      latexResult: "x = 5",
      timestamp: Date.now() - 3000,
    },
    {
      id: "init-2",
      expression: "x^2 + 2x",
      latexInput: "x^2 + 2 \\cdot x",
      result: "35",
      latexResult: "35",
      timestamp: Date.now() - 2000,
    },
    {
      id: "init-3",
      expression: "integrate(x * sin(x), x, 0, pi)",
      latexInput: "\\int_{0}^{\\pi} x \\sin(x) \\, dx",
      result: "pi ≈ 3.14159265",
      latexResult: "\\pi \\approx 3.14159265",
      timestamp: Date.now() - 1000,
    }
  ]);

  const [input, setInput] = useState<string>("");
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lastAns, setLastAns] = useState<any>(null);
  const memoryScopeRef = useRef<Record<string, any>>({ x: 5 });

  // Helper to evaluate calculus expressions safely
  const evalCalculus = (expr: string): any => {
    // 1. Derivative: deriv(sin(x), x, 0) or d/dx(x^3, x, 2)
    const derivRegex = /^(?:deriv|diff|d\/dx)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z_]\w*)\s*,\s*([^)]+)\s*\)$/i;
    const dMatch = expr.match(derivRegex);
    if (dMatch) {
      const funcBody = sanitizeMathExpression(dMatch[1]);
      const varName = dMatch[2];
      const atValStr = sanitizeMathExpression(dMatch[3]);
      const atVal = math.evaluate(atValStr, { ...memoryScopeRef.current, ans: lastAns ?? 0 });
      const compiled = math.compile(funcBody);
      const fn = (v: number) => {
        const scope = { ...memoryScopeRef.current, [varName]: v, ans: lastAns ?? 0 };
        return Number(compiled.evaluate(scope));
      };
      const res = numericalDerivative(fn, atVal);
      return Number(res.toFixed(8));
    }

    // Symbolic derivative: deriv(x^3, x) without 3rd parameter
    const derivSymRegex = /^(?:deriv|diff|d\/dx)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z_]\w*)\s*\)$/i;
    const dSymMatch = expr.match(derivSymRegex);
    if (dSymMatch) {
      const funcBody = sanitizeMathExpression(dSymMatch[1]);
      const varName = dSymMatch[2];
      try {
        const d = math.derivative(funcBody, varName);
        return d.toString();
      } catch {
        return null;
      }
    }

    // 2. Integral: integrate(sin(x), x, 0, pi) or int(x^2, x, 0, 1)
    const intRegex = /^(?:integrate|integral|int)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z_]\w*)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i;
    const iMatch = expr.match(intRegex);
    if (iMatch) {
      const funcBody = sanitizeMathExpression(iMatch[1]);
      const varName = iMatch[2];
      const aVal = Number(math.evaluate(sanitizeMathExpression(iMatch[3]), { ...memoryScopeRef.current, ans: lastAns ?? 0, pi: Math.PI, e: Math.E }));
      const bVal = Number(math.evaluate(sanitizeMathExpression(iMatch[4]), { ...memoryScopeRef.current, ans: lastAns ?? 0, pi: Math.PI, e: Math.E }));
      const compiled = math.compile(funcBody);
      const fn = (v: number) => {
        const scope = { ...memoryScopeRef.current, [varName]: v, ans: lastAns ?? 0, pi: Math.PI, e: Math.E };
        return Number(compiled.evaluate(scope));
      };
      const res = numericalIntegral(fn, aVal, bVal, 1000);
      return Number(res.toFixed(8));
    }

    // 3. Summation: sum(k^2, k, 1, 10)
    const sumRegex = /^(?:sum|sigma)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z_]\w*)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i;
    const sMatch = expr.match(sumRegex);
    if (sMatch) {
      const body = sanitizeMathExpression(sMatch[1]);
      const varName = sMatch[2];
      const fromVal = Math.round(Number(math.evaluate(sanitizeMathExpression(sMatch[3]), { ...memoryScopeRef.current, ans: lastAns ?? 0 })));
      const toVal = Math.round(Number(math.evaluate(sanitizeMathExpression(sMatch[4]), { ...memoryScopeRef.current, ans: lastAns ?? 0 })));
      const compiled = math.compile(body);
      let total = 0;
      for (let k = fromVal; k <= toVal; k++) {
        total += Number(compiled.evaluate({ ...memoryScopeRef.current, [varName]: k, ans: lastAns ?? 0 }));
      }
      return total;
    }

    // 4. Product: prod(k, k, 1, 5)
    const prodRegex = /^(?:prod|product)\s*\(\s*([^,]+)\s*,\s*([a-zA-Z_]\w*)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)$/i;
    const pMatch = expr.match(prodRegex);
    if (pMatch) {
      const body = sanitizeMathExpression(pMatch[1]);
      const varName = pMatch[2];
      const fromVal = Math.round(Number(math.evaluate(sanitizeMathExpression(pMatch[3]), { ...memoryScopeRef.current, ans: lastAns ?? 0 })));
      const toVal = Math.round(Number(math.evaluate(sanitizeMathExpression(pMatch[4]), { ...memoryScopeRef.current, ans: lastAns ?? 0 })));
      const compiled = math.compile(body);
      let total = 1;
      for (let k = fromVal; k <= toVal; k++) {
        total *= Number(compiled.evaluate({ ...memoryScopeRef.current, [varName]: k, ans: lastAns ?? 0 }));
      }
      return total;
    }

    return null;
  };

  // Perform calculation
  const calculate = useCallback((customExpr?: string) => {
    const rawExpr = (customExpr !== undefined ? customExpr : input).trim();
    if (!rawExpr) return;

    let sanitized = sanitizeMathExpression(rawExpr);
    let resultValue: any = null;
    let resultString = "";
    let latexResultStr = "";
    let isError = false;

    // Check Variable Assignment: e.g. "5 -> x", "5 sto-> x", "x := 5", "x = 5"
    const stoMatch = rawExpr.match(/^(.+?)\s*(?:->|sto->)\s*([a-zA-Z_]\w*)$/i);
    const assignMatch = !stoMatch ? rawExpr.match(/^([a-zA-Z_]\w*)\s*(?::=|=)\s*(.+)$/) : null;

    if (stoMatch || assignMatch) {
      const varName = stoMatch ? stoMatch[2].trim() : assignMatch![1].trim();
      const valExprRaw = stoMatch ? stoMatch[1].trim() : assignMatch![2].trim();
      const valExpr = sanitizeMathExpression(valExprRaw);

      try {
        const evaluatedVal = math.evaluate(valExpr, {
          ...memoryScopeRef.current,
          ans: lastAns ?? 0,
          pi: Math.PI,
          e: Math.E,
        });
        memoryScopeRef.current[varName] = evaluatedVal;
        resultValue = evaluatedVal;
        resultString = `${varName} = ${typeof evaluatedVal === "number" ? evaluatedVal : String(evaluatedVal)}`;
        latexResultStr = `${varName} = ${resultToLatex(evaluatedVal)}`;
        setLastAns(evaluatedVal);
      } catch (err: any) {
        isError = true;
        resultString = "Değişken atama hatası";
        latexResultStr = "\\text{Tanımsız Değer}";
      }
    } else {
      try {
        // 1. Check for custom calculus functions first
        const calcResult = evalCalculus(sanitized);
        if (calcResult !== null) {
          resultValue = calcResult;
          resultString = String(resultValue);
          latexResultStr = resultToLatex(resultValue);
          setLastAns(resultValue);
        } else {
          // 2. Build scope with Angle Mode (RAD / DEG) support
          const scope: Record<string, any> = {
            ...memoryScopeRef.current,
            ans: lastAns ?? 0,
            pi: Math.PI,
            e: Math.E,
            i: math.complex(0, 1),
            // Combinatorics & Stats
            nCr: (n: number, r: number) => math.combinations(n, r),
            nPr: (n: number, r: number) => math.permutations(n, r),
            mean: (arr: number[]) => math.mean(arr),
            median: (arr: number[]) => math.median(arr),
            std: (arr: number[]) => math.std(arr),
          };

          if (angleMode === "DEG") {
            const toRad = (d: number) => (d * Math.PI) / 180;
            const toDeg = (r: number) => (r * 180) / Math.PI;
            scope.sin = (x: number) => {
              const res = Math.sin(toRad(x));
              return Math.abs(res) < 1e-12 ? 0 : Number(res.toFixed(10));
            };
            scope.cos = (x: number) => {
              const res = Math.cos(toRad(x));
              return Math.abs(res) < 1e-12 ? 0 : Number(res.toFixed(10));
            };
            scope.tan = (x: number) => {
              if (Math.abs(x % 180) === 90) return Infinity;
              const res = Math.tan(toRad(x));
              return Math.abs(res) < 1e-12 ? 0 : Number(res.toFixed(10));
            };
            scope.asin = (x: number) => Number(toDeg(Math.asin(x)).toFixed(8));
            scope.acos = (x: number) => Number(toDeg(Math.acos(x)).toFixed(8));
            scope.atan = (x: number) => Number(toDeg(Math.atan(x)).toFixed(8));
          }

          // Try evaluating numerically
          try {
            resultValue = math.evaluate(sanitized, scope);

            if (typeof resultValue === "number") {
              if (!Number.isFinite(resultValue)) {
                resultString = resultValue === Infinity || resultValue === -Infinity ? "±∞ (Tanımsız/Sonsuz)" : "Undefined";
                latexResultStr = "\\pm\\infty";
                isError = true;
              } else {
                resultString = String(Number(resultValue.toFixed(8)));
                latexResultStr = resultToLatex(resultValue);
              }
            } else if (resultValue && typeof resultValue.toString === "function") {
              resultString = resultValue.toString();
              latexResultStr = resultToLatex(resultValue);
            } else {
              resultString = String(resultValue);
              latexResultStr = resultToLatex(resultValue);
            }

            setLastAns(resultValue);
          } catch (evalErr: any) {
            // 3. CAS Symbolic Simplification Fallback:
            // If variable (like x, y) was not in scope, don't crash! Simplify or show symbolic form!
            try {
              const simplifiedNode = math.simplify(sanitized);
              resultValue = simplifiedNode.toString();
              resultString = simplifiedNode.toString();
              latexResultStr = simplifiedNode.toTex({ parenthesis: "auto" });
            } catch (symErr) {
              // If simplify also fails, give clean descriptive error
              isError = true;
              const msg = evalErr.message || "";
              if (msg.includes("Undefined symbol")) {
                const varName = msg.replace("Undefined symbol ", "");
                resultString = `Tanımsız Değişken: ${varName} (örn: 5 -> ${varName} yazın)`;
                latexResultStr = `\\text{Tanımsız: } ${varName}`;
              } else if (msg.includes("Unexpected type")) {
                resultString = "Boyut / Tip Uyuşmazlığı";
                latexResultStr = "\\text{Syntax Error}";
              } else {
                resultString = "Sözdizimi Hatası (Syntax Error)";
                latexResultStr = "\\text{Syntax Error}";
              }
            }
          }
        }
      } catch (err: any) {
        isError = true;
        resultString = "Syntax Error";
        latexResultStr = "\\text{Syntax Error}";
      }
    }

    const newItem: HistoryItem = {
      id: "hist-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      expression: rawExpr,
      latexInput: exprToLatex(rawExpr),
      result: resultString,
      latexResult: latexResultStr || `\\text{${resultString}}`,
      isError,
      timestamp: Date.now(),
    };

    setHistory((prev) => [...prev, newItem]);
    setInput("");
    setHistoryIndex(-1);
  }, [input, angleMode, lastAns]);

  // Navigate up in history
  const historyUp = useCallback(() => {
    if (history.length === 0) return;
    const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(newIdx);
    setInput(history[newIdx].expression);
  }, [history, historyIndex]);

  // Navigate down in history
  const historyDown = useCallback(() => {
    if (historyIndex === -1) return;
    const newIdx = historyIndex + 1;
    if (newIdx >= history.length) {
      setHistoryIndex(-1);
      setInput("");
    } else {
      setHistoryIndex(newIdx);
      setInput(history[newIdx].expression);
    }
  }, [history, historyIndex]);

  // Append token to input
  const appendInput = useCallback((token: string) => {
    setInput((prev) => prev + token);
  }, []);

  // Backspace
  const backspace = useCallback(() => {
    setInput((prev) => prev.slice(0, -1));
  }, []);

  // Clear
  const clearAll = useCallback(() => {
    setInput("");
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setLastAns(null);
    memoryScopeRef.current = {};
  }, []);

  return {
    input,
    setInput,
    angleMode,
    setAngleMode,
    history,
    calculate,
    historyUp,
    historyDown,
    appendInput,
    backspace,
    clearAll,
    clearHistory,
    lastAns,
    variablesScope: memoryScopeRef.current,
  };
}
