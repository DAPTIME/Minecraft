import * as THREE from "three";
import { buildAtlas, tileIcon, woodenArmorIcon } from "./textures.js";
import { World, B, BLOCKS, CHUNK, HEIGHT, MIN_Y, MAX_Y, SEA } from "./world.js";
import { tickRedstone, REDSTONE_IDS } from "./redstone.js";
import { Settings, buildSettingsUI } from "./settings.js";

// =============================================================================
// Renderer / scene
// =============================================================================
const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(Settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbcd9ff, 0x4a3b2a, 0.8);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const fog = new THREE.FogExp2(0x9ec6ff, 0.012);
scene.fog = fog;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =============================================================================
// Atlas + materials
// =============================================================================
const atlas = buildAtlas();
const matOpaque = new THREE.MeshLambertMaterial({
  map: atlas.texture, vertexColors: true, side: THREE.FrontSide,
});
const matCutout = new THREE.MeshLambertMaterial({
  map: atlas.texture, vertexColors: true, side: THREE.DoubleSide,
  alphaTest: 0.5, transparent: true,
});
const matWater = new THREE.MeshLambertMaterial({
  map: atlas.texture, vertexColors: true, side: THREE.DoubleSide,
  transparent: true, opacity: 0.72, depthWrite: false,
});

// =============================================================================
// World state (created on game start)
// =============================================================================
let SEED = 0;
let worlds = null;          // { overworld, nether }
let world = null;           // active World

let RENDER_DIST = Settings.renderDist;
const chunkMeshes = new Map();
const genQueue = [];
const meshQueue = new Set();
function chunkKey(cx, cz) { return cx + "," + cz; }

function hashSeed(str) {
  if (/^\d+$/.test(str.trim())) return (parseInt(str.trim(), 10) >>> 0) || 1;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

// =============================================================================
// Player
// =============================================================================
const player = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false, flying: false, inWater: false, inLava: false,
  health: 20, maxHealth: 20, hurtCooldown: 0, lavaCd: 0,
};
const P_RAD = 0.3, P_HEIGHT = 1.8, EYE = 1.62;
const spawn = new THREE.Vector3();

function blockSolidAt(x, y, z) {
  const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  return id !== B.AIR && BLOCKS[id].solid;
}

function collideAxis(axis) {
  const p = player.pos;
  const minX = Math.floor(p.x - P_RAD), maxX = Math.floor(p.x + P_RAD);
  const minY = Math.floor(p.y), maxY = Math.floor(p.y + P_HEIGHT);
  const minZ = Math.floor(p.z - P_RAD), maxZ = Math.floor(p.z + P_RAD);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++) {
        if (!blockSolidAt(x + 0.5, y + 0.5, z + 0.5)) continue;
        if (axis === "x") {
          if (player.vel.x > 0) p.x = x - P_RAD - 1e-4;
          else if (player.vel.x < 0) p.x = x + 1 + P_RAD + 1e-4;
          player.vel.x = 0;
        } else if (axis === "z") {
          if (player.vel.z > 0) p.z = z - P_RAD - 1e-4;
          else if (player.vel.z < 0) p.z = z + 1 + P_RAD + 1e-4;
          player.vel.z = 0;
        } else {
          if (player.vel.y > 0) { p.y = y - P_HEIGHT - 1e-4; player.vel.y = 0; }
          else if (player.vel.y < 0) {
            if (player.vel.y < -16 && !player.flying)
              hurtPlayer((-player.vel.y - 16) * 0.6);
            p.y = y + 1 + 1e-4;
            player.vel.y = 0;
            player.onGround = true;
          }
        }
        return;
      }
}

function updatePlayer(dt) {
  const feet = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.1), Math.floor(player.pos.z));
  player.inWater = feet === B.WATER;
  player.inLava = feet === B.LAVA;
  if (player.inLava) {
    player.lavaCd -= dt;
    if (player.lavaCd <= 0) { hurtPlayer(4); player.lavaCd = 0.5; }
  } else player.lavaCd = 0;

  const kb = Settings.keys;
  const speed = player.flying ? 9 : keys.has(kb.sprint) ? 6.5 : 4.3;
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const wish = new THREE.Vector3();
  if (keys.has(kb.forward)) wish.add(fwd);
  if (keys.has(kb.back)) wish.sub(fwd);
  if (keys.has(kb.right)) wish.add(right);
  if (keys.has(kb.left)) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
  player.vel.x = wish.x;
  player.vel.z = wish.z;

  if (player.flying) {
    player.vel.y = 0;
    if (keys.has(kb.jump)) player.vel.y = speed;
    if (keys.has(kb.sprint)) player.vel.y = -speed;
  } else {
    const grav = player.inWater ? 9 : 28;
    player.vel.y -= grav * dt;
    if (player.inWater) {
      player.vel.y = Math.max(player.vel.y, -4);
      if (keys.has(kb.jump)) player.vel.y = 4;
    } else if (keys.has(kb.jump) && player.onGround) {
      player.vel.y = 9.2;
    }
  }

  player.onGround = false;
  player.pos.x += player.vel.x * dt; collideAxis("x");
  player.pos.z += player.vel.z * dt; collideAxis("z");
  player.pos.y += player.vel.y * dt; collideAxis("y");

  // keep inside the world border
  const lim = world.limit - 1;
  player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
  player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));

  if (player.pos.y < MIN_Y - 8) { player.pos.copy(spawn); player.vel.set(0, 0, 0); }

  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
}

