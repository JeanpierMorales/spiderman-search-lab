"use strict";
// Spider-Man Search Lab · el mapa es un GRAFO de puntos de anclaje sobre el skyline.
// Nodo = azotea, cornisa o antena. Arista = telaraña posible, costo = distancia (×k dentro de una zona de bombas).

const WORLD_W = 1150;
const WORLD_H = 750;
const UNIT = 40; // píxeles por unidad de costo
const RISK_COST = 3;

// ---------- utilidades ----------
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round1 = (value) => Math.round(value * 10) / 10;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// ---------- generador de ciudad ----------
function buildCity(seed, options = {}) {
  const { reach = 175, links = 3, zones = 2, name = `Ciudad #${seed}` } = options;
  const random = seededRandom(seed);
  const buildings = [];
  for (let x = 12; x < WORLD_W - 60;) {
    const width = 48 + Math.floor(random() * 70);
    const height = 170 + Math.floor(random() * 380);
    buildings.push({ x, width, height, top: WORLD_H - height });
    x += width + 8 + Math.floor(random() * 16);
  }

  const nodes = [];
  buildings.forEach((building, index) => {
    const { x, width, top, height } = building;
    if (width > 80) {
      nodes.push({ x: x + 14, y: top - 4, building: index });
      nodes.push({ x: x + width - 14, y: top - 4, building: index });
    } else {
      nodes.push({ x: x + width / 2, y: top - 4, building: index });
    }
    if (random() < 0.8) nodes.push({ x: random() < 0.5 ? x + 4 : x + width - 4, y: top + 40 + random() * height * 0.5, building: index, facade: true });
    if (height > 300 && random() < 0.5) nodes.push({ x: x + width / 2, y: top + 90 + random() * height * 0.4, building: index, facade: true });
    if (height > 380 && random() < 0.6) nodes.push({ x: x + width / 2, y: top - 42, building: index, antenna: true });
  });

  const riskZones = Array.from({ length: zones }, () => ({
    x: 200 + random() * (WORLD_W - 400),
    y: 120 + random() * (WORLD_H - 420),
    radius: 80 + random() * 50,
  }));

  const adjacency = nodes.map(() => []);
  const connect = (a, b) => {
    if (a === b || adjacency[a].some((edge) => edge.to === b)) return;
    const midpoint = { x: (nodes[a].x + nodes[b].x) / 2, y: (nodes[a].y + nodes[b].y) / 2 };
    const risk = riskZones.some((zone) => distance(zone, midpoint) < zone.radius);
    const length = round1(distance(nodes[a], nodes[b]) / UNIT);
    adjacency[a].push({ to: b, length, risk });
    adjacency[b].push({ to: a, length, risk });
  };
  nodes.forEach((node, index) => {
    nodes.map((other, otherIndex) => ({ otherIndex, d: distance(node, other) }))
      .filter(({ otherIndex, d }) => otherIndex !== index && d < reach)
      .sort((a, b) => a.d - b.d)
      .slice(0, links)
      .forEach(({ otherIndex }) => connect(index, otherIndex));
  });
  // ponytail: si algo queda aislado, lo engancho al nodo alcanzable más cercano.
  const start = 0;
  for (;;) {
    const reachable = new Set([start]);
    const queue = [start];
    while (queue.length) adjacency[queue.shift()].forEach(({ to }) => { if (!reachable.has(to)) { reachable.add(to); queue.push(to); } });
    if (reachable.size === nodes.length) break;
    const orphan = nodes.findIndex((node, index) => !reachable.has(index));
    let best = start;
    reachable.forEach((index) => { if (distance(nodes[index], nodes[orphan]) < distance(nodes[best], nodes[orphan])) best = index; });
    connect(orphan, best);
  }
  adjacency.forEach((edges) => edges.sort((a, b) => a.to - b.to));

  const goal = nodes.reduce((best, node, index) => (node.x > nodes[best].x && !node.facade ? index : best), 0);
  return { name, seed, buildings, nodes, adjacency, riskZones, start, goal };
}

