"""
VibeLab FastAPI Backend with LLM Python API
High-performance backend using direct LLM Python API integration
"""

import asyncio
import json # Ensure json is imported
import logging
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from fastapi import FastAPI, HTTPException, Request, status # Added status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import llm

from database_manager import DatabaseManager
from prompt_service import PromptService # Corrected import

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
    allow_origins=["http://localhost:8080", "http://localhost:8082"], # Allow frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Increased thread pool for better parallel processing
executor = ThreadPoolExecutor(max_workers=os.cpu_count() * 2 or 4) # More dynamic worker count

# Database and prompt service instances
db = DatabaseManager() # Default path "data/vibelab_research.db"
prompt_service = PromptService() # Default path "data/vibelab_research.db"

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
    success: bool # Consider removing this if using HTTP status codes primarily
    output: Optional[str] = None
    generation_time_ms: Optional[int] = None
    generation_id: Optional[str] = None
    conversation_id: Optional[str] = None
    error: Optional[str] = None # For specific error messages if needed beyond HTTP details

class ExperimentCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    config: Dict[str, Any] = Field(default_factory=dict)

class ExperimentResponse(BaseModel): # Can be simplified if returning Experiment model directly
    id: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    status: Optional[str] = None


class ModelInfo(BaseModel):
    name: str
    type: str = "base" # e.g., 'base', 'consortium'
    consortium_config: Dict[str, Any] = Field(default_factory=dict)

# Models for Prompt Templates
class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, example="My Awesome SVG Template")
    prompt: str = Field(..., min_length=1, example="Create an SVG of a cat wearing a hat.")
    tags: Optional[List[str]] = Field(default_factory=list, example=["cat", "svg", "beginner"])
    animated: Optional[bool] = False

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, example="My Updated SVG Template")
    prompt: Optional[str] = Field(None, min_length=1, example="Create a detailed SVG of a dog.")
    tags: Optional[List[str]] = Field(None, example=["dog", "intermediate"])
    animated: Optional[bool] = None

class TemplateResponse(TemplateBase):
    id: str = Field(..., example="a1b2c3d4-e5f6-7890-1234-567890abcdef")
    created: datetime # Using 'created' as in PromptService, maps to created_at in DB
    updated: datetime # Using 'updated' as in PromptService, maps to updated_at in DB

    class Config:
        orm_mode = True # For compatibility if returning ORM objects directly, though we map manually

# ==================== Helper Functions ====================

def validate_prompt_type(prompt_type: str) -> str:
    """Validate and normalize prompt_type"""
    if not prompt_type:
        return "base"
    clean_type = prompt_type.lower().strip().replace('-', '_').replace(' ', '_')
    logger.info(f"Validating prompt_type: '{prompt_type}' -> '{clean_type}'")
    return clean_type

async def execute_llm_python_api_async(model_alias: str, prompt_text: str, conversation_id: Optional[str] = None) -> Tuple[str, int, Optional[str]]:
    """Asynchronously execute LLM using Python API for better performance"""
    logger.info(f"Executing LLM model '{model_alias}' via Python API. Prompt length: {len(prompt_text)}")
    loop = asyncio.get_event_loop()
    
    def _blocking_llm_call():
        start_time = time.time()
        model_instance = llm.get_model(model_alias) # This might block
        if not model_instance:
            raise Exception(f"Model '{model_alias}' not found by llm library")
        
        if conversation_id:
            response = model_instance.prompt(prompt_text, conversation_id=conversation_id) # This blocks
        else:
            response = model_instance.prompt(prompt_text) # This blocks
        
        generation_time_ms = int((time.time() - start_time) * 1000)
        output_text = response.text()
        
        updated_conv_id = None
        if hasattr(response, 'conversation') and response.conversation and hasattr(response.conversation, 'id'):
            updated_conv_id = response.conversation.id
        elif hasattr(response, 'conversation_id'): # Fallback
             updated_conv_id = response.conversation_id
        
        logger.info(f"LLM API call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms")
        return output_text, generation_time_ms, updated_conv_id

    try:
        return await loop.run_in_executor(executor, _blocking_llm_call)
    except Exception as e:
        logger.error(f"Error executing llm via Python API for model {model_alias}: {e}")
        # Re-raise as a more specific error or handle appropriately
        raise Exception(f"LLM API Error: {str(e)}")


