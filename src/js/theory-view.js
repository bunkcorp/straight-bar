import { freqAt, midiToName, stringMidi } from './theory.js';
import {
  LESSONS,
  describeSignature,
  lessonGroups,
} from './theory-course.js';

const STORE = 'straight-bar-theory';
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const BEATS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

const ui = {
  lessonId: LESSONS[0].id,
  screen: 0,
  choice: 0,
  sigKind: 'sharp',
  sigCount: 1,
  done: {},
};

let ctx = null;
let master = null;
let raf = 0;
let token = 0;
let playing = false;

function loadUi() {
  try {
    if (typeof localStorage === 'undefined') return;
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!saved || !LESSONS.some((lesson) => lesson.id === saved.lessonId)) return;
    ui.lessonId = saved.lessonId;
    ui.screen = Number(saved.screen) || 0;
    ui.choice = 0;
    ui.sigKind = saved.sigKind === 'flat' ? 'flat' : 'sharp';
    ui.sigCount = Math.max(0, Math.min(7, Number(saved.sigCount) || 0));
    ui.done = saved.done && typeof saved.done === 'object' ? saved.done : {};
    const lesson = currentLesson();
    if (ui.screen >= lesson.screens.length) ui.screen = 0;
  } catch {
    /* keep the defaults */
  }
}

function saveUi() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      lessonId: ui.lessonId,
      screen: ui.screen,
      sigKind: ui.sigKind,
      sigCount: ui.sigCount,
      done: ui.done,
    }));
  } catch {
    /* private mode */
  }
}

function currentLesson() {
  return LESSONS.find((lesson) => lesson.id === ui.lessonId) || LESSONS[0];
}

function currentScreen() {
  const lesson = currentLesson();
  const index = Math.max(0, Math.min(ui.screen, lesson.screens.length - 1));
  return lesson.screens[index];
}

