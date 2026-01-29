"""
Phase 6: Single Chapter Writing Workflow

Converts: Novel_Writing/Phase06_Single_Chapter_Writing.yaml
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
        get_previous_chapter_activity,
        update_manifest_activity,
    )


@dataclass
class Phase6Input:
    """Input for Phase 6 workflow."""
    project_id: str
    chapter_number: int
    chapter_title: str
    chapter_notes: str | None = None
    auto_approve_improvements: bool = False  # For testing: auto-apply improvements
    auto_approve_final: bool = False  # For testing: auto-approve final chapter


@dataclass
class Phase6Output:
    """Output from Phase 6 workflow."""
    scene_brief: str
    first_draft: str
    final_chapter: str
    updated_context_bundle: str
    status: str


@workflow.defn
class Phase6SingleChapterWorkflow:
    """
    Phase 6: Single Chapter Writing
    
    Workflow steps:
    1. Load context bundle
    2. Load previous chapter
    3. Create scene brief
    4. Write first draft
    5. Analyze draft for improvements
    6. Human choice: APPLY / CUSTOM / SKIP improvements
    7. Implement improvements (if applicable)
    8. Final review loop: APPROVE or REVISE
    9. Update context bundle with final chapter
    10. Save all artifacts and update manifest
    """
    
    @workflow.run
    async def run(self, input: Phase6Input) -> Phase6Output:
        """Execute Phase 6 workflow."""
        
        workflow.logger.info(f"Starting Phase 6: Chapter {input.chapter_number} - {input.chapter_title}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        # Step 2: Load previous chapter
        workflow.logger.info("Loading previous chapter")
        
        previous_chapter_text = await workflow.execute_activity(
            get_previous_chapter_activity,
            args=[input.project_id, input.chapter_number],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        chapter_notes = input.chapter_notes or ""
        
        # Step 3: Create scene brief
        workflow.logger.info("Creating scene brief")
        
        scene_brief = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are a scene planning expert who creates detailed, actionable scene briefs for fiction writing.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<previous_chapter_text>
{previous_chapter_text}
</previous_chapter_text>

<chapter_notes>
{chapter_notes}
</chapter_notes>

Create a detailed scene brief for:

## Chapter {input.chapter_number}: {input.chapter_title}

Requirements:
- Stay consistent with the OUTLINE, CHARACTERS, WORLDBUILDING, STYLE_SHEET and GENRE_TROPES in the bundle.
- If previous_chapter_text != NONE, include a short "continuity carryover" section.
- Include: POV, setting, time, scene goal, conflict, beats, emotional arc, and ending hook.
- Include a short "DO / DON'T" list from the style sheet and prohibited words.

Output as Markdown only.""",
                0.6,
                5000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Save scene brief
        chapter_dir = f"phase6_outputs/chapter_{input.chapter_number}"
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md", scene_brief],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Write first draft
        workflow.logger.info("Writing first draft")
        
        first_draft = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                f"""You are an expert novelist.
Follow the style sheet and avoid prohibited words.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<scene_brief>
{scene_brief}
</scene_brief>

Write Chapter {input.chapter_number}: {input.chapter_title} as complete prose.

Requirements:
- Respect the style sheet (voice, POV, tense, rhythm).
- Avoid prohibited words and AI-isms.
- Keep pacing tight: prioritize scene goal + conflict + escalation.
- End on the hook specified in the scene brief.

Output only the full chapter in Markdown with a heading:
## Chapter {input.chapter_number}: {input.chapter_title}""",
                0.75,
                12000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Save first draft
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md", first_draft],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 5: Analyze draft for improvements
        workflow.logger.info("Analyzing draft for improvements")
        
        improvement_plan = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are a developmental editor and line editor. You identify the highest-impact improvements.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<scene_brief>
{scene_brief}
</scene_brief>

<first_draft>
{first_draft}
</first_draft>

Create an improvement plan with:
1) Continuity issues (with prior chapter/outline)
2) Character voice issues
3) Pacing issues
4) Show-don't-tell upgrades (specific line-level suggestions)
5) Dialogue/subtext upgrades
6) Any prohibited word / AI-ism cleanup

