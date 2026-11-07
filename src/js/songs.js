import { applyMediaSink, devicePicker } from './devices.js';
import { clampFret } from './fret-colors.js';
import { renderNeck } from './neck.js';
import { SONGS, filterSongs, songById } from './songs-data.js';
import { centsBetween, freqAt } from './theory.js';

/** Pixels per beat. Half-beat notes need ≥ pill (42) + 8 between centers → ≥100. */
const PIXELS = 104;
const NOW = 118;
const COUNT_IN = 4;
const PILL = 42;
const EARLY = 0.22;
const FOLLOW_IDLE_MS = 2000;
const STATS_KEY = 'straight-bar-song-stats-v1';

const play = {
  beat: -1,
  running: false,
  finished: false,
  score: 0,
  streak: 0,
  lit: -1,
  hits: new Set(),
  misses: new Set(),
  recorded: false,
};

let audio = null;
let getState = () => ({});
let toggleListen = async () => {};
let loopTimer = 0;
let songLoop = false;
let userScrolling = false;
let scrollIdleTimer = 0;
let programmaticScroll = false;
let highwayScrollBound = false;

function blankStats() {
  return {
    practiced: 0,
    correct: 0,
    misses: 0,
    consecutive: 0,
    bestConsecutive: 0,
  };
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { loop: false, songs: {} };
    return {
      loop: Boolean(raw.loop),
      songs: raw.songs && typeof raw.songs === 'object' ? raw.songs : {},
    };
  } catch {
    return { loop: false, songs: {} };
  }
}

function saveStore(store) {
  localStorage.setItem(STATS_KEY, JSON.stringify(store));
}

function songStats(id = song().id) {
  const store = loadStore();
  const entry = store.songs[id] || blankStats();
  return {
    practiced: Number(entry.practiced) || 0,
    correct: Number(entry.correct) || 0,
    misses: Number(entry.misses) || 0,
    consecutive: Number(entry.consecutive) || 0,
    bestConsecutive: Number(entry.bestConsecutive) || 0,
  };
}

function writeSongStats(id, next) {
  const store = loadStore();
  store.songs[id] = next;
  saveStore(store);
}

function isLoopOn() {
  return songLoop;
}

function setSongLoop(on) {
  songLoop = Boolean(on);
  const store = loadStore();
  store.loop = songLoop;
  saveStore(store);
  if (!songLoop) cancelLoopRestart();
}

function ratioLabel(correct, misses) {
  const total = correct + misses;
  if (!total) return '—';
  const pct = Math.round((correct / total) * 100);
  return `${pct}%`;
}

function cancelLoopRestart() {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = 0;
  }
}

function scheduleLoopRestart() {
  cancelLoopRestart();
  // Count-in on the next play is the gap; short beat before restarting.
  const ms = Math.max(180, Math.round((60 / playBpm()) * 1000));
  loopTimer = setTimeout(() => {
    loopTimer = 0;
    if (!isLoopOn() || getState().mode !== 'songs' || song().phrases) return;
    playSong();
  }, ms);
}

/** Correct/miss only when Listen scored this run; practiced always on finish. */
function recordFinishedRun() {
  if (song().phrases) return;
  const id = song().id;
  const stats = songStats(id);
  stats.practiced += 1;
  const listenScored = getState().listening || play.hits.size > 0 || play.misses.size > 0;
  if (listenScored) {
    stats.correct += play.hits.size;
    stats.misses += play.misses.size;
    if (play.misses.size === 0) stats.consecutive += 1;
    else stats.consecutive = 0;
    stats.bestConsecutive = Math.max(stats.bestConsecutive, stats.consecutive);
  }
  writeSongStats(id, stats);
  paintScoreboard();
}

function resetCurrentSongStats() {
  writeSongStats(song().id, blankStats());
  paintScoreboard();
}

export function bindSongs(api, hooks) {
  audio = api;
  getState = hooks.getState;
  toggleListen = hooks.toggleListen;
  songLoop = loadStore().loop;
  document.body.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.action === 'song-loop') {
      setSongLoop(input.checked);
      const status = document.getElementById('play-status');
      if (status && !play.running && !play.finished) status.textContent = modeLabel();
    }
  });
  bindHighwayScroll();
}

/** Beat 0 sits after count-in lead-in so negative beats stay on the track. */
function originX() {
  return NOW + COUNT_IN * PIXELS;
}