// =============================================================================
// Chunk manager
// =============================================================================
function queueAround(pcx, pcz) {
  const limC = Math.floor(world.limit / CHUNK);
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (dx * dx + dz * dz > (RENDER_DIST + 0.5) ** 2) continue;
      if (Math.abs(cx) > limC || Math.abs(cz) > limC) continue;
      const k = chunkKey(cx, cz);
      if (!world.decorated.has(k) && !genQueue.some(c => c.k === k))
        genQueue.push({ k, cx, cz, d: dx * dx + dz * dz });
    }
  genQueue.sort((a, b) => a.d - b.d);
}

function disposeMesh(entry) {
  scene.remove(entry.group);
  for (const m of [entry.opaque, entry.cutout, entry.water])
    if (m) m.geometry.dispose();
}

function buildChunkMesh(cx, cz) {
  const k = chunkKey(cx, cz);
  const geo = world.buildMesh(cx, cz);
  if (!geo) return;
  if (chunkMeshes.has(k)) disposeMesh(chunkMeshes.get(k));
  const group = new THREE.Group();
  const entry = { group };
  const mk = (g, mat, key) => {
    if (!g) return;
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(cx * CHUNK, MIN_Y, cz * CHUNK);
    group.add(mesh);
    entry[key] = mesh;
  };
  mk(geo.opaque, matOpaque, "opaque");
  mk(geo.cutout, matCutout, "cutout");
  mk(geo.water, matWater, "water");
  scene.add(group);
  chunkMeshes.set(k, entry);
}

function updateChunks() {
  const pcx = Math.floor(player.pos.x / CHUNK);
  const pcz = Math.floor(player.pos.z / CHUNK);

  let budget = 3;
  while (budget-- > 0 && genQueue.length) {
    const { cx, cz } = genQueue.shift();
    world.generateChunk(cx, cz);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const k = chunkKey(cx + dx, cz + dz);
        if (world.decorated.has(k)) meshQueue.add(k);
      }
  }
  let mbudget = 4;
  for (const k of meshQueue) {
    if (mbudget-- <= 0) break;
    const [cx, cz] = k.split(",").map(Number);
    buildChunkMesh(cx, cz);
    meshQueue.delete(k);
  }
  for (const [k, entry] of chunkMeshes) {
    const [cx, cz] = k.split(",").map(Number);
    if (Math.abs(cx - pcx) > RENDER_DIST + 2 || Math.abs(cz - pcz) > RENDER_DIST + 2) {
      disposeMesh(entry);
      chunkMeshes.delete(k);
    }
  }
}

function remeshDirty(keys) {
  for (const k of keys) {
    const [cx, cz] = k.split(",").map(Number);
    if (world.decorated.has(k)) buildChunkMesh(cx, cz);
  }
}
function remeshCoords(coords) {
  const keys = new Set();
  for (const [x, , z] of coords) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    keys.add(chunkKey(cx, cz));
    keys.add(chunkKey(cx + 1, cz)); keys.add(chunkKey(cx - 1, cz));
    keys.add(chunkKey(cx, cz + 1)); keys.add(chunkKey(cx, cz - 1));
  }
  remeshDirty(keys);
}

// =============================================================================
// Block edits (with redstone bookkeeping)
// =============================================================================
function editBlock(x, y, z, id, meta) {
  const affected = world.setBlock(x, y, z, id);
  const k = x + "," + y + "," + z;
  if (REDSTONE_IDS.has(id)) {
    world.redstoneNodes.add(k);
    if (meta) world.meta.set(k, meta);
  } else {
    world.redstoneNodes.delete(k);
  }
  return affected;
}

// =============================================================================
// Raycast
// =============================================================================
function raycastBlock() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  let prev = null;
  for (let t = 0; t < 6; t += 0.05) {
    const p = origin.clone().addScaledVector(dir, t);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const id = world.getBlock(bx, by, bz);
    if (id !== B.AIR && id !== B.WATER) return { hit: [bx, by, bz], prev };
    prev = [bx, by, bz];
  }
  return null;
}

// =============================================================================
// Hotbar / inventory
// =============================================================================
const ALL_BLOCKS = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.GRAVEL, B.SANDSTONE, B.ORANGE,
  B.LOG, B.PLANKS, B.LEAVES, B.BIRCH_LOG, B.BIRCH_PLANKS, B.BIRCH_LEAVES,
  B.SPRUCE_LOG, B.SPRUCE_PLANKS, B.SPRUCE_LEAVES, B.GLASS, B.CACTUS,
  B.NETHERRACK, B.SLIME, B.WOOL, B.LAVA,
  B.REDSTONE_BLOCK, B.REDSTONE_DUST, B.LEVER, B.REPEATER,
  B.PISTON, B.STICKY_PISTON, B.PORTAL,
];
// each hotbar slot: { id, count }.  id === B.AIR means empty.
const hotbar = Array.from({ length: 9 }, () => ({ id: B.AIR, count: 0 }));
let selected = 0;
let gamemode = "survival";          // "survival" | "creative"

const hotbarEl = document.getElementById("hotbar");
function tileNameFor(id) {
  const b = BLOCKS[id];
  return b.all || b.top || b.side;
}
function buildHotbar() {
  hotbarEl.innerHTML = "";
  hotbar.forEach((slot, i) => {
    const el = document.createElement("div");
    el.className = "slot" + (i === selected ? " active" : "");
    if (slot.id !== B.AIR) {
      el.appendChild(tileIcon(tileNameFor(slot.id)));
      const label = document.createElement("div");
      label.className = "label";
      label.textContent = BLOCKS[slot.id].name;
      el.appendChild(label);
      if (gamemode === "survival") {
        const c = document.createElement("div");
        c.className = "count";
        c.textContent = slot.count;
        el.appendChild(c);
      }
    }
    el.onclick = () => { selected = i; buildHotbar(); updateHand(); };
    hotbarEl.appendChild(el);
  });
}