function esc(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[ch]));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.filter((child) => child != null).forEach((child) => {
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function spelled(mark) {
  return midiToName(stringMidi(mark.string, mark.fret), Boolean(mark.flats));
}

function noteLabel(mark) {
  return spelled(mark).name;
}

function staffStep(mark) {
  const pitch = spelled(mark);
  return (pitch.octave - 4) * 7 + (LETTERS.indexOf(pitch.name[0]) - LETTERS.indexOf('E'));
}

function beatsOf(item) {
  if (item.bar) return 0;
  const key = item.rest || item.dur || 'q';
  const base = BEATS[key] || 1;
  return item.dot ? base * 1.5 : base;
}

function lessonIndex(lesson) {
  return LESSONS.findIndex((item) => item.id === lesson.id);
}

function shownVisual(screen) {
  if (screen.choices?.length) {
    const choice = screen.choices[Math.min(ui.choice, screen.choices.length - 1)];
    return choice.visual;
  }
  if (screen.frames?.length) return screen.frames[0].visual;
  return screen.visual;
}

function activeHear(screen) {
  if (screen.frames) {
    return { kind: 'frames', label: screen.hearLabel || 'Hear it', frames: screen.frames };
  }
  if (screen.hear?.signature) return { kind: 'signature', label: screen.hear.label || 'Hear the tonic' };
  if (screen.hear?.rhythm) {
    return { kind: 'rhythm', label: screen.hear.label || 'Tap', bpm: screen.hear.bpm || 80, bars: screen.hear.bars || 2, visual: screen.visual };
  }
  if (screen.hear?.followStaff) {
    return {
      kind: 'staff',
      label: screen.hear.label || 'Hear it',
      bpm: screen.hear.bpm || 80,
      clicks: Boolean(screen.hear.clicks),
      visual: screen.visual,
    };
  }
  if (screen.hear?.rows) return { kind: 'rows', label: screen.hear.label || 'Hear them', visual: screen.visual };
  if (screen.hear?.events) return { kind: 'events', label: screen.hear.label || 'Hear it', events: screen.hear.events };
  const choice = screen.choices?.[ui.choice];
  if (choice?.hear?.events) {
    return { kind: 'events', label: choice.hear.label || `Hear ${choice.label}`, events: choice.hear.events };
  }
  return null;
}

function ensure() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function pluck(freq, time, duration = 1.1, gain = 0.15) {
  const osc = ctx.createOscillator();
  const overtone = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  osc.type = 'triangle';
  overtone.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  overtone.frequency.setValueAtTime(freq * 2, time);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, time);
  filter.frequency.exponentialRampToValueAtTime(480, time + duration);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(filter);
  overtone.connect(filter);
  filter.connect(amp);
  amp.connect(master);
  osc.start(time);
  overtone.start(time);
  osc.stop(time + duration + 0.05);
  overtone.stop(time + duration + 0.05);
}

function clickAt(time, accent) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(accent ? 1500 : 980, time);
  amp.gain.setValueAtTime(accent ? 0.07 : 0.035, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  osc.connect(amp);
  amp.connect(master);
  osc.start(time);
  osc.stop(time + 0.04);
}

function schedule(events, windows, duration) {
  stopAudio();
  ensure();
  playing = true;
  renderTransport();
  const my = token;
  const start = ctx.currentTime + 0.06;
  events.forEach((event) => {
    const time = start + event.t;
    if (event.click != null) clickAt(time, event.click);
    else if (event.notes?.length) {
      event.notes.forEach((note, index) => {
        pluck(freqAt(note.string, note.fret), time, event.dur || 1.2, index ? 0.055 : 0.11);
      });
    } else if (event.string && !event.rest) {
      pluck(freqAt(event.string, event.fret), time, event.dur || 0.8, 0.16);
    }
  });
  let shown = -1;
  const tick = () => {
    if (my !== token || !ctx) return;
    const now = ctx.currentTime - start;
    if (windows) {
      const win = windows.find((item) => now >= item.t && now < item.t + item.hold);
      if (win && win.index !== shown) {
        shown = win.index;
        paintFrame(win.index);
      }
    }
    const current = [...events].reverse().find((event) => (
      event.click == null && now >= event.t && now < event.t + (event.dur || 0.16)
    ));
    const beat = [...events].reverse().find((event) => (
      event.beat != null && now >= event.t && now < event.t + (event.dur || 0.16)
    ));
    paintPlayhead(current, beat);
    if (now < duration) raf = requestAnimationFrame(tick);
    else finishPlayback();
  };
  raf = requestAnimationFrame(tick);
}

function stopAudio() {
  token += 1;
  playing = false;
  cancelAnimationFrame(raf);
  if (ctx) {
    ctx.close().catch(() => {});
    ctx = null;
    master = null;
  }
}

function finishPlayback() {
  playing = false;
  paintPlayhead(null);
  renderTransport();
}

function paintPlayhead(event, beat) {
  document.querySelectorAll('.th-mark').forEach((node) => {
    const on = Boolean(event && !event.rest && event.string
      && node.dataset.string === String(event.string)
      && node.dataset.fret === String(event.fret));
    node.classList.toggle('now', on);
  });
  document.querySelectorAll('.th-note, .th-rest').forEach((node) => {
    node.classList.toggle('now', Boolean(event && node.dataset.i != null && node.dataset.i === String(event.i)));
  });
  document.querySelectorAll('.th-cell').forEach((node) => {
    node.classList.toggle('now', Boolean(beat && node.dataset.beat === String(beat.beat)));
  });
  document.querySelectorAll('.th-row').forEach((node) => {
    node.classList.toggle('now', Boolean(event && event.row != null && node.dataset.index === String(event.row)));
  });
}

function paintFrame(index) {
  const screen = currentScreen();
  const frame = screen.frames?.[index];
  if (!frame) return;
  const host = document.getElementById('th-visual');
  if (host) host.innerHTML = visualHtml(frame.visual);
  const caption = document.getElementById('caption');
  if (caption && frame.caption) caption.textContent = frame.caption;
  document.querySelectorAll('[data-frame]').forEach((node) => {
    node.classList.toggle('on', Number(node.dataset.frame) === index);
  });
}

function previewNote(string, fret) {
  if (playing) {
    stopAudio();
    renderTransport();
  }
  ensure();
  pluck(freqAt(string, fret), ctx.currentTime + 0.02, 1.15, 0.16);
}

function previewClick(accent) {
  if (playing) {
    stopAudio();
    renderTransport();
  }
  ensure();
  clickAt(ctx.currentTime + 0.02, accent);
}

function staffEvents(visual, bpm, withClicks) {
  const spb = 60 / bpm;
  const events = [];
  let beat = 0;
  let noteIndex = 0;
  const items = [];
  (visual.systems || []).forEach((system) => {
    system.items.forEach((item) => items.push(item));
  });
  const meter = visual.systems?.find((system) => system.time)?.time?.[0] || 4;
  items.forEach((item, index) => {
    if (item.bar) return;
    const beats = beatsOf(item);
    const mine = noteIndex;
    noteIndex += 1;
    if (!item.rest && item.tie !== 'stop') {
      let sound = beats;
      if (item.tie === 'start') {
        for (let next = index + 1; next < items.length; next += 1) {
          if (items[next].bar) continue;
          if (items[next].tie === 'stop') sound += beatsOf(items[next]);
          break;
        }
      }
      events.push({
        t: beat * spb,
        string: item.string,
        fret: item.fret,
        dur: Math.max(0.18, sound * spb * 0.92),
        i: mine,
      });
    } else {
      events.push({ t: beat * spb, i: mine, rest: true, dur: Math.max(0.12, beats * spb * 0.9) });
    }
    beat += beats;
  });
  if (withClicks) {
    const steps = Math.ceil(beat);
    for (let i = 0; i < steps; i += 1) {
      events.push({ t: i * spb, click: i % meter === 0 ? 1 : 0, dur: 0.05 });
    }
  }
  return { events, duration: beat * spb + 0.2 };
}

function rhythmEvents(visual, bpm, bars) {
  const spb = 60 / bpm;
  const events = [];
  const accents = new Set(visual.accents || [0]);
  for (let bar = 0; bar < bars; bar += 1) {
    for (let beat = 0; beat < visual.beats; beat += 1) {
      events.push({
        t: (bar * visual.beats + beat) * spb,
        click: accents.has(beat) ? 1 : 0,
        beat,
        dur: spb * 0.9,
      });
    }
  }
  return { events, duration: bars * visual.beats * spb + 0.15 };
}

function rowEvents(visual) {
  const events = [];
  let t = 0;
  visual.rows.forEach((row, index) => {
    if (row.spread) {
      row.notes.forEach((note, noteIndex) => {
        events.push({
          t: t + noteIndex * 0.32,
          string: note.string,
          fret: note.fret,
          dur: 0.42,
          row: index,
        });
      });
      t += 1.3;
    } else {
      events.push({ t, notes: row.notes, dur: 1.05, row: index });
      t += 1.22;
    }
  });
  return { events, duration: t + 0.1 };
}

function framePlan(frames) {
  const events = [];
  const windows = [];
  let t = 0;
  frames.forEach((frame, index) => {
    const hold = frame.hold || 1.6;
    windows.push({ t, hold, index });
    const inner = frame.events || [{ t: 0, notes: frame.notes || [], dur: Math.min(1.45, hold * 0.82) }];
    inner.forEach((event) => {
      events.push({ ...event, t: t + (event.t || 0) });
    });
    t += hold;
  });
  return { events, windows, duration: t + 0.05 };
}

function playSpec(spec) {
  if (!spec) return;
  if (spec.kind === 'signature') {
    const info = describeSignature(ui.sigKind, ui.sigCount);
    schedule([{ t: 0, string: 2, fret: info.fret, dur: 1.3 }], null, 1.5);
    return;
  }
  if (spec.kind === 'rhythm') {
    const plan = rhythmEvents(spec.visual, spec.bpm, spec.bars);
    schedule(plan.events, null, plan.duration);
    return;
  }
  if (spec.kind === 'staff') {
    const plan = staffEvents(spec.visual, spec.bpm, spec.clicks);
    schedule(plan.events, null, plan.duration);
    return;
  }
  if (spec.kind === 'rows') {
    const plan = rowEvents(spec.visual);
    schedule(plan.events, null, plan.duration);
    return;
  }
  if (spec.kind === 'frames') {
    const plan = framePlan(spec.frames);
    schedule(plan.events, plan.windows, plan.duration);
    return;
  }
  const events = spec.events || [];
  const end = events.reduce((max, event) => Math.max(max, event.t + (event.dur || 0.4)), 0.4);
  schedule(events, null, end + 0.15);
}

function playFrame(index) {
  const frame = currentScreen().frames?.[index];
  if (!frame) return;
  paintFrame(index);
  const plan = framePlan([frame]);
  schedule(plan.events, null, plan.duration);
}

function playRow(index) {
  const row = currentScreen().visual?.rows?.[index];
  if (!row) return;
  const events = row.spread
    ? row.notes.map((note, noteIndex) => ({
      t: noteIndex * 0.34,
      string: note.string,
      fret: note.fret,
      dur: 0.45,
      row: index,
    }))
    : [{ t: 0, notes: row.notes, dur: 1.25, row: index }];
  const end = events.reduce((max, event) => Math.max(max, event.t + (event.dur || 0.3)), 0.3);
  schedule(events, null, end + 0.1);
}

const NUT = 96;
const F12 = 790;
const SCALE = 2 * (F12 - NUT);
const STRING_TOP = 58;
const STRING_BOT = 236;

function fretX(fret) {
  if (fret <= 0) return NUT;
  return NUT + SCALE * (1 - 2 ** (-fret / 12));
}

function stringY(stringNumber) {
  return STRING_TOP + ((stringNumber - 1) / 5) * (STRING_BOT - STRING_TOP);
}

function visualHtml(visual) {
  if (!visual) return '';
  if (visual.type === 'neck') return drawNeck(visual);
  if (visual.type === 'staff') return drawStaff(visual);
  if (visual.type === 'rhythm') return drawRhythm(visual);
  if (visual.type === 'circle') return drawCircle(visual);
  if (visual.type === 'rows') return drawRows(visual);
  if (visual.type === 'order') return drawOrder(visual.kind);
  if (visual.type === 'keys') return drawKeys();
  return '';
}

function drawNeck(visual) {
  const marks = visual.marks || [];
  const pick = new Set(visual.pick || marks.map((mark) => mark.string));
  const strings = [];
  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const y = stringY(stringNumber);
    const gauge = [0, 1.4, 1.6, 1.9, 2.4, 2.8, 3.2][stringNumber];
    const hot = pick.has(stringNumber);
    strings.push(`<line class="th-string ${hot ? 'hot' : 'dim'}" x1="${NUT}" y1="${y}" x2="${F12 + 18}" y2="${y}" stroke-width="${gauge}" />`);
    const open = midiToName(stringMidi(stringNumber, 0)).name;
    strings.push(`<text class="th-string-name" x="18" y="${y + 4}">${stringNumber}</text>`);
    strings.push(`<text class="th-string-name note" x="40" y="${y + 4}">${esc(open)}</text>`);
    if (!hot) strings.push(`<text class="th-mute" x="${F12 + 34}" y="${y + 4}">×</text>`);
  }
  const frets = [];
  const numbers = [];
  const inlays = [];
  for (let fret = 0; fret <= 12; fret += 1) {
    const x = fretX(fret);
    if (fret > 0) {
      frets.push(`<line class="th-fret" x1="${x}" y1="${STRING_TOP - 16}" x2="${x}" y2="${STRING_BOT + 16}" />`);
    }
    numbers.push(`<text class="th-fretnum" x="${x}" y="286">${fret}</text>`);
    if ([3, 5, 7, 9].includes(fret)) {
      const prev = fretX(fret - 1);
      inlays.push(`<circle class="th-inlay" cx="${(prev + x) / 2}" cy="${(STRING_TOP + STRING_BOT) / 2}" r="5" />`);
    }
    if (fret === 12) {
      const prev = fretX(11);
      const cx = (prev + x) / 2;
      const mid = (STRING_TOP + STRING_BOT) / 2;
      inlays.push(`<circle class="th-inlay" cx="${cx}" cy="${mid - 28}" r="5" />`);
      inlays.push(`<circle class="th-inlay" cx="${cx}" cy="${mid + 28}" r="5" />`);
    }
  }
  const dots = marks.map((mark) => {
    const x = fretX(mark.fret);
    const y = stringY(mark.string);
    const name = noteLabel(mark);
    const tag = mark.tag && mark.tag !== name ? `<text class="th-tag" x="${x}" y="${y - 18}">${esc(mark.tag)}</text>` : '';
    return `<g class="th-mark ${esc(mark.role || 'chord')}" data-action="theory" data-theory="pluck" data-string="${mark.string}" data-fret="${mark.fret}">
      ${tag}
      <circle cx="${x}" cy="${y}" r="12" />
      <text x="${x}" y="${y + 4}">${esc(name)}</text>
    </g>`;
  }).join('');
  const ribbon = visual.ribbon ? `<text class="th-ribbon" x="450" y="24">${esc(visual.ribbon)}</text>` : '';
  return `<svg class="th-svg" viewBox="0 0 860 310" role="img" aria-label="Fretboard diagram, nut at the left, string 1 on top, string 6 on the bottom">
    <defs>
      <linearGradient id="th-board" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a3428"/>
        <stop offset="0.5" stop-color="#3b2218"/>
        <stop offset="1" stop-color="#2a1812"/>
      </linearGradient>
      <linearGradient id="th-steel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fbf8f3"/>
        <stop offset="0.45" stop-color="#c5ced4"/>
        <stop offset="1" stop-color="#6e777e"/>
      </linearGradient>
    </defs>
    ${ribbon}
    <text class="th-edge" x="450" y="42">string 1 · high E · far side</text>
    <rect class="th-board" x="78" y="44" width="748" height="214" rx="10" />
    ${inlays.join('')}
    ${frets.join('')}
    <rect class="th-nut" x="${NUT - 8}" y="${STRING_TOP - 16}" width="10" height="${STRING_BOT - STRING_TOP + 32}" rx="2" />
    ${strings.join('')}
    ${barLine(visual.ghostBar, true)}
    ${barLine(visual.bar, false)}
    ${dots}
    ${numbers.join('')}
    <text class="th-edge" x="450" y="304">string 6 · low C · near you</text>
  </svg>`;
}

