const fs = require('fs');
const path = require('path');

const DOWNLOADS = '/Users/kevinwoods/Downloads';

const LESSON_SHEETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25, 26, 28, 30, 31, 32, 34, 35, 36, 37, 40, 41, 42, 43, 44, 45, 46];
const LESSON_RECORDINGS = [26, 22, 21, 20, 19, 18, 17, 15, 14, 13, 12, 11, 10, 9, 8, 4, 3, 44, 43, 41, 7, 6, 5, 40, 1, 36, 37, 46, 55, 50, 51, 52, 53, 56, 57];

const GROUP_ORDER = ['Primers', 'Song charts', 'Lesson sheets', 'Lesson recordings'];

const CANDIDATES = [
  ...[
    'tablature_key-2.pdf',
    'string_gauge_chart.pdf',
    'diatonic_harmony_primer.pdf',
    'music_theory_quickstart.pdf',
    'chord_study_2.pdf',
    'chord_study_1.pdf',
    'tablature_key.pdf',
  ].map((name) => ({ group: 'Primers', name })),
  ...[
    'bubbles_in_my_beer-page1.pdf',
    'coconut_grove-page1.pdf',
    'Now Is The Hour',
    'Port of Paradise.pdf',
    "Aloha 'Oe.pdf",
    'Maui Moon.pdf',
    'Hawaiis Charm',
    'On A Tropic Night',
    'Lovelight In The Starlight',
    'Carefree',
    'Hello Hawaii, How Are You',
    'Hawaiian Cocktail - C6 Lap Steel Guitar.pdf',
    'bb_81_songs',
    'A Million Moons Over Hawaii.MGU',
    'No Teardrops Tonight Lap.pdf',
    'Texas Playboy Rag Lap.pdf',
    'Kansas City Blues.pdf',
  ].map((name) => ({ group: 'Song charts', name })),
  ...['L10-2.pdf', ...LESSON_SHEETS.map((number) => `L${number}.pdf`)].map((name) => ({ group: 'Lesson sheets', name })),
  ...[
    ...LESSON_RECORDINGS.map((number) => `L${number}.wma`),
    'Kansas City Track.wma',
    'Kansas City Blues.wma',
    'No Teardrops Tonight Lap.wma',
    'No Teardrops Tonight Lap Track.wma',
    'Texas Playboy Rag Lap Steel.wma',
    'Texas Playboy Rag Lap Track.wma',
    'Egg Blues.wma',
    'Egg Blues Track.wma',
    'Bouquet Of Roses Track.wma',
    'Panhandle Rag Lap Steel Track.wma',
    'It Is No Secret Track.wma',
  ].map((name) => ({ group: 'Lesson recordings', name })),
];

function statSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function insideDownloads(filePath) {
  try {
    const real = fs.realpathSync(filePath);
    const root = fs.realpathSync(DOWNLOADS);
    if (real === root || real.startsWith(`${root}${path.sep}`)) return real;
  } catch {
    return null;
  }
  return null;
}

function addFile(entries, seen, group, name, filePath) {
  const real = insideDownloads(filePath);
  const stat = statSafe(filePath);
  if (!real || !stat?.isFile() || seen.has(real)) return;
  seen.add(real);
  entries.push({ group, name, path: real });
}

function scanLibrary() {
  const entries = [];
  const seen = new Set();
  let missing = 0;

  CANDIDATES.forEach((candidate) => {
    const full = path.join(DOWNLOADS, candidate.name);
    const stat = statSafe(full);
    if (!stat || !insideDownloads(full)) {
      missing += 1;
      return;
    }
    if (stat.isDirectory()) {
      const real = insideDownloads(full);
      let names = [];
      try {
        names = fs.readdirSync(real, { withFileTypes: true });
      } catch {
        missing += 1;
        return;
      }
      names.forEach((dirent) => {
        if (!dirent.name || dirent.name.startsWith('.')) return;
        addFile(entries, seen, candidate.group, dirent.name, path.join(real, dirent.name));
      });
      return;
    }
    addFile(entries, seen, candidate.group, candidate.name, full);
  });

  entries.sort((a, b) => {
    const group = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    if (group) return group;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { entries, missing, candidates: CANDIDATES.length };
}

function isLibraryPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false;
  return scanLibrary().entries.some((item) => item.path === filePath);
}

module.exports = { scanLibrary, isLibraryPath };
