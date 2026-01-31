"""
Core vault functions matching YAML workflow specifications.

These functions provide the exact same interface as used in the YAML workflows,
allowing Python nodes to execute without modification.
"""

import json
import re
from pathlib import Path
from typing import Dict, Any

from ..config import settings


def _get_project_path(project_id: str) -> Path:
    """Get the absolute path to a project directory."""
    project_path = settings.projects_root_path / project_id
    return project_path


def _ensure_project_exists(project_id: str) -> Path:
    """Ensure project directory exists and return its path."""
    project_path = _get_project_path(project_id)
    if not project_path.exists():
        raise FileNotFoundError(f"Project {project_id} does not exist at {project_path}")
    return project_path


def novel_write_text(project_id: str, path: str, content: str) -> Dict[str, Any]:
    """
    Write artifact to project storage.
    
    Used in all 7 phases to save outputs like:
    - phase1_outputs/genre_tropes.md
    - phase1_outputs/style_sheet.md
    - phase1_outputs/context_bundle.md
    - phase2_outputs/series_outline.md
    - phase3_outputs/call_sheet.md
    - phase4_outputs/characters.md, worldbuilding.md
    - phase5_outputs/outline.md
    - phase6_outputs/chapter_X/scene_brief.md, first_draft.md, final.md
    - exports/FINAL_MANUSCRIPT.md
    
    Args:
        project_id: Unique project identifier
        path: Relative path within project (e.g., "phase1_outputs/genre_tropes.md")
        content: Text content to write
        
    Returns:
        Dict with status information
    """
    project_path = _get_project_path(project_id)
    project_path.mkdir(parents=True, exist_ok=True)
    
    file_path = project_path / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    
    file_path.write_text(content, encoding="utf-8")
    
    return {
        "success": True,
        "path": str(file_path),
        "bytes_written": len(content.encode("utf-8")),
    }


def novel_read_text(project_id: str, path: str) -> Dict[str, Any]:
    """
    Read artifact from project storage.
    
    Used in Phases 2-7 to load context_bundle.md and other artifacts.
    
    Args:
        project_id: Unique project identifier
        path: Relative path within project (e.g., "phase1_outputs/context_bundle.md")
        
    Returns:
        Dict with 'text' key containing file content
        
    Raises:
        FileNotFoundError: If the file doesn't exist
    """
    project_path = _ensure_project_exists(project_id)
    file_path = project_path / path
    
    if not file_path.exists():
        raise FileNotFoundError(f"Artifact not found: {path} in project {project_id}")
    
    content = file_path.read_text(encoding="utf-8")
    
    return {
        "text": content,
        "path": str(file_path),
        "success": True,
    }


def novel_get_previous_chapter_final(project_id: str, chapter_number: int) -> Dict[str, Any]:
    """
    Get previous chapter text for continuity.
    
    Used in Phase 6 to maintain narrative continuity between chapters.
    Returns 'NONE' for Chapter 1 (no previous chapter).
    
    Args:
        project_id: Unique project identifier
        chapter_number: Current chapter number (1-indexed)
        
    Returns:
        Dict with 'text' key containing previous chapter content or 'NONE'
    """
    if chapter_number <= 1:
        return {"text": "NONE", "success": True}
    
    previous_chapter_num = chapter_number - 1
    project_path = _ensure_project_exists(project_id)
    
    # Look for final.md in previous chapter directory
    previous_chapter_path = (
        project_path / "phase6_outputs" / f"chapter_{previous_chapter_num}" / "final.md"
    )
    
    if not previous_chapter_path.exists():
        # If final.md doesn't exist, try first_draft.md as fallback
        previous_chapter_path = (
            project_path / "phase6_outputs" / f"chapter_{previous_chapter_num}" / "first_draft.md"
        )
    
    if not previous_chapter_path.exists():
        return {
            "text": "NONE",
            "success": True,
            "warning": f"Chapter {previous_chapter_num} not found",
        }
    
    content = previous_chapter_path.read_text(encoding="utf-8")
    
    return {
        "text": content,
        "path": str(previous_chapter_path),
        "success": True,
    }


