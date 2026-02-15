# DevDetective 

## Live Demo 

https://dev-detective-t5y7.vercel.app/

## Overview

DevDetective is a GitHub Portfolio Analyzer & Enhancer optimized for Vercel serverless deployment.
It provides recruiter-style scoring, risk detection, roadmap generation, and downloadable reports using real GitHub data.

### What is DevDetective?

DevDetective transforms GitHub profiles into professional portfolio assessments by analyzing repository data, contribution patterns, and code quality metrics. It simulates how technical recruiters evaluate developer portfolios, providing objective scores (0-100) and actionable improvement suggestions.

### Key Use Cases

- **Job Seekers**: Optimize your GitHub portfolio before applications
- **Recruiters**: Quickly assess candidate technical profiles  
- **Developers**: Get data-driven feedback on your open-source presence
- **Teams**: Evaluate potential collaborators or contributors

## Core Features

### Analysis Engine
- **Multi-Input Support**: Accepts GitHub username, `@username`, or full profile URL
- **Real-time Data**: Uses GitHub REST API and GraphQL to fetch live repository and user data
- **Comprehensive Scoring**: Objective portfolio score (0-100) with seven weighted category subscores
- **Smart Caching**: Multi-layer caching (in-function, API response, CDN) for optimal performance

### Portfolio Assessment
- **Recruiter Simulation**: AI-powered recruiter insights including strengths, red flags, and hidden risks
- **Hireability Metrics**: Calculated hireability score with portfolio readiness classification
- **Repository Ranking**: Importance-based ranking of top repositories with detailed metrics
- **Visual Analytics**: Interactive charts for language distribution, repository importance, and activity patterns

### Actionable Insights
- **Personalized Roadmap**: Step-by-step improvement plan tailored to your portfolio gaps
- **Career Path Recommendations**: Role-fit suggestions based on technology stack and impact signals
- **Downloadable Reports**: Professional markdown reports ready to share with recruiters
- **Transparency**: Detailed scoring formula breakdowns for each assessment category

### User Experience
- **Modern UI**: Dark/light mode with responsive, SaaS-style interface
- **Progressive Web App**: Service worker support with offline capabilities
- **Search History**: Quick access to previously analyzed profiles
- **Performance**: Sub-second responses with intelligent caching and CDN delivery

## Technical Architecture

### Vercel-Native Design

DevDetective is built from the ground up for Vercel's serverless platform:

- **Static Frontend**: HTML, CSS, and vanilla JavaScript served via Vercel's global CDN
- **Serverless API**: Single endpoint (`api/analyze.js`) handling all analysis requests
- **Stateless Processing**: Each request is independent, enabling horizontal scaling
- **Edge Caching**: Configured CDN cache headers for optimal content delivery
- **Zero Config Build**: No build step required - deploy directly from repository

### Performance Optimizations

1. **Multi-Layer Caching Strategy**:
   - In-memory function cache (TTL: 5 minutes)
   - Response caching with stale-while-revalidate
   - CDN edge caching (configurable via headers)
   - Request de-duplication for concurrent same-user requests

2. **Rate Limiting**:
   - Optional distributed rate limiting via Vercel KV / Upstash REST
   - Fallback to in-memory rate limiting
   - Configurable window and request thresholds
   - Graceful 429 responses with retry-after headers

3. **API Efficiency**:
   - Parallel GitHub API requests where possible
   - Smart data fetching (only top repositories analyzed in detail)
   - Configurable timeout handling
   - GraphQL for pinned repositories (when token available)

## Project Structure

```text
.
├── api/                      # Serverless API routes
│   ├── analyze.js           # Main analysis endpoint
│   └── _lib/
│       ├── analysis.js      # Portfolio scoring logic
│       ├── github.js        # GitHub API integration
│       ├── rate-limit.js    # Rate limiting middleware
│       └── utils.js         # Shared utilities
├── src/                     # Frontend application
│   ├── main.js             # Application entry point
│   ├── config/
│   │   └── constants.js    # Configuration constants
│   ├── report/
│   │   └── markdown.js     # Report generation
│   ├── ui/
│   │   ├── charts.js       # Chart.js visualizations
│   │   ├── elements.js     # DOM element references
│   │   └── render.js       # UI rendering logic
│   └── utils/
│       └── core.js         # Frontend utilities
├── Images/                  # Static assets and icons
├── index.html              # Main HTML file
├── style.css               # Application styles
├── sw.js                   # Service worker
├── manifest.json           # PWA manifest
├── vercel.json            # Vercel configuration
└── .env.example           # Environment template
```

