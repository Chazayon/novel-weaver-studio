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
    run_risk_audit: bool = False  # Optional risk audit


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
    3. Human review (APPROVE or REVISE)
    4. If REVISE: collect notes, regenerate, repeat
    5. Extract series_constraints.json from approved outline
    6. Optional: Run risk audit (genre mismatches, missing stakes, etc.)
    7. Save series outline, constraints JSON, and optional audit
    8. Update context bundle with approved outline
    9. Save updated context bundle
    """
    
    def __init__(self) -> None:
        self._current_status = "starting"
        self._pending_content: str | None = None
        self._pending_description: str | None = None
        self._pending_expected_outputs: list[str] | None = None
        self._human_input: Dict[str, str] | None = None
    
    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status
    
    @workflow.query
    def get_pending_content(self) -> str | None:
        return self._pending_content
    
    @workflow.query
    def get_pending_description(self) -> str | None:
        return self._pending_description
    
    @workflow.query
    def get_pending_expected_outputs(self) -> list[str] | None:
        return self._pending_expected_outputs

    @workflow.signal
    async def human_input_received(self, inputs: Dict[str, str]) -> None:
        """Receive human input from the API and resume the workflow."""
        self._human_input = inputs
        # Prevent the UI from re-opening the same pending review while we process the response
        self._current_status = "processing_review"
    
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
        self._current_status = "generating_outline"
        
        series_outline = await self._generate_series_outline(
            context_bundle=context_bundle,
            extra_notes=extra_notes,
            auto_approve=input.auto_approve,
            project_id=input.project_id,
        )
        
        # Step 3: Extract series_constraints.json
        workflow.logger.info("Extracting series_constraints.json")
        self._current_status = "extracting_constraints"
        
        constraints_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<series_outline>
{series_outline}
</series_outline>

Extract structured constraints and metadata from the series outline and context bundle.

Output valid JSON with this structure:
{{
  "series_type": "standalone/trilogy/long_series",
  "pov_plan": "single/rotating/multiple",
  "target_length": "number of books or chapters",
  "must_include": ["constraint1", "constraint2"],
  "must_avoid": ["constraint1", "constraint2"],
  "rating": "G/PG/PG-13/R/etc",
  "heat_level": "none/mild/moderate/explicit",
  "themes": ["theme1", "theme2"],
  "genre_tropes": ["trope1", "trope2"]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                3000,
                input.project_id,
                "phase2-constraints-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 4: Optional risk audit
        risk_audit = ""
        if input.run_risk_audit:
            workflow.logger.info("Running series outline risk audit")
            self._current_status = "running_risk_audit"
            
            risk_audit = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "default",
                    "default",
                    """You are a story development critic who identifies potential issues in series outlines.""",
                    f"""<context_bundle>
{context_bundle}
</context_bundle>

<series_outline>
{series_outline}
</series_outline>

Analyze this series outline for potential issues:

1. **Genre Expectation Mismatches**: Does it deliver on genre promises?
2. **Missing Stakes**: Are the stakes clear and escalating?
3. **Unclear Antagonist Pressure**: Is the antagonist force well-defined and compelling?
4. **Hook Quality**: Does it grab attention early?
5. **Character Agency**: Do characters drive the plot or just react?
6. **Pacing Issues**: Does the structure feel balanced?

For each category, provide:
- **Status**: Good | Needs Work | Missing
- **Brief Note**: 1-2 sentences

Output as Markdown with clear headings.""",
                    0.3,
                    4000,
                    input.project_id,
                    "phase2-risk-audit",
                ],
                start_to_close_timeout=workflow.timedelta(minutes=3),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        
        # Step 5: Save series outline, constraints, and optional audit
        workflow.logger.info("Saving series outline and artifacts")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase2_outputs/series_outline.md", series_outline],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase2_outputs/series_constraints.json", constraints_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        if risk_audit:
            await workflow.execute_activity(
                save_artifact_activity,
                args=[input.project_id, "phase2_outputs/series_outline_audit.md", risk_audit],
                start_to_close_timeout=workflow.timedelta(seconds=30),
            )
        
        # Step 6: Update context bundle with series outline
        workflow.logger.info("Updating context bundle")
        self._current_status = "updating_context_bundle"
        
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
        self._current_status = "completed"
        
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
            self._current_status = "waiting_for_review"
            
            # Set pending review state for frontend
            self._pending_content = f"""## Series Outline Review

{series_outline}

---

**Review the series outline above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated series outline"
            self._pending_expected_outputs = ["decision"]
            self._human_input = None
            
            # Request approval or revision
            await workflow.execute_activity(
                human_input_activity,
                args=[
                    self._pending_content,
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

            # Wait for signal from API
            await workflow.wait_condition(
                lambda: self._human_input is not None,
                timeout=workflow.timedelta(hours=24),
            )

            decision = self._human_input or {}
            
            # Clear pending state
            self._pending_content = None
            self._pending_description = None
            self._pending_expected_outputs = None
            self._current_status = "processing_review"
            
            # Check decision (case-insensitive)
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Series outline approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Revision requested")
                
                # Collect revision notes
                self._current_status = "waiting_for_review"
                self._pending_content = """## Revision Notes

Describe what needs to change in the series outline (bullets are best). The agent will revise based on your notes."""
                self._pending_description = "Provide revision notes"
                self._pending_expected_outputs = ["revision_notes"]
                self._human_input = None
                
                await workflow.execute_activity(
                    human_input_activity,
                    args=[
                        self._pending_content,
                        ["revision_notes"],
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=2),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )

                await workflow.wait_condition(
                    lambda: self._human_input is not None,
                    timeout=workflow.timedelta(hours=24),
                )

                revision_input = self._human_input or {}
                
                self._pending_content = None
                self._pending_description = None
                self._pending_expected_outputs = None
                
                revision_notes = revision_input.get("revision_notes", "")
                
                # Revise the series outline
                workflow.logger.info("Revising series outline")
                self._current_status = "revising_outline"
                
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
