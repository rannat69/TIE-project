# frontline_boost

## What you have

- **Frontend**: Vite + React (this repo root)
- **Backend**: Node + Express in `backend/` (Firebase Admin connected)

## Backend: connect to your Firebase project

Your snippet is the **Web (frontend) Firebase SDK** config. A backend should connect using **Firebase Admin SDK** with a **service account** (not the web `apiKey`).

### Deploying backend on Google Cloud (Cloud Run)

On **Cloud Run**, you do **not** need `serviceAccountKey.json`. Firebase Admin will use the Cloud Run service account automatically (Application Default Credentials).

Basic deploy (from `backend/`):

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

gcloud run deploy frontline-boost-api ^
  --source . ^
  --region asia-southeast1 ^
  --allow-unauthenticated ^
  --set-env-vars FRONTEND_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Notes:

- `--allow-unauthenticated` is fine because your protected routes still require a Firebase ID token (e.g. `/me`). You can remove it later and protect with IAM if you want.
- Make sure the Cloud Run **service account** has permissions for Firebase Auth (typically **Firebase Authentication Admin**).

### 1) Create a Firebase service account key (local dev)

In Firebase Console:

- Project settings → **Service accounts** → **Generate new private key**
- Save the file as `backend/serviceAccountKey.json`

### 2) Configure backend env

Copy the example env:

- `backend/.env.example` → `backend/.env`

Make sure it contains:

- `GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json`

### 3) Run the backend

From `backend/`:

```bash
npm install
npm run dev
```

Test:

- `GET http://localhost:8080/health` → `{ "ok": true }`

### 4) Call an authenticated endpoint (`/me`)

Send an `Authorization: Bearer <FIREBASE_ID_TOKEN>` header to:

- `GET http://localhost:8080/me`

The backend will verify the token using Firebase Admin and return your `uid` (and email if present).

## Run on production server

yarn 
npm run build

pm2 start npm --name pgortrack-frontend -- run preview

cd backend
npm i 
npm run build

pm2 start npm --name pgortrack-backend -- start
