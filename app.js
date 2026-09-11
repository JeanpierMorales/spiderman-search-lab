"use strict";

const WORLD_W = 1150;
const WORLD_H = 750;
const UNIT = 40;

// ---------- Utilidades ----------
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

// ---------- Generador de Ciudad ----------
function buildCity(seed) {
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

  const adjacency = nodes.map(() => []);
  const connect = (a, b) => {
    if (a === b || adjacency[a].some((edge) => edge.to === b)) return;
    const length = round1(distance(nodes[a], nodes[b]) / UNIT);
    adjacency[a].push({ to: b, length });
    adjacency[b].push({ to: a, length });
  };
  
  nodes.forEach((node, index) => {
    nodes.map((other, otherIndex) => ({ otherIndex, d: distance(node, other) }))
      .filter(({ otherIndex, d }) => otherIndex !== index && d < 180)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ otherIndex }) => connect(index, otherIndex));
  });

  const start = 0;
  const goal = nodes.reduce((best, node, index) => (node.x > nodes[best].x && !node.facade ? index : best), 0);
  return { buildings, nodes, adjacency, start, goal };
}

// ---------- Estado Global Minimax ----------
const scenario = buildCity(42); 
const state = {
  spidey: scenario.start,
  goblin: Math.floor(scenario.nodes.length / 2),
  target: scenario.goal,
  turn: 'MAX',
  mode: 'EvE',
  depth: 4,
  pruned: 0,
  turns: 0,
  timer: null,
  speed: 800
};

const canvas = document.querySelector("#city-canvas");
const context = canvas.getContext("2d");

// ---------- Dibujo Gráfico ----------
function drawSpider(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(238, 48, 71, 0.25)"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ee3047"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f7f4e8"; ctx.beginPath();
  ctx.moveTo(-9, -6); ctx.quadraticCurveTo(-4, -9, -2, 6); ctx.quadraticCurveTo(-7, 2, -9, -6);
  ctx.moveTo(9, -6); ctx.quadraticCurveTo(4, -9, 2, 6); ctx.quadraticCurveTo(7, 2, 9, -6); ctx.fill();
  ctx.restore();
}

function drawMJ(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = "#ffd43d"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke();
  ctx.fillStyle = "#e3263a"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("MJ", 0, 1);
  ctx.restore();
}

function drawGoblin(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(40, 167, 69, 0.25)"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#28a745"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("DV", 0, 1);
  ctx.font = "18px sans-serif"; ctx.fillText("🎃", 0, -32);
  ctx.restore();
}

function drawCity() {
  const { nodes, adjacency, buildings } = scenario;
  
  const sky = context.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, "#050813"); sky.addColorStop(1, "#141f45");
  context.fillStyle = sky; context.fillRect(0, 0, WORLD_W, WORLD_H);

  buildings.forEach((building, index) => {
    context.fillStyle = index % 2 ? "#0b1330" : "#0e1738";
    context.fillRect(building.x, building.top, building.width, building.height);
  });

  context.lineCap = "round";
  context.strokeStyle = "rgba(169, 183, 216, 0.28)";
  context.lineWidth = 1.4;
  adjacency.forEach((edges, from) => edges.forEach((edge) => {
    if (edge.to > from) {
      context.beginPath(); context.moveTo(nodes[from].x, nodes[from].y); context.lineTo(nodes[edge.to].x, nodes[edge.to].y); context.stroke();
    }
  }));

  // Resaltar posibles saltos si es turno de Spidey en modo PvE
  if (state.mode === 'PvE' && state.turn === 'MAX' && state.timer) {
    adjacency[state.spidey].forEach((edge) => {
      context.beginPath();
      context.strokeStyle = "rgba(255, 255, 255, 0.5)";
      context.lineWidth = 3;
      context.setLineDash([5, 5]);
      context.moveTo(nodes[state.spidey].x, nodes[state.spidey].y);
      context.lineTo(nodes[edge.to].x, nodes[edge.to].y);
      context.stroke();
      context.setLineDash([]);
    });
  }

  nodes.forEach((node, id) => {
    context.fillStyle = "#1b294d"; context.strokeStyle = "rgba(126, 153, 216, 0.7)"; context.lineWidth = 2;
    context.beginPath(); context.arc(node.x, node.y, node.antenna ? 5 : 7, 0, Math.PI * 2); context.fill(); context.stroke();
  });

  drawMJ(context, nodes[state.target].x, nodes[state.target].y);
  drawGoblin(context, nodes[state.goblin].x, nodes[state.goblin].y);
  drawSpider(context, nodes[state.spidey].x, nodes[state.spidey].y);
  updateUI();
}

