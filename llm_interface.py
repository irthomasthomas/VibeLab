import asyncio
import time
import os
import logging
from typing import Tuple, Optional
from concurrent.futures import ThreadPoolExecutor

import llm # The 'llm' CLI library

logger = logging.getLogger(__name__)

# Thread pool executor for running blocking LLM calls asynchronously
# This could be shared with the FastAPI app's executor if appropriate,
# but for modularity, it can have its own.
LLM_EXECUTOR_MAX_WORKERS = os.cpu_count() * 2 or 4
llm_executor = ThreadPoolExecutor(max_workers=LLM_EXECUTOR_MAX_WORKERS)

async def execute_llm_call_async(
    model_alias: str, 
    prompt_text: str, 
    conversation_id: Optional[str] = None
) -> Tuple[str, int, Optional[str]]:
    """
    Asynchronously executes an LLM call using the 'llm' library.

    Args:
        model_alias: The alias or ID of the LLM model to use.
        prompt_text: The text of the prompt to send to the model.
        conversation_id: Optional ID for continuing an existing conversation.

    Returns:
        A tuple containing:
            - output_text (str): The text response from the LLM.
            - generation_time_ms (int): The time taken for generation in milliseconds.
            - updated_conversation_id (Optional[str]): The updated conversation ID, if applicable.
            
    Raises:
        Exception: If the model is not found or if the LLM API call fails.
    """
    logger.info(f"Executing LLM model '{model_alias}' via 'llm' library. Prompt length: {len(prompt_text)}")
    loop = asyncio.get_event_loop()

    def _blocking_llm_call_wrapper():
        start_time = time.time()
        
        try:
            model_instance = llm.get_model(model_alias)
        except Exception as e: # llm library might raise various errors if model not found/configured
            logger.error(f"Failed to get model '{model_alias}': {e}")
            raise Exception(f"Model '{model_alias}' not found or configured in 'llm' library: {e}")

        if not model_instance: # Should be caught by the exception above, but as a safeguard.
            raise Exception(f"Model '{model_alias}' not found by 'llm' library.")
        
        # Execute the prompt
        # The `llm` library handles conversation state internally if conversation_id is passed.
        try:
            if conversation_id:
                # Ensure the conversation object exists for the model if llm expects it
                # Some models might handle conversation_id directly, others might need a conversation object
                # For simplicity, assume direct conversation_id usage is supported by the model.prompt()
                # If a specific model needs `conversation=model.conversation(id=conversation_id)`,
                # that logic would need to be more model-aware.
                # The `llm` library's `prompt()` method itself takes `conversation_id` directly.
                response = model_instance.prompt(prompt_text, conversation_id=conversation_id)
            else:
                response = model_instance.prompt(prompt_text)
        except Exception as e:
            logger.error(f"LLM prompt execution failed for model {model_alias}: {e}")
            raise Exception(f"LLM API call error: {str(e)}")
            
        generation_time_ms = int((time.time() - start_time) * 1000)
        output_text = response.text() # Gets the primary text content
        
        # Attempt to retrieve the conversation ID from the response object
        # This part can be tricky as it depends on the 'llm' library's response structure,
        # which can vary slightly by model adapter.
        updated_conv_id = None
        if hasattr(response, 'conversation') and response.conversation:
            if hasattr(response.conversation, 'id'):
                updated_conv_id = response.conversation.id
        elif hasattr(response, 'conversation_id') and response.conversation_id: # Fallback for some models
             updated_conv_id = response.conversation_id
        elif conversation_id and not updated_conv_id:
            # If an input conversation_id was given, and the response doesn't explicitly give a new one,
            # it's often assumed the same conversation_id persists or the library handles it.
            # For clarity, we only return an updated_conv_id if the library provides one.
            # If no new ID, the caller might reuse the old one or the library handles it implicitly.
            logger.debug(f"No new conversation ID explicitly returned by model {model_alias}, input was {conversation_id}.")


        logger.info(f"LLM API call successful for model {model_alias}. Output length: {len(output_text)}, Time: {generation_time_ms}ms. Conversation ID: {updated_conv_id}")
        return output_text, generation_time_ms, updated_conv_id

    try:
        # Runs the blocking call in a separate thread from the event loop's thread pool
        return await loop.run_in_executor(llm_executor, _blocking_llm_call_wrapper)
    except Exception as e:
        # Log the already formatted error from _blocking_llm_call_wrapper or a new one if loop.run_in_executor fails
        logger.error(f"Error during llm_executor task for model {model_alias}: {e}")
        # Re-raise to be handled by the caller in FastAPI
        raise

# Example usage (can be run with `python llm_interface.py` if __main__ is added)
# async def main_test():
#     try:
#         # Configure a default model alias for testing, e.g., using llm-gpt4all or similar free model
#         # Ensure you have a model like 'gpt-3.5-turbo' or a free one aliased/installed via 'llm' CLI
#         # For example: `llm install llm-gpt4all` then `llm keys set gpt4all` (no key needed)
#         # Or use a model that requires a key if you have one set up: `llm keys set openai`
#         test_model = "gpt-3.5-turbo" # Replace with your model alias
#         # You can list models with `llm models list`
#         output, gen_time, conv_id = await execute_llm_call_async(test_model, "Say 'Hello, VibeLab!'")
#         print(f"Output: {output}")
#         print(f"Time: {gen_time}ms")
#         print(f"Conversation ID: {conv_id}")

#         if conv_id:
#             output2, gen_time2, conv_id2 = await execute_llm_call_async(test_model, "What did I just say?", conversation_id=conv_id)
#             print(f"Output2: {output2}")
#             print(f"Time2: {gen_time2}ms")
#             print(f"Conversation ID2: {conv_id2}")

#     except Exception as e:
#         print(f"Error in example: {e}")

# if __name__ == "__main__":
#    asyncio.run(main_test())
