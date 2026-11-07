import { createAudio } from './audio.js';
import { bindSixthsAudio, onSixthsKey, renderSixths, sixthsCommand, syncSixthsLiveString } from './sixths.js';
import { bindSongs, renderSongs, routeTakeOutput, setSongQuery, setTakeVolume, songActions, songsOnPitch, stopSong } from './songs.js';
import { openLibraryFile, renderLibrary, setLibraryQuery } from './library.js';
import { renderTheory, stopTheory, theoryCommand, theoryOnKey } from './theory-view.js';
import { songById } from './songs-data.js';
import {
  CHANGE_CHORDS,
  CHANGES,
  BACKUP,
  BACKUP_CHORDS,
  BACKUP_NINTH,
  BACKUP_NINTH_CHORDS,
  FORM,
  FORM_CHORDS,
  INTRO,
  INTRO_CHORDS,
  LESSONS,
  MELODY,
  MELODY_CHORDS,
  MELODY_SIXTHS,
  PHRASE,
  PHRASE_CHORDS,
  SCALE,
  SLIDE_A,
  SLIDE_B,
  SLIDE_E,
  TAKEOFF,
  TAKEOFF_CHORDS,
  UPPER_CHORDS,
  UPPER_LINE,
  VAMP,
  VAMP_CHORDS,
} from './lessons.js';
import { applyFretColorVars } from './fret-colors.js';
import { renderNeck } from './neck.js';
import {
  adoptPreferredInput,
  adoptPreferredOutput,
  deviceErrorMessage,
  devicePicker,
  getInputs,
  inputStatusText,
  isLowLatencyEnabled,
  isMonitorEnabled,
  latencyTipText,
  monitorTipText,
  preferScarlettForMonitor,
  refreshDevices,
  resolveInputId,
  setInputDeviceId,
  setLowLatencyEnabled,
  setMonitorEnabled,
  setOutputDeviceId,
  shouldMonitorLive,
} from './devices.js';
import { createPitch } from './pitch.js';
import {
  STRINGS,
  barCaption,
  centsBetween,
  describeNotes,
  dominantNinthName,
  formatFret,
  freqAt,
  fretOnString,
  midiToFreq,
  matchLiveString,
  midiToName,
  nearestChromatic,
  openStrings,
  soundingMidis,
  straightBar,
  stringMidi,
} from './theory.js';

const KEY = 'straight-bar-c6';

const PRESETS = [
  { id: 'c6', name: 'Open C6', fret: 0, slant: 0, span: 'all', picked: [1, 2, 3, 4, 5, 6], muted: [] },
  { id: 'f6', name: 'F6', fret: 5, slant: 0, span: 'all', picked: [1, 2, 3, 4, 5, 6], muted: [] },
  { id: 'g6', name: 'G6', fret: 7, slant: 0, span: 'all', picked: [1, 2, 3, 4, 5, 6], muted: [] },
  { id: 'c9', name: 'C9', fret: 10, slant: 0, span: 'top', picked: [1, 2, 3], muted: [4, 5, 6] },
  { id: 'f9', name: 'F9', fret: 3, slant: 0, span: 'top', picked: [1, 2, 3], muted: [4, 5, 6] },
  { id: 'g9', name: 'G9', fret: 5, slant: 0, span: 'top', picked: [1, 2, 3], muted: [4, 5, 6] },
  { id: 'oct', name: 'Octave E', fret: 12, slant: 0, span: 'one', picked: [1], muted: [2, 3, 4, 5, 6] },
  { id: 'g7', name: 'G7 slant', fret: 4, slant: 1, span: 'inner', picked: [4, 2], muted: [6, 5, 3, 1] },
];

const state = load();
const audio = createAudio();
const pitch = createPitch(onPitch);
audio.setVolume(state.volume);

function load() {
  const fresh = {
    mode: 'lesson',
    lessonId: 'setup',
    stepIndex: 0,
    done: {},
    volume: 0.8,
    tempo: 60,
    guide: true,
    songId: 'aloha-oe',
    songQuery: '',
    songSpeed: 100,
    practice: {
      fret: 0,
      slant: 0,
      span: 'all',
      picked: [1, 2, 3, 4, 5, 6],
      muted: [],
    },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved) return { ...fresh, ...runtime() };
    if (!LESSONS.some((lesson) => lesson.id === saved.lessonId)) saved.lessonId = 'setup';
    return { ...fresh, ...saved, practice: { ...fresh.practice, ...(saved.practice || {}) }, ...runtime() };
  } catch {
    return { ...fresh, ...runtime() };
  }
}

function runtime() {
  return {
    listening: false,
    listenError: '',
    hit: null,
    passed: false,
    hold: 0,
    ladderIndex: 0,
    vib: [],
    tuneString: 6,
    tuned: new Set(),
    demo: false,
    playEvent: null,
    playKey: '',
    playingKind: '',
    rollString: 0,
    lastPitchAt: 0,
    /** @type {{ string: number, fret: number, lastHeard: number }[]} */
    liveNotes: [],
    /** Last successfully matched MIDI this Listen session (octave continuity). */
    lastLiveMidi: null,
  };
}

/** Same neck geometry as neck.js / fretboard.js (fret 0 at the nut). */
const LIVE_NUT_X = 118;
const LIVE_FRET_12_X = 930;
const LIVE_SCALE = 2 * (LIVE_FRET_12_X - LIVE_NUT_X);
const LIVE_TOP = 78;
const LIVE_BOTTOM = 300;
const LIVE_HOLD_MS = 700;
/** Prefer the string that was live within this window (string continuity). */
const LIVE_STRING_MS = 400;
/** Ignore muddy YIN hits for fret glow (clarity = 1 − yin residual). */
const MIN_LIVE_CLARITY = 0.85;
let liveFadeTimer = null;

function liveFretX(fret) {
  return LIVE_NUT_X + LIVE_SCALE * (1 - 2 ** (-fret / 12));
}

function liveStringY(stringNumber) {
  return LIVE_TOP + ((stringNumber - 1) / 5) * (LIVE_BOTTOM - LIVE_TOP);
}

function activeLiveStrings() {
  return [...new Set(state.liveNotes.map((note) => note.string))];
}

function diagramBarForLive() {
  if (state.mode === 'sixths' || state.mode === 'songs' || state.mode === 'theory') return null;
  return activeBar();
}

/**
 * When a bar has several picked strings and YIN hears any of those chord tones,
 * light every picked string at its bar fret (straight or slant) for the hold window.
 * Never lights frets away from the bar.
 */
function chordBoostNotes(freq, bar) {
  if (!bar || bar.open || bar.fromString == null) return [];
  const picked = bar.picked || [];
  if (picked.length < 2) return [];
  let anyMatch = false;
  const notes = [];
  for (const stringNumber of picked) {
    const fret = fretOnString(bar, stringNumber);
    if (fret == null) continue;
    const rounded = Math.round(fret);
    const cents = Math.abs(centsBetween(freq, freqAt(stringNumber, rounded)));
    if (cents <= 25) anyMatch = true;
    notes.push({ string: stringNumber, fret: rounded });
  }
  return anyMatch ? notes : [];
}

function recentLiveString(now = performance.now()) {
  let best = null;
  for (const note of state.liveNotes) {
    if (now - note.lastHeard > LIVE_STRING_MS) continue;
    if (!best || note.lastHeard > best.lastHeard) best = note;
  }
  return best;
}

