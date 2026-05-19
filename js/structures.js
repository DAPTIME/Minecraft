// 1.14-style generated structures: desert temples (pyramids), desert wells
// and pillager outposts. All are stamped into the world during chunk decoration.
import { B, SEA } from "./world.js";

function avgGround(world, bx, bz, w, d) {
  let sum = 0;
  for (const [ox, oz] of [[0,0],[w-1,0],[0,d-1],[w-1,d-1]])
    sum += world.surfaceHeight(bx + ox, bz + oz);
  return Math.round(sum / 4);
}

// --- Desert Temple: a stepped sandstone pyramid with orange accents ----------
export function generateDesertTemple(world, bx, bz, rng) {
  const W = 13, D = 13, LAYERS = 6;
  const gy = avgGround(world, bx, bz, W, D);
  if (gy <= SEA + 1) return;
  const SS = B.SANDSTONE, OR = B.ORANGE;

  // foundation packed down to the terrain
  for (let x = 0; x < W; x++)
    for (let z = 0; z < D; z++) {
      for (let y = world.surfaceHeight(bx + x, bz + z) - 3; y < gy; y++)
        world.setBlockGen(bx + x, y, bz + z, SS);
      world.setBlockGen(bx + x, gy, bz + z, SS);
    }

  // stepped pyramid: each layer is a hollow ring inset by one block
  for (let L = 0; L < LAYERS; L++) {
    const y = gy + 1 + L;
    for (let x = L; x < W - L; x++)
      for (let z = L; z < D - L; z++) {
        const edge = x === L || z === L || x === W - 1 - L || z === D - 1 - L;
        world.setBlockGen(bx + x, y, bz + z, edge ? (L % 2 ? OR : SS) : B.AIR);
      }
  }
  world.setBlockGen(bx + 6, gy + 1 + LAYERS, bz + 6, OR);   // capstone

  // corner spires
  for (const [cx, cz] of [[0,0],[W-1,0],[0,D-1],[W-1,D-1]])
    for (let y = 1; y <= 9; y++)
      world.setBlockGen(bx + cx, gy + y, bz + cz, y >= 8 ? OR : SS);

  // entrance carved into the front (−z) face + orange motif above it
  for (let y = 1; y <= 3; y++)
    for (let dx = -1; dx <= 1; dx++)
      world.setBlockGen(bx + 6 + dx, gy + y, bz, B.AIR);
  world.setBlockGen(bx + 6, gy + 4, bz, OR);
  world.setBlockGen(bx + 5, gy + 4, bz, OR);
  world.setBlockGen(bx + 7, gy + 4, bz, OR);
}

// --- Desert Well -------------------------------------------------------------
export function generateDesertWell(world, wx, wz, rng) {
  const gy = world.surfaceHeight(wx, wz);
  if (gy <= SEA + 1) return;
  const SS = B.SANDSTONE;

  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      world.setBlockGen(wx + x, gy, wz + z, SS);
  world.setBlockGen(wx, gy, wz, B.WATER);
  world.setBlockGen(wx, gy - 1, wz, B.WATER);

  for (const [dx, dz] of [[-1,-1],[1,-1],[-1,1],[1,1]])
    for (let y = 1; y <= 3; y++)
      world.setBlockGen(wx + dx, gy + y, wz + dz, SS);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      world.setBlockGen(wx + x, gy + 4, wz + z, SS);
}

// --- Pillager Outpost: a tall log/cobblestone watchtower ---------------------
export function generatePillagerOutpost(world, bx, bz, rng) {
  const W = 5, D = 5, H = 12;
  const gy = avgGround(world, bx, bz, W, D);
  if (gy <= SEA + 1) return;
  const CO = B.COBBLE, LOG = B.LOG, PL = B.PLANKS;

  // foundation
  for (let x = 0; x < W; x++)
    for (let z = 0; z < D; z++) {
      for (let y = world.surfaceHeight(bx + x, bz + z) - 3; y < gy; y++)
        world.setBlockGen(bx + x, y, bz + z, CO);
      world.setBlockGen(bx + x, gy, bz + z, CO);
    }

  // tower shaft, hollow, with log corners and window gaps
  for (let y = 1; y <= H; y++)
    for (let x = 0; x < W; x++)
      for (let z = 0; z < D; z++) {
        const edge = x === 0 || z === 0 || x === W - 1 || z === D - 1;
        const corner = (x === 0 || x === W - 1) && (z === 0 || z === D - 1);
        if (!edge) { world.setBlockGen(bx + x, gy + y, bz + z, B.AIR); continue; }
        if (!corner && y % 4 === 2) { world.setBlockGen(bx + x, gy + y, bz + z, B.AIR); continue; }
        world.setBlockGen(bx + x, gy + y, bz + z, corner ? LOG : CO);
      }

  // overhanging lookout platform
  const py = gy + H + 1;
  for (let x = -1; x <= W; x++)
    for (let z = -1; z <= D; z++)
      world.setBlockGen(bx + x, py, bz + z, PL);
  // railing
  for (let x = -1; x <= W; x++) {
    world.setBlockGen(bx + x, py + 1, bz - 1, LOG);
    world.setBlockGen(bx + x, py + 1, bz + D, LOG);
  }
  for (let z = -1; z <= D; z++) {
    world.setBlockGen(bx - 1, py + 1, bz + z, LOG);
    world.setBlockGen(bx + W, py + 1, bz + z, LOG);
  }
  // pitched roof
  for (let r = 0; r <= 3; r++)
    for (let x = -1 + r; x <= W - r; x++)
      for (let z = -1 + r; z <= D - r; z++) {
        const onRing = x === -1 + r || z === -1 + r || x === W - r || z === D - r;
        if (onRing) world.setBlockGen(bx + x, py + 4 + r, bz + z, PL);
      }

  // hostile pillager garrison
  (world.pillagerSpawns ||= []).push({ x: bx + 2.5, y: py + 1, z: bz + 2.5 });
  (world.pillagerSpawns ||= []).push({ x: bx + 1.5, y: py + 1, z: bz + 3.5 });
  (world.pillagerSpawns ||= []).push({ x: bx + 3.5, y: gy + 1, z: bz + 2.5 });
}