function barLine(bar, ghost) {
  if (!bar) return '';
  const x = fretX(bar.fret);
  const top = Math.min(stringY(bar.from), stringY(bar.to)) - 12;
  const bot = Math.max(stringY(bar.from), stringY(bar.to)) + 12;
  return `<line class="th-bar${ghost ? ' ghost' : ''}" x1="${x}" y1="${top}" x2="${x}" y2="${bot}" />`;
}

function drawRhythm(visual) {
  const accents = new Set(visual.accents || []);
  const cells = [];
  for (let beat = 0; beat < visual.beats; beat += 1) {
    const accent = accents.has(beat) ? ' accent' : '';
    cells.push(`<button type="button" class="th-cell${accent}" data-action="theory" data-theory="tap" data-beat="${beat}" data-accent="${accent ? '1' : '0'}">${beat + 1}</button>`);
  }
  const label = visual.groupLabel ? `<p class="th-group-label">${esc(visual.groupLabel)}</p>` : '';
  return `<div class="th-rhythm">${cells.join('')}</div>${label}`;
}

function drawCircle(visual) {
  const highlight = new Set(visual.highlight || []);
  const cx = 320;
  const cy = 214;
  const radius = 150;
  const dots = FIFTHS.map((name, index) => {
    const angle = (-Math.PI / 2) + index * (Math.PI * 2 / 12);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const on = highlight.has(name) ? ' on' : '';
    return `<g class="th-fifth${on}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="22" />
      <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(name)}</text>
    </g>`;
  }).join('');
  return `<svg class="th-svg" viewBox="0 0 640 430" role="img" aria-label="Circle of fifths, C at the top, clockwise a fifth higher">
    <circle class="th-ring" cx="${cx}" cy="${cy}" r="${radius}" />
    ${dots}
    <text class="th-ribbon" x="${cx}" y="${cy - 8}">clockwise</text>
    <text class="th-edge" x="${cx}" y="${cy + 14}">up a fifth</text>
  </svg>`;
}

