"""API routes for Novel Weaver Studio backend."""

import json
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from ..models import (
    ProjectCreate,
    GenerateStyleSheetRequest,
    ProjectImportCreateRequest,
    ProjectImportRequest,
    ProjectResponse,
    ResumeSuggestion,
    ArtifactInfo,
    ArtifactUpdateRequest,
    PhaseExecuteRequest,
    ProjectLLMSettings,
    ProjectLLMSettingsUpdate,
    WorkflowStatus,
    PhaseStatus,
    WorkflowSignal,
    HumanInputResponse,
    PendingInput,
    ChapterDetail,
    ChapterUpdate,
    PhaseProgress,
    ProjectProgress,
    TimelineEvent,
    SystemStats,
)
from ..vault import storage_manager, novel_vault

router = APIRouter(prefix="/api", tags=["api"])


def _sanitize_relative_artifact_path(path: str) -> str:
    raw = (path or "").strip()
    if not raw:
        raise ValueError("Artifact path cannot be empty")
    if raw.startswith("/") or raw.startswith("\\"):
        raise ValueError("Artifact path must be relative")

    safe = raw.replace("\\", "/")
    parts = [p for p in safe.split("/") if p not in {"", "."}]
    if any(p == ".." for p in parts):
        raise ValueError("Artifact path cannot contain '..'")
    if not parts:
        raise ValueError("Artifact path cannot be empty")

    if parts[-1] == "project.json":
        raise ValueError("Refusing to write project.json via artifact import")

    return "/".join(parts)


def _artifact_file_exists(project_id: str, artifact_path: str) -> bool:
    project_path = storage_manager.get_project_path(project_id)
    file_path = project_path / artifact_path
    return file_path.exists() and file_path.is_file()


def _build_minimal_context_bundle(manifest: dict, import_data: ProjectImportRequest) -> str:
    metadata = manifest.get("metadata", {}) if isinstance(manifest, dict) else {}
    title = str(metadata.get("title", "Untitled") or "Untitled")
    author = str(metadata.get("author", "Unknown") or "Unknown")
    genre = str(metadata.get("genre", "") or "")

    lines: list[str] = [
        "# CONTEXT_BUNDLE",
        "",
        f"## PROJECT",
        f"- Title: {title}",
        f"- Author: {author}",
    ]
    if genre.strip():
        lines.append(f"- Genre: {genre}")

    sections: list[tuple[str, str | None]] = [
        ("GENRE_TROPES", import_data.genre_tropes),
        ("STYLE_SHEET", import_data.style_sheet),
        ("SERIES_OUTLINE", import_data.series_outline),
        ("CALL_SHEET", import_data.call_sheet),
        ("CHARACTERS", import_data.characters),
        ("WORLDBUILDING", import_data.worldbuilding),
        ("STORY_BIBLE", import_data.story_bible),
        ("OUTLINE", import_data.outline),
    ]

    for header, content in sections:
        if content and str(content).strip():
            lines.extend(["", f"## {header}", "", str(content).strip()])

    chapter_blocks: list[str] = []
    for ch in import_data.chapters:
        if not ch or not ch.content.strip():
            continue
        label = f"Chapter {ch.number}" + (f": {ch.title}" if ch.title else "")
        chapter_blocks.append(f"### {label}\n\n{ch.content.strip()}\n")

    if chapter_blocks:
        lines.extend(["", "## DRAFTING_PROGRESS", ""])
        lines.extend(chapter_blocks)

    return ("\n".join(lines).rstrip() + "\n")


def _maybe_write_artifact(project_id: str, artifact_path: str, content: str, overwrite: bool) -> None:
    safe_path = _sanitize_relative_artifact_path(artifact_path)
    if _artifact_file_exists(project_id, safe_path) and not overwrite:
        raise ValueError(f"Artifact already exists: {safe_path}")
    novel_vault.novel_write_text(project_id, safe_path, content)


def _read_first_existing_artifact(project_id: str, paths: list[str]) -> str | None:
    for p in paths:
        try:
            return novel_vault.novel_read_text(project_id, p).get("text")
        except Exception:
            continue
    return None


def _upsert_context_bundle_section(bundle: str, header: str, content: str) -> str:
    import re

    header_text = str(header or "").strip()
    if not header_text:
        return bundle
    new_content = (content or "").strip()
    if not new_content:
        return bundle

    b = (bundle or "").rstrip() + "\n"
    h2 = f"## {header_text}"

    m = re.search(rf"(^##\s+{re.escape(header_text)}\s*$)", b, flags=re.MULTILINE)
    if not m:
        return (b.rstrip() + f"\n\n{h2}\n\n{new_content}\n").rstrip() + "\n"

    section_start = m.start(1)
    after_header = m.end(1)
    next_h2 = re.search(r"^##\s+", b[after_header:], flags=re.MULTILINE)
    section_end = after_header + next_h2.start(0) if next_h2 else len(b)

    updated = (
        b[:section_start].rstrip()
        + f"\n\n{h2}\n\n{new_content}\n\n"
        + b[section_end:].lstrip()
    )
    return updated.rstrip() + "\n"


