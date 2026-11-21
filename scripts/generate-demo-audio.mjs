import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.resolve(__dirname, '..', 'public', 'audio');

const SAMPLE_RATE = 44100;

// MIDI note number to frequency (Hz)
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Synthesize a warm choral/harmonium phrase as mono 16-bit PCM WAV buffer
function synthesizeChantWav(notes, tempoScale = 1.0) {
  const totalSec =
    notes.reduce((sum, [, dur]) => sum + dur * tempoScale, 0) + 0.45;
  const totalSamples = Math.ceil(totalSec * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  let cursor = 0.08;
  for (let nIdx = 0; nIdx < notes.length; nIdx++) {
    const [midi, baseDur] = notes[nIdx];
    const dur = baseDur * tempoScale;
    const freq = midiToFreq(midi);
    const startSample = Math.floor(cursor * SAMPLE_RATE);
    const noteSamples = Math.floor((dur + 0.16) * SAMPLE_RATE);

    for (let i = 0; i < noteSamples; i++) {
      const idx = startSample + i;
      if (idx >= totalSamples) break;
      const t = i / SAMPLE_RATE;

      // Smooth choral envelope (gentle attack, sustained tone, resonant release)
      const attack = Math.min(1, t / 0.065);
      const releaseStart = dur;
      const release =
        t > releaseStart ? Math.max(0, 1 - (t - releaseStart) / 0.16) : 1;
      const env = attack * release;

      // Gentle vocal vibrato
      const vibrato = 1 + 0.0022 * Math.sin(2 * Math.PI * 4.8 * t);
      const f = freq * vibrato;

      // Warm ensemble harmonics (fundamental + octave + fifth + gentle choir overtones + low drone fifth/root)
      const voice =
        0.52 * Math.sin(2 * Math.PI * f * t) +
        0.24 * Math.sin(2 * Math.PI * f * 2 * t) +
        0.11 * Math.sin(2 * Math.PI * f * 3 * t) +
        0.05 * Math.sin(2 * Math.PI * f * 4 * t) +
        0.18 * Math.sin(2 * Math.PI * (f * 0.5) * t);

      samples[idx] += voice * env * 0.36;
    }

    cursor += dur;
  }

  // Gentle reverb tail (simple comb-like early reflections)
  const delay1 = Math.floor(0.043 * SAMPLE_RATE);
  const delay2 = Math.floor(0.089 * SAMPLE_RATE);
  for (let i = delay2; i < totalSamples; i++) {
    samples[i] += samples[i - delay1] * 0.16 + samples[i - delay2] * 0.09;
  }

  // Normalize peak to -2 dB
  let maxAmp = 0.0001;
  for (let i = 0; i < totalSamples; i++) {
    const a = Math.abs(samples[i]);
    if (a > maxAmp) maxAmp = a;
  }
  const gain = 0.78 / maxAmp;

  // Build 16-bit PCM WAV
  const dataSize = totalSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // Mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < totalSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * gain));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return buf;
}

// Distinct, musical, rights-free synthetic demonstration melodies inspired by modal chant contours.
// Intentionally leaves glases 5 & 7 empty in trop and glases 3 & 7 empty in stih to demonstrate
// partial completeness per section 3.4 of the specification.
const DEMO_TRACKS = [
  // Тропари — Глас 1 (D minor / F major reciting tone A4 = 69)
  {
    file: 'trop_1_1.mp3',
    notes: [[67, 0.35], [69, 0.55], [69, 0.45], [70, 0.45], [69, 0.4], [67, 0.8]],
  },
  {
    file: 'trop_1_1a.mp3',
    notes: [[67, 0.35], [69, 0.5], [70, 0.5], [72, 0.55], [70, 0.4], [69, 0.75]],
  },
  {
    file: 'trop_1_2.mp3',
    notes: [[69, 0.45], [67, 0.4], [65, 0.45], [67, 0.4], [65, 0.85]],
  },
  {
    file: 'trop_1_К.mp3',
    notes: [[69, 0.45], [67, 0.4], [65, 0.4], [64, 0.45], [62, 1.0]],
  },

  // Тропари — Глас 2 (G major / E minor reciting tone B4 = 71)
  {
    file: 'trop_2_1.mp3',
    notes: [[67, 0.4], [71, 0.55], [71, 0.45], [72, 0.45], [71, 0.75]],
  },
  {
    file: 'trop_2_2.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.45], [69, 0.4], [67, 0.8]],
  },
  {
    file: 'trop_2_2a.mp3',
    notes: [[71, 0.4], [72, 0.45], [71, 0.4], [69, 0.45], [71, 0.75]],
  },
  {
    file: 'trop_2_К.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.5], [66, 0.45], [67, 1.0]],
  },

  // Тропари — Глас 3 (F major reciting tone C5 = 72)
  {
    file: 'trop_3_1.mp3',
    notes: [[69, 0.4], [72, 0.55], [74, 0.45], [72, 0.45], [70, 0.8]],
  },
  {
    file: 'trop_3_2.mp3',
    notes: [[72, 0.45], [70, 0.45], [69, 0.5], [67, 0.45], [69, 0.8]],
  },
  {
    file: 'trop_3_К.mp3',
    notes: [[70, 0.45], [69, 0.45], [67, 0.45], [65, 1.05]],
  },

  // Тропари — Глас 4 (G major reciting tone D5 = 74 / B4 = 71)
  {
    file: 'trop_4_1.mp3',
    notes: [[71, 0.4], [74, 0.55], [74, 0.45], [72, 0.45], [71, 0.75]],
  },
  {
    file: 'trop_4_2.mp3',
    notes: [[71, 0.45], [72, 0.45], [71, 0.4], [69, 0.45], [67, 0.85]],
  },
  {
    file: 'trop_4_3.mp3',
    notes: [[69, 0.45], [71, 0.45], [72, 0.5], [71, 0.45], [69, 0.8]],
  },
  {
    file: 'trop_4_К.mp3',
    notes: [[72, 0.45], [71, 0.45], [69, 0.45], [67, 1.05]],
  },

  // Тропари — Глас 6 (F major / D minor reciting tone A4 = 69 / Bb4 = 70)
  {
    file: 'trop_6_1.mp3',
    notes: [[65, 0.45], [67, 0.45], [69, 0.55], [67, 0.45], [65, 0.8]],
  },
  {
    file: 'trop_6_2.mp3',
    notes: [[69, 0.45], [70, 0.5], [69, 0.4], [67, 0.45], [69, 0.8]],
  },
  {
    file: 'trop_6_К.mp3',
    notes: [[69, 0.45], [67, 0.45], [65, 0.45], [64, 0.45], [62, 1.0]],
  },

  // Тропари — Глас 8 (G major solemn reciting tone G4 = 67 -> B4 = 71)
  {
    file: 'trop_8_1.mp3',
    notes: [[67, 0.5], [69, 0.45], [71, 0.6], [69, 0.45], [67, 0.8]],
  },
  {
    file: 'trop_8_2.mp3',
    notes: [[71, 0.5], [72, 0.45], [71, 0.45], [69, 0.8]],
  },
  {
    file: 'trop_8_К.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.5], [64, 0.45], [67, 1.05]],
  },

  // Стихиры — Глас 1 (richer phrase lengths with 4, 5, К)
  {
    file: 'stih_1_1.mp3',
    notes: [[64, 0.4], [67, 0.45], [69, 0.6], [69, 0.45], [67, 0.45], [69, 0.75]],
  },
  {
    file: 'stih_1_2.mp3',
    notes: [[69, 0.45], [70, 0.45], [69, 0.45], [67, 0.45], [65, 0.8]],
  },
  {
    file: 'stih_1_3.mp3',
    notes: [[65, 0.4], [67, 0.45], [69, 0.5], [67, 0.45], [64, 0.85]],
  },
  {
    file: 'stih_1_К.mp3',
    notes: [[69, 0.45], [67, 0.45], [65, 0.45], [64, 0.5], [62, 1.05]],
  },

  // Стихиры — Глас 2
  {
    file: 'stih_2_1.mp3',
    notes: [[67, 0.4], [69, 0.45], [71, 0.55], [72, 0.45], [71, 0.75]],
  },
  {
    file: 'stih_2_2.mp3',
    notes: [[71, 0.45], [72, 0.45], [74, 0.5], [72, 0.45], [71, 0.8]],
  },
  {
    file: 'stih_2_3.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.5], [66, 0.45], [67, 0.8]],
  },
  {
    file: 'stih_2_К.mp3',
    notes: [[72, 0.45], [71, 0.45], [69, 0.5], [67, 1.05]],
  },

  // Стихиры — Глас 4
  {
    file: 'stih_4_1.mp3',
    notes: [[69, 0.4], [71, 0.45], [74, 0.6], [72, 0.45], [71, 0.8]],
  },
  {
    file: 'stih_4_2.mp3',
    notes: [[71, 0.45], [72, 0.5], [71, 0.4], [69, 0.85]],
  },
  {
    file: 'stih_4_4.mp3',
    notes: [[67, 0.45], [69, 0.45], [71, 0.5], [72, 0.45], [69, 0.85]],
  },
  {
    file: 'stih_4_К.mp3',
    notes: [[74, 0.45], [72, 0.45], [71, 0.45], [69, 0.45], [67, 1.05]],
  },

  // Стихиры — Глас 5
  {
    file: 'stih_5_1.mp3',
    notes: [[65, 0.4], [69, 0.5], [72, 0.55], [71, 0.45], [69, 0.8]],
  },
  {
    file: 'stih_5_2a.mp3',
    notes: [[69, 0.45], [71, 0.5], [72, 0.5], [74, 0.45], [72, 0.8]],
  },
  {
    file: 'stih_5_К.mp3',
    notes: [[72, 0.45], [71, 0.45], [69, 0.5], [67, 0.45], [65, 1.05]],
  },

  // Стихиры — Глас 6 (includes 2a and 5)
  {
    file: 'stih_6_1.mp3',
    notes: [[62, 0.45], [65, 0.5], [69, 0.55], [67, 0.45], [65, 0.8]],
  },
  {
    file: 'stih_6_2a.mp3',
    notes: [[67, 0.45], [69, 0.5], [70, 0.5], [69, 0.45], [67, 0.8]],
  },
  {
    file: 'stih_6_5.mp3',
    notes: [[69, 0.45], [72, 0.5], [70, 0.45], [69, 0.45], [67, 0.85]],
  },
  {
    file: 'stih_6_К.mp3',
    notes: [[69, 0.45], [67, 0.45], [65, 0.45], [64, 0.45], [62, 1.05]],
  },

  // Стихиры — Глас 8
  {
    file: 'stih_8_1.mp3',
    notes: [[67, 0.45], [71, 0.55], [74, 0.55], [72, 0.45], [71, 0.8]],
  },
  {
    file: 'stih_8_3.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.45], [69, 0.5], [71, 0.8]],
  },
  {
    file: 'stih_8_К.mp3',
    notes: [[71, 0.45], [69, 0.45], [67, 0.5], [66, 0.45], [67, 1.05]],
  },
];

fs.mkdirSync(audioDir, { recursive: true });

for (const track of DEMO_TRACKS) {
  const wavBuffer = synthesizeChantWav(track.notes);
  const tmpWav = path.join(audioDir, `.tmp_${track.file}.wav`);
  const outMp3 = path.join(audioDir, track.file);
  fs.writeFileSync(tmpWav, wavBuffer);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    tmpWav,
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '96k',
    outMp3,
  ]);
  fs.unlinkSync(tmpWav);
}

console.log(`[demo-audio] Сгенерировано ${DEMO_TRACKS.length} тестовых MP3-записей в public/audio/.`);
