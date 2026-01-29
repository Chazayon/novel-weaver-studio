"""
Phase 3: Call Sheet Generation Workflow

Converts: Novel_Writing/Phase03_Call_Sheet_Generation.yaml
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
class Phase3Input:
    """Input for Phase 3 workflow."""
    project_id: str


@dataclass
class Phase3Output:
    """Output from Phase 3 workflow."""
    call_sheet: str
    updated_context_bundle: str
    status: str


@workflow.defn
class Phase3CallSheetWorkflow:
    """
    Phase 3: Call Sheet Generation
    
    Workflow steps:
    1. Load context bundle (with series outline from Phase 2)
    2. Generate call sheet (characters, worldbuilding, outline plan)
    3. Save call sheet
    4. Update context bundle with call sheet
    5. Save updated context bundle
    """
    
    @workflow.run
    async def run(self, input: Phase3Input) -> Phase3Output:
        """Execute Phase 3 workflow."""
        
        workflow.logger.info(f"Starting Phase 3 for project {input.project_id}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        # Step 2: Generate call sheet
        workflow.logger.info("Generating call sheet")
        
        call_sheet = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert writing assistant who helps authors prepare comprehensive pre-writing materials.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

Create a pre-writing **CALL SHEET** that lists everything the author needs to fully flesh out:
- Characters (including minor ones with names)
- Worldbuilding elements (locations, objects, institutions, lore)
- Outline plan guidance (what we still need to decide before outlining)

Requirements:
- Make it actionable (checklist-like)
- Keep descriptions concise (1–2 sentences for characters; 1 sentence for worldbuilding items)

Output in Markdown with clear headings:
# CALL SHEET
## Characters
## Worldbuilding
## Outline Plan""",
                0.4,
                6000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 3: Save call sheet
        workflow.logger.info("Saving call sheet")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase3_outputs/call_sheet.md", call_sheet],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Update context bundle
        workflow.logger.info("Updating context bundle with call sheet")
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a meticulous technical writer.
You update the Context Bundle by inserting/overwriting the CALL_SHEET section.""",
                f"""Take the existing Context Bundle and update it:

- If it already contains a section named "CALL_SHEET", replace that entire section.
- Otherwise, append a new "CALL_SHEET" section near the end.

Return the full updated Context Bundle in Markdown.

<context_bundle>
{context_bundle}
</context_bundle>

<call_sheet>
{call_sheet}
</call_sheet>""",
                0.1,
                9000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 5: Save updated context bundle
        workflow.logger.info("Saving updated context bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 3 complete!")
        
        return Phase3Output(
            call_sheet=call_sheet,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
