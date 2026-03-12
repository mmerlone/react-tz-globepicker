import { useId } from "react";

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: NumberInputProps) {
  const id = useId();
  return (
    <div style={{ minWidth: 0 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          marginBottom: 4,
          fontSize: "0.75rem",
          opacity: 0.7,
        }}
      >
        {label}
      </label>
      <input
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!Number.isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          borderRadius: 4,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          color: "#e0e0e0",
          fontSize: "0.8rem",
        }}
      />
    </div>
  );
}
