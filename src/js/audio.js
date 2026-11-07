import { applyContextSink } from './devices.js';
import { chordFreqs, freqAt, midiToFreq } from './theory.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let drone = null;
  let running = false;
  let volume = 0.8;
  let tickHandle = 0;

  function ensure() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    void applyContextSink(ctx);
  }

  async function routeOutput() {
    if (!ctx) return;
    await applyContextSink(ctx);
  }

  function setVolume(value) {
    volume = value;
    if (master) master.gain.value = value;
  }

  function pluck(freq, time, duration = 1.5, gain = 0.15) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = 'triangle';
    overtone.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    overtone.frequency.setValueAtTime(freq * 2, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + duration);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(filter);
    overtone.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    osc.start(time);
    overtone.start(time);
    osc.stop(time + duration + 0.05);
    overtone.stop(time + duration + 0.05);
  }

  function wood(time, accent) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accent ? 1600 : 1100, time);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(accent ? 1700 : 1200, time);
    filter.Q.setValueAtTime(0.8, time);
    amp.gain.setValueAtTime(accent ? 0.09 : 0.045, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  function playChord(name, time, duration) {
    const freqs = chordFreqs(name);
    freqs.forEach((freq, index) => {
      pluck(freq, time, Math.min(duration, 2.4), index === 0 ? 0.11 : 0.045);
    });
  }

  function playNotes(freqs) {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const time = ctx.currentTime + 0.02;
    freqs.forEach((freq) => pluck(freq, time, 1.6, 0.16));
  }

  function playRoll(firstFreqs, secondFreqs) {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const time = ctx.currentTime + 0.05;
    firstFreqs.forEach((freq) => pluck(freq, time, 1.15, 0.14));
    secondFreqs.forEach((freq, index) => pluck(freq, time + 1.25, 1.8, index === 0 ? 0.12 : 0.05));
  }

  function playPairs(pairs, gap, onIndex) {
    stop();
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
    const start = ctx.currentTime + 0.06;
    pairs.forEach((freqs, index) => {
      const time = start + index * gap;
      freqs.forEach((freq) => pluck(freq, time, Math.max(0.28, Math.min(gap * 0.92, 1.5)), 0.13));
    });
    const endAt = start + pairs.length * gap;
    let lastIndex = -1;
    const tick = () => {
      if (!running || !ctx) return;
      const done = ctx.currentTime >= endAt;
      const index = done ? pairs.length : Math.max(0, Math.floor((ctx.currentTime - start) / gap));
      if (done || index !== lastIndex) {
        lastIndex = index;
        onIndex(index, done);
      }
      if (!done) tickHandle = requestAnimationFrame(tick);
      else running = false;
    };
    tickHandle = requestAnimationFrame(tick);
  }

  function playSequence(freqs, gap = 0.42) {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const time = ctx.currentTime + 0.04;
    freqs.forEach((freq, index) => pluck(freq, time + index * gap, 1.15, 0.15));
  }

  /** One note at a time, with a callback so the diagram can pulse the string. */
  function playFigure(freqs, gap, onIndex) {
    stop();
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
    const start = ctx.currentTime + 0.05;
    freqs.forEach((freq, index) => {
      if (freq == null) return;
      pluck(freq, start + index * gap, Math.max(0.35, gap * 0.92), 0.15);
    });
    const endAt = start + freqs.length * gap;
    let lastIndex = -1;
    const tick = () => {
      if (!running || !ctx) return;
      const done = ctx.currentTime >= endAt;
      const index = done ? freqs.length : Math.max(0, Math.floor((ctx.currentTime - start) / gap));
      if (done || index !== lastIndex) {
        lastIndex = index;
        onIndex?.(index, done);
      }
      if (!done) tickHandle = requestAnimationFrame(tick);
      else running = false;
    };
    tickHandle = requestAnimationFrame(tick);
  }

  /**
   * notes: { beat, dur, string, fret }
   * chords: { beat, name, dur }
   * onFrame(beatPosition, done) — negative during the count-in
   */
  function playChart({ bpm, notes, chords, guide, onFrame }) {
    stop();
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
    const beat = 60 / bpm;
    const countIn = 4;
    const start = ctx.currentTime + 0.08;
    const musicStart = start + countIn * beat;
    const totalBeats = Math.max(
      notes.reduce((max, item) => Math.max(max, item.beat + item.dur), 0),
      chords.reduce((max, item) => Math.max(max, item.beat + item.dur), 0),
    );

    for (let i = 0; i < countIn; i += 1) wood(start + i * beat, true);
    for (let i = 0; i < totalBeats; i += 1) wood(musicStart + i * beat, i % 4 === 0);

    for (const chord of chords) {
      playChord(chord.name, musicStart + chord.beat * beat, chord.dur * beat * 0.92);
    }
    if (guide) {
      for (const item of notes) {
        const time = musicStart + item.beat * beat;
        pluck(freqAt(item.string, item.fret), time, Math.min(item.dur * beat * 0.9, 1.6), 0.07);
      }
    }

    const endAt = musicStart + totalBeats * beat;
    const tick = () => {
      if (!running || !ctx) return;
      const beatPos = (ctx.currentTime - musicStart) / beat;
      const done = ctx.currentTime >= endAt;
      onFrame(beatPos, done);
      if (!done) tickHandle = requestAnimationFrame(tick);
      else running = false;
    };
    tickHandle = requestAnimationFrame(tick);
  }

  function startDrone(freq) {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    stopDrone();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    amp.gain.value = 0.045;
    osc.connect(amp);
    amp.connect(master);
    osc.start();
    drone = { osc, amp };
  }

  function stopDrone() {
    if (!drone) return;
    try {
      drone.osc.stop();
    } catch {
      /* already stopped */
    }
    drone = null;
  }

  function stop() {
    running = false;
    cancelAnimationFrame(tickHandle);
    stopDrone();
    if (!ctx) return;
    const now = ctx.currentTime;
    ctx.close();
    ctx = null;
    master = null;
    void now;
  }

  /**
   * events: { beat, dur, fret, chord? } melody on string 1
   * chords: { beat, name, dur }
   * onTick(beatPosition, done) — beatPosition is negative during the count-in
   */
  function playTimeline({ bpm, events, chords, guide, onTick }) {
    stop();
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    running = true;
    const beat = 60 / bpm;
    const countIn = 4;
    const start = ctx.currentTime + 0.08;
    const musicStart = start + countIn * beat;
    const totalBeats = events.reduce((max, event) => Math.max(max, event.beat + event.dur), 0);

    for (let i = 0; i < countIn; i += 1) wood(start + i * beat, true);
    for (let i = 0; i < totalBeats; i += 1) wood(musicStart + i * beat, i % 4 === 0);

    for (const chord of chords) {
      playChord(chord.name, musicStart + chord.beat * beat, chord.dur * beat * 0.92);
    }
    if (guide) {
      for (const event of events) {
        const time = musicStart + event.beat * beat;
        const dur = Math.min(event.dur * beat * 0.9, 1.7);
        if (event.midis?.length) {
          event.midis.forEach((midi) => pluck(midiToFreq(midi), time, dur, 0.07));
          continue;
        }
        if (event.tones?.length) {
          event.tones.forEach((tone) => pluck(freqAt(tone.string, tone.fret), time, dur, 0.07));
          continue;
        }
        const fret = event.guideFret ?? event.fret;
        if (fret == null) continue;
        pluck(freqAt(event.string || 1, fret), time, dur, 0.07);
      }
    }

    const endAt = musicStart + totalBeats * beat;

    const tick = () => {
      if (!running || !ctx) return;
      const beatPos = (ctx.currentTime - musicStart) / beat;
      const done = ctx.currentTime >= endAt;
      onTick(beatPos, done);
      if (!done) tickHandle = requestAnimationFrame(tick);
      else running = false;
    };
    tickHandle = requestAnimationFrame(tick);
  }

  return {
    ensure,
    routeOutput,
    setVolume,
    playNotes,
    playRoll,
    playSequence,
    playFigure,
    playPairs,
    playTimeline,
    playChart,
    startDrone,
    stopDrone,
    stop,
    get running() {
      return running;
    },
  };
}
