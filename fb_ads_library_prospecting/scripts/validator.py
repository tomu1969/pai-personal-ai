#!/usr/bin/env python3
"""
Module 6: Pipeline Validator
Validates final output against source data and checks for missing fields.
Run after exporter.py to verify data quality.
"""

import json
import pandas as pd
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).parent.parent
SOURCE_FILE = BASE_DIR / "processed" / "01_loaded.csv"
ENRICHED_FILE = BASE_DIR / "processed" / "02_enriched.csv"
HUNTER_FILE = BASE_DIR / "processed" / "03b_hunter.csv"
EMAILS_FILE = BASE_DIR / "output" / "email_drafts.json"
FINAL_CSV = BASE_DIR / "output" / "prospects_final.csv"


def load_data():
    """Load all pipeline data files."""
    data = {}

    if SOURCE_FILE.exists():
        data['source'] = pd.read_csv(SOURCE_FILE)
        print(f"Loaded source: {len(data['source'])} rows")

    if ENRICHED_FILE.exists():
        data['enriched'] = pd.read_csv(ENRICHED_FILE)
        print(f"Loaded enriched: {len(data['enriched'])} rows")

    if HUNTER_FILE.exists():
        data['hunter'] = pd.read_csv(HUNTER_FILE)
        print(f"Loaded hunter: {len(data['hunter'])} rows")

    if EMAILS_FILE.exists():
        with open(EMAILS_FILE, 'r') as f:
            data['emails'] = json.load(f)
        print(f"Loaded emails: {len(data['emails'])} drafts")

    if FINAL_CSV.exists():
        data['final'] = pd.read_csv(FINAL_CSV)
        print(f"Loaded final: {len(data['final'])} rows")

    return data


def check_missing_fields(emails):
    """Check for missing contact names and emails in drafts."""
    issues = {
        'missing_email': [],
        'missing_contact': [],
        'missing_both': [],
        'complete': []
    }

    for prospect in emails:
        page_name = prospect.get('page_name', 'Unknown')
        has_email = bool(prospect.get('primary_email') or prospect.get('emails') or prospect.get('hunter_emails'))
        has_contact = bool(prospect.get('contact_name') and prospect.get('contact_name').strip())

        if not has_email and not has_contact:
            issues['missing_both'].append(page_name)
        elif not has_email:
            issues['missing_email'].append(page_name)
        elif not has_contact:
            issues['missing_contact'].append(page_name)
        else:
            issues['complete'].append(page_name)

    return issues


def check_coherence(data):
    """Check data coherence between source and final output."""
    coherence_issues = []

    if 'source' not in data or 'emails' not in data:
        return ["Cannot check coherence: missing source or emails data"]

    source_df = data['source']
    emails = data['emails']

    # Create lookup by page_name
    source_lookup = {row['page_name']: row for _, row in source_df.iterrows()}

    for prospect in emails:
        page_name = prospect.get('page_name')
        if not page_name:
            coherence_issues.append(f"Missing page_name in email draft")
            continue

        if page_name not in source_lookup:
            coherence_issues.append(f"'{page_name}' not found in source data")
            continue

        source_row = source_lookup[page_name]

        # Check ad_count matches
        source_ad_count = int(source_row.get('ad_count', 0))
        email_ad_count = int(prospect.get('ad_count', 0))

        if source_ad_count != email_ad_count:
            coherence_issues.append(
                f"'{page_name}': ad_count mismatch - source={source_ad_count}, email={email_ad_count}"
            )

        # Check email body mentions correct ad count
        email_body = prospect.get('email_body', '')
        expected_phrase = f"{source_ad_count} ad" if source_ad_count == 1 else f"{source_ad_count} ads"

        if expected_phrase not in email_body:
            coherence_issues.append(
                f"'{page_name}': email body doesn't mention '{expected_phrase}'"
            )

    return coherence_issues


def check_email_quality(emails):
    """Check email quality issues."""
    quality_issues = []

    bad_patterns = [
        ('Hi None', 'Bad greeting: Hi None'),
        ('Hi nan', 'Bad greeting: Hi nan'),
        ('Hi Nan', 'Bad greeting: Hi Nan'),
        ('Hi null', 'Bad greeting: Hi null'),
        ('{{', 'Unresolved template variable'),
        ('}}', 'Unresolved template variable'),
        ('[NAME]', 'Placeholder not replaced'),
        ('[COMPANY]', 'Placeholder not replaced'),
        ('ad(s)', 'Poor pluralization'),
    ]

    for prospect in emails:
        page_name = prospect.get('page_name', 'Unknown')
        email_body = prospect.get('email_body', '')
        email_subject = prospect.get('email_subject', '')

        for pattern, issue_type in bad_patterns:
            if pattern in email_body or pattern in email_subject:
                quality_issues.append(f"'{page_name}': {issue_type} - found '{pattern}'")

        # Check email is not too short
        if len(email_body) < 100:
            quality_issues.append(f"'{page_name}': Email body too short ({len(email_body)} chars)")

        # Check subject exists
        if not email_subject:
            quality_issues.append(f"'{page_name}': Missing email subject")

    return quality_issues


