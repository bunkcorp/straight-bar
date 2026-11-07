import { freqAt, midiToName, openStrings, straightBar, stringMidi } from './theory.js';

const ALL = [1, 2, 3, 4, 5, 6];
const UPPER = [1, 2, 3, 4];
const LOW = [5, 6];

const CHORD_LABEL = { C: 'C6', F: 'F6', G: 'G6' };

export const SCALE = [0, 1, 3, 5, 7, 8, 10, 12].map((fret) => ({
  fret,
  ...midiToName(stringMidi(1, fret)),
  freq: freqAt(1, fret),
}));

export const PHRASE = [
  { beat: 0, bars: 1, chord: 'C', fret: 0, dur: 2 },
  { beat: 2, bars: 1, chord: 'C', fret: 3, dur: 2 },
  { beat: 4, bars: 2, chord: 'C', fret: 5, dur: 2 },
  { beat: 6, bars: 2, chord: 'C', fret: 3, dur: 2 },
  { beat: 8, bars: 3, chord: 'F', fret: 5, dur: 2 },
  { beat: 10, bars: 3, chord: 'F', fret: 1, dur: 2 },
  { beat: 12, bars: 4, chord: 'C', fret: 3, dur: 2 },
  { beat: 14, bars: 4, chord: 'C', fret: 0, dur: 2 },
  { beat: 16, bars: 5, chord: 'G', fret: 7, dur: 2 },
  { beat: 18, bars: 5, chord: 'G', fret: 0, dur: 2 },
  { beat: 20, bars: 6, chord: 'F', fret: 5, dur: 2 },
  { beat: 22, bars: 6, chord: 'F', fret: 8, dur: 2 },
  { beat: 24, bars: 7, chord: 'C', fret: 3, dur: 2 },
  { beat: 26, bars: 7, chord: 'C', fret: 5, dur: 2 },
  { beat: 28, bars: 8, chord: 'C', fret: 3, dur: 2 },
  { beat: 30, bars: 8, chord: 'C', fret: 0, dur: 2 },
].map((event) => ({
  ...event,
  chord: CHORD_LABEL[event.chord],
  name: midiToName(stringMidi(1, event.fret)).name,
  label: midiToName(stringMidi(1, event.fret)).label,
}));

export const PHRASE_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'C', dur: 4 },
  { beat: 8, name: 'F', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
  { beat: 16, name: 'G', dur: 4 },
  { beat: 20, name: 'F', dur: 4 },
  { beat: 24, name: 'C', dur: 4 },
  { beat: 28, name: 'C', dur: 4 },
];

/** Strings 4 and 2: B3 and F4. String 3 sits between them and stays muted. */
const g7Slant = {
  fromString: 4,
  toString: 2,
  fromFret: 4,
  toFret: 5,
  picked: [4, 2],
  muted: [6, 5, 3, 1],
};

const g6Bar = straightBar(7, ALL, []);
const c6High = straightBar(12, ALL, []);
const f6Bar = straightBar(5, ALL, []);

/** Straight bar on strings 3, 2, and 1. Same fret on every string. */
function topThree(fret, picked = [1, 2, 3]) {
  const sounding = new Set(picked);
  return {
    fromString: 3,
    toString: 1,
    fromFret: fret,
    toFret: fret,
    picked: [...picked],
    muted: [1, 2, 3, 4, 5, 6].filter((string) => !sounding.has(string)),
    flats: true,
  };
}

function pinches(fret) {
  return [
    { label: 'First pinch', bar: topThree(fret, [2, 1]) },
    { label: 'Second pinch', bar: topThree(fret, [3, 2]) },
  ];
}

const c9 = topThree(10);
const f9 = topThree(3);
const gPassing = topThree(6);
const g9 = topThree(5);

const gWalk = [
  { label: 'G6', bar: g6Bar, ghost: null },
  { label: 'Fret 6', bar: gPassing, ghost: g6Bar },
  { label: 'G9', bar: g9, ghost: g6Bar },
];

const cheatinHeart = [
  { label: 'C6', bar: c6High, ghost: null },
  { label: 'C9', bar: c9, ghost: c6High },
  { label: 'F6', bar: f6Bar, ghost: null },
  { label: 'G6', bar: g6Bar, ghost: null },
  { label: 'Fret 6', bar: gPassing, ghost: g6Bar },
  { label: 'G9', bar: g9, ghost: g6Bar },
  { label: 'C6', bar: c6High, ghost: null },
];

/** Straight sixths named by string 6. Fret 10 is Bb, so the chord spells Bb6. */
const sixthStops = [
  { fret: 0, name: 'C6' },
  { fret: 2, name: 'D6' },
  { fret: 4, name: 'E6' },
  { fret: 5, name: 'F6' },
  { fret: 7, name: 'G6' },
  { fret: 9, name: 'A6' },
  { fret: 10, name: 'Bb6', flats: true },
  { fret: 12, name: 'C6' },
].map((stop) => ({
  label: stop.name,
  bar: { ...straightBar(stop.fret, ALL, []), ...(stop.flats ? { flats: true } : {}) },
}));

/** Strings 4–2, high end two frets toward the bridge. Notes C, Eb, G. */
const forwardSlant = {
  fromString: 4,
  toString: 2,
  fromFret: 5,
  toFret: 7,
  picked: [4, 3, 2],
  muted: [6, 5, 1],
  flats: true,
};

/** Strings 4–2, high end two frets toward the nut. Notes D, Eb, F. */
const reverseSlant = {
  fromString: 4,
  toString: 2,
  fromFret: 7,
  toFret: 5,
  picked: [4, 3, 2],
  muted: [6, 5, 1],
  flats: true,
};

/**
 * Reverse slant. String 4 on fret 4, string 2 on fret 2, string 1 on fret 1.
 * String 3 lands on fret 3 and stays muted. Sounding notes: B, D, F.
 */
const bDim = {
  fromString: 4,
  toString: 1,
  fromFret: 4,
  toFret: 1,
  picked: [4, 2, 1],
  muted: [6, 5, 3],
};

const walkSix = { ...topThree(6), passing: true };

function pairBar(bassString, trebleString, fret) {
  const picked = [bassString, trebleString];
  return {
    fromString: Math.max(bassString, trebleString),
    toString: Math.min(bassString, trebleString),
    fromFret: fret,
    toFret: fret,
    picked,
    muted: [1, 2, 3, 4, 5, 6].filter((string) => !picked.includes(string)),
  };
}

function slantPair(lowString, lowFret, highString, highFret) {
  const picked = [lowString, highString];
  return {
    fromString: lowString,
    toString: highString,
    fromFret: lowFret,
    toFret: highFret,
    picked,
    muted: [1, 2, 3, 4, 5, 6].filter((string) => !picked.includes(string)),
  };
}

function oneString(stringNumber, fret) {
  return {
    fromString: stringNumber,
    toString: stringNumber,
    fromFret: fret,
    toFret: fret,
    picked: [stringNumber],
    muted: [1, 2, 3, 4, 5, 6].filter((string) => string !== stringNumber),
  };
}

