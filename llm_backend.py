#!/usr/bin/env python3
"""
Simple backend server for VibeLab to interface with llm CLI
"""

import json
import subprocess
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs
import threading
import time

class LLMHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/generate':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                model = data.get('model', 'claude-3-5-sonnet-20241022')
                prompt = data.get('prompt', '')
                
                if not prompt:
                    self.send_error(400, "Missing prompt")
                    return
                
                # Execute llm command
                result = self.execute_llm(model, prompt)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'success': True,
                    'result': result,
                    'model': model
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                self.send_error_response(str(e))
        
        elif self.path == '/prompts':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                from prompt_manager import PromptManager
                pm = PromptManager()
                
                new_template = pm.save_template(
                    name=data.get('name', ''),
                    prompt=data.get('prompt', ''),
                    tags=data.get('tags', []),
                    animated=data.get('animated', False)
                )
                
                self.send_json_response({'success': True, 'template': new_template})
                
            except Exception as e:
                self.send_error_response(str(e))
    
    def do_GET(self):
        if self.path == '/prompts':
            try:
                from prompt_manager import PromptManager
                pm = PromptManager()
                templates = pm.get_templates()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'success': True,
                    'templates': templates
                }
                self.wfile.write(json.dumps(response).encode('utf-8'))
                
            except Exception as e:
                self.send_error_response(str(e))
        else:
            self.send_error(404, "Not found")
    
    def do_PUT(self):
        if self.path.startswith('/prompts/'):
            try:
                template_id = self.path.split('/')[-1]
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                
                from prompt_manager import PromptManager
                pm = PromptManager()
                
                updated = pm.update_template(
                    template_id,
                    name=data.get('name'),
                    prompt=data.get('prompt'),
                    tags=data.get('tags'),
                    animated=data.get('animated')
                )
                
                if updated:
                    self.send_json_response({'success': True, 'template': updated})
                else:
                    self.send_error(404, "Template not found")
                    
            except Exception as e:
                self.send_error_response(str(e))
    
    def do_DELETE(self):
        if self.path.startswith('/prompts/'):
            try:
                template_id = self.path.split('/')[-1]
                
                from prompt_manager import PromptManager
                pm = PromptManager()
                
                success = pm.delete_template(template_id)
                
                if success:
                    self.send_json_response({'success': True})
                else:
                    self.send_error(404, "Template not found")
                    
            except Exception as e:
                self.send_error_response(str(e))
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_json_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def send_error_response(self, error_msg):
        self.send_response(500)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        error_response = {
            'success': False,
            'error': error_msg
        }
        self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def execute_llm(self, model, prompt):
        """Execute llm CLI command and return result"""
        try:
            # Construct llm command
            cmd = ['llm', '-m', model, prompt]
            
            print(f"Executing: {' '.join(cmd)}")
            
            # Run the command
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )
            
            if result.returncode != 0:
                raise Exception(f"LLM command failed: {result.stderr}")
            
            return result.stdout.strip()
            
        except subprocess.TimeoutExpired:
            raise Exception("LLM command timed out after 2 minutes")
        except FileNotFoundError:
            raise Exception("llm command not found. Please ensure llm CLI is installed and in PATH")
        except Exception as e:
            raise Exception(f"Error executing llm: {str(e)}")
    
    def log_message(self, format, *args):
        # Custom logging
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def main():
    port = 8081
    server = HTTPServer(('localhost', port), LLMHandler)
    print(f"Starting LLM backend server on http://localhost:{port}")
    print("This server will handle LLM CLI calls for VibeLab")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()

if __name__ == '__main__':
    main()
