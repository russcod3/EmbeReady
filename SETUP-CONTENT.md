# EmbeReady setup and manual content

## Gemini

Copy `.env.example` to `.env` if you do not already have an environment file. Set:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_TIMEOUT_MS=90000
```

Use a model available to your Google AI Studio project; `GEMINI_MODEL` is configurable. Stop the existing server with Ctrl+C, then run `npm start` again after editing the environment. The startup banner must say `AI Provider: gemini`. The request timeout defaults to 90 seconds and is configurable with `GEMINI_TIMEOUT_MS`. Never put the key in `public/` or commit `.env`.

New reports generate a risk assessment and safety plan. The resulting classification controls the marker; a Live fire keeps its Live marker regardless of assessed severity. Database value `heavy` is retained for compatibility and displayed as High. Existing assessments are preserved; this change does not spend API credits reassessing the whole database.

When Gemini fails or is not configured, reports still save with an explicitly labelled rule-based estimate and template guidance. Scores describe the model's estimate, not verification by responders.

## Photos

For any hazard ID, add `public/uploads/seed/hazard-01.jpg`, `hazard-02.jpg`, etc. IDs are padded to at least two digits. Both seeded and manually maintained records use this convention when `hazards.photo_url` is empty. Alternatively set that database column to a same-origin path such as `/uploads/seed/my-photo.jpg`. Uploaded report photos take precedence. Missing photos display a neutral placeholder.

## Contacts

Edit `server/contacts.json`. Keep `is_placeholder: true` and `phone_dialable: null` until you have a verified number. To enable calling, provide `phone_display`, `phone_dialable` (digits with optional leading +), and `is_placeholder: false`.

Use the exact barangay name from `barangays.name` as `jurisdiction`, or `Citywide` for BFP. Run:

```powershell
node server/sync-contacts.js
```

This updates matching jurisdiction/facility entries and creates missing barangay placeholders without removing reports. Do not rerun the seed script to update phone numbers. Contact actions stay disabled until configured. Submission records a report; it does not call or dispatch responders.

## Run and verify

```powershell
npm start
node --test server/ai/assessment.test.js
```

The map opens immediately. On mobile, use the sheet handle or Filters & layers button to expand controls. Hazard details have their own expandable sheet. On desktop, filters sit on the left and the selected hazard appears on the right.