function matchAtBarFret(match, bar) {
  if (!match || !bar || bar.open || bar.fromString == null) return false;
  const barFret = fretOnString(bar, match.string);
  if (barFret == null) return false;
  return Math.abs(barFret - match.fret) < 0.35;
}

function upsertLiveNote(stringNumber, fret, now) {
  const existing = state.liveNotes.find(
    (note) => note.string === stringNumber && note.fret === fret,
  );
  if (existing) {
    existing.lastHeard = now;
    return;
  }
  state.liveNotes.push({ string: stringNumber, fret, lastHeard: now });
}

function pruneLiveNotes(now = performance.now()) {
  state.liveNotes = state.liveNotes.filter((note) => now - note.lastHeard < LIVE_HOLD_MS);
}

function scheduleLivePrune() {
  clearTimeout(liveFadeTimer);
  liveFadeTimer = null;
  if (!state.liveNotes.length) return;
  const now = performance.now();
  const soonest = Math.min(...state.liveNotes.map((note) => note.lastHeard + LIVE_HOLD_MS));
  const wait = Math.max(20, soonest - now + 8);
  liveFadeTimer = setTimeout(() => {
    liveFadeTimer = null;
    pruneLiveNotes();
    syncLivePaint();
    scheduleLivePrune();
  }, wait);
}

function clearLiveNotes() {
  clearTimeout(liveFadeTimer);
  liveFadeTimer = null;
  state.liveNotes = [];
  state.lastLiveMidi = null;
  syncLivePaint();
}

function syncLivePaint() {
  const strings = state.listening ? activeLiveStrings() : [];
  syncSixthsLiveString(strings);
  paintLiveNotes();
}

/** Neon string lines + fret circles — in-place, never wiped by relying on re-render alone. */
function paintLiveNotes() {
  const mount = document.getElementById('neck-mount');
  if (!mount) return;
  const live = new Set(state.listening ? activeLiveStrings() : []);
  mount.querySelectorAll('.string[data-string], .string-under[data-string]').forEach((line) => {
    const n = Number(line.getAttribute('data-string'));
    const on = live.has(n);
    line.classList.toggle('live', on);
    if (line.classList.contains('string')) {
      const gauge = Number(line.getAttribute('data-gauge') || line.getAttribute('stroke-width') || 2);
      if (on) {
        line.setAttribute('stroke', '#39ff14');
        line.setAttribute('stroke-width', String(Math.max(gauge, 6)));
        line.setAttribute('filter', 'url(#live-glow)');
      } else {
        line.removeAttribute('stroke');
        line.setAttribute('stroke-width', String(gauge));
        line.removeAttribute('filter');
      }
    }
  });

  const svg = mount.querySelector('svg');
  if (!svg) return;
  let layer = svg.querySelector('g.live-fret-layer');
  if (!layer) {
    layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('class', 'live-fret-layer');
    svg.appendChild(layer);
  }

  const notes = state.listening ? state.liveNotes : [];
  const wanted = new Set(notes.map((note) => `${note.string}:${note.fret}`));
  layer.querySelectorAll('.live-fret-mark').forEach((node) => {
    if (!wanted.has(node.getAttribute('data-key'))) node.remove();
  });
  for (const note of notes) {
    const key = `${note.string}:${note.fret}`;
    let circle = [...layer.querySelectorAll('.live-fret-mark')]
      .find((node) => node.getAttribute('data-key') === key);
    if (!circle) {
      circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'live-fret-mark');
      circle.setAttribute('data-key', key);
      circle.setAttribute('r', '15');
      circle.setAttribute('fill', '#00f0ff');
      circle.setAttribute('fill-opacity', '0.9');
      circle.setAttribute('stroke', '#7afcff');
      circle.setAttribute('stroke-width', '2.5');
      layer.appendChild(circle);
    }
    circle.setAttribute('cx', String(liveFretX(note.fret)));
    circle.setAttribute('cy', String(liveStringY(note.string)));
  }
}

function liveMatchFromHit(hit) {
  if (!hit || !state.listening) return null;
  if (typeof hit.clarity === 'number' && hit.clarity < MIN_LIVE_CLARITY) return null;
  const bar = diagramBarForLive();
  const recent = recentLiveString();
  // Match frets 0–12 by frequency; diagram mute marks must not block the glow.
  return matchLiveString(hit.freq, {
    picked: bar?.picked || [],
    bar,
    maxCents: 35,
    lockCents: 25,
    preferString: recent?.string ?? null,
    lastMidi: state.lastLiveMidi,
    lastFret: recent?.fret ?? null,
  });
}

function updateLiveStringHighlight(hit) {
  if (!state.listening) {
    clearLiveNotes();
    return;
  }
  const now = performance.now();
  if (hit) {
    const match = liveMatchFromHit(hit);
    if (match) {
      const bar = diagramBarForLive();
      const boost = chordBoostNotes(hit.freq, bar);
      // Chord glow stays on the bar only — don't also paint a distant wrong fret.
      const paintMatch = !boost.length || matchAtBarFret(match, bar) || !bar || bar.open;
      if (paintMatch) {
        upsertLiveNote(match.string, match.fret, now);
        state.lastLiveMidi = match.midi;
      } else {
        state.lastLiveMidi = stringMidi(boost[0].string, boost[0].fret);
      }
      for (const note of boost) {
        upsertLiveNote(note.string, note.fret, now);
      }
    }
  }
  pruneLiveNotes(now);
  syncLivePaint();
  scheduleLivePrune();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify({
    mode: state.mode,
    lessonId: state.lessonId,
    stepIndex: state.stepIndex,
    done: state.done,
    volume: state.volume,
    tempo: state.tempo,
    guide: state.guide,
    songId: state.songId,
    songSpeed: state.songSpeed,
    practice: state.practice,
  }));
}

function currentLesson() {
  return LESSONS.find((lesson) => lesson.id === state.lessonId) || LESSONS[0];
}

function currentStep() {
  const lesson = currentLesson();
  return lesson.steps[state.stepIndex] || lesson.steps[0];
}

function lessonComplete(lesson) {
  return lesson.steps.every((_, index) => state.done[`${lesson.id}:${index}`]);
}

function markDone() {
  const lesson = currentLesson();
  state.done[`${lesson.id}:${state.stepIndex}`] = true;
  save();
}

function spanShape(span) {
  if (span === 'all') return { fromString: 6, toString: 1, strings: [6, 5, 4, 3, 2, 1] };
  if (span === 'top') return { fromString: 3, toString: 1, strings: [3, 2, 1] };
  if (span === 'inner') return { fromString: 4, toString: 2, strings: [4, 3, 2] };
  return { fromString: 1, toString: 1, strings: [1] };
}

function practiceModel() {
  const practice = state.practice;
  const shape = spanShape(practice.span);
  const fromString = shape.fromString;
  const slant = practice.span === 'one' ? 0 : practice.slant;
  let bass = practice.fret;
  let treble = practice.fret + slant;
  if (treble < 0) {
    bass -= treble;
    treble = 0;
  }
  if (treble > 12) {
    bass -= treble - 12;
    treble = 12;
  }
  bass = Math.max(0, Math.min(12, bass));
  return {
    fromString,
    toString: shape.toString,
    fromFret: bass,
    toFret: treble,
    picked: practice.picked,
    muted: practice.muted,
  };
}

