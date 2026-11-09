# EmbeReady setup and saved content

## Assessment lifecycle

Website startup loads saved assessments. It does not evaluate the mock database through Gemini. `server/install-saved-assessments.js` installs prepared mock results only for explicitly listed existing references and restores successful historical Gemini results. Existing successful Gemini results take precedence over any prepared demo fixture.

The current dataset includes 35 prepared mock assessments and the preserved original Gemini assessment for `ER-20261107-BE6BDA` (40/100, Moderate). The newer community report remains on the real-Gemini path. The original historical Gemini row, factor values, reasoning, confidence and matching precautions are preserved; it is displayed with its original model and earlier rubric.

Newly submitted non-live community reports are saved immediately and queued for actual Gemini assessment. Live fire bypasses Gemini. Loading or refreshing the map does not retry failed reports automatically. The Retry control and `npm run reassess` explicitly retry failed community reports; they do not spend quota regenerating prepared demos or successful saved results.

## Gemini configuration

Keep the existing `.env` and configure `GEMINI_API_KEY`, `GEMINI_MODEL` and optional `GEMINI_TIMEOUT_MS` (120 seconds by default). Restart your manually run server after changing these values or server code. The key remains server-side and must not be committed.

Gemini 3 models use the stateless Interactions API with revision 2026-05-20, low thinking level and schema-constrained JSON. Deprecated sampling parameters are omitted. `GEMINI_API_MODE=generate_content` supports older integrations explicitly. Returned provider statuses are preserved, and a shared authentication, quota or connectivity failure stops queued requests rather than repeatedly consuming quota.

## Prepared mock records

`server/data/demo-assessments.json` contains complete authored mock outputs, observation profiles and limited content corrections keyed by existing reference codes. It stores explicit factor scores and scenario-specific precautions, not a runtime rule engine. No Gemini request is made to prepare or load those records.

Prepared results are labelled Demo assessment/Demo guidance in the same layout used for real Gemini results. New community reports never receive these fixtures based on their category. Mock references are explicitly enumerated so future reports cannot silently inherit fabricated assessments.

The installer is idempotent. Unchanged fixtures reuse the existing saved run. It can update descriptions, titles, category and mock severity where explicitly authored, but never changes coordinates, IDs, reference codes, barangay, addresses, photo paths or incident status. Historical rule-based rows remain archived rather than being relabelled as Gemini output.

`hazard_observations` stores input records; `assessment_runs` stores immutable paired assessments and precautions; `assessment_jobs` points to the active saved result. A server restart marks unfinished community requests as needing an explicit retry instead of leaving stale progress indicators.

## Scoring and evidence

The `evidence-v2` prototype allocates 100 points: ignition 20, fuel 15, exposure 15, spread 10, exits 10, responder access 10, history 5, environment 5, practices 5, safeguards 5. Low is 0-39, Moderate 40-64, High 65-100. This is a prioritisation index, not a fire probability or official BFP classification. The preserved historical Gemini result retains its original eight-factor rubric.

New Gemini assessments must cite supplied evidence IDs. Unknown factors remain null. Their contribution bounds produce a range rather than an invented precise total. A band is shown only when both bounds fit that band. Confidence and action urgency remain separate. Results with invalid references, arithmetic or classifications are rejected; a correction request can repair invalid output using the original evidence. Assessment and matching precautions publish together.

Mock history and synthetic environmental conditions are identified as fictional. Genuine community reports use reported observations and eligible non-demo history. Actual uploaded files are included as image evidence only when they exist; placeholder filenames never become photographs.

## Photos, contacts and interface

Empty photo slots remain empty; no hazard photos are generated or populated. Existing photo paths are preserved.

Configure verified contacts in `server/contacts.json`, then run `node server/sync-contacts.js`. Alert opens contacts for manual calling; it does not send an emergency message or dispatch responders. Barangay inference uses proximity to centres, not boundary verification.

The report starts with Live fire, High, Moderate or Low. Non-live reports then collect category and observations. Hazard details use the Riff 28 card-shuffle treatment, with each factor score and explanation, arrow/dot navigation, keyboard controls and swipes. Motion respects reduced-motion settings. The redundant right-side legend is removed.

## Checks and local backups

Run `npm test`. Tests use a temporary database and mocked Gemini responses; they do not spend API credits or insert pins in the main database. They cover zero Gemini calls on page load, preservation of genuine saved Gemini results, prepared mock scores, new-report processing, failures and exact coordinate preservation.

The original database/pin snapshot is under `data/backups/assessment-refactor-20261109/`; the later 37-pin snapshot is under `data/backups/new-key-20261109/`. These local recovery files and UI screenshots under `data/qa/` are excluded from Git.
