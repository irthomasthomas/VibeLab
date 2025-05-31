-- VibeLab Research Engine Database Schema

-- Experiments table
CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    config JSON
);

-- Prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    experiment_id TEXT,
    type TEXT CHECK(type IN ('base', 'modified', 'system', 'multi_step')),
    content TEXT NOT NULL,
    parent_prompt_id TEXT,
    modifier_used TEXT,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id),
    FOREIGN KEY (parent_prompt_id) REFERENCES prompts(id)
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT CHECK(type IN ('base', 'consortium')),
    consortium_config JSON,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generations table
CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    prompt_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    conversation_id TEXT,
    step_number INTEGER DEFAULT 1,
    output TEXT NOT NULL,
    svg_content TEXT,
    generation_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);

-- Rankings table
CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    prompt_id TEXT NOT NULL,
    generation_id TEXT NOT NULL,
    rank INTEGER,
    quality_score REAL,
    evaluator_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id),
    FOREIGN KEY (prompt_id) REFERENCES prompts(id),
    FOREIGN KEY (generation_id) REFERENCES generations(id)
);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    analysis_type TEXT,
    results JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_generations_experiment ON generations(experiment_id);
CREATE INDEX IF NOT EXISTS idx_generations_prompt ON generations(prompt_id);
CREATE INDEX IF NOT EXISTS idx_rankings_experiment ON rankings(experiment_id);
CREATE INDEX IF NOT EXISTS idx_prompts_experiment ON prompts(experiment_id);
