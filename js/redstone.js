// Basic redstone: power flows from redstone blocks / levers through
// redstone dust and repeaters; pistons extend when powered (single-block push),
// sticky pistons pull the block back when retracting.
// Simplified vs. real Minecraft: no signal strength, no delay, no comparators.
import { B } from "./world.js";

export const REDSTONE_IDS = new Set([
  B.REDSTONE_BLOCK, B.REDSTONE_DUST, B.LEVER, B.REPEATER, B.PISTON, B.STICKY_PISTON,
]);
const WIRE = new Set([B.REDSTONE_DUST, B.REPEATER]);
const PISTONS = new Set([B.PISTON, B.STICKY_PISTON]);
const N6 = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function movable(id) {
  return id !== B.AIR && id !== B.BEDROCK && id !== B.PISTON_HEAD &&
         id !== B.WATER && id !== B.LAVA && !PISTONS.has(id);
}

function extendPiston(world, x, y, z, id, m, changed) {
  const [fx, fy, fz] = m.facing;
  const hx = x + fx, hy = y + fy, hz = z + fz;
  const front = world.getBlock(hx, hy, hz);
  if (front === B.AIR) {
    world.setBlock(hx, hy, hz, B.PISTON_HEAD);
    changed.push([hx, hy, hz]);
  } else if (movable(front)) {
    const bx = x + 2 * fx, by = y + 2 * fy, bz = z + 2 * fz;
    if (world.getBlock(bx, by, bz) !== B.AIR) return;     // blocked
    world.setBlock(bx, by, bz, front);
    world.setBlock(hx, hy, hz, B.PISTON_HEAD);
    changed.push([hx, hy, hz], [bx, by, bz]);
  } else return;                                          // immovable in front
  m.extended = true;
}

function retractPiston(world, x, y, z, id, m, changed) {
  const [fx, fy, fz] = m.facing;
  const hx = x + fx, hy = y + fy, hz = z + fz;
  if (world.getBlock(hx, hy, hz) === B.PISTON_HEAD) {
    world.setBlock(hx, hy, hz, B.AIR);
    changed.push([hx, hy, hz]);
    if (id === B.STICKY_PISTON) {
      const bx = x + 2 * fx, by = y + 2 * fy, bz = z + 2 * fz;
      const pull = world.getBlock(bx, by, bz);
      if (movable(pull)) {
        world.setBlock(bx, by, bz, B.AIR);
        world.setBlock(hx, hy, hz, pull);
        changed.push([bx, by, bz], [hx, hy, hz]);
      }
    }
  }
  m.extended = false;
}

// run one redstone tick; returns [x,y,z] coords whose blocks changed
export function tickRedstone(world) {
  const changed = [];
  const powered = new Set();
  const queue = [];

  for (const k of world.redstoneNodes) {
    const [x, y, z] = k.split(",").map(Number);
    const id = world.getBlock(x, y, z);
    if (id === B.REDSTONE_BLOCK) { powered.add(k); queue.push([x, y, z]); }
    else if (id === B.LEVER) {
      const m = world.meta.get(k);
      if (m && m.on) { powered.add(k); queue.push([x, y, z]); }
    }
  }

  // flood power through dust + repeaters
  let steps = 0;
  while (queue.length && steps < 20000) {
    steps++;
    const [x, y, z] = queue.shift();
    for (const [dx, dy, dz] of N6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nk = nx + "," + ny + "," + nz;
      if (powered.has(nk)) continue;
      if (WIRE.has(world.getBlock(nx, ny, nz))) {
        powered.add(nk);
        queue.push([nx, ny, nz]);
      }
    }
  }

  // drive pistons
  for (const k of world.redstoneNodes) {
    const [x, y, z] = k.split(",").map(Number);
    const id = world.getBlock(x, y, z);
    if (!PISTONS.has(id)) continue;
    let pw = false;
    for (const [dx, dy, dz] of N6) {
      const nk = (x + dx) + "," + (y + dy) + "," + (z + dz);
      if (powered.has(nk)) { pw = true; break; }
    }
    const m = world.meta.get(k) || { facing: [0, 1, 0], extended: false };
    if (pw && !m.extended) extendPiston(world, x, y, z, id, m, changed);
    else if (!pw && m.extended) retractPiston(world, x, y, z, id, m, changed);
    world.meta.set(k, m);
  }
  return changed;
}
