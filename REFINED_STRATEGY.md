# VibeLab: Refined Development Strategy

**Project:** VibeLab - SVG Generation for LLM Prompt Evaluation

**Current State:**
- Amateur coded, not fully functional.
- Frontend: JS (index.html, app.js, various controllers like ApiService.js, ExperimentSetupController.js, GenerationQueueController.js, error_display_system.js). Numerous app.js backups indicate instability.
- Backend: Python/FastAPI (fastapi_backend_llm_api.py, database_api.py, database_manager.py, various prompt_manager.py versions).
- Data: SQLite (vibelab_research.db), JSON (prompts.json). Backups exist.
- Key issues: Stability, integration challenges between frontend/backend, inconsistent data management (multiple prompt managers), general lack of polish and robustness.

**Goal:** Transform VibeLab into a functional, stable, and usable tool for researchers to evaluate LLM prompt engineering techniques via SVG generation, as outlined in `paper-draft.md`.

---

## Phased Development Strategy

### **Phase 0: Project Setup & Initial Cleanup (Immediate Actions)**

*   **0.1. Version Control:**
    *   Initialize a Git repository immediately if one does not already exist.
    *   Commit all current files in their present state to establish a baseline. `git init && git add . && git commit -m "Initial commit of existing project state"`
*   **0.2. Archive Backups:**
    *   Create an `archive/` directory.
    *   Move all `*.backup` files and redundant `app.js` versions (e.g., `app.js.backup`, `app.js.backup2`, etc.) into `archive/`.
    *   Commit this change: `mkdir archive && mv *.backup* archive/ && mv app.js.backup* archive/ && git add . && git commit -m "Archive backup files and redundant app.js versions"`
*   **0.3. Environment Standardization:**
    *   **Python Backend:**
        *   Verify `start_vibelab_venv.sh` correctly sets up and activates a Python virtual environment. Document the Python version used/required (e.g., Python 3.9+).
        *   Generate/update `requirements.txt`: `pip freeze > requirements.txt` (after ensuring all necessary packages are installed in the venv). Commit this file.
    *   **Node.js Frontend (Assumption):**
        *   Check for `package.json`. If not present, create one: `npm init -y`.
        *   Identify and document Node.js version.
    *   **Documentation:** Create a `RUN.md` or update `README.md` with clear, concise steps to:
        *   Set up the Python virtual environment and install dependencies.
        *   Run the FastAPI backend server.
        *   Serve/run the frontend application.

### **Phase 1: Backend Stabilization & API Definition (Foundation First)**

*   **1.1. Consolidate Backend Logic:**
    *   **Prompt Management:**
        *   **Crucial Decision:** Analyze `prompt_manager.py`, `prompt_manager_fixed.py`, and `prompt_manager_db.py`.
        *   **Action:** Select *one* as the authoritative module for managing prompts (likely `prompt_manager_db.py` if database integration is desired, or a refactored `prompt_manager.py` that robustly uses the database).
        *   **Action:** Rename the chosen file to `prompt_service.py` or similar for clarity.
        *   **Action:** Move the other, now redundant, prompt manager files to the `archive/` directory.
    *   **Database Interface:**
        *   Review and solidify `database_manager.py`. Ensure it provides clear, reusable functions for all database operations.
        *   Verify `db_schema.sql` accurately reflects the current and intended database structure. Update if necessary.
