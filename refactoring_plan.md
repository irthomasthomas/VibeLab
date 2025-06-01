**Guiding Principles for Refactoring:**

*   **Separation of Concerns:** Clearly divide UI, state management, business logic, and API communication.
*   **Single Source of Truth:** Establish a clear and reliable data management strategy.
*   **Robustness & Error Handling:** Implement comprehensive error handling and recovery mechanisms.
*   **Testability:** Design code in a way that facilitates unit and integration testing.
*   **Maintainability:** Create a codebase that is easier to understand, modify, and extend.
*   **Scalability:** Improve the backend's ability to handle concurrent requests and potentially larger datasets.

**Phased Refactoring Strategy:**

This strategy prioritizes immediate stability for researchers, followed by foundational backend improvements, and then frontend modernization.

**Phase 0: Immediate Triage (Critical for Stability & Research Continuity)**

*   **2. Basic Backend Stability & Responsiveness:**
    *   **Upgrade Server:** Replace `HTTPServer` with a more robust framework like **FastAPI** or **Flask**. FastAPI is recommended for its async capabilities and ease of use.
    *   **Replace `subprocess` LLM Calls with `llm` Python API:** Modify `execute_llm` to use the `llm` Python library directly for model interactions (e.g., `llm.get_model(model_alias).prompt(...)`). This offers better control, error handling, performance, and integration compared to shelling out to the CLI.
        *   LLM calls, even via the Python API, can be blocking. If the chosen model's `prompt()` method is synchronous, run these calls in a thread pool executor (e.g., `concurrent.futures.ThreadPoolExecutor`) when using an async framework like FastAPI to prevent blocking the server's event loop.
        *   The `llm` Python API (like its CLI counterpart) may also support logging responses to its standard log database (e.g., `response.log_to_db()`), which can be maintained.
        *   Conversation IDs should continue to be managed, passing them to `model.prompt(..., conversation_id=...)` and retrieving updated ones from the response object.

        ```python
        # Example with FastAPI, llm Python API, and ThreadPoolExecutor
        # (Add to llm_backend.py, refactoring main() and EnhancedVibeLab)
        import asyncio
        from fastapi import FastAPI
        from concurrent.futures import ThreadPoolExecutor
        import llm # Import the llm library
        import time # For timing
        from typing import Optional, Tuple

        # app = FastAPI() # Initialize FastAPI app globally or in main()
        # executor = ThreadPoolExecutor(max_workers=5) # Adjust workers as needed

        # This function now uses the llm Python API and is synchronous
        def execute_llm_sync(model_alias: str, prompt_text: str, conversation_id: Optional[str] = None) -> Tuple[str, int, Optional[str]]:
            logger.info(f"Executing LLM model '{model_alias}' via Python API. Prompt length: {len(prompt_text)}")
            try:
                model_instance = llm.get_model(model_alias)
                if not model_instance:
                    logger.error(f"LLM model '{model_alias}' not found via llm library.")
                    raise Exception(f"Model '{model_alias}' not found by llm library.")

                start_time = time.time()
                
                # Use the conversation_id if provided to continue a conversation
                # The `llm` library handles conversation objects internally when an ID is passed.
                # Based on llm_consortium, it seems `conversation_id` can be passed directly.
                response_obj = model_instance.prompt(prompt_text, conversation_id=conversation_id)

                generation_time_ms = int((time.time() - start_time) * 1000)
                output_text = response_obj.text() # Get the textual response

                # Retrieve the updated conversation ID from the response object
                updated_conversation_id = None
                if hasattr(response_obj, 'conversation') and response_obj.conversation and hasattr(response_obj.conversation, 'id'):
                    updated_conversation_id = response_obj.conversation.id
                elif hasattr(response_obj, 'conversation_id') and response_obj.conversation_id: # Fallback for some llm versions/models
                    updated_conversation_id = response_obj.conversation_id

                # Optional: Log to llm's logs.db
                # try:
                #     # This requires the database object.
                #     # db_path = llm.cli.get_db_path() # Might need to adapt to get db_path correctly
                #     # logs_db = sqlite_utils.Database(str(db_path))
                #     # response_obj.log_to_db(logs_db)
                # except Exception as log_e:
                #     logger.warning(f"Could not log LLM response to logs.db: {log_e}")

                logger.info(f"LLM API call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms, New Conv ID: {updated_conversation_id}")
                return output_text, generation_time_ms, updated_conversation_id

            except llm.UnknownModelError:
                logger.error(f"LLM model '{model_alias}' not found by llm library.")
                raise Exception(f"llm model '{model_alias}' not found. Ensure it's installed/available to the llm tool.")
            except Exception as e:
                logger.error(f"Error executing llm via Python API for model {model_alias}: {e}")
                # Re-raise or handle specific llm exceptions
                raise Exception(f"Error executing llm: {str(e)}")

        # Your FastAPI route would then 'await' this wrapper if `execute_llm_sync` is run in an executor
        # async def execute_llm_async_wrapper(model_alias: str, prompt_text: str, conversation_id: Optional[str] = None):
        #     loop = asyncio.get_event_loop()
        #     # This runs the synchronous execute_llm_sync in a separate thread
        #     return await loop.run_in_executor(executor, execute_llm_sync, model_alias, prompt_text, conversation_id)
        ```

