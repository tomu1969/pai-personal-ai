# Facebook Ads Library Prospecting Pipeline

Automated pipeline to convert Facebook Ads Library data into qualified prospects with personalized outreach emails for LaHaus AI.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env with your OPENAI_API_KEY and HUNTER_API_KEY

# Run full pipeline
python run_pipeline.py --all

# Or run in test mode (3 rows)
python run_pipeline.py
```

## Pipeline Overview

```
Module 1    Module 2    Module 3    Module 3.5   Module 4    Module 5    Module 6
Loader  →  Enricher →  Scraper  →   Hunter   →  Composer →  Exporter → Validator
  │           │           │            │            │           │           │
Excel      Search      Scrape      Hunter.io    OpenAI      CSV/JSON   Quality
           Websites    Contacts    Emails       GPT-4o                  Report
```

## Project Structure

```
fb_ads_library_prospecting/
├── run_pipeline.py       # Main orchestrator
├── scripts/
│   ├── loader.py         # Module 1: Load Excel data
│   ├── enricher.py       # Module 2: Find company websites
│   ├── scraper.py        # Module 3: Scrape contacts
│   ├── hunter.py         # Module 3.5: Hunter.io email enrichment
│   ├── composer.py       # Module 4: Generate personalized emails
│   ├── exporter.py       # Module 5: Export to CSV/Excel/JSON
│   ├── validator.py      # Module 6: Quality validation
│   └── progress.py       # Real-time progress monitor
├── input/                # Source Excel file
├── processed/            # Intermediate CSV files
├── output/               # Final prospect data
└── config/               # Settings and overrides
```

## Usage

### Run Full Pipeline
```bash
python run_pipeline.py --all
```

### Run Individual Modules
```bash
python scripts/loader.py
python scripts/enricher.py --all
python scripts/scraper.py --all
python scripts/hunter.py --all
python scripts/composer.py --all
python scripts/exporter.py
python scripts/validator.py
```

### Resume from Specific Module
```bash
python run_pipeline.py --all --from 3.5  # Resume from Hunter
```

### Monitor Progress (separate terminal)
```bash
python scripts/progress.py
```

## Output Files

| File | Description |
|------|-------------|
| `output/prospects_final.csv` | Complete prospect data |
| `output/prospects_final.xlsx` | Excel version with formatting |
| `output/email_drafts.json` | Ready-to-send personalized emails |

## Configuration

### Environment Variables (.env)
```
OPENAI_API_KEY=sk-...
HUNTER_API_KEY=...
```

### Website Overrides (config/website_overrides.csv)
Manually specify websites for prospects that can't be found automatically:
```csv
page_name,website_url
"Company Name","https://company.com"
```

## Current Pipeline Results

| Metric | Count | % |
|--------|-------|---|
| Total Prospects | 59 | 100% |
| Complete (email + contact) | 28 | 47% |
| Missing contact only | 13 | 22% |
| Missing both email & contact | 18 | 31% |
| Websites found | 52 | 88% |
| Hunter emails verified | 28 | 47% |

## Next Steps: Automating Missing Data Completion

### 1. Apollo.io Integration (Recommended)
Add Apollo.io as fallback for prospects where Hunter.io found no emails.

**Implementation:**
```python
# scripts/apollo.py
def search_person(name, company_domain):
    """Find person's email via Apollo.io People API"""
    # POST https://api.apollo.io/v1/people/match
    pass

def search_company(company_name):
    """Find company contacts via Apollo.io Organization API"""
    # POST https://api.apollo.io/v1/organizations/search
    pass
```

**Add to pipeline after Hunter:**
- Input: prospects with no Hunter email
- Output: updated 03b_hunter.csv with Apollo emails

### 2. LinkedIn Sales Navigator Scraping
For prospects with no website or email, extract contact info from LinkedIn.

**Implementation options:**
- **Phantombuster**: LinkedIn profile scraper (paid, reliable)
- **LinkedIn API**: Official API with limited access
- **Browser automation**: Selenium/Playwright (requires careful rate limiting)

**Data to extract:**
- Company LinkedIn URL → Employee list → Decision maker emails
- Use page_name to search LinkedIn Companies

### 3. Google Maps / Places API
For local real estate businesses, extract contact info from Google Business profiles.

**Implementation:**
```python
# scripts/google_places.py
def search_business(company_name, location="Miami"):
    """Find business contact via Google Places API"""
    # Returns: phone, website, address
    pass
```

### 4. Website Contact Form Detection
For prospects with websites but no email, detect and catalog contact forms.

**Implementation:**
```python
# scripts/contact_forms.py
def detect_contact_form(website_url):
    """Find contact form URL on website"""
    # Check /contact, /contact-us, /get-in-touch
    # Return form URL if found
    pass
```

### 5. Manual Research Queue
Export a prioritized list for manual research with helpful context.

**Implementation:**
```python
# scripts/research_queue.py
def export_research_queue():
    """Export prospects needing manual research"""
    # Priority: high ad count + high page likes = higher priority
    # Include: page_name, ad_count, website_url, ad_text samples
    # Output: output/manual_research_queue.csv
```

### 6. Email Finder Aggregator
Combine multiple email finding services for higher coverage.

**Services to integrate:**
- Hunter.io (current)
- Apollo.io
- Clearbit
- Snov.io
- FindThatLead
- Voila Norbert

**Implementation:**
```python
# scripts/email_aggregator.py
def find_email(name, domain, company):
    """Try multiple services until email found"""
    providers = [hunter, apollo, clearbit, snov]
    for provider in providers:
        email = provider.find(name, domain)
        if email:
            return email, provider.name
    return None, None
```

### 7. Automated Follow-up for Unverified Emails
For emails marked as "accept_all" or unverified, implement email verification.

**Tools:**
- NeverBounce
- ZeroBounce
- EmailListVerify

### Priority Implementation Order

1. **Apollo.io** - Highest ROI, good coverage, reasonable cost
2. **Manual Research Queue** - Quick win, helps prioritize human effort
3. **Google Places** - Good for local real estate businesses
4. **Email Aggregator** - Maximize coverage with multiple sources
5. **LinkedIn Scraping** - Most comprehensive but complex/risky

## Troubleshooting

### No emails found for a prospect
1. Check if website was found in `02_enriched.csv`
2. Try adding website manually to `config/website_overrides.csv`
3. Re-run from Hunter module: `python run_pipeline.py --from 3.5`

### "Hi None" in emails
Fixed in current version. If still occurring, run:
```bash
python scripts/composer.py --all
python scripts/exporter.py
```

### Rate limiting errors
- Enricher: Uses 2-second delays between requests
- Hunter: Uses 1-second delays
- Increase delays in script if needed

## API Requirements

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| OpenAI | Email generation | Pay per use |
| Hunter.io | Email finding/verification | 25 searches/month |
| DuckDuckGo | Website search | Unlimited (rate limited) |

## License

Internal use only - LaHaus AI
