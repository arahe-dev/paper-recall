export type RecognizedShape = "rectangle" | "ellipse" | "diamond" | "arrow" | "line" | null;

export type GesturePoint = readonly [number, number] | readonly number[];

export type GestureRecognition = {
  shape: RecognizedShape;
  confidence: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
  start?: [number, number];
  end?: [number, number];
  simplified: [number, number][];
};

type Point = [number, number];

const MIN_POINTS = 4;
const MIN_SIZE = 14;
const SIMPLIFY_TOLERANCE = 5;

function toPoint(point: GesturePoint): Point | null {
  const x = Number(point[0]);
  const y = Number(point[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function boundsFor(points: readonly Point[]): GestureRecognition["bounds"] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1], points[i]);
  }
  return length;
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(point, start);
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) /
    Math.sqrt(lenSq);
}

function douglasPeucker(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];

  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const currentDistance = perpendicularDistance(points[i], start, end);
    if (currentDistance > maxDistance) {
      index = i;
      maxDistance = currentDistance;
    }
  }

  if (maxDistance <= tolerance) {
    return [start, end];
  }

  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function normalizedPoints(points: readonly GesturePoint[]): Point[] {
  const output: Point[] = [];
  for (const point of points) {
    const parsed = toPoint(point);
    if (!parsed) continue;
    const previous = output[output.length - 1];
    if (!previous || distance(previous, parsed) > 0.75) {
      output.push(parsed);
    }
  }
  return output;
}

function polygonArea(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function withoutClosingDuplicate(points: readonly Point[], closeThreshold: number): Point[] {
  if (points.length <= 2) return [...points];
  return distance(points[0], points[points.length - 1]) <= closeThreshold
    ? points.slice(0, -1)
    : [...points];
}

function cornerAngle(prev: Point, current: Point, next: Point): number {
  const ax = prev[0] - current[0];
  const ay = prev[1] - current[1];
  const bx = next[0] - current[0];
  const by = next[1] - current[1];
  const aLen = Math.hypot(ax, ay);
  const bLen = Math.hypot(bx, by);
  if (aLen === 0 || bLen === 0) return 180;
  const cosine = clamp01((ax * bx + ay * by) / (aLen * bLen) * 0.5 + 0.5) * 2 - 1;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function rectangleScore(corners: readonly Point[], bounds: GestureRecognition["bounds"], areaRatio: number): number {
  if (corners.length < 4 || corners.length > 6) return 0;
  const expected = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY],
  ] as Point[];
  const diagonal = Math.max(1, Math.hypot(bounds.width, bounds.height));
  let matched = 0;
  for (const target of expected) {
    const nearest = Math.min(...corners.map((corner) => distance(corner, target)));
    if (nearest / diagonal < 0.22) matched++;
  }
  const angleScores = corners.map((corner, index) => {
    const prev = corners[(index - 1 + corners.length) % corners.length];
    const next = corners[(index + 1) % corners.length];
    return clamp01(1 - Math.abs(cornerAngle(prev, corner, next) - 90) / 45);
  });
  const angleScore = angleScores.reduce((sum, value) => sum + value, 0) / Math.max(1, angleScores.length);
  const coverageScore = clamp01((areaRatio - 0.45) / 0.4);
  return clamp01((matched / 4) * 0.45 + angleScore * 0.35 + coverageScore * 0.2);
}

function diamondScore(corners: readonly Point[], bounds: GestureRecognition["bounds"], areaRatio: number): number {
  if (corners.length < 4 || corners.length > 6) return 0;
  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;
  const expected = [
    [cx, bounds.minY],
    [bounds.maxX, cy],
    [cx, bounds.maxY],
    [bounds.minX, cy],
  ] as Point[];
  const diagonal = Math.max(1, Math.hypot(bounds.width, bounds.height));
  let matched = 0;
  for (const target of expected) {
    const nearest = Math.min(...corners.map((corner) => distance(corner, target)));
    if (nearest / diagonal < 0.22) matched++;
  }
  const areaScore = clamp01(1 - Math.abs(areaRatio - 0.5) / 0.35);
  return clamp01((matched / 4) * 0.7 + areaScore * 0.3);
}

function ellipseScore(points: readonly Point[], bounds: GestureRecognition["bounds"], areaRatio: number): number {
  if (bounds.width < MIN_SIZE || bounds.height < MIN_SIZE) return 0;
  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx <= 0 || ry <= 0) return 0;

  const errors = points.map(([x, y]) => Math.abs(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 - 1));
  const meanError = errors.reduce((sum, value) => sum + value, 0) / Math.max(1, errors.length);
  const radialScore = clamp01(1 - meanError / 0.8);
  const areaScore = clamp01(1 - Math.abs(areaRatio - Math.PI / 4) / 0.35);
  const aspect = Math.max(bounds.width, bounds.height) / Math.max(1, Math.min(bounds.width, bounds.height));
  const aspectScore = aspect <= 4 ? 1 : clamp01(1 - (aspect - 4) / 4);
  return clamp01(radialScore * 0.5 + areaScore * 0.35 + aspectScore * 0.15);
}

