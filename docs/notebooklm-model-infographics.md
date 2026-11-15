# DrainWise model explainer: source and prompts for NotebookLM infographics

Upload this file as the only source. Then in Studio choose Infographic, paste one prompt below, generate, download the PNG.
Save the files as `web/public/infographics/model-1-inputs.png`, `model-2-checks.png`, `model-3-training.png`.

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

## Prompts (paste one per infographic)

Common style: simple, friendly, very little text, large icons, no more than 6 short labels, flat style, dark navy background with white text, Orange for High, yellow for Medium, blue for Low, English only, no logos, add the small footer "Sample data".

1. Prompt: Infographic "What the model looks at". Show a GPT net in the middle with four arrows coming in: trees, rain cloud, falling leaf, calendar with days since clean. On the right, three risk faces: High, Medium, Low. Labels of 1 to 3 words only.
2. Prompt: Infographic "How we check it". A left-to-right row of 5 icons: phone BEFORE photo, AI suggests 0 to 3, person confirms, compare with the model, becomes training data. One short label under each, no paragraphs.
3. Prompt: Infographic "From sample to real". A staircase of 5 steps: Simulate, Train, Check, Serve (all marked Built) and Real council records (marked Planned, dashed outline). One short label per step.
