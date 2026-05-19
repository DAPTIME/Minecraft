import * as THREE from "three";
import { buildAtlas, tileIcon, woodenArmorIcon } from "./textures.js";
import { World, B, BLOCKS, CHUNK, HEIGHT, SEA } from "./world.js";

// =============================================================================
// Renderer / scene
// =============================================================================
const canvas = document.getElementById("canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

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
// World + materials
// =============================================================================
const atlas = buildAtlas();
const SEED = (Math.random() * 0xffffffff) >>> 0;
const world = new World(SEED, atlas);

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
// Chunk manager
// =============================================================================
const RENDER_DIST = 5;
const chunkMeshes = new Map();   // key -> {group, opaque, cutout, water}
const genQueue = [];
const meshQueue = new Set();

function chunkKey(cx, cz) { return cx + "," + cz; }

function queueAround(pcx, pcz) {
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (dx * dx + dz * dz > (RENDER_DIST + 0.5) ** 2) continue;
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
    mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
    group.add(mesh);
    entry[key] = mesh;
  };
  mk(geo.opaque, matOpaque, "opaque");
  mk(geo.cutout, matCutout, "cutout");
  mk(geo.water, matWater, "water");
  scene.add(group);
  chunkMeshes.set(k, entry);
}

function updateChunks(dt) {
  const pcx = Math.floor(player.pos.x / CHUNK);
  const pcz = Math.floor(player.pos.z / CHUNK);

  // generate a few chunks per frame
  let budget = 3;
  while (budget-- > 0 && genQueue.length) {
    const { cx, cz } = genQueue.shift();
    world.generateChunk(cx, cz);
    // villages/trees can write into chunks up to ~2 away — remesh that area
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const k = chunkKey(cx + dx, cz + dz);
        if (world.decorated.has(k)) meshQueue.add(k);
      }
  }

  // mesh a few per frame
  let mbudget = 4;
  for (const k of meshQueue) {
    if (mbudget-- <= 0) break;
    const [cx, cz] = k.split(",").map(Number);
    buildChunkMesh(cx, cz);
    meshQueue.delete(k);
  }

  // unload distant chunks
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

// =============================================================================
// Player
// =============================================================================
const player = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: false,
  flying: false,
  health: 20, maxHealth: 20,
  inWater: false,
  hurtCooldown: 0,
};
const P_RAD = 0.3, P_HEIGHT = 1.8, EYE = 1.62;

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
            // fall damage
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
  const feetBlock = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y + 0.1), Math.floor(player.pos.z));
  player.inWater = feetBlock === B.WATER;

  // movement input
  const speed = (player.flying ? 9 : keys.has("shiftleft") ? 6.5 : 4.3);
  const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const wish = new THREE.Vector3();
  if (keys.has("keyw")) wish.add(fwd);
  if (keys.has("keys")) wish.sub(fwd);
  if (keys.has("keyd")) wish.add(right);
  if (keys.has("keya")) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

  player.vel.x = wish.x;
  player.vel.z = wish.z;

  if (player.flying) {
    player.vel.y = 0;
    if (keys.has("space")) player.vel.y = speed;
    if (keys.has("shiftleft")) player.vel.y = -speed;
  } else {
    const grav = player.inWater ? 9 : 28;
    player.vel.y -= grav * dt;
    if (player.inWater) {
      player.vel.y = Math.max(player.vel.y, -4);
      if (keys.has("space")) player.vel.y = 4;
    } else if (keys.has("space") && player.onGround) {
      player.vel.y = 9.2;
    }
  }

  player.onGround = false;
  player.pos.x += player.vel.x * dt; collideAxis("x");
  player.pos.z += player.vel.z * dt; collideAxis("z");
  player.pos.y += player.vel.y * dt; collideAxis("y");

  // void protection
  if (player.pos.y < -20) { player.pos.set(spawn.x, spawn.y, spawn.z); player.vel.set(0,0,0); }

  // camera
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");

  if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
}

// =============================================================================
// Spawn
// =============================================================================
const spawn = new THREE.Vector3(8, 50, 8);
function findSpawn() {
  world.generateChunk(0, 0);
  for (let y = HEIGHT - 1; y > 0; y--) {
    const id = world.getBlock(8, y, 8);
    if (id !== B.AIR && id !== B.WATER) { spawn.set(8.5, y + 1.2, 8.5); break; }
  }
  player.pos.copy(spawn);
}