function noteX(beat) {
  return originX() + beat * PIXELS;
}

function trackEndBeat() {
  return song().notes.reduce((max, item) => Math.max(max, item.beat + Math.max(item.dur || 0, 1)), COUNT_IN);
}

function trackWidth() {
  return Math.ceil(noteX(trackEndBeat()) + PILL + 48);
}

function markUserScrolling() {
  userScrolling = true;
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    userScrolling = false;
    scrollIdleTimer = 0;
    if (play.running) followPlayhead(true);
  }, FOLLOW_IDLE_MS);
}

function highwayScroller() {
  return document.getElementById('highway-scroll');
}

function bindHighwayScroll() {
  if (highwayScrollBound) return;
  const mount = document.getElementById('highway');
  if (!mount) return;
  highwayScrollBound = true;
  const onUser = (event) => {
    if (!event.target.closest?.('#highway-scroll, #highway')) return;
    markUserScrolling();
  };
  // Listen on the highway shell so rebuilt scrollers still report user scrubbing.
  mount.addEventListener('wheel', onUser, { passive: true });
  mount.addEventListener('touchstart', onUser, { passive: true });
  mount.addEventListener('pointerdown', onUser);
  mount.addEventListener('scroll', (event) => {
    if (programmaticScroll) return;
    if (event.target?.id !== 'highway-scroll') return;
    markUserScrolling();
  }, true);
}

function followPlayhead(force = false) {
  const scroller = highwayScroller();
  const shell = document.getElementById('highway');
  if (!scroller || !shell || shell.hidden) return;
  // Auto-follow only while playing, and only if the user is not scrubbing.
  if (!force && (!play.running || userScrolling)) return;
  const beat = play.running || play.finished ? play.beat : 0;
  const headX = noteX(beat);
  const target = Math.max(0, headX - NOW);
  if (Math.abs(scroller.scrollLeft - target) < 0.5) return;
  programmaticScroll = true;
  scroller.scrollLeft = target;
  requestAnimationFrame(() => {
    programmaticScroll = false;
  });
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (child == null) return;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  });
  return node;
}

function song() {
  return songById(getState().songId);
}

function windowClose(note) {
  return note.beat + Math.max(0.4, Math.min(note.dur, 1));
}

function resetScore() {
  play.score = 0;
  play.streak = 0;
  play.finished = false;
  play.lit = -1;
  play.hits = new Set();
  play.misses = new Set();
  play.recorded = false;
}

function noteBar(item) {
  if (!item) return { open: true, fromString: null, toString: null, fromFret: 0, toFret: 0, picked: [], muted: [] };
  const muted = [1, 2, 3, 4, 5, 6].filter((string) => string !== item.string);
  return {
    fromString: item.string,
    toString: item.string,
    fromFret: item.fret,
    toFret: item.fret,
    picked: [item.string],
    muted,
  };
}

function currentNote(beat) {
  return song().notes.find((item) => beat >= item.beat && beat < item.beat + item.dur) || null;
}

function chordAt(beat) {
  return song().chords.find((item) => beat >= item.beat && beat < item.beat + item.dur) || null;
}

function modeLabel() {
  return getState().listening ? 'Listening' : 'Follow the lights';
}

/** Absolute play tempo for Songs / phrase outline; floor is 10 bpm. */
function playBpm() {
  const base = song().bpm || 70;
  return Math.max(10, Math.round(base * (getState().songSpeed / 100)));
}

function tempoRange() {
  const base = song().bpm || 70;
  const bpm = playBpm();
  const maxBpm = Math.max(Math.round(base * 1.2), 120);
  return range('Tempo', 'song-tempo', bpm, 10, maxBpm, `${bpm} bpm`);
}

const outline = {
  pick: 'F#4',
  running: false,
  which: null,
  cursor: -1,
  events: [],
};

let outlineToken = 0;

const take = {
  which: null,
  playing: false,
  error: '',
};

let takeAudio = null;

function takeElement() {
  if (takeAudio) return takeAudio;
  takeAudio = new Audio();
  takeAudio.preload = 'auto';
  takeAudio.hidden = true;
  document.body.append(takeAudio);
  takeAudio.addEventListener('ended', () => {
    take.playing = false;
    take.which = null;
    if (getState().mode === 'songs' && song().phrases) renderSongs();
  });
  return takeAudio;
}

