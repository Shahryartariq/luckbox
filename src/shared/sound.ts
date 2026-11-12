import { load, save } from "./storage";

/**
 * Tiny synthesized sound effects (no audio files to download).
 * Sound is on by default and the choice is remembered.
 */
type Cue = "tap" | "flip" | "win" | "lose" | "push" | "boom";

const settings = load("settings", { sound: true });
let ctx: AudioContext | undefined;
const listeners = new Set<(on: boolean) => void>();

export function isSoundOn(): boolean {
  return settings.sound;
}

export function setSound(on: boolean): void {
  settings.sound = on;
  save("settings", settings);
  listeners.forEach((fn) => fn(on));
}

export function onSoundChange(fn: (on: boolean) => void): void {
  listeners.add(fn);
}

function tone(freq: number, start: number, length: number, type: OscillatorType, gain = 0.12): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export function play(cue: Cue): void {
  if (!settings.sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return;
  }
  switch (cue) {
    case "tap":
      tone(660, 0, 0.06, "triangle", 0.08);
      break;
    case "flip":
      tone(420, 0, 0.05, "square", 0.04);
      tone(840, 0.03, 0.05, "triangle", 0.05);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.18, "triangle"));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(f, i * 0.11, 0.2, "sawtooth", 0.06));
      break;
    case "push":
      tone(494, 0, 0.12, "triangle");
      tone(494, 0.14, 0.12, "triangle");
      break;
    case "boom":
      tone(90, 0, 0.45, "sawtooth", 0.18);
      tone(60, 0.05, 0.5, "square", 0.1);
      break;
  }
}