// =============================================================================
// Raycasting (blocks)
// =============================================================================
function raycastBlock() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone();
  let prev = null;
  const step = 0.05;
  for (let t = 0; t < 6; t += step) {
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
const HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.LEAVES, B.GLASS, B.SAND];
const ALL_BLOCKS = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.SAND, B.GRAVEL,
  B.LOG, B.LEAVES, B.PLANKS, B.GLASS];
let selected = 0;

const hotbarEl = document.getElementById("hotbar");
function tileNameFor(id) {
  const b = BLOCKS[id];
  return b.all || b.top || b.side;
}
function buildHotbar() {
  hotbarEl.innerHTML = "";
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement("div");
    slot.className = "slot" + (i === selected ? " active" : "");
    slot.appendChild(tileIcon(tileNameFor(id)));
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = BLOCKS[id].name;
    slot.appendChild(label);
    slot.onclick = () => { selected = i; buildHotbar(); updateHand(); };
    hotbarEl.appendChild(slot);
  });
}

const invGrid = document.getElementById("inv-grid");
const armorSlotEl = document.getElementById("armor-slot");
function buildInventory() {
  invGrid.innerHTML = "";
  for (const id of ALL_BLOCKS) {
    const cell = document.createElement("div");
    cell.className = "inv-item";
    cell.appendChild(tileIcon(tileNameFor(id), 40));
    cell.title = BLOCKS[id].name;
    cell.onclick = () => {
      HOTBAR[selected] = id;
      buildHotbar(); updateHand();
    };
    invGrid.appendChild(cell);
  }
  // wooden armor item
  armorSlotEl.innerHTML = "";
  if (armor.owned) {
    armorSlotEl.appendChild(woodenArmorIcon(56));
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;font-size:11px;color:#ffd;margin-top:60px";
  } else {
    armorSlotEl.textContent = "empty";
  }
  armorSlotEl.onclick = () => equipArmor();
}

const handEl = document.getElementById("hand");
function updateHand() {
  const id = HOTBAR[selected];
  handEl.style.backgroundImage = `url(${tileIcon(tileNameFor(id), 180).toDataURL()})`;
}

// =============================================================================
// Wooden Armor — "very bad": breaks after 10 hits, only 20% protection
// =============================================================================
const armor = {
  owned: true,         // player starts with one in their inventory
  equipped: false,
  durability: 10,
  maxDurability: 10,
};

function equipArmor() {
  if (!armor.owned) { toast("You have no Wooden Armor"); return; }
  armor.equipped = !armor.equipped;
  if (armor.equipped) {
    armor.durability = armor.maxDurability;
    toast("Wooden Armor equipped — it is flimsy (10 hits)");
  } else {
    toast("Wooden Armor removed");
  }
  updateHand();
  updateHUD();
}

// =============================================================================
// Damage
// =============================================================================
function hurtPlayer(amount) {
  if (player.hurtCooldown > 0 || amount <= 0) return;
  player.hurtCooldown = 0.5;

  if (armor.equipped) {
    amount *= 0.8;                       // wooden armor: weak 20% reduction
    armor.durability -= 1;               // every hit chips it
    if (armor.durability <= 0) {
      armor.equipped = false;
      armor.owned = false;
      toast("Your Wooden Armor broke!");
      updateHand();
      buildInventory();
    }
  }

  player.health = Math.max(0, player.health - amount);
  flashDamage();
  updateHUD();
  if (player.health <= 0) die();
}

let damageFlash = 0;
function flashDamage() { damageFlash = 0.4; }

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
  const hearts = 10;
  const full = Math.round(player.health / 2);
  for (let i = 0; i < hearts; i++) {
    const p = document.createElement("div");
    p.className = "pip " + (i < full ? "heart-full" : "heart-empty");
    healthbar.appendChild(p);
  }
  armorbar.innerHTML = "";
  if (armor.equipped) {
    // 10 armor pips = current durability remaining
    for (let i = 0; i < armor.maxDurability; i++) {
      const p = document.createElement("div");
      p.className = "pip " + (i < armor.durability ? "armor-full" : "armor-empty");
      armorbar.appendChild(p);
    }
  }
}