const SCENARIOS = [
  { ...buildCity(11, { reach: 190, links: 3, zones: 1, name: "Azoteas abiertas" }), kicker: "MISIÓN 01 · AZOTEAS ABIERTAS", description: "Skyline denso y telarañas cortas: una entrada clara para comparar cómo se expande cada frontera." },
  { ...buildCity(23, { reach: 150, links: 2, zones: 2, name: "Laberinto de antenas" }), kicker: "MISIÓN 02 · LABERINTO DE ANTENAS", description: "Pocas telarañas por anclaje: la frontera tiene que serpentear entre fachadas y antenas." },
  { ...buildCity(37, { reach: 200, links: 3, zones: 4, name: "Bombas calabaza" }), kicker: "MISIÓN 03 · BOMBAS CALABAZA", description: "El Duende sembró zonas de bombas. BFS cuenta saltos; A* también cuenta lo que cuesta cruzarlas." },
  { ...buildCity(59, { reach: 165, links: 2, zones: 2, name: "La trampa del Octopus" }), kicker: "MISIÓN 04 · LA TRAMPA DEL OCTOPUS", description: "MJ parece cerca en línea recta, pero las telarañas disponibles obligan a rodear." },
  { ...buildCity(71, { reach: 215, links: 4, zones: 3, name: "Corredores del multiverso" }), kicker: "MISIÓN 05 · CORREDORES DEL MULTIVERSO", description: "Muchas rutas compiten: aquí se nota quién explora de más." },
];

const ALGORITHMS = {
  dfs: {
    short: "DFS", structure: "PILA · LIFO", frontier: "PILA (LIFO)",
    explanation: "Expande el último anclaje generado. Encuentra una salida, pero no garantiza el menor costo.",
    pseudocode: ["pila ← [inicio]", "mientras pila no esté vacía:", "  n ← pila.pop()   // último", "  si n es MJ: devolver ruta", "  apilar anclajes vecinos no visitados"],
  },
  bfs: {
    short: "BFS", structure: "COLA · FIFO", frontier: "COLA (FIFO)",
    explanation: "Expande el anclaje más superficial. Minimiza saltos, no distancia recorrida.",
    pseudocode: ["cola ← [inicio]", "mientras cola no esté vacía:", "  n ← cola.shift() // primero", "  si n es MJ: devolver ruta", "  encolar anclajes vecinos no visitados"],
  },
  astar: {
    short: "A*", structure: "PRIORIDAD · menor f", frontier: "COLA DE PRIORIDAD",
    explanation: "Combina distancia recorrida g con distancia en línea recta h y expande el menor f = g + h.",
    pseudocode: ["abierta ← prioridad(inicio)", "mientras abierta no esté vacía:", "  n ← extraer menor f = g + h", "  si n es MJ: devolver ruta", "  relajar vecinos y prioridades"],
  },
  manual: {
    short: "MANUAL", structure: "DECISIÓN HUMANA", frontier: "HISTORIAL DE SALTOS",
    explanation: "Tú eliges cada salto: flechas, WASD o clic sobre un anclaje vecino. Cada telaraña cuesta su distancia.",
    pseudocode: ["leer flecha, WASD o clic", "elegir el anclaje vecino en esa dirección", "si hay telaraña: saltar", "sumar la distancia (×k en zona de bombas)", "si llega hasta MJ: rescate"],
  },
};

const state = {
  scenarioIndex: 0,
  algorithm: "astar",
  explored: new Set(),
  exploredNodes: new Map(),
  lastParents: new Map(),
  active: null,
  path: [],
  agent: null,
  runToken: 0,
  running: false,
  manualActive: false,
  manualCost: 0,
  manualSteps: 0,
  manualStartedAt: 0,
  manualElapsed: 0,
  fog: false,
  showGraph: false,
  showF: false,
  sound: false,
  rubbleOn: true,
  rubbleCost: RISK_COST,
};

const canvas = document.querySelector("#city-canvas");
const context = canvas.getContext("2d");
const scenarioSelect = document.querySelector("#scenario-select");
const runButton = document.querySelector("#run-button");
const resetButton = document.querySelector("#reset-button");
const frontierList = document.querySelector("#frontier-list");
const currentScenario = () => SCENARIOS[state.scenarioIndex];
const edgeCost = (edge) => round1(edge.length * (edge.risk && state.rubbleOn ? state.rubbleCost : 1));
const heuristic = (scenario, id, goal) => round1(distance(scenario.nodes[id], scenario.nodes[goal]) / UNIT);

