/**
 * Built-in play-along charts. No network.
 * Notes are { beat, string, fret, dur } in C6 (C E G A C E).
 * Melodies are public domain, with original fret positions on this tuning.
 * Aloha 'Oe is the 1878 chorus, transposed into C. Near the Cross is the
 * 1869 Doane tune, transposed from F into C. Trade Wind and I–IV–V are original.
 * Mr. Crispy Diet Coke is a personal recording, not a published song.
 */
import { STRINGS, midiToFreq, midiToName, stringMidi } from './theory.js';

const OPEN_MIDI = [
  [6, 48],
  [5, 52],
  [4, 55],
  [3, 57],
  [2, 60],
  [1, 64],
];

OPEN_MIDI.forEach(([string, midi]) => {
  const found = STRINGS.find((item) => item.string === string);
  if (!found || found.midi !== midi) {
    throw new Error(`String ${string} should be MIDI ${midi} in C6`);
  }
});

function placed(name, string, fret) {
  const midi = stringMidi(string, fret);
  const heard = midiToName(midi).label;
  if (heard !== name) {
    throw new Error(`${name} is ${heard} (MIDI ${midi}) on string ${string} fret ${fret}`);
  }
  return { name, string, fret, midi };
}

const F_SHARP_3 = placed('F#3', 5, 2);
const C4 = placed('C4', 2, 0);
const C_SHARP_4 = placed('C#4', 2, 1);
const E4 = placed('E4', 1, 0);
const D_SHARP_4 = placed('D#4', 2, 3);
const F4 = placed('F4', 1, 1);
const F_SHARP_4 = placed('F#4', 1, 2);
const G4 = placed('G4', 1, 3);
const G_SHARP_4 = placed('G#4', 1, 4);
const A_SHARP_4 = placed('A#4', 1, 6);
const C_SHARP_5 = placed('C#5', 1, 9);

/** F4 is E# enharmonically. These are the corrected palette on C6. */
const CRISPY_PALETTE = [C_SHARP_4, D_SHARP_4, F4, F_SHARP_4, G_SHARP_4, A_SHARP_4];
const CRISPY_PALETTE_MIDI = [61, 63, 65, 66, 68, 70];
CRISPY_PALETTE.forEach((item, index) => {
  if (item.midi !== CRISPY_PALETTE_MIDI[index]) {
    throw new Error(`${item.name} is MIDI ${item.midi}, expected ${CRISPY_PALETTE_MIDI[index]}`);
  }
});

if (Math.round(midiToFreq(C_SHARP_5.midi)) !== 554) {
  throw new Error(`C#5 should read 554 Hz, got ${midiToFreq(C_SHARP_5.midi)}`);
}

function note(beat, dur, string, fret) {
  return { beat, string, fret, dur };
}

/** Chorus only. Liliʻuokalani, 1878. Key of C on this tuning. */
const ALOHA_NOTES = [
  note(0, 0.5, 2, 0),
  note(0.5, 0.5, 2, 0),
  note(1, 0.5, 3, 2),
  note(1.5, 1, 3, 0),
  note(2.5, 1, 2, 0),
  note(3.5, 0.5, 1, 1),
  note(4, 0.5, 3, 0),
  note(4.5, 0.5, 3, 0),
  note(5, 0.5, 3, 0),
  note(5.5, 1, 4, 0),
  note(6.5, 1, 2, 0),
  note(7.5, 1, 1, 0),
  note(8.5, 0.5, 2, 0),
  note(9, 0.5, 2, 0),
  note(9.5, 0.5, 3, 2),
  note(10, 0.5, 3, 2),
  note(10.5, 0.5, 3, 2),
  note(11, 0.5, 2, 0),
  note(11.5, 0.5, 2, 2),
  note(12, 0.5, 2, 1),
  note(12.5, 0.5, 2, 2),
  note(13, 0.5, 1, 1),
  note(13.5, 2, 1, 0),
  note(15.5, 1, 2, 0),
  note(17, 0.5, 3, 2),
  note(17.5, 1, 3, 0),
  note(18.5, 1, 2, 0),
  note(19.5, 1.5, 1, 1),
  note(21, 0.5, 3, 0),
  note(21.5, 0.5, 4, 0),
  note(22, 0.5, 4, 0),
  note(22.5, 0.5, 2, 0),
  note(23, 0.5, 2, 0),
  note(23.5, 1.5, 1, 0),
  note(25, 0.5, 2, 0),
  note(25.5, 1.5, 3, 2),
  note(27, 0.5, 2, 0),
  note(27.5, 0.5, 1, 0),
  note(28, 1, 2, 2),
  note(29, 0.5, 3, 2),
  note(29.5, 3, 2, 0),
];

