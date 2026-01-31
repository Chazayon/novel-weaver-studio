"""Storage manager for project initialization and directory structure."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from ..config import settings


def create_project(project_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Initialize a new project with directory structure and metadata.
    
    Creates:
    - Project root directory
    - project.json manifest
    - Phase output directories
    
    Args:
        project_id: Unique project identifier
        metadata: Project metadata (title, author, genre, etc.)
        
    Returns:
        Dict with project information
    """
    project_path = settings.projects_root_path / project_id
    
    if project_path.exists():
        raise ValueError(f"Project {project_id} already exists")
    
    # Create project directory
    project_path.mkdir(parents=True, exist_ok=True)
    
    # Create phase output directories
    phase_dirs = [
        "phase1_outputs",
        "phase2_outputs",
        "phase3_outputs",
        "phase4_outputs",
        "phase5_outputs",
        "phase6_outputs",
        "exports",
    ]
    
    for phase_dir in phase_dirs:
        (project_path / phase_dir).mkdir(exist_ok=True)
    
    # Create project manifest
    now = datetime.utcnow().isoformat()
    llm_profiles = {
        "phase1-style-sheet": {"temperature": 0.2, "maxTokens": 4000},
        "phase1-context-bundle": {"temperature": 0.1, "maxTokens": 7000},
        "phase1-context-bundle-revise": {"temperature": 0.5, "maxTokens": 8000},
        "phase2-series-outline": {"temperature": 0.7, "maxTokens": 8000},
        "phase2-series-outline-revise": {"temperature": 0.5, "maxTokens": 8000},
        "phase2-context-bundle-update": {"temperature": 0.1, "maxTokens": 9000},
        "phase3-call-sheet": {"temperature": 0.4, "maxTokens": 6000},
        "phase3-context-bundle-update": {"temperature": 0.1, "maxTokens": 9000},
        "phase4-characters": {"temperature": 0.5, "maxTokens": 7000},
        "phase4-worldbuilding": {"temperature": 0.5, "maxTokens": 8000},
        "phase4-context-bundle-update": {"temperature": 0.1, "maxTokens": 12000},
        "phase5-outline": {"temperature": 0.6, "maxTokens": 9000},
        "phase5-outline-revise": {"temperature": 0.5, "maxTokens": 9000},
        "phase5-context-bundle-update": {"temperature": 0.1, "maxTokens": 12000},
        "phase6-scene-brief": {"temperature": 0.6, "maxTokens": 5000},
        "phase6-first-draft": {"temperature": 0.75, "maxTokens": 12000},
        "phase6-improvement-plan": {"temperature": 0.3, "maxTokens": 5000},
        "phase6-apply-improvement-plan": {"temperature": 0.6, "maxTokens": 12000},
        "phase6-final-revise": {"temperature": 0.55, "maxTokens": 12000},
        "phase6-context-bundle-update": {"temperature": 0.1, "maxTokens": 12000},
        "phase7-compile": {"temperature": 0.2, "maxTokens": 16000},
    }
    manifest = {
        "project_id": project_id,
        "created_at": now,
        "updated_at": now,
        "metadata": metadata,
        "settings": {
            "llm": {
                "profiles": llm_profiles,
            }
        },
        "state": {
            "current_phase": 1,
            "phases_completed": [],
            "total_chapters": 0,
            "chapters": [],
        },
    }
    
    manifest_path = project_path / "project.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    
    return {
        "success": True,
        "project_id": project_id,
        "path": str(project_path),
        "manifest": manifest,
    }


def get_project_path(project_id: str) -> Path:
    """Get absolute path to project directory."""
    return settings.projects_root_path / project_id


def get_project_manifest(project_id: str) -> Dict[str, Any]:
    """Load project manifest (project.json)."""
    manifest_path = get_project_path(project_id) / "project.json"
    
    if not manifest_path.exists():
        raise FileNotFoundError(f"Project manifest not found for {project_id}")
    
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def list_all_projects() -> List[Dict[str, Any]]:
    """List all projects in the storage directory."""
    projects_root = settings.projects_root_path
    
    if not projects_root.exists():
        return []
    
    projects = []
    for project_dir in projects_root.iterdir():
        if project_dir.is_dir() and (project_dir / "project.json").exists():
            try:
                manifest = get_project_manifest(project_dir.name)
                projects.append({
                    "id": project_dir.name,
                    "manifest": manifest,
                })
            except Exception:
                # Skip invalid projects
                continue
    
    return projects


def list_artifacts(project_id: str, phase: str | None = None) -> List[Dict[str, Any]]:
    """
    List all artifacts in a project, optionally filtered by phase.
    
    Args:
        project_id: Unique project identifier
        phase: Optional phase filter (e.g., "phase1_outputs")
        
    Returns:
        List of artifact information dicts
    """
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        raise FileNotFoundError(f"Project {project_id} does not exist")
    
    artifacts = []
    
    # Determine which directories to scan
    if phase:
        search_dirs = [project_path / phase] if (project_path / phase).exists() else []
    else:
        search_dirs = [
            d for d in project_path.iterdir()
            if d.is_dir() and d.name != "__pycache__"
        ]
    
    # Scan for markdown files
    for search_dir in search_dirs:
        for file_path in search_dir.rglob("*.md"):
            relative_path = file_path.relative_to(project_path)
            artifacts.append({
                "path": str(relative_path),
                "name": file_path.name,
                "size": file_path.stat().st_size,
                "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
            })
    
    return artifacts


def ensure_phase_directory(project_id: str, phase: str) -> Path:
    """
    Ensure a phase output directory exists.
    
    Args:
        project_id: Unique project identifier
        phase: Phase directory name (e.g., "phase6_outputs")
        
    Returns:
        Path to the phase directory
    """
    project_path = get_project_path(project_id)
    phase_path = project_path / phase
    phase_path.mkdir(parents=True, exist_ok=True)
    return phase_path


def delete_project(project_id: str) -> Dict[str, Any]:
    """
    Delete a project and all its artifacts.
    
    Args:
        project_id: Unique project identifier
        
    Returns:
        Dict with deletion status
    """
    import shutil
    
    project_path = get_project_path(project_id)
    
    if not project_path.exists():
        raise FileNotFoundError(f"Project {project_id} does not exist")
    
    shutil.rmtree(project_path)
    
    return {
        "success": True,
        "project_id": project_id,
        "message": "Project deleted successfully",
    }
