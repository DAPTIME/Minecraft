import * as THREE from "three";
import { fbm, fbm3, makeRng } from "./noise.js";
import { generateVillage } from "./villages.js";
import { generateDesertTemple, generatePillagerOutpost } from "./structures.js";

export const CHUNK = 16;
export const MIN_Y = -64;          // bottom of the world
export const MAX_Y = 64;           // build limit
export const HEIGHT = MAX_Y - MIN_Y + 1;
export const SEA = 24;

// --- block ids ---------------------------------------------------------------
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, GRAVEL: 6, WATER: 7,
  LOG: 8, LEAVES: 9, PLANKS: 10, GLASS: 11, BEDROCK: 12, PATH: 13,
  SANDSTONE: 14, ORANGE: 15, CACTUS: 16,
  BIRCH_LOG: 17, BIRCH_PLANKS: 18, BIRCH_LEAVES: 19,
  SPRUCE_LOG: 20, SPRUCE_PLANKS: 21, SPRUCE_LEAVES: 22,
  NETHERRACK: 23, SLIME: 24, WOOL: 25,
  REDSTONE_BLOCK: 26, REDSTONE_DUST: 27, LEVER: 28, REPEATER: 29,
  PISTON: 30, STICKY_PISTON: 31, PISTON_HEAD: 32, PORTAL: 33,
  LAVA: 34,
};

export const BLOCKS = {
  [B.GRASS]:  { name: "Grass", top: "grass_top", side: "grass_side", bottom: "dirt", solid: true },
  [B.DIRT]:   { name: "Dirt", all: "dirt", solid: true },
  [B.STONE]:  { name: "Stone", all: "stone", solid: true },
  [B.COBBLE]: { name: "Cobblestone", all: "cobblestone", solid: true },
  [B.SAND]:   { name: "Sand", all: "sand", solid: true },
  [B.GRAVEL]: { name: "Gravel", all: "gravel", solid: true },
  [B.WATER]:  { name: "Water", all: "water", solid: false, transparent: true, liquid: true },
  [B.LOG]:    { name: "Oak Log", top: "log_top", side: "log_side", bottom: "log_top", solid: true },
  [B.LEAVES]: { name: "Oak Leaves", all: "leaves", solid: true, transparent: true },
  [B.PLANKS]: { name: "Oak Planks", all: "planks", solid: true },
  [B.GLASS]:  { name: "Glass", all: "glass", solid: true, transparent: true },
  [B.BEDROCK]:{ name: "Bedrock", all: "bedrock", solid: true },
  [B.PATH]:   { name: "Path", top: "path", side: "grass_side", bottom: "dirt", solid: true },
  [B.SANDSTONE]: { name: "Sandstone", all: "sandstone", solid: true },
  [B.ORANGE]: { name: "Orange Block", all: "orange", solid: true },
  [B.CACTUS]: { name: "Cactus", all: "cactus", solid: true },
  [B.BIRCH_LOG]:    { name: "Birch Log", top: "birch_log_top", side: "birch_log_side", bottom: "birch_log_top", solid: true },
  [B.BIRCH_PLANKS]: { name: "Birch Planks", all: "birch_planks", solid: true },
  [B.BIRCH_LEAVES]: { name: "Birch Leaves", all: "birch_leaves", solid: true, transparent: true },
  [B.SPRUCE_LOG]:    { name: "Spruce Log", top: "spruce_log_top", side: "spruce_log_side", bottom: "spruce_log_top", solid: true },
  [B.SPRUCE_PLANKS]: { name: "Spruce Planks", all: "spruce_planks", solid: true },
  [B.SPRUCE_LEAVES]: { name: "Spruce Leaves", all: "spruce_leaves", solid: true, transparent: true },
  [B.NETHERRACK]: { name: "Netherrack", all: "netherrack", solid: true },
  [B.SLIME]:  { name: "Slime Block", all: "slime", solid: true, transparent: true },
  [B.WOOL]:   { name: "White Wool", all: "wool", solid: true },
  [B.REDSTONE_BLOCK]: { name: "Redstone Block", all: "redstone_block", solid: true },
  [B.REDSTONE_DUST]:  { name: "Redstone Dust", all: "redstone_dust", solid: false, transparent: true },
  [B.LEVER]:  { name: "Lever", all: "lever", solid: false, transparent: true },
  [B.REPEATER]: { name: "Repeater", all: "repeater", solid: false, transparent: true },
  [B.PISTON]: { name: "Piston", all: "piston", solid: true },
  [B.STICKY_PISTON]: { name: "Sticky Piston", all: "sticky_piston", solid: true },
  [B.PISTON_HEAD]: { name: "Piston Head", all: "piston_head", solid: true },
  [B.PORTAL]: { name: "Nether Portal", all: "portal", solid: false, transparent: true },
  [B.LAVA]:  { name: "Lava", all: "lava", solid: false, transparent: true, liquid: true },
};

