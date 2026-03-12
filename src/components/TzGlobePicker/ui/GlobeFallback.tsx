import React from "react";

/**
 * Props for the GlobeFallback component.
 */
export interface GlobeFallbackProps {
  /** Whether geographic data is currently loading */
  isLoading: boolean;
  /** Whether geographic data has been successfully loaded */
  hasData: boolean;
  /** Any error that occurred during data loading */
  error: Error | null;
}

/**
 * Fallback component displayed when the globe data is loading or fails to load.
 * Returns null if data is loaded successfully, allowing the main globe to render.
 */
export function GlobeFallback({
  isLoading,
  hasData,
  error,
}: GlobeFallbackProps): React.ReactElement | null {
  // Check error first (when not actively loading)
  if (error && !isLoading) {
    return <>Failed to load globe data</>;
  }

  if (isLoading) {
    return <>Loading globe...</>;
  }

  if (!hasData) {
    return <>No geographic data available</>;
  }

  return null;
}