const c6FromFive = {
  fromString: 5,
  toString: 1,
  fromFret: 12,
  toFret: 12,
  picked: [5, 4, 3, 2, 1],
  muted: [6],
};

const e6Bar = straightBar(4, ALL, []);
const minorThird = slantPair(2, 4, 1, 3);
const majorThird = openStrings([1, 2], [3, 4, 5, 6]);
const perfectFourth = slantPair(2, 0, 1, 1);
const majorSixthGrip = slantPair(2, 0, 1, 5);
const minorSixthGrip = slantPair(2, 4, 1, 8);

const nodeOpen = openStrings([], [2, 3, 4, 5, 6]);
const node12 = {
  label: 'Fret 12 · E5',
  bar: nodeOpen,
  midis: [76],
  lights: [{ string: 1, fret: 12 }],
  marks: [{ fret: 12, state: 'now' }],
  caption: 'String 1  ·  node over fret 12  ·  E5',
};
const node7 = {
  label: 'Fret 7 · B5',
  bar: nodeOpen,
  midis: [83],
  lights: [{ string: 1, fret: 7 }],
  marks: [{ fret: 7, state: 'now' }],
  caption: 'String 1  ·  node over fret 7  ·  B5',
};

const palmDrill = [
  { label: 'String 1 · A4', bar: straightBar(5, [1], [2, 3, 4, 5, 6]) },
  { label: 'String 2 · F4', bar: straightBar(5, [2], [1, 3, 4, 5, 6]) },
  { label: 'String 3 · D4', bar: straightBar(5, [3], [1, 2, 4, 5, 6]) },
  { label: 'F4 and A4', bar: straightBar(5, [1, 2], [3, 4, 5, 6]) },
  { label: 'D4 and F4', bar: straightBar(5, [2, 3], [1, 4, 5, 6]) },
];

function formEvent(beat, dur, chord, name, bar, guideFret) {
  return { beat, dur, bars: Math.floor(beat / 4) + 1, chord, name, bar, guideFret, fret: guideFret };
}

/** Original I–IV–V form. The walk at fret 6 is a passing step, not a named chord. */
export const FORM = [
  formEvent(0, 4, 'C6', 'fret 12', c6High, 12),
  formEvent(4, 4, 'C9', 'fret 10', c9, 10),
  formEvent(8, 4, 'F6', 'fret 5', f6Bar, 5),
  formEvent(12, 2, 'G6', 'fret 7', g6Bar, 7),
  formEvent(14, 1, 'Fret 6', 'passing', walkSix, 6),
  formEvent(15, 3, 'G9', 'fret 5', g9, 5),
  formEvent(18, 4, 'C6', 'fret 12', c6High, 12),
  formEvent(22, 4, 'F6', 'bridge', f6Bar, 5),
  formEvent(26, 4, 'F6', 'bridge', f6Bar, 5),
  formEvent(30, 4, 'C6', 'bridge', c6High, 12),
  formEvent(34, 4, 'C6', 'bridge', c6High, 12),
  formEvent(38, 4, 'G9', 'bridge', g9, 5),
  formEvent(42, 4, 'C6', 'home', c6High, 12),
];

export const FORM_CHORDS = [
  { beat: 0, name: 'C', dur: 8 },
  { beat: 8, name: 'F', dur: 4 },
  { beat: 12, name: 'G', dur: 6 },
  { beat: 18, name: 'C', dur: 4 },
  { beat: 22, name: 'F', dur: 8 },
  { beat: 30, name: 'C', dur: 8 },
  { beat: 38, name: 'G', dur: 4 },
  { beat: 42, name: 'C', dur: 4 },
];

/** Original string-1 line. Every note is a chord tone of the bar under it. */
export const UPPER_LINE = [
  { beat: 0, bars: 1, chord: 'C6', fret: 3, dur: 2 },
  { beat: 2, bars: 1, chord: 'C6', fret: 0, dur: 2 },
  { beat: 4, bars: 2, chord: 'F6', fret: 5, dur: 2 },
  { beat: 6, bars: 2, chord: 'F6', fret: 8, dur: 2 },
  { beat: 8, bars: 3, chord: 'G6', fret: 7, dur: 2 },
  { beat: 10, bars: 3, chord: 'G6', fret: 10, dur: 2 },
  { beat: 12, bars: 4, chord: 'C6', fret: 8, dur: 2 },
  { beat: 14, bars: 4, chord: 'C6', fret: 12, dur: 2 },
  { beat: 16, bars: 5, chord: 'C6', fret: 8, dur: 2 },
  { beat: 18, bars: 5, chord: 'C6', fret: 12, dur: 2 },
  { beat: 20, bars: 6, chord: 'F6', fret: 8, dur: 4 },
  { beat: 24, bars: 7, chord: 'G6', fret: 10, dur: 2 },
  { beat: 26, bars: 7, chord: 'G6', fret: 7, dur: 2 },
  { beat: 28, bars: 8, chord: 'C6', fret: 12, dur: 2 },
  { beat: 30, bars: 8, chord: 'C6', fret: 8, dur: 2 },
].map((event) => ({
  ...event,
  name: midiToName(stringMidi(1, event.fret)).name,
  label: midiToName(stringMidi(1, event.fret)).label,
}));

export const UPPER_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
  { beat: 16, name: 'C', dur: 4 },
  { beat: 20, name: 'F', dur: 4 },
  { beat: 24, name: 'G', dur: 4 },
  { beat: 28, name: 'C', dur: 4 },
];

