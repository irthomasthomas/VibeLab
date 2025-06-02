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
from typing import Dict, List, Optional, Any, Tuple # Ensure List, Optional are imported

from fastapi import FastAPI, HTTPException, Request, status 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse # Ensure JSONResponse is imported
from pydantic import BaseModel, Field
import llm

from database_manager import DatabaseManager
from prompt_service import PromptService 
from llm_interface import execute_llm_call_async, llm_executor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VibeLab API",
    description="API for VibeLab - SVG generation research tool with LLM Python API",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8082"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager() 
prompt_service = PromptService() 

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
    id: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    status: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    type: str = "base" 
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
    created: datetime 
    updated: datetime 

    class Config:
        orm_mode = True # Deprecated in Pydantic V2, use model_config = {"from_attributes": True}
        # For now, keeping orm_mode for compatibility if Pydantic V1 is somehow in use.
        # If using Pydantic V2 (likely with modern FastAPI), this should be:
        # model_config = {"from_attributes": True}

# NEW Pydantic Models for Evaluation
class EvaluationEntry(BaseModel):
    generation_id: str
    rank: int
    quality_score: Optional[float] = None
    evaluator_id: Optional[str] = Field(default="human_default")

class EvaluationSubmit(BaseModel):
    experiment_id: str 
    evaluations: List[EvaluationEntry]

# ==================== Helper Functions ====================
# (validate_prompt_type was here, can be kept or removed if not used elsewhere)
def validate_prompt_type(prompt_type: str) -> str:
    if not prompt_type: return "base"
    return prompt_type.lower().strip().replace('-', '_').replace(' ', '_')

# ==================== API Endpoints ====================

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup: Initializing database...")
    try:
        db.init_database() 
        logger.info("Database initialization check complete.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

@app.get("/")
async def root():
    return {"message": "VibeLab FastAPI Backend with LLM Python API", "version": "2.0.0"}

@app.get("/health")
async def health_check():
    try:
        db.execute_select("SELECT 1") 
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
            name=template_data.name, prompt=template_data.prompt,
            tags=template_data.tags, animated=template_data.animated
        )
        return TemplateResponse(**created_template)
    except ValueError as e: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create template")

@app.get("/api/v1/templates", response_model=List[TemplateResponse])
async def get_all_templates_api():
    try:
        templates_dict = prompt_service.get_templates() 
        return [TemplateResponse(**t) for t in templates_dict.get("templates", [])]
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
    except ValueError: 
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid template ID format")
    except Exception as e:
        logger.error(f"Error fetching template {template_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve template")

@app.put("/api/v1/templates/{template_id}", response_model=TemplateResponse)
async def update_template_api(template_id: str, template_data: TemplateUpdate):
    try:
        updated_template = prompt_service.update_template(
            template_id=template_id, name=template_data.name, prompt=template_data.prompt,
            tags=template_data.tags, animated=template_data.animated
        )
        return TemplateResponse(**updated_template)
    except ValueError as e: 
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
        success = prompt_service.delete_template(template_id)
        if not success: 
             raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found or could not be deleted")
    except ValueError as e: 
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete template")
    return None 

# --- Generation Endpoint ---
@app.post("/api/v1/generate", response_model=GenerationResponse) 
async def generate_content(request_data: GenerationRequest): 
    try:
        output, generation_time, new_conv_id = await execute_llm_call_async(
            request_data.model, request_data.prompt, request_data.conversation_id
        )
        generation_id_val = None
        if request_data.experiment_id:
            logger.info(f"Saving generation for experiment_id: {request_data.experiment_id}")
            existing_model = db.get_model_by_name(request_data.model)
            model_id_val = existing_model['id'] if existing_model else db.register_model(name=request_data.model) # Ensure name arg
            
            prompt_id_val = request_data.prompt_id
            if not prompt_id_val:
                clean_type = validate_prompt_type(request_data.prompt_type)
                prompt_id_val = db.create_prompt(
                    experiment_id=request_data.experiment_id,
                    content=request_data.prompt, # This is the full, templated prompt sent to LLM
                    prompt_type=clean_type 
                    # Consider how original base prompt and technique details are stored if needed for later analysis
                )
            generation_id_val = db.save_generation(
                experiment_id=request_data.experiment_id, prompt_id=prompt_id_val,
                model_id=model_id_val, output=output, generation_time_ms=generation_time,
                conversation_id=new_conv_id, metadata=request_data.metadata
            )
            logger.info(f"Saved generation with id: {generation_id_val}")
        
        return GenerationResponse(
            success=True, output=output, generation_time_ms=generation_time,
            generation_id=generation_id_val, conversation_id=new_conv_id
        )
    except Exception as e:
        logger.error(f"Error in generate_content: {str(e)}")
        return GenerationResponse(success=False, error=str(e))

