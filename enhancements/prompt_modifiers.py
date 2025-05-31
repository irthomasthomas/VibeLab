#!/usr/bin/env python3
"""
VibeLab Prompt Modifier System
Creates various prompt engineering techniques for testing
"""

class PromptModifier:
    def __init__(self):
        self.modifiers = {
            'base': self.base_prompt,
            'role_play': self.role_play_prompt,
            'chain_of_thought': self.chain_of_thought_prompt,
            'few_shot': self.few_shot_prompt,
            'step_by_step': self.step_by_step_prompt,
            'expert_persona': self.expert_persona_prompt,
            'constraint_focus': self.constraint_focus_prompt,
            'creative_inspiration': self.creative_inspiration_prompt
        }
    
    def base_prompt(self, prompt):
        return prompt
    
    def role_play_prompt(self, prompt):
        return f"You are an expert graphic designer with 10+ years of SVG creation experience. {prompt}"
    
    def chain_of_thought_prompt(self, prompt):
        return f"Think step-by-step about creating this SVG. First, consider the main elements, then the composition, then the styling. {prompt}"
    
    def few_shot_prompt(self, prompt):
        return f"""Here are examples of excellent SVG creation:
Example 1: Simple shapes with clean paths
Example 2: Proper use of viewBox and scaling
Example 3: Effective color schemes

Now create: {prompt}"""
    
    def step_by_step_prompt(self, prompt):
        return f"Break this down step-by-step: 1) Identify main visual elements 2) Plan the composition 3) Choose appropriate SVG elements 4) Create clean, optimized code. {prompt}"
    
    def expert_persona_prompt(self, prompt):
        return f"As a senior SVG developer who has created award-winning graphics, approach this with professional standards: {prompt}"
    
    def constraint_focus_prompt(self, prompt):
        return f"Focus on creating clean, minimal SVG code with optimal performance. Avoid unnecessary complexity. {prompt}"
    
    def creative_inspiration_prompt(self, prompt):
        return f"Draw inspiration from modern graphic design principles. Make it visually striking and memorable. {prompt}"
    
    def apply_modifier(self, prompt, modifier_type):
        if modifier_type in self.modifiers:
            return self.modifiers[modifier_type](prompt)
        return prompt
    
    def get_all_variations(self, base_prompt):
        variations = {}
        for modifier_type in self.modifiers:
            variations[modifier_type] = self.apply_modifier(base_prompt, modifier_type)
        return variations

if __name__ == "__main__":
    modifier = PromptModifier()
    test_prompt = "Create an SVG of a bicycle"
    
    print("Prompt Variations:")
    for variant_type, variant_prompt in modifier.get_all_variations(test_prompt).items():
        print(f"\n{variant_type.upper()}:")
        print(variant_prompt)
