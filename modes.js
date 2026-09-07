"use strict";
// Modos extra sobre el mismo grafo de anclajes: Cacería (MJ se mueve), Carrera (3 agentes) y Torneo (N ciudades).
// Reutiliza buildCity(), search(), drawCity(), ALGORITHMS, SCENARIOS y state de app.js.

const MODE_KEYS = ["dfs", "bfs", "astar"];
const MODE_COLORS = { dfs: "#f09238", bfs: "#65daf4", astar: "#63f0b4" };
const randomCity = (seed, zones) => buildCity(seed, { reach: 150 + (seed % 60), links: 2 + (seed % 3), zones });

// ---------- CACERÍA ----------
const hunt = { algorithm: "astar", scenario: SCENARIOS[1], agent: 0, target: 0, plan: [], explored: new Set(), turn: 0, replans: 0, nodes: 0, captures: 0, timer: null, rows: [] };
const huntContext = document.querySelector("#hunt-canvas").getContext("2d");
const huntValue = (id) => document.querySelector(`#hunt-${id}`);

function huntDraw() {
  drawCity(huntContext, hunt.scenario, {
    explored: document.querySelector("#hunt-show-explored").checked ? hunt.explored : new Set(),
    path: [hunt.agent, ...hunt.plan],
    agent: hunt.agent,
    goal: hunt.target,
    color: MODE_COLORS[hunt.algorithm],
  });
  huntValue("turn").textContent = hunt.turn;
  huntValue("replans").textContent = hunt.replans;
  huntValue("nodes").textContent = hunt.nodes;
  huntValue("distance").textContent = heuristic(hunt.scenario, hunt.agent, hunt.target).toFixed(1);
  huntValue("captures").textContent = hunt.captures;
}

function huntReset(keepCaptures = true) {
  clearInterval(hunt.timer);
  hunt.timer = null;
  hunt.agent = hunt.scenario.start;
  hunt.target = hunt.scenario.goal;
  hunt.plan = [];
  hunt.explored = new Set();
  hunt.turn = 0;
  hunt.replans = 0;
  hunt.nodes = 0;
  if (!keepCaptures) hunt.captures = 0;
  document.querySelector("#hunt-start").disabled = false;
  document.querySelector("#hunt-status").textContent = "Pulsa «Iniciar cacería».";
  huntDraw();
}

function huntTick() {
  const strategy = document.querySelector("#hunt-strategy").value;
  const behavior = document.querySelector("#hunt-behavior").value;
  const ratio = Number(document.querySelector("#hunt-ratio").value);
  const { nodes, adjacency } = hunt.scenario;
  hunt.turn += 1;

  const planBroken = !hunt.plan.length || hunt.plan.at(-1) !== hunt.target;
  if (strategy === "always" || planBroken) {
    const result = search(hunt.algorithm, { ...hunt.scenario, start: hunt.agent, goal: hunt.target }, false);
    hunt.replans += 1;
    hunt.nodes += result.expanded.length;
    hunt.explored = new Set(result.expanded.map((node) => node.id));
    hunt.plan = result.found ? result.path.slice(1) : [];
  }
  if (hunt.plan.length) hunt.agent = hunt.plan.shift();

  if (hunt.agent !== hunt.target && behavior !== "still" && hunt.turn % ratio === 0) {
    const options = adjacency[hunt.target].map((edge) => edge.to);
    if (options.length) {
      hunt.target = behavior === "random"
        ? options[Math.floor(Math.random() * options.length)]
        : options.reduce((best, id) => (distance(nodes[id], nodes[hunt.agent]) > distance(nodes[best], nodes[hunt.agent]) ? id : best), options[0]);
    }
  }

  if (hunt.agent === hunt.target) {
    clearInterval(hunt.timer);
    hunt.timer = null;
    hunt.captures += 1;
    hunt.rows.unshift({ algorithm: hunt.algorithm, strategy, replans: hunt.replans, nodes: hunt.nodes, turns: hunt.turn });
    document.querySelector("#hunt-table").innerHTML = hunt.rows.slice(0, 8).map((row) => (
      `<tr><td>${ALGORITHMS[row.algorithm].short}</td><td>${row.strategy === "always" ? "Cada turno" : "Si se rompe"}</td><td>${row.replans}</td><td>${row.nodes}</td><td>${row.turns}</td></tr>`
    )).join("");
    document.querySelector("#hunt-status").textContent = `¡MJ rescatada en ${hunt.turn} turnos con ${hunt.replans} replanificaciones y ${hunt.nodes} anclajes expandidos!`;
    document.querySelector("#hunt-start").disabled = false;
    beep(880, 0.3);
  } else {
    document.querySelector("#hunt-status").textContent = planBroken ? "El Duende saltó a otra azotea: plan roto, replanificando…" : "Siguiendo el plan actual.";
  }
  huntDraw();
}

