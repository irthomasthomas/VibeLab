#!/usr/bin/env python3
"""
VibeLab Custom Prompts Demo
Shows how to use the new custom prompt engineering features
"""

import time
import webbrowser
import subprocess
import os

def main():
    print("🧪 VibeLab Custom Prompts Demo")
    print("=" * 50)
    print()
    
    print("📋 WHAT'S NEW:")
    print("• Custom System Prompts - Set AI role and context")
    print("• Custom Modifiers - Create named prompt templates") 
    print("• Multi-Step Conversations - Iterative refinement")
    print("• Advanced Prompt Engineering - Test specific hypotheses")
    print()
    
    print("🎯 DEMO SCENARIOS:")
    print()
    
    print("1. SYSTEM PROMPT TESTING:")
    print("   System: 'You are a minimalist designer who values simplicity'")
    print("   Prompt: 'Create an SVG of a tree'")
    print("   Expected: Clean, simple tree design")
    print()
    
    print("2. CUSTOM MODIFIER TESTING:")
    print("   Modifier: 'Oxford Style'")
    print("   Template: 'Reinterpret in sophisticated academic style: {prompt}'")
    print("   Prompt: 'Create an SVG of a bicycle'")
    print("   Expected: Refined, academic approach to bicycle SVG")
    print()
    
    print("3. MULTI-STEP REFINEMENT:")
    print("   Step 1: 'Create an SVG of a house'")
    print("   Step 2: 'Add more architectural detail'")
    print("   Step 3: 'Make it more visually striking'")
    print("   Expected: Progressive improvement across steps")
    print()
    
    print("🔬 RESEARCH APPLICATIONS:")
    print("• Test if role-playing improves SVG quality")
    print("• Compare constraint-based vs free-form prompts")
    print("• Measure multi-step vs single-step effectiveness")
    print("• Validate prompt engineering techniques")
    print()
    
    print("🚀 TO START DEMO:")
    print("1. python llm_backend.py  (in one terminal)")
    print("2. python -m http.server 8000  (in another terminal)")
    print("3. Open http://localhost:8000")
    print("4. Try the custom prompt features in 'Experiment Setup'")
    print()
    
    choice = input("Start demo now? (y/N): ").lower().strip()
    if choice == 'y':
        print("\n🏁 Starting VibeLab demo...")
        
        # Start backend
        print("Starting backend...")
        backend = subprocess.Popen(['python', 'llm_backend.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        time.sleep(3)
        
        # Start frontend
        print("Starting frontend...")
        frontend = subprocess.Popen(['python', '-m', 'http.server', '8000'],
                                  stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE)
        time.sleep(2)
        
        # Open browser
        print("Opening browser...")
        webbrowser.open('http://localhost:8000')
        
        print("\n✅ Demo started! Check your browser.")
        print("   Press Ctrl+C to stop the demo.")
        
        try:
            backend.wait()
        except KeyboardInterrupt:
            print("\n🛑 Stopping demo...")
            backend.terminate()
            frontend.terminate()
            print("Demo stopped.")

if __name__ == "__main__":
    main()