export function setTakeVolume(value) {
  if (takeAudio) takeAudio.volume = value;
}

export async function routeTakeOutput() {
  if (takeAudio) await applyMediaSink(takeAudio);
}

function stopTake() {
  if (!takeAudio) return;
  takeAudio.pause();
  take.playing = false;
  take.which = null;
}

function playTake(id) {
  const item = (song().takes || []).find((entry) => entry.id === id);
  if (!item) return;
  const player = takeElement();
  if (take.playing && take.which === id) {
    stopTake();
    renderSongs();
    return;
  }
  outlineToken += 1;
  outline.running = false;
  outline.cursor = -1;
  outline.which = null;
  outline.events = [];
  audio?.stop();
  player.volume = getState().volume ?? 0.8;
  player.src = item.file;
  take.error = '';
  take.playing = true;
  take.which = id;
  renderSongs();
  void applyMediaSink(player).then(() => player.play()).catch(() => {
    take.playing = false;
    take.which = null;
    take.error = 'That recording did not play.';
    if (getState().mode === 'songs') renderSongs();
  });
}

function outlineEvent() {
  if (!outline.running || outline.cursor < 0) return null;
  return outline.events[outline.cursor] || null;
}

function finderNote(chart) {
  return chart.finder.find((item) => item.name === outline.pick)
    || chart.finder.find((item) => item.name === 'F#4');
}

function litNote(chart) {
  if (!outline.running) return finderNote(chart);
  const event = outlineEvent();
  return event && !event.rest ? event : null;
}

function placeLabel(item) {
  return `String ${item.string} · Fret ${item.fret}`;
}

function neckLights(chart, shown) {
  const lights = [];
  const seen = new Set();
  const add = (item) => {
    if (!item || item.string == null || item.fret == null) return;
    const key = `${item.string}:${item.fret}`;
    if (seen.has(key)) return;
    seen.add(key);
    lights.push({ string: item.string, fret: item.fret });
  };
  (chart.palette || []).forEach(add);
  add(shown);
  return lights;
}

function outlineEvents(phrases) {
  const events = [];
  phrases.forEach((phrase, index) => {
    if (index > 0) events.push({ rest: true });
    phrase.notes.forEach((item, noteIndex) => {
      events.push({ ...item, phraseId: phrase.id, noteIndex });
    });
  });
  return events;
}

function playOutline(phraseId) {
  const chart = song();
  const phrases = phraseId
    ? chart.phrases.filter((item) => item.id === phraseId)
    : chart.phrases;
  if (!phrases.length) return;
  stopTake();
  outlineToken += 1;
  const token = outlineToken;
  outline.events = outlineEvents(phrases);
  outline.running = true;
  outline.which = phraseId || 'all';
  outline.cursor = 0;
  const bpm = playBpm();
  audio.playFigure(
    outline.events.map((event) => (event.rest ? null : freqAt(event.string, event.fret))),
    60 / bpm,
    (index, done) => {
      if (token !== outlineToken) return;
      if (getState().mode !== 'songs' || !song().phrases) return;
      if (done || index >= outline.events.length) {
        outline.running = false;
        outline.cursor = -1;
        outline.which = null;
        outline.events = [];
        renderSongs();
        return;
      }
      outline.cursor = index;
      if (document.getElementById('finder-readout')) paintOutline();
      else renderSongs();
    },
  );
  renderSongs();
}

function liveNeckOptions(extra = {}) {
  const state = getState();
  return {
    ...extra,
    liveStrings: state.listening
      ? [...new Set((state.liveNotes || []).map((note) => note.string))]
      : [],
  };
}