def _apply_project_import(project_id: str, import_data: ProjectImportRequest) -> dict:
    manifest = storage_manager.get_project_manifest(project_id)

    if import_data.metadata_patch and isinstance(import_data.metadata_patch, dict):
        novel_vault.novel_update_manifest(project_id, {"metadata": import_data.metadata_patch})
        manifest = storage_manager.get_project_manifest(project_id)

    overwrite = bool(import_data.overwrite)

    if import_data.genre_tropes is not None:
        _maybe_write_artifact(project_id, "phase1_outputs/genre_tropes.md", import_data.genre_tropes, overwrite)
    if import_data.style_sheet is not None:
        _maybe_write_artifact(project_id, "phase1_outputs/style_sheet.md", import_data.style_sheet, overwrite)
    if import_data.series_outline is not None:
        _maybe_write_artifact(project_id, "phase2_outputs/series_outline.md", import_data.series_outline, overwrite)
    if import_data.call_sheet is not None:
        _maybe_write_artifact(project_id, "phase3_outputs/call_sheet.md", import_data.call_sheet, overwrite)
    if import_data.characters is not None:
        _maybe_write_artifact(project_id, "phase4_outputs/characters.md", import_data.characters, overwrite)
    if import_data.worldbuilding is not None:
        _maybe_write_artifact(project_id, "phase4_outputs/worldbuilding.md", import_data.worldbuilding, overwrite)
    if import_data.story_bible is not None:
        _maybe_write_artifact(project_id, "phase5_outputs/story_bible.md", import_data.story_bible, overwrite)

    outline_written = False
    if import_data.outline is not None:
        _maybe_write_artifact(project_id, "phase6_outputs/outline.md", import_data.outline, overwrite)
        outline_written = True

    for art in import_data.artifacts:
        _maybe_write_artifact(project_id, art.path, art.content, overwrite)

    imported_chapter_nums: set[int] = set()
    for ch in import_data.chapters:
        if ch.number <= 0:
            raise ValueError("Chapter number must be >= 1")
        chapter_dir = f"phase7_outputs/chapter_{ch.number}"
        file_name = "final.md" if ch.kind.value == "final" else "first_draft.md"
        _maybe_write_artifact(project_id, f"{chapter_dir}/{file_name}", ch.content, overwrite)
        imported_chapter_nums.add(int(ch.number))

    if not outline_written and import_data.generate_outline_from_chapters and imported_chapter_nums:
        lines: list[str] = ["# OUTLINE", ""]
        for ch_num in sorted(imported_chapter_nums):
            title = None
            for ch in import_data.chapters:
                if int(ch.number) == int(ch_num):
                    title = (ch.title or "").strip() or None
                    break
            if title is None:
                title = f"Chapter {ch_num}"
            lines.append(f"### Chapter {ch_num}: {title}")
            lines.append("")
        _maybe_write_artifact(project_id, "phase6_outputs/outline.md", "\n".join(lines).rstrip() + "\n", overwrite)
        outline_written = True

    if outline_written:
        try:
            novel_vault.novel_parse_outline(project_id)
        except Exception:
            pass

    if import_data.context_bundle is not None:
        _maybe_write_artifact(project_id, "phase1_outputs/context_bundle.md", import_data.context_bundle, overwrite)
    elif import_data.ensure_context_bundle:
        if not _artifact_file_exists(project_id, "phase1_outputs/context_bundle.md"):
            minimal_bundle = _build_minimal_context_bundle(manifest, import_data)
            _maybe_write_artifact(project_id, "phase1_outputs/context_bundle.md", minimal_bundle, overwrite)

    if imported_chapter_nums:
        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {}) if isinstance(manifest.get("state", {}), dict) else {}
        chapters_data = state.get("chapters", []) if isinstance(state.get("chapters", []), list) else []

        existing_by_num: dict[int, dict] = {}
        for item in chapters_data:
            try:
                num = int(item.get("number"))
            except Exception:
                continue
            if num > 0:
                existing_by_num[num] = item

        for ch in import_data.chapters:
            num = int(ch.number)
            title = (ch.title or "").strip() if ch.title else None
            if num in existing_by_num:
                if title:
                    existing_by_num[num]["title"] = title
            else:
                existing_by_num[num] = {"number": num, "title": title or f"Chapter {num}"}

        merged = [existing_by_num[n] for n in sorted(existing_by_num.keys())]
        total_chapters = state.get("total_chapters")
        if not isinstance(total_chapters, int) or total_chapters <= 0:
            total_chapters = len(merged)
        total_chapters = max(total_chapters, max(imported_chapter_nums))

        novel_vault.novel_update_manifest(
            project_id,
            {"state": {"chapters": merged, "total_chapters": total_chapters}},
        )

    manifest = storage_manager.get_project_manifest(project_id)
    state = manifest.get("state", {}) if isinstance(manifest.get("state", {}), dict) else {}
    inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(project_id, state)
    novel_vault.novel_update_manifest(
        project_id,
        {"state": {"phases_completed": inferred_completed, "current_phase": inferred_current_phase}},
    )

    manifest = storage_manager.get_project_manifest(project_id)
    manifest["updated_at"] = datetime.utcnow().isoformat()
    manifest_path = storage_manager.get_project_path(project_id) / "project.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return manifest


def _artifact_exists(project_id: str, path: str) -> bool:
    try:
        novel_vault.novel_read_text(project_id, path)
        return True
    except Exception:
        return False


def _infer_project_phase_state(project_id: str, state: dict) -> tuple[list[int], int, int]:
    chapters_data = state.get("chapters", [])
    total_chapters = state.get("total_chapters")
    if not isinstance(total_chapters, int) or total_chapters <= 0:
        total_chapters = len(chapters_data)

    chapters_completed = 0
    for chapter in chapters_data:
        chapter_num = chapter.get("number")
        if chapter_num is None:
            continue
        if _artifact_exists(project_id, f"phase7_outputs/chapter_{chapter_num}/final.md") or _artifact_exists(
            project_id, f"phase6_outputs/chapter_{chapter_num}/final.md"
        ):
            chapters_completed += 1

    has_outline = _artifact_exists(project_id, "phase6_outputs/outline.md") or _artifact_exists(
        project_id, "phase5_outputs/outline.md"
    )

    phase_completed_map: dict[int, bool] = {
        1: (
            _artifact_exists(project_id, "phase1_outputs/genre_tropes.md")
            and _artifact_exists(project_id, "phase1_outputs/style_sheet.md")
            and _artifact_exists(project_id, "phase1_outputs/context_bundle.md")
        ),
        2: _artifact_exists(project_id, "phase2_outputs/series_outline.md"),
        3: _artifact_exists(project_id, "phase3_outputs/call_sheet.md"),
        4: (
            _artifact_exists(project_id, "phase4_outputs/characters.md")
            and _artifact_exists(project_id, "phase4_outputs/worldbuilding.md")
        ),
        5: _artifact_exists(project_id, "phase5_outputs/story_bible.md") or has_outline,
        6: has_outline,
        7: total_chapters > 0 and chapters_completed >= total_chapters,
        8: _artifact_exists(project_id, "exports/FINAL_MANUSCRIPT.md"),
    }

    phases_completed = [p for p in range(1, 9) if phase_completed_map.get(p, False)]
    current_phase = next((p for p in range(1, 9) if p not in phases_completed), 8)

    return phases_completed, current_phase, chapters_completed


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# Project Management Endpoints