function openMatch(hit) {
  if (!hit) return null;
  let best = null;
  for (const string of STRINGS) {
    const cents = Math.abs(centsBetween(hit.freq, midiToFreq(string.midi)));
    if (cents <= 50 && (!best || cents < best.cents)) {
      best = { string: string.string, cents, midi: string.midi };
    }
  }
  return best;
}

function ladderBar() {
  const item = SCALE[Math.min(state.ladderIndex, SCALE.length - 1)];
  if (item.fret === 0) return openStrings([1], [2, 3, 4, 5, 6]);
  return {
    fromString: 1,
    toString: 1,
    fromFret: item.fret,
    toFret: item.fret,
    picked: [1],
    muted: [2, 3, 4, 5, 6],
  };
}

function barFromEvent(event, kind) {
  if (event?.bar) return event.bar;
  if (kind === 'changes') {
    if (event.fret == null) return openStrings([1, 2, 3, 4, 5, 6], []);
    return straightBar(event.fret, [1, 2, 3, 4, 5, 6], []);
  }
  return {
    fromString: 1,
    toString: 1,
    fromFret: event.fret,
    toFret: event.fret,
    picked: [1],
    muted: [2, 3, 4, 5, 6],
  };
}

function activeBar() {
  if (state.mode === 'practice') return practiceModel();
  if (state.mode === 'tuner') {
    const match = openMatch(state.hit);
    if (!match) return openStrings([], []);
    const muted = [1, 2, 3, 4, 5, 6].filter((string) => string !== match.string);
    return openStrings([match.string], muted);
  }
  const step = currentStep();
  if (state.rollString && state.mode === 'lesson') {
    const step = currentStep();
    const base = step?.bar || openStrings([], []);
    const muted = [1, 2, 3, 4, 5, 6].filter((string) => string !== state.rollString);
    return { ...base, picked: [state.rollString], muted };
  }
  if (state.playingKind === 'passage' && state.playEvent?.bar) return state.playEvent.bar;
  if (state.playEvent && state.playingKind !== 'metro') {
    return barFromEvent(state.playEvent, step?.timeline);
  }
  if (step?.tune) {
    const muted = [1, 2, 3, 4, 5, 6].filter((string) => string !== state.tuneString);
    return openStrings([state.tuneString], muted);
  }
  if (step?.listen?.ladder) return ladderBar();
  return step?.bar || openStrings([], []);
}

function currentTarget() {
  if (state.mode === 'tuner') return null;
  const step = currentStep();
  if (!step) return null;
  if (step.tune) {
    return { string: state.tuneString, fret: 0, freq: freqAt(state.tuneString, 0) };
  }
  if (step.listen?.ladder) {
    const item = SCALE[Math.min(state.ladderIndex, SCALE.length - 1)];
    return { string: 1, fret: item.fret, freq: item.freq, label: item.label };
  }
  if (step.listen) {
    const freq = freqAt(step.listen.string, step.listen.fret);
    return {
      string: step.listen.string,
      fret: step.listen.fret,
      freq,
      label: midiToName(stringMidi(step.listen.string, step.listen.fret)).label,
    };
  }
  return null;
}

function captionText() {
  if (state.mode === 'tuner') {
    if (!state.listening) return 'Tuner  ·  press Listen, then pluck one open string';
    if (!state.hit) return 'Tuner  ·  no clear note yet';
    const note = nearestChromatic(state.hit.freq);
    const match = openMatch(state.hit);
    return match
      ? `String ${match.string}  ·  ${note.label}`
      : `${note.label}  ·  not an open string`;
  }
  if (state.playEvent?.caption) return state.playEvent.caption;
  const step = state.mode === 'lesson' ? currentStep() : null;
  if (step?.caption && !state.playEvent) return step.caption;
  return barCaption(activeBar());
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

function paragraphs(text) {
  return text.split(/\n\n/).map((part) => el('p', { text: part }));
}

function render() {
  document.querySelectorAll('.modes button').forEach((button) => {
    button.classList.toggle('on', button.dataset.mode === state.mode);
  });
  document.body.dataset.mode = state.mode;
  document.getElementById('highway').hidden = state.mode !== 'songs';
  const library = document.getElementById('library');
  const workspace = document.querySelector('.workspace');
  if (library) library.hidden = state.mode !== 'library';
  if (workspace) workspace.hidden = state.mode === 'library';
  if (state.mode === 'library') {
    renderLibrary();
    save();
    return;
  }
  if (state.mode === 'sixths') {
    renderSixths({ liveStrings: state.listening ? activeLiveStrings() : [] });
    paintLiveNotes();
    save();
    return;
  }
  if (state.mode === 'songs') {
    renderSongs();
    paintLiveNotes();
    save();
    return;
  }
  if (state.mode === 'theory') {
    renderTheory();
    paintLiveNotes();
    save();
    return;
  }
  renderLessonList();
  renderStage();
  renderInspector();
  paintLiveNotes();
  save();
}

function renderLessonList() {
  const aside = document.getElementById('lesson-list');
  aside.replaceChildren();
  const heading = el('p', { class: 'rail-label', text: 'Lessons' });
  aside.append(heading);
  LESSONS.forEach((lesson) => {
    const done = lessonComplete(lesson);
    const active = state.mode === 'lesson' && lesson.id === currentLesson().id;
    const button = el('button', {
      class: `lesson-item${active ? ' active' : ''}`,
      'data-action': 'lesson',
      'data-id': lesson.id,
    }, [
      el('span', { class: `num${done ? ' done' : ''}`, text: String(lesson.number).padStart(2, '0') }),
      el('span', { class: 'lesson-copy' }, [
        el('span', { class: 'lesson-title', text: lesson.title }),
        el('span', { class: 'lesson-summary', text: lesson.summary }),
      ]),
    ]);
    aside.append(button);
  });
  const finished = LESSONS.every(lessonComplete);
  aside.append(el('p', {
    class: 'rail-foot',
    text: finished
      ? `All ${LESSONS.length} lessons are marked. The practice desk is yours.`
      : 'C6  ·  C  E  G  A  C  E',
  }));
}

function ladderMarks() {
  const step = currentStep();
  if (state.mode !== 'lesson' || !step?.listen?.ladder) return [];
  return SCALE.map((item, index) => ({
    fret: item.fret,
    state: index < state.ladderIndex || (state.passed && index === state.ladderIndex)
      ? 'done'
      : index === state.ladderIndex ? 'now' : 'ahead',
  }));
}

function renderStage() {
  const mount = document.getElementById('neck-mount');
  const step = currentStep();
  const passage = state.playingKind === 'passage' && state.playEvent;
  const live = state.playEvent;
  const ladder = ladderMarks();
  renderNeck(mount, activeBar(), {
    ghost: passage
      ? (live.ghost || null)
      : (state.mode === 'lesson' && !live ? step?.ghost : null),
    marks: ladder.length ? ladder : (live?.marks || (state.mode === 'lesson' && !live ? step?.marks : []) || []),
    lights: live?.lights || (state.mode === 'lesson' && !live ? step?.lights : []) || [],
    demo: Boolean(state.demo && state.mode === 'lesson' && step?.demo),
    liveStrings: state.listening ? activeLiveStrings() : [],
    onFret: state.mode === 'practice' ? (fret) => {
      state.practice.fret = fret;
      render();
    } : null,
  });
  document.getElementById('caption').textContent = captionText();
  renderTransport();
}

function renderTransport() {
  const bar = document.getElementById('transport');
  bar.replaceChildren();
  const step = state.mode === 'lesson' ? currentStep() : null;
  const left = el('div', { class: 'transport-group' });
  left.append(el('button', { 'data-action': 'hear', text: 'Hear it' }));
  if (step?.rollStrings) left.append(el('button', { 'data-action': 'string-roll', text: 'Hear the roll' }));
  if (step?.roll) left.append(el('button', { 'data-action': 'chord-roll', text: 'Hear the roll' }));
  (step?.hears || []).forEach((part, index) => {
    left.append(el('button', { 'data-action': 'hear-part', 'data-index': String(index), text: part.label }));
  });
  if (step?.passage) {
    left.append(el('button', { 'data-action': 'passage', text: step.passageLabel || 'Hear the changes' }));
  }
  if (step?.demo) {
    left.append(el('button', {
      'data-action': 'demo',
      class: state.demo ? 'on' : '',
      text: state.demo ? 'Hide the motion' : 'Show the motion',
    }));
  }
  if (step?.drone) {
    left.append(el('button', { 'data-action': 'drone', text: 'Play the drone' }));
  }
  if (step?.timeline) {
    left.append(el('button', {
      id: 'play-btn',
      class: 'primary',
      'data-action': 'play',
      text: 'Play',
    }));
  }
  left.append(el('button', { 'data-action': 'metro', text: 'Metronome' }));
  left.append(el('button', { 'data-action': 'stop', text: 'Stop' }));
  left.append(el('button', {
    'data-action': 'listen',
    class: state.listening ? 'on' : '',
    text: state.listening ? 'Stop listening' : 'Listen',
  }));
  left.append(devicePicker(el));

  const mid = el('div', { class: 'transport-status', id: 'play-status', text: '' });

  const right = el('div', { class: 'transport-group sliders' });
  if (step?.timeline || state.mode !== 'lesson') {
    right.append(labeledRange('Tempo', 'tempo', state.tempo, 10, 110, 'bpm'));
    if (step?.timeline) {
      const guide = el('label', { class: 'check' }, [
        el('input', { type: 'checkbox', 'data-action': 'guide', ...(state.guide ? { checked: 'checked' } : {}) }),
        'Guide',
      ]);
      right.append(guide);
    }
  }
  right.append(labeledRange('Volume', 'volume', Math.round(state.volume * 100), 0, 100, ''));
  bar.append(left, mid, right);
}

function labeledRange(label, action, value, min, max, unit) {
  const wrap = el('label', { class: 'range' });
  wrap.append(el('span', { text: label }));
  const input = el('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    value: String(value),
    'data-action': action,
  });
  const readout = el('span', { class: 'range-value', id: `${action}-readout`, text: unit ? `${value} ${unit}` : `${value}` });
  wrap.append(input, readout);
  return wrap;
}