*   **1.2. Define & Refine FastAPI Backend (`fastapi_backend_llm_api.py`):**
    *   **API Design:**
        *   Establish clear, RESTful API endpoints using Pydantic models for request/response validation.
        *   **Key Endpoints (Minimum Viable Product):**
            *   `POST /api/experiments`: Create a new experiment setup (baseline prompt, techniques, parameters).
            *   `POST /api/experiments/{experiment_id}/generate`: Trigger SVG generation for an experiment (could be async).
            *   `GET /api/experiments/{experiment_id}/generations`: Fetch generated SVGs for an experiment.
            *   `POST /api/evaluations`: Submit human ranking data (SVG IDs, rankings).
            *   `GET /api/experiments/{experiment_id}/results`: Retrieve aggregated results/statistics.
            *   (Optional) `GET /api/prompts`, `POST /api/prompts`: For managing a library of prompts if needed beyond experiment-specific ones.
    *   **Implementation:**
        *   Ensure `fastapi_backend_llm_api.py` implements these endpoints.
        *   Implement robust error handling (e.g., proper HTTP status codes, informative error messages).
        *   Integrate comprehensive logging (e.g., using Python's `logging` module).
        *   Utilize FastAPI's automatic OpenAPI documentation (Swagger UI/ReDoc) by ensuring Pydantic models and route docstrings are well-defined.
*   **1.3. LLM Interaction Service:**
    *   Create a new Python module, e.g., `llm_interface.py`.
    *   This module will encapsulate all logic for interacting with LLMs:
        *   Securely manage API keys (e.g., via environment variables).
        *   Format prompts according to the experiment's defined techniques.
        *   Execute calls to the LLM API(s).
        *   Handle LLM API responses and errors.
*   **1.4. Basic Backend Unit Tests:**
    *   Introduce `pytest`.
    *   Write initial unit tests for:
        *   Critical API endpoint logic (mocking LLM calls and DB interactions).
        *   Database interaction functions in `database_manager.py`.
        *   Prompt construction logic in the new `prompt_service.py` or `llm_interface.py`.

### **Phase 2: Frontend Overhaul & Connection (User Interface)**

*   **2.1. Identify & Rationalize Core Frontend Logic:**
    *   **Crucial Decision:** Determine the "canonical" `app.js` from the many backups. If all are problematic, select the most complete one as a base for refactoring or start fresh with a clear structure.
    *   Analyze `ExperimentSetupController.js`, `GenerationQueueController.js`, `ApiService.js`, and `error_display_system.js`.
    *   Plan for modularization: Break down `app.js` if it's monolithic. Aim for single-responsibility modules/components. Existing controllers might be a starting point if their scope is clear.
*   **2.2. Connect to Backend API:**
    *   Update or rewrite `ApiService.js` (or create a new `apiService.js`) to communicate reliably with the defined FastAPI endpoints from Phase 1.2.
    *   Implement robust error handling for API calls (e.g., displaying user-friendly messages, logging details to console).
    *   Use `fetch` or a lightweight library like `axios`.
*   **2.3. Implement Core UI Workflow (as per `paper-draft.md`):**
    *   **Experiment Setup:**
        *   Develop a form/interface for users to define a baseline prompt.
        *   Allow selection/configuration of prompt engineering techniques (e.g., few-shot, chain-of-thought, role-playing).
        *   Allow setting relevant parameters for generation.
    *   **SVG Display & Ranking:**
        *   Create an interface to display multiple generated SVGs (from `GET /api/experiments/{exp_id}/generations`).
        *   Implement reliable drag-and-drop ranking. (Investigate and fix issues hinted at by `fix_svg_drag.py`).
    *   **Results Submission:**
        *   Send ranking data to the backend (`POST /api/evaluations`).
    *   **Error Display:**
        *   Consistently use and improve `error_display_system.js` to show errors from both frontend operations and backend API calls.
*   **2.4. Frontend Linting & Basic Checks:**
    *   Introduce ESLint and Prettier for code consistency and quality.
    *   Regularly use `node --check <file.js>` for quick syntax validation of individual files during development.

### **Phase 3: End-to-End Functionality, Iteration & Polish**

*   **3.1. Full Workflow Testing:**
    *   Conduct thorough end-to-end testing of the entire user flow:
        1.  Create an experiment.
        2.  Trigger SVG generation.
        3.  View and rank generated SVGs.
        4.  Submit evaluations.
        5.  View basic results/confirmation.
*   **3.2. Statistical Analysis & Results Display:**
    *   **Backend:** Develop Python functions (likely in a new `analysis_service.py` or within the FastAPI app) to compute efficacy statistics from the stored evaluation data.
    *   **Frontend:** Create a view/component to clearly display these statistics to the researcher.
*   **3.3. Refinement & UX Improvements:**
    *   Gather feedback (even if internal initially) on the user experience.
    *   Iteratively improve UI/UX, addressing pain points and enhancing clarity.
    *   Optimize performance if necessary (e.g., loading of SVGs, API response times).
*   **3.4. Comprehensive Documentation:**
    *   **User Guide:** Detailed guide for researchers on how to use VibeLab, create experiments, interpret results, etc.
    *   **Developer Documentation:**
        *   Update `README.md` with full setup, development, and deployment instructions.
        *   Document API endpoints (Swagger/OpenAPI from FastAPI is a good start).
        *   Explain the project architecture, key modules, and data flow.

---

## Key Tools & Practices to Enforce Consistently:

*   **Version Control:** Git for all changes. Use feature branches and pull requests if multiple developers are involved.
*   **Python:**
    *   `venv` for environment isolation.
    *   `requirements.txt` for dependency management.
    *   Code Formatting: Black.
    *   Linting: Flake8.
    *   Testing: `pytest`.
*   **JavaScript:**
    *   Linting: ESLint.
    *   Code Formatting: Prettier.
    *   Consider a simple bundler (e.g., Parcel) or module scripts (`<script type="module">`) if JavaScript complexity grows significantly, to manage dependencies and improve organization.
*   **Consistent Logging:** Implement structured logging on both backend (Python `logging`) and frontend ( `console.log` strategically, potentially a simple logging wrapper).
*   **Modular Design:** Aggressively break down large files and components into smaller, focused, and reusable units.
*   **Clear API Contracts:** Maintain well-defined and documented API interfaces between frontend and backend, leveraging Pydantic and OpenAPI.

This refined strategy prioritizes establishing a stable core, then building out features methodically, with continuous emphasis on code quality, testing, and documentation.
EOF; sleep 2
