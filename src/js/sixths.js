import { renderFretboard } from './fretboard.js';
import {
  chordFrequencies,
  getMidiNote,
  frequency,
  noteName,
  scaleSteps,
  sixthChordName,
  stepNotes,
  tuning,
} from './sixths-data.js';

const sixths = {
  view: 'scale',
  index: 0,
  showAll: false,
  chordFret: 0,
  speed: 100,
  quizIndex: 0,
  guessFret: null,
  guessStrings: [],
  verdict: null,
  revealed: false,
  playing: false,
};

let audio = null;

export function bindSixthsAudio(api) {
  audio = api;
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

function button(sixthsAction, attrs = {}, children = []) {
  return el('button', { type: 'button', 'data-action': 'sixths', 'data-sixths': sixthsAction, ...attrs }, children);
}

function activeStep() {
  if (sixths.view === 'quiz') return scaleSteps[sixths.quizIndex];
  return scaleSteps[sixths.index];
}

function markers() {
  if (sixths.view === 'chord') {
    return tuning.map((item) => ({
      string: item.string,
      fret: sixths.chordFret,
      tone: 'chord',
      name: noteName(getMidiNote(item.string, sixths.chordFret)).name,
    }));
  }
  if (sixths.view === 'quiz' && !sixths.revealed) {
    if (sixths.guessFret == null) return [];
    return sixths.guessStrings.map((stringNumber) => ({
      string: stringNumber,
      fret: sixths.guessFret,
      tone: 'guess',
      name: noteName(getMidiNote(stringNumber, sixths.guessFret)).name,
    }));
  }
  const notes = stepNotes(activeStep());
  return [
    { string: notes.bassString, fret: activeStep().fret, tone: 'bass', name: notes.bass.name },
    { string: notes.trebleString, fret: activeStep().fret, tone: 'treble', name: notes.treble.name },
  ];
}

function gapSeconds() {
  return 0.9 * (100 / Math.max(40, sixths.speed));
}

function playFrequencies(freqs) {
  if (!audio || !freqs.length) return;
  audio.playNotes(freqs);
}

function playCurrent() {
  if (sixths.view === 'chord') {
    playFrequencies(chordFrequencies(sixths.chordFret));
    return;
  }
  if (sixths.view === 'quiz' && !sixths.revealed) {
    if (sixths.guessFret == null || sixths.guessStrings.length === 0) return;
    playFrequencies(sixths.guessStrings.map((stringNumber) => frequency(getMidiNote(stringNumber, sixths.guessFret))));
    return;
  }
  const notes = stepNotes(activeStep());
  playFrequencies([notes.bass.freq, notes.treble.freq]);
}

function playScale() {
  if (!audio) return;
  sixths.view = 'scale';
  sixths.playing = true;
  const pairs = scaleSteps.map((step) => {
    const notes = stepNotes(step);
    return [notes.bass.freq, notes.treble.freq];
  });
  audio.playPairs(pairs, gapSeconds(), (index, done) => {
    if (done) {
      sixths.playing = false;
      const status = document.getElementById('play-status');
      if (status) status.textContent = 'Scale finished';
      return;
    }
    if (index >= scaleSteps.length || index === sixths.index && sixths.view === 'scale') {
      sixths.index = Math.min(index, scaleSteps.length - 1);
      return;
    }
    sixths.index = Math.min(index, scaleSteps.length - 1);
    renderSixths();
  });
  renderSixths();
}

function clearGuess() {
  sixths.guessFret = null;
  sixths.guessStrings = [];
  sixths.verdict = null;
  sixths.revealed = false;
}

function sameStrings(left, right) {
  return [...left].sort((a, b) => a - b).join() === [...right].sort((a, b) => a - b).join();
}

function checkGuess() {
  const step = scaleSteps[sixths.quizIndex];
  if (sixths.guessFret == null || sixths.guessStrings.length !== 2) {
    sixths.verdict = 'incomplete';
    renderSixths();
    return;
  }
  const right = sixths.guessFret === step.fret && sameStrings(sixths.guessStrings, step.strings);
  sixths.verdict = right ? 'right' : 'wrong';
  if (right) {
    sixths.revealed = true;
    const notes = stepNotes(step);
    playFrequencies([notes.bass.freq, notes.treble.freq]);
  }
  renderSixths();
}

function revealAnswer() {
  const notes = stepNotes(scaleSteps[sixths.quizIndex]);
  sixths.revealed = true;
  sixths.verdict = sixths.verdict || 'wrong';
  playFrequencies([notes.bass.freq, notes.treble.freq]);
  renderSixths();
}

function toggleString(stringNumber) {
  const list = sixths.guessStrings;
  const index = list.indexOf(stringNumber);
  if (index >= 0) list.splice(index, 1);
  else {
    list.push(stringNumber);
    if (list.length > 2) list.shift();
  }
  sixths.verdict = null;
  sixths.revealed = false;
}

function onBoard({ string, fret }) {
  if (sixths.view === 'chord') {
    sixths.chordFret = fret;
    renderSixths();
    return;
  }
  if (sixths.view === 'quiz') {
    if (sixths.guessFret !== fret) {
      sixths.guessFret = fret;
      sixths.verdict = null;
      sixths.revealed = false;
      if (!sixths.guessStrings.includes(string)) toggleString(string);
    } else {
      toggleString(string);
    }
    renderSixths();
    return;
  }
  const match = scaleSteps.findIndex((step) => step.fret === fret && step.strings.includes(string));
  if (match >= 0) {
    sixths.index = match;
    renderSixths();
  }
}

function move(delta) {
  if (sixths.view === 'chord') {
    sixths.chordFret = Math.max(0, Math.min(12, sixths.chordFret + delta));
  } else if (sixths.view === 'quiz') {
    sixths.quizIndex = (sixths.quizIndex + delta + scaleSteps.length) % scaleSteps.length;
    clearGuess();
  } else {
    sixths.index = (sixths.index + delta + scaleSteps.length) % scaleSteps.length;
  }
  renderSixths();
}

export function sixthsCommand(name, node) {
  if (name === 'next') move(1);
  else if (name === 'prev') move(-1);
  else if (name === 'step') {
    const index = Number(node.dataset.index);
    if (sixths.view === 'quiz') {
      sixths.quizIndex = index;
      clearGuess();
    } else if (sixths.view === 'chord') {
      sixths.chordFret = index;
    } else {
      sixths.index = index;
    }
    renderSixths();
  } else if (name === 'play') playCurrent();
  else if (name === 'scale') playScale();
  else if (name === 'stop') {
    sixths.playing = false;
    if (audio) audio.stop();
    const status = document.getElementById('play-status');
    if (status) status.textContent = '';
  } else if (name === 'notes') {
    sixths.showAll = !sixths.showAll;
    renderSixths();
  } else if (name === 'view') {
    sixths.view = node.dataset.view;
    sixths.playing = false;
    if (audio) audio.stop();
    renderSixths();
  } else if (name === 'check') checkGuess();
  else if (name === 'reveal') revealAnswer();
  else if (name === 'string') {
    toggleString(Number(node.dataset.string));
    renderSixths();
  }
}

export function onSixthsKey(event) {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    move(1);
    return true;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    move(-1);
    return true;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    playCurrent();
    return true;
  }
  return false;
}

