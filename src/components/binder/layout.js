// Binder layouts: columns × rows of pockets per page.
export const PRESETS = [
  { cols: 2, rows: 2, label: '2 × 2' },
  { cols: 3, rows: 3, label: '3 × 3' },
  { cols: 4, rows: 3, label: '4 × 3' },
  { cols: 3, rows: 4, label: '3 × 4' },
  { cols: 5, rows: 4, label: '5 × 4' },
];
export const MAX = 8;
export const parseLayout = (s) => {
  const m = /^(\d)x(\d)$/.exec(s || '');
  if (!m) return null;
  const cols = +m[1], rows = +m[2];
  return cols >= 1 && rows >= 1 && cols <= MAX && rows <= MAX ? { cols, rows } : null;
};
export const layoutParam = (l) => `${l.cols}x${l.rows}`;
