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
        human_input_activity,
    )


@dataclass
class Phase3Input:
    """Input for Phase 3 workflow."""
    project_id: str
    auto_approve: bool = False  # For testing


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
    3. Human review (APPROVE or REVISE)
    4. If REVISE: collect notes, regenerate, repeat
    5. Extract structured JSON from approved call sheet
    6. Save call sheet markdown and JSON
    7. Update context bundle with call sheet
    8. Save updated context bundle
    """
    
    def __init__(self) -> None:
        self._current_status = "starting"
        self._pending_content: str | None = None
        self._pending_description: str | None = None
        self._pending_expected_outputs: list[str] | None = None
        self._human_input: dict[str, str] | None = None
    
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
    async def human_input_received(self, inputs: dict[str, str]) -> None:
        """Receive human input from the API and resume the workflow."""
        self._human_input = inputs
        # Prevent the UI from re-opening the same pending review while we process the response
        self._current_status = "processing_review"
    
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
        
        # Step 2: Generate call sheet (with revision loop)
        workflow.logger.info("Generating call sheet")
        self._current_status = "generating_call_sheet"
        
        call_sheet = await self._generate_call_sheet(
            context_bundle=context_bundle,
            auto_approve=input.auto_approve,
            project_id=input.project_id,
        )
        
        # Step 3: Extract structured JSON from call sheet
        workflow.logger.info("Extracting structured call_sheet.json")
        self._current_status = "extracting_json"
        
        call_sheet_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<call_sheet>
{call_sheet}
</call_sheet>

Extract a structured JSON representation of this call sheet.

Output valid JSON with this structure:
{{
  "characters": [
    {{"name": "Character Name", "role": "brief role", "description": "1-2 sentences"}}
  ],
  "worldbuilding": [
    {{"name": "Element Name", "type": "location/object/institution/lore", "description": "1 sentence"}}
  ],
  "outline_plan": [
    {{"item": "Decision or question", "priority": "high/medium/low"}}
  ]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                4000,
                input.project_id,
                "phase3-call-sheet-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 4: Save call sheet (markdown and JSON)
        workflow.logger.info("Saving call sheet")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase3_outputs/call_sheet.md", call_sheet],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase3_outputs/call_sheet.json", call_sheet_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 5: Update context bundle
        workflow.logger.info("Updating context bundle with call sheet")
        self._current_status = "updating_context_bundle"
        
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
                input.project_id,
                "phase3-context-bundle-update",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 6: Save updated context bundle
        workflow.logger.info("Saving updated context bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 3 complete!")
        self._current_status = "completed"
        
        return Phase3Output(
            call_sheet=call_sheet,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
    
    async def _generate_call_sheet(
        self,
        context_bundle: str,
        auto_approve: bool,
        project_id: str,
    ) -> str:
        """
        Generate call sheet with approval/revision loop.
        
        Returns the final approved call sheet.
        """
        # Initial generation
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
- Characters (including minor ones with names, ensuring groups have 3-5 named members)
- Worldbuilding elements (locations, objects, institutions, lore)
- Outline plan guidance (what we still need to decide before outlining)

Requirements:
- Make it actionable (checklist-like)
- Keep descriptions concise (1–2 sentences for characters; 1 sentence for worldbuilding items)
- Ensure every major plot thread from the series outline has supporting items
- Include at least one antagonist force, clear stakes, and core settings

Output in Markdown with clear headings:
# CALL SHEET
## Characters
## Worldbuilding
## Outline Plan""",
                0.4,
                6000,
                project_id,
                "phase3-call-sheet",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Auto-approve mode for testing
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping human review")
            return call_sheet
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting human review (attempt {revision_count + 1})")
            self._current_status = "waiting_for_review"
            
            # Set pending review state for frontend
            self._pending_content = f"""## Call Sheet Review

{call_sheet}

---

**Review the call sheet above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated call sheet"
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
                workflow.logger.info("Call sheet approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Revision requested")
                
                # Collect revision notes
                self._current_status = "waiting_for_review"
                self._pending_content = """## Revision Notes

Describe what needs to change in the call sheet (bullets are best). The agent will revise based on your notes."""
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
                
                # Revise the call sheet
                workflow.logger.info("Revising call sheet")
                self._current_status = "revising_call_sheet"
                
                call_sheet = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
                        """You revise call sheets without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<current_call_sheet>
{call_sheet}
</current_call_sheet>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the call sheet to implement the revision notes.
Keep it internally consistent and genre-appropriate.
Maintain the same Markdown structure.

Output ONLY the revised Markdown call sheet.""",
                        0.5,
                        6000,
                        project_id,
                        "phase3-call-sheet-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                
                # Loop back for another review
                continue
            
            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return call_sheet
