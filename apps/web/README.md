# Calendar web app

The React app uses the Calendar Management `/v1` API for paginated browsing,
calendar details and dates, exclusions, create/update, and CSV upload.

## Run locally

Start the [calendar service](../calendar_service/README.md) on port 8000, then run
from this directory:

```powershell
npm install
npm run dev
npm run build
```

Vite proxies `/v1` to the backend. In production, serve the SPA and `/v1` under
the same origin.

When auth is enabled, obtain an OAuth access token from the configured provider and
paste it into the header's token field, without the `Bearer` prefix. The app
stores it only in memory; clearing it or reloading the page removes it. No token
is needed when the backend explicitly runs with auth disabled.

## Regenerate API types

Export the backend OpenAPI schema first, then run `npm run generate:api`.
The generated types must reflect the backend contract; do not edit them by hand.