let audioContext = null;
function beep(frequency, duration = 0.05) {
  if (!state.sound) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.04;
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

// ---------- búsqueda ----------
function reconstructPath(parents, goal) {
  const path = [];
  for (let node = goal; node !== null && node !== undefined; node = parents.get(node)) path.unshift(node);
  return path;
}

function snapshotFrontier(frontier, algorithm) {
  const ordered = [...frontier];
  if (algorithm === "dfs") ordered.reverse();
  if (algorithm === "astar") ordered.sort((a, b) => a.f - b.f || a.h - b.h || a.order - b.order);
  return ordered.slice(0, 14);
}

function search(algorithm, scenario, capture = true) {
  const startedAt = performance.now();
  const { start, goal, adjacency } = scenario;
  const parents = new Map([[start, null]]);
  const discovered = new Set([start]);
  const closed = new Set();
  const bestG = new Map([[start, 0]]);
  let order = 0;
  const h0 = heuristic(scenario, start, goal);
  let frontier = [{ id: start, g: 0, h: h0, f: h0, order }];
  const expanded = [];
  const snapshots = [];
  let generated = 1;
  let maxFrontier = 1;
  const finish = (found, node) => ({
    found,
    path: found ? reconstructPath(parents, goal) : [],
    cost: found ? node.g : Infinity,
    steps: found ? reconstructPath(parents, goal).length - 1 : 0,
    expanded, snapshots, parents, generated, maxFrontier,
    elapsed: performance.now() - startedAt,
  });

  while (frontier.length > 0) {
    let node;
    if (algorithm === "dfs") node = frontier.pop();
    else if (algorithm === "bfs") node = frontier.shift();
    else {
      frontier.sort((a, b) => a.f - b.f || a.h - b.h || a.order - b.order);
      node = frontier.shift();
    }
    if (closed.has(node.id)) continue;
    closed.add(node.id);
    expanded.push(node);
    if (node.id === goal) {
      if (capture) snapshots.push(snapshotFrontier(frontier, algorithm));
      return finish(true, node);
    }

    const edges = algorithm === "dfs" ? [...adjacency[node.id]].reverse() : adjacency[node.id];
    for (const edge of edges) {
      const nextG = round1(node.g + edgeCost(edge));
      const h = heuristic(scenario, edge.to, goal);
      order += 1;
      if (algorithm === "astar") {
        if (nextG >= (bestG.get(edge.to) ?? Infinity)) continue;
      } else if (discovered.has(edge.to)) continue;
      discovered.add(edge.to);
      bestG.set(edge.to, nextG);
      parents.set(edge.to, node.id);
      frontier.push({ id: edge.to, g: nextG, h, f: round1(nextG + h), order });
      generated += 1;
    }
    maxFrontier = Math.max(maxFrontier, frontier.length);
    if (capture) snapshots.push(snapshotFrontier(frontier, algorithm));
  }
  return finish(false, null);
}

// ---------- dibujo ----------
function drawSpider(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(238, 48, 71, 0.25)";
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ee3047";
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f7f4e8";
  ctx.beginPath();
  ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-4, -9, -2, 6); ctx.quadraticCurveTo(-7, 2, -9, -6);
  ctx.moveTo(9, -6); ctx.quadraticCurveTo(4, -9, 2, 6); ctx.quadraticCurveTo(7, 2, 9, -6);
  ctx.fill();
  ctx.restore();
}

function drawMJ(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#ffd43d"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
  ctx.fillStyle = "#e3263a";
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("MJ", 0, 1);
  ctx.font = "20px sans-serif"; ctx.fillText("👺", 0, -34);
  ctx.restore();
}