function drawRows(visual) {
  return `<div class="th-rows">${visual.rows.map((row, index) => `
    <button type="button" class="th-row" data-action="theory" data-theory="row" data-index="${index}">
      <span class="th-num">${esc(row.num)}</span>
      <span class="th-row-copy">
        <span class="th-row-title">${esc(row.title)}</span>
        <span class="th-row-sub">${esc(row.sub)}</span>
      </span>
    </button>`).join('')}</div>`;
}

function drawOrder(kind) {
  const order = kind === 'sharp' ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  const info = describeSignature(kind, 7);
  const letters = order.map((letter) => `<span>${esc(letter)}</span>`).join('');
  const staff = drawStaff({
    systems: [{ signature: { kind, count: 7, steps: info.steps }, items: [] }],
  });
  return `<div class="th-order"><p class="th-order-letters">${letters}</p>${staff}</div>`;
}

function drawKeys() {
  const info = describeSignature(ui.sigKind, ui.sigCount);
  const buttons = ['sharp', 'flat'].map((kind) => {
    const name = kind === 'sharp' ? 'Sharps' : 'Flats';
    const row = [`<span class="th-sig-label">${name}</span>`];
    for (let count = 0; count <= 7; count += 1) {
      const on = ui.sigKind === kind && ui.sigCount === count ? ' on' : '';
      row.push(`<button type="button" class="th-sig${on}" data-action="theory" data-theory="sig" data-kind="${kind}" data-count="${count}">${count}</button>`);
    }
    return `<div class="th-sig-row">${row.join('')}</div>`;
  }).join('');
  const staff = drawStaff({
    systems: [{ signature: { kind: info.kind, count: info.count, steps: info.steps }, items: info.count ? [] : [{ string: 2, fret: 0, dur: 'w', lyric: 'C' }] }],
  });
  return `<div class="th-keys">${buttons}${staff}<p class="th-calc">${esc(info.sentence)}</p></div>`;
}

