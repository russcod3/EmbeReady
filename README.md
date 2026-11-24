# EmbeReady

A community fire-hazard map for Batangas City. Report a risk level first; Live fire goes directly to pinning and responder contacts. Non-live reports collect a category, observations and an optional photo.

Existing mock reports load complete saved demo assessments and tailored precautions immediately, using the same factor-card interface as Gemini results. Opening the website does not send the mock database to Gemini. Successful Gemini assessments, including the original saved bamboo report, are preserved.

Only newly submitted non-live community reports invoke Gemini automatically. Failed community reports can be retried explicitly. No local scoring fallback invents a result for a real report when Gemini is unavailable.

The prepared demo results are authored fixtures in `server/data/demo-assessments.json`, with corresponding fictional observations in `server/data/mock-observations.json`. A DEMO DATA badge identifies example records. Cards show ordinary assessment prose with a Pre-seeded assessment label; genuine Gemini results retain their Gemini attribution. Stored provenance, coordinates, IDs, reference codes, photos and incident statuses are preserved.

Map levels are independent switches backed by one Set. All is derived from the four levels; Clear filters restores every level and clears barangay/category selections. English and Tagalog interface controls, a first-visit tip and a reviewed FAQ explain these controls. The language choice and tip dismissal are saved locally; report and assessment narratives retain their original wording.

See [SETUP-CONTENT.md](SETUP-CONTENT.md) for configuration. Run `npm start` and open `http://localhost:3000`. Run `npm test` for isolated assessment, reporting, quota-preservation and pin-preservation checks.

Run `npm run test:ui` for the filter walkthrough, all 16 combinations, dropdown interactions, refresh races, tip persistence, translation keys and assessment display checks. This suite uses local fixtures, sends no HTTP/API requests and never opens the application database.

The top navigation places language and the persisted light/dark Eclipse theme control on the right, outside the filter card. A shared FAQ button stays fixed at the lower-right corner on both homepage and map and uses the report liquid reveal. Compact 38px level chips use a glow and separate corner remove buttons. Successful saved reports play the Figma-derived check/rings and a one-shot canvas ember burst; pending or failed saves never trigger it. Motion respects reduced-motion preferences. Figma assets are stored under `public/images/motion/`.

## Report review

Set a unique `ADMIN_PASSWORD` of at least 16 characters in `.env`, restart the server, and open `/admin`. Use HTTPS when sharing the app. If HTTPS terminates at a reverse proxy, configure `TRUST_PROXY` for your deployment.

The queue contains submitted community reports, with live fires listed first. Reviewers can inspect the submitted location, observations, photo, and any saved Gemini assessment before recording a decision, an optional evaluated risk level, and notes. Notes are required for **Needs verification** and **Dismissed**. Review decisions are internal, and community pins and live-fire responder contacts appear as soon as a report is saved.
