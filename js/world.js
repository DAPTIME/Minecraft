import * as THREE from "three";
import { fbm, makeRng } from "./noise.js";
import { generateVillage } from "./villages.js";
import { generateDesertTemple, generateDesertWell, generatePillagerOutpost } from "./structures.js";

export const CHUNK = 16;
export const HEIGHT = 72;
export const SEA = 24;

// --- block registry ----------------------------------------------------------
// transparent: neighbouring faces are still drawn against this block
// solid: has collision
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6,
  WATER: 7, LOG: 8, LEAVES: 9, PLANKS: 10, GLASS: 11, BEDROCK: 12, PATH: 13,
  SANDSTONE: 14, ORANGE: 15, CACTUS: 16,
};

export const BLOCKS = {
  [B.GRASS]:  { name: "Grass",       top: "grass_top", side: "grass_side", bottom: "dirt", solid: true },
  [B.DIRT]:   { name: "Dirt",        all: "dirt", solid: true },
  [B.STONE]:  { name: "Stone",       all: "stone", solid: true },
  [B.COBBLE]: { name: "Cobblestone", all: "cobblestone", solid: true },
  [B.SAND]:   { name: "Sand",        all: "sand", solid: true },
  [B.GRAVEL]: { name: "Gravel",      all: "gravel", solid: true },
  [B.WATER]:  { name: "Water",       all: "water", solid: false, transparent: true, liquid: true },
  [B.LOG]:    { name: "Oak Log",     top: "log_top", side: "log_side", bottom: "log_top", solid: true },
  [B.LEAVES]: { name: "Leaves",      all: "leaves", solid: true, transparent: true },
  [B.PLANKS]: { name: "Oak Planks",  all: "planks", solid: true },
  [B.GLASS]:  { name: "Glass",       all: "glass", solid: true, transparent: true },
  [B.BEDROCK]:{ name: "Bedrock",     all: "bedrock", solid: true },
  [B.PATH]:   { name: "Path",        top: "path", side: "grass_side", bottom: "dirt", solid: true },
  [B.SANDSTONE]: { name: "Sandstone", all: "sandstone", solid: true },
  [B.ORANGE]: { name: "Orange Block", all: "orange", solid: true },
  [B.CACTUS]: { name: "Cactus",      all: "cactus", solid: true },
};

function faceTile(id, face) {
  const b = BLOCKS[id];
  if (b.all) return b.all;
  if (face === "top") return b.top;
  if (face === "bottom") return b.bottom;
  return b.side;
}