function drawStaff(visual) {
  const stepPx = 7;
  const systems = visual.systems || [];
  let yCursor = 8;
  let width = 640;
  const chunks = [];
  let noteCounter = 0;
  systems.forEach((system) => {
    const sounding = system.items.filter((item) => item.string);
    const steps = sounding.map((item) => staffStep(item));
    const maxStep = Math.max(8, ...steps, 8);
    const minStep = Math.min(0, ...steps, 0);
    const titleH = system.title ? 22 : 8;
    const bottomY = yCursor + titleH + 28 + (maxStep * stepPx);
    const yOf = (step) => bottomY - step * stepPx;
    let x = 28;
    const clef = drawClef(x, yOf);
    x += 36;
    let sigWidth = 0;
    let sig = '';
    if (system.signature?.count) {
      sig = drawSignature(x, yOf, system.signature);
      sigWidth = system.signature.count * 14 + 10;
      x += sigWidth;
    }
    if (system.time) {
      sig += drawTime(x, yOf, system.time);
      x += 36;
    }
    const placed = [];
    system.items.forEach((item) => {
      if (item.bar) {
        placed.push({ kind: 'bar', x });
        x += 16;
        return;
      }
      const beats = beatsOf(item);
      const headX = x + Math.max(16, beats * 16);
      const mine = noteCounter;
      noteCounter += 1;
      placed.push({
        kind: item.rest ? 'rest' : 'note',
        item,
        x: headX,
        i: mine,
        step: item.string ? staffStep(item) : 0,
        beats,
      });
      x = headX + Math.max(26, beats * 18);
    });
    width = Math.max(width, x + 24);
    const lyricY = yOf(minStep) + 28;
    const body = placed.map((place, index) => {
      if (place.kind === 'bar') {
        return `<line class="th-barline" x1="${place.x}" y1="${yOf(8)}" x2="${place.x}" y2="${yOf(0)}" />`;
      }
      if (place.kind === 'rest') {
        return drawRest(place, yOf, lyricY);
      }
      const next = placed.slice(index + 1).find((item) => item.kind === 'note');
      return drawNote(place, yOf, next, lyricY);
    }).join('');
    const title = system.title ? `<text class="th-system-title" x="28" y="${yCursor + 16}">${esc(system.title)}</text>` : '';
    const lines = [0, 2, 4, 6, 8].map((step) => (
      `<line class="th-staff-line" x1="20" y1="${yOf(step)}" x2="${x}" y2="${yOf(step)}" />`
    )).join('');
    chunks.push(`${title}${lines}${clef}${sig}${body}`);
    yCursor = lyricY + 18;
  });
  const height = Math.max(120, yCursor + 8);
  return `<svg class="th-svg th-staff" viewBox="0 0 ${width} ${height}" role="img" aria-label="Staff">${chunks.join('')}</svg>`;
}

