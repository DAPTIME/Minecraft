// Procedural pixel-art textures, generated entirely in code at 32x32.
import * as THREE from "three";
import { makeRng } from "./noise.js";

const TILE = 32;          // pixels per tile
const COLS = 8;           // tiles per atlas row
const U = TILE / 16;      // scale unit relative to a 16px design grid

function tileCtx() {
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  return c.getContext("2d");
}
function px(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function shade(hex, m) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * m | 0));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * m | 0));
  const b = Math.max(0, Math.min(255, (n & 255) * m | 0));
  return `rgb(${r},${g},${b})`;
}
function speckle(ctx, base, amount, rng) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(ctx, x, y, shade(base, 1 + (rng() - 0.5) * amount));
}
function scatter(ctx, count, color, rng, vary = 0) {
  for (let i = 0; i < count; i++)
    px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0,
       vary ? shade(color, 1 + (rng() - 0.5) * vary) : color);
}

const painters = {
  grass_top(ctx, rng) {
    speckle(ctx, "#5fa83a", 0.35, rng);
    scatter(ctx, 110, "#74c24a", rng, 0.25);
    scatter(ctx, 40, "#4f9030", rng);
  },
  grass_side(ctx, rng) {
    speckle(ctx, "#7a5b3a", 0.3, rng);
    for (let x = 0; x < TILE; x++) {
      const h = (6 + rng() * 8) | 0;
      for (let y = 0; y < h; y++)
        px(ctx, x, y, shade("#5fa83a", 1 + (rng() - 0.5) * 0.3));
    }
  },
  dirt(ctx, rng) { speckle(ctx, "#7a5b3a", 0.35, rng); scatter(ctx, 56, "#5c4329", rng); },
  stone(ctx, rng) { speckle(ctx, "#8a8a8a", 0.22, rng); scatter(ctx, 40, "#6f6f6f", rng, 0.15); },
  cobblestone(ctx, rng) {
    speckle(ctx, "#7d7d7d", 0.18, rng);
    const cell = 10;
    for (let gy = 0; gy < TILE; gy += cell)
      for (let gx = 0; gx < TILE; gx += cell) {
        const ox = (rng() * 3) | 0, oy = (rng() * 3) | 0, s = cell - 2;
        for (let y = 0; y < s; y++)
          for (let x = 0; x < s; x++) {
            const edge = x === 0 || y === 0 || x === s - 1 || y === s - 1;
            const px2 = gx + x + ox, py2 = gy + y + oy;
            if (px2 < TILE && py2 < TILE)
              px(ctx, px2, py2, shade("#7d7d7d", edge ? 0.6 : 1 + (rng() - 0.5) * 0.2));
          }
      }
  },
  sand(ctx, rng) { speckle(ctx, "#e3d6a3", 0.16, rng); scatter(ctx, 48, "#cdbf86", rng); },
  gravel(ctx, rng) {
    speckle(ctx, "#8d847f", 0.3, rng);
    scatter(ctx, 90, "#6b635f", rng); scatter(ctx, 70, "#a59c97", rng);
  },
  water(ctx, rng) {
    speckle(ctx, "#3a6fbb", 0.18, rng);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        if ((x + y) % 8 < 2) px(ctx, x, y, shade("#5b8dff", 1.15));
  },
  log_side(ctx, rng) {
    for (let x = 0; x < TILE; x++) {
      const bark = 0.8 + Math.abs(Math.sin(x * 0.45)) * 0.4;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade("#6b4f2a", bark + (rng() - 0.5) * 0.18));
    }
  },
  log_top(ctx, rng) { rings(ctx, rng, "#b5945a", "#8a6c3c"); },
  leaves(ctx, rng) { leafTile(ctx, rng, "#3f7d2c", 0.5); },
  planks(ctx, rng) { plankTile(ctx, rng, "#b08344", "#7a5a2c"); },
  glass(ctx, rng) {
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = "rgba(220,240,255,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(220,240,255,0.5)";
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(TILE * 0.5, TILE * 0.5); ctx.stroke();
  },
  bedrock(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++)
        px(ctx, x, y, shade("#2b2b2b", 0.6 + rng() * 0.9));
  },
  path(ctx, rng) {
    speckle(ctx, "#6f5536", 0.25, rng);
    ctx.strokeStyle = shade("#5c4329", 1); ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  },
  sandstone(ctx, rng) {
    speckle(ctx, "#dccb92", 0.1, rng);
    for (let y = 0; y < TILE; y += 9)
      for (let x = 0; x < TILE; x++) px(ctx, x, y, shade("#bfa869", 1));
  },
  orange(ctx, rng) { speckle(ctx, "#d8731f", 0.16, rng); scatter(ctx, 40, "#b85a13", rng); },
  cactus(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const rib = (x % 10) < 4;
        px(ctx, x, y, shade(rib ? "#3a5e29" : "#4f7d3a", 1 + (rng() - 0.5) * 0.18));
      }
    scatter(ctx, 34, "#e4ecbf", rng);
  },
  birch_log_side(ctx, rng) {
    speckle(ctx, "#d8cfb6", 0.12, rng);
    for (let i = 0; i < 22; i++) {
      const y = (rng() * TILE) | 0, w = (2 + rng() * 6) | 0, x0 = (rng() * TILE) | 0;
      for (let x = 0; x < w; x++) px(ctx, (x0 + x) % TILE, y, "#3a3128");
    }
  },
  birch_log_top(ctx, rng) { rings(ctx, rng, "#e6dcc0", "#cdbf99"); },
  birch_planks(ctx, rng) { plankTile(ctx, rng, "#d2c3a0", "#a9966f"); },
  birch_leaves(ctx, rng) { leafTile(ctx, rng, "#73ad53", 0.45); },
  spruce_log_side(ctx, rng) {
    for (let x = 0; x < TILE; x++) {
      const bark = 0.8 + Math.abs(Math.sin(x * 0.45)) * 0.4;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade("#4a3520", bark + (rng() - 0.5) * 0.2));
    }
  },
  spruce_log_top(ctx, rng) { rings(ctx, rng, "#6b5236", "#503c26"); },
  spruce_planks(ctx, rng) { plankTile(ctx, rng, "#6e5436", "#4d3a25"); },
  spruce_leaves(ctx, rng) { leafTile(ctx, rng, "#2f5e2a", 0.5); },
  netherrack(ctx, rng) {
    speckle(ctx, "#7a2a26", 0.3, rng);
    scatter(ctx, 96, "#4f1a18", rng); scatter(ctx, 70, "#9c3b34", rng);
  },
  slime(ctx, rng) {
    speckle(ctx, "#6fbf5a", 0.2, rng);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#3f8a36"; ctx.strokeRect(5, 5, TILE - 10, TILE - 10);
    ctx.strokeStyle = "#9fe089"; ctx.strokeRect(9, 9, TILE - 18, TILE - 18);
  },
  wool(ctx, rng) { speckle(ctx, "#ececec", 0.14, rng); },
  redstone_block(ctx, rng) { speckle(ctx, "#c0302a", 0.22, rng); scatter(ctx, 56, "#ff5a4f", rng); },
  redstone_dust(ctx, rng) {
    speckle(ctx, "#3a3a3a", 0.2, rng);
    ctx.strokeStyle = "#c81e10"; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(TILE / 2, 0); ctx.lineTo(TILE / 2, TILE);
    ctx.moveTo(0, TILE / 2); ctx.lineTo(TILE, TILE / 2);
    ctx.stroke();
    ctx.fillStyle = "#ff5a4f"; ctx.fillRect(TILE / 2 - 3, TILE / 2 - 3, 6, 6);
  },
  lever(ctx, rng) {
    speckle(ctx, "#8a8a8a", 0.2, rng);
    rect(ctx, TILE / 2 - 2, 6 * U, 4, 9 * U, "#6b4f2a");
    rect(ctx, TILE / 2 - 4, 3 * U, 8, 6 * U, "#cacaca");
  },
  repeater(ctx, rng) {
    speckle(ctx, "#b4b0aa", 0.14, rng);
    rect(ctx, TILE / 2 - 2, 3 * U, 4, TILE - 6 * U, "#c81e10");
    rect(ctx, 8 * U, TILE * 0.55, 5 * U, 5, "#7a2a26");
    rect(ctx, TILE - 13 * U, TILE * 0.3, 5 * U, 5, "#7a2a26");
  },
  piston(ctx, rng) {
    speckle(ctx, "#9a8a6a", 0.16, rng);
    ctx.strokeStyle = "#5a4a2c"; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  },
  piston_head(ctx, rng) {
    speckle(ctx, "#c2b48a", 0.14, rng);
    rect(ctx, 0, 0, TILE, 8 * U, "#8a7a52");
    rect(ctx, TILE / 2 - 4, 8 * U, 8, TILE - 8 * U, "#5a4a2c");
  },
  sticky_piston(ctx, rng) {
    speckle(ctx, "#9a8a6a", 0.16, rng);
    rect(ctx, 8 * U, 8 * U, TILE - 16 * U, TILE - 16 * U, "#6fbf5a");
    ctx.strokeStyle = "#5a4a2c"; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
  },
  portal(ctx, rng) {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = 0.5 + 0.5 * Math.sin((x + y) * 0.4 + rng() * 0.6);
        px(ctx, x, y, shade("#7b3fb0", 0.6 + v * 0.8));
      }
  },
};