function huntStart() {
  if (hunt.timer) return;
  if (hunt.agent === hunt.target) huntReset();
  document.querySelector("#hunt-start").disabled = true;
  hunt.timer = setInterval(huntTick, 1000 / Number(document.querySelector("#hunt-speed").value));
}

// ---------- CARRERA ----------
const race = { scenario: SCENARIOS[1], runners: [], timer: null };
const raceGrid = document.querySelector("#race-grid");
const RACE_SCALE = 0.4;

function raceBuild() {
  clearInterval(race.timer);
  race.timer = null;
  race.runners = MODE_KEYS.map((algorithm) => ({ algorithm, result: search(algorithm, race.scenario, true), index: 0, explored: new Set(), done: false }));
  raceGrid.innerHTML = race.runners.map((runner) => `
    <article class="race-card" data-race="${runner.algorithm}">
      <header><strong>${ALGORITHMS[runner.algorithm].short}</strong><span>0 nodos · frontera 1</span></header>
      <canvas width="${WORLD_W * RACE_SCALE}" height="${WORLD_H * RACE_SCALE}"></canvas>
      <footer></footer>
    </article>`).join("");
  raceDraw();
  document.querySelector("#race-start").disabled = false;
}

function raceDraw() {
  race.runners.forEach((runner) => {
    const card = raceGrid.querySelector(`[data-race="${runner.algorithm}"]`);
    const ctx = card.querySelector("canvas").getContext("2d");
    ctx.setTransform(RACE_SCALE, 0, 0, RACE_SCALE, 0, 0);
    const node = runner.result.expanded[Math.max(0, runner.index - 1)];
    drawCity(ctx, race.scenario, {
      explored: runner.explored,
      path: runner.done ? runner.result.path : [],
      agent: runner.done ? race.scenario.goal : (runner.index ? node.id : race.scenario.start),
      color: MODE_COLORS[runner.algorithm],
      detail: false,
    });
    const frontier = runner.index ? runner.result.snapshots[Math.min(runner.index - 1, runner.result.snapshots.length - 1)]?.length ?? 0 : 1;
    card.querySelector("header span").textContent = `${runner.index} nodos · frontera ${frontier}`;
  });
}

function raceTick() {
  let winner = null;
  race.runners.forEach((runner) => {
    if (runner.done) return;
    runner.explored.add(runner.result.expanded[runner.index].id);
    runner.index += 1;
    if (runner.index >= runner.result.expanded.length) {
      runner.done = true;
      const card = raceGrid.querySelector(`[data-race="${runner.algorithm}"]`);
      card.querySelector("footer").textContent = runner.result.found
        ? `Llegó tras ${runner.index} nodos · costo ${runner.result.cost.toFixed(1)} · ${runner.result.steps} saltos`
        : "Sin ruta";
      if (!winner && !race.runners.some((other) => other !== runner && other.done)) winner = card;
    }
  });
  if (winner) {
    winner.classList.add("winner");
    winner.querySelector("footer").textContent = `🏆 ${winner.querySelector("footer").textContent}`;
    beep(880, 0.3);
  }
  raceDraw();
  if (race.runners.every((runner) => runner.done)) { clearInterval(race.timer); race.timer = null; }
}

function raceStart() {
  if (race.timer || race.runners.every((runner) => runner.done)) return;
  document.querySelector("#race-start").disabled = true;
  race.timer = setInterval(raceTick, 1000 / Number(document.querySelector("#race-speed").value));
}

