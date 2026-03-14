import React from "react";

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Converts a color string to a 6-digit hex color suitable for HTML color input.
 * Handles:
 * - 8-digit hex (#RRGGBBAA -> #RRGGBB)
 * - 6-digit hex (#RRGGBB -> #RRGGBB)
 * - rgb/rgba strings
 */
function toHex6(color: string): string {
  if (color.startsWith("#")) {
    // Handle 8-digit hex (#RRGGBBAA) or 6-digit hex (#RRGGBB)
    if (color.length >= 8) {
      return "#" + color.slice(1, 7);
    }
    return color.slice(0, 7);
  }

  // Handle rgb/rgba strings
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]!, 10).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]!, 10).toString(16).padStart(2, "0");
    return "#" + r + g + b;
  }

  // Return original if we can't parse it
  return "#000000";
}

export function ColorInput({
  label,
  value,
  onChange,
  disabled = false,
}: ColorInputProps): React.ReactElement {
  // Convert the value to 6-digit hex for the color input
  const hexValue = toHex6(value);

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
        value={hexValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
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
