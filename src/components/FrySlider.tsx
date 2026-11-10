import React from 'react';

interface FrySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
  defaultValue?: number;
  accent?: 'amber' | 'crimson' | 'lime';
  hint?: string;
  disabled?: boolean;
}

const ACCENT_COLORS = {
  amber: '#ff6b1a',
  crimson: '#ff2e4c',
  lime: '#a3e635',
};

export const FrySlider: React.FC<FrySliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
  defaultValue,
  accent = 'amber',
  hint,
  disabled = false,
}) => {
  const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  const accentColor = ACCENT_COLORS[accent];

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-xs font-medium text-[#d8d4ca] truncate select-none"
            title={defaultValue !== undefined ? 'Double-click slider to reset' : undefined}
          >
            {label}
          </span>
          {hint && (
            <span className="text-[10px] text-[#7c7972] hidden sm:inline truncate">
              {hint}
            </span>
          )}
        </div>
        <span
          className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#1b1b22] border border-[#2b2b36] text-[#f5f2eb] tabular-nums shrink-0"
          style={{ color: value !== defaultValue ? accentColor : '#d8d4ca' }}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => {
          if (defaultValue !== undefined) onChange(defaultValue);
        }}
        className="fry-slider w-full h-4"
        style={
          {
            '--slider-pct': `${pct}%`,
            '--slider-color': accentColor,
          } as React.CSSProperties
        }
      />
    </div>
  );
};
