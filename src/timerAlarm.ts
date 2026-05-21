let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function beep(frequency: number, startTime: number, duration: number, ctx: AudioContext): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.4, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playAlarm(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    beep(440, now, 0.5, ctx);
    beep(660, now + 0.8, 0.5, ctx);
    beep(880, now + 1.6, 1.0, ctx);
  } catch {
    // Audio not supported — fail silently
  }

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([500, 300, 500, 300, 800]);
    }
  } catch {
    // Vibration not supported — fail silently
  }
}

export function prewarmAudio(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.01);
    oscillator.disconnect();
    gain.disconnect();
  } catch {
    // Audio not supported — fail silently
  }
}
