"""
Phase 5: Chapter Outline Creation Workflow

Converts: Novel_Writing/Phase05_Chapter_Outline_Creation.yaml
"""

from dataclasses import dataclass
import re
from typing import Dict

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        llm_generate_activity,
        load_artifact_activity,
        load_artifact_optional_activity,
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
    enable_npe_romance_architect: bool = True


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

    def __init__(self) -> None:
        self._current_status: str = "starting"
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
        self._human_input = inputs
        self._current_status = "processing_review"
    
    @workflow.run
    async def run(self, input: Phase5Input) -> Phase5Output:
        """Execute Phase 5 workflow."""
        
        self._current_status = "starting"
        workflow.logger.info(f"Starting Phase 5 for project {input.project_id}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        self._current_status = "loading_context_bundle"
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        context_bundle_tags_json = ""
        context_bundle_tags_json = await workflow.execute_activity(
            load_artifact_optional_activity,
            args=[input.project_id, "phase1_outputs/context_bundle_tags.json"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        
        outline_template = input.outline_template or "USE_BUNDLE"
        
        # Step 2: Generate chapter outline (with revision loop)
        workflow.logger.info("Generating chapter outline")
        self._current_status = "generating_outline"
        
        outline = await self._generate_chapter_outline(
            context_bundle=context_bundle,
            context_bundle_tags_json=context_bundle_tags_json,
            outline_template=outline_template,
            auto_approve=input.auto_approve,
            project_id=input.project_id,
            enable_npe_romance_architect=input.enable_npe_romance_architect,
        )

        if not outline or not outline.strip():
            raise ValueError("Generated outline was empty")

        if "### Chapter" not in outline:
            raise ValueError("Generated outline did not include any '### Chapter N:' headings")
        
        # Step 3: Save outline
        workflow.logger.info("Saving chapter outline")
        self._current_status = "saving_outline"
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase6_outputs/outline.md", outline],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Update context bundle with outline
        workflow.logger.info("Updating context bundle")
        self._current_status = "updating_context_bundle"
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
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
                input.project_id,
                "phase5-context-bundle-update",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 5: Save updated context bundle
        workflow.logger.info("Saving updated context bundle")
        self._current_status = "saving_context_bundle"
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 6: Parse outline to extract chapters
        workflow.logger.info("Parsing outline to extract chapters")
        self._current_status = "parsing_outline"
        
        chapters_parsed = await workflow.execute_activity(
            parse_outline_activity,
            args=[input.project_id],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        workflow.logger.info(f"Phase 5 complete! Parsed {chapters_parsed} chapters")
        self._current_status = "completed"
        
        return Phase5Output(
            outline=outline,
            updated_context_bundle=updated_context_bundle,
            chapters_parsed=chapters_parsed,
            status="completed",
        )
    
    async def _generate_chapter_outline(
        self,
        context_bundle: str,
        context_bundle_tags_json: str,
        outline_template: str,
        auto_approve: bool,
        project_id: str,
        enable_npe_romance_architect: bool,
    ) -> str:
        """
        Generate chapter outline with approval/revision loop.
        
        Returns the final approved outline.
        """
        # Initial generation
        outline = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert outliner who creates detailed, compelling story outlines.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<context_bundle_tags_json>
{context_bundle_tags_json}
</context_bundle_tags_json>

<outline_template_override>
{outline_template}
</outline_template_override>

Generate a fully fleshed out chapter-by-chapter outline.

Rules:
- Use the outline template override if provided (unless it's USE_BUNDLE).
- If override is SKIP, use a sensible default for the genre.
- Each chapter summary should be specific (200–250 words), like a handoff to a ghostwriter.
- Keep the outline consistent with characters, worldbuilding, and genre conventions from the bundle.
- If the tags JSON is present, use it as a consistency aid for canonical names, aliases, locations, factions, rules, themes, and prohibited words.

Formatting requirements (strict):
- Do NOT use Markdown tables.
- Every chapter MUST be a Markdown heading exactly like: ### Chapter 1: The Title
- Immediately under each chapter heading, write the 200–250 word summary as normal paragraphs.
- Then include this mini-schema using these exact labels (one per line), with non-empty values:
  **POV:**
  **Romance Beat:**
  **External Plot Beat:**
  **Turn (what changes):**
  **Hook (what pulls to next chapter):**
  **Heat level (0–5):**
  **Setting:**
- You MAY add book/part separators as Markdown headings, but chapter headings MUST remain exactly as specified.
- Chapter numbering MUST be global and continuous across the entire series (do not restart at Chapter 1 for each book).

Output as Markdown:
## OUTLINE
### Chapter 1: Title
[200–250 words...]
...""",
                0.6,
                9000,
                project_id,
                "phase6-outline",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        if enable_npe_romance_architect:
            outline = await self._apply_npe_romance_architect(
                context_bundle=context_bundle,
                context_bundle_tags_json=context_bundle_tags_json,
                outline=outline,
                project_id=project_id,
            )
        
        # Auto-approve mode for testing
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping human review")
            return outline

        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting human review (attempt {revision_count + 1})")

            self._current_status = "waiting_for_review"
            self._pending_content = f"""## Chapter Outline Review

{outline}

---

**Review the outline above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated chapter outline"
            self._pending_expected_outputs = ["decision"]
            self._human_input = None

            await workflow.execute_activity(
                human_input_activity,
                args=[self._pending_content, ["decision"]],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

            await workflow.wait_condition(
                lambda: self._human_input is not None,
                timeout=workflow.timedelta(hours=24),
            )

            decision_text = (self._human_input or {}).get("decision", "").strip().upper()

            self._pending_content = None
            self._pending_description = None
            self._pending_expected_outputs = None
            self._current_status = "processing_review"

            if "APPROVE" in decision_text:
                workflow.logger.info("Chapter outline approved")
                break

            if "REVISE" in decision_text:
                workflow.logger.info("Revision requested")

                self._current_status = "waiting_for_review"
                self._pending_content = """## Revision Notes

Paste which chapters need changes and what you want different (bullets are best). The agent will revise the outline based on your notes."""
                self._pending_description = "Provide revision notes"
                self._pending_expected_outputs = ["revision_notes"]
                self._human_input = None

                await workflow.execute_activity(
                    human_input_activity,
                    args=[self._pending_content, ["revision_notes"]],
                    start_to_close_timeout=workflow.timedelta(minutes=2),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )

                await workflow.wait_condition(
                    lambda: self._human_input is not None,
                    timeout=workflow.timedelta(hours=24),
                )

                revision_notes = (self._human_input or {}).get("revision_notes", "")

                self._pending_content = None
                self._pending_description = None
                self._pending_expected_outputs = None
                self._current_status = "revising"

                # Revise the outline
                workflow.logger.info("Revising chapter outline")

                outline = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
                        """You revise outlines without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<context_bundle_tags_json>
{context_bundle_tags_json}
</context_bundle_tags_json>

<current_outline>
{outline}
</current_outline>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the outline to implement the revision notes.
Keep it internally consistent and genre-appropriate.

Formatting requirements (strict):
- Preserve the existing chapter heading format: ### Chapter N: Title
- Do NOT use Markdown tables.
- Preserve the mini-schema lines under each chapter heading with the exact labels:
  **POV:**
  **Romance Beat:**
  **External Plot Beat:**
  **Turn (what changes):**
  **Hook (what pulls to next chapter):**
  **Heat level (0–5):**
  **Setting:**

Output ONLY the revised Markdown outline.""",
                        0.5,
                        9000,
                        project_id,
                        "phase6-outline-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )

                if enable_npe_romance_architect:
                    outline = await self._apply_npe_romance_architect(
                        context_bundle=context_bundle,
                        context_bundle_tags_json=context_bundle_tags_json,
                        outline=outline,
                        project_id=project_id,
                    )

                # Loop back for another review
                continue

            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break

        return outline

    def _outline_has_npe_mini_schema(self, outline: str) -> bool:
        chapter_heading = re.compile(
            r"^###\s+Chapter\s+\d+\s*[:\-–—]\s*.+$",
            re.MULTILINE,
        )
        matches = list(chapter_heading.finditer(outline))
        if not matches:
            return False

        required = [
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?POV(?:\*\*)?:\s*\S+"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?Romance Beat(?:\*\*)?:\s*\S+"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?External Plot Beat(?:\*\*)?:\s*\S+"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?Turn\s*(?:\([^)]*\))?(?:\*\*)?:\s*\S+"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?Hook\s*(?:\([^)]*\))?(?:\*\*)?:\s*\S+"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?Heat level\s*(?:\([^)]*\))?(?:\*\*)?:\s*(?:[0-5])\b"),
            re.compile(r"(?m)^\s*(?:[-*]\s*)?(?:\*\*)?Setting(?:\*\*)?:\s*\S+"),
        ]

        for idx, m in enumerate(matches):
            section_start = m.end()
            section_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(outline)
            section = outline[section_start:section_end]
            for pat in required:
                if not pat.search(section):
                    return False
        return True

    async def _apply_npe_romance_architect(
        self,
        context_bundle: str,
        context_bundle_tags_json: str,
        outline: str,
        project_id: str,
    ) -> str:
        role = (
            "You are the NPE Romance Architect. "
            "You ensure the chapter outline has a coherent romance arc, romance beats in every chapter, "
            "and a clean per-chapter mini-schema."
        )

        task = f"""<context_bundle>
{context_bundle}
</context_bundle>

<context_bundle_tags_json>
{context_bundle_tags_json}
</context_bundle_tags_json>

<current_outline>
{outline}
</current_outline>

Revise the outline to satisfy ALL constraints:
    
Relationship arc (overall): meet → friction → forced proximity/connection → midpoint shift → breakup/dark moment → grand gesture → HEA/HFN.

Romance beats per chapter:
- Every chapter MUST include at least 1 relational beat.
- No insta-resolve; desire grows; misbeliefs persist; trust is earned.

External plot pressure:
- Every chapter must include an external plot beat that pressures intimacy (but does not replace it).

Required scenes (somewhere in the outline):
- First meaningful interaction
- First “we can’t ignore this,”
- First kiss / sexual tension escalation
- Breakup/dark moment
- Grand gesture
- HEA/HFN

Formatting requirements (strict):
- Do NOT use Markdown tables.
- Preserve chapter headings exactly like: ### Chapter N: The Title (do not renumber).
- Under each chapter heading:
  1) Keep a specific 200–250 word chapter summary as normal paragraphs.
  2) Then include this mini-schema using these exact labels (one per line), with non-empty values:
     **POV:**
     **Romance Beat:**
     **External Plot Beat:**
     **Turn (what changes):**
     **Hook (what pulls to next chapter):**
     **Heat level (0–5):**
     **Setting:**
- In **Romance Beat**, explicitly label required-scene beats when they occur using the exact phrases above.

Output ONLY the revised Markdown outline."""

        revised = outline
        for attempt in range(2):
            revised = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "default",
                    "default",
                    role,
                    task
                    if attempt == 0
                    else f"""The outline format is invalid.

Fix formatting ONLY (do not change story content more than necessary) so that EVERY chapter contains all required mini-schema lines with the exact labels.

<current_outline>
{revised}
</current_outline>

Output ONLY the revised Markdown outline.""",
                    0.35,
                    12000,
                    project_id,
                    "phase6-npe-romance-architect",
                ],
                start_to_close_timeout=workflow.timedelta(minutes=5),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )

            if self._outline_has_npe_mini_schema(revised):
                return revised

        return revised
