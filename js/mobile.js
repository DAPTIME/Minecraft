// mobile.js — touch controls for mobile/tablet

export const mobile = {
  active: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  lookDx: 0,
  lookDy: 0,
  breaking: false,
  triggerPlace: false,
  triggerInventory: false,
  triggerMenu: false,
  triggerChat: false,
  forward: false, back: false, left: false, right: false,
  jump: false,
  sprint: false,
  flying_down: false,
};

export function setFlyButtons(show) {
  const flyUp = document.getElementById('_mob_flyup');
  const flyDn = document.getElementById('_mob_flydn');
  if (flyUp) flyUp.style.display = show ? 'flex' : 'none';
  if (flyDn) flyDn.style.display = show ? 'flex' : 'none';
}

if (mobile.active) _init();

function _init() {
  const JOY_RADIUS = 52;
  const KNOB_LIMIT = JOY_RADIUS * 0.82;

  // ── styles ──────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #_mob_joy_outer {
      position: fixed; display: none; width: ${JOY_RADIUS * 2}px; height: ${JOY_RADIUS * 2}px;
      border-radius: 50%; background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.35);
      transform: translate(-50%,-50%); pointer-events: none; z-index: 6;
    }
    #_mob_joy_knob {
      position: absolute; width: ${JOY_RADIUS * 0.72}px; height: ${JOY_RADIUS * 0.72}px;
      border-radius: 50%; background: rgba(255,255,255,0.5);
      top: 50%; left: 50%; transform: translate(-50%,-50%);
    }
    ._mob_btn {
      position: fixed; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 22px; user-select: none;
      -webkit-user-select: none; cursor: pointer; z-index: 6;
      background: rgba(0,0,0,0.4); border: 2px solid rgba(255,255,255,0.35);
      color: #fff; touch-action: none;
    }
    #_mob_jump {
      width: 58px; height: 58px;
      bottom: 28px; right: 28px;
    }
    #_mob_place {
      width: 50px; height: 50px;
      bottom: 28px; right: 100px;
    }
    #_mob_break {
      width: 50px; height: 50px;
      bottom: 28px; right: 164px;
    }
    #_mob_flyup {
      width: 48px; height: 48px;
      bottom: 100px; right: 28px; display: none;
    }
    #_mob_flydn {
      width: 48px; height: 48px;
      bottom: 160px; right: 28px; display: none;
    }
    #_mob_inv {
      width: 48px; height: 48px; border-radius: 6px;
      top: 16px; right: 16px;
    }
    #_mob_menu {
      width: 48px; height: 48px; border-radius: 6px;
      top: 16px; left: 16px;
    }
    #_mob_chat {
      width: 48px; height: 48px; border-radius: 6px;
      top: 16px; left: 76px; font-size: 18px;
    }
    #_mob_sprint {
      position: fixed; width: 56px; height: 34px; border-radius: 8px;
      bottom: 28px; left: 20px;
      background: rgba(0,0,0,0.45); border: 2px solid rgba(255,255,255,0.35);
      color: #fff; font-size: 11px; font-weight: bold;
      display: flex; align-items: center; justify-content: center;
      user-select: none; -webkit-user-select: none;
      cursor: pointer; z-index: 6; touch-action: none;
    }
    #_mob_sprint.on { background: rgba(60,180,60,0.55); border-color: #7ac74f; }
  `;
  document.head.appendChild(style);

  // ── DOM ─────────────────────────────────────────────────────────────────
  const joyOuter = document.createElement('div'); joyOuter.id = '_mob_joy_outer';
  const joyKnob  = document.createElement('div'); joyKnob.id  = '_mob_joy_knob';
  joyOuter.appendChild(joyKnob);
  document.body.appendChild(joyOuter);

  function mkBtn(id, emoji, extraClass) {
    const b = document.createElement('div');
    b.id = id;
    b.className = '_mob_btn' + (extraClass ? ' ' + extraClass : '');
    b.textContent = emoji;
    document.body.appendChild(b);
    return b;
  }

  const btnJump  = mkBtn('_mob_jump',   '▲');
  const btnPlace = mkBtn('_mob_place',  '■');
  const btnBreak = mkBtn('_mob_break',  '⛏');
  const btnFlyUp = mkBtn('_mob_flyup',  '↑');
  const btnFlyDn = mkBtn('_mob_flydn',  '↓');
  const btnInv   = mkBtn('_mob_inv',    'E');
  const btnMenu  = mkBtn('_mob_menu',   '☰');
  const btnChat  = mkBtn('_mob_chat',   '💬');

  const btnSprint = document.createElement('div');
  btnSprint.id = '_mob_sprint';
  btnSprint.textContent = 'SPRINT';
  document.body.appendChild(btnSprint);

  // ── sprint toggle ────────────────────────────────────────────────────────
  let sprintToggle = false;
  btnSprint.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sprintToggle = !sprintToggle;
    btnSprint.classList.toggle('on', sprintToggle);
    mobile.sprint = sprintToggle;
  }, { passive: false });

  // ── jump ─────────────────────────────────────────────────────────────────
  btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.jump = true; },  { passive: false });
  btnJump.addEventListener('touchend',   (e) => { e.preventDefault(); mobile.jump = false; }, { passive: false });
  btnJump.addEventListener('touchcancel',(e) => { e.preventDefault(); mobile.jump = false; }, { passive: false });

  // ── place ─────────────────────────────────────────────────────────────────
  btnPlace.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.triggerPlace = true; }, { passive: false });

  // ── break ─────────────────────────────────────────────────────────────────
  btnBreak.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.breaking = true; },  { passive: false });
  btnBreak.addEventListener('touchend',   (e) => { e.preventDefault(); mobile.breaking = false; }, { passive: false });
  btnBreak.addEventListener('touchcancel',(e) => { e.preventDefault(); mobile.breaking = false; }, { passive: false });

  // ── fly up ────────────────────────────────────────────────────────────────
  btnFlyUp.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.jump = true; },  { passive: false });
  btnFlyUp.addEventListener('touchend',   (e) => { e.preventDefault(); mobile.jump = false; }, { passive: false });
  btnFlyUp.addEventListener('touchcancel',(e) => { e.preventDefault(); mobile.jump = false; }, { passive: false });

  // ── fly down ──────────────────────────────────────────────────────────────
  btnFlyDn.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.flying_down = true; },  { passive: false });
  btnFlyDn.addEventListener('touchend',   (e) => { e.preventDefault(); mobile.flying_down = false; }, { passive: false });
  btnFlyDn.addEventListener('touchcancel',(e) => { e.preventDefault(); mobile.flying_down = false; }, { passive: false });

  // ── inventory / pause menu / chat ────────────────────────────────────────
  btnInv.addEventListener('touchstart',  (e) => { e.preventDefault(); mobile.triggerInventory = true; }, { passive: false });
  btnMenu.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.triggerMenu = true; },      { passive: false });
  btnChat.addEventListener('touchstart', (e) => { e.preventDefault(); mobile.triggerChat = true; },      { passive: false });

  // ── joystick + look ────────────────────────────────────────────────────────
  const canvas = document.getElementById('canvas');

  let joyTouchId = null;
  let joyOriginX = 0, joyOriginY = 0;

  let lookTouchId = null;
  let lookLastX = 0, lookLastY = 0;
  let lookStartX = 0, lookStartY = 0;
  let lookMoved = 0;

  function updateJoy(tx, ty) {
    let dx = tx - joyOriginX;
    let dy = ty - joyOriginY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const norm = dist > 0 ? Math.min(dist, KNOB_LIMIT) / JOY_RADIUS : 0;
    const angle = Math.atan2(dy, dx);
    const cx = Math.cos(angle) * Math.min(dist, KNOB_LIMIT);
    const cy = Math.sin(angle) * Math.min(dist, KNOB_LIMIT);
    joyKnob.style.transform = `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;

    const THRESH = 0.35;
    mobile.forward = dy < 0 && Math.abs(dy) / JOY_RADIUS > THRESH;
    mobile.back    = dy > 0 && Math.abs(dy) / JOY_RADIUS > THRESH;
    mobile.left    = dx < 0 && Math.abs(dx) / JOY_RADIUS > THRESH;
    mobile.right   = dx > 0 && Math.abs(dx) / JOY_RADIUS > THRESH;

    // auto-sprint when pushing far enough (and sprint toggle not off)
    if (norm > 0.80 && sprintToggle !== false) {
      mobile.sprint = true;
    } else if (!sprintToggle) {
      mobile.sprint = false;
    }
  }

  function resetJoy() {
    joyTouchId = null;
    joyOuter.style.display = 'none';
    joyKnob.style.transform = 'translate(-50%, -50%)';
    mobile.forward = mobile.back = mobile.left = mobile.right = false;
    mobile.sprint = sprintToggle;
  }

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const lim = window.innerWidth * 0.42;
      if (t.clientX < lim && joyTouchId === null) {
        // joystick zone
        joyTouchId = t.identifier;
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;
        joyOuter.style.left = t.clientX + 'px';
        joyOuter.style.top  = t.clientY + 'px';
        joyOuter.style.display = 'block';
        updateJoy(t.clientX, t.clientY);
      } else if (t.clientX >= lim && lookTouchId === null) {
        // look zone
        lookTouchId = t.identifier;
        lookLastX = t.clientX;
        lookLastY = t.clientY;
        lookStartX = t.clientX;
        lookStartY = t.clientY;
        lookMoved = 0;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) {
        updateJoy(t.clientX, t.clientY);
      } else if (t.identifier === lookTouchId) {
        const dx = t.clientX - lookLastX;
        const dy = t.clientY - lookLastY;
        mobile.lookDx += dx * 1.4;
        mobile.lookDy += dy * 1.4;
        lookMoved += Math.abs(dx) + Math.abs(dy);
        lookLastX = t.clientX;
        lookLastY = t.clientY;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) {
        resetJoy();
      } else if (t.identifier === lookTouchId) {
        lookTouchId = null;
        // short tap = place
        if (lookMoved < 6) {
          mobile.triggerPlace = true;
        }
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) resetJoy();
      else if (t.identifier === lookTouchId) { lookTouchId = null; }
    }
  }, { passive: false });
}