// Dibuja la ciudad completa. `options` controla lo que se superpone (explorados, ruta, agente...).
function drawCity(ctx, scenario, options = {}) {
  const {
    explored = new Set(), exploredNodes = new Map(), parents = null, active = null, path = [],
    agent = scenario.start, goal = scenario.goal, fog = false, showF = false, showF_astar = true,
    color = "#65daf4", detail = true,
  } = options;
  const { nodes, adjacency, buildings, riskZones } = scenario;
  const visible = (id) => !fog || explored.has(id) || id === agent || id === goal || path.includes(id);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, "#050813"); sky.addColorStop(1, "#141f45");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = "rgba(247, 244, 232, 0.85)";
  ctx.beginPath(); ctx.arc(WORLD_W - 140, 90, 34, 0, Math.PI * 2); ctx.fill();

  buildings.forEach((building, index) => {
    ctx.fillStyle = index % 2 ? "#0b1330" : "#0e1738";
    ctx.fillRect(building.x, building.top, building.width, building.height);
    if (!detail) return;
    ctx.fillStyle = "rgba(255, 212, 61, 0.28)";
    for (let wy = building.top + 14; wy < WORLD_H - 10; wy += 22) {
      for (let wx = building.x + 8; wx < building.x + building.width - 8; wx += 16) {
        if ((wx * 7 + wy * 13 + scenario.seed) % 5 < 2) ctx.fillRect(wx, wy, 6, 9);
      }
    }
  });

  if (state.rubbleOn) {
    riskZones.forEach((zone) => {
      const glow = ctx.createRadialGradient(zone.x, zone.y, 10, zone.x, zone.y, zone.radius);
      glow.addColorStop(0, "rgba(240, 146, 56, 0.45)"); glow.addColorStop(1, "rgba(240, 146, 56, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2); ctx.fill();
      if (detail) { ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🎃", zone.x, zone.y); }
    });
  }

  ctx.lineCap = "round";
  adjacency.forEach((edges, from) => edges.forEach((edge) => {
    if (edge.to < from || !(visible(from) && visible(edge.to))) return;
    const risky = edge.risk && state.rubbleOn;
    ctx.strokeStyle = risky ? "rgba(240, 146, 56, 0.6)" : "rgba(169, 183, 216, 0.28)";
    ctx.lineWidth = risky ? 2 : 1.4;
    ctx.setLineDash(risky ? [6, 6] : []);
    ctx.beginPath(); ctx.moveTo(nodes[from].x, nodes[from].y); ctx.lineTo(nodes[edge.to].x, nodes[edge.to].y); ctx.stroke();
  }));
  ctx.setLineDash([]);

  if (parents) {
    ctx.strokeStyle = "rgba(255, 212, 61, 0.7)"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    explored.forEach((id) => {
      const parent = parents.get(id);
      if (parent === null || parent === undefined) return;
      ctx.moveTo(nodes[parent].x, nodes[parent].y); ctx.lineTo(nodes[id].x, nodes[id].y);
    });
    ctx.stroke();
  }

  if (path.length > 1) {
    ctx.strokeStyle = "rgba(99, 240, 180, 0.25)"; ctx.lineWidth = 14; ctx.lineJoin = "round";
    ctx.beginPath(); path.forEach((id, index) => ctx[index ? "lineTo" : "moveTo"](nodes[id].x, nodes[id].y)); ctx.stroke();
    ctx.strokeStyle = "#63f0b4"; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.stroke(); ctx.setLineDash([]);
  }

  nodes.forEach((node, id) => {
    if (!visible(id)) return;
    const isExplored = explored.has(id);
    ctx.fillStyle = isExplored ? color : "#1b294d";
    ctx.strokeStyle = isExplored ? color : "rgba(126, 153, 216, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(node.x, node.y, node.antenna ? 5 : 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (isExplored) {
      ctx.fillStyle = color.length === 7 ? `${color}44` : color;
      ctx.beginPath(); ctx.arc(node.x, node.y, 14, 0, Math.PI * 2); ctx.fill();
    }
    if (id === active) { ctx.strokeStyle = "#ffd43d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(node.x, node.y, 17, 0, Math.PI * 2); ctx.stroke(); }
    if (detail) {
      ctx.fillStyle = "rgba(247, 244, 232, 0.55)"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(`#${id}`, node.x, node.y - 12);
      const info = showF && exploredNodes.get(id);
      if (info) { ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.fillText(showF_astar ? `f=${info.f}` : `g=${info.g}`, node.x, node.y + 24); }
    }
  });

  drawMJ(ctx, nodes[goal].x, nodes[goal].y);
  drawSpider(ctx, nodes[agent].x, nodes[agent].y, detail ? 1 : 0.9);
}

function drawScene() {
  drawCity(context, currentScenario(), {
    explored: state.explored,
    exploredNodes: state.exploredNodes,
    parents: state.showGraph ? state.lastParents : null,
    active: state.active,
    path: state.path,
    agent: state.agent ?? currentScenario().start,
    fog: state.fog,
    showF: state.showF,
    showF_astar: state.algorithm === "astar",
  });
}

// ---------- UI ----------
function setCallout(title, message) {
  const callout = document.querySelector("#mission-callout");
  callout.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  callout.classList.remove("pop");
  void callout.offsetWidth;
  callout.classList.add("pop");
}

function updateMetrics(result = null) {
  const done = result && (result.found || result.manual);
  document.querySelector("#metric-algorithm").textContent = ALGORITHMS[state.algorithm].short;
  document.querySelector("#metric-nodes").textContent = result ? result.expanded.length : "0";
  document.querySelector("#metric-cost").textContent = done ? result.cost.toFixed(1) : "···";
  document.querySelector("#metric-steps").textContent = done ? result.steps : "···";
  document.querySelector("#metric-time").textContent = result ? `${result.elapsed.toFixed(2)} ms` : "0.00 ms";
  updateStats(result);
}

function updateStats(result = null, liveExpanded = null) {
  const set = (id, value) => { document.querySelector(`#stat-${id}`).textContent = value; };
  const done = liveExpanded === null && result && (result.found || result.manual);
  const expandedCount = liveExpanded ?? (result ? result.expanded.length : 0);
  set("expanded", expandedCount);
  set("generated", result ? result.generated ?? expandedCount : 0);
  set("frontier", result ? result.maxFrontier ?? "···" : 0);
  set("length", done ? result.steps : "···");
  set("cost", done ? result.cost.toFixed(1) : "···");
  set("efficiency", done && expandedCount ? `${Math.round((result.steps / expandedCount) * 100)}%` : "···");
  set("branching", done && result.steps ? Math.pow(result.generated ?? expandedCount, 1 / result.steps).toFixed(2) : "···");
  set("time", result ? `${result.elapsed.toFixed(1)} ms` : "0.0 ms");
  const verdict = document.querySelector("#stat-verdict");
  if (!done) verdict.textContent = liveExpanded ? "Lanzando telarañas…" : "Ejecuta un agente para ver el veredicto.";
  else if (result.manual) verdict.textContent = `🕷️ Rescate manual: ${result.steps} saltos con costo ${result.cost.toFixed(1)}.`;
  else {
    verdict.textContent = `${state.algorithm === "astar" ? "🥇 Camino óptimo garantizado." : state.algorithm === "bfs" ? "⚠️ BFS minimiza saltos, no distancia." : "⚠️ DFS no garantiza el óptimo."} De cada 100 anclajes abiertos, ${Math.round((result.steps / expandedCount) * 100)} acabaron en la ruta final.`;
  }
}

function highlightCodeLine(index) {
  document.querySelectorAll("#pseudocode li").forEach((li, i) => li.classList.toggle("active", i === index));
}

function renderFrontier(nodes = []) {
  if (!nodes.length) {
    frontierList.innerHTML = '<li class="empty-frontier">La estructura aparecerá al ejecutar.</li>';
    return;
  }
  frontierList.innerHTML = nodes.map((node) => {
    const values = state.algorithm === "astar" ? `g=${node.g} · h=${node.h} · f=${node.f}` : `costo=${node.g}`;
    return `<li><span>anclaje #${node.id}</span><span>${values}</span></li>`;
  }).join("");
}

function updateAlgorithmUI() {
  const algorithm = ALGORITHMS[state.algorithm];
  const isManual = state.algorithm === "manual";
  document.querySelectorAll("[data-algorithm]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.algorithm === state.algorithm);
    button.setAttribute("aria-pressed", button.dataset.algorithm === state.algorithm ? "true" : "false");
  });
  document.querySelector("#structure-chip").textContent = algorithm.structure;
  document.querySelector("#frontier-kind").textContent = algorithm.frontier;
  document.querySelector("#algorithm-explanation").textContent = algorithm.explanation;
  document.querySelector("#run-label").textContent = algorithm.short;
  document.querySelector("#pseudocode").innerHTML = algorithm.pseudocode.map((line) => `<li>${line}</li>`).join("");
  document.querySelector("#frontier-columns").textContent = state.algorithm === "astar" ? "g · h · f" : isManual ? "salto · costo" : "costo acumulado";
  document.querySelector(".speed-control").hidden = isManual;
  document.querySelector("#manual-controls").hidden = !isManual;
  updateMetrics();
}