// shared sub-painters
function rings(ctx, rng, base, dark) {
  speckle(ctx, base, 0.16, rng);
  const c = TILE / 2 - 0.5;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      if (((Math.hypot(x - c, y - c) / U) | 0) % 3 === 0) px(ctx, x, y, shade(dark, 1));
}
function leafTile(ctx, rng, base, vary) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (rng() < 0.12) { ctx.clearRect(x, y, 1, 1); continue; }
      px(ctx, x, y, shade(base, 1 + (rng() - 0.5) * vary));
    }
}
function plankTile(ctx, rng, base, dark) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(ctx, x, y, shade(base, 1 + (rng() - 0.5) * 0.13));
  for (let y = 0; y < TILE; y += 8) rect(ctx, 0, y, TILE, 1, shade(dark, 1));
  for (let x = 7 * U; x < TILE; x += 16 * U) rect(ctx, x, 0, 1, TILE, shade(dark, 1));
}

const TILE_NAMES = [
  "grass_top", "grass_side", "dirt", "stone", "cobblestone", "sand",
  "gravel", "water", "log_side", "log_top", "leaves", "planks",
  "glass", "bedrock", "path", "sandstone", "orange", "cactus",
  "birch_log_side", "birch_log_top", "birch_planks", "birch_leaves",
  "spruce_log_side", "spruce_log_top", "spruce_planks", "spruce_leaves",
  "netherrack", "slime", "wool", "redstone_block", "redstone_dust",
  "lever", "repeater", "piston", "piston_head", "sticky_piston", "portal",
];

