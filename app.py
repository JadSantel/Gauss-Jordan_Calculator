"""
Gauss-Jordan Elimination Calculator
Flask web application for PIT Numerical Methods project.
"""

from flask import Flask, render_template, request, jsonify
from fractions import Fraction
import json
import re

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Core Algorithm
# ---------------------------------------------------------------------------

def parse_matrix(raw: str, n: int) -> list[list[float]]:
    """
    Safely parse a flat whitespace/comma-separated string into an n x (n+1)
    augmented matrix.  Accepts integers, decimals, and simple fractions (e.g. 1/3).
    Raises ValueError with a descriptive message on bad input.
    """
    # Normalise separators
    raw = raw.replace(",", " ").replace(";", " ")
    tokens = raw.split()
    expected = n * (n + 1)
    if len(tokens) != expected:
        raise ValueError(
            f"Expected {expected} values for a {n}×{n} system, got {len(tokens)}."
        )

    matrix = []
    for i in range(n):
        row = []
        for j in range(n + 1):
            token = tokens[i * (n + 1) + j]
            # Validate: digits, sign, dot, slash only
            if not re.fullmatch(r"-?\d+(\.\d+)?(/\d+)?", token):
                raise ValueError(f"Invalid token '{token}' at position ({i},{j}).")
            if "/" in token:
                row.append(float(Fraction(token)))
            else:
                row.append(float(token))
        matrix.append(row)
    return matrix


def gauss_jordan(matrix: list[list[float]]) -> dict:
    """
    Perform Gauss-Jordan elimination with partial pivoting.
    Returns a dict with:
      - steps: list of (description, matrix_snapshot)
      - solution: list of floats or None if no unique solution
      - status: 'unique' | 'no_solution' | 'infinite'
    """
    import copy

    n = len(matrix)
    aug = [row[:] for row in matrix]  # deep copy
    steps = []

    def snap(desc: str):
        steps.append({"desc": desc, "matrix": copy.deepcopy(aug)})

    snap("Initial augmented matrix [A|b]")

    for col in range(n):
        # --- Partial pivoting ---
        max_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if aug[max_row][col] == 0:
            # Check for no solution or infinite solutions
            for row in range(col, n):
                if aug[row][n] != 0:
                    return {"steps": steps, "solution": None, "status": "no_solution"}
            return {"steps": steps, "solution": None, "status": "infinite"}

        if max_row != col:
            aug[col], aug[max_row] = aug[max_row], aug[col]
            snap(f"Swap R{col+1} ↔ R{max_row+1} (partial pivoting)")

        # --- Scale pivot row so pivot = 1 ---
        pivot = aug[col][col]
        if pivot != 1.0:
            aug[col] = [x / pivot for x in aug[col]]
            snap(f"R{col+1} → R{col+1} ÷ {_fmt(pivot)}  (make pivot = 1)")

        # --- Eliminate all other rows ---
        for row in range(n):
            if row == col:
                continue
            factor = aug[row][col]
            if factor == 0:
                continue
            aug[row] = [aug[row][k] - factor * aug[col][k] for k in range(n + 1)]
            sign = "+" if factor >= 0 else "-"
            snap(
                f"R{row+1} → R{row+1} − ({_fmt(factor)})·R{col+1}"
            )

    solution = [aug[r][n] for r in range(n)]
    return {"steps": steps, "solution": solution, "status": "unique"}


def _fmt(val: float) -> str:
    """Format a float nicely (drop trailing zeros)."""
    if val == int(val):
        return str(int(val))
    return f"{val:.6g}"


def matrix_to_latex(mat: list[list[float]]) -> str:
    """Convert an augmented matrix to a LaTeX bmatrix string."""
    n = len(mat)
    cols = n + 1
    col_spec = "c" * n + "|c"
    rows_tex = []
    for row in mat:
        rows_tex.append(" & ".join(_fmt(v) for v in row))
    body = " \\\\ ".join(rows_tex)
    return rf"\left[\begin{{array}}{{{col_spec}}}{body}\end{{array}}\right]"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/discussion")
def discussion():
    return render_template("discussion.html")


@app.route("/examples")
def examples():
    return render_template("examples.html")


@app.route("/calculator")
def calculator():
    return render_template("calculator.html")


@app.route("/api/solve", methods=["POST"])
def solve():
    """API endpoint: receives JSON {n, matrix_str}, returns steps + solution."""
    data = request.get_json(force=True)

    try:
        n = int(data.get("n", 0))
        if not (2 <= n <= 6):
            raise ValueError("Matrix size must be between 2 and 6.")
        raw = str(data.get("matrix", ""))
        matrix = parse_matrix(raw, n)
    except (ValueError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400

    result = gauss_jordan(matrix)

    # Build LaTeX for every step
    latex_steps = []
    for step in result["steps"]:
        latex_steps.append(
            {
                "desc": step["desc"],
                "latex": matrix_to_latex(step["matrix"]),
            }
        )

    payload = {
        "status": result["status"],
        "steps": latex_steps,
        "solution": result["solution"],
        "n": n,
    }
    return jsonify(payload)


if __name__ == "__main__":
    app.run(debug=True)