function updateScenarioUI() {
  const scenario = currentScenario();
  document.querySelector("#scenario-kicker").textContent = scenario.kicker;
  document.querySelector("#scenario-description").textContent = scenario.description;
  document.querySelector("#scenario-count").textContent = `${state.scenarioIndex + 1} / ${SCENARIOS.length}`;
  scenarioSelect.value = String(state.scenarioIndex);
  resetMission(false);
}

function setControlsDisabled(disabled) {
  state.running = disabled;
  runButton.disabled = disabled;
  resetButton.disabled = disabled;
  scenarioSelect.disabled = disabled;
  document.querySelectorAll("[data-algorithm], #previous-scenario, #next-scenario").forEach((button) => { button.disabled = disabled; });
}

function resetMission(announce = true) {
  state.runToken += 1;
  state.explored.clear();
  state.exploredNodes.clear();
  state.lastParents = new Map();
  state.active = null;
  state.path = [];
  state.agent = currentScenario().start;
  state.manualActive = false;
  state.manualCost = 0;
  state.manualSteps = 0;
  state.manualStartedAt = 0;
  state.manualElapsed = 0;
  setControlsDisabled(false);
  renderFrontier();
  updateMetrics();
  document.querySelector("#timeline-progress").style.transform = "scaleX(0)";
  document.querySelector("#code-step-label").textContent = "EN ESPERA";
  document.querySelector("#frontier-kind").textContent = ALGORITHMS[state.algorithm].frontier;
  highlightCodeLine(-1);
  if (announce) setCallout("MISIÓN REINICIADA", "La ciudad vuelve a su estado inicial.");
  drawScene();
}

