"use strict";
/* =====================================================================
   EL ASEDIO DE OSCORP · MODELO FORMAL DEL JUEGO
   ---------------------------------------------------------------------
   Juego adversarial de suma cero, por turnos, información perfecta.

     MAX = Spider-Man. Gana si aterriza en el mismo anclaje que el Duende.
     MIN = Duende Verde. Gana si llega al anclaje de Mary Jane sin ser atrapado.

   Las 6 funciones del modelo son PURAS: no mutan el estado que reciben.
   `resultado()` siempre devuelve un objeto nuevo, así los algoritmos de
   búsqueda pueden explorar el árbol sin deshacer jugadas.

   Un ESTADO es: { max, min, turno, turnos }
     max    · índice del anclaje donde está Spider-Man
     min    · índice del anclaje donde está el Duende
     turno  · 'MAX' | 'MIN', a quién le toca mover
     turnos · plies jugados, para cortar por límite
   ===================================================================== */

const LIMITE_TURNOS_POR_DEFECTO = 40;

function JuegoAsedio(tablero, opciones = {}) {
  const limiteTurnos = opciones.limiteTurnos ?? LIMITE_TURNOS_POR_DEFECTO;
  const { nodes, adjacency } = tablero;
  const meta = tablero.target;

  // ---- 1. inicial() · estado de partida ----
  function inicial() {
    return Object.freeze({ max: tablero.spidey, min: tablero.goblin, turno: "MAX", turnos: 0 });
  }

  // ---- 2. jugador(estado) · a quién le toca ----
  function jugador(estado) {
    return estado.turno;
  }

  // ---- 3. acciones(estado) · anclajes vecinos legales ----
  // Devuelve los nodos a los que puede saltar SOLO el jugador de turno.
  function acciones(estado) {
    if (terminal(estado)) return [];
    const origen = estado.turno === "MAX" ? estado.max : estado.min;
    return adjacency[origen].map((arista) => arista.to);
  }

  // ---- 4. resultado(estado, accion) · nuevo estado, sin mutar el anterior ----
  function resultado(estado, accion) {
    return Object.freeze({
      max: estado.turno === "MAX" ? accion : estado.max,
      min: estado.turno === "MIN" ? accion : estado.min,
      turno: estado.turno === "MAX" ? "MIN" : "MAX",
      turnos: estado.turnos + 1,
    });
  }

  // ---- 5. terminal(estado) · ¿se acabó la partida? ----
  function terminal(estado) {
    return estado.max === estado.min || estado.min === meta || estado.turnos >= limiteTurnos;
  }

  // ---- 6. utilidad(estado) · valor del estado terminal para MAX ----
  // +1 gana MAX · −1 gana MIN · 0 empate por límite de turnos.
  function utilidad(estado) {
    if (estado.max === estado.min) return 1;   // Spider-Man atrapó al Duende
    if (estado.min === meta) return -1;        // el Duende alcanzó a Mary Jane
    return 0;                                  // se agotaron los turnos
  }

  /* ---- Heurística para los cortes por profundidad ----
     Fórmula pedida:  Eval = Distancia(MIN, MJ) − Distancia(MAX, MIN)
     MAX quiere el valor alto: eso significa Duende lejos de MJ y Spidey encima de él.

     OJO (detalle importante del modelo): utilidad() vale como mucho ±1, pero esa
     resta de distancias puede valer 20 o más. Si la devolviéramos en crudo, el
     algoritmo preferiría una posición "bonita" (valor 9) antes que ganar de verdad
     (valor 1). Por eso la comprimimos con tanh al rango (−0.9, 0.9): conserva
     exactamente el mismo ORDEN de preferencia entre posiciones, pero garantiza
     que ninguna estimación supere nunca a una victoria real. */
  function heuristicaCruda(estado) {
    const dMinMeta = distance(nodes[estado.min], nodes[meta]) / UNIT;
    const dMaxMin = distance(nodes[estado.max], nodes[estado.min]) / UNIT;
    return dMinMeta - dMaxMin;
  }

  function heuristica(estado) {
    return 0.9 * Math.tanh(heuristicaCruda(estado) / 6);
  }

  // Valor de referencia del estado: utilidad si es terminal, heurística si no.
  function valor(estado) {
    return terminal(estado) ? utilidad(estado) : heuristica(estado);
  }

  return {
    inicial, jugador, acciones, resultado, terminal, utilidad,
    heuristica, heuristicaCruda, valor,
    tablero, meta, nodes, adjacency, limiteTurnos,
  };
}

// Nombre legible del ganador de una partida ya terminada.
function ganadorDe(juego, estado) {
  const u = juego.utilidad(estado);
  return u === 1 ? "MAX" : u === -1 ? "MIN" : "EMPATE";
}
