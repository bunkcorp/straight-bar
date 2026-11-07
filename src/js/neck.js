import { colorForFret } from './fret-colors.js';
import { STRINGS, midiToName } from './theory.js';

const NUT_X = 118;
const FRET_12_X = 930;
const SCALE = 2 * (FRET_12_X - NUT_X);
const TOP = 78;
const BOTTOM = 300;

function fretX(fret) {
  return NUT_X + SCALE * (1 - 2 ** (-fret / 12));
}

function stringY(stringNumber) {
  const t = (stringNumber - 1) / 5;
  return TOP + t * (BOTTOM - TOP);
}

function extend(x1, y1, x2, y2, extra) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return [x2 + (dx / len) * extra, y2 + (dy / len) * extra];
}

function barEndpoints(bar) {
  if (!bar || bar.open || bar.fromString == null) return null;
  let x1 = fretX(bar.fromFret);
  let y1 = stringY(bar.fromString);
  let x2 = fretX(bar.toFret);
  let y2 = stringY(bar.toString);
  if (Math.hypot(x2 - x1, y2 - y1) < 2) {
    y1 -= 24;
    y2 += 24;
    x2 = x1;
  }
  const [sx, sy] = extend(x2, y2, x1, y1, 16);
  const [ex, ey] = extend(x1, y1, x2, y2, 16);
  return { x1: sx, y1: sy, x2: ex, y2: ey };
}

function woodDefs() {
  return `
    <defs>
      <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a3428"/>
        <stop offset="0.45" stop-color="#3b2218"/>
        <stop offset="1" stop-color="#2a1812"/>
      </linearGradient>
      <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbf8f3"/>
        <stop offset="0.42" stop-color="#c5ced4"/>
        <stop offset="1" stop-color="#6e777e"/>
      </linearGradient>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.2" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
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
    </defs>`;
}

function drawBar(bar, ghost) {
  const ends = barEndpoints(bar);
  if (!ends) return '';
  const cls = ghost ? 'bar ghost' : 'bar';
  return `
    <line class="${cls}" x1="${ends.x1}" y1="${ends.y1}" x2="${ends.x2}" y2="${ends.y2}" />
    ${ghost ? '' : `<line class="bar-shine" x1="${ends.x1}" y1="${ends.y1}" x2="${ends.x2}" y2="${ends.y2}" />`}`;
}

/**
 * @param {HTMLElement} mount
 * @param {object|null} bar
 * @param {{ ghost?: object, marks?: {fret:number,state:string}[], onFret?: function, demo?: boolean, liveString?: number|null, liveStrings?: number[] }} options
 */
export function renderNeck(mount, bar, options = {}) {
  const picked = new Set(bar?.picked || []);
  const muted = new Set(bar?.muted || []);
  const live = new Set(
    options.liveStrings
      || (options.liveString != null ? [options.liveString] : []),
  );
  const under = [];
  const strings = [];
  for (let stringNumber = 6; stringNumber >= 1; stringNumber -= 1) {
    const y = stringY(stringNumber);
    const gauge = [0, 1.35, 1.55, 1.9, 2.45, 2.85, 3.25][stringNumber];
    const wound = stringNumber >= 4;
    const state = picked.has(stringNumber) ? 'pick' : muted.has(stringNumber) ? 'mute' : 'idle';
    const isLive = live.has(stringNumber);
    const liveClass = isLive ? ' live' : '';
    // Soft green under-glow (mute marks never block matching or this layer).
    under.push(
      `<line class="string-under${liveClass}" data-string="${stringNumber}" x1="${NUT_X}" y1="${y}" x2="968" y2="${y}" stroke-width="14" />`,
    );
    strings.push(
      `<line class="string ${state} ${wound ? 'wound' : 'plain'}${liveClass}" data-string="${stringNumber}" data-gauge="${gauge}" x1="${NUT_X}" y1="${y}" x2="968" y2="${y}" stroke-width="${isLive ? Math.max(gauge, 6) : gauge}"${isLive ? ' filter="url(#live-glow)"' : ''} />`,
    );
    if (muted.has(stringNumber)) {
      strings.push(
        `<text class="mute-mark" x="978" y="${y + 4}">×</text>`,
      );
    }
  }

  const frets = [];
  const numbers = [];
  const inlays = [];
  for (let fret = 0; fret <= 12; fret += 1) {
    const x = fretX(fret);
    if (fret > 0) {
      frets.push(`<line class="fretwire" x1="${x}" y1="${TOP - 14}" x2="${x}" y2="${BOTTOM + 14}" />`);
    }
    const marked = (options.marks || []).find((mark) => mark.fret === fret);
    const numClass = marked ? `fretnum ${marked.state}` : 'fretnum';
    numbers.push(`<text class="${numClass}" x="${x}" y="352">${fret}</text>`);
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

  const labels = [1, 2, 3, 4, 5, 6].map((stringNumber) => {
    const open = midiToName(STRINGS.find((item) => item.string === stringNumber).midi).name;
    const y = stringY(stringNumber);
    return `<text class="string-label" x="18" y="${y + 4}">${stringNumber}</text>
      <text class="string-note" x="40" y="${y + 4}">${open}</text>`;
  }).join('');

  const lights = (options.lights || []).map((light) => {
    const x = fretX(light.fret);
    const y = stringY(light.string);
    const { bg, ink } = colorForFret(light.fret);
    return `<circle class="fret-light" cx="${x}" cy="${y}" r="18" style="fill:${bg}" />
      <text class="fret-light-num" x="${x}" y="${y + 8}" style="fill:${ink}">${light.fret}</text>`;
  }).join('');

  const demoClass = options.demo ? ' demo' : '';
  const svg = `
    <svg viewBox="0 0 1000 390" class="neck${demoClass}" role="img" aria-label="Lap steel fretboard, nut at the left">
      ${woodDefs()}
      <text class="edge-label" x="540" y="28">high ${midiToName(STRINGS.find((item) => item.string === 1).midi).name} · far side</text>
      <rect class="board" x="96" y="52" width="874" height="274" rx="10" />
      ${inlays.join('')}
      ${frets.join('')}
      <rect class="nut" x="${NUT_X - 9}" y="${TOP - 16}" width="11" height="${BOTTOM - TOP + 32}" rx="2" />
      ${under.join('')}
      ${strings.join('')}
      <g class="bar-group">${options.ghost ? drawBar(options.ghost, true) : ''}${drawBar(bar, false)}</g>
      ${lights}
      ${labels}
      ${numbers.join('')}
      <text class="edge-label near" x="540" y="382">low ${midiToName(STRINGS.find((item) => item.string === 6).midi).name} · near you</text>
    </svg>`;

  mount.innerHTML = svg;
  const svgEl = mount.querySelector('svg');
  if (options.onFret && svgEl) {
    svgEl.classList.add('clickable');
    svgEl.addEventListener('click', (event) => {
      const point = svgEl.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const mapped = point.matrixTransform(svgEl.getScreenCTM().inverse());
      if (mapped.y < TOP - 20 || mapped.y > BOTTOM + 30) return;
      if (mapped.x < NUT_X - 20 || mapped.x > fretX(12) + 24) return;
      let best = 0;
      let bestDist = Infinity;
      for (let fret = 0; fret <= 12; fret += 1) {
        const dist = Math.abs(fretX(fret) - mapped.x);
        if (dist < bestDist) {
          best = fret;
          bestDist = dist;
        }
      }
      options.onFret(best);
    });
  }
}
