# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS, and JavaScript, as required by the assignment.

## Users

University students presenting an intelligent-agents assignment and a professor evaluating whether every team member can explain DFS, BFS, A*, PEAS, frontier structures, cost, and heuristic.

## Product Purpose

An interactive Spider-Man rescue game that runs DFS, BFS, and A* on the same search problem, exposes their behavior, and produces comparable evidence across five scenarios.

## Positioning

The search frontier is part of the playfield: students can see explored rooftops, the active node, the final route, and the data structure changing while the algorithm runs.

## Operating Context

The project must open in a browser without installation, support a five-minute classroom presentation, and supply measurements for the three-page report.

## Capabilities and Constraints

- Select and run DFS, BFS, or A*.
- Play the same missions manually with keyboard or touch controls.
- Use five fixed, reproducible scenarios.
- Measure expanded nodes, real solution cost, and search execution time.
- Use a weighted terrain so BFS can visibly lose optimality.
- Explain the search model and PEAS in Spanish.
- Do not fabricate measurements; calculate them in the browser.

## Brand Commitments

Spider-Man classroom theme, comic-book visual language, and the supplied Pac-Man simulator screenshot as a functional reference. No external character artwork is required.

## Evidence on Hand

The course PDF specifies DFS with a LIFO stack, BFS with a FIFO queue, A* with a priority queue ordered by f = g + h, and a five-scenario comparison.

## Product Principles

- Make every algorithm observable and explainable.
- Keep identical maps, costs, and neighbor order for fair comparisons.
- Separate search computation time from animation time.
- Prefer a compact game that can be defended with data.

## Accessibility & Inclusion

Keyboard-operable controls, visible focus, reduced-motion support, high contrast, and a readable mobile layout.