const toastEl = document.getElementById("toast");
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  toastTimer = 2.5;
}

// =============================================================================
// Mobs
// =============================================================================
const mobs = [];

function boxMesh(w, h, d, color) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
}

function makeVillager() {
  const g = new THREE.Group();
  const body = boxMesh(0.5, 0.8, 0.3, 0x6d4f37); body.position.y = 0.7; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0xc99a6b); head.position.y = 1.32; g.add(head);
  const nose = boxMesh(0.12, 0.18, 0.14, 0xb07a4f); nose.position.set(0, 1.28, 0.25); g.add(nose);
  const armL = boxMesh(0.14, 0.7, 0.2, 0x5a4029); armL.position.set(-0.32, 0.75, 0); g.add(armL);
  const armR = boxMesh(0.14, 0.7, 0.2, 0x5a4029); armR.position.set(0.32, 0.75, 0); g.add(armR);
  return g;
}

function makeZombie() {
  const g = new THREE.Group();
  const body = boxMesh(0.5, 0.8, 0.28, 0x3a6b3a); body.position.y = 0.7; g.add(body);
  const head = boxMesh(0.45, 0.45, 0.45, 0x4f8f4f); head.position.y = 1.32; g.add(head);
  const armL = boxMesh(0.16, 0.7, 0.2, 0x4f8f4f); armL.position.set(-0.33, 1.0, 0.25); armL.rotation.x = -1.4; g.add(armL);
  const armR = boxMesh(0.16, 0.7, 0.2, 0x4f8f4f); armR.position.set(0.33, 1.0, 0.25); armR.rotation.x = -1.4; g.add(armR);
  const legL = boxMesh(0.18, 0.7, 0.2, 0x2c4f7a); legL.position.set(-0.13, 0.0, 0); g.add(legL);
  const legR = boxMesh(0.18, 0.7, 0.2, 0x2c4f7a); legR.position.set(0.13, 0.0, 0); g.add(legR);
  return g;
}

function groundHeightAt(x, z) {
  for (let y = HEIGHT - 1; y > 0; y--) {
    const id = world.getBlock(Math.floor(x), y, Math.floor(z));
    if (id !== B.AIR && id !== B.WATER && BLOCKS[id].solid) return y + 1;
  }
  return SEA;
}

function spawnMob(type, x, y, z) {
  const mesh = type === "zombie" ? makeZombie() : makeVillager();
  scene.add(mesh);
  const mob = {
    type, mesh,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    health: type === "zombie" ? 10 : 12,
    home: new THREE.Vector3(x, y, z),
    wander: new THREE.Vector3(x, y, z),
    attackCd: 0, wanderCd: 0, onGround: false,
  };
  mobs.push(mob);
  return mob;
}

function spawnVillagers() {
  const list = world.villagerSpawns || [];
  for (const s of list) {
    if (mobs.length > 80) break;
    if (mobs.some(m => m.type === "villager" && m.home.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 0.5))
      continue;
    if (player.pos.distanceTo(new THREE.Vector3(s.x, s.y, s.z)) < 90)
      spawnMob("villager", s.x, s.y, s.z);
  }
}

function updateMobs(dt) {
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    const toPlayer = player.pos.clone().sub(m.pos);
    const dist = toPlayer.length();

    // despawn far mobs
    if (dist > 110) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }

    let move = new THREE.Vector3();
    if (m.type === "zombie") {
      // burn in daylight
      if (isDay() && m.pos.y > SEA) { m.health -= dt * 4; }
      if (dist < 26) {
        move.copy(toPlayer).setY(0).normalize().multiplyScalar(2.6);
        if (dist < 1.4 && m.attackCd <= 0) {
          hurtPlayer(4);
          m.attackCd = 1.0;
          // knockback
          player.vel.addScaledVector(toPlayer.setY(0).normalize(), 4);
          player.vel.y += 3;
        }
      }
    } else {
      // villager wanders near home
      m.wanderCd -= dt;
      if (m.wanderCd <= 0) {
        m.wander.set(
          m.home.x + (Math.random() - 0.5) * 8,
          m.home.y,
          m.home.z + (Math.random() - 0.5) * 8
        );
        m.wanderCd = 3 + Math.random() * 4;
      }
      const toW = m.wander.clone().sub(m.pos).setY(0);
      if (toW.length() > 0.6) move.copy(toW).normalize().multiplyScalar(1.3);
    }
    if (m.attackCd > 0) m.attackCd -= dt;

    // physics
    m.vel.x = move.x; m.vel.z = move.z;
    m.vel.y -= 24 * dt;
    m.pos.addScaledVector(m.vel, dt);
    const gh = groundHeightAt(m.pos.x, m.pos.z);
    if (m.pos.y <= gh) {
      // step up small obstacles
      m.pos.y = gh;
      if (m.vel.y < 0) m.vel.y = 0;
      m.onGround = true;
    } else m.onGround = false;

    if (m.health <= 0) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }

    m.mesh.position.copy(m.pos);
    if (move.lengthSq() > 0.01) m.mesh.rotation.y = Math.atan2(move.x, move.z);
  }
}

