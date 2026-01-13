"""Quick test to verify unknown category raises error"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from src.predict_model.linucb import extract_features

categories = ['sport', 'study', 'work']

try:
    x = extract_features(
        motivation=4, 
        duration=45, 
        difficulty=3, 
        delta_hours=48, 
        category='music',  # Unknown!
        categories=categories
    )
    print("ERROR: Should have raised ValueError!")
except ValueError as e:
    print(f"SUCCESS: Caught expected error:\n  {e}")