// ---------- modo manual ----------
function manualResult(found = false) {
  return { manual: true, found, expanded: [...state.explored], cost: state.manualCost, steps: state.manualSteps, elapsed: state.manualElapsed };
}

function renderManualHistory() {
  const recent = state.path.slice(-14);
  frontierList.innerHTML = recent.map((id, index) => (
    `<li><span>anclaje #${id}</span><span>${index === recent.length - 1 ? "AHORA · " : ""}salto ${state.manualSteps - recent.length + index + 1}</span></li>`
  )).reverse().join("");
}

function startManualMode() {
  resetMission(false);
  state.manualActive = true;
  state.manualStartedAt = performance.now();
  state.path = [currentScenario().start];
  state.explored.add(currentScenario().start);
  renderManualHistory();
  updateMetrics(manualResult(false));
  document.querySelector("#code-step-label").textContent = "TU DECIDES";
  document.querySelector("#timeline-progress").style.transform = "scaleX(0.04)";
  setCallout("TU TURNO, HÉROE", "Flechas, WASD o clic sobre un anclaje vecino para saltar hasta MJ.");
  drawScene();
}

function jumpTo(edge) {
  const scenario = currentScenario();
  state.agent = edge.to;
  state.path.push(edge.to);
  state.explored.add(edge.to);
  state.manualSteps += 1;
  state.manualCost = round1(state.manualCost + edgeCost(edge));
  state.manualElapsed = performance.now() - state.manualStartedAt;
  renderManualHistory();
  document.querySelector("#timeline-progress").style.transform = `scaleX(${Math.min(0.92, 0.04 + state.manualSteps / 40)})`;
  const reachedGoal = edge.to === scenario.goal;
  if (reachedGoal) {
    state.manualActive = false;
    document.querySelector("#timeline-progress").style.transform = "scaleX(1)";
    document.querySelector("#code-step-label").textContent = "RESCATE MANUAL";
    setCallout("¡LO CONSEGUISTE!", `Tu ruta costó ${state.manualCost.toFixed(1)} en ${state.manualSteps} saltos.`);
    beep(880, 0.25);
  }
  updateMetrics(manualResult(reachedGoal));
  drawScene();
}