function paintOutline() {
  const chart = song();
  const shown = litNote(chart);
  const event = outlineEvent();
  renderNeck(document.getElementById('neck-mount'), noteBar(shown), liveNeckOptions({
    lights: neckLights(chart, shown),
  }));
  const label = shown ? placeLabel(shown) : 'Rest';
  const caption = document.getElementById('caption');
  if (caption) caption.textContent = label;
  const readout = document.getElementById('finder-readout');
  if (readout) readout.textContent = label;
  const status = document.getElementById('play-status');
  if (status) {
    if (!outline.running) status.textContent = `${playBpm()} bpm`;
    else if (!event || event.rest) status.textContent = 'Rest';
    else {
      const phrase = chart.phrases.find((item) => item.id === event.phraseId);
      status.textContent = `${phrase?.title || 'Phrase'}  ·  ${event.name}`;
    }
  }
  document.querySelectorAll('.phrase-card').forEach((card, index) => {
    const phrase = chart.phrases[index];
    const sounding = Boolean(outline.running && event && event.phraseId === phrase.id);
    card.classList.toggle('on', sounding);
    card.querySelectorAll('.phrase-pitches span').forEach((span, noteIndex) => {
      span.classList.toggle('now', sounding && event.noteIndex === noteIndex);
    });
  });
  document.querySelectorAll('[data-action="song-find"]').forEach((button) => {
    const item = chart.finder.find((note) => note.name === button.dataset.name);
    const lit = Boolean(shown && item && shown.string === item.string && shown.fret === item.fret && shown.name === item.name);
    const held = !outline.running && item && item.name === outline.pick;
    button.classList.toggle('on', lit || held);
  });
}

function renderOutline(state) {
  document.body.dataset.chart = 'phrases';
  const highway = document.getElementById('highway');
  highway.hidden = true;
  highway.replaceChildren();
  const chart = song();
  const shown = litNote(chart);
  renderNeck(document.getElementById('neck-mount'), noteBar(shown), liveNeckOptions({
    lights: neckLights(chart, shown),
  }));
  document.getElementById('caption').textContent = shown ? placeLabel(shown) : 'Rest';
  renderOutlineTransport(state, chart);
  renderOutlineInspector(chart);
}

function renderOutlineTransport(state) {
  const bar = document.getElementById('transport');
  bar.replaceChildren();
  const left = el('div', { class: 'transport-group' });
  left.append(el('button', {
    class: 'primary',
    'data-action': 'song-play',
    text: 'Play all',
  }));
  left.append(el('button', { 'data-action': 'song-stop', text: 'Stop' }));
  left.append(devicePicker(el));
  const event = outlineEvent();
  const activeTake = (song().takes || []).find((item) => item.id === take.which);
  let status = take.playing && activeTake ? activeTake.label : `${playBpm()} bpm`;
  if (outline.running && event?.rest) status = 'Rest';
  else if (outline.running && event) {
    const phrase = song().phrases.find((item) => item.id === event.phraseId);
    status = `${phrase?.title || 'Phrase'}  ·  ${event.name}`;
  }
  const mid = el('div', { class: 'transport-status', id: 'play-status', text: status });
  const right = el('div', { class: 'transport-group sliders' });
  right.append(tempoRange());
  right.append(range('Volume', 'volume', Math.round(state.volume * 100), 0, 100, String(Math.round(state.volume * 100))));
  bar.append(left, mid, right);
}

function renderOutlineInspector(chart) {
  const pane = document.getElementById('inspector');
  pane.replaceChildren();
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: 'Songs' }));
  wrap.append(el('h1', { text: chart.title }));
  chart.copy.forEach((text) => wrap.append(el('p', { text })));
  if (chart.takes?.length) {
    wrap.append(el('p', { class: 'rail-label', text: 'Listen' }));
    const listens = el('div', { class: 'finder-row' });
    chart.takes.forEach((item) => {
      const playing = take.playing && take.which === item.id;
      const classes = [
        playing ? 'on' : '',
        item.id === 'natural' && !playing ? 'primary' : '',
      ].filter(Boolean).join(' ');
      listens.append(el('button', {
        class: classes,
        'data-action': 'song-take',
        'data-id': item.id,
        text: item.label,
      }));
    });
    wrap.append(listens);
    if (take.error) wrap.append(el('p', { class: 'error', text: take.error }));
  }
  wrap.append(el('p', { class: 'rail-label', text: 'Phrases' }));
  const list = el('div', { class: 'phrase-list' });
  const event = outlineEvent();
  chart.phrases.forEach((phrase) => {
    const sounding = Boolean(outline.running && event && event.phraseId === phrase.id);
    const card = el('div', { class: `phrase-card${sounding ? ' on' : ''}` });
    const copy = el('div', { class: 'phrase-copy' });
    copy.append(el('p', { class: 'phrase-title', text: phrase.title }));
    copy.append(el('p', { class: 'phrase-detail', text: phrase.detail }));
    const pitches = el('p', { class: 'phrase-pitches' });
    phrase.notes.forEach((item, noteIndex) => {
      if (noteIndex) pitches.append(document.createTextNode(', '));
      const now = sounding && event.noteIndex === noteIndex;
      pitches.append(el('span', { class: now ? 'now' : '', text: item.name }));
    });
    copy.append(pitches);
    card.append(copy);
    card.append(el('button', {
      'data-action': 'song-phrase',
      'data-id': phrase.id,
      text: 'Play',
    }));
    list.append(card);
  });
  wrap.append(list);
  wrap.append(el('p', { class: 'rail-label', text: 'Fret finder' }));
  const shown = litNote(chart);
  const row = el('div', { class: 'finder-row' });
  chart.finder.forEach((item) => {
    const selected = !outline.running && item.name === outline.pick;
    const lit = Boolean(shown && shown.name === item.name && shown.string === item.string && shown.fret === item.fret);
    row.append(el('button', {
      class: selected || lit ? 'on' : '',
      'data-action': 'song-find',
      'data-name': item.name,
      text: item.name,
    }));
  });
  wrap.append(row);
  wrap.append(el('p', {
    class: 'finder-readout',
    id: 'finder-readout',
    text: shown ? placeLabel(shown) : 'Rest',
  }));
  pane.append(wrap);
}

