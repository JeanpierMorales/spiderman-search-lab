"use strict";

const GRID_WIDTH = 23;
const GRID_HEIGHT = 15;
const NORMAL_COST = 1;
const RUBBLE_COST = 4;
const NEIGHBORS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function createMap() {
  return Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(NORMAL_COST));
}

function addVerticalWall(map, x, y1, y2, gaps = []) {
  for (let y = y1; y <= y2; y += 1) {
    if (!gaps.includes(y)) map[y][x] = Infinity;
  }
}

function addHorizontalWall(map, y, x1, x2, gaps = []) {
  for (let x = x1; x <= x2; x += 1) {
    if (!gaps.includes(x)) map[y][x] = Infinity;
  }
}

function addRubble(map, cells) {
  cells.forEach(([x, y]) => {
    if (map[y]?.[x] !== undefined && Number.isFinite(map[y][x])) map[y][x] = RUBBLE_COST;
  });
}

function buildScenarios() {
  const open = createMap();
  addVerticalWall(open, 7, 2, 5, [4]);
  addHorizontalWall(open, 10, 4, 8, [6]);
  addVerticalWall(open, 15, 8, 12, [10]);
  addRubble(open, [[10, 6], [11, 6], [12, 6], [18, 8]]);

  const maze = createMap();
  addVerticalWall(maze, 5, 0, 12, [2]);
  addVerticalWall(maze, 10, 2, 14, [12]);
  addVerticalWall(maze, 15, 0, 12, [4]);
  addVerticalWall(maze, 19, 3, 14, [11]);
  addRubble(maze, [[3, 2], [8, 12], [13, 4], [17, 11], [18, 11]]);

  const weighted = createMap();
  addRubble(weighted, Array.from({ length: 17 }, (_, index) => [index + 3, 7]));
  addHorizontalWall(weighted, 4, 7, 16, [8, 15]);
  addHorizontalWall(weighted, 10, 5, 14, [6, 13]);

  const trap = createMap();
  addHorizontalWall(trap, 3, 16, 20);
  addVerticalWall(trap, 16, 3, 10);
  addVerticalWall(trap, 20, 3, 10);
  addHorizontalWall(trap, 10, 16, 20, [18]);
  addVerticalWall(trap, 8, 0, 9, [8]);
  addRubble(trap, [[11, 8], [12, 8], [13, 8], [18, 9]]);

  const corridors = createMap();
  addHorizontalWall(corridors, 3, 2, 20, [4, 12, 18]);
  addHorizontalWall(corridors, 7, 2, 20, [7, 15]);
  addHorizontalWall(corridors, 11, 2, 20, [4, 11, 19]);
  addVerticalWall(corridors, 9, 3, 11, [5, 9]);
  addVerticalWall(corridors, 17, 3, 11, [6, 10]);
  addRubble(corridors, [
    [4, 3], [12, 3], [18, 3], [7, 7], [15, 7], [4, 11], [11, 11], [19, 11],
  ]);

  return [
    {
      name: "Azoteas abiertas",
      kicker: "MISIÓN 01 · AZOTEAS ABIERTAS",
      description: "Una entrada clara para comparar el patrón de exploración sin demasiados bloqueos.",
      map: open,
      start: [1, 7],
      goal: [21, 7],
    },
    {
      name: "Laberinto de antenas",
      kicker: "MISIÓN 02 · LABERINTO DE ANTENAS",
      description: "Los callejones obligan a la frontera a serpentear por toda la ciudad.",
      map: maze,
      start: [1, 7],
      goal: [21, 7],
    },
    {
      name: "Ruta corta, costo alto",
      kicker: "MISIÓN 03 · ESCOMBROS EN LA RUTA",
      description: "BFS ve pocos pasos; A* también considera que cruzar escombros cuesta cuatro veces más.",
      map: weighted,
      start: [1, 7],
      goal: [21, 7],
    },
    {
      name: "La trampa del Octopus",
      kicker: "MISIÓN 04 · LA TRAMPA DEL OCTOPUS",
      description: "La baliza parece cercana, pero primero hay que alejarse de ella para entrar por la abertura.",
      map: trap,
      start: [2, 5],
      goal: [18, 6],
    },
    {
      name: "Corredores del multiverso",
      kicker: "MISIÓN 05 · CORREDORES DEL MULTIVERSO",
      description: "Varias rutas compiten entre sí con cuellos de botella y terreno ponderado.",
      map: corridors,
      start: [1, 1],
      goal: [21, 13],
    },
  ];
}