### Key Components

- **API Layer** (`api/`): Serverless function handling GitHub data fetching and analysis
- **Frontend** (`src/`): Modular vanilla JavaScript with clear separation of concerns
- **Analysis Engine** (`api/_lib/analysis.js`): Scoring algorithms and portfolio evaluation
- **GitHub Integration** (`api/_lib/github.js`): REST and GraphQL API client with error handling
- **UI Rendering** (`src/ui/`): Declarative rendering of analysis results with Chart.js visualizations

## Environment Variables

Configure in Vercel Project Settings → Environment Variables.

### Required (Strongly Recommended)

- `GITHUB_TOKEN`: Personal access token for GitHub API
  - Increases rate limits from 60 to 5,000 requests/hour
  - Enables GraphQL queries for pinned repositories
  - Get token at: https://github.com/settings/tokens

### Optional: Distributed Rate Limiting

For production deployments with multiple regions:

- `KV_REST_API_URL`: Vercel KV or Upstash REST API URL
- `KV_REST_API_TOKEN`: Authentication token for KV service

### Optional: Performance Tuning

Fine-tune caching and rate limiting behavior:

- `RATE_LIMIT_MAX_REQUESTS` (default: `30`)
  - Maximum requests per window per IP
  
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
  - Rate limit window duration in milliseconds
  
- `ANALYSIS_CACHE_TTL_MS` (default: `300000`)
  - How long to cache analysis results (5 minutes)
  
- `GITHUB_CACHE_TTL_MS` (default: `120000`)
  - GitHub API response cache duration (2 minutes)
  
- `GITHUB_REQUEST_TIMEOUT_MS` (default: `10000`)
  - Timeout for GitHub API requests (10 seconds)

## Deployment

### Deploy on Vercel (Recommended)

1. **Import Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/new)
   - Import the DevDetective repository
   - Select your Git provider (GitHub, GitLab, Bitbucket)

2. **Configure Environment**:
   - Add `GITHUB_TOKEN` in Environment Variables section
   - Optionally add KV credentials for distributed rate limiting

3. **Deploy**:
   - Click "Deploy"
   - Vercel automatically detects the configuration from `vercel.json`

**Vercel Project Settings**:
- Build Command: **(leave empty - no build required)**
- Output Directory: **(leave empty)**
- Framework Preset: **Other**
- Node.js Version: **18.x or higher**

The `vercel.json` file includes:
- Function timeout configuration (15 seconds)
- Production-ready cache headers
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)

### Custom Domain (Optional)

After deployment:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS as instructed by Vercel

## Local Development

### Quick Start - Static Frontend

For rapid frontend development without API functionality:

```bash
# Using Python (built-in on most systems)
python3 -m http.server 5500

# Or using Node.js http-server (install: npm i -g http-server)
http-server -p 5500
```

Then open `http://localhost:5500` in your browser.

**Note**: API calls will fail without the serverless backend. This mode is useful for UI/styling work.

### Full Local Development with Vercel CLI

To test the complete application including API routes:

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Set Up Environment**:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your GITHUB_TOKEN
```

3. **Run Development Server**:
```bash
vercel dev
```

The application will be available at `http://localhost:3000` with:
- Static files served locally
- API routes running in serverless simulation
- Hot reloading for code changes
- Environment variables loaded from `.env`

### Development Tips

- **Testing API**: Use tools like Postman or curl to test the `/api/analyze` endpoint directly
- **Mock Data**: For frontend development, consider caching API responses to avoid rate limits
- **Live Reloading**: Vercel CLI auto-reloads on file changes
- **Debug Mode**: Check browser console for detailed error messages

## Security & Reliability

### Security Measures

1. **Input Validation**:
   - Sanitization of GitHub usernames and URLs
   - Regex-based validation before API calls
   - Prevention of code injection attacks