def check_enrichment_success(data):
    """Check how well enrichment worked."""
    stats = defaultdict(int)
    details = defaultdict(list)

    if 'enriched' in data:
        df = data['enriched']
        for _, row in df.iterrows():
            page_name = row['page_name']

            if pd.isna(row.get('website_url')) or not row.get('website_url'):
                stats['no_website'] += 1
                details['no_website'].append(page_name)
            else:
                confidence = row.get('search_confidence', 0)
                if confidence < 0.5:
                    stats['low_confidence_website'] += 1
                    details['low_confidence_website'].append(f"{page_name} ({confidence:.2f})")

    if 'hunter' in data:
        df = data['hunter']
        for _, row in df.iterrows():
            page_name = row['page_name']

            # Check for valid email
            primary_email = row.get('primary_email', '')
            if pd.isna(primary_email) or not primary_email:
                stats['no_hunter_email'] += 1
                details['no_hunter_email'].append(page_name)

            # Check verification status (only for those WITH emails)
            if primary_email and not pd.isna(primary_email):
                verified = str(row.get('email_verified', ''))
                if verified and verified.lower() not in ['valid', 'accept_all', 'nan', '']:
                    stats['unverified_email'] += 1
                    details['unverified_email'].append(f"{page_name} ({verified})")

    return stats, details


def generate_report(data):
    """Generate comprehensive validation report."""
    print("\n" + "=" * 70)
    print("PIPELINE VALIDATION REPORT")
    print("=" * 70)

    emails = data.get('emails', [])

    # 1. Missing Fields Check
    print("\n1. MISSING FIELDS ANALYSIS")
    print("-" * 50)
    issues = check_missing_fields(emails)

    print(f"   Complete (email + contact): {len(issues['complete'])}")
    print(f"   Missing email only:         {len(issues['missing_email'])}")
    print(f"   Missing contact only:       {len(issues['missing_contact'])}")
    print(f"   Missing both:               {len(issues['missing_both'])}")

    if issues['missing_both']:
        print(f"\n   Prospects missing BOTH email and contact:")
        for name in issues['missing_both']:
            print(f"      - {name}")

    if issues['missing_email']:
        print(f"\n   Prospects missing email (have contact):")
        for name in issues['missing_email']:
            print(f"      - {name}")

    # 2. Data Coherence Check
    print("\n2. DATA COHERENCE CHECK")
    print("-" * 50)
    coherence_issues = check_coherence(data)

    if coherence_issues:
        print(f"   Found {len(coherence_issues)} coherence issues:")
        for issue in coherence_issues[:10]:  # Show first 10
            print(f"      - {issue}")
        if len(coherence_issues) > 10:
            print(f"      ... and {len(coherence_issues) - 10} more")
    else:
        print("   All data is coherent with source")

    # 3. Email Quality Check
    print("\n3. EMAIL QUALITY CHECK")
    print("-" * 50)
    quality_issues = check_email_quality(emails)

    if quality_issues:
        print(f"   Found {len(quality_issues)} quality issues:")
        for issue in quality_issues[:10]:
            print(f"      - {issue}")
        if len(quality_issues) > 10:
            print(f"      ... and {len(quality_issues) - 10} more")
    else:
        print("   All emails pass quality checks")

    # 4. Enrichment Success Stats
    print("\n4. ENRICHMENT SUCCESS STATS")
    print("-" * 50)
    stats, details = check_enrichment_success(data)

    total = len(emails)
    print(f"   Total prospects:            {total}")
    print(f"   No website found:           {stats['no_website']} ({100*stats['no_website']/total:.1f}%)")
    print(f"   Low confidence websites:    {stats['low_confidence_website']}")
    print(f"   No Hunter email:            {stats['no_hunter_email']} ({100*stats['no_hunter_email']/total:.1f}%)")
    print(f"   Unverified emails:          {stats['unverified_email']}")

    if details['no_website']:
        print(f"\n   Prospects without website:")
        for name in details['no_website']:
            print(f"      - {name}")

    # 5. Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total_issues = (
        len(issues['missing_both']) +
        len(coherence_issues) +
        len(quality_issues)
    )

    if total_issues == 0:
        print("   STATUS: ALL CHECKS PASSED")
    else:
        print(f"   STATUS: {total_issues} ISSUES FOUND")
        print(f"   - {len(issues['missing_both'])} prospects with no contact data")
        print(f"   - {len(coherence_issues)} data coherence issues")
        print(f"   - {len(quality_issues)} email quality issues")

    print("\n   Recommendations:")
    if issues['missing_both']:
        print("   - Manual research needed for prospects missing both email and contact")
    if stats['no_website'] > 0:
        print("   - Consider adding website overrides for prospects without websites")
    if stats['no_hunter_email'] > total * 0.5:
        print("   - High percentage of missing emails - consider alternative sources")

    print("=" * 70 + "\n")

    return total_issues == 0


def main():
    print("=== Pipeline Validator ===\n")

    data = load_data()

    if not data:
        print("ERROR: No data files found. Run the pipeline first.")
        return False

    success = generate_report(data)

    return success


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
