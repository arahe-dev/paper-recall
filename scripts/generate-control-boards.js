// @ts-check
/**
 * Generate 6 Excalidraw boards showing step-by-step block diagram reduction.
 * Visual teaching quality focused: no line-text overlap, explicit signs, one
 * transformation per step, spacious final diagram, exam-friendly captions.
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const outDir = resolve(__dirname, "..", "control-systems-reduction");
mkdirSync(outDir, { recursive: true });

let _id = 0;
function uid() {
  return `el-${++_id}`;
}
const _now = Date.now();
function base() {
  return {
    id: uid(),
    version: 2,
    versionNonce: Math.floor(Math.random() * 1000000),
    updated: _now,
    created: _now,
    isDeleted: false,
  };
}

function rect(x, y, w, h, label, opts = {}) {
  const shape = {
    ...base(),
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    strokeColor: "#1e1e1e",
    backgroundColor: opts.bg || "#ffffff",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    roundness: { type: 1, value: 4 },
  };
  const tw = opts.tw || w - 8;
  const labelText = {
    ...base(),
    type: "text",
    x: x + (w - tw) / 2,
    y: y + h / 2 - 14,
    width: tw,
    height: 28,
    text: label,
    fontSize: opts.fs || 20,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "top",
    strokeColor: "#1e1e1e",
    roughness: 0,
    opacity: 100,
  };
  return [shape, labelText];
}

function summingJunction(x, y, r, topSign, bottomSign) {
  const els = [];
  // Outer circle
  els.push({
    ...base(),
    type: "ellipse",
    x: x - r,
    y: y - r,
    width: r * 2,
    height: r * 2,
    strokeColor: "#1e1e1e",
    backgroundColor: "#ffffff",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
  });
  // Horizontal cross line
  els.push({
    ...base(),
    type: "line",
    x: x - r + 5,
    y,
    width: r * 2 - 10,
    height: 0,
    strokeColor: "#1e1e1e",
    strokeWidth: 1.5,
    roughness: 0,
    points: [[0, 0], [r * 2 - 10, 0]],
  });
  // Vertical cross line
  els.push({
    ...base(),
    type: "line",
    x,
    y: y - r + 5,
    width: 0,
    height: r * 2 - 10,
    strokeColor: "#1e1e1e",
    strokeWidth: 1.5,
    roughness: 0,
    points: [[0, 0], [0, r * 2 - 10]],
  });
  // Signs — explicit, large, bold
  const off = r * 0.32;
  if (topSign) {
    els.push({
      ...base(),
      type: "text",
      x: x - 10,
      y: y - off - 14,
      width: 20,
      height: 28,
      text: topSign,
      fontSize: 22,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor: "#000000",
      roughness: 0,
      opacity: 100,
    });
  }
  if (bottomSign) {
    els.push({
      ...base(),
      type: "text",
      x: x - 10,
      y: y + off - 14,
      width: 20,
      height: 28,
      text: bottomSign,
      fontSize: 22,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "top",
      strokeColor: "#000000",
      roughness: 0,
      opacity: 100,
    });
  }
  return els;
}

function text(x, y, content, size = 20, opts = {}) {
  return {
    ...base(),
    type: "text",
    x,
    y,
    width: opts.w || 300,
    height: opts.h || 30,
    text: content,
    fontSize: size,
    fontFamily: 2,
    textAlign: opts.align || "left",
    verticalAlign: "top",
    strokeColor: "#1e1e1e",
    roughness: 0,
    opacity: 100,
  };
}

function arrow(x1, y1, x2, y2, opts = {}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    ...base(),
    type: "arrow",
    x: x1,
    y: y1,
    width: Math.abs(dx),
    height: Math.abs(dy),
    strokeColor: "#1e1e1e",
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    points: [[0, 0], [dx, dy]],
    endArrowhead: "arrow",
    startBinding: opts.startBind || null,
    endBinding: opts.endBind || null,
  };
}

function hLine(y, x1, x2) {
  const w = x2 - x1;
  return {
    ...base(),
    type: "line",
    x: x1,
    y,
    width: w,
    height: 0,
    strokeColor: "#1e1e1e",
    strokeWidth: 2,
    roughness: 0,
    points: [[0, 0], [w, 0]],
  };
}

function vLine(x, y1, y2) {
  const h = y2 - y1;
  return {
    ...base(),
    type: "line",
    x,
    y: y1,
    width: 0,
    height: h,
    strokeColor: "#1e1e1e",
    strokeWidth: 2,
    roughness: 0,
    points: [[0, 0], [0, h]],
  };
}

// ── Layout constants ──────────────────────────────────────────────────────
const Y = 280;                 // main signal path y
const R_X = 80;                // Reference input x
const J1_X = 200;              // First summing junction x
const J2_X = 320;              // Second summing junction x
const G1_X = 460;              // G₁ block center x
const J3_X = 600;              // Third summing junction x
const G2_X = 720;              // G₂ block center x
const G3_X = 860;              // G₃ block center x
const C_X = 1000;              // Output C x

// Feedback loop y-levels (generous spacing to avoid overlap)
const FB_OUTER_Y = Y + 260;    // outer feedback horizontal
const FB_H1_Y    = Y + 200;    // H₁ branch horizontal
const FB_H2_Y    = Y - 200;    // H₂ branch horizontal

function makeBoard(name, elements, caption, formula) {
  const captionY = 560;
  const all = [
    ...elements,
    text(60, captionY, caption, 18),
    text(60, captionY + 28, formula, 17, { w: 900 }),
  ];
  const data = {
    type: "excalidraw",
    version: 2,
    source: "generated",
    elements: all,
  };
  writeFileSync(resolve(outDir, `${name}.excalidraw.json`), JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 1: Original
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  // Reference input
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  // R → J1
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  // J1  (+ / −)
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  // J1 → J2
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  // J2  (+ / +)
  els.push(...summingJunction(J2_X, Y, 25, "+", "+"));
  // J2 → G1
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  // G₁
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  // G1 → J3
  els.push(arrow(G1_X + 50, Y, J3_X - 25, Y));
  // J3  (+ / −)
  els.push(...summingJunction(J3_X, Y, 25, "+", "−"));
  // J3 → G2
  els.push(arrow(J3_X + 25, Y, G2_X - 50, Y));
  // G₂
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  // G2 → G3
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  // G₃
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  // G3 → C
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // ── H₁ feedback ──
  const tapH1 = (G2_X + G3_X) / 2;   // between G₂ and G₃
  els.push(vLine(tapH1, Y + 30, FB_H1_Y));
  els.push(...rect(tapH1 - 40, FB_H1_Y, 80, 50, "H₁"));
  els.push(hLine(FB_H1_Y + 50, J2_X, tapH1));
  els.push(vLine(J2_X, Y + 25, FB_H1_Y + 50));
  els.push(arrow(J2_X, FB_H1_Y + 50, J2_X, Y + 25));

  // ── H₂ feedback ──
  const tapH2 = C_X - 40;
  els.push(vLine(tapH2, Y - 30, FB_H2_Y));
  els.push(...rect(tapH2 - 40, FB_H2_Y - 50, 80, 50, "H₂"));
  els.push(hLine(FB_H2_Y, J3_X, tapH2));
  els.push(vLine(J3_X, FB_H2_Y, Y - 25));
  els.push(arrow(J3_X, FB_H2_Y, J3_X, Y - 25));

  // ── Outer feedback C → J1 ──
  els.push(vLine(R_X + 10, Y, FB_OUTER_Y));
  els.push(hLine(FB_OUTER_Y, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, FB_OUTER_Y));
  els.push(arrow(J1_X, FB_OUTER_Y, J1_X, Y + 25));

  makeBoard("step-01-original", els,
    "Original system — find C/R",
    "C/R = ?");
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 2: Shift H₁ pickoff past G₃
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...summingJunction(J2_X, Y, 25, "+", "+"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  els.push(arrow(G1_X + 50, Y, J3_X - 25, Y));
  els.push(...summingJunction(J3_X, Y, 25, "+", "−"));
  els.push(arrow(J3_X + 25, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // H₁/G₃ from C down to J2
  const tapH1 = C_X - 40;
  els.push(vLine(tapH1, Y + 30, FB_H1_Y));
  els.push(...rect(tapH1 - 55, FB_H1_Y, 110, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H1_Y + 50, J2_X, tapH1));
  els.push(vLine(J2_X, Y + 25, FB_H1_Y + 50));
  els.push(arrow(J2_X, FB_H1_Y + 50, J2_X, Y + 25));

  // H₂ unchanged
  const tapH2 = C_X - 110;
  els.push(vLine(tapH2, Y - 30, FB_H2_Y));
  els.push(...rect(tapH2 - 40, FB_H2_Y - 50, 80, 50, "H₂"));
  els.push(hLine(FB_H2_Y, J3_X, tapH2));
  els.push(vLine(J3_X, FB_H2_Y, Y - 25));
  els.push(arrow(J3_X, FB_H2_Y, J3_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, FB_OUTER_Y));
  els.push(hLine(FB_OUTER_Y, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, FB_OUTER_Y));
  els.push(arrow(J1_X, FB_OUTER_Y, J1_X, Y + 25));

  makeBoard("step-02-shift-h1", els,
    "Move H₁ pickoff past G₃",
    "H₁ → H₁/G₃");
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 3: Shift H₂ left past G₂
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...summingJunction(J2_X, Y, 25, "+", "+"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));

  // J3 now at output of G₁ (keep same spacing as original J3)
  const J3new_X = J3_X;
  els.push(arrow(G1_X + 50, Y, J3new_X - 25, Y));
  els.push(...summingJunction(J3new_X, Y, 25, "+", "−"));
  els.push(arrow(J3new_X + 25, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // H₁/G₃ unchanged
  const tapH1 = C_X - 40;
  els.push(vLine(tapH1, Y + 30, FB_H1_Y));
  els.push(...rect(tapH1 - 55, FB_H1_Y, 110, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H1_Y + 50, J2_X, tapH1));
  els.push(vLine(J2_X, Y + 25, FB_H1_Y + 50));
  els.push(arrow(J2_X, FB_H1_Y + 50, J2_X, Y + 25));

  // H₂/G₂ from C up to new J3
  const tapH2 = C_X - 110;
  els.push(vLine(tapH2, Y - 30, FB_H2_Y));
  els.push(...rect(tapH2 - 55, FB_H2_Y - 50, 110, 50, "H₂/G₂", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H2_Y, J3new_X, tapH2));
  els.push(vLine(J3new_X, FB_H2_Y, Y - 25));
  els.push(arrow(J3new_X, FB_H2_Y, J3new_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, FB_OUTER_Y));
  els.push(hLine(FB_OUTER_Y, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, FB_OUTER_Y));
  els.push(arrow(J1_X, FB_OUTER_Y, J1_X, Y + 25));

  makeBoard("step-03-shift-h2-past-g2", els,
    "Move H₂ junction past G₂",
    "H₂ → H₂/G₂");
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 4: Combine summing junctions
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  // Combined junction — keep explicit signs
  els.push(...summingJunction(J2_X, Y, 25, "+", "−"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  els.push(arrow(G1_X + 50, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // H₁/G₃
  const tapH1 = C_X - 40;
  els.push(vLine(tapH1, Y + 30, FB_H1_Y));
  els.push(...rect(tapH1 - 55, FB_H1_Y, 110, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H1_Y + 50, J2_X, tapH1));
  els.push(vLine(J2_X, Y + 25, FB_H1_Y + 50));
  els.push(arrow(J2_X, FB_H1_Y + 50, J2_X, Y + 25));

  // H₂/(G₁G₂)
  const tapH2 = C_X - 110;
  els.push(vLine(tapH2, Y - 30, FB_H2_Y));
  els.push(...rect(tapH2 - 80, FB_H2_Y - 50, 160, 50, "H₂/(G₁G₂)", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H2_Y, J2_X, tapH2));
  els.push(vLine(J2_X, FB_H2_Y, Y - 25));
  els.push(arrow(J2_X, FB_H2_Y, J2_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, FB_OUTER_Y));
  els.push(hLine(FB_OUTER_Y, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, FB_OUTER_Y));
  els.push(arrow(J1_X, FB_OUTER_Y, J1_X, Y + 25));

  makeBoard("step-04-combine-junctions", els,
    "Combine summing junctions",
    "J₂ now receives both feedbacks");
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 5: Combine cascade
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...summingJunction(J2_X, Y, 25, "+", "−"));
  const Gcombo_X = 640;
  els.push(arrow(J2_X + 25, Y, Gcombo_X - 80, Y));
  els.push(...rect(Gcombo_X - 80, Y - 35, 160, 70, "G₁G₂G₃", { bg: "#fff8e1" }));
  els.push(arrow(Gcombo_X + 80, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // H₁/G₃
  const tapH1 = C_X - 40;
  els.push(vLine(tapH1, Y + 30, FB_H1_Y));
  els.push(...rect(tapH1 - 55, FB_H1_Y, 110, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H1_Y + 50, J2_X, tapH1));
  els.push(vLine(J2_X, Y + 25, FB_H1_Y + 50));
  els.push(arrow(J2_X, FB_H1_Y + 50, J2_X, Y + 25));

  // H₂/(G₁G₂)
  const tapH2 = C_X - 110;
  els.push(vLine(tapH2, Y - 30, FB_H2_Y));
  els.push(...rect(tapH2 - 80, FB_H2_Y - 50, 160, 50, "H₂/(G₁G₂)", { bg: "#e8f4ff" }));
  els.push(hLine(FB_H2_Y, J2_X, tapH2));
  els.push(vLine(J2_X, FB_H2_Y, Y - 25));
  els.push(arrow(J2_X, FB_H2_Y, J2_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, FB_OUTER_Y));
  els.push(hLine(FB_OUTER_Y, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, FB_OUTER_Y));
  els.push(arrow(J1_X, FB_OUTER_Y, J1_X, Y + 25));

  makeBoard("step-05-combine-cascade", els,
    "Combine cascade blocks",
    "G₁·G₂·G₃");
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARD 6: Final closed-loop form
// ═══════════════════════════════════════════════════════════════════════════
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22, { w: 40 }));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...summingJunction(J1_X, Y, 25, "+", "−"));
  const Gcombo_X = 580;
  els.push(arrow(J1_X + 25, Y, Gcombo_X - 80, Y));
  els.push(...rect(Gcombo_X - 80, Y - 35, 160, 70, "G₁G₂G₃", { bg: "#fff8e1" }));
  els.push(arrow(Gcombo_X + 80, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22, { w: 40 }));

  // Feedback path: C ↓ [H_eq] ↓ ←←←←←← J1 ↑
  // Place H_eq on the vertical drop from C, then continue down and loop back.
  const heqW = 240;
  const heqH = 60;
  const heqX = C_X - 40 - heqW / 2;   // centered under C tap
  const heqY = Y + 140;                // well below main path

  // C → down to H_eq
  els.push(vLine(C_X - 40, Y + 30, heqY));
  // H_eq block
  els.push(...rect(heqX, heqY, heqW, heqH,
    "H_eq = 1 − H₁/G₃ + H₂/(G₁G₂)", { bg: "#e8f4ff", tw: heqW - 8, fs: 18 }));
  // Continue down from H_eq to loop-back level
  const loopY = heqY + heqH + 60;      // 60 px below H_eq
  els.push(vLine(C_X - 40, heqY + heqH, loopY));
  // Horizontal back to J1
  els.push(hLine(loopY, J1_X, C_X - 40));
  // Up into J1
  els.push(vLine(J1_X, Y + 25, loopY));
  els.push(arrow(J1_X, loopY, J1_X, Y + 25));

  makeBoard("step-06-final", els,
    "Final closed-loop form",
    "C/R = G₁G₂G₃ / (1 + G₁G₂G₃ − G₁G₂H₁ + G₂G₃H₂)");
}

console.log("Generated 6 boards in:", outDir);
