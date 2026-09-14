"use strict";
/* =====================================================================
   LOS 5 AGENTES · firma común  jugada_agente(juego, estado, opciones)
   ---------------------------------------------------------------------
   Todos reciben el modelo `juego` y un `estado`, y devuelven un objeto
   { accion, valor, ... }. La acción es siempre un anclaje vecino legal.
   ===================================================================== */

// Contador global de estados visitados. Se pone a cero ANTES de cada decisión
// (lo hace reiniciarContador), así "NODOS" siempre mide una sola jugada.
let NODOS = 0;
function reiniciarContador() { NODOS = 0; }

// Traza opcional de la búsqueda, para animar el árbol y las podas en el canvas.
let TRAZA = [];
let trazaActiva = false;
let trazaSeq = 0;
function registrarTraza(evento) {
  if (trazaActiva) TRAZA.push({ seq: trazaSeq++, ...evento });
}

const claveEstado = (estado) => `${estado.max},${estado.min},${estado.turno}`;

/* ---------------------------------------------------------------------
   ORDEN DE SUCESORES (afecta muchísimo a la poda alfa-beta)
   natural       · el orden en que salen del grafo
   aleatorio     · barajado
   mejor_primero · los que acercan al jugador a su objetivo
                   (MAX se acerca al rival, MIN se acerca a la meta)
   --------------------------------------------------------------------- */
function ordenarSucesores(juego, estado, acciones, modo) {
  if (modo === "natural" || !modo) return acciones;
  if (modo === "aleatorio") {
    const copia = [...acciones];
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }
  // mejor_primero
  const referencia = juego.jugador(estado) === "MAX" ? estado.min : juego.meta;
  return [...acciones].sort(
    (a, b) =>
      distance(juego.nodes[a], juego.nodes[referencia]) -
      distance(juego.nodes[b], juego.nodes[referencia])
  );
}

/* =====================================================================
   1 y 2 · DFS y BFS "cooperativos"
   ---------------------------------------------------------------------
   No son agentes adversariales: buscan en el espacio de estados conjunto
   SUPONIENDO QUE EL RIVAL COOPERA, es decir, que el rival elegirá las
   jugadas que a nosotros nos convienen. Buscan cualquier secuencia que
   acabe en victoria propia y devuelven su PRIMERA acción.

   Es justo lo que hay que enseñar: contra un rival real fracasan, porque
   su plan depende de que el otro se deje atrapar.
   ===================================================================== */

// Si no hay plan ganador dentro del límite, al menos jugamos algo razonable.
function accionDeRespaldo(juego, estado) {
  const soyMax = juego.jugador(estado) === "MAX";
  const acciones = juego.acciones(estado);
  if (!acciones.length) return null;
  return acciones.reduce((mejor, accion) => {
    const vActual = juego.valor(juego.resultado(estado, accion));
    const vMejor = juego.valor(juego.resultado(estado, mejor));
    return (soyMax ? vActual > vMejor : vActual < vMejor) ? accion : mejor;
  }, acciones[0]);
}

function jugada_dfs(juego, estado, opciones = {}) {
  reiniciarContador();
  const limite = opciones.profundidad ?? 8;
  const topeNodos = opciones.topeNodos ?? 80000;
  const yo = juego.jugador(estado);
  const enCamino = new Set(); // evita ciclos dentro de la rama actual

  function explorar(actual, profundidad) {
    NODOS += 1;
    if (NODOS > topeNodos) return false;
    if (juego.terminal(actual)) return ganadorDe(juego, actual) === yo;
    if (profundidad === 0) return false;

    const clave = claveEstado(actual);
    if (enCamino.has(clave)) return false;
    enCamino.add(clave);
    for (const accion of juego.acciones(actual)) {
      if (explorar(juego.resultado(actual, accion), profundidad - 1)) {
        enCamino.delete(clave);
        return true;
      }
    }
    enCamino.delete(clave);
    return false;
  }

  for (const accion of juego.acciones(estado)) {
    if (explorar(juego.resultado(estado, accion), limite - 1)) {
      return { accion, valor: yo === "MAX" ? 1 : -1, planEncontrado: true };
    }
  }
  return { accion: accionDeRespaldo(juego, estado), valor: 0, planEncontrado: false };
}

