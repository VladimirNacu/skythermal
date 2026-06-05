// Animated wind particles — guide section 8.
// A MapLibre CustomLayerInterface that advects particles through a synthetic
// vector field and recolors trails by speed. The vector field here is generated
// procedurally (smooth pseudo-flow) so the layer runs without a U/V tile backend;
// swap `sampleField` for a texture sampler once /v1/map/wind-vector-tile exists.

import type { CustomLayerInterface, Map as MlMap } from "maplibre-gl";

interface Particle {
  x: number; // normalized 0..1 across viewport
  y: number;
  px: number;
  py: number;
  age: number;
  maxAge: number;
}

const VERT = `
attribute vec2 a_pos;
attribute vec4 a_color;
varying vec4 v_color;
void main() {
  // a_pos in clip space already (-1..1)
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_color = a_color;
}`;

const FRAG = `
precision mediump float;
varying vec4 v_color;
void main() { gl_FragColor = v_color; }`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || "shader compile failed");
  }
  return sh;
}

// Wind speed (0..1 of max) → RGBA on the SkyThermal ramp.
function rampColor(speed: number): [number, number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0.0, [0x26, 0x7b, 0xd4]],
    [0.125, [0x1c, 0xc0, 0xb2]],
    [0.25, [0x59, 0xc5, 0x5a]],
    [0.375, [0xd2, 0xbd, 0x32]],
    [0.5, [0xf1, 0x85, 0x2d]],
    [0.625, [0xdd, 0x48, 0x4a]],
    [0.75, [0xc3, 0x31, 0x90]],
    [1.0, [0x73, 0x2b, 0xce]],
  ];
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (speed >= stops[i][0] && speed <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const t = (speed - lo[0]) / Math.max(1e-6, hi[0] - lo[0]);
  const c = (a: number, b: number) => (a + (b - a) * t) / 255;
  return [c(lo[1][0], hi[1][0]), c(lo[1][1], hi[1][1]), c(lo[1][2], hi[1][2]), 0.85];
}

export class WindParticleLayer implements CustomLayerInterface {
  id: string;
  type = "custom" as const;
  renderingMode = "2d" as const;

  private map: MlMap | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private aPos = 0;
  private aColor = 0;

  private particles: Particle[] = [];
  private count: number;
  private fade: number;
  private lastT = 0;
  private fieldRotation = 0; // animates the synthetic field over time

  /** Field direction offset, set from the dominant site wind so flow matches data. */
  public fieldBearingDeg = 315;
  public speedScale = 1;
  public enabled = true;

  constructor(id = "wind-particles", count = 6000, fade = 0.92) {
    this.id = id;
    this.count = count;
    this.fade = fade;
  }

  onAdd(map: MlMap, gl: WebGLRenderingContext) {
    this.map = map;
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    this.program = prog;
    this.aPos = gl.getAttribLocation(prog, "a_pos");
    this.aColor = gl.getAttribLocation(prog, "a_color");
    this.buffer = gl.createBuffer();
    this.seed();
  }

  private seed() {
    this.particles = Array.from({ length: this.count }, () => this.spawn());
  }

  private spawn(): Particle {
    const x = Math.random();
    const y = Math.random();
    return { x, y, px: x, py: y, age: 0, maxAge: 40 + Math.random() * 80 };
  }

  // Synthetic smooth vector field. Returns [u, v, speed01].
  private sampleField(x: number, y: number): [number, number, number] {
    const base = (this.fieldBearingDeg * Math.PI) / 180;
    // layered sinusoids give a swirling but coherent flow
    const a =
      base +
      0.6 * Math.sin(x * 6.0 + this.fieldRotation) +
      0.4 * Math.cos(y * 5.0 - this.fieldRotation * 0.7);
    const speed =
      0.45 +
      0.35 * Math.sin(x * 4.0 + y * 4.0 + this.fieldRotation * 0.5) * 0.5 +
      0.2 * Math.cos(y * 8.0);
    const s = Math.min(1, Math.max(0.05, speed)) * this.speedScale;
    return [Math.cos(a) * s, -Math.sin(a) * s, Math.min(1, s)];
  }

  render(gl: WebGLRenderingContext) {
    if (!this.program || !this.enabled) return;
    const now = performance.now();
    const dt = this.lastT ? Math.min(0.05, (now - this.lastT) / 1000) : 0.016;
    this.lastT = now;
    this.fieldRotation += dt * 0.15;

    const verts: number[] = [];
    const speedMove = 0.06; // normalized units / sec

    for (const p of this.particles) {
      const [u, v, s] = this.sampleField(p.x, p.y);
      p.px = p.x;
      p.py = p.y;
      p.x += u * speedMove * dt;
      p.y += v * speedMove * dt;
      p.age += dt * 30;

      if (p.age > p.maxAge || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        Object.assign(p, this.spawn());
        continue;
      }

      const [r, g, b, a] = rampColor(s);
      // clip space: x -1..1, y +1..-1
      const cx0 = p.px * 2 - 1;
      const cy0 = 1 - p.py * 2;
      const cx1 = p.x * 2 - 1;
      const cy1 = 1 - p.y * 2;
      verts.push(cx0, cy0, r, g, b, a, cx1, cy1, r, g, b, a);
    }

    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);

    const stride = 6 * 4;
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.aColor);
    gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, stride, 2 * 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.lineWidth(1.0);
    gl.drawArrays(gl.LINES, 0, verts.length / 6);

    if (this.map && this.enabled) this.map.triggerRepaint();
  }

  onRemove() {
    const gl = this.gl;
    if (gl) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.program) gl.deleteProgram(this.program);
    }
  }
}