function renderInspector() {
  const pane = document.getElementById('inspector');
  pane.replaceChildren();
  if (state.mode === 'practice') {
    pane.append(practiceInspector());
    return;
  }
  if (state.mode === 'tuner') {
    pane.append(tunerInspector());
    return;
  }
  pane.append(lessonInspector());
}

function lessonInspector() {
  const lesson = currentLesson();
  const step = currentStep();
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: `Lesson ${lesson.number}  ·  Step ${state.stepIndex + 1} of ${lesson.steps.length}` }));
  wrap.append(el('h1', { text: step.title }));
  const dots = el('div', { class: 'dots' });
  lesson.steps.forEach((_, index) => {
    const cls = index === state.stepIndex ? 'dot now' : state.done[`${lesson.id}:${index}`] ? 'dot done' : 'dot';
    dots.append(el('button', { class: cls, 'data-action': 'step', 'data-index': String(index), 'aria-label': `Step ${index + 1}` }));
  });
  wrap.append(dots);
  paragraphs(step.body).forEach((p) => wrap.append(p));

  if (step.tune) wrap.append(tunePicker());
  if (step.listen || step.tune) wrap.append(meterBlock());
  if (step.listen?.ladder) wrap.append(ladderReadout());
  if (state.passed && step.listen?.ladder && state.ladderIndex >= SCALE.length - 1) {
    wrap.append(el('p', {
      class: 'closing',
      text: 'The scale is in tune. You can sit with the bar, play C6, F6, and G6, block down to one note, wobble around fret 12, and resolve the slant into G6. The practice desk is where you move the bar yourself.',
    }));
  }

  wrap.append(stringList(activeBar()));
  const actions = el('div', { class: 'step-actions' });
  actions.append(el('button', { 'data-action': 'prev', text: 'Back', disabled: state.stepIndex === 0 && lesson.number === 1 ? 'disabled' : null }));
  const last = state.stepIndex >= lesson.steps.length - 1;
  const lastLesson = lesson.number === LESSONS.length;
  actions.append(el('button', {
    class: 'primary',
    'data-action': 'next',
    text: last ? (lastLesson ? 'Finish' : 'Next lesson') : 'Next',
  }));
  wrap.append(actions);
  if (state.listenError) wrap.append(el('p', { class: 'error', text: state.listenError }));
  return wrap;
}

function tunePicker() {
  const row = el('div', { class: 'tune-row' });
  STRINGS.forEach((string) => {
    const name = midiToName(string.midi);
    const on = string.string === state.tuneString;
    const done = state.tuned.has(string.string);
    row.append(el('button', {
      class: `tune-string${on ? ' on' : ''}${done ? ' done' : ''}`,
      'data-action': 'tune-string',
      'data-string': String(string.string),
      text: `${string.string}  ${name.name}`,
    }));
  });
  const target = midiToName(STRINGS.find((string) => string.string === state.tuneString).midi);
  const block = el('div', { class: 'tune-block' }, [
    el('p', { class: 'kicker', text: `String ${state.tuneString}` }),
    row,
    el('button', { 'data-action': 'reference', text: `Play reference ${target.label}` }),
  ]);
  return block;
}

function meterBlock() {
  const target = currentTarget();
  const where = target
    ? (target.fret === 0 ? `${target.label}  ·  open string ${target.string}` : `Match ${target.label}`)
    : 'Match the note';
  return el('div', { class: 'meter-block' }, [
    el('div', { class: 'target-name', id: 'target-name', text: where }),
    el('div', { class: 'heard', id: 'heard', text: state.listening ? 'Listening…' : 'Press Listen, then play' }),
    el('div', { class: 'level-track' }, [el('div', { class: 'level', id: 'level' })]),
    el('div', { class: 'meter', id: 'meter' }, [
      el('div', { class: 'zone' }),
      el('div', { class: 'needle', id: 'needle' }),
    ]),
    el('div', { class: 'meter-scale' }, [
      el('span', { text: 'flat' }),
      el('span', { text: 'in tune' }),
      el('span', { text: 'sharp' }),
    ]),
    el('div', { class: 'hold-row' }, [
      el('div', { class: `hold${state.passed ? ' passed' : ''}`, id: 'hold-ring' }),
      el('p', { class: 'hold-copy', id: 'hold-copy', text: state.passed ? 'In tune.' : 'Play the note and hold it.' }),
    ]),
  ]);
}

