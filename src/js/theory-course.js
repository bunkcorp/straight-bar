import { midiToName, stringMidi } from './theory.js';

/** Original C6 theory course. Pitch names on marks come from theory.js. */

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const GROUPS = [
  { id: 'basics', title: 'Basics' },
  { id: 'rhythm', title: 'Rhythm' },
  { id: 'scales', title: 'Scales' },
  { id: 'intervals', title: 'Intervals' },
  { id: 'chords', title: 'Chords' },
  { id: 'diatonic', title: 'Diatonic' },
  { id: 'progressions', title: 'Progressions' },
];

function tone(string, fret, extra = {}) {
  const flats = Boolean(extra.flats);
  const name = midiToName(stringMidi(string, fret), flats).name;
  return { string, fret, name, flats, role: extra.role || 'chord', tag: extra.tag || '' };
}

function tones(pairs, extra = {}) {
  return pairs.map(([string, fret, tag]) => tone(string, fret, { ...extra, tag: tag || extra.tag || '' }));
}

function spellPc(spelled) {
  let pc = SEMI[spelled[0]];
  for (const ch of spelled.slice(1)) {
    if (ch === '#') pc += 1;
    if (ch === 'b') pc -= 1;
  }
  return (pc + 12) % 12;
}

function halfStepAbove(spelled) {
  const target = (spellPc(spelled) + 1) % 12;
  const dest = LETTERS[(LETTERS.indexOf(spelled[0]) + 1) % 7];
  const up = (target - SEMI[dest] + 12) % 12;
  if (up === 0) return dest;
  if (up === 1) return `${dest}#`;
  if (up === 11) return `${dest}b`;
  return dest;
}

function fourthDown(spelled) {
  const target = (spellPc(spelled) - 5 + 12) % 12;
  const dest = LETTERS[(LETTERS.indexOf(spelled[0]) + 4) % 7];
  const up = (target - SEMI[dest] + 12) % 12;
  if (up === 0) return dest;
  if (up === 1) return `${dest}#`;
  if (up === 11) return `${dest}b`;
  if (up === 10) return `${dest}bb`;
  return dest;
}

export function describeSignature(kind, count) {
  const safe = Math.max(0, Math.min(7, count));
  if (safe === 0) {
    return {
      kind,
      count: 0,
      key: 'C',
      fret: 0,
      steps: [],
      sentence: 'No sharps and no flats. The major key is C. String 2, fret 0, is C.',
    };
  }
  if (kind === 'sharp') {
    const last = `${SHARP_ORDER[safe - 1]}#`;
    const key = halfStepAbove(last);
    const fret = spellPc(key);
    const sounding = midiToName(60 + fret, false).name;
    const word = safe === 1 ? 'One sharp' : `${safe} sharps`;
    const alias = sounding === key
      ? `String 2, fret ${fret}, is ${key}.`
      : `String 2, fret ${fret}, sounds ${sounding}. In this signature the tonic is spelled ${key}.`;
    return {
      kind,
      count: safe,
      key,
      last,
      fret,
      steps: SHARP_STEPS.slice(0, safe),
      sentence: `${word}. The last sharp is ${last}, and the last sharp is ti. A half step above ${last} is ${key}. The major key is ${key}. ${alias}`,
    };
  }
  const last = `${FLAT_ORDER[safe - 1]}b`;
  const key = fourthDown(last);
  const fret = spellPc(key);
  const sounding = midiToName(60 + fret, false).name;
  const word = safe === 1 ? 'One flat' : `${safe} flats`;
  const penult = safe >= 2
    ? `The next-to-last flat is ${FLAT_ORDER[safe - 2]}b, and that flat spells the key as well.`
    : 'With only one flat there is no next-to-last flat, so you count a fourth down from fa.';
  const alias = sounding === key
    ? `String 2, fret ${fret}, is ${key}.`
    : `String 2, fret ${fret}, sounds ${sounding}. In this signature the tonic is spelled ${key}.`;
  return {
    kind: 'flat',
    count: safe,
    key,
    last,
    fret,
    steps: FLAT_STEPS.slice(0, safe),
    sentence: `${word}. The last flat is ${last}, and the last flat is fa. A fourth below ${last} is ${key}. The major key is ${key}. ${penult} ${alias}`,
  };
}

function openChord(strings) {
  return strings.map((string) => tone(string, 0));
}

function barChord(fret, strings) {
  return strings.map((string) => tone(string, fret, { flats: fret === 10 && string === 2 }));
}

const AULD = [
  {
    title: 'For auld lang syne, my dear',
    frets: [7, 4, 0, 2, 4, 0],
  },
  {
    title: 'For auld lang syne',
    frets: [2, 4, 7, 4, 2, 0],
  },
  {
    title: "We'll tak a cup of kindness yet",
    frets: [7, 7, 7, 4, 0, 2, 4, 0],
  },
  {
    title: 'For auld lang syne',
    frets: [2, 4, 7, 4, 2, 0],
  },
];

function auldSystems() {
  return AULD.map((line) => ({
    title: line.title,
    items: line.frets.map((fret) => ({
      string: 2,
      fret,
      dur: 'q',
      lyric: String(fret),
    })),
  }));
}

function auldEvents(bpm = 92) {
  const beat = 60 / bpm;
  const events = [];
  let t = 0;
  AULD.forEach((line, lineIndex) => {
    if (lineIndex) t += beat * 0.85;
    line.frets.forEach((fret) => {
      events.push({ t, string: 2, fret, dur: beat * 0.92 });
      t += beat;
    });
  });
  return events;
}

