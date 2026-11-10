# Questions for council experts, Mon 9 Nov

Asset for ticket 01. Ask in this order; if time runs out, drop from the bottom. Do not show the demo; questions only.

Fallback for every "we don't have / can't share" answer: ask for the smallest usable thing instead, in this order: (a) an anonymised sample (even 10-20 points, location blurred to suburb level), (b) the field names / schema without the data, (c) one typical number. Only if none of these is possible do we use simulated data, labelled "sample data".

1. **Asset locations** - Can we get drain pit / inlet and GPT locations, even a sample or anonymised?
2. **Cleaning / blockage history (model training data)** - Is there any history, and in what format (system, fields, how far back)? Dig into:
   - How is a "blockage" recorded, and is there a severity scale we can map to our 0-3 levels?
   - Fields per record: asset id, date/time, event type (blockage / cleaning / inspection), who reported it.
   - How often is each asset inspected? (Assets never inspected have no label, which biases training.)
   - If there are no blockage records: are complaints, localised ponding reports or work orders usable as a proxy?
3. **GPT meaning** - Confirm "GPT" means Gross Pollutant Trap (our current assumption).
4. **Truck and bin volumes** - Truck and bin sizes, typical load per inlet and per GPT, cost per clean, crews per day.
5. **GPTs and cameras** - How many GPTs and cameras are there, and how are cameras monitored today?
6. **Existing systems** - Is there a work-order or inspection system we should integrate with, and what are the rules for photo evidence?
7. **Judges** - Do judges prefer depth (one well-grounded model) or breadth?

8. **Historical photos (vision model)** - Are there historical photos of drains / GPTs (before or after cleaning), may we use them for training, and what restrictions apply (faces, number plates, retention)? We currently have only 7 unlabelled sample images.

Also say once, up front: everything in our prototype is sample data and the risk model is trained on simulated data until real records exist.

## Answers from 9 Nov (owner's notes)

Answered: GPT = Gross Pollutant Trap (net and bars; we do net). About 8 to 10 cameras, one image per day, images and GPT locations accessible. Non-camera GPTs cleaned about every 3 months; after storms, 1 day or 1 week matters. Truck size, cost per clean and weight per clean: unknown to council. Work goes to a contractor who schedules it. Clean at about 70 to 80% full. Synthetic images acceptable. Details are in `map.md`, section "Council session 9 Nov 2026".

## Still to ask on Fri 13 Nov

1. Can we get a few dozen real camera images (a clean one per camera if possible) for testing? Licence and privacy limits (faces, number plates, retention)?
2. Does "about 30 GPTs extra" mean about 30 GPTs without cameras, or 30 more than the 8 to 10? Total GPT count?
3. Is any cleaning or blockage history available, and in what format?
4. Who is the contractor, what form does a work order take, and can the contractor tell us truck size and typical load?
5. Does the 70 to 80% rule hold for every GPT type? How is "how full" judged today?
6. What does "arrow pointing, hole" labelling mean, and who can label?
7. Which completion period does council set for a storm job (for example within 7 days)?
8. Are drain inlets still of interest at all (we have dropped them)?
