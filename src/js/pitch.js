import { applyContextSink, micConstraints } from './devices.js';

/**
 * YIN pitch detector. Returns null when the buffer is quiet or unclear.
 * Low D2 is about 73 Hz, so the window has to be long enough to hold several periods.
 */
export function detectPitch(buf, sampleRate) {
  const step = 2;
  const n = Math.floor(buf.length / step);
  const samples = new Float32Array(n);
  let rms = 0;
  for (let i = 0; i < n; i += 1) {
    const value = buf[i * step];
    samples[i] = value;
    rms += value * value;
  }
  rms = Math.sqrt(rms / n);
  sampleRate /= step;
  if (rms < 0.012) return null;
  buf = samples;

  const minLag = Math.floor(sampleRate / 900);
  const maxLag = Math.min(n - 2, Math.floor(sampleRate / 65));
  const yin = new Float32Array(maxLag + 1);
  let running = 0;

  for (let tau = 1; tau <= maxLag; tau += 1) {
    let sum = 0;
    for (let i = 0; i < n - tau; i += 1) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    running += sum;
    yin[tau] = running === 0 ? 1 : (sum * tau) / running;
  }

  const threshold = 0.18;
  let tauEstimate = -1;
  for (let tau = minLag; tau <= maxLag; tau += 1) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= maxLag && yin[tau + 1] < yin[tau]) tau += 1;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate < 1) return null;

  const x0 = yin[tauEstimate - 1];
  const x1 = yin[tauEstimate];
  const x2 = yin[tauEstimate + 1] ?? yin[tauEstimate];
  const denom = 2 * x1 - x2 - x0;
  const shift = denom === 0 ? 0 : (x2 - x0) / (2 * denom);
  const freq = sampleRate / (tauEstimate + shift);
  if (freq < 65 || freq > 900 || x1 > threshold) return null;
  return { freq, rms, clarity: 1 - x1 };
}

const MONITOR_GAIN = 0.7;
const ANALYSER_MS = 50;

/** Force stereo speaker layout so mono does not stay locked to the left ear. */
function forceStereoOut(node) {
  try {
    node.channelCount = 2;
    node.channelCountMode = 'explicit';
    node.channelInterpretation = 'speakers';
  } catch {
    /* destination / some nodes reject channelCount changes */
  }
}

function readableLatency(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function createPitch(onFrame) {
  let stream = null;
  let ctx = null;
  let source = null;
  let analyser = null;
  let monitorGain = null;
  let monitorSplitter = null;
  let monitorMerger = null;
  let raf = 0;
  let lastAnalyse = 0;
  let buf = null;
  let on = false;
  let monitorWanted = false;
  let monitorLive = false;

  function disconnectMonitor() {
    if (!source || !monitorGain) {
      monitorLive = false;
      return;
    }
    try {
      source.disconnect(monitorGain);
    } catch {
      /* not connected */
    }
    try {
      monitorGain.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      if (monitorSplitter) monitorSplitter.disconnect();
    } catch {
      /* already disconnected */
    }
    try {
      if (monitorMerger) monitorMerger.disconnect();
    } catch {
      /* already disconnected */
    }
    monitorLive = false;
  }

  function connectMonitor() {
    if (!source || !monitorGain || !monitorSplitter || !monitorMerger || !ctx || monitorLive) {
      return;
    }
    monitorGain.gain.value = MONITOR_GAIN;
    // Scarlett Solo often exposes 1ch true mono OR 2ch with signal only on
    // channel 0. Split, take ch0 only, then merge that same mono into L and R
    // so both ears hear it (also covers silent-right stereo streams).
    // Direct graph only — no ScriptProcessor / worklets on this path.
    // Graph: source → gain → splitter(ch0) → merger L+R → destination (sinkId).
    source.connect(monitorGain);
    monitorGain.connect(monitorSplitter);
    monitorSplitter.connect(monitorMerger, 0, 0);
    monitorSplitter.connect(monitorMerger, 0, 1);
    monitorMerger.connect(ctx.destination);
    monitorLive = true;
  }

  function syncMonitor(forceOff = false) {
    const should = !forceOff && monitorWanted;
    if (should) connectMonitor();
    else disconnectMonitor();
  }

  async function start(deviceId, { monitor = false } = {}) {
    if (on) return;
    monitorWanted = Boolean(monitor);
    stream = await navigator.mediaDevices.getUserMedia(micConstraints(deviceId));
    ctx = new AudioContext({ latencyHint: 'interactive' });
    forceStereoOut(ctx.destination);
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    monitorGain = ctx.createGain();
    forceStereoOut(monitorGain);
    monitorGain.gain.value = MONITOR_GAIN;
    monitorSplitter = ctx.createChannelSplitter(2);
    monitorMerger = ctx.createChannelMerger(2);
    buf = new Float32Array(analyser.fftSize);
    // Out picker uses AudioContext.setSinkId; monitor still ends at ctx.destination.
    await applyContextSink(ctx);
    if (ctx.state === 'suspended') await ctx.resume();
    syncMonitor();
    on = true;
    lastAnalyse = 0;
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!on) return;
    raf = requestAnimationFrame(tick);
    if (now - lastAnalyse < ANALYSER_MS) return;
    lastAnalyse = now;
    analyser.getFloatTimeDomainData(buf);
    onFrame(detectPitch(buf, ctx.sampleRate));
  }

  function setMonitor(enabled) {
    monitorWanted = Boolean(enabled);
    if (!on) return;
    syncMonitor();
  }

  async function routeOutput() {
    if (!ctx) return;
    await applyContextSink(ctx);
  }

  function latencyInfo() {
    if (!ctx) return null;
    const base = ctx.baseLatency;
    const output = ctx.outputLatency;
    const hasBase = readableLatency(base);
    const hasOutput = readableLatency(output);
    if (!hasBase && !hasOutput) return null;
    return {
      baseMs: hasBase ? base * 1000 : null,
      outputMs: hasOutput ? output * 1000 : null,
      totalMs: (hasBase ? base : 0) * 1000 + (hasOutput ? output : 0) * 1000,
    };
  }

  function stop() {
    on = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    disconnectMonitor();
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (ctx) ctx.close();
    stream = null;
    ctx = null;
    source = null;
    analyser = null;
    monitorGain = null;
    monitorSplitter = null;
    monitorMerger = null;
    onFrame(null);
  }

  return {
    start,
    stop,
    setMonitor,
    routeOutput,
    latencyInfo,
    get on() {
      return on;
    },
    get monitoring() {
      return monitorLive;
    },
  };
}
