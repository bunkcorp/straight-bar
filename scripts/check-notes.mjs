import {
  barCaption,
  describeNotes,
  dominantNinthName,
  soundingMidis,
  straightBar,
  stringMidi,
} from '../src/js/theory.js';
import { FORM, LESSONS, UPPER_LINE } from '../src/js/lessons.js';
import { SONGS, filterSongs } from '../src/js/songs-data.js';

const failures = [];

function check(label, ok, detail = '') {
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const ALL = [1, 2, 3, 4, 5, 6];
const sixths = [
  [0, 'C6'],
  [2, 'D6'],
  [4, 'E6'],
  [5, 'F6'],
  [7, 'G6'],
  [9, 'A6'],
  [10, 'Bb6'],
  [12, 'C6'],
];
for (const [fret, name] of sixths) {
  const bar = { ...straightBar(fret, ALL, []), ...(fret === 10 ? { flats: true } : {}) };
  const heard = describeNotes(soundingMidis(bar), Boolean(bar.flats));
  check(`sixth fret ${fret}`, heard === name, heard);
}

function top(fret) {
  return {
    fromString: 3,
    toString: 1,
    fromFret: fret,
    toFret: fret,
    picked: [1, 2, 3],
    muted: [4, 5, 6],
    flats: true,
  };
}

check('open minor', describeNotes(soundingMidis(top(0))) === 'A minor');
check('fret 5 minor', describeNotes(soundingMidis(top(5))) === 'D minor');
check('fret 7 minor', describeNotes(soundingMidis(top(7))) === 'E minor');
const pcs = (bar) => soundingMidis(bar).map((midi) => midi % 12).sort((a, b) => a - b).join();
check('notes fret 0', pcs(top(0)) === '0,4,9', pcs(top(0)));
check('notes fret 5', pcs(top(5)) === '2,5,9', pcs(top(5)));
check('notes fret 7', pcs(top(7)) === '4,7,11', pcs(top(7)));

const forward = LESSONS.find((lesson) => lesson.id === 'slants').steps[0].bar;
const reverse = LESSONS.find((lesson) => lesson.id === 'slants').steps[1].bar;
check('forward geometry', forward.toFret > forward.fromFret && forward.toString < forward.fromString);
check('reverse geometry', reverse.toFret < reverse.fromFret && reverse.toString < reverse.fromString);
check('forward name', describeNotes(soundingMidis(forward), true) === 'C minor', describeNotes(soundingMidis(forward), true));
check('reverse notes', describeNotes(soundingMidis(reverse), true) === 'D4  ·  Eb4  ·  F4', describeNotes(soundingMidis(reverse), true));
check('forward frets', [4, 3, 2].map((string) => {
  const t = (forward.fromString - string) / (forward.fromString - forward.toString);
  return forward.fromFret + (forward.toFret - forward.fromFret) * t;
}).join() === '5,6,7');

const dim = LESSONS.find((lesson) => lesson.id === 'diminished').steps[0].bar;
const dimMidis = soundingMidis(dim).sort((a, b) => a - b);
check('dim midis', dimMidis.join() === '59,62,65', dimMidis.join());
check('dim name', describeNotes(dimMidis) === 'B dim', describeNotes(dimMidis));
check('string 3 muted', dim.muted.includes(3) && !dim.picked.includes(3));

check('C9', dominantNinthName(top(10)) === 'C9');
check('G9', dominantNinthName(top(5)) === 'G9');
check('F9', dominantNinthName(top(3)) === 'F9');

const tones = {
  C: new Set([0, 4, 7, 9]),
  F: new Set([5, 9, 0, 2]),
  G: new Set([7, 11, 2, 4]),
};
for (const event of UPPER_LINE) {
  const pc = stringMidi(1, event.fret) % 12;
  const key = event.chord[0];
  check(`upper ${event.beat}`, tones[key].has(pc), `${event.chord} fret ${event.fret}`);
  check(`upper past or around`, event.fret <= 12);
}
check('upper reaches past 7', UPPER_LINE.some((event) => event.beat < 16 && event.fret > 7));
check('upper second half near 12', UPPER_LINE.filter((event) => event.beat >= 16).every((event) => event.fret >= 7));

for (const event of FORM) {
  if (event.chord === 'C6') check(`form C6 ${event.beat}`, event.bar.fromFret === 12 && event.bar.toFret === 12);
  if (event.chord === 'C9') check('form C9', dominantNinthName(event.bar) === 'C9');
  if (event.chord === 'F6') check(`form F6 ${event.beat}`, event.bar.fromFret === 5);
  if (event.chord === 'G6') check('form G6', event.bar.fromFret === 7);
  if (event.chord === 'G9') check(`form G9 ${event.beat}`, dominantNinthName(event.bar) === 'G9');
  if (event.chord === 'Fret 6') {
    check('walk unnamed', event.bar.passing === true);
    check('walk caption', barCaption(event.bar).includes('Eb4'), barCaption(event.bar));
  }
}

const alohaMidis = [60, 60, 59, 57, 60, 65, 57, 57, 57, 55, 60, 64, 60, 60, 59, 59, 59, 60, 62, 61, 62, 65, 64, 60, 59, 57, 60, 65, 57, 55, 55, 60, 60, 64, 60, 59, 60, 64, 62, 59, 60];
const aloha = SONGS.find((item) => item.id === 'aloha-oe');
check('aloha count', aloha.notes.length === alohaMidis.length, String(aloha.notes.length));
aloha.notes.forEach((item, index) => {
  const midi = stringMidi(item.string, item.fret);
  check(`aloha ${index}`, midi === alohaMidis[index] && item.fret >= 0 && item.fret <= 12, `${midi} fret ${item.fret}`);
});

const ninth = { C: new Set([0, 2, 4, 7, 10]), G: new Set([2, 4, 5, 7, 9, 11]) };
for (const song of SONGS) {
  for (const item of song.notes) {
    const midi = stringMidi(item.string, item.fret);
    check(`${song.id} fret`, item.fret >= 0 && item.fret <= 12 && item.string >= 1 && item.string <= 6);
    check(`${song.id} midi`, midi === [64, 60, 57, 55, 52, 48][item.string - 1] + item.fret);
  }
  if (song.id === 'trade-wind') {
    song.notes.forEach((item) => {
      const chord = song.chords.find((entry) => item.beat >= entry.beat && item.beat < entry.beat + entry.dur);
      check(`etude ${item.beat}`, chord && tones[chord.name].has(stringMidi(item.string, item.fret) % 12));
    });
  }
  if (song.id === 'one-four-five') {
    song.notes.forEach((item) => {
      const chord = song.chords.find((entry) => item.beat >= entry.beat && item.beat < entry.beat + entry.dur);
      const pc = stringMidi(item.string, item.fret) % 12;
      const passing = item.beat === 14 && item.string === 1 && item.fret === 6;
      const allowed = chord?.name === 'C' && item.beat >= 4 && item.beat < 8
        ? ninth.C
        : chord?.name === 'G' && item.beat >= 15
          ? ninth.G
          : tones[chord?.name];
      check(`form note ${item.beat}`, passing || allowed?.has(pc), `${chord?.name} ${pc}`);
    });
  }
}

check('search aloha', filterSongs('aloha').some((item) => item.title === "Aloha 'Oe"));
check('search empty', filterSongs('').length === SONGS.length);
const banned = ['cheatin', 'leilani', 'blue hawaii', 'tiny bubbles', 'pearly shells', 'pono'];
for (const song of SONGS) {
  const blob = `${song.title} ${song.credit}`.toLowerCase();
  check(`title ${song.title}`, banned.every((word) => !blob.includes(word)));
}
check('lesson count', LESSONS.length === 16, String(LESSONS.length));
check('no cheatin title', LESSONS.every((lesson) => !/cheatin/i.test(lesson.title)));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('ok', {
  lessons: LESSONS.map((lesson) => lesson.title),
  songs: SONGS.map((item) => item.title),
  alohaNotes: aloha.notes.length,
});
