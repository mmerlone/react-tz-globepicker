import React from "react";

/**
 * A reusable space background component with gradient effects.
 * Can be passed to the TzGlobePicker `background` prop.
 */
export function SpaceBackground(): React.ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: [
          "radial-gradient(circle at 20% 80%, rgba(186, 119, 198, 0.3) 0%, transparent 50%)",
          "radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%)",
          "radial-gradient(circle at 40% 40%, rgba(0, 187, 255, 0.83) 0%, transparent 50%)",
          "radial-gradient(ellipse at center, #0a0e27 0%, #020515 40%, #000000 100%)",
        ].join(", "),
        pointerEvents: "none",
      }}
    />
  );
}
