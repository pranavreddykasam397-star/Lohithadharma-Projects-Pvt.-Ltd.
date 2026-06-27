import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
import unittest.mock as mock
from server import CompatCursor, CompatConnection, celery, sync_active_calls_task

def test_compat_cursor_postgres_translation():
    # Mock underlying cursor
    mock_cursor = mock.MagicMock()
    
    # Instantiate compatibility wrapper for PostgreSQL mode
    compat = CompatCursor(mock_cursor, is_postgres=True)
    
    # Verify parameter placeholder conversion
    compat.execute("SELECT * FROM leads WHERE id = ? AND status = ?", ("LD-123", "new"))
    mock_cursor.execute.assert_called_once_with(
        "SELECT * FROM leads WHERE id = %s AND status = %s",
        ("LD-123", "new")
    )

def test_compat_cursor_postgres_schema_translation():
    mock_cursor = mock.MagicMock()
    compat = CompatCursor(mock_cursor, is_postgres=True)
    
    # Verify CREATE TABLE translations
    compat.execute("CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT)")
    mock_cursor.execute.assert_called_once_with(
        "CREATE TABLE test (id SERIAL PRIMARY KEY )",
        ()
    )

def test_compat_cursor_sqlite_fallback():
    mock_cursor = mock.MagicMock()
    compat = CompatCursor(mock_cursor, is_postgres=False)
    
    # Verify query runs unmodified in SQLite fallback mode
    compat.execute("SELECT * FROM leads WHERE id = ?", ("LD-123",))
    mock_cursor.execute.assert_called_once_with(
        "SELECT * FROM leads WHERE id = ?",
        ("LD-123",)
    )

def test_celery_task_registration():
    # Verify task name matches configuration
    assert "tasks.sync_active_calls" in celery.tasks
