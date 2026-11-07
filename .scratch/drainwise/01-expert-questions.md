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