**Phase 1: Backend Modernization & Data Integrity**

*   **2. Leverage `llm` Python API for Model Interactions:**
    *   Fully transition LLM interactions from `subprocess` to the `llm` Python API (e.g., `llm.get_model(model_alias).prompt(...)` as detailed in Phase 0). This provides a consistent interface across different models supported by the `llm` tool and integrates better with Pythonic error handling and data structures.
    *   If the `llm` library or the underlying model SDKs it uses offer asynchronous methods for specific models, these should be preferred for direct `await` usage within an async backend framework like FastAPI, potentially bypassing the need for `ThreadPoolExecutor` for those specific models.
    *   For model interactions via the `llm` API that are inherently blocking (synchronous), continue to use the `ThreadPoolExecutor` pattern (as outlined in Phase 0) when called from async request handlers to avoid blocking the server's event loop.
    *   This approach supersedes direct usage of individual LLM SDKs (like `openai`, `anthropic`) unless a feature is needed that `llm` doesn't expose, as `llm` itself acts as an abstraction layer.

*   **3. Centralize Data Persistence in the Database:**
    *   Migrate functionality from the legacy `PromptManager` (used for `/prompts` templates) into the main database. Create a dedicated `templates` table if one doesn't exist.
    *   Update frontend `loadTemplates`, `saveCurrentAsTemplate`, `deleteTemplate`, `createNewTemplate` to use new backend API endpoints (e.g., `/api/v1/templates`).
    *   Make the database the **single source of truth**. `localStorage` should ideally only be used for UI preferences or temporary client-side caching, not primary experiment data.
    *   Refactor `saveExperiment` and `loadExperiment` in `app.js` to fetch/send full experiment structures (including prompts, variations, config, results, rankings) to/from the backend.

*   **4. Standardize and Version API Endpoints:**
    *   Move all APIs under a versioned path (e.g., `/api/v1/experiments`, `/api/v1/prompts`, `/api/v1/generations`).

**Phase 2: Frontend Decoupling & Modernization**

*   **1. Introduce a State Management Solution:**
    *   Adopt a dedicated state management library (e.g., Zustand for simplicity, Pinia if moving to Vue, Redux Toolkit if moving to React).
    *   Centralize `currentExperiment`, `generationQueue`, `results`, `rankings`, `templates`, etc., in this store.

*   **2. Create an API Service Layer (`ApiService.js`):**
    *   Abstract all `fetch` calls to the backend into a dedicated module. This service will handle request/response formatting and basic error handling.

*   **3. Modularize UI Components:**
    *   Break down the monolithic `VibeLab` class and HTML into smaller, reusable components (e.g., `ExperimentSetupForm`, `QueueItem`, `SVGCard`, `ResultsTable`).
    *   Initially, these can be plain JavaScript modules managing their own DOM sections. Consider a gradual move to a lightweight component library or a framework like Vue.js, Svelte, or React for better maintainability.
    *   UI updates should become reactive to state changes rather than manual DOM manipulation.

*   **4. Refine UI Code:**
    *   Replace direct `innerHTML` assignments with safer DOM creation methods (e.g., `document.createElement`, `appendChild`, `textContent`) or template literals where appropriate (or framework-specific templating).
    *   Consolidate redundant functions (e.g., different prompt adding methods).

