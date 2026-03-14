"use client";

import React from "react";
import { formatUtcOffset } from "../utils/globeUtils";

interface GlobeTooltipProps {
  timezone: string | null;
  position: { x: number; y: number };
  open: boolean;
}

function formatLocalTime(tz: string, date: Date): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return fmt.format(date);
  } catch {
    return "";
  }
}

function parseGmtOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
    const parts = dtf.formatToParts(date);
    const tzPart =
      parts.find((p: Intl.DateTimeFormatPart) => p.type === "timeZoneName")
        ?.value ?? "";
    const m = tzPart.match(/GMT([+-]?\d{1,2})(?::?(\d{2}))?/);
    if (m) {
      const h = parseInt(m[1] ?? "0", 10);
      const min = m[2] ? parseInt(m[2] ?? "0", 10) : 0;
      return -(h * 60 + min);
    }
    const m2 = tzPart.match(/([+-]\d{2}):?(\d{2})/);
    if (m2) {
      const h = parseInt(m2[1] ?? "0", 10);
      const min = parseInt(m2[2] ?? "0", 10);
      return -(h * 60 + min);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Tooltip component for displaying timezone information on hover */
export function GlobeTooltip({
  timezone,
  position,
  open,
}: GlobeTooltipProps): React.ReactElement {
  const [localTime, setLocalTime] = React.useState<string>("");
  const [dstInEffect, setDstInEffect] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!open || !timezone) return undefined;

    const year = new Date().getUTCFullYear();
    const jan = new Date(Date.UTC(year, 0, 1));
    const jul = new Date(Date.UTC(year, 6, 1));
    const offsetJan = parseGmtOffsetMinutes(timezone, jan);
    const offsetJul = parseGmtOffsetMinutes(timezone, jul);
    const observesDst = offsetJan !== offsetJul;

    const update = (): void => {
      const now = new Date();
      setLocalTime(formatLocalTime(timezone, now));
      if (observesDst) {
        const offsetNow = parseGmtOffsetMinutes(timezone, now);
        setDstInEffect(offsetNow === Math.min(offsetJan, offsetJul));
      } else {
        setDstInEffect(false);
      }
    };

    update();
    const id = setInterval(update, 1000);
    return (): void => {
      clearInterval(id);
    };
  }, [open, timezone]);

  if (!timezone || !open) return <></>;

  const year = new Date().getUTCFullYear();
  const jan = new Date(Date.UTC(year, 0, 1));
  const jul = new Date(Date.UTC(year, 6, 1));
  const offsetJan = parseGmtOffsetMinutes(timezone, jan);
  const offsetJul = parseGmtOffsetMinutes(timezone, jul);
  const observesDst = offsetJan !== offsetJul;

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
          boxShadow: "0 2px 8px rgba(0,0,0,0.18), 0 0.5px 2px rgba(0,0,0,0.12)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.2 }}>
          {timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone}
        </div>
        <div style={{ color: "#666", fontSize: "0.7rem", marginBottom: 1 }}>
          {timezone}
        </div>
        <div style={{ color: "#666", fontSize: "0.75rem", fontWeight: 500 }}>
          {formatUtcOffset(timezone)}
        </div>
        <div
          style={{
            color: "#333",
            fontSize: "0.9rem",
            fontWeight: 600,
            marginTop: 6,
          }}
        >
          {localTime}
        </div>
        <div style={{ color: "#666", fontSize: "0.7rem", marginTop: 2 }}>
          {observesDst
            ? dstInEffect
              ? "DST in effect"
              : "Standard time"
            : "No DST"}
        </div>
      </div>
    </div>
  );
}