export const LESSONS = [
  {
    id: 'setup',
    number: 1,
    title: 'Sit and hold the bar',
    summary: 'Lap, picks, and the line the bar makes.',
    steps: [
      {
        title: 'The guitar on your lap',
        body: 'Lay the steel across your lap with the strings facing the ceiling. The nut points left and the bridge points right.\n\nThe string closest to your stomach is the low C. The far string is the high E. The diagram is drawn from that seat: high E on top, low C along the bottom.',
        bar: openStrings([], []),
      },
      {
        title: 'Picks',
        body: 'Put a thumb pick on your right thumb. Put a fingerpick on the index finger and another on the middle finger, with the metal facing the string.\n\nThe right hand picks the notes and does most of the muting. Bare fingers work while you are learning the bar, if that is what you have.',
        bar: openStrings([], []),
      },
      {
        title: 'The bar in the left hand',
        body: 'Rest the bar in the palm, between the index and middle fingers, thumb on the front of it. The index finger lies along the top.\n\nThe middle, ring, and pinky trail behind the bar, on the nut side, and rest lightly on the strings. They steady the bar and hush the scrape when you slide.',
        bar: straightBar(5, [], ALL),
      },
      {
        title: 'On the marker',
        body: 'Lay the bar straight across all six strings, on the fret 5 marker. The bar is parallel to the fret wire. The strings touch it in one line, directly over that marker.\n\nThat contact is the pitch. Look down the neck until the bar and the fret wire line up.',
        bar: straightBar(5, [], ALL),
      },
    ],
  },
  {
    id: 'open-c6',
    number: 2,
    title: 'Open C6',
    summary: 'The open strings are already a C6 chord.',
    steps: [
      {
        title: 'Six strings, one chord',
        body: 'Take the bar off. Low to high, the open strings are C, E, G, A, C, E. Together they are C6. In this tuning a straight bar is a major sixth, and the open strings are the I chord.',
        bar: openStrings(ALL, []),
      },
      {
        title: 'Tune the open strings',
        body: 'Pick one string at a time, starting with the low C. Use Listen, then Play reference. The meter is happy inside 12 cents of the target.\n\nHeadphones keep the meter from locking onto the speaker.',
        bar: openStrings([6], [5, 4, 3, 2, 1]),
        tune: true,
      },
      {
        title: 'The top of the chord',
        body: 'Pick strings 4, 3, 2, and 1 together and let them ring. Those notes are G, A, C, and E, still C6. Keep strings 6 and 5 quiet under the thumb.\n\nThumb on string 4, index on string 3, middle on string 2. Catch string 1 with the thumb again.',
        bar: openStrings(UPPER, LOW),
      },
      {
        title: 'A slow roll',
        body: 'Play the same four strings one at a time, evenly, from string 4 down to string 1. Let each note ring into the next.\n\nHear the roll, then copy it. Slow and even beats fast.',
        bar: openStrings(UPPER, LOW),
        rollStrings: [4, 3, 2, 1],
      },
    ],
  },
  {
    id: 'sixths',
    number: 3,
    title: 'Three straight-bar sixths',
    summary: 'Open C6, fret 5 F6, fret 7 G6.',
    steps: [
      {
        title: 'Open is C6',
        body: 'With the bar off, the guitar is C6. You will come back here by sliding off the nut side, or by lifting the bar.',
        bar: openStrings(ALL, []),
      },
      {
        title: 'Fret 5 is F6',
        body: 'Slide the bar straight to fret 5 and set it on the marker. All six strings are now F6. Slide there. Lifting the bar and planting it again adds a gap and a click.\n\nFor the tuner, mute every string except string 2 and pick it. The note is F.',
        bar: straightBar(5, [2], [1, 3, 4, 5, 6]),
        listen: { string: 2, fret: 5, hold: 0.7 },
      },
      {
        title: 'Fret 7 is G6',
        body: 'Slide from fret 5 to fret 7. All six strings are G6.\n\nMute every string except string 2 and pick it. The note is G.',
        bar: straightBar(7, [2], [1, 3, 4, 5, 6]),
        listen: { string: 2, fret: 7, hold: 0.7 },
      },
      {
        title: 'Four changes',
        body: 'The band plays C6, F6, G6, C6. Four beats each, at the tempo in the bar under the neck. Move on beat 1.\n\nOpen strings, then fret 5, then fret 7, then back to open. If you arrive late, arrive in tune.',
        bar: openStrings(ALL, []),
        timeline: 'changes',
      },
    ],
  },
  {
    id: 'blocking',
    number: 4,
    title: 'Blocking',
    summary: 'The bar touches every string. You choose which ones speak.',
    steps: [
      {
        title: 'Why the first notes sound messy',
        body: 'A straight bar stops every string under it. If the right hand is up in the air, you get the whole sixth chord whether you wanted it or not.\n\nLap steel is one or two notes, with the rest kept quiet.',
        bar: straightBar(5, ALL, []),
      },
      {
        title: 'The right-hand clamp',
        body: 'Rest the picking fingers and the side of the thumb on the strings. That contact is home.\n\nTo play a note, lift only the finger that picks, then put it back. The left-hand fingers behind the bar already hush the scrape. The right hand decides which string is allowed to ring.',
        bar: straightBar(5, [], ALL),
      },
      {
        title: 'One note',
        body: 'Bar straight on fret 5. Mute every string except string 1. Pick string 1. You want a single A, with no chord behind it.\n\nIf you hear F6, a finger is still off a string. Put it back and pick again.',
        bar: straightBar(5, [1], [2, 3, 4, 5, 6]),
        listen: { string: 1, fret: 5, hold: 0.7 },
      },
      {
        title: 'Two notes',
        body: 'Same bar, still on fret 5. Let strings 1 and 2 ring, and mute 3, 4, 5, and 6. The notes are A and F, the third and the root of F6.\n\nThe mute has to be there before you pick.',
        bar: straightBar(5, [1, 2], [3, 4, 5, 6]),
      },
    ],
  },
  {
    id: 'vibrato',
    number: 5,
    title: 'Vibrato',
    summary: 'Rock the bar around the fret, evenly.',
    steps: [
      {
        title: 'The octave E',
        body: 'Bar straight on fret 12, string 1 only. That is E again, one octave higher than the open high string. Mute the other five strings.\n\nThe frets are closer together up here. A small slip is a bigger pitch change than the same slip at fret 2.',
        bar: {
          fromString: 1,
          toString: 1,
          fromFret: 12,
          toFret: 12,
          picked: [1],
          muted: [2, 3, 4, 5, 6],
        },
        listen: { string: 1, fret: 12, hold: 0.7 },
      },
      {
        title: 'Rock around the fret',
        body: 'Pick string 1 and rock the bar a little toward the bridge, then back toward the nut. Even pulses. The same distance sharp as flat.\n\nThe middle of the wobble stays on the fret 12 marker. Show the motion if you want to see the size.',
        bar: {
          fromString: 1,
          toString: 1,
          fromFret: 12,
          toFret: 12,
          picked: [1],
          muted: [2, 3, 4, 5, 6],
        },
        demo: 'vibrato',
      },
      {
        title: 'Against a drone',
        body: 'Use headphones. The drone is the octave E, and the meter should hear the steel, not the speaker.\n\nMatch the drone with a still bar until the center sits inside 15 cents. Then add the wobble. A pass is a center that stays near the fret while the needle keeps moving.',
        bar: {
          fromString: 1,
          toString: 1,
          fromFret: 12,
          toFret: 12,
          picked: [1],
          muted: [2, 3, 4, 5, 6],
        },
        listen: { string: 1, fret: 12, mode: 'vibrato' },
        drone: { string: 1, fret: 12 },
      },
    ],
  },
  {
    id: 'slant',
    number: 6,
    title: 'A forward slant',
    summary: 'B and F, then a straight bar on G6.',
    steps: [
      {
        title: 'Tip the high end forward',
        body: 'A straight bar is parallel to the fret. A forward slant tips the far end toward the bridge. That end is the high strings, so they sit on a higher fret than the low strings nearest you.\n\nThe bar still touches the strings. You mute the ones that should stay quiet.',
        bar: g7Slant,
      },
      {
        title: 'B and F',
        body: 'Cover strings 4, 3, and 2. Put string 4 on fret 4 and string 2 on fret 5. Mute string 3, the one between them.\n\nAlso mute strings 6, 5, and 1. The bar is not on them, so they will ring open if you let them. Pick string 4 and string 2. The notes are B and F, the guide tones of G7.',
        bar: g7Slant,
      },
      {
        title: 'Resolve to G6',
        body: 'Slide the bar toward the bridge until it lies straight on fret 7. All six strings there are G6. Pick them once the bar is straight.\n\nThe pale bar on the diagram is that G6. Hear the roll, then play it: B and F first, then the straight sixth.',
        bar: g7Slant,
        ghost: g6Bar,
        roll: true,
      },
      {
        title: 'The high end, in tune',
        body: 'Set the slant again: string 4 on fret 4, string 2 on fret 5. Mute everything except string 2. That end of the bar should be on the fret 5 marker, and the note is F.\n\nListen and hold it. If the F is sharp, the high end has crept toward the bridge.',
        bar: {
          fromString: 4,
          toString: 2,
          fromFret: 4,
          toFret: 5,
          picked: [2],
          muted: [1, 3, 4, 5, 6],
        },
        listen: { string: 2, fret: 5, hold: 0.7 },
      },
    ],
  },
  {
    id: 'phrase',
    number: 7,
    title: 'Eight bars',
    summary: 'A straight-bar line on the high string.',
    steps: [
      {
        title: 'One string, eight bars',
        body: 'The line stays on string 1. The open high string is E. The bar stays straight. Mute the other strings the whole time.\n\nThe chords under you are C6, C6, F6, C6, G6, F6, C6, C6. Every note in the line belongs to the chord of that bar. Slide between frets. The guide melody can play the line once, then turn Guide off and play it yourself.',
        bar: {
          fromString: 1,
          toString: 1,
          fromFret: 0,
          toFret: 0,
          picked: [1],
          muted: [2, 3, 4, 5, 6],
        },
        timeline: 'phrase',
      },
    ],
  },
  {
    id: 'ladder',
    number: 8,
    title: 'Intonation ladder',
    summary: 'A C major scale on the high string, in tune.',
    steps: [
      {
        title: 'The marker gets you close',
        body: 'You cannot see the exact point where the bar touches the string, and the frets get closer as you go up the neck. The marker is the neighborhood. Your ear lands the note.\n\nThis last pass is a C major scale on string 1, starting from the open E. The frets are 0, 1, 3, 5, 7, 8, 10, and 12: E, F, G, A, B, C, D, E. Hold each one inside 12 cents and the fret lights.',
        bar: openStrings([1], [2, 3, 4, 5, 6]),
        listen: { ladder: true },
      },
    ],
  },
  {
    id: 'ninth',
    number: 9,
    title: 'Turn the sixth into a ninth',
    summary: 'Drop strings 3, 2, and 1 two frets. You get the 5, the flat 7, and the 9.',
    steps: [
      {
        title: 'String 6 names the chord',
        body: 'A straight bar across all six strings is a sixth. The note on string 6 is the name. Fret 0 or 12 is C, so C6. Fret 5 is F, so F6. Fret 7 is G, so G6.\n\nThis move slides two frets toward the nut. Open C6 has nowhere to slide, so play C at fret 12.',
        bar: c6High,
      },
      {
        title: 'C6 becomes C9',
        body: 'From the C6 at fret 12, slide until the bar covers only strings 3, 2, and 1, on fret 10. Mute strings 6, 5, and 4. The pale bar is the C6 you left.\n\nThe notes are G, Bb, and D: the 5, the flat 7, and the 9. That is C9. It stands in for C7. The flat 7 is what pulls into the IV.\n\nPick two notes at a time. First pinch: strings 2 and 1, Bb and D. Second pinch: strings 3 and 2, G and Bb. Hear it plays all three.',
        bar: c9,
        ghost: c6High,
        hears: pinches(10),
      },
      {
        title: 'IV is F6',
        body: 'The IV is a straight bar on fret 5. String 6 is F, so the chord is F6. All six strings. Slide there from the C9.',
        bar: f6Bar,
      },
      {
        title: 'F6 becomes F9',
        body: 'Same move, on the IV. From the F6, cover only strings 3, 2, and 1 two frets lower, on fret 3. The pale bar is the F6.\n\nThe notes are C, Eb, and G: the 5, the flat 7, and the 9. That is F9. First pinch: strings 2 and 1, Eb and G. Second pinch: strings 3 and 2, C and Eb.',
        bar: f9,
        ghost: f6Bar,
        hears: pinches(3),
      },
      {
        title: 'Walk G6 down to G9',
        body: 'The V is a straight bar on fret 7. String 6 is G, so it is G6. To come home, walk strings 3, 2, and 1 down one fret at a time: fret 7, then 6, then 5.\n\nFret 5 lands on D, F, and A: the 5, the flat 7, and the 9. That is G9. The pale bar is the G6 you left. Hear the walk, then the two pinches.',
        bar: g9,
        ghost: g6Bar,
        hears: pinches(5),
        passage: gWalk,
        passageLabel: 'Hear the walk',
      },
      {
        title: 'I, IV, V, I',
        body: 'In C: C6 at fret 12, then C9 before the IV. F6 at fret 5. G6 at fret 7, walking down to G9 when it wants to return. C6 again at fret 12. Open strings are that same C6 if you come all the way off.\n\nHear the changes plays the shape. On the ninths, your right hand still uses the two pinches.',
        bar: c6High,
        passage: cheatinHeart,
        passageLabel: 'Hear the changes',
      },
    ],
  },
  {
    id: 'roots',
    number: 10,
    title: 'Sixths along the neck',
    summary: 'A straight bar on all six is a sixth named by string 6.',
    steps: [
      {
        title: 'String 6 names the sixth',
        body: 'Lay the bar straight across all six strings. The note on string 6 is the name of the chord. Fret 0 is C, so the open strings are C6. The same shape at fret 12 is C6 again.\n\nThe stops are frets 0, 2, 4, 5, 7, 9, 10, and 12: C6, D6, E6, F6, G6, A6, Bb6, and C6.',
        bar: straightBar(0, ALL, []),
      },
      {
        title: 'Eight stops',
        body: 'Hear the sixths walks those eight frets. Slide. Keep the bar parallel to the fret. At fret 10, string 6 is Bb, so the chord is Bb6.\n\nName each one from string 6 before you look at the list.',
        bar: straightBar(0, ALL, []),
        passage: sixthStops,
        passageLabel: 'Hear the sixths',
      },
    ],
  },
  {
    id: 'minors',
    number: 11,
    title: 'Minor triads on top',
    summary: 'Strings 3, 2, and 1 of a straight sixth are a minor triad.',
    steps: [
      {
        title: 'Open is A minor',
        body: 'Cover only strings 3, 2, and 1. Mute 6, 5, and 4. Open, the notes are A, C, and E. That is A minor.\n\nThe full straight bar would be C6. These three strings are the top of it.',
        bar: topThree(0),
      },
      {
        title: 'Fret 5 is D minor',
        body: 'Same three strings, straight bar on fret 5. The notes are D, F, and A. That is D minor. A full bar here would be F6.',
        bar: topThree(5),
      },
      {
        title: 'Fret 7 is E minor',
        body: 'Same three strings on fret 7. The notes are E, G, and B. That is E minor. A full bar here would be G6.',
        bar: topThree(7),
      },
    ],
  },
  {
    id: 'slants',
    number: 12,
    title: 'Forward and reverse',
    summary: 'One slant each way. The screen names the notes.',
    steps: [
      {
        title: 'Forward',
        body: 'A forward slant tips the high-string end toward the bridge, so that end sits on a higher fret.\n\nCover strings 4, 3, and 2. String 4 is on fret 5, string 3 on fret 6, string 2 on fret 7. Mute the other strings. The notes are C, Eb, and G.',
        bar: forwardSlant,
      },
      {
        title: 'Reverse',
        body: 'A reverse slant tips the high-string end toward the nut, so that end sits on a lower fret.\n\nCover strings 4, 3, and 2 again. String 4 is on fret 7, string 3 on fret 6, string 2 on fret 5. The notes are D, Eb, and F.',
        bar: reverseSlant,
      },
    ],
  },
  {
    id: 'diminished',
    number: 13,
    title: 'A diminished triad',
    summary: 'B, D, and F. String 3 stays quiet.',
    steps: [
      {
        title: 'B, D, and F',
        body: 'This slant runs from string 4 on fret 4 to string 1 on fret 1. The high end is closer to the nut.\n\nString 2 falls on fret 2. String 3 falls on fret 3, and you mute it, along with strings 6 and 5. The notes that sound are B, D, and F. That is a B diminished triad.',
        bar: bDim,
      },
    ],
  },
  {
    id: 'rolls',
    number: 14,
    title: 'Forward and back',
    summary: 'A roll on strings 4, 3, 2, and 1, then the way home.',
    steps: [
      {
        title: 'The right hand rolls',
        body: 'The bar can stay off. Pick strings 4, 3, 2, and 1 one at a time, from the lower one toward the high E, then come back 1, 2, 3, 4.\n\nHear plays the forward roll and the reverse roll. The string that is speaking lights up. Even notes. Let each one ring into the next.',
        bar: openStrings(UPPER, LOW),
        rollPattern: [4, 3, 2, 1],
      },
    ],
  },
  {
    id: 'upper-line',
    number: 15,
    title: 'Chord tones up the neck',
    summary: 'A C line on string 1 that crosses fret 7, then the same idea near fret 12.',
    steps: [
      {
        title: 'Past fret 7, then near 12',
        body: 'Stay on string 1 and mute the rest. The bar stays straight. The chords are C6, F6, G6, C6, then that idea again higher up.\n\nEvery note belongs to the chord of its bar: C is E, G, or C; F is F, A, or C; G is G, B, or D. The first half reaches frets 8, 10, and 12. The second half sits on frets 7, 8, 10, and 12. Guide plays it once. Turn Guide off and play it yourself.',
        bar: {
          fromString: 1,
          toString: 1,
          fromFret: 3,
          toFret: 3,
          picked: [1],
          muted: [2, 3, 4, 5, 6],
        },
        timeline: 'upper',
      },
    ],
  },
  {
    id: 'form',
    number: 16,
    title: 'An I–IV–V form',
    summary: 'C6, C9, F6, G6 into G9, and a bridge. A form, not a song.',
    steps: [
      {
        title: 'Numbers in C',
        body: 'The I is C6 at fret 12. Drop strings 1, 2, and 3 to fret 10 for C9, and mute the lower three. The IV is F6 at fret 5. The V is G6 at fret 7. Walk the top three through frets 7, 6, and 5. Fret 5 is G9. Then C6 again.\n\nThe bridge is F6, F6, C6, C6, G9, C6. Play follows the bar with a count-in. The notes are a form.',
        bar: c6High,
        timeline: 'form',
      },
    ],
  },
  {
    id: 'palm',
    number: 17,
    title: 'Palm blocking',
    summary: 'The palm edge stops the strings. Only the picking fingers lift.',
    steps: [
      {
        title: 'The edge of the palm',
        body: 'The Blocking lesson used the fingers as the mute. This one uses the palm.\n\nRest the outside edge of the right palm on the strings, just ahead of the picks. The strings go quiet. To sound one, lift only the finger that picks, then set it down again. The other fingers stay in the palm.',
        bar: straightBar(5, [], ALL),
      },
      {
        title: 'One note on string 1',
        body: 'Bar straight on fret 5. That full bar would be F6. The palm keeps it from ringing.\n\nLift only the finger on string 1. The note is A4. If you hear a chord, the palm came off.',
        bar: straightBar(5, [1], [2, 3, 4, 5, 6]),
        listen: { string: 1, fret: 5, hold: 0.7 },
      },
      {
        title: 'One note on string 2',
        body: 'Same bar, same palm. Lift only the finger on string 2. The note is F4.\n\nStrings 1, 3, 4, 5, and 6 stay under the palm.',
        bar: straightBar(5, [2], [1, 3, 4, 5, 6]),
        listen: { string: 2, fret: 5, hold: 0.7 },
      },
      {
        title: 'One note on string 3',
        body: 'Still fret 5, still the high strings. Lift only the finger on string 3. The note is D4.\n\nThree single notes, three fingers. The palm does not hop.',
        bar: straightBar(5, [3], [1, 2, 4, 5, 6]),
        listen: { string: 3, fret: 5, hold: 0.7 },
      },
      {
        title: 'Two notes',
        body: 'Lift two fingers and leave the palm on the rest.\n\nStrings 1 and 2 are A4 and F4, a major third. Strings 2 and 3 are F4 and D4, a minor third. Neither pair is the whole F6. Hear the drill plays one note, then the other, then each pair.',
        bar: straightBar(5, [1, 2], [3, 4, 5, 6]),
        passage: palmDrill,
        passageLabel: 'Hear the drill',
      },
    ],
  },
  {
    id: 'intervals',
    number: 18,
    title: 'Thirds, fourths, and sixths',
    summary: 'Name the interval from the two pitches, on strings 1 and 2.',
    steps: [
      {
        title: 'A minor third',
        body: 'String 2 on fret 4 is E4. String 1 on fret 3 is G4. E up to G is three semitones, a minor third.\n\nThe high end of the bar sits closer to the nut. Mute every other string.',
        bar: minorThird,
      },
      {
        title: 'A major third',
        body: 'Take the bar off. String 2 open is C4. String 1 open is E4. C up to E is four semitones, a major third.\n\nAny straight bar on these two strings is that same major third, moved.',
        bar: majorThird,
      },
      {
        title: 'A perfect fourth',
        body: 'String 2 stays open, C4. String 1 moves to fret 1, F4. C up to F is five semitones, a perfect fourth.\n\nThe high end is one fret toward the bridge.',
        bar: perfectFourth,
      },
      {
        title: 'The major sixth you know',
        body: 'String 2 open is C4. String 1 on fret 5 is A4. C up to A is nine semitones, a major sixth.\n\nThose are the same two pitches as the A sixth in the sixths exercise: C4 under A4. There the C sits on string 4 at fret 5. Here it sits on string 2, open.',
        bar: majorSixthGrip,
      },
      {
        title: 'The minor sixth you know',
        body: 'String 2 on fret 4 is E4. String 1 on fret 8 is C5. E up to C is eight semitones, a minor sixth.\n\nThose are the same two pitches as the high C sixth: string 5 and string 2 at fret 12 are also E4 and C5.',
        bar: minorSixthGrip,
      },
    ],
  },
  {
    id: 'inversions',
    number: 19,
    title: 'The same C6, moved',
    summary: 'Root on string 6, then the same pitches with the root higher up.',
    steps: [
      {
        title: 'Root on string 6',
        body: 'Bar off. All six open strings are C3, E3, G3, A3, C4, and E4. The pitch classes are C, E, G, and A. That is C6, and the root is the low C on string 6.',
        bar: openStrings(ALL, []),
      },
      {
        title: 'Root on string 2',
        body: 'Cover strings 5 through 1 at fret 12. Leave string 6 quiet, so the root is not on the bottom string.\n\nThe notes are E4, G4, A4, C5, and E5. Still C, E, G, and A, so this is still C6. The lowest note is E. The root is the C on string 2.',
        bar: c6FromFive,
      },
      {
        title: 'The same idea, open',
        body: 'Mute string 6 and play the other five open. The notes are E3, G3, A3, C4, and E4. Same four pitch classes. The low note is E3, and the root C is again on string 2.\n\nOpen, there is no bar to aim. Fret 12 is the one you can see.',
        bar: openStrings([5, 4, 3, 2, 1], [6]),
      },
      {
        title: 'The relative minor',
        body: 'Strings 3, 2, and 1 open are A3, C4, and E4. That is A minor. You already used this grip as the top of the straight bar.\n\nA minor is the relative minor of C. G is not in the grip, so do not call it C6.',
        bar: openStrings([3, 2, 1], [6, 5, 4]),
      },
      {
        title: 'This one is not C6',
        body: 'A straight bar on fret 4 sounds E3, G#3, B3, C#4, E4, and G#4. That is E6.\n\nThe pitches are not C, E, G, and A. A straight bar is a sixth named by string 6, and string 6 here is E.',
        bar: e6Bar,
      },
    ],
  },
  {
    id: 'melody-sixth',
    number: 20,
    title: 'A melody and a sixth',
    summary: 'Four original bars on string 1, then each note with its sixth underneath.',
    steps: [
      {
        title: 'Four bars on string 1',
        body: 'An original line in C. The notes are E4, G4, A4, F4, G4, A4, B4, and C5, two beats each.\n\nStay on string 1. The frets are 0, 3, 5, 1, 3, 5, 7, and 8. Mute the other strings. The band under you is C, F, C, then G into C.',
        bar: oneString(1, 0),
        timeline: 'melody',
      },
      {
        title: 'One sixth, as a check',
        body: 'The A you just played is string 1 at fret 5, A4. The sixth under it is the pair you already know: string 4 at that same fret, C4.\n\nC up to A is a major sixth. Mute strings 3 and 2, where the straight bar also lands.',
        bar: pairBar(4, 1, 5),
      },
      {
        title: 'The line with sixths',
        body: 'Each melody note keeps its pitch. The sixth comes from the scale pair for that note, so some melody notes move off string 1.\n\nE4 goes to string 3 at fret 7, over G3 on string 6. G4 goes to string 2 at fret 7, over B3 on string 5. F4 goes to string 2 at fret 5, over A3 on string 5. B4 stays on string 1 at fret 7, over D4 on string 4. C5 goes to string 2 at fret 12, over E4 on string 5. A4 stays where you just put it.',
        bar: pairBar(6, 3, 7),
        timeline: 'melody-sixths',
      },
    ],
  },
  {
    id: 'harmonics',
    number: 21,
    title: 'Natural harmonics',
    summary: 'Bar off. Touch the node, pluck, and let go.',
    steps: [
      {
        title: 'The bar stays off',
        body: 'A natural harmonic is not a fretted note. Lift the bar.\n\nThe right hand touches the string lightly, right over a fret wire, and plucks. The touch comes off as the note speaks. A heavy finger just mutes the string.',
        bar: nodeOpen,
        lights: [{ string: 1, fret: 12 }],
        marks: [{ fret: 12, state: 'now' }],
        caption: 'Bar off  ·  the node is a touch, not a bar',
      },
      {
        title: 'The octave, over fret 12',
        body: 'On string 1, fret 12 is halfway along the string. That node sounds one octave above the open E.\n\nThe harmonic is E5. Hear plays that pitch. A bar pressed at fret 12 is also E5, but here the bar is up and the finger only touches.',
        bar: nodeOpen,
        lights: [{ string: 1, fret: 12 }],
        marks: [{ fret: 12, state: 'now' }],
        caption: 'String 1  ·  node over fret 12  ·  E5',
        hearMidis: [76],
      },
      {
        title: 'The twelfth, over fret 7',
        body: 'Fret 7 is about one third of the way from the nut. That node sounds an octave and a fifth above the open string.\n\nOn string 1 the harmonic is B5. A bar pressed at fret 7 would be B4, a different note. Hear plays B5, the harmonic.',
        bar: nodeOpen,
        lights: [{ string: 1, fret: 7 }],
        marks: [{ fret: 7, state: 'now' }],
        caption: 'String 1  ·  node over fret 7  ·  B5',
        hearMidis: [83],
      },
      {
        title: 'Both nodes',
        body: 'Hear the nodes plays E5, then B5. Touch, pluck, release. Then move the finger to the other fret.\n\nString 1 only. The other five stay quiet.',
        bar: nodeOpen,
        lights: [{ string: 1, fret: 12 }],
        marks: [{ fret: 12, state: 'now' }],
        caption: 'String 1  ·  E5, then B5',
        passage: [node12, node7],
        passageLabel: 'Hear the nodes',
      },
    ],
  },
  {
    id: 'vamp',
    number: 22,
    title: 'A vamp and an intro',
    summary: 'Two bars of G9 to C6, then a two-bar intro that lands on C6.',
    steps: [
      {
        title: 'G9, then home',
        body: 'A Hawaiian vamp in C is a short loop that can sit under a singer. This one is two bars: G9, then C6.\n\nG9 is strings 1, 2, and 3 at fret 5. The notes are D4, F4, and A4. C6 is the straight bar at fret 12. Open strings are that same C6 if you come all the way off.',
        bar: g9,
        ghost: c6High,
      },
      {
        title: 'The two-bar loop',
        body: 'One bar of G9, one bar of C6, then the same pair again. Palm-block the strings you are not picking. On G9 that is strings 6, 5, and 4.\n\nMove on beat 1. The number on the screen is V, then I.',
        bar: g9,
        timeline: 'vamp',
      },
      {
        title: 'An intro that lands',
        body: 'Two bars, and the second one is home. Bar 1 is G9 for two beats, then a straight G6 at fret 7 for two beats. Bar 2 is C6 at fret 12, and it stays there.\n\nThe last chord is the one a singer would enter on.',
        bar: c6High,
        timeline: 'intro',
      },
    ],
  },
  {
    id: 'backup',
    number: 23,
    title: 'Backup for a singer',
    summary: 'Whole-note pads on I, IV, and V, then a ninth into the IV.',
    steps: [
      {
        title: 'One chord, one bar',
        body: 'Behind a singer the steel often holds a pad. Palm on the strings, bar straight, one chord for the whole bar.\n\nThe numbers in C are I, IV, and V. I is C6 at fret 12. IV is F6 at fret 5. V is G6 at fret 7.',
        bar: c6High,
      },
      {
        title: 'Four bars',
        body: 'C6, F6, G6, C6. Four beats each. The screen shows I, IV, V, and I.\n\nSet the palm before the pick. Let the chord ring for the bar, then slide. Do not chop every beat.',
        bar: c6High,
        timeline: 'backup',
      },
      {
        title: 'The ninth before IV',
        body: 'On the C bar that leads to F, hold C6 for two beats. For the last two beats, drop strings 1, 2, and 3 to fret 10 and mute the lower three. That grip is C9.\n\nThen F6, G6, and C6, a whole bar each. The number stays I while the color changes to C9.',
        bar: c9,
        ghost: c6High,
        timeline: 'backup-ninth',
      },
    ],
  },
  {
    id: 'phrasing',
    number: 24,
    title: 'Slide in, then vibrato',
    summary: 'Approach from one fret below, land, and rock the bar.',
    steps: [
      {
        title: 'From one fret below',
        body: 'The left hand can aim a note by sliding into it. Start one fret toward the nut, pick, and arrive on the fret as the note is speaking.\n\nThen a short vibrato: the same small rock you already use, centered on the fret you landed on. String 1 only.',
        bar: oneString(1, 5),
        ghost: oneString(1, 4),
      },
      {
        title: 'G#4 into A4',
        body: 'Fret 4 is G#4. Slide to fret 5, A4. Hold A4 and add a little vibrato. Show the motion rocks the bar so you can see the size.\n\nPlay gives you the lower note, then the note you land on.',
        bar: oneString(1, 5),
        ghost: oneString(1, 4),
        demo: 'vibrato',
        timeline: 'slide-a',
      },
      {
        title: 'A#4 into B4',
        body: 'Fret 6 is A#4. Slide to fret 7, B4. Same idea: pick on the way in, then vibrato on B4.\n\nThe frets are closer here than they were at fret 5. A shorter slide.',
        bar: oneString(1, 7),
        ghost: oneString(1, 6),
        demo: 'vibrato',
        timeline: 'slide-b',
      },
      {
        title: 'D#5 into E5',
        body: 'Fret 11 is D#5. Slide to fret 12, E5. Vibrato stays centered on the octave marker.\n\nUp here a small slide is a large pitch change. Start close, and stop on the marker.',
        bar: oneString(1, 12),
        ghost: oneString(1, 11),
        demo: 'vibrato',
        timeline: 'slide-e',
      },
    ],
  },
  {
    id: 'takeoff',
    number: 25,
    title: 'A take-off in C',
    summary: 'Eight original bars on string 1, chord tones of I, IV, and V.',
    steps: [
      {
        title: 'Only the chord tones',
        body: 'A take-off is the short solo over the changes. This one uses notes you already have.\n\nOn I, string 1 may play E, G, A, or C. On IV, F, A, C, or D. On V, G, B, D, or E. Nothing else. The form is I, IV, V, I, and then those four bars again.',
        bar: oneString(1, 12),
      },
      {
        title: 'The ground',
        body: 'Hear the pads once before you solo: C6, F6, G6, one bar each. The numbers are I, IV, and V.\n\nYou will play over a longer form, but these three shapes are the whole vocabulary.',
        bar: c6High,
        passage: [
          { label: 'I · C6', bar: c6High },
          { label: 'IV · F6', bar: f6Bar },
          { label: 'V · G6', bar: g6Bar },
        ],
        passageLabel: 'Hear I, IV, V',
      },
      {
        title: 'Eight bars',
        body: 'Follow the lights. Every note is a chord tone of the number on the screen.\n\nThe line starts on E5, comes down through the IV and the V, and the second half walks A4, G4, E4 on the I before it goes out. Guide plays it once. Turn Guide off and take it yourself.',
        bar: oneString(1, 12),
        timeline: 'takeoff',
      },
    ],
  },
];