function faceTile(id, face) {
  const b = BLOCKS[id];
  if (b.all) return b.all;
  if (face === "top") return b.top;
  if (face === "bottom") return b.bottom;
  return b.side;
}

const FACES = [
  { name: "px", dir: [1,0,0], n: [1,0,0], light: 0.78, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { name: "nx", dir: [-1,0,0], n: [-1,0,0], light: 0.78, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { name: "py", dir: [0,1,0], n: [0,1,0], light: 1.0, corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] },
  { name: "ny", dir: [0,-1,0], n: [0,-1,0], light: 0.5, corners: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] },
  { name: "pz", dir: [0,0,1], n: [0,0,1], light: 0.62, corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { name: "nz", dir: [0,0,-1], n: [0,0,-1], light: 0.62, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];
const FACE_KEY = { px: "side", nx: "side", py: "top", ny: "bottom", pz: "side", nz: "side" };

// blocks rendered as a thin flat plate on the floor of their voxel cell
const FLAT_BLOCKS = new Set([B.LEVER, B.REDSTONE_DUST, B.REPEATER]);

export class World {
  constructor(seed, atlas, dimension = "overworld") {
    this.seed = seed >>> 0;
    this.atlas = atlas;
    this.dimension = dimension;
    this.nether = dimension === "nether";
    this.limit = this.nether ? 1250 : 10000;     // half-extent in blocks
    this.chunks = new Map();
    this.terrainDone = new Set();
    this.decorated = new Set();
    this.meta = new Map();                       // "x,y,z" -> {facing,...}
    this.redstoneNodes = new Set();              // "x,y,z" of redstone parts
    this.villagerSpawns = [];
    this.pillagerSpawns = [];
  }

  key(cx, cz) { return cx + "," + cz; }
  mkey(x, y, z) { return x + "," + y + "," + z; }

  surfaceHeight(wx, wz) {
    const cont = fbm(wx, wz, this.seed, 4, 0.0075);
    const hills = fbm(wx, wz, this.seed + 7, 4, 0.03);
    const h = 18 + cont * 32 + hills * 12;
    return Math.max(MIN_Y + 6, Math.min(MAX_Y - 14, Math.floor(h)));
  }

  biome(wx, wz) {
    return fbm(wx, wz, this.seed + 555, 3, 0.0045) > 0.6 ? "desert" : "plains";
  }

  // would a village generate at this (anchor) chunk?
  villageAt(cx, cz) {
    const m = (v, n) => ((v % n) + n) % n;
    if (m(cx, 4) !== 0 || m(cz, 4) !== 0) return false;
    if (this.biome(cx * CHUNK + 8, cz * CHUNK + 8) !== "plains") return false;
    return makeRng(this.seed ^ (cx * 91138233) ^ (cz * 471232))() < 0.5;
  }
  villageNear(cx, cz) {
    for (let ax = cx - 5; ax <= cx + 5; ax++)
      for (let az = cz - 5; az <= cz + 5; az++)
        if (this.villageAt(ax, az)) return true;
    return false;
  }

  // true => this voxel should be carved into a cave
  carveCave(wx, wy, wz) {
    if (this.nether) {
      // big sweeping caverns: combine large-scale + medium noise
      const big = fbm3(wx, wy, wz, this.seed + 99, 3, 0.028);
      const med = fbm3(wx, wy, wz, this.seed + 211, 2, 0.07);
      return big > 0.42 || med > 0.56;
    }
    const v = fbm3(wx, wy, wz, this.seed + 42, 3, 0.06);
    return Math.abs(v - 0.5) < 0.062;                            // winding tunnels
  }

  ensureTerrain(cx, cz) {
    const k = this.key(cx, cz);
    if (this.terrainDone.has(k)) return this.chunks.get(k);
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);

    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        if (this.nether) this.fillNetherColumn(data, x, z, wx, wz);
        else this.fillOverworldColumn(data, x, z, wx, wz);
      }

    this.chunks.set(k, data);
    this.terrainDone.add(k);
    return data;
  }

  fillOverworldColumn(data, x, z, wx, wz) {
    const h = this.surfaceHeight(wx, wz);
    const beach = h <= SEA + 1;
    const desert = this.biome(wx, wz) === "desert";
    for (let wy = MIN_Y; wy <= MAX_Y; wy++) {
      let id = B.AIR;
      if (wy === MIN_Y) id = B.BEDROCK;
      else if (wy < h - 4) id = B.STONE;
      else if (wy < h) id = desert ? (wy < h - 1 ? B.SANDSTONE : B.SAND)
                                   : (beach ? B.SAND : B.DIRT);
      else if (wy === h) id = desert ? B.SAND : (beach ? B.SAND : B.GRASS);
      else if (wy <= SEA) id = B.WATER;
      // carve caves through stone/dirt below the surface
      if (id !== B.AIR && id !== B.WATER && id !== B.BEDROCK &&
          wy < h - 1 && this.carveCave(wx, wy, wz)) id = B.AIR;
      data[this.idx(x, wy, z)] = id;
    }
  }

  fillNetherColumn(data, x, z, wx, wz) {
    const LAVA_SEA = MIN_Y + 14;                       // y = -50
    const n = fbm(wx, wz, this.seed + 701, 4, 0.012);  // 0..1
    const surf = MIN_Y + 1 + Math.floor(n * 36);       // -63..-28
    for (let wy = MIN_Y; wy <= MAX_Y; wy++) {
      let id = B.AIR;
      if (wy === MIN_Y || wy === MAX_Y) id = B.BEDROCK;
      else if (wy <= surf)
        id = this.carveCave(wx, wy, wz) ? B.AIR : B.NETHERRACK;
      if (id === B.AIR && wy <= LAVA_SEA) id = B.LAVA;
      data[this.idx(x, wy, z)] = id;
    }
  }

  generateChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.decorated.has(k)) return this.chunks.get(k);
    this.ensureTerrain(cx, cz);
    this.decorated.add(k);
    if (this.nether) return this.chunks.get(k);

    const rng = makeRng(this.seed ^ (cx * 341873128) ^ (cz * 132897987));
    const m = (v, n) => ((v % n) + n) % n;
    const acx = cx * CHUNK + 8, acz = cz * CHUNK + 8;
    const centreBiome = this.biome(acx, acz);

    if (m(cx, 4) === 0 && m(cz, 4) === 0 && centreBiome === "plains") {
      const vrng = makeRng(this.seed ^ (cx * 91138233) ^ (cz * 471232));
      if (vrng() < 0.5) generateVillage(this, cx, cz, vrng);
    }
    if (m(cx, 3) === 1 && m(cz, 3) === 1 && centreBiome === "desert") {
      const trng = makeRng(this.seed ^ (cx * 70253) ^ (cz * 1992873));
      if (trng() < 0.6) generateDesertTemple(this, cx * CHUNK + 1, cz * CHUNK + 1, trng);
    }
    // pillager outposts never spawn close to a village
    if (m(cx, 6) === 3 && m(cz, 6) === 3 && !this.villageNear(cx, cz)) {
      const org = makeRng(this.seed ^ (cx * 33119) ^ (cz * 60101));
      if (org() < 0.5) generatePillagerOutpost(this, cx * CHUNK + 5, cz * CHUNK + 5, org);
    }

    // trees: oak / birch / spruce
    for (let x = 2; x < CHUNK - 2; x++)
      for (let z = 2; z < CHUNK - 2; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = this.surfaceHeight(wx, wz);
        if (h <= SEA) continue;
        if (this.biome(wx, wz) === "desert") {
          if (rng() < 0.012 && this.getBlock(wx, h, wz) === B.SAND) {
            const tall = 1 + ((rng() * 3) | 0);
            for (let i = 1; i <= tall; i++) this.setBlockGen(wx, h + i, wz, B.CACTUS);
          }
          continue;
        }
        if (rng() > 0.02) continue;
        if (this.getBlock(wx, h, wz) !== B.GRASS) continue;
        const r = rng();
        const kind = r < 0.55 ? "oak" : r < 0.8 ? "birch" : "spruce";
        this.placeTree(wx, h + 1, wz, rng, kind);
      }
    return this.chunks.get(k);
  }

  placeTree(wx, wy, wz, rng, kind) {
    const SET = {
      oak:    { log: B.LOG, leaf: B.LEAVES, trunk: [4, 6] },
      birch:  { log: B.BIRCH_LOG, leaf: B.BIRCH_LEAVES, trunk: [5, 7] },
      spruce: { log: B.SPRUCE_LOG, leaf: B.SPRUCE_LEAVES, trunk: [6, 9] },
    }[kind];
    const trunk = SET.trunk[0] + ((rng() * (SET.trunk[1] - SET.trunk[0] + 1)) | 0);
    for (let i = 0; i < trunk; i++) this.setBlockGen(wx, wy + i, wz, SET.log);
    const top = wy + trunk;

    if (kind === "spruce") {
      // conical layered canopy
      let radius = 2;
      for (let dy = -trunk + 2; dy <= 2; dy++) {
        const r = ((dy + trunk) % 2 === 0) ? radius : radius - 1;
        for (let dx = -r; dx <= r; dx++)
          for (let dz = -r; dz <= r; dz++) {
            if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
            if (dx === 0 && dz === 0 && dy < 2) continue;
            const x = wx + dx, y = top + dy - 2, z = wz + dz;
            if (this.getBlock(x, y, z) === B.AIR) this.setBlockGen(x, y, z, SET.leaf);
          }
      }
      this.setBlockGen(wx, top + 1, wz, SET.leaf);
    } else {
      for (let dy = -2; dy <= 1; dy++)
        for (let dx = -2; dx <= 2; dx++)
          for (let dz = -2; dz <= 2; dz++) {
            if (dx === 0 && dz === 0 && dy < 1) continue;
            const r = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
            if (r > 4 || (dy === 1 && r > 3)) continue;
            const x = wx + dx, y = top + dy, z = wz + dz;
            if (this.getBlock(x, y, z) === B.AIR) this.setBlockGen(x, y, z, SET.leaf);
          }
    }
  }

  idx(x, wy, z) { return ((wy - MIN_Y) * CHUNK + z) * CHUNK + x; }

  getBlock(wx, wy, wz) {
    if (wy < MIN_Y || wy > MAX_Y) return B.AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return B.AIR;
    return data[this.idx(wx - cx * CHUNK, wy, wz - cz * CHUNK)];
  }

  setBlockGen(wx, wy, wz, id) {
    if (wy < MIN_Y || wy > MAX_Y) return;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.ensureTerrain(cx, cz);
    data[this.idx(wx - cx * CHUNK, wy, wz - cz * CHUNK)] = id;
  }

  setBlock(wx, wy, wz, id) {
    if (wy < MIN_Y || wy > MAX_Y) return [];
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return [];
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    data[this.idx(lx, wy, lz)] = id;
    if (id === B.AIR) this.meta.delete(this.mkey(wx, wy, wz));
    const out = [this.key(cx, cz)];
    if (lx === 0) out.push(this.key(cx - 1, cz));
    if (lx === CHUNK - 1) out.push(this.key(cx + 1, cz));
    if (lz === 0) out.push(this.key(cx, cz - 1));
    if (lz === CHUNK - 1) out.push(this.key(cx, cz + 1));
    return out;
  }

  buildMesh(cx, cz) {
    const data = this.chunks.get(this.key(cx, cz));
    if (!data) return null;
    const opaque = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const cutout = { pos: [], norm: [], uv: [], col: [], idx: [] };
    const water  = { pos: [], norm: [], uv: [], col: [], idx: [] };

    for (let wy = MIN_Y; wy <= MAX_Y; wy++)
      for (let z = 0; z < CHUNK; z++)
        for (let x = 0; x < CHUNK; x++) {
          const id = data[this.idx(x, wy, z)];
          if (id === B.AIR) continue;
          const block = BLOCKS[id];
          const wx = cx * CHUNK + x, wz = cz * CHUNK + z;

          // flat overlay blocks (lever, dust, repeater) render as one quad
          if (FLAT_BLOCKS.has(id)) {
            this.pushFlatFace(cutout, x, wy - MIN_Y, z, faceTile(id, "top"));
            continue;
          }

          const target = block.liquid ? water : block.transparent ? cutout : opaque;
          for (const f of FACES) {
            const nid = this.getBlock(wx + f.dir[0], wy + f.dir[1], wz + f.dir[2]);
            if (nid !== B.AIR) {
              const nb = BLOCKS[nid];
              if (!nb.transparent) continue;
              if (nid === id) continue;
              if (block.transparent && !block.liquid && nb.transparent) continue;
            }
            this.pushFace(target, x, wy - MIN_Y, z, f, faceTile(id, FACE_KEY[f.name]));
          }
        }
    return {
      opaque: this.toGeometry(opaque),
      cutout: this.toGeometry(cutout),
      water:  this.toGeometry(water),
    };
  }

  // thin quad just above the floor of a voxel cell
  pushFlatFace(t, x, y, z, tileName) {
    const uv = this.atlas.uv[tileName];
    const base = t.pos.length / 3;
    const h = 0.06;
    t.pos.push(
      x, y + h, z,
      x, y + h, z + 1,
      x + 1, y + h, z + 1,
      x + 1, y + h, z,
    );
    for (let i = 0; i < 4; i++) {
      t.norm.push(0, 1, 0);
      t.col.push(1, 1, 1);
    }
    t.uv.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
    t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
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
    t.uv.push(uv.u0, uv.v0, uv.u0, uv.v1, uv.u1, uv.v1, uv.u1, uv.v0);
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