function moveManual(dx, dy) {
  if (state.algorithm !== "manual" || !state.manualActive) {
    if (state.algorithm === "manual") setCallout("INICIA LA PARTIDA", "Pulsa Ejecutar Manual antes de moverte.");
    return;
  }
  const { nodes, adjacency } = currentScenario();
  const here = nodes[state.agent];
  // ponytail: el vecino cuya dirección se parezca más a la flecha (producto punto normalizado).
  let best = null;
  let bestScore = 0.3;
  adjacency[state.agent].forEach((edge) => {
    const target = nodes[edge.to];
    const length = distance(here, target);
    const score = ((target.x - here.x) * dx + (target.y - here.y) * dy) / length;
    if (score > bestScore) { bestScore = score; best = edge; }
  });
  if (!best) { setCallout("SIN TELARAÑA", "No hay anclaje en esa dirección. Prueba otra."); return; }
  jumpTo(best);
}

function clickManual(event) {
  if (state.algorithm !== "manual" || !state.manualActive) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD_W;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD_H;
  const { nodes, adjacency } = currentScenario();
  const edge = adjacency[state.agent].find((candidate) => distance(nodes[candidate.to], { x, y }) < 22);
  if (edge) jumpTo(edge);
  else setCallout("SIN TELARAÑA", "Solo puedes saltar a un anclaje conectado con el tuyo.");
}

// ---------- ejecución animada ----------
async function runSelectedAlgorithm() {
  if (state.running) return;
  if (state.algorithm === "manual") { startManualMode(); return; }
  const token = ++state.runToken;
  resetMission(false);
  state.runToken = token;
  setControlsDisabled(true);
  const scenario = currentScenario();
  const result = search(state.algorithm, scenario, true);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = Number(document.querySelector("#speed-range").value);
  const frameDelay = Math.max(40, 400 - speed * 3.6);
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  setCallout("BÚSQUEDA EN CURSO", `${ALGORITHMS[state.algorithm].frontier}: ${result.expanded.length} anclajes por inspeccionar.`);
  document.querySelector("#code-step-label").textContent = "EXPANDIENDO";

  // ponytail: avance por tiempo real; cada frame pinta TODOS los nodos pendientes, nunca salta ninguno.
  const total = result.expanded.length;
  state.lastParents = result.parents;
  const startedAt = performance.now();
  let painted = 0;
  while (painted < total) {
    if (token !== state.runToken) return;
    const target = reducedMotion ? total : Math.min(total, Math.floor((performance.now() - startedAt) / frameDelay) + 1);
    for (; painted < target; painted += 1) {
      const node = result.expanded[painted];
      state.explored.add(node.id);
      state.exploredNodes.set(node.id, node);
    }
    const node = result.expanded[painted - 1];
    state.active = node.id;
    state.agent = node.id;
    beep(300 + (painted / total) * 500, 0.03);
    renderFrontier(result.snapshots[Math.min(painted - 1, result.snapshots.length - 1)] ?? []);
    highlightCodeLine(painted % 2 ? 2 : 4);
    document.querySelector("#frontier-kind").textContent = `${ALGORITHMS[state.algorithm].frontier} · ${result.snapshots[painted - 1]?.length ?? 0}`;
    document.querySelector("#metric-nodes").textContent = String(painted);
    updateStats(result, painted);
    document.querySelector("#timeline-progress").style.transform = `scaleX(${(painted / total) * 0.72})`;
    drawScene();
    if (!reducedMotion) await nextFrame();
  }

  state.active = null;
  if (result.found) {
    document.querySelector("#code-step-label").textContent = "RUTA ENCONTRADA";
    highlightCodeLine(3);
    for (let index = 0; index < result.path.length; index += 1) {
      if (token !== state.runToken) return;
      state.path = result.path.slice(0, index + 1);
      state.agent = result.path[index];
      document.querySelector("#timeline-progress").style.transform = `scaleX(${0.72 + ((index + 1) / result.path.length) * 0.28})`;
      drawScene();
      if (!reducedMotion) await delay(Math.max(60, frameDelay));
    }
    beep(880, 0.25);
    setCallout("¡MJ RESCATADA!", `${ALGORITHMS[state.algorithm].short} venció al Duende con costo ${result.cost.toFixed(1)} en ${result.steps} saltos.`);
  } else {
    state.agent = scenario.start;
    setCallout("SIN RUTA", "La frontera quedó vacía. Cambia de misión o reinicia.");
  }
  updateMetrics(result);
  setControlsDisabled(false);
  drawScene();
}