export const LESSONS = [
  {
    id: 'staff',
    group: 'basics',
    title: 'The staff',
    summary: 'Five lines, the treble clef, and where the open strings sit.',
    screens: [
      {
        title: 'Five lines and a treble clef',
        caption: 'String 1 open is E4, the bottom line.',
        paragraphs: [
          'The staff is five lines and the four spaces between them. A note sits on a line or in a space. Higher on the page is higher in pitch.',
          'The treble clef marks the second line as G. Count letter by letter up from that G and the bottom line is E. Your open first string is that E, E4.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            items: [{ string: 1, fret: 0, dur: 'w', lyric: 'string 1' }],
          }],
        },
        hear: { label: 'Hear string 1', events: [{ t: 0, string: 1, fret: 0, dur: 1.6 }] },
      },
      {
        title: 'Ledger lines',
        caption: 'Open strings, high E down to low C.',
        paragraphs: [
          'When a note is too low for the five lines, it gets a short ledger line of its own. Open string 2 is C4, one ledger below the staff. That C is middle C. Open string 3 is A3, on the next ledger down.',
          'String 4, G3, hangs in the space under the A ledger. String 5, E3, sits under a third ledger. String 6, low C, sits under a fourth. You will mostly read E, C, and A on the page. The near-side strings you already know by feel.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            items: [1, 2, 3, 4, 5, 6].map((string) => ({
              string,
              fret: 0,
              dur: 'q',
              lyric: String(string),
            })),
          }],
        },
        hear: {
          label: 'Hear the open strings',
          events: [1, 2, 3, 4, 5, 6].map((string, index) => ({
            t: index * 0.55,
            string,
            fret: 0,
            dur: 0.7,
          })),
        },
      },
    ],
  },
  {
    id: 'durations',
    group: 'basics',
    title: 'Note durations',
    summary: 'Whole, half, quarter, eighth, and sixteenth, heard on string 1.',
    screens: [
      {
        title: 'Five lengths',
        caption: 'Each note is open E, held for its full value.',
        paragraphs: [
          'A whole note lasts four beats. A half note lasts two. A quarter note lasts one. An eighth note is half a beat, and a sixteenth is a quarter of a beat.',
          'On the steel, the left hand can hold the bar for the long notes. The right hand places the short ones. These five are all the same pitch, open string 1, so you can hear the length by itself.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            items: [
              { string: 1, fret: 0, dur: 'w', lyric: 'whole' },
              { string: 1, fret: 0, dur: 'h', lyric: 'half' },
              { string: 1, fret: 0, dur: 'q', lyric: 'quarter' },
              { string: 1, fret: 0, dur: 'e', lyric: 'eighth' },
              { string: 1, fret: 0, dur: 's', lyric: '16th' },
            ],
          }],
        },
        hear: { label: 'Hear the lengths', followStaff: true, bpm: 72, clicks: true },
      },
    ],
  },
  {
    id: 'measures',
    group: 'basics',
    title: 'Measures and 4/4',
    summary: 'Barlines, and four quarter notes in the box.',
    screens: [
      {
        title: 'The box of four',
        caption: '4/4 · four quarter notes · one bar.',
        paragraphs: [
          'Barlines slice the music into measures. The top number of a time signature tells how many beats sit in the box. The bottom number names the beat. The 4 on the bottom means a quarter note.',
          '4/4 is four quarter-note beats. A lot of straight-bar playing is one chord for a bar, or a chord that lasts two of these boxes. Tap the four beats, then hear them filled with open E.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            time: [4, 4],
            items: [
              { string: 1, fret: 0, dur: 'q', lyric: '1' },
              { string: 1, fret: 0, dur: 'q', lyric: '2' },
              { string: 1, fret: 0, dur: 'q', lyric: '3' },
              { string: 1, fret: 0, dur: 'q', lyric: '4' },
              { bar: true },
            ],
          }],
        },
        hear: { label: 'Tap 4/4', followStaff: true, bpm: 76, clicks: true },
      },
    ],
  },
  {
    id: 'rests',
    group: 'basics',
    title: 'Rests',
    summary: 'Silence with a job: the right hand waits.',
    screens: [
      {
        title: 'A rest for each note',
        caption: 'Whole, half, quarter, eighth, sixteenth.',
        paragraphs: [
          'A rest is counted time with no pick. The whole rest hangs under a line and lasts four beats. The half rest sits on a line and lasts two. The quarter, eighth, and sixteenth rests match the notes you just held.',
          'On the lap you keep the bar where it is and let the right hand stay quiet. The silence is part of the bar.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            items: [
              { rest: 'w', lyric: 'whole' },
              { rest: 'h', lyric: 'half' },
              { rest: 'q', lyric: 'quarter' },
              { rest: 'e', lyric: 'eighth' },
              { rest: 's', lyric: '16th' },
            ],
          }],
        },
        hear: { label: 'Count the rests', followStaff: true, bpm: 80, clicks: true },
      },
      {
        title: 'Count through the rest',
        caption: 'One, two, rest, four. The third beat is empty.',
        paragraphs: [
          'This bar is quarter, quarter, quarter rest, quarter, all on open E. Count four. On three, the hand does not play. The click still marks the beat so you can feel the hole.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            time: [4, 4],
            items: [
              { string: 1, fret: 0, dur: 'q', lyric: '1' },
              { string: 1, fret: 0, dur: 'q', lyric: '2' },
              { rest: 'q', lyric: '3' },
              { string: 1, fret: 0, dur: 'q', lyric: '4' },
              { bar: true },
            ],
          }],
        },
        hear: { label: 'Hear the rest', followStaff: true, bpm: 72, clicks: true },
      },
    ],
  },
  {
    id: 'dots-ties',
    group: 'basics',
    title: 'Dots and ties',
    summary: 'A dot adds half. A tie joins one pitch across a barline.',
    screens: [
      {
        title: 'The dot',
        caption: 'Dotted half, then a quarter, fills 4/4.',
        paragraphs: [
          'A dot adds half the length of the note it follows. A dotted half note is a half plus a quarter: three beats. A dotted quarter is a quarter plus an eighth. You will tap that dotted quarter when the meter is 6/8.',
          'The bar below is a dotted half and a quarter on open E. One pick can hold for the dotted half. The quarter is a second pick.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            time: [4, 4],
            items: [
              { string: 1, fret: 0, dur: 'h', dot: true, lyric: '3' },
              { string: 1, fret: 0, dur: 'q', lyric: '1' },
              { bar: true },
            ],
          }],
        },
        hear: { label: 'Hear the dot', followStaff: true, bpm: 72, clicks: true },
      },
      {
        title: 'The tie',
        caption: 'One E, held across the barline. Pick once.',
        paragraphs: [
          'A tie joins two notes of the same pitch into one sound. You pick the first and let the second ring. The time adds up. This is how a note walks across a barline without a new attack.',
          'Here an E on beat 4 is tied to an E on beat 1 of the next bar. Two beats, one pick. The bar stays on the nut.',
        ],
        visual: {
          type: 'staff',
          systems: [{
            time: [4, 4],
            items: [
              { rest: 'q' },
              { rest: 'q' },
              { rest: 'q' },
              { string: 1, fret: 0, dur: 'q', tie: 'start', lyric: '4' },
              { bar: true },
              { string: 1, fret: 0, dur: 'q', tie: 'stop', lyric: '1' },
              { rest: 'q' },
              { rest: 'q' },
              { rest: 'q' },
            ],
          }],
        },
        hear: { label: 'Hear the tie', followStaff: true, bpm: 76, clicks: true },
      },
    ],
  },
  {
    id: 'steps',
    group: 'basics',
    title: 'Half steps and whole steps',
    summary: 'One fret, two frets, and the names sharp and flat.',
    screens: [
      {
        title: 'One fret, two frets',
        caption: 'String 1 on top. String 6, low C, is the near edge.',
        paragraphs: [
          'On the diagram, string 1, the high E, is the top line, the far side of the lap. String 6, the low C, is the bottom line, nearest you. The nut is at the left. Every fret is a half step.',
          'On string 1, fret 0 is E and fret 1 is F. Those two letters are already a half step apart, so they sit on neighboring frets. F at fret 1 up to G at fret 3 is a whole step. F# lives in the middle, at fret 2.',
        ],
        visual: {
          type: 'neck',
          pick: [1],
          marks: tones([[1, 0, 'E'], [1, 1, 'F'], [1, 2, 'F#'], [1, 3, 'G']], {}),
        },
        hear: {
          label: 'Hear E, F, F#, G',
          events: [0, 1, 2, 3].map((fret, index) => ({ t: index * 0.48, string: 1, fret, dur: 0.55 })),
        },
      },
      {
        title: 'Sharps and flats',
        caption: 'Fret 2 is F# on the way up, Gb on the way down.',
        paragraphs: [
          'A sharp means one fret higher than the letter. A flat means one fret lower. The bar plays a fret, and the page chooses the spelling.',
          'Fret 2 on string 1 is a half step above F, so it can be written F#. It is also a half step below G, so the same fret can be written Gb. E to F and B to C are the letter pairs that are already half steps. Every other letter pair has a fret between the two names.',
        ],
        visual: {
          type: 'neck',
          pick: [1],
          marks: [
            tone(1, 1, { tag: 'F' }),
            tone(1, 2, { tag: 'F# / Gb', flats: false }),
            tone(1, 3, { tag: 'G' }),
          ],
        },
        hear: {
          label: 'Hear F, the fret between, G',
          events: [1, 2, 3].map((fret, index) => ({ t: index * 0.55, string: 1, fret, dur: 0.6 })),
        },
      },
    ],
  },
  {
    id: 'simple-meter',
    group: 'rhythm',
    title: 'Simple meters',
    summary: '2/4, 3/4, and 4/4. The beat splits in two.',
    screens: [
      {
        title: '2/4',
        caption: 'Two quarter-note beats. The first is the strong one.',
        paragraphs: [
          'Simple meter splits each beat into two equal parts, a pair of eighth notes. 2/4 has two quarter-note beats in the bar. You feel a march step: strong, weak.',
          'Tap two beats. The first click is heavier.',
        ],
        visual: { type: 'rhythm', beats: 2, accents: [0], groupLabel: 'strong · weak' },
        hear: { label: 'Tap 2/4', rhythm: true, bpm: 80, bars: 2 },
      },
      {
        title: '3/4',
        caption: 'Three quarter-note beats. A waltz step.',
        paragraphs: [
          '3/4 has three quarter-note beats. The first is strong, and the next two give way. The beat still splits into two eighths. Only the count of beats changed.',
        ],
        visual: { type: 'rhythm', beats: 3, accents: [0], groupLabel: 'strong · weak · weak' },
        hear: { label: 'Tap 3/4', rhythm: true, bpm: 84, bars: 2 },
      },
      {
        title: '4/4',
        caption: 'Four quarter-note beats. Beat 1 is strongest, beat 3 is next.',
        paragraphs: [
          '4/4 has four quarter-note beats. Beat 1 carries the bar. Beat 3 is a lighter accent. Beats 2 and 4 are the off side of the step. Each of those beats can split into two eighth notes.',
        ],
        visual: { type: 'rhythm', beats: 4, accents: [0, 2], groupLabel: '1 strong · 3 medium' },
        hear: { label: 'Tap 4/4', rhythm: true, bpm: 76, bars: 2 },
      },
    ],
  },
  {
    id: 'compound',
    group: 'rhythm',
    title: 'Compound meter',
    summary: '6/8: six eighths, felt as two dotted-quarter beats.',
    screens: [
      {
        title: 'The beat splits in three',
        caption: '6/8 · accents on 1 and 4.',
        paragraphs: [
          'In 2/4, 3/4, and 4/4 the beat splits in half. In compound meter the beat splits in three. 6/8 shows six eighth notes in the bar, and your foot taps twice. Each tap is a dotted quarter, the dotted note from the last lesson: a quarter plus an eighth.',
          'Count ONE-two-three, FOUR-five-six. The heavy clicks land on one and four.',
        ],
        visual: { type: 'rhythm', beats: 6, accents: [0, 3], groupLabel: 'two beats of three eighths' },
        hear: { label: 'Tap 6/8', rhythm: true, bpm: 168, bars: 2 },
      },
    ],
  },
  {
    id: 'five',
    group: 'rhythm',
    title: 'Five-four',
    summary: 'An odd meter: five quarter beats, grouped 3 + 2.',
    screens: [
      {
        title: '3 + 2',
        caption: 'Five beats. Accents on 1 and 4.',
        paragraphs: [
          '5/4 holds five quarter-note beats in the bar. The grouping that sits well under the hands is three plus two: ONE two three, ONE two. The second accent lands on beat 4.',
          'Tap along with the grid. The brass cells are the accents. You can also click a cell to place that beat yourself.',
        ],
        visual: { type: 'rhythm', beats: 5, accents: [0, 3], groupLabel: '3 + 2' },
        hear: { label: 'Tap 5/4', rhythm: true, bpm: 88, bars: 2 },
      },
    ],
  },
  {
    id: 'c-major',
    group: 'scales',
    title: 'C major on the neck',
    summary: 'From C on string 2, and the same scale from E on string 1.',
    screens: [
      {
        title: 'From C, on string 2',
        caption: 'Frets 0 2 4 5 7 9 11 12 · C D E F G A B C',
        paragraphs: [
          'String 2 open is C, the root of this tuning. The C major scale walks that string on frets 0, 2, 4, 5, 7, 9, 11, and 12: C, D, E, F, G, A, B, C.',
          'The one-fret gaps are E to F, frets 4 and 5, and B to C, frets 11 and 12. Those are the half steps. Every other degree skips a fret. The numbers on the dots are the scale degrees, 1 through 7 and back to 1.',
        ],
        visual: {
          type: 'neck',
          pick: [2],
          marks: tones([
            [2, 0, '1'], [2, 2, '2'], [2, 4, '3'], [2, 5, '4'],
            [2, 7, '5'], [2, 9, '6'], [2, 11, '7'], [2, 12, '1'],
          ]),
        },
        hear: {
          label: 'Hear C major',
          events: [0, 2, 4, 5, 7, 9, 11, 12].map((fret, index) => ({
            t: index * 0.38, string: 2, fret, dur: 0.45,
          })),
        },
      },
      {
        title: 'The same scale from E',
        caption: 'String 1 · frets 0 1 3 5 7 8 10 12 · E F G A B C D E',
        paragraphs: [
          'Start on degree 3 and the scale is the same notes, now from E. On string 1 the frets are 0, 1, 3, 5, 7, 8, 10, and 12: E, F, G, A, B, C, D, E. E up to F is one fret, because those letters are a half step.',
          'Frets 0, 2, 4, 5, 7, 9, 11, and 12 on this same string spell E major: E, F#, G#, A, B, C#, D#, E. That is a useful scale, and it is a different one. C major on string 1 uses the frets in this picture.',
        ],
        choices: [
          {
            label: 'C major from E',
            blurb: 'Degrees 3 4 5 6 7 1 2 3. Frets 0, 1, 3, 5, 7, 8, 10, 12.',
            visual: {
              type: 'neck',
              pick: [1],
              marks: tones([
                [1, 0, '3'], [1, 1, '4'], [1, 3, '5'], [1, 5, '6'],
                [1, 7, '7'], [1, 8, '1'], [1, 10, '2'], [1, 12, '3'],
              ]),
            },
            hear: {
              label: 'Hear it from E',
              events: [0, 1, 3, 5, 7, 8, 10, 12].map((fret, index) => ({
                t: index * 0.38, string: 1, fret, dur: 0.45,
              })),
            },
          },
          {
            label: 'E major',
            blurb: 'The even-fret walk on string 1. E F# G# A B C# D# E.',
            visual: {
              type: 'neck',
              pick: [1],
              marks: tones([
                [1, 0], [1, 2], [1, 4], [1, 5], [1, 7], [1, 9], [1, 11], [1, 12],
              ]),
            },
            hear: {
              label: 'Hear E major',
              events: [0, 2, 4, 5, 7, 9, 11, 12].map((fret, index) => ({
                t: index * 0.38, string: 1, fret, dur: 0.45,
              })),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'degrees',
    group: 'scales',
    title: 'Scale-degree names',
    summary: 'In C: do re mi fa sol la ti, on string 2.',
    screens: [
      {
        title: 'Do through ti',
        caption: 'Do is C. String 2 open, and string 6 open.',
        paragraphs: [
          'The seven degrees have singing names. In C they are 1 do, 2 re, 3 mi, 4 fa, 5 sol, 6 la, 7 ti. Do is the tonic, the note the key is named for. Ti is the leading tone, a half step under the next do.',
          'On this neck, when you are in C, do is open string 2 and also open string 6. Mi is open string 1 and open string 5. Sol is open string 4. La is open string 3. The whole open tuning is do, mi, sol, la, do, mi.',
        ],
        visual: {
          type: 'neck',
          pick: [2],
          marks: [
            tone(2, 0, { tag: 'do' }),
            tone(2, 2, { tag: 're' }),
            tone(2, 4, { tag: 'mi' }),
            tone(2, 5, { tag: 'fa' }),
            tone(2, 7, { tag: 'sol' }),
            tone(2, 9, { tag: 'la' }),
            tone(2, 11, { tag: 'ti' }),
            tone(2, 12, { tag: 'do' }),
          ],
        },
        hear: {
          label: 'Hear do to do',
          events: [0, 2, 4, 5, 7, 9, 11, 12].map((fret, index) => ({
            t: index * 0.42, string: 2, fret, dur: 0.5,
          })),
        },
      },
    ],
  },
  {
    id: 'a-minor',
    group: 'scales',
    title: 'A minor',
    summary: 'Natural, harmonic, and melodic minor on string 3.',
    screens: [
      {
        title: 'The open top three',
        caption: 'Strings 3, 2, 1 open: A C E.',
        paragraphs: [
          'Strings 3, 2, and 1 ring A, C, and E with no bar. From A up to C is three frets, a minor third. From C up to E is four frets, a major third. That stack is an A minor triad.',
          'A minor shares its notes with C major. Do is still C. The scale simply starts on la, which is A, open string 3.',
        ],
        visual: {
          type: 'neck',
          pick: [3, 2, 1],
          marks: openChord([3, 2, 1]),
        },
        hear: {
          label: 'Hear A minor',
          events: [
            { t: 0, string: 3, fret: 0, dur: 0.5 },
            { t: 0.4, string: 2, fret: 0, dur: 0.5 },
            { t: 0.8, string: 1, fret: 0, dur: 0.5 },
            { t: 1.45, notes: openChord([3, 2, 1]), dur: 1.4 },
          ],
        },
      },
      {
        title: 'Natural minor',
        caption: 'String 3 · 0 2 3 5 7 8 10 12 · A B C D E F G A',
        paragraphs: [
          'Natural minor uses the notes of C major, starting on A. On string 3 the frets are 0, 2, 3, 5, 7, 8, 10, and 12: A, B, C, D, E, F, G, A.',
          'The half steps fall between 2 and 3 (B–C, frets 2 and 3) and between 5 and 6 (E–F, frets 7 and 8). The 7th degree, G, is a whole step under A.',
        ],
        visual: {
          type: 'neck',
          pick: [3],
          marks: tones([[3, 0], [3, 2], [3, 3], [3, 5], [3, 7], [3, 8], [3, 10], [3, 12]]),
        },
        hear: {
          label: 'Hear natural minor',
          events: [0, 2, 3, 5, 7, 8, 10, 12].map((fret, index) => ({
            t: index * 0.36, string: 3, fret, dur: 0.42,
          })),
        },
      },
      {
        title: 'Harmonic minor',
        caption: 'Raise the 7th: G at fret 10 becomes G# at fret 11.',
        paragraphs: [
          'Harmonic minor keeps the natural minor notes and raises the 7th degree one fret. G at fret 10 becomes G# at fret 11. The step from G# up to A is a half step, so the scale leans into the tonic the way ti leans into do.',
          'Frets: 0, 2, 3, 5, 7, 8, 11, 12. A, B, C, D, E, F, G#, A.',
        ],
        visual: {
          type: 'neck',
          pick: [3],
          marks: [
            tone(3, 0), tone(3, 2), tone(3, 3), tone(3, 5), tone(3, 7), tone(3, 8),
            tone(3, 11, { role: 'color' }),
            tone(3, 12),
          ],
        },
        hear: {
          label: 'Hear harmonic minor',
          events: [0, 2, 3, 5, 7, 8, 11, 12].map((fret, index) => ({
            t: index * 0.36, string: 3, fret, dur: 0.42,
          })),
        },
      },
      {
        title: 'Melodic minor',
        caption: 'Going up: F# at fret 9 and G# at fret 11.',
        paragraphs: [
          'Melodic minor, going up, raises the 6th and the 7th. F becomes F# at fret 9. G becomes G# at fret 11. Frets: 0, 2, 3, 5, 7, 9, 11, 12. A, B, C, D, E, F#, G#, A.',
          'Coming down, those two degrees usually drop back to F and G, the natural minor you already played: fret 12, then 10, 8, 7, 5, 3, 2, and 0.',
        ],
        visual: {
          type: 'neck',
          pick: [3],
          marks: [
            tone(3, 0), tone(3, 2), tone(3, 3), tone(3, 5), tone(3, 7),
            tone(3, 9, { role: 'color' }),
            tone(3, 11, { role: 'color' }),
            tone(3, 12),
          ],
        },
        hear: {
          label: 'Hear it up',
          events: [0, 2, 3, 5, 7, 9, 11, 12].map((fret, index) => ({
            t: index * 0.36, string: 3, fret, dur: 0.42,
          })),
        },
      },
    ],
  },
  {
    id: 'keys',
    group: 'scales',
    title: 'Key signatures',
    summary: 'The order of sharps and flats, then the ti and fa sum.',
    screens: [
      {
        title: 'The order of sharps',
        caption: 'F C G D A E B',
        paragraphs: [
          'Sharps are written in one fixed order: F, C, G, D, A, E, B. One sharp is F#. Two sharps are F# and C#. You add the next letter; you do not rearrange them.',
          'On the treble staff they sit in a fixed pattern, starting with F# on the top line. The last sharp you wrote is ti of the major key. The next screen does that sum for any count.',
        ],
        visual: { type: 'order', kind: 'sharp' },
        hear: { label: 'Hear G, one sharp', events: [{ t: 0, string: 2, fret: 7, dur: 1.2 }] },
      },
      {
        title: 'The order of flats',
        caption: 'B E A D G C F',
        paragraphs: [
          'Flats arrive in the reverse order: B, E, A, D, G, C, F. One flat is Bb. Two flats are Bb and Eb. The last flat you wrote is fa of the major key.',
          'Once you have two or more flats, the next-to-last flat spells the major key by itself. One flat has no next-to-last, so you count a fourth down from fa. The calculation screen does both.',
        ],
        visual: { type: 'order', kind: 'flat' },
        hear: { label: 'Hear F, one flat', events: [{ t: 0, string: 2, fret: 5, dur: 1.2 }] },
      },
      {
        title: 'Last sharp is ti, last flat is fa',
        caption: 'Pick a signature. The sum is on the staff.',
        paragraphs: [
          'Last sharp is ti. The major key, do, is one half step higher than that sharp. Last flat is fa. The major key is a fourth below that flat.',
          'Choose a count. The sentence under the staff is the sum for that signature, and the tonic it names is a fret on string 2.',
        ],
        visual: { type: 'keys' },
        hear: { label: 'Hear the tonic', signature: true },
      },
    ],
  },
  {
    id: 'interval-size',
    group: 'intervals',
    title: 'Size and quality',
    summary: 'Letter count, then the frets that decide major, minor, or perfect.',
    screens: [
      {
        title: 'Count letters, then frets',
        caption: 'C up to E is a third. Four frets makes it major. Three makes it minor.',
        paragraphs: [
          'The generic size is a letter count, including the note you start on. C, D, E is three letters, so C up to E is a third, whatever the frets do. C up to F is a fourth. C up to G is a fifth.',
          'Quality is the fret count. C up to E, string 2 frets 0 to 4, is four half steps: a major third. C up to Eb, frets 0 to 3, is three half steps: a minor third. Same letters, different quality. Unisons, fourths, fifths, and octaves take the word perfect instead of major or minor.',
        ],
        choices: [
          {
            label: 'Major third',
            blurb: 'String 2, fret 0 to fret 4. C up to E. Four half steps.',
            visual: { type: 'neck', pick: [2], marks: [tone(2, 0, { tag: 'C' }), tone(2, 4, { tag: 'E' })] },
            hear: { label: 'Hear C to E', events: [
              { t: 0, string: 2, fret: 0, dur: 0.7 },
              { t: 0.55, string: 2, fret: 4, dur: 0.8 },
            ] },
          },
          {
            label: 'Minor third',
            blurb: 'String 2, fret 0 to fret 3. C up to Eb. Three half steps.',
            visual: { type: 'neck', pick: [2], marks: [tone(2, 0), tone(2, 3, { flats: true })] },
            hear: { label: 'Hear C to Eb', events: [
              { t: 0, string: 2, fret: 0, dur: 0.7 },
              { t: 0.55, string: 2, fret: 3, dur: 0.8 },
            ] },
          },
        ],
      },
    ],
  },
  {
    id: 'interval-neck',
    group: 'intervals',
    title: 'Intervals on the open neck',
    summary: 'm3, M3, P4, P5, m6, and M6 inside the open C6 grip.',
    screens: [
      {
        title: 'Six intervals you can pick open',
        caption: 'Every pair is two open strings. Click one, then hear it.',
        paragraphs: [
          'C6 already holds these six intervals between open strings. The lower string is listed first. Pick the two strings and you hear the interval as a chord; the button plays them low note, then high note, then together.',
        ],
        choices: [
          {
            label: 'm3',
            blurb: 'Strings 5 and 4. E up to G. Three half steps, a minor third.',
            visual: { type: 'neck', pick: [5, 4], marks: openChord([5, 4]) },
            hear: { label: 'Hear the minor third', events: [
              { t: 0, string: 5, fret: 0, dur: 0.55 },
              { t: 0.45, string: 4, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([5, 4]), dur: 1.2 },
            ] },
          },
          {
            label: 'M3',
            blurb: 'Strings 6 and 5. C up to E. Four half steps, a major third.',
            visual: { type: 'neck', pick: [6, 5], marks: openChord([6, 5]) },
            hear: { label: 'Hear the major third', events: [
              { t: 0, string: 6, fret: 0, dur: 0.55 },
              { t: 0.45, string: 5, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([6, 5]), dur: 1.2 },
            ] },
          },
          {
            label: 'P4',
            blurb: 'Strings 4 and 2. G up to C. Five half steps, a perfect fourth.',
            visual: { type: 'neck', pick: [4, 2], marks: openChord([4, 2]) },
            hear: { label: 'Hear the fourth', events: [
              { t: 0, string: 4, fret: 0, dur: 0.55 },
              { t: 0.45, string: 2, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([4, 2]), dur: 1.2 },
            ] },
          },
          {
            label: 'P5',
            blurb: 'Strings 6 and 4. C up to G. Seven half steps, a perfect fifth.',
            visual: { type: 'neck', pick: [6, 4], marks: openChord([6, 4]) },
            hear: { label: 'Hear the fifth', events: [
              { t: 0, string: 6, fret: 0, dur: 0.55 },
              { t: 0.45, string: 4, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([6, 4]), dur: 1.2 },
            ] },
          },
          {
            label: 'm6',
            blurb: 'Strings 5 and 2. E up to C. Eight half steps, a minor sixth.',
            visual: { type: 'neck', pick: [5, 2], marks: openChord([5, 2]) },
            hear: { label: 'Hear the minor sixth', events: [
              { t: 0, string: 5, fret: 0, dur: 0.55 },
              { t: 0.45, string: 2, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([5, 2]), dur: 1.2 },
            ] },
          },
          {
            label: 'M6',
            blurb: 'Strings 6 and 3. C up to A. Nine half steps, a major sixth. This is the "6" in C6.',
            visual: { type: 'neck', pick: [6, 3], marks: openChord([6, 3]) },
            hear: { label: 'Hear the major sixth', events: [
              { t: 0, string: 6, fret: 0, dur: 0.55 },
              { t: 0.45, string: 3, fret: 0, dur: 0.55 },
              { t: 1.15, notes: openChord([6, 3]), dur: 1.2 },
            ] },
          },
        ],
      },
    ],
  },
  {
    id: 'invert',
    group: 'intervals',
    title: 'Inverting an interval',
    summary: 'The open E–G minor third turns over into a G–E major sixth.',
    screens: [
      {
        title: 'A third becomes a sixth',
        caption: 'E–G on strings 5–4. G–E on strings 4–1.',
        paragraphs: [
          'To invert an interval, put the old top note on the bottom. The two generic sizes add to nine, so a third becomes a sixth. Major becomes minor, and minor becomes major. Perfect stays perfect: the open G–C fourth on strings 4 and 2 inverts to the open C–G fifth on strings 6 and 4.',
          'Open string 5 up to open string 4 is E up to G, three half steps, a minor third. Open string 4 up to open string 1 is G up to E, nine half steps, a major sixth. Same two letters, turned over. Green is the minor third. Brass is the major sixth.',
        ],
        visual: {
          type: 'neck',
          pick: [5, 4, 1],
          marks: [
            tone(5, 0, { role: 'color', tag: 'm3' }),
            tone(4, 0, { role: 'color', tag: 'm3' }),
            tone(1, 0, { role: 'chord', tag: 'M6' }),
          ],
        },
        hear: {
          label: 'Hear the turn',
          events: [
            { t: 0, string: 5, fret: 0, dur: 0.5 },
            { t: 0.42, string: 4, fret: 0, dur: 0.7 },
            { t: 1.4, string: 4, fret: 0, dur: 0.5 },
            { t: 1.82, string: 1, fret: 0, dur: 0.9 },
          ],
        },
      },
    ],
  },
  {
    id: 'triads',
    group: 'chords',
    title: 'Four triads',
    summary: 'Major, minor, diminished, and augmented, on frets you can prove.',
    screens: [
      {
        title: 'Two thirds, stacked',
        caption: 'Click a quality. The dots are the real frets.',
        paragraphs: [
          'A triad is two thirds stacked. Major is a major third with a minor third on top. Minor swaps that order. Diminished is two minor thirds. Augmented is two major thirds.',
          'Major and minor sit under a straight bar on this tuning. Diminished and augmented do not: a straight fret is always a sixth. Those two you spell along one string, three notes, and you can hear the stack.',
        ],
        choices: [
          {
            label: 'Major',
            blurb: 'Open strings 6, 5, and 4: C E G. Any straight bar on those three strings is a major triad. Fret 5 is F. Fret 7 is G.',
            visual: { type: 'neck', pick: [6, 5, 4], ribbon: '1 · 3 · 5', marks: openChord([6, 5, 4]) },
            hear: { label: 'Hear C major', events: [{ t: 0, notes: openChord([6, 5, 4]), dur: 1.5 }] },
          },
          {
            label: 'A minor',
            blurb: 'Open strings 3, 2, and 1: A C E. The top of the open grip.',
            visual: { type: 'neck', pick: [3, 2, 1], ribbon: '1 · ♭3 · 5', marks: openChord([3, 2, 1]) },
            hear: { label: 'Hear A minor', events: [{ t: 0, notes: openChord([3, 2, 1]), dur: 1.5 }] },
          },
          {
            label: 'D minor',
            blurb: 'Fret 5, strings 3, 2, and 1: D F A. The top of an F6 bar.',
            visual: {
              type: 'neck',
              pick: [3, 2, 1],
              ribbon: '1 · ♭3 · 5',
              bar: { fret: 5, from: 3, to: 1 },
              marks: barChord(5, [3, 2, 1]),
            },
            hear: { label: 'Hear D minor', events: [{ t: 0, notes: barChord(5, [3, 2, 1]), dur: 1.5 }] },
          },
          {
            label: 'Diminished',
            blurb: 'String 3, frets 2, 5, and 8: B D F. Two minor thirds. There is no straight bar that holds all three.',
            visual: {
              type: 'neck',
              pick: [3],
              ribbon: '1 · ♭3 · ♭5',
              marks: tones([[3, 2], [3, 5], [3, 8]]),
            },
            hear: {
              label: 'Hear B diminished',
              events: [2, 5, 8].map((fret, index) => ({ t: index * 0.42, string: 3, fret, dur: 0.55 })),
            },
          },
          {
            label: 'Augmented',
            blurb: 'String 2, frets 0, 4, and 8: C E G#. Two major thirds. The fifth is raised one fret past the perfect fifth at fret 7.',
            visual: {
              type: 'neck',
              pick: [2],
              ribbon: '1 · 3 · ♯5',
              marks: [tone(2, 0), tone(2, 4), tone(2, 8, { role: 'color' })],
            },
            hear: {
              label: 'Hear C augmented',
              events: [0, 4, 8].map((fret, index) => ({ t: index * 0.42, string: 2, fret, dur: 0.55 })),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'sixth',
    group: 'chords',
    title: 'The straight-bar sixth',
    summary: 'A major triad plus a major sixth. Open strings are C6.',
    screens: [
      {
        title: 'Triad plus 6',
        caption: 'Open: C E G A C E.',
        paragraphs: [
          'A straight bar on all six strings is a sixth chord: a major triad plus a major sixth above the root. Open, the low three strings are C, E, and G. String 3 adds A, nine half steps above the low C. The top two strings repeat C and E an octave up.',
          'Those same pitches, named from A, are A, C, E, and G: an A minor 7. The hand does not move. C6 is the name this tuning is built to answer to.',
        ],
        visual: {
          type: 'neck',
          pick: [6, 5, 4, 3, 2, 1],
          ribbon: 'C · E · G · A · C · E',
          marks: openChord([6, 5, 4, 3, 2, 1]),
        },
        hear: {
          label: 'Hear C6',
          events: [
            ...[6, 5, 4, 3, 2, 1].map((string, index) => ({ t: index * 0.28, string, fret: 0, dur: 0.4 })),
            { t: 2.1, notes: openChord([6, 5, 4, 3, 2, 1]), dur: 1.6 },
          ],
        },
      },
    ],
  },
  {
    id: 'inversions',
    group: 'chords',
    title: 'Triad inversions',
    summary: 'C, C with E in the bass, C with G in the bass. All open strings.',
    screens: [
      {
        title: 'Same three notes, new bass',
        caption: 'Root, first inversion, second inversion.',
        paragraphs: [
          'Inversion keeps the pitch classes and changes which one is lowest. Root position puts the root in the bass. First inversion puts the third in the bass. Second inversion puts the fifth in the bass.',
          'All three live in the open C6 grip. You prove them by picking only the strings named here. Nothing is fretted, so the pitches are the open tuning itself.',
        ],
        choices: [
          {
            label: 'Root',
            blurb: 'Strings 6, 5, 4: C E G. C is in the bass.',
            visual: { type: 'neck', pick: [6, 5, 4], ribbon: 'C in the bass', marks: openChord([6, 5, 4]) },
            hear: { label: 'Hear root position', events: [{ t: 0, notes: openChord([6, 5, 4]), dur: 1.4 }] },
          },
          {
            label: 'First',
            blurb: 'Strings 5, 4, 2: E G C. E, the third, is in the bass. This is C/E.',
            visual: { type: 'neck', pick: [5, 4, 2], ribbon: 'E in the bass', marks: openChord([5, 4, 2]) },
            hear: { label: 'Hear first inversion', events: [{ t: 0, notes: openChord([5, 4, 2]), dur: 1.4 }] },
          },
          {
            label: 'Second',
            blurb: 'Strings 4, 2, 1: G C E. G, the fifth, is in the bass. This is C/G.',
            visual: { type: 'neck', pick: [4, 2, 1], ribbon: 'G in the bass', marks: openChord([4, 2, 1]) },
            hear: { label: 'Hear second inversion', events: [{ t: 0, notes: openChord([4, 2, 1]), dur: 1.4 }] },
          },
        ],
      },
    ],
  },
  {
    id: 'sevenths',
    group: 'chords',
    title: 'Seventh chords',
    summary: 'The five common stacks, then the frets that spell them.',
    screens: [
      {
        title: 'Five kinds',
        caption: 'Three of them on the C string. Two of them on B, along string 3.',
        paragraphs: [
          'A seventh chord stacks a third on top of a triad. The five you meet constantly: major 7 (1 3 5 7), dominant 7 (1 3 5 ♭7), minor 7 (1 ♭3 5 ♭7), half-diminished (1 ♭3 ♭5 ♭7), and diminished 7 (1 ♭3 ♭5 ♭♭7).',
          'The first three are built on C along string 2, so you can watch the third and the seventh move by one fret. The last two start on B along string 3, the leading tone of C, where the spelling stays to single flats.',
        ],
        choices: [
          {
            label: 'Major 7',
            blurb: 'String 2, frets 0, 4, 7, 11: C E G B. The seventh is a half step under the octave.',
            visual: {
              type: 'neck',
              pick: [2],
              ribbon: '1 · 3 · 5 · 7',
              marks: tones([[2, 0], [2, 4], [2, 7], [2, 11]]),
            },
            hear: {
              label: 'Hear Cmaj7',
              events: [0, 4, 7, 11].map((fret, index) => ({ t: index * 0.36, string: 2, fret, dur: 0.5 })),
            },
          },
          {
            label: 'Dominant 7',
            blurb: 'String 2, frets 0, 4, 7, 10: C E G Bb. The seventh dropped one fret.',
            visual: {
              type: 'neck',
              pick: [2],
              ribbon: '1 · 3 · 5 · ♭7',
              marks: [tone(2, 0), tone(2, 4), tone(2, 7), tone(2, 10, { flats: true })],
            },
            hear: {
              label: 'Hear C7',
              events: [0, 4, 7, 10].map((fret, index) => ({ t: index * 0.36, string: 2, fret, dur: 0.5 })),
            },
          },
          {
            label: 'Minor 7',
            blurb: 'String 2, frets 0, 3, 7, 10: C Eb G Bb. The third dropped one fret as well.',
            visual: {
              type: 'neck',
              pick: [2],
              ribbon: '1 · ♭3 · 5 · ♭7',
              marks: [tone(2, 0), tone(2, 3, { flats: true }), tone(2, 7), tone(2, 10, { flats: true })],
            },
            hear: {
              label: 'Hear Cm7',
              events: [0, 3, 7, 10].map((fret, index) => ({ t: index * 0.36, string: 2, fret, dur: 0.5 })),
            },
          },
          {
            label: 'Half-dim',
            blurb: 'String 3, frets 2, 5, 8, 12: B D F A. Minor seventh with a lowered fifth. Also called m7♭5.',
            visual: {
              type: 'neck',
              pick: [3],
              ribbon: '1 · ♭3 · ♭5 · ♭7',
              marks: tones([[3, 2], [3, 5], [3, 8], [3, 12]]),
            },
            hear: {
              label: 'Hear Bm7♭5',
              events: [2, 5, 8, 12].map((fret, index) => ({ t: index * 0.36, string: 3, fret, dur: 0.5 })),
            },
          },
          {
            label: 'Dim 7',
            blurb: 'String 3, frets 2, 5, 8, 11: B D F Ab. The seventh is one fret lower than the half-diminished seventh. Three minor thirds.',
            visual: {
              type: 'neck',
              pick: [3],
              ribbon: '1 · ♭3 · ♭5 · ♭♭7',
              marks: [tone(3, 2), tone(3, 5), tone(3, 8), tone(3, 11, { flats: true, role: 'color' })],
            },
            hear: {
              label: 'Hear Bdim7',
              events: [2, 5, 8, 11].map((fret, index) => ({ t: index * 0.36, string: 3, fret, dur: 0.5 })),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'ninth',
    group: 'chords',
    title: 'The dominant 9',
    summary: 'Strings 1–3, two frets under a sixth. C9 at fret 10 is G Bb D.',
    screens: [
      {
        title: 'Two frets under the sixth',
        caption: 'Fret 10 · strings 3, 2, 1 · G Bb D.',
        paragraphs: [
          'Find the straight-bar sixth, then slide two frets toward the nut and pick only strings 1, 2, and 3. Those three notes are the 5, the flat 7, and the 9 of that sixth. The root can live in the bass of the song; the left hand is playing the color.',
          'C6 comes back at fret 12, the pale bar. Two frets under it is fret 10. String 3 is G, string 2 is Bb, string 1 is D. From C, G is the 5th, Bb is the flat 7th, and D is the 9th. The same move under F6 (fret 5) is fret 3, and under G6 (fret 7) is fret 5.',
        ],
        visual: {
          type: 'neck',
          pick: [3, 2, 1],
          ribbon: '5 · ♭7 · 9',
          bar: { fret: 10, from: 3, to: 1 },
          ghostBar: { fret: 12, from: 6, to: 1 },
          marks: [
            tone(3, 10, { tag: '5' }),
            tone(2, 10, { flats: true, tag: '♭7' }),
            tone(1, 10, { tag: '9' }),
          ],
        },
        hear: {
          label: 'Hear C9',
          events: [
            { t: 0, string: 3, fret: 10, dur: 0.5 },
            { t: 0.4, string: 2, fret: 10, dur: 0.5 },
            { t: 0.8, string: 1, fret: 10, dur: 0.5 },
            { t: 1.45, notes: barChord(10, [3, 2, 1]), dur: 1.5 },
          ],
        },
      },
    ],
  },
  {
    id: 'diatonic-triads',
    group: 'diatonic',
    title: 'Triads of C major',
    summary: 'C, Dm, Em, F, G, Am, Bdim, and the grips that actually hold them.',
    screens: [
      {
        title: 'Where they sit',
        caption: 'Six of the seven are a straight bar or the top three strings.',
        paragraphs: [
          'The triads of C major are C, D minor, E minor, F, G, A minor, and B diminished. Strings 6–5–4 under a straight bar are always a major triad. Strings 3–2–1 under a straight bar are always a minor triad.',
          'So C is fret 0 on the low three, F is fret 5 on the low three, and G is fret 7 on the low three. A minor is fret 0 on the top three, D minor is fret 5 on the top three, and E minor is fret 7 on the top three. B diminished is the one that leaves the straight bar: string 3, frets 2, 5, and 8, B D F.',
        ],
        choices: [
          {
            label: 'C',
            blurb: 'I. Fret 0, strings 6–5–4. C E G.',
            visual: { type: 'neck', pick: [6, 5, 4], marks: openChord([6, 5, 4]) },
            hear: { label: 'Hear C', events: [{ t: 0, notes: openChord([6, 5, 4]), dur: 1.3 }] },
          },
          {
            label: 'Dm',
            blurb: 'ii. Fret 5, strings 3–2–1. D F A. The top of F6.',
            visual: { type: 'neck', pick: [3, 2, 1], bar: { fret: 5, from: 3, to: 1 }, marks: barChord(5, [3, 2, 1]) },
            hear: { label: 'Hear Dm', events: [{ t: 0, notes: barChord(5, [3, 2, 1]), dur: 1.3 }] },
          },
          {
            label: 'Em',
            blurb: 'iii. Fret 7, strings 3–2–1. E G B. The top of G6.',
            visual: { type: 'neck', pick: [3, 2, 1], bar: { fret: 7, from: 3, to: 1 }, marks: barChord(7, [3, 2, 1]) },
            hear: { label: 'Hear Em', events: [{ t: 0, notes: barChord(7, [3, 2, 1]), dur: 1.3 }] },
          },
          {
            label: 'F',
            blurb: 'IV. Fret 5, strings 6–5–4. F A C. The low side of F6.',
            visual: { type: 'neck', pick: [6, 5, 4], bar: { fret: 5, from: 6, to: 4 }, marks: barChord(5, [6, 5, 4]) },
            hear: { label: 'Hear F', events: [{ t: 0, notes: barChord(5, [6, 5, 4]), dur: 1.3 }] },
          },
          {
            label: 'G',
            blurb: 'V. Fret 7, strings 6–5–4. G B D. The low side of G6.',
            visual: { type: 'neck', pick: [6, 5, 4], bar: { fret: 7, from: 6, to: 4 }, marks: barChord(7, [6, 5, 4]) },
            hear: { label: 'Hear G', events: [{ t: 0, notes: barChord(7, [6, 5, 4]), dur: 1.3 }] },
          },
          {
            label: 'Am',
            blurb: 'vi. Fret 0, strings 3–2–1. A C E. The top of the open grip.',
            visual: { type: 'neck', pick: [3, 2, 1], marks: openChord([3, 2, 1]) },
            hear: { label: 'Hear Am', events: [{ t: 0, notes: openChord([3, 2, 1]), dur: 1.3 }] },
          },
          {
            label: 'Bdim',
            blurb: 'vii°. String 3, frets 2, 5, 8. B D F. Played as three notes, one string.',
            visual: { type: 'neck', pick: [3], marks: tones([[3, 2], [3, 5], [3, 8]]) },
            hear: {
              label: 'Hear Bdim',
              events: [2, 5, 8].map((fret, index) => ({ t: index * 0.4, string: 3, fret, dur: 0.5 })),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'numerals',
    group: 'diatonic',
    title: 'Roman numerals',
    summary: 'I ii iii IV V vi vii° for the seven triads.',
    screens: [
      {
        title: 'Numbers that survive a new key',
        caption: 'Uppercase is major. Lowercase is minor. The circle is diminished.',
        paragraphs: [
          'Roman numerals name a chord by its degree, so the pattern still means something when you slide the whole song to another fret. In C: I is C, ii is D minor, iii is E minor, IV is F, V is G, vi is A minor, vii° is B diminished.',
          'Uppercase is major, lowercase is minor, and the small circle marks diminished. Click a row to hear that grip. The button plays them in order.',
        ],
        visual: {
          type: 'rows',
          rows: [
            { num: 'I', title: 'C', sub: 'Fret 0 · strings 6–5–4', notes: openChord([6, 5, 4]) },
            { num: 'ii', title: 'Dm', sub: 'Fret 5 · strings 3–2–1', notes: barChord(5, [3, 2, 1]) },
            { num: 'iii', title: 'Em', sub: 'Fret 7 · strings 3–2–1', notes: barChord(7, [3, 2, 1]) },
            { num: 'IV', title: 'F', sub: 'Fret 5 · strings 6–5–4', notes: barChord(5, [6, 5, 4]) },
            { num: 'V', title: 'G', sub: 'Fret 7 · strings 6–5–4', notes: barChord(7, [6, 5, 4]) },
            { num: 'vi', title: 'Am', sub: 'Fret 0 · strings 3–2–1', notes: openChord([3, 2, 1]) },
            { num: 'vii°', title: 'Bdim', sub: 'String 3 · frets 2, 5, 8', notes: tones([[3, 2], [3, 5], [3, 8]]), spread: true },
          ],
        },
        hear: { label: 'Hear I through vii°', rows: true },
      },
    ],
  },
  {
    id: 'diatonic-sevenths',
    group: 'diatonic',
    title: 'Sevenths in C',
    summary: 'I△7, ii7, and V7, plus one sentence on harmonic minor.',
    screens: [
      {
        title: 'I△7, ii7, V7',
        caption: 'C major 7, D minor 7, G7.',
        paragraphs: [
          'The seventh chords built on the degrees of C follow the scale. I△7 is C major 7. ii7 is D minor 7. V7 is G7, the dominant seventh, the one that pulls back to C.',
          'D minor 7, D F A C, uses the same pitches as the F6 bar at fret 5. G7 is G B D F along string 4, frets 0, 4, 7, and 10.',
        ],
        choices: [
          {
            label: 'I△7',
            blurb: 'String 2, frets 0, 4, 7, 11. C E G B.',
            visual: { type: 'neck', pick: [2], ribbon: 'I△7', marks: tones([[2, 0], [2, 4], [2, 7], [2, 11]]) },
            hear: {
              label: 'Hear Cmaj7',
              events: [0, 4, 7, 11].map((fret, index) => ({ t: index * 0.38, string: 2, fret, dur: 0.5 })),
            },
          },
          {
            label: 'ii7',
            blurb: 'String 2, frets 2, 5, 9, 12. D F A C. The same pitches as F6 at fret 5.',
            visual: { type: 'neck', pick: [2], ribbon: 'ii7', marks: tones([[2, 2], [2, 5], [2, 9], [2, 12]]) },
            hear: {
              label: 'Hear Dm7',
              events: [2, 5, 9, 12].map((fret, index) => ({ t: index * 0.38, string: 2, fret, dur: 0.5 })),
            },
          },
          {
            label: 'V7',
            blurb: 'String 4, frets 0, 4, 7, 10. G B D F.',
            visual: { type: 'neck', pick: [4], ribbon: 'V7', marks: tones([[4, 0], [4, 4], [4, 7], [4, 10]]) },
            hear: {
              label: 'Hear G7',
              events: [0, 4, 7, 10].map((fret, index) => ({ t: index * 0.38, string: 4, fret, dur: 0.5 })),
            },
          },
        ],
      },
      {
        title: 'What harmonic minor does to V',
        caption: 'In A minor, fret 7 on the top three is E minor. Raise G to G# and it is E major.',
        paragraphs: [
          'In A natural minor the chord on the fifth degree is E minor: fret 7, strings 3–2–1, E G B. Harmonic minor raises the 7th of the scale, G to G#, and that fifth chord becomes E major, E G# B.',
          'The G# is string 2, fret 8, one fret higher than the straight bar. You can hear the minor grip under the bar, then the one note that moves.',
        ],
        visual: {
          type: 'neck',
          pick: [3, 2, 1],
          bar: { fret: 7, from: 3, to: 1 },
          marks: [
            tone(3, 7, { tag: 'E' }),
            tone(2, 7, { tag: 'G' }),
            tone(2, 8, { role: 'color', tag: 'G#' }),
            tone(1, 7, { tag: 'B' }),
          ],
        },
        hear: {
          label: 'Hear Em, then the G#',
          events: [
            { t: 0, notes: barChord(7, [3, 2, 1]), dur: 1.3 },
            { t: 1.5, string: 2, fret: 8, dur: 0.9 },
            { t: 2.5, notes: [tone(3, 7), tone(2, 8), tone(1, 7)], dur: 1.4 },
          ],
        },
      },
    ],
  },
  {
    id: 'voicing',
    group: 'diatonic',
    title: 'Close and spread',
    summary: 'Three strings in one octave, or the full six-string sixth.',
    screens: [
      {
        title: 'Same fret, two jobs',
        caption: 'Fret 5. Top three is D minor. All six is F6.',
        paragraphs: [
          'Close voicing stacks a triad on neighboring strings so the outside notes stay inside one octave. At fret 5, strings 3–2–1 are D4, F4, and A4. D up to A is a fifth. That is D minor, tight enough to read as one handful.',
          'The full straight bar at that fret is F6 across all six strings: F A C D F A. The notes cover more than an octave, and the sixth shape brings each tone around again. One fret, two chords, depending on which strings you pick.',
        ],
        choices: [
          {
            label: 'Close',
            blurb: 'Strings 3–2–1 at fret 5. D F A, inside one octave.',
            visual: {
              type: 'neck',
              pick: [3, 2, 1],
              ribbon: 'D4 · F4 · A4',
              bar: { fret: 5, from: 3, to: 1 },
              marks: barChord(5, [3, 2, 1]),
            },
            hear: { label: 'Hear the close triad', events: [{ t: 0, notes: barChord(5, [3, 2, 1]), dur: 1.5 }] },
          },
          {
            label: 'The sixth',
            blurb: 'All six strings at fret 5. F A C D F A.',
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'F6',
              bar: { fret: 5, from: 6, to: 1 },
              marks: barChord(5, [6, 5, 4, 3, 2, 1]),
            },
            hear: { label: 'Hear F6', events: [{ t: 0, notes: barChord(5, [6, 5, 4, 3, 2, 1]), dur: 1.6 }] },
          },
        ],
      },
    ],
  },
  {
    id: 'nonharmonic',
    group: 'progressions',
    title: 'Passing and neighbor tones',
    summary: 'Notes outside C6, on string 1, over a held open bar.',
    screens: [
      {
        title: 'Passing tone',
        caption: 'E, F, G on string 1. F is the passer.',
        paragraphs: [
          'A passing tone steps between two chord tones. Over C6 the chord tones on string 1 include E at fret 0 and G at fret 3. F at fret 1 sits between them and is not in C, E, G, or A.',
          'The open sixth rings, and the line E–F–G walks across it. F is the note that does not belong to the chord. It earns its place by connecting the two that do.',
        ],
        visual: {
          type: 'neck',
          pick: [1],
          marks: [
            tone(1, 0, { tag: 'E' }),
            tone(1, 1, { role: 'pass', tag: 'F' }),
            tone(1, 3, { tag: 'G' }),
          ],
        },
        hear: {
          label: 'Hear the passing tone',
          events: [
            { t: 0, notes: openChord([6, 5, 4, 3, 2, 1]), dur: 2.6 },
            { t: 0.35, string: 1, fret: 0, dur: 0.45 },
            { t: 0.85, string: 1, fret: 1, dur: 0.45 },
            { t: 1.35, string: 1, fret: 3, dur: 0.7 },
          ],
        },
      },
      {
        title: 'Neighbor tone',
        caption: 'A, B, A. B steps off the chord and comes home.',
        paragraphs: [
          'A neighbor tone steps away from a chord tone and returns to the same tone. A at fret 5 is the 6th of C6, a chord tone in this grip. B at fret 7 is one step higher and is not in the chord. The line A–B–A leaves and comes back.',
          'The open sixth holds still. Only string 1 moves.',
        ],
        visual: {
          type: 'neck',
          pick: [1],
          marks: [
            tone(1, 5, { tag: 'A' }),
            tone(1, 7, { role: 'pass', tag: 'B' }),
          ],
        },
        hear: {
          label: 'Hear the neighbor',
          events: [
            { t: 0, notes: openChord([6, 5, 4, 3, 2, 1]), dur: 2.6 },
            { t: 0.35, string: 1, fret: 5, dur: 0.45 },
            { t: 0.9, string: 1, fret: 7, dur: 0.45 },
            { t: 1.45, string: 1, fret: 5, dur: 0.7 },
          ],
        },
      },
    ],
  },
  {
    id: 'phrase',
    group: 'progressions',
    title: 'Phrase and cadence',
    summary: 'Four bars, ending G6 to C6.',
    screens: [
      {
        title: 'A sentence that lands V–I',
        caption: 'C6, F6, G6, C6. The last two bars are the cadence.',
        paragraphs: [
          'A phrase is a musical sentence, often four bars. This one moves C6, F6, G6, C6: frets 0, 5, 7, and home to 0. Each bar is one straight bar. The high string sings E, A, B, E.',
          'The last two bars are G then C, degree 5 to degree 1. That ending is an authentic cadence. The phrase asks with G and answers with C.',
        ],
        frames: [
          {
            caption: 'Bar 1 · C6 · fret 0 · string 1 is E',
            hold: 1.7,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'I', marks: openChord([1, 2, 3, 4, 5, 6]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'Bar 2 · F6 · fret 5 · string 1 is A',
            hold: 1.7,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'IV',
              bar: { fret: 5, from: 6, to: 1 },
              marks: barChord(5, [1, 2, 3, 4, 5, 6]),
            },
            notes: barChord(5, [6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'Bar 3 · G6 · fret 7 · string 1 is B · this is V',
            hold: 1.7,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'V',
              bar: { fret: 7, from: 6, to: 1 },
              marks: barChord(7, [1, 2, 3, 4, 5, 6]),
            },
            notes: barChord(7, [6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'Bar 4 · C6 · fret 0 · I again',
            hold: 2,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'I', marks: openChord([1, 2, 3, 4, 5, 6]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
        ],
        hearLabel: 'Hear the phrase',
      },
    ],
  },
  {
    id: 'circle',
    group: 'progressions',
    title: 'Circle of fifths',
    summary: 'The clock, then C, F, B diminished, and home.',
    screens: [
      {
        title: 'The clock',
        caption: 'Clockwise is up a fifth. C, G, D, A, and on around.',
        paragraphs: [
          'Each step clockwise is a fifth higher. C\'s fifth is G, G\'s fifth is D, and the chain returns to C after all twelve. Counterclockwise, each step is a fifth lower, which is the same distance as a fourth higher. Chords that pull tend to walk counterclockwise: G falls to C, and C falls to F.',
          'A minor, the open top three, shares C\'s signature. No sharps, no flats. On the neck, G is also open string 4, and F6 is the straight bar at fret 5.',
        ],
        visual: { type: 'circle', highlight: ['C', 'F', 'G', 'B'] },
        hear: {
          label: 'Hear C, G, C',
          events: [
            { t: 0, notes: openChord([6, 5, 4]), dur: 0.9 },
            { t: 1, notes: barChord(7, [6, 5, 4]), dur: 0.9 },
            { t: 2, notes: openChord([6, 5, 4]), dur: 1.1 },
          ],
        },
      },
      {
        title: 'A lap-steel snippet in C',
        caption: 'C6, F6, B–D–F, C6. G6 at fret 7 can stand in for the B diminished.',
        paragraphs: [
          'One short walk around the circle, in C. C6 at fret 0, then a fifth down to F6 at fret 5. The next diatonic fifth down from F would be Bb; in C major that place is taken by B diminished, B D F, on string 3 at frets 2, 5, and 8. B is ti, so it leads home to C6.',
          'If you want a straight bar for that third chord, play G6 at fret 7 instead. G is a fifth above C, one step clockwise, and G to C is the same homecoming. The button plays C, F, the B diminished tones, then C.',
        ],
        frames: [
          {
            caption: 'C6 · fret 0',
            hold: 1.55,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'C', marks: openChord([6, 5, 4, 3, 2, 1]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'F6 · fret 5 · a fifth down from C',
            hold: 1.55,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'F',
              bar: { fret: 5, from: 6, to: 1 },
              marks: barChord(5, [6, 5, 4, 3, 2, 1]),
            },
            notes: barChord(5, [6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'B diminished · string 3 · frets 2, 5, 8 · or use G6 at fret 7',
            hold: 1.7,
            visual: { type: 'neck', pick: [3], ribbon: 'Bdim', marks: tones([[3, 2], [3, 5], [3, 8]]) },
            events: [2, 5, 8].map((fret, index) => ({ t: index * 0.34, string: 3, fret, dur: 0.4 })),
          },
          {
            caption: 'C6 · home',
            hold: 1.8,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'C', marks: openChord([6, 5, 4, 3, 2, 1]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
        ],
        hearLabel: 'Hear C, F, Bdim, C',
      },
    ],
  },
  {
    id: 'common',
    group: 'progressions',
    title: 'Two progressions',
    summary: 'I–vi–IV–V and I–IV–V, on bars you can hold.',
    screens: [
      {
        title: 'I – vi – IV – V',
        caption: 'C6, the open top three, F6, G6.',
        paragraphs: [
          'I–vi–IV–V in C is C, A minor, F, and G. On this neck, I is the open straight bar. vi is the same position with only the top three strings, A C E. IV is F6 at fret 5. V is G6 at fret 7.',
          'You do not move for the first two chords. You change which strings the right hand takes. Then the bar slides to 5 and to 7.',
        ],
        frames: [
          {
            caption: 'I · C6 · fret 0',
            hold: 1.5,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'I', marks: openChord([6, 5, 4, 3, 2, 1]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'vi · A minor · open strings 3–2–1',
            hold: 1.5,
            visual: { type: 'neck', pick: [3, 2, 1], ribbon: 'vi', marks: openChord([3, 2, 1]) },
            notes: openChord([3, 2, 1]),
          },
          {
            caption: 'IV · F6 · fret 5',
            hold: 1.5,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'IV',
              bar: { fret: 5, from: 6, to: 1 },
              marks: barChord(5, [6, 5, 4, 3, 2, 1]),
            },
            notes: barChord(5, [6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'V · G6 · fret 7',
            hold: 1.7,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'V',
              bar: { fret: 7, from: 6, to: 1 },
              marks: barChord(7, [6, 5, 4, 3, 2, 1]),
            },
            notes: barChord(7, [6, 5, 4, 3, 2, 1]),
          },
        ],
        hearLabel: 'Hear I–vi–IV–V',
      },
      {
        title: 'I – IV – V',
        caption: 'Frets 0, 5, and 7.',
        paragraphs: [
          'I–IV–V is the smaller version: C6, F6, G6. Frets 0, 5, and 7. Three straight bars. The high string moves E, A, B.',
          'Bring it home by returning to fret 0 when you want the phrase to close. That last G-to-C is the cadence from the phrase lesson.',
        ],
        frames: [
          {
            caption: 'I · C6 · fret 0',
            hold: 1.45,
            visual: { type: 'neck', pick: [6, 5, 4, 3, 2, 1], ribbon: 'I', marks: openChord([6, 5, 4, 3, 2, 1]) },
            notes: openChord([6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'IV · F6 · fret 5',
            hold: 1.45,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'IV',
              bar: { fret: 5, from: 6, to: 1 },
              marks: barChord(5, [6, 5, 4, 3, 2, 1]),
            },
            notes: barChord(5, [6, 5, 4, 3, 2, 1]),
          },
          {
            caption: 'V · G6 · fret 7',
            hold: 1.6,
            visual: {
              type: 'neck',
              pick: [6, 5, 4, 3, 2, 1],
              ribbon: 'V',
              bar: { fret: 7, from: 6, to: 1 },
              marks: barChord(7, [6, 5, 4, 3, 2, 1]),
            },
            notes: barChord(7, [6, 5, 4, 3, 2, 1]),
          },
        ],
        hearLabel: 'Hear I–IV–V',
      },
    ],
  },
  {
    id: 'bass-line',
    group: 'progressions',
    title: 'Inversions in a line',
    summary: 'The bass walks C, E, G, C on open strings. The chord stays C.',
    screens: [
      {
        title: 'C, then E in the bass, then G',
        caption: 'Root, first inversion, second inversion, root.',
        paragraphs: [
          'The three open voicings of C can walk as a progression. Start with strings 6–5–4, C in the bass. Move to strings 5–4–2, E in the bass: first inversion. Then strings 4–2–1, G in the bass: second inversion. Return to C in the bass.',
          'The pitch classes never leave C, E, and G. What changes is the lowest note. The bass line is C, E, G, C, and every note is an open string.',
        ],
        frames: [
          {
            caption: 'Root · C E G · strings 6–5–4',
            hold: 1.45,
            visual: { type: 'neck', pick: [6, 5, 4], ribbon: 'C bass', marks: openChord([6, 5, 4]) },
            notes: openChord([6, 5, 4]),
          },
          {
            caption: 'First inversion · E G C · strings 5–4–2',
            hold: 1.45,
            visual: { type: 'neck', pick: [5, 4, 2], ribbon: 'E bass', marks: openChord([5, 4, 2]) },
            notes: openChord([5, 4, 2]),
          },
          {
            caption: 'Second inversion · G C E · strings 4–2–1',
            hold: 1.45,
            visual: { type: 'neck', pick: [4, 2, 1], ribbon: 'G bass', marks: openChord([4, 2, 1]) },
            notes: openChord([4, 2, 1]),
          },
          {
            caption: 'Root again · C in the bass',
            hold: 1.7,
            visual: { type: 'neck', pick: [6, 5, 4], ribbon: 'C bass', marks: openChord([6, 5, 4]) },
            notes: openChord([6, 5, 4]),
          },
        ],
        hearLabel: 'Hear the bass walk',
      },
    ],
  },
  {
    id: 'auld',
    group: 'progressions',
    title: 'Auld Lang Syne',
    summary: 'The chorus in C, on string 2, in even quarter notes.',
    screens: [
      {
        title: 'The chorus on the C string',
        caption: 'String 2. The number under each note is the fret.',
        paragraphs: [
          'This is the chorus people sing at the turn of the year, set in C in a plain string of quarter notes. The pitches are the traditional tune. The even rhythm is a steel reading, so every note is one fret to find.',
          'String 1 opens on E, and this melody dips to C and D, so the whole chorus sits on string 2. C is fret 0, D is 2, E is 4, G is 7. The numbers under the staff are those frets.',
        ],
        visual: { type: 'staff', systems: auldSystems() },
        hear: { label: 'Hear the chorus', events: auldEvents(96) },
      },
      {
        title: 'The frets',
        caption: 'One string. C D E G, frets 0, 2, 4, and 7.',
        paragraphs: [
          'Four pitches, four frets, one string. The line starts on G, fret 7, drops through E to open C, and steps back up. When a phrase ends it settles on open C, the root, with the open sixth available under it if you want a chord on the last note.',
          'Play it slowly with the button, then pick the dots yourself. The cursor rides the fret the tune is on.',
        ],
        visual: {
          type: 'neck',
          pick: [2],
          marks: tones([[2, 0, 'C'], [2, 2, 'D'], [2, 4, 'E'], [2, 7, 'G']]),
        },
        hear: { label: 'Hear it on the neck', events: auldEvents(92) },
      },
    ],
  },
];

export function lessonGroups() {
  return GROUPS.map((group) => ({
    ...group,
    lessons: LESSONS.filter((lesson) => lesson.group === group.id),
  }));
}

export function auditClaims() {
  const claims = [
    [1, 0, 'E'], [1, 1, 'F'], [1, 2, 'F#'], [1, 3, 'G'], [1, 5, 'A'], [1, 7, 'B'],
    [1, 8, 'C'], [1, 10, 'D'], [1, 12, 'E'], [1, 4, 'G#'], [1, 9, 'C#'], [1, 11, 'D#'],
    [2, 0, 'C'], [2, 2, 'D'], [2, 3, 'Eb', true], [2, 4, 'E'], [2, 5, 'F'], [2, 6, 'Gb', true],
    [2, 7, 'G'], [2, 8, 'G#'], [2, 9, 'A'], [2, 10, 'Bb', true], [2, 11, 'B'], [2, 12, 'C'],
    [3, 0, 'A'], [3, 2, 'B'], [3, 3, 'C'], [3, 5, 'D'], [3, 7, 'E'], [3, 8, 'F'],
    [3, 9, 'F#'], [3, 10, 'G'], [3, 11, 'Ab', true], [3, 12, 'A'],
    [4, 0, 'G'], [4, 4, 'B'], [4, 7, 'D'], [4, 10, 'F'],
    [5, 0, 'E'], [6, 0, 'C'],
    [1, 10, 'D'], [3, 10, 'G'], [5, 5, 'A'], [6, 5, 'F'], [4, 5, 'C'],
    [3, 7, 'E'], [2, 7, 'G'], [6, 7, 'G'], [5, 7, 'B'], [4, 7, 'D'],
  ];
  const bad = [];
  for (const [string, fret, name, flats] of claims) {
    const got = midiToName(stringMidi(string, fret), Boolean(flats)).name;
    if (got !== name) bad.push(`string ${string} fret ${fret}: ${got} !== ${name}`);
  }
  for (let count = 0; count <= 7; count += 1) {
    const sharp = describeSignature('sharp', count);
    const flat = describeSignature('flat', count);
    if (!sharp.key || !flat.key) bad.push(`empty key at ${count}`);
    const sharpFretName = midiToName(stringMidi(2, sharp.fret), sharp.key.includes('b')).name;
    if (spellPc(sharp.key) !== sharp.fret) bad.push(`sharp key pc ${sharp.key}`);
    if (spellPc(flat.key) !== flat.fret) bad.push(`flat key pc ${flat.key}`);
    void sharpFretName;
  }
  const expectSharp = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const expectFlat = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  expectSharp.forEach((key, count) => {
    if (describeSignature('sharp', count).key !== key) bad.push(`sharp ${count} ${key}`);
  });
  expectFlat.forEach((key, count) => {
    if (describeSignature('flat', count).key !== key) bad.push(`flat ${count} ${key}`);
  });
  const melody = ['G', 'E', 'C', 'D', 'E', 'C', 'D', 'E', 'G', 'E', 'D', 'C', 'G', 'G', 'G', 'E', 'C', 'D', 'E', 'C', 'D', 'E', 'G', 'E', 'D', 'C'];
  const frets = [7, 4, 0, 2, 4, 0, 2, 4, 7, 4, 2, 0, 7, 7, 7, 4, 0, 2, 4, 0, 2, 4, 7, 4, 2, 0];
  frets.forEach((fret, index) => {
    const got = midiToName(stringMidi(2, fret)).name;
    if (got !== melody[index]) bad.push(`auld ${index} ${got}`);
  });
  if (bad.length) throw new Error(bad.join('\n'));
  return { lessons: LESSONS.length, claims: claims.length };
}