export function renderSongs() {
  const state = getState();
  document.body.dataset.mode = 'songs';
  document.querySelectorAll('.modes button').forEach((button) => {
    button.classList.toggle('on', button.dataset.mode === 'songs');
  });
  renderCatalog(state);
  if (song().phrases) {
    renderOutline(state);
    return;
  }
  delete document.body.dataset.chart;
  const highway = document.getElementById('highway');
  highway.hidden = false;
  renderHighway(state);
  renderNeck(document.getElementById('neck-mount'), noteBar(currentNote(play.beat)), liveNeckOptions({
    lights: currentNote(play.beat) ? [{ string: currentNote(play.beat).string, fret: currentNote(play.beat).fret }] : [],
  }));
  const chord = play.running && play.beat >= 0 ? chordAt(play.beat) : null;
  document.getElementById('caption').textContent = chord
    ? `${song().title}  ·  ${chord.name}`
    : `${song().title}  ·  ${song().credit}`;
  renderTransport(state);
  renderInspector(state);
  placeNotes();
}

function renderCatalog(state) {
  const aside = document.getElementById('lesson-list');
  const previous = document.activeElement;
  const typing = previous?.dataset?.action === 'song-query';
  const caret = typing ? previous.selectionStart : null;
  aside.replaceChildren();
  aside.append(el('p', { class: 'rail-label', text: 'Songs' }));
  const search = el('input', {
    class: 'song-search',
    type: 'search',
    placeholder: 'Search',
    value: state.songQuery || '',
    'data-action': 'song-query',
    'aria-label': 'Search songs',
  });
  aside.append(search);
  const matches = filterSongs(state.songQuery || '');
  if (!matches.length) {
    aside.append(el('p', { class: 'rail-foot', text: 'Nothing under that name.' }));
  }
  matches.forEach((item) => {
    aside.append(el('button', {
      class: `lesson-item${item.id === song().id ? ' active' : ''}`,
      'data-action': 'song',
      'data-id': item.id,
    }, [
      el('span', { class: 'lesson-copy' }, [
        el('span', { class: 'lesson-title', text: item.title }),
        el('span', { class: 'lesson-summary', text: item.credit }),
      ]),
    ]));
  });
  aside.append(el('p', {
    class: 'rail-foot',
    text: 'Built in. Nothing is fetched.',
  }));
  if (typing) {
    const input = aside.querySelector('[data-action="song-query"]');
    input.focus();
    const pos = caret ?? input.value.length;
    input.setSelectionRange(pos, pos);
  }
}

