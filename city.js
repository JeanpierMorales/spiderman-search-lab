"use strict";
// Generador del tablero: un GRAFO de puntos de anclaje sobre el skyline de Oscorp.
// Nodo = azotea, cornisa o antena. Arista = telaraña / planeo posible entre dos anclajes.

const WORLD_W = 1150;
const WORLD_H = 750;
const UNIT = 40; // píxeles por unidad de distancia

const round1 = (value) => Math.round(value * 10) / 10;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

// Saltos mínimos desde `source` a cada nodo (BFS sobre el grafo sin pesos).
function hopDistances(adjacency, source) {
  const hops = new Array(adjacency.length).fill(Infinity);
  hops[source] = 0;
  const queue = [source];
  while (queue.length) {
    const node = queue.shift();
    for (const edge of adjacency[node]) {
      if (hops[edge.to] === Infinity) {
        hops[edge.to] = hops[node] + 1;
        queue.push(edge.to);
      }
    }
  }
  return hops;
}

function buildGraph(seed) {
  const random = seededRandom(seed);

  const buildings = [];
  for (let x = 12; x < WORLD_W - 60; ) {
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
    if (random() < 0.8) {
      nodes.push({ x: random() < 0.5 ? x + 4 : x + width - 4, y: top + 40 + random() * height * 0.5, building: index, facade: true });
    }
    if (height > 300 && random() < 0.5) {
      nodes.push({ x: x + width / 2, y: top + 90 + random() * height * 0.4, building: index, facade: true });
    }
    if (height > 380 && random() < 0.6) {
      nodes.push({ x: x + width / 2, y: top - 42, building: index, antenna: true });
    }
  });

  const adjacency = nodes.map(() => []);
  const connect = (a, b) => {
    if (a === b || adjacency[a].some((edge) => edge.to === b)) return;
    const length = round1(distance(nodes[a], nodes[b]) / UNIT);
    adjacency[a].push({ to: b, length });
    adjacency[b].push({ to: a, length });
  };
  nodes.forEach((node, index) => {
    nodes
      .map((other, otherIndex) => ({ otherIndex, d: distance(node, other) }))
      .filter(({ otherIndex, d }) => otherIndex !== index && d < 180)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ otherIndex }) => connect(index, otherIndex));
  });

  // Un anclaje aislado rompería el juego: lo engancho al nodo alcanzable más cercano.
  for (;;) {
    const reachable = new Set([0]);
    const queue = [0];
    while (queue.length) {
      adjacency[queue.shift()].forEach(({ to }) => {
        if (!reachable.has(to)) {
          reachable.add(to);
          queue.push(to);
        }
      });
    }
    if (reachable.size === nodes.length) break;
    const orphan = nodes.findIndex((_, index) => !reachable.has(index));
    let best = 0;
    reachable.forEach((index) => {
      if (distance(nodes[index], nodes[orphan]) < distance(nodes[best], nodes[orphan])) best = index;
    });
    connect(orphan, best);
  }
  adjacency.forEach((edges) => edges.sort((a, b) => a.to - b.to));

  return { seed, buildings, nodes, adjacency };
}

// Quién sale con ventaja. El resultado de la partida depende muchísimo de la
// posición inicial: con el mismo algoritmo, Spider-Man gana o pierde según
// cuántos saltos le separen de Mary Jane cuando el Duende arranca su carrera.
// Valores medidos sobre 10 ciudades con Alfa-Beta contra Alfa-Beta a profundidad 4:
//   4 saltos -> MAX 7, MIN 0, empates 3     (Spider-Man llega a tiempo a cerrar el paso)
//   5 saltos -> MAX 4, MIN 3, empates 3     (partida realmente disputada)
//   7 saltos -> MAX 0, MIN 10               (el Duende pasa antes de que le intercepten)
const VENTAJAS = {
  spidey: { spideyHops: 4, etiqueta: "Guardia cerrada · ventaja MAX" },
  abierta: { spideyHops: 5, etiqueta: "Persecución abierta · equilibrada" },
  duende: { spideyHops: 7, etiqueta: "Duende desatado · ventaja MIN" },
};
const GOBLIN_HOPS = 5; // saltos que separan al Duende de MJ al empezar

const SEPARACION_MINIMA = 3; // saltos mínimos entre Spidey y el Duende al empezar

// Busca el nodo cuya distancia en saltos a MJ sea la más parecida a `objetivo`.
function nodoASaltos(fromTarget, objetivo, excluir = -1) {
  let mejor = -1;
  let mejorError = Infinity;
  fromTarget.forEach((hops, index) => {
    if (index === excluir || !Number.isFinite(hops)) return;
    const error = Math.abs(hops - objetivo);
    if (error < mejorError) {
      mejorError = error;
      mejor = index;
    }
  });
  return mejor;
}

// MJ se queda en el extremo derecho del skyline; el Duende entra a `GOBLIN_HOPS`
// saltos de ella y Spider-Man se coloca según la ventaja elegida.
function placeActors(graph, ventaja = "abierta") {
  const { nodes, adjacency } = graph;
  const target = nodes.reduce((best, node, index) => (node.x > nodes[best].x && !node.facade ? index : best), 0);
  const fromTarget = hopDistances(adjacency, target);
  const goblin = nodoASaltos(fromTarget, GOBLIN_HOPS);
  const fromGoblin = hopDistances(adjacency, goblin);
  const objetivo = (VENTAJAS[ventaja] ?? VENTAJAS.abierta).spideyHops;

  // Spider-Man debe caer en su banda de saltos a MJ, pero SIN empezar pegado al
  // Duende: si arrancan adyacentes la partida se acaba en la primera jugada y no
  // se ve nada. Entre los candidatos válidos, el que mejor respete la banda.
  const candidatos = nodes
    .map((_, index) => index)
    .filter((index) =>
      index !== goblin && index !== target &&
      Number.isFinite(fromTarget[index]) && fromGoblin[index] >= SEPARACION_MINIMA);

  const elegibles = candidatos.length ? candidatos : nodes.map((_, i) => i).filter((i) => i !== goblin);
  const spidey = elegibles.reduce((mejor, index) =>
    Math.abs(fromTarget[index] - objetivo) < Math.abs(fromTarget[mejor] - objetivo) ? index : mejor
  , elegibles[0]);

  return { spidey, goblin, target, ventaja };
}

function createBoard(seed, ventaja = "abierta") {
  const graph = buildGraph(seed);
  return { ...graph, ...placeActors(graph, ventaja) };
}
