import React from 'react';
import { Trash2 } from 'lucide-react';
import type { PlannedSet, Tempo } from '../types';
import { emptyTempo } from '../tempoUtils';
import { NumericInput } from './NumericInput';

const condensed: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

interface Props {
  sets: PlannedSet[];
  onChange: (next: PlannedSet[]) => void;
}

const numInputClass =
  "w-full bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-lg px-2 py-2 text-[13px] text-[var(--ink)] outline-none text-center transition-colors focus:border-[var(--ash)]";
const tempoInputClass =
  "w-10 bg-[var(--canvas)] border border-[var(--hairline-2)] rounded-md px-1 py-1.5 text-[12px] text-[var(--ink)] outline-none text-center transition-colors focus:border-[var(--ash)]";
const labelClass = "block text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--stone)] mb-1";

const clampTempoNum = (n: number) => Math.min(10, Math.max(0, Math.round(n)));

export const ExerciseSetTable: React.FC<Props> = ({ sets, onChange }) => {
  const updateSet = (idx: number, patch: Partial<PlannedSet>) => {
    const next = sets.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const updateTempo = (idx: number, patch: Partial<Tempo>) => {
    const current = sets[idx].tempo ?? emptyTempo();
    const tempo: Tempo = { ...current, ...patch };
    updateSet(idx, { tempo });
  };

  const addRow = () => {
    const prev = sets[sets.length - 1];
    const newRow: PlannedSet = prev
      ? { reps: prev.reps, weight: prev.weight, tempo: prev.tempo ? { ...prev.tempo } : undefined }
      : { reps: 10, weight: 0 };
    onChange([...sets, newRow]);
  };

  const removeRow = (idx: number) => {
    onChange(sets.filter((_, i) => i !== idx));
  };

  const applyTempoToAll = () => {
    const first = sets[0]?.tempo;
    if (!first) return;
    onChange(sets.map(s => ({ ...s, tempo: { ...first } })));
  };

  const renderUpInput = (idx: number, tempo: Tempo) => {
    const value = tempo.up;
    const display = value === 'X' ? 'X' : String(value);
    return (
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={e => {
          const raw = e.target.value.trim().toUpperCase();
          if (raw === 'X') {
            updateTempo(idx, { up: 'X' });
            return;
          }
          const n = parseInt(raw, 10);
          if (Number.isNaN(n)) {
            updateTempo(idx, { up: 0 });
            return;
          }
          updateTempo(idx, { up: clampTempoNum(n) });
        }}
        className={tempoInputClass}
        aria-label={`Set ${idx + 1} concentric (up) seconds or X for explosive`}
      />
    );
  };

  if (sets.length === 0) {
    return (
      <div className="border border-dashed border-[var(--hairline-2)] rounded-lg py-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--stone)] mb-2" style={condensed}>
          No sets yet
        </p>
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
          style={condensed}
        >
          + Add set
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[28px_64px_72px_1fr_36px] gap-2 items-end pb-1.5 border-b border-[var(--hairline)]">
        <span className={labelClass} style={condensed}>Set</span>
        <span className={labelClass} style={condensed}>Reps</span>
        <span className={labelClass} style={condensed}>Wt</span>
        <span className={labelClass} style={condensed}>Tempo (Down · Hold · Up · Hold)</span>
        <span />
      </div>

      {sets.map((s, idx) => {
        const tempo = s.tempo ?? emptyTempo();
        return (
          <div
            key={idx}
            className="grid grid-cols-[28px_64px_72px_1fr_36px] gap-2 items-center py-1.5 border-b border-[var(--hairline)]"
          >
            <span className="text-[12px] text-[var(--stone)] font-mono">{idx + 1}</span>
            <NumericInput
              integer
              min={1}
              value={s.reps}
              onChange={n => updateSet(idx, { reps: n })}
              className={numInputClass}
            />
            <NumericInput
              min={0}
              value={s.weight}
              onChange={n => updateSet(idx, { weight: n })}
              className={numInputClass}
            />
            <div className="flex items-center gap-1">
              <NumericInput
                integer
                min={0}
                value={typeof tempo.down === 'number' ? tempo.down : 0}
                onChange={n => updateTempo(idx, { down: clampTempoNum(n) })}
                className={tempoInputClass}
              />
              <NumericInput
                integer
                min={0}
                value={tempo.holdBottom}
                onChange={n => updateTempo(idx, { holdBottom: clampTempoNum(n) })}
                className={tempoInputClass}
              />
              {renderUpInput(idx, tempo)}
              <NumericInput
                integer
                min={0}
                value={tempo.holdTop}
                onChange={n => updateTempo(idx, { holdTop: clampTempoNum(n) })}
                className={tempoInputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="p-1.5 text-[var(--stone)] hover:text-[var(--action)] transition-colors border-none bg-none cursor-pointer"
              aria-label={`Remove set ${idx + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2.5">
        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--hairline-2)] text-[var(--ash)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] transition-colors"
          style={condensed}
        >
          + Add set
        </button>
        <button
          type="button"
          onClick={applyTempoToAll}
          disabled={!sets[0]?.tempo}
          className="px-3 py-1.5 rounded-full bg-transparent border border-[var(--hairline-2)] text-[var(--stone)] text-[11px] font-semibold uppercase tracking-[0.06em] cursor-pointer hover:border-[var(--ash)] hover:text-[var(--ash)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={condensed}
        >
          Apply tempo to all sets ↕
        </button>
      </div>
    </div>
  );
};
