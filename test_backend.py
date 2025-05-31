#!/usr/bin/env python3
"""Test script to verify enhanced backend functionality"""

import requests
import json
import time
import traceback

BASE_URL = "http://localhost:8081"

def test_legacy_endpoints():
    """Test that legacy endpoints still work"""
    print("Testing legacy endpoints...")
    
    # Test GET /prompts
    try:
        print("Attempting GET /prompts...")
        resp = requests.get(f"{BASE_URL}/prompts")
        resp.raise_for_status()
        data = resp.json()
        assert 'templates' in data
        print("✓ GET /prompts works")
    except requests.exceptions.HTTPError as http_err:
        print(f"✗ GET /prompts HTTP error: {http_err}")
        if http_err.response is not None:
            print(f"✗ Response status: {http_err.response.status_code}, text: {http_err.response.text[:500]}")
    except Exception as e:
        print(f"✗ GET /prompts failed: {e}")
        traceback.print_exc()
    
    # Test POST /generate (without experiment_id - legacy mode)
    try:
        print("Attempting POST /generate (legacy)...")
        payload = {
            "model": "openrouter/anthropic/claude-3-haiku",
            "prompt": "Create a simple SVG circle"
        }
        resp = requests.post(f"{BASE_URL}/generate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        assert 'result' in data
        print("✓ POST /generate (legacy) works")
    except requests.exceptions.HTTPError as http_err:
        print(f"✗ POST /generate (legacy) HTTP error: {http_err}")
        if http_err.response is not None:
            print(f"✗ Response status: {http_err.response.status_code}, text: {http_err.response.text[:500]}")
    except Exception as e:
        print(f"✗ POST /generate (legacy) failed: {e}")
        traceback.print_exc()

def test_new_endpoints():
    """Test new database-backed endpoints"""
    print("\nTesting new database endpoints...")
    experiment_id = None
    
    try:
        # Create experiment
        print("Attempting to create experiment (POST /api/experiments)...")
        resp_exp = requests.post(f"{BASE_URL}/api/experiments", json={
            "name": "Backend Test Experiment",
            "description": "Testing enhanced backend"
        })
        print(f"POST /api/experiments status: {resp_exp.status_code}, response: {resp_exp.text[:200]}...")
        resp_exp.raise_for_status() 
        data_exp = resp_exp.json()
        assert 'experiment' in data_exp and 'id' in data_exp['experiment']
        experiment_id = data_exp['experiment']['id']
        print(f"✓ Created experiment: {experiment_id}")
        
        # Test generate with experiment_id (database storage)
        print(f"Attempting POST /generate for experiment_id: {experiment_id}...")
        payload_generate = {
            "model": "openrouter/anthropic/claude-3-haiku",
            "prompt": "Create an SVG of a red square",
            "experiment_id": experiment_id,
            "prompt_type": "base" # Add specific type for clarity
        }
        print(f"Payload for POST /generate: {json.dumps(payload_generate)}")
        resp_gen = requests.post(f"{BASE_URL}/generate", json=payload_generate)
        
        print(f"POST /generate status code: {resp_gen.status_code}")
        print(f"POST /generate response text: {resp_gen.text[:500]}...")
        
        resp_gen.raise_for_status()
        data_gen = resp_gen.json()
        assert 'generation_id' in data_gen
        print(f"✓ POST /generate with database storage works (generation_id: {data_gen.get('generation_id')})")
        
        # Get experiment data
        print(f"Attempting GET /api/experiments/{experiment_id}...")
        resp_get_exp = requests.get(f"{BASE_URL}/api/experiments/{experiment_id}")
        print(f"GET /api/experiments/{experiment_id} status: {resp_get_exp.status_code}, response: {resp_get_exp.text[:200]}...")
        resp_get_exp.raise_for_status()
        data_get_exp = resp_get_exp.json()
        assert 'prompts' in data_get_exp and len(data_get_exp['prompts']) > 0
        assert 'generations' in data_get_exp and len(data_get_exp['generations']) > 0
        print("✓ GET /api/experiments/{id} works")
        
    except requests.exceptions.HTTPError as http_err:
        print(f"✗ HTTP error occurred: {http_err}")
        if http_err.response is not None:
            print(f"✗ Response status code: {http_err.response.status_code}")
            print(f"✗ Response text: {http_err.response.text[:500]}...")
    except Exception as e:
        print(f"✗ Database endpoints failed: {e}")
        traceback.print_exc()


def test_models_endpoint():
    """Test model registration"""
    print("\nTesting model endpoints...")
    
    try:
        # Register a test model
        print("Attempting POST /api/models (register test-model-1)...")
        resp = requests.post(f"{BASE_URL}/api/models", json={
            "name": "test-model-1",
            "type": "base"
        })
        print(f"POST /api/models status: {resp.status_code}, response: {resp.text[:200]}...")
        resp.raise_for_status()
        print("✓ Model registration works")
        
        # Get models list
        print("Attempting GET /api/models...")
        resp = requests.get(f"{BASE_URL}/api/models")
        print(f"GET /api/models status: {resp.status_code}, response: {resp.text[:200]}...")
        resp.raise_for_status()
        data = resp.json()
        assert 'models' in data and any(m['name'] == 'test-model-1' for m in data['models'])
        print("✓ GET /api/models works and contains test-model-1")
        
    except requests.exceptions.HTTPError as http_err:
        print(f"✗ Model endpoints HTTP error: {http_err}")
        if http_err.response is not None:
            print(f"✗ Response status: {http_err.response.status_code}, text: {http_err.response.text[:500]}")
    except Exception as e:
        print(f"✗ Model endpoints failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    print("Testing VibeLab Enhanced Backend...")
    print("Make sure the backend is running on port 8081 (PID: $BACKEND_PID)")
    print("-" * 50)
    
    # Wait a moment for backend to be ready
    time.sleep(1) # Increased from 1 to 2 just in case
    
    try:
        test_legacy_endpoints()
        test_new_endpoints()
        test_models_endpoint()
        print("\n✅ Backend tests completed!")
    except requests.exceptions.ConnectionError:
        print("\n❌ Could not connect to backend. Is it running on port 8081 (PID: $BACKEND_PID)?")
    except Exception as e:
        print(f"\n❌ Unexpected error during test execution: {e}")
        traceback.print_exc()
