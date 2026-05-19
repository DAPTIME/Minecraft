// Village generation: oak houses, lamp posts, paths and a well.
// Villager spawn points are recorded on world.villagerSpawns for main.js.
import { B, CHUNK, SEA } from "./world.js";

function flatGround(world, wx, wz) {
  return world.surfaceHeight(wx, wz);
}

function buildHouse(world, wx, wz, w, d, rng) {
  // foundation height = average of corners
  let sum = 0;
  for (const [ox, oz] of [[0,0],[w-1,0],[0,d-1],[w-1,d-1]])
    sum += flatGround(world, wx + ox, wz + oz);
  const gy = Math.round(sum / 4);
  if (gy <= SEA) return false;                 // don't build in water

  const h = 4;                                 // wall height
  // foundation + floor
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) {
      for (let y = world.surfaceHeight(wx + x, wz + z); y < gy; y++)
        world.setBlockGen(wx + x, y, wz + z, B.DIRT);
      world.setBlockGen(wx + x, gy, wz + z, B.PLANKS);
    }

  // walls
  for (let y = 1; y <= h; y++)
    for (let x = 0; x < w; x++)
      for (let z = 0; z < d; z++) {
        const edge = x === 0 || z === 0 || x === w - 1 || z === d - 1;
        if (!edge) { world.setBlockGen(wx + x, gy + y, wz + z, B.AIR); continue; }
        const corner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
        let block = corner ? B.LOG : B.PLANKS;
        // windows
        if (!corner && y === 2 && (x % 2 === 0 || z % 2 === 0)) block = B.GLASS;
        world.setBlockGen(wx + x, gy + y, wz + z, block);
      }

  // doorway on +z wall
  const dx = (w / 2) | 0;
  world.setBlockGen(wx + dx, gy + 1, wz + d - 1, B.AIR);
  world.setBlockGen(wx + dx, gy + 2, wz + d - 1, B.AIR);

  // gable roof from planks
  for (let r = 0; r <= ((Math.min(w, d) / 2) | 0); r++)
    for (let x = -1 + r; x < w + 1 - r; x++)
      for (let z = -1 + r; z < d + 1 - r; z++) {
        const onRing = x === -1 + r || z === -1 + r || x === w - r || z === d - r;
        if (onRing) world.setBlockGen(wx + x, gy + h + 1 + r, wz + z, B.PLANKS);
      }

  // villager indoors
  (world.villagerSpawns ||= []).push({
    x: wx + dx + 0.5, y: gy + 1, z: wz + d - 0.5 - 1,
  });
  return true;
}

function buildLamp(world, wx, wz) {
  const gy = flatGround(world, wx, wz);
  if (gy <= SEA) return;
  for (let i = 1; i <= 4; i++) world.setBlockGen(wx, gy + i, wz, B.LOG);
  world.setBlockGen(wx, gy + 5, wz, B.GLASS);
}

function buildWell(world, wx, wz) {
  const gy = flatGround(world, wx, wz);
  if (gy <= SEA) return;
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++) {
      world.setBlockGen(wx + x, gy, wz + z, B.COBBLE);
      world.setBlockGen(wx + x, gy + 1, wz + z,
        x === 0 && z === 0 ? B.WATER : B.COBBLE);
    }
  for (const [x, z] of [[-1,-1],[1,-1],[-1,1],[1,1]])
    for (let i = 1; i <= 3; i++)
      world.setBlockGen(wx + x, gy + 1 + i, wz + z, B.LOG);
}

export function generateVillage(world, cx, cz, rng) {
  const ax = cx * CHUNK + 8, az = cz * CHUNK + 8;   // anchor (chunk centre)
  buildWell(world, ax, az);

  const houses = 4 + ((rng() * 4) | 0);
  for (let i = 0; i < houses; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 8 + rng() * 26;
    const hx = Math.round(ax + Math.cos(angle) * dist);
    const hz = Math.round(az + Math.sin(angle) * dist);
    const w = 6 + ((rng() * 3) | 0);
    const d = 6 + ((rng() * 3) | 0);
    const ok = buildHouse(world, hx, hz, w, d, rng);

    // a path of PATH blocks from well toward the house
    if (ok) {
      const steps = Math.floor(dist);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = Math.round(ax + (hx + w / 2 - ax) * t);
        const pz = Math.round(az + (hz + d - az) * t);
        const gy = flatGround(world, px, pz);
        if (gy > SEA && world.getBlock(px, gy, pz) === B.GRASS)
          world.setBlockGen(px, gy, pz, B.PATH);
      }
    }
  }

  // a couple of lamp posts
  for (let i = 0; i < 3; i++)
    buildLamp(world,
      Math.round(ax + (rng() - 0.5) * 30),
      Math.round(az + (rng() - 0.5) * 30));
}
