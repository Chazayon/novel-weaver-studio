// API Type Definitions
// These types match the backend API models

export interface ProjectCreate {
    title: string;
    author: string;
    genre: string;
    seriesLength: number;
}

export interface ProjectResponse {
    id: string;
    title: string;
    author: string;
    genre: string;
    seriesLength: number;
    createdAt: string;
    updatedAt: string;
    currentPhase: number;
    progress: number;
}

export type ImportChapterKind = 'final' | 'draft';

export interface ImportChapter {
    number: number;
    title?: string;
    content: string;
    kind?: ImportChapterKind;
}

export interface ImportArtifact {
    path: string;
    content: string;
}

export interface ProjectImportRequest {
    genreTropes?: string;
    styleSheet?: string;
    contextBundle?: string;
    seriesOutline?: string;
    callSheet?: string;
    characters?: string;
    worldbuilding?: string;
    storyBible?: string;
    outline?: string;
    chapters?: ImportChapter[];
    artifacts?: ImportArtifact[];
    overwrite?: boolean;
    ensureContextBundle?: boolean;
    generateOutlineFromChapters?: boolean;
    metadataPatch?: Record<string, unknown>;
}

export interface ProjectImportCreateRequest {
    metadata: ProjectCreate;
    import: ProjectImportRequest;
}

export interface ResumeSuggestion {
    nextChapterNumber?: number;
    nextChapterTitle?: string;
    chaptersCompleted: number;
    totalChapters: number;
}

export interface GenerateStyleSheetRequest {
    overwrite?: boolean;
    maxChars?: number;
    chapterNumbers?: number[];
}

export interface GenerateStyleSheetResponse {
    success: boolean;
    styleSheet: string;
}

export interface PhaseExecuteRequest {
    phase: number;
    inputs: Record<string, unknown>;
}

export interface WorkflowStatus {
    workflowId: string;
    phase: number;
    status: 'not-started' | 'in-progress' | 'completed' | 'failed';
    progress: number;
    currentStep?: string;
    outputs: Record<string, unknown>;
    error?: string;
}

export interface ArtifactInfo {
    name: string;
    path: string;
    size: number;
    modified: string;
}

export interface ArtifactContent {
    content: string;
    path: string;
}

export interface ArtifactUpdateRequest {
    content: string;
}

export interface WorkflowSignal {
    signal_name: string;
    args: Record<string, unknown>;
}

export interface WorkflowHistory {
    workflowId: string;
    status: string;
    startTime?: string;
    closeTime?: string;
    executionTime?: number;
}

export interface PendingInput {
    workflowId: string;
    phase: number;
    prompt: string;
    inputType: string;
    currentContent?: string;
    expectedOutputs?: string[];
    requestedAt?: string;
}

export interface HumanInputResponse {
    inputs: Record<string, unknown>;
}

export interface ChapterDetail {
    number: number;
    title: string;
    status: 'not_started' | 'in_progress' | 'completed';
    wordCount?: number;
    lastUpdated?: string;
    hasSceneBrief: boolean;
    hasFirstDraft: boolean;
    hasImprovementPlan: boolean;
    hasFinal: boolean;
}

export interface ChapterUpdate {
    title?: string;
    notes?: string;
}

export interface PhaseProgress {
    phase: number;
    status: 'not-started' | 'in-progress' | 'completed' | 'failed';
    progress: number;
    startedAt?: string;
    completedAt?: string;
}

export interface ProjectProgress {
    projectId: string;
    overallProgress: number;
    phases: PhaseProgress[];
    chaptersCompleted: number;
    totalChapters: number;
}

export interface TimelineEvent {
    timestamp: string;
    type: string;
    phase?: number;
    description: string;
}

export interface SystemStats {
    totalProjects: number;
    activeWorkflows: number;
    totalStorageMb: number;
    uptimeSeconds: number;
}

export interface LLMStepProfile {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface ProjectLLMSettings {
    default?: LLMStepProfile;
    profiles: Record<string, LLMStepProfile>;
}

export interface ProjectLLMSettingsUpdate {
    default?: LLMStepProfile;
    profiles?: Record<string, LLMStepProfile>;
    replaceProfiles?: boolean;
}

export interface HealthResponse {
    status: string;
    timestamp: string;
}

// Project Management
export type CreateProjectRequest = ProjectCreate;
export type ListProjectsResponse = ProjectResponse[];
export type GetProjectResponse = ProjectResponse;
export type CreateProjectFromImportRequest = ProjectImportCreateRequest;
export type ImportIntoProjectRequest = ProjectImportRequest;
export type GetResumeSuggestionResponse = ResumeSuggestion;
export type GenerateStyleSheetFromChaptersRequest = GenerateStyleSheetRequest;
export type GenerateStyleSheetFromChaptersResponse = GenerateStyleSheetResponse;

// Workflow Execution
export type ExecutePhaseRequest = PhaseExecuteRequest;
export type ExecutePhaseResponse = WorkflowStatus;
export type GetPhaseStatusResponse = WorkflowStatus;

// Artifacts
export type ListArtifactsResponse = ArtifactInfo[];
export type GetArtifactResponse = ArtifactContent;
export type UpdateArtifactRequest = ArtifactUpdateRequest;

// Workflow Control
export interface CancelWorkflowResponse {
    success: boolean;
    workflowId: string;
    status: string;
}

// Human Input
export type ListPendingInputsResponse = PendingInput[];

// Chapters
export type ListChaptersResponse = ChapterDetail[];
export type GetChapterResponse = ChapterDetail;

// Progress & Stats
export type GetProjectProgressResponse = ProjectProgress;
export type GetProjectTimelineResponse = TimelineEvent[];
export type GetSystemStatsResponse = SystemStats;
