# DrainWise AI OS — design (draft v2, 10 Nov 2026)

> Source: written in the claude.ai chat Project, pasted here on 11 Nov 2026 so Claude Code can read it. The chat copy is not synced automatically; update both if it changes.

Goal: grow DrainWise from "predict + plan" into a small AI OS that **learns from operational feedback**. Be precise in the pitch: the OpenAI model's weights never change. What learns is (a) our own risk model, retrained on new labelled data, and (b) the agent's memory, lessons, preferences and example library. Data is **mock/simulated and labelled as such** (decision 10 Nov: use mock data).

## 1. Modules (what the OS can do)

| Module              | Function in DrainWise                                                                                                                         | Hackathon MVP?            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Ingest              | Weather (BoM), canopy per asset, season/leaf-fall, crew photos and notes, camera checks                                                       | Yes (simulated + canopy)  |
| Chatbot (Assistant) | Natural-language ops: "what to clean this week", what-if, "why is this ranked 3rd", "what did you learn from my edits"                        | Yes (3-5 tools)           |
| Risk service        | FastAPI + scikit-learn: P(block in next N days) + top reasons                                                                                 | Yes                       |
| Planner             | Truck run: risk first, nearby first, capacity-safe (greedy, then OR-Tools)                                                                    | Yes                       |
| Scheduler learning  | Records the council scheduler's edits to proposed plans; learns preferences (section 6)                                                       | Yes (simulated scheduler) |
| Image labelling     | Vision LLM proposes blocked level 0-3; council confirms/corrects; confirmed examples feed an example library (section 7)                      | Yes, few-shot version     |
| Memory              | Episodic (jobs, outcomes, plan edits), semantic (asset facts, guidelines via RAG), procedural (playbooks), preferences, image example library | Yes                       |
| Evaluation          | Compare predictions, plans and image labels with actual outcomes; track metrics over time                                                     | Yes                       |
| Reflection          | LLM analyses misses and plan edits, proposes lessons / rules with evidence                                                                    | Yes                       |
| Governance          | Human approval, versioned lessons/models, rollback, audit log                                                                                 | Minimal (approve/reject)  |
| Observability       | Tracing of every agent run, tool call, and decision                                                                                           | Yes (log table)           |
| Reporting           | Weekly summary, compliance pack for council                                                                                                   | Stretch                   |

## 2. Data: what feeds training, evaluation, reflection

Core outcome record (one row per visit), written when a crew closes a job:
`asset_id, ts, predicted_risk (at planning time), features snapshot, observed_blocked_level (0-3), load_m3_actual, source (photo|camera|inspection), photo_before_url, photo_after_url, crew_note, run_id`.

### Training data (for the risk model)

- Features: canopy cover near asset, leaf-fall season, rainfall since last clean, days since last clean, catchment/asset type (inlet vs GPT), camera presence.
- Labels: `observed_blocked_level` from visits; later, confirmed before-photo labels.
- Now: simulated history from the simulator (section 5). Later: council records if provided (brief, open question 3).
- Rule: the model card and UI must say "trained on simulated data".

### Evaluation data (did it work?)

- Prediction quality: precision@N (of the top-N ranked, how many were actually blocked at level >= 2), recall of blocked assets, calibration, false-alarm rate (wasted stops).
- Planning quality: planned vs actual load (m3), capacity overruns, stops completed per run, blocked assets missed.
- Scheduler learning: plan acceptance rate (proposed plan used unchanged), number of edits per plan (swaps/additions/removals), both tracked per simulated week.
- Image labelling: agreement with council labels on a held-out set, confusion matrix, especially "blocked judged as clear" (miss rate).
- Ground truth sources: crew-confirmed levels, camera checks, before/after photo pairs, council label corrections.
- Agent quality: recommendation vs what the crew found; tool-call success; groundedness (every claim traceable to a tool result).
- Use a fixed held-out backtest set so a change is accepted only if the metric improves.

### Reflection data (why was it wrong?)

- Disagreements: predicted High but found clean; predicted Low but found blocked; load estimate far off; scheduler edits to the proposed plan; image label corrected by council.
- Context attached to each case: feature snapshot, weather since last visit, crew/scheduler free-text note, photo label.
- Output: a **lesson** = {statement, supporting case ids, count, status: proposed|approved|rejected, created_at}. Example: "GPTs near the creek fill faster after >20 mm rain than the model predicts."
- Promotion rule: a lesson is applied only after >= k supporting cases AND improves the backtest (where testable) AND a human approves.

## 3. The learning loop

```
Plan (risk + lessons + preferences + playbooks)
  -> Scheduler edits the plan / Crew visits and records outcome / Council corrects image labels
  -> Evaluate (metrics vs outcomes and vs final plan)
  -> Reflect (LLM drafts lessons and preference rules)
  -> Validate (backtest + human approve)
  -> Store (lessons / preferences / example library / retrain trigger, versioned)
  -> next Plan uses them
```

Kinds of learning, in increasing risk:

