# Spider-Man Search Lab

Juego educativo estático para comparar DFS, BFS y A* en cinco escenarios reproducibles, con un modo manual jugable mediante teclado o controles táctiles.

## Ejecutar

Abre `index.html` directamente o inicia un servidor local:

```bash
python3 -m http.server 4173 --directory spiderman-search-lab
```

Luego visita `http://localhost:4173`.

## Modelo de búsqueda

| Elemento | Definición |
| --- | --- |
| Estado | Posición `(fila, columna)` de Spider-Man |
| Acciones | Arriba, derecha, abajo e izquierda |
| Costo | Azotea normal: 1; escombros: 4 |
| Heurística | Distancia Manhattan multiplicada por el costo mínimo 1 |

DFS usa una pila LIFO, BFS una cola FIFO y A* una cola de prioridad ordenada por `f = g + h`.

## Medición

El botón **Correr los 3 en 5 escenarios** calcula los promedios solicitados por la actividad. El cronómetro mide únicamente la búsqueda y excluye la animación y el renderizado.
