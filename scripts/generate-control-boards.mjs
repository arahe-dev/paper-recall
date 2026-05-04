// @ts-check
/**
 * Generate 6 Excalidraw boards showing step-by-step block diagram reduction.
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
  const labelText = {
    ...base(),
    type: "text",
    x: x + 4,
    y: y + h / 2 - 14,
    width: w - 8,
    height: 28,
    text: label,
    fontSize: 20,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "top",
    strokeColor: "#1e1e1e",
    roughness: 0,
    opacity: 100,
  };
  return [shape, labelText];
}

function circle(x, y, r, topSign, bottomSign, opts = {}) {
  const els = [];
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
  // Cross lines
  els.push({
    ...base(),
    type: "line",
    x: x - r + 6,
    y,
    width: r * 2 - 12,
    height: 0,
    strokeColor: "#1e1e1e",
    strokeWidth: 1.5,
    roughness: 0,
    points: [[0, 0], [r * 2 - 12, 0]],
  });
  els.push({
    ...base(),
    type: "line",
    x,
    y: y - r + 6,
    width: 0,
    height: r * 2 - 12,
    strokeColor: "#1e1e1e",
    strokeWidth: 1.5,
    roughness: 0,
    points: [[0, 0], [0, r * 2 - 12]],
  });
  // Signs
  const off = r * 0.45;
  if (topSign) {
    els.push(text(x, y - off, topSign, 18));
  }
  if (bottomSign) {
    els.push(text(x, y + off - 6, bottomSign, 18));
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

const Y = 320;
const R_X = 60;
const J1_X = 170;
const J2_X = 280;
const G1_X = 400;
const J3_X = 540;
const G2_X = 660;
const G3_X = 800;
const C_X = 940;

function makeBoard(name, elements, caption, formula) {
  const captionY = 540;
  const all = [
    ...elements,
    text(60, captionY, `Step: ${caption}`, 18),
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

// ========== BOARD 1: Original ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...circle(J2_X, Y, 25, "+", "+"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  els.push(arrow(G1_X + 50, Y, J3_X - 25, Y));
  els.push(...circle(J3_X, Y, 25, "+", "−"));
  els.push(arrow(J3_X + 25, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // H1 from G2 output down to J2
  const tapX = (G2_X + G3_X) / 2 - 10;
  els.push(vLine(tapX, Y + 30, Y + 110));
  els.push(...rect(tapX - 35, Y + 110, 70, 50, "H₁"));
  els.push(hLine(Y + 160, J2_X, tapX));
  els.push(vLine(J2_X, Y + 25, Y + 160));
  els.push(arrow(J2_X, Y + 160, J2_X, Y + 25));

  // H2 from C up to J3
  const tapX2 = C_X - 30;
  els.push(vLine(tapX2, Y - 30, Y - 110));
  els.push(...rect(tapX2 - 35, Y - 160, 70, 50, "H₂"));
  els.push(hLine(Y - 160, J3_X, tapX2));
  els.push(vLine(J3_X, Y - 160, Y - 25));
  els.push(arrow(J3_X, Y - 160, J3_X, Y - 25));

  // Outer feedback C → J1
  els.push(vLine(R_X + 10, Y, Y + 180));
  els.push(hLine(Y + 180, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, Y + 180));
  els.push(arrow(J1_X, Y + 180, J1_X, Y + 25));

  makeBoard("step-01-original", els, "Original block diagram", "C/R = ?");
}

// ========== BOARD 2: Shift H1 pickoff past G3 ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...circle(J2_X, Y, 25, "+", "+"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  els.push(arrow(G1_X + 50, Y, J3_X - 25, Y));
  els.push(...circle(J3_X, Y, 25, "+", "−"));
  els.push(arrow(J3_X + 25, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // H1/G3 from C down to J2
  const tapX = C_X - 30;
  els.push(vLine(tapX, Y + 30, Y + 110));
  els.push(...rect(tapX - 50, Y + 110, 100, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(Y + 160, J2_X, tapX));
  els.push(vLine(J2_X, Y + 25, Y + 160));
  els.push(arrow(J2_X, Y + 160, J2_X, Y + 25));

  // H2 from C up to J3
  const tapX2 = C_X - 80;
  els.push(vLine(tapX2, Y - 30, Y - 110));
  els.push(...rect(tapX2 - 35, Y - 160, 70, 50, "H₂"));
  els.push(hLine(Y - 160, J3_X, tapX2));
  els.push(vLine(J3_X, Y - 160, Y - 25));
  els.push(arrow(J3_X, Y - 160, J3_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, Y + 180));
  els.push(hLine(Y + 180, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, Y + 180));
  els.push(arrow(J1_X, Y + 180, J1_X, Y + 25));

  // Annotation
  els.push(text(60, 500, "Rule: Move pickoff forward past block → divide by that block", 16, { w: 800 }));

  makeBoard("step-02-shift-h1", els, "Shift H₁ pickoff past G₃", "H₁ → H₁/G₃");
}

// ========== BOARD 3: Shift H2 left past G2 ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...circle(J2_X, Y, 25, "+", "+"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  // J3 is now at output of G1
  const J3new_X = G1_X + 60;
  els.push(arrow(G1_X + 50, Y, J3new_X - 25, Y));
  els.push(...circle(J3new_X, Y, 25, "+", "−"));
  els.push(arrow(J3new_X + 25, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // H1/G3 from C down to J2
  const tapX = C_X - 30;
  els.push(vLine(tapX, Y + 30, Y + 110));
  els.push(...rect(tapX - 50, Y + 110, 100, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(Y + 160, J2_X, tapX));
  els.push(vLine(J2_X, Y + 25, Y + 160));
  els.push(arrow(J2_X, Y + 160, J2_X, Y + 25));

  // H2/G2 from C up to J3 (now at G1 output)
  const tapX2 = C_X - 80;
  els.push(vLine(tapX2, Y - 30, Y - 90));
  els.push(...rect(tapX2 - 55, Y - 140, 110, 50, "H₂/G₂", { bg: "#e8f4ff" }));
  els.push(hLine(Y - 140, J3new_X, tapX2));
  els.push(vLine(J3new_X, Y - 140, Y - 25));
  els.push(arrow(J3new_X, Y - 140, J3new_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, Y + 180));
  els.push(hLine(Y + 180, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, Y + 180));
  els.push(arrow(J1_X, Y + 180, J1_X, Y + 25));

  els.push(text(60, 500, "Rule: Move summing junction left past block → divide feedback by that block", 16, { w: 800 }));

  makeBoard("step-03-shift-h2-past-g2", els, "Shift H₂ left past G₂", "H₂ → H₂/G₂");
}

// ========== BOARD 4: Shift H2 left past G1, combine junctions ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  // Combined junction B/C
  els.push(...circle(J2_X, Y, 25, "+", "±"));
  els.push(arrow(J2_X + 25, Y, G1_X - 50, Y));
  els.push(...rect(G1_X - 50, Y - 30, 100, 60, "G₁"));
  els.push(arrow(G1_X + 50, Y, G2_X - 50, Y));
  els.push(...rect(G2_X - 50, Y - 30, 100, 60, "G₂"));
  els.push(arrow(G2_X + 50, Y, G3_X - 50, Y));
  els.push(...rect(G3_X - 50, Y - 30, 100, 60, "G₃"));
  els.push(arrow(G3_X + 50, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // H1/G3 from C down to combined junction
  const tapX = C_X - 30;
  els.push(vLine(tapX, Y + 30, Y + 110));
  els.push(...rect(tapX - 55, Y + 110, 110, 50, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(Y + 160, J2_X, tapX));
  els.push(vLine(J2_X, Y + 25, Y + 160));
  els.push(arrow(J2_X, Y + 160, J2_X, Y + 25));

  // H2/(G1G2) from C up to combined junction
  const tapX2 = C_X - 90;
  els.push(vLine(tapX2, Y - 30, Y - 90));
  els.push(...rect(tapX2 - 70, Y - 140, 140, 50, "H₂/(G₁G₂)", { bg: "#e8f4ff" }));
  els.push(hLine(Y - 140, J2_X, tapX2));
  els.push(vLine(J2_X, Y - 140, Y - 25));
  els.push(arrow(J2_X, Y - 140, J2_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, Y + 180));
  els.push(hLine(Y + 180, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, Y + 180));
  els.push(arrow(J1_X, Y + 180, J1_X, Y + 25));

  els.push(text(60, 500, "Rule: Move summing junction left past G₁ → H₂/G₂ → H₂/(G₁G₂); then combine junctions", 15, { w: 800 }));

  makeBoard("step-04-combine-junctions", els, "Combine summing junctions B & C", "Single junction with multiple feedbacks");
}

// ========== BOARD 5: Combine cascade G1G2G3 ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  els.push(arrow(J1_X + 25, Y, J2_X - 25, Y));
  els.push(...circle(J2_X, Y, 25, "+", "±"));
  const Gcombo_X = 600;
  els.push(arrow(J2_X + 25, Y, Gcombo_X - 70, Y));
  els.push(...rect(Gcombo_X - 70, Y - 35, 140, 70, "G₁G₂G₃", { bg: "#fff8e1" }));
  els.push(arrow(Gcombo_X + 70, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // Combined feedback H_eq drawn as parallel paths
  const tapX = C_X - 30;
  // Path 2: H1/G3
  els.push(vLine(tapX, Y + 30, Y + 90));
  els.push(...rect(tapX - 55, Y + 90, 110, 45, "H₁/G₃", { bg: "#e8f4ff" }));
  els.push(hLine(Y + 135, J2_X, tapX));
  els.push(vLine(J2_X, Y + 25, Y + 135));
  els.push(arrow(J2_X, Y + 135, J2_X, Y + 25));

  // Path 3: H2/(G1G2)
  const tapX2 = C_X - 100;
  els.push(vLine(tapX2, Y - 30, Y - 80));
  els.push(...rect(tapX2 - 70, Y - 125, 140, 45, "H₂/(G₁G₂)", { bg: "#e8f4ff" }));
  els.push(hLine(Y - 125, J2_X, tapX2));
  els.push(vLine(J2_X, Y - 125, Y - 25));
  els.push(arrow(J2_X, Y - 125, J2_X, Y - 25));

  // Outer feedback
  els.push(vLine(R_X + 10, Y, Y + 160));
  els.push(hLine(Y + 160, R_X + 10, J1_X));
  els.push(vLine(J1_X, Y + 25, Y + 160));
  els.push(arrow(J1_X, Y + 160, J1_X, Y + 25));

  els.push(text(60, 500, "Rule: Cascade blocks multiply: G₁·G₂·G₃", 16));

  makeBoard("step-05-combine-cascade", els, "Combine G₁G₂G₃ cascade", "Forward path = G₁G₂G₃");
}

// ========== BOARD 6: Final closed-loop form ==========
{
  const els = [];
  els.push(text(R_X - 10, Y - 12, "R", 22));
  els.push(arrow(R_X + 10, Y, J1_X - 25, Y));
  els.push(...circle(J1_X, Y, 25, "+", "−"));
  const Gcombo_X = 550;
  els.push(arrow(J1_X + 25, Y, Gcombo_X - 80, Y));
  els.push(...rect(Gcombo_X - 80, Y - 40, 160, 80, "G₁G₂G₃", { bg: "#fff8e1" }));
  els.push(arrow(Gcombo_X + 80, Y, C_X - 10, Y));
  els.push(text(C_X, Y - 12, "C", 22));

  // Combined H_eq feedback block
  const Heq_X = 780;
  const Heq_Y = Y + 140;
  els.push(vLine(C_X - 30, Y + 30, Heq_Y));
  els.push(...rect(Heq_X - 130, Heq_Y - 35, 260, 70, "H_eq = 1 − H₁/G₃ + H₂/(G₁G₂)", { bg: "#e8f4ff" }));
  els.push(hLine(Heq_Y, J1_X, C_X - 30));
  els.push(vLine(J1_X, Y + 25, Heq_Y));
  els.push(arrow(J1_X, Heq_Y, J1_X, Y + 25));

  makeBoard("step-06-final", els, "Apply negative feedback formula", "C/R = G₁G₂G₃ / (1 + G₁G₂G₃ − G₁G₂H₁ + G₂G₃H₂)");
}

console.log("Generated 6 boards in:", outDir);
