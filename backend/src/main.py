"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import settings

app = FastAPI(
    title="Novel Weaver Studio API",
    description="Temporal-based backend for AI-assisted novel writing",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(router)


@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    # Ensure projects root directory exists
    settings.projects_root_path.mkdir(parents=True, exist_ok=True)
    
    # Validate that at least one LLM provider is configured
    available_providers = settings.validate_llm_keys()
    if not available_providers:
        print("WARNING: No LLM API keys configured. Workflow execution will fail.")
        print("Please set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY")
    else:
        print(f"Available LLM providers: {', '.join(available_providers)}")


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
