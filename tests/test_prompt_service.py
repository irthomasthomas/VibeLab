import pytest
import os
import uuid
from pathlib import Path
import json
import datetime
from unittest.mock import MagicMock, patch

# Adjust path to import from parent directory
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prompt_service import PromptService
from database_manager import DatabaseManager

# Test database path
TEST_DB_PATH = "data/test_vibelab_research.db"

@pytest.fixture(scope="function")
def temp_db_manager():
    """Fixture to create a temporary, clean database for each test function."""
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    
    # Ensure the 'data' directory exists for the test DB
    Path(TEST_DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    
    db_manager = DatabaseManager(db_path=TEST_DB_PATH)
    # Initialize with the actual schema
    # Assuming db_schema.sql is in the project root, one level up from tests/
    schema_path = Path(__file__).resolve().parent.parent / "db_schema.sql"
    db_manager.init_database(schema_file=str(schema_path))
    yield db_manager
    
    # Teardown: Remove the test database after tests run
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

@pytest.fixture
def prompt_service_instance(temp_db_manager):
    """Fixture to create a PromptService instance with a clean test database."""
    # The PromptService will use the db_path passed to its DatabaseManager
    return PromptService(db_path=TEST_DB_PATH)

def test_create_and_get_template(prompt_service_instance: PromptService):
    """Test creating a new template and retrieving it."""
    template_name = "Test Template"
    template_prompt = "This is a test prompt."
    template_tags = ["test", "pytest"]
    template_animated = False

    created_template = prompt_service_instance.save_template(
        name=template_name,
        prompt=template_prompt,
        tags=template_tags,
        animated=template_animated
    )

    assert created_template is not None
    assert "id" in created_template
    assert created_template["name"] == template_name
    assert created_template["prompt"] == template_prompt
    assert created_template["tags"] == template_tags
    assert created_template["animated"] == template_animated
    assert "created" in created_template
    assert "updated" in created_template

    retrieved_template = prompt_service_instance.get_template(created_template["id"])
    
    assert retrieved_template is not None
    assert retrieved_template["id"] == created_template["id"]
    assert retrieved_template["name"] == template_name
    assert retrieved_template["prompt"] == template_prompt
    # Ensure tags are loaded correctly (JSON conversion)
    assert retrieved_template["tags"] == template_tags 
    assert retrieved_template["animated"] == template_animated
    assert retrieved_template["created"] == created_template["created"]

def test_get_all_templates_empty(prompt_service_instance: PromptService):
    """Test getting all templates when the database is empty."""
    result = prompt_service_instance.get_templates()
    assert result is not None
    assert "templates" in result
    assert len(result["templates"]) == 0

def test_get_all_templates_with_data(prompt_service_instance: PromptService):
    """Test getting all templates after adding some data."""
    prompt_service_instance.save_template(name="T1", prompt="P1")
    prompt_service_instance.save_template(name="T2", prompt="P2", tags=["tag1"])
    
    result = prompt_service_instance.get_templates()
    assert result is not None
    assert "templates" in result
    assert len(result["templates"]) == 2
    # Templates are ordered by created_at DESC in get_templates
    assert result["templates"][0]["name"] == "T2" 
    assert result["templates"][1]["name"] == "T1"

def test_update_template(prompt_service_instance: PromptService):
    """Test updating an existing template."""
    original = prompt_service_instance.save_template(name="Original", prompt="Original prompt")
    template_id = original["id"]

    updated_name = "Updated Name"
    updated_prompt = "Updated prompt text."
    updated_tags = ["new_tag"]
    updated_animated = True

    updated_template = prompt_service_instance.update_template(
        template_id=template_id,
        name=updated_name,
        prompt=updated_prompt,
        tags=updated_tags,
        animated=updated_animated
    )

    assert updated_template is not None
    assert updated_template["id"] == template_id
    assert updated_template["name"] == updated_name
    assert updated_template["prompt"] == updated_prompt
    assert updated_template["tags"] == updated_tags
    assert updated_template["animated"] == updated_animated
    assert updated_template["updated"] != original["updated"] # Updated timestamp should change

    # Verify by fetching again
    fetched_template = prompt_service_instance.get_template(template_id)
    assert fetched_template["name"] == updated_name
    assert fetched_template["tags"] == updated_tags

def test_update_template_not_found(prompt_service_instance: PromptService):
    """Test updating a non-existent template."""
    non_existent_id = str(uuid.uuid4())
    with pytest.raises(ValueError, match=f"Template {non_existent_id} not found"):
        prompt_service_instance.update_template(template_id=non_existent_id, name="New Name")

def test_delete_template(prompt_service_instance: PromptService):
    """Test deleting a template."""
    template_to_delete = prompt_service_instance.save_template(name="To Delete", prompt="Delete me")
    template_id = template_to_delete["id"]

    # Save another template to ensure only the specified one is deleted
    prompt_service_instance.save_template(name="To Keep", prompt="Keep me")

    delete_result = prompt_service_instance.delete_template(template_id)
    assert delete_result is True

    assert prompt_service_instance.get_template(template_id) is None
    
    remaining_templates = prompt_service_instance.get_templates()["templates"]
    assert len(remaining_templates) == 1
    assert remaining_templates[0]["name"] == "To Keep"

# Example of mocking DatabaseManager if you don't want to hit a real DB
# This is more of a unit test for PromptService logic, less of an integration test.
def test_get_template_with_mocked_db():
    mock_db_manager = MagicMock(spec=DatabaseManager)
    
    # Create a PromptService instance and manually assign the mocked db_manager
    service_with_mock = PromptService(db_path="dummy_path_not_used") # Path doesn't matter here
    service_with_mock.db_manager = mock_db_manager

    test_id = "test-id-123"
    mock_row_data = {
        'id': test_id,
        'name': 'Mocked Template',
        'prompt': 'Mocked prompt content',
        'tags': json.dumps(['mock_tag']),
        'animated': 0, # Assuming DB stores 0/1 for boolean
        'created_at': datetime.datetime.now().isoformat(),
        'updated_at': datetime.datetime.now().isoformat()
    }
    # Mock the return value of execute_select_one
    # Need to simulate sqlite3.Row behavior if _row_to_template expects it
    # A simple way is to make mock_row_data accessible by index and key
    class MockSqliteRow:
        def __init__(self, data_dict):
            self._data = data_dict
        def __getitem__(self, key):
            if isinstance(key, int): # Access by index for older _row_to_template versions
                return list(self._data.values())[key]
            return self._data[key] # Access by key name
        def keys(self): # Needed if _row_to_template iterates keys or similar
            return self._data.keys()

    mock_db_manager.execute_select_one.return_value = MockSqliteRow(mock_row_data)

    template = service_with_mock.get_template(test_id)

    mock_db_manager.execute_select_one.assert_called_once_with(
        """
            SELECT id, name, prompt, tags, animated, created_at, updated_at 
            FROM templates 
            WHERE id = ?
        """, (test_id,)
    )
    assert template is not None
    assert template["id"] == test_id
    assert template["name"] == "Mocked Template"
    assert template["tags"] == ["mock_tag"]