function renderRail() {
  const aside = document.getElementById('lesson-list');
  aside.replaceChildren();
  if (sixths.view === 'chord') {
    aside.append(el('p', { class: 'rail-label', text: 'Straight bar' }));
    for (let fret = 0; fret <= 12; fret += 1) {
      aside.append(button('step', {
        class: `lesson-item${fret === sixths.chordFret ? ' active' : ''}`,
        'data-index': String(fret),
      }, [
        el('span', { class: 'num', text: String(fret).padStart(2, '0') }),
        el('span', { class: 'lesson-title', text: sixthChordName(fret) }),
      ]));
    }
    return;
  }
  const quiz = sixths.view === 'quiz';
  aside.append(el('p', { class: 'rail-label', text: quiz ? 'Find the note' : 'C major sixths' }));
  scaleSteps.forEach((step, index) => {
    const current = quiz ? index === sixths.quizIndex : index === sixths.index;
    const detail = quiz ? step.note : `${step.note}  ·  fret ${step.fret}`;
    aside.append(button('step', {
      class: `lesson-item${current ? ' active' : ''}`,
      'data-index': String(index),
    }, [
      el('span', { class: 'num', text: String(index + 1).padStart(2, '0') }),
      el('span', { class: 'lesson-copy' }, [
        el('span', { class: 'lesson-title', text: detail }),
        quiz ? null : el('span', { class: 'lesson-summary', text: step.interval }),
      ]),
    ]));
  });
}

