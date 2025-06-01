# User Test Results

- [ ]  '+ Add Custom Technique' button does not function.

- [ ]  LLM Consortium Models section is no good. This should probably be its own page, or else a large collapsible section. To begin with, it might be best to simply use consertium models which have already been saved, and add llm consortium creation at a later date. These llm consortium models can be retrieved from consortium_configs table in logs.db, the UI should list the name and the details, e.g. name	config	created_at
deepseek-opus-gempro-gempro	{"models": {"fast-deepseek-r1": 1, "claude-4-opus": 1, "gemini-2.5-pro-preview-05-06": 1}, "system_prompt": null, "confidence_threshold": 0.8, "max_iterations": 1, "minimum_iterations": 1, "arbiter": "gemini-2.5-pro-preview-05-06"}	2025-06-01 11:56:59

- [ ]  Models should allow choosing from the built-in llm models list and utilize type-to-filter for user convienience.
- [ ]  Generation Queue: "Implement random shuffling of generation display order" **Benefit:** Reduces order bias during human evaluation.
- [ ]  Start the generation queue automatically.
- [ ]  Combine Generation Queue and Evaluation so that on Create Experiment the user is shown the evaluation tab and a button to start the experiment or edit it. It should then show a progress bar on one line and the images to evaluate below that. The list of images should update automatically as they are received. The progess bar should be expandeble to reveal the whole queue list similar to how it looks now in Generation Queue.
- [ ]  Clear queue button seems to not work currently.

Evaluation:
- [ ] When drag-n-dropping the images to rank them, sometimes the images change, they change color or something, how is that possible?
