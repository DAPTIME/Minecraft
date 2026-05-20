// Persistent game settings: graphics options + rebindable controls.
const DEFAULTS = {
  renderDist: 5,
  fov: 75,
  sensitivity: 1.0,
  fog: true,
  keys: {
    forward: "keyw", back: "keys", left: "keya", right: "keyd",
    jump: "space", sprint: "shiftleft", inventory: "keye", fly: "keyf",
  },
};

function load() {
  try {
    const s = JSON.parse(localStorage.getItem("devcraft_settings"));
    if (s) return { ...DEFAULTS, ...s, keys: { ...DEFAULTS.keys, ...(s.keys || {}) } };
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export const Settings = load();

export function saveSettings() {
  try { localStorage.setItem("devcraft_settings", JSON.stringify(Settings)); }
  catch (e) { /* ignore */ }
}

const KEY_ACTIONS = [
  ["forward", "Move forward"], ["back", "Move back"],
  ["left", "Strafe left"], ["right", "Strafe right"],
  ["jump", "Jump / swim up"], ["sprint", "Sprint / fly down"],
  ["inventory", "Open inventory"], ["fly", "Toggle fly"],
];

function keyLabel(code) {
  if (!code) return "—";
  if (code === "space") return "Space";
  if (code.startsWith("key")) return code.slice(3).toUpperCase();
  if (code.startsWith("digit")) return code.slice(5);
  if (code === "shiftleft") return "L-Shift";
  if (code === "shiftright") return "R-Shift";
  if (code === "controlleft") return "L-Ctrl";
  if (code === "altleft") return "L-Alt";
  if (code.startsWith("arrow")) return code.slice(5);
  return code.toUpperCase();
}

export function buildSettingsUI(apply) {
  const body = document.getElementById("settings-body");
  body.innerHTML = "";

  const gfx = document.createElement("div");
  gfx.className = "set-section";
  gfx.innerHTML = "<h3>Graphics</h3>";
  body.appendChild(gfx);

  function slider(label, key, min, max, step, fmt) {
    const row = document.createElement("div");
    row.className = "set-row";
    const l = document.createElement("span"); l.textContent = label;
    const val = document.createElement("span"); val.className = "set-val";
    const inp = document.createElement("input");
    inp.type = "range"; inp.min = min; inp.max = max; inp.step = step;
    inp.value = Settings[key];
    const upd = () => { val.textContent = fmt ? fmt(Settings[key]) : Settings[key]; };
    inp.oninput = () => { Settings[key] = parseFloat(inp.value); upd(); saveSettings(); apply(); };
    upd();
    row.append(l, inp, val);
    gfx.appendChild(row);
  }
  slider("Render distance", "renderDist", 2, 8, 1);
  slider("Field of view", "fov", 60, 110, 1);
  slider("Mouse sensitivity", "sensitivity", 0.2, 3, 0.1, v => v.toFixed(1));

  const frow = document.createElement("div");
  frow.className = "set-row";
  const fl = document.createElement("span"); fl.textContent = "Distance fog";
  const fc = document.createElement("input");
  fc.type = "checkbox"; fc.checked = Settings.fog;
  fc.onchange = () => { Settings.fog = fc.checked; saveSettings(); apply(); };
  frow.append(fl, fc);
  gfx.appendChild(frow);

  const ctl = document.createElement("div");
  ctl.className = "set-section";
  ctl.innerHTML = "<h3>Controls</h3>";
  body.appendChild(ctl);

  for (const [key, label] of KEY_ACTIONS) {
    const row = document.createElement("div");
    row.className = "set-row";
    const l = document.createElement("span"); l.textContent = label;
    const btn = document.createElement("button");
    btn.className = "key-btn";
    btn.textContent = keyLabel(Settings.keys[key]);
    btn.onclick = () => {
      btn.textContent = "press a key…";
      const handler = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.code.toLowerCase() !== "escape") Settings.keys[key] = e.code.toLowerCase();
        btn.textContent = keyLabel(Settings.keys[key]);
        saveSettings();
        apply();
      };
      window.addEventListener("keydown", handler, { capture: true, once: true });
    };
    row.append(l, btn);
    ctl.appendChild(row);
  }
}