const ALOHA_CHORDS = [
  { beat: 0, name: 'C', dur: 1.5 },
  { beat: 1.5, name: 'F', dur: 4 },
  { beat: 5.5, name: 'C', dur: 4 },
  { beat: 9.5, name: 'G', dur: 4 },
  { beat: 13.5, name: 'C', dur: 4 },
  { beat: 17.5, name: 'F', dur: 4 },
  { beat: 21.5, name: 'C', dur: 1 },
  { beat: 22.5, name: 'G', dur: 1 },
  { beat: 23.5, name: 'C', dur: 2 },
  { beat: 25.5, name: 'G', dur: 4 },
  { beat: 29.5, name: 'C', dur: 3 },
];

/** Original. Chord tones of C, F, and G only. */
const ETUDE_NOTES = [
  note(0, 1, 1, 0),
  note(1, 1, 1, 3),
  note(2, 1, 1, 8),
  note(3, 1, 1, 3),
  note(4, 1, 1, 1),
  note(5, 1, 1, 5),
  note(6, 1, 2, 5),
  note(7, 1, 1, 8),
  note(8, 1, 2, 0),
  note(9, 1, 1, 0),
  note(10, 2, 1, 3),
  note(12, 1, 1, 7),
  note(13, 1, 1, 10),
  note(14, 1, 1, 3),
  note(15, 1, 2, 7),
  note(16, 2, 1, 12),
  note(18, 2, 1, 8),
  note(20, 1, 1, 5),
  note(21, 1, 1, 8),
  note(22, 2, 1, 5),
  note(24, 1, 1, 7),
  note(25, 1, 1, 3),
  note(26, 1, 1, 10),
  note(27, 1, 1, 7),
  note(28, 1, 1, 8),
  note(29, 1, 1, 3),
  note(30, 2, 1, 0),
];

const ETUDE_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'C', dur: 4 },
  { beat: 12, name: 'G', dur: 4 },
  { beat: 16, name: 'C', dur: 4 },
  { beat: 20, name: 'F', dur: 4 },
  { beat: 24, name: 'G', dur: 4 },
  { beat: 28, name: 'C', dur: 4 },
];

/**
 * Original line on the I–IV–V form.
 * Fret 6 on string 1 is the passing step of the 7–6–5 walk, not a chord name.
 */
const FORM_NOTES = [
  note(0, 2, 1, 12),
  note(2, 2, 1, 8),
  note(4, 2, 1, 10),
  note(6, 2, 2, 10),
  note(8, 2, 1, 5),
  note(10, 2, 1, 8),
  note(12, 2, 1, 7),
  note(14, 1, 1, 6),
  note(15, 1, 1, 5),
  note(16, 1, 1, 5),
  note(17, 1, 2, 5),
  note(18, 4, 1, 12),
  note(22, 2, 1, 5),
  note(24, 2, 1, 1),
  note(26, 4, 1, 8),
  note(30, 2, 1, 12),
  note(32, 2, 1, 8),
  note(34, 2, 1, 3),
  note(36, 2, 1, 8),
  note(38, 2, 1, 5),
  note(40, 2, 3, 5),
  note(42, 4, 1, 12),
];

const FORM_SONG_CHORDS = [
  { beat: 0, name: 'C', dur: 8 },
  { beat: 8, name: 'F', dur: 4 },
  { beat: 12, name: 'G', dur: 6 },
  { beat: 18, name: 'C', dur: 4 },
  { beat: 22, name: 'F', dur: 8 },
  { beat: 30, name: 'C', dur: 8 },
  { beat: 38, name: 'G', dur: 4 },
  { beat: 42, name: 'C', dur: 4 },
];

/**
 * Doane, 1869, read in F and transposed down a fourth into C.
 * Quarter note = 1 beat. Each bar of the 6/4 tune is six beats.
 * [duration, string, fret], in order.
 */
const NEAR_PATTERN = [
  [2, 1, 0], [1, 1, 1], [2, 1, 0], [1, 2, 2],
  [2, 2, 0], [1, 3, 0], [3, 3, 0],
  [2, 4, 0], [1, 2, 0], [2, 2, 0], [1, 1, 0],
  [3, 1, 0], [3, 2, 2],
  [2, 1, 0], [1, 1, 1], [2, 1, 0], [1, 2, 2],
  [2, 2, 0], [1, 3, 0], [3, 3, 0],
  [2, 4, 0], [1, 2, 0], [2, 2, 0], [1, 3, 2],
  [3, 2, 2], [3, 2, 0],
  [2, 1, 0], [1, 1, 3], [3, 1, 3],
  [2, 1, 1], [1, 1, 5], [3, 1, 5],
  [2, 1, 3], [1, 1, 5], [2, 1, 3], [1, 1, 0],
  [3, 1, 0], [3, 2, 2],
  [2, 1, 0], [1, 1, 1], [2, 1, 0], [1, 2, 2],
  [2, 2, 0], [1, 3, 0], [3, 3, 0],
  [2, 4, 0], [1, 2, 0], [2, 2, 0], [1, 3, 2],
  [3, 2, 2], [3, 2, 0],
];

