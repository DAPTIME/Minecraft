// Procedural pixel-art textures. Everything here is generated from code —
// no external image assets are used.
import * as THREE from "three";
import { makeRng } from "./noise.js";

const TILE = 16;          // pixels per tile
const COLS = 8;           // tiles per atlas row

// --- low level pixel helpers -------------------------------------------------
function tileCtx() {
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  return c.getContext("2d");
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// shade a hex color by a multiplier
function shade(hex, m) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) * m;
  let g = ((n >> 8) & 255) * m;
  let b = (n & 255) * m;
  r = Math.max(0, Math.min(255, r | 0));
  g = Math.max(0, Math.min(255, g | 0));
  b = Math.max(0, Math.min(255, b | 0));
  return `rgb(${r},${g},${b})`;
}

// fill a tile with speckled noise around a base color
function speckle(ctx, base, amount, rng) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const m = 1 + (rng() - 0.5) * amount;
      px(ctx, x, y, shade(base, m));
    }
}

// --- individual tile painters ------------------------------------------------
const painters = {
  grass_top(ctx, rng) {
    speckle(ctx, "#5fa83a", 0.35, rng);
    for (let i = 0; i < 26; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade("#74c24a", 1 + rng() * 0.2));
  },
  grass_side(ctx, rng) {
    speckle(ctx, "#7a5b3a", 0.3, rng);            // dirt base
    for (let x = 0; x < TILE; x++) {
      const h = 3 + ((rng() * 4) | 0);            // grassy top fringe
      for (let y = 0; y < h; y++)
        px(ctx, x, y, shade("#5fa83a", 1 + (rng() - 0.5) * 0.3));
    }
  },
  dirt(ctx, rng) {
    speckle(ctx, "#7a5b3a", 0.35, rng);
    for (let i = 0; i < 14; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade("#5c4329", 1));
  },
  stone(ctx, rng) {
    speckle(ctx, "#8a8a8a", 0.22, rng);
    for (let i = 0; i < 10; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade("#6f6f6f", 1));
  },
  cobblestone(ctx, rng) {
    speckle(ctx, "#7d7d7d", 0.18, rng);
    for (let gy = 0; gy < TILE; gy += 5)
      for (let gx = 0; gx < TILE; gx += 5) {
        const ox = (rng() * 2) | 0, oy = (rng() * 2) | 0;
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            const edge = x === 0 || y === 0 || x === 3 || y === 3;
            px(ctx, gx + x + ox, gy + y + oy,
               shade("#7d7d7d", edge ? 0.6 : 1 + (rng() - 0.5) * 0.2));
          }
      }
  },
  sand(ctx, rng) {
    speckle(ctx, "#e3d6a3", 0.16, rng);
    for (let i = 0; i < 12; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade("#cdbf86", 1));
  },
  gravel(ctx, rng) {
    speckle(ctx, "#8d847f", 0.3, rng);
    for (let i = 0; i < 22; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade(rng() > 0.5 ? "#6b635f" : "#a59c97", 1));
  },
  water(ctx, rng) {
    speckle(ctx, "#3a6fbb", 0.18, rng);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if ((x + y) % 6 === 0) px(ctx, x, y, shade("#5b8dff", 1.15));
  },
  log_side(ctx, rng) {
    for (let x = 0; x < TILE; x++) {
      const bark = 0.8 + Math.abs(Math.sin(x * 0.9)) * 0.4;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade("#6b4f2a", bark + (rng() - 0.5) * 0.18));
    }
  },
  log_top(ctx, rng) {
    speckle(ctx, "#b5945a", 0.18, rng);
    const cx = 7.5, cy = 7.5;
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if ((d | 0) % 3 === 0) px(ctx, x, y, shade("#8a6c3c", 1));
      }
  },
  leaves(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if (rng() < 0.12) { ctx.clearRect(x, y, 1, 1); continue; }  // gaps
        px(ctx, x, y, shade("#3f7d2c", 1 + (rng() - 0.5) * 0.5));
      }
  },
  planks(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(ctx, x, y, shade("#b08344", 1 + (rng() - 0.5) * 0.14));
    for (let y = 0; y < TILE; y += 4)
      for (let x = 0; x < TILE; x++) px(ctx, x, y, shade("#7a5a2c", 1));
    for (let x = 3; x < TILE; x += 8)
      for (let y = 0; y < TILE; y++) px(ctx, x, y, shade("#7a5a2c", 1));
  },
  glass(ctx, rng) {
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = "rgba(220,240,255,0.9)";
    ctx.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    ctx.strokeStyle = "rgba(220,240,255,0.45)";
    ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(8, 8); ctx.stroke();
  },
  bedrock(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(ctx, x, y, shade("#2b2b2b", 0.6 + rng() * 0.9));
  },
  path(ctx, rng) {
    speckle(ctx, "#6f5536", 0.25, rng);
    ctx.strokeStyle = shade("#5c4329", 1);
    ctx.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
  },
  sandstone(ctx, rng) {
    speckle(ctx, "#dccb92", 0.1, rng);
    for (let y = 0; y < TILE; y += 5)
      for (let x = 0; x < TILE; x++) px(ctx, x, y, shade("#bfa869", 1));
    for (let y = 1; y < TILE; y += 5)
      for (let x = 0; x < TILE; x++) px(ctx, x, y, shade("#c9b67d", 1));
  },
  orange(ctx, rng) {
    speckle(ctx, "#d8731f", 0.16, rng);
    for (let i = 0; i < 10; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, shade("#b85a13", 1));
  },
  cactus(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const rib = x % 5 === 2 || x % 5 === 3;
        px(ctx, x, y, shade(rib ? "#3a5e29" : "#4f7d3a", 1 + (rng() - 0.5) * 0.18));
      }
    for (let i = 0; i < 9; i++)
      px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0, "#e4ecbf");
  },
};