function renderHighway() {
  const mount = document.getElementById('highway');
  mount.replaceChildren();
  const gutter = el('div', { class: 'highway-gutter', 'aria-hidden': 'true' });
  for (let string = 1; string <= 6; string += 1) {
    const label = el('span', { class: 'lane-num', text: String(string) });
    label.style.top = `${(string - 1) * (100 / 6) + 100 / 12}%`;
    gutter.append(label);
  }
  const scroller = el('div', { class: 'highway-scroll', id: 'highway-scroll' });
  const lanes = el('div', { class: 'lanes', id: 'song-lanes' });
  lanes.style.width = `${trackWidth()}px`;
  for (let string = 1; string <= 6; string += 1) {
    const lane = el('div', { class: 'lane', 'data-string': String(string) });
    lane.style.top = `${(string - 1) * (100 / 6)}%`;
    lanes.append(lane);
  }
  lanes.append(el('div', { class: 'now-line', id: 'song-now', title: 'Now' }));
  song().notes.forEach((item, index) => {
    const token = el('span', {
      class: `gh-note${play.hits.has(index) ? ' hit' : ''}${play.misses.has(index) ? ' miss' : ''}`,
      'data-index': String(index),
      'data-string': String(item.string),
      'data-fret': String(clampFret(item.fret)),
      text: String(item.fret),
    });
    lanes.append(token);
  });
  scroller.append(lanes);
  mount.append(gutter, scroller);
  userScrolling = false;
  if (scrollIdleTimer) {
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = 0;
  }
  placeNotes();
  followPlayhead(true);
}

function placeNotes() {
  const lanes = document.getElementById('song-lanes');
  if (lanes) lanes.style.width = `${trackWidth()}px`;

  document.querySelectorAll('.gh-note').forEach((token) => {
    const item = song().notes[Number(token.dataset.index)];
    if (!item) return;
    token.style.left = `${noteX(item.beat)}px`;
    token.style.top = `${(item.string - 1) * (100 / 6) + 100 / 12}%`;
    const active = play.beat >= item.beat && play.beat < item.beat + item.dur && play.running;
    token.classList.toggle('now', active);
  });

  const headBeat = play.running || play.finished ? play.beat : 0;
  const nowLine = document.getElementById('song-now');
  if (nowLine) nowLine.style.left = `${noteX(headBeat)}px`;

  document.querySelectorAll('.lane').forEach((lane) => {
    const active = currentNote(play.beat);
    lane.classList.toggle('hot', Boolean(active && play.running && String(active.string) === lane.dataset.string));
  });

  followPlayhead();
}

function renderTransport(state) {
  const bar = document.getElementById('transport');
  bar.replaceChildren();
  const left = el('div', { class: 'transport-group' });
  left.append(el('button', {
    class: 'primary',
    'data-action': 'song-play',
    text: play.finished ? 'Play again' : play.running ? 'Play again' : 'Play',
  }));
  left.append(el('button', { 'data-action': 'song-stop', text: 'Stop' }));
  left.append(el('button', {
    'data-action': 'listen',
    class: state.listening ? 'on' : '',
    text: state.listening ? 'Stop listening' : 'Listen',
  }));
  left.append(devicePicker(el));
  const status = play.running && play.beat < 0
    ? `Count in  ${Math.max(1, Math.ceil(-play.beat))}`
    : play.finished
      ? (isLoopOn() ? 'Looping…' : 'Again whenever you want.')
      : play.running
        ? modeLabel()
        : modeLabel();
  const mid = el('div', { class: 'transport-status', id: 'play-status', text: status });
  const right = el('div', { class: 'transport-group sliders' });
  right.append(tempoRange());
  const guide = el('label', { class: 'check' }, [
    el('input', { type: 'checkbox', 'data-action': 'guide', ...(state.guide ? { checked: 'checked' } : {}) }),
    'Guide',
  ]);
  right.append(guide);
  const loop = el('label', { class: 'check' }, [
    el('input', {
      type: 'checkbox',
      'data-action': 'song-loop',
      ...(isLoopOn() ? { checked: 'checked' } : {}),
    }),
    'Loop',
  ]);
  right.append(loop);
  right.append(range('Volume', 'volume', Math.round(state.volume * 100), 0, 100, String(Math.round(state.volume * 100))));
  bar.append(left, mid, right);
}

function range(label, action, value, min, max, readout) {
  const wrap = el('label', { class: 'range' });
  wrap.append(el('span', { text: label }));
  wrap.append(el('input', {
    type: 'range',
    min: String(min),
    max: String(max),
    value: String(value),
    'data-action': action,
  }));
  wrap.append(el('span', { class: 'range-value', id: `${action}-readout`, text: readout }));
  return wrap;
}

