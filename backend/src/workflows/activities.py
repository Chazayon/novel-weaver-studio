"""Temporal workflow activities for Novel Weaver Studio."""

import json
from typing import Dict, Any, List, Optional
from datetime import datetime

from temporalio import activity

from ..llm import get_provider_manager
from ..vault import novel_vault, storage_manager
from ..config import settings


@activity.defn
async def llm_generate_activity(
    provider: str,
    model: str,
    role: str,
    task: str,
    temperature: float = 0.7,
    max_tokens: int = 4000,
    project_id: Optional[str] = None,
    profile: Optional[str] = None,
) -> str:
    """
    Execute LLM generation from workflow.
    
    This activity maps to YAML workflow nodes of type: agent
    
    Args:
        provider: LLM provider ("openai", "anthropic", "google")
        model: Model name
        role: System/role prompt
        task: User task/prompt
        temperature: Sampling temperature
        max_tokens: Max tokens to generate
    Returns:
        Generated text
    """
    def _resolve_project_profile(pid: str, key: str) -> Dict[str, Any]:
        manifest = storage_manager.get_project_manifest(pid)
        settings_root = manifest.get("settings", {})
        if not isinstance(settings_root, dict):
            return {}

        llm_settings = settings_root.get("llm", {})
        if not isinstance(llm_settings, dict):
            return {}

        merged: Dict[str, Any] = {}

        default_profile = llm_settings.get("default")
        if isinstance(default_profile, dict):
            merged.update(default_profile)

        profiles = llm_settings.get("profiles", {})
        if isinstance(profiles, dict):
            override = profiles.get(key)
            if isinstance(override, dict):
                merged.update(override)

        return merged

    # Resolve provider/model defaults (explicit args win; "default" means: use project profile if set, else env defaults)
    effective_provider = provider
    effective_model = model
    effective_temperature = temperature
    effective_max_tokens = max_tokens

    project_overrides: Dict[str, Any] = {}
    if project_id and profile:
        try:
            project_overrides = _resolve_project_profile(project_id, profile)
        except Exception as e:
            activity.logger.warning(f"Failed to resolve project LLM profile '{profile}': {e}")
            project_overrides = {}

    if not effective_provider or effective_provider == "default":
        effective_provider = project_overrides.get("provider") or settings.default_llm_provider

    if not effective_model or effective_model == "default":
        effective_model = project_overrides.get("model") or settings.default_llm_model

    if project_overrides.get("temperature") is not None:
        effective_temperature = float(project_overrides["temperature"])

    project_max_tokens = project_overrides.get("maxTokens")
    if project_max_tokens is None:
        project_max_tokens = project_overrides.get("max_tokens")
    if project_max_tokens is not None:
        effective_max_tokens = int(project_max_tokens)

    profile_suffix = f" (profile={profile})" if profile else ""
    activity.logger.info(
        f"Generating with {effective_provider}/{effective_model}{profile_suffix} "
        f"temp={effective_temperature} max_tokens={effective_max_tokens}"
    )
    
    manager = get_provider_manager()
    
    result = await manager.generate(
        provider=effective_provider,
        model=effective_model,
        role=role,
        task=task,
        temperature=effective_temperature,
        max_tokens=effective_max_tokens,
    )
    
    activity.logger.info(f"Generated {len(result)} characters")
    return result


@activity.defn
async def python_code_activity(
    code: str,
    variables: Dict[str, Any],
    project_id: str,
) -> Dict[str, Any]:
    """
    Execute Python code blocks from YAML workflows.
    
    This activity maps to YAML workflow nodes of type: python
    The code can call vault functions (novel_write_text, novel_read_text, etc.)
    
    Args:
        code: Python code to execute
        variables: Workflow variables to make available
        project_id: Current project ID
        
    Returns:
        Dict with execution results and any returned values
    """
    activity.logger.info(f"Executing Python code for project {project_id}")
    
    # Prepare execution environment with vault functions
    exec_globals = {
        "novel_write_text": novel_vault.novel_write_text,
        "novel_read_text": novel_vault.novel_read_text,
        "novel_get_previous_chapter_final": novel_vault.novel_get_previous_chapter_final,
        "novel_update_manifest": novel_vault.novel_update_manifest,
        "novel_parse_outline": novel_vault.novel_parse_outline,
        "project_id": project_id,
        **variables,  # Add workflow variables
    }
    
    exec_locals = {}
    
    # Execute the code
    try:
        exec(code, exec_globals, exec_locals)
        activity.logger.info("Python code executed successfully")
        return {"success": True, "locals": exec_locals}
    except Exception as e:
        activity.logger.error(f"Python code execution failed: {e}")
        raise


