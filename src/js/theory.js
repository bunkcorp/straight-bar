export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** C6 lap steel, low string to high string: C3 E3 G3 A3 C4 E4.
 *  On the lap, string 6 is nearest you and string 1 is the far edge. */
export const STRINGS = [
  { string: 6, midi: 48, side: 'near' },
  { string: 5, midi: 52, side: 'near' },
  { string: 4, midi: 55, side: 'near' },
  { string: 3, midi: 57, side: 'far' },
  { string: 2, midi: 60, side: 'far' },
  { string: 1, midi: 64, side: 'far' },
];

const QUALITIES = [
  ['major', [0, 4, 7]],
  ['minor', [0, 3, 7]],
  ['dim', [0, 3, 6]],
  ['6', [0, 4, 7, 9]],
  ['7', [0, 4, 7, 10]],
  ['maj7', [0, 4, 7, 11]],
  ['min7', [0, 3, 7, 10]],
];

/** Roots that read more clearly with a flat than a sharp. */
const FLAT_ROOTS = new Set([1, 3, 6, 8, 10]);

/** Straight-bar C6, F6, and G6, low to high through the bottom four strings. */
export const CHORD_PITCHES = {
  C: [48, 52, 55, 57],
  F: [53, 57, 60, 62],
  G: [55, 59, 62, 64],
};

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToName(midi, flats = false) {
  const rounded = Math.round(midi);
  const names = flats ? FLAT_NAMES : NOTE_NAMES;
  const name = names[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { name, octave, label: `${name}${octave}` };
}

export function stringMidi(stringNumber, fret) {
  const open = STRINGS.find((s) => s.string === stringNumber);
  return open.midi + fret;
}

export function freqAt(stringNumber, fret) {
  return midiToFreq(stringMidi(stringNumber, fret));
}

export function centsBetween(freq, target) {
  if (!freq || !target) return null;
  return 1200 * Math.log2(freq / target);
}

/** Prefer lock-in within this many cents when any such candidate exists. */
const LIVE_LOCK_CENTS = 25;
/** Open-string preference only applies inside this window. */
const LIVE_OPEN_CENTS = 15;

/**
 * Map a detected frequency to the nearest C6 string (open or fretted 0–12).
 *
 * Ranking (after dropping weak matches when a tighter one exists):
 * 1. Bar fret (straight or slant) when a diagram bar is present
 * 2. Same string as the recent live note (continuity vs unison jumps)
 * 3. Open string within ~15¢ over a distant fretted unison
 * 4. Octave nearest the last heard MIDI
 * 5. Lower absolute cents
 * 6. Fret closer to the bar / last fretted note
 * 7. Higher string (lower string number) for melody range — last resort
 *
 * @param {number} freq
 * @param {{
 *   picked?: number[],
 *   maxCents?: number,
 *   lockCents?: number,
 *   bar?: object|null,
 *   preferString?: number|null,
 *   lastMidi?: number|null,
 *   lastFret?: number|null,
 * }} [options]
 * @returns {{ string: number, fret: number, cents: number, midi: number }|null}
 */
export function matchLiveString(freq, options = {}) {
  if (!freq) return null;
  const maxCents = options.maxCents ?? 35;
  const lockCents = options.lockCents ?? LIVE_LOCK_CENTS;
  const picked = new Set(options.picked || []);
  const bar = options.bar;
  const preferString = options.preferString ?? null;
  const lastMidi = options.lastMidi ?? null;
  const lastFret = options.lastFret ?? null;
  const candidates = [];

  // Always search frets 0–12 on every string. Mute marks on the diagram
  // are visual only — they must never exclude a frequency match.
  for (const open of STRINGS) {
    const stringNumber = open.string;
    for (let fret = 0; fret <= 12; fret += 1) {
      const midi = open.midi + fret;
      const cents = Math.abs(centsBetween(freq, midiToFreq(midi)));
      if (cents > maxCents) continue;
      const barFret = bar ? fretOnString(bar, stringNumber) : null;
      const atBar = barFret != null && Math.abs(barFret - fret) < 0.35;
      const anchorFret = barFret != null
        ? barFret
        : (lastFret != null ? lastFret : fret);
      candidates.push({
        string: stringNumber,
        fret,
        cents,
        midi,
        open: fret === 0,
        atBar,
        goodOpen: fret === 0 && cents <= LIVE_OPEN_CENTS,
        sameString: preferString != null && stringNumber === preferString,
        octaveDist: lastMidi == null ? 0 : Math.abs(midi - lastMidi),
        fretDist: Math.abs(fret - anchorFret),
        picked: picked.has(stringNumber),
      });
    }
  }

  if (!candidates.length) return null;

  // Don't accept a 35¢ weak match when something within lockCents exists.
  const locked = candidates.filter((c) => c.cents <= lockCents);
  const pool = locked.length ? locked : candidates;

  pool.sort((a, b) => {
    // Lap steel: when the pitch fits the bar, stay on the bar.
    if (a.atBar !== b.atBar) return a.atBar ? -1 : 1;
    // Stick with the string that was just live (beats open-unison jumps).
    if (a.sameString !== b.sameString) return a.sameString ? -1 : 1;
    // Open within ~15¢ beats a distant fretted unison (not at the bar).
    if (a.goodOpen !== b.goodOpen) return a.goodOpen ? -1 : 1;
    // Prefer the octave nearest the last heard pitch this session.
    if (a.octaveDist !== b.octaveDist) return a.octaveDist - b.octaveDist;
    // Tightest cents win.
    if (a.cents !== b.cents) return a.cents - b.cents;
    // Then fret nearer the bar / last fretted note.
    if (a.fretDist !== b.fretDist) return a.fretDist - b.fretDist;
    // Diagram-picked strings before muted ones when still tied.
    if (a.picked !== b.picked) return a.picked ? -1 : 1;
    // Melody range: higher string (lower string number) last.
    return a.string - b.string;
  });

  const best = pool[0];
  return { string: best.string, fret: best.fret, cents: best.cents, midi: best.midi };
}

export function nearestChromatic(freq) {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const ref = midiToFreq(midi);
  return {
    midi,
    ...midiToName(midi),
    cents: centsBetween(freq, ref),
    freq: ref,
  };
}

export function straightBar(fret, picked, muted = []) {
  return {
    fromString: 6,
    toString: 1,
    fromFret: fret,
    toFret: fret,
    picked,
    muted,
  };
}

export function openStrings(picked, muted = []) {
  return {
    open: true,
    fromString: null,
    toString: null,
    fromFret: 0,
    toFret: 0,
    picked,
    muted,
  };
}

export function fretOnString(bar, stringNumber) {
  if (!bar || bar.open || bar.fromString == null) return 0;
  const a = bar.fromString;
  const b = bar.toString;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (stringNumber < lo || stringNumber > hi) return null;
  if (a === b) return bar.fromFret;
  const t = (a - stringNumber) / (a - b);
  return bar.fromFret + (bar.toFret - bar.fromFret) * t;
}

export function soundingMidis(bar) {
  if (!bar) return [];
  const midis = [];
  for (const stringNumber of bar.picked || []) {
    const fret = fretOnString(bar, stringNumber);
    if (fret == null) continue;
    midis.push(stringMidi(stringNumber, fret));
  }
  return midis;
}

function chordLabel(root, quality) {
  const name = FLAT_ROOTS.has(root) ? FLAT_NAMES[root] : NOTE_NAMES[root];
  if (quality === 'major') return `${name} major`;
  if (quality === 'minor') return `${name} minor`;
  if (quality === 'dim') return `${name} dim`;
  if (quality === '6') return `${name}6`;
  if (quality === '7') return `${name}7`;
  if (quality === 'maj7') return `${name}maj7`;
  if (quality === 'min7') return `${name}min7`;
  return null;
}

function matchChord(pitchClasses) {
  const matches = [];
  for (let root = 0; root < 12; root += 1) {
    for (const [quality, intervals] of QUALITIES) {
      const chord = intervals.map((interval) => (root + interval) % 12);
      const exact = pitchClasses.length === chord.length
        && pitchClasses.every((pc) => chord.includes(pc));
      if (!exact) continue;
      const label = chordLabel(root, quality);
      if (label) matches.push({ quality, label });
    }
  }
  // C6 uses the same four notes as Amin7. On a straight bar the chord is the sixth.
  const sixth = matches.find((match) => match.quality === '6');
  if (sixth) return sixth.label;
  return matches[0]?.label ?? null;
}

export function describeNotes(midis, flats = false) {
  const sounding = [...midis].sort((a, b) => a - b);
  if (!sounding.length) return 'Nothing sounding';
  if (sounding.length === 1) return midiToName(sounding[0], flats).label;
  const pitchClasses = [...new Set(sounding.map((midi) => ((midi % 12) + 12) % 12))];
  if (pitchClasses.length >= 3) {
    const named = matchChord(pitchClasses);
    if (named) return named;
  }
  return sounding.map((midi) => midiToName(midi, flats).label).join('  ·  ');
}

export function formatFret(fret) {
  if (Math.abs(fret - Math.round(fret)) < 0.05) return String(Math.round(fret));
  return fret.toFixed(1);
}

/** Strings 1–3, two frets under a straight sixth, are the 5, b7, and 9 of that chord. */
export function dominantNinthName(bar) {
  if (!bar || bar.open || bar.fromString == null) return null;
  if (Math.abs(bar.fromFret - bar.toFret) > 0.05) return null;
  const lo = Math.min(bar.fromString, bar.toString);
  const hi = Math.max(bar.fromString, bar.toString);
  if (lo !== 1 || hi !== 3) return null;
  const picked = [...(bar.picked || [])].sort((a, b) => a - b);
  if (picked.join(',') !== '1,2,3') return null;
  const rootFret = Math.round(bar.fromFret) + 2;
  if (rootFret < 0 || rootFret > 12) return null;
  return `${midiToName(stringMidi(6, rootFret)).name}9`;
}

export function barCaption(bar) {
  if (bar?.passing) {
    const names = soundingMidis(bar).map((midi) => midiToName(midi, true).label).join('  ·  ');
    const straight = Math.abs(bar.fromFret - bar.toFret) < 0.05;
    const where = straight ? `Fret ${formatFret(bar.fromFret)}  ·  straight bar` : 'Passing';
    return `${where}  ·  ${names}`;
  }
  const notes = dominantNinthName(bar) || describeNotes(soundingMidis(bar), Boolean(bar?.flats));
  if (!bar || bar.open || bar.fromString == null) return `Open strings  ·  ${notes}`;
  const straight = Math.abs(bar.fromFret - bar.toFret) < 0.05;
  if (bar.fromString === bar.toString) {
    return `String ${bar.fromString}  ·  fret ${formatFret(bar.fromFret)}  ·  ${notes}`;
  }
  if (straight) return `Fret ${formatFret(bar.fromFret)}  ·  straight bar  ·  ${notes}`;
  const forward = bar.toFret > bar.fromFret;
  const slant = forward ? 'forward slant' : 'reverse slant';
  return `Frets ${formatFret(bar.fromFret)}–${formatFret(bar.toFret)}  ·  ${slant}  ·  ${notes}`;
}

export function chordFreqs(name) {
  return CHORD_PITCHES[name].map(midiToFreq);
}