export function buildAtlas() {
  const rows = Math.ceil(TILE_NAMES.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = rows * TILE;
  const actx = canvas.getContext("2d");

  const uv = {};
  TILE_NAMES.forEach((name, i) => {
    const cx = i % COLS, cy = (i / COLS) | 0;
    const ctx = tileCtx();
    painters[name](ctx, makeRng(0x1234 + i * 9871));
    actx.drawImage(ctx.canvas, cx * TILE, cy * TILE);
    const e = 0.0008;
    uv[name] = {
      u0: cx / COLS + e, u1: (cx + 1) / COLS - e,
      v0: 1 - (cy + 1) / rows + e, v1: 1 - cy / rows - e,
    };
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { texture: tex, uv, tileNames: TILE_NAMES };
}

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

export function woodenArmorIcon(size = 40) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const u = size / 16;
  const plank = "#b08344", dark = "#7a5a2c", light = "#c89a5a";
  const fill = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * u, y * u, w * u, h * u); };
  fill(2, 3, 4, 3, plank); fill(10, 3, 4, 3, plank);
  fill(4, 5, 8, 8, plank);
  fill(4, 7, 8, 1, dark); fill(4, 10, 8, 1, dark);
  fill(2, 4, 4, 1, light); fill(10, 4, 4, 1, light);
  g.strokeStyle = dark; g.lineWidth = u;
  g.strokeRect(4 * u, 5 * u, 8 * u, 8 * u);
  return c;
}
