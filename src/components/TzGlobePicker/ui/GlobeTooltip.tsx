"use client";

import React from "react";
import { formatUtcOffset } from "../utils/globeUtils";

interface GlobeTooltipProps {
  timezone: string | null;
  position: { x: number; y: number };
  open: boolean;
}

/** Tooltip component for displaying timezone information on hover */
export function GlobeTooltip({
  timezone,
  position,
  open,
}: GlobeTooltipProps): React.ReactElement {
  if (!timezone || !open) return <></>;

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y - 12,
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        zIndex: 1300,
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.96)",
          color: "#1a1a1a",
          borderRadius: 6,
          padding: "6px 12px",
          maxWidth: 260,
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.18), 0 0.5px 2px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.2 }}>
          {timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone}
        </div>
        <div
          style={{
            color: "#666",
            fontSize: "0.7rem",
            marginBottom: 1,
          }}
        >
          {timezone}
        </div>
        <div style={{ color: "#666", fontSize: "0.75rem", fontWeight: 500 }}>
          {formatUtcOffset(timezone)}
        </div>
      </div>
    </div>
  );
}
