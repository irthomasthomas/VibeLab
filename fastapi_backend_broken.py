"""
VibeLab FastAPI Backend
Modern, async-capable backend for VibeLab using FastAPI
"""

import asyncio
import json
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
# import llm  # Will use subprocess for now

from database_manager import DatabaseManager
from prompt_manager import PromptManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VibeLab API",
    description="API for VibeLab - SVG generation research tool",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8082"],  # Configure as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for blocking LLM operations
executor = ThreadPoolExecutor(max_workers=5)

# Database and prompt manager instances
db = DatabaseManager()
prompt_manager = PromptManager()

# ==================== Pydantic Models ====================

class GenerationRequest(BaseModel):
    model: str
    prompt: str
    experiment_id: Optional[str] = None
    prompt_type: str = "base"
    conversation_id: Optional[str] = None
    prompt_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class GenerationResponse(BaseModel):
    success: bool
    output: Optional[str] = None
    generation_time_ms: Optional[int] = None
    generation_id: Optional[str] = None
    conversation_id: Optional[str] = None
    error: Optional[str] = None

class ExperimentCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    config: Dict[str, Any] = Field(default_factory=dict)

class ExperimentResponse(BaseModel):
    success: bool
    experiment_id: Optional[str] = None
    error: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    type: str = "base"
    consortium_config: Dict[str, Any] = Field(default_factory=dict)

# ==================== Helper Functions ====================

def validate_prompt_type(prompt_type: str) -> str:
    """Validate and normalize prompt_type"""
    if not prompt_type:
        return "base"
    
    # Normalize the type
    clean_type = prompt_type.lower().strip().replace('-', '_').replace(' ', '_')
    
    logger.info(f"Validating prompt_type: '{prompt_type}' -> '{clean_type}'")
    return clean_type

