/**
 * Audio input/output device picking for Listen and optional song playback.
 * Input uses getUserMedia deviceId. Output uses setSinkId when Chromium exposes it.
 */

const INPUT_KEY = 'straight-bar-audio-input';
const OUTPUT_KEY = 'straight-bar-audio-output';
const MONITOR_KEY = 'straight-bar-audio-monitor';
const LOW_LATENCY_KEY = 'straight-bar-audio-low-latency';
const SYSTEM_DEFAULT = '__default__';

let inputs = [];
let outputs = [];
let inputPref = localStorage.getItem(INPUT_KEY); // null | SYSTEM_DEFAULT | deviceId
let outputPref = localStorage.getItem(OUTPUT_KEY);
let monitorPref = localStorage.getItem(MONITOR_KEY) === '1';
let lowLatencyPref = localStorage.getItem(LOW_LATENCY_KEY) === '1';

export function supportsOutputSink() {
  return typeof HTMLMediaElement !== 'undefined'
    && typeof HTMLMediaElement.prototype.setSinkId === 'function';
}

export function supportsContextSink() {
  return typeof AudioContext !== 'undefined'
    && typeof AudioContext.prototype.setSinkId === 'function';
}

export function canRouteOutput() {
  return supportsOutputSink() || supportsContextSink();
}

export function getInputs() {
  return inputs;
}

export function getOutputs() {
  return outputs;
}

function isFocusrite(label) {
  const text = (label || '').toLowerCase();
  return text.includes('focusrite') || text.includes('scarlett');
}

function looksLikeBluetooth(label) {
  const text = (label || '').toLowerCase();
  return /airpods|bluetooth|\bbt\b|beats|galaxy buds|pixel buds|sony wh-|bose qc|wireless/.test(text);
}

function looksLikeAirPods(label) {
  return /airpods/i.test(label || '');
}

export function shortDeviceName(label) {
  if (!label) return 'Default';
  const trimmed = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return trimmed || label;
}

function stillPresent(list, id) {
  return Boolean(id && list.some((device) => device.deviceId === id));
}

function focusriteOutput() {
  return outputs.find((device) => isFocusrite(device.label)) || null;
}

function currentOutputLabel() {
  const id = resolveOutputId();
  if (!id) return '';
  return outputs.find((device) => device.deviceId === id)?.label || '';
}

function outputIsExplicitBluetooth() {
  if (outputPref == null || outputPref === SYSTEM_DEFAULT) return false;
  const match = outputs.find((device) => device.deviceId === outputPref);
  return Boolean(match && looksLikeBluetooth(match.label));
}

/** Resolved deviceId for getUserMedia, or '' for system default. */
export function resolveInputId() {
  if (inputPref === SYSTEM_DEFAULT) return '';
  if (stillPresent(inputs, inputPref)) return inputPref;
  if (inputPref == null) {
    const focus = inputs.find((device) => isFocusrite(device.label));
    return focus?.deviceId || '';
  }
  return '';
}

export function resolveOutputId() {
  if (!canRouteOutput()) return '';
  if (outputPref === SYSTEM_DEFAULT) return '';
  if (stillPresent(outputs, outputPref)) return outputPref;
  if (outputPref == null) {
    const focus = outputs.find((device) => isFocusrite(device.label));
    return focus?.deviceId || '';
  }
  return '';
}

export function getInputDeviceId() {
  return resolveInputId();
}

export function getOutputDeviceId() {
  return resolveOutputId();
}

export function inputStatusText() {
  const id = resolveInputId();
  if (!id) return 'Input: Default';
  const match = inputs.find((device) => device.deviceId === id);
  if (!match) return 'Input: Default';
  return `Input: ${shortDeviceName(match.label)}`;
}

export function setInputDeviceId(id) {
  inputPref = id ? id : SYSTEM_DEFAULT;
  localStorage.setItem(INPUT_KEY, inputPref);
}

