# 03 Truck planner algorithm: research findings

Ticket: `issues/03-truck-planner-algorithm.md`. Researched 2026-11-08. This note is recommendation-neutral; the decision is made afterwards.

Legend: **[S]** = stated by the cited source. **[A]** = my analysis/inference, not from a source (check before relying on it).

## Sources used

- OR-Tools, Capacity constraints (CVRP): https://developers.google.com/optimization/routing/cvrp
- OR-Tools, Penalties and dropping visits: https://developers.google.com/optimization/routing/penalties
- OR-Tools, Routing options: https://developers.google.com/optimization/routing/routing_options
- OR-Tools, Knapsack problem: https://developers.google.com/optimization/pack/knapsack
- Vansteenwegen, Souffriau, Van Oudheusden (2011), "The orienteering problem: a survey", EJOR 209(1):1-10 (abstract only read, via https://econpapers.repec.org/RePEc:eee:ejores:v:209:y:2011:i:1:p:1-10 search hit).
- Shen et al. (2025), "A survey of the orienteering problem: model evolution, algorithmic advances, and future directions", https://arxiv.org/abs/2512.16865 (first ~100k of 179k chars of the HTML read).

## What the sources establish

1. **Capacity in OR-Tools [S]:** model load with a demand callback (`RegisterUnaryTransitCallback`) plus `AddDimensionWithVehicleCapacity(callback, slack=0, capacities per vehicle, start_cumul_to_zero=true, "Capacity")`. Several vehicles can have different capacities.
2. **Dropping stops [S]:** `AddDisjunction([node], penalty)` makes a node optional; the solver minimises distance plus penalties of dropped nodes. The docs' own capacity example (4 vehicles, capacity 15) drops two nodes at penalty 1000 each. Docs warn that if total demand exceeds capacity the solver may run very long, so set a time limit or use penalties. They note that fitting items into vehicles is a version of the multiple knapsack problem.
3. **Search is heuristic [S, partly implied]:** first-solution strategies (`PATH_CHEAPEST_ARC`, `SAVINGS`, `PARALLEL_CHEAPEST_INSERTION`, ...) and local-search metaheuristics (`GUIDED_LOCAL_SEARCH`, `SIMULATED_ANNEALING`, `TABU_SEARCH`, ...); `GUIDED_LOCAL_SEARCH` is described as generally most efficient for routing. Default `time_limit` is effectively unlimited, so a limit must be set. The page does not explicitly say "no optimality guarantee"; it only says status "solution found, local optimum not reached" can occur.
4. **Knapsack [S]:** OR-Tools `KnapsackSolver` with `KNAPSACK_MULTIDIMENSION_BRANCH_AND_BOUND_SOLVER` finds the best-value subset under a capacity; integers only (scale decimals). Docs example: 50 items solved to optimal.
5. **Orienteering [S]:** the orienteering problem (OP) chooses a path through a subset of locations to maximise collected reward under a budget; the Team OP (TOP) does this for several routes. A 2025 survey describes OP as a "prize-collecting TSP with a knapsack-type budget". It reports exact branch-and-cut on thousands of nodes for the plain OP, but a compact TOP model limited to under about 100 nodes, and heuristics (ALNS/LNS) scaling to 1000+ nodes. It does not state in the portion read that the OP is NP-hard (usual citation is Golden, Levy, Vohra 1987; not verified here).
6. **Not found in primary sources:** any direct comparison of a risk-first greedy with CVRP/OP solvers on 36-200 nodes, or any council-audience explainability evidence. Items below on explainability, effort and quality at 36-200 assets are [A].

## Problem mapping [A]

DrainWise's task is closest to an orienteering / prize-collecting routing problem: each asset has a reward (blockage risk), a demand (m³ of debris load), the truck has a capacity (1-4 m³) and travel distance is a cost. Demo greedy ignores route shape when choosing stops; knapsack ignores travel; OR-Tools can optimise both (reward via disjunction penalty, capacity via dimension). One truck, one trip (or a few trips, if multiple runs per day) means vehicles = 1 or small.

## Comparison

| Criterion | Demo greedy (risk first, nearby first, never over capacity) | Knapsack + nearest-neighbour | OR-Tools routing (capacitated, optional nodes via disjunction penalties) |
|---|---|---|---|
| What it optimises | Nothing global; picks by rule | Max total risk under capacity [S: knapsack objective], then orders chosen stops by travel | Distance plus dropped-stop penalties under capacity [S] |
| Explainability to council [A] | Highest: one sentence rule | High: two steps ("pick best risk per m³ that fits, then order by proximity") | Lowest: black-box local search; explain via penalty = risk and compare with greedy plan |
| Effort in about 1 day [A] | Already in demo; trivial port | Small: knapsack (own DP or `KnapsackSolver`) plus nearest-neighbour loop | Moderate: Python-only dependency `ortools`, distance matrix, integer scaling of m³ and risk, tuning penalties and time limit; fits a FastAPI service |
| Quality at 36-200 assets [A] | Can pick a risky far stop that wastes route, or fill capacity poorly | Better stop set than greedy; route order is a heuristic | Best expected route and stop trade-off; heuristic not proven optimal [S]; 36-200 nodes is small for OR-Tools [A, see survey scale evidence above] |
| Capacity handling | Hard check per stop | Exact for subset choice [S: branch and bound] | Hard via capacity dimension [S] |
| Trade-off between risk and distance | Implicit via ordering rule | Not within selection (travel only in ordering) | Explicit via penalty weight vs distance [S mechanism] |
| "Why this stop" display [A] | Rank number, risk reasons, and "next nearest that fits" | Risk-per-m³ ratio, "selected to maximise total risk cleaned within 2.0 m³" | Penalty (risk) vs detour cost per stop; "cost of skipping" = penalty; extra computation to compute alternatives |
| Determinism / reproducibility | Fully deterministic | Deterministic | Depends on time limit and strategy; set seeds/limits [A] |
| Failure modes | Over-eager to take near low-risk jobs | Tour may be ugly if selected stops are scattered | Bad penalty scale drops important stops or ignores distance; infeasible demand may run long without time limit [S] |

## Open points to resolve in the decision (not decided here)

- Is the goal one truck-run per day, or several runs/vehicles? (changes vehicle count in OR-Tools).
- Should risk be a hard priority (always take High first) or traded off against distance?
- Is distance Euclidean on mock data or road network (needs a matrix source)? Not researched.
- Whether a "plan vs greedy baseline" comparison panel is wanted to justify extra complexity.
