# EmbeReady

A community fire-hazard map for Batangas City. Report a risk level first; Live fire goes directly to pinning and responder contacts. Non-live reports collect a category, observations and an optional photo.

Existing mock reports load complete saved demo assessments and tailored precautions immediately, using the same factor-card interface as Gemini results. Opening the website does not send the mock database to Gemini. Successful Gemini assessments, including the original saved bamboo report, are preserved.

Only newly submitted non-live community reports invoke Gemini automatically. Failed community reports can be retried explicitly. No local scoring fallback invents a result for a real report when Gemini is unavailable.

The prepared demo results are authored fixtures in `server/data/demo-assessments.json`, with corresponding fictional observations in `server/data/mock-observations.json`. They are identified as demo data rather than actual Gemini API output. Coordinates, IDs, reference codes, photos and incident statuses are preserved.

See [SETUP-CONTENT.md](SETUP-CONTENT.md) for configuration. Run `npm start` and open `http://localhost:3000`. Run `npm test` for isolated assessment, reporting, quota-preservation and pin-preservation checks.