function drawClef(x, yOf) {
  const g = yOf(2);
  return `<text class="th-clef-glyph" x="${x + 4}" y="${g + 19}">𝄞</text>`;
}

function drawSignature(x, yOf, signature) {
  const glyph = signature.kind === 'flat' ? '♭' : '♯';
  return (signature.steps || []).map((step, index) => {
    const px = x + index * 14;
    return `<text class="th-acc" x="${px}" y="${yOf(step) + 5}">${glyph}</text>`;
  }).join('');
}

function drawTime(x, yOf, time) {
  return `<text class="th-meter" x="${x + 8}" y="${yOf(6) + 4}">${time[0]}</text>
    <text class="th-meter" x="${x + 8}" y="${yOf(2) + 4}">${time[1]}</text>`;
}

function drawNote(place, yOf, next, lyricY) {
  const { item, x, step, i } = place;
  const y = yOf(step);
  const pitch = spelled(item);
  const accidental = pitch.name.includes('#') ? '♯' : pitch.name.includes('b') ? '♭' : '';
  const filled = item.dur === 'q' || item.dur === 'e' || item.dur === 's';
  const stemUp = step < 4;
  const stemX = stemUp ? x + 6.5 : x - 6.5;
  const stemY = stemUp ? y - 34 : y + 34;
  const stem = item.dur === 'w' ? '' : `<line class="th-stem" x1="${stemX}" y1="${y}" x2="${stemX}" y2="${stemY}" />`;
  const flags = item.dur === 'e' || item.dur === 's' ? drawFlags(stemX, stemY, stemUp, item.dur === 's' ? 2 : 1) : '';
  const dotStep = step % 2 === 0 ? step + 1 : step;
  const dot = item.dot ? `<circle class="th-dot" cx="${x + 16}" cy="${yOf(dotStep)}" r="2.2" />` : '';
  const acc = accidental ? `<text class="th-acc" x="${x - 16}" y="${y + 5}">${accidental}</text>` : '';
  const ledgers = ledgerLines(x, step, yOf);
  const lyric = item.lyric ? `<text class="th-lyric" x="${x}" y="${lyricY}">${esc(item.lyric)}</text>` : '';
  let tie = '';
  if (item.tie === 'start' && next) {
    const y2 = y + 10;
    tie = `<path class="th-tie" d="M ${x + 8} ${y2} Q ${(x + next.x) / 2} ${y2 + 14} ${next.x - 8} ${y2}" />`;
  }
  const cls = filled ? 'th-note filled' : 'th-note';
  return `<g class="${cls}" data-i="${i}" data-action="theory" data-theory="pluck" data-string="${item.string}" data-fret="${item.fret}">
    ${ledgers}${acc}
    <ellipse class="th-head" cx="${x}" cy="${y}" rx="7.2" ry="5" transform="rotate(-18 ${x} ${y})" />
    ${stem}${flags}${dot}${tie}${lyric}
  </g>`;
}

function drawFlags(x, y, up, count) {
  const dir = up ? 1 : -1;
  let marks = '';
  for (let i = 0; i < count; i += 1) {
    const yy = y + dir * i * 7;
    marks += `<path class="th-flag" d="M ${x} ${yy} c 10 ${dir * 2} 12 ${dir * 12} 4 ${dir * 16}" />`;
  }
  return marks;
}

function ledgerLines(x, step, yOf) {
  const lines = [];
  if (step <= -2) {
    for (let line = -2; line >= step; line -= 2) lines.push(line);
  }
  if (step >= 10) {
    for (let line = 10; line <= step; line += 2) lines.push(line);
  }
  return lines.map((line) => `<line class="th-ledger" x1="${x - 12}" y1="${yOf(line)}" x2="${x + 12}" y2="${yOf(line)}" />`).join('');
}

