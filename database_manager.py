import sqlite3
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Union # Ensure Dict is imported
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self, db_path: str = "data/vibelab_research.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self, schema_file: str = 'db_schema.sql'):
        if not Path(schema_file).exists():
            logger.error(f"Schema file {schema_file} not found.")
            raise FileNotFoundError(f"Schema file {schema_file} not found.")
        with open(schema_file, 'r') as f:
            schema = f.read()
        try:
            with self._connect() as conn:
                conn.executescript(schema)
            logger.info(f"Database schema applied from {schema_file} to {self.db_path}")
        except sqlite3.Error as e:
            logger.error(f"Error initializing database: {e}")
            raise

    def execute_select(self, query: str, params: tuple = None) -> List[sqlite3.Row]:
        try:
            with self._connect() as conn:
                cursor = conn.execute(query, params or ())
                return cursor.fetchall()
        except sqlite3.Error as e:
            logger.error(f"Error executing SELECT query: {query} with params {params} - {e}")
            raise

    def execute_select_one(self, query: str, params: tuple = None) -> Optional[sqlite3.Row]:
        try:
            with self._connect() as conn:
                cursor = conn.execute(query, params or ())
                return cursor.fetchone()
        except sqlite3.Error as e:
            logger.error(f"Error executing SELECT ONE query: {query} with params {params} - {e}")
            raise

    def execute_commit(self, query: str, params: tuple = None) -> Optional[int]:
        try:
            with self._connect() as conn:
                cursor = conn.execute(query, params or ())
                conn.commit()
                return cursor.lastrowid
        except sqlite3.Error as e:
            logger.error(f"Error executing DML query: {query} with params {params} - {e}")
            raise
            
    def create_experiment(self, name: str, description: str = "", config: Dict = None) -> str:
        experiment_id = str(uuid.uuid4())
        self.execute_commit("""
            INSERT INTO experiments (id, name, description, config)
            VALUES (?, ?, ?, ?)
        """, (experiment_id, name, description, json.dumps(config or {})))
        logger.info(f"Created experiment: {name} ({experiment_id})")
        return experiment_id
    
    def get_experiment(self, experiment_id: str) -> Optional[Dict]:
        row = self.execute_select_one(
            "SELECT * FROM experiments WHERE id = ?", (experiment_id,)
        )
        return dict(row) if row else None
    
    def list_experiments(self) -> List[Dict]:
        rows = self.execute_select(
            "SELECT * FROM experiments ORDER BY created_at DESC"
        )
        return [dict(row) for row in rows]
    
    def update_experiment(self, experiment_id: str, **kwargs):
        valid_fields = ['name', 'description', 'status', 'config']
        updates = {k: v for k, v in kwargs.items() if k in valid_fields}
        if not updates: return
        if 'config' in updates: updates['config'] = json.dumps(updates['config'])
        set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
        self.execute_commit(f"""
            UPDATE experiments SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        """, list(updates.values()) + [experiment_id])
    
    def create_prompt(self, experiment_id: str, content: str, 
                     prompt_type: str = 'base', parent_prompt_id: str = None,
                     modifier_used: str = None, tags: List[str] = None) -> str:
        prompt_id = str(uuid.uuid4())
        self.execute_commit("""
            INSERT INTO prompts (id, experiment_id, type, content, parent_prompt_id, modifier_used, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (prompt_id, experiment_id, prompt_type, content, 
              parent_prompt_id, modifier_used, json.dumps(tags or [])))
        return prompt_id
    
    def get_prompts_by_experiment(self, experiment_id: str) -> List[Dict]:
        rows = self.execute_select(
            "SELECT * FROM prompts WHERE experiment_id = ? ORDER BY created_at",
            (experiment_id,)
        )
        return [dict(row) for row in rows]
    
    def register_model(self, name: str, model_type: str = 'base', 
                      consortium_config: Dict = None) -> str:
        model_id = str(uuid.uuid4())
        self.execute_commit(""" 
            INSERT OR REPLACE INTO models (id, name, type, consortium_config)
            VALUES (?, ?, ?, ?)
        """, (model_id, name, model_type, json.dumps(consortium_config or {})))
        return model_id
    
    def get_models(self, active_only: bool = True) -> List[Dict]:
        query = "SELECT * FROM models"
        if active_only: query += " WHERE is_active = 1"
        query += " ORDER BY name"
        rows = self.execute_select(query)
        return [dict(row) for row in rows]
    
    def get_model_by_name(self, name: str) -> Optional[Dict]:
        row = self.execute_select_one("SELECT * FROM models WHERE name = ?", (name,))
        return dict(row) if row else None
    
    def save_generation(self, experiment_id: str, prompt_id: str, model_id: str,
                       output: str, svg_content: str = None, generation_time_ms: int = None,
                       conversation_id: str = None, step_number: int = 1,
                       metadata: Dict = None) -> str:
        generation_id = str(uuid.uuid4())
        self.execute_commit("""
            INSERT INTO generations 
            (id, experiment_id, prompt_id, model_id, conversation_id, step_number,
             output, svg_content, generation_time_ms, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (generation_id, experiment_id, prompt_id, model_id, conversation_id,
              step_number, output, svg_content, generation_time_ms, json.dumps(metadata or {})))
        return generation_id
    
    def get_generations_by_experiment(self, experiment_id: str) -> List[Dict]:
        rows = self.execute_select("""
            SELECT g.*, p.content as prompt_content, m.name as model_name
            FROM generations g
            JOIN prompts p ON g.prompt_id = p.id
            JOIN models m ON g.model_id = m.id
            WHERE g.experiment_id = ? ORDER BY g.created_at
        """, (experiment_id,))
        return [dict(row) for row in rows]

    def get_identifiers_for_generation(self, generation_id: str) -> Optional[Dict[str, str]]:
        """Fetch experiment_id and prompt_id for a given generation_id."""
        query = "SELECT experiment_id, prompt_id FROM generations WHERE id = ?"
        try:
            row = self.execute_select_one(query, (generation_id,))
            if row:
                return dict(row) 
            return None
        except Exception as e:
            logger.error(f"Error fetching identifiers for generation {generation_id}: {e}")
            return None

    def save_ranking(self, experiment_id: str, prompt_id: str, generation_id: str,
                    rank: int, quality_score: float = None, evaluator_id: str = "human") -> str:
        ranking_id = str(uuid.uuid4())
        self.execute_commit("""
            INSERT INTO rankings 
            (id, experiment_id, prompt_id, generation_id, rank, quality_score, evaluator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (ranking_id, experiment_id, prompt_id, generation_id, rank, quality_score, evaluator_id))
        return ranking_id
    
    def get_rankings_by_experiment(self, experiment_id: str) -> List[Dict]:
        rows = self.execute_select("""
            SELECT r.*, g.output as generation_output, p.content as prompt_content, m.name as model_name
            FROM rankings r
            JOIN generations g ON r.generation_id = g.id
            JOIN prompts p ON r.prompt_id = p.id
            JOIN models m ON g.model_id = m.id
            WHERE r.experiment_id = ? ORDER BY r.prompt_id, r.rank
        """, (experiment_id,))
        return [dict(row) for row in rows]
    
    def save_analysis(self, experiment_id: str, analysis_type: str, results: Dict) -> str:
        analysis_id = str(uuid.uuid4())
        self.execute_commit("""
            INSERT INTO analysis_results (id, experiment_id, analysis_type, results)
            VALUES (?, ?, ?, ?)
        """, (analysis_id, experiment_id, analysis_type, json.dumps(results)))
        return analysis_id
    
    def get_analysis_by_experiment(self, experiment_id: str) -> List[Dict]:
        rows = self.execute_select(
            "SELECT * FROM analysis_results WHERE experiment_id = ? ORDER BY created_at",
            (experiment_id,)
        )
        return [dict(row) for row in rows]
        
    def migrate_localStorage_data(self, localStorage_data: Dict):
        logger.info("Starting localStorage data migration...")
        logger.warning("localStorage migration logic is complex and currently a placeholder.")
        pass

    def export_experiment_data(self, experiment_id: str) -> Dict:
        experiment = self.get_experiment(experiment_id)
        if not experiment:
            logger.error(f"Experiment {experiment_id} not found for export.")
            raise ValueError(f"Experiment {experiment_id} not found")
        
        return {
            'experiment': experiment,
            'prompts': self.get_prompts_by_experiment(experiment_id),
            'generations': self.get_generations_by_experiment(experiment_id),
            'rankings': self.get_rankings_by_experiment(experiment_id),
            'analysis': self.get_analysis_by_experiment(experiment_id)
        }
