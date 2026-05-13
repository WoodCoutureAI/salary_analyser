# SalaryIQ — Real-Time Market Salary Analyzer

AI-powered salary benchmarking tool using Perplexity AI with live web search.

---

## Project Structure

```
WCL/
├── backend/
│   ├── main.py               # FastAPI backend
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Backend container config
│   ├── .dockerignore         # Files to exclude from Docker
│   ├── .env                  # Secret API keys (never commit this)
│   └── salary_cache.json     # Auto-generated cache file
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── App.css           # Styles
│   │   └── main.jsx          # React entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── Dockerfile            # Frontend container config
│   └── .dockerignore         # Files to exclude from Docker
│
└── black-dragon-456811-k5-0f47c11efbc4.json  # GCP service account key
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| AI Model | Perplexity AI `sonar-pro` |
| Deployment | Google Cloud Run |
| Container | Docker (built on Google Cloud) |

---

## GCP Project Details

| Item | Value |
|---|---|
| Project ID | `black-dragon-456811-k5` |
| Region | `us-central1` |
| Backend Service | `myapp-backend` |
| Frontend Service | `myapp-frontend` |
| Backend URL | `https://myapp-backend-210612455139.us-central1.run.app` |
| Frontend URL | `https://myapp-frontend-210612455139.us-central1.run.app` |

---

## Running Locally

### 1. Start Backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```
Backend runs at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Frontend runs at: `http://localhost:5173`

> ⚠️ When running locally, make sure `App.jsx` fetch URL is set to `http://localhost:8000`

---

## Environment Variables

Create a `.env` file inside the `backend/` folder:

```env
PERPLEXITY_API_KEY=pplx-your-actual-key-here
```

> ⚠️ Never commit `.env` to Git. It is listed in `.dockerignore` to prevent accidental uploads.

---

## Deploying to Google Cloud

### Prerequisites
- Google Cloud SDK installed
- Docker Desktop installed (optional — cloud builds without it)
- Logged in with service account

### Step 1 — Authenticate
```bash
gcloud auth activate-service-account --key-file="C:\Users\sridh\WCL\black-dragon-456811-k5-0f47c11efbc4.json"
gcloud config set project black-dragon-456811-k5
```

### Step 2 — Deploy Backend
```bash
cd backend

gcloud run deploy myapp-backend --source . --region us-central1 --platform managed --memory 1Gi --port 8080 --allow-unauthenticated --set-env-vars PERPLEXITY_API_KEY=pplx-your-actual-key-here
```

### Step 3 — Deploy Frontend
```bash
cd frontend

gcloud run deploy myapp-frontend --source . --region us-central1 --platform managed --port 80 --allow-unauthenticated
```

> ✅ Both deployments will print a live URL when complete.

---

## Redeploying After Code Changes

Whenever you make changes to your code, just re-run the deploy commands:

**Backend changed:**
```bash
cd backend
gcloud run deploy myapp-backend --source . --region us-central1 --platform managed --memory 1Gi --port 8080 --allow-unauthenticated --set-env-vars PERPLEXITY_API_KEY=pplx-your-actual-key-here
```

**Frontend changed:**
```bash
cd frontend
gcloud run deploy myapp-frontend --source . --region us-central1 --platform managed --port 80 --allow-unauthenticated
```

---

## Switching Between Local and Cloud Backend

**For local development** — in `frontend/src/App.jsx`:
```javascript
const res = await fetch(`http://localhost:8000/api/analyze-salary`, {
```

**For production (cloud)** — in `frontend/src/App.jsx`:
```javascript
const res = await fetch(`https://myapp-backend-210612455139.us-central1.run.app/api/analyze-salary`, {
```

> Remember to redeploy frontend after changing this for production.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/analyze-salary` | Generate salary analysis |
| GET | `/health` | Check if backend is running |
| GET | `/docs` | Interactive API documentation |
| DELETE | `/api/clear-cache` | Clear the salary cache |

### Test Backend Health
Open in browser:
```
https://myapp-backend-210612455139.us-central1.run.app/health
```
Should return: `{"status": "ok"}`

---

## Cache Management

- Salary results are cached in `salary_cache.json` in the backend folder
- Same input = same result returned from cache (no extra API calls)
- Cache persists across server restarts
- **To clear cache** — visit this URL in browser:
```
https://myapp-backend-210612455139.us-central1.run.app/api/clear-cache
```
Or delete `salary_cache.json` manually from the backend folder.

> Recommended: Clear cache once a year so salary data stays current.

---

## Troubleshooting

### "Failed to fetch" error in frontend
- Check that `App.jsx` has the correct backend URL
- Verify backend is running: visit `/health` endpoint
- Check browser console (Right-click → Inspect → Console tab)

### Check backend logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=myapp-backend" --limit=30
```

### Check frontend logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=myapp-frontend" --limit=30
```

### Permission denied on IAM
```bash
gcloud auth activate-service-account --key-file="C:\Users\sridh\WCL\black-dragon-456811-k5-0f47c11efbc4.json"
```
Then retry the command.

### Fix public access manually
```bash
gcloud beta run services add-iam-policy-binding --region=us-central1 --member=allUsers --role=roles/run.invoker myapp-frontend

gcloud beta run services add-iam-policy-binding --region=us-central1 --member=allUsers --role=roles/run.invoker myapp-backend
```

---

## Requirements

### Backend (`requirements.txt`)
```
fastapi==0.115.5
uvicorn==0.32.1
python-dotenv==1.0.1
openai
pydantic==2.10.3
aiofiles==24.1.0
```

### Frontend
```
node 20+
npm
react
vite
```

---

## Important Files — Never Delete

| File | Why |
|---|---|
| `backend/Dockerfile` | Required for cloud deployment |
| `backend/.dockerignore` | Prevents secrets from uploading |
| `frontend/Dockerfile` | Required for cloud deployment |
| `frontend/.dockerignore` | Excludes node_modules from upload |
| `backend/.env` | Contains your API key |
| `black-dragon-456811-k5-0f47c11efbc4.json` | GCP service account key for deployment |

---

*Powered by Perplexity AI sonar-pro with live web search · Deployed on Google Cloud Run*
