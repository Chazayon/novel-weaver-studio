"""
Phase 2: Brainstorming & Series Outline Workflow

Converts: Novel_Writing/Phase02_Brainstorming_and_Series_Outline.yaml
"""

from dataclasses import dataclass
from typing import Dict, Any

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        llm_generate_activity,
        load_artifact_activity,
        save_artifact_activity,
        human_input_activity,
    )


@dataclass
class Phase2Input:
    """Input for Phase 2 workflow."""
    project_id: str
    extra_notes: str | None = None
    auto_approve: bool = False  # For testing


@dataclass
class Phase2Output:
    """Output from Phase 2 workflow."""
    series_outline: str
    updated_context_bundle: str
    status: str


@workflow.defn
class Phase2BrainstormingWorkflow:
    """
    Phase 2: Brainstorming & Series Outline
    
    Workflow steps:
    1. Load Phase 1 context bundle
    2. Generate series outline
    3. Save series outline
    4. Human review (APPROVE or REVISE)
    5. If REVISE: collect notes, regenerate, repeat
    6. Update context bundle with approved outline
    7. Save updated context bundle
    """
    
    @workflow.run
    async def run(self, input: Phase2Input) -> Phase2Output:
        """Execute Phase 2 workflow."""
        
        workflow.logger.info(f"Starting Phase 2 for project {input.project_id}")
        
        # Step 1: Load context bundle from Phase 1
        workflow.logger.info("Loading Phase 1 context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        extra_notes = input.extra_notes or ""
        
        # Step 2: Generate series outline (with revision loop)
        workflow.logger.info("Generating series outline")
        
        series_outline = await self._generate_series_outline(
            context_bundle=context_bundle,
            extra_notes=extra_notes,
            auto_approve=input.auto_approve,
            project_id=input.project_id,
        )
        
        # Step 3: Save series outline
        workflow.logger.info("Saving series outline")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase2_outputs/series_outline.md", series_outline],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Update context bundle with series outline
        workflow.logger.info("Updating context bundle")
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a meticulous technical writer.
You update the Context Bundle by inserting/overwriting the SERIES_OUTLINE section.""",
                f"""Take the existing Context Bundle and update it:

- If it already contains a section named "SERIES_OUTLINE", replace that entire section.
- Otherwise, append a new "SERIES_OUTLINE" section near the end.

Return the full updated Context Bundle in Markdown.

<context_bundle>
{context_bundle}
</context_bundle>

<series_outline>
{series_outline}
</series_outline>""",
                0.1,
                9000,
                input.project_id,
                "phase2-context-bundle-update",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 5: Save updated context bundle (overwrite Phase 1 version)
        workflow.logger.info("Saving updated context bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 2 complete!")
        
        return Phase2Output(
            series_outline=series_outline,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
    
    async def _generate_series_outline(
        self,
        context_bundle: str,
        extra_notes: str,
        auto_approve: bool,
        project_id: str,
    ) -> str:
        """
        Generate series outline with approval/revision loop.
        
        Returns the final approved series outline.
        """
        # Initial generation
        series_outline = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert creative writer and series outliner.
You must stay consistent with the genre conventions inside the context bundle.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<extra_notes>
{extra_notes}
</extra_notes>

Create a comprehensive **Series Outline** that a writer can actually draft from.

Include:
- Core premise & hook
- Protagonist, antagonist, and key cast
- Main conflict + stakes
- Magic/setting rules (as relevant)
- Book/series arc (if series: book-by-book arcs; if standalone: arc + sequel hooks)
- Act/beat overview (high level, not chapter-by-chapter yet)

Output in clean Markdown with headings.""",
                0.7,
                8000,
                project_id,
                "phase2-series-outline",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Auto-approve mode for testing
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping human review")
            return series_outline
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting human review (attempt {revision_count + 1})")
            
            # Request approval or revision
            decision = await workflow.execute_activity(
                human_input_activity,
                args=[
                    f"""## Series Outline Review

{series_outline}

---

**Review the Series Outline above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes.""",
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            # Check decision (case-insensitive)
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Series outline approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Revision requested")
                
                # Collect revision notes
                revision_input = await workflow.execute_activity(
                    human_input_activity,
                    args=[
                        """## Revision Notes

Paste specific changes you want (bullets are best). The agent will revise the outline based on your notes.""",
                        ["revision_notes"],
                    ],
                    start_to_close_timeout=workflow.timedelta(hours=24),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                
                revision_notes = revision_input.get("revision_notes", "")
                
                # Revise the outline
                workflow.logger.info("Revising series outline")
                
                series_outline = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
                        """You revise outlines without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<current_series_outline>
{series_outline}
</current_series_outline>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the series outline to implement the revision notes.
Keep it internally consistent and genre-appropriate.

Output ONLY the revised Markdown outline.""",
                        0.5,
                        8000,
                        project_id,
                        "phase2-series-outline-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                
                # Loop back for another review
                continue
            
            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return series_outline
