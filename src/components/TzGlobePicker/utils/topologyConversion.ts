import type { FeatureCollection } from "geojson";
import type { Topology } from "topojson-specification";
import { feature } from "topojson-client";

/**
 * Type conversion utilities to handle TopoJSON module mismatches.
 * These utilities provide safe conversions between different type expectations
 * from various TopoJSON generators and data sources.
 */

/**
 * Interface for generated topology with flexible structure.
 * Using loose types to handle module compatibility issues where
 * different generators may produce slightly different object shapes.
 */
interface GeneratedTopology {
  /** Topology type identifier (e.g., "Topology", "topology") */
  type?: string;
  /** Bounding box [minX, minY, maxX, maxY] if available */
  bbox?: number[] | undefined;
  /** Objects collection with arbitrary string keys */
  objects?: Record<string, unknown>;
  /** Arcs/lines data - supports both nested and flat array formats */
  arcs?: number[][][] | number[][] | undefined;
  /** Transformation specification for scaling, translation, etc. */
  transform?:
    | {
        scale?: number[] | undefined;
        translate?: number[] | undefined;
      }
    | undefined;
  /** Dynamic properties with string keys */
  [key: string]: unknown;
}

/**
 * Convert our generated topology to standard Topology type.
 * Handles bbox format differences and arc structure variations
 * between different TopoJSON generation tools.
 *
 * @param generatedTopology - Raw topology data from external source
 * @returns Standard Topology object with proper type structure
 * @throws Error if topology data is invalid or not an object
 *
 * @example
 * ```typescript
 * const rawTopology = loadTopologyData(); // From external source
 * const standardTopology = convertToStandardTopology(rawTopology);
 * // Now safe to use with type-aware tools
 * ```
 */
export function convertToStandardTopology(
  generatedTopology: GeneratedTopology,
): Topology {
  // Basic validation of input data
  if (!generatedTopology || typeof generatedTopology !== "object") {
    throw new Error("Invalid topology data");
  }

  // Create a shallow copy to avoid mutating the input, then normalize
  return {
    ...generatedTopology,
    type: "Topology",
  } as Topology;
}

/**
 * Safely extract features from topology with proper type handling.
 *
 * This function handles the complexity of TopoJSON data structures where:
 * - Features may be nested under objects with arbitrary keys
 * - Result may be a single Feature or FeatureCollection
 * - Different generators use different data organization patterns
 *
 * @param topology - Standard Topology object to extract features from
 * @param objectKey - Key to locate the geometry object within topology.objects
 * @returns FeatureCollection if successful, null if extraction fails
 *
 * @example
 * ```typescript
 * const topology = loadStandardTopology();
 * const countries = extractFeatures(topology, 'countries');
 * if (countries) {
 *   // Use with geoPath generator
 *   geoPath(topology)(countries.features);
 * }
 * ```
 */
export function extractFeatures(
  topology: Topology,
  objectKey: string,
): FeatureCollection | null {
  const geometryObject = topology.objects[objectKey];
  if (!geometryObject) {
    return null;
  }

  // Use topojson-client's native feature extraction.
  // This correctly parses GeometryCollections into FeatureCollections
  // without dropping geometries that lack specific properties like 'tzid'.
  const extracted = feature(topology, geometryObject);

  if (!extracted) {
    return null;
  }

  if (extracted.type === "FeatureCollection") {
    return extracted;
  } else if (extracted.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [extracted],
    };
  }

  return null;
}