export function setOutputDeviceId(id) {
  outputPref = id ? id : SYSTEM_DEFAULT;
  localStorage.setItem(OUTPUT_KEY, outputPref);
}

export function isMonitorEnabled() {
  return monitorPref;
}

export function setMonitorEnabled(on) {
  monitorPref = Boolean(on);
  localStorage.setItem(MONITOR_KEY, monitorPref ? '1' : '0');
}

export function isLowLatencyEnabled() {
  return lowLatencyPref;
}

/**
 * Low-latency mode: route Out to Scarlett when available and remind the user
 * to use hardware Direct Monitor (true near-zero latency).
 * Returns true if Out was changed to Scarlett.
 */
export function setLowLatencyEnabled(on) {
  lowLatencyPref = Boolean(on);
  localStorage.setItem(LOW_LATENCY_KEY, lowLatencyPref ? '1' : '0');
  if (!lowLatencyPref) return false;
  const focus = focusriteOutput();
  if (!focus) return false;
  if (resolveOutputId() === focus.deviceId) return false;
  setOutputDeviceId(focus.deviceId);
  return true;
}

/**
 * When Monitor turns on, prefer Scarlett Out if the user has not explicitly
 * chosen AirPods/Bluetooth. Never force over an explicit BT pick.
 */
export function preferScarlettForMonitor() {
  if (!monitorPref && !lowLatencyPref) return false;
  const focus = focusriteOutput();
  if (!focus) return false;
  if (resolveOutputId() === focus.deviceId) return false;
  if (outputIsExplicitBluetooth() && !lowLatencyPref) return false;
  if (outputPref != null && outputPref !== SYSTEM_DEFAULT && !lowLatencyPref) {
    const current = outputs.find((device) => device.deviceId === outputPref);
    if (current && !isFocusrite(current.label)) return false;
  }
  setOutputDeviceId(focus.deviceId);
  return true;
}

function looksLikeBuiltInMic(label) {
  const text = (label || '').toLowerCase();
  if (isFocusrite(label)) return false;
  return /macbook|built-?in microphone|internal microphone|mac.*microphone/.test(text);
}

function looksLikeLaptopSpeakers(label) {
  const text = (label || '').toLowerCase();
  if (isFocusrite(label)) return false;
  if (/headphone|headset|earphone/.test(text)) return false;
  return /macbook|built-?in.*speaker|internal speaker|\bspeakers\b/.test(text);
}

/**
 * MacBook mic → laptop speakers will howl. Scarlett in (pickup) is fine even to speakers;
 * Scarlett in → Scarlett out is the normal interface path.
 */
export function isMonitorFeedbackRisk() {
  const inId = resolveInputId();
  const outId = resolveOutputId();
  const inLabel = inputs.find((device) => device.deviceId === inId)?.label || '';
  const outLabel = outputs.find((device) => device.deviceId === outId)?.label || '';

  if (isFocusrite(inLabel)) return false;
  if (outId && isFocusrite(outLabel)) return false;
  if (outId && outLabel && !looksLikeLaptopSpeakers(outLabel)) return false;

  const micRisk = !inId || looksLikeBuiltInMic(inLabel);
  const speakerRisk = !outId || looksLikeLaptopSpeakers(outLabel);
  return micRisk && speakerRisk;
}

/** True when Monitor preference is on and the current Mic/Out path is safe to hear. */
export function shouldMonitorLive() {
  return monitorPref && !isMonitorFeedbackRisk();
}

