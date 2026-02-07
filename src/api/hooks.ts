import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import {
    ProjectCreate,
    ProjectResponse,
    PhaseExecuteRequest,
    WorkflowStatus,
    ChapterDetail,
    ProjectProgress,
    ArtifactInfo,
    PendingInput,
    SystemStats,
    ProjectLLMSettingsUpdate,
    ProjectImportCreateRequest,
    ProjectImportRequest,
    ResumeSuggestion,
    GenerateStyleSheetRequest,
    GenerateStyleSheetResponse,
} from './types';

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
    projects: ['projects'] as const,
    project: (id: string) => ['projects', id] as const,
    projectProgress: (id: string) => ['projects', id, 'progress'] as const,
    projectLlmSettings: (id: string) => ['projects', id, 'settings', 'llm'] as const,
    resumeSuggestion: (id: string) => ['projects', id, 'resume-suggestion'] as const,
    phaseStatus: (projectId: string, phase: number, workflowId?: string) =>
        ['projects', projectId, 'phases', phase, 'status', workflowId] as const,
    chapters: (projectId: string) => ['projects', projectId, 'chapters'] as const,
    chapter: (projectId: string, chapterNumber: number) =>
        ['projects', projectId, 'chapters', chapterNumber] as const,
    artifacts: (projectId: string, phase?: string) =>
        ['projects', projectId, 'artifacts', phase] as const,
    pendingInputs: (projectId: string) => ['projects', projectId, 'pending-inputs'] as const,
    systemStats: ['system', 'stats'] as const,
};

// ============================================================================
// Project Management Hooks
// ============================================================================

export function useProjects() {
    return useQuery({
        queryKey: queryKeys.projects,
        queryFn: () => apiClient.listProjects(),
        staleTime: 30000, // 30 seconds
    });
}

export function useCreateProjectFromImport() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ProjectImportCreateRequest) => apiClient.createProjectFromImport(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

export function useImportIntoProject(projectId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ProjectImportRequest) => apiClient.importIntoProject(projectId!, payload),
        onSuccess: (_, __) => {
            if (!projectId) return;
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
            queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.projectProgress(projectId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.resumeSuggestion(projectId) });
        },
    });
}

export function useResumeSuggestion(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.resumeSuggestion(projectId!),
        queryFn: () => apiClient.getResumeSuggestion(projectId!),
        enabled: !!projectId,
        staleTime: 10000,
    });
}

export function useGenerateStyleSheetFromChapters(projectId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: GenerateStyleSheetRequest) =>
            apiClient.generateStyleSheetFromChapters(projectId!, payload),
        onSuccess: () => {
            if (!projectId) return;
            queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.projectProgress(projectId) });
        },
    });
}

// ============================================================================
// Project Settings Hooks
// ============================================================================

export function useProjectLlmSettings(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.projectLlmSettings(projectId!),
        queryFn: () => apiClient.getProjectLlmSettings(projectId!),
        enabled: !!projectId,
        staleTime: 30000,
    });
}

export function useUpdateProjectLlmSettings(projectId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ProjectLLMSettingsUpdate) =>
            apiClient.updateProjectLlmSettings(projectId!, payload),
        onSuccess: () => {
            if (!projectId) return;
            queryClient.invalidateQueries({ queryKey: queryKeys.projectLlmSettings(projectId) });
        },
    });
}

export function useProject(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.project(projectId!),
        queryFn: () => apiClient.getProject(projectId!),
        enabled: !!projectId,
        staleTime: 30000,
    });
}

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ProjectCreate) => apiClient.createProject(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        },
    });
}

// ============================================================================
// Workflow Execution Hooks
// ============================================================================

export function useExecutePhase() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            projectId,
            phase,
            request,
        }: {
            projectId: string;
            phase: number;
            request: PhaseExecuteRequest;
        }) => apiClient.executePhase(projectId, phase, request),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.phaseStatus(variables.projectId, variables.phase)
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.projectProgress(variables.projectId)
            });
        },
    });
}

export function usePhaseStatus(
    projectId: string | undefined,
    phase: number,
    workflowId?: string,
    options?: { refetchInterval?: number; enabled?: boolean }
) {
    return useQuery({
        queryKey: queryKeys.phaseStatus(projectId!, phase, workflowId),
        queryFn: () => apiClient.getPhaseStatus(projectId!, phase, workflowId),
        enabled: !!projectId && (options?.enabled ?? true),
        refetchInterval: options?.refetchInterval || false,
    });
}

export function useCancelWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (workflowId: string) => apiClient.cancelWorkflow(workflowId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}

// ============================================================================
// Chapter Management Hooks
// ============================================================================

export function useChapters(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.chapters(projectId!),
        queryFn: () => apiClient.listChapters(projectId!),
        enabled: !!projectId,
        staleTime: 10000,
    });
}

export function useChapter(projectId: string | undefined, chapterNumber: number | undefined) {
    return useQuery({
        queryKey: queryKeys.chapter(projectId!, chapterNumber!),
        queryFn: () => apiClient.getChapter(projectId!, chapterNumber!),
        enabled: !!projectId && chapterNumber !== undefined,
    });
}

// ============================================================================
// Artifact Management Hooks
// ============================================================================

export function useArtifacts(projectId: string | undefined, phase?: string) {
    return useQuery({
        queryKey: queryKeys.artifacts(projectId!, phase),
        queryFn: () => apiClient.listArtifacts(projectId!, phase),
        enabled: !!projectId,
        staleTime: 10000,
    });
}

export function useArtifact(projectId: string | undefined, artifactPath: string | undefined) {
    return useQuery({
        queryKey: ['projects', projectId, 'artifacts', 'content', artifactPath],
        queryFn: () => apiClient.getArtifact(projectId!, artifactPath!),
        enabled: !!projectId && !!artifactPath,
    });
}

export function useUpdateArtifact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            projectId,
            artifactPath,
            content,
        }: {
            projectId: string;
            artifactPath: string;
            content: string;
        }) => apiClient.updateArtifact(projectId, artifactPath, { content }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.artifacts(variables.projectId)
            });
        },
    });
}

// ============================================================================
// Progress & Stats Hooks
// ============================================================================

export function useProjectProgress(projectId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.projectProgress(projectId!),
        queryFn: () => apiClient.getProjectProgress(projectId!),
        enabled: !!projectId,
        staleTime: 5000,
    });
}

export function useSystemStats() {
    return useQuery({
        queryKey: queryKeys.systemStats,
        queryFn: () => apiClient.getSystemStats(),
        staleTime: 60000, // 1 minute
    });
}

// ============================================================================
// Human Input Hooks
// ============================================================================

export function usePendingInputs(
    projectId: string | undefined,
    options?: { refetchInterval?: number }
) {
    return useQuery({
        queryKey: queryKeys.pendingInputs(projectId!),
        queryFn: () => apiClient.listPendingInputs(projectId!),
        enabled: !!projectId,
        refetchInterval: options?.refetchInterval || false,
    });
}

export function useRespondToWorkflow() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            workflowId,
            inputs,
        }: {
            workflowId: string;
            inputs: Record<string, unknown>;
        }) => apiClient.respondToWorkflow(workflowId, { inputs }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });
}
