#!/usr/bin/env python3
"""
ML Model Service Wrapper
========================

Provides a simple interface between Node.js and the multi_feature_linucb model.
This service:
1. Loads/saves the trained model from pickle
2. Makes predictions on new tasks
3. Updates the model with training signals (rewards)
4. Supports both JSON RPC and CLI modes

Usage:
    # As a library (imported from Node.js service)
    from model_service import ModelService
    service = ModelService()
    result = service.predict({'motivation': 4, 'duration': 60, ...})

    # As a CLI tool
    python model_service.py predict '{"motivation": 4, "duration": 60, ...}'
    python model_service.py train '{"motivation": 4, ...}' 0.75

Note: Does NOT modify the predict_model/ files. Only loads and uses them.
"""

import json
import sys
import os
import pickle
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

# Import the model and feature extractor from the linucb package
from linucb import MultiFeatureLinUCB, extract_features


class ModelService:
    """Wrapper service for the LinUCB ML model."""

    # Standard task categories (must match ML_CATEGORIES in mlInputConverter.js)
    CATEGORIES = [
        "study_and_education",
        "skill_building",
        "workout",
        "reflection",
        "home_and_chores",
        "family",
        "life_management",
        "work_and_career",
        "creative_projects",
        "hobbies",
        "relationship",
        "goals",
        "mindfulness",
        "health",
        "social_activity",
        "recovery",
        "exploration",
        "uncategorized",
    ]

    # Model hyperparameters
    ALPHA = 0.1  # Exploration parameter for LinUCB
    MAX_DURATION = 120  # Maximum task duration in minutes (for feature normalization)

    def __init__(self, model_path: Optional[str] = None, user_id: Optional[str] = None):
        """
        Initialize the model service.

        Args:
            model_path: Path to pickle file for model persistence.
                       If None and user_id provided, uses 'user_models/model_{user_id}.pkl'
                       If None and no user_id, uses 'model.pkl' (legacy global model)
            user_id: User ID for per-user model persistence.
        """
        if model_path is None:
            script_dir = Path(__file__).parent
            if user_id:
                # Store per-user models in user_models subdirectory
                user_models_dir = script_dir / "user_models"
                user_models_dir.mkdir(exist_ok=True)  # Create directory if it doesn't exist
                model_path = user_models_dir / f"model_{user_id}.pkl"
            else:
                model_path = script_dir / "model.pkl"
        
        self.model_path = Path(model_path)
        self.user_id = user_id
        self.model = self._load_or_create_model()

    def _load_or_create_model(self) -> MultiFeatureLinUCB:
        """
        Load model from pickle if it exists, otherwise create a new one.

        Returns:
            MultiFeatureLinUCB: The loaded or newly created model.
        """
        if self.model_path.exists():
            try:
                with open(self.model_path, 'rb') as f:
                    model = pickle.load(f)
                user_context = f" for user {self.user_id}" if self.user_id else " (global)"
                print(f"✅ Loaded model from {self.model_path}{user_context}", file=sys.stderr)
                return model
            except Exception as e:
                print(f"⚠️  Failed to load model: {e}. Creating new model.", file=sys.stderr)

        # Calculate total number of features:
        # motivation=1 + duration=2 + difficulty=3 + pressure=4 + category=18
        total_features = 1 + 2 + 3 + 4 + len(self.CATEGORIES)
        
        # Create fresh model
        model = MultiFeatureLinUCB(
            n_features=total_features,
            alpha=self.ALPHA
        )
        user_context = f" for user {self.user_id}" if self.user_id else " (global)"
        print(f"✅ Created new model with {total_features} features{user_context}", file=sys.stderr)
        return model

    def _save_model(self) -> None:
        """Persist the model to pickle file."""
        try:
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
        except Exception as e:
            print(f"⚠️  Failed to save model: {e}", file=sys.stderr)

    def predict(self, task_input: Dict[str, Any], subcategory_map: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
        """
        Predict completion difficulty and confidence for a task.

        Input format (from mlInputConverter.taskToMLInput):
        {
            'motivation': 1-5,        # Task importance
            'duration': float,        # Estimated minutes
            'difficulty': 1-5,        # Task effort
            'delta_hours': float,     # Hours until deadline (0 if no deadline)
            'category': 0-17,         # Task category (index into CATEGORIES)
            'subcategory': str,       # Optional subcategory name
        }

        Output:
        {
            'score': 0-1,             # Prediction confidence
            'category': 1-5,          # Predicted completion difficulty (1=easy, 5=hard)
            'success': True
        }

        Args:
            task_input: Dict with required fields as above

        Returns:
            Dict with 'score', 'category', and 'success' keys
        """
        try:
            # Validate required fields
            required = {'motivation', 'duration', 'difficulty', 'delta_hours', 'category'}
            if not required.issubset(task_input.keys()):
                missing = required - task_input.keys()
                raise ValueError(f"Missing required fields: {missing}")

            # Extract features using the model's feature engineering
            subcategory = task_input.get('subcategory', None)
            features = extract_features(
                motivation=task_input['motivation'],
                duration=task_input['duration'],
                difficulty=task_input['difficulty'],
                delta_hours=task_input['delta_hours'],
                category=self.CATEGORIES[task_input['category']],
                categories=self.CATEGORIES,
                max_duration=self.MAX_DURATION,
                subcategory=subcategory,
                subcategory_map=subcategory_map
            )

            # Get predictions from the model
            score = self.model.predict_score(features)      # 0-1 confidence
            category = self.model.predict_category(features)  # 1-5 difficulty

            # Persist model file after first prediction (ensures file exists)
            if not self.model_path.exists():
                self._save_model()

            return {
                'score': float(score),
                'category': int(category),
                'success': True
            }

        except Exception as e:
            print(f"❌ Prediction error: {e}", file=sys.stderr)
            # Return safe defaults on error
            return {
                'score': 0.5,       # Neutral confidence
                'category': 3,      # Medium difficulty
                'success': False,
                'error': str(e)
            }

    def train(self, task_input: Dict[str, Any], reward: float, subcategory_map: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
        """
        Update the model with observed task completion data.

        This is called after a task is completed to teach the model
        from the actual outcome.

        Args:
            task_input: Same format as predict() - task features
            reward: 0-1 confidence score from calculateReward()
                   (1.0 = completed at estimated time, 0.0 = very inaccurate)

        Returns:
            Dict with 'success' and metadata about the update
        """
        try:
            # Validate inputs
            required = {'motivation', 'duration', 'difficulty', 'delta_hours', 'category'}
            if not required.issubset(task_input.keys()):
                missing = required - task_input.keys()
                raise ValueError(f"Missing required fields: {missing}")

            if not (0 <= reward <= 1):
                raise ValueError(f"Reward must be in [0, 1], got {reward}")

            # Extract features
            subcategory = task_input.get('subcategory', None)
            features = extract_features(
                motivation=task_input['motivation'],
                duration=task_input['duration'],
                difficulty=task_input['difficulty'],
                delta_hours=task_input['delta_hours'],
                category=self.CATEGORIES[task_input['category']],
                categories=self.CATEGORIES,
                max_duration=self.MAX_DURATION,
                subcategory=subcategory,
                subcategory_map=subcategory_map
            )

            # Update model weights
            self.model.update(features, reward=reward)

            # Persist model after training
            self._save_model()

            return {
                'success': True,
                'reward': reward,
                'message': f"Model updated with reward {reward}"
            }

        except Exception as e:
            print(f"❌ Training error: {e}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }

    def health_check(self) -> Dict[str, Any]:
        """Return service health status."""
        return {
            'status': 'healthy',
            'model_loaded': self.model is not None,
            'model_path': str(self.model_path),
            'categories': self.CATEGORIES
        }


def main():
    """
    CLI interface for the model service.

    Usage:
        python model_service.py predict <userId> '{"motivation": 4, "duration": 60, ...}'
        python model_service.py train <userId> '{"motivation": 4, ...}' 0.75
        python model_service.py health [userId]
    """
    if len(sys.argv) < 2:
        print("Usage: python model_service.py <command> <userId> [args...]", file=sys.stderr)
        print("Commands:", file=sys.stderr)
        print("  predict <userId> <json>  - Predict on task for specific user", file=sys.stderr)
        print("  train <userId> <json> <reward>  - Train on completed task for specific user", file=sys.stderr)
        print("  health [userId]  - Check service health", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    
    # Extract userId if provided (not for health check without userId)
    user_id = None
    arg_offset = 2
    if command in ['predict', 'train']:
        if len(sys.argv) < 3:
            print(f"❌ {command} requires userId argument", file=sys.stderr)
            sys.exit(1)
        user_id = sys.argv[2]
        arg_offset = 3
    elif command == 'health' and len(sys.argv) >= 3:
        user_id = sys.argv[2]
        arg_offset = 3
    
    service = ModelService(user_id=user_id)

    try:
        if command == 'predict':
            if len(sys.argv) < arg_offset + 1:
                print("❌ predict requires payload JSON argument", file=sys.stderr)
                sys.exit(1)
            payload = json.loads(sys.argv[arg_offset])
            task_input = payload.get('task', payload)  # Support both {task: ..., subcategory_map: ...} and direct task
            subcategory_map = payload.get('subcategory_map', None)
            result = service.predict(task_input, subcategory_map)
            print(json.dumps(result))

        elif command == 'train':
            if len(sys.argv) < arg_offset + 2:
                print("❌ train requires payload JSON and reward arguments", file=sys.stderr)
                sys.exit(1)
            payload = json.loads(sys.argv[arg_offset])
            task_input = payload.get('task', payload)  # Support both formats
            subcategory_map = payload.get('subcategory_map', None)
            reward = float(sys.argv[arg_offset + 1])
            result = service.train(task_input, reward, subcategory_map)
            print(json.dumps(result))

        elif command == 'health':
            result = service.health_check()
            print(json.dumps(result))

        else:
            print(f"❌ Unknown command: {command}", file=sys.stderr)
            sys.exit(1)

    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