function pad(beat, dur, bars, chord, name, bar, tones) {
  return { beat, dur, bars, chord, name, bar, tones, fret: tones[0]?.fret ?? 0 };
}

const g9Tones = [
  { string: 3, fret: 5 },
  { string: 2, fret: 5 },
  { string: 1, fret: 5 },
];
const c6Tones = [1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 12 }));
const f6Tones = [1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 5 }));
const g6Tones = [1, 2, 3, 4, 5, 6].map((string) => ({ string, fret: 7 }));
const c9Tones = [
  { string: 3, fret: 10 },
  { string: 2, fret: 10 },
  { string: 1, fret: 10 },
];

export const MELODY = [
  { beat: 0, dur: 2, bars: 1, chord: 'C', name: 'E4', fret: 0, string: 1 },
  { beat: 2, dur: 2, bars: 1, chord: 'C', name: 'G4', fret: 3, string: 1 },
  { beat: 4, dur: 2, bars: 2, chord: 'F', name: 'A4', fret: 5, string: 1 },
  { beat: 6, dur: 2, bars: 2, chord: 'F', name: 'F4', fret: 1, string: 1 },
  { beat: 8, dur: 2, bars: 3, chord: 'C', name: 'G4', fret: 3, string: 1 },
  { beat: 10, dur: 2, bars: 3, chord: 'C', name: 'A4', fret: 5, string: 1 },
  { beat: 12, dur: 2, bars: 4, chord: 'G', name: 'B4', fret: 7, string: 1 },
  { beat: 14, dur: 2, bars: 4, chord: 'C', name: 'C5', fret: 8, string: 1 },
];