def novel_update_manifest(project_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update project.json metadata with patch.
    
    Used in Phase 6 to track current chapter progress.
    Performs a deep merge of the patch into existing metadata.
    
    Args:
        project_id: Unique project identifier
        patch: Dictionary to merge into project metadata
        
    Returns:
        Dict with updated manifest
    """
    project_path = _get_project_path(project_id)
    project_path.mkdir(parents=True, exist_ok=True)
    
    manifest_path = project_path / "project.json"
    
    # Load existing manifest or create new one
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    else:
        manifest = {
            "project_id": project_id,
            "created_at": None,
            "updated_at": None,
            "state": {},
        }
    
    # Deep merge patch into manifest
    def deep_merge(base: Dict, update: Dict) -> Dict:
        """Recursively merge update into base."""
        for key, value in update.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                deep_merge(base[key], value)
            else:
                base[key] = value
        return base
    
    manifest = deep_merge(manifest, patch)
    
    # Save updated manifest
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    
    return {
        "success": True,
        "manifest": manifest,
        "path": str(manifest_path),
    }


def novel_parse_outline(project_id: str) -> Dict[str, Any]:
    """
    Parse outline.md and extract chapter structure.
    
    Used in Phase 5 to extract chapter count and structure from the generated outline.
    Expects outline in Markdown format with headers like:
    ### Chapter 1: Title
    ### Chapter 2: Another Title
    
    Args:
        project_id: Unique project identifier
        
    Returns:
        Dict with 'chapters' list containing chapter information
    """
    project_path = _ensure_project_exists(project_id)
    outline_path = project_path / "phase5_outputs" / "outline.md"
    
    if not outline_path.exists():
        raise FileNotFoundError(f"Outline not found at {outline_path}")
    
    content = outline_path.read_text(encoding="utf-8")
    
    chapters: list[dict[str, Any]] = []

    # Parse chapter headers (### Chapter X: Title)
    # Also accept common separators like '-', '–', '—'
    chapter_pattern = re.compile(r"^###\s+Chapter\s+(\d+)\s*[:\-–—]\s*(.+)$", re.MULTILINE)
    matches = chapter_pattern.findall(content)

    for chapter_num_str, title in matches:
        chapter_num = int(chapter_num_str)
        chapters.append({
            "number": chapter_num,
            "title": title.strip(),
        })

    # Fallback: parse markdown table rows like: | **1** | **The Title** | Summary... |
    if not chapters:
        table_row_pattern = re.compile(r"^\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}([^|]+?)\*{0,2}\s*\|", re.MULTILINE)
        table_matches = table_row_pattern.findall(content)
        for chapter_num_str, title in table_matches:
            try:
                chapter_num = int(chapter_num_str)
            except ValueError:
                continue

            cleaned_title = title.strip()
            cleaned_title = re.sub(r"^\*+", "", cleaned_title)
            cleaned_title = re.sub(r"\*+$", "", cleaned_title)
            cleaned_title = cleaned_title.strip()

            chapters.append({
                "number": chapter_num,
                "title": cleaned_title,
            })

    # If numbering restarts per book/part (duplicates or non-monotonic numbers),
    # renumber sequentially in the order encountered.
    if chapters:
        nums = [ch.get("number") for ch in chapters]
        int_nums = [n for n in nums if isinstance(n, int)]

        has_duplicate_numbers = len(set(int_nums)) != len(int_nums)
        is_monotonic_non_decreasing = int_nums == sorted(int_nums)

        if has_duplicate_numbers or not is_monotonic_non_decreasing:
            for idx, ch in enumerate(chapters):
                ch["number"] = idx + 1
    
    # Also update the manifest with total chapter count
    if chapters:
        novel_update_manifest(
            project_id,
            {
                "state": {
                    "total_chapters": len(chapters),
                    "chapters": chapters,
                }
            },
        )
    
    return {
        "success": True,
        "chapters": chapters,
        "total_chapters": len(chapters),
    }
