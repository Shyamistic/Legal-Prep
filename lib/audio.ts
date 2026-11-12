"use client";

export interface RecordingResult {
  wav: Blob;
  durationSec: number; // trimmed speaking time
  pauses: number;
  longestPauseSec: number;
}

const TARGET_RATE = 16000;
const SILENCE_RMS = 0.012;
const PAUSE_SEC = 0.9;
export const MAX_RECORD_SEC = 29; // Gnani REST limit is 30s

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const len = Math.floor(input.length / ratio);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => Array.from(s).forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Records mic audio as 16 kHz mono WAV and measures speaking time and pauses. */
export class Recorder {
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private src: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private frameRms: number[] = [];
  private frameSec = 0;
  private sampleRate = 48000;
  onLevel?: (level: number) => void;

  constructor(private stream: MediaStream) {}

  async start() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.sampleRate = this.ctx.sampleRate;
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.frameSec = 4096 / this.sampleRate;
    this.chunks = [];
    this.frameRms = [];
    this.node.onaudioprocess = (e) => {
      const data = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      this.frameRms.push(rms);
      this.onLevel?.(Math.min(1, rms * 8));
    };
    this.src.connect(this.node);
    this.node.connect(this.ctx.destination); // required by some browsers; output is silent
  }

  elapsedSec(): number {
    return this.frameRms.length * this.frameSec;
  }

  async stop(): Promise<RecordingResult> {
    this.node?.disconnect();
    this.src?.disconnect();
    if (this.node) this.node.onaudioprocess = null;
    await this.ctx?.close();

    const speaking = this.frameRms.map((r) => r > SILENCE_RMS);
    const first = speaking.indexOf(true);
    const last = speaking.lastIndexOf(true);
    let pauses = 0;
    let longest = 0;
    let durationSec = 0;
    if (first >= 0) {
      durationSec = (last - first + 1) * this.frameSec;
      let run = 0;
      for (let i = first; i <= last; i++) {
        if (!speaking[i]) run++;
        else {
          const s = run * this.frameSec;
          if (s >= PAUSE_SEC) pauses++;
          longest = Math.max(longest, s);
          run = 0;
        }
      }
    }
    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      merged.set(c, o);
      o += c.length;
    }
    this.chunks = [];
    const wav = encodeWav(downsample(merged, this.sampleRate, TARGET_RATE), TARGET_RATE);
    return { wav, durationSec, pauses, longestPauseSec: longest };
  }
}

