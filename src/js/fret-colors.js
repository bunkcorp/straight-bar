/**
 * Fixed rainbow for frets 0–12 (red → purple).
 * Single source for highway pills, neck lights, and CSS --fret-N vars.
 */
const FRET_PALETTE = Object.freeze([
  { bg: '#E53935', ink: '#fff8f0' }, // 0 red
  { bg: '#F57C00', ink: '#fff8f0' }, // 1 orange
  { bg: '#FFB300', ink: '#1a120e' }, // 2 amber
  { bg: '#FDD835', ink: '#1a120e' }, // 3 yellow
  { bg: '#C0CA33', ink: '#1a120e' }, // 4 lime
  { bg: '#43A047', ink: '#fff8f0' }, // 5 green
  { bg: '#00897B', ink: '#fff8f0' }, // 6 teal
  { bg: '#00ACC1', ink: '#1a120e' }, // 7 cyan
  { bg: '#1E88E5', ink: '#fff8f0' }, // 8 blue
  { bg: '#3949AB', ink: '#fff8f0' }, // 9 indigo
  { bg: '#5E35B1', ink: '#fff8f0' }, // 10 violet-blue
  { bg: '#8E24AA', ink: '#fff8f0' }, // 11 purple
  { bg: '#AB47BC', ink: '#fff8f0' }, // 12 magenta-purple
]);

export function clampFret(fret) {
  const n = Number(fret);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(12, Math.round(n)));
}

export function colorForFret(fret) {
  return FRET_PALETTE[clampFret(fret)];
}

/** Fret index → background hex (for docs / debugging). */
export function fretHexMap() {
  return Object.fromEntries(FRET_PALETTE.map((swatch, fret) => [fret, swatch.bg]));
}

/** Install --fret-0…--fret-12 and --fret-ink-0… on :root. */
export function applyFretColorVars(root = document.documentElement) {
  FRET_PALETTE.forEach((swatch, fret) => {
    root.style.setProperty(`--fret-${fret}`, swatch.bg);
    root.style.setProperty(`--fret-ink-${fret}`, swatch.ink);
  });
}