// survival: add one block to the hotbar inventory
function giveItem(id) {
  if (id === B.AIR) return;
  for (const s of hotbar)
    if (s.id === id && s.count > 0 && s.count < 99) { s.count++; buildHotbar(); updateHand(); return; }
  for (const s of hotbar)
    if (s.id === B.AIR) { s.id = id; s.count = 1; buildHotbar(); updateHand(); return; }
}

const invGrid = document.getElementById("inv-grid");
const armorSlotEl = document.getElementById("armor-slot");
const invHint = document.querySelector("#inventory .hint");
function buildInventory() {
  invGrid.innerHTML = "";
  if (gamemode === "creative") {
    for (const id of ALL_BLOCKS) {
      const cell = document.createElement("div");
      cell.className = "inv-item";
      cell.appendChild(tileIcon(tileNameFor(id), 40));
      cell.title = BLOCKS[id].name;
      cell.onclick = () => {
        hotbar[selected] = { id, count: 1 };
        buildHotbar(); updateHand();
      };
      invGrid.appendChild(cell);
    }
    invHint.textContent = "Creative mode — click a block to put it on the hotbar.";
  } else {
    invHint.textContent = "Survival mode — break blocks to collect them. Open chat and type /gamemode creative to switch.";
  }
  armorSlotEl.innerHTML = "";
  if (armor.owned) armorSlotEl.appendChild(woodenArmorIcon(56));
  else armorSlotEl.textContent = "empty";
  armorSlotEl.onclick = () => equipArmor();
}

const handEl = document.getElementById("hand");
function updateHand() {
  const id = hotbar[selected].id;
  handEl.style.backgroundImage =
    id === B.AIR ? "none" : `url(${tileIcon(tileNameFor(id), 180).toDataURL()})`;
}

function setGamemode(g) {
  if (g !== "survival" && g !== "creative") return;
  gamemode = g;
  player.flying = (g === "creative");          // creative auto-enables fly
  buildHotbar(); buildInventory(); updateHand();
  chatMsg("Game mode set to " + g);
}

// =============================================================================
// Wooden armor — breaks after 10 hits
// =============================================================================
const armor = { owned: true, equipped: false, durability: 10, maxDurability: 10 };
function equipArmor() {
  if (!armor.owned) { toast("You have no Wooden Armor"); return; }
  armor.equipped = !armor.equipped;
  if (armor.equipped) {
    armor.durability = armor.maxDurability;
    toast("Wooden Armor equipped — flimsy (10 hits)");
  } else toast("Wooden Armor removed");
  updateHUD();
}

// =============================================================================
// Damage / death
// =============================================================================
function hurtPlayer(amount) {
  if (gamemode === "creative") return;            // creative is invulnerable
  if (player.hurtCooldown > 0 || amount <= 0) return;
  player.hurtCooldown = 0.5;
  if (armor.equipped) {
    amount *= 0.8;
    armor.durability -= 1;
    if (armor.durability <= 0) {
      armor.equipped = false; armor.owned = false;
      toast("Your Wooden Armor broke!");
      buildInventory();
    }
  }
  player.health = Math.max(0, player.health - amount);
  updateHUD();
  if (player.health <= 0) die();
}
function die() {
  document.exitPointerLock();
  document.getElementById("death").classList.remove("hidden");
}
document.getElementById("respawn").onclick = () => {
  player.health = player.maxHealth;
  player.pos.copy(spawn);
  player.vel.set(0, 0, 0);
  document.getElementById("death").classList.add("hidden");
  canvas.requestPointerLock();
};

// =============================================================================
// HUD
// =============================================================================
const healthbar = document.getElementById("healthbar");
const armorbar = document.getElementById("armorbar");
function updateHUD() {
  healthbar.innerHTML = "";
  const full = Math.round(player.health / 2);
  for (let i = 0; i < 10; i++) {
    const p = document.createElement("div");
    p.className = "pip " + (i < full ? "heart-full" : "heart-empty");
    healthbar.appendChild(p);
  }
  armorbar.innerHTML = "";
  if (armor.equipped)
    for (let i = 0; i < armor.maxDurability; i++) {
      const p = document.createElement("div");
      p.className = "pip " + (i < armor.durability ? "armor-full" : "armor-empty");
      armorbar.appendChild(p);
    }
}
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); toastTimer = 2.5; }