function lineScore(points: readonly Point[]): { confidence: number; start: Point; end: Point } {
  const start = points[0];
  const end = points[points.length - 1];
  const direct = distance(start, end);
  const length = pathLength(points);
  if (direct < MIN_SIZE || length <= 0) return { confidence: 0, start, end };
  const maxDeviation = Math.max(...points.map((point) => perpendicularDistance(point, start, end)));
  const straightness = clamp01(1 - maxDeviation / Math.max(8, direct * 0.14));
  const efficiency = clamp01(direct / length);
  return {
    confidence: clamp01(straightness * 0.65 + efficiency * 0.35),
    start,
    end,
  };
}

function arrowScore(points: readonly Point[], simplified: readonly Point[]): { confidence: number; start: Point; end: Point } {
  if (points.length < 5 || simplified.length < 3) {
    return { confidence: 0, start: points[0], end: points[points.length - 1] };
  }

  const start = points[0];
  let tipIndex = 0;
  let tipDistance = 0;
  for (let i = 1; i < points.length; i++) {
    const currentDistance = distance(start, points[i]);
    if (currentDistance > tipDistance) {
      tipDistance = currentDistance;
      tipIndex = i;
    }
  }

  const tip = points[tipIndex];
  if (tipDistance < MIN_SIZE * 1.5) return { confidence: 0, start, end: tip };

  const preTip = points.slice(0, tipIndex + 1);
  const shaft = lineScore(preTip);
  const afterTip = points.slice(tipIndex + 1);
  const headLength = afterTip.reduce((max, point) => Math.max(max, distance(point, tip)), 0);
  const headReturnsToTip = afterTip.some((point, index) => index > 1 && distance(point, tip) < Math.max(8, tipDistance * 0.18));
  const hasHead = headLength > Math.max(8, tipDistance * 0.12) && headLength < tipDistance * 0.7;
  const tipAwayFromEnd = tipIndex < points.length - 2 || distance(points[points.length - 1], tip) < tipDistance * 0.28;
  const confidence = hasHead && tipAwayFromEnd
    ? clamp01(shaft.confidence * 0.55 + (headReturnsToTip ? 0.25 : 0.12) + 0.2)
    : 0;

  return { confidence, start, end: tip };
}

export function recognizeShape(
  points: readonly GesturePoint[],
  pressures: readonly number[] = []
): GestureRecognition {
  void pressures;
  const normalized = normalizedPoints(points);
  const emptyBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  if (normalized.length < MIN_POINTS) {
    return { shape: null, confidence: 0, bounds: emptyBounds, simplified: normalized };
  }

  const bounds = boundsFor(normalized);
  const diagonal = Math.hypot(bounds.width, bounds.height);
  if (bounds.width < MIN_SIZE && bounds.height < MIN_SIZE) {
    return { shape: null, confidence: 0, bounds, simplified: normalized };
  }

  const simplified = douglasPeucker(normalized, Math.max(SIMPLIFY_TOLERANCE, diagonal * 0.025));
  const closed = distance(normalized[0], normalized[normalized.length - 1]) <= Math.max(12, diagonal * 0.18);
  const corners = withoutClosingDuplicate(simplified, Math.max(12, diagonal * 0.18));
  const areaRatio = bounds.width > 0 && bounds.height > 0
    ? polygonArea(corners) / (bounds.width * bounds.height)
    : 0;

  const line = !closed ? lineScore(normalized) : { confidence: 0, start: normalized[0], end: normalized[normalized.length - 1] };
  const arrow = !closed ? arrowScore(normalized, simplified) : { confidence: 0, start: normalized[0], end: normalized[normalized.length - 1] };
  const rectangle = closed ? rectangleScore(corners, bounds, areaRatio) : 0;
  const diamond = closed ? diamondScore(corners, bounds, areaRatio) : 0;
  const ellipse = closed ? ellipseScore(normalized, bounds, areaRatio) : 0;

  const candidates: Array<{ shape: RecognizedShape; confidence: number; start?: Point; end?: Point }> = [
    { shape: "arrow", confidence: arrow.confidence, start: arrow.start, end: arrow.end },
    { shape: "line", confidence: line.confidence, start: line.start, end: line.end },
    { shape: "rectangle", confidence: rectangle },
    { shape: "diamond", confidence: diamond },
    { shape: "ellipse", confidence: ellipse },
  ];
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  return {
    shape: best.confidence > 0 ? best.shape : null,
    confidence: best.confidence,
    bounds,
    start: best.start,
    end: best.end,
    simplified,
  };
}
