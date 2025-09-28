#!/usr/bin/env python
"""Quick test of the patches - tests deterministic extraction."""
import sys
sys.path.insert(0, '/Users/tomas/Desktop/ai_pbx/mortgage-agent')

from src.extraction_helpers import (
    parse_money,
    normalize_loan_purpose,
    parse_location,
    extract_from_message
)

print("\n" + "="*80)
print("QUICK PATCH TEST - Deterministic Extraction")
print("="*80)

# Test 1: Money parsing
print("\n### Test 1: Money Parsing ###")
test_cases = [
    "$50k",
    "$400,000",
    "I have 175k saved",
    "1.5 million"
]
for text in test_cases:
    result = parse_money(text)
    print(f"  '{text}' → {result}")

# Test 2: Loan purpose normalization
print("\n### Test 2: Loan Purpose ###")
test_cases = [
    "I want to rent it on Airbnb",
    "It's my primary residence",
    "vacation home",
    "investment property"
]
for text in test_cases:
    result = normalize_loan_purpose(text)
    print(f"  '{text}' → {result}")

# Test 3: Location parsing
print("\n### Test 3: Location ###")
test_cases = [
    "Miami, FL",
    "Dallas, Texas",
    "Seattle"
]
for text in test_cases:
    result = parse_location(text)
    print(f"  '{text}' → {result}")

# Test 4: Full extraction from message
print("\n### Test 4: Full Message Extraction ###")
messages = [
    ("$400k down, looking at $1.5M house in Seattle for investment", 1),
    ("I want to rent it on Airbnb", 3),
    ("Miami, Florida", 2)
]
for text, q_num in messages:
    result = extract_from_message(text, q_num, {})
    print(f"  Q{q_num}: '{text}' → {result}")

print("\n" + "="*80)
print("✅ All extraction tests completed!")
print("="*80 + "\n")