// =============================================================================
// Mobs
// =============================================================================
const mobs = [];
function boxMesh(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
}
function makeVillager() {
  const g = new THREE.Group();
  const body = boxMesh(0.5, 0.8, 0.3, 0x6d4f37); body.position.y = 0.7; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0xc99a6b); head.position.y = 1.32; g.add(head);
  const nose = boxMesh(0.12, 0.18, 0.14, 0xb07a4f); nose.position.set(0, 1.28, 0.25); g.add(nose);
  const aL = boxMesh(0.14, 0.7, 0.2, 0x5a4029); aL.position.set(-0.32, 0.75, 0); g.add(aL);
  const aR = boxMesh(0.14, 0.7, 0.2, 0x5a4029); aR.position.set(0.32, 0.75, 0); g.add(aR);
  return g;
}
function makeZombie() {
  const g = new THREE.Group();
  const body = boxMesh(0.5, 0.8, 0.28, 0x3a6b3a); body.position.y = 0.7; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0x4f8f4f); head.position.y = 1.32; g.add(head);
  const aL = boxMesh(0.16, 0.7, 0.2, 0x4f8f4f); aL.position.set(-0.33, 1.0, 0.25); aL.rotation.x = -1.4; g.add(aL);
  const aR = boxMesh(0.16, 0.7, 0.2, 0x4f8f4f); aR.position.set(0.33, 1.0, 0.25); aR.rotation.x = -1.4; g.add(aR);
  return g;
}
function makeCreeper() {
  const g = new THREE.Group();
  const body = boxMesh(0.45, 1.0, 0.3, 0x4a8a3a); body.position.y = 0.95; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0x4f8f4f); head.position.y = 1.65; g.add(head);
  const eyeL = boxMesh(0.1, 0.1, 0.05, 0x1a1a1a); eyeL.position.set(-0.11, 1.68, 0.22); g.add(eyeL);
  const eyeR = boxMesh(0.1, 0.1, 0.05, 0x1a1a1a); eyeR.position.set(0.11, 1.68, 0.22); g.add(eyeR);
  const mouth = boxMesh(0.16, 0.16, 0.05, 0x1a1a1a); mouth.position.set(0, 1.5, 0.22); g.add(mouth);
  for (const [x, z] of [[-0.13, -0.1], [0.13, -0.1], [-0.13, 0.1], [0.13, 0.1]]) {
    const leg = boxMesh(0.18, 0.42, 0.18, 0x3a6b3a);
    leg.position.set(x, 0.21, z);
    g.add(leg);
  }
  return g;
}

function makePillager() {
  const g = new THREE.Group();
  const body = boxMesh(0.5, 0.8, 0.28, 0x53565c); body.position.y = 0.7; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0x9aa0a6); head.position.y = 1.32; g.add(head);
  const nose = boxMesh(0.12, 0.2, 0.16, 0x7c8086); nose.position.set(0, 1.28, 0.26); g.add(nose);
  const aL = boxMesh(0.15, 0.7, 0.2, 0x44464b); aL.position.set(-0.32, 0.95, 0.2); aL.rotation.x = -1.0; g.add(aL);
  const aR = boxMesh(0.15, 0.7, 0.2, 0x44464b); aR.position.set(0.32, 0.95, 0.2); aR.rotation.x = -1.0; g.add(aR);
  return g;
}
// topmost solid block that has two air blocks above it (standing room)
function groundHeightAt(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  for (let y = MAX_Y - 2; y > MIN_Y; y--) {
    const id = world.getBlock(ix, y, iz);
    if (id !== B.AIR && id !== B.WATER && BLOCKS[id] && BLOCKS[id].solid &&
        world.getBlock(ix, y + 1, iz) === B.AIR &&
        world.getBlock(ix, y + 2, iz) === B.AIR)
      return y + 1;
  }
  return MIN_Y + 1;
}
function spawnMob(type, x, y, z) {
  const mesh = type === "zombie"   ? makeZombie()
             : type === "pillager" ? makePillager()
             : type === "creeper"  ? makeCreeper()
             :                       makeVillager();
  scene.add(mesh);
  const mob = {
    type, mesh,
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
    health: type === "creeper"  ? 8
          : type === "zombie"   ? 10
          : type === "pillager" ? 16
          :                       12,
    home: new THREE.Vector3(x, y, z), wander: new THREE.Vector3(x, y, z),
    attackCd: 0, wanderCd: 0, fuse: 0,
  };
  mobs.push(mob);
  return mob;
}