function drawRest(place, yOf, lyricY) {
  const key = place.item.rest;
  const x = place.x;
  const i = place.i;
  let glyph = '';
  if (key === 'w') {
    glyph = `<rect class="th-rest-block" x="${x - 8}" y="${yOf(6)}" width="16" height="6" />`;
  } else if (key === 'h') {
    glyph = `<rect class="th-rest-block" x="${x - 8}" y="${yOf(4) - 6}" width="16" height="6" />`;
  } else if (key === 'q') {
    glyph = `<path class="th-rest-path" d="M ${x - 4} ${yOf(7)} c 8 6 10 10 2 16 c -6 4 -8 8 -2 12 c 6 2 8 6 2 10 c -8 2 -12 -2 -8 4" />`;
  } else if (key === 'e') {
    glyph = `<path class="th-rest-path" d="M ${x + 4} ${yOf(6)} c -8 8 -2 14 2 18" />
      <circle class="th-dot" cx="${x - 2}" cy="${yOf(2)}" r="2.4" />`;
  } else {
    glyph = `<path class="th-rest-path" d="M ${x + 4} ${yOf(7)} c -8 8 -2 12 2 16" />
      <circle class="th-dot" cx="${x - 2}" cy="${yOf(3)}" r="2.2" />
      <circle class="th-dot" cx="${x - 2}" cy="${yOf(1)}" r="2.2" />`;
  }
  const lyric = place.item.lyric ? `<text class="th-lyric" x="${x}" y="${lyricY}">${esc(place.item.lyric)}</text>` : '';
  return `<g class="th-rest" data-i="${i}">${glyph}${lyric}</g>`;
}

function renderRail() {
  const aside = document.getElementById('lesson-list');
  aside.replaceChildren();
  const lesson = currentLesson();
  lessonGroups().forEach((group) => {
    aside.append(el('p', { class: 'rail-label th-group', text: group.title }));
    group.lessons.forEach((item) => {
      const number = lessonIndex(item) + 1;
      const active = item.id === lesson.id;
      const done = Boolean(ui.done[item.id]);
      aside.append(el('button', {
        class: `lesson-item${active ? ' active' : ''}`,
        type: 'button',
        'data-action': 'theory',
        'data-theory': 'lesson',
        'data-id': item.id,
      }, [
        el('span', { class: `num${done ? ' done' : ''}`, text: String(number).padStart(2, '0') }),
        el('span', { class: 'lesson-copy' }, [
          el('span', { class: 'lesson-title', text: item.title }),
          el('span', { class: 'lesson-summary', text: item.summary }),
        ]),
      ]));
    });
  });
  aside.append(el('p', {
    class: 'rail-foot',
    text: 'Arrow keys move. Space hears.',
  }));
  aside.querySelector('.lesson-item.active')?.scrollIntoView({ block: 'nearest' });
}

function renderStage(screen) {
  const mount = document.getElementById('neck-mount');
  mount.replaceChildren();
  const stage = el('div', { class: 'th-stage' });
  const visual = el('div', { id: 'th-visual', class: 'th-visual' });
  visual.innerHTML = visualHtml(shownVisual(screen));
  stage.append(visual);
  const chips = el('div', { class: 'chip-row th-chips' });
  if (screen.choices?.length) {
    screen.choices.forEach((choice, index) => {
      chips.append(el('button', {
        type: 'button',
        class: index === ui.choice ? 'on' : '',
        'data-action': 'theory',
        'data-theory': 'choice',
        'data-index': String(index),
        text: choice.label,
      }));
    });
  } else if (screen.frames?.length) {
    screen.frames.forEach((frame, index) => {
      chips.append(el('button', {
        type: 'button',
        'data-action': 'theory',
        'data-theory': 'frame',
        'data-frame': String(index),
        'data-index': String(index),
        text: frame.visual?.ribbon || `Bar ${index + 1}`,
      }));
    });
  }
  if (chips.childElementCount) stage.append(chips);
  mount.append(stage);
  const caption = document.getElementById('caption');
  if (caption) caption.textContent = screen.caption || '';
}

function renderInspector(screen) {
  const pane = document.getElementById('inspector');
  pane.replaceChildren();
  const lesson = currentLesson();
  const group = lessonGroups().find((item) => item.id === lesson.group);
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', {
    class: 'kicker',
    text: `${group?.title || 'Theory'}  ·  ${ui.screen + 1} of ${lesson.screens.length}`,
  }));
  wrap.append(el('h1', { text: screen.title }));
  const dots = el('div', { class: 'dots' });
  lesson.screens.forEach((_, index) => {
    const cls = index === ui.screen ? 'dot now' : 'dot';
    dots.append(el('button', {
      class: cls,
      type: 'button',
      'data-action': 'theory',
      'data-theory': 'screen',
      'data-index': String(index),
      'aria-label': `Screen ${index + 1}`,
    }));
  });
  wrap.append(dots);
  screen.paragraphs.forEach((text) => wrap.append(el('p', { text })));
  const blurb = screen.choices?.[ui.choice]?.blurb;
  if (blurb) wrap.append(el('p', { class: 'th-blurb', text: blurb }));
  pane.append(wrap);
}

