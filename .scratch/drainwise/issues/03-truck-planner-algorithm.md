# 03 Truck planner algorithm

Type: research
Status: resolved (2026-11-08)
Blocked by: none

## Question

What planner should the MVP use for "clean the riskiest nearby assets without exceeding truck capacity"? Compare the demo's greedy heuristic, knapsack + nearest-neighbour, and OR-Tools routing (capacitated VRP / orienteering style) on: explainability to a council audience, implementation effort in ~1 day, quality of results at ~36-200 assets, and how the "why this stop" reason can be shown. Findings go to `research/03-truck-planner.md`; the decision itself is made afterwards.

## Decision (2026-11-08)

Knapsack + nearest-neighbour, behind the existing `planRun(assets, capacity)` seam.
1. Select the stop set that maximises total risk within truck capacity (exact DP/branch and bound; scale m3 to integers).
2. Order the chosen stops by nearest-neighbour from the depot.
Risk is the priority; distance is used only for ordering (no risk-vs-distance penalty weight, which would need real data to calibrate). Not OR-Tools: hard to explain to council and adds a Python dependency.
Revisit if experts say multiple trucks/runs per day, or road-network distances are needed.
Implementation: TDD in `planner/` (set choice first, then ordering). The current risk-sorted greedy is a stand-in.