function renderInspector(state) {
  const pane = document.getElementById('inspector');
  pane.replaceChildren();
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: 'Songs' }));
  wrap.append(el('h1', { text: song().title }));
  wrap.append(el('p', { text: song().credit }));
  wrap.append(el('p', { class: 'mode-flag', id: 'score-mode', text: modeLabel() }));
  const run = el('div', { class: 'score-row' });
  run.append(stat('This run', String(play.score), 'score-value'));
  run.append(stat('Streak', String(play.streak), 'streak-value'));
  wrap.append(run);
  wrap.append(scoreboardPanel());
  wrap.append(el('p', {
    class: 'hint',
    id: 'score-hint',
    text: state.listening
      ? 'Correct and Miss count only with Listen on (within 25 cents). Practiced counts every full playthrough.'
      : 'Follow the lights. Turn Listen on to score Correct / Miss from the microphone. Practiced still counts when a run finishes.',
  }));
  if (state.listenError) wrap.append(el('p', { class: 'error', text: state.listenError }));
  pane.append(wrap);
}

function scoreboardPanel() {
  const stats = songStats();
  const board = el('div', { class: 'scoreboard', id: 'song-scoreboard' });
  board.append(el('p', { class: 'scoreboard-title', text: 'Scoreboard' }));
  const grid = el('div', { class: 'scoreboard-grid' });
  grid.append(stat('Practiced', String(stats.practiced), 'board-practiced'));
  grid.append(stat('Correct', String(stats.correct), 'board-correct'));
  grid.append(stat('Misses', String(stats.misses), 'board-misses'));
  grid.append(stat('Ratio', ratioLabel(stats.correct, stats.misses), 'board-ratio'));
  const streak = stat('Consecutive', String(stats.consecutive), 'board-consecutive');
  streak.append(el('span', {
    class: 'stat-sub',
    id: 'board-best',
    text: `Best ${stats.bestConsecutive}`,
  }));
  grid.append(streak);
  board.append(grid);
  board.append(el('button', {
    'data-action': 'song-reset-stats',
    text: 'Reset stats',
  }));
  return board;
}

function stat(label, value, id) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-label', text: label }),
    el('span', { class: 'stat-value', id, text: value }),
  ]);
}

function paintScoreboard() {
  const stats = songStats();
  const practiced = document.getElementById('board-practiced');
  const correct = document.getElementById('board-correct');
  const misses = document.getElementById('board-misses');
  const ratio = document.getElementById('board-ratio');
  const consecutive = document.getElementById('board-consecutive');
  const best = document.getElementById('board-best');
  if (practiced) practiced.textContent = String(stats.practiced);
  if (correct) correct.textContent = String(stats.correct);
  if (misses) misses.textContent = String(stats.misses);
  if (ratio) ratio.textContent = ratioLabel(stats.correct, stats.misses);
  if (consecutive) consecutive.textContent = String(stats.consecutive);
  if (best) best.textContent = `Best ${stats.bestConsecutive}`;
}

function paintScore() {
  const score = document.getElementById('score-value');
  const streak = document.getElementById('streak-value');
  const mode = document.getElementById('score-mode');
  const hint = document.getElementById('score-hint');
  const status = document.getElementById('play-status');
  if (score) score.textContent = String(play.score);
  if (streak) streak.textContent = String(play.streak);
  if (mode) mode.textContent = modeLabel();
  if (hint) {
    hint.textContent = getState().listening
      ? 'Correct and Miss count only with Listen on (within 25 cents). Practiced counts every full playthrough.'
      : 'Follow the lights. Turn Listen on to score Correct / Miss from the microphone. Practiced still counts when a run finishes.';
  }
  if (status && play.running) {
    status.textContent = play.beat < 0 ? `Count in  ${Math.max(1, Math.ceil(-play.beat))}` : modeLabel();
  }
}

function mark(index, kind) {
  if (kind === 'hit') play.hits.add(index);
  if (kind === 'miss') play.misses.add(index);
  const token = document.querySelector(`.gh-note[data-index="${index}"]`);
  if (!token) return;
  token.classList.remove('hit', 'miss');
  token.classList.add(kind);
}

function judgeMisses() {
  if (!getState().listening) return;
  song().notes.forEach((item, index) => {
    if (play.hits.has(index) || play.misses.has(index)) return;
    if (play.beat <= windowClose(item)) return;
    mark(index, 'miss');
    play.streak = 0;
  });
}