function spawnZombies() {
  if (isDay()) return;
  const zombies = mobs.filter(m => m.type === "zombie").length;
  if (zombies >= 14) return;
  if (Math.random() > 0.04) return;
  const ang = Math.random() * Math.PI * 2;
  const r = 16 + Math.random() * 18;
  const x = player.pos.x + Math.cos(ang) * r;
  const z = player.pos.z + Math.sin(ang) * r;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  if (!world.decorated.has(chunkKey(cx, cz))) return;
  const y = groundHeightAt(x, z);
  if (y > SEA) spawnMob("zombie", x, y, z);
}

// player attacks the nearest mob along the view ray
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
    const closest = origin.clone().addScaledVector(dir, t);
    if (closest.distanceTo(center) < 0.7) { best = m; bestT = t; }
  }
  if (best) {
    best.health -= 5;
    const kb = best.pos.clone().sub(player.pos).setY(0).normalize();
    best.vel.addScaledVector(kb, 5);
    best.vel.y = 4;
    return true;
  }
  return false;
}

// =============================================================================
// Day / night cycle
// =============================================================================
const DAY_LENGTH = 180;          // seconds for a full cycle
let timeOfDay = 0.25;            // 0..1, start in morning
function isDay() { return timeOfDay > 0.0 && timeOfDay < 0.5; }

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  const ang = timeOfDay * Math.PI * 2;
  sun.position.set(Math.cos(ang) * 100, Math.sin(ang) * 100, 40);

  // brightness: 1 at noon, ~0.08 at midnight
  const brightness = Math.max(0.08, Math.sin(ang));
  sun.intensity = brightness;
  ambient.intensity = 0.2 + brightness * 0.35;
  hemi.intensity = 0.3 + brightness * 0.6;

  const daySky = new THREE.Color(0x9ec6ff);
  const nightSky = new THREE.Color(0x0a1330);
  const sky = nightSky.clone().lerp(daySky, brightness);
  scene.background = sky;
  fog.color.copy(sky);
}

// =============================================================================
// Input
// =============================================================================
const keys = new Set();
let mouseDownL = false;

window.addEventListener("keydown", (e) => {
  const code = e.code.toLowerCase();
  keys.add(code);
  if (code === "keye") { e.preventDefault(); toggleInventory(); }
  if (code === "keyf") player.flying = !player.flying;
  if (code === "keyr") equipArmor();
  if (code >= "digit1" && code <= "digit9") {
    selected = parseInt(code.slice(5)) - 1;
    buildHotbar(); updateHand();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code.toLowerCase()));

canvas.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) { mouseDownL = true; swingHand(); doBreak(); }
  if (e.button === 2) { swingHand(); doPlace(); }
});
canvas.addEventListener("mouseup", (e) => { if (e.button === 0) mouseDownL = false; });
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

window.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0024;
  player.pitch -= e.movementY * 0.0024;
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

function doBreak() {
  // attacking a mob takes priority if one is in range
  if (attackMob()) return;
  const r = raycastBlock();
  if (!r) return;
  const [x, y, z] = r.hit;
  if (world.getBlock(x, y, z) === B.BEDROCK) return;
  const affected = world.setBlock(x, y, z, B.AIR);
  remeshDirty(affected);
}