const SCENARIOS = buildScenarios();

const ALGORITHMS = {
  dfs: {
    short: "DFS",
    structure: "PILA · LIFO",
    frontier: "PILA (LIFO)",
    explanation: "Expande el último nodo generado. Encuentra una salida, pero no garantiza el menor costo.",
    pseudocode: [
      "pila ← [inicio]",
      "mientras pila no esté vacía:",
      "  n ← pila.pop()   // último",
      "  si n es meta: devolver ruta",
      "  apilar vecinos no visitados",
    ],
  },
  bfs: {
    short: "BFS",
    structure: "COLA · FIFO",
    frontier: "COLA (FIFO)",
    explanation: "Expande el nodo más superficial. Minimiza pasos solo cuando todos cuestan lo mismo.",
    pseudocode: [
      "cola ← [inicio]",
      "mientras cola no esté vacía:",
      "  n ← cola.shift() // primero",
      "  si n es meta: devolver ruta",
      "  encolar vecinos no visitados",
    ],
  },
  astar: {
    short: "A*",
    structure: "PRIORIDAD · menor f",
    frontier: "COLA DE PRIORIDAD",
    explanation: "Combina costo recorrido g con distancia estimada h y expande el menor f = g + h.",
    pseudocode: [
      "abierta ← prioridad(inicio)",
      "mientras abierta no esté vacía:",
      "  n ← extraer menor f = g + h",
      "  si n es meta: devolver ruta",
      "  relajar vecinos y prioridades",
    ],
  },
  manual: {
    short: "MANUAL",
    structure: "DECISIÓN HUMANA",
    frontier: "HISTORIAL DE MOVIMIENTOS",
    explanation: "Tú eliges cada movimiento. El costo sube al entrar en una azotea y los obstáculos bloquean el paso.",
    pseudocode: [
      "leer flecha, WASD o control táctil",
      "calcular la casilla siguiente",
      "si es transitable: mover agente",
      "sumar costo de la nueva casilla",
      "si llega a la baliza: rescate",
    ],
  },
};

const state = {
  scenarioIndex: 0,
  algorithm: "astar",
  explored: new Set(),
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
};

const canvas = document.querySelector("#city-canvas");
const context = canvas.getContext("2d");
const scenarioSelect = document.querySelector("#scenario-select");
const runButton = document.querySelector("#run-button");
const resetButton = document.querySelector("#reset-button");
const benchmarkButton = document.querySelector("#benchmark-button");
const frontierList = document.querySelector("#frontier-list");

const keyOf = (x, y) => `${x},${y}`;
const fromKey = (key) => key.split(",").map(Number);
const currentScenario = () => SCENARIOS[state.scenarioIndex];
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function heuristic(x, y, goal) {
  return Math.abs(x - goal[0]) + Math.abs(y - goal[1]);
}

function reconstructPath(parents, goalKey) {
  const path = [];
  let current = goalKey;
  while (current) {
    path.push(fromKey(current));
    current = parents.get(current);
  }
  return path.reverse();
}

function snapshotFrontier(frontier, algorithm, goal) {
  const ordered = [...frontier];
  if (algorithm === "dfs") ordered.reverse();
  if (algorithm === "astar") {
    ordered.sort((a, b) => a.f - b.f || a.h - b.h || a.order - b.order);
  }
  return ordered.slice(0, 14).map((node) => ({
    ...node,
    h: node.h ?? heuristic(node.x, node.y, goal),
    f: node.f ?? node.g + heuristic(node.x, node.y, goal),
  }));
}