// blow up an area around (ex,ey,ez): damages player and clears blocks
function explodeAt(ex, ey, ez) {
  const radius = 3;
  const affected = new Set();
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dz = -radius; dz <= radius; dz++) {
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > radius * radius) continue;
        const x = Math.floor(ex + dx), y = Math.floor(ey + dy), z = Math.floor(ez + dz);
        const id = world.getBlock(x, y, z);
        if (id === B.AIR || id === B.BEDROCK) continue;
        const a = world.setBlock(x, y, z, B.AIR);
        for (const k of a) affected.add(k);
      }
  remeshDirty(affected);
  redstoneTimer = 0;
  const dist = player.pos.distanceTo(new THREE.Vector3(ex, ey, ez));
  if (dist < 5) {
    hurtPlayer(12 * (1 - dist / 5));
    const kb = player.pos.clone().sub(new THREE.Vector3(ex, ey, ez)).setY(0).normalize();
    player.vel.addScaledVector(kb, 7);
    player.vel.y += 5;
  }
}
function clearMobs() {
  for (const m of mobs) scene.remove(m.mesh);
  mobs.length = 0;
}
function spawnVillagers() {
  for (const s of world.villagerSpawns) {
    if (mobs.length > 80) break;
    const at = new THREE.Vector3(s.x, s.y, s.z);
    if (mobs.some(m => m.type === "villager" && m.home.distanceTo(at) < 0.5)) continue;
    if (player.pos.distanceTo(at) < 90) spawnMob("villager", s.x, s.y, s.z);
  }
}
function spawnPillagers() {
  for (const s of world.pillagerSpawns) {
    if (mobs.length > 90) break;
    const at = new THREE.Vector3(s.x, s.y, s.z);
    if (mobs.some(m => m.type === "pillager" && m.home.distanceTo(at) < 0.5)) continue;
    if (player.pos.distanceTo(at) < 70) spawnMob("pillager", s.x, s.y, s.z);
  }
}
function spawnZombies() {
  const dark = world.nether || !isDay();
  if (!dark) return;
  const hostiles = mobs.filter(m => m.type === "zombie" || m.type === "creeper").length;
  if (hostiles >= 16) return;
  if (Math.random() > 0.045) return;
  const ang = Math.random() * Math.PI * 2, r = 16 + Math.random() * 18;
  const x = player.pos.x + Math.cos(ang) * r, z = player.pos.z + Math.sin(ang) * r;
  if (!world.decorated.has(chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)))) return;
  const y = groundHeightAt(x, z);
  if (y <= MIN_Y + 1) return;
  const type = Math.random() < 0.32 ? "creeper" : "zombie";
  spawnMob(type, x, y, z);
}
function updateMobs(dt) {
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    const toPlayer = player.pos.clone().sub(m.pos);
    const dist = toPlayer.length();
    if (dist > 110) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }

    const move = new THREE.Vector3();
    if (m.type !== "villager") {
      if (m.type === "zombie" && !world.nether && isDay() && m.pos.y > SEA) m.health -= dt * 4;
      const aggro = m.type === "pillager" ? 32 : m.type === "creeper" ? 24 : 26;
      if (dist < aggro) {
        const speedScale = m.type === "pillager" ? 2.9 : m.type === "creeper" ? 2.5 : 2.6;
        move.copy(toPlayer).setY(0).normalize().multiplyScalar(speedScale);

        if (m.type === "creeper") {
          if (dist < 3.2) {
            m.fuse += dt;
            const s = 1 + Math.sin(m.fuse * 28) * 0.08;
            m.mesh.scale.set(s, 1 + m.fuse * 0.05, s);
            if (m.fuse > 1.5) {
              explodeAt(m.pos.x, m.pos.y + 0.6, m.pos.z);
              m.health = 0;
            }
          } else if (m.fuse > 0) {
            m.fuse = 0;
            m.mesh.scale.set(1, 1, 1);
          }
        } else if (dist < 1.6 && m.attackCd <= 0) {
          hurtPlayer(m.type === "pillager" ? 3 : 4);
          m.attackCd = 1.0;
          player.vel.addScaledVector(toPlayer.setY(0).normalize(), 4);
          player.vel.y += 3;
        }
      } else if (m.type === "creeper" && m.fuse > 0) {
        m.fuse = 0;
        m.mesh.scale.set(1, 1, 1);
      }
    } else {
      m.wanderCd -= dt;
      if (m.wanderCd <= 0) {
        m.wander.set(m.home.x + (Math.random() - 0.5) * 8, m.home.y,
                     m.home.z + (Math.random() - 0.5) * 8);
        m.wanderCd = 3 + Math.random() * 4;
      }
      const toW = m.wander.clone().sub(m.pos).setY(0);
      if (toW.length() > 0.6) move.copy(toW).normalize().multiplyScalar(1.3);
    }
    if (m.attackCd > 0) m.attackCd -= dt;

    m.vel.x = move.x; m.vel.z = move.z;
    m.vel.y -= 24 * dt;
    m.pos.addScaledVector(m.vel, dt);
    const gh = groundHeightAt(m.pos.x, m.pos.z);
    if (m.pos.y <= gh) { m.pos.y = gh; if (m.vel.y < 0) m.vel.y = 0; }

    if (m.health <= 0) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }
    m.mesh.position.copy(m.pos);
    if (move.lengthSq() > 0.01) m.mesh.rotation.y = Math.atan2(move.x, move.z);
  }
}
function attackMob() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  let best = null, bestT = 4;
  for (const m of mobs) {
    const center = m.pos.clone(); center.y += 1;
    const toM = center.clone().sub(origin);
    const t = toM.dot(dir);
    if (t < 0 || t > bestT) continue;
    if (origin.clone().addScaledVector(dir, t).distanceTo(center) < 0.7) { best = m; bestT = t; }
  }
  if (best) {
    best.health -= 5;
    const kb = best.pos.clone().sub(player.pos).setY(0).normalize();
    best.vel.addScaledVector(kb, 5); best.vel.y = 4;
    return true;
  }
  return false;
}

// =============================================================================
// Day / night
// =============================================================================
const DAY_LENGTH = 600;          // ten-minute day/night cycle
let timeOfDay = 0.25;
function isDay() { return timeOfDay > 0 && timeOfDay < 0.5; }
function updateSky(dt) {
  if (world.nether) {
    sun.intensity = 0;
    ambient.intensity = 0.55;
    hemi.intensity = 0.4;
    const c = new THREE.Color(0x2a0d0a);
    scene.background = c; fog.color.copy(c); fog.density = 0.03;
    return;
  }
  fog.density = 0.012;
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  const ang = timeOfDay * Math.PI * 2;
  sun.position.set(Math.cos(ang) * 100, Math.sin(ang) * 100, 40);
  const b = Math.max(0.08, Math.sin(ang));
  sun.intensity = b;
  ambient.intensity = 0.2 + b * 0.35;
  hemi.intensity = 0.3 + b * 0.6;
  const sky = new THREE.Color(0x0a1330).lerp(new THREE.Color(0x9ec6ff), b);
  scene.background = sky; fog.color.copy(sky);
}

