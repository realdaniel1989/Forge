import React, { useState, useEffect, useRef } from 'react';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
  integer?: boolean;
  min?: number;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  integer = false,
  min = 0,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [display, setDisplay] = useState(String(value));
  const isFocusedRef = useRef(false);

  // Sync display when value changes externally (e.g. unit toggle)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplay(String(value));
    }
  }, [value]);

  const parse = (s: string): number => {
    const n = integer ? parseInt(s, 10) : parseFloat(s);
    return isNaN(n) ? min : Math.max(min, n);
  };

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      value={display}
      onChange={e => {
        const raw = e.target.value;
        setDisplay(raw);
        const n = integer ? parseInt(raw, 10) : parseFloat(raw);
        if (!isNaN(n)) {
          onChange(Math.max(min, n));
        }
      }}
      onFocus={e => {
        isFocusedRef.current = true;
        e.target.select();
        onFocus?.(e);
      }}
      onBlur={e => {
        isFocusedRef.current = false;
        const n = parse(display);
        setDisplay(String(n));
        onChange(n);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
};
