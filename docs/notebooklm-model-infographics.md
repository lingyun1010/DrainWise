# DrainWise model explainer: source and prompts for NotebookLM infographics

Upload this file as the only source. Then in Studio choose Infographic, paste one prompt below, generate, download the PNG.
Save the files as `web/public/infographics/model-1-inputs.png`, `model-2-checks.png`, `model-3-training.png`, `model-4-feedback.png`.

## Source (plain words, all sample data)

DrainWise is a prototype with SAMPLE DATA. No real council records are used yet.

### 1. What the risk model looks at

The model guesses how likely each gross pollutant trap (GPT, a net that catches leaves and rubbish) is to fill soon.
It looks at four things:

- Tree canopy near the GPT: more trees, more leaves.
- Rain: the last 7 days and the forecast.
- Leaf fall: how heavy the leaf season is.
- Days since the last clean.
  More of any of these never lowers the risk. Each GPT gets a risk level: High (60%+), Medium (30%+), Low, and the top reasons why.

### 2. How photos and people check it

1. The crew takes a BEFORE photo, cleans the GPT, then takes an AFTER photo.
2. A vision model suggests how blocked it was, from 0 (clear) to 3 (blocked).
3. A person confirms the level. Only confirmed labels count.
4. We compare the confirmed level with the risk the model gave before the visit.
5. Confirmed BEFORE photos become training examples. AFTER photos are proof of work.
   Status: only 7 sample photos exist, so no accuracy is claimed.

### 3. From sample data to a real model

1. Simulate: make 20,000 sample GPTs with an assumed rule (built).
2. Train: a simple model learns the rule (built).
3. Check: shows the pipeline works, not real accuracy (built).
4. Serve: the app asks the model for scores (built).
5. Real records: council history replaces the sample data (planned).

### 4. Learning from feedback

A scheduler (the person who plans truck runs) can edit the plan DrainWise proposes, and gives a short reason.

1. DrainWise proposes a truck run.
2. The scheduler edits it (for example moves a creek-side GPT first) and gives a reason.
3. DrainWise records every edit and reason.
4. A language model (Claude) looks for a pattern that repeats in at least 3 edits and proposes a rule, for example "put creek-side GPTs first".
5. The admin approves, edits or rejects the rule. Nothing applies without approval.
6. Approved rules become soft weights in the next plan, and each adjusted stop says which rule changed it.
   The risk model's own weights never change. What learns is the rules table.
   Status: the demo uses a SIMULATED scheduler with made-up preferences, not a real council officer.

## Prompts (paste one per infographic)

Common style: simple, friendly, very little text, large icons, no more than 6 short labels, flat style, dark navy background with white text, Orange for High, yellow for Medium, blue for Low, English only, no logos, add the small footer "Sample data".

1. Prompt: Infographic "What the model looks at". Show a GPT net in the middle with four arrows coming in: trees, rain cloud, falling leaf, calendar with days since clean. On the right, three risk faces: High, Medium, Low. Labels of 1 to 3 words only.
2. Prompt: Infographic "How we check it". A left-to-right row of 5 icons: phone BEFORE photo, AI suggests 0 to 3, person confirms, compare with the model, becomes training data. One short label under each, no paragraphs.
3. Prompt: Infographic "From sample to real". A staircase of 5 steps: Simulate, Train, Check, Serve (all marked Built) and Real council records (marked Planned, dashed outline). One short label per step.
4. Prompt: Infographic "Learning from feedback". A circular loop of 6 icons going clockwise: clipboard with a proposed run, pencil edit with a reason bubble, notebook that records edits, AI spark finds a pattern (3+ edits), person approves with a tick (a lock labelled "Nothing applies without approval"), next plan with a small tag "Rule applied". One short label per icon. In the centre write "Rules learn, the risk model does not change". Add the small footer "Sample data, simulated scheduler".