// ---------- TORNEO ----------
async function runTournament() {
  const count = Number(document.querySelector("#tournament-count").value);
  const seed = Number(document.querySelector("#tournament-seed").value) || 1;
  const withRisk = document.querySelector("#tournament-rubble").checked;
  const status = document.querySelector("#tournament-status");
  const button = document.querySelector("#tournament-start");
  button.disabled = true;
  status.textContent = `Generando ${count} ciudades…`;
  await delay(20);

  const previousRisk = state.rubbleOn;
  state.rubbleOn = withRisk;
  const totals = Object.fromEntries(MODE_KEYS.map((key) => [key, { expanded: 0, cost: 0, steps: 0, memory: 0, optimal: 0, time: 0, wins: 0 }]));
  for (let index = 0; index < count; index += 1) {
    const scenario = randomCity(seed + index * 7919, withRisk ? 1 + (index % 4) : 0);
    const results = {};
    MODE_KEYS.forEach((key) => { results[key] = search(key, scenario, false); });
    const bestCost = Math.min(...MODE_KEYS.map((key) => results[key].cost));
    const fewest = Math.min(...MODE_KEYS.map((key) => results[key].expanded.length));
    MODE_KEYS.forEach((key) => {
      const result = results[key];
      const total = totals[key];
      total.expanded += result.expanded.length;
      total.cost += result.cost;
      total.steps += result.steps;
      total.memory += result.maxFrontier;
      total.time += result.elapsed;
      if (Math.abs(result.cost - bestCost) < 0.05) total.optimal += 1;
      if (result.expanded.length === fewest) total.wins += 1;
    });
    if (index % 5 === 4) { status.textContent = `Ciudad ${index + 1} / ${count}…`; await delay(0); }
  }
  state.rubbleOn = previousRisk;

  const avg = (key, field) => totals[key][field] / count;
  const pct = (key) => Math.round((totals[key].optimal / count) * 100);
  document.querySelector("#tournament-body").innerHTML = MODE_KEYS.map((key) => `
    <tr><th>${ALGORITHMS[key].short}</th><td>${avg(key, "expanded").toFixed(1)}</td><td>${avg(key, "cost").toFixed(1)}</td><td>${avg(key, "steps").toFixed(1)}</td>
    <td>${avg(key, "memory").toFixed(1)}</td><td>${pct(key)}%</td><td>${avg(key, "time").toFixed(3)}</td><td>${totals[key].wins}</td></tr>`).join("");

  const bars = (title, field) => {
    const max = Math.max(...MODE_KEYS.map((key) => avg(key, field)));
    return `<div><h4>${title}</h4>${MODE_KEYS.map((key) => (
      `<div class="bar ${key}"><span>${ALGORITHMS[key].short}</span><i style="width:${(avg(key, field) / max) * 100}%"></i><span>${avg(key, field).toFixed(1)}</span></div>`
    )).join("")}</div>`;
  };
  document.querySelector("#tournament-bars").innerHTML =
    bars("Anclajes expandidos (menos = más eficiente)", "expanded") +
    bars("Costo medio del camino (menos = mejor solución)", "cost") +
    bars("Frontera máxima media (memoria)", "memory");

  document.querySelector("#tournament-verdict").textContent =
    `Sobre ${count} ciudades (semilla ${seed}${withRisk ? ", con bombas" : ", sin bombas"}): ` +
    `A* expandió ${(avg("bfs", "expanded") / avg("astar", "expanded")).toFixed(1)}× menos anclajes que BFS y acertó el óptimo el ${pct("astar")}% de las veces. ` +
    `BFS fue óptimo el ${pct("bfs")}%: en un grafo con distancias reales, menos saltos no significa menos distancia. ` +
    `DFS devolvió caminos ${(avg("dfs", "cost") / avg("astar", "cost")).toFixed(1)}× más caros. ` +
    `Frontera máxima media: DFS ${avg("dfs", "memory").toFixed(0)} · BFS ${avg("bfs", "memory").toFixed(0)} · A* ${avg("astar", "memory").toFixed(0)}.`;
  status.textContent = `${count} ciudades × 3 algoritmos = ${count * 3} búsquedas · ${new Date().toLocaleTimeString()}`;
  button.disabled = false;
}

// ---------- wiring ----------
document.querySelectorAll("[data-hunt-algorithm]").forEach((button) => {
  button.addEventListener("click", () => {
    hunt.algorithm = button.dataset.huntAlgorithm;
    document.querySelectorAll("[data-hunt-algorithm]").forEach((other) => other.classList.toggle("selected", other === button));
    huntReset();
  });
});
document.querySelector("#hunt-start").addEventListener("click", huntStart);
document.querySelector("#hunt-reset").addEventListener("click", () => huntReset(false));
document.querySelector("#hunt-show-explored").addEventListener("change", huntDraw);
document.querySelector("#race-start").addEventListener("click", raceStart);
document.querySelector("#race-reset").addEventListener("click", raceBuild);
document.querySelector("#race-new-map").addEventListener("click", () => { race.scenario = randomCity(Date.now() % 100000, 2); raceBuild(); });
document.querySelector("#tournament-start").addEventListener("click", runTournament);
document.querySelector("#terrain-select").addEventListener("change", () => { huntReset(); raceBuild(); });
document.querySelector("#rubble-range").addEventListener("input", () => { huntReset(); raceBuild(); });

huntReset(false);
raceBuild();
