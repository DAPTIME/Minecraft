// Procedural 32x32 textures, generated entirely in code.
// Styled to read clearly as Minecraft-style blocks; nothing here is a copy
// of any Mojang asset.
import * as THREE from "three";
import { makeRng } from "./noise.js";

const TILE = 32;
const COLS = 8;

// ---------------- low-level helpers ----------------------------------------
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
function fill(ctx, color) { rect(ctx, 0, 0, TILE, TILE, color); }
function noise(ctx, base, amp, rng) {
  amp *= 0.5;                        // damp overall noise for cleaner textures
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++)
      px(ctx, x, y, shade(base, 1 + (rng() - 0.5) * amp));
}
function speckles(ctx, count, color, rng, vary = 0) {
  for (let i = 0; i < count; i++)
    px(ctx, (rng() * TILE) | 0, (rng() * TILE) | 0,
       vary ? shade(color, 1 + (rng() - 0.5) * vary) : color);
}

// ---------------- painters --------------------------------------------------
const painters = {
  grass_top(ctx, rng) {
    fill(ctx, "#5fa83a");
    noise(ctx, "#5fa83a", 0.18, rng);
    speckles(ctx, 70, "#74c24a", rng, 0.15);
    speckles(ctx, 30, "#4f9030", rng);
  },
  grass_side(ctx, rng) {
    // dirt base
    fill(ctx, "#7a5b3a");
    noise(ctx, "#7a5b3a", 0.22, rng);
    speckles(ctx, 50, "#5c4329", rng);
    // grass strip across the top with an irregular edge
    for (let x = 0; x < TILE; x++) {
      const h = 5 + ((rng() * 3) | 0);
      for (let y = 0; y < h; y++)
        px(ctx, x, y, shade("#5fa83a", 1 + (rng() - 0.5) * 0.18));
    }
  },
  dirt(ctx, rng) {
    fill(ctx, "#7a5b3a");
    noise(ctx, "#7a5b3a", 0.22, rng);
    speckles(ctx, 70, "#5c4329", rng);
    speckles(ctx, 30, "#8e6c47", rng);
  },
  stone(ctx, rng) {
    fill(ctx, "#8a8a8a");
    noise(ctx, "#8a8a8a", 0.12, rng);
    // a few darker patches
    for (let i = 0; i < 6; i++) {
      const cx = (rng() * TILE) | 0, cy = (rng() * TILE) | 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          if (rng() < 0.55)
            px(ctx, (cx + dx + TILE) % TILE, (cy + dy + TILE) % TILE,
               shade("#6f6f6f", 1 + (rng() - 0.5) * 0.2));
    }
  },
  cobblestone(ctx, rng) {
    // mortar background
    fill(ctx, "#4a4a4a");
    // stones: 3 rows of irregular rounded rectangles
    const rows = [
      [0, 11, 16, 9], [16, 0, 16, 12],
      [0, 0, 12, 11], [12, 12, 12, 8], [24, 12, 8, 11],
      [0, 20, 14, 12], [14, 20, 18, 12],
    ];
    for (const [x, y, w, h] of rows) {
      const base = shade("#8a8a8a", 1 + (rng() - 0.5) * 0.15);
      rect(ctx, x + 1, y + 1, w - 2, h - 2, base);
      // highlight + shadow
      rect(ctx, x + 1, y + 1, w - 2, 1, shade("#a0a0a0", 1));
      rect(ctx, x + 1, y + h - 2, w - 2, 1, shade("#5e5e5e", 1));
      // grain
      for (let i = 0; i < 6; i++)
        px(ctx, x + 2 + ((rng() * (w - 4)) | 0), y + 2 + ((rng() * (h - 4)) | 0),
           shade(base, 0.85));
    }
  },
  sand(ctx, rng) {
    fill(ctx, "#e3d6a3");
    noise(ctx, "#e3d6a3", 0.08, rng);
    speckles(ctx, 60, "#cdbf86", rng);
    speckles(ctx, 25, "#f0e5b8", rng);
  },
  gravel(ctx, rng) {
    fill(ctx, "#8d847f");
    noise(ctx, "#8d847f", 0.25, rng);
    speckles(ctx, 60, "#6b635f", rng);
    speckles(ctx, 50, "#a59c97", rng);
    speckles(ctx, 18, "#444042", rng);
  },
  water(ctx, rng) {
    fill(ctx, "#3a6fbb");
    noise(ctx, "#3a6fbb", 0.12, rng);
    // gentle horizontal waves
    for (let y = 6; y < TILE; y += 9)
      for (let x = 0; x < TILE; x++)
        if (((x + (y * 3) + (rng() * 2 | 0)) % 6) < 2)
          px(ctx, x, y, shade("#6aa2ff", 1.05));
  },
  log_side(ctx, rng) {
    fill(ctx, "#6b4f2a");
    // vertical bark stripes
    for (let x = 0; x < TILE; x++) {
      const bark = 0.78 + Math.abs(Math.sin(x * 0.7 + rng() * 0.4)) * 0.45;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade("#6b4f2a", bark + (rng() - 0.5) * 0.12));
    }
    // top/bottom ring caps
    rect(ctx, 0, 0, TILE, 1, "#3e2a14");
    rect(ctx, 0, TILE - 1, TILE, 1, "#3e2a14");
  },
  log_top(ctx, rng) { rings(ctx, rng, "#b5945a", "#8a6c3c", "#6b4f2a"); },
  leaves(ctx, rng) { leafTile(ctx, rng, "#3f7d2c", "#2e5e1f"); },
  planks(ctx, rng) { plankTile(ctx, rng, "#b08344", "#7a5a2c", "#c89a5a"); },
  glass(ctx, rng) {
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = "rgba(220,240,255,0.95)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(220,240,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(14, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TILE - 5, TILE - 12); ctx.lineTo(TILE - 12, TILE - 5); ctx.stroke();
  },
  bedrock(ctx, rng) {
    fill(ctx, "#2b2b2b");
    // irregular block-y darker chunks
    for (let i = 0; i < 8; i++) {
      const w = 6 + ((rng() * 8) | 0), h = 4 + ((rng() * 6) | 0);
      const x = (rng() * (TILE - w)) | 0, y = (rng() * (TILE - h)) | 0;
      rect(ctx, x, y, w, h, shade("#3a3a3a", 1 + (rng() - 0.5) * 0.4));
      rect(ctx, x, y, w, 1, "#1a1a1a");
      rect(ctx, x, y + h - 1, w, 1, "#1a1a1a");
    }
  },
  path(ctx, rng) {
    fill(ctx, "#6f5536");
    noise(ctx, "#6f5536", 0.22, rng);
    speckles(ctx, 40, "#5c4329", rng);
    rect(ctx, 0, 0, TILE, 2, shade("#8a6f47", 1));
  },
  sandstone(ctx, rng) {
    fill(ctx, "#dccb92");
    noise(ctx, "#dccb92", 0.07, rng);
    for (let y = 0; y < TILE; y += 10)
      rect(ctx, 0, y, TILE, 1, "#bfa869");
    // subtle vertical lines
    for (let x = 0; x < TILE; x += 14)
      rect(ctx, x, 1, 1, TILE - 2, shade("#cdb87b", 0.95));
  },
  orange(ctx, rng) {
    fill(ctx, "#d8731f");
    noise(ctx, "#d8731f", 0.1, rng);
    speckles(ctx, 30, "#b85a13", rng);
    speckles(ctx, 15, "#ec8b35", rng);
  },
  cactus(ctx, rng) {
    for (let x = 0; x < TILE; x++) {
      const rib = x < 4 || x >= TILE - 4;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade(rib ? "#3a5e29" : "#4f7d3a", 1 + (rng() - 0.5) * 0.16));
    }
    // spines
    for (let y = 4; y < TILE; y += 6)
      for (const x of [1, TILE - 2]) px(ctx, x, y, "#e4ecbf");
  },
  birch_log_side(ctx, rng) {
    fill(ctx, "#d8cfb6");
    noise(ctx, "#d8cfb6", 0.06, rng);
    // dark birch flecks
    for (let i = 0; i < 14; i++) {
      const y = (rng() * TILE) | 0, w = 4 + ((rng() * 6) | 0), x0 = (rng() * TILE) | 0;
      for (let x = 0; x < w; x++) px(ctx, (x0 + x) % TILE, y, "#3a3128");
    }
    rect(ctx, 0, 0, TILE, 1, "#3a3128");
    rect(ctx, 0, TILE - 1, TILE, 1, "#3a3128");
  },
  birch_log_top(ctx, rng) { rings(ctx, rng, "#e6dcc0", "#cdbf99", "#a89770"); },
  birch_planks(ctx, rng) { plankTile(ctx, rng, "#d2c3a0", "#a9966f", "#e2d4b0"); },
  birch_leaves(ctx, rng) { leafTile(ctx, rng, "#73ad53", "#588b3d"); },
  spruce_log_side(ctx, rng) {
    fill(ctx, "#4a3520");
    for (let x = 0; x < TILE; x++) {
      const bark = 0.78 + Math.abs(Math.sin(x * 0.65)) * 0.45;
      for (let y = 0; y < TILE; y++)
        px(ctx, x, y, shade("#4a3520", bark + (rng() - 0.5) * 0.18));
    }
    rect(ctx, 0, 0, TILE, 1, "#2a1d11");
    rect(ctx, 0, TILE - 1, TILE, 1, "#2a1d11");
  },
  spruce_log_top(ctx, rng) { rings(ctx, rng, "#6b5236", "#503c26", "#3a2a18"); },
  spruce_planks(ctx, rng) { plankTile(ctx, rng, "#6e5436", "#4d3a25", "#856947"); },
  spruce_leaves(ctx, rng) { leafTile(ctx, rng, "#2f5e2a", "#22441e"); },
  netherrack(ctx, rng) {
    fill(ctx, "#7a2a26");
    noise(ctx, "#7a2a26", 0.22, rng);
    // small darker pockmarks
    for (let i = 0; i < 8; i++) {
      const cx = (rng() * TILE) | 0, cy = (rng() * TILE) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (rng() < 0.7) px(ctx, (cx + dx + TILE) % TILE, (cy + dy + TILE) % TILE, "#4f1a18");
    }
    speckles(ctx, 30, "#9c3b34", rng);
  },
  slime(ctx, rng) {
    fill(ctx, "#6fbf5a");
    noise(ctx, "#6fbf5a", 0.16, rng);
    // inner darker translucent core
    ctx.strokeStyle = "#3f8a36"; ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, TILE - 10, TILE - 10);
    ctx.strokeStyle = "#9fe089"; ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, TILE - 20, TILE - 20);
  },
  wool(ctx, rng) {
    fill(ctx, "#ececec");
    noise(ctx, "#ececec", 0.08, rng);
    // a few tufts
    speckles(ctx, 24, "#d2d2d2", rng);
  },
  redstone_block(ctx, rng) {
    fill(ctx, "#c0302a");
    noise(ctx, "#c0302a", 0.14, rng);
    // brighter crystal dots in a loose grid
    for (let y = 4; y < TILE; y += 7)
      for (let x = 4; x < TILE; x += 7) {
        const ox = (rng() * 3) | 0, oy = (rng() * 3) | 0;
        px(ctx, x + ox, y + oy, "#ff5a4f");
        px(ctx, x + ox + 1, y + oy, "#ff8a7e");
      }
  },
  redstone_dust(ctx, rng) {
    // flat overlay
    ctx.clearRect(0, 0, TILE, TILE);
    rect(ctx, TILE / 2 - 2, 4, 4, TILE - 8, "#c81e10");
    rect(ctx, 4, TILE / 2 - 2, TILE - 8, 4, "#c81e10");
    rect(ctx, TILE / 2 - 3, TILE / 2 - 3, 6, 6, "#ff5a4f");
    rect(ctx, TILE / 2 - 1, TILE / 2 - 1, 2, 2, "#ffb8a8");
  },
  lever(ctx, rng) {
    // drawn as a flat overlay (transparent background)
    ctx.clearRect(0, 0, TILE, TILE);
    // cobble base plate
    rect(ctx, 9, 19, 14, 10, "#6f6f6f");
    rect(ctx, 9, 19, 14, 1, "#a0a0a0");
    rect(ctx, 9, 28, 14, 1, "#4a4a4a");
    // stick
    rect(ctx, TILE / 2 - 1, 8, 3, 14, "#6b4f2a");
    // knob
    rect(ctx, TILE / 2 - 3, 4, 6, 5, "#cacaca");
    rect(ctx, TILE / 2 - 3, 4, 6, 1, "#ffffff");
  },
  repeater(ctx, rng) {
    ctx.clearRect(0, 0, TILE, TILE);
    // smooth-stone slab
    rect(ctx, 3, 3, TILE - 6, TILE - 6, "#b4b0aa");
    rect(ctx, 3, 3, TILE - 6, 1, "#cac6c0");
    rect(ctx, 3, TILE - 4, TILE - 6, 1, "#85827d");
    // central wire
    rect(ctx, TILE / 2 - 1, 10, 3, TILE - 20, "#c81e10");
    // two torches (small base + bright top)
    rect(ctx, 10, 20, 2, 4, "#6b4f2a"); rect(ctx, 9, 19, 4, 2, "#ff5a4f");
    rect(ctx, 20, 12, 2, 4, "#6b4f2a"); rect(ctx, 19, 11, 4, 2, "#ff5a4f");
  },
  piston(ctx, rng) {
    // planky face with a darker frame
    fill(ctx, "#b08344");
    noise(ctx, "#b08344", 0.12, rng);
    rect(ctx, 0, 0, TILE, 3, "#7a5a2c");
    rect(ctx, 0, TILE - 3, TILE, 3, "#7a5a2c");
    rect(ctx, 0, 0, 3, TILE, "#7a5a2c");
    rect(ctx, TILE - 3, 0, 3, TILE, "#7a5a2c");
    // central wood-ring detail
    const c = TILE / 2 - 0.5;
    for (let y = 5; y < TILE - 5; y++)
      for (let x = 5; x < TILE - 5; x++) {
        const d = ((Math.hypot(x - c, y - c)) | 0);
        if (d % 3 === 0) px(ctx, x, y, "#8a6c3c");
      }
  },
  piston_head(ctx, rng) {
    fill(ctx, "#c2b48a");
    noise(ctx, "#c2b48a", 0.1, rng);
    rect(ctx, 0, 0, TILE, 12, "#8a7a52");
    rect(ctx, 0, 0, TILE, 2, "#a99860");
    rect(ctx, TILE / 2 - 4, 12, 8, TILE - 12, "#5a4a2c");
    rect(ctx, TILE / 2 - 4, 12, 8, 2, "#3e3318");
  },
  sticky_piston(ctx, rng) {
    fill(ctx, "#b08344");
    noise(ctx, "#b08344", 0.12, rng);
    rect(ctx, 0, 0, TILE, 3, "#7a5a2c");
    rect(ctx, 0, TILE - 3, TILE, 3, "#7a5a2c");
    rect(ctx, 0, 0, 3, TILE, "#7a5a2c");
    rect(ctx, TILE - 3, 0, 3, TILE, "#7a5a2c");
    // slime patch in the middle
    rect(ctx, 7, 7, TILE - 14, TILE - 14, "#6fbf5a");
    ctx.strokeStyle = "#3f8a36"; ctx.lineWidth = 1;
    ctx.strokeRect(7.5, 7.5, TILE - 15, TILE - 15);
    ctx.strokeStyle = "#9fe089";
    ctx.strokeRect(11.5, 11.5, TILE - 23, TILE - 23);
  },
  lava(ctx, rng) {
    fill(ctx, "#e07a1f");
    noise(ctx, "#e07a1f", 0.14, rng);
    // brighter molten flecks
    for (let i = 0; i < 14; i++) {
      const x = (rng() * (TILE - 2)) | 0, y = (rng() * (TILE - 2)) | 0;
      rect(ctx, x, y, 2, 2, "#ffce5a");
    }
    // dark crusts
    for (let i = 0; i < 10; i++) {
      const x = (rng() * (TILE - 2)) | 0, y = (rng() * (TILE - 2)) | 0;
      rect(ctx, x, y, 2, 2, "#a83d12");
    }
    // horizontal flowing streaks
    for (let y = 5; y < TILE; y += 9)
      for (let x = 0; x < TILE; x++)
        if (rng() < 0.4) px(ctx, x, y, "#ffa552");
  },
  portal(ctx, rng) {
    // vertical wavy bands of purple, like a portal interior
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const v = 0.5 + 0.5 * Math.sin(x * 0.35 + y * 0.18 + rng() * 0.4);
        px(ctx, x, y, shade("#7b3fb0", 0.55 + v * 0.9));
      }
    rect(ctx, 0, 0, TILE, 1, "#3a1a52");
    rect(ctx, 0, TILE - 1, TILE, 1, "#3a1a52");
    rect(ctx, 0, 0, 1, TILE, "#3a1a52");
    rect(ctx, TILE - 1, 0, 1, TILE, "#3a1a52");
  },
};