@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate):
    """Create a new novel project."""
    try:
        project_id = str(uuid.uuid4())
        
        metadata = project.model_dump()
        result = storage_manager.create_project(project_id, metadata)
        
        manifest = result["manifest"]
        
        return ProjectResponse(
            id=project_id,
            title=metadata["title"],
            author=metadata["author"],
            genre=metadata["genre"],
            seriesLength=metadata.get("series_length", 20),
            createdAt=manifest["created_at"],
            updatedAt=manifest["updated_at"],
            currentPhase=manifest["state"]["current_phase"],
            progress=0.0,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.post("/projects/import", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project_with_import(payload: ProjectImportCreateRequest):
    try:
        project_id = str(uuid.uuid4())

        metadata = payload.metadata.model_dump()
        storage_manager.create_project(project_id, metadata)

        _apply_project_import(project_id, payload.import_data)

        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {})
        inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(project_id, state)
        progress = (len(inferred_completed) / 8) * 100

        return ProjectResponse(
            id=project_id,
            title=metadata.get("title", "Untitled"),
            author=metadata.get("author", "Unknown"),
            genre=metadata.get("genre", "Unknown"),
            seriesLength=metadata.get("series_length", 20),
            createdAt=manifest.get("created_at", ""),
            updatedAt=manifest.get("updated_at", ""),
            currentPhase=inferred_current_phase,
            progress=progress,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import project: {str(e)}")


@router.post("/projects/{project_id}/import", response_model=ProjectResponse)
async def import_into_project(project_id: str, import_data: ProjectImportRequest):
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        _apply_project_import(project_id, import_data)

        manifest = storage_manager.get_project_manifest(project_id)
        metadata = manifest.get("metadata", {})
        state = manifest.get("state", {})
        inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(project_id, state)
        progress = (len(inferred_completed) / 8) * 100

        return ProjectResponse(
            id=project_id,
            title=metadata.get("title", "Untitled"),
            author=metadata.get("author", "Unknown"),
            genre=metadata.get("genre", "Unknown"),
            seriesLength=metadata.get("series_length", 20),
            createdAt=manifest.get("created_at", ""),
            updatedAt=manifest.get("updated_at", ""),
            currentPhase=inferred_current_phase,
            progress=progress,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import into project: {str(e)}")


@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects():
    """List all projects."""
    try:
        projects_data = storage_manager.list_all_projects()
        
        projects = []
        for project_data in projects_data:
            manifest = project_data["manifest"]
            metadata = manifest.get("metadata", {})
            state = manifest.get("state", {})

            inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(project_data["id"], state)

            # Calculate progress based on completed phases
            phases_completed = len(inferred_completed)
            progress = (phases_completed / 8) * 100
            
            projects.append(
                ProjectResponse(
                    id=project_data["id"],
                    title=metadata.get("title", "Untitled"),
                    author=metadata.get("author", "Unknown"),
                    genre=metadata.get("genre", "Unknown"),
                    seriesLength=metadata.get("series_length", 20),
                    createdAt=manifest.get("created_at", ""),
                    updatedAt=manifest.get("updated_at", ""),
                    currentPhase=inferred_current_phase,
                    progress=progress,
                )
            )
        
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """Get project details."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        metadata = manifest.get("metadata", {})
        state = manifest.get("state", {})

        inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(project_id, state)

        phases_completed = len(inferred_completed)
        progress = (phases_completed / 8) * 100
        
        return ProjectResponse(
            id=project_id,
            title=metadata.get("title", "Untitled"),
            author=metadata.get("author", "Unknown"),
            genre=metadata.get("genre", "Unknown"),
            seriesLength=metadata.get("series_length", 20),
            createdAt=manifest.get("created_at", ""),
            updatedAt=manifest.get("updated_at", ""),
            currentPhase=inferred_current_phase,
            progress=progress,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")


@router.get("/projects/{project_id}/resume-suggestion", response_model=ResumeSuggestion)
async def get_resume_suggestion(project_id: str):
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {}) if isinstance(manifest.get("state", {}), dict) else {}
        chapters_data = state.get("chapters", []) if isinstance(state.get("chapters", []), list) else []

        inferred_completed, _, chapters_completed = _infer_project_phase_state(project_id, state)

        total_chapters = state.get("total_chapters")
        if not isinstance(total_chapters, int) or total_chapters <= 0:
            total_chapters = len(chapters_data)

        completed_nums: set[int] = set()
        for ch in chapters_data:
            try:
                num = int(ch.get("number"))
            except Exception:
                continue
            if _artifact_exists(project_id, f"phase7_outputs/chapter_{num}/final.md") or _artifact_exists(
                project_id, f"phase6_outputs/chapter_{num}/final.md"
            ):
                completed_nums.add(num)

        next_num = None
        next_title = None
        for ch in chapters_data:
            try:
                num = int(ch.get("number"))
            except Exception:
                continue
            if num <= 0:
                continue
            if num not in completed_nums:
                next_num = num
                next_title = ch.get("title")
                break

        if next_num is None and completed_nums:
            next_num = max(completed_nums) + 1
            next_title = None

        if next_num is not None and (not next_title or not str(next_title).strip()):
            next_title = f"Chapter {next_num}"

        return ResumeSuggestion(
            nextChapterNumber=next_num,
            nextChapterTitle=next_title,
            chaptersCompleted=chapters_completed,
            totalChapters=total_chapters,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get resume suggestion: {str(e)}")


@router.post("/projects/{project_id}/generate-style-sheet")
async def generate_style_sheet_from_chapters(project_id: str, payload: GenerateStyleSheetRequest):
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {}) if isinstance(manifest.get("state", {}), dict) else {}
        chapters_data = state.get("chapters", []) if isinstance(state.get("chapters", []), list) else []

        overwrite = bool(payload.overwrite)
        if _artifact_file_exists(project_id, "phase1_outputs/style_sheet.md") and not overwrite:
            raise HTTPException(status_code=400, detail="style_sheet.md already exists (set overwrite=true to replace)")

        chapter_nums: list[int] = []
        if payload.chapter_numbers:
            chapter_nums = [int(n) for n in payload.chapter_numbers if int(n) > 0]
        else:
            for ch in chapters_data:
                try:
                    n = int(ch.get("number"))
                except Exception:
                    continue
                if n > 0:
                    chapter_nums.append(n)

        chapter_nums = sorted(set(chapter_nums))
        if not chapter_nums:
            raise HTTPException(status_code=400, detail="No chapters found to generate a style sheet from")

        max_chars = int(payload.max_chars or 60000)
        max_chars = max(5000, min(max_chars, 200000))

        samples_parts: list[str] = []
        total = 0
        for n in chapter_nums:
            text = _read_first_existing_artifact(
                project_id,
                [
                    f"phase7_outputs/chapter_{n}/final.md",
                    f"phase7_outputs/chapter_{n}/first_draft.md",
                    f"phase6_outputs/chapter_{n}/final.md",
                    f"phase6_outputs/chapter_{n}/first_draft.md",
                ],
            )
            if not text or not str(text).strip():
                continue

            block = f"## Chapter {n}\n\n{str(text).strip()}\n"
            remaining = max_chars - total
            if remaining <= 0:
                break
            if len(block) > remaining:
                block = block[:remaining]
            samples_parts.append(block)
            total += len(block)

        writing_samples = "\n\n".join(samples_parts).strip()
        if not writing_samples:
            raise HTTPException(status_code=400, detail="No readable chapter text found for the selected chapters")

        from ..config import settings
        from ..llm import get_provider_manager

        manager = get_provider_manager()
        style_sheet = await manager.generate(
            provider=settings.default_llm_provider,
            model=settings.default_llm_model,
            role="You are an expert prose analyst.",
            task=(
                f"<writing_samples>\n{writing_samples}\n</writing_samples>\n\n"
                "Draft a prose style sheet that an LLM can follow to write consistently.\n\n"
                "Requirements:\n"
                "- Emphasize deep POV and show-don't-tell (with examples).\n"
                "- Specify POV + tense conventions.\n"
                "- Dialogue style guidance.\n"
                "- Typical sentence/paragraph rhythm.\n"
                "- Approximate grade level.\n\n"
                "Output only the style sheet in Markdown."
            ),
            temperature=0.2,
            max_tokens=4000,
        )

        _maybe_write_artifact(project_id, "phase1_outputs/style_sheet.md", style_sheet, overwrite)

        try:
            existing_bundle = _read_first_existing_artifact(project_id, ["phase1_outputs/context_bundle.md"])
            if existing_bundle is not None:
                updated_bundle = _upsert_context_bundle_section(existing_bundle, "STYLE_SHEET", style_sheet)
                _maybe_write_artifact(project_id, "phase1_outputs/context_bundle.md", updated_bundle, True)
        except Exception:
            pass

        try:
            refreshed = storage_manager.get_project_manifest(project_id)
            refreshed_state = (
                refreshed.get("state", {})
                if isinstance(refreshed.get("state", {}), dict)
                else {}
            )
            inferred_completed, inferred_current_phase, _ = _infer_project_phase_state(
                project_id, refreshed_state
            )
            novel_vault.novel_update_manifest(
                project_id,
                {
                    "updated_at": datetime.utcnow().isoformat(),
                    "state": {
                        "phases_completed": inferred_completed,
                        "current_phase": inferred_current_phase,
                    },
                },
            )
        except Exception:
            pass

        return {"success": True, "styleSheet": style_sheet}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate style sheet: {str(e)}")


@router.get("/projects/{project_id}/settings/llm", response_model=ProjectLLMSettings)
async def get_project_llm_settings(project_id: str):
    """Get per-project LLM settings (profiles, temperature, max tokens, etc.)."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        llm_settings = (
            manifest.get("settings", {}).get("llm", {})
            if isinstance(manifest.get("settings", {}), dict)
            else {}
        )

        if not isinstance(llm_settings, dict):
            llm_settings = {}

        return ProjectLLMSettings.model_validate(llm_settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get LLM settings: {str(e)}")


@router.put("/projects/{project_id}/settings/llm", response_model=ProjectLLMSettings)
async def update_project_llm_settings(project_id: str, payload: ProjectLLMSettingsUpdate):
    """Update per-project LLM settings."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)

        settings_obj = manifest.get("settings", {})
        if not isinstance(settings_obj, dict):
            settings_obj = {}

        llm_settings = settings_obj.get("llm", {})
        if not isinstance(llm_settings, dict):
            llm_settings = {}

        if payload.default is not None:
            llm_settings["default"] = payload.default.model_dump(by_alias=True, exclude_none=True)

        if payload.profiles is not None:
            profiles_dump = {
                key: profile.model_dump(by_alias=True, exclude_none=True)
                for key, profile in payload.profiles.items()
            }

            if payload.replace_profiles:
                llm_settings["profiles"] = profiles_dump
            else:
                existing_profiles = llm_settings.get("profiles", {})
                if not isinstance(existing_profiles, dict):
                    existing_profiles = {}
                existing_profiles.update(profiles_dump)
                llm_settings["profiles"] = existing_profiles

        settings_obj["llm"] = llm_settings
        manifest["settings"] = settings_obj
        manifest["updated_at"] = datetime.utcnow().isoformat()

        manifest_path = storage_manager.get_project_path(project_id) / "project.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

        return ProjectLLMSettings.model_validate(llm_settings)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update LLM settings: {str(e)}")


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    try:
        result = storage_manager.delete_project(project_id)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


# Workflow Execution Endpoints

@router.post("/projects/{project_id}/phases/{phase}/execute")
async def execute_phase(project_id: str, phase: int, request: PhaseExecuteRequest):
    """
    Start executing a workflow phase using Temporal.
    
    Supports all 8 phases of the Novel Weaver Studio workflow.
    """
    try:
        # Verify project exists
        storage_manager.get_project_manifest(project_id)
        
        # Import workflow client
        from ..workflows.client import get_temporal_client
        from ..config import settings
        from datetime import timedelta
        
        client = await get_temporal_client()
        
        if phase == 1:
            from ..workflows.phase1_initial_setup import Phase1InitialSetupWorkflow, Phase1Input
            
            workflow_input = Phase1Input(
                project_id=project_id,
                genre=request.inputs.get("genre"),
                book_title=request.inputs.get("book_title"),
                initial_ideas=request.inputs.get("initial_ideas"),
                writing_samples=request.inputs.get("writing_samples"),
                outline_template=request.inputs.get("outline_template"),
                prohibited_words=request.inputs.get("prohibited_words"),
            )
            
            workflow_id = f"phase1-{project_id}-{uuid.uuid4()}"
            
            handle = await client.start_workflow(
                Phase1InitialSetupWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )
            
            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 1: Initial Setup & Research",
                outputs={},
            )
        
        elif phase == 2:
            from ..workflows.phase2_brainstorming import Phase2BrainstormingWorkflow, Phase2Input
            
            workflow_input = Phase2Input(
                project_id=project_id,
                extra_notes=request.inputs.get("extra_notes"),
                auto_approve=request.inputs.get("auto_approve", False),
                run_risk_audit=request.inputs.get("run_risk_audit", False),
            )
            
            workflow_id = f"phase2-{project_id}-{uuid.uuid4()}"
            
            handle = await client.start_workflow(
                Phase2BrainstormingWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )
            
            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 2: Brainstorming & Series Outline",
                outputs={},
            )
        
        elif phase == 3:
            from ..workflows.phase3_call_sheet import Phase3CallSheetWorkflow, Phase3Input
            
            workflow_input = Phase3Input(
                project_id=project_id,
                auto_approve=request.inputs.get("auto_approve", False),
            )
            
            workflow_id = f"phase3-{project_id}-{uuid.uuid4()}"
            
            handle = await client.start_workflow(
                Phase3CallSheetWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )
            
            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 3: Call Sheet Generation",
                outputs={},
            )
        
        elif phase == 4:
            from ..workflows.phase4_characters import Phase4CharactersWorldbuildingWorkflow, Phase4Input
            
            step = request.inputs.get("step", "full")
            workflow_input = Phase4Input(
                project_id=project_id,
                step=step,
                auto_approve=request.inputs.get("auto_approve", False),
            )
            
            workflow_id = f"phase4-{project_id}-{step}-{uuid.uuid4()}"
            
            handle = await client.start_workflow(
                Phase4CharactersWorldbuildingWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )
            
            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 4: Characters & Worldbuilding",
                outputs={},
            )
        
        elif phase == 5:
            from ..workflows.phase5_story_bible import Phase5StoryBibleWorkflow, Phase5StoryBibleInput
            from ..workflows.phase5_context_bundle_curation import (
                Phase5ContextBundleCurationWorkflow,
                Phase5ContextBundleCurationInput,
                Phase5ContextBundleTagsWorkflow,
                Phase5ContextBundleTagsInput,
            )

            step_raw = request.inputs.get("step")
            step = str(step_raw).strip().lower() if step_raw is not None else ""
            step = step.replace("_", "-")

            step_workflow = None
            step_label = None
            workflow_input = None
            timeout_hours = 1

            if step in {"curate-context-bundle", "context-bundle-curation", "context-bundle", "phase5-0"}:
                step_workflow = Phase5ContextBundleCurationWorkflow.run
                step_label = "context-bundle-curation"
                workflow_input = Phase5ContextBundleCurationInput(
                    project_id=project_id,
                    extra_notes=request.inputs.get("extra_notes"),
                )
                timeout_hours = 1
            elif step in {"context-tags", "generate-context-tags", "context-bundle-tags", "tags"}:
                step_workflow = Phase5ContextBundleTagsWorkflow.run
                step_label = "context-tags"
                workflow_input = Phase5ContextBundleTagsInput(project_id=project_id)
                timeout_hours = 1
            else:
                workflow_input = Phase5StoryBibleInput(
                    project_id=project_id,
                    extra_notes=request.inputs.get("extra_notes"),
                )

            if step_workflow is None:
                workflow_id = f"phase5-{project_id}-{uuid.uuid4()}"
                await client.start_workflow(
                    Phase5StoryBibleWorkflow.run,
                    workflow_input,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    execution_timeout=timedelta(hours=timeout_hours),
                    run_timeout=timedelta(hours=timeout_hours),
                )
                current_step = "Starting Phase 5: Story Bible Compilation"
            else:
                workflow_id = f"phase5-{project_id}-{step_label}-{uuid.uuid4()}"
                await client.start_workflow(
                    step_workflow,
                    workflow_input,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    execution_timeout=timedelta(hours=timeout_hours),
                    run_timeout=timedelta(hours=timeout_hours),
                )
                if step_label == "context-bundle-curation":
                    current_step = "Starting Phase 5.0: Context Bundle Curation"
                elif step_label == "context-tags":
                    current_step = "Starting Phase 5.0: Context Bundle Tags"
                else:
                    current_step = "Starting Phase 5"

            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep=current_step,
                outputs={},
            )
        
        elif phase == 6:
            from ..workflows.phase6_chapter_outline import Phase5ChapterOutlineWorkflow, Phase5Input

            workflow_input = Phase5Input(
                project_id=project_id,
                outline_template=request.inputs.get("outline_template", "USE_BUNDLE"),
                auto_approve=request.inputs.get("auto_approve", False),
                enable_npe_romance_architect=request.inputs.get("enable_npe_romance_architect", True),
            )

            workflow_id = f"phase6-{project_id}-{uuid.uuid4()}"
            await client.start_workflow(
                Phase5ChapterOutlineWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )

            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 6: Chapter Outline Creation",
                outputs={},
            )

        elif phase == 7:
            from ..workflows.phase7_chapter_writing import (
                Phase7SingleChapterWorkflow,
                Phase7SceneBriefWorkflow,
                Phase7FirstDraftWorkflow,
                Phase7ImprovementPlanWorkflow,
                Phase7ApplyImprovementPlanWorkflow,
                Phase7FinalWorkflow,
                Phase7Input,
            )

            if not request.inputs.get("chapter_number") or not request.inputs.get("chapter_title"):
                raise HTTPException(
                    status_code=400,
                    detail="Phase 7 requires chapter_number and chapter_title in inputs",
                )

            workflow_input = Phase7Input(
                project_id=project_id,
                chapter_number=request.inputs.get("chapter_number"),
                chapter_title=request.inputs.get("chapter_title"),
                chapter_notes=request.inputs.get("chapter_notes"),
                auto_approve_improvements=request.inputs.get("auto_approve_improvements", False),
                auto_approve_final=request.inputs.get("auto_approve_final", False),
            )

            step_raw = request.inputs.get("step")
            step = str(step_raw).strip().lower() if step_raw is not None else ""
            step = step.replace("_", "-")

            step_workflow = None
            step_label = None

            if step in {"scene-brief", "scenebrief"}:
                step_workflow = Phase7SceneBriefWorkflow.run
                step_label = "scene-brief"
            elif step in {"draft", "first-draft", "firstdraft"}:
                step_workflow = Phase7FirstDraftWorkflow.run
                step_label = "draft"
            elif step in {"improve-plan", "improvement-plan", "improveplan", "improvementplan"}:
                step_workflow = Phase7ImprovementPlanWorkflow.run
                step_label = "improve-plan"
            elif step in {
                "apply-improvement-plan",
                "apply-plan",
                "applyimprovementplan",
                "applyplan",
            }:
                step_workflow = Phase7ApplyImprovementPlanWorkflow.run
                step_label = "apply-improvement-plan"
            elif step in {"final", "final-draft", "finaldraft"}:
                step_workflow = Phase7FinalWorkflow.run
                step_label = "final"

            if step_workflow is None:
                workflow_id = f"phase7-{project_id}-ch{workflow_input.chapter_number}-{uuid.uuid4()}"
                await client.start_workflow(
                    Phase7SingleChapterWorkflow.run,
                    workflow_input,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    execution_timeout=timedelta(hours=2),
                    run_timeout=timedelta(hours=2),
                )
            else:
                workflow_id = (
                    f"phase7-{project_id}-ch{workflow_input.chapter_number}-{step_label}-{uuid.uuid4()}"
                )
                await client.start_workflow(
                    step_workflow,
                    workflow_input,
                    id=workflow_id,
                    task_queue=settings.temporal_task_queue,
                    execution_timeout=timedelta(hours=2),
                    run_timeout=timedelta(hours=2),
                )

            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep=f"Starting Phase 7: Drafting Chapter {workflow_input.chapter_number}",
                outputs={},
            )

        elif phase == 8:
            from ..workflows.phase8_compilation import Phase8FinalCompilationWorkflow, Phase8Input

            manifest = storage_manager.get_project_manifest(project_id)
            author_name = manifest.get("metadata", {}).get("author", "Unknown Author")

            workflow_input = Phase8Input(
                project_id=project_id,
                author_name=author_name,
            )

            workflow_id = f"phase8-{project_id}-{uuid.uuid4()}"
            await client.start_workflow(
                Phase8FinalCompilationWorkflow.run,
                workflow_input,
                id=workflow_id,
                task_queue=settings.temporal_task_queue,
                execution_timeout=timedelta(hours=1),
                run_timeout=timedelta(hours=1),
            )

            return WorkflowStatus(
                workflowId=workflow_id,
                phase=phase,
                status=PhaseStatus.IN_PROGRESS,
                progress=0.0,
                currentStep="Starting Phase 8: Final Manuscript Compilation",
                outputs={},
            )
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid phase number: {phase}. Valid phases are 1-8."
            )
            
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute phase: {str(e)}")


@router.get("/projects/{project_id}/phases/{phase}/status")
async def get_phase_status(project_id: str, phase: int, workflow_id: str | None = None):
    """Get the status of a workflow phase."""
    try:
        # If workflow_id provided, query Temporal for actual status
        if workflow_id:
            try:
                from ..workflows.client import get_temporal_client
                from temporalio.client import WorkflowExecutionStatus
                
                client = await get_temporal_client()
                handle = client.get_workflow_handle(workflow_id)
                
                # First check if workflow has completed by describing it
                desc = await handle.describe()
                
                # Check for completion first
                if desc.status == WorkflowExecutionStatus.COMPLETED:
                    try:
                        result = await handle.result()
                        
                        # Convert dataclass result to dict
                        if hasattr(result, '__dataclass_fields__'):
                            # It's a dataclass - convert to dict
                            from dataclasses import asdict
                            outputs = asdict(result)
                        elif isinstance(result, dict):
                            outputs = result
                        else:
                            outputs = {"result": result if isinstance(result, (str, int, float, bool, list)) else str(result)}
                        
                        # For Phase 1, fetch the generated artifacts
                        if phase == 1:
                            try:
                                # Fetch Phase 1 artifacts
                                genre_tropes = novel_vault.novel_read_text(project_id, "phase1_outputs/genre_tropes.md")
                                style_sheet = novel_vault.novel_read_text(project_id, "phase1_outputs/style_sheet.md")
                                context_bundle = novel_vault.novel_read_text(project_id, "phase1_outputs/context_bundle.md")
                                
                                outputs["artifacts"] = {
                                    "genre_tropes": genre_tropes.get("text", ""),
                                    "style_sheet": style_sheet.get("text", ""),
                                    "context_bundle": context_bundle.get("text", "")
                                }
                            except Exception as e:
                                print(f"Warning: Could not fetch Phase 1 artifacts: {e}")
                        
                        return WorkflowStatus(
                            workflowId=workflow_id,
                            phase=phase,
                            status=PhaseStatus.COMPLETED,
                            progress=100.0,
                            outputs=outputs,
                        )
                    except Exception as e:
                        print(f"Error getting workflow result: {e}")
                        # Still return completed status even if we can't get result
                        return WorkflowStatus(
                            workflowId=workflow_id,
                            phase=phase,
                            status=PhaseStatus.COMPLETED,
                            progress=100.0,
                            outputs={},
                        )
                
                # Check for failed status
                if desc.status == WorkflowExecutionStatus.FAILED:
                    return WorkflowStatus(
                        workflowId=workflow_id,
                        phase=phase,
                        status=PhaseStatus.FAILED,
                        progress=0.0,
                        outputs={},
                        error="Workflow execution failed"
                    )
                
                # Workflow is still running, try to get granular status via query
                try:
                    current_status = await handle.query("get_current_status")
                    outputs = {}
                    
                    # If waiting for review, get content
                    if current_status == "waiting_for_review":
                        content = await handle.query("get_pending_content")
                        description = None
                        expected_outputs = None
                        try:
                            description = await handle.query("get_pending_description")
                        except Exception:
                            description = None
                        try:
                            expected_outputs = await handle.query("get_pending_expected_outputs")
                        except Exception:
                            expected_outputs = None
                        if content:
                            outputs["pending_review"] = {
                                "content": content,
                                "description": description or "Please review the generated content.",
                                "expectedOutputs": expected_outputs or [],
                            }
                            
                    # Map status to progress
                    progress_map = {
                        "starting": 0,
                        "collecting_inputs": 10,
                        "waiting_for_inputs": 10,
                        "loading_context_bundle": 20,
                        "loading_sources": 15,
                        "researching": 30,
                        "generating_stylesheets": 50,
                        "generating_context_bundle": 70,
                        "generating_call_sheet": 70,
                        "extracting_json": 85,
                        "revising_call_sheet": 80,
                        "extracting_constraints": 85,
                        "running_risk_audit": 90,
                        "revising_outline": 80,
                        "generating_story_bible": 70,
                        "saving_story_bible": 85,
                        "generating_outline": 70,
                        "saving_outline": 85,
                        "updating_context_bundle": 80,
                        "saving_context_bundle": 85,
                        "parsing_outline": 90,
                        "waiting_for_review": 90,
                        "revising_call_sheet": 80,
                        "revising_characters": 80,
                        "revising_worldbuilding": 80,
                        "revising": 80,
                        "processing_review": 90,
                        "curating_context_bundle": 70,
                        "generating_tags": 70,
                        "validating_tags": 80,
                        "saving_tags": 90,
                        "completed": 100,
                    }
                    
                    return WorkflowStatus(
                        workflowId=workflow_id,
                        phase=phase,
                        status=PhaseStatus.IN_PROGRESS,
                        progress=float(progress_map.get(current_status, 10)),
                        currentStep=current_status.replace("_", " ").title(),
                        outputs=outputs,
                    )
                except Exception as e:
                    # Query failed but workflow is still running
                    return WorkflowStatus(
                        workflowId=workflow_id,
                        phase=phase,
                        status=PhaseStatus.IN_PROGRESS,
                        progress=10.0,
                        outputs={},
                    )
            except Exception as e:
                print(f"Error querying workflow status: {e}")
                pass  # Fall through to manifest-based status
        
        # Fall back to manifest-based status
        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {})
        phases_completed = state.get("phases_completed", [])
        
        if phase in phases_completed:
            phase_status = PhaseStatus.COMPLETED
            progress = 100.0
        elif phase == state.get("current_phase", 1):
            phase_status = PhaseStatus.NOT_STARTED
            progress = 0.0
        else:
            phase_status = PhaseStatus.NOT_STARTED
            progress = 0.0
        
        return WorkflowStatus(
            workflowId=f"workflow-{project_id}-phase-{phase}",
            phase=phase,
            status=phase_status,
            progress=progress,
            outputs={},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")


# Artifact Management Endpoints

@router.get("/projects/{project_id}/artifacts", response_model=List[ArtifactInfo])
async def list_artifacts(project_id: str, phase: str = None):
    """List all artifacts in a project."""
    try:
        artifacts = storage_manager.list_artifacts(project_id, phase)
        return [ArtifactInfo(**artifact) for artifact in artifacts]
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list artifacts: {str(e)}")


@router.get("/projects/{project_id}/artifacts/{artifact_path:path}")
async def get_artifact(project_id: str, artifact_path: str):
    """Get artifact content."""
    try:
        result = novel_vault.novel_read_text(project_id, artifact_path)
        return {"content": result["text"], "path": artifact_path}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Artifact {artifact_path} not found in project {project_id}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get artifact: {str(e)}")


@router.put("/projects/{project_id}/artifacts/{artifact_path:path}")
async def update_artifact(
    project_id: str, artifact_path: str, request: ArtifactUpdateRequest
):
    """Update artifact content."""
    try:
        result = novel_vault.novel_write_text(project_id, artifact_path, request.content)
        return {"success": True, "path": artifact_path, "bytes_written": result["bytes_written"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update artifact: {str(e)}")
"""
Additional API endpoints for workflow control, human input, and chapter management.
"""

# Workflow Control Endpoints

@router.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str):
    """Cancel a running workflow."""
    try:
        from ..workflows.client import get_temporal_client
        
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)
        
        await handle.cancel()
        
        return {"success": True, "workflow_id": workflow_id, "status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel workflow: {str(e)}")


@router.post("/workflows/{workflow_id}/signal")
async def signal_workflow(workflow_id: str, signal: WorkflowSignal):
    """Send a signal to a running workflow."""
    try:
        from ..workflows.client import get_temporal_client
        
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)
        
        # Send signal with args as a single dict parameter
        await handle.signal(signal.signal_name, signal.args)
        
        return {"success": True, "workflow_id": workflow_id, "signal": signal.signal_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to signal workflow: {str(e)}")


@router.get("/workflows/{workflow_id}/history")
async def get_workflow_history(workflow_id: str):
    """Get workflow execution history."""
    try:
        from ..workflows.client import get_temporal_client
        
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)
        
        # Get workflow description which includes history
        description = await handle.describe()
        
        return {
            "workflow_id": workflow_id,
            "status": description.status.name,
            "start_time": description.start_time.isoformat() if description.start_time else None,
            "close_time": description.close_time.isoformat() if description.close_time else None,
            "execution_time": description.execution_time,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow history: {str(e)}")


# Human Input Endpoints

@router.get("/projects/{project_id}/pending-inputs", response_model=List[PendingInput])
async def list_pending_inputs(project_id: str):
    """List all workflows awaiting human input for a project."""
    try:
        import re
        from datetime import datetime

        from ..workflows.client import get_temporal_client

        client = await get_temporal_client()

        result: list[PendingInput] = []

        list_fn = getattr(client, "list_workflows", None)
        if not callable(list_fn):
            return []

        safe_project_id = project_id.replace("'", "''")
        prefixes = [f"phase{i}-{safe_project_id}-" for i in range(1, 9)]
        workflow_id_clauses = " OR ".join(
            [f"WorkflowId STARTS_WITH '{prefix}'" for prefix in prefixes]
        )

        workflow_iter = None
        for query in (
            f"ExecutionStatus='Running' AND ({workflow_id_clauses})",
            f"({workflow_id_clauses})",
            "ExecutionStatus='Running'",
        ):
            try:
                workflow_iter = list_fn(query)
                break
            except Exception:
                workflow_iter = None

        if workflow_iter is None:
            return []

        async for wf in workflow_iter:
            workflow_id = (
                getattr(wf, "id", None)
                or getattr(wf, "workflow_id", None)
                or getattr(wf, "workflowId", None)
            )
            if not workflow_id or not isinstance(workflow_id, str):
                continue

            # Safety filter in case visibility query fallback is too broad
            if f"-{project_id}-" not in workflow_id:
                continue

            match = re.match(r"^phase(\d+)-", workflow_id)
            phase_num = int(match.group(1)) if match else 1

            handle = client.get_workflow_handle(workflow_id)
            try:
                current_status = await handle.query("get_current_status")
            except Exception:
                continue

            if current_status != "waiting_for_review":
                continue

            prompt = "Please review the generated content."
            current_content = None
            expected_outputs = None

            try:
                maybe_prompt = await handle.query("get_pending_description")
                if isinstance(maybe_prompt, str) and maybe_prompt.strip():
                    prompt = maybe_prompt
            except Exception:
                pass

            try:
                maybe_content = await handle.query("get_pending_content")
                if isinstance(maybe_content, str) and maybe_content.strip():
                    current_content = maybe_content
            except Exception:
                pass

            try:
                maybe_expected_outputs = await handle.query("get_pending_expected_outputs")
                if isinstance(maybe_expected_outputs, list):
                    expected_outputs = [str(x) for x in maybe_expected_outputs]
            except Exception:
                pass

            result.append(
                PendingInput(
                    workflowId=workflow_id,
                    phase=phase_num,
                    prompt=prompt,
                    inputType="review",
                    currentContent=current_content,
                    expectedOutputs=expected_outputs,
                    requestedAt=datetime.utcnow().isoformat(),
                )
            )

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list pending inputs: {str(e)}")


@router.post("/workflows/{workflow_id}/respond")
async def respond_to_workflow(workflow_id: str, response: HumanInputResponse):
    """Submit a response to a workflow awaiting human input."""
    try:
        from ..workflows.client import get_temporal_client
        
        client = await get_temporal_client()
        handle = client.get_workflow_handle(workflow_id)
        
        # Determine which signal to send based on workflow ID and input type
        # Phase 1 workflows have specific signals for different stages
        if "phase1" in workflow_id:
            # Check if this is user input or approval
            if "genre" in response.inputs or "book_title" in response.inputs:
                # Initial user input signal
                await handle.signal("provide_user_input", response.inputs)
            elif "decision" in response.inputs:
                # Context approval signal
                decision = response.inputs.get("decision", "")
                notes = response.inputs.get("revision_notes", "")
                await handle.signal(
                    "provide_context_approval",
                    {"decision": decision, "notes": notes, "revision_notes": notes},
                )
            elif "revision_notes" in response.inputs:
                # Support workflows that submit notes separately after a REVISE decision
                notes = response.inputs.get("revision_notes", "")
                await handle.signal(
                    "provide_context_approval",
                    {"decision": "REVISE", "notes": notes, "revision_notes": notes},
                )
            else:
                # Generic fallback
                await handle.signal("provide_user_input", response.inputs)
        elif "phase2" in workflow_id:
            # Phase 2 uses generic signal (existing behavior)
            await handle.signal("human_input_received", response.inputs)
        else:
            # Generic signal for other phases
            await handle.signal("human_input_received", response.inputs)
        
        return {"success": True, "workflow_id": workflow_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to respond to workflow: {str(e)}")


# Chapter Management Endpoints

@router.get("/projects/{project_id}/chapters", response_model=List[ChapterDetail])
async def list_chapters(project_id: str):
    """List all chapters from the project's outline."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        chapters_data = manifest.get("state", {}).get("chapters", [])
        
        chapters = []
        for chapter_data in chapters_data:
            chapter_num = chapter_data.get("number")
            
            # Check which artifacts exist for this chapter
            chapter_dir = f"phase7_outputs/chapter_{chapter_num}"
            legacy_chapter_dir = f"phase6_outputs/chapter_{chapter_num}"
            has_scene_brief = False
            has_first_draft = False
            has_improvement_plan = False
            has_final = False
            word_count = None
            last_updated = None
            
            try:
                # Check for scene brief
                novel_vault.novel_read_text(project_id, f"{chapter_dir}/scene_brief.md")
                has_scene_brief = True
            except:
                try:
                    novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/scene_brief.md")
                    has_scene_brief = True
                except:
                    pass
            
            try:
                # Check for first draft
                novel_vault.novel_read_text(project_id, f"{chapter_dir}/first_draft.md")
                has_first_draft = True
            except:
                try:
                    novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/first_draft.md")
                    has_first_draft = True
                except:
                    pass

            try:
                # Check for improvement plan
                novel_vault.novel_read_text(project_id, f"{chapter_dir}/improvement_plan.md")
                has_improvement_plan = True
            except:
                try:
                    novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/improvement_plan.md")
                    has_improvement_plan = True
                except:
                    pass
            
            try:
                # Check for final chapter
                final_result = novel_vault.novel_read_text(project_id, f"{chapter_dir}/final.md")
                has_final = True
                # Rough word count
                word_count = len(final_result["text"].split())
                last_updated = final_result.get("modified")
            except:
                try:
                    final_result = novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/final.md")
                    has_final = True
                    word_count = len(final_result["text"].split())
                    last_updated = final_result.get("modified")
                except:
                    pass
            
            # Determine status
            if has_final:
                status = "completed"
            elif has_first_draft or has_scene_brief:
                status = "in_progress"
            else:
                status = "not_started"
            
            chapters.append(ChapterDetail(
                number=chapter_num,
                title=chapter_data.get("title", f"Chapter {chapter_num}"),
                status=status,
                word_count=word_count,
                last_updated=last_updated,
                has_scene_brief=has_scene_brief,
                has_first_draft=has_first_draft,
                has_improvement_plan=has_improvement_plan,
                has_final=has_final,
            ))
        
        return chapters
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list chapters: {str(e)}")


@router.get("/projects/{project_id}/chapters/{chapter_number}", response_model=ChapterDetail)
async def get_chapter(project_id: str, chapter_number: int):
    """Get details about a specific chapter."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        chapters_data = manifest.get("state", {}).get("chapters", [])
        
        # Find the chapter
        chapter_data = next(
            (c for c in chapters_data if c.get("number") == chapter_number),
            None
        )
        
        if not chapter_data:
            raise HTTPException(status_code=404, detail=f"Chapter {chapter_number} not found")
        
        # Check which artifacts exist
        chapter_dir = f"phase7_outputs/chapter_{chapter_number}"
        legacy_chapter_dir = f"phase6_outputs/chapter_{chapter_number}"
        has_scene_brief = False
        has_first_draft = False
        has_improvement_plan = False
        has_final = False
        word_count = None
        last_updated = None
        
        try:
            novel_vault.novel_read_text(project_id, f"{chapter_dir}/scene_brief.md")
            has_scene_brief = True
        except:
            try:
                novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/scene_brief.md")
                has_scene_brief = True
            except:
                pass
        
        try:
            novel_vault.novel_read_text(project_id, f"{chapter_dir}/first_draft.md")
            has_first_draft = True
        except:
            try:
                novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/first_draft.md")
                has_first_draft = True
            except:
                pass

        try:
            novel_vault.novel_read_text(project_id, f"{chapter_dir}/improvement_plan.md")
            has_improvement_plan = True
        except:
            try:
                novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/improvement_plan.md")
                has_improvement_plan = True
            except:
                pass
        
        try:
            final_result = novel_vault.novel_read_text(project_id, f"{chapter_dir}/final.md")
            has_final = True
            word_count = len(final_result["text"].split())
            last_updated = final_result.get("modified")
        except:
            try:
                final_result = novel_vault.novel_read_text(project_id, f"{legacy_chapter_dir}/final.md")
                has_final = True
                word_count = len(final_result["text"].split())
                last_updated = final_result.get("modified")
            except:
                pass
        
        # Determine status
        if has_final:
            status = "completed"
        elif has_first_draft or has_scene_brief:
            status = "in_progress"
        else:
            status = "not_started"
        
        return ChapterDetail(
            number=chapter_number,
            title=chapter_data.get("title", f"Chapter {chapter_number}"),
            status=status,
            word_count=word_count,
            last_updated=last_updated,
            has_scene_brief=has_scene_brief,
            has_first_draft=has_first_draft,
            has_improvement_plan=has_improvement_plan,
            has_final=has_final,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chapter: {str(e)}")


@router.put("/projects/{project_id}/chapters/{chapter_number}")
async def update_chapter(project_id: str, chapter_number: int, update: ChapterUpdate):
    """Update chapter metadata."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        chapters_data = manifest.get("state", {}).get("chapters", [])
        
        # Find and update the chapter
        chapter_found = False
        for chapter in chapters_data:
            if chapter.get("number") == chapter_number:
                if update.title:
                    chapter["title"] = update.title
                if update.notes:
                    chapter["notes"] = update.notes
                chapter_found = True
                break
        
        if not chapter_found:
            raise HTTPException(status_code=404, detail=f"Chapter {chapter_number} not found")
        
        # Update manifest (store chapters under state)
        novel_vault.novel_update_manifest(project_id, {"state": {"chapters": chapters_data}})
        
        return {"success": True, "chapter_number": chapter_number}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update chapter: {str(e)}")


# Progress & Stats Endpoints

@router.get("/projects/{project_id}/progress", response_model=ProjectProgress)
async def get_project_progress(project_id: str):
    """Get detailed progress information for a project."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        state = manifest.get("state", {})
        chapters_data = state.get("chapters", [])

        inferred_completed, inferred_current_phase, chapters_completed = _infer_project_phase_state(project_id, state)

        # Calculate phase progress
        phases_completed = inferred_completed
        phases = []

        for phase_num in range(1, 9):
            if phase_num in phases_completed:
                phases.append(PhaseProgress(
                    phase=phase_num,
                    status=PhaseStatus.COMPLETED,
                    progress=100.0,
                    started_at=None,  # TODO: Track this
                    completed_at=None,  # TODO: Track this
                ))
            elif phase_num == 7:
                total_chapters = state.get("total_chapters")
                if not isinstance(total_chapters, int) or total_chapters <= 0:
                    total_chapters = len(chapters_data)
                if total_chapters > 0 and chapters_completed > 0:
                    progress = min(99.0, float(chapters_completed / total_chapters) * 100.0)
                    phases.append(PhaseProgress(
                        phase=phase_num,
                        status=PhaseStatus.IN_PROGRESS,
                        progress=progress,
                        started_at=None,
                        completed_at=None,
                    ))
                else:
                    phases.append(PhaseProgress(
                        phase=phase_num,
                        status=PhaseStatus.NOT_STARTED,
                        progress=0.0,
                        started_at=None,
                        completed_at=None,
                    ))
            elif phase_num == inferred_current_phase:
                phases.append(PhaseProgress(
                    phase=phase_num,
                    status=PhaseStatus.NOT_STARTED,
                    progress=0.0,
                    started_at=None,
                    completed_at=None,
                ))
            else:
                phases.append(PhaseProgress(
                    phase=phase_num,
                    status=PhaseStatus.NOT_STARTED,
                    progress=0.0,
                    started_at=None,
                    completed_at=None,
                ))
        
        # Calculate overall progress
        phase_weight = 0.7  # 70% weight to phases
        chapter_weight = 0.3  # 30% weight to chapters
        
        phase_progress = (len(phases_completed) / 8) * 100
        chapter_progress = (chapters_completed / max(len(chapters_data), 1)) * 100
        
        overall_progress = (phase_progress * phase_weight) + (chapter_progress * chapter_weight)
        
        return ProjectProgress(
            project_id=project_id,
            overall_progress=overall_progress,
            phases=phases,
            chapters_completed=chapters_completed,
            total_chapters=len(chapters_data),
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {str(e)}")


@router.get("/projects/{project_id}/timeline", response_model=List[TimelineEvent])
async def get_project_timeline(project_id: str):
    """Get project timeline/activity log."""
    try:
        manifest = storage_manager.get_project_manifest(project_id)
        
        # Build timeline from manifest data
        events = []
        
        # Project creation
        events.append(TimelineEvent(
            timestamp=manifest.get("created_at", ""),
            event_type="project_created",
            phase=None,
            description=f"Project '{manifest.get('metadata', {}).get('title')}' created",
        ))
        
        # Completed phases
        for phase in manifest.get("state", {}).get("phases_completed", []):
            events.append(TimelineEvent(
                timestamp=manifest.get("updated_at", ""),  # TODO: Track individual phase completion times
                event_type="phase_completed",
                phase=phase,
                description=f"Completed Phase {phase}",
            ))
        
        # Sort by timestamp (most recent first)
        events.sort(key=lambda x: x.timestamp, reverse=True)
        
        return events
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get timeline: {str(e)}")


@router.get("/system/stats", response_model=SystemStats)
async def get_system_stats():
    """Get system-wide statistics."""
    try:
        import time
        import os
        
        # Get all projects
        projects = storage_manager.list_all_projects()
        total_projects = len(projects)
        
        # Calculate storage (simplified)
        storage_mb = 0.0
        try:
            vault_path = storage_manager.vault_root
            for dirpath, dirnames, filenames in os.walk(vault_path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    storage_mb += os.path.getsize(filepath) / (1024 * 1024)
        except:
            pass
        
        # TODO: Get active workflows from Temporal
        active_workflows = 0
        
        # Uptime (simplified - would need to track server start time)
        uptime_seconds = 0
        
        return SystemStats(
            total_projects=total_projects,
            active_workflows=active_workflows,
            total_storage_mb=round(storage_mb, 2),
            uptime_seconds=uptime_seconds,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get system stats: {str(e)}")
