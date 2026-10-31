export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TILE_MARGIN = 16;

const contains = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;

export function resolvePosition(
  saved: { x: number; y: number } | null,
  workAreas: Rect[],
  primary: Rect,
  size: { width: number; height: number },
): { x: number; y: number } {
  if (saved) {
    const cx = saved.x + size.width / 2;
    const cy = saved.y + size.height / 2;
    if (workAreas.some((r) => contains(r, cx, cy))) return saved;
  }
  return { x: primary.x + TILE_MARGIN, y: primary.y + TILE_MARGIN };
}
