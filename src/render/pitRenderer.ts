import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Axis, Cell, Direction } from '../domain/geometry';
import { bounds } from '../domain/geometry';
import type { Vec3 } from './faces';
import { exposedFaces, outlineEdges } from './faces';

/** Colour of each pit layer, from the floor upwards (cycled for deep pits). */
export const LAYER_COLORS = [
  '#c81414', '#b416a8', '#14a6b4', '#18a018', '#1e2ed2', '#bdbdbd',
  '#d08418', '#7c3ad8', '#d6d218', '#e85a5a', '#30d49c', '#5a78ff',
];
export const layerColor = (z: number): string => LAYER_COLORS[z % LAYER_COLORS.length];

const GRID_COLOR = 0x0b8a1a;
const PIECE_COLOR = 0xffffff;
const BOTTOM_COLOR = 0xffb020;

export interface RenderStyle {
  transparency: number; // 0..10
  lineWidth: number; // 0..10
  rotationSpeed: number; // 0..10
}

export type PieceHint = { type: 'rotate'; axis: Axis; dir: Direction } | { type: 'shift'; delta: Vec3 } | { type: 'none' };

const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

/** Draws the Blockout pit as seen from above: green wire walls, layer-coloured cubes, wireframe piece. */
export class PitRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private readonly grid = new THREE.Group();
  private readonly stack = new THREE.Group();
  private readonly pieceRoot = new THREE.Group();
  private readonly pieceContent = new THREE.Group();
  private readonly stackEdgeMaterial = new LineMaterial({ color: 0x000000, linewidth: 1, transparent: true, opacity: 0.55 });
  private readonly pieceMaterial = new LineMaterial({ color: PIECE_COLOR, linewidth: 2 });
  private readonly bottomMaterial = new LineMaterial({ color: BOTTOM_COLOR, linewidth: 3 });
  private readonly bottomFill = new THREE.MeshBasicMaterial({
    color: BOTTOM_COLOR, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide,
  });
  private stackMaterial: THREE.Material | null = null;
  private size = { w: 5, h: 5, d: 12 };
  private style: RenderStyle = { transparency: 0, lineWidth: 2, rotationSpeed: 5 };
  private anim: { start: number; duration: number; from: THREE.Quaternion; offset: THREE.Vector3 } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.up.set(0, 1, 0);
    this.pieceRoot.add(this.pieceContent);
    this.scene.add(this.grid, this.stack, this.pieceRoot);
  }

  configure(w: number, h: number, d: number): void {
    this.size = { w, h, d };
    this.buildGrid();
    this.resize();
  }

  setStyle(style: RenderStyle): void {
    this.style = style;
    this.pieceMaterial.linewidth = 1.2 + style.lineWidth * 0.35;
    this.bottomMaterial.linewidth = this.pieceMaterial.linewidth + 1;
  }

  resize(): void {
    const { clientWidth: cw, clientHeight: ch } = this.canvas;
    if (!cw || !ch) return;
    this.renderer.setSize(cw, ch, false);
    const { w, h, d } = this.size;
    const aspect = cw / ch;
    // Camera distance proportional to depth keeps the floor at about a third of the rim size.
    const dist = d * 0.55;
    const halfV = Math.max(h / 2, w / 2 / aspect) * 1.01;
    this.camera.aspect = aspect;
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfV / dist));
    this.camera.position.set(w / 2, h / 2, d + dist);
    this.camera.lookAt(w / 2, h / 2, 0);
    this.camera.updateProjectionMatrix();
    for (const m of [this.stackEdgeMaterial, this.pieceMaterial, this.bottomMaterial]) m.resolution.set(cw, ch);
  }

  private lines(segments: [Vec3, Vec3][], material: LineMaterial): LineSegments2 {
    const geometry = new LineSegmentsGeometry().setPositions(segments.flatMap(([a, b]) => [...a, ...b]));
    return new LineSegments2(geometry, material);
  }

  private clear(group: THREE.Group): void {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
    });
    group.clear();
  }

  private buildGrid(): void {
    this.clear(this.grid);
    const { w, h, d } = this.size;
    const seg: Vec3[] = [];
    const add = (a: Vec3, b: Vec3) => seg.push(a, b);
    for (let x = 0; x <= w; x++) add([x, 0, 0], [x, h, 0]);
    for (let y = 0; y <= h; y++) add([0, y, 0], [w, y, 0]);
    for (let z = 0; z <= d; z++) {
      add([0, 0, z], [w, 0, z]);
      add([w, 0, z], [w, h, z]);
      add([w, h, z], [0, h, z]);
      add([0, h, z], [0, 0, z]);
    }
    for (let x = 0; x <= w; x++) {
      add([x, 0, 0], [x, 0, d]);
      add([x, h, 0], [x, h, d]);
    }
    for (let y = 0; y <= h; y++) {
      add([0, y, 0], [0, y, d]);
      add([w, y, 0], [w, y, d]);
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(seg.map((p) => new THREE.Vector3(...p)));
    this.grid.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: GRID_COLOR })));
  }

  /** Rebuilds the settled cubes; each one takes the colour of its layer. */
  setStack(cells: readonly Cell[]): void {
    this.clear(this.stack);
    this.stackMaterial?.dispose();
    this.stackMaterial = null;
    if (!cells.length) return;
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    for (const face of exposedFaces(cells)) {
      // Flat shading like the original: tops bright, walls darker.
      const shade = face.axis === 2 ? 1 : face.axis === 0 ? 0.62 : 0.5;
      color.set(layerColor(face.cell[2])).multiplyScalar(shade);
      const [a, b, c, dd] = face.corners;
      for (const p of [a, b, c, a, c, dd]) {
        positions.push(...p);
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const opacity = 1 - this.style.transparency * 0.08;
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity === 1,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.stackMaterial = material;
    this.stack.add(new THREE.Mesh(geometry, material));
    this.stack.add(this.lines(outlineEdges(cells), this.stackEdgeMaterial));
  }

  /**
   * Draws the falling piece as a white wireframe. The lowest layer (closest to the floor) is
   * filled and outlined in amber so the player always sees which part touches down first.
   */
  setPiece(cells: readonly Cell[] | null, hint: PieceHint = { type: 'none' }): void {
    this.clear(this.pieceContent);
    this.anim = null;
    this.pieceRoot.quaternion.identity();
    this.pieceRoot.position.set(0, 0, 0);
    this.pieceContent.position.set(0, 0, 0);
    if (!cells || !cells.length) return;

    const minZ = bounds(cells).min[2];
    const edges = outlineEdges(cells);
    const isBottomEdge = ([a, b]: [Vec3, Vec3]) => a[2] <= minZ + 1 && b[2] <= minZ + 1;
    this.pieceContent.add(this.lines(edges.filter((e) => !isBottomEdge(e)), this.pieceMaterial));
    this.pieceContent.add(this.lines(edges.filter(isBottomEdge), this.bottomMaterial));

    // Fill the faces that will touch down: the underside of the lowest layer.
    const bottom = cells.filter((c) => c[2] === minZ);
    const positions: number[] = [];
    for (const { axis, sign, corners: [a, b, c, d] } of exposedFaces(bottom)) {
      if (axis === 2 && sign === -1) for (const p of [a, b, c, a, c, d]) positions.push(...p);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const fill = new THREE.Mesh(geometry, this.bottomFill);
    fill.name = 'bottom-layer';
    this.pieceContent.add(fill);

    this.startAnimation(cells, hint);
  }

  private startAnimation(cells: readonly Cell[], hint: PieceHint): void {
    const { min, max } = bounds(cells);
    const pivot = new THREE.Vector3((min[0] + max[0] + 1) / 2, (min[1] + max[1] + 1) / 2, (min[2] + max[2] + 1) / 2);
    this.pieceRoot.position.copy(pivot);
    this.pieceContent.position.copy(pivot).negate();
    const duration = (10 - this.style.rotationSpeed) * 22;
    if (duration <= 0 || hint.type === 'none') return;
    const from = new THREE.Quaternion();
    const offset = new THREE.Vector3();
    if (hint.type === 'rotate') from.setFromAxisAngle(AXIS_VECTORS[hint.axis], (-hint.dir * Math.PI) / 2);
    else offset.set(...hint.delta);
    this.anim = { start: performance.now(), duration: hint.type === 'shift' ? duration * 0.5 : duration, from, offset };
    this.applyAnimation(0);
  }

  private applyAnimation(t: number): void {
    if (!this.anim) return;
    const e = 1 - (1 - t) ** 3;
    this.pieceRoot.quaternion.slerpQuaternions(this.anim.from, new THREE.Quaternion(), e);
    this.pieceContent.position.copy(this.pieceRoot.position).negate().add(this.anim.offset.clone().multiplyScalar(1 - e));
  }

  render(now = performance.now()): void {
    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.duration);
      this.applyAnimation(t);
      if (t >= 1) this.anim = null;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