function ladderReadout() {
  const item = SCALE[Math.min(state.ladderIndex, SCALE.length - 1)];
  const doneCount = state.passed ? SCALE.length : state.ladderIndex;
  return el('p', {
    class: 'ladder-readout',
    id: 'ladder-readout',
    text: `${doneCount} of ${SCALE.length}  ·  now ${item.label}, fret ${item.fret}`,
  });
}

function stringList(bar) {
  const list = el('ul', { class: 'string-list' });
  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const fret = fretOnString(bar, stringNumber);
    const picked = bar.picked?.includes(stringNumber);
    const muted = bar.muted?.includes(stringNumber);
    let role = 'quiet';
    let detail = 'leave it';
    if (muted) {
      role = 'mute';
      detail = 'mute';
    } else if (picked && fret != null) {
      role = 'pick';
      const name = midiToName(stringMidi(stringNumber, fret), Boolean(bar?.flats) || Boolean(dominantNinthName(bar)));
      detail = fret === 0 ? `open  ${name.label}` : `fret ${formatFret(fret)}  ${name.label}`;
    }
    list.append(el('li', { class: role }, [
      el('span', { class: 'sn', text: String(stringNumber) }),
      el('span', { text: detail }),
    ]));
  }
  return list;
}

function practiceInspector() {
  const bar = practiceModel();
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: 'Practice desk' }));
  wrap.append(el('h1', { text: describeNotes(soundingMidis(bar)) }));
  wrap.append(el('p', { text: 'Click a fret on the neck. The bar lands there. Forward tips the high strings toward the bridge.' }));

  wrap.append(el('p', { class: 'kicker', text: 'Places' }));
  const presets = el('div', { class: 'chip-row' });
  PRESETS.forEach((preset) => {
    presets.append(el('button', { 'data-action': 'preset', 'data-id': preset.id, text: preset.name }));
  });
  wrap.append(presets);

  wrap.append(el('p', { class: 'kicker', text: 'Fret' }));
  const frets = el('div', { class: 'chip-row' });
  [0, 3, 5, 7, 9, 12].forEach((fret) => {
    frets.append(el('button', {
      class: state.practice.fret === fret ? 'on' : '',
      'data-action': 'fret',
      'data-fret': String(fret),
      text: String(fret),
    }));
  });
  wrap.append(frets);

  wrap.append(el('p', { class: 'kicker', text: 'Bar' }));
  const slants = el('div', { class: 'chip-row' });
  [['Reverse', -1], ['Straight', 0], ['Forward', 1]].forEach(([label, slant]) => {
    slants.append(el('button', {
      class: state.practice.slant === slant ? 'on' : '',
      'data-action': 'slant',
      'data-slant': String(slant),
      text: label,
    }));
  });
  wrap.append(slants);

  wrap.append(el('p', { class: 'kicker', text: 'Strings under the bar' }));
  const spans = el('div', { class: 'chip-row' });
  [['All six', 'all'], ['Strings 1–3', 'top'], ['Strings 4–2', 'inner'], ['High string', 'one']].forEach(([label, span]) => {
    spans.append(el('button', {
      class: state.practice.span === span ? 'on' : '',
      'data-action': 'span',
      'data-span': span,
      text: label,
    }));
  });
  wrap.append(spans);

  const list = el('ul', { class: 'string-list pickable' });
  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const fret = fretOnString(bar, stringNumber);
    const picked = state.practice.picked.includes(stringNumber);
    const muted = state.practice.muted.includes(stringNumber);
    const role = muted ? 'mute' : picked ? 'pick' : 'quiet';
    const name = picked && fret != null
      ? midiToName(stringMidi(stringNumber, fret), Boolean(bar.flats) || Boolean(dominantNinthName(bar))).label
      : '';
    const detail = muted ? 'muted' : picked ? (fret === 0 || fret == null ? `open ${name}` : `fret ${formatFret(fret)}  ${name}`) : 'silent';
    list.append(el('li', {}, [
      el('button', {
        class: role,
        'data-action': 'string',
        'data-string': String(stringNumber),
        text: `${stringNumber}   ${detail}`,
      }),
    ]));
  }
  wrap.append(list);
  wrap.append(el('p', { class: 'hint', text: 'Click a string to switch it between sounding and muted.' }));
  const g7 = state.practice.span === 'inner'
    && state.practice.fret === 4
    && state.practice.slant === 1
    && state.practice.picked.includes(4)
    && state.practice.picked.includes(2)
    && !state.practice.picked.includes(3);
  if (g7) {
    wrap.append(el('p', { text: 'B and F. Those are the guide tones of G7. A straight bar on fret 7 is G6.' }));
  }
  const ninthCopy = {
    C9: 'G, Bb, and D. The 5, the flat 7, and the 9.',
    F9: 'C, Eb, and G. The 5, the flat 7, and the 9.',
    G9: 'D, F, and A. The 5, the flat 7, and the 9.',
  };
  const ninth = dominantNinthName(bar);
  if (ninthCopy[ninth]) wrap.append(el('p', { text: ninthCopy[ninth] }));
  return wrap;
}

function tunerInspector() {
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: 'Tuner' }));
  wrap.append(el('h1', { id: 'tuner-note', text: '—' }));
  wrap.append(el('p', { id: 'tuner-cents', class: 'tuner-cents', text: state.listening ? 'Pluck one string.' : 'Press Listen.' }));
  wrap.append(el('p', { text: 'Low to high: C, E, G, A, C, E. Play a reference, then match it on the steel. Headphones keep the meter honest.' }));
  const block = meterBlock();
  const targetName = block.querySelector('#target-name');
  if (targetName) targetName.textContent = 'Open strings';
  wrap.append(block);
  const refs = el('div', { class: 'chip-row' });
  STRINGS.forEach((string) => {
    const name = midiToName(string.midi);
    refs.append(el('button', {
      'data-action': 'reference',
      'data-string': String(string.string),
      text: `${string.string}  ${name.label}`,
    }));
  });
  wrap.append(refs);
  if (state.listenError) wrap.append(el('p', { class: 'error', text: state.listenError }));
  return wrap;
}

function onPitch(hit) {
  state.hit = hit;
  updateMeter();
  updateLiveStringHighlight(hit);
  if (state.mode === 'tuner') updateTunerReadout();
  if (state.mode === 'lesson') evaluateListen();
  if (state.mode === 'songs') songsOnPitch(hit);
  // Re-apply after any neck re-render triggered above (tuner / songs / ladder).
  if (state.listening) paintLiveNotes();
  const latencyEl = document.getElementById('latency-tip');
  if (latencyEl && pitch.on) {
    const next = latencyTipText(pitch.latencyInfo());
    if (next !== latencyEl.textContent) latencyEl.textContent = next;
  }
}

function updateMeter() {
  const heard = document.getElementById('heard');
  const needle = document.getElementById('needle');
  const level = document.getElementById('level');
  if (level) level.style.width = `${Math.min(100, (state.hit?.rms || 0) * 380)}%`;
  if (!heard || !needle) return;
  if (!state.listening) {
    heard.textContent = 'Press Listen, then play';
    needle.style.left = '50%';
    return;
  }
  if (!state.hit) {
    heard.textContent = 'No clear note';
    return;
  }
  const target = currentTarget();
  const cents = target ? centsBetween(state.hit.freq, target.freq) : nearestChromatic(state.hit.freq).cents;
  const shown = Math.max(-50, Math.min(50, cents));
  needle.style.left = `${((shown + 50) / 100) * 100}%`;
  const note = nearestChromatic(state.hit.freq);
  const abs = Math.abs(cents);
  const dir = cents > 0 ? 'sharp' : 'flat';
  heard.textContent = abs < 8 ? `${note.label}  ·  in tune` : `${note.label}  ·  ${Math.round(abs)} cents ${dir}`;
}