# ==================== API Endpoints ====================

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup: Initializing database...")
    try:
        db.init_database() # Ensure DB is initialized on startup
        logger.info("Database initialization check complete.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        # Depending on severity, might want to prevent app start or enter degraded mode
        # For now, just log.

@app.get("/")
async def root():
    return {"message": "VibeLab FastAPI Backend with LLM Python API", "version": "2.0.0"}

@app.get("/health")
async def health_check():
    # Add a simple DB check if desired
    try:
        db.execute_select("SELECT 1") # Simple query to check DB connection
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Health check DB error: {e}")
        db_status = "unhealthy"
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat(), "llm_api": "enabled", "database_status": db_status}

# --- Template Endpoints (Refactored) ---
@app.post("/api/v1/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template_api(template_data: TemplateCreate):
    try:
        created_template = prompt_service.save_template(
            name=template_data.name,
            prompt=template_data.prompt,
            tags=template_data.tags,
            animated=template_data.animated
        )
        # prompt_service.save_template returns a dict, map to TemplateResponse
        return TemplateResponse(**created_template)
    except ValueError as e: # Catch potential errors from service layer
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create template")

@app.get("/api/v1/templates", response_model=List[TemplateResponse])
async def get_all_templates_api():
    try:
        templates_dict = prompt_service.get_templates() # This returns {'templates': [...]}
        # Map list of dicts to list of TemplateResponse models
        response_list = [TemplateResponse(**t) for t in templates_dict.get("templates", [])]
        return response_list
    except Exception as e:
        logger.error(f"Error fetching all templates: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve templates")

@app.get("/api/v1/templates/{template_id}", response_model=TemplateResponse)
async def get_template_by_id_api(template_id: str):
    try:
        template = prompt_service.get_template(template_id)
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return TemplateResponse(**template)
    except ValueError: # If ID format is bad, though UUIDs are usually fine
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid template ID format")
    except Exception as e:
        logger.error(f"Error fetching template {template_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve template")

@app.put("/api/v1/templates/{template_id}", response_model=TemplateResponse)
async def update_template_api(template_id: str, template_data: TemplateUpdate):
    try:
        # prompt_service.update_template raises ValueError if not found
        updated_template = prompt_service.update_template(
            template_id=template_id,
            name=template_data.name,
            prompt=template_data.prompt,
            tags=template_data.tags,
            animated=template_data.animated
        )
        return TemplateResponse(**updated_template)
    except ValueError as e: # Catches "Template not found" or other validation errors
        # Differentiate between not found and bad request
        if "not found" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating template {template_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update template")

@app.delete("/api/v1/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template_api(template_id: str):
    try:
        # Consider having delete_template return a boolean or raise if not found
        # For now, assume it succeeds or raises an exception internally
        success = prompt_service.delete_template(template_id)
        if not success: # If delete_template was modified to return False on failure
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found or could not be deleted")
        return None # Return No Content
    except ValueError as e: # If prompt_service.delete_template raises ValueError for not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete template")

# --- Other Endpoints (Existing - to be reviewed/refactored later) ---

@app.post("/api/v1/generate", response_model=GenerationResponse) # Kept versioned endpoint
async def generate_content(request_data: GenerationRequest): # Changed to request_data for clarity
    try:
        output, generation_time, new_conv_id = await execute_llm_python_api_async(
            request_data.model,
            request_data.prompt,
            request_data.conversation_id
        )
        generation_id_val = None
        if request_data.experiment_id:
            logger.info(f"Saving generation for experiment_id: {request_data.experiment_id}")
            existing_model = db.get_model_by_name(request_data.model)
            model_id_val = existing_model['id'] if existing_model else db.register_model(request_data.model)
            
            prompt_id_val = request_data.prompt_id
            if not prompt_id_val:
                clean_type = validate_prompt_type(request_data.prompt_type)
                prompt_id_val = db.create_prompt(
                    experiment_id=request_data.experiment_id,
                    content=request_data.prompt,
                    prompt_type=clean_type
                )
            generation_id_val = db.save_generation(
                experiment_id=request_data.experiment_id,
                prompt_id=prompt_id_val,
                model_id=model_id_val,
                output=output,
                generation_time_ms=generation_time,
                conversation_id=new_conv_id, # Ensure this is correctly passed and handled
                metadata=request_data.metadata
            )
            logger.info(f"Saved generation with id: {generation_id_val}")
        
        return GenerationResponse(
            success=True, output=output, generation_time_ms=generation_time,
            generation_id=generation_id_val, conversation_id=new_conv_id
        )
    except Exception as e:
        logger.error(f"Error in generate_content: {str(e)}")
        # Return Pydantic model for error as well, or rely on HTTPException for client handling
        return GenerationResponse(success=False, error=str(e))


@app.post("/generate") # Legacy - consider deprecation path
async def generate_legacy(request: Request):
    data = await request.json()
    try:
        gen_request = GenerationRequest(**data)
    except Exception as e: # Pydantic validation error
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return await generate_content(gen_request)


@app.post("/api/v1/experiments", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
async def create_experiment_api(experiment_data: ExperimentCreate):
    try:
        exp_id = db.create_experiment(
            name=experiment_data.name,
            description=experiment_data.description,
            config=experiment_data.config
        )
        # Fetch the created experiment to return full details
        created_experiment = db.get_experiment(exp_id)
        if not created_experiment: # Should not happen if create_experiment is successful
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created experiment")
        return ExperimentResponse(**created_experiment) # Map dict to Pydantic model
    except Exception as e:
        logger.error(f"Error creating experiment: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create experiment")

@app.get("/api/v1/experiments", response_model=List[ExperimentResponse])
async def list_experiments_api():
    try:
        experiments_list = db.list_experiments() # Returns list of dicts
        return [ExperimentResponse(**exp) for exp in experiments_list] # Map to Pydantic
    except Exception as e:
        logger.error(f"Error listing experiments: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve experiments")

@app.get("/api/v1/experiments/{experiment_id}") # Removed response_model for now, complex return
async def get_experiment_api(experiment_id: str): # Renamed for consistency
    try:
        experiment = db.get_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
        
        # generations = db.get_generations_by_experiment(experiment_id)
        # For now, just return experiment detail, generations can be a separate endpoint or paginated.
        # This simplifies the ExperimentResponse model.
        return ExperimentResponse(**experiment)
        # return {
        #     "success": True, # Consider removing 'success' fields
        #     "experiment": experiment,
        #     "generations": generations # This part makes the response model complex
        # }
    except HTTPException: # Re-raise specific HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error getting experiment {experiment_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve experiment")


@app.get("/api/v1/models", response_model=List[ModelInfo])
async def list_models_api():
    try:
        models_list = db.get_models() # Assuming this returns list of dicts compatible with ModelInfo
        return [ModelInfo(**m) for m in models_list]
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve models")

@app.post("/api/v1/models", response_model=ModelInfo, status_code=status.HTTP_201_CREATED)
async def register_model_api(model_data: ModelInfo): # Changed to model_data
    try:
        # Ensure model name is unique or handle conflict
        existing_model = db.get_model_by_name(model_data.name)
        if existing_model:
            # Return existing if details match, or raise conflict
            # For simplicity, let's assume we can just return the existing one or update.
            # The current db.register_model uses INSERT OR REPLACE, which is fine.
             logger.warning(f"Model {model_data.name} already exists. Overwriting/Updating.")


        model_id = db.register_model( # This returns an ID, not the full model object
            name=model_data.name,
            model_type=model_data.type,
            consortium_config=model_data.consortium_config # Pass as dict
        )
        # Fetch the model to return full details
        registered_model = db.get_model_by_name(model_data.name) # Assuming get_model_by_name or by_id
        if not registered_model:
             raise HTTPException(status_code=500, detail="Failed to retrieve registered model")
        return ModelInfo(**registered_model) # Map dict to ModelInfo
    except Exception as e:
        logger.error(f"Error registering model: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register model")

# Remove old /prompts, /models/register endpoints as they are now /api/v1/templates and /api/v1/models
# The section "TEMPLATE ENDPOINTS (Compatibility)" and the old /prompts functions are removed by this rewrite.
# The old /models/register is also superseded.

# Consortium and available-models endpoints are kept for now, review later if they fit the core API strategy
DATABASE_PATH_CONSORTIUMS = 'data/vibelab_research.db' 

@app.get("/api/consortiums") # Consider versioning this like /api/v1/consortiums
async def get_saved_consortiums_api():
    # This endpoint directly uses sqlite3, should be refactored to use DatabaseManager
    # For now, leaving as is, but mark for refactor.
    # TODO: Refactor to use DatabaseManager methods for consistency and error handling.
    logger.warning("Endpoint /api/consortiums is using direct sqlite3 access and needs refactoring.")
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH_CONSORTIUMS) # type: ignore
        conn.row_factory = sqlite3.Row # type: ignore
        cursor = conn.cursor()
        # Assuming a table `consortium_configs` exists as per the original snippet
        cursor.execute("SELECT name, config, created_at FROM consortium_configs ORDER BY created_at DESC")
        consortiums = cursor.fetchall()
        result = [{"name": row["name"], "config": row["config"], "created_at": row["created_at"]} for row in consortiums]
        return result
    except sqlite3.Error as e: # type: ignore
        logger.error(f"Database error in get_saved_consortiums_api: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in get_saved_consortiums_api: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {e}")
    finally:
        if conn:
            conn.close()

PREDEFINED_MODELS = [
    # ... (keeping predefined models list as is for now) ...
    {"id": "anthropic/claude-3-opus-20240229", "name": "Claude 3 Opus"},
    {"id": "anthropic/claude-3-sonnet-20240229", "name": "Claude 3 Sonnet"},
    {"id": "anthropic/claude-3-haiku-20240307", "name": "Claude 3 Haiku"},
    {"id": "anthropic/claude-3-5-sonnet-20240620", "name": "Claude 3.5 Sonnet"}, 
    {"id": "openai/gpt-4-turbo", "name": "GPT-4 Turbo"},
    {"id": "openai/gpt-4", "name": "GPT-4"},
    {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
    {"id": "google/gemini-1.5-pro-latest", "name": "Gemini 1.5 Pro"},
    {"id": "google/gemini-1.5-flash-latest", "name": "Gemini 1.5 Flash"},
    {"id": "google/gemini-1.0-pro", "name": "Gemini 1.0 Pro"},
    {"id": "mistralai/mistral-large-latest", "name": "Mistral Large"}, # Standardized naming
    {"id": "mistralai/mistral-medium-latest", "name": "Mistral Medium"},
    {"id": "mistralai/mistral-small-latest", "name": "Mistral Small"},
    {"id": "cohere/command-r-plus", "name": "Cohere Command R+"},
    {"id": "cohere/command-r", "name": "Cohere Command R"},
]

@app.get("/api/available-models") # Consider versioning
async def get_available_models_list():
    # TODO: This should ideally fetch from the 'models' table in the DB
    # after they are registered, or combine with a static list of known callable models.
    logger.warning("Endpoint /api/available-models is returning a hardcoded list. Should integrate with DB models.")
    # For now, return hardcoded + DB models
    db_models_raw = db.get_models(active_only=True) # Get active models from DB
    db_model_list = [{"id": m["name"], "name": m["name"]} for m in db_models_raw] # Adapt to expected format

    # Combine and deduplicate, giving preference to DB models if names clash (though IDs should be unique)
    combined_models = {model["id"]: model for model in PREDEFINED_MODELS}
    for model in db_model_list:
        combined_models[model["id"]] = model # DB version will override if ID (name) is the same
    
    return list(combined_models.values())


if __name__ == "__main__":
    import uvicorn
    # The uvicorn.run call outside of this block was removed.
    # Ensure only one uvicorn.run call is active.
    logger.info("Starting VibeLab FastAPI backend...")
    uvicorn.run(app, host="0.0.0.0", port=8081, log_level="info")

