import json
import os
from datetime import datetime
import uuid

class PromptManager:
    def __init__(self, storage_path="data/prompts.json"):
        self.storage_path = storage_path
        self.ensure_storage_exists()
    
    def ensure_storage_exists(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            default_data = {
                "templates": [
                    {
                        "id": "pelican-bicycle",
                        "name": "Pelican on Bicycle",
                        "prompt": "SVG of a pelican riding a bicycle",
                        "tags": ["animals", "vehicles"],
                        "created": datetime.now().isoformat(),
                        "animated": False
                    },
                    {
                        "id": "raccoon-biplane", 
                        "name": "Raccoon Flying Biplane",
                        "prompt": "SVG of a raccoon flying a biplane",
                        "tags": ["animals", "aircraft"],
                        "created": datetime.now().isoformat(),
                        "animated": False
                    }
                ]
            }
            self.save_data(default_data)
    
    def load_data(self):
        with open(self.storage_path, 'r') as f:
            return json.load(f)
    
    def save_data(self, data):
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def get_templates(self):
        data = self.load_data()
        return data.get("templates", [])
    
    def get_template(self, template_id):
        templates = self.get_templates()
        return next((t for t in templates if t["id"] == template_id), None)
    
    def save_template(self, name, prompt, tags=None, animated=False):
        data = self.load_data()
        new_template = {
            "id": str(uuid.uuid4()),
            "name": name,
            "prompt": prompt,
            "tags": tags or [],
            "created": datetime.now().isoformat(),
            "animated": animated
        }
        data["templates"].append(new_template)
        self.save_data(data)
        return new_template
    
    def update_template(self, template_id, name=None, prompt=None, tags=None, animated=None):
        data = self.load_data()
        templates = data["templates"]
        
        for i, template in enumerate(templates):
            if template["id"] == template_id:
                if name is not None:
                    template["name"] = name
                if prompt is not None:
                    template["prompt"] = prompt
                if tags is not None:
                    template["tags"] = tags
                if animated is not None:
                    template["animated"] = animated
                template["modified"] = datetime.now().isoformat()
                break
        
        self.save_data(data)
        return self.get_template(template_id)
    
    def delete_template(self, template_id):
        data = self.load_data()
        data["templates"] = [t for t in data["templates"] if t["id"] != template_id]
        self.save_data(data)
        return True