function updateTunerReadout() {
  const noteEl = document.getElementById('tuner-note');
  const centsEl = document.getElementById('tuner-cents');
  const caption = document.getElementById('caption');
  if (caption) caption.textContent = captionText();
  if (!noteEl) return;
  if (!state.hit) {
    noteEl.textContent = '—';
    if (centsEl) centsEl.textContent = 'No clear note';
    return;
  }
  const note = nearestChromatic(state.hit.freq);
  noteEl.textContent = note.label;
  const abs = Math.abs(note.cents);
  const dir = note.cents > 0 ? 'sharp' : 'flat';
  const match = openMatch(state.hit);
  const where = match ? `String ${match.string}` : 'Not an open string';
  if (centsEl) {
    centsEl.textContent = abs < 8 ? `${where}  ·  in tune` : `${where}  ·  ${Math.round(abs)} cents ${dir}`;
  }
  const matchKey = match ? match.string : 0;
  if (matchKey !== state.tunerKey) {
    state.tunerKey = matchKey;
    const mount = document.getElementById('neck-mount');
    renderNeck(mount, activeBar(), {
      liveStrings: state.listening ? activeLiveStrings() : [],
    });
    paintLiveNotes();
  }
}

function evaluateListen() {
  const step = currentStep();
  if (!step || state.passed) return;
  const target = currentTarget();
  if (!target) return;
  const now = performance.now();
  const dt = state.lastPitchAt ? Math.min(0.12, (now - state.lastPitchAt) / 1000) : 0;
  state.lastPitchAt = now;

  if (step.listen?.mode === 'vibrato') {
    evaluateVibrato(target, now);
    return;
  }
  const needed = step.listen?.hold || step.tune || step.listen?.ladder ? 0.7 : 0;
  if (!needed) return;
  if (!state.hit || !state.listening) {
    state.hold = 0;
  } else {
    const cents = Math.abs(centsBetween(state.hit.freq, target.freq));
    if (cents <= 12 && state.hit.clarity > 0.75) state.hold += dt;
    else state.hold = 0;
  }
  paintHold(needed);
  if (state.hold >= needed) passPitch();
}

function paintHold(needed) {
  const ring = document.getElementById('hold-ring');
  const copy = document.getElementById('hold-copy');
  const progress = Math.min(1, state.hold / needed);
  if (ring) ring.style.setProperty('--p', String(progress));
  if (copy && !state.passed) {
    copy.textContent = progress > 0.05 ? 'Hold it there.' : 'Play the note and hold it.';
  }
}

function evaluateVibrato(target, now) {
  const copy = document.getElementById('hold-copy');
  if (!state.hit) {
    if (copy) copy.textContent = 'Play the octave E, then rock the bar.';
    return;
  }
  const cents = centsBetween(state.hit.freq, target.freq);
  state.vib.push({ t: now, cents });
  state.vib = state.vib.filter((sample) => now - sample.t < 2000);
  if (state.vib.length < 8) return;
  const span = state.vib.at(-1).t - state.vib[0].t;
  const values = state.vib.map((sample) => sample.cents);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const width = Math.max(...values) - Math.min(...values);
  const dir = mean > 0 ? 'sharp' : 'flat';
  if (copy) {
    const center = Math.abs(mean) < 8 ? 'center is on the fret' : `center is ${Math.round(Math.abs(mean))} cents ${dir}`;
    copy.textContent = `${center}. Width ${Math.round(width)} cents.`;
  }
  if (span > 1200 && Math.abs(mean) < 15 && width > 18 && width < 90) {
    state.passed = true;
    markDone();
    if (copy) copy.textContent = 'That wobble sits on the fret.';
    const ring = document.getElementById('hold-ring');
    if (ring) ring.classList.add('passed');
    renderLessonList();
  }
}

function passPitch() {
  const step = currentStep();
  state.hold = 0;
  if (step.tune) {
    state.tuned.add(state.tuneString);
    if (state.tuneString > 1) {
      state.tuneString -= 1;
      render();
      return;
    }
  }
  if (step.listen?.ladder) {
    if (state.ladderIndex < SCALE.length - 1) {
      state.ladderIndex += 1;
      renderStage();
      const readout = document.getElementById('ladder-readout');
      const item = SCALE[state.ladderIndex];
      if (readout) readout.textContent = `${state.ladderIndex} of ${SCALE.length}  ·  now ${item.label}, fret ${item.fret}`;
      const copy = document.getElementById('hold-copy');
      if (copy) copy.textContent = 'Next fret.';
      const ring = document.getElementById('hold-ring');
      if (ring) ring.style.setProperty('--p', '0');
      return;
    }
  }
  state.passed = true;
  markDone();
  const copy = document.getElementById('hold-copy');
  if (copy) copy.textContent = 'In tune.';
  const ring = document.getElementById('hold-ring');
  if (ring) {
    ring.classList.add('passed');
    ring.style.setProperty('--p', '1');
  }
  renderLessonList();
  if (step.listen?.ladder) render();
}

function setStep(index) {
  audio.stop();
  state.stepIndex = index;
  state.passed = false;
  state.hold = 0;
  state.ladderIndex = 0;
  state.vib = [];
  state.demo = false;
  state.playEvent = null;
  state.playKey = '';
  state.playingKind = '';
  state.rollString = 0;
  state.tuneString = 6;
  state.tuned = new Set();
  render();
}

function next() {
  const lesson = currentLesson();
  markDone();
  if (state.stepIndex < lesson.steps.length - 1) {
    setStep(state.stepIndex + 1);
    return;
  }
  const index = LESSONS.findIndex((item) => item.id === lesson.id);
  if (index < LESSONS.length - 1) {
    state.lessonId = LESSONS[index + 1].id;
    setStep(0);
    return;
  }
  render();
}

function prev() {
  if (state.stepIndex > 0) setStep(state.stepIndex - 1);
}

function hear() {
  const step = state.mode === 'lesson' ? currentStep() : null;
  if (step?.hearMidis?.length) {
    audio.playNotes(step.hearMidis.map((midi) => midiToFreq(midi)));
    return;
  }
  if (step?.rollPattern) {
    const forward = step.rollPattern;
    const sequence = [...forward, ...[...forward].reverse()];
    state.rollString = 0;
    audio.playFigure(sequence.map((string) => freqAt(string, 0)), 0.42, (index, done) => {
      if (done || index >= sequence.length) {
        state.rollString = 0;
        renderStage();
        const status = document.getElementById('play-status');
        if (status) status.textContent = 'Forward, then back.';
        return;
      }
      state.rollString = sequence[index];
      renderStage();
      const status = document.getElementById('play-status');
      if (status) status.textContent = index < forward.length ? 'Forward roll' : 'Reverse roll';
    });
    return;
  }
  const midis = soundingMidis(activeBar());
  if (!midis.length) return;
  audio.playNotes(midis.map((midi) => midiToFreq(midi)));
}

