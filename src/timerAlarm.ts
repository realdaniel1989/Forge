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
    beep(440, now, 0.18, ctx);
    beep(880, now + 0.22, 0.18, ctx);
  } catch {
    // Audio not supported — fail silently
  }

  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // Vibration not supported — fail silently
  }
}