export const MELODY_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'C', dur: 4 },
  { beat: 12, name: 'G', dur: 2 },
  { beat: 14, name: 'C', dur: 2 },
];

export const MELODY_SIXTHS = [
  {
    beat: 0, dur: 2, bars: 1, chord: 'Major 6th', name: 'G3 and E4', fret: 7,
    bar: pairBar(6, 3, 7),
    tones: [{ string: 6, fret: 7 }, { string: 3, fret: 7 }],
  },
  {
    beat: 2, dur: 2, bars: 1, chord: 'Minor 6th', name: 'B3 and G4', fret: 7,
    bar: pairBar(5, 2, 7),
    tones: [{ string: 5, fret: 7 }, { string: 2, fret: 7 }],
  },
  {
    beat: 4, dur: 2, bars: 2, chord: 'Major 6th', name: 'C4 and A4', fret: 5,
    bar: pairBar(4, 1, 5),
    tones: [{ string: 4, fret: 5 }, { string: 1, fret: 5 }],
  },
  {
    beat: 6, dur: 2, bars: 2, chord: 'Minor 6th', name: 'A3 and F4', fret: 5,
    bar: pairBar(5, 2, 5),
    tones: [{ string: 5, fret: 5 }, { string: 2, fret: 5 }],
  },
  {
    beat: 8, dur: 2, bars: 3, chord: 'Minor 6th', name: 'B3 and G4', fret: 7,
    bar: pairBar(5, 2, 7),
    tones: [{ string: 5, fret: 7 }, { string: 2, fret: 7 }],
  },
  {
    beat: 10, dur: 2, bars: 3, chord: 'Major 6th', name: 'C4 and A4', fret: 5,
    bar: pairBar(4, 1, 5),
    tones: [{ string: 4, fret: 5 }, { string: 1, fret: 5 }],
  },
  {
    beat: 12, dur: 2, bars: 4, chord: 'Major 6th', name: 'D4 and B4', fret: 7,
    bar: pairBar(4, 1, 7),
    tones: [{ string: 4, fret: 7 }, { string: 1, fret: 7 }],
  },
  {
    beat: 14, dur: 2, bars: 4, chord: 'Minor 6th', name: 'E4 and C5', fret: 12,
    bar: pairBar(5, 2, 12),
    tones: [{ string: 5, fret: 12 }, { string: 2, fret: 12 }],
  },
];