// ---------------- shared sub-painters ---------------------------------------
function rings(ctx, rng, base, mid, dark) {
  fill(ctx, base);
  noise(ctx, base, 0.1, rng);
  const c = TILE / 2 - 0.5;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - c, y - c) | 0;
      if (d % 4 === 0) px(ctx, x, y, mid);
      else if (d % 4 === 2) px(ctx, x, y, shade(base, 0.93));
    }
  // pith dot
  rect(ctx, ((TILE / 2) | 0) - 1, ((TILE / 2) | 0) - 1, 2, 2, dark);
}
function leafTile(ctx, rng, light, dark) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      if (rng() < 0.10) { ctx.clearRect(x, y, 1, 1); continue; }
      const r = rng();
      const c = r < 0.35 ? dark : light;
      px(ctx, x, y, shade(c, 1 + (rng() - 0.5) * 0.3));
    }
}
function plankTile(ctx, rng, base, dark, light) {
  fill(ctx, base);
  noise(ctx, base, 0.08, rng);
  // four horizontal planks
  for (let y = 0; y < TILE; y += 8) {
    rect(ctx, 0, y, TILE, 1, dark);
    rect(ctx, 0, y + 1, TILE, 1, light);
  }
  // staggered vertical seams
  for (let row = 0; row < 4; row++) {
    const seamX = (row % 2 === 0) ? 11 : 22;
    rect(ctx, seamX, row * 8, 1, 8, dark);
  }
}