const TIMELINES = {
  phrase: { events: PHRASE, chords: PHRASE_CHORDS, guide: true },
  changes: { events: CHANGES, chords: CHANGE_CHORDS, guide: true },
  upper: { events: UPPER_LINE, chords: UPPER_CHORDS, guide: true },
  form: { events: FORM, chords: FORM_CHORDS, guide: true },
  melody: { events: MELODY, chords: MELODY_CHORDS, guide: true },
  'melody-sixths': { events: MELODY_SIXTHS, chords: MELODY_CHORDS, guide: true },
  vamp: { events: VAMP, chords: VAMP_CHORDS, guide: true },
  intro: { events: INTRO, chords: INTRO_CHORDS, guide: true },
  backup: { events: BACKUP, chords: BACKUP_CHORDS, guide: true },
  'backup-ninth': { events: BACKUP_NINTH, chords: BACKUP_NINTH_CHORDS, guide: true },
  'slide-a': { events: SLIDE_A, chords: [], guide: true },
  'slide-b': { events: SLIDE_B, chords: [], guide: true },
  'slide-e': { events: SLIDE_E, chords: [], guide: true },
  takeoff: { events: TAKEOFF, chords: TAKEOFF_CHORDS, guide: true },
};

function beginTimeline(kind) {
  audio.stop();
  state.rollString = 0;
  state.playingKind = kind;
  state.playEvent = null;
  state.playKey = '';
  const table = TIMELINES[kind];
  audio.playTimeline({
    bpm: state.tempo,
    events: table ? table.events : [{ beat: 0, dur: 32, fret: 0 }],
    chords: table ? table.chords : [],
    guide: Boolean(table?.guide) && state.guide,
    onTick: (beatPos, done) => onTick(kind, beatPos, done),
  });
  const status = document.getElementById('play-status');
  if (status) status.textContent = 'Count in';
}

function onTick(kind, beatPos, done) {
  const status = document.getElementById('play-status');
  if (done) {
    state.playingKind = '';
    state.playEvent = null;
    state.playKey = '';
    if (status) status.textContent = kind === 'metro' ? '' : 'Again whenever you want.';
    if (kind !== 'metro') renderStage();
    return;
  }
  if (kind === 'metro') {
    if (status) {
      const beat = Math.floor(Math.max(0, beatPos)) % 4;
      status.textContent = beatPos < 0 ? `Count in  ${Math.ceil(-beatPos)}` : `Click  ${beat + 1}`;
    }
    return;
  }
  const events = TIMELINES[kind]?.events || [];
  let event = null;
  if (beatPos >= 0) {
    event = events.find((item) => beatPos >= item.beat && beatPos < item.beat + item.dur) || null;
  }
  const key = event ? String(event.beat) : 'count';
  if (key !== state.playKey) {
    state.playKey = key;
    state.playEvent = event;
    renderStage();
  }
  if (!status) return;
  if (beatPos < 0) status.textContent = `Count in  ${Math.ceil(-beatPos)}`;
  else if (event) status.textContent = `Bar ${event.bars}  ·  ${event.chord}  ·  ${event.name}`;
}

function syncPitchMonitor() {
  pitch.setMonitor(shouldMonitorLive());
  const tip = document.getElementById('monitor-tip');
  if (tip) {
    tip.textContent = monitorTipText();
    tip.classList.toggle('warn', isMonitorEnabled() && !shouldMonitorLive());
  }
  const latencyEl = document.getElementById('latency-tip');
  if (latencyEl) {
    latencyEl.textContent = pitch.on ? latencyTipText(pitch.latencyInfo()) : '';
  }
  document.querySelectorAll('.device-monitor').forEach((node) => {
    node.classList.toggle('warn', isMonitorEnabled() && !shouldMonitorLive());
  });
  document.querySelectorAll('#low-latency-toggle').forEach((node) => {
    if (node instanceof HTMLInputElement) node.checked = isLowLatencyEnabled();
  });
}

async function toggleListen() {
  if (pitch.on) {
    pitch.stop();
    state.listening = false;
    state.listenError = '';
    clearLiveNotes();
    render();
    return;
  }
  let chosenId = resolveInputId();
  let chosen = getInputs().find((device) => device.deviceId === chosenId);
  try {
    await pitch.start(chosenId || undefined, { monitor: shouldMonitorLive() });
    await refreshDevices();
    // Labels are empty before the first grant; prefer Scarlett once names appear.
    const preferred = adoptPreferredInput();
    adoptPreferredOutput();
    if (preferScarlettForMonitor()) {
      await Promise.all([audio.routeOutput(), routeTakeOutput(), pitch.routeOutput()]);
    }
    if (preferred && preferred !== chosenId) {
      pitch.stop();
      chosenId = preferred;
      chosen = getInputs().find((device) => device.deviceId === chosenId);
      await pitch.start(chosenId, { monitor: shouldMonitorLive() });
    } else if (chosenId) {
      setInputDeviceId(chosenId);
    }
    state.listening = true;
    state.listenError = '';
    syncPitchMonitor();
  } catch (err) {
    pitch.stop();
    state.listening = false;
    state.listenError = deviceErrorMessage(err, chosen?.label);
  }
  render();
}

async function changeInputDevice(id) {
  setInputDeviceId(id);
  const status = document.getElementById('input-status');
  if (status) status.textContent = inputStatusText();
  if (!pitch.on) {
    syncPitchMonitor();
    return;
  }
  pitch.stop();
  state.listening = false;
  state.listenError = '';
  try {
    await pitch.start(id || undefined, { monitor: shouldMonitorLive() });
    state.listening = true;
    await refreshDevices();
    syncPitchMonitor();
  } catch (err) {
    const chosen = getInputs().find((device) => device.deviceId === id);
    state.listenError = deviceErrorMessage(err, chosen?.label);
  }
  render();
}

async function changeOutputDevice(id) {
  setOutputDeviceId(id);
  await Promise.all([audio.routeOutput(), routeTakeOutput(), pitch.routeOutput()]);
  syncPitchMonitor();
  render();
}

async function changeMonitor(on) {
  setMonitorEnabled(on);
  if (on && preferScarlettForMonitor()) {
    await Promise.all([audio.routeOutput(), routeTakeOutput(), pitch.routeOutput()]);
  }
  syncPitchMonitor();
  render();
}

async function changeLowLatency(on) {
  const switched = setLowLatencyEnabled(on);
  if (switched || on) {
    await Promise.all([audio.routeOutput(), routeTakeOutput(), pitch.routeOutput()]);
  }
  syncPitchMonitor();
  render();
}

function applyPreset(id) {
  const preset = PRESETS.find((item) => item.id === id);
  if (!preset) return;
  state.practice = {
    fret: preset.fret,
    slant: preset.slant,
    span: preset.span,
    picked: [...preset.picked],
    muted: [...preset.muted],
  };
  render();
}

