#!/usr/bin/env python3
"""
VibeLab Database Manager - SQLite backend for persistent research data
"""

import sqlite3
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path: str = "data/vibelab_research.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()
    
    def init_database(self):
        """Initialize database with schema"""
        with open('db_schema.sql', 'r') as f:
            schema = f.read()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(schema)
            logger.info(f"Database initialized at {self.db_path}")
    
    def get_connection(self):
        """Get database connection with row factory"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    # Experiment operations
    def create_experiment(self, name: str, description: str = "", config: Dict = None) -> str:
        """Create new experiment"""
        experiment_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO experiments (id, name, description, config)
                VALUES (?, ?, ?, ?)
            """, (experiment_id, name, description, json.dumps(config or {})))
        
        logger.info(f"Created experiment: {name} ({experiment_id})")
        return experiment_id
    
    def get_experiment(self, experiment_id: str) -> Optional[Dict]:
        """Get experiment by ID"""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM experiments WHERE id = ?", (experiment_id,)
            ).fetchone()
            
            if row:
                return dict(row)
        return None
    
    def list_experiments(self) -> List[Dict]:
        """List all experiments"""
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM experiments ORDER BY created_at DESC"
            ).fetchall()
            
            return [dict(row) for row in rows]
    
    def update_experiment(self, experiment_id: str, **kwargs):
        """Update experiment fields"""
        valid_fields = ['name', 'description', 'status', 'config']
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}
        
        if not updates:
            return
        
        # Handle JSON serialization for config
        if 'config' in updates:
            updates['config'] = json.dumps(updates['config'])
        
        set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
        
        with self.get_connection() as conn:
            conn.execute(f"""
                UPDATE experiments 
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, list(updates.values()) + [experiment_id])
    
    # Prompt operations
    def create_prompt(self, experiment_id: str, content: str, 
                     prompt_type: str = 'base', parent_prompt_id: str = None,
                     modifier_used: str = None, tags: List[str] = None) -> str:
        """Create new prompt"""
        prompt_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO prompts (id, experiment_id, type, content, parent_prompt_id, modifier_used, tags)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (prompt_id, experiment_id, prompt_type, content, 
                  parent_prompt_id, modifier_used, json.dumps(tags or [])))
        
        return prompt_id
    
    def get_prompts_by_experiment(self, experiment_id: str) -> List[Dict]:
        """Get all prompts for an experiment"""
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM prompts WHERE experiment_id = ? ORDER BY created_at",
                (experiment_id,)
            ).fetchall()
            
            return [dict(row) for row in rows]
    
    # Model operations
    def register_model(self, name: str, model_type: str = 'base', 
                      consortium_config: Dict = None) -> str:
        """Register a new model"""
        model_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO models (id, name, type, consortium_config)
                VALUES (?, ?, ?, ?)
            """, (model_id, name, model_type, json.dumps(consortium_config or {})))
        
        return model_id
    
    def get_models(self, active_only: bool = True) -> List[Dict]:
        """Get all models"""
        query = "SELECT * FROM models"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY name"
        
        with self.get_connection() as conn:
            rows = conn.execute(query).fetchall()
            return [dict(row) for row in rows]
    
    def get_model_by_name(self, name: str) -> Optional[Dict]:
        """Get model by name"""
        with self.get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM models WHERE name = ?", (name,)
            ).fetchone()
            
            if row:
                return dict(row)
        return None
    
    # Generation operations
    def save_generation(self, experiment_id: str, prompt_id: str, model_id: str,
                       output: str, svg_content: str = None, generation_time_ms: int = None,
                       conversation_id: str = None, step_number: int = 1,
                       metadata: Dict = None) -> str:
        """Save generation result"""
        generation_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO generations 
                (id, experiment_id, prompt_id, model_id, conversation_id, step_number,
                 output, svg_content, generation_time_ms, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (generation_id, experiment_id, prompt_id, model_id, conversation_id,
                  step_number, output, svg_content, generation_time_ms, 
                  json.dumps(metadata or {})))
        
        return generation_id
    
    def get_generations_by_experiment(self, experiment_id: str) -> List[Dict]:
        """Get all generations for an experiment"""
        with self.get_connection() as conn:
            rows = conn.execute("""
                SELECT g.*, p.content as prompt_content, m.name as model_name
                FROM generations g
                JOIN prompts p ON g.prompt_id = p.id
                JOIN models m ON g.model_id = m.id
                WHERE g.experiment_id = ?
                ORDER BY g.created_at
            """, (experiment_id,)).fetchall()
            
            return [dict(row) for row in rows]
    
    # Ranking operations
    def save_ranking(self, experiment_id: str, prompt_id: str, generation_id: str,
                    rank: int, quality_score: float = None, evaluator_id: str = "human") -> str:
        """Save ranking/evaluation"""
        ranking_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO rankings 
                (id, experiment_id, prompt_id, generation_id, rank, quality_score, evaluator_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ranking_id, experiment_id, prompt_id, generation_id, rank, quality_score, evaluator_id))
        
        return ranking_id
    
    def get_rankings_by_experiment(self, experiment_id: str) -> List[Dict]:
        """Get all rankings for an experiment"""
        with self.get_connection() as conn:
            rows = conn.execute("""
                SELECT r.*, g.output, p.content as prompt_content, m.name as model_name
                FROM rankings r
                JOIN generations g ON r.generation_id = g.id
                JOIN prompts p ON r.prompt_id = p.id
                JOIN models m ON g.model_id = m.id
                WHERE r.experiment_id = ?
                ORDER BY r.prompt_id, r.rank
            """, (experiment_id,)).fetchall()
            
            return [dict(row) for row in rows]
    
    # Analysis operations
    def save_analysis(self, experiment_id: str, analysis_type: str, results: Dict) -> str:
        """Save analysis results"""
        analysis_id = str(uuid.uuid4())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO analysis_results (id, experiment_id, analysis_type, results)
                VALUES (?, ?, ?, ?)
            """, (analysis_id, experiment_id, analysis_type, json.dumps(results)))
        
        return analysis_id
    
    def get_analysis_by_experiment(self, experiment_id: str) -> List[Dict]:
        """Get all analysis results for an experiment"""
        with self.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM analysis_results WHERE experiment_id = ? ORDER BY created_at",
                (experiment_id,)
            ).fetchall()
            
            return [dict(row) for row in rows]
    
    # Data migration from localStorage
    def migrate_localStorage_data(self, localStorage_data: Dict):
        """Migrate data from localStorage format to database"""
        logger.info("Starting localStorage data migration...")
        
        for key, experiment_data in localStorage_data.items():
            if not key.startswith('vibelab_'):
                continue
                
            experiment_name = key.replace('vibelab_', '')
            
            # Create experiment
            exp_id = self.create_experiment(
                name=experiment_name,
                description=f"Migrated from localStorage",
                config=experiment_data.get('config', {})
            )
            
            # Migrate prompts and generations
            for result in experiment_data.get('results', []):
                # Create prompt
                prompt_id = self.create_prompt(
                    experiment_id=exp_id,
                    content=result.get('prompt', ''),
                    tags=[result.get('technique', 'unknown')]
                )
                
                # Find or create model
                model_name = result.get('model', 'unknown')
                model = self.get_model_by_name(model_name)
                if not model:
                    model_id = self.register_model(model_name)
                else:
                    model_id = model['id']
                
                # Save generation
                self.save_generation(
                    experiment_id=exp_id,
                    prompt_id=prompt_id,
                    model_id=model_id,
                    output=result.get('result', ''),
                    svg_content=result.get('result', '') if result.get('result', '').strip().startswith('<svg') else None
                )
        
        logger.info("Migration completed")

    def export_experiment_data(self, experiment_id: str) -> Dict:
        """Export complete experiment data for backup/sharing"""
        experiment = self.get_experiment(experiment_id)
        if not experiment:
            raise ValueError(f"Experiment {experiment_id} not found")
        
        return {
            'experiment': experiment,
            'prompts': self.get_prompts_by_experiment(experiment_id),
            'generations': self.get_generations_by_experiment(experiment_id),
            'rankings': self.get_rankings_by_experiment(experiment_id),
            'analysis': self.get_analysis_by_experiment(experiment_id)
        }

if __name__ == "__main__":
    # Test the database
    db = DatabaseManager()
    
    # Create test experiment
    exp_id = db.create_experiment("Test SVG Generation", "Testing the database")
    print(f"Created experiment: {exp_id}")
    
    # Test model registration
    model_id = db.register_model("claude-3-5-sonnet-20241022")
    print(f"Registered model: {model_id}")
    
    # Test prompt creation
    prompt_id = db.create_prompt(exp_id, "SVG of a pelican riding a bicycle")
    print(f"Created prompt: {prompt_id}")
    
    print("Database test completed successfully!")
