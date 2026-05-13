#from http import client
import httpx
from openai import OpenAI
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
#from google import genai
#from google.genai import types
import os
from dotenv import load_dotenv
import hashlib
import json
#from functools import lru_cache

load_dotenv()

# Simple in-memory cache for analysis results
CACHE_FILE = "salary_cache.json"

def load_cache():
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

_analysis_cache = load_cache()

def get_cached_analysis(request_hash: str) -> str:
    return _analysis_cache.get(request_hash)

def cache_analysis(request_hash: str, analysis: str):
    _analysis_cache[request_hash] = analysis
    save_cache(_analysis_cache)

app = FastAPI(title="Salary Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SalaryRequest(BaseModel):
    country: str
    job_title: str
    years_of_experience: str
    job_description: str
    currency: str
 # New field for analysis date in YYYY-MM-DD format




def build_prompt(req: SalaryRequest) -> str:
    from datetime import date
    today = date.today().strftime("%B %d, %Y")
    return f"""You are a salary analysis engine.

Your job is to return a stable, repeatable salary recommendation for the SAME normalized input.
For identical input values, keep the same salary ranges, same structure, and same wording as much as possible.
Do not vary phrasing unnecessarily.
Do not add disclaimers.
Do not add notes.
Do not add bullets outside the required format.
Do not add any text before or after the required output.

Use the input exactly as provided.
Do not infer missing fields.
Do not use the current system date.
Use only the ANALYSIS_DATE field provided below.

Normalization rules:
- Treat all input fields as already normalized.
- Keep the currency symbol and label consistent with CURRENCY.
- Salary values must be annual salary ranges in CURRENCY.
- Every table cell must contain a short salary range, not a single exact amount.
- Format every range exactly like this: [min amount] - [max amount]
- Round all salary values to the nearest 50,000.
- Keep each range narrow and practical.
- Ensure logical ordering: Entry < Market Median < Premium.
- The Recommended Offer must be a narrow range near the Market Median unless the profile clearly justifies a higher offer.
- Keep the Executive Summary to 2 sentences maximum.
- Keep wording formal, concise, and stable across repeated runs.

Output rules:
- Return EXACTLY two sections and nothing else.
- The first section title must be exactly: "## Executive Summary"
- The second section title must be exactly: "## Recommended Salary Range"
- The table must have exactly these rows and labels:
  - Entry (25th percentile)
  - Market Median (50th)
  - Premium (75th percentile)
  - **Recommended Offer**
- Use short salary ranges inside every table cell.
- Do not put a single exact number in any salary cell.
- Do not include monthly salary.
- Do not include extra commentary.
- Stop immediately after the table.

Decision rules:
- Base the recommendation on the job title, country, experience, and description.
- For early-career roles, prefer conservative but market-aligned estimates.
- Keep percentile spread realistic and not excessively wide.
- Maintain internal consistency across similar inputs.

INPUT
POSITION: {req.job_title}
EXPERIENCE_YEARS: {req.years_of_experience}
COUNTRY: {req.country}
CURRENCY: {req.currency}
DESCRIPTION: {req.job_description}
ANALYSIS_DATE: {today}

REQUIRED OUTPUT FORMAT

## Executive Summary
[One short paragraph about market conditions and salary recommendation in {req.currency}]

## Recommended Salary Range
| Level | {req.currency} Per Annum |
|---|---|
| Entry (25th percentile) | [amount] - [amount] |
| Market Median (50th) | [amount] - [amount] |
| Premium (75th percentile) | [amount] - [amount] |
| **Recommended Offer** | **[amount] - [amount]** |"""


@app.post("/api/analyze-salary")
async def analyze_salary(request: SalaryRequest):
    # Create a hash of the request for caching
    request_str = f"{request.country}|{request.job_title}|{request.years_of_experience}|{request.job_description}|{request.currency}"
    request_hash = hashlib.md5(request_str.encode()).hexdigest()
    
    # Check cache first
    cached_result = get_cached_analysis(request_hash)
    if cached_result:
        return {"analysis": cached_result}
    
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key or api_key == "your_perplexity_api_key_here":
        raise HTTPException(
            status_code=500,
            detail="PERPLEXITY_API_KEY is not configured. Please add it to backend/.env"
        )

    try:
        http_client = httpx.Client()
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.perplexity.ai",
            http_client=http_client,
        )
        prompt = build_prompt(request)

        response = client.chat.completions.create(
            model="sonar-pro",
            temperature=0.0,
            max_tokens=4096,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict salary analyst. "
                        "You ONLY output exactly what is asked. "
                        "You NEVER add extra sections, explanations, bullet points, "
                        "or any content beyond what is explicitly requested in the prompt. "
                        "If the prompt says STOP, you stop immediately. "
                        "Output ONLY Executive Summary and Recommended Salary Range table. Nothing else. "
                        "Base salary data ONLY from these trusted sources: glassdoor.com, linkedin.com, "
                        "ambitionbox.com, naukri.com, payscale.com, levels.fyi, indeed.com, timesjobs.com. "
                        "Do not use random blogs, forums, or unverified sources."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            extra_body={
                "search_domain_filter": [
                    "glassdoor.com",
                    "linkedin.com",
                    "ambitionbox.com",
                    "naukri.com",
                    "payscale.com",
                    "levels.fyi",
                    "indeed.com",
                    "timesjobs.com"
                ],
                "search_recency_filter": "month",
                "return_citations": False,
            }
        )

        # Extract text — handle grounded responses where .text may be None
        text = response.choices[0].message.content

        if not text:
            raise ValueError("Perplexity returned an empty response. Please retry.")

        cache_analysis(request_hash, text)
        return {"analysis": text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}

@app.delete("/api/clear-cache")
def clear_cache():
    _analysis_cache.clear()
    if os.path.exists(CACHE_FILE):
        os.remove(CACHE_FILE)
    return {"status": "cache cleared"}

#to clear cache:
#http://localhost:8000/api/clear-cache
#https://myapp-backend-210612455139.us-central1.run.app/api/clear-cache

# Serve React frontend — must be mounted last so API routes take precedence
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
