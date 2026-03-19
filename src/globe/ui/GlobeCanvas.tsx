import React from "react";

export interface GlobeCanvasProps {
  /** Reference to the underlying HTML5 Canvas element */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Width and height of the canvas in CSS pixels */
  size: number;
}

/**
 * Presentational component that renders the physical HTML5 Canvas element
 * where the interactive 3D globe is drawn.
 */
export function GlobeCanvas({
  canvasRef,
  size,
}: GlobeCanvasProps): React.ReactElement {
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: "block",
        touchAction: "none",
        backgroundColor: "transparent",
        position: "relative",
        zIndex: 1,
      }}
    />
  );
}