@activity.defn
async def web_search_activity(
    query: str,
    max_results: int = 10,
) -> str:
    """
    Perform web search to gather current information.
    
    Uses Perplexity or similar search-enabled LLM to research topics online.
    This is useful for genre research, trope analysis, etc.
    
    Args:
        query: Search query
        max_results: Maximum number of results to synthesize
        
    Returns:
        Synthesized search results as markdown text
    """
    activity.logger.info(f"Performing web search: {query[:100]}")
    
    manager = get_provider_manager()
    
    # Use Perplexity for web-enhanced search
    # Falls back to regular LLM if Perplexity not available
    try:
        result = await manager.generate(
            provider="openrouter",
            model="perplexity/sonar-pro",  # Search-enabled model
            role="You are a research assistant with access to web search. Provide comprehensive, well-researched answers with citations.",
            task=f"""Research the following query and provide a comprehensive answer based on current web sources:

{query}

Provide:
1. A comprehensive summary of key findings
2. Specific details, examples, and data points
3. Citations/sources where relevant

Format your response in clean Markdown.""",
            temperature=0.3,
            max_tokens=4000,
        )
        activity.logger.info(f"Web search completed: {len(result)} characters")
        return result
    except Exception as e:
        activity.logger.warning(f"Perplexity search failed, falling back to regular LLM: {e}")
        # Fallback to regular LLM without web search
        result = await manager.generate(
            provider=settings.default_llm_provider,
            model=settings.default_llm_model,
            role="You are an expert literary analyst with deep knowledge of genre conventions.",
            task=query,
            temperature=0.3,
            max_tokens=4000,
        )
        return result


@activity.defn
async def human_input_activity(
    description: str,
    expected_outputs: list[str] | None = None,
) -> Dict[str, Any]:
    """
    Pause workflow for human input.
    
    This activity maps to YAML workflow nodes of type: human
    
    NOTE: This activity returns a placeholder that signals the workflow needs input.
    The workflow should use Temporal's signal mechanism to actually wait for input.
    The frontend must call the /workflows/{workflow_id}/respond endpoint with
    the user's input to resume the workflow.
    
    Args:
        description: Instructions for the user
        expected_outputs: Expected output variable names
        
    Returns:
        Dict indicating input is needed (placeholder for workflow signal handling)
    """
    activity.logger.info(f"Requesting human input: {description[:100]}")
    
    # Return a structured response indicating what input is needed
    # The workflow layer will handle waiting for the actual signal
    return {
        "status": "awaiting_input",
        "description": description,
        "expected_outputs": expected_outputs or [],
        "timestamp": datetime.utcnow().isoformat(),
    }


@activity.defn  
async def save_artifact_activity(
    project_id: str,
    path: str,
    content: str,
) -> Dict[str, Any]:
    """
    Save artifact to project storage.
    
    Convenience activity for saving files without using python_code_activity.
    
    Args:
        project_id: Project ID
        path: Relative path within project
        content: Content to save
        
    Returns:
        Result from novel_write_text
    """
    activity.logger.info(f"Saving artifact: {path}")
    return novel_vault.novel_write_text(project_id, path, content)


@activity.defn
async def load_artifact_activity(
    project_id: str,
    path: str,
) -> str:
    """
    Load artifact from project storage.
    
    Convenience activity for loading files without using python_code_activity.
    
    Args:
        project_id: Project ID
        path: Relative path within project
        
    Returns:
        Artifact content
    """
    activity.logger.info(f"Loading artifact: {path}")
    result = novel_vault.novel_read_text(project_id, path)
    return result["text"]


@activity.defn
async def parse_outline_activity(
    project_id: str,
) -> int:
    """
    Parse outline and extract chapters.
    
    This activity parses the outline.md file and updates the project manifest
    with a structured list of chapters.
    
    Args:
        project_id: Project ID
        
    Returns:
        Number of chapters parsed
    """
    activity.logger.info(f"Parsing outline for project {project_id}")
    result = novel_vault.novel_parse_outline(project_id)
    chapters_count = result.get("total_chapters", 0)
    activity.logger.info(f"Parsed {chapters_count} chapters")
    return chapters_count


@activity.defn
async def get_previous_chapter_activity(
    project_id: str,
    chapter_number: int,
) -> str:
    """
    Get the final text of the previous chapter.
    
    Args:
        project_id: Project ID
        chapter_number: Current chapter number
        
    Returns:
        Previous chapter text or "NONE"
    """
    activity.logger.info(f"Loading previous chapter for chapter {chapter_number}")
    result = novel_vault.novel_get_previous_chapter_final(project_id, chapter_number)
    return result.get("text", "NONE")


@activity.defn
async def update_manifest_activity(
    project_id: str,
    patch: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Update project manifest with patch data.
    
    Args:
        project_id: Project ID
        patch: Patch data to merge into manifest
        
    Returns:
        Updated manifest
    """
    activity.logger.info(f"Updating manifest for project {project_id}")
    return novel_vault.novel_update_manifest(project_id, patch)