function doPlace() {
  const r = raycastBlock();
  if (!r || !r.prev) return;
  const [x, y, z] = r.prev;
  // don't place inside the player
  const pminX = player.pos.x - P_RAD, pmaxX = player.pos.x + P_RAD;
  const pminZ = player.pos.z - P_RAD, pmaxZ = player.pos.z + P_RAD;
  if (x + 1 > pminX && x < pmaxX && z + 1 > pminZ && z < pmaxZ &&
      y + 1 > player.pos.y && y < player.pos.y + P_HEIGHT) return;
  if (world.getBlock(x, y, z) !== B.AIR) return;
  const affected = world.setBlock(x, y, z, HOTBAR[selected]);
  remeshDirty(affected);
}

// =============================================================================
// Inventory toggle
// =============================================================================
let inventoryOpen = false;
function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  document.getElementById("inventory").classList.toggle("hidden", !inventoryOpen);
  if (inventoryOpen) document.exitPointerLock();
  else if (running) canvas.requestPointerLock();
}

// =============================================================================
// Block highlight box
// =============================================================================
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
highlight.visible = false;
scene.add(highlight);
function updateHighlight() {
  const r = raycastBlock();
  if (r) {
    highlight.visible = true;
    highlight.position.set(r.hit[0] + 0.5, r.hit[1] + 0.5, r.hit[2] + 0.5);
  } else highlight.visible = false;
}

// =============================================================================
// Menu / start
// =============================================================================
let running = false;
const menu = document.getElementById("menu");
document.getElementById("play").onclick = () => {
  menu.classList.add("hidden");
  running = true;
  canvas.requestPointerLock();
};
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas && running && !inventoryOpen
      && document.getElementById("death").classList.contains("hidden")) {
    menu.classList.remove("hidden");
  } else {
    menu.classList.add("hidden");
  }
});

// =============================================================================
// Game loop
// =============================================================================
const debugEl = document.getElementById("debug");
let last = performance.now();
let villagerTimer = 0;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (running && !inventoryOpen) {
    updatePlayer(dt);
    if (mouseDownL) { /* held break handled per-frame */ }
    updateMobs(dt);
    spawnZombies();
    villagerTimer -= dt;
    if (villagerTimer <= 0) { spawnVillagers(); villagerTimer = 2; }
  }

  updateChunks(dt);
  updateSky(dt);
  updateHighlight();

  // continuous breaking while holding LMB
  if (running && mouseDownL && breakCd <= 0) { doBreak(); breakCd = 0.22; }
  if (breakCd > 0) breakCd -= dt;

  // swing animation
  if (swingTimer > 0) { swingTimer -= dt; if (swingTimer <= 0) handEl2.classList.remove("swing"); }

  // toast fade
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toastEl.classList.remove("show"); }

  // health regen
  if (player.health > 0 && player.health < player.maxHealth) {
    regenTimer -= dt;
    if (regenTimer <= 0) { player.health = Math.min(player.maxHealth, player.health + 1); regenTimer = 3; updateHUD(); }
  }

  // damage vignette
  if (damageFlash > 0) { damageFlash -= dt; }
  renderer.toneMappingExposure = 1;

  const pcx = Math.floor(player.pos.x / CHUNK), pcz = Math.floor(player.pos.z / CHUNK);
  queueAround(pcx, pcz);

  debugEl.textContent =
    `DevCraft  (seed ${SEED})\n` +
    `xyz ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}\n` +
    `chunks ${chunkMeshes.size}  mobs ${mobs.length}\n` +
    `time ${(timeOfDay * 24).toFixed(1)}h  ${isDay() ? "day" : "night"}\n` +
    `fly ${player.flying ? "on" : "off"}  ` +
    `armor ${armor.equipped ? armor.durability + "/10" : "off"}`;

  renderer.render(scene, camera);
}

let breakCd = 0;
let regenTimer = 3;

// =============================================================================
// Boot
// =============================================================================
findSpawn();
queueAround(0, 0);
// pre-generate spawn area so the player doesn't fall through
for (let dx = -2; dx <= 2; dx++)
  for (let dz = -2; dz <= 2; dz++) world.generateChunk(dx, dz);
for (let dx = -2; dx <= 2; dx++)
  for (let dz = -2; dz <= 2; dz++) buildChunkMesh(dx, dz);

buildHotbar();
buildInventory();
updateHand();
updateHUD();
loop();