// ---------------- atlas -----------------------------------------------------
const TILE_NAMES = [
  "grass_top", "grass_side", "dirt", "stone", "cobblestone", "sand",
  "gravel", "water", "log_side", "log_top", "leaves", "planks",
  "glass", "bedrock", "path", "sandstone", "orange", "cactus",
  "birch_log_side", "birch_log_top", "birch_planks", "birch_leaves",
  "spruce_log_side", "spruce_log_top", "spruce_planks", "spruce_leaves",
  "netherrack", "slime", "wool", "redstone_block", "redstone_dust",
  "lever", "repeater", "piston", "piston_head", "sticky_piston", "portal",
  "lava",
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

// ---------------- icon cache (optimisation) ---------------------------------
const iconCache = new Map();
export function tileIcon(name, size = 36) {
  const key = name + ":" + size;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const ctx = tileCtx();
  painters[name](ctx, makeRng(0x1234 + TILE_NAMES.indexOf(name) * 9871));
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const o = out.getContext("2d");
  o.imageSmoothingEnabled = false;
  o.drawImage(ctx.canvas, 0, 0, size, size);
  iconCache.set(key, out);
  return out;
}

let armorIconCache = null;
export function woodenArmorIcon(size = 40) {
  if (armorIconCache && armorIconCache.width === size) return armorIconCache;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const u = size / 16;
  const plank = "#b08344", dark = "#7a5a2c", light = "#c89a5a";
  const f = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * u, y * u, w * u, h * u); };
  f(2, 3, 4, 3, plank); f(10, 3, 4, 3, plank);
  f(4, 5, 8, 8, plank);
  f(4, 7, 8, 1, dark); f(4, 10, 8, 1, dark);
  f(2, 4, 4, 1, light); f(10, 4, 4, 1, light);
  g.strokeStyle = dark; g.lineWidth = u;
  g.strokeRect(4 * u, 5 * u, 8 * u, 8 * u);
  armorIconCache = c;
  return c;
}
