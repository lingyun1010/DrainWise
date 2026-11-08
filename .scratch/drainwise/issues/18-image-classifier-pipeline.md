# 18: Image classifier pipeline (prototype, trained on sample labels)

Type: task
Status: needs-info
Blocked by: owner decisions below; real labelled photos from the council (9 and 13 Nov) for anything beyond a prototype
Spec: `.scratch/drainwise/spec.md` (tickets 04, 08, 13 and 16); `CLAUDE.md` section 8

Lower priority than 17. Cut first if time is short.

## Why

DrainWise should have two models: an image model (photo to blockage level 0-3) and the existing risk model (will this drain block in the next N days). Today the image step is a hosted vision model that only suggests a level; a person confirms it. The owner wants our own image model in the story. This ticket builds the **pipeline** for that, honestly labelled.

## The hard limit (say it in the README and the UI)

Only 7 council photos exist and they are unlabelled. A model trained and tested on 7 images has no meaningful accuracy, and nothing here may be presented as accuracy. This ticket demonstrates the steps (photo, label, train, predict). It does not produce a model worth trusting. Real value needs labelled photos from the council or from crews over time.

## What to build

1. A script `python -m ml.image_train` that:
   - reads human-confirmed labels (level 0-3) for photos (from the `job_photos` table through the server, or from a local export of `/review` labels),
   - turns each image into a feature vector with a **pretrained open-source vision model** used as a frozen feature extractor (for example CLIP image embeddings),
   - trains a small scikit-learn classifier on those vectors (logistic regression first),
   - writes `ml/image_model.joblib` plus a small metadata JSON: data source, number of images per level, date, model version, and the words "prototype, sample labels, no accuracy claim".
2. A prediction function or `risk-api` route `POST /classify` (in: image, out: `{level, confidence, rationale}`), same output shape as the hosted vision suggestion so `/review` and the camera popup (17) can use either.
3. `/review` can show "own model" next to the hosted suggestion for comparison, local only.
4. Evaluation: leave-one-out on the confirmed labels, printed by the script, labelled "pipeline check only". Not shown to judges as accuracy.

## Decisions needed from the owner

- Which pretrained feature extractor? Recommended: CLIP via `open_clip` or `transformers`, CPU only. Check its licence and the size of the download before adding it. Alternative: a small torchvision ResNet.
- Does the project accept a Python dependency of several hundred MB (torch)? If not, the prototype can call the extractor in a separate throwaway venv and commit only the small classifier file.
- Who labels? The owner confirms levels on `/review`. At least about 10 images per level are needed for a model that is more than a toy; with 7 images, the script can only show that it runs.
- Should the image level feed the risk model as `current_blockage_level` for camera sites? Recommended: later, only after real labelled data exists. Changing `/predict` is an API contract change.

## Acceptance criteria

- [ ] `python -m ml.image_train` runs end to end on whatever confirmed labels exist, refuses to train with fewer than 2 classes or fewer than 2 images per class, and says why.
- [ ] Fixed random seed; the metadata JSON records data source, counts per level, date and model version.
- [ ] Output of the classifier has the same shape as the hosted suggestion and passes the same `parseSuggestion` checks.
- [ ] Everything user-facing says "prototype", "sample labels", "no accuracy claim". README states it too.
- [ ] No raw photos, no large model files and no keys are committed. The classifier file is small (check its size before committing).
- [ ] Face and number-plate gate: images with `privacy_checked = false` are not used for training. Until that check exists, the script trains only on the 7 council sample photos, and the metadata says the gate is not built.
- [ ] pytest covers the label loading and the refusal cases without needing the big model (use a stub extractor).

## Not in scope

- Claiming accuracy, or comparing against the hosted model as a benchmark.
- Training on public-demo uploads.
- Fine-tuning the vision backbone.
- Building the face and number-plate detector (separate ticket).