function search(algorithm, scenario, capture = true) {
  const startedAt = performance.now();
  const [startX, startY] = scenario.start;
  const [goalX, goalY] = scenario.goal;
  const startKey = keyOf(startX, startY);
  const goalKey = keyOf(goalX, goalY);
  const parents = new Map([[startKey, null]]);
  const discovered = new Set([startKey]);
  const closed = new Set();
  const bestG = new Map([[startKey, 0]]);
  let insertionOrder = 0;
  let frontier = [{
    x: startX,
    y: startY,
    g: 0,
    h: heuristic(startX, startY, scenario.goal),
    f: heuristic(startX, startY, scenario.goal),
    order: insertionOrder,
  }];
  const expanded = [];
  const snapshots = [];

  while (frontier.length > 0) {
    let node;
    if (algorithm === "dfs") {
      node = frontier.pop();
    } else if (algorithm === "bfs") {
      node = frontier.shift();
    } else {
      frontier.sort((a, b) => a.f - b.f || a.h - b.h || a.order - b.order);
      node = frontier.shift();
      if (closed.has(keyOf(node.x, node.y))) continue;
    }

    const nodeKey = keyOf(node.x, node.y);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    expanded.push(node);

    if (nodeKey === goalKey) {
      if (capture) snapshots.push(snapshotFrontier(frontier, algorithm, scenario.goal));
      const path = reconstructPath(parents, goalKey);
      return {
        found: true,
        path,
        cost: node.g,
        steps: path.length - 1,
        expanded,
        snapshots,
        elapsed: performance.now() - startedAt,
      };
    }

    const directions = algorithm === "dfs" ? [...NEIGHBORS].reverse() : NEIGHBORS;
    for (const [dx, dy] of directions) {
      const x = node.x + dx;
      const y = node.y + dy;
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) continue;
      const stepCost = scenario.map[y][x];
      if (!Number.isFinite(stepCost)) continue;

      const neighborKey = keyOf(x, y);
      const nextG = node.g + stepCost;
      const h = heuristic(x, y, scenario.goal);
      insertionOrder += 1;

      if (algorithm === "astar") {
        if (nextG >= (bestG.get(neighborKey) ?? Infinity)) continue;
        bestG.set(neighborKey, nextG);
        parents.set(neighborKey, nodeKey);
        frontier.push({ x, y, g: nextG, h, f: nextG + h, order: insertionOrder });
      } else if (!discovered.has(neighborKey)) {
        discovered.add(neighborKey);
        bestG.set(neighborKey, nextG);
        parents.set(neighborKey, nodeKey);
        frontier.push({ x, y, g: nextG, h, f: nextG + h, order: insertionOrder });
      }
    }

    if (capture) snapshots.push(snapshotFrontier(frontier, algorithm, scenario.goal));
  }

  return {
    found: false,
    path: [],
    cost: Infinity,
    steps: 0,
    expanded,
    snapshots,
    elapsed: performance.now() - startedAt,
  };
}

function drawWeb(x, y, radius) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "rgba(169, 183, 216, 0.24)";
  context.lineWidth = 1.2;
  for (let ring = 1; ring <= 3; ring += 1) {
    context.beginPath();
    for (let arm = 0; arm < 8; arm += 1) {
      const angle = (Math.PI * 2 * arm) / 8;
      const rx = Math.cos(angle) * radius * (ring / 3);
      const ry = Math.sin(angle) * radius * (ring / 3);
      if (arm === 0) context.moveTo(rx, ry);
      else context.lineTo(rx, ry);
    }
    context.closePath();
    context.stroke();
  }
  for (let arm = 0; arm < 8; arm += 1) {
    const angle = (Math.PI * 2 * arm) / 8;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    context.stroke();
  }
  context.restore();
}

function cellCenter(x, y) {
  return [x * 50 + 25, y * 50 + 25];
}