// ---------- Inteligencia Artificial: Minimax Alfa-Beta ----------
function minimaxAlphaBeta(spideyNode, goblinNode, depth, alpha, beta, isMaximizing) {
  const { nodes, adjacency } = scenario;

  if (spideyNode === goblinNode) return { score: 1000 }; 
  if (goblinNode === state.target) return { score: -1000 };     
  
  if (depth === 0) {
    const dGoblinMJ = distance(nodes[goblinNode], nodes[state.target]);
    const dSpideyGoblin = distance(nodes[spideyNode], nodes[goblinNode]);
    return { score: dGoblinMJ - dSpideyGoblin };
  }

  let bestMove = null;

  if (isMaximizing) {
    let maxEval = -Infinity;
    const options = adjacency[spideyNode].map(e => e.to);
    if (options.length === 0) return { score: -500 }; 
    bestMove = options[0];
    
    for (const nextNode of options) {
      const evalNode = minimaxAlphaBeta(nextNode, goblinNode, depth - 1, alpha, beta, false);
      if (evalNode.score > maxEval) { maxEval = evalNode.score; bestMove = nextNode; }
      alpha = Math.max(alpha, evalNode.score);
      if (beta <= alpha) { state.pruned++; break; }
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    const options = adjacency[goblinNode].map(e => e.to);
    if (options.length === 0) return { score: 500 }; 
    bestMove = options[0];

    for (const nextNode of options) {
      const evalNode = minimaxAlphaBeta(spideyNode, nextNode, depth - 1, alpha, beta, true);
      if (evalNode.score < minEval) { minEval = evalNode.score; bestMove = nextNode; }
      beta = Math.min(beta, evalNode.score);
      if (beta <= alpha) { state.pruned++; break; }
    }
    return { score: minEval, move: bestMove };
  }
}

function gameTick() {
  if (state.spidey === state.goblin) {
    clearInterval(state.timer); state.timer = null;
    document.getElementById("stat-verdict").textContent = "¡VICTORIA! Spider-Man acorraló al Duende Verde.";
    drawCity();
    return;
  }
  if (state.goblin === state.target) {
    clearInterval(state.timer); state.timer = null;
    document.getElementById("stat-verdict").textContent = "¡DERROTA! El Duende escapó con MJ.";
    drawCity();
    return;
  }

  // Turno de Spider-Man (MAX)
  if (state.turn === 'MAX') {
    if (state.mode === 'PvE') {
      drawCity(); // Redibujar para mostrar las guías visuales de a dónde puede saltar
      return;     // Detiene la simulación y espera el clic
    }
    const result = minimaxAlphaBeta(state.spidey, state.goblin, state.depth, -Infinity, Infinity, true);
    state.spidey = result.move;
    state.turn = 'MIN';
  } 
  // Turno del Duende Verde (MIN)
  else {
    const result = minimaxAlphaBeta(state.spidey, state.goblin, state.depth, -Infinity, Infinity, false);
    state.goblin = result.move;
    state.turn = 'MAX';
  }
  
  state.turns++;
  drawCity();
}

// ---------- UI y Eventos ----------
function updateUI() {
  let turnoStr = "En espera";
  if (state.timer) {
    turnoStr = state.turn === 'MAX' ? (state.mode === 'PvE' ? "Spider-Man (TU TURNO)" : "Spider-Man") : "Duende Verde";
  }
  document.getElementById("metric-turn").textContent = turnoStr;
  document.getElementById("metric-pruned").textContent = state.pruned;
  document.getElementById("metric-turns").textContent = state.turns;
}

function resetGame() {
  clearInterval(state.timer);
  state.timer = null;
  state.spidey = scenario.start;
  state.goblin = Math.floor(scenario.nodes.length / 2);
  state.turn = 'MAX';
  state.pruned = 0;
  state.turns = 0;
  document.getElementById("stat-verdict").textContent = "Configura la profundidad y ejecuta el algoritmo.";
  document.getElementById("run-button").disabled = false;
  drawCity();
}

document.getElementById("run-button").addEventListener("click", () => {
  if (state.timer) return;
  document.getElementById("run-button").disabled = true;
  document.getElementById("stat-verdict").textContent = state.mode === 'PvE' ? "Haz clic en un anclaje vecino para saltar." : "Calculando el árbol de decisiones...";
  state.timer = setInterval(gameTick, state.speed);
  // Llamar un tick inmediato para que arranque de una vez
  gameTick();
});

document.getElementById("reset-button").addEventListener("click", resetGame);

document.getElementById("depth-range").addEventListener("input", (e) => {
  state.depth = Number(e.target.value);
  document.getElementById("depth-val").textContent = e.target.value;
});

document.getElementById("speed-range").addEventListener("input", (e) => {
  state.speed = Number(e.target.value);
  if (state.timer && state.mode === 'EvE') {
    clearInterval(state.timer);
    state.timer = setInterval(gameTick, state.speed);
  }
});

// Controladores para cambiar de modo
document.querySelectorAll("[data-mode]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll("[data-mode]").forEach(b => b.classList.remove("selected"));
    e.target.classList.add("selected");
    state.mode = e.target.dataset.mode;
    resetGame();
  });
});

// Control de Clics en el Canvas (Modo Manual)
canvas.addEventListener("click", (event) => {
  if (state.mode !== 'PvE' || state.turn !== 'MAX' || !state.timer) return;
  
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  
  const { nodes, adjacency } = scenario;
  
  const clickedEdge = adjacency[state.spidey].find(edge => {
    const targetNode = nodes[edge.to];
    return distance(targetNode, { x, y }) < 22; 
  });

  if (clickedEdge) {
    state.spidey = clickedEdge.to;
    state.turn = 'MIN';
    state.turns++;
    drawCity();
    
    // Le damos un respiro de unos ms para que se note que saltó antes de que la IA responda
    setTimeout(gameTick, 250); 
  }
});

// Inicio
drawCity();