// order of tiles inside the atlas
const TILE_NAMES = [
  "grass_top", "grass_side", "dirt", "stone", "cobblestone", "sand",
  "gravel", "water", "log_side", "log_top", "leaves", "planks",
  "glass", "bedrock", "path", "sandstone", "orange", "cactus",
];

export function buildAtlas() {
  const rows = Math.ceil(TILE_NAMES.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = rows * TILE;
  const actx = canvas.getContext("2d");

  const uv = {}; // name -> {u0,v0,u1,v1}
  TILE_NAMES.forEach((name, i) => {
    const cx = i % COLS, cy = (i / COLS) | 0;
    const ctx = tileCtx();
    painters[name](ctx, makeRng(0x1234 + i * 9871));
    actx.drawImage(ctx.canvas, cx * TILE, cy * TILE);
    // small inset to avoid texture bleeding between tiles
    const e = 0.001;
    uv[name] = {
      u0: cx / COLS + e,
      u1: (cx + 1) / COLS - e,
      v0: 1 - (cy + 1) / rows + e,
      v1: 1 - cy / rows - e,
    };
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, uv, tileNames: TILE_NAMES };
}

// a single tile as a standalone canvas (for hotbar / inventory icons)
export function tileIcon(name, size = 36) {
  const ctx = tileCtx();
  painters[name](ctx, makeRng(0x1234 + TILE_NAMES.indexOf(name) * 9871));
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.drawImage(ctx.canvas, 0, 0, size, size);
  return out;
}

// the wooden-armor item icon — a little chestplate, drawn from scratch
export function woodenArmorIcon(size = 40) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const u = size / 16;
  const plank = "#b08344", dark = "#7a5a2c", light = "#c89a5a";
  const fill = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * u, y * u, w * u, h * u); };
  // shoulders
  fill(2, 3, 4, 3, plank); fill(10, 3, 4, 3, plank);
  // chest
  fill(4, 5, 8, 8, plank);
  // wood grain
  fill(4, 7, 8, 1, dark); fill(4, 10, 8, 1, dark);
  fill(2, 4, 4, 1, light); fill(10, 4, 4, 1, light);
  // outline
  g.strokeStyle = dark; g.lineWidth = u;
  g.strokeRect(4 * u, 5 * u, 8 * u, 8 * u);
  return c;
}
