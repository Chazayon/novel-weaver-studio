# Novel Weaver Studio - Backend

Temporal-based backend for AI-assisted novel writing automation.

## Features

- **7-Phase Workflow Orchestration**: Temporal workflows for each writing phase
- **Multi-LLM Support**: OpenAI, Anthropic (Claude), Google (Gemini)
- **File-Based Storage**: Project artifacts stored in `~/.novel-weaver-studio`
- **REST API**: FastAPI endpoints for frontend integration
- **Vault Functions**: Novel-specific storage operations matching YAML workflows

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -e .
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

**Required** (at least one):
- `OPENAI_API_KEY` - For GPT models
- `ANTHROPIC_API_KEY` - For Claude models
- `GOOGLE_API_KEY` - For Gemini models

### 3. Start Temporal Server (Development)

**Option A: Using Docker Compose** (Recommended)
```bash
# From project root
docker-compose up -d
```

**Option B: Temporal CLI**
```bash
temporal server start-dev
```

### 4. Start the Backend API

```bash
cd backend
python -m src.main
```

Server will start at `http://localhost:8000`
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

### 5. Start Temporal Worker

```bash
# In a NEW terminal
cd backend  
python3 -m src.workflows.worker
```

Expected output:
```
Worker starting on task queue: novel-weaver-workflow
Registered workflows: Phase1InitialSetupWorkflow
```

### 6. Test Phase 1 Workflow

```bash
# In another terminal
cd backend
python3 test_phase1.py
```

This will create a test project, execute Phase 1, monitor progress, and verify artifacts.

**Manual Testing:**
```bash
# Create project
PROJECT_ID=$(curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Novel","author":"Me","genre":"Fantasy","seriesLength":20}' \
  | jq -r '.id')

# Execute Phase 1  
curl -X POST http://localhost:8000/api/projects/$PROJECT_ID/phases/1/execute \
  -H "Content-Type: application/json" \
  -d '{"phase":1,"inputs":{"genre":"Fantasy","book_title":"Test","initial_ideas":"A story","writing_samples":"SKIP","outline_template":"SKIP","prohibited_words":"SKIP"}}'
```

## Project Structure

```
backend/
├── src/
│   ├── main.py                 # FastAPI application
│   ├── config.py               # Configuration management
│   ├── models.py               # Pydantic models
│   ├── api/
│   │   └── routes.py          # REST API endpoints
│   ├── vault/
│   │   ├── novel_vault.py     # Core vault functions (matches YAML)
│   │   └── storage_manager.py # Project management
│   ├── llm/                    # LLM provider integration (TODO)
│   │   ├── provider_manager.py
│   │   └── providers/
│   │       ├── openai_provider.py
│   │       ├── anthropic_provider.py
│   │       └── google_provider.py
│   └── workflows/              # Temporal workflows (TODO)
│       ├── phase1_initial_setup.py
│       ├── phase2_brainstorming.py
│       ├── ...
│       ├── activities.py
│       └── worker.py
├── pyproject.toml
└── .env
```

## API Endpoints

### Projects
- `POST /api/projects` - Create new project
- `GET /api/projects` - List all projects
- `GET /api/projects/{id}` - Get project details
- `DELETE /api/projects/{id}` - Delete project

### Workflows
- `POST /api/projects/{id}/phases/{phase}/execute` - Execute phase
- `GET /api/projects/{id}/phases/{phase}/status` - Get phase status

### Artifacts
- `GET /api/projects/{id}/artifacts` - List artifacts
- `GET /api/projects/{id}/artifacts/{path}` - Get artifact content
- `PUT /api/projects/{id}/artifacts/{path}` - Update artifact

## Vault Functions

The backend implements these functions (matching your YAML workflows):

```python
from src.vault import (
    novel_write_text,
    novel_read_text,
    novel_get_previous_chapter_final,
    novel_update_manifest,
    novel_parse_outline,
)
```

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black src/
ruff check src/
```

## Next Steps

1. **Implement LLM Providers** (`src/llm/`)
2. **Implement Temporal Workflows** (`src/workflows/`)
3. **Connect Frontend** (update API client in frontend)
4. **Add Tests** (unit tests for vault, workflows)

## Storage Structure

Projects are stored at `~/.novel-weaver-studio/projects/{project_id}/`:

```
{project_id}/
├── project.json                # Metadata
├── phase1_outputs/
│   ├── genre_tropes.md
│   ├── style_sheet.md
│   └── context_bundle.md
├── phase2_outputs/
│   └── series_outline.md
├── phase3_outputs/
│   └── call_sheet.md
├── phase4_outputs/
│   ├── characters.md
│   └── worldbuilding.md
├── phase5_outputs/
│   └── outline.md
├── phase6_outputs/
│   ├── chapter_1/
│   │   ├── scene_brief.md
│   │   ├── first_draft.md
│   │   └── final.md
│   └── ...
└── exports/
    └── FINAL_MANUSCRIPT.md
```

## Environment Variables

See `.env.example` for all available configuration options.
