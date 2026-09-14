"use strict";
/* =====================================================================
   EL ASEDIO DE OSCORP · capa de presentación
   Dibujo del grafo, animación del árbol de búsqueda, bucle de turnos
   y panel de experimentos. La lógica vive en juego.js y agentes.js.
   ===================================================================== */

const COLOR = {
  max: "#65daf4",   // Spider-Man analiza en cian
  min: "#63f0b4",   // el Duende analiza en verde
  poda: "#ff3b52",  // rama cortada por alfa-beta
};

const ui = {
  board: null,
  juego: null,
  estado: null,
  semilla: 42,
  ventaja: "abierta",
  agenteMax: "alfabeta",
  agenteMin: "alfabeta",
  profundidad: 4,
  orden: "mejor_primero",
  pausa: 700,
  modo: "EvE",
  running: false,
  esperandoHumano: false,
  token: 0,
  podadasTotal: 0,
  hover: null,
};

const canvas = document.querySelector("#city-canvas");
const context = canvas.getContext("2d");
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- destellos del árbol de búsqueda ---------------- */
let destellos = [];
let rafId = null;

function destello(desde, hasta, color, vida = 620) {
  destellos.push({ desde, hasta, color, nace: performance.now(), vida });
}

function bucleRender() {
  if (rafId) return;
  const tick = () => {
    dibujar();
    rafId = destellos.length ? requestAnimationFrame(tick) : null;
  };
  rafId = requestAnimationFrame(tick);
}