function drawSpiderMarker(x, y, scale = 1) {
  const [cx, cy] = cellCenter(x, y);
  context.save();
  context.translate(cx, cy);
  context.scale(scale, scale);
  context.fillStyle = "rgba(238, 48, 71, 0.22)";
  context.beginPath();
  context.arc(0, 0, 23, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ee3047";
  context.beginPath();
  context.arc(0, 0, 15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f7f4e8";
  context.beginPath();
  context.moveTo(-10, -7);
  context.quadraticCurveTo(-4, -10, -2, 6);
  context.quadraticCurveTo(-8, 2, -10, -7);
  context.moveTo(10, -7);
  context.quadraticCurveTo(4, -10, 2, 6);
  context.quadraticCurveTo(8, 2, 10, -7);
  context.fill();
  context.restore();
}

function drawGoal(x, y) {
  const [cx, cy] = cellCenter(x, y);
  context.save();
  context.translate(cx, cy);
  context.strokeStyle = "#ffd43d";
  context.lineWidth = 3;
  for (const radius of [14, 22]) {
    context.beginPath();
    context.arc(0, 0, radius, -Math.PI * 0.8, -Math.PI * 0.2);
    context.stroke();
  }
  context.fillStyle = "#ffd43d";
  context.beginPath();
  context.moveTo(0, -8);
  context.lineTo(8, 7);
  context.lineTo(-8, 7);
  context.closePath();
  context.fill();
  context.restore();
}

function drawScene() {
  const scenario = currentScenario();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#050813";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.strokeStyle = "rgba(101, 218, 244, 0.05)";
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 50) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 50) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
  context.restore();

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cost = scenario.map[y][x];
      const key = keyOf(x, y);
      const px = x * 50;
      const py = y * 50;

      if (!Number.isFinite(cost)) {
        context.fillStyle = "#02040a";
        context.fillRect(px + 4, py + 4, 42, 42);
        context.strokeStyle = "rgba(101, 218, 244, 0.08)";
        context.strokeRect(px + 8, py + 8, 34, 34);
        continue;
      }

      const shade = (x + y) % 3;
      context.fillStyle = ["#1b294d", "#223158", "#27375f"][shade];
      context.fillRect(px + 3, py + 3, 44, 44);

      context.strokeStyle = "rgba(126, 153, 216, 0.12)";
      context.strokeRect(px + 8, py + 8, 34, 34);

      if (cost === RUBBLE_COST) {
        context.fillStyle = "rgba(240, 146, 56, 0.34)";
        context.fillRect(px + 3, py + 3, 44, 44);
        context.strokeStyle = "#f09238";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(px + 10, py + 36);
        context.lineTo(px + 36, py + 10);
        context.moveTo(px + 23, py + 42);
        context.lineTo(px + 42, py + 23);
        context.stroke();
      }

      if (state.explored.has(key)) {
        context.fillStyle = "rgba(101, 218, 244, 0.33)";
        context.fillRect(px + 4, py + 4, 42, 42);
        context.fillStyle = "rgba(101, 218, 244, 0.8)";
        context.beginPath();
        context.arc(px + 25, py + 25, 3, 0, Math.PI * 2);
        context.fill();
      }

      if (state.active === key) {
        context.strokeStyle = "#ffd43d";
        context.lineWidth = 4;
        context.strokeRect(px + 5, py + 5, 40, 40);
      }
    }
  }

  if (state.path.length > 1) {
    context.save();
    context.strokeStyle = "rgba(99, 240, 180, 0.22)";
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    state.path.forEach(([x, y], index) => {
      const [cx, cy] = cellCenter(x, y);
      if (index === 0) context.moveTo(cx, cy);
      else context.lineTo(cx, cy);
    });
    context.stroke();
    context.strokeStyle = "#63f0b4";
    context.lineWidth = 5;
    context.setLineDash([8, 9]);
    context.stroke();
    context.restore();
  }

  drawWeb(1065, 90, 90);
  drawWeb(85, 690, 65);
  drawGoal(...scenario.goal);
  const agent = state.agent ?? scenario.start;
  drawSpiderMarker(...agent, state.running ? 0.92 : 1);
}