let nearBeat = 0;
const NEAR_NOTES = NEAR_PATTERN.map(([dur, string, fret]) => {
  const item = note(nearBeat, dur, string, fret);
  nearBeat += dur;
  return item;
});

const NEAR_CHORDS = [
  { beat: 0, name: 'C', dur: 12 },
  { beat: 12, name: 'G', dur: 3 },
  { beat: 15, name: 'C', dur: 9 },
  { beat: 24, name: 'C', dur: 12 },
  { beat: 36, name: 'G', dur: 9 },
  { beat: 45, name: 'C', dur: 9 },
  { beat: 54, name: 'F', dur: 6 },
  { beat: 60, name: 'C', dur: 6 },
  { beat: 66, name: 'G', dur: 6 },
  { beat: 72, name: 'C', dur: 12 },
  { beat: 84, name: 'G', dur: 9 },
  { beat: 93, name: 'C', dur: 3 },
];

export const SONGS = [
  {
    id: 'aloha-oe',
    title: "Aloha 'Oe",
    credit: 'Liliʻuokalani, 1878. Chorus, in C.',
    bpm: 92,
    notes: ALOHA_NOTES,
    chords: ALOHA_CHORDS,
  },
  {
    id: 'near-the-cross',
    title: 'Near the Cross',
    credit: 'William H. Doane, 1869. Tune in C. Original frets.',
    bpm: 80,
    notes: NEAR_NOTES,
    chords: NEAR_CHORDS,
  },
  {
    id: 'trade-wind',
    title: 'Trade Wind',
    credit: 'Original hapa-haole etude. Not a traditional tune.',
    bpm: 84,
    notes: ETUDE_NOTES,
    chords: ETUDE_CHORDS,
  },
  {
    id: 'one-four-five',
    title: 'I–IV–V in C',
    credit: 'Original form. C6, C9, F6, G6 into G9, and a bridge.',
    bpm: 80,
    notes: FORM_NOTES,
    chords: FORM_SONG_CHORDS,
  },
  {
    id: 'mr-crispy-diet-coke',
    title: 'Mr. Crispy Diet Coke',
    credit: 'Personal recording.',
    bpm: 70,
    phrases: [
      {
        id: 'a',
        title: 'Phrase A',
        detail: 'Lower, about 0:02',
        notes: [F_SHARP_4, C_SHARP_4, F_SHARP_3, C4],
      },
      {
        id: 'b',
        title: 'Phrase B',
        detail: 'Higher, about 0:11',
        notes: [A_SHARP_4, F_SHARP_4, C_SHARP_4],
      },
      {
        id: 'c',
        title: 'Phrase C',
        detail: 'Highest, about 0:17',
        notes: [G_SHARP_4, C_SHARP_5, G4, E4],
      },
    ],
    finder: [F_SHARP_3, C4, C_SHARP_4, E4, F_SHARP_4, G4, G_SHARP_4, A_SHARP_4, C_SHARP_5],
    palette: CRISPY_PALETTE,
    takes: [
      { id: 'natural', label: 'Natural (recommended)', file: 'audio/crispy-natural.wav' },
      { id: 'strong', label: 'Strong', file: 'audio/crispy-strong.wav' },
      { id: 'cleaned', label: 'Cleaned', file: 'audio/crispy-cleaned.wav' },
    ],
    notes: [],
    chords: [],
    copy: [
      'Personal recording. She repeats "Mr. Crispy Diet Coke" and changes pitch.',
      'Lowest around F3–F#3, highest C#5 (554 Hz).',
      'One early pass was heard as C#4, F4, C#4, F#3. She slides, so the bar should glide.',
      'Slide into the notes; these are outlines, not syllable-by-syllable.',
      'The corrected palette is C# D# F F# G# A#.',
    ],
  },
];

export function songById(id) {
  return SONGS.find((song) => song.id === id) || SONGS[0];
}

export function filterSongs(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return SONGS;
  return SONGS.filter((song) => `${song.title} ${song.credit}`.toLowerCase().includes(needle));
}