// =============================================================================
// Dimension travel (Nether portal, 8:1 scale)
// =============================================================================
let portalTimer = 0, portalCooldown = 0;
function inPortal() {
  return world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y), Math.floor(player.pos.z)) === B.PORTAL
      || world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 1), Math.floor(player.pos.z)) === B.PORTAL;
}
function switchDimension() {
  const toNether = !world.nether;
  const scale = toNether ? 1 / 8 : 8;
  let nx = player.pos.x * scale, nz = player.pos.z * scale;
  world = toNether ? worlds.nether : worlds.overworld;
  const lim = world.limit - 2;
  nx = Math.max(-lim, Math.min(lim, nx));
  nz = Math.max(-lim, Math.min(lim, nz));

  // wipe current dimension's render state
  for (const e of chunkMeshes.values()) disposeMesh(e);
  chunkMeshes.clear();
  genQueue.length = 0; meshQueue.clear();
  clearMobs();

  // generate landing area
  const cx = Math.floor(nx / CHUNK), cz = Math.floor(nz / CHUNK);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) world.generateChunk(cx + dx, cz + dz);

  const gx = Math.floor(nx), gz = Math.floor(nz);
  let gy = groundHeightAt(nx, nz);
  // carve a niche and place a return portal
  for (let y = 0; y < 3; y++) world.setBlock(gx, gy + y, gz, B.AIR);
  world.setBlock(gx, gy, gz, B.PORTAL);
  world.setBlock(gx, gy + 1, gz, B.PORTAL);

  player.pos.set(gx + 0.5, gy + 0.1, gz + 0.5);
  player.vel.set(0, 0, 0);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) buildChunkMesh(cx + dx, cz + dz);
  queueAround(cx, cz);
  portalCooldown = 5;
  toast(toNether ? "Entering the Nether" : "Returning to the Overworld");
}

// =============================================================================
// Input
// =============================================================================
const keys = new Set();
let mouseDownL = false, breakCd = 0;

window.addEventListener("keydown", (e) => {
  const code = e.code.toLowerCase();
  if (chatOpen) return;                       // chat input handles its own keys
  keys.add(code);
  if (!running) return;
  if (!inventoryOpen && (code === "keyt" || code === "slash")) {
    e.preventDefault();
    openChat(code === "slash" ? "/" : "");
    return;
  }
  if (code === Settings.keys.inventory) { e.preventDefault(); toggleInventory(); }
  if (code === Settings.keys.fly) {
    if (gamemode === "creative") {
      player.flying = !player.flying;
      toast("Fly " + (player.flying ? "on" : "off"));
    } else toast("Flying is for creative mode");
  }
  if (code === "keyr") equipArmor();
  if (code.startsWith("digit")) {
    const n = parseInt(code.slice(5));
    if (n >= 1 && n <= 9) { selected = n - 1; buildHotbar(); updateHand(); }
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code.toLowerCase()));

canvas.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) { mouseDownL = true; swingHand(); attackMob(); }
  if (e.button === 2) { swingHand(); doPlace(); }
});
canvas.addEventListener("mouseup", (e) => { if (e.button === 0) mouseDownL = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0024 * Settings.sensitivity;
  player.pitch -= e.movementY * 0.0024 * Settings.sensitivity;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});