function setCallout(title, message) {
  const callout = document.querySelector("#mission-callout");
  callout.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  callout.classList.remove("pop");
  void callout.offsetWidth;
  callout.classList.add("pop");
}

function updateMetrics(result = null) {
  document.querySelector("#metric-algorithm").textContent = ALGORITHMS[state.algorithm].short;
  document.querySelector("#metric-nodes").textContent = result ? result.expanded.length : "0";
  document.querySelector("#metric-cost").textContent = result && (result.found || result.manual) ? result.cost : "···";
  document.querySelector("#metric-steps").textContent = result && (result.found || result.manual) ? result.steps : "···";
  document.querySelector("#metric-time").textContent = result ? `${result.elapsed.toFixed(2)} ms` : "0.00 ms";
}

function renderFrontier(nodes = []) {
  if (!nodes.length) {
    frontierList.innerHTML = '<li class="empty-frontier">La estructura aparecerá al ejecutar.</li>';
    return;
  }

  frontierList.innerHTML = nodes.map((node) => {
    const values = state.algorithm === "astar"
      ? `g=${node.g} · h=${node.h} · f=${node.f}`
      : `prof.=${node.g} · costo=${node.g}`;
    return `<li><span>(${node.x}, ${node.y})</span><span>${values}</span></li>`;
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
  document.querySelector("#pseudocode").textContent = algorithm.pseudocode.join("\n");
  document.querySelector("#frontier-columns").textContent = state.algorithm === "astar"
    ? "g · h · f"
    : isManual ? "paso · costo" : "profundidad · costo";
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
  document.querySelectorAll("[data-algorithm], #previous-scenario, #next-scenario").forEach((button) => {
    button.disabled = disabled;
  });
}

function resetMission(announce = true) {
  state.runToken += 1;
  state.explored.clear();
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
  if (announce) setCallout("MISIÓN REINICIADA", "El tablero vuelve a su estado inicial.");
  drawScene();
}

function manualResult(found = false) {
  return {
    manual: true,
    found,
    expanded: [...state.explored],
    cost: state.manualCost,
    steps: state.manualSteps,
    elapsed: state.manualElapsed,
  };
}

function renderManualHistory() {
  const entries = state.path.slice(-14).map(([x, y], index) => ({
    x,
    y,
    step: Math.max(0, state.manualSteps - state.path.slice(-14).length + index + 1),
  })).reverse();
  if (!entries.length) {
    renderFrontier();
    return;
  }
  frontierList.innerHTML = entries.map((entry, index) => (
    `<li><span>(${entry.x}, ${entry.y})</span><span>${index === 0 ? "AHORA · " : ""}paso ${entry.step}</span></li>`
  )).join("");
}

function startManualMode() {
  resetMission(false);
  state.manualActive = true;
  state.manualStartedAt = performance.now();
  state.path = [[...currentScenario().start]];
  state.explored.add(keyOf(...currentScenario().start));
  renderManualHistory();
  updateMetrics(manualResult(false));
  document.querySelector("#code-step-label").textContent = "TU DECIDES";
  document.querySelector("#timeline-progress").style.transform = "scaleX(0.04)";
  setCallout("TU TURNO, HÉROE", "Usa flechas, WASD o el control táctil para llegar a la baliza.");
  drawScene();
}

function moveManual(dx, dy) {
  if (state.algorithm !== "manual" || !state.manualActive) {
    if (state.algorithm === "manual") setCallout("INICIA LA PARTIDA", "Pulsa Ejecutar Manual antes de moverte.");
    return;
  }

  const scenario = currentScenario();
  const [currentX, currentY] = state.agent;
  const x = currentX + dx;
  const y = currentY + dy;
  const cost = scenario.map[y]?.[x];
  if (!Number.isFinite(cost)) {
    setCallout("PASO BLOQUEADO", "Hay un edificio sin acceso en esa dirección. Prueba otra ruta.");
    return;
  }

  state.agent = [x, y];
  state.path.push([x, y]);
  state.explored.add(keyOf(x, y));
  state.manualSteps += 1;
  state.manualCost += cost;
  state.manualElapsed = performance.now() - state.manualStartedAt;
  renderManualHistory();
  document.querySelector("#timeline-progress").style.transform = `scaleX(${Math.min(0.92, 0.04 + state.manualSteps / 80)})`;

  const reachedGoal = x === scenario.goal[0] && y === scenario.goal[1];
  if (reachedGoal) {
    state.manualActive = false;
    document.querySelector("#timeline-progress").style.transform = "scaleX(1)";
    document.querySelector("#code-step-label").textContent = "RESCATE MANUAL";
    setCallout("¡LO CONSEGUISTE!", `Tu ruta costó ${state.manualCost} en ${state.manualSteps} movimientos.`);
  }
  updateMetrics(manualResult(reachedGoal));
  drawScene();
}

async function runSelectedAlgorithm() {
  if (state.running) return;
  if (state.algorithm === "manual") {
    startManualMode();
    return;
  }
  const token = ++state.runToken;
  resetMission(false);
  state.runToken = token;
  setControlsDisabled(true);
  const scenario = currentScenario();
  const result = search(state.algorithm, scenario, true);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = Number(document.querySelector("#speed-range").value);
  const frameDelay = Math.max(8, 64 - speed * 0.56);
  const stride = reducedMotion ? result.expanded.length : Math.max(1, Math.ceil(result.expanded.length / 150));

  setCallout("BÚSQUEDA EN CURSO", `${ALGORITHMS[state.algorithm].frontier}: ${result.expanded.length} nodos por inspeccionar.`);
  document.querySelector("#code-step-label").textContent = "EXPANDIENDO";

  for (let index = 0; index < result.expanded.length; index += stride) {
    if (token !== state.runToken) return;
    const node = result.expanded[index];
    state.explored.add(keyOf(node.x, node.y));
    state.active = keyOf(node.x, node.y);
    renderFrontier(result.snapshots[Math.min(index, result.snapshots.length - 1)] ?? []);
    document.querySelector("#metric-nodes").textContent = String(index + 1);
    document.querySelector("#timeline-progress").style.transform = `scaleX(${((index + 1) / result.expanded.length) * 0.72})`;
    drawScene();
    if (!reducedMotion) await delay(frameDelay);
  }

  state.active = null;
  if (result.found) {
    document.querySelector("#code-step-label").textContent = "RUTA ENCONTRADA";
    for (let index = 0; index < result.path.length; index += 1) {
      if (token !== state.runToken) return;
      state.path = result.path.slice(0, index + 1);
      state.agent = result.path[index];
      document.querySelector("#timeline-progress").style.transform = `scaleX(${0.72 + ((index + 1) / result.path.length) * 0.28})`;
      drawScene();
      if (!reducedMotion) await delay(Math.max(14, frameDelay * 1.3));
    }
    setCallout("¡RESCATE COMPLETADO!", `${ALGORITHMS[state.algorithm].short} llegó con costo ${result.cost} en ${result.steps} pasos.`);
  } else {
    setCallout("SIN RUTA", "La frontera quedó vacía. Cambia de misión o reinicia.");
  }

  updateMetrics(result);
  setControlsDisabled(false);
  drawScene();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function runBenchmark() {
  benchmarkButton.disabled = true;
  document.querySelector("#benchmark-status").textContent = "Midiendo…";
  benchmarkButton.textContent = "Ejecutando pruebas…";
  await delay(30);

  const keys = ["dfs", "bfs", "astar"];
  const benchmark = {};
  const timingRepetitions = 120;

  for (const algorithm of keys) {
    const scenarioResults = SCENARIOS.map((scenario) => search(algorithm, scenario, false));
    const timingSamples = [];
    for (let repetition = 0; repetition < timingRepetitions; repetition += 1) {
      const startedAt = performance.now();
      SCENARIOS.forEach((scenario) => search(algorithm, scenario, false));
      timingSamples.push((performance.now() - startedAt) / SCENARIOS.length);
    }
    benchmark[algorithm] = {
      nodes: average(scenarioResults.map((result) => result.expanded.length)),
      cost: average(scenarioResults.map((result) => result.cost)),
      time: average(timingSamples),
      results: scenarioResults,
    };
  }

  const optimalCosts = benchmark.astar.results.map((result) => result.cost);
  const optimalCounts = Object.fromEntries(keys.map((algorithm) => [
    algorithm,
    benchmark[algorithm].results.filter((result, index) => result.cost === optimalCosts[index]).length,
  ]));
  const minimumNodes = Math.min(...keys.map((algorithm) => benchmark[algorithm].nodes));
  const minimumCost = Math.min(...keys.map((algorithm) => benchmark[algorithm].cost));

  const verdicts = {
    dfs: `${optimalCounts.dfs}/5 costos óptimos`,
    bfs: `${optimalCounts.bfs}/5 costos óptimos`,
    astar: `${optimalCounts.astar}/5 costos óptimos`,
  };

  document.querySelector("#results-body").innerHTML = keys.map((algorithm) => {
    const result = benchmark[algorithm];
    const bestNodes = result.nodes === minimumNodes ? "result-best" : "";
    const bestCost = result.cost === minimumCost ? "result-best" : "";
    return `
      <tr>
        <th>${ALGORITHMS[algorithm].short}</th>
        <td class="${bestNodes}" data-label="Nodos prom.">${result.nodes.toFixed(1)}</td>
        <td class="${bestCost}" data-label="Costo prom.">${result.cost.toFixed(1)}</td>
        <td data-label="Tiempo">${result.time.toFixed(3)} ms</td>
        <td data-label="Veredicto">${verdicts[algorithm]}</td>
      </tr>`;
  }).join("");

  const bestEfficiency = keys.reduce((best, algorithm) => (
    benchmark[algorithm].nodes < benchmark[best].nodes ? algorithm : best
  ), keys[0]);
  document.querySelector("#final-verdict").textContent =
    `Con estos datos, A* mantiene el costo mínimo en ${optimalCounts.astar} de 5 escenarios. ` +
    `${ALGORITHMS[bestEfficiency].short} expande menos nodos en promedio (${benchmark[bestEfficiency].nodes.toFixed(1)}). ` +
    `BFS puede perder optimalidad con escombros porque minimiza profundidad, no costo acumulado.`;
  document.querySelector("#benchmark-status").textContent = `${timingRepetitions} repeticiones por algoritmo`;
  benchmarkButton.textContent = "Repetir comparación";
  benchmarkButton.disabled = false;
}

function changeScenario(nextIndex) {
  state.scenarioIndex = (nextIndex + SCENARIOS.length) % SCENARIOS.length;
  updateScenarioUI();
}

function initialize() {
  scenarioSelect.innerHTML = SCENARIOS.map((scenario, index) => (
    `<option value="${index}">${index + 1}. ${scenario.name}</option>`
  )).join("");

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
  benchmarkButton.addEventListener("click", runBenchmark);

  const movementByName = {
    up: [0, -1],
    right: [1, 0],
    down: [0, 1],
    left: [-1, 0],
  };
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveManual(...movementByName[button.dataset.move]));
  });
  window.addEventListener("keydown", (event) => {
    const keyMap = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    };
    const movement = keyMap[event.key];
    if (!movement || state.algorithm !== "manual") return;
    event.preventDefault();
    moveManual(...movement);
  });

  document.querySelectorAll(".info-dot").forEach((button) => {
    button.addEventListener("click", () => setCallout("COMPARACIÓN JUSTA", button.dataset.tip));
  });

  const navigationLinks = [...document.querySelectorAll(".chapter-nav a")];
  const observedSections = navigationLinks.map((link) => document.querySelector(link.getAttribute("href")));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navigationLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-30% 0px -60%" });
  observedSections.forEach((section) => observer.observe(section));

  updateScenarioUI();
  updateAlgorithmUI();
  drawScene();
}

initialize();