@app.post("/generate") 
async def generate_legacy(request: Request):
    data = await request.json()
    try:
        gen_request = GenerationRequest(**data)
    except Exception as e: 
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    return await generate_content(gen_request)

# --- Experiment Endpoints ---
@app.post("/api/v1/experiments", response_model=ExperimentResponse, status_code=status.HTTP_201_CREATED)
async def create_experiment_api(experiment_data: ExperimentCreate):
    try:
        exp_id = db.create_experiment(
            name=experiment_data.name, description=experiment_data.description,
            config=experiment_data.config
        )
        created_experiment = db.get_experiment(exp_id)
        if not created_experiment: 
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created experiment")
        return ExperimentResponse(**created_experiment) 
    except Exception as e:
        logger.error(f"Error creating experiment: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create experiment")

@app.get("/api/v1/experiments", response_model=List[ExperimentResponse])
async def list_experiments_api():
    try:
        experiments_list = db.list_experiments() 
        return [ExperimentResponse(**exp) for exp in experiments_list] 
    except Exception as e:
        logger.error(f"Error listing experiments: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve experiments")

@app.get("/api/v1/experiments/{experiment_id}", response_model=ExperimentResponse) 
async def get_experiment_api(experiment_id: str): 
    try:
        experiment = db.get_experiment(experiment_id)
        if not experiment:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experiment not found")
        return ExperimentResponse(**experiment)
    except HTTPException: 
        raise
    except Exception as e:
        logger.error(f"Error getting experiment {experiment_id}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve experiment")

# --- Model Endpoints ---
@app.get("/api/v1/models", response_model=List[ModelInfo])
async def list_models_api():
    try:
        models_list = db.get_models() 
        return [ModelInfo(**m) for m in models_list]
    except Exception as e:
        logger.error(f"Error listing models: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve models")

@app.post("/api/v1/models", response_model=ModelInfo, status_code=status.HTTP_201_CREATED)
async def register_model_api(model_data: ModelInfo): 
    try:
        existing_model = db.get_model_by_name(model_data.name)
        if existing_model:
             logger.warning(f"Model {model_data.name} already exists. Overwriting/Updating via INSERT OR REPLACE.")
        
        # db.register_model internally uses INSERT OR REPLACE.
        # It returns the model_id (which is newly generated UUID by default).
        # To return the full ModelInfo, we should fetch it after registration.
        model_id_returned = db.register_model( 
            name=model_data.name, model_type=model_data.type,
            consortium_config=model_data.consortium_config 
        )
        # Fetch the model using the name, as ID might be new if it was an insert.
        registered_model_details = db.get_model_by_name(model_data.name)
        if not registered_model_details:
             # This case should be rare if register_model succeeded.
             raise HTTPException(status_code=500, detail="Failed to retrieve registered model details after registration.")
        return ModelInfo(**registered_model_details) 
    except Exception as e:
        logger.error(f"Error registering model: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register model")

