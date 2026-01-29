"""
Phase 5: Chapter Outline Creation Workflow

Converts: Novel_Writing/Phase05_Chapter_Outline_Creation.yaml
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
        parse_outline_activity,
    )


@dataclass
class Phase5Input:
    """Input for Phase 5 workflow."""
    project_id: str
    outline_template: str | None = "USE_BUNDLE"
    auto_approve: bool = False  # For testing


@dataclass
class Phase5Output:
    """Output from Phase 5 workflow."""
    outline: str
    updated_context_bundle: str
    chapters_parsed: int
    status: str


@workflow.defn
class Phase5ChapterOutlineWorkflow:
    """
    Phase 5: Chapter Outline Creation
    
    Workflow steps:
    1. Load context bundle
    2. Generate chapter-by-chapter outline
    3. Save outline
    4. Human review (APPROVE or REVISE)
    5. If REVISE: collect notes, regenerate, repeat
    6. Update context bundle with approved outline
    7. Save updated context bundle
    8. Parse outline to extract chapters
    """
    
    @workflow.run
    async def run(self, input: Phase5Input) -> Phase5Output:
        """Execute Phase 5 workflow."""
        
        workflow.logger.info(f"Starting Phase 5 for project {input.project_id}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        outline_template = input.outline_template or "USE_BUNDLE"
        
        # Step 2: Generate chapter outline (with revision loop)
        workflow.logger.info("Generating chapter outline")
        
        outline = await self._generate_chapter_outline(
            context_bundle=context_bundle,
            outline_template=outline_template,
            auto_approve=input.auto_approve,
            project_id=input.project_id,
        )
        
        # Step 3: Save outline
        workflow.logger.info("Saving chapter outline")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase5_outputs/outline.md", outline],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Update context bundle with outline
        workflow.logger.info("Updating context bundle")
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are a meticulous technical writer.
You update the Context Bundle by inserting/overwriting the OUTLINE section.""",
                f"""Take the existing Context Bundle and update it:

- If it already contains a section named "OUTLINE", replace that entire section.
- Otherwise, append a new "OUTLINE" section near the end.

Return the full updated Context Bundle in Markdown.

<context_bundle>
{context_bundle}
</context_bundle>

<outline>
{outline}
</outline>""",
                0.1,
                12000,
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
        
        # Step 6: Parse outline to extract chapters
        workflow.logger.info("Parsing outline to extract chapters")
        
        chapters_parsed = await workflow.execute_activity(
            parse_outline_activity,
            args=[input.project_id],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        workflow.logger.info(f"Phase 5 complete! Parsed {chapters_parsed} chapters")
        
        return Phase5Output(
            outline=outline,
            updated_context_bundle=updated_context_bundle,
            chapters_parsed=chapters_parsed,
            status="completed",
        )
    
    async def _generate_chapter_outline(
        self,
        context_bundle: str,
        outline_template: str,
        auto_approve: bool,
        project_id: str,
    ) -> str:
        """
        Generate chapter outline with approval/revision loop.
        
        Returns the final approved outline.
        """
        # Initial generation
        outline = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are an expert outliner who creates detailed, compelling story outlines.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<outline_template_override>
{outline_template}
</outline_template_override>

Generate a fully fleshed out chapter-by-chapter outline.

Rules:
- Use the outline template override if provided (unless it's USE_BUNDLE).
- If override is SKIP, use a sensible default for the genre.
- Each chapter summary should be specific (200–250 words), like a handoff to a ghostwriter.
- Keep the outline consistent with characters, worldbuilding, and genre conventions from the bundle.

Output as Markdown:
## OUTLINE
### Chapter 1: Title
[200–250 words...]
...""",
                0.6,
                9000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Auto-approve mode for testing
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping human review")
            return outline
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting human review (attempt {revision_count + 1})")
            
            # Request approval or revision
            decision = await workflow.execute_activity(
                human_input_activity,
                args=[
                    f"""## Chapter Outline Review

{outline}

---

**Review the outline above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes.""",
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            # Check decision (case-insensitive)
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Chapter outline approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Revision requested")
                
                # Collect revision notes
                revision_input = await workflow.execute_activity(
                    human_input_activity,
                    args=[
                        """## Revision Notes

Paste which chapters need changes and what you want different (bullets are best). The agent will revise the outline based on your notes.""",
                        ["revision_notes"],
                    ],
                    start_to_close_timeout=workflow.timedelta(hours=24),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                
                revision_notes = revision_input.get("revision_notes", "")
                
                # Revise the outline
                workflow.logger.info("Revising chapter outline")
                
                outline = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "openrouter",
                        "openai/gpt-5-nano",
                        """You revise outlines without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<current_outline>
{outline}
</current_outline>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the outline to implement the revision notes.
Keep it internally consistent and genre-appropriate.

Output ONLY the revised Markdown outline.""",
                        0.5,
                        9000,
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                
                # Loop back for another review
                continue
            
            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return outline
