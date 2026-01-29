"""
Phase 7: Final Manuscript Compilation Workflow

Converts: Novel_Writing/Phase07_Final_Manuscript_Compilation.yaml
"""

from dataclasses import dataclass

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        llm_generate_activity,
        load_artifact_activity,
        save_artifact_activity,
    )


@dataclass
class Phase7Input:
    """Input for Phase 7 workflow."""
    project_id: str
    author_name: str | None = None


@dataclass
class Phase7Output:
    """Output from Phase 7 workflow."""
    final_manuscript: str
    status: str


@workflow.defn
class Phase7FinalCompilationWorkflow:
    """
    Phase 7: Final Manuscript Compilation
    
    Workflow steps:
    1. Load context bundle (with all chapter data)
    2. Compile final manuscript with title page, TOC, chapters
    3. Save final manuscript
    """
    
    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7Output:
        """Execute Phase 7 workflow."""
        
        workflow.logger.info(f"Starting Phase 7 for project {input.project_id}")
        
        author_name = input.author_name or "Unknown Author"
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        # Step 2: Compile manuscript
        workflow.logger.info("Compiling final manuscript")
        
        final_manuscript = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are a manuscript compiler who creates clean, formatted final manuscripts.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

Compile a final, publication-ready manuscript in Markdown.

Requirements:
1) Title Page (title, "by", author)
2) Copyright Page (standard fiction disclaimer)
3) Table of Contents (chapters + titles)
4) Manuscript body:
   - Chapters in correct order
   - Consistent formatting
   - Use `---` between chapters as a page-break marker

Source of truth:
- Use the book title and genre from the META section of the Context Bundle (if present).
- Use chapters from the DRAFTING_PROGRESS section.
- If a chapter is missing, note it in a short "Missing Chapters" section before the manuscript body.

Author name: {author_name}

Output ONLY the final manuscript Markdown.""",
                0.2,
                16000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 3: Save final manuscript
        workflow.logger.info("Saving final manuscript")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "exports/FINAL_MANUSCRIPT.md", final_manuscript],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 7 complete! Novel compilation finished!")
        
        return Phase7Output(
            final_manuscript=final_manuscript,
            status="completed",
        )