export const VAMP = [
  pad(0, 4, 1, 'V', 'G9', g9, g9Tones),
  pad(4, 4, 2, 'I', 'C6', c6High, c6Tones),
  pad(8, 4, 3, 'V', 'G9', g9, g9Tones),
  pad(12, 4, 4, 'I', 'C6', c6High, c6Tones),
];

export const VAMP_CHORDS = [
  { beat: 0, name: 'G', dur: 4 },
  { beat: 4, name: 'C', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
];

export const INTRO = [
  pad(0, 2, 1, 'V', 'G9', g9, g9Tones),
  pad(2, 2, 1, 'V', 'G6', g6Bar, g6Tones),
  pad(4, 4, 2, 'I', 'C6', c6High, c6Tones),
];

export const INTRO_CHORDS = [
  { beat: 0, name: 'G', dur: 4 },
  { beat: 4, name: 'C', dur: 4 },
];

export const BACKUP = [
  pad(0, 4, 1, 'I', 'C6', c6High, c6Tones),
  pad(4, 4, 2, 'IV', 'F6', f6Bar, f6Tones),
  pad(8, 4, 3, 'V', 'G6', g6Bar, g6Tones),
  pad(12, 4, 4, 'I', 'C6', c6High, c6Tones),
];

export const BACKUP_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
];

