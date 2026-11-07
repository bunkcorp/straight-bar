/**
 * Reusable lap-steel fretboard, as seen looking down at the lap.
 * String 1 (high E) is the far edge, at the top. String 6 (low C) is
 * nearest the player, at the bottom. Fret 0 is the nut on the left.
 * Pass a tuning and the notes to mark; the drawing does not know
 * which exercise it is serving.
 */
const NUT_X = 118;
const FRET_12_X = 930;
const SCALE = 2 * (FRET_12_X - NUT_X);
const TOP = 78;
const BOTTOM = 300;

function fretX(fret) {
  return NUT_X + SCALE * (1 - 2 ** (-fret / 12));
}

function stringY(stringNumber) {
  return TOP + ((stringNumber - 1) / 5) * (BOTTOM - TOP);
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function nearestFret(x) {
  let best = 0;
  let bestDist = Infinity;
  for (let fret = 0; fret <= 12; fret += 1) {
    const dist = Math.abs(fretX(fret) - x);
    if (dist < bestDist) {
      best = fret;
      bestDist = dist;
    }
  }
  return best;
}

function nearestString(y) {
  let best = null;
  let bestDist = 26;
  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const dist = Math.abs(stringY(stringNumber) - y);
    if (dist < bestDist) {
      best = stringNumber;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * @param {HTMLElement} mount
 * @param {{
 *   tuning: {string:number, note:string, midi:number}[],
 *   markers?: {string:number, fret:number, tone:'bass'|'treble'|'chord'|'guess', name:string}[],
 *   showAllNotes?: boolean,
 *   noteAt?: (string:number, fret:number) => {name:string},
 *   barFret?: number|null,
 *   onPosition?: (pos:{string:number, fret:number}) => void,
 *   liveString?: number|null,
 *   liveStrings?: number[],
 * }} options
 */
export function renderFretboard(mount, options = {}) {
  const tuning = options.tuning || [];
  const markers = options.markers || [];
  const marked = new Set(markers.map((marker) => `${marker.string}:${marker.fret}`));
  const byString = new Map(tuning.map((item) => [item.string, item]));
  const live = new Set(
    options.liveStrings
      || (options.liveString != null ? [options.liveString] : []),
  );

  const frets = [];
  const numbers = [];
  const inlays = [];
  for (let fret = 0; fret <= 12; fret += 1) {
    const x = fretX(fret);
    if (fret > 0) {
      frets.push(`<line class="fretwire" x1="${x}" y1="${TOP - 14}" x2="${x}" y2="${BOTTOM + 14}" />`);
    }
    numbers.push(`<text class="fretnum" x="${x}" y="352">${fret}</text>`);
    if ([3, 5, 7, 9].includes(fret)) {
      const prev = fretX(fret - 1);
      inlays.push(`<circle class="inlay" cx="${(prev + x) / 2}" cy="${(TOP + BOTTOM) / 2}" r="7" />`);
    }
    if (fret === 12) {
      const prev = fretX(11);
      const cx = (prev + x) / 2;
      inlays.push(`<circle class="inlay" cx="${cx}" cy="${(TOP + BOTTOM) / 2 - 36}" r="7" />`);
      inlays.push(`<circle class="inlay" cx="${cx}" cy="${(TOP + BOTTOM) / 2 + 36}" r="7" />`);
    }
  }

  const under = [];
  const strings = [];
  for (let stringNumber = 6; stringNumber >= 1; stringNumber -= 1) {
    const y = stringY(stringNumber);
    const gauge = [0, 1.35, 1.55, 1.9, 2.45, 2.85, 3.25][stringNumber];
    const wound = stringNumber >= 4;
    const isLive = live.has(stringNumber);
    const liveClass = isLive ? ' live' : '';
    under.push(
      `<line class="string-under${liveClass}" data-string="${stringNumber}" x1="${NUT_X}" y1="${y}" x2="968" y2="${y}" stroke-width="14" />`,
    );
    strings.push(
      `<line class="string ${wound ? 'wound' : 'plain'}${liveClass}" data-string="${stringNumber}" data-gauge="${gauge}" x1="${NUT_X}" y1="${y}" x2="968" y2="${y}" stroke-width="${isLive ? Math.max(gauge, 6) : gauge}"${isLive ? ' filter="url(#live-glow)"' : ''} />`,
    );
  }

  const labels = [1, 2, 3, 4, 5, 6].map((stringNumber) => {
    const open = byString.get(stringNumber);
    const y = stringY(stringNumber);
    return `<text class="string-label" x="18" y="${y + 4}">${stringNumber}</text>
      <text class="string-note" x="40" y="${y + 4}">${open ? open.note : ''}</text>`;
  }).join('');

  const grid = [];
  if (options.showAllNotes && options.noteAt) {
    for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
      for (let fret = 0; fret <= 12; fret += 1) {
        if (marked.has(`${stringNumber}:${fret}`)) continue;
        const name = options.noteAt(stringNumber, fret).name;
        grid.push(
          `<text class="fb-grid-name" x="${fretX(fret)}" y="${stringY(stringNumber) - 14}">${name}</text>`,
        );
      }
    }
  }

  const circles = markers.map((marker) => {
    const x = fretX(marker.fret);
    const y = stringY(marker.string);
    const tone = marker.tone || 'chord';
    return `<g class="fb-mark">
      <circle class="fb-note ${tone}" cx="${x}" cy="${y}" r="12" />
      <text class="fb-note-name ${tone}" x="${x}" y="${y + 4}">${marker.name}</text>
    </g>`;
  }).join('');

  let bar = '';
  if (options.barFret != null) {
    const x = fretX(options.barFret);
    bar = `<line class="bar" x1="${x}" y1="${TOP - 18}" x2="${x}" y2="${BOTTOM + 18}" />
      <line class="bar-shine" x1="${x}" y1="${TOP - 18}" x2="${x}" y2="${BOTTOM + 18}" />`;
  }

  const low = byString.get(6);
  const high = byString.get(1);
  const svg = `
    <svg viewBox="0 0 1000 390" class="neck${options.onPosition ? ' clickable' : ''}" role="img" aria-label="Sixths fretboard, nut at the left">
      <defs>
        <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5a3428"/>
          <stop offset="0.45" stop-color="#3b2218"/>
          <stop offset="1" stop-color="#2a1812"/>
        </linearGradient>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fbf8f3"/>
          <stop offset="0.45" stop-color="#c5ced4"/>
          <stop offset="1" stop-color="#6e777e"/>
        </linearGradient>
        <filter id="live-glow" x="-120%" y="-120%" width="340%" height="340%" color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="blur"/>
          <feFlood flood-color="#39ff14" flood-opacity="0.95" result="color"/>
          <feComposite in="color" in2="blur" operator="in" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <text class="edge-label" x="540" y="28">high ${high ? high.note : ''} · far side</text>
      <rect class="board" x="96" y="52" width="874" height="274" rx="10" />
      ${inlays.join('')}
      ${frets.join('')}
      <rect class="nut" x="${NUT_X - 9}" y="${TOP - 16}" width="11" height="${BOTTOM - TOP + 32}" rx="2" />
      ${under.join('')}
      ${strings.join('')}
      ${grid.join('')}
      ${bar}
      ${circles}
      ${labels}
      ${numbers.join('')}
      <text class="edge-label near" x="540" y="382">low ${low ? low.note : ''} · near you</text>
    </svg>`;

  mount.innerHTML = svg;
  const svgEl = mount.querySelector('svg');
  if (!options.onPosition || !svgEl) return;
  svgEl.addEventListener('click', (event) => {
    const mapped = svgPoint(svgEl, event);
    if (mapped.y < TOP - 24 || mapped.y > BOTTOM + 28) return;
    if (mapped.x < NUT_X - 24 || mapped.x > fretX(12) + 28) return;
    const stringNumber = nearestString(mapped.y);
    if (stringNumber == null) return;
    options.onPosition({ string: stringNumber, fret: nearestFret(mapped.x) });
  });
}
