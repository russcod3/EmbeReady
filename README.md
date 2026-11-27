# EmbeReady

A community fire-hazard map for Batangas City. Report a risk level first; Live fire goes directly to pinning and responder contacts. Non-live reports collect a category, observations and an optional photo.

Existing mock reports load complete saved demo assessments and tailored precautions immediately, using the same factor-card interface as Gemini results. Opening the website does not send the mock database to Gemini. Successful Gemini assessments, including the original saved bamboo report, are preserved.

Only newly submitted non-live community reports invoke Gemini automatically. Failed community reports can be retried explicitly. No local scoring fallback invents a result for a real report when Gemini is unavailable.

The prepared demo results are authored fixtures in `server/data/demo-assessments.json`, with corresponding fictional observations in `server/data/mock-observations.json`. A DEMO DATA badge identifies example records. Cards show ordinary assessment prose with a Pre-seeded assessment label; genuine Gemini results retain their Gemini attribution. Stored provenance, coordinates, IDs, reference codes, photos and incident statuses are preserved.

Map levels are independent switches backed by one Set. All is derived from the four levels; Clear filters restores every level and clears barangay/category selections. English and Tagalog interface controls, a first-visit tip and a reviewed FAQ explain these controls. The language choice and tip dismissal are saved locally; report and assessment narratives retain their original wording.

See [SETUP-CONTENT.md](SETUP-CONTENT.md) for configuration. Run `npm start` and open `http://localhost:3000`. Run `npm test` for isolated assessment, reporting, quota-preservation and pin-preservation checks.

Run `npm run test:ui` for the filter walkthrough, all 16 combinations, dropdown interactions, refresh races, tip persistence, translation keys and assessment display checks. This suite uses local fixtures, sends no HTTP/API requests and never opens the application database.

The top navigation places language and the persisted light/dark Eclipse theme control on the right, outside the filter card. A shared FAQ button stays fixed at the lower-right corner on both homepage and map and uses the report liquid reveal. Compact 38px level chips use a glow and separate corner remove buttons. Successful saved reports play the Figma-derived check/rings and a one-shot canvas ember burst; pending or failed saves never trigger it. Motion respects reduced-motion preferences. Figma assets are stored under `public/images/motion/`.

On Node 24, EmbeReady uses built-in SQLite. Run `npm ci --include=optional` so the local photo scanner has Sharp’s platform binaries. Older Node versions use the optional `better-sqlite3` fallback.

## Report review

Open `/admin` after starting the server. The sign-in card accepts a username and password and includes a password visibility control. The requested local credentials are configured in the ignored `.env` file: username `admin`, password `admin1234`. `ADMIN_USERNAME` and `ADMIN_PASSWORD` control the account. The interface is English and includes the same light/dark theme and animated artwork as the public site.

**Reports** contains community submissions only. Example and pre-seeded hazards stay in **All hazards**. Both collections support search, filters, and grid/list views. Open a card to inspect the description, reported risk, location, photo, and review notes. Verify reports using residents, first-hand observation, or your own external sources. **Mark as verified** adds a public Verified badge. **Mark as fake** keeps the report in the private review inbox and hides it from the public map.

The optional photo check runs locally with an Apache-licensed ONNX classifier. Install its pinned, checksum-verified model with `npm run setup:detector`. The installed model lives in ignored `data/models/`; no API key is needed and no report photo is uploaded to a detection service. Results are cached by photo hash and model revision. A score strictly above 50% displays a warning and a **Delete this report** action. A score is a review signal, not proof that a photo or report is authentic.

Deletion always requires a confirmation dialog and a reason. It removes the selected hazard, its reports and related evidence, and its uploaded photo when no other hazard uses it. A private deletion log retains the reference, reviewer, reason, and time. **All hazards** also lets an admin remove a hazard confirmed to no longer exist. Existing reports, saved Gemini assessments, and unrelated pins are preserved.

The map filter explanation has a persistent **Got it** dismissal. Preparedness tabs have left/right overflow arrows on hover or keyboard focus; touch devices show the available arrows directly. Map zoom uses smaller increments and smoother marker hover transitions.

Run `npm test` for reporting, review, deletion, photo-cache, threshold, filter, and assessment checks. Integration tests use isolated databases and stub Gemini calls.
