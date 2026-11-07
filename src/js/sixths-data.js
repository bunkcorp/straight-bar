/**
 * C6 sixths exercise. Tuning and steps live here so another tuning can be
 * added as another entry in `exercises` without touching the fretboard drawing.
 */
export const tuning = [
  { string: 1, note: 'E', midi: 64 },
  { string: 2, note: 'C', midi: 60 },
  { string: 3, note: 'A', midi: 57 },
  { string: 4, note: 'G', midi: 55 },
  { string: 5, note: 'E', midi: 52 },
  { string: 6, note: 'C', midi: 48 },
];

export const scaleSteps = [
  { note: 'C', fret: 0, strings: [5, 2], interval: 'Minor 6th' },
  { note: 'D', fret: 5, strings: [6, 3], interval: 'Major 6th' },
  { note: 'E', fret: 7, strings: [6, 3], interval: 'Major 6th' },
  { note: 'F', fret: 5, strings: [5, 2], interval: 'Minor 6th' },
  { note: 'G', fret: 7, strings: [5, 2], interval: 'Minor 6th' },
  { note: 'A', fret: 5, strings: [4, 1], interval: 'Major 6th' },
  { note: 'B', fret: 7, strings: [4, 1], interval: 'Major 6th' },
  { note: 'C', fret: 12, strings: [5, 2], interval: 'Minor 6th' },
];

export const exercises = [
  { id: 'c6-sixths', label: 'C6 sixths', tuning, scaleSteps },
];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getMidiNote(stringNumber, fret) {
  const open = tuning.find((item) => item.string === stringNumber);
  return open.midi + fret;
}

export function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function noteName(midi) {
  const rounded = Math.round(midi);
  const name = NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave, label: `${name}${octave}` };
}

export function intervalBetween(lowMidi, highMidi) {
  const semi = (Math.round(highMidi) - Math.round(lowMidi) + 120) % 12;
  if (semi === 8) return 'Minor 6th';
  if (semi === 9) return 'Major 6th';
  return null;
}

/** The first string in the pair is the bassier one, played with the thumb. */
export function stepNotes(step) {
  const [bassString, trebleString] = step.strings;
  const bassMidi = getMidiNote(bassString, step.fret);
  const trebleMidi = getMidiNote(trebleString, step.fret);
  return {
    bassString,
    trebleString,
    bass: { ...noteName(bassMidi), midi: bassMidi, freq: frequency(bassMidi) },
    treble: { ...noteName(trebleMidi), midi: trebleMidi, freq: frequency(trebleMidi) },
  };
}

/** Straight bar: the root is the low string, raised by the fret. */
export function sixthChordName(fret) {
  const root = noteName(getMidiNote(6, fret)).name;
  return `${root}6`;
}

export function chordFrequencies(fret) {
  return tuning.map((item) => frequency(getMidiNote(item.string, fret)));
}
