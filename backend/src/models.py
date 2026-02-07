"""Pydantic models for API requests and responses."""

from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional

from pydantic import BaseModel, Field


class PhaseStatus(str, Enum):
    """Phase execution status."""
    NOT_STARTED = "not-started"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ProjectMetadata(BaseModel):
    """Project metadata."""
    title: str = Field(..., description="Novel title")
    author: str = Field(..., description="Author name")
    genre: str = Field(..., description="Novel genre")
    series_length: int = Field(default=20, description="Target number of chapters", alias="seriesLength")


class ProjectCreate(BaseModel):
    """Request model for creating a new project."""
    title: str
    author: str
    genre: str
    series_length: int = Field(default=20, alias="seriesLength")


class ProjectResponse(BaseModel):
    """Response model for project information."""
    id: str
    title: str
    author: str
    genre: str
    series_length: int = Field(alias="seriesLength")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    current_phase: int = Field(alias="currentPhase")
    progress: float  # 0-100
    
    class Config:
        populate_by_name = True


class GenerateStyleSheetRequest(BaseModel):
    overwrite: bool = False
    max_chars: int = Field(default=60000, alias="maxChars")
    chapter_numbers: Optional[List[int]] = Field(default=None, alias="chapterNumbers")

    class Config:
        populate_by_name = True


class ArtifactInfo(BaseModel):
    """Information about a project artifact."""
    path: str
    name: str
    size: int
    modified: str


class PhaseInput(BaseModel):
    """User input for a workflow phase."""
    inputs: Dict[str, Any] = Field(default_factory=dict)


class WorkflowStatus(BaseModel):
    """Status of a workflow execution."""
    workflow_id: str = Field(alias="workflowId")
    phase: int
    status: PhaseStatus
    progress: float  # 0-100
    current_step: Optional[str] = Field(default=None, alias="currentStep")
    outputs: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    
    class Config:
        populate_by_name = True


class ChapterInfo(BaseModel):
    """Information about a chapter."""
    number: int
    title: str


class PhaseExecuteRequest(BaseModel):
    """Request to execute a workflow phase."""
    phase: int
    inputs: Dict[str, Any] = Field(default_factory=dict)


class LLMStepProfile(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = Field(default=None, alias="maxTokens")

    class Config:
        populate_by_name = True


class ProjectLLMSettings(BaseModel):
    default: Optional[LLMStepProfile] = None
    profiles: Dict[str, LLMStepProfile] = Field(default_factory=dict)


class ProjectLLMSettingsUpdate(BaseModel):
    default: Optional[LLMStepProfile] = None
    profiles: Optional[Dict[str, LLMStepProfile]] = None

    replace_profiles: bool = Field(default=False, alias="replaceProfiles")

    class Config:
        populate_by_name = True


class ArtifactUpdateRequest(BaseModel):
    """Request to update an artifact."""
    content: str


class WorkflowSignal(BaseModel):
    """Signal to send to a running workflow."""
    signal_name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class HumanInputResponse(BaseModel):
    """Response to a human input request."""
    inputs: Dict[str, str]


class PendingInput(BaseModel):
    """Information about a pending human input request."""
    workflow_id: str = Field(alias="workflowId")
    phase: int
    prompt: str
    input_type: str = Field(alias="inputType")
    current_content: Optional[str] = Field(default=None, alias="currentContent")
    expected_outputs: Optional[List[str]] = Field(default=None, alias="expectedOutputs")
    requested_at: Optional[str] = Field(default=None, alias="requestedAt")
    
    class Config:
        populate_by_name = True


class ChapterDetail(BaseModel):
    """Detailed information about a chapter."""
    number: int
    title: str
    status: str  # "not_started", "in_progress", "completed"
    word_count: Optional[int] = Field(default=None, alias="wordCount")
    last_updated: Optional[str] = Field(default=None, alias="lastUpdated")
    has_scene_brief: bool = Field(default=False, alias="hasSceneBrief")
    has_first_draft: bool = Field(default=False, alias="hasFirstDraft")
    has_improvement_plan: bool = Field(default=False, alias="hasImprovementPlan")
    has_final: bool = Field(default=False, alias="hasFinal")
    
    class Config:
        populate_by_name = True


class ChapterUpdate(BaseModel):
    """Update request for chapter metadata."""
    title: Optional[str] = None
    notes: Optional[str] = None


class PhaseProgress(BaseModel):
    """Progress information for a single phase."""
    phase: int
    status: PhaseStatus
    progress: float  # 0-100
    started_at: Optional[str] = Field(default=None, alias="startedAt")
    completed_at: Optional[str] = Field(default=None, alias="completedAt")
    
    class Config:
        populate_by_name = True


class ProjectProgress(BaseModel):
    """Detailed progress information for a project."""
    project_id: str = Field(alias="projectId")
    overall_progress: float = Field(alias="overallProgress")  # 0-100
    phases: List[PhaseProgress]
    chapters_completed: int = Field(alias="chaptersCompleted")
    total_chapters: int = Field(alias="totalChapters")
    
    class Config:
        populate_by_name = True


class TimelineEvent(BaseModel):
    """A timeline event in project history."""
    timestamp: str
    event_type: str = Field(alias="eventType")
    phase: Optional[int] = None
    description: str
    
    class Config:
        populate_by_name = True


class SystemStats(BaseModel):
    """System-wide statistics."""
    total_projects: int = Field(alias="totalProjects")
    active_workflows: int = Field(alias="activeWorkflows")
    total_storage_mb: float = Field(alias="totalStorageMb")
    uptime_seconds: int = Field(alias="uptimeSeconds")
    
    class Config:
        populate_by_name = True


class ImportChapterKind(str, Enum):
    FINAL = "final"
    DRAFT = "draft"


class ImportChapter(BaseModel):
    number: int
    title: Optional[str] = None
    content: str
    kind: ImportChapterKind = ImportChapterKind.FINAL


class ImportArtifact(BaseModel):
    path: str
    content: str


class ProjectImportRequest(BaseModel):
    genre_tropes: Optional[str] = Field(default=None, alias="genreTropes")
    style_sheet: Optional[str] = Field(default=None, alias="styleSheet")
    context_bundle: Optional[str] = Field(default=None, alias="contextBundle")
    series_outline: Optional[str] = Field(default=None, alias="seriesOutline")
    call_sheet: Optional[str] = Field(default=None, alias="callSheet")
    characters: Optional[str] = None
    worldbuilding: Optional[str] = None
    story_bible: Optional[str] = Field(default=None, alias="storyBible")
    outline: Optional[str] = None

    chapters: List[ImportChapter] = Field(default_factory=list)
    artifacts: List[ImportArtifact] = Field(default_factory=list)

    overwrite: bool = False
    ensure_context_bundle: bool = Field(default=True, alias="ensureContextBundle")
    generate_outline_from_chapters: bool = Field(
        default=True, alias="generateOutlineFromChapters"
    )

    metadata_patch: Optional[Dict[str, Any]] = Field(default=None, alias="metadataPatch")

    class Config:
        populate_by_name = True


class ProjectImportCreateRequest(BaseModel):
    metadata: ProjectCreate
    import_data: ProjectImportRequest = Field(alias="import")

    class Config:
        populate_by_name = True


class ResumeSuggestion(BaseModel):
    next_chapter_number: Optional[int] = Field(default=None, alias="nextChapterNumber")
    next_chapter_title: Optional[str] = Field(default=None, alias="nextChapterTitle")
    chapters_completed: int = Field(alias="chaptersCompleted")
    total_chapters: int = Field(alias="totalChapters")

    class Config:
        populate_by_name = True