export const BACKUP_NINTH = [
  pad(0, 2, 1, 'I', 'C6', c6High, c6Tones),
  pad(2, 2, 1, 'I', 'C9', c9, c9Tones),
  pad(4, 4, 2, 'IV', 'F6', f6Bar, f6Tones),
  pad(8, 4, 3, 'V', 'G6', g6Bar, g6Tones),
  pad(12, 4, 4, 'I', 'C6', c6High, c6Tones),
];

export const BACKUP_NINTH_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
];

export const SLIDE_A = [
  { beat: 0, dur: 1, bars: 1, chord: 'Below', name: 'G#4', fret: 4, string: 1 },
  { beat: 1, dur: 3, bars: 1, chord: 'Land', name: 'A4', fret: 5, string: 1 },
];

export const SLIDE_B = [
  { beat: 0, dur: 1, bars: 1, chord: 'Below', name: 'A#4', fret: 6, string: 1 },
  { beat: 1, dur: 3, bars: 1, chord: 'Land', name: 'B4', fret: 7, string: 1 },
];

export const SLIDE_E = [
  { beat: 0, dur: 1, bars: 1, chord: 'Below', name: 'D#5', fret: 11, string: 1 },
  { beat: 1, dur: 3, bars: 1, chord: 'Land', name: 'E5', fret: 12, string: 1 },
];

