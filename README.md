# EmbeReady

A community fire-hazard map for Batangas City. Report a risk level first; Live fire goes directly to pinning and responder contacts. Non-live reports collect a category, observations and an optional photo.

Existing mock reports load complete saved demo assessments and tailored precautions immediately, using the same factor-card interface as Gemini results. Opening the website does not send the mock database to Gemini. Successful Gemini assessments, including the original saved bamboo report, are preserved.

Only newly submitted non-live community reports invoke Gemini automatically. Failed community reports can be retried explicitly. No local scoring fallback invents a result for a real report when Gemini is unavailable.

The prepared demo results are authored fixtures in `server/data/demo-assessments.json`, with corresponding fictional observations in `server/data/mock-observations.json`. A DEMO DATA badge identifies example records. Cards show ordinary assessment prose with a Pre-seeded assessment label; genuine Gemini results retain their Gemini attribution. Stored provenance, coordinates, IDs, reference codes, photos and incident statuses are preserved.

Map levels are independent switches backed by one Set. All is derived from the four levels; Clear filters restores every level and clears barangay/category selections. English and Tagalog interface controls, a first-visit tip and a reviewed FAQ explain these controls. The language choice and tip dismissal are saved locally; report and assessment narratives retain their original wording.

See [SETUP-CONTENT.md](SETUP-CONTENT.md) for configuration. Run `npm start` and open `http://localhost:3000`. Run `npm test` for isolated assessment, reporting, quota-preservation and pin-preservation checks.

Run `npm run test:ui` for the filter walkthrough, all 16 combinations, dropdown interactions, refresh races, tip persistence, translation keys and assessment display checks. This suite uses local fixtures, sends no HTTP/API requests and never opens the application database.

The top navigation places language and the persisted light/dark Eclipse theme control on the right, outside the filter card. A shared FAQ button stays fixed at the lower-right corner on both homepage and map and uses the report liquid reveal. Compact 38px level chips use a glow and separate corner remove buttons. Successful saved reports play the Figma-derived check/rings and a one-shot canvas ember burst; pending or failed saves never trigger it. Motion respects reduced-motion preferences. Figma assets are stored under `public/images/motion/`.

On Node 24, EmbeReady uses built-in SQLite. Run `npm ci --omit=optional` to install without compiling the optional `better-sqlite3` fallback. On older Node versions without built-in SQLite, run `npm ci` to install the fallback.

## Report review

Set a unique `ADMIN_PASSWORD` of at least 8 characters in `.env`, restart the server, and open `/admin`. Use HTTPS when sharing the app. If HTTPS terminates at a reverse proxy, configure `TRUST_PROXY` for your deployment.

Choose **Shared admin** and enter the password configured in `.env`. Open **Reviewers** to add named accounts or disable access. Reviewers choose **Named reviewer** and enter the username and password created for them. Disabling an account ends its active sessions. The review history attributes new decisions to the account used to sign in. The most recent decision for older reviews is labeled **Legacy review**.

The queue puts live fires first. Reviewers can inspect the report pin and up to five other community reports within 500 m, review submitted evidence, and compare reported, Gemini, and moderator risk. **Needs verification** requires both a follow-up reason and notes. The queue can filter by reason. **Dismissed** requires notes.

The public map shows a **Verified** badge when a moderator validates a community report. Other community reports remain **Unverified**. Pins and responder contacts appear as soon as a submission is saved. Review notes and reviewer names stay private.

Use **Follow-up & incident** to assign a reviewer, set a due date, link or unlink a duplicate, and update incident status. **Assigned to me** and **Overdue** show open follow-ups, with overdue dates evaluated in Batangas City time. Incident status is separate from the review decision. Linking a duplicate preserves both submissions and their history.

**Save and open next** advances within the current filters. The community and demo queues each remember their filters in the current browser tab. Switch to **Demo queue** and use **Load sample reports** to install four practice cases when barangay data is available. Demo reports stay out of the public map and do not call Gemini.

Use **Operations overview** for the current community workload and the last seven days of submissions. **Needs attention** prioritizes unreviewed live fires, unread reporter replies, and overdue cases. Reviewers can create a private reply link and share it directly with a reporter. It accepts one reply with text, coordinates, or a photo, and expires after seven days. Links created on localhost are reachable only on the local machine.

The shared admin can appoint named supervisors under **Reviewers**. Supervisors can manage standard reviewer accounts and correct another reviewer’s decision with a documented reason. **Correct report pin** saves the previous and new coordinates and the reason for the move. Reporter replies and pin-change history stay in the workspace.
