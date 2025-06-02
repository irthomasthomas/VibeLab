import json
import sqlite3
import uuid
from datetime import datetime
from database_manager import DatabaseManager

class PromptService:
    def __init__(self, db_path="data/vibelab_research.db"):
        self.db_manager = DatabaseManager(db_path)
        
    def _row_to_template(self, row):
        """Convert database row to template dictionary format"""
        if not row:
            return None
            
        return {
            'id': row[0],
            'name': row[1],
            'prompt': row[2],
            'tags': json.loads(row[3]) if row[3] else [],
            'animated': bool(row[4]),
            'created': row[5],
            'updated': row[6] if len(row) > 6 else row[5]
        }
    
    def get_templates(self):
        """Get all templates"""
        query = """
            SELECT id, name, prompt, tags, animated, created_at, updated_at 
            FROM templates 
            ORDER BY created_at DESC
        """
        
        rows = self.db_manager.execute_query(query)
        templates = [self._row_to_template(row) for row in rows]
        
        return {'templates': templates}
    
    def get_template(self, template_id):
        """Get a specific template by ID"""
        query = """
            SELECT id, name, prompt, tags, animated, created_at, updated_at 
            FROM templates 
            WHERE id = ?
        """
        
        rows = self.db_manager.execute_query(query, (template_id,))
        if rows:
            return self._row_to_template(rows[0])
        return None
    
    def save_template(self, name, prompt, tags=None, animated=False):
        """Save a new template"""
        template_id = str(uuid.uuid4())
        tags = tags or []
        now = datetime.now().isoformat()
        
        query = """
            INSERT INTO templates 
            (id, name, prompt, tags, animated, created_at, updated_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        params = (
            template_id,
            name,
            prompt,
            json.dumps(tags),
            animated,
            now,
            now,
            'user'
        )
        
        self.db_manager.execute_query(query, params)
        
        return {
            'id': template_id,
            'name': name,
            'prompt': prompt,
            'tags': tags,
            'animated': animated,
            'created': now
        }
    
    def update_template(self, template_id, name=None, prompt=None, tags=None, animated=None):
        """Update an existing template"""
        # Get current template
        current = self.get_template(template_id)
        if not current:
            raise ValueError(f"Template {template_id} not found")
        
        # Build update query dynamically
        updates = []
        params = []
        
        if name is not None:
            updates.append("name = ?")
            params.append(name)
            current['name'] = name
            
        if prompt is not None:
            updates.append("prompt = ?")
            params.append(prompt)
            current['prompt'] = prompt
            
        if tags is not None:
            updates.append("tags = ?")
            params.append(json.dumps(tags))
            current['tags'] = tags
            
        if animated is not None:
            updates.append("animated = ?")
            params.append(animated)
            current['animated'] = animated
        
        if updates:
            updates.append("updated_at = ?")
            params.append(datetime.now().isoformat())
            params.append(template_id)
            
            query = f"UPDATE templates SET {', '.join(updates)} WHERE id = ?"
            self.db_manager.execute_query(query, params)
        
        return current
    
    def delete_template(self, template_id):
        """Delete a template"""
        query = "DELETE FROM templates WHERE id = ?"
        self.db_manager.execute_query(query, (template_id,))
        return True
    
    
    
