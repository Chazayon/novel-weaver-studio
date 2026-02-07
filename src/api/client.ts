import axios, { AxiosInstance, AxiosError } from 'axios';
import {
    ProjectCreate,
    ProjectResponse,
    ProjectImportCreateRequest,
    ProjectImportRequest,
    ResumeSuggestion,
    GenerateStyleSheetRequest,
    GenerateStyleSheetResponse,
    PhaseExecuteRequest,
    WorkflowStatus,
    ArtifactInfo,
    ArtifactContent,
    ArtifactUpdateRequest,
    WorkflowSignal,
    WorkflowHistory,
    PendingInput,
    HumanInputResponse,
    ChapterDetail,
    ChapterUpdate,
    ProjectProgress,
    TimelineEvent,
    SystemStats,
    HealthResponse,
    CancelWorkflowResponse,
    ProjectLLMSettings,
    ProjectLLMSettingsUpdate,
} from './types';

// API Client Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type FastApiValidationError = {
    loc?: Array<string | number>;
    msg?: string;
};

type FastApiErrorBody = {
    detail?: unknown;
};

type EnhancedError = Error & { response?: unknown };

class NovelWeaverClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': 'novel-weaver-studio', // Dummy token for strict proxies
            },
            timeout: 30000, // 30 seconds
        });

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                const status = error.response?.status;
                const url = (error.config?.url || '').toString();
                const isArtifact404 = status === 404 && url.includes('/artifacts/');

                if (!isArtifact404) {
                    console.error('API Error:', error.response?.data);
                }

                if (error.response) {
                    // Server responded with error status
                    const data = error.response.data as FastApiErrorBody;
                    let message = 'An error occurred';

                    if (data?.detail) {
                        if (Array.isArray(data.detail)) {
                            // FastAPI validation errors
                            const errs = data.detail as FastApiValidationError[];
                            message = errs
                                .map((err) => `${err.loc?.join('.') || 'field'}: ${err.msg || 'invalid'}`)
                                .join('; ');
                        } else if (typeof data.detail === 'string') {
                            message = data.detail;
                        } else {
                            message = JSON.stringify(data.detail);
                        }
                    }

                    const enhancedError = new Error(message);
                    (enhancedError as EnhancedError).response = error.response;
                    throw enhancedError;
                } else if (error.request) {
                    // Request made but no response
                    throw new Error('Unable to connect to server. Please ensure the backend is running.');
                } else {
                    throw new Error(error.message);
                }
            }
        );
    }

    // ============================================================================
    // Project Management
    // ============================================================================

    async createProject(data: ProjectCreate): Promise<ProjectResponse> {
        const response = await this.client.post<ProjectResponse>('/projects', data);
        return response.data;
    }

    async createProjectFromImport(data: ProjectImportCreateRequest): Promise<ProjectResponse> {
        const response = await this.client.post<ProjectResponse>('/projects/import', data);
        return response.data;
    }

    async importIntoProject(projectId: string, data: ProjectImportRequest): Promise<ProjectResponse> {
        const response = await this.client.post<ProjectResponse>(`/projects/${projectId}/import`, data);
        return response.data;
    }

    async getResumeSuggestion(projectId: string): Promise<ResumeSuggestion> {
        const response = await this.client.get<ResumeSuggestion>(`/projects/${projectId}/resume-suggestion`);
        return response.data;
    }

    async generateStyleSheetFromChapters(
        projectId: string,
        payload: GenerateStyleSheetRequest
    ): Promise<GenerateStyleSheetResponse> {
        const response = await this.client.post<GenerateStyleSheetResponse>(
            `/projects/${projectId}/generate-style-sheet`,
            payload
        );
        return response.data;
    }

    async listProjects(): Promise<ProjectResponse[]> {
        const response = await this.client.get<ProjectResponse[]>('/projects');
        return response.data;
    }

    async getProject(projectId: string): Promise<ProjectResponse> {
        const response = await this.client.get<ProjectResponse>(`/projects/${projectId}`);
        return response.data;
    }

    async deleteProject(projectId: string): Promise<void> {
        await this.client.delete(`/projects/${projectId}`);
    }

    // ============================================================================
    // Workflow Execution
    // ============================================================================

    async executePhase(
        projectId: string,
        phase: number,
        request: PhaseExecuteRequest
    ): Promise<WorkflowStatus> {
        const response = await this.client.post<WorkflowStatus>(
            `/projects/${projectId}/phases/${phase}/execute`,
            request
        );
        return response.data;
    }

    async getPhaseStatus(
        projectId: string,
        phase: number,
        workflowId?: string
    ): Promise<WorkflowStatus> {
        const params = workflowId ? { workflow_id: workflowId } : {};
        const response = await this.client.get<WorkflowStatus>(
            `/projects/${projectId}/phases/${phase}/status`,
            { params }
        );
        return response.data;
    }

    // ============================================================================
    // Workflow Control
    // ============================================================================

    async cancelWorkflow(workflowId: string): Promise<CancelWorkflowResponse> {
        const response = await this.client.post<CancelWorkflowResponse>(
            `/workflows/${workflowId}/cancel`
        );
        return response.data;
    }

    async signalWorkflow(workflowId: string, signal: WorkflowSignal): Promise<void> {
        await this.client.post(`/workflows/${workflowId}/signal`, signal);
    }

    async getWorkflowHistory(workflowId: string): Promise<WorkflowHistory> {
        const response = await this.client.get<WorkflowHistory>(`/workflows/${workflowId}/history`);
        return response.data;
    }

    // ============================================================================
    // Human Input
    // ============================================================================

    async listPendingInputs(projectId: string): Promise<PendingInput[]> {
        const response = await this.client.get<PendingInput[]>(
            `/projects/${projectId}/pending-inputs`
        );
        return response.data;
    }

    async respondToWorkflow(workflowId: string, response: HumanInputResponse): Promise<void> {
        await this.client.post(`/workflows/${workflowId}/respond`, response);
    }

    // ============================================================================
    // Chapter Management
    // ============================================================================

    async listChapters(projectId: string): Promise<ChapterDetail[]> {
        const response = await this.client.get<ChapterDetail[]>(`/projects/${projectId}/chapters`);
        return response.data;
    }

    async getChapter(projectId: string, chapterNumber: number): Promise<ChapterDetail> {
        const response = await this.client.get<ChapterDetail>(
            `/projects/${projectId}/chapters/${chapterNumber}`
        );
        return response.data;
    }

    async updateChapter(
        projectId: string,
        chapterNumber: number,
        update: ChapterUpdate
    ): Promise<void> {
        await this.client.put(`/projects/${projectId}/chapters/${chapterNumber}`, update);
    }

    // ============================================================================
    // Artifact Management
    // ============================================================================

    async listArtifacts(projectId: string, phase?: string): Promise<ArtifactInfo[]> {
        const params = phase ? { phase } : {};
        const response = await this.client.get<ArtifactInfo[]>(
            `/projects/${projectId}/artifacts`,
            { params }
        );
        return response.data;
    }

    async getArtifact(projectId: string, artifactPath: string): Promise<ArtifactContent> {
        const response = await this.client.get<ArtifactContent>(
            `/projects/${projectId}/artifacts/${encodeURIComponent(artifactPath)}`
        );
        return response.data;
    }

    async updateArtifact(
        projectId: string,
        artifactPath: string,
        request: ArtifactUpdateRequest
    ): Promise<void> {
        await this.client.put(
            `/projects/${projectId}/artifacts/${encodeURIComponent(artifactPath)}`,
            request
        );
    }

    // ============================================================================
    // Progress & Stats
    // ============================================================================

    async getProjectProgress(projectId: string): Promise<ProjectProgress> {
        const response = await this.client.get<ProjectProgress>(`/projects/${projectId}/progress`);
        return response.data;
    }

    async getProjectTimeline(projectId: string): Promise<TimelineEvent[]> {
        const response = await this.client.get<TimelineEvent[]>(`/projects/${projectId}/timeline`);
        return response.data;
    }

    async getSystemStats(): Promise<SystemStats> {
        const response = await this.client.get<SystemStats>('/system/stats');
        return response.data;
    }

    // ============================================================================
    // Health Check
    // ============================================================================

    async healthCheck(): Promise<HealthResponse> {
        const response = await this.client.get<HealthResponse>('/health');
        return response.data;
    }

    // =========================================================================
    // Project Settings: LLM
    // =========================================================================

    async getProjectLlmSettings(projectId: string): Promise<ProjectLLMSettings> {
        const response = await this.client.get<ProjectLLMSettings>(
            `/projects/${projectId}/settings/llm`
        );
        return response.data;
    }

    async updateProjectLlmSettings(
        projectId: string,
        payload: ProjectLLMSettingsUpdate
    ): Promise<ProjectLLMSettings> {
        const response = await this.client.put<ProjectLLMSettings>(
            `/projects/${projectId}/settings/llm`,
            payload
        );
        return response.data;
    }
}

// Export singleton instance
export const apiClient = new NovelWeaverClient();

// Export class for testing
export { NovelWeaverClient };