function changeScenario(nextIndex) {
  state.scenarioIndex = (nextIndex + SCENARIOS.length) % SCENARIOS.length;
  updateScenarioUI();
}

function initialize() {
  scenarioSelect.innerHTML = SCENARIOS.map((scenario, index) => `<option value="${index}">${index + 1}. ${scenario.name}</option>`).join("");

  document.querySelectorAll("[data-algorithm]").forEach((button) => {
    button.addEventListener("click", () => {
      state.algorithm = button.dataset.algorithm;
      resetMission(false);
      updateAlgorithmUI();
      setCallout(`${ALGORITHMS[state.algorithm].short} SELECCIONADO`, ALGORITHMS[state.algorithm].explanation);
      drawScene();
    });
  });
  scenarioSelect.addEventListener("change", (event) => changeScenario(Number(event.target.value)));
  document.querySelector("#previous-scenario").addEventListener("click", () => changeScenario(state.scenarioIndex - 1));
  document.querySelector("#next-scenario").addEventListener("click", () => changeScenario(state.scenarioIndex + 1));
  runButton.addEventListener("click", runSelectedAlgorithm);
  resetButton.addEventListener("click", () => resetMission(true));
  canvas.addEventListener("click", clickManual);

  const movementByName = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveManual(...movementByName[button.dataset.move]));
  });
  window.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    };
    const movement = keyMap[event.key];
    if (!movement || state.algorithm !== "manual") return;
    event.preventDefault();
    moveManual(...movement);
  });

  document.querySelectorAll(".info-dot").forEach((button) => {
    button.addEventListener("click", () => setCallout("COMPARACIÓN JUSTA", button.dataset.tip));
  });

  const bindToggle = (id, key) => document.querySelector(id).addEventListener("change", (event) => {
    state[key] = event.target.checked;
    if (key === "sound" && state.sound) beep(660, 0.1);
    drawScene();
  });
  bindToggle("#opt-fog", "fog");
  bindToggle("#opt-graph", "showGraph");
  bindToggle("#opt-f", "showF");
  bindToggle("#opt-sound", "sound");

  const updateTerrain = () => {
    state.rubbleOn = document.querySelector("#terrain-select").value === "on";
    state.rubbleCost = Number(document.querySelector("#rubble-range").value);
    document.querySelector("#rubble-value").textContent = `×${state.rubbleCost}`;
    document.querySelector("#rubble-range").disabled = !state.rubbleOn;
    document.querySelector("#legend-rubble").textContent = state.rubbleOn ? `Zona de bombas · costo ×${state.rubbleCost}` : "Bombas desactivadas";
    document.querySelector("#terrain-note").textContent = state.rubbleOn
      ? `Cruzar una zona de bombas multiplica la distancia por ${state.rubbleCost}. BFS no lo ve; A* sí: compara «menos saltos» con «menos costo».`
      : "Sin bombas cada telaraña cuesta solo su distancia. BFS sigue sin ser óptimo: pocos saltos largos pueden costar más que muchos cortos.";
    resetMission(false);
  };
  document.querySelector("#terrain-select").addEventListener("change", updateTerrain);
  document.querySelector("#rubble-range").addEventListener("input", updateTerrain);
  updateTerrain();

  const navigationLinks = [...document.querySelectorAll(".chapter-nav a")];
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navigationLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-30% 0px -60%" });
  navigationLinks.forEach((link) => observer.observe(document.querySelector(link.getAttribute("href"))));

  updateScenarioUI();
  updateAlgorithmUI();
  drawScene();
}

initialize();
