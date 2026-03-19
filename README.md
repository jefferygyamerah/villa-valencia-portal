# Villa Valencia Portal

Digital portal for Villa Valencia HOA (APROVIVA), Costa Sur, Don Bosco, Panama.

## Overview

Community portal for 118 homeowners providing transparency into HOA operations, finances, and maintenance. Static site hosted on GitHub Pages.

## Structure

```
index.html          Main portal (dashboard, comunicados, PQRS, financials)
proveedores.html    Provider directory with search and filtering
css/styles.css      Shared styles
js/config.js        Configuration (Google Client ID, form URLs, Drive links)
js/auth.js          Google Sign-In + demo mode
js/app.js           Portal page logic
js/proveedores.js   Provider directory logic
docs/               Reference documents and prototypes
```

## Configuration

Edit `js/config.js` with your values:

- `GOOGLE_CLIENT_ID` — OAuth 2.0 client ID from Google Cloud Console
- `PQRS_FORM_URL` — Published Google Form URL
- `DRIVE_LINKS` — Google Drive folder URLs for each document section

## Deployment

Hosted on GitHub Pages from the `master` branch root. Add `.nojekyll` to skip Jekyll processing.