function lightNeck() {
  const item = currentNote(play.beat);
  const key = item ? `${item.string}:${item.fret}:${item.beat}` : '';
  if (key === play.lit) return;
  play.lit = key;
  renderNeck(document.getElementById('neck-mount'), noteBar(play.running ? item : null), liveNeckOptions({
    lights: item && play.running ? [{ string: item.string, fret: item.fret }] : [],
  }));
  const chord = item ? chordAt(play.beat) : null;
  const caption = document.getElementById('caption');
  if (caption) {
    caption.textContent = chord ? `${song().title}  ·  ${chord.name}` : song().title;
  }
}

function onFrame(beatPos, done) {
  play.beat = beatPos;
  play.running = !done;
  play.finished = done;
  placeNotes();
  judgeMisses();
  lightNeck();
  paintScore();
  if (done) {
    play.running = false;
    if (!play.recorded) {
      play.recorded = true;
      recordFinishedRun();
    }
    lightNeck();
    if (isLoopOn()) {
      const status = document.getElementById('play-status');
      if (status) status.textContent = 'Looping…';
      const button = document.querySelector('[data-action="song-play"]');
      if (button) button.textContent = 'Play again';
      scheduleLoopRestart();
      return;
    }
    const status = document.getElementById('play-status');
    if (status) status.textContent = 'Again whenever you want.';
    const button = document.querySelector('[data-action="song-play"]');
    if (button) button.textContent = 'Play again';
  }
}

export function playSong() {
  if (song().phrases) {
    playOutline(null);
    return;
  }
  cancelLoopRestart();
  const state = getState();
  resetScore();
  play.beat = -COUNT_IN;
  play.running = true;
  play.finished = false;
  userScrolling = false;
  if (scrollIdleTimer) {
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = 0;
  }
  document.querySelectorAll('.gh-note').forEach((token) => token.classList.remove('hit', 'miss', 'now'));
  placeNotes();
  const bpm = playBpm();
  audio.playChart({
    bpm,
    notes: song().notes,
    chords: song().chords,
    guide: state.guide,
    onFrame,
  });
  const button = document.querySelector('[data-action="song-play"]');
  if (button) button.textContent = 'Play again';
  paintScore();
  paintScoreboard();
}

export function stopSong() {
  cancelLoopRestart();
  outlineToken += 1;
  stopTake();
  audio?.stop();
  play.running = false;
  play.finished = false;
  play.beat = -1;
  play.lit = '';
  userScrolling = false;
  if (scrollIdleTimer) {
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = 0;
  }
  outline.running = false;
  outline.cursor = -1;
  outline.which = null;
  outline.events = [];
  if (getState().mode !== 'songs') return;
  if (song().phrases) {
    renderSongs();
    return;
  }
  placeNotes();
  followPlayhead(true);
  lightNeck();
  const status = document.getElementById('play-status');
  if (status) status.textContent = modeLabel();
  const button = document.querySelector('[data-action="song-play"]');
  if (button) button.textContent = 'Play';
}

export function songsOnPitch(hit) {
  if (!play.running || song().phrases || !getState().listening || !hit) return;
  const chart = song();
  const index = chart.notes.findIndex((item, noteIndex) => {
    if (play.hits.has(noteIndex) || play.misses.has(noteIndex)) return false;
    return play.beat >= item.beat - EARLY && play.beat <= windowClose(item);
  });
  if (index < 0) return;
  const item = chart.notes[index];
  const cents = Math.abs(centsBetween(hit.freq, freqAt(item.string, item.fret)));
  if (cents == null || cents > 25) return;
  mark(index, 'hit');
  play.score += 1;
  play.streak += 1;
  paintScore();
}

export function selectSong(id) {
  stopSong();
  resetScore();
  getState().songId = id;
  renderSongs();
}

export function setSongQuery(value) {
  getState().songQuery = value;
  renderSongs();
}

export const songActions = {
  song(button) {
    selectSong(button.dataset.id);
  },
  'song-play': playSong,
  'song-stop': stopSong,
  'song-reset-stats'() {
    resetCurrentSongStats();
  },
  'song-phrase'(button) {
    playOutline(button.dataset.id);
  },
  'song-take'(button) {
    playTake(button.dataset.id);
  },
  'song-find'(button) {
    outline.pick = button.dataset.name;
    if (outline.running) {
      outlineToken += 1;
      outline.running = false;
      outline.cursor = -1;
      outline.which = null;
      outline.events = [];
      audio?.stop();
    }
    renderSongs();
  },
};

export function songsCatalogIds() {
  return SONGS.map((item) => item.id);
}
