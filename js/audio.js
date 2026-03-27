/**
 * audio.js — Synthetic sound engine using Web Audio API.
 * No external audio files required. No dependencies.
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let _ctx = null;

/** Lazily create the AudioContext on first use (requires user gesture) */
const ctx = () => {
  if (!_ctx) _ctx = new AudioCtx();
  return _ctx;
};

/** Whoosh + soft thud when playing a card */
export const sndWhoosh = () => {
  try {
    const c   = ctx();
    const buf = c.createBuffer(1, c.sampleRate * 0.28, c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    }
    const src = c.createBufferSource(); src.buffer = buf;
    const g   = c.createGain();
    g.gain.setValueAtTime(0.28, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  } catch (_) {}
};

/** Quick card flip when drawing */
export const sndFlip = () => {
  try {
    const c   = ctx();
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, c.currentTime + 0.1);
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    osc.connect(g); g.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + 0.1);
  } catch (_) {}
};

/** Upbeat fanfare jingle on win (~3 s) */
export const sndWin = () => {
  try {
    const c = ctx();
    const melody = [523, 659, 784, 523, 659, 784, 1047, 784, 1047, 1319, 1047, 784, 1047, 1319];
    let t = c.currentTime + 0.05;
    melody.forEach((freq, i) => {
      const osc = c.createOscillator();
      const g   = c.createGain();
      osc.type = i % 2 === 0 ? 'square' : 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g); g.connect(c.destination);
      osc.start(t); osc.stop(t + 0.3);
      t += 0.19;
    });
  } catch (_) {}
};

/** Bold UNO shout effect */
export const sndUno = () => {
  try {
    const c = ctx();
    [220, 330, 440, 330].forEach((freq, i) => {
      const osc   = c.createOscillator();
      const g     = c.createGain();
      const start = c.currentTime + i * 0.08;
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.3, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
      osc.connect(g); g.connect(c.destination);
      osc.start(start); osc.stop(start + 0.1);
    });
  } catch (_) {}
};