const actions = {
  mode(button) {
    audio.stop();
    stopSong();
    stopTheory();
    state.rollString = 0;
    state.mode = button.dataset.mode;
    state.playEvent = null;
    state.playingKind = '';
    render();
  },
  sixths(button) {
    sixthsCommand(button.dataset.sixths, button);
  },
  theory(button) {
    theoryCommand(button.dataset.theory, button);
  },
  ...songActions,
  'library-open'(button) {
    openLibraryFile(button.dataset.path);
  },
  lesson(button) {
    state.mode = 'lesson';
    state.lessonId = button.dataset.id;
    setStep(0);
  },
  step(button) {
    setStep(Number(button.dataset.index));
  },
  next,
  prev,
  hear,
  play() {
    const step = currentStep();
    if (step?.timeline) beginTimeline(step.timeline);
  },
  metro() {
    beginTimeline('metro');
  },
  stop() {
    audio.stop();
    stopSong();
    state.rollString = 0;
    state.playEvent = null;
    state.playKey = '';
    state.playingKind = '';
    render();
  },
  listen() {
    toggleListen();
  },
  demo() {
    state.demo = !state.demo;
    render();
  },
  drone() {
    const step = currentStep();
    if (!step?.drone) return;
    audio.startDrone(freqAt(step.drone.string, step.drone.fret));
  },
  'hear-part'(button) {
    const step = currentStep();
    const part = step?.hears?.[Number(button.dataset.index)];
    if (!part) return;
    audio.playNotes(soundingMidis(part.bar).map((midi) => midiToFreq(midi)));
  },
  passage() {
    const step = currentStep();
    if (!step?.passage?.length) return;
    const figures = step.passage;
    state.playingKind = 'passage';
    state.playEvent = null;
    audio.playPairs(
      figures.map((figure) => (figure.midis || soundingMidis(figure.bar)).map((midi) => midiToFreq(midi))),
      1.45,
      (index, done) => {
        if (done || index >= figures.length) {
          state.playingKind = '';
          state.playEvent = null;
          render();
          const status = document.getElementById('play-status');
          if (status) status.textContent = 'Again whenever you want.';
          return;
        }
        state.playEvent = figures[index];
        render();
        const status = document.getElementById('play-status');
        if (status) status.textContent = figures[index].label;
      },
    );
  },
  'string-roll'() {
    const step = currentStep();
    if (!step?.rollStrings) return;
    audio.playSequence(step.rollStrings.map((string) => freqAt(string, 0)));
  },
  'chord-roll'() {
    const step = currentStep();
    if (!step?.roll || !step.ghost) return;
    audio.playRoll(
      soundingMidis(step.bar).map((midi) => midiToFreq(midi)),
      soundingMidis(step.ghost).map((midi) => midiToFreq(midi)),
    );
  },
  reference(button) {
    const stringNumber = Number(button.dataset.string || state.tuneString);
    audio.playNotes([freqAt(stringNumber, 0)]);
  },
  'tune-string'(button) {
    state.tuneString = Number(button.dataset.string);
    state.hold = 0;
    state.passed = false;
    render();
  },
  preset(button) {
    applyPreset(button.dataset.id);
  },
  fret(button) {
    state.practice.fret = Number(button.dataset.fret);
    render();
  },
  slant(button) {
    state.practice.slant = Number(button.dataset.slant);
    render();
  },
  span(button) {
    const span = button.dataset.span;
    const covered = new Set(spanShape(span).strings);
    state.practice.span = span;
    state.practice.picked = [...covered];
    state.practice.muted = [1, 2, 3, 4, 5, 6].filter((string) => !covered.has(string));
    if (span === 'one' || span === 'top') state.practice.slant = 0;
    render();
  },
  string(button) {
    const stringNumber = Number(button.dataset.string);
    const picked = new Set(state.practice.picked);
    const muted = new Set(state.practice.muted);
    if (picked.has(stringNumber)) {
      picked.delete(stringNumber);
      muted.add(stringNumber);
    } else {
      muted.delete(stringNumber);
      picked.add(stringNumber);
    }
    state.practice.picked = [...picked];
    state.practice.muted = [...muted];
    render();
  },
};

document.body.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.tagName === 'INPUT') return;
  actions[button.dataset.action]?.(button);
});

document.body.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.action === 'tempo') {
    state.tempo = Number(input.value);
    const readout = document.getElementById('tempo-readout');
    if (readout) readout.textContent = `${state.tempo} bpm`;
    save();
  }
  if (input.dataset.action === 'song-query') {
    setSongQuery(input.value);
    return;
  }
  if (input.dataset.action === 'library-query') {
    setLibraryQuery(input.value);
    return;
  }
  if (input.dataset.action === 'song-speed') {
    state.songSpeed = Number(input.value);
    const readout = document.getElementById('song-speed-readout');
    if (readout) readout.textContent = `${Math.round(songById(state.songId).bpm * state.songSpeed / 100)} bpm`;
    save();
  }
  if (input.dataset.action === 'song-tempo') {
    const base = songById(state.songId).bpm || 70;
    const bpm = Math.max(10, Number(input.value));
    state.songSpeed = (bpm / base) * 100;
    const readout = document.getElementById('song-tempo-readout');
    if (readout) readout.textContent = `${Math.round(bpm)} bpm`;
    save();
  }
  if (input.dataset.action === 'volume') {
    state.volume = Number(input.value) / 100;
    audio.setVolume(state.volume);
    setTakeVolume(state.volume);
    const readout = document.getElementById('volume-readout');
    if (readout) readout.textContent = String(input.value);
    save();
  }
});

document.body.addEventListener('change', (event) => {
  const input = event.target;
  if (input instanceof HTMLInputElement && input.dataset.action === 'guide') {
    state.guide = input.checked;
    save();
  }
  if (input instanceof HTMLInputElement && input.dataset.action === 'monitor') {
    void changeMonitor(input.checked);
  }
  if (input instanceof HTMLInputElement && input.dataset.action === 'low-latency') {
    void changeLowLatency(input.checked);
  }
  if (input instanceof HTMLSelectElement && input.dataset.action === 'input-device') {
    changeInputDevice(input.value);
  }
  if (input instanceof HTMLSelectElement && input.dataset.action === 'output-device') {
    changeOutputDevice(input.value);
  }
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (state.mode === 'sixths' && onSixthsKey(event)) return;
  if (state.mode === 'theory') {
    theoryOnKey(event);
    return;
  }
  if (state.mode === 'songs' && event.code === 'Space') {
    event.preventDefault();
    songActions['song-play']();
    return;
  }
  if (state.mode === 'library') return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (state.mode === 'practice') {
      state.practice.fret = Math.min(12, state.practice.fret + 1);
      render();
    } else if (state.mode === 'lesson') next();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (state.mode === 'practice') {
      state.practice.fret = Math.max(0, state.practice.fret - 1);
      render();
    } else if (state.mode === 'lesson') prev();
  } else if (event.code === 'Space') {
    event.preventDefault();
    const step = state.mode === 'lesson' ? currentStep() : null;
    if (step?.timeline) actions.play();
    else hear();
  } else if (event.key === 'l' || event.key === 'L') {
    toggleListen();
  }
});

bindSixthsAudio(audio);
bindSongs(audio, {
  getState: () => state,
  toggleListen,
});

if (location.hash.startsWith('#songs')) {
  state.mode = 'songs';
  const id = location.hash.split('/')[1];
  if (id) state.songId = id;
}

if (location.hash.startsWith('#library')) {
  state.mode = 'library';
}

if (location.hash.startsWith('#theory')) {
  state.mode = 'theory';
}

if (location.hash.startsWith('#tuner')) {
  state.mode = 'tuner';
}

if (navigator.userAgent.includes('Mac')) document.body.classList.add('mac');
applyFretColorVars();

document.querySelectorAll('.modes button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.modes button').forEach((item) => item.classList.toggle('on', item === button));
  });
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    refreshDevices().then(() => {
      if (['lesson', 'practice', 'tuner', 'songs'].includes(state.mode)) render();
    });
  });
}

void refreshDevices().then(() => render());
render();