1. Memory, lessons, preferences and image examples injected into the agent's context (safe, reversible).
2. Planning-rule and factor-weight adjustments (versioned, backtested).
3. Retraining the risk model or an image model on new labels (system-triggered, human-approved, model versioned).

## 4. Chatbot

Tools (function calling over existing FastAPI endpoints):

- `get_risk_scores(date_range, filters)`
- `get_asset_history(asset_id)`
- `plan_run(capacity_m3, constraints)`
- `get_preferences()` / `get_lessons()`
- `get_plan_edit_summary(period)` (what the scheduler changed and what was learned)
- `classify_photo(photo_url)` (image labelling, section 7)

Example questions: "What should we clean first this week and why?", "What if next week has heavy rain?", "Why is asset 12 third?", "What did you learn from my edits last week?" Every answer must cite tool results and name any preference rule used. Replies in the user's language; stored data and UI copy in English.

## 5. Simulator (makes learning demonstrable and measurable)

A small "digital twin" generating, per simulated week:

- leaf fall, rain and true blockages from a hidden process that includes a factor the initial model does not know (e.g. creek-adjacent GPTs fill faster after storms);
- a **simulated scheduler persona** with hidden preferences (e.g. schools first, no far runs on Fridays, GPTs first after heavy rain) who edits each proposed plan accordingly;
- synthetic image labels (see section 7) where needed.

Success = the system's lessons/preferences recover the hidden factors, acceptance rate rises and edits per plan fall over simulated weeks. Because the truth is known, results are verifiable. Label all of it "simulation" in the UI and README. It is not real council behaviour.

## 6. Learning from the scheduler (learning from demonstration)

Record per plan: proposed plan, final plan (adds, removals, reordering, swaps), optional one-line reason, context (weather, date, truck capacity).

What can be learned:

- Preference rules (e.g. "sites near schools go first"), stored as editable rules, each with supporting cases.
- Factor trade-offs (risk vs distance vs capacity); with enough data, a light ranking model.
- Communication style (short vs detailed answers).

Controls: the scheduler sees each proposed rule with its evidence and approves, edits or rejects it; any rule can be switched off; rules are versioned. Rules are applied as constraints/soft weights in the planner and as context for the chatbot. Do not infer preferences silently.

## 7. Image recognition (council marks photos)

The OS does not learn vision by itself; a vision model does the recognising, and the OS manages data, evaluation and approval.

Stage 1 (hackathon): vision LLM + example library.

- Vision LLM proposes blocked level 0-3 with a short reason for each before photo.
- Council confirms or corrects (one tap). Confirmed/corrected examples go to the example library.
- At classification time, retrieve the most similar annotated examples and include them in the prompt (few-shot). Learning here is in the library, not in model weights.
- Evaluate on a held-out set: agreement with council, confusion matrix, miss rate for blocked-as-clear.

Stage 2 (roadmap): separate image model.

- Fine-tune a small pretrained classifier (or detector if boxes are annotated) on council-labelled images once there are enough per class and the classes are reasonably balanced.
- OS responsibilities: labelling queue, dataset versioning, held-out test set, retrain trigger, human approval, model versioning and rollback. A new model goes live only if it beats the current one on the held-out set.

Annotation options: level 0-3 per photo (cheap, recommended); boxes/polygons on debris (richer, costly; roadmap only).

Mock-data rules: use a small set of clearly labelled sample images ("sample images, not council data"); report no accuracy figures from a tiny non-representative set; check real photos for faces and number plates before any training use.

## 8. Suggested tables (Supabase)

`outcomes`, `plans` (proposed_json, final_json, reason, context), `plan_edits`, `lessons`, `preferences` (rule, evidence_ids, status, version, enabled), `image_examples` (photo_url, label, source: llm|council, embedding), `model_versions` (type, metrics, data window, status), `eval_runs` (metric, run_id, version), `agent_traces` (run id, tool calls, inputs/outputs, latency).

## 9. Scope for the 18-20 Nov submission

Must: seeded assets + ranked queue, risk service on simulated data, truck planner, crew photo flow with LLM label + council confirm, `outcomes` and `plans` logging, simulated scheduler, eval view (precision@N, acceptance rate over simulated weeks), chatbot with tools above, reflection producing lessons/preferences with approve/reject.

Cut if short on time: image model fine-tuning (roadmap), multi-agent, weather forecast tool, automatic retraining (show a manual "retrain" button and a model-version list), reporting.

## 10. Honesty rules for pitch and UI

- Never present the demo formula or simulated results as a trained model on real data.
- The simulated scheduler is not a real council officer; say so wherever its results appear.
- Say "the system learns from feedback via memory, preference rules, an example library and retraining"; do not say "the AI evolves itself".
- Check photos for faces and number plates before any training use.
- Do not claim council facts or statistics that are not sourced.

## 11. Open points

- Confirm with council whether any real cleaning/blockage history, scheduling records or labelled photos exist; real data would replace the simulator.
- Whether a real council scheduler can test the plan-edit loop before submission.
- Decide k (minimum supporting cases) and the backtest acceptance threshold.
