"use client";

import React from "react";

interface GlobeTooltipProps {
  timezone: string | null;
  position: { x: number; y: number };
  open: boolean;
  /** Simulated date for displaying timezone offsets at a specific time */
  simulatedDate?: Date;
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

// Map of US timezone abbreviations to their UTC offsets in minutes
const US_TIMEZONE_OFFSETS: Record<string, number> = {
  EST: -300, // UTC-5
  EDT: -240, // UTC-4
  CST: -360, // UTC-6
  CDT: -300, // UTC-5
  MST: -420, // UTC-7
  MDT: -360, // UTC-6
  PST: -480, // UTC-8
  PDT: -420, // UTC-7
};

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

    // Check for US timezone abbreviations first (EST, EDT, CST, etc.)
    const usOffset = US_TIMEZONE_OFFSETS[tzPart];
    if (usOffset !== undefined) {
      return usOffset;
    }

    const m = tzPart.match(/GMT([+-]?\d{1,2})(?::?(\d{2}))?/);
    if (m) {
      const h = parseInt(m[1] ?? "0", 10);
      const min = m[2] ? parseInt(m[2] ?? "0", 10) : 0;
      const sign = h >= 0 ? 1 : -1;
      return -(h * 60 + sign * min);
    }
    const m2 = tzPart.match(/([+-]\d{2}):?(\d{2})/);
    if (m2) {
      const h = parseInt(m2[1] ?? "0", 10);
      const min = parseInt(m2[2] ?? "0", 10);
      const sign = h >= 0 ? 1 : -1;
      return -(h * 60 + sign * min);
    }
  } catch {
    /* ignore */
  }
  return 0;
}

/** Format offset in minutes to UTC offset string (e.g., "UTC-4") */
function formatOffsetMinutes(minutes: number): string {
  if (minutes === 0) return "UTC";
  const hours = Math.abs(minutes) / 60;
  const sign = minutes > 0 ? "-" : "+";
  return `UTC${sign}${hours}`;
}

/** Format timezone offset as GMT offset (e.g., "GMT+5" for UTC-5), using standard time (January) */
function formatGmtOffset(timezone: string): string {
  // Use January to get the standard (non-DST) offset
  const jan = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const minutes = parseGmtOffsetMinutes(timezone, jan);
  if (minutes === 0) return "GMT";
  const hours = Math.abs(minutes) / 60;
  // UTC-5 (EST) = -300 min = GMT+5, so invert the sign
  const sign = minutes < 0 ? "+" : "-";
  return `GMT${sign}${hours}`;
}

// Simple clock icon SVG
function ClockIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l3 3" />
    </svg>
  );
}

/** Tooltip component for displaying timezone information on hover */
export function GlobeTooltip({
  timezone,
  position,
  open,
  simulatedDate,
}: GlobeTooltipProps): React.ReactElement {
  // Use simulatedDate if provided, otherwise use current date
  const effectiveDate = React.useMemo(
    () => simulatedDate ?? new Date(),
    [simulatedDate],
  );

  const [localTime, setLocalTime] = React.useState<string>("");
  const [dstInEffect, setDstInEffect] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (!open || !timezone) return undefined;

    const year = effectiveDate.getUTCFullYear();
    const jan = new Date(Date.UTC(year, 0, 1));
    const jul = new Date(Date.UTC(year, 6, 1));
    const offsetJan = parseGmtOffsetMinutes(timezone, jan);
    const offsetJul = parseGmtOffsetMinutes(timezone, jul);
    const observesDst = offsetJan !== offsetJul;

    const update = (): void => {
      setLocalTime(formatLocalTime(timezone, effectiveDate));
      if (observesDst) {
        const offsetNow = parseGmtOffsetMinutes(timezone, effectiveDate);
        // DST has the larger offset value (less negative, closer to UTC)
        setDstInEffect(offsetNow === Math.max(offsetJan, offsetJul));
      } else {
        setDstInEffect(false);
      }
    };

    update();
    // Only set up interval if not using simulated date
    if (!simulatedDate) {
      const id = setInterval(update, 1000);
      return (): void => {
        clearInterval(id);
      };
    }
    return undefined;
  }, [open, timezone, simulatedDate, effectiveDate]);

  if (!timezone || !open) return <></>;

  const year = effectiveDate.getUTCFullYear();
  const jan = new Date(Date.UTC(year, 0, 1));
  const jul = new Date(Date.UTC(year, 6, 1));
  const offsetJan = parseGmtOffsetMinutes(timezone, jan);
  const offsetJul = parseGmtOffsetMinutes(timezone, jul);
  const observesDst = offsetJan !== offsetJul;

  // Extract city name from timezone
  const cityName = timezone.split("/").pop()?.replace(/_/g, " ") ?? timezone;
  const regionName = timezone.split("/").slice(0, -1).join("/");

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y - 16,
        transform: "translate(-50%, -100%)",
        pointerEvents: "none",
        zIndex: 1300,
      }}
    >
      {/* Tooltip pointer triangle */}
      <div
        style={{
          position: "absolute",
          bottom: -6,
          left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 12,
          height: 12,
          background: "rgba(15, 23, 42, 0.95)",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          background: "rgba(15, 23, 42, 0.95)",
          color: "#e2e8f0",
          borderRadius: 12,
          padding: "14px 18px",
          minWidth: 200,
          maxWidth: 280,
          boxShadow:
            "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Location section */}
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              lineHeight: 1.2,
              color: "#ffffff",
              letterSpacing: "0.02em",
            }}
          >
            {cityName}
          </div>
          {regionName && (
            <div
              style={{
                color: "#64748b",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 2,
              }}
            >
              {regionName}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            marginBottom: 10,
          }}
        />

        {/* Time section - prominent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(6, 182, 212, 0.3)",
            }}
          >
            <ClockIcon />
          </div>
          <div>
            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                color: "#06b6d4",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
              }}
            >
              {localTime}
            </div>
          </div>
        </div>

        {/* Details section */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                color: "#475569",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              GMT Offset
            </div>
            <div
              style={{
                color: "#cbd5e1",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {formatGmtOffset(timezone)}
            </div>
          </div>
          <div>
            <div
              style={{
                color: "#475569",
                fontSize: "0.65rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Timezone
            </div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "0.7rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={timezone}
            >
              {timezone}
            </div>
          </div>
        </div>

        {/* DST/STD indicator with offsets */}
        {observesDst && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              borderRadius: 6,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(100, 116, 139, 0.3)",
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {/* DST offset */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 2,
                  }}
                >
                  DST
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: dstInEffect ? "#fbbf24" : "#475569",
                      boxShadow: dstInEffect
                        ? "0 0 6px rgba(251, 191, 36, 0.5)"
                        : "none",
                    }}
                  />
                  <span
                    style={{
                      color: dstInEffect ? "#fbbf24" : "#94a3b8",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {formatOffsetMinutes(offsetJul)}
                  </span>
                </div>
              </div>
              {/* STD offset */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 2,
                  }}
                >
                  STD
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: !dstInEffect ? "#06b6d4" : "#475569",
                      boxShadow: !dstInEffect
                        ? "0 0 6px rgba(6, 182, 212, 0.5)"
                        : "none",
                    }}
                  />
                  <span
                    style={{
                      color: !dstInEffect ? "#06b6d4" : "#94a3b8",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {formatOffsetMinutes(offsetJan)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {!observesDst && (
          <div
            style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 6,
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(100, 116, 139, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#64748b",
              }}
            />
            <span
              style={{
                color: "#94a3b8",
                fontSize: "0.7rem",
                fontWeight: 500,
              }}
            >
              No DST (year-round)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