export function monitorTipText() {
  if (isMonitorFeedbackRisk()) {
    return 'Monitor muted to avoid feedback (MacBook mic → laptop speakers). Use Scarlett in/out or headphones.';
  }

  if (lowLatencyPref) {
    const hasScarlett = Boolean(focusriteOutput());
    if (hasScarlett) {
      return 'Low latency: Out → Scarlett. Plug headphones into the Scarlett, enable Direct Monitor in Focusrite Control. If you use Direct Monitor, turn app Monitor off.';
    }
    return 'Low latency: connect a Scarlett, plug headphones into it, and enable Direct Monitor in Focusrite Control. AirPods cannot be instant.';
  }

  const outLabel = currentOutputLabel();
  if (looksLikeAirPods(outLabel) || looksLikeBluetooth(outLabel)) {
    return 'For instant sound, plug headphones into the Scarlett and turn on Direct Monitor in Focusrite Control. AirPods always add Bluetooth delay.';
  }

  return 'For instant sound, plug headphones into the Scarlett and turn on Direct Monitor in Focusrite Control. AirPods always add Bluetooth delay. If you use Direct Monitor, turn app Monitor off.';
}

export function latencyTipText(info) {
  if (!info) return '';
  const parts = [];
  if (info.baseMs != null) parts.push(`base ${Math.round(info.baseMs)}ms`);
  if (info.outputMs != null) parts.push(`out ${Math.round(info.outputMs)}ms`);
  if (!parts.length) return '';
  const total = info.totalMs != null ? Math.round(info.totalMs) : null;
  return total != null
    ? `Web Audio ~${total}ms (${parts.join(' + ')}) — Bluetooth adds more`
    : `Web Audio ${parts.join(', ')}`;
}

/** Remember Scarlett after labels appear, only if the user has no stored choice yet. */
export function adoptPreferredInput() {
  if (inputPref != null) return resolveInputId();
  const focus = inputs.find((device) => isFocusrite(device.label));
  if (focus) {
    inputPref = focus.deviceId;
    localStorage.setItem(INPUT_KEY, inputPref);
  }
  return resolveInputId();
}

/** Prefer Scarlett Out when unset, or when low-latency / monitor policy asks for it. */
export function adoptPreferredOutput() {
  if (lowLatencyPref || (monitorPref && !outputIsExplicitBluetooth())) {
    const focus = focusriteOutput();
    if (focus && (outputPref == null || lowLatencyPref)) {
      if (outputPref == null || resolveOutputId() !== focus.deviceId) {
        setOutputDeviceId(focus.deviceId);
      }
      return resolveOutputId();
    }
  }
  if (outputPref != null) return resolveOutputId();
  const focus = focusriteOutput();
  if (focus) {
    setOutputDeviceId(focus.deviceId);
  }
  return resolveOutputId();
}

export function micConstraints(deviceId) {
  const audio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };
  if (deviceId) audio.deviceId = { exact: deviceId };
  return { audio };
}

export function deviceErrorMessage(err, chosenLabel) {
  const name = String(err?.name || '');
  const message = String(err?.message || '');
  if (name === 'NotAllowedError' || name === 'SecurityError' || /permission/i.test(message)) {
    return 'The microphone is blocked. Allow Electron under System Settings, Privacy & Security, Microphone, then press Listen again.';
  }
  if (chosenLabel || name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
    const label = shortDeviceName(chosenLabel || 'Scarlett');
    return `Could not open ${label}. Check the USB cable, turn off exclusive mode in Focusrite Control, and confirm Microphone access for Electron.`;
  }
  return 'The microphone is blocked. Allow Electron under System Settings, Privacy & Security, Microphone, then press Listen again.';
}

export async function refreshDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    inputs = [];
    outputs = [];
    return { inputs, outputs };
  }
  const all = await navigator.mediaDevices.enumerateDevices();
  inputs = all.filter((device) => device.kind === 'audioinput');
  outputs = all.filter((device) => device.kind === 'audiooutput');

  if (inputPref && inputPref !== SYSTEM_DEFAULT && !stillPresent(inputs, inputPref)) {
    inputPref = null;
    localStorage.removeItem(INPUT_KEY);
  }
  if (outputPref && outputPref !== SYSTEM_DEFAULT && !stillPresent(outputs, outputPref)) {
    outputPref = null;
    localStorage.removeItem(OUTPUT_KEY);
  }

  return { inputs, outputs };
}