function jugada_bfs(juego, estado, opciones = {}) {
  reiniciarContador();
  const limite = opciones.profundidad ?? 8;
  const topeNodos = opciones.topeNodos ?? 80000;
  const yo = juego.jugador(estado);

  // Cada entrada recuerda con qué acción del estado raíz empezó su rama.
  const cola = juego.acciones(estado).map((accion) => ({
    estado: juego.resultado(estado, accion),
    primeraAccion: accion,
    profundidad: 1,
  }));
  const visitados = new Set([claveEstado(estado)]);

  while (cola.length) {
    const { estado: actual, primeraAccion, profundidad } = cola.shift();
    NODOS += 1;
    if (NODOS > topeNodos) break;

    if (juego.terminal(actual)) {
      if (ganadorDe(juego, actual) === yo) {
        return { accion: primeraAccion, valor: yo === "MAX" ? 1 : -1, planEncontrado: true, saltos: profundidad };
      }
      continue; // rama muerta: terminal que no me favorece
    }
    if (profundidad >= limite) continue;

    const clave = claveEstado(actual);
    if (visitados.has(clave)) continue;
    visitados.add(clave);

    for (const accion of juego.acciones(actual)) {
      cola.push({ estado: juego.resultado(actual, accion), primeraAccion, profundidad: profundidad + 1 });
    }
  }
  return { accion: accionDeRespaldo(juego, estado), valor: 0, planEncontrado: false };
}

/* =====================================================================
   3 · MINIMAX completo con límite de profundidad
   Funciones mutuamente recursivas MAX_VALOR / MIN_VALOR (estilo AIMA).
   ===================================================================== */

function MAX_VALOR(juego, estado, profundidad) {
  NODOS += 1;
  if (juego.terminal(estado)) return { valor: juego.utilidad(estado), accion: null };
  if (profundidad === 0) return { valor: juego.heuristica(estado), accion: null };

  let mejorValor = -Infinity;
  let mejorAccion = null;
  for (const accion of juego.acciones(estado)) {
    const { valor } = MIN_VALOR(juego, juego.resultado(estado, accion), profundidad - 1);
    if (valor > mejorValor) { mejorValor = valor; mejorAccion = accion; }
  }
  return { valor: mejorValor, accion: mejorAccion };
}

function MIN_VALOR(juego, estado, profundidad) {
  NODOS += 1;
  if (juego.terminal(estado)) return { valor: juego.utilidad(estado), accion: null };
  if (profundidad === 0) return { valor: juego.heuristica(estado), accion: null };

  let mejorValor = Infinity;
  let mejorAccion = null;
  for (const accion of juego.acciones(estado)) {
    const { valor } = MAX_VALOR(juego, juego.resultado(estado, accion), profundidad - 1);
    if (valor < mejorValor) { mejorValor = valor; mejorAccion = accion; }
  }
  return { valor: mejorValor, accion: mejorAccion };
}

function jugada_minimax(juego, estado, opciones = {}) {
  reiniciarContador();
  const profundidad = opciones.profundidad ?? 4;
  const decidir = juego.jugador(estado) === "MAX" ? MAX_VALOR : MIN_VALOR;
  const { valor, accion } = decidir(juego, estado, profundidad);
  return { accion, valor, podas: 0 };
}

/* =====================================================================
   4 · ALFA-BETA · el mismo minimax, pero cortando ramas inútiles
   ---------------------------------------------------------------------
   Invariante: alfa = lo mejor que MAX tiene asegurado hasta ahora,
               beta  = lo mejor que MIN tiene asegurado hasta ahora.
   Si beta <= alfa, el rival nunca dejaría llegar a esta rama: se poda.
   ===================================================================== */

function MAX_VALOR_AB(juego, estado, profundidad, alfa, beta, ctx) {
  NODOS += 1;
  if (juego.terminal(estado)) return { valor: juego.utilidad(estado), accion: null };
  if (profundidad === 0) return { valor: juego.heuristica(estado), accion: null };

  const acciones = ordenarSucesores(juego, estado, juego.acciones(estado), ctx.orden);
  let mejorValor = -Infinity;
  let mejorAccion = acciones[0] ?? null;

  for (let i = 0; i < acciones.length; i += 1) {
    const accion = acciones[i];
    registrarTraza({ tipo: "eval", desde: estado.max, hasta: accion, lado: "MAX" });
    const { valor } = MIN_VALOR_AB(juego, juego.resultado(estado, accion), profundidad - 1, alfa, beta, ctx);
    if (valor > mejorValor) { mejorValor = valor; mejorAccion = accion; }
    alfa = Math.max(alfa, mejorValor);
    if (beta <= alfa) {
      const descartados = acciones.slice(i + 1);
      if (descartados.length) {
        ctx.podas += 1;
        registrarTraza({ tipo: "poda", desde: estado.max, descartados, lado: "MAX" });
      }
      break; // poda beta
    }
  }
  return { valor: mejorValor, accion: mejorAccion };
}

function MIN_VALOR_AB(juego, estado, profundidad, alfa, beta, ctx) {
  NODOS += 1;
  if (juego.terminal(estado)) return { valor: juego.utilidad(estado), accion: null };
  if (profundidad === 0) return { valor: juego.heuristica(estado), accion: null };

  const acciones = ordenarSucesores(juego, estado, juego.acciones(estado), ctx.orden);
  let mejorValor = Infinity;
  let mejorAccion = acciones[0] ?? null;

  for (let i = 0; i < acciones.length; i += 1) {
    const accion = acciones[i];
    registrarTraza({ tipo: "eval", desde: estado.min, hasta: accion, lado: "MIN" });
    const { valor } = MAX_VALOR_AB(juego, juego.resultado(estado, accion), profundidad - 1, alfa, beta, ctx);
    if (valor < mejorValor) { mejorValor = valor; mejorAccion = accion; }
    beta = Math.min(beta, mejorValor);
    if (beta <= alfa) {
      const descartados = acciones.slice(i + 1);
      if (descartados.length) {
        ctx.podas += 1;
        registrarTraza({ tipo: "poda", desde: estado.min, descartados, lado: "MIN" });
      }
      break; // poda alfa
    }
  }
  return { valor: mejorValor, accion: mejorAccion };
}

