// Small sounds, made with WebAudio: no audio files, nothing to fetch. A soft
// tick for a footstep, a coin's clink, a glassy sparkle when a case is lifted,
// a low drill hum-throb while the vault opens, a zap for the EMP, a rising
// whine as the alarm climbs, and a brassy little figure for a clean getaway.
// The context is made lazily on the first user gesture, as browsers demand;
// until then — and on any error — every call is a quiet no-op.

export function createSound() {
  let audio = null, highStep = false;

  function ensureAudio() {
    if (audio !== null) {
      if (audio.state === "suspended") audio.resume();
      return audio;
    }
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audio = null;
    }
    return audio;
  }

  function tone(startFreq, endFreq, seconds, wave, volume, delay = 0) {
    const ctx = ensureAudio();
    if (ctx === null) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(startFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 2 / 100);
  }

  return {
    // Call this from a click or keypress so the browser lets the context start.
    unlock() {
      ensureAudio();
    },
    footstep() {
      highStep = highStep === false;
      tone(highStep ? 190 : 150, 105, 0.05, "sine", 0.045);
    },
    toss() {
      tone(880, 1320, 0.07, "triangle", 0.05);
    },
    clink() {
      tone(2637, 2637, 0.09, "sine", 0.06);
      tone(3520, 3520, 0.13, "sine", 0.05, 0.06);
    },
    snatch() {
      tone(1568, 1568, 0.08, "sine", 0.06);
      tone(2093, 2093, 0.1, "sine", 0.06, 0.07);
      tone(3136, 3136, 0.16, "sine", 0.05, 0.14);
    },
    crack() {
      tone(90, 70, 0.22, "sawtooth", 0.05);
    },
    vaultOpen() {
      tone(392, 392, 0.12, "triangle", 0.07);
      tone(523, 523, 0.12, "triangle", 0.07, 0.1);
      tone(659, 659, 0.12, "triangle", 0.07, 0.2);
      tone(1047, 1047, 0.26, "triangle", 0.08, 0.3);
    },
    emp() {
      tone(1800, 120, 0.28, "sawtooth", 0.07);
    },
    wary() {
      tone(740, 1108, 0.11, "square", 0.03);
    },
    blown() {
      tone(880, 880, 0.16, "square", 0.07);
      tone(880, 880, 0.16, "square", 0.07, 0.22);
      tone(1174, 587, 0.4, "square", 0.07, 0.44);
    },
    getaway() {
      tone(523, 523, 0.11, "triangle", 0.07);
      tone(659, 659, 0.11, "triangle", 0.07, 0.1);
      tone(784, 784, 0.11, "triangle", 0.07, 0.2);
      tone(1047, 1047, 0.24, "triangle", 0.08, 0.3);
    },
  };
}
