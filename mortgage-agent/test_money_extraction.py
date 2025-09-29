#!/usr/bin/env python3
"""Quick test of money extraction"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.slot_extraction import extract_all_money

# Test the money extraction
result = extract_all_money("200k")
print(f"extract_all_money('200k') = {result}")

result = extract_all_money("$200k")
print(f"extract_all_money('$200k') = {result}")

result = extract_all_money("200000")
print(f"extract_all_money('200000') = {result}")