2. **API Security**:
   - GitHub tokens stored server-side only (never exposed to browser)
   - Security headers configured in `vercel.json`:
     - `X-Frame-Options: DENY` (prevents clickjacking)
     - `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
     - `Referrer-Policy: strict-origin-when-cross-origin`

3. **Rate Limiting**:
   - Protection against API abuse
   - Configurable thresholds per IP address
   - 429 Too Many Requests responses with `Retry-After` headers
   - Optional distributed rate limiting for scaled deployments

### Error Handling

DevDetective gracefully handles multiple failure scenarios:

- **Invalid Input**: User-friendly validation messages
- **User Not Found**: Clear 404 messaging with suggestions
- **Network Failures**: Timeout handling with retry guidance
- **GitHub API Errors**: Upstream error detection and reporting
- **Rate Limit Exceeded**: Automatic retry-after calculation
- **Server Errors**: Generic error messages without leaking internals

### Performance & Reliability

- **Request Timeouts**: 10-second default prevents hanging requests
- **Concurrent Request Handling**: De-duplication prevents redundant GitHub API calls
- **Graceful Degradation**: Fallback to REST API when GraphQL fails
- **Cache Staleness**: `stale-while-revalidate` ensures fast responses even during revalidation

## API Documentation

### Endpoint

```
GET /api/analyze?username={input}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | GitHub username, `@username`, or full profile URL |

### Example Requests

```bash
# Using username
curl "https://dev-detective-t5y7.vercel.app/api/analyze?username=torvalds"

# Using @mention format
curl "https://dev-detective-t5y7.vercel.app/api/analyze?username=@torvalds"

# Using full URL
curl "https://dev-detective-t5y7.vercel.app/api/analyze?username=https://github.com/torvalds"
```

### Response Format

**Success (200 OK)**:
```json
{
  "ok": true,
  "data": {
    "profile": {
      "username": "torvalds",
      "name": "Linus Torvalds",
      "avatar_url": "https://...",
      "bio": "...",
      "followers": 12345,
      "following": 0,
      "public_repos": 5
    },
    "scoring": {
      "overallScore": 87,
      "grade": "A",
      "hireabilityScore": 92,
      "readinessLevel": "Interview Ready",
      "subscores": { /* 7 category scores */ }
    },
    "insights": {
      "strengths": ["..."],
      "redFlags": ["..."],
      "suggestions": ["..."],
      "hiddenRisks": ["..."]
    },
    "career": {
      "recommendedPath": "Backend Engineer",
      "confidence": "High",
      "skills": ["..."]
    },
    "repositories": { /* top repos ranked */ },
    "analytics": { /* language distribution, etc */ }
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid username format
- `404 Not Found`: GitHub user does not exist
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side error
- `503 Service Unavailable`: GitHub API unavailable

### Response Headers

- `X-Cache`: `HIT`, `MISS`, or `INFLIGHT` (indicates cache status)
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset-At`: ISO timestamp when rate limit resets
- `Cache-Control`: CDN and browser caching directives
- `Retry-After`: (on 429) Seconds until retry allowed

## Scoring Methodology

DevDetective uses a weighted scoring system across seven key dimensions. The overall score (0-100) is calculated as a weighted sum of category subscores.

### Scoring Categories

1. **Documentation Quality (18% weight)**
   - Formula: `0.75 × README Coverage + 0.25 × Description Coverage`
   - Evaluates: Presence and quality of README files and repository descriptions
   - Rationale: Good documentation indicates professionalism and maintainability

2. **Code Activity / Consistency (17% weight)**
   - Formula: `0.60 × Active Months (last 6) + 0.40 × Repos Updated in 90 Days`
   - Evaluates: Regularity of commits and recent repository updates
   - Rationale: Consistent activity demonstrates sustained engagement

3. **Project Popularity (15% weight)**
   - Formula: `0.60 × Stars/Repo + 0.25 × Forks/Repo + 0.15 × Watchers/Repo`
   - Evaluates: Community engagement with repositories (capped to avoid outliers)
   - Rationale: Popular projects indicate valuable contributions

4. **Repository Completeness (14% weight)**
   - Formula: `0.50 × Non-empty Ratio + 0.30 × Homepage Presence + 0.20 × Topics Tagged`
   - Evaluates: Repository metadata completeness
   - Rationale: Complete profiles are more discoverable and professional

5. **Language Diversity (10% weight)**
   - Formula: `0.70 × Unique Languages + 0.30 × Shannon Entropy`
   - Evaluates: Breadth of programming language experience
   - Rationale: Polyglot developers are often more versatile

6. **Recent Activity (14% weight)**
   - Formula: `0.70 × Recency Bucket + 0.30 × Repos Updated in 30 Days`
   - Evaluates: How recently the developer has been active
   - Rationale: Recent activity suggests current skill relevance

7. **Impact Signals (12% weight)**
   - Formula: `0.35 × Top Repo Stars + 0.25 × Followers + 0.25 × PRs + 0.15 × Issues`
   - Evaluates: Broader community impact and collaboration
   - Rationale: PRs and issues indicate community contribution

### Hireability Score

Separate from the portfolio score, the hireability score (0-100) emphasizes recruiter-relevant factors:
- Active contribution patterns
- Repository quality over quantity
- Community engagement (followers, PR participation)
- Recent activity signals

### Readiness Levels

Based on combined scores, portfolios are classified into readiness levels:
- **Interview Ready** (80+): Strong portfolio, minimal concerns
- **Almost There** (60-79): Good foundation, some improvements needed
- **Building Up** (40-59): Developing portfolio, several gaps to address
- **Getting Started** (0-39): Early stage, needs significant development

## Technology Stack

### Frontend
- **HTML5**: Semantic markup with accessibility attributes
- **CSS3**: Custom properties (CSS variables) for theming, CSS Grid & Flexbox layouts
- **JavaScript (ES6+)**: Vanilla JS with modern features (modules, async/await, fetch API)
- **Chart.js**: Data visualization library for analytics charts
- **Service Worker**: PWA functionality with offline support

### Backend
- **Node.js**: Runtime for serverless functions (v18+)
- **Vercel Serverless Functions**: Zero-config deployment platform
- **GitHub REST API**: Primary data source for user and repository information
- **GitHub GraphQL API**: For pinned repositories (when authenticated)

### Infrastructure
- **Vercel CDN**: Global content delivery network
- **Vercel KV / Upstash** (optional): Distributed key-value store for rate limiting
- **No Database Required**: Fully stateless architecture with intelligent caching

### Development Tools
- **Git**: Version control
- **Vercel CLI**: Local development environment
- **ES Modules**: Native JavaScript modules (no bundler required)

## Browser Compatibility

DevDetective supports modern browsers with ES6+ capabilities:

- **Chrome/Edge**: Version 90+
- **Firefox**: Version 88+
- **Safari**: Version 14+
- **Opera**: Version 76+

Features requiring polyfills for older browsers:
- ES6 Modules
- Async/await
- Fetch API
- CSS Grid
- CSS Custom Properties

## Contributing

We welcome contributions! Here's how you can help:

### Reporting Issues

1. Check existing issues to avoid duplicates
2. Use issue templates when available
3. Provide detailed reproduction steps
4. Include browser/environment information

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Test locally using `vercel dev`
5. Commit with clear messages (`git commit -m 'Add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request with a detailed description

### Development Guidelines

- **Keep it Simple**: Prefer vanilla JavaScript over frameworks
- **No Build Step**: Avoid adding build dependencies
- **Minimal Dependencies**: Only add npm packages if absolutely necessary
- **Code Style**: Follow existing patterns (ES6 modules, async/await)
- **Comments**: Add comments for complex logic only
- **Testing**: Manually test all changes locally before submitting

### Areas for Contribution

- 🎨 UI/UX improvements and accessibility enhancements
- 📊 Additional scoring metrics or visualizations
- 🌐 Internationalization and localization
- 📱 Mobile experience optimization
- 🧪 Testing infrastructure
- 📝 Documentation improvements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **GitHub API**: For providing comprehensive developer data
- **Vercel**: For serverless platform and excellent DX
- **Chart.js**: For beautiful data visualizations
- **Community**: For feedback and contributions

## Support & Contact

- **Issues**: Report bugs via [GitHub Issues](https://github.com/sudheerxdev/Dev-Detective/issues)
- **Discussions**: Feature requests and questions in [GitHub Discussions](https://github.com/sudheerxdev/Dev-Detective/discussions)
- **Live Demo**: https://dev-detective-t5y7.vercel.app/

## Limitations & Future Enhancements

### Current Limitations

- Commit consistency approximated via `pushed_at` metadata (not true commit timestamps)
- Deep README/language analysis limited to top repositories (performance & API quota)
- No private repository analysis (requires GitHub OAuth implementation)
- Language detection based on GitHub's linguist (may not reflect actual codebase)

### Planned Features

- 🔐 OAuth authentication for private repo analysis
- 📈 Historical trend tracking for portfolio evolution
- 🤝 Team/organization portfolio analysis
- 🎯 Custom scoring weights for different role types
- 💬 AI-powered commit message quality analysis
- 🏆 Portfolio comparison and benchmarking

---

**Built with ❤️ for the developer community**
