# Novel Weaver Studio - API Documentation

## Base URL
```
http://localhost:8000/api
```

---

## Project Management

### Create Project
```http
POST /projects
```

**Request Body**:
```json
{
  "title": "My Novel",
  "author": "Author Name",
  "genre": "Fantasy",
  "seriesLength": 20
}
```

**Response**: `ProjectResponse`

---

### List Projects
```http
GET /projects
```

**Response**: `ProjectResponse[]`

---

### Get Project
```http
GET /projects/{project_id}
```

**Response**: `ProjectResponse`

---

### Delete Project
```http
DELETE /projects/{project_id}
```

---

## Workflow Execution

### Execute Phase
```http
POST /projects/{project_id}/phases/{phase}/execute
```

**Request Body**:
```json
{
  "inputs": {
    "genre": "Fantasy",
    "book_title": "The Adventure",
    "initial_ideas": "A hero's journey...",
    // Phase-specific inputs
  }
}
```

**Phase-Specific Inputs**:
- **Phase 1**: `genre`, `book_title`, `initial_ideas`, `writing_samples`, `outline_template`, `prohibited_words`
- **Phase 2**: `extra_notes`, `auto_approve`
- **Phase 3-4**: No required inputs
- **Phase 5**: `outline_template`, `auto_approve`
- **Phase 6**: **Required**: `chapter_number`, `chapter_title`; Optional: `chapter_notes`, `auto_approve_improvements`, `auto_approve_final`
- **Phase 7**: No required inputs

**Response**: `WorkflowStatus`

---

### Get Phase Status
```http
GET /projects/{project_id}/phases/{phase}/status?workflow_id={id}
```

**Response**: `WorkflowStatus`

---

## Workflow Control

### Cancel Workflow
```http
POST /workflows/{workflow_id}/cancel
```

**Response**:
```json
{
  "success": true,
  "workflow_id": "...",
  "status": "cancelled"
}
```

---

### Signal Workflow
```http
POST /workflows/{workflow_id}/signal
```

**Request Body**:
```json
{
  "signal_name": "human_input_received",
  "args": {
    "decision": "APPROVE"
  }
}
```

---

### Get Workflow History
```http
GET /workflows/{workflow_id}/history
```

**Response**:
```json
{
  "workflow_id": "...",
  "status": "RUNNING",
  "start_time": "2026-01-28T...",
  "close_time": null,
  "execution_time": 120
}
```

---

## Human Input

### List Pending Inputs
```http
GET /projects/{project_id}/pending-inputs
```

**Response**: `PendingInput[]`

---

### Respond to Workflow
```http
POST /workflows/{workflow_id}/respond
```

**Request Body**:
```json
{
  "inputs": {
    "decision": "APPROVE",
    "revision_notes": "Please add more detail..."
  }
}
```

---

## Chapter Management

### List Chapters
```http
GET /projects/{project_id}/chapters
```

**Response**: `ChapterDetail[]`

**Example Response**:
```json
[
  {
    "number": 1,
    "title": "The Beginning",
    "status": "completed",
    "wordCount": 3500,
    "lastUpdated": "2026-01-28T...",
    "hasSceneBrief": true,
    "hasFirstDraft": true,
    "hasFinal": true
  }
]
```

---

### Get Chapter
```http
GET /projects/{project_id}/chapters/{chapter_number}
```

**Response**: `ChapterDetail`

---

### Update Chapter
```http
PUT /projects/{project_id}/chapters/{chapter_number}
```

**Request Body**:
```json
{
  "title": "New Chapter Title",
  "notes": "Additional notes..."
}
```

---

## Artifacts

### List Artifacts
```http
GET /projects/{project_id}/artifacts?phase={phase}
```

**Response**: `ArtifactInfo[]`

---

### Get Artifact
```http
GET /projects/{project_id}/artifacts/{artifact_path}
```

**Response**:
```json
{
  "content": "...",
  "path": "phase1_outputs/genre_analysis.md"
}
```

---

### Update Artifact
```http
PUT /projects/{project_id}/artifacts/{artifact_path}
```

**Request Body**:
```json
{
  "content": "Updated content..."
}
```

---

## Progress & Stats

### Get Project Progress
```http
GET /projects/{project_id}/progress
```

**Response**: `ProjectProgress`

**Example**:
```json
{
  "projectId": "...",
  "overallProgress": 65.5,
  "phases": [
    {
      "phase": 1,
      "status": "completed",
      "progress": 100.0,
      "startedAt": "...",
      "completedAt": "..."
    }
  ],
  "chaptersCompleted": 5,
  "totalChapters": 10
}
```

---

### Get Project Timeline
```http
GET /projects/{project_id}/timeline
```

**Response**: `TimelineEvent[]`

---

### Get System Stats
```http
GET /system/stats
```

**Response**: `SystemStats`

**Example**:
```json
{
  "totalProjects": 5,
  "activeWorkflows": 2,
  "totalStorageMb": 125.5,
  "uptimeSeconds": 3600
}
```

---

## Health Check

### Health
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T..."
}
```

---

## Data Models

### ProjectResponse
```typescript
{
  id: string
  title: string
  author: string
  genre: string
  seriesLength: number
  createdAt: string
  updatedAt: string
  currentPhase: number
  progress: number  // 0-100
}
```

### WorkflowStatus
```typescript
{
  workflowId: string
  phase: number
  status: "not-started" | "in-progress" | "completed" | "failed"
  progress: number  // 0-100
  currentStep?: string
  outputs: Record<string, any>
  error?: string
}
```

### ChapterDetail
```typescript
{
  number: number
  title: string
  status: "not_started" | "in_progress" | "completed"
  wordCount?: number
  lastUpdated?: string
  hasSceneBrief: boolean
  hasFirstDraft: boolean
  hasFinal: boolean
}
```

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `500` - Internal Server Error

**Error Response Format**:
```json
{
  "detail": "Error message here"
}
```

---

## Workflow Execution Flow

### Phase 1-4, 7 (No Human Input)
1. `POST /projects/{id}/phases/{phase}/execute`
2. Poll `GET /projects/{id}/phases/{phase}/status`
3. Wait for `status: "completed"`

### Phase 2, 5 (With Approval Loop)
1. `POST /projects/{id}/phases/{phase}/execute`
2. Poll `GET /projects/{id}/pending-inputs`
3. When input needed: `POST /workflows/{workflow_id}/respond`
4. Repeat steps 2-3 until complete

### Phase 6 (Chapter Writing)
1. Ensure Phase 5 completed (outline parsed)
2. `GET /projects/{id}/chapters` - Get chapter list
3. For each chapter:
   - `POST /projects/{id}/phases/6/execute` with `chapter_number` and `chapter_title`
   - Handle improvement decision (APPLY/CUSTOM/SKIP)
   - Handle final review (APPROVE/REVISE)
4. `GET /projects/{id}/chapters/{number}` - Check completion

---

## Testing with cURL

### Create a Project
```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Novel",
    "author": "Test Author",
    "genre": "Fantasy",
    "seriesLength": 10
  }'
```

### Execute Phase 1
```bash
curl -X POST http://localhost:8000/api/projects/{project_id}/phases/1/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "genre": "Fantasy",
      "book_title": "The Adventure",
      "initial_ideas": "A hero embarks on a quest..."
    }
  }'
```

### Get Progress
```bash
curl http://localhost:8000/api/projects/{project_id}/progress
```

---

## Notes

- All timestamps are in ISO 8601 format
- Field names use camelCase in JSON responses (aliased from snake_case)
- Workflow IDs are returned when executing phases
- Human input handling uses Temporal signals for robust state management
