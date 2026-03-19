"use client";

import React from "react";

interface ResetButtonProps {
  size: number;
  onClick: () => void;
}

/** Reset button component for recentering the globe */
/** TODO: Missing keyboard focus styles for accessibility. */
export function ResetButton({
  size,
  onClick,
}: ResetButtonProps): React.ReactElement {
  const btnSize = Math.min(36, Math.max(24, size * 0.1));
  const iconSize = Math.min(20, Math.max(14, size * 0.06));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reset globe to timezone center"
      title="Reset view"
      style={{
        position: "absolute",
        bottom: Math.max(4, size * 0.03),
        right: Math.max(4, size * 0.03),
        width: btnSize,
        height: btnSize,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.88)",
        color: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: "50%",
        cursor: "pointer",
        padding: 0,
        backdropFilter: "blur(4px)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        transition: "background-color 0.15s, color 0.15s, transform 0.15s",
        zIndex: 2,
      }}
      onMouseEnter={(e): void => {
        const btn = e.currentTarget;
        btn.style.background = "rgba(255,255,255,0.96)";
        btn.style.color = "rgba(0,0,0,0.8)";
        btn.style.transform = "scale(1.08)";
      }}
      onMouseLeave={(e): void => {
        const btn = e.currentTarget;
        btn.style.background = "rgba(255,255,255,0.88)";
        btn.style.color = "rgba(0,0,0,0.55)";
        btn.style.transform = "scale(1)";
      }}
    >
      {/* Crosshair / MyLocation icon as inline SVG */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
      </svg>
    </button>
  );
}
