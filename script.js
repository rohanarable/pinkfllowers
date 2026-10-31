/* ============ EDIT ME: all messages and settings live here ============ */
const CONFIG = {
  name: "",
  opening: "I made something little for you... \u2661",
  growButton: "Grow Our Little Garden \u{1F331}",
  mainMessage: "",
  subMessage: "",
  moreButton: "A Little More Love",
  hiddenMessage: "Even on ordinary days, you make life feel a little more beautiful. If I could give you one thing, it would be the chance to see yourself through my eyes. \u2661",
  replayButton: "Replay the Magic",
  signature: "",
  petalColors: ["#f9dce3", "#f2b9cb", "#e997b3", "#d7779b", "#c65e87"],
  flowerDensity: 108,
  windStrength: 1,
  audio: true,
  maxPlants: 12,
  initialPlants: 3,
  duration: 10,
  features: {
    wind: true,
    water: true,
    pick: true,
    wishes: true,
    butterflies: true,
    dayNight: true,
    bouquet: true,
    savePicture: true,
    clearGarden: true,
    music: true,
    hiddenMessage: true
  }
};
/* ====================================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("garden");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    $("status").textContent = "This browser could not start the garden canvas.";
    return;
  }
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = CONFIG.petalColors.length ? CONFIG.petalColors : ["#f4c4d3", "#e997b3", "#cf6b91"];
  const palette = ["#607c64", "#779773", "#92a985", "#abc095"];
  const maxPlantCount = Math.max(1, CONFIG.maxPlants | 0);
  const maxParticles = window.innerWidth < 700 ? 90 : 145;
  const particlePool = Array.from({ length: maxParticles }, () => ({ active: false }));
  const plants = [];
  const bugs = [];
  const spriteCache = new Map();
  const randomBetween = (rng, min, max) => min + rng() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const hexToRgb = hex => {
    const value = Number.parseInt(hex.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  };
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, "0")).join("");
  const blend = (a, b, amount) => {
    const from = hexToRgb(a), to = hexToRgb(b);
    return rgbToHex(from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount);
  };
  const randomFromSeed = seed => {
    let state = seed >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  };

  let width = 0, height = 0, dpr = 1, started = false, night = false, nightBlend = 0;
  let elapsed = 0, lastFrame = 0, raf = 0, lastWater = 0, lastWindPetal = 0;
  let tool = "plant", windForce = 0, pointerDown = false, waterHeld = false;
  let pointer = { x: -1000, y: -1000, previousX: -1000, previousY: -1000, time: 0, active: false };
  let keyboardCursor = { x: 0, y: 0, focused: false };
  let queuedPlant = null;
  let ambientContext = null, ambientGain = null, ambientTimer = 0, ambientStep = 0;
  let musicWanted = false, musicPlaying = false;

  function dimensionsChanged() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    keyboardCursor.x = clamp(keyboardCursor.x || width / 2, 0, width);
    keyboardCursor.y = clamp(keyboardCursor.y || height * .78, 0, height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initBugs();
    if (started) {
      const previous = plants.slice();
      plants.length = 0;
      previous.forEach(old => plants.push(makePlant(old.xRatio, old.size, old.flowerCount, old.seed, old.startedAt, old.depth, old)));
    } else {
      drawScene(0);
    }
  }

  function partialCubic(p0, p1, p2, p3, t) {
    const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const a = lerp(p0, p1), b = lerp(p1, p2), c = lerp(p2, p3);
    const d = lerp(a, b), e = lerp(b, c), end = lerp(d, e);
    return { control1: a, control2: d, end };
  }

  function createSprite(type, color) {
    const key = type + ":" + color;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const sprite = document.createElement("canvas");
    sprite.width = 120; sprite.height = 120;
    const c = sprite.getContext("2d");
    const center = 60;
    const petal = (x, y, radius, angle, fill) => {
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      const gradient = c.createLinearGradient(0, -radius, 0, 2);
      gradient.addColorStop(0, blend(fill, "#ffffff", .34));
      gradient.addColorStop(.55, fill);
      gradient.addColorStop(1, blend(fill, "#9f466d", .17));
      c.fillStyle = gradient;
      c.shadowColor = "rgba(102,43,69,.22)";
      c.shadowBlur = 5;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-radius * .62, -radius * .48, -radius * .48, -radius * 1.16, 0, -radius * 1.22);
      c.bezierCurveTo(radius * .48, -radius * 1.16, radius * .62, -radius * .48, 0, 0);
      c.fill();
      c.restore();
    };
    c.translate(center, center);
    const ring = (count, radius, size, offset) => {
      for (let i = 0; i < count; i++) {
        petal(0, 0, size, (Math.PI * 2 * i / count) + offset, blend(color, "#ffffff", (i % 3) * .035));
      }
    };
    if (type === 0) ring(5, 32, 31, .15);
    if (type === 1) { ring(8, 26, 26, 0); ring(6, 17, 20, .34); }
    if (type === 2) {
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate(i * Math.PI * 2 / 3); c.translate(0, -16);
        c.scale(.55, .55); ring(5, 27, 26, .15);
        c.fillStyle = "#e8bd68"; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }
    const centerRadius = type === 1 ? 9 : 7;
    const gold = c.createRadialGradient(-2, -3, 1, 0, 0, centerRadius + 2);
    gold.addColorStop(0, "#fff1b4"); gold.addColorStop(.55, "#e8bd68"); gold.addColorStop(1, "#ba8242");
    c.fillStyle = gold; c.shadowColor = "rgba(255,230,159,.5)"; c.shadowBlur = 8;
    c.beginPath(); c.arc(0, 0, centerRadius, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      c.fillStyle = "rgba(255,247,207,.8)";
      c.beginPath(); c.arc(Math.cos(angle) * (centerRadius - 2), Math.sin(angle) * (centerRadius - 2), 1.1, 0, Math.PI * 2); c.fill();
    }
    spriteCache.set(key, sprite);
    return sprite;
  }

  function branchTree(x, y, size, seed, depthScale) {
    const rng = randomFromSeed(seed);
    const branches = [];
    const terminals = [];
    const stemHeight = Math.min(height * .58, (height * .52 + width * .05) * size);
    const maxDepth = 3 + (rng() > .45 ? 1 : 0);
    const grow = (sx, sy, angle, length, level, widthAtBase, delay, parentSide) => {
      const bend = randomBetween(rng, -.18, .18);
      const curveAngle = angle + bend;
      const ex = sx + Math.cos(curveAngle) * length;
      const ey = sy + Math.sin(curveAngle) * length;
      const cx1 = sx + Math.cos(angle) * length * .34;
      const cy1 = sy + Math.sin(angle) * length * .34;
      const cx2 = sx + Math.cos(curveAngle) * length * .76;
      const cy2 = sy + Math.sin(curveAngle) * length * .76;
      const branch = { x: sx, y: sy, cx1, cy1, cx2, cy2, ex, ey, length, level, lineWidth: widthAtBase, delay, duration: Math.max(.5, 1.45 - level * .17), leaves: [], side: parentSide };
      branches.push(branch);
      for (let i = 0; i < 2; i++) {
        const t = randomBetween(rng, .22, .83);
        const point = cubicPoint(branch, t);
        const side = i === 0 ? -1 : 1;
        branch.leaves.push({ x: point.x, y: point.y, angle: curveAngle + side * randomBetween(rng, .75, 1.45), size: randomBetween(rng, 5, 9), color: palette[(rng() * palette.length) | 0], delay: delay + t * branch.duration });
      }
      if (level >= maxDepth) {
        terminals.push(branch);
        return;
      }
      let childCount = level === 0 ? 3 : (rng() > .63 ? 3 : 2);
      for (let i = 0; i < childCount; i++) {
        const side = i - (childCount - 1) / 2;
        const childAngle = curveAngle + side * randomBetween(rng, .35, .62) + randomBetween(rng, -.2, .2);
        const childLength = length * randomBetween(rng, .61, .78);
        grow(ex, ey, childAngle, childLength, level + 1, Math.max(1, widthAtBase * .69), delay + randomBetween(rng, .43, .82), Math.sign(side) || 1);
      }
      if (level >= maxDepth - 1) terminals.push(branch);
    };
    const trunkLength = stemHeight * randomBetween(rng, .24, .31);
    grow(x, y, -Math.PI / 2 + randomBetween(rng, -.06, .06), trunkLength, 0, Math.max(3, size * 7), 0, 0);
    const candidates = branches.filter(branch => branch.level > 0);
    return { branches, candidates, terminals, rng, stemHeight, x, y, seed, depthScale };
  }

  function cubicPoint(branch, t) {
    const inv = 1 - t;
    return {
      x: inv ** 3 * branch.x + 3 * inv ** 2 * t * branch.cx1 + 3 * inv * t ** 2 * branch.cx2 + t ** 3 * branch.ex,
      y: inv ** 3 * branch.y + 3 * inv ** 2 * t * branch.cy1 + 3 * inv * t ** 2 * branch.cy2 + t ** 3 * branch.ey
    };
  }

  function makePlant(xRatio, size, flowerCount, seed, startedAt, depth, oldPlant) {
    const ground = height * .84 + depth * height * .035;
    const x = width * xRatio;
    const tree = branchTree(x, ground, size, seed, depth);
    const plant = {
      xRatio, size, flowerCount, seed, startedAt, depth, branches: tree.branches,
      flowers: [], ground, growthBonus: 0, wateredUntil: 0, fadeAt: oldPlant ? oldPlant.fadeAt : null,
      opacity: oldPlant ? oldPlant.opacity : 1, isInitial: oldPlant ? oldPlant.isInitial : false
    };
    const rng = randomFromSeed(seed ^ 0x9E3779B9);
    const oldFlowers = oldPlant ? oldPlant.flowers : [];
    for (let i = 0; i < flowerCount; i++) {
      const branch = tree.candidates[(i * 7 + Math.floor(rng() * tree.candidates.length)) % tree.candidates.length];
      const t = randomBetween(rng, .58, .98);
      const p = cubicPoint(branch, t);
      const angle = Math.atan2(branch.ey - branch.y, branch.ex - branch.x);
      const side = rng() > .5 ? 1 : -1;
      const bloom = {
        x: p.x + Math.cos(angle + side * .7) * randomBetween(rng, 4, 13),
        y: p.y + Math.sin(angle + side * .7) * randomBetween(rng, 4, 13),
        radius: randomBetween(rng, 8, 17) * size,
        type: (rng() * 3) | 0,
        color: colors[(rng() * colors.length) | 0],
        rotation: randomBetween(rng, -Math.PI, Math.PI),
        openAt: startedAt + branch.delay + branch.duration * t + randomBetween(rng, .05, 1.5),
        health: oldFlowers[i] ? oldFlowers[i].health : 1,
        pickedAt: oldFlowers[i] ? oldFlowers[i].pickedAt : null,
        tilt: 0
      };
      plant.flowers.push(bloom);
    }
    return plant;
  }

  function addParticle(x, y, kind, color, strength) {
    let particle = particlePool.find(item => !item.active);
    if (!particle) return null;
    const rng = Math.random;
    const angle = randomBetween(rng, 0, Math.PI * 2);
    const speed = strength || randomBetween(rng, 20, 90);
    Object.assign(particle, {
      active: true, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (kind === "drop" ? 0 : 20),
      age: 0, life: kind === "drop" ? .85 : randomBetween(rng, 1.2, 2.8), kind, color: color || colors[(rng() * colors.length) | 0],
      rotation: randomBetween(rng, 0, Math.PI * 2), spin: randomBetween(rng, -4, 4), size: randomBetween(rng, 2.5, 7)
    });
    return particle;
  }

  function burst(x, y, kind, amount) {
    const count = reduceMotion ? Math.min(5, amount) : amount;
    for (let i = 0; i < count; i++) addParticle(x, y, kind, colors[i % colors.length], kind === "drop" ? randomBetween(Math.random, 20, 75) : undefined);
  }

  function plantFlower() {
    if (!started) startGarden();
    const candidates = plants.flatMap(plant => plant.flowers.map(flower => ({ plant, flower })))
      .filter(item => item.flower.health > .8);
    const gathered = [];
    if (candidates.length) {
      for (let i = 0; i < Math.min(4, candidates.length); i++) {
        const selected = candidates.splice((Math.random() * candidates.length) | 0, 1)[0];
        gathered.push(selected);
        pickFlower(selected.plant, selected.flower);
      }
    }
    const art = $("bouquetDialog").querySelector(".bouquet-art");
    art.querySelectorAll(".bouquet-flower").forEach(flower => flower.remove());
    const arrangement = [
      { x: 37, y: 14, tilt: -16 }, { x: 70, y: 2, tilt: 0 }, { x: 103, y: 18, tilt: 16 }
    ];
    arrangement.forEach((position, index) => {
      const flower = document.createElement("span");
      flower.className = "bouquet-flower";
      flower.setAttribute("aria-hidden", "true");
      flower.style.setProperty("--bloom-color", gathered[index]?.flower.color || colors[index % colors.length]);
      flower.style.left = position.x + "px";
      flower.style.top = position.y + "px";
      flower.style.transform = "rotate(" + position.tilt + "deg)";
      art.appendChild(flower);
    });
    try {
      $("bouquetDialog").showModal();
    } catch (error) {
      $("status").textContent = "Your bouquet is ready. Close this note to return to the garden.";
      $("bouquetDialog").setAttribute("open", "");
    }
  }

  function pickFlower(plant, flower) {
    if (flower.health < .95) return;
    flower.health = .08;
    flower.pickedAt = elapsed;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI * 2 / 6 + flower.rotation;
      const particle = addParticle(flower.x, flower.y, "petal", flower.color, randomBetween(Math.random, 30, 110));
      if (particle) { particle.vx += Math.cos(angle) * 35; particle.vy += Math.sin(angle) * 28; }
    }
    $("status").textContent = "A flower has given you its petals. It will bloom again soon.";
  }

  function setTool(nextTool) {
    if (!["plant", "wind", "water", "pick", "wish"].includes(nextTool)) return;
    tool = nextTool;
    document.querySelectorAll(".tool-button").forEach(button => {
      const selected = button.dataset.tool === tool;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      const label = button.getAttribute("aria-label").replace(", selected.", ".");
      button.setAttribute("aria-label", selected ? label.replace(".", ", selected.") : label);
    });
    const instructions = { plant: "Tap the earth to plant \u00B7 P plant", wind: "Drag to send a breeze \u00B7 W wind", water: "Hold or drag to water \u00B7 R water", pick: "Tap a flower to gather petals \u00B7 K pick", wish: "Tap anywhere to make a wish \u00B7 S wish" };
    $("hint").textContent = instructions[tool] + " \u00B7 B bouquet \u00B7 N night";
  }

  function addPlant(x, size, flowerCount, seed, isInitial) {
    if (plants.length >= maxPlantCount) {
      const oldest = plants.reduce((candidate, plant) => plant.startedAt < candidate.startedAt ? plant : candidate, plants[0]);
      if (oldest) {
        oldest.fadeAt = elapsed;
        queuedPlant = { x, size, flowerCount, seed, isInitial };
        $("status").textContent = "Making room for your new plant.";
        return;
      }
    }
    const plant = makePlant(x, size, flowerCount, seed, elapsed, randomBetween(Math.random, -1, 1));
    plant.isInitial = Boolean(isInitial);
    plants.push(plant);
    if (!isInitial) {
      $("status").textContent = "A new little plant is growing.";
      burst(width * x, height * .84, "spark", 6);
    }
  }

  function clearGarden() {
    plants.length = 0;
    particlePool.forEach(particle => { particle.active = false; });
    queuedPlant = null;
    windForce = 0;
    pointerDown = false;
    waterHeld = false;
    setTool("plant");
    $("status").textContent = "The garden is clear. Choose Plant and tap to begin again.";
  }

  function initialGarden() {
    plants.length = 0;
    elapsed = 0;
    const count = Math.min(maxPlantCount, Math.max(1, CONFIG.initialPlants | 0));
    const density = clamp(CONFIG.flowerDensity | 0, 60, 150);
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? .5 : .16 + i * (.68 / (count - 1));
      const size = i === 1 ? .82 : (i === 2 ? .72 : 1);
      const depth = i === 1 ? -.9 : (i === 2 ? -.55 : -.15);
      const share = Math.floor(density / count) + (i < density % count ? 1 : 0);
      addPlant(x, size, share, 8417 + i * 1297, true);
    }
  }

  function startGarden() {
    if (started) return;
    started = true;
    $("intro").classList.add("dismissed");
    $("note").hidden = true;
    initialGarden();
    lastFrame = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function resetGarden() {
    cancelAnimationFrame(raf);
    if (musicWanted) { musicWanted = false; setMusicButton(false); stopAmbient(); }
    plants.length = 0;
    particlePool.forEach(particle => { particle.active = false; });
    queuedPlant = null;
    started = false;
    elapsed = 0;
    night = false;
    nightBlend = 0;
    windForce = 0;
    pointerDown = false;
    waterHeld = false;
    pointer.active = false;
    pointer.x = -1000; pointer.y = -1000;
    lastWater = 0; lastWindPetal = 0;
    setTool("plant");
    $("dayNight").setAttribute("aria-pressed", "false");
    $("dayNight").setAttribute("aria-label", "Switch to moonlight");
    $("intro").classList.remove("dismissed");
    $("note").hidden = true;
    $("status").textContent = "Ready for another little garden.";
    drawScene(0);
  }

  function groundLine() { return height * .84; }
  function skyColors() {
    const amount = nightBlend;
    const top = blend("#49334f", "#171a36", amount);
    const middle = blend("#986585", "#433d66", amount);
    const low = blend("#f3b6bd", "#997397", amount);
    return { top, middle, low };
  }

  function drawBackground(time) {
    const sky = skyColors();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, sky.top);
    gradient.addColorStop(.48, sky.middle);
    gradient.addColorStop(1, sky.low);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    const sunX = width * .77, sunY = height * .25;
    const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, Math.max(width, height) * .37);
    glow.addColorStop(0, "rgba(255,222,192," + (.4 * (1 - nightBlend) + .22 * nightBlend) + ")");
    glow.addColorStop(1, "rgba(255,226,205,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    ctx.save();
    if (nightBlend > 0) {
      ctx.shadowColor = "rgba(236,232,255,.7)"; ctx.shadowBlur = 28;
      ctx.fillStyle = "#f4e8d8";
      ctx.globalAlpha = nightBlend;
      const moonRadius = Math.max(13, width * .019);
      ctx.beginPath();
      ctx.moveTo(sunX, sunY - moonRadius);
      ctx.arc(sunX, sunY, moonRadius, -Math.PI / 2, Math.PI / 2);
      ctx.quadraticCurveTo(sunX - moonRadius * .52, sunY, sunX, sunY - moonRadius);
      ctx.fill();
      ctx.globalAlpha = 1 - nightBlend;
      ctx.shadowColor = "rgba(255,240,205,.5)"; ctx.shadowBlur = 26;
      ctx.fillStyle = "rgba(255,236,203,.72)"; ctx.beginPath(); ctx.arc(sunX, sunY, Math.max(12, width * .018), 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = "rgba(255,240,205,.5)"; ctx.shadowBlur = 26;
      ctx.fillStyle = "rgba(255,236,203,.72)"; ctx.beginPath(); ctx.arc(sunX, sunY, Math.max(12, width * .018), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (nightBlend > .01) {
      const rng = randomFromSeed(98125);
      ctx.fillStyle = "rgba(255,245,221,.72)";
      for (let i = 0; i < 48; i++) {
        const x = rng() * width, y = rng() * height * .53;
        ctx.globalAlpha = nightBlend * (.25 + .55 * (Math.sin(time * .8 + i) * .5 + .5));
        ctx.beginPath(); ctx.arc(x, y, rng() * 1.35 + .35, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const ground = groundLine();
    const hill = ctx.createLinearGradient(0, ground - 25, 0, height);
    hill.addColorStop(0, blend("#718c70", "#344859", nightBlend));
    hill.addColorStop(.36, blend("#526e59", "#283e43", nightBlend));
    hill.addColorStop(1, blend("#354d3d", "#203537", nightBlend));
    ctx.fillStyle = hill;
    ctx.beginPath(); ctx.moveTo(0, ground + 10);
    ctx.bezierCurveTo(width * .22, ground - 38, width * .71, ground + 9, width, ground - 24);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = night ? "rgba(184,218,180,.12)" : "rgba(218,238,189,.28)";
    ctx.lineWidth = 1;
    for (let i = 0; i < Math.ceil(width / 15); i++) {
      const x = i * 15, y = ground + (Math.sin(i * 2.14) * 8) + 4;
      ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.quadraticCurveTo(x + 2, y + 3, x + Math.sin(i) * 4, y - 7); ctx.stroke();
    }
  }

  function drawLeaf(leaf, progress, wind, now) {
    const reveal = clamp((now - leaf.delay) / .55, 0, 1);
    if (reveal <= 0 || progress <= 0) return;
    const sway = Math.sin(now * 1.4 + leaf.x) * .05 + wind * .05;
    ctx.save(); ctx.translate(leaf.x + wind * (height - leaf.y) * .07, leaf.y); ctx.rotate(leaf.angle + sway);
    ctx.globalAlpha *= reveal;
    ctx.fillStyle = leaf.color;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-leaf.size, -leaf.size * .55, -leaf.size * .65, -leaf.size * 2.7, 0, -leaf.size * 2.4); ctx.bezierCurveTo(leaf.size * .65, -leaf.size * 2.7, leaf.size, -leaf.size * .55, 0, 0); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.24)"; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -leaf.size * 2.1); ctx.stroke();
    ctx.restore();
  }

  function drawPlant(plant, now, time) {
    const age = Math.max(0, now - plant.startedAt);
    const wet = plant.wateredUntil > now ? (plant.wateredUntil - now) / 3 : 0;
    const wind = windForce * CONFIG.windStrength + Math.sin(time * .7 + plant.xRatio * 4) * (reduceMotion ? .008 : .018);
    const fade = plant.fadeAt !== null ? clamp(1 - (now - plant.fadeAt) / 1.1, 0, 1) : 1;
    plant.opacity = fade;
    ctx.save(); ctx.globalAlpha *= fade * clamp(.84 + plant.depth * .09, .68, .95);
    for (const branch of plant.branches) {
      const localAge = age - branch.delay + plant.growthBonus;
      const progress = clamp(localAge / branch.duration, 0, 1);
      if (progress <= 0) continue;
      const bend = (height - branch.y) * wind * .11;
      const endBend = (height - branch.ey) * wind * .11;
      const p0 = { x: branch.x + bend, y: branch.y };
      const p1 = { x: branch.cx1 + bend * .72, y: branch.cy1 };
      const p2 = { x: branch.cx2 + endBend * .72, y: branch.cy2 };
      const p3 = { x: branch.ex + endBend, y: branch.ey };
      const partial = partialCubic(p0, p1, p2, p3, progress);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(partial.control1.x, partial.control1.y, partial.control2.x, partial.control2.y, partial.end.x, partial.end.y);
      ctx.strokeStyle = blend(blend("#6d8f69", "#6f947b", nightBlend), "#aac28b", Math.min(.35, branch.level * .07));
      ctx.lineWidth = Math.max(.8, branch.lineWidth * (1 - branch.level * .13));
      ctx.lineCap = "round";
      ctx.stroke();
      branch.leaves.forEach(leaf => drawLeaf(leaf, progress, wind, age));
    }
    for (const flower of plant.flowers) {
      const bloomAge = now - flower.openAt;
      const wetOpen = wet * .28;
      const bloom = clamp(bloomAge / (reduceMotion ? .5 : 1.8) + wetOpen, 0, 1);
      const recovery = flower.pickedAt !== null ? clamp((now - flower.pickedAt) / 3.5, .08, 1) : 1;
      flower.health = flower.pickedAt !== null ? recovery : flower.health;
      const open = bloom * flower.health;
      if (open <= 0) {
        const budProgress = clamp((now - (flower.openAt - 1.2)) / .6, 0, 1);
        if (budProgress > 0) drawBud(flower, budProgress, wind);
        continue;
      }
      const lean = pointer.active ? clamp((pointer.x - flower.x) / Math.max(width, 1), -.055, .055) : 0;
      const openness = Math.max(open, flower === hoveredFlower ? .8 : 0);
      const scale = flower.radius * (.32 + openness * .68) * (1 + wet * .055);
      const x = flower.x + wind * (height - flower.y) * .1;
      const y = flower.y + Math.sin(time * 1.1 + flower.x * .03) * (reduceMotion ? .4 : 1.3);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(flower.rotation + lean + wind * .09);
      ctx.globalAlpha *= clamp(openness * 1.35, .2, 1);
      if (nightBlend > 0) { ctx.shadowColor = flower.color; ctx.shadowBlur = 13 * nightBlend; }
      ctx.drawImage(createSprite(flower.type, flower.color), -scale, -scale, scale * 2, scale * 2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBud(flower, amount, wind) {
    const x = flower.x + wind * (height - flower.y) * .1;
    const size = flower.radius * (.42 + amount * .12);
    ctx.save(); ctx.translate(x, flower.y); ctx.rotate(flower.rotation + wind * .1); ctx.globalAlpha *= amount;
    const gradient = ctx.createLinearGradient(-size, -size, size, size);
    gradient.addColorStop(0, blend(flower.color, "#ffffff", .3)); gradient.addColorStop(1, blend(flower.color, "#9e4669", .2));
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, size * .45); ctx.bezierCurveTo(-size * 1.05, -size * .1, -size * .7, -size * 1.75, 0, -size * 1.8); ctx.bezierCurveTo(size * .7, -size * 1.75, size * 1.05, -size * .1, 0, size * .45); ctx.fill();
    ctx.restore();
  }

  let hoveredFlower = null;
  function findFlower(x, y, limit) {
    let closest = null, best = limit;
    for (const plant of plants) for (const flower of plant.flowers) {
      const distance = Math.hypot(flower.x - x, flower.y - y);
      if (distance < best) { best = distance; closest = { plant, flower }; }
    }
    return closest;
  }

  function drawParticles(dt) {
    for (const particle of particlePool) {
      if (!particle.active) continue;
      particle.age += dt;
      if (particle.age >= particle.life) { particle.active = false; continue; }
      particle.vy += (particle.kind === "drop" ? 100 : 32) * dt;
      particle.vx += windForce * 30 * dt;
      particle.x += particle.vx * dt; particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      const alpha = clamp(1 - particle.age / particle.life, 0, 1);
      ctx.save(); ctx.translate(particle.x, particle.y); ctx.rotate(particle.rotation); ctx.globalAlpha = alpha;
      if (particle.kind === "drop") {
        ctx.fillStyle = "rgba(210,235,244,.77)"; ctx.beginPath(); ctx.ellipse(0, 0, particle.size * .55, particle.size * 1.35, 0, 0, Math.PI * 2); ctx.fill();
      } else if (particle.kind === "heart") {
        ctx.fillStyle = particle.color; ctx.scale(particle.size / 7, particle.size / 7);
        ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-11, -2, -7, -9, 0, -3); ctx.bezierCurveTo(7, -9, 11, -2, 0, 5); ctx.fill();
      } else if (particle.kind === "spark") {
        ctx.fillStyle = "#fff2c6"; ctx.shadowColor = particle.color; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(0, -particle.size); ctx.lineTo(particle.size * .3, 0); ctx.lineTo(0, particle.size); ctx.lineTo(-particle.size * .3, 0); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath(); ctx.ellipse(0, -particle.size * .2, particle.size * .45, particle.size, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function initBugs() {
    bugs.length = 0;
    if (!CONFIG.features.butterflies) return;
    const count = width < 600 ? 4 : 7;
    for (let i = 0; i < count; i++) bugs.push({ x: Math.random() * width, y: height * (.17 + Math.random() * .48), phase: Math.random() * 8, speed: randomBetween(Math.random, 5, 16), color: ["#f9e5c6", "#f7c6d3", "#fff0b7"][i % 3], butterfly: i < (width < 600 ? 2 : 4) });
  }

  function drawBugs(time, dt) {
    for (const bug of bugs) {
      const dx = pointer.active ? pointer.x - bug.x : Math.sin(time * .3 + bug.phase) * 30;
      const dy = pointer.active ? pointer.y - bug.y : Math.cos(time * .4 + bug.phase) * 20;
      bug.x += (Math.sin(time * .8 + bug.phase) * bug.speed + dx * .012) * dt;
      bug.y += (Math.cos(time * .7 + bug.phase) * bug.speed + dy * .012) * dt;
      bug.x = (bug.x + width + 15) % (width + 15);
      bug.y = clamp(bug.y, height * .08, groundLine() - 20);
      ctx.save(); ctx.translate(bug.x, bug.y);
      if (bug.butterfly) {
        const flap = Math.sin(time * 13 + bug.phase) * .65;
        ctx.fillStyle = bug.color; ctx.globalAlpha = .76;
        ctx.beginPath(); ctx.ellipse(-3, 0, 3, 5, flap, 0, Math.PI * 2); ctx.ellipse(3, 0, 3, 5, -flap, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(83,61,71,.6)"; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
      } else {
        ctx.globalAlpha = .4 + .5 * (Math.sin(time * 4 + bug.phase) * .5 + .5);
        ctx.fillStyle = bug.color; ctx.shadowColor = bug.color; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawScene(now, dt) {
    if (!width || !height) return;
    const time = now;
    drawBackground(time);
    hoveredFlower = pointer.active ? findFlower(pointer.x, pointer.y, 60)?.flower || null : null;
    plants.sort((a, b) => a.depth - b.depth);
    plants.forEach(plant => drawPlant(plant, now, time));
    if (started) {
      drawBugs(time, dt);
      drawParticles(dt);
        if (keyboardCursor.focused) {
          ctx.strokeStyle = "rgba(255,245,224,.82)"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(keyboardCursor.x, keyboardCursor.y, 15, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
      if (waterHeld && now - lastWater > (reduceMotion ? .19 : .08)) {
        for (let i = 0; i < (reduceMotion ? 1 : 2); i++) {
          const drop = addParticle(pointer.x + randomBetween(Math.random, -28, 28), pointer.y - randomBetween(Math.random, 35, 100), "drop", "#d7eaf1", 25);
          if (drop) { drop.vx = randomBetween(Math.random, -8, 8); drop.vy = randomBetween(Math.random, 18, 38); }
        }
        lastWater = now;
        plants.forEach(plant => {
          if (Math.abs(plant.xRatio * width - pointer.x) < 155) {
            plant.wateredUntil = now + 2.4;
            plant.growthBonus += dt * .55;
          }
        });
      }
      if (Math.abs(windForce) > .38 && now - lastWindPetal > .24) {
        const pool = plants.flatMap(plant => plant.flowers.map(flower => ({ plant, flower }))).filter(item => item.flower.health > .6);
        if (pool.length) {
          const chosen = pool[(Math.random() * pool.length) | 0];
          addParticle(chosen.flower.x, chosen.flower.y, "petal", chosen.flower.color, Math.abs(windForce) * 90);
          lastWindPetal = now;
        }
      }
      const fadedIndex = plants.findIndex(plant => plant.fadeAt !== null && now - plant.fadeAt > 1.05);
      if (queuedPlant && fadedIndex >= 0) {
        const oldestIndex = fadedIndex;
        if (oldestIndex >= 0) plants.splice(oldestIndex, 1);
        const queued = queuedPlant; queuedPlant = null;
        addPlant(queued.x, queued.size, queued.flowerCount, queued.seed, queued.isInitial);
      } else if (!queuedPlant) {
        for (let i = plants.length - 1; i >= 0; i--) if (plants[i].fadeAt !== null && now - plants[i].fadeAt > 1.05) plants.splice(i, 1);
      }
    }
  }

  function frame(timestamp) {
    if (!started || document.hidden) { raf = 0; return; }
    const dt = Math.min(.05, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    elapsed += dt;
    windForce *= Math.pow(reduceMotion ? .82 : .95, dt * 60);
    nightBlend += ((night ? 1 : 0) - nightBlend) * Math.min(1, dt * .8);
    drawScene(elapsed, dt);
    if (elapsed >= CONFIG.duration && $("note").hidden) $("note").hidden = false;
    raf = requestAnimationFrame(frame);
  }

  function eventPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event) {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const point = eventPosition(event);
    pointer.active = true; pointer.x = point.x; pointer.y = point.y; pointerDown = true; pointer.time = performance.now();
    activateAt(point);
    pointer.previousX = point.x; pointer.previousY = point.y;
  }

  function activateAt(point) {
    if (!started) startGarden();
    if (tool === "plant" && point.y > height * .68) {
      const perPlant = Math.max(8, Math.round(clamp(CONFIG.flowerDensity, 60, 150) / maxPlantCount));
      addPlant(clamp(point.x / width, .05, .95), randomBetween(Math.random, .54, .9), perPlant, (Math.random() * 0xffffffff) >>> 0, false);
    } else if (tool === "wish") {
      burst(point.x, point.y, "heart", 15);
      burst(point.x, point.y, "spark", 11);
      $("status").textContent = "A little wish is on its way.";
    } else if (tool === "pick" && CONFIG.features.pick) {
      const found = findFlower(point.x, point.y, 58);
      if (found) pickFlower(found.plant, found.flower);
      else $("status").textContent = "Tap near a flower to pick its petals.";
    } else if (tool === "water" && CONFIG.features.water) {
      waterHeld = true; lastWater = 0;
    }
  }

  canvas.addEventListener("focus", () => {
    keyboardCursor.focused = true;
    pointer.active = true; pointer.x = keyboardCursor.x; pointer.y = keyboardCursor.y;
  });
  canvas.addEventListener("blur", () => { keyboardCursor.focused = false; });

  function onPointerMove(event) {
    const point = eventPosition(event);
    const now = performance.now();
    pointer.active = true; pointer.x = point.x; pointer.y = point.y;
    if (pointerDown && tool === "wind" && CONFIG.features.wind) {
      const speed = (point.x - pointer.previousX) / Math.max(.01, (now - pointer.time) / 16);
      windForce = clamp(windForce + speed * .018, -1.5, 1.5);
    }
    if (pointerDown && tool === "water") waterHeld = true;
    pointer.previousX = point.x; pointer.previousY = point.y; pointer.time = now;
  }

  function onPointerUp() {
    pointerDown = false;
    waterHeld = false;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", () => { if (!pointerDown) pointer.active = false; });

  document.querySelectorAll(".tool-button").forEach(button => {
    const requested = button.dataset.tool;
    if ((requested === "wind" && !CONFIG.features.wind) || (requested === "water" && !CONFIG.features.water) || (requested === "pick" && !CONFIG.features.pick) || (requested === "wish" && !CONFIG.features.wishes)) {
      button.hidden = true;
    }
    button.addEventListener("click", () => setTool(requested));
  });

  $("grow").addEventListener("click", startGarden);
  $("replay").addEventListener("click", resetGarden);
  $("clear").addEventListener("click", clearGarden);
  $("bouquet").addEventListener("click", plantFlower);
  $("save").addEventListener("click", () => {
    if (!started) startGarden();
    requestAnimationFrame(() => {
      drawScene(elapsed, 0);
      canvas.toBlob(blob => {
        if (!blob) {
          $("status").textContent = "The picture could not be saved. Please try again.";
          return;
        }
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = url; link.download = "little-pink-garden.png";
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        $("status").textContent = "Your garden picture has been saved.";
      }, "image/png");
    });
  });
  if (!CONFIG.features.clearGarden) $("clear").hidden = true;
  if (!CONFIG.features.bouquet) $("bouquet").hidden = true;
  if (!CONFIG.features.savePicture) $("save").hidden = true;

  const messageDialog = $("messageDialog");
  let messageTrigger = null;
  $("more").querySelector(".button-label").textContent = CONFIG.moreButton;
  $("replay").querySelector(".button-label").textContent = CONFIG.replayButton;
  $("hiddenMessage").textContent = CONFIG.hiddenMessage;
  if (!CONFIG.features.hiddenMessage) $("more").hidden = true;
  $("more").addEventListener("click", () => {
    messageTrigger = $("more");
    try { messageDialog.showModal(); }
    catch (error) { messageDialog.setAttribute("open", ""); }
  });
  document.querySelectorAll(".dialog-close").forEach(button => button.addEventListener("click", () => {
    const dialog = button.closest("dialog");
    if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
  }));
  messageDialog.addEventListener("close", () => {
    if (messageTrigger) {
      messageTrigger.focus();
      messageTrigger = null;
    }
  });
  [messageDialog, $("bouquetDialog")].forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));

  $("dayNight").addEventListener("click", () => {
    if (!CONFIG.features.dayNight) return;
    night = !night;
    $("dayNight").querySelector("path").setAttribute("d", night ? "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" : "M15.5 3.3a8.7 8.7 0 1 0 5.2 15.8A9 9 0 0 1 15.5 3.3Z");
    $("dayNight").setAttribute("aria-pressed", String(night));
    $("dayNight").setAttribute("aria-label", night ? "Switch to daylight" : "Switch to moonlight");
    $("status").textContent = night ? "The garden is now moonlit." : "The garden is in daylight.";
    if (!started) {
      nightBlend = night ? 1 : 0;
      drawScene(elapsed, 0);
    }
  });
  if (!CONFIG.features.dayNight) $("dayNight").hidden = true;

  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.matches("input,textarea,select"))) return;
    const key = event.key.toLowerCase();
    if (document.querySelector("dialog[open]") && key !== "escape") return;
    if (event.target === canvas) {
      if (key.startsWith("arrow")) {
        const step = event.shiftKey ? 70 : 35;
        const oldX = keyboardCursor.x;
        if (key === "arrowleft") keyboardCursor.x -= step;
        if (key === "arrowright") keyboardCursor.x += step;
        if (key === "arrowup") keyboardCursor.y -= step;
        if (key === "arrowdown") keyboardCursor.y += step;
        keyboardCursor.x = clamp(keyboardCursor.x, 0, width);
        keyboardCursor.y = clamp(keyboardCursor.y, 0, height);
        pointer.active = true; pointer.x = keyboardCursor.x; pointer.y = keyboardCursor.y;
        if (tool === "wind" && CONFIG.features.wind) windForce = clamp(windForce + (keyboardCursor.x - oldX) * .018, -1.5, 1.5);
        event.preventDefault();
        return;
      }
      if ((key === "enter" || key === " ") && !event.repeat) {
        activateAt(keyboardCursor);
        event.preventDefault();
        return;
      }
    }
    if (key === "escape") {
      document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
      return;
    }
    if (key === "p") { setTool("plant"); event.preventDefault(); }
    if (key === "w" && CONFIG.features.wind) { setTool("wind"); event.preventDefault(); }
    if (key === "r" && CONFIG.features.water) { setTool("water"); event.preventDefault(); }
    if (key === "k" && CONFIG.features.pick) { setTool("pick"); event.preventDefault(); }
    if (key === "s" && CONFIG.features.wishes) { setTool("wish"); event.preventDefault(); }
    if (key === "n" && CONFIG.features.dayNight) $("dayNight").click();
    if (key === "b" && CONFIG.features.bouquet) plantFlower();
    if (key === "c" && CONFIG.features.clearGarden) clearGarden();
  });
  document.addEventListener("keyup", event => {
    if (event.key === "Enter" || event.key === " ") waterHeld = false;
  });

  function setMusicButton(playing) {
    const button = $("music");
    musicPlaying = Boolean(playing);
    button.querySelector(".music-label").textContent = musicPlaying ? "Music: On" : "Music: Off";
    button.setAttribute("aria-pressed", String(musicPlaying));
    button.setAttribute("aria-label", musicPlaying ? "Music: On \u266A" : "Music: Off \u266A");
    button.title = musicPlaying ? "Music: On \u266A" : "Music: Off \u266A";
  }

  function ambientTone(frequency, start, duration, volume) {
    const oscillator = ambientContext.createOscillator();
    const gain = ambientContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + .55);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ambientGain);
    oscillator.start(start);
    oscillator.stop(start + duration + .1);
  }

  function ambientBeat() {
    const notes = [261.63, 293.66, 329.63, 392, 440, 523.25, 659.25];
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 4, 6, 4, 2, 3];
    const pads = [130.81, 110, 146.83, 98];
    const start = ambientContext.currentTime + .05;
    ambientTone(notes[pattern[ambientStep % pattern.length]], start, 3.2, .04);
    if (ambientStep % 4 === 0) ambientTone(pads[(ambientStep / 4 | 0) % pads.length], start, 5, .045);
    ambientStep++;
  }

  function stopAmbient() {
    window.clearInterval(ambientTimer);
    ambientTimer = 0;
    if (!ambientContext) return Promise.resolve();
    ambientGain.gain.setTargetAtTime(.0001, ambientContext.currentTime, .08);
    return new Promise(resolve => window.setTimeout(() => {
      ambientContext.suspend().then(resolve).catch(resolve);
    }, 220));
  }

  function startAmbient() {
    if (document.hidden) return;
    try {
      if (!ambientContext) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) throw new Error("Web Audio is unsupported");
        ambientContext = new AudioCtor();
        ambientGain = ambientContext.createGain();
        ambientGain.gain.value = .0001;
        ambientGain.connect(ambientContext.destination);
      }
      ambientContext.resume().then(() => {
        if (!musicWanted || document.hidden) return;
        ambientGain.gain.setTargetAtTime(.65, ambientContext.currentTime, .18);
        ambientBeat();
        window.clearInterval(ambientTimer);
        ambientTimer = window.setInterval(ambientBeat, 1250);
        setMusicButton(true);
        $("status").textContent = "Soft ambient melody is playing.";
      }).catch(() => {
        musicWanted = false;
        $("music").hidden = true;
      });
    } catch (error) {
      musicWanted = false;
      $("music").hidden = true;
      $("status").textContent = "The ambient melody is unavailable in this browser.";
    }
  }

  function toggleMusic() {
    if (!CONFIG.features.music || !CONFIG.audio) return;
    if (musicWanted) {
      musicWanted = false;
      setMusicButton(false);
      stopAmbient();
      $("status").textContent = "Soft ambient melody paused.";
      return;
    }
    musicWanted = true;
    startAmbient();
  }

  $("music").addEventListener("click", toggleMusic);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf); raf = 0;
      if (musicWanted) { stopAmbient(); setMusicButton(false); }
    } else {
      if (started && !raf) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); }
      if (musicWanted) startAmbient();
    }
  });
  window.addEventListener("resize", dimensionsChanged, { passive: true });
  window.addEventListener("orientationchange", dimensionsChanged, { passive: true });

  dimensionsChanged();
})();