export async function applyMediaSink(element) {
  if (!element || !supportsOutputSink()) return false;
  try {
    await element.setSinkId(resolveOutputId() || '');
    return true;
  } catch {
    return false;
  }
}

export async function applyContextSink(ctx) {
  if (!ctx || !supportsContextSink()) return false;
  try {
    await ctx.setSinkId(resolveOutputId() || '');
    return true;
  } catch {
    return false;
  }
}

/** Shared transport control: mic picker (+ output when setSinkId exists). */
export function devicePicker(el) {
  const selectedInput = resolveInputId();
  const selectedOutput = resolveOutputId();
  const wrap = el('div', { class: 'device-controls' });
  const mic = el('label', { class: 'device-pick' });
  mic.append(el('span', { text: 'Mic' }));
  const micSelect = el('select', {
    'data-action': 'input-device',
    id: 'input-device',
    title: 'Audio input for Listen',
  });
  micSelect.append(el('option', {
    value: '',
    text: 'System default',
    ...(selectedInput ? {} : { selected: 'selected' }),
  }));
  const ordered = [...inputs].sort((a, b) => Number(isFocusrite(b.label)) - Number(isFocusrite(a.label)));
  ordered.forEach((device) => {
    const label = device.label || `Input ${device.deviceId.slice(0, 6)}`;
    micSelect.append(el('option', {
      value: device.deviceId,
      text: label,
      ...(device.deviceId === selectedInput ? { selected: 'selected' } : {}),
    }));
  });
  mic.append(micSelect);
  wrap.append(mic);

  if (canRouteOutput()) {
    const out = el('label', { class: 'device-pick' });
    out.append(el('span', { text: 'Out' }));
    const outSelect = el('select', {
      'data-action': 'output-device',
      id: 'output-device',
      title: 'Audio output for song takes (and Web Audio when supported)',
    });
    outSelect.append(el('option', {
      value: '',
      text: 'System default',
      ...(selectedOutput ? {} : { selected: 'selected' }),
    }));
    const outOrdered = [...outputs].sort((a, b) => Number(isFocusrite(b.label)) - Number(isFocusrite(a.label)));
    outOrdered.forEach((device) => {
      const label = device.label || `Output ${device.deviceId.slice(0, 6)}`;
      outSelect.append(el('option', {
        value: device.deviceId,
        text: label,
        ...(device.deviceId === selectedOutput ? { selected: 'selected' } : {}),
      }));
    });
    out.append(outSelect);
    wrap.append(out);
  }

  const monitor = el('label', {
    class: `check device-monitor${isMonitorFeedbackRisk() && monitorPref ? ' warn' : ''}`,
    title: monitorTipText(),
  }, [
    el('input', {
      type: 'checkbox',
      'data-action': 'monitor',
      id: 'monitor-toggle',
      ...(monitorPref ? { checked: 'checked' } : {}),
    }),
    'Monitor',
  ]);
  wrap.append(monitor);

  const lowLat = el('label', {
    class: 'check device-low-latency',
    title: 'Route Out to Scarlett and remind you to use Focusrite Direct Monitor for near-instant sound. AirPods cannot do this.',
  }, [
    el('input', {
      type: 'checkbox',
      'data-action': 'low-latency',
      id: 'low-latency-toggle',
      ...(lowLatencyPref ? { checked: 'checked' } : {}),
    }),
    'Low latency',
  ]);
  wrap.append(lowLat);

  wrap.append(el('span', {
    class: 'device-status',
    id: 'input-status',
    text: inputStatusText(),
  }));
  wrap.append(el('span', {
    class: `device-monitor-tip${isMonitorFeedbackRisk() && monitorPref ? ' warn' : ''}`,
    id: 'monitor-tip',
    text: monitorTipText(),
  }));
  wrap.append(el('span', {
    class: 'device-latency-tip',
    id: 'latency-tip',
    text: '',
  }));
  return wrap;
}
