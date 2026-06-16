# Incoterms Simulation — LTI v1.3 Integration

This package wraps the Incoterms simulation with a full LTI v1.3 backend,
making it ready for submission to HBI's eLearning catalog.

---

## What's Inside

```
lti-incoterm/
├── public/
│   └── index.html          ← Your simulation (unchanged content)
├── src/
│   └── server.js           ← LTI v1.3 backend (handles launch + grading)
├── package.json            ← Node.js dependencies
├── railway.toml            ← Railway deployment config
├── .env.example            ← Environment variables template
└── .gitignore
```

---

## Step-by-Step Deployment on Railway (Free)

### Step 1 — Upload to GitHub
1. Go to https://github.com and sign in
2. Click **"New repository"** → name it `incoterms-lti`
3. Upload ALL files from this folder (drag & drop)
4. Click **Commit changes**

### Step 2 — Deploy on Railway
1. Go to https://railway.app and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `incoterms-lti` repository
4. Railway auto-detects Node.js and starts deploying

### Step 3 — Add MongoDB Database
1. In your Railway project, click **"+ New"** → **"Database"** → **"MongoDB"**
2. Railway creates a database and sets `DATABASE_URL` automatically

### Step 4 — Set Environment Variables
In Railway → your service → **Variables** tab, add:

| Variable | Value |
|---|---|
| `LTI_KEY` | A long random string (generate at randomkeygen.com) |
| `NODE_ENV` | `production` |
| `LTI_ISS` | *(provided by HBI LMS admin)* |
| `LTI_CLIENT_ID` | *(provided by HBI LMS admin)* |
| `LTI_AUTH_URL` | *(provided by HBI LMS admin)* |
| `LTI_ACCESSTKN` | *(provided by HBI LMS admin)* |
| `LTI_KEYSET_URL` | *(provided by HBI LMS admin)* |

> **Note:** The HBI-specific values are shared by HBI's LMS administrator
> after you provide them your tool URLs (Step 6).

### Step 5 — Get Your Live URL
Railway gives you a URL like:
```
https://incoterms-lti-production.up.railway.app
```
Find it under: **Settings → Networking → Public Networking**

### Step 6 — Share These URLs with HBI LMS Admin
Give HBI the following (replace YOUR_URL with your Railway URL):

| What | URL |
|---|---|
| **Tool Launch URL** | `https://YOUR_URL/` |
| **OIDC Login URL** | `https://YOUR_URL/login` |
| **Public Keyset URL** | `https://YOUR_URL/keys` |

HBI's admin registers these in their LMS and sends you back the
`LTI_ISS`, `LTI_CLIENT_ID`, `LTI_AUTH_URL`, `LTI_ACCESSTKN`, `LTI_KEYSET_URL` values.

### Step 7 — Set HBI Values & Redeploy
Paste the values HBI sends you into Railway's Variables tab.
Railway auto-redeploys. You're live.

---

## How Grading Works

1. Student launches simulation from HBI's LMS
2. LTI handshake validates student identity
3. Simulation runs normally in browser
4. On completion, score is automatically sent back to HBI's gradebook
5. Instructor sees grade in LMS — no manual work needed

---

## Health Check

Visit `https://YOUR_URL/health` — should return:
```json
{ "status": "ok", "service": "Incoterms LTI Tool", "version": "1.0.0" }
```

---

## Support

For LTI integration questions, refer to:
- ltijs docs: https://cvmcosta.me/ltijs
- LTI 1.3 spec: https://www.imsglobal.org/spec/lti/v1p3