// opciones.orden: 'natural' | 'aleatorio' | 'mejor_primero'
function jugada_alfabeta(juego, estado, opciones = {}) {
  reiniciarContador();
  const profundidad = opciones.profundidad ?? 4;
  const ctx = { orden: opciones.orden ?? "mejor_primero", podas: 0 };

  trazaActiva = Boolean(opciones.traza);
  TRAZA = [];
  trazaSeq = 0;

  const decidir = juego.jugador(estado) === "MAX" ? MAX_VALOR_AB : MIN_VALOR_AB;
  const { valor, accion } = decidir(juego, estado, profundidad, -Infinity, Infinity, ctx);

  const traza = TRAZA;
  trazaActiva = false;
  return { accion, valor, podas: ctx.podas, traza };
}

/* ===================================================================== */
/* 5 · ALEATORIO · línea base para comparar                              */
/* ===================================================================== */
function jugada_aleatorio(juego, estado) {
  reiniciarContador();
  const acciones = juego.acciones(estado);
  NODOS = acciones.length; // ha "mirado" sus jugadas legales, nada más
  const accion = acciones[Math.floor(Math.random() * acciones.length)] ?? null;
  return { accion, valor: 0 };
}

/* =====================================================================
   REGISTRO DE AGENTES
   ===================================================================== */
const AGENTES = {
  dfs:       { nombre: "DFS cooperativo",  fn: jugada_dfs },
  bfs:       { nombre: "BFS cooperativo",  fn: jugada_bfs },
  minimax:   { nombre: "Minimax",          fn: jugada_minimax },
  alfabeta:  { nombre: "Alfa-Beta",        fn: jugada_alfabeta },
  aleatorio: { nombre: "Aleatorio",        fn: jugada_aleatorio },
};

/* =====================================================================
   MÉTRICAS
   ---------------------------------------------------------------------
   medir() ejecuta una jugada y reporta: acción elegida, nodos visitados
   y tiempo en milisegundos.
   ===================================================================== */
function medir(juego, agente, estado, nombre, opciones = {}) {
  const inicio = performance.now();
  const salida = agente(juego, estado, opciones);
  const ms = performance.now() - inicio;
  const informe = {
    nombre,
    jugada: salida.accion,
    nodos: NODOS,
    ms,
    valor: salida.valor,
    podas: salida.podas ?? 0,
    planEncontrado: salida.planEncontrado,
    traza: salida.traza,
  };
  console.log(`[${nombre}] jugada=${informe.jugada} · nodos=${informe.nodos} · ${ms.toFixed(3)} ms`);
  return informe;
}

/* =====================================================================
   TORNEO
   ---------------------------------------------------------------------
   Juega n partidas con agente1 llevando a MAX (Spider-Man, mueve primero)
   y agente2 llevando a MIN (Duende). Devuelve el balance desde la óptica
   de agente1: victorias, derrotas y empates.

   NOTA: si los dos agentes son deterministas y el tablero no cambia, las n
   partidas serían idénticas. Por eso se puede pasar `fabricaJuego(i)` para
   generar una ciudad distinta en cada partida y que la media signifique algo.
   ===================================================================== */
function torneo(juego, agente1, agente2, n, opciones = {}) {
  const resultados = { victorias: 0, derrotas: 0, empates: 0, turnosMedios: 0, nodosMedios: 0 };
  let totalTurnos = 0;
  let totalNodos = 0;

  for (let partida = 0; partida < n; partida += 1) {
    const juegoActual = opciones.fabricaJuego ? opciones.fabricaJuego(partida) : juego;
    let estado = juegoActual.inicial();

    while (!juegoActual.terminal(estado)) {
      const agente = juegoActual.jugador(estado) === "MAX" ? agente1 : agente2;
      const salida = agente(juegoActual, estado, opciones);
      totalNodos += NODOS;
      if (salida.accion === null || salida.accion === undefined) break;
      estado = juegoActual.resultado(estado, salida.accion);
    }

    totalTurnos += estado.turnos;
    const ganador = ganadorDe(juegoActual, estado);
    if (ganador === "MAX") resultados.victorias += 1;
    else if (ganador === "MIN") resultados.derrotas += 1;
    else resultados.empates += 1;
  }

  resultados.turnosMedios = totalTurnos / n;
  resultados.nodosMedios = Math.round(totalNodos / n);
  return resultados;
}
