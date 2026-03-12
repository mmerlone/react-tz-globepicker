import React from "react";

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorInput({
  label,
  value,
  onChange,
  disabled = false,
}: ColorInputProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: 28,
          height: 24,
          padding: 0,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 4,
          cursor: disabled ? "not-allowed" : "pointer",
          flexShrink: 0,
          opacity: disabled ? 0.5 : 1,
        }}
      />
      <span
        style={{
          fontSize: "0.7rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={label}
      >
        {label}
      </span>
    </div>
  );
}