const openE = openStrings([1], [2, 3, 4, 5, 6]);

export const TAKEOFF = [
  { beat: 0, dur: 2, bars: 1, chord: 'I', name: 'E5', fret: 12, string: 1 },
  { beat: 2, dur: 2, bars: 1, chord: 'I', name: 'C5', fret: 8, string: 1 },
  { beat: 4, dur: 2, bars: 2, chord: 'IV', name: 'D5', fret: 10, string: 1 },
  { beat: 6, dur: 2, bars: 2, chord: 'IV', name: 'A4', fret: 5, string: 1 },
  { beat: 8, dur: 2, bars: 3, chord: 'V', name: 'B4', fret: 7, string: 1 },
  { beat: 10, dur: 2, bars: 3, chord: 'V', name: 'E5', fret: 12, string: 1 },
  { beat: 12, dur: 2, bars: 4, chord: 'I', name: 'C5', fret: 8, string: 1 },
  { beat: 14, dur: 2, bars: 4, chord: 'I', name: 'G4', fret: 3, string: 1 },
  { beat: 16, dur: 1, bars: 5, chord: 'I', name: 'A4', fret: 5, string: 1 },
  { beat: 17, dur: 1, bars: 5, chord: 'I', name: 'G4', fret: 3, string: 1 },
  { beat: 18, dur: 2, bars: 5, chord: 'I', name: 'E4', fret: 0, string: 1, bar: openE },
  { beat: 20, dur: 2, bars: 6, chord: 'IV', name: 'F4', fret: 1, string: 1 },
  { beat: 22, dur: 2, bars: 6, chord: 'IV', name: 'C5', fret: 8, string: 1 },
  { beat: 24, dur: 2, bars: 7, chord: 'V', name: 'D5', fret: 10, string: 1 },
  { beat: 26, dur: 2, bars: 7, chord: 'V', name: 'B4', fret: 7, string: 1 },
  { beat: 28, dur: 2, bars: 8, chord: 'I', name: 'G4', fret: 3, string: 1 },
  { beat: 30, dur: 2, bars: 8, chord: 'I', name: 'E4', fret: 0, string: 1, bar: openE },
];

export const TAKEOFF_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
  { beat: 16, name: 'C', dur: 4 },
  { beat: 20, name: 'F', dur: 4 },
  { beat: 24, name: 'G', dur: 4 },
  { beat: 28, name: 'C', dur: 4 },
];

export const CHANGES = [
  { beat: 0, bars: 1, chord: 'C6', fret: null, guideFret: 0, dur: 4 },
  { beat: 4, bars: 2, chord: 'F6', fret: 5, guideFret: 5, dur: 4 },
  { beat: 8, bars: 3, chord: 'G6', fret: 7, guideFret: 7, dur: 4 },
  { beat: 12, bars: 4, chord: 'C6', fret: null, guideFret: 0, dur: 4 },
].map((event) => ({
  ...event,
  name: midiToName(stringMidi(1, event.guideFret)).name,
  label: midiToName(stringMidi(1, event.guideFret)).label,
}));

export const CHANGE_CHORDS = [
  { beat: 0, name: 'C', dur: 4 },
  { beat: 4, name: 'F', dur: 4 },
  { beat: 8, name: 'G', dur: 4 },
  { beat: 12, name: 'C', dur: 4 },
];