window.addEventListener("wheel", (e) => {
  if (document.pointerLockElement !== canvas) return;
  selected = (selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
  buildHotbar(); updateHand();
});

const handEl2 = document.getElementById("hand");
let swingTimer = 0;
function swingHand() { handEl2.classList.add("swing"); swingTimer = 0.12; }

// per-block break time in seconds
const HARDNESS = {
  [B.DIRT]: 0.5, [B.GRASS]: 0.5, [B.PATH]: 0.5, [B.SAND]: 0.5, [B.GRAVEL]: 0.6,
  [B.LEAVES]: 0.3, [B.BIRCH_LEAVES]: 0.3, [B.SPRUCE_LEAVES]: 0.3,
  [B.LOG]: 1.2, [B.BIRCH_LOG]: 1.2, [B.SPRUCE_LOG]: 1.2,
  [B.PLANKS]: 1.0, [B.BIRCH_PLANKS]: 1.0, [B.SPRUCE_PLANKS]: 1.0,
  [B.GLASS]: 0.3, [B.WOOL]: 0.8, [B.SLIME]: 0.4, [B.CACTUS]: 0.4,
  [B.STONE]: 2.0, [B.COBBLE]: 2.0, [B.SANDSTONE]: 1.5, [B.NETHERRACK]: 0.8,
  [B.ORANGE]: 1.2, [B.REDSTONE_BLOCK]: 1.8,
  [B.PISTON]: 0.6, [B.STICKY_PISTON]: 0.6, [B.PISTON_HEAD]: 0.6,
  [B.LEVER]: 0.2, [B.REDSTONE_DUST]: 0.1, [B.REPEATER]: 0.3,
  [B.PORTAL]: 0.5,
};
function hardnessOf(id) { return HARDNESS[id] ?? 1.0; }

let breakState = null;            // { x, y, z, t, hardness }
const breakbar = document.getElementById("breakbar");
const breakbarFill = breakbar.querySelector(".fill");
let lastBreakSwing = 0;

function breakBlockAt(x, y, z, id) {
  if (id === B.BEDROCK || id === B.AIR) return;
  remeshDirty(editBlock(x, y, z, B.AIR));
  redstoneTimer = 0;
  if (gamemode === "survival") giveItem(id);
}

function tickBreaking(dt) {
  if (!mouseDownL) {
    breakState = null;
    breakbar.classList.remove("show");
    return;
  }
  const r = raycastBlock();
  if (!r) { breakState = null; breakbar.classList.remove("show"); return; }
  const [x, y, z] = r.hit;
  const id = world.getBlock(x, y, z);
  if (id === B.AIR || id === B.WATER || id === B.LAVA || id === B.BEDROCK) {
    breakState = null; breakbar.classList.remove("show"); return;
  }

  // continuously animate the hand swing while breaking
  lastBreakSwing -= dt;
  if (lastBreakSwing <= 0) { swingHand(); lastBreakSwing = 0.25; }

  if (gamemode === "creative") {
    breakState = null;
    breakbar.classList.remove("show");
    if (breakCd <= 0) { breakBlockAt(x, y, z, id); breakCd = 0.18; }
    return;
  }

  // survival: progress over time, only counts on the same block
  if (!breakState || breakState.x !== x || breakState.y !== y || breakState.z !== z)
    breakState = { x, y, z, t: 0, hardness: hardnessOf(id) };
  breakState.t += dt;
  breakbar.classList.add("show");
  const pct = Math.min(100, breakState.t / breakState.hardness * 100);
  breakbarFill.style.width = pct + "%";
  if (breakState.t >= breakState.hardness) {
    breakBlockAt(x, y, z, id);
    breakState = null;
    breakbar.classList.remove("show");
  }
}

function doPlace() {
  const r = raycastBlock();
  if (!r) return;
  // right-click a lever to toggle it
  if (world.getBlock(...r.hit) === B.LEVER) {
    const k = r.hit.join(",");
    const m = world.meta.get(k) || {};
    m.on = !m.on;
    world.meta.set(k, m);
    redstoneTimer = 0;                    // re-evaluate immediately
    return;
  }
  if (!r.prev) return;
  const [x, y, z] = r.prev;
  if (y > MAX_Y || y < MIN_Y) return;
  const slot = hotbar[selected];
  const id = slot.id;
  if (id === B.AIR) return;
  if (gamemode === "survival" && slot.count <= 0) return;
  const pminX = player.pos.x - P_RAD, pmaxX = player.pos.x + P_RAD;
  const pminZ = player.pos.z - P_RAD, pmaxZ = player.pos.z + P_RAD;
  if (BLOCKS[id].solid &&
      x + 1 > pminX && x < pmaxX && z + 1 > pminZ && z < pmaxZ &&
      y + 1 > player.pos.y && y < player.pos.y + P_HEIGHT) return;
  if (world.getBlock(x, y, z) !== B.AIR) return;

  let meta = null;
  if (id === B.PISTON || id === B.STICKY_PISTON) {
    // piston pushes outward from the clicked face — take the dominant axis
    // of (r.prev - r.hit) so the facing is always axis-aligned
    const dx = r.prev[0] - r.hit[0];
    const dy = r.prev[1] - r.hit[1];
    const dz = r.prev[2] - r.hit[2];
    const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
    let facing;
    if (ax >= ay && ax >= az) facing = [Math.sign(dx) || 1, 0, 0];
    else if (ay >= az)         facing = [0, Math.sign(dy) || 1, 0];
    else                       facing = [0, 0, Math.sign(dz) || 1];
    meta = { facing, extended: false };
  }
  remeshDirty(editBlock(x, y, z, id, meta));
  redstoneTimer = 0;                      // react to power change next frame
  if (gamemode === "survival") {
    slot.count--;
    if (slot.count <= 0) slot.id = B.AIR;
    buildHotbar(); updateHand();
  }
}

// =============================================================================
// Chat
// =============================================================================
let chatOpen = false, chatFadeT = 0;
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatMessages = [];
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function chatMsg(text) {
  chatMessages.push(text);
  while (chatMessages.length > 8) chatMessages.shift();
  chatLog.innerHTML = chatMessages.map(m => `<div>${escapeHtml(m)}</div>`).join("");
  chatLog.classList.add("show");
  clearTimeout(chatFadeT);
  chatFadeT = setTimeout(() => { if (!chatOpen) chatLog.classList.remove("show"); }, 6000);
}
function openChat(prefill) {
  chatOpen = true;
  keys.clear();
  chatInput.value = prefill || "";
  chatInput.classList.remove("hidden");
  chatLog.classList.add("show");
  document.exitPointerLock();
  chatInput.focus();
}
function closeChat() {
  chatOpen = false;
  chatInput.classList.add("hidden");
  chatInput.blur();
  if (running) canvas.requestPointerLock();
}
function runCommand(t) {
  if (!t.startsWith("/")) { chatMsg("<You> " + t); return; }
  const p = t.slice(1).trim().split(/\s+/);
  if (p[0] === "gamemode") {
    const g = (p[1] || "").toLowerCase();
    if (g === "creative" || g === "c") setGamemode("creative");
    else if (g === "survival" || g === "s") setGamemode("survival");
    else chatMsg("Usage: /gamemode <creative|survival>");
  } else if (p[0] === "help") {
    chatMsg("Commands: /gamemode creative | /gamemode survival | /settings");
  } else if (p[0] === "settings") {
    buildSettingsUI(applySettings);
    menu.classList.add("hidden");
    settingsOverlay.classList.remove("hidden");
    document.exitPointerLock();
    closeChat();
  } else {
    chatMsg("Unknown command: /" + p[0]);
  }
}
chatInput.addEventListener("keydown", (e) => {
  e.stopPropagation();
  if (e.code === "Enter") {
    const t = chatInput.value.trim();
    if (t) runCommand(t);
    closeChat();
  } else if (e.code === "Escape") {
    closeChat();
  }
});

// =============================================================================
// Inventory / menu
// =============================================================================
let inventoryOpen = false;
function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  document.getElementById("inventory").classList.toggle("hidden", !inventoryOpen);
  if (inventoryOpen) document.exitPointerLock();
  else if (running) canvas.requestPointerLock();
}

