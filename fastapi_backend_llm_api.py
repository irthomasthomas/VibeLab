"""
VibeLab FastAPI Backend with LLM Python API
High-performance backend using direct LLM Python API integration
"""

import asyncio
import json
import logging
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import llm

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
    description="API for VibeLab - SVG generation research tool with LLM Python API",
    version="2.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8082"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Increased thread pool for better parallel processing
executor = ThreadPoolExecutor(max_workers=10)

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
    
    clean_type = prompt_type.lower().strip().replace('-', '_').replace(' ', '_')
    logger.info(f"Validating prompt_type: '{prompt_type}' -> '{clean_type}'")
    return clean_type

def execute_llm_python_api(model_alias: str, prompt_text: str, conversation_id: Optional[str] = None) -> Tuple[str, int, Optional[str]]:
    """Execute LLM using Python API for better performance"""
    logger.info(f"Executing LLM model '{model_alias}' via Python API. Prompt length: {len(prompt_text)}")
    
    try:
        start_time = time.time()
        
        # Get the model instance
        model_instance = llm.get_model(model_alias)
        if not model_instance:
            raise Exception(f"Model '{model_alias}' not found by llm library")
        
        # Execute the prompt
        if conversation_id:
            response = model_instance.prompt(prompt_text, conversation_id=conversation_id)
        else:
            response = model_instance.prompt(prompt_text)
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        output_text = response.text()
        
        # Get updated conversation ID
        updated_conversation_id = None
        if hasattr(response, 'conversation') and response.conversation:
            if hasattr(response.conversation, 'id'):
                updated_conversation_id = response.conversation.id
        elif hasattr(response, 'conversation_id'):
            updated_conversation_id = response.conversation_id
        
        logger.info(f"LLM API call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms")
        return output_text, generation_time_ms, updated_conversation_id
        
    except Exception as e:
        logger.error(f"Error executing llm via Python API for model {model_alias}: {e}")
        raise Exception(f"LLM API Error: {str(e)}")

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "VibeLab FastAPI Backend with LLM Python API", "version": "2.0.0"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "llm_api": "enabled"}

@app.post("/api/v1/generate", response_model=GenerationResponse)
async def generate_content(request: GenerationRequest):
    """Generate content using LLM Python API"""
    try:
        # Run the LLM call in the executor
        loop = asyncio.get_event_loop()
        output, generation_time, new_conv_id = await loop.run_in_executor(
            executor, 
            execute_llm_python_api,
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

# Keep compatibility endpoint for transition
@app.post("/generate")
async def generate_legacy(request: Request):
    """Legacy generation endpoint for compatibility"""
    data = await request.json()
    gen_request = GenerationRequest(**data)
    return await generate_content(gen_request)

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

# ==================== TEMPLATE ENDPOINTS (Compatibility) ====================


async def get_templates():
    """Get all prompt templates (compatibility endpoint)"""
    try:
        templates_data = prompt_manager.get_templates()
        # Extract just the templates array for frontend compatibility
        return {"success": True, "templates": templates_data["templates"]}
    except Exception as e:
        logger.error(f"Error loading templates: {str(e)}")
        return {"success": False, "error": str(e)}

# Fixed template endpoints for FastAPI backend

@app.get("/prompts")
async def get_templates():
    """Get all prompt templates (compatibility endpoint)"""
    try:
        templates_data = prompt_manager.get_templates()
        # Extract just the templates array for frontend compatibility
        return {"success": True, "templates": templates_data["templates"]}
    except Exception as e:
        logger.error(f"Error loading templates: {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/prompts")
async def save_template(request: Request):
    """Save a new template (compatibility endpoint)"""
    try:
        data = await request.json()
        
        # Extract required fields from the request data
        name = data.get('name')
        prompt = data.get('prompt')
        tags = data.get('tags', [])
        animated = data.get('animated', False)
        
        if not name or not prompt:
            return {"success": False, "error": "Name and prompt are required"}
        
        # Use the new PromptManager API
        result = prompt_manager.save_template(
            name=name,
            prompt=prompt,
            tags=tags,
            animated=animated
        )
        
        return {"success": True, "template": result}
    except Exception as e:
        logger.error(f"Error saving template: {str(e)}")
        return {"success": False, "error": str(e)}

@app.delete("/prompts")
async def delete_template(request: Request):
    """Delete a template (compatibility endpoint)"""
    try:
        data = await request.json()
        template_id = data.get('id')
        template_name = data.get('name')
        
        # Support both ID and name-based deletion for backward compatibility
        if template_id:
            prompt_manager.delete_template(template_id)
        elif template_name:
            # Find template by name and delete by ID
            templates_data = prompt_manager.get_templates()
            template_to_delete = None
            for template in templates_data["templates"]:
                if template["name"] == template_name:
                    template_to_delete = template
                    break
            
            if template_to_delete:
                prompt_manager.delete_template(template_to_delete["id"])
            else:
                return {"success": False, "error": f"Template '{template_name}' not found"}
        else:
            return {"success": False, "error": "Template ID or name required"}
        
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting template: {str(e)}")
        return {"success": False, "error": str(e)}

@app.post("/models/register")
async def register_model(request: Request):
    """Register a model in the database before first use"""
    try:
        data = await request.json()
        model_name = data.get('model')
        
        if not model_name:
            return {"success": False, "error": "Model name required"}
        
        # Check if model exists in llm
        try:
            model_instance = llm.get_model(model_name)
            if not model_instance:
                return {"success": False, "error": f"Model '{model_name}' not available in llm"}
        except Exception as e:
            return {"success": False, "error": f"Failed to validate model: {str(e)}"}
        
        # Register in database
        existing_model = db.get_model_by_name(model_name)
        if not existing_model:
            model_id = db.register_model(model_name)
            logger.info(f"Registered new model '{model_name}' with id: {model_id}")
            return {"success": True, "model_id": model_id, "message": "Model registered"}
        else:
            return {"success": True, "model_id": existing_model['id'], "message": "Model already registered"}
        
    except Exception as e:
        logger.error(f"Error registering model: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)

@app.post("/models/register")

@app.post("/models/register")
async def register_model(request: Request):
    """Register a model in the database before first use"""
    try:
        data = await request.json()
        model_name = data.get('model')
        
        if not model_name:
            return {"success": False, "error": "Model name required"}
        
        # Check if model exists in llm
        try:
            import llm
            model_instance = llm.get_model(model_name)
            if not model_instance:
                return {"success": False, "error": f"Model '{model_name}' not available in llm"}
        except Exception as e:
            return {"success": False, "error": f"Failed to validate model: {str(e)}"}
        
        # Register in database
        existing_model = db.get_model_by_name(model_name)
        if not existing_model:
            model_id = db.register_model(model_name)
            logger.info(f"Registered new model '{model_name}' with id: {model_id}")
            return {"success": True, "model_id": model_id, "message": "Model registered"}
        else:
            return {"success": True, "model_id": existing_model['id'], "message": "Model already registered"}
        
    except Exception as e:
        logger.error(f"Error registering model: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)
