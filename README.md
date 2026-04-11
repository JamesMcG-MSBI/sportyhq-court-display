# Pirates TC — Court Availability Board

A live court booking display board for Pirates Tennis Club. Designed to run fullscreen on a notice board monitor at the club. 

## What it does

Fetches live court booking data from the SportyHQ API and displays it as a rolling 3-hour visual timeline across 6 courts. The board auto-refreshes every 5 minutes and re-renders every 30 seconds to keep the "now" indicator current. Upcoming bookings scroll across a ticker at the bottom of the screen.

## Tech stack

Plain HTML, CSS, and JavaScript — no frameworks, no build step, no dependencies. Hosted on **Azure Static Web Apps**.

---

## Deployment

The project auto-deploys to Azure Static Web Apps on every push to `main` via GitHub Actions (see `.github/workflows/azure-static-web-apps.yml`). Pull requests generate automatic preview deployments.

---

## Configuration

Before deploying to production, update the following constants at the top of `js/noticeboard.js` with the club's real credentials:

```js
const API_KEY  = 'YOUR_API_KEY';
const CLUB_KEY = 'YOUR_CLUB_KEY';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // adjust if needed
```

### Switching from demo to production mode

The file currently ships in **demo mode** with three hardcoded values (marked `← DEMO ONLY` / `← REMOVE FOR PRODUCTION`). Replace them as follows:

**1. `getTodayDateString()` — return today's real date**

Remove:
```js
return '2024-05-28'; // ← REMOVE FOR PRODUCTION
```
Uncomment:
```js
// const d = new Date();
// return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

**2. `getNowMins()` — return the real current time**

Remove:
```js
return 9 * 60 + 42; // ← REMOVE FOR PRODUCTION
```
Uncomment:
```js
// const n = new Date(); return n.getHours() * 60 + n.getMinutes();
```

**3. `render()` — show the real clock**

Replace:
```js
document.getElementById('clock').textContent = '09:42'; // ← CHANGE FOR PRODUCTION
const d = new Date('2024-05-28');                        // ← CHANGE FOR PRODUCTION
```
With:
```js
document.getElementById('clock').textContent = formatTime(new Date());
const d = new Date();
```

---

## CORS note

The SportyHQ API may block direct browser requests due to [CORS policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS). If you see CORS errors in the browser console after deploying, the API does not allow browser-side calls and you will need an **Azure Function proxy** to forward requests server-side.

This is a planned future enhancement. Search for **"Azure Static Web Apps API proxy"** for official guidance on setting one up — it requires only a small `api/` folder alongside the static files.

---

## Kiosk setup

To display the board fullscreen on a dedicated monitor, use Chrome kiosk mode:

```
chrome --kiosk https://your-app.azurestaticapps.net
```

Replace `your-app` with the subdomain assigned to your Static Web App. A **custom domain** (e.g. `board.piratestc.co.uk`) can be mapped in the Azure portal under your Static Web App → Custom domains.

---

## Azure portal setup

1. Sign in to [https://portal.azure.com](https://portal.azure.com).
2. Search for **Static Web Apps** and click **Create**.
3. Fill in:
   - **Subscription / Resource group** — create or select one.
   - **Name** — e.g. `pirates-court-display`.
   - **Plan type** — Free tier is sufficient.
   - **Region** — choose the region closest to you.
   - **Source** — GitHub. Authorise Azure to access your GitHub account.
   - **Organisation / Repository / Branch** — select this repo and `main`.
   - **Build presets** — select **Custom**.
   - **App location** — `/`
   - **Output location** — `/`
4. Click **Review + create**, then **Create**.
5. Once deployed, go to **Overview → Manage deployment token** and copy the token.
6. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: paste the token.
7. Push any commit to `main` to trigger the first deployment.

### Verifying the deployment

- Open the **GitHub Actions** tab in your repository and confirm the workflow run shows a green tick.
- Visit the URL shown in the Azure portal under **Static Web App → Overview → URL**.
- The board should load and display the demo data (or live data once configured).