function renderTransport() {
  const bar = document.getElementById('transport');
  bar.replaceChildren();
  const left = el('div', { class: 'transport-group' });
  left.append(button('prev', {}, [document.createTextNode('Previous')]));
  left.append(button('next', {}, [document.createTextNode('Next')]));
  left.append(button('play', { class: 'primary' }, [document.createTextNode('Play')]));
  left.append(button('scale', {}, [document.createTextNode('Play scale')]));
  left.append(button('stop', {}, [document.createTextNode('Stop')]));
  left.append(button('notes', { class: sixths.showAll ? 'on' : '' }, [
    document.createTextNode(sixths.showAll ? 'Hide note names' : 'All note names'),
  ]));
  const speed = el('label', { class: 'range' });
  speed.append(el('span', { text: 'Speed' }));
  speed.append(el('input', {
    type: 'range',
    min: '50',
    max: '160',
    value: String(sixths.speed),
    'data-action': 'sixths-speed',
  }));
  speed.append(el('span', { class: 'range-value', id: 'sixths-speed-readout', text: `${sixths.speed}%` }));
  bar.append(left, el('div', { class: 'transport-status', id: 'play-status', text: '' }), speed);
}

function detailScale(step) {
  const notes = stepNotes(step);
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: `Step ${scaleSteps.indexOf(step) + 1} of ${scaleSteps.length}` }));
  wrap.append(el('h1', { text: step.note }));
  wrap.append(el('p', { text: `${notes.bass.label} and ${notes.treble.label}. ${step.interval}.` }));
  wrap.append(el('p', { text: `Fret ${step.fret}. Strings ${notes.bassString} and ${notes.trebleString}.` }));
  wrap.append(el('p', { class: 'hint', text: `Red is the thumb on string ${notes.bassString}, the lower note ${notes.bass.label}. Blue is the middle finger on string ${notes.trebleString}, ${notes.treble.label}.` }));
  return wrap;
}

function detailChord() {
  const wrap = el('div', { class: 'inspector-inner' });
  const name = sixthChordName(sixths.chordFret);
  wrap.append(el('p', { class: 'kicker', text: 'Straight bar' }));
  wrap.append(el('h1', { text: name }));
  wrap.append(el('p', { text: sixths.chordFret === 0
    ? 'Open strings. The bar is off, and the chord is still C6.'
    : `Bar straight across fret ${sixths.chordFret}. All six strings are ${name}.` }));
  const names = tuning.slice().sort((a, b) => b.string - a.string).map((item) => (
    noteName(getMidiNote(item.string, sixths.chordFret)).label
  ));
  wrap.append(el('p', { text: `Low to high: ${names.join(', ')}.` }));
  return wrap;
}

