# DevDetective 

## Live Demo 

https://dev-detective-t5y7.vercel.app/

DevDetective is a GitHub Portfolio Analyzer & Enhancer optimized for Vercel serverless deployment.
It provides recruiter-style scoring, risk detection, roadmap generation, and downloadable reports using real GitHub data.

## Highlights

- Accepts GitHub username, `@username`, or profile URL
- Uses real GitHub REST/GraphQL data through serverless API
- Objective portfolio score (`0-100`) + weighted category subscores
- Recruiter insights: strengths, red flags, hidden risks
- Hireability score + readiness level
- Top repository ranking and visual analytics dashboard
- Personalized improvement roadmap and career-path recommendation
- Downloadable markdown recruiter report
- Dark/light mode and responsive SaaS-style UI

## Vercel-Native Architecture

- Static frontend served via Vercel CDN
- Serverless API route: `api/analyze.js`
- Stateless request flow
- Optional distributed rate limiting using Vercel KV / Upstash REST
- API response caching + in-function cache + CDN caching headers
- Request de-duplication for concurrent same-user analysis calls

## Project Structure

```text
.
├── api/
│   ├── analyze.js
│   └── _lib/
│       ├── analysis.js
│       ├── github.js
│       ├── rate-limit.js
│       └── utils.js
├── src/
│   ├── main.js
│   ├── config/constants.js
│   ├── report/markdown.js
│   ├── ui/charts.js
│   ├── ui/elements.js
│   ├── ui/render.js
│   └── utils/core.js
├── index.html
├── style.css
├── sw.js
├── manifest.json
├── vercel.json
└── .env.example
```

## Environment Variables

Set in Vercel Project Settings -> Environment Variables.

### Required (recommended strongly)

- `GITHUB_TOKEN`: GitHub token for higher rate limits and GraphQL pinned repos

### Optional (for distributed rate limiting)

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`



## Deploy on Vercel

1. Import this repository in Vercel.
2. Add environment variables above.
3. Deploy.

Vercel settings:

- Build Command: **(none required)**
- Output Directory: **(none required)**
- Framework Preset: **Other**

`vercel.json` already includes function config and production headers.

## Local Run

### Static frontend check



### Full Vercel-like local run (if Vercel CLI installed)

```bash
vercel dev
```

## Reliability & Security

- Input sanitization for usernames/URLs
- API abuse protection with rate limiting
- 429 responses when limits are exceeded
- Graceful handling for invalid input, not found, network failures, and GitHub upstream failures
- No sensitive token exposed to browser
- Security headers configured via `vercel.json`

## Notes

- Commit consistency is approximated via `pushed_at` metadata.
- Deep README/language checks are limited to top repos for performance and GitHub quota efficiency.
