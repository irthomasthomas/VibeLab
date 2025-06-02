import json
import uuid
from datetime import datetime
from database_manager import DatabaseManager
# No longer need sqlite3 directly in this file
# import sqlite3 

class PromptService:
    def __init__(self, db_path="data/vibelab_research.db"):
        self.db_manager = DatabaseManager(db_path)
        
    def _row_to_template(self, row):
        """Convert database row (sqlite3.Row) to template dictionary format"""
        if not row:
            return None
            
        return {
            'id': row['id'], # Access by column name
            'name': row['name'],
            'prompt': row['prompt'],
            'tags': json.loads(row['tags']) if row['tags'] else [],
            'animated': bool(row['animated']),
            'created': row['created_at'], # Match column name
            'updated': row['updated_at'] # Match column name
        }
    
    def get_templates(self):
        """Get all templates"""
        query = """
            SELECT id, name, prompt, tags, animated, created_at, updated_at 
            FROM templates 
            ORDER BY created_at DESC
        """
        
        rows = self.db_manager.execute_select(query)
        templates = [self._row_to_template(row) for row in rows]
        
        return {'templates': templates} # Keep original return structure
    
    def get_template(self, template_id):
        """Get a specific template by ID"""
        query = """
            SELECT id, name, prompt, tags, animated, created_at, updated_at 
            FROM templates 
            WHERE id = ?
        """
        
        row = self.db_manager.execute_select_one(query, (template_id,))
        return self._row_to_template(row) if row else None
    
    def save_template(self, name, prompt, tags=None, animated=False):
        """Save a new template"""
        template_id = str(uuid.uuid4())
        tags = tags or []
        now_iso = datetime.now().isoformat()
        
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
            now_iso, # Use ISO format string for datetime
            now_iso, # Use ISO format string for datetime
            'user'  # Assuming 'user' as default creator
        )
        
        self.db_manager.execute_commit(query, params)
        
        # Return the created template object, consistent with previous behavior
        return {
            'id': template_id,
            'name': name,
            'prompt': prompt,
            'tags': tags,
            'animated': animated,
            'created': now_iso, # Return ISO string
            'updated': now_iso  # Return ISO string
        }
    
    def update_template(self, template_id, name=None, prompt=None, tags=None, animated=None):
        """Update an existing template"""
        current = self.get_template(template_id)
        if not current:
            # Consider raising a more specific error, e.g., NotFoundError
            raise ValueError(f"Template {template_id} not found")
        
        updates = []
        params_list = [] # Use a list for params as their order matters
        
        # Update current dictionary as we go to return the updated object
        if name is not None:
            updates.append("name = ?")
            params_list.append(name)
            current['name'] = name
            
        if prompt is not None:
            updates.append("prompt = ?")
            params_list.append(prompt)
            current['prompt'] = prompt
            
        if tags is not None:
            updates.append("tags = ?")
            params_list.append(json.dumps(tags))
            current['tags'] = tags
            
        if animated is not None:
            updates.append("animated = ?")
            params_list.append(animated)
            current['animated'] = bool(animated) # Ensure boolean
        
        if updates:
            now_iso = datetime.now().isoformat()
            updates.append("updated_at = ?")
            params_list.append(now_iso)
            current['updated'] = now_iso
            
            params_list.append(template_id) # Add template_id for WHERE clause
            
            query = f"UPDATE templates SET {', '.join(updates)} WHERE id = ?"
            self.db_manager.execute_commit(query, tuple(params_list))
        
        return current # Return the potentially modified current dictionary
    
    def delete_template(self, template_id):
        """Delete a template"""
        # Optional: Check if template exists before deleting
        # current = self.get_template(template_id)
        # if not current:
        #     raise ValueError(f"Template {template_id} not found for deletion")

        query = "DELETE FROM templates WHERE id = ?"
        self.db_manager.execute_commit(query, (template_id,))
        return True # Maintain previous return signature
