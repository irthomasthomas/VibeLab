#!/usr/bin/env python3
"""
LLM-Consortium Detection and Integration Module
Detects saved consortium configurations and integrates them into VibeLab
"""

import sqlite3
import json
import os
from pathlib import Path

class ConsortiumDetector:
    def __init__(self):
        self.logs_db_path = self.find_llm_logs_db()
        self.consortium_configs = {}
        
    def find_llm_logs_db(self):
        """Find the LLM logs database"""
        possible_paths = [
            Path.home() / ".config/io.datasette.llm/logs.db",
            Path.home() / ".local/share/io.datasette.llm/logs.db",
            Path("~/.config/io.datasette.llm/logs.db").expanduser(),
        ]
        
        for path in possible_paths:
            if path.exists():
                return str(path)
        
        return None
    
    def detect_consortium_models(self):
        """Detect consortium models from LLM logs"""
        if not self.logs_db_path:
            return []
        
        try:
            conn = sqlite3.connect(self.logs_db_path)
            cursor = conn.cursor()
            
            # Look for consortium-related logs
            cursor.execute("""
                SELECT DISTINCT model, response 
                FROM logs 
                WHERE model LIKE '%consortium%' 
                   OR prompt LIKE '%consortium%'
                   OR response LIKE '%consortium%'
                ORDER BY datetime DESC
            """)
            
            consortium_models = []
            for row in cursor.fetchall():
                model_name, response = row
                consortium_models.append({
                    'name': model_name,
                    'type': 'consortium',
                    'detected_from': 'logs'
                })
            
            conn.close()
            return consortium_models
            
        except Exception as e:
            print(f"Error accessing LLM logs: {e}")
            return []
    
    def detect_saved_consortiums(self):
        """Detect saved consortium configurations"""
        if not self.logs_db_path:
            return []
        
        try:
            conn = sqlite3.connect(self.logs_db_path)
            cursor = conn.cursor()
            
            # Look for consortium save operations
            cursor.execute("""
                SELECT model, prompt, response, datetime
                FROM logs 
                WHERE prompt LIKE '%save%consortium%'
                   OR response LIKE '%consortium%saved%'
                ORDER BY datetime DESC
                LIMIT 50
            """)
            
            saved_consortiums = []
            for row in cursor.fetchall():
                model, prompt, response, datetime = row
                
                # Try to extract consortium name and config
                if 'consortium' in prompt.lower() or 'consortium' in response.lower():
                    consortium_info = {
                        'name': self.extract_consortium_name(prompt, response),
                        'datetime': datetime,
                        'models': self.extract_member_models(prompt, response),
                        'arbiter': self.extract_arbiter_model(prompt, response)
                    }
                    saved_consortiums.append(consortium_info)
            
            conn.close()
            return saved_consortiums
            
        except Exception as e:
            print(f"Error detecting saved consortiums: {e}")
            return []
    
    def extract_consortium_name(self, prompt, response):
        """Extract consortium name from prompt/response"""
        # Look for common patterns
        import re
        
        # Look in prompt first
        name_patterns = [
            r'consortium[:\s]+([a-zA-Z0-9_-]+)',
            r'save[:\s]+([a-zA-Z0-9_-]+)[:\s]+consortium',
            r'name[:\s]+([a-zA-Z0-9_-]+)'
        ]
        
        for pattern in name_patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                return match.group(1)
        
        # If not found in prompt, try response
        for pattern in name_patterns:
            match = re.search(pattern, response, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return "unnamed_consortium"
    
    def extract_member_models(self, prompt, response):
        """Extract member models from consortium definition"""
        # This would need to be enhanced based on actual consortium format
        import re
        
        # Look for model lists
        model_patterns = [
            r'models[:\s]+\[(.*?)\]',
            r'members[:\s]+\[(.*?)\]',
        ]
        
        for pattern in model_patterns:
            match = re.search(pattern, prompt + " " + response, re.IGNORECASE | re.DOTALL)
            if match:
                models_str = match.group(1)
                # Parse model names (simple implementation)
                models = [m.strip().strip('"\'') for m in models_str.split(',')]
                return models
        
        return []
    
    def extract_arbiter_model(self, prompt, response):
        """Extract arbiter model from consortium definition"""
        import re
        
        arbiter_patterns = [
            r'arbiter[:\s]+([a-zA-Z0-9/_-]+)',
            r'judge[:\s]+([a-zA-Z0-9/_-]+)',
        ]
        
        for pattern in arbiter_patterns:
            match = re.search(pattern, prompt + " " + response, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def get_all_consortiums(self):
        """Get all detected consortium configurations"""
        consortium_models = self.detect_consortium_models()
        saved_consortiums = self.detect_saved_consortiums()
        
        # Combine and deduplicate
        all_consortiums = {}
        
        for model in consortium_models:
            all_consortiums[model['name']] = {
                'name': model['name'],
                'type': 'consortium',
                'source': 'model_logs',
                'models': [],
                'arbiter': None
            }
        
        for consortium in saved_consortiums:
            name = consortium['name']
            all_consortiums[name] = {
                'name': name,
                'type': 'consortium',
                'source': 'saved_config',
                'models': consortium['models'],
                'arbiter': consortium['arbiter'],
                'created': consortium['datetime']
            }
        
        return list(all_consortiums.values())

if __name__ == "__main__":
    detector = ConsortiumDetector()
    consortiums = detector.get_all_consortiums()
    
    print("Detected Consortium Models:")
    if consortiums:
        for consortium in consortiums:
            print(f"- {consortium['name']} ({consortium['source']})")
            if consortium['models']:
                print(f"  Members: {', '.join(consortium['models'])}")
            if consortium['arbiter']:
                print(f"  Arbiter: {consortium['arbiter']}")
    else:
        print("No consortium models detected.")