/* ---------------- avatares ---------------- */
function dibujarSpider(x, y, activo) {
  context.save();
  context.translate(x, y);
  if (activo) {
    context.strokeStyle = "rgba(238, 48, 71, 0.8)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 26 + Math.sin(performance.now() / 260) * 4, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = "rgba(238, 48, 71, 0.3)";
  context.beginPath(); context.arc(0, 0, 22, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#ee3047";
  context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#f7f4e8";
  context.beginPath();
  context.moveTo(-9, -6); context.quadraticCurveTo(-4, -9, -2, 6); context.quadraticCurveTo(-7, 2, -9, -6);
  context.moveTo(9, -6); context.quadraticCurveTo(4, -9, 2, 6); context.quadraticCurveTo(7, 2, 9, -6);
  context.fill();
  context.fillStyle = COLOR.max;
  context.font = "bold 10px sans-serif";
  context.textAlign = "center";
  context.fillText("MAX", 0, -30);
  context.restore();
}

function dibujarDuende(x, y, activo) {
  context.save();
  context.translate(x, y);
  if (activo) {
    context.strokeStyle = "rgba(99, 240, 180, 0.85)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, 26 + Math.sin(performance.now() / 260) * 4, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = "rgba(45, 190, 120, 0.3)";
  context.beginPath(); context.arc(0, 0, 22, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#2ea86a";
  context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill();
  context.font = "17px sans-serif";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText("👺", 0, 1);
  context.fillStyle = COLOR.min;
  context.font = "bold 10px sans-serif";
  context.fillText("MIN", 0, -30);
  context.restore();
}

function dibujarMJ(x, y) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = "#ffd43d"; context.lineWidth = 3;
  context.beginPath(); context.arc(0, 0, 23, -Math.PI * 0.85, -Math.PI * 0.15); context.stroke();
  context.fillStyle = "rgba(255, 212, 61, 0.25)";
  context.beginPath(); context.arc(0, 0, 21, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#e3263a";
  context.beginPath(); context.arc(0, 0, 15, 0, Math.PI * 2); context.fill();
  context.fillStyle = "#fff";
  context.font = "bold 12px sans-serif";
  context.textAlign = "center"; context.textBaseline = "middle";
  context.fillText("MJ", 0, 1);
  context.fillStyle = "#ffd43d";
  context.font = "bold 10px sans-serif";
  context.fillText("META", 0, -31);
  context.restore();
}

/* ---------------- tablero ---------------- */
function dibujar() {
  const { nodes, adjacency, buildings } = ui.board;
  const estado = ui.estado;
  const ahora = performance.now();

  const cielo = context.createLinearGradient(0, 0, 0, WORLD_H);
  cielo.addColorStop(0, "#050813");
  cielo.addColorStop(1, "#141f45");
  context.fillStyle = cielo;
  context.fillRect(0, 0, WORLD_W, WORLD_H);
  context.fillStyle = "rgba(247, 244, 232, 0.8)";
  context.beginPath(); context.arc(WORLD_W - 140, 88, 32, 0, Math.PI * 2); context.fill();

  buildings.forEach((edificio, i) => {
    context.fillStyle = i % 2 ? "#0b1330" : "#0e1738";
    context.fillRect(edificio.x, edificio.top, edificio.width, edificio.height);
    context.fillStyle = "rgba(255, 212, 61, 0.22)";
    for (let wy = edificio.top + 14; wy < WORLD_H - 10; wy += 22) {
      for (let wx = edificio.x + 8; wx < edificio.x + edificio.width - 8; wx += 16) {
        if ((wx * 7 + wy * 13 + ui.board.seed) % 5 < 2) context.fillRect(wx, wy, 6, 9);
      }
    }
  });

  context.lineCap = "round";
  context.strokeStyle = "rgba(169, 183, 216, 0.26)";
  context.lineWidth = 1.4;
  adjacency.forEach((aristas, desde) =>
    aristas.forEach((arista) => {
      if (arista.to <= desde) return;
      context.beginPath();
      context.moveTo(nodes[desde].x, nodes[desde].y);
      context.lineTo(nodes[arista.to].x, nodes[arista.to].y);
      context.stroke();
    })
  );

  // Ramas evaluadas (cian/verde) y ramas PODADAS (rojo con ✕).
  destellos = destellos.filter((f) => ahora - f.nace < f.vida);
  destellos.forEach((f) => {
    const a = nodes[f.desde];
    const b = nodes[f.hasta];
    if (!a || !b) return;
    context.save();
    context.globalAlpha = Math.max(0, 1 - (ahora - f.nace) / f.vida);
    context.strokeStyle = f.color;
    context.lineWidth = f.color === COLOR.poda ? 5 : 3.5;
    if (f.color === COLOR.poda) context.setLineDash([9, 6]);
    context.shadowColor = f.color;
    context.shadowBlur = 14;
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    if (f.color === COLOR.poda) {
      context.setLineDash([]);
      context.font = "bold 16px sans-serif";
      context.textAlign = "center";
      context.fillStyle = f.color;
      context.fillText("✕", (a.x + b.x) / 2, (a.y + b.y) / 2 + 5);
    }
    context.restore();
  });

  // Modo humano: marcar los anclajes legales.
  const jugables = new Set();
  if (ui.esperandoHumano) {
    ui.juego.acciones(estado).forEach((id) => jugables.add(id));
    context.save();
    context.setLineDash([6, 6]);
    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 2.5;
    jugables.forEach((id) => {
      context.beginPath();
      context.moveTo(nodes[estado.max].x, nodes[estado.max].y);
      context.lineTo(nodes[id].x, nodes[id].y);
      context.stroke();
    });
    context.restore();
  }

  nodes.forEach((nodo, id) => {
    const jugable = jugables.has(id);
    context.fillStyle = jugable ? "#2b4478" : "#1b294d";
    context.strokeStyle = jugable ? "#ffffff" : "rgba(126, 153, 216, 0.7)";
    context.lineWidth = jugable ? 3 : 2;
    context.beginPath();
    context.arc(nodo.x, nodo.y, jugable ? 10 : nodo.antenna ? 5 : 7, 0, Math.PI * 2);
    context.fill(); context.stroke();
    if (jugable && ui.hover === id) {
      context.strokeStyle = "#ffd43d"; context.lineWidth = 3;
      context.beginPath(); context.arc(nodo.x, nodo.y, 16, 0, Math.PI * 2); context.stroke();
    }
  });

  dibujarMJ(nodes[ui.juego.meta].x, nodes[ui.juego.meta].y);
  dibujarDuende(nodes[estado.min].x, nodes[estado.min].y, ui.running && estado.turno === "MIN");
  dibujarSpider(nodes[estado.max].x, nodes[estado.max].y, ui.running && estado.turno === "MAX");
}

/* ---------------- animación de la traza ----------------
   El árbol puede tener miles de nodos. Para la animación conservo todas
   las podas (que es lo interesante) y una muestra uniforme del resto. */
function muestrearTraza(traza, maximo = 56) {
  if (traza.length <= maximo) return traza;
  const podas = traza.filter((e) => e.tipo === "poda").slice(0, Math.floor(maximo / 2));
  const evals = traza.filter((e) => e.tipo === "eval");
  const cupo = Math.max(1, maximo - podas.length);
  const paso = evals.length / cupo;
  const muestra = [];
  for (let i = 0; i < cupo; i += 1) muestra.push(evals[Math.floor(i * paso)]);
  return [...muestra.filter(Boolean), ...podas].sort((a, b) => a.seq - b.seq);
}

async function animarTraza(traza, presupuesto, token) {
  const eventos = muestrearTraza(traza ?? []);
  if (!eventos.length) return;
  const intervalo = Math.max(10, presupuesto / eventos.length);
  for (const evento of eventos) {
    if (token !== ui.token) return;
    if (evento.tipo === "eval") {
      destello(evento.desde, evento.hasta, evento.lado === "MAX" ? COLOR.max : COLOR.min);
    } else {
      evento.descartados.forEach((d) => destello(evento.desde, d, COLOR.poda, 950));
    }
    bucleRender();
    await sleep(intervalo);
  }
}

/* ---------------- interfaz ---------------- */
function mensaje(texto, tono = "") {
  const nodo = $("#stat-verdict");
  nodo.textContent = texto;
  nodo.dataset.tono = tono;
}

function actualizarUI() {
  const estado = ui.estado;
  const turno = estado.turno;
  $("#arena").dataset.turno = ui.running ? turno : "idle";
  $("#turn-chip").textContent = ui.running ? (turno === "MAX" ? "TURNO MAX" : "TURNO MIN") : "EN ESPERA";
  $("#metric-turn").textContent = !ui.running
    ? "En espera"
    : turno === "MAX"
      ? (ui.modo === "PvE" ? "Spider-Man · TU TURNO" : `Spider-Man · ${AGENTES[ui.agenteMax].nombre}`)
      : `Duende · ${AGENTES[ui.agenteMin].nombre}`;
  $("#metric-turns").textContent = `${estado.turnos} / ${ui.juego.limiteTurnos}`;
  $("#metric-pruned").textContent = ui.podadasTotal;
  $("#seed-value").textContent = ui.semilla;
}

function mostrarMetricas(informe) {
  $("#stat-evaluated").textContent = informe.nodos.toLocaleString("es");
  $("#stat-pruned").textContent = informe.podas ?? 0;
  $("#stat-ms").textContent = `${informe.ms.toFixed(2)} ms`;
  $("#stat-score").textContent =
    Math.abs(informe.valor) === 1 ? (informe.valor > 0 ? "+1 (gana MAX)" : "−1 (gana MIN)") : informe.valor.toFixed(3);
  $("#stat-side").textContent = informe.nombre;
}

/* ---------------- bucle de partida ---------------- */
function terminar() {
  ui.running = false;
  ui.esperandoHumano = false;
  $("#run-button").disabled = false;
  $("#run-button").textContent = "Iniciar asedio";
  const ganador = ganadorDe(ui.juego, ui.estado);
  const textos = {
    MAX: "¡GANA MAX! Spider-Man aterrizó sobre el Duende. utilidad = +1",
    MIN: "¡GANA MIN! El Duende alcanzó a Mary Jane. utilidad = −1",
    EMPATE: `EMPATE. Se agotó el límite de ${ui.juego.limiteTurnos} turnos. utilidad = 0`,
  };
  mensaje(textos[ganador], ganador === "MAX" ? "ok" : ganador === "MIN" ? "mal" : "");
  actualizarUI();
  dibujar();
}

async function turnoAgente(token) {
  const estado = ui.estado;
  const esMax = estado.turno === "MAX";
  const clave = esMax ? ui.agenteMax : ui.agenteMin;
  const { nombre, fn } = AGENTES[clave];

  mensaje(`${esMax ? "Spider-Man" : "El Duende"} decide con ${nombre}…`);
  actualizarUI();

  const informe = medir(ui.juego, fn, estado, `${esMax ? "MAX" : "MIN"} · ${nombre}`, {
    profundidad: ui.profundidad,
    orden: ui.orden,
    traza: clave === "alfabeta",
  });

  // La traza viene de la misma ejecución que se acaba de medir, no se recalcula.
  if (informe.traza) await animarTraza(informe.traza, Math.max(240, ui.pausa * 0.75), token);
  if (token !== ui.token) return;

  if (informe.jugada === null || informe.jugada === undefined) return terminar();
  ui.podadasTotal += informe.podas ?? 0;
  ui.estado = ui.juego.resultado(estado, informe.jugada);
  mostrarMetricas(informe);
  actualizarUI();
  dibujar();
}

async function bucle(token) {
  while (ui.running && token === ui.token) {
    if (ui.juego.terminal(ui.estado)) return terminar();

    if (ui.modo === "PvE" && ui.estado.turno === "MAX") {
      ui.esperandoHumano = true;
      mensaje("Tu turno: haz clic en uno de los anclajes marcados en blanco.");
      actualizarUI();
      dibujar();
      return; // se reanuda desde el clic
    }

    ui.esperandoHumano = false;
    await turnoAgente(token);
    if (token !== ui.token) return;
    await sleep(ui.pausa);
  }
}

function iniciar() {
  if (ui.running) return;
  ui.running = true;
  $("#run-button").disabled = true;
  $("#run-button").textContent = "Asedio en curso…";
  bucle(ui.token);
}

function reiniciar(nuevaSemilla = false) {
  ui.token += 1;
  ui.running = false;
  ui.esperandoHumano = false;
  destellos = [];
  if (nuevaSemilla) ui.semilla = Math.floor(Math.random() * 99999);
  ui.board = createBoard(ui.semilla, ui.ventaja);
  ui.juego = JuegoAsedio(ui.board);
  ui.estado = ui.juego.inicial();
  ui.podadasTotal = 0;
  $("#run-button").disabled = false;
  $("#run-button").textContent = "Iniciar asedio";
  ["evaluated", "pruned", "ms", "score"].forEach((id) => { $(`#stat-${id}`).textContent = "—"; });
  $("#stat-side").textContent = "—";
  mensaje("Elige los agentes y lanza el asedio.");
  actualizarUI();
  dibujar();
}

/* =====================================================================
   EXPERIMENTOS
   ===================================================================== */
function tablaHTML(cabeceras, filas) {
  return `<table class="exp-table"><thead><tr>${cabeceras.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function pintarExperimento(titulo, html, nota = "") {
  $("#exp-output").innerHTML =
    `<h3>${titulo}</h3>${html}${nota ? `<p class="exp-note">${nota}</p>` : ""}`;
}

async function conBoton(id, etiqueta, tarea) {
  const boton = $(id);
  const original = boton.textContent;
  document.querySelectorAll(".exp-actions button").forEach((b) => { b.disabled = true; });
  boton.textContent = etiqueta;
  $("#exp-output").innerHTML = '<p class="exp-note">Ejecutando…</p>';
  await sleep(30);
  try {
    await tarea();
  } finally {
    document.querySelectorAll(".exp-actions button").forEach((b) => { b.disabled = false; });
    boton.textContent = original;
  }
}

// (a) Costo de la primera jugada: los 5 agentes sobre el MISMO estado inicial.
async function expPrimeraJugada() {
  const estado = ui.juego.inicial();
  const filas = Object.entries(AGENTES).map(([clave, { nombre, fn }]) => {
    const informe = medir(ui.juego, fn, estado, nombre, {
      profundidad: ui.profundidad,
      orden: ui.orden,
    });
    const extra = informe.planEncontrado === false ? " (sin plan)" : "";
    return [
      nombre,
      `anclaje #${informe.jugada}${extra}`,
      informe.nodos.toLocaleString("es"),
      informe.ms.toFixed(3),
      clave === "alfabeta" ? informe.podas : "—",
    ];
  });
  pintarExperimento(
    "(a) Costo de la primera jugada",
    tablaHTML(["Agente", "Jugada", "Nodos", "ms", "Podas"], filas),
    `Mismo estado inicial, profundidad ${ui.profundidad}, orden «${ui.orden}». Minimax y Alfa-Beta
     eligen la misma jugada, pero Alfa-Beta visita muchos menos nodos: la poda no cambia el
     resultado, solo el trabajo. DFS y BFS son baratos porque se rinden en cuanto encuentran
     una secuencia ganadora suponiendo que el rival colabora, y ese plan es una fantasía.`
  );
}

// (b) Efecto del orden de sucesores sobre la poda alfa-beta.
async function expOrden() {
  const ordenes = ["natural", "aleatorio", "mejor_primero"];
  const ciudades = [11, 42, 77, 123, 999].map((s) => JuegoAsedio(createBoard(s, ui.ventaja)));
  const filas = ordenes.map((orden) => {
    let nodos = 0;
    let podas = 0;
    let ms = 0;
    ciudades.forEach((juego) => {
      const informe = medir(juego, jugada_alfabeta, juego.inicial(), `alfabeta·${orden}`, {
        profundidad: ui.profundidad,
        orden,
      });
      nodos += informe.nodos;
      podas += informe.podas;
      ms += informe.ms;
    });
    const n = ciudades.length;
    return [orden, Math.round(nodos / n).toLocaleString("es"), (podas / n).toFixed(1), (ms / n).toFixed(3)];
  });

  const soloMinimax = ciudades.reduce((acc, juego) => {
    const informe = medir(juego, jugada_minimax, juego.inicial(), "minimax", { profundidad: ui.profundidad });
    return acc + informe.nodos;
  }, 0) / ciudades.length;

  // La conclusión se redacta con los números que acaban de salir, no con una
  // frase fija: si el experimento cambia, el texto cambia con él.
  const nodosPorOrden = Object.fromEntries(
    ordenes.map((orden, i) => [orden, Number(filas[i][1].replace(/\./g, ""))])
  );
  const mejor = ordenes.reduce((a, b) => (nodosPorOrden[a] <= nodosPorOrden[b] ? a : b));
  const ahorro = (1 - nodosPorOrden[mejor] / soloMinimax) * 100;

  filas.unshift(["minimax (sin poda)", Math.round(soloMinimax).toLocaleString("es"), "0.0", "—"]);

  pintarExperimento(
    "(b) Orden de sucesores en Alfa-Beta",
    tablaHTML(["Orden", "Nodos medios", "Podas medias", "ms medios"], filas),
    `Media de ${ciudades.length} ciudades a profundidad ${ui.profundidad}. El orden no cambia nunca la
     jugada elegida, solo cuánto cuesta encontrarla. Aquí el mejor es «${mejor}», que visita un
     ${ahorro.toFixed(0)}% menos de nodos que Minimax sin poda. Probar primero las jugadas fuertes
     estrecha antes la ventana alfa-beta, así que corta más ramas. El orden «natural» es simplemente
     el índice del nodo en el grafo: no tiene nada que ver con lo buena que es la jugada, por eso
     puede rendir incluso peor que barajar al azar.`
  );
}

// (c) Batería de torneos automáticos.
async function expTorneos() {
  const fabricaJuego = (i) => JuegoAsedio(createBoard(1000 + i * 137, ui.ventaja));
  const opciones = { profundidad: ui.profundidad, orden: ui.orden, fabricaJuego };
  const enfrentamientos = [
    ["Alfa-Beta", "Aleatorio", jugada_alfabeta, jugada_aleatorio, 20],
    ["Alfa-Beta", "Minimax", jugada_alfabeta, jugada_minimax, 5],
    ["DFS cooperativo", "Alfa-Beta", jugada_dfs, jugada_alfabeta, 3],
    ["BFS cooperativo", "Alfa-Beta", jugada_bfs, jugada_alfabeta, 3],
    ["Aleatorio", "Alfa-Beta", jugada_aleatorio, jugada_alfabeta, 20],
  ];

  const filas = [];
  for (const [n1, n2, a1, a2, n] of enfrentamientos) {
    const r = torneo(null, a1, a2, n, opciones);
    filas.push([
      `${n1} (MAX) vs ${n2} (MIN)`, n,
      r.victorias, r.derrotas, r.empates,
      r.turnosMedios.toFixed(1), r.nodosMedios.toLocaleString("es"),
    ]);
    $("#exp-output").innerHTML = tablaHTML(
      ["Enfrentamiento", "N", "Gana MAX", "Gana MIN", "Empates", "Turnos", "Nodos/partida"], filas);
    await sleep(0);
  }

  pintarExperimento(
    "(c) Torneos automáticos",
    tablaHTML(["Enfrentamiento", "N", "Gana MAX", "Gana MIN", "Empates", "Turnos", "Nodos/partida"], filas),
    `Cada partida usa una ciudad distinta, si no todas serían idénticas con agentes deterministas.
     Victorias y derrotas se cuentan siempre desde la óptica del agente que lleva a MAX.
     Fíjate en que DFS y BFS pierden contra Alfa-Beta: su plan supone que el rival coopera.`
  );
}

/* ---------------- eventos ---------------- */
function nodoEnPunto(evento) {
  const rect = canvas.getBoundingClientRect();
  const x = ((evento.clientX - rect.left) / rect.width) * WORLD_W;
  const y = ((evento.clientY - rect.top) / rect.height) * WORLD_H;
  const legales = ui.juego.acciones(ui.estado);
  return legales.find((id) => distance(ui.board.nodes[id], { x, y }) < 24) ?? null;
}

canvas.addEventListener("mousemove", (evento) => {
  if (!ui.esperandoHumano) return;
  const anterior = ui.hover;
  ui.hover = nodoEnPunto(evento);
  canvas.style.cursor = ui.hover === null ? "default" : "pointer";
  if (anterior !== ui.hover) dibujar();
});

canvas.addEventListener("click", (evento) => {
  if (!ui.esperandoHumano) return;
  const destino = nodoEnPunto(evento);
  if (destino === null) {
    mensaje("Ese anclaje no está conectado con el tuyo. Elige uno marcado en blanco.", "mal");
    return;
  }
  ui.estado = ui.juego.resultado(ui.estado, destino);
  ui.esperandoHumano = false;
  ui.hover = null;
  actualizarUI();
  dibujar();
  bucle(ui.token);
});

$("#run-button").addEventListener("click", iniciar);
$("#reset-button").addEventListener("click", () => reiniciar(false));
$("#new-city").addEventListener("click", () => reiniciar(true));

$("#depth-range").addEventListener("input", (e) => {
  ui.profundidad = Number(e.target.value);
  $("#depth-val").textContent = ui.profundidad;
});
$("#speed-range").addEventListener("input", (e) => {
  ui.pausa = Number(e.target.value);
  $("#speed-val").textContent = `${ui.pausa} ms`;
});
$("#order-select").addEventListener("change", (e) => { ui.orden = e.target.value; });
$("#agent-max").addEventListener("change", (e) => { ui.agenteMax = e.target.value; reiniciar(false); });
$("#agent-min").addEventListener("change", (e) => { ui.agenteMin = e.target.value; reiniciar(false); });
$("#advantage-select").addEventListener("change", (e) => { ui.ventaja = e.target.value; reiniciar(false); });

document.querySelectorAll("[data-mode]").forEach((boton) => {
  boton.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((otro) => otro.classList.toggle("selected", otro === boton));
    ui.modo = boton.dataset.mode;
    $("#agent-max").disabled = ui.modo === "PvE";
    reiniciar(false);
  });
});

$("#exp-first").addEventListener("click", () => conBoton("#exp-first", "Midiendo…", expPrimeraJugada));
$("#exp-order").addEventListener("click", () => conBoton("#exp-order", "Comparando…", expOrden));
$("#exp-tournament").addEventListener("click", () => conBoton("#exp-tournament", "Jugando…", expTorneos));

reiniciar(false);