def execute_llm_sync(model_alias: str, prompt_text: str, conversation_id: Optional[str] = None) -> tuple[str, int, Optional[str]]:
    """Execute LLM using subprocess (temporary until llm Python API is available)"""
    logger.info(f"Executing LLM model '{model_alias}' via subprocess. Prompt length: {len(prompt_text)}")
    
    try:
        import subprocess
        import time
        
        cmd = ['llm', '-m', model_alias]
        if conversation_id:
            cmd.extend(['-c', conversation_id])
        
        start_time = time.time()
        
        result = subprocess.run(
            cmd,
            input=prompt_text,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        
        if result.returncode != 0:
            raise Exception(f"LLM command failed: {result.stderr}")
        
        output_text = result.stdout.strip()
        
        # Extract conversation ID from stderr if available
        updated_conversation_id = None
        if result.stderr and 'conversation_id:' in result.stderr:
            match = re.search(r'conversation_id: (\S+)', result.stderr)
            if match:
                updated_conversation_id = match.group(1)
        
        logger.info(f"LLM subprocess call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms")
        return output_text, generation_time_ms, updated_conversation_id
        
    except subprocess.TimeoutExpired:
        logger.error(f"LLM command timed out for model {model_alias}")
        raise Exception("LLM command timed out")
    except Exception as e:
        logger.error(f"Error executing llm via subprocess for model {model_alias}: {e}")
        raise
    """Execute LLM using the Python API (synchronous)"""
    logger.info(f"Executing LLM model '{model_alias}' via Python API. Prompt length: {len(prompt_text)}")
    
    try:
        import time
        
        model_instance = llm.get_model(model_alias)
        if not model_instance:
            logger.error(f"LLM model '{model_alias}' not found via llm library.")
            raise Exception(f"Model '{model_alias}' not found by llm library.")
        
        start_time = time.time()
        
        # Use the conversation_id if provided
        response_obj = model_instance.prompt(prompt_text, conversation_id=conversation_id)
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        output_text = response_obj.text()
        
        # Retrieve updated conversation ID
        updated_conversation_id = None
        if hasattr(response_obj, 'conversation') and response_obj.conversation:
            updated_conversation_id = getattr(response_obj.conversation, 'id', None)
        
        logger.info(f"LLM API call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms")
        return output_text, generation_time_ms, updated_conversation_id
        
    except Exception as e:
        logger.error(f"Error executing llm via Python API for model {model_alias}: {e}")
        raise

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "VibeLab FastAPI Backend", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.post("/api/v1/generate", response_model=GenerationResponse)
async def generate_content(request: GenerationRequest):
    """Generate content using LLM"""
    try:
        # Run the synchronous LLM call in the executor
        loop = asyncio.get_event_loop()
        output, generation_time, new_conv_id = await loop.run_in_executor(
            executor, 
            execute_llm_sync,
            request.model,
            request.prompt,
            request.conversation_id
        )
        
        generation_id = None
        
        # Save to database if experiment_id provided
        if request.experiment_id:
            logger.info(f"Saving generation for experiment_id: {request.experiment_id}")
            
            # Ensure model is registered
            existing_model = db.get_model_by_name(request.model)
            if not existing_model:
                model_id = db.register_model(request.model)
                logger.info(f"Registered new model '{request.model}' with id: {model_id}")
            else:
                model_id = existing_model['id']
            
            # Handle prompt creation or use existing
            prompt_id = request.prompt_id
            if not prompt_id:
                clean_type = validate_prompt_type(request.prompt_type)
                logger.info(f"Creating new prompt. Type: '{clean_type}', Content: '{request.prompt[:50]}...'")
                
                prompt_id = db.create_prompt(
                    experiment_id=request.experiment_id,
                    content=request.prompt,
                    prompt_type=clean_type
                )
                logger.info(f"Created prompt with id: {prompt_id}, type: {clean_type}")
            
            # Save generation
            generation_id = db.save_generation(
                experiment_id=request.experiment_id,
                prompt_id=prompt_id,
                model_id=model_id,
                output=output,
                generation_time_ms=generation_time,
                conversation_id=new_conv_id,
                metadata=request.metadata
            )
            logger.info(f"Saved generation with id: {generation_id}")
        
        return GenerationResponse(
            success=True,
            output=output,
            generation_time_ms=generation_time,
            generation_id=generation_id,
            conversation_id=new_conv_id
        )
        
    except Exception as e:
        logger.error(f"Error in generate_content: {str(e)}")
        return GenerationResponse(success=False, error=str(e))

@app.post("/api/v1/experiments", response_model=ExperimentResponse)
async def create_experiment(experiment: ExperimentCreate):
    """Create a new experiment"""
    try:
        experiment_id = db.create_experiment(
            name=experiment.name,
            description=experiment.description,
            config=experiment.config
        )
        logger.info(f"Created experiment: {experiment.name} ({experiment_id})")
        
        return ExperimentResponse(success=True, experiment_id=experiment_id)
        
    except Exception as e:
        logger.error(f"Error creating experiment: {str(e)}")
        return ExperimentResponse(success=False, error=str(e))

@app.get("/api/v1/experiments")
async def list_experiments():
    """List all experiments"""
    try:
        experiments = db.get_experiments()
        return {"success": True, "experiments": experiments}
    except Exception as e:
        logger.error(f"Error listing experiments: {str(e)}")
        return {"success": False, "error": str(e)}

@app.get("/api/v1/experiments/{experiment_id}")
async def get_experiment(experiment_id: str):
    """Get experiment details"""
    try:
        experiment = db.get_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        
        generations = db.get_generations_by_experiment(experiment_id)
        
        return {
            "success": True,
            "experiment": experiment,
            "generations": generations
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting experiment: {str(e)}")
        return {"success": False, "error": str(e)}

@app.get("/api/v1/models")
async def list_models():
    """List all registered models"""
    try:
        models = db.get_models()
        return {"success": True, "models": models}
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/api/v1/models")
async def register_model(model: ModelInfo):
    """Register a new model"""
    try:
        model_id = db.register_model(
            name=model.name,
            model_type=model.type,
            consortium_config=json.dumps(model.consortium_config)
        )
        return {"success": True, "model_id": model_id}
    except Exception as e:
        logger.error(f"Error registering model: {str(e)}")
        return {"success": False, "error": str(e)}

# Keep compatibility endpoint for transition
@app.post("/generate")
async def generate_legacy(request: Request):
    """Legacy generation endpoint for compatibility"""
    data = await request.json()
    gen_request = GenerationRequest(**data)
    return await generate_content(gen_request)

# ==================== TEMPLATE ENDPOINTS (Compatibility) ====================

@app.get("/prompts")
async def get_templates():
    """Get all prompt templates (compatibility endpoint)"""
    try:
        templates = prompt_manager.get_templates()
        return {"success": True, "templates": templates}
    except Exception as e:
        logger.error(f"Error loading templates: {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/prompts")
async def save_template(request: Request):
    """Save a new template (compatibility endpoint)"""
    try:
        data = await request.json()
        prompt_manager.save_template(data)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving template: {str(e)}")
        return {"success": False, "error": str(e)}

@app.delete("/prompts")
async def delete_template(request: Request):
    """Delete a template (compatibility endpoint)"""
    try:
        data = await request.json()
        template_name = data.get('name')
        if not template_name:
            return {"success": False, "error": "Template name required"}
        
        prompt_manager.delete_template(template_name)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        return {"success": False, "error": str(e)}

# ==================== Main ====================

if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting VibeLab FastAPI Backend on port 8081")
    uvicorn.run(app, host="0.0.0.0", port=8081)

# ==================== TEMPLATE ENDPOINTS (Compatibility) ====================

@app.post("/prompts")
async def save_template(request: Request):
    """Save a new template (compatibility endpoint)"""
    try:
        data = await request.json()
        prompt_manager.save_template(data)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error saving template: {str(e)}")
        return {"success": False, "error": str(e)}

@app.delete("/prompts")
async def delete_template(request: Request):
    """Delete a template (compatibility endpoint)"""
    try:
        data = await request.json()
        template_name = data.get('name')
        if not template_name:
            return {"success": False, "error": "Template name required"}
        
        prompt_manager.delete_template(template_name)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        return {"success": False, "error": str(e)}
