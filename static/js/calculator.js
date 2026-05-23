/**
 * Gauss–Jordan Calculator — Frontend
 * Handles matrix grid rendering, API calls, step display, and export.
 */

/* ── State ── */
let currentN = 2;
let stepsVisible = true;
let lastResult = null;

/* ── Example data ── */
const EXAMPLES = {
  2: "4 1 9 2 3 8",          // 4x+y=9, 2x+3y=8  → x=2.09, y=0.636
  3: "2 1 -1 8 -3 -1 2 -11 -2 1 2 -3",  // classic example from the examples page
  4: "1 2 -1 1 5  2 4 1 -1 3  3 1 -2 2 10  1 -1 1 2 4",
  5: "2 1 0 0 0 3 1 3 1 0 0 4 0 1 4 1 0 5 0 0 1 5 1 6 0 0 0 1 6 7",
  6: "4 1 0 0 0 0 4 1 3 1 0 0 0 5 0 1 3 1 0 0 6 0 0 1 4 1 0 7 0 0 0 1 3 1 8 0 0 0 0 1 4 9 0 0 0 0 0 5 10",
};

/* ── DOM refs ── */
const grid        = document.getElementById("matrix-grid");
const solveBtn    = document.getElementById("solve-btn");
const clearBtn    = document.getElementById("clear-btn");
const exampleBtn  = document.getElementById("example-btn");
const errorMsg    = document.getElementById("error-msg");
const resultsPanel= document.getElementById("results-panel");
const statusBanner= document.getElementById("status-banner");
const solutionDisp= document.getElementById("solution-display");
const stepsContainer = document.getElementById("steps-container");
const toggleBtn   = document.getElementById("toggle-steps");
const exportBtn   = document.getElementById("export-btn");
const copySolBtn  = document.getElementById("copy-solution-btn");