const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 }));
highlight.visible = false;
scene.add(highlight);
function updateHighlight() {
  const r = raycastBlock();
  if (r) { highlight.visible = true; highlight.position.set(r.hit[0] + 0.5, r.hit[1] + 0.5, r.hit[2] + 0.5); }
  else highlight.visible = false;
}

// =============================================================================
// Start
// =============================================================================
let running = false;
const menu = document.getElementById("menu");

function findSpawn() {
  world.generateChunk(0, 0);
  for (let y = MAX_Y; y > MIN_Y; y--) {
    const id = world.getBlock(8, y, 8);
    if (id !== B.AIR && id !== B.WATER) { spawn.set(8.5, y + 1.2, 8.5); break; }
  }
  player.pos.copy(spawn);
}

function startGame() {
  const seedInput = document.getElementById("seed");
  SEED = hashSeed(seedInput && seedInput.value ? seedInput.value : String(Math.random()));
  worlds = {
    overworld: new World(SEED, atlas, "overworld"),
    nether: new World(SEED ^ 0x9e3779b9, atlas, "nether"),
  };
  world = worlds.overworld;

  findSpawn();
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) world.generateChunk(dx, dz);
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) buildChunkMesh(dx, dz);
  queueAround(0, 0);

  buildHotbar(); buildInventory(); updateHand(); updateHUD();
  running = true;
  menu.classList.add("hidden");
  canvas.requestPointerLock();
  toast("Esc for pause menu  •  /settings to open settings");
}
function applySettings() {
  RENDER_DIST = Settings.renderDist;
  camera.fov = Settings.fov;
  camera.updateProjectionMatrix();
  scene.fog = Settings.fog ? fog : null;
}

document.getElementById("play").onclick = () => {
  if (running) { menu.classList.add("hidden"); canvas.requestPointerLock(); }
  else startGame();
};
const settingsOverlay = document.getElementById("settings");
function showMenu() {
  document.getElementById("play").textContent = running ? "Resume" : "Play";
  const seedRow = document.querySelector(".seedrow");
  if (seedRow) seedRow.style.display = running ? "none" : "";
  menu.classList.remove("hidden");
}
document.getElementById("open-settings").onclick = () => {
  buildSettingsUI(applySettings);
  menu.classList.add("hidden");
  settingsOverlay.classList.remove("hidden");
};
document.getElementById("settings-close").onclick = () => {
  settingsOverlay.classList.add("hidden");
  if (running) canvas.requestPointerLock();    // resume the game directly
  else showMenu();
};
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas && running && !inventoryOpen && !chatOpen
      && document.getElementById("death").classList.contains("hidden")
      && settingsOverlay.classList.contains("hidden"))
    showMenu();
  else menu.classList.add("hidden");
});

// =============================================================================
// Loop
// =============================================================================
const debugEl = document.getElementById("debug");
let last = performance.now();
let villagerTimer = 0, regenTimer = 3, redstoneTimer = 0;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running && !inventoryOpen && !chatOpen) {
    updatePlayer(dt);
    updateMobs(dt);
    spawnZombies();
    villagerTimer -= dt;
    if (villagerTimer <= 0) { spawnVillagers(); spawnPillagers(); villagerTimer = 2; }

    // redstone tick
    redstoneTimer -= dt;
    if (redstoneTimer <= 0) {
      redstoneTimer = 0.15;
      const changed = tickRedstone(world);
      if (changed.length) remeshCoords(changed);
    }

    // portal
    if (portalCooldown > 0) portalCooldown -= dt;
    if (portalCooldown <= 0 && inPortal()) {
      portalTimer += dt;
      if (portalTimer > 1.2) { switchDimension(); portalTimer = 0; }
    } else portalTimer = 0;

    tickBreaking(dt);
    if (breakCd > 0) breakCd -= dt;

    if (player.health > 0 && player.health < player.maxHealth) {
      regenTimer -= dt;
      if (regenTimer <= 0) {
        player.health = Math.min(player.maxHealth, player.health + 1);
        regenTimer = 3; updateHUD();
      }
    }
  }

  if (running) { updateChunks(); updateSky(dt); updateHighlight(); }

  if (swingTimer > 0) { swingTimer -= dt; if (swingTimer <= 0) handEl2.classList.remove("swing"); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.classList.remove("show"); }

  if (running)
    debugEl.textContent =
      `DevCraft  seed ${SEED}  [${world.nether ? "Nether" : "Overworld"}]\n` +
      `xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
      `chunks ${chunkMeshes.size}  mobs ${mobs.length}  border ±${world.limit}\n` +
      `${world.nether ? "" : (timeOfDay * 24).toFixed(1) + "h  " + (isDay() ? "day" : "night") + "  "}` +
      `${gamemode}  fly ${player.flying ? "on" : "off"}  armor ${armor.equipped ? armor.durability + "/10" : "off"}`;

  renderer.render(scene, camera);
}
applySettings();
if (location.search.indexOf("reset") !== -1)
  toast("Settings reset and cache flushed");
loop();
