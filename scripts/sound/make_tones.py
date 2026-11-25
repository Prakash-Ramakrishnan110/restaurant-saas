#!/usr/bin/env python3
"""Generate six distinct, short, original WAV alert tones for ServeMyFood Stage 3."""

from __future__ import annotations

import math
import os
import struct
import wave

SAMPLE_RATE = 22050
MAX_BYTES = 40 * 1024
MAX_DURATION = 1.2


def _synth_notes(
    notes: list[tuple[float, float, float, str]],
    amplitude: float = 0.45,
) -> bytes:
    """Synthesize a sequence of (start_s, dur_s, freq_hz, waveform) into 16-bit PCM frames."""
    total_dur = max(start + dur for start, dur, _, _ in notes)
    if total_dur > MAX_DURATION:
        raise ValueError(f"Tone duration {total_dur:.2f}s exceeds {MAX_DURATION}s limit")

    total_samples = int(SAMPLE_RATE * total_dur)
    samples = [0.0] * total_samples

    for start_s, dur_s, freq_hz, wave_type in notes:
        start_idx = int(start_s * SAMPLE_RATE)
        end_idx = min(total_samples, int((start_s + dur_s) * SAMPLE_RATE))
        length = max(1, end_idx - start_idx)
        for idx in range(start_idx, end_idx):
            local_i = idx - start_idx
            t = local_i / SAMPLE_RATE
            phase = 2.0 * math.pi * freq_hz * t
            if wave_type == "triangle":
                raw = (2.0 / math.pi) * math.asin(math.sin(phase))
            else:
                raw = math.sin(phase)
            # Smooth attack (10ms) and exponential decay envelope
            attack = min(1.0, local_i / (0.01 * SAMPLE_RATE))
            decay = math.exp(-3.5 * (local_i / length))
            samples[idx] += amplitude * raw * attack * decay

    pcm = bytearray()
    for s in samples:
        clamped = max(-0.98, min(0.98, s))
        pcm.extend(struct.pack("<h", int(clamped * 32767)))
    return bytes(pcm)


def _write_wav(path: str, pcm_bytes: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_bytes)
    size = os.path.getsize(path)
    if size > MAX_BYTES:
        raise ValueError(f"{path} size {size} exceeds {MAX_BYTES} bytes")


def main() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(repo_root, "frontend", "public", "sound")

    catalog: dict[str, list[tuple[float, float, float, str]]] = {
        # Distinct ascending dual-tone D5 -> A5
        "new-order.wav": [(0.0, 0.18, 587.33, "sine"), (0.14, 0.30, 880.0, "sine")],
        # Distinct 3-note triad C5 -> E5 -> G5
        "ready.wav": [
            (0.0, 0.18, 523.25, "triangle"),
            (0.14, 0.18, 659.25, "triangle"),
            (0.28, 0.28, 783.99, "triangle"),
        ],
        # Gentle high bell E5 -> B5
        "request.wav": [(0.0, 0.20, 659.25, "sine"), (0.16, 0.32, 987.77, "sine")],
        # Urgent 3-pulse F5 -> A5 -> F5
        "attention.wav": [
            (0.0, 0.14, 698.46, "triangle"),
            (0.16, 0.14, 880.0, "triangle"),
            (0.32, 0.22, 698.46, "triangle"),
        ],
        # Bright counter pickup chime G5 -> C6
        "token-ready.wav": [(0.0, 0.16, 783.99, "triangle"), (0.13, 0.32, 1046.50, "triangle")],
        # Crisp confirmation C5 -> G5
        "success.wav": [(0.0, 0.12, 523.25, "sine"), (0.10, 0.24, 783.99, "sine")],
    }

    for filename, notes in catalog.items():
        target = os.path.join(out_dir, filename)
        pcm = _synth_notes(notes)
        _write_wav(target, pcm)
        print(f"Generated {filename}: {os.path.getsize(target)} bytes")


if __name__ == "__main__":
    main()