/* ── Build matrix grid ── */
function buildGrid(n) {
  currentN = n;
  grid.innerHTML = "";
  // Set CSS grid columns: n data cols + separator + 1 augmented col
  const cols = n + 1 + 1; // n A cols + pipe + b col
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr) 20px 1fr`;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const inp = makeInput(i, j, false);
      grid.appendChild(inp);
    }
    // Separator
    const sep = document.createElement("div");
    sep.className = "col-sep";
    sep.textContent = "|";
    grid.appendChild(sep);
    // Augmented column
    const aug = makeInput(i, n, true);
    grid.appendChild(aug);
  }
}

function makeInput(row, col, isAug) {
  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "matrix-input" + (isAug ? " augmented" : "");
  inp.setAttribute("aria-label", isAug ? `b${row+1}` : `a${row+1}${col+1}`);
  inp.placeholder = "0";
  inp.dataset.row = row;
  inp.dataset.col = col;
  // Navigate with arrow keys
  inp.addEventListener("keydown", handleArrow);
  return inp;
}

function handleArrow(e) {
  const inputs = [...grid.querySelectorAll(".matrix-input")];
  const idx = inputs.indexOf(e.target);
  // Cols per row = n + 1 (augmented) = currentN + 1
  const rowLen = currentN + 1;
  let next = -1;
  if (e.key === "ArrowRight" || e.key === "Tab") { next = idx + 1; e.preventDefault(); }
  if (e.key === "ArrowLeft")  { next = idx - 1; e.preventDefault(); }
  if (e.key === "ArrowDown")  { next = idx + rowLen; e.preventDefault(); }
  if (e.key === "ArrowUp")    { next = idx - rowLen; e.preventDefault(); }
  if (e.key === "Enter")      { next = idx + rowLen; e.preventDefault(); }
  if (next >= 0 && next < inputs.length) inputs[next].focus();
}

/* ── Size buttons ── */
document.querySelectorAll(".size-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    buildGrid(parseInt(btn.dataset.n));
    hideResults();
  });
});

/* ── Gather inputs → flat string ── */
function gatherMatrix() {
  const inputs = [...grid.querySelectorAll(".matrix-input")];
  return inputs.map(inp => inp.value.trim() || "0").join(" ");
}

/* ── Solve ── */
solveBtn.addEventListener("click", async () => {
  hideError();
  solveBtn.textContent = "Solving…";
  solveBtn.disabled = true;

  try {
    const resp = await fetch("/api/solve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n: currentN, matrix: gatherMatrix() }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Server error");
    lastResult = data;
    displayResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    solveBtn.textContent = "Solve →";
    solveBtn.disabled = false;
  }
});

/* ── Display results ── */
function displayResults(data) {
  resultsPanel.hidden = false;

  // Status banner
  const labels = {
    unique:      "✓ Unique solution found",
    no_solution: "✗ No solution (inconsistent system)",
    infinite:    "∞ Infinitely many solutions (dependent system)",
  };
  statusBanner.textContent = labels[data.status] || data.status;
  statusBanner.className = "status-banner status-" + data.status;

  // Solution display
  if (data.status === "unique" && data.solution) {
    solutionDisp.innerHTML = data.solution.map((v, i) => {
      const fmt = Number.isInteger(v) ? v : parseFloat(v.toFixed(8));
      return `<span class="sol-var">x<sub>${i+1}</sub></span> = ${fmt}`;
    }).join("&emsp;&emsp;");
  } else {
    solutionDisp.innerHTML = `<em style="color:var(--ink-3)">${labels[data.status]}</em>`;
  }

  // Steps
  stepsContainer.innerHTML = "";
  data.steps.forEach((step, idx) => {
    const card = document.createElement("div");
    card.className = "step-card";
    card.style.animationDelay = `${idx * 30}ms`;
    card.innerHTML = `
      <div class="step-card-label">Step ${idx + 1}</div>
      <div class="step-card-desc">${escHtml(step.desc)}</div>
      <div class="step-card-matrix">\\[${step.latex}\\]</div>
    `;
    stepsContainer.appendChild(card);
  });

  // Re-typeset MathJax
  if (window.MathJax) {
    MathJax.typesetPromise([solutionDisp, stepsContainer]).catch(console.error);
  }
}

/* ── Toggle steps ── */
toggleBtn.addEventListener("click", () => {
  stepsVisible = !stepsVisible;
  stepsContainer.style.display = stepsVisible ? "" : "none";
  toggleBtn.textContent = stepsVisible ? "Hide steps" : "Show steps";
});

/* ── Clear ── */
clearBtn.addEventListener("click", () => {
  grid.querySelectorAll(".matrix-input").forEach(inp => inp.value = "");
  hideResults();
  hideError();
});

/* ── Load example ── */
exampleBtn.addEventListener("click", () => {
  const vals = (EXAMPLES[currentN] || "").split(/\s+/);
  const inputs = [...grid.querySelectorAll(".matrix-input")];
  inputs.forEach((inp, i) => { inp.value = vals[i] || "0"; });
});

/* ── Export TXT ── */
exportBtn.addEventListener("click", () => {
  if (!lastResult) return;
  let txt = "Gauss-Jordan Elimination — Solution\n";
  txt += "=".repeat(40) + "\n\n";
  txt += `Status: ${lastResult.status}\n\n`;
  if (lastResult.solution) {
    txt += "Solution:\n";
    lastResult.solution.forEach((v, i) => {
      txt += `  x${i+1} = ${parseFloat(v.toFixed(8))}\n`;
    });
    txt += "\n";
  }
  txt += "Steps:\n";
  lastResult.steps.forEach((s, i) => {
    txt += `\nStep ${i+1}: ${s.desc}\n`;
  });
  download("gauss_jordan_solution.txt", txt);
});

/* ── Copy solution ── */
copySolBtn.addEventListener("click", () => {
  if (!lastResult?.solution) return;
  const text = lastResult.solution.map((v, i) =>
    `x${i+1} = ${parseFloat(v.toFixed(8))}`
  ).join(", ");
  navigator.clipboard.writeText(text).then(() => {
    copySolBtn.textContent = "Copied!";
    setTimeout(() => { copySolBtn.textContent = "Copy solution"; }, 1800);
  });
});

/* ── Utilities ── */
function showError(msg) {
  errorMsg.textContent = "Error: " + msg;
  errorMsg.hidden = false;
}
function hideError() { errorMsg.hidden = true; }
function hideResults() { resultsPanel.hidden = true; }
function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function download(filename, text) {
  const a = document.createElement("a");
  a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
  a.download = filename;
  a.click();
}

/* ── Init ── */
buildGrid(2);