// face geometry data: dir, corner offsets, normal, light
const FACES = [
  { name: "px", dir: [1, 0, 0], n: [1, 0, 0], light: 0.78,
    corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { name: "nx", dir: [-1, 0, 0], n: [-1, 0, 0], light: 0.78,
    corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { name: "py", dir: [0, 1, 0], n: [0, 1, 0], light: 1.0,
    corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
  { name: "ny", dir: [0, -1, 0], n: [0, -1, 0], light: 0.5,
    corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] },
  { name: "pz", dir: [0, 0, 1], n: [0, 0, 1], light: 0.62,
    corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { name: "nz", dir: [0, 0, -1], n: [0, 0, -1], light: 0.62,
    corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
const FACE_KEY = { px: "side", nx: "side", py: "top", ny: "bottom", pz: "side", nz: "side" };

export class World {
  constructor(seed, atlas) {
    this.seed = seed >>> 0;
    this.atlas = atlas;
    this.chunks = new Map();      // "cx,cz" -> Uint8Array
    this.terrainDone = new Set();
    this.decorated = new Set();
  }

  key(cx, cz) { return cx + "," + cz; }

  // surface height of a world column
  surfaceHeight(wx, wz) {
    const cont = fbm(wx, wz, this.seed, 4, 0.0075);
    const hills = fbm(wx, wz, this.seed + 7, 4, 0.03);
    let h = 14 + cont * 30 + hills * 10;
    return Math.max(2, Math.min(HEIGHT - 12, Math.floor(h)));
  }

  // biome of a world column: "desert" or "plains"
  biome(wx, wz) {
    return fbm(wx, wz, this.seed + 555, 3, 0.0045) > 0.6 ? "desert" : "plains";
  }

  ensureTerrain(cx, cz) {
    const k = this.key(cx, cz);
    if (this.terrainDone.has(k)) return this.chunks.get(k);
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = this.surfaceHeight(wx, wz);
        const beach = h <= SEA + 1;
        const desert = this.biome(wx, wz) === "desert";
        for (let y = 0; y < HEIGHT; y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y < h - 4) id = B.STONE;
          else if (y < h) id = desert ? (y < h - 1 ? B.SANDSTONE : B.SAND)
                                       : (beach ? B.SAND : B.DIRT);
          else if (y === h) id = desert ? B.SAND : (beach ? B.SAND : B.GRASS);
          else if (y <= SEA) id = B.WATER;
          data[this.idx(x, y, z)] = id;
        }
      }
    this.chunks.set(k, data);
    this.terrainDone.add(k);
    return data;
  }

  // generate terrain + trees + villages
  generateChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.decorated.has(k)) return this.chunks.get(k);
    this.ensureTerrain(cx, cz);
    this.decorated.add(k);            // mark first to avoid recursion via setBlockGen

    const rng = makeRng(this.seed ^ (cx * 341873128) ^ (cz * 132897987));
    const m = (v, n) => ((v % n) + n) % n;
    const acx = cx * CHUNK + 8, acz = cz * CHUNK + 8;   // chunk centre
    const centreBiome = this.biome(acx, acz);

    // villages: one anchor per 4x4 chunk grid, plains only
    if (m(cx, 4) === 0 && m(cz, 4) === 0 && centreBiome === "plains") {
      const vrng = makeRng(this.seed ^ (cx * 91138233) ^ (cz * 471232));
      if (vrng() < 0.5) generateVillage(this, cx, cz, vrng);
    }

    // desert temple (pyramid): 3x3 chunk grid, desert only
    if (m(cx, 3) === 1 && m(cz, 3) === 1 && centreBiome === "desert") {
      const trng = makeRng(this.seed ^ (cx * 70253) ^ (cz * 1992873));
      if (trng() < 0.6) generateDesertTemple(this, cx * CHUNK + 1, cz * CHUNK + 1, trng);
    }

    // desert well: 3x3 chunk grid offset, desert only
    if (m(cx, 3) === 2 && m(cz, 3) === 2 && centreBiome === "desert") {
      const wrng = makeRng(this.seed ^ (cx * 553) ^ (cz * 8821));
      if (wrng() < 0.45) generateDesertWell(this, acx, acz, wrng);
    }

    // pillager outpost: 6x6 chunk grid
    if (m(cx, 6) === 3 && m(cz, 6) === 3) {
      const org = makeRng(this.seed ^ (cx * 33119) ^ (cz * 60101));
      if (org() < 0.5) generatePillagerOutpost(this, cx * CHUNK + 5, cz * CHUNK + 5, org);
    }

    // trees (plains only)
    for (let x = 2; x < CHUNK - 2; x++)
      for (let z = 2; z < CHUNK - 2; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = this.surfaceHeight(wx, wz);
        if (h <= SEA) continue;
        if (this.biome(wx, wz) === "desert") {
          // cacti
          if (rng() < 0.012 && this.getBlock(wx, h, wz) === B.SAND) {
            const tall = 1 + ((rng() * 3) | 0);
            for (let i = 1; i <= tall; i++) this.setBlockGen(wx, h + i, wz, B.CACTUS);
          }
          continue;
        }
        if (rng() > 0.018) continue;
        if (this.getBlock(wx, h, wz) !== B.GRASS) continue;
        this.placeTree(wx, h + 1, wz, rng);
      }
    return this.chunks.get(k);
  }

  placeTree(wx, wy, wz, rng) {
    const trunk = 4 + ((rng() * 3) | 0);
    for (let i = 0; i < trunk; i++) this.setBlockGen(wx, wy + i, wz, B.LOG);
    const top = wy + trunk;
    for (let dy = -2; dy <= 1; dy++)
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
          if (dx === 0 && dz === 0 && dy < 1) continue;
          const r = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (r > 4 || (dy === 1 && r > 3)) continue;
          const x = wx + dx, y = top + dy, z = wz + dz;
          if (this.getBlock(x, y, z) === B.AIR) this.setBlockGen(x, y, z, B.LEAVES);
        }
  }

  idx(x, y, z) { return (y * CHUNK + z) * CHUNK + x; }

  // world-coord block access
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return B.AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return B.AIR;
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    return data[this.idx(lx, wy, lz)];
  }

  // used during generation: auto-creates neighbour terrain
  setBlockGen(wx, wy, wz, id) {
    if (wy < 0 || wy >= HEIGHT) return;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.ensureTerrain(cx, cz);
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    data[this.idx(lx, wy, lz)] = id;
  }

  // runtime edit; returns affected chunk keys (incl. neighbours on borders)
  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= HEIGHT) return [];
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return [];
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    data[this.idx(lx, wy, lz)] = id;
    const affected = [this.key(cx, cz)];
    if (lx === 0) affected.push(this.key(cx - 1, cz));
    if (lx === CHUNK - 1) affected.push(this.key(cx + 1, cz));
    if (lz === 0) affected.push(this.key(cx, cz - 1));
    if (lz === CHUNK - 1) affected.push(this.key(cx, cz + 1));
    return affected;
  }

  isOpaque(wx, wy, wz) {
    const id = this.getBlock(wx, wy, wz);
    if (id === B.AIR) return false;
    return !BLOCKS[id].transparent;
  }

  // build opaque / cutout (leaves+glass) / water meshes for a chunk
  buildMesh(cx, cz) {
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return null;
    const opaque = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const cutout = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const water  = { pos: [], norm: [], uv: [], col: [], idx: [] };

    for (let y = 0; y < HEIGHT; y++)
      for (let z = 0; z < CHUNK; z++)
        for (let x = 0; x < CHUNK; x++) {
          const id = data[this.idx(x, y, z)];
          if (id === B.AIR) continue;
          const block = BLOCKS[id];
          const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
          const target = block.liquid ? water : block.transparent ? cutout : opaque;

          for (const f of FACES) {
            const nx = wx + f.dir[0], ny = y + f.dir[1], nz = wz + f.dir[2];
            const nid = this.getBlock(nx, ny, nz);
            if (nid !== B.AIR) {
              const nb = BLOCKS[nid];
              if (!nb.transparent) continue;            // hidden by opaque
              if (nid === id) continue;                 // same transparent block
              if (block.transparent && !block.liquid && nb.transparent) continue;
            }
            this.pushFace(target, x, y, z, f, faceTile(id, FACE_KEY[f.name]));
          }
        }

    return {
      opaque: this.toGeometry(opaque),
      cutout: this.toGeometry(cutout),
      water:  this.toGeometry(water),
    };
  }

  pushFace(t, x, y, z, f, tileName) {
    const uv = this.atlas.uv[tileName];
    const base = t.pos.length / 3;
    const c = f.corners;
    for (let i = 0; i < 4; i++) {
      t.pos.push(x + c[i][0], y + c[i][1], z + c[i][2]);
      t.norm.push(f.n[0], f.n[1], f.n[2]);
      t.col.push(f.light, f.light, f.light);
    }
    t.uv.push(uv.u0, uv.v0,  uv.u0, uv.v1,  uv.u1, uv.v1,  uv.u1, uv.v0);
    t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  toGeometry(t) {
    if (t.idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(t.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(t.norm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(t.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(t.col, 3));
    g.setIndex(t.idx);
    return g;
  }
}
