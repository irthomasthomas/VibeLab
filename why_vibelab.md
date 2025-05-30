you probably don't need SVGs of ducks. But imagine you're trying to get an LLM to write Python code, or generate a complex JSON structure, or even just follow a really specific set of instructions for a marketing blurb.


**VibeLab uses SVGs as a rapid visual benchmark for testing prompt engineering techniques.**
**VibeLab isn't about *making* the best SVGs. The SVGs are just a super-fast proxy for prompt techniques.**

Think of it like this:
*   **Your problem:** 'How do I get the LLM to consistently follow my complex instructions?'
*   **Baseline prompt:** 'Give me X.' (e.g., 'Write Python code for a web scraper')
*   **Technique you're testing:** Adding a detailed system prompt like 'You are a principal software engineer specializing in robust Python. Your code must include error handling and comments.'

Instead of running that, getting a wall of Python, reading it, debugging it, then trying another system prompt... VibeLab outsources that 'did this technique work?' question to a quick visual task.

So, 'SVG of a pelican on a bicycle' + 'System: You are an expert SVG designer who pays attention to detail' -> pelican_image_A.
'SVG of a pelican on a bicycle' + 'System: Just make an SVG' -> pelican_image_B.

If pelican_image_A is consistently way better and more detailed than pelican_image_B across a few examples, it's a strong hint that the 'expert SVG designer' system prompt technique is *effective at making the LLM pay more attention to detail and apply expertise.*

**The bet is that a technique which demonstrably improves output for one structured task (like SVG code) has a good chance of improving output for *other* structured tasks you *do* care about (like Python code, JSON, or that marketing blurb with specific formatting).** It's about rapidly identifying *patterns* in prompt structures that work, using images as a quick, cheap visual shortcut for evaluation, so you can apply those winning patterns elsewhere without spending hours reading text."
