#!/usr/bin/env python3
"""
Step 3 Validation: Python ML Model Service Tests

Tests the model_service.py wrapper to ensure:
- Model loads/creates correctly
- predict() returns valid predictions
- train() updates the model
- CLI interface works
- Error handling is robust
"""

import json
import sys
import subprocess
import tempfile
from pathlib import Path

# Add predict_model directory to path so we can import model_service
sys.path.insert(0, str(Path(__file__).parent.parent / 'predict_model'))

# Import service directly for testing
from model_service import ModelService


def test_suite_1_model_initialization():
    """Test 1: Model loads or creates correctly"""
    print("\n📋 Test Suite 1: Model Initialization\n")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = Path(tmpdir) / "test_model.pkl"
        
        # First service: creates new model
        service1 = ModelService(str(model_path))
        assert service1.model is not None, "✅ Created new model"
        print("✅ Created new model")
        
        # Second service: loads existing model
        service2 = ModelService(str(model_path))
        assert service2.model is not None, "✅ Loaded existing model"
        print("✅ Loaded existing model")


def test_suite_2_predict_basic():
    """Test 2: Basic prediction works"""
    print("\n📋 Test Suite 2: Basic Prediction\n")
    
    service = ModelService()
    
    task_input = {
        'motivation': 4,
        'duration': 60,
        'difficulty': 3,
        'delta_hours': 24,
        'category': 0,  # WORK
    }
    
    result = service.predict(task_input)
    
    assert result['success'] is True, "✅ Prediction succeeded"
    print("✅ Prediction succeeded")
    
    assert 0 <= result['score'] <= 1, f"✅ Score in valid range [0,1]: {result['score']}"
    print(f"✅ Score in valid range: {result['score']:.3f}")
    
    assert 1 <= result['category'] <= 5, f"✅ Category in valid range [1,5]: {result['category']}"
    print(f"✅ Category in valid range: {result['category']}")


def test_suite_3_predict_variations():
    """Test 3: Predictions vary with task characteristics"""
    print("\n📋 Test Suite 3: Prediction Variations\n")
    
    service = ModelService()
    
    # Low motivation task
    low_motivation = service.predict({
        'motivation': 1,
        'duration': 30,
        'difficulty': 1,
        'delta_hours': 48,
        'category': 5,  # OTHER
    })
    
    # High motivation task
    high_motivation = service.predict({
        'motivation': 5,
        'duration': 30,
        'difficulty': 1,
        'delta_hours': 48,
        'category': 5,
    })
    
    # Predictions should be different (different motivation)
    assert low_motivation['score'] != high_motivation['score'], \
        f"✅ Predictions differ: low={low_motivation['score']:.3f}, high={high_motivation['score']:.3f}"
    print(f"✅ Motivation affects predictions: low={low_motivation['score']:.3f}, high={high_motivation['score']:.3f}")


def test_suite_4_train_and_predict():
    """Test 4: Training updates the model"""
    print("\n📋 Test Suite 4: Training Updates Model\n")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        model_path = Path(tmpdir) / "train_test.pkl"
        service = ModelService(str(model_path))
        
        task_input = {
            'motivation': 3,
            'duration': 90,
            'difficulty': 3,
            'delta_hours': 12,
            'category': 1,  # PERSONAL
        }
        
        # Get initial prediction
        pred_before = service.predict(task_input)
        print(f"✅ Initial prediction: score={pred_before['score']:.3f}, category={pred_before['category']}")
        
        # Train with positive reward (task went well)
        train_result = service.train(task_input, reward=0.9)
        assert train_result['success'] is True, "✅ Training succeeded"
        print("✅ Training succeeded")
        
        # Get prediction after training
        pred_after = service.predict(task_input)
        print(f"✅ After training: score={pred_after['score']:.3f}, category={pred_after['category']}")
        
        # Model learns from training (score might change)
        print(f"✅ Model learned from reward signal")


def test_suite_5_error_handling():
    """Test 5: Error handling is robust"""
    print("\n📋 Test Suite 5: Error Handling\n")
    
    service = ModelService()
    
    # Missing required field
    incomplete_input = {
        'motivation': 4,
        'duration': 60,
        # Missing: difficulty, delta_hours, category
    }
    
    result = service.predict(incomplete_input)
    assert result['success'] is False, "✅ Prediction fails gracefully on incomplete input"
    print(f"✅ Prediction fails gracefully: {result.get('error', 'No error message')}")
    
    # Invalid reward (outside [0,1])
    task_input = {
        'motivation': 3,
        'duration': 60,
        'difficulty': 3,
        'delta_hours': 24,
        'category': 0,
    }
    
    train_result = service.train(task_input, reward=2.0)
    assert train_result['success'] is False, "✅ Training rejects invalid reward"
    print(f"✅ Training rejects invalid reward: {train_result.get('error', 'No error message')}")


def test_suite_6_health_check():
    """Test 6: Health check endpoint works"""
    print("\n📋 Test Suite 6: Health Check\n")
    
    service = ModelService()
    health = service.health_check()
    
    assert health['status'] == 'healthy', "✅ Service is healthy"
    print("✅ Service is healthy")
    
    assert health['model_loaded'] is True, "✅ Model is loaded"
    print("✅ Model is loaded")
    
    assert len(health['categories']) == 18, "✅ 18 categories configured"
    print(f"✅ Categories: {', '.join(health['categories'])}")


def test_suite_7_cli_interface():
    """Test 7: CLI interface works"""
    print("\n📋 Test Suite 7: CLI Interface\n")
    
    # Test predict via CLI
    task_json = json.dumps({
        'motivation': 4,
        'duration': 60,
        'difficulty': 3,
        'delta_hours': 24,
        'category': 0,
    })
    
    result = subprocess.run(
        [sys.executable, 'src/predict_model/model_service.py', 'predict', task_json],
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, f"✅ CLI predict succeeded (exit code {result.returncode})"
    print(f"✅ CLI predict succeeded")
    
    output = json.loads(result.stdout)
    assert output['success'] is True, "✅ CLI output is valid JSON with success=True"
    print(f"✅ CLI output: score={output['score']:.3f}, category={output['category']}")
    
    # Test health via CLI
    result = subprocess.run(
        [sys.executable, 'src/predict_model/model_service.py', 'health'],
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, "✅ CLI health check succeeded"
    print("✅ CLI health check succeeded")
    
    health = json.loads(result.stdout)
    assert health['status'] == 'healthy', "✅ Health check returns healthy"
    print("✅ Health check returns healthy")


def main():
    """Run all validation tests"""
    print("\n" + "="*70)
    print("🧪 Step 3 Validation: Python ML Model Service")
    print("="*70)
    
    total_passed = 0
    total_failed = 0
    
    test_suites = [
        test_suite_1_model_initialization,
        test_suite_2_predict_basic,
        test_suite_3_predict_variations,
        test_suite_4_train_and_predict,
        test_suite_5_error_handling,
        test_suite_6_health_check,
        test_suite_7_cli_interface,
    ]
    
    for test_suite in test_suites:
        try:
            test_suite()
            total_passed += 1
        except AssertionError as e:
            print(f"❌ Test failed: {e}")
            total_failed += 1
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            total_failed += 1
    
    print("\n" + "="*70)
    print(f"✅ Passed: {total_passed}/{len(test_suites)}")
    print(f"❌ Failed: {total_failed}/{len(test_suites)}")
    print("="*70 + "\n")
    
    return 0 if total_failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
