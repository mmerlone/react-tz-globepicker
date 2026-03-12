import React from "react";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Section({
  title,
  children,
  defaultOpen = true,
  isOpen,
  onToggle,
}: SectionProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isControlled = typeof isOpen === "boolean";
  const open = isControlled ? isOpen : internalOpen;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.();
      return;
    }

    setInternalOpen(!internalOpen);
  };

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        paddingBottom: 12,
      }}
    >
      <button
        onClick={handleToggle}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          background: "none",
          border: "none",
          color: "#e0e0e0",
          cursor: "pointer",
          padding: "4px 0",
          marginBottom: open ? 10 : 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{title}</span>
        <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}
