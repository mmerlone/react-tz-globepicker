import type { GlobePalette } from "../types/globe.types";
import { buildLogger } from "../../../logger/client";
import hexRgb from "hex-rgb";

const logger = buildLogger("WebGLPenumbraRenderer");

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_radius;
uniform vec3 u_sunDirection;
uniform vec3 u_dayColor;
uniform vec3 u_nightColor;
uniform float u_opacity;

// Convert screen coordinates to sphere coordinates
vec3 screenToSphere(vec2 screenPos) {
  vec2 center = u_resolution * 0.5;
  
  vec2 pos = (screenPos - center) / u_radius;
  float distSq = dot(pos, pos);
  
  // Outside sphere - discard
  if (distSq > 1.0) {
    discard;
  }
  
  // Calculate z coordinate on sphere surface
  float z = sqrt(1.0 - distSq);
  
  return normalize(vec3(pos, z));
}

void main() {
  vec2 screenPos = gl_FragCoord.xy;
  vec3 normal = screenToSphere(screenPos);
  
  // Lambertian lighting: dot(surfaceNormal, sunDirection)
  float diffuse = dot(normal, u_sunDirection);
  
  // Smooth penumbra transition
  float nightFactor = smoothstep(0.1, -0.2, diffuse);
  
  // Only apply night color with varying opacity for the shadow
  // We MUST output pre-multiplied alpha since the WebGL context uses it by default when composited
  float alpha = nightFactor * u_opacity;
  gl_FragColor = vec4(u_nightColor * alpha, alpha);
}
`;

/**
 * WebGL program for penumbra rendering
 */
export interface WebGLRendererProgram {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  canvas: HTMLCanvasElement;
  uniformLocations: {
    resolution: WebGLUniformLocation;
    radius: WebGLUniformLocation;
    sunDirection: WebGLUniformLocation;
    dayColor: WebGLUniformLocation;
    nightColor: WebGLUniformLocation;
    opacity: WebGLUniformLocation;
  };
}

/**
 * Create and compile a shader
 */
function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    logger.error(
      { error: gl.getShaderInfoLog(shader) },
      "Shader compilation error",
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Initialize WebGL context and shader program
 */
export function createWebGLRenderer(
  canvas: HTMLCanvasElement,
): WebGLRendererProgram | null {
  const gl =
    canvas.getContext("webgl", { alpha: true, antialias: true }) ??
    canvas.getContext("experimental-webgl", { alpha: true, antialias: true });

  if (!gl) {
    return null;
  }

  const webglContext = gl as WebGLRenderingContext;

  // Create shaders
  const vertexShader = createShader(
    webglContext,
    webglContext.VERTEX_SHADER,
    VERTEX_SHADER,
  );
  const fragmentShader = createShader(
    webglContext,
    webglContext.FRAGMENT_SHADER,
    FRAGMENT_SHADER,
  );

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) webglContext.deleteShader(vertexShader);
    if (fragmentShader) webglContext.deleteShader(fragmentShader);
    return null;
  }

  // Create program
  const program = webglContext.createProgram();
  if (!program) return null;

  webglContext.attachShader(program, vertexShader);
  webglContext.attachShader(program, fragmentShader);
  webglContext.linkProgram(program);

  if (!webglContext.getProgramParameter(program, webglContext.LINK_STATUS)) {
    logger.error(
      { error: webglContext.getProgramInfoLog(program) },
      "Unable to initialize shader program",
    );
    return null;
  }

  // Create position buffer for full-screen quad
  const positionBuffer = webglContext.createBuffer();
  if (!positionBuffer) return null;

  webglContext.bindBuffer(webglContext.ARRAY_BUFFER, positionBuffer);
  webglContext.bufferData(
    webglContext.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    webglContext.STATIC_DRAW,
  );

  // Get uniform locations
  const uniformLocations = {
    resolution: webglContext.getUniformLocation(program, "u_resolution")!,
    radius: webglContext.getUniformLocation(program, "u_radius")!,
    sunDirection: webglContext.getUniformLocation(program, "u_sunDirection")!,
    dayColor: webglContext.getUniformLocation(program, "u_dayColor")!,
    nightColor: webglContext.getUniformLocation(program, "u_nightColor")!,
    opacity: webglContext.getUniformLocation(program, "u_opacity")!,
  };

  return {
    gl: webglContext,
    program,
    positionBuffer,
    canvas,
    uniformLocations,
  } as WebGLRendererProgram;
}

/**
 * Convert longitude/latitude to Cartesian coordinates
 */
export function latLonToCartesian(
  lng: number,
  lat: number,
): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180); // Convert to radians from north pole
  const theta = (lng + 180) * (Math.PI / 180); // Convert to radians from prime meridian

  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);

  // Note: D3 Orthographic projection by default has +Y pointing up in screen coords??
  // No, D3 screen coords have +Y pointing down.
  // Our shader gl_FragCoord.xy has (0,0) at bottom-left.

  return [x, y, z];
}

/**
 * Calculate sun direction from subsolar point
 */
export function calculateSunDirection(
  subsolarPoint: [number, number],
): [number, number, number] {
  const [sunLng, sunLat] = subsolarPoint;
  const cartesian = latLonToCartesian(sunLng, sunLat);
  return cartesian;
}

/**
 * Render penumbra using WebGL
 */
export function renderWebGLPenumbra(
  renderer: WebGLRendererProgram,
  canvas: HTMLCanvasElement,
  radius: number,
  sunDirection: [number, number, number],
  colors: GlobePalette,
  opacity: number = 0.7,
): void {
  const { gl, program, positionBuffer, uniformLocations } = renderer;

  // Set viewport
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Clear canvas (fully transparent)
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Use shader program
  gl.useProgram(program);

  // Set up position attribute
  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Set uniforms
  gl.uniform2f(uniformLocations.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniformLocations.radius, radius);
  gl.uniform3fv(uniformLocations.sunDirection, sunDirection);

  // Convert colors to RGB [0-1] range
  const dayColor = colors.ocean;
  const nightColor = "rgb(0,0,40)"; // Standard dark blue for night

  const parseToRGB = (colorStr: string): [number, number, number] => {
    try {
      const result = hexRgb(colorStr);
      return [result.red / 255, result.green / 255, result.blue / 255];
    } catch {
      // Fallback for rgb() strings or others
      if (colorStr.startsWith("rgb")) {
        const parts = colorStr.match(/\d+/g);
        if (parts && parts.length >= 3) {
          return [
            Number(parts[0]) / 255,
            Number(parts[1]) / 255,
            Number(parts[2]) / 255,
          ];
        }
      }
      return [0, 0, 0];
    }
  };

  const dayRGB = parseToRGB(dayColor);
  const nightRGB = parseToRGB(nightColor);

  gl.uniform3fv(uniformLocations.dayColor, dayRGB);
  gl.uniform3fv(uniformLocations.nightColor, nightRGB);
  gl.uniform1f(uniformLocations.opacity, opacity);

  // Enable blending for smooth edges
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  // Draw full-screen quad
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Disable blending
  gl.disable(gl.BLEND);
}

/**
 * Clean up WebGL resources
 */
export function disposeWebGLRenderer(renderer: WebGLRendererProgram): void {
  const { gl, program, positionBuffer } = renderer;

  gl.deleteBuffer(positionBuffer);
  gl.deleteProgram(program);
}