function detailQuiz() {
  const step = scaleSteps[sixths.quizIndex];
  const wrap = el('div', { class: 'inspector-inner' });
  wrap.append(el('p', { class: 'kicker', text: 'Practice' }));
  wrap.append(el('h1', { text: step.note }));
  wrap.append(el('p', { text: 'This is one note of the C major scale. Find its sixth on the board: one fret, two strings. The fret and the strings stay hidden until you check.' }));
  const picked = sixths.guessFret == null
    ? 'No fret yet.'
    : `Your pick: fret ${sixths.guessFret}, strings ${sixths.guessStrings.length ? sixths.guessStrings.join(' and ') : 'none yet'}.`;
  wrap.append(el('p', { id: 'quiz-pick', text: picked }));
  if (sixths.verdict === 'incomplete') {
    wrap.append(el('p', { class: 'error', text: 'Choose one fret and two strings, then check.' }));
  } else if (sixths.verdict === 'right') {
    const notes = stepNotes(step);
    wrap.append(el('p', { class: 'ok', text: `Right. Fret ${step.fret}, strings ${notes.bassString} and ${notes.trebleString}. ${notes.bass.label} and ${notes.treble.label}, ${step.interval}.` }));
  } else if (sixths.verdict === 'wrong' && !sixths.revealed) {
    wrap.append(el('p', { class: 'error', text: 'Not this pair. Hear the answer when you want it.' }));
  } else if (sixths.revealed) {
    const notes = stepNotes(step);
    wrap.append(el('p', { class: 'hint', text: `Answer: fret ${step.fret}, strings ${notes.bassString} and ${notes.trebleString}. ${notes.bass.label} and ${notes.treble.label}, ${step.interval}.` }));
  }
  const row = el('div', { class: 'step-actions' });
  row.append(button('check', { class: 'primary' }, [document.createTextNode('Check')]));
  row.append(button('reveal', {}, [document.createTextNode('Hear the answer')]));
  wrap.append(row);
  wrap.append(el('p', { class: 'kicker', text: 'Strings' }));
  const strings = el('div', { class: 'chip-row' });
  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const on = sixths.guessStrings.includes(stringNumber);
    strings.append(button('string', {
      class: on ? 'on' : '',
      'data-string': String(stringNumber),
      text: String(stringNumber),
    }));
  }
  wrap.append(strings);
  wrap.append(el('p', { class: 'hint', text: 'Click the board to set the fret and a string, or use these string buttons after the fret is set.' }));
  return wrap;
}

function captionText() {
  if (sixths.view === 'chord') {
    return `Fret ${sixths.chordFret}  ·  straight bar  ·  ${sixthChordName(sixths.chordFret)}`;
  }
  if (sixths.view === 'quiz' && !sixths.revealed) {
    return `Find ${scaleSteps[sixths.quizIndex].note}`;
  }
  const step = activeStep();
  const notes = stepNotes(step);
  return `Step ${scaleSteps.indexOf(step) + 1} of 8  ·  ${step.note}  ·  ${notes.bass.name} and ${notes.treble.name}  ·  ${step.interval}`;
}

/** @type {number[]} */
let liveStrings = [];

/** Keep the sixths neck in sync when Listen paints live notes without a full render. */
export function syncSixthsLiveString(strings) {
  if (strings == null) liveStrings = [];
  else if (Array.isArray(strings)) liveStrings = [...strings];
  else liveStrings = [strings];
}

export function renderSixths(options = {}) {
  if ('liveStrings' in options) liveStrings = [...(options.liveStrings || [])];
  else if ('liveString' in options) {
    liveStrings = options.liveString != null ? [options.liveString] : [];
  }
  renderRail();
  renderFretboard(document.getElementById('neck-mount'), {
    tuning,
    markers: markers(),
    showAllNotes: sixths.showAll,
    noteAt(stringNumber, fret) {
      return noteName(getMidiNote(stringNumber, fret));
    },
    barFret: sixths.view === 'chord' && sixths.chordFret > 0 ? sixths.chordFret : null,
    liveStrings,
    onPosition: onBoard,
  });
  const caption = document.getElementById('caption');
  if (caption) caption.textContent = captionText();
  renderTransport();
  const pane = document.getElementById('inspector');
  pane.replaceChildren();
  const views = el('div', { class: 'chip-row sixths-views' });
  [['Scale', 'scale'], ['Chord', 'chord'], ['Practice', 'quiz']].forEach(([label, view]) => {
    views.append(button('view', { class: sixths.view === view ? 'on' : '', 'data-view': view, text: label }));
  });
  const inner = sixths.view === 'chord'
    ? detailChord()
    : sixths.view === 'quiz'
      ? detailQuiz()
      : detailScale(scaleSteps[sixths.index]);
  inner.prepend(views);
  pane.append(inner);
}

document.body.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== 'sixths-speed') return;
  sixths.speed = Number(input.value);
  const readout = document.getElementById('sixths-speed-readout');
  if (readout) readout.textContent = `${sixths.speed}%`;
});