Output as Markdown:
# IMPROVEMENT PLAN
- ...""",
                0.3,
                5000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 6: Get improvement path decision and implement
        final_chapter = await self._process_improvements(
            context_bundle=context_bundle,
            scene_brief=scene_brief,
            first_draft=first_draft,
            improvement_plan=improvement_plan,
            chapter_number=input.chapter_number,
            chapter_title=input.chapter_title,
            auto_approve=input.auto_approve_improvements,
        )
        
        # Step 7: Final review loop
        final_chapter = await self._final_review_loop(
            context_bundle=context_bundle,
            final_chapter=final_chapter,
            auto_approve=input.auto_approve_final,
        )
        
        # Step 8: Update context bundle with final chapter
        workflow.logger.info("Updating context bundle with final chapter")
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are a meticulous technical writer.
You update the Context Bundle by storing the finished chapter for continuity.""",
                f"""Update the Context Bundle as follows:

- Add or update a section named "DRAFTING_PROGRESS".
- Under it, store the latest finished chapter text.
- If an entry for this chapter already exists, replace it.

Preferred format inside DRAFTING_PROGRESS:
## DRAFTING_PROGRESS
### Chapter X
[full chapter text...]

Return the FULL updated Context Bundle in Markdown.

<context_bundle>
{context_bundle}
</context_bundle>

<final_chapter>
{final_chapter}
</final_chapter>""",
                0.1,
                14000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 9: Save all artifacts
        workflow.logger.info("Saving final chapter and updated bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/final.md", final_chapter],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 10: Update manifest with chapter status
        workflow.logger.info("Updating chapter status in manifest")
        
        await workflow.execute_activity(
            update_manifest_activity,
            args=[
                input.project_id,
                {
                    "state": {
                        "current_chapter_number": input.chapter_number,
                        "current_chapter_name": input.chapter_title,
                    }
                },
            ],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info(f"Phase 6 complete! Chapter {input.chapter_number} finished")
        
        return Phase6Output(
            scene_brief=scene_brief,
            first_draft=first_draft,
            final_chapter=final_chapter,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
    
    async def _process_improvements(
        self,
        context_bundle: str,
        scene_brief: str,
        first_draft: str,
        improvement_plan: str,
        chapter_number: int,
        chapter_title: str,
        auto_approve: bool,
    ) -> str:
        """
        Handle improvement path decision and implementation.
        
        Returns the chapter after improvements (or original if skipped).
        """
        # Auto-approve mode: automatically apply improvements
        if auto_approve:
            workflow.logger.info("Auto-approve improvements mode: applying improvements")
            
            revised_draft = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "openrouter",
                    "openai/gpt-5-nano",
                    """You are an expert reviser. Apply plans precisely while preserving voice.""",
                    f"""<context_bundle>
{context_bundle}
</context_bundle>

<improvement_plan>
{improvement_plan}
</improvement_plan>

<draft>
{first_draft}
</draft>

Revise the chapter by implementing the improvement plan.
Output only the revised chapter in Markdown with the same heading.""",
                    0.6,
                    12000,
                ],
                start_to_close_timeout=workflow.timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            
            return revised_draft
        
        # Human decision: APPLY / CUSTOM / SKIP
        decision = await workflow.execute_activity(
            human_input_activity,
            args=[
                f"""## Improvement Plan

{improvement_plan}

---

**Review the Improvement Plan.**

Type:
- **APPLY** to implement it as-is
- **CUSTOM** to add your own instructions first
- **SKIP** to keep the first draft as final""",
                ["decision"],
            ],
            start_to_close_timeout=workflow.timedelta(hours=24),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        
        decision_text = decision.get("decision", "").strip().upper()
        
        if "SKIP" in decision_text:
            workflow.logger.info("User chose SKIP - keeping first draft")
            # Return first draft as-is
            return first_draft
        
        if "CUSTOM" in decision_text:
            workflow.logger.info("User chose CUSTOM - collecting custom notes")
            
            # Collect custom notes
            custom_input = await workflow.execute_activity(
                human_input_activity,
                args=[
                    """## Custom Instructions

Add your custom instructions (what to emphasize, what to ignore, tone shifts, etc.).""",
                    ["custom_notes"],
                ],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            custom_notes = custom_input.get("custom_notes", "")
            
            # Apply improvements with custom notes
            revised_draft = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "openrouter",
                    "openai/gpt-5-nano",
                    """You are an expert reviser. Apply plans + custom notes precisely while preserving voice.""",
                    f"""<context_bundle>
{context_bundle}
</context_bundle>

<improvement_plan>
{improvement_plan}
</improvement_plan>

<custom_notes>
{custom_notes}
</custom_notes>

<draft>
{first_draft}
</draft>

Revise the chapter by implementing the improvement plan AND the custom notes.
If they conflict, follow the custom notes.
Output only the revised chapter in Markdown with the same heading.""",
                    0.65,
                    12000,
                ],
                start_to_close_timeout=workflow.timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            
            return revised_draft
        
        # Default or APPLY
        workflow.logger.info("Applying improvements")
        
        revised_draft = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-5-nano",
                """You are an expert reviser. Apply plans precisely while preserving voice.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

<improvement_plan>
{improvement_plan}
</improvement_plan>

<draft>
{first_draft}
</draft>

Revise the chapter by implementing the improvement plan.
Output only the revised chapter in Markdown with the same heading.""",
                0.6,
                12000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        return revised_draft
    
    async def _final_review_loop(
        self,
        context_bundle: str,
        final_chapter: str,
        auto_approve: bool,
    ) -> str:
        """
        Final review loop: APPROVE or REVISE.
        
        Returns the approved final chapter.
        """
        # Auto-approve mode
        if auto_approve:
            workflow.logger.info("Auto-approve final mode: skipping final review")
            return final_chapter
        
        # Human final review loop
        max_revisions = 3
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting final review (attempt {revision_count + 1})")
            
            # Request approval or revision
            decision = await workflow.execute_activity(
                human_input_activity,
                args=[
                    f"""## Final Chapter Review

{final_chapter}

---

**Review the FINAL chapter text.**

Type **APPROVE** to lock it in, or type **REVISE** to provide notes and generate one more pass.""",
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            # Check decision
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Final chapter approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Final revision requested")
                
                # Collect revision notes
                revision_input = await workflow.execute_activity(
                    human_input_activity,
                    args=[
                        """## Final Revision Notes

Paste your final revision notes (bullets are best). The agent will revise the FINAL chapter accordingly.""",
                        ["revision_notes"],
                    ],
                    start_to_close_timeout=workflow.timedelta(hours=24),
                    retry_policy=RetryPolicy(maximum_attempts=1),
                )
                
                revision_notes = revision_input.get("revision_notes", "")
                
                # Revise final chapter
                workflow.logger.info("Revising final chapter")
                
                final_chapter = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "openrouter",
                        "openai/gpt-5-nano",
                        """You perform a targeted revision without changing what doesn't need changing.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<final_chapter_current>
{final_chapter}
</final_chapter_current>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the chapter to implement the revision notes. Preserve voice and continuity.
Output only the revised chapter in Markdown with the same heading.""",
                        0.55,
                        12000,
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=10),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                
                # Loop back for another review
                continue
            
            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return final_chapter