function renderTransport() {
  const bar = document.getElementById('transport');
  if (!bar) return;
  const screen = currentScreen();
  const hear = activeHear(screen);
  bar.replaceChildren();
  const left = el('div', { class: 'transport-group' });
  const lesson = currentLesson();
  const index = lessonIndex(lesson);
  const atStart = index === 0 && ui.screen === 0;
  const atEnd = index === LESSONS.length - 1 && ui.screen === lesson.screens.length - 1;
  left.append(el('button', {
    type: 'button',
    'data-action': 'theory',
    'data-theory': 'prev',
    text: 'Back',
    ...(atStart ? { disabled: 'disabled' } : {}),
  }));
  if (hear) {
    left.append(el('button', {
      type: 'button',
      class: 'primary',
      'data-action': 'theory',
      'data-theory': 'hear',
      text: playing ? 'Playing' : hear.label,
    }));
  }
  if (playing) {
    left.append(el('button', {
      type: 'button',
      'data-action': 'theory',
      'data-theory': 'stop',
      text: 'Stop',
    }));
  }
  left.append(el('button', {
    type: 'button',
    'data-action': 'theory',
    'data-theory': 'next',
    text: atEnd ? (ui.done[lesson.id] ? 'Done' : 'Finish') : 'Next',
  }));
  bar.append(left);
}

export function renderTheory() {
  const screen = currentScreen();
  if (screen.choices && ui.choice >= screen.choices.length) ui.choice = 0;
  renderRail();
  renderStage(screen);
  renderInspector(screen);
  renderTransport();
}

function go(direction) {
  stopAudio();
  const lesson = currentLesson();
  const index = lessonIndex(lesson);
  if (direction > 0) {
    if (ui.screen < lesson.screens.length - 1) {
      ui.screen += 1;
      ui.choice = 0;
    } else {
      ui.done[lesson.id] = true;
      if (index < LESSONS.length - 1) {
        ui.lessonId = LESSONS[index + 1].id;
        ui.screen = 0;
        ui.choice = 0;
      }
    }
  } else if (ui.screen > 0) {
    ui.screen -= 1;
    ui.choice = 0;
  } else if (index > 0) {
    const prev = LESSONS[index - 1];
    ui.lessonId = prev.id;
    ui.screen = prev.screens.length - 1;
    ui.choice = 0;
  }
  saveUi();
  renderTheory();
}

export function theoryCommand(name, button) {
  if (name === 'lesson') {
    stopAudio();
    ui.lessonId = button.dataset.id;
    ui.screen = 0;
    ui.choice = 0;
    saveUi();
    renderTheory();
    return;
  }
  if (name === 'screen') {
    stopAudio();
    ui.screen = Number(button.dataset.index) || 0;
    ui.choice = 0;
    saveUi();
    renderTheory();
    return;
  }
  if (name === 'next') {
    go(1);
    return;
  }
  if (name === 'prev') {
    go(-1);
    return;
  }
  if (name === 'choice') {
    stopAudio();
    ui.choice = Number(button.dataset.index) || 0;
    renderTheory();
    const choice = currentScreen().choices?.[ui.choice];
    if (choice?.hear) playSpec({ kind: 'events', events: choice.hear.events });
    return;
  }
  if (name === 'frame') {
    playFrame(Number(button.dataset.index) || 0);
    return;
  }
  if (name === 'hear') {
    if (playing) {
      stopAudio();
      renderTheory();
      return;
    }
    playSpec(activeHear(currentScreen()));
    return;
  }
  if (name === 'stop') {
    stopAudio();
    renderTheory();
    return;
  }
  if (name === 'pluck') {
    previewNote(Number(button.dataset.string), Number(button.dataset.fret));
    return;
  }
  if (name === 'tap') {
    previewClick(button.dataset.accent === '1');
    document.querySelectorAll('.th-cell').forEach((node) => {
      node.classList.toggle('now', node === button);
    });
    return;
  }
  if (name === 'row') {
    playRow(Number(button.dataset.index) || 0);
    return;
  }
  if (name === 'sig') {
    stopAudio();
    ui.sigKind = button.dataset.kind === 'flat' ? 'flat' : 'sharp';
    ui.sigCount = Number(button.dataset.count) || 0;
    saveUi();
    renderTheory();
  }
}

export function theoryOnKey(event) {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    go(1);
    return true;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    go(-1);
    return true;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    theoryCommand('hear');
    return true;
  }
  return false;
}

export function stopTheory() {
  stopAudio();
}

loadUi();
