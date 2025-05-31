#!/usr/bin/env python3
"""
VibeLab Database API - REST endpoints for database operations
Extends the existing llm_backend.py with database persistence
"""

import json
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from database_manager import DatabaseManager
import logging

logger = logging.getLogger(__name__)

class DatabaseAPIHandler(BaseHTTPRequestHandler):
    
    def __init__(self, *args, **kwargs):
        self.db = DatabaseManager()
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_json_response(self, data, status=200):
        """Send JSON response with CORS headers"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def send_error_response(self, error_msg, status=500):
        """Send error response"""
        self.send_json_response({
            'success': False,
            'error': error_msg
        }, status)
    
    def parse_request_body(self):
        """Parse JSON request body"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {}
            
            post_data = self.rfile.read(content_length)
            return json.loads(post_data.decode('utf-8'))
        except Exception as e:
            raise ValueError(f"Invalid JSON in request body: {e}")
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)
        
        try:
            if path == '/api/experiments':
                experiments = self.db.list_experiments()
                self.send_json_response({'success': True, 'experiments': experiments})
            
            elif path.startswith('/api/experiments/'):
                experiment_id = path.split('/')[-1]
                if experiment_id == 'export':
                    # Handle export with query param
                    exp_id = query_params.get('id', [None])[0]
                    if not exp_id:
                        self.send_error_response("Missing experiment ID", 400)
                        return
                    
                    export_data = self.db.export_experiment_data(exp_id)
                    self.send_json_response({'success': True, 'data': export_data})
                else:
                    experiment = self.db.get_experiment(experiment_id)
                    if experiment:
                        # Get related data
                        prompts = self.db.get_prompts_by_experiment(experiment_id)
                        generations = self.db.get_generations_by_experiment(experiment_id)
                        rankings = self.db.get_rankings_by_experiment(experiment_id)
                        
                        self.send_json_response({
                            'success': True,
                            'experiment': experiment,
                            'prompts': prompts,
                            'generations': generations,
                            'rankings': rankings
                        })
                    else:
                        self.send_error_response("Experiment not found", 404)
            
            elif path == '/api/models':
                models = self.db.get_models()
                self.send_json_response({'success': True, 'models': models})
            
            elif path.startswith('/api/generations/'):
                experiment_id = path.split('/')[-1]
                generations = self.db.get_generations_by_experiment(experiment_id)
                self.send_json_response({'success': True, 'generations': generations})
            
            elif path.startswith('/api/rankings/'):
                experiment_id = path.split('/')[-1]
                rankings = self.db.get_rankings_by_experiment(experiment_id)
                self.send_json_response({'success': True, 'rankings': rankings})
            
            else:
                self.send_error_response("Endpoint not found", 404)
                
        except Exception as e:
            logger.error(f"GET error: {e}")
            self.send_error_response(str(e))
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        try:
            data = self.parse_request_body()
            
            if path == '/api/experiments':
                # Create new experiment
                experiment_id = self.db.create_experiment(
                    name=data.get('name', 'Untitled Experiment'),
                    description=data.get('description', ''),
                    config=data.get('config', {})
                )
                
                experiment = self.db.get_experiment(experiment_id)
                self.send_json_response({
                    'success': True,
                    'experiment': experiment
                })
            
            elif path == '/api/prompts':
                # Create new prompt
                prompt_id = self.db.create_prompt(
                    experiment_id=data['experiment_id'],
                    content=data['content'],
                    prompt_type=data.get('type', 'base'),
                    parent_prompt_id=data.get('parent_prompt_id'),
                    modifier_used=data.get('modifier_used'),
                    tags=data.get('tags', [])
                )
                
                self.send_json_response({
                    'success': True,
                    'prompt_id': prompt_id
                })
            
            elif path == '/api/models':
                # Register new model
                model_id = self.db.register_model(
                    name=data['name'],
                    model_type=data.get('type', 'base'),
                    consortium_config=data.get('consortium_config')
                )
                
                model = self.db.get_model_by_name(data['name'])
                self.send_json_response({
                    'success': True,
                    'model': model
                })
            
            elif path == '/api/generations':
                # Save generation result
                generation_id = self.db.save_generation(
                    experiment_id=data['experiment_id'],
                    prompt_id=data['prompt_id'],
                    model_id=data['model_id'],
                    output=data['output'],
                    svg_content=data.get('svg_content'),
                    generation_time_ms=data.get('generation_time_ms'),
                    conversation_id=data.get('conversation_id'),
                    step_number=data.get('step_number', 1),
                    metadata=data.get('metadata', {})
                )
                
                self.send_json_response({
                    'success': True,
                    'generation_id': generation_id
                })
            
            elif path == '/api/rankings':
                # Save ranking
                ranking_id = self.db.save_ranking(
                    experiment_id=data['experiment_id'],
                    prompt_id=data['prompt_id'],
                    generation_id=data['generation_id'],
                    rank=data['rank'],
                    quality_score=data.get('quality_score'),
                    evaluator_id=data.get('evaluator_id', 'human')
                )
                
                self.send_json_response({
                    'success': True,
                    'ranking_id': ranking_id
                })
            
            elif path == '/api/migrate':
                # Migrate localStorage data
                localStorage_data = data.get('localStorage_data', {})
                self.db.migrate_localStorage_data(localStorage_data)
                
                self.send_json_response({
                    'success': True,
                    'message': 'Migration completed'
                })
            
            else:
                self.send_error_response("Endpoint not found", 404)
                
        except Exception as e:
            logger.error(f"POST error: {e}")
            self.send_error_response(str(e))
    
    def do_PUT(self):
        """Handle PUT requests"""
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        try:
            data = self.parse_request_body()
            
            if path.startswith('/api/experiments/'):
                experiment_id = path.split('/')[-1]
                self.db.update_experiment(experiment_id, **data)
                
                experiment = self.db.get_experiment(experiment_id)
                self.send_json_response({
                    'success': True,
                    'experiment': experiment
                })
            
            else:
                self.send_error_response("Endpoint not found", 404)
                
        except Exception as e:
            logger.error(f"PUT error: {e}")
            self.send_error_response(str(e))
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def main():
    port = 8082
    server = HTTPServer(('localhost', port), DatabaseAPIHandler)
    print(f"Starting VibeLab Database API server on http://localhost:{port}")
    print("Database endpoints available at /api/*")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down database API server...")
        server.shutdown()

if __name__ == '__main__':
    main()
