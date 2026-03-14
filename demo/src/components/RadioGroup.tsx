import React from "react";

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  label: string;
  name: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
}

export function RadioGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: RadioGroupProps<T>): React.ReactElement {
  return (
    <fieldset
      style={{
        border: "none",
        padding: 0,
        margin: 0,
      }}
    >
      <legend
        style={{
          fontWeight: 500,
          fontSize: "0.85rem",
          marginBottom: 6,
          color: "#e0e0e0",
        }}
      >
        {label}
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={(e) => onChange(e.target.value as T)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