# --- NEW Evaluation Endpoint ---
@app.post("/api/v1/evaluations", status_code=status.HTTP_201_CREATED) # Default 201, will be overridden on errors
async def submit_evaluations_api(submission: EvaluationSubmit):
    saved_ranking_ids = []
    errors_detail = [] # More structured errors
    
    if not submission.evaluations:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evaluations list cannot be empty.")

    for eval_entry in submission.evaluations:
        gen_details = db.get_identifiers_for_generation(eval_entry.generation_id)
        
        if not gen_details:
            err_msg = f"Generation ID {eval_entry.generation_id} not found."
            logger.warning(err_msg)
            errors_detail.append({"generation_id": eval_entry.generation_id, "error": err_msg})
            continue
        
        # Validate that the generation belongs to the submitted experiment_id
        if gen_details['experiment_id'] != submission.experiment_id:
            err_msg = (f"Generation ID {eval_entry.generation_id} (exp: {gen_details['experiment_id']}) "
                       f"does not belong to submitted experiment {submission.experiment_id}.")
            logger.warning(err_msg)
            errors_detail.append({"generation_id": eval_entry.generation_id, "error": err_msg})
            continue
            
        prompt_id = gen_details['prompt_id']
        
        try:
            rank_id = db.save_ranking(
                experiment_id=submission.experiment_id,
                prompt_id=prompt_id,
                generation_id=eval_entry.generation_id,
                rank=eval_entry.rank,
                quality_score=eval_entry.quality_score,
                evaluator_id=eval_entry.evaluator_id
            )
            saved_ranking_ids.append(rank_id)
        except Exception as e: # Catch specific DB errors if possible
            err_msg = f"Failed to save ranking for generation {eval_entry.generation_id}: {str(e)}"
            logger.error(err_msg, exc_info=True)
            errors_detail.append({"generation_id": eval_entry.generation_id, "error": err_msg})

    if errors_detail:
        # If any error occurred during processing of items
        if not saved_ranking_ids: # No items were successfully processed
            # All items failed, likely due to bad input or consistent issue
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, # Or 400 if errors are more like bad requests
                content={"message": "No evaluations could be processed successfully.", "errors": errors_detail, "saved_ranking_ids": [] }
            )
        else: # Partial success
            return JSONResponse(
                status_code=status.HTTP_207_MULTI_STATUS, 
                content={"message": "Evaluations processed with some errors.", "saved_ranking_ids": saved_ranking_ids, "errors": errors_detail}
            )
            
    return {"message": "All evaluations submitted successfully.", "ranking_ids": saved_ranking_ids, "errors": []}


# --- Other Endpoints (Review Later) ---
@app.get("/api/consortiums") 
async def get_saved_consortiums_api():
    logger.warning("Endpoint /api/consortiums is using direct sqlite3 access and needs refactoring.")
    # Placeholder for refactored version using db_manager
    # For now, return empty or a mock response.
    # This table  is not in db_schema.sql yet.
    # return [] 
    # To avoid breaking frontend if it calls this, let's check if table exists.
    try:
        # A bit of a hack to check if table exists. Proper way is to use db_manager.
        # This functionality might be removed or properly integrated later.
        # For now, assuming it should query 'models' table with type 'consortium' if that's the intent.
        # The original code queried "consortium_configs".
        # Let's assume the table doesn't exist for now as it's not in schema.
        logger.info("Consortium feature not fully implemented or table 'consortium_configs' missing.")
        return [] # Return empty list if table/feature not ready
    except Exception as e:
        logger.error(f"Error in /api/consortiums (placeholder): {e}")
        raise HTTPException(status_code=500, detail="Error processing consortiums.")


PREDEFINED_MODELS = [
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
    {"id": "mistralai/mistral-large-latest", "name": "Mistral Large"}, 
    {"id": "mistralai/mistral-medium-latest", "name": "Mistral Medium"},
    {"id": "mistralai/mistral-small-latest", "name": "Mistral Small"},
    {"id": "cohere/command-r-plus", "name": "Cohere Command R+"},
    {"id": "cohere/command-r", "name": "Cohere Command R"},
]

@app.get("/api/available-models") 
async def get_available_models_list():
    logger.info("Fetching available models: combining predefined list with database models.")
    db_models_raw = db.get_models(active_only=True) 
    db_model_list = [{"id": m["name"], "name": m["name"], "type": m.get("type", "db")} for m in db_models_raw] 
    
    combined_models_dict = {model["id"]: model for model in PREDEFINED_MODELS}
    for model in db_model_list:
        if model["id"] not in combined_models_dict: # Add if not already in predefined
            combined_models_dict[model["id"]] = model
        else: # If in predefined, update with DB details if necessary (e.g. type)
            combined_models_dict[model["id"]].update(model) 
            
    return list(combined_models_dict.values())

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting VibeLab FastAPI backend...")
    uvicorn.run(app, host="0.0.0.0", port=8081, log_level="info")

