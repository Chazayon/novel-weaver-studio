"""
Phase 6: Single Chapter Writing Workflow

Converts: Novel_Writing/Phase06_Single_Chapter_Writing.yaml
"""

import json
from dataclasses import dataclass
from typing import Any, Dict

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        llm_generate_activity,
        load_artifact_activity,
        load_artifact_optional_activity,
        save_artifact_activity,
        human_input_activity,
        get_previous_chapter_activity,
        update_manifest_activity,
    )


def _build_relevant_context_markdown(
    tags_json: str,
    chapter_number: int,
    chapter_title: str,
    chapter_notes: str | None,
) -> str:
    try:
        data = json.loads(tags_json)
    except Exception:
        return ""

    hint = None
    for item in data.get("chapterHints", []) or []:
        try:
            if int(item.get("chapterNumber")) == int(chapter_number):
                hint = item
                break
        except Exception:
            continue

    entities_root = data.get("entities", {}) or {}
    entity_groups = {
        "Characters": entities_root.get("characters", []) or [],
        "Locations": entities_root.get("locations", []) or [],
        "Factions": entities_root.get("factions", []) or [],
        "Objects": entities_root.get("objects", []) or [],
    }

    def norm(s: str) -> str:
        return (s or "").strip().lower()

    def match_entity(group: list[dict[str, Any]], name: str) -> dict[str, Any] | None:
        needle = norm(name)
        for ent in group:
            if norm(str(ent.get("name", ""))) == needle:
                return ent
            for alias in ent.get("aliases", []) or []:
                if norm(str(alias)) == needle:
                    return ent
        return None

    entity_names: list[str] = []
    hint_tags: list[str] = []
    hint_summary = ""
    if isinstance(hint, dict):
        entity_names = [str(x) for x in (hint.get("entities", []) or []) if str(x).strip()]
        hint_tags = [str(x) for x in (hint.get("tags", []) or []) if str(x).strip()]
        hint_summary = str(hint.get("summary", "") or "")

    inferred_text = f"{chapter_title}\n{chapter_notes or ''}".strip().lower()

    matched: dict[str, list[dict[str, Any]]] = {k: [] for k in entity_groups.keys()}
    for name in entity_names:
        for group_name, group in entity_groups.items():
            ent = match_entity(group, name)
            if ent is not None:
                matched[group_name].append(ent)

    if inferred_text:
        for group_name, group in entity_groups.items():
            for ent in group:
                name = str(ent.get("name", "") or "").strip()
                if name and norm(name) in inferred_text:
                    matched[group_name].append(ent)
                    continue
                for alias in ent.get("aliases", []) or []:
                    a = str(alias or "").strip()
                    if a and norm(a) in inferred_text:
                        matched[group_name].append(ent)
                        break

    # De-duplicate by entity name per group
    for group_name, ents in matched.items():
        seen: set[str] = set()
        uniq: list[dict[str, Any]] = []
        for ent in ents:
            key = norm(str(ent.get("name", "") or ""))
            if not key or key in seen:
                continue
            seen.add(key)
            uniq.append(ent)
        matched[group_name] = uniq

    rules: list[dict[str, Any]] = []
    for r in data.get("rules", []) or []:
        if not isinstance(r, dict):
            continue
        r_tags = [norm(str(t)) for t in (r.get("tags", []) or [])]
        if hint_tags and any(norm(t) in r_tags for t in hint_tags):
            rules.append(r)
    if not rules:
        for r in data.get("rules", []) or []:
            if isinstance(r, dict):
                rules.append(r)
            if len(rules) >= 8:
                break

    themes = [str(t) for t in (data.get("themes", []) or []) if str(t).strip()]
    prohibited = [str(w) for w in (data.get("prohibitedWords", []) or []) if str(w).strip()]

    lines: list[str] = ["## RELEVANT CONTEXT", f"### Chapter {chapter_number}: {chapter_title}"]
    if chapter_notes and str(chapter_notes).strip():
        lines.append(f"\n<chapter_notes>\n{chapter_notes}\n</chapter_notes>")

    if hint_summary.strip():
        lines.append("\n### Chapter Hint")
        lines.append(hint_summary.strip())

    if hint_tags:
        lines.append("\n### Tags")
        for t in hint_tags[:25]:
            lines.append(f"- {t}")

    any_entities = any(len(v) > 0 for v in matched.values())
    if any_entities:
        lines.append("\n### Entities")
        for group_name, ents in matched.items():
            if not ents:
                continue
            lines.append(f"\n#### {group_name}")
            for ent in ents[:20]:
                name = str(ent.get("name", "") or "").strip()
                summary = str(ent.get("summary", "") or "").strip()
                if name and summary:
                    lines.append(f"- **{name}**: {summary}")
                elif name:
                    lines.append(f"- **{name}**")

    if rules:
        lines.append("\n### Rules / Constraints")
        for r in rules[:12]:
            name = str(r.get("name", "") or "").strip()
            summary = str(r.get("summary", "") or "").strip()
            if name and summary:
                lines.append(f"- **{name}**: {summary}")
            elif name:
                lines.append(f"- **{name}**")

    if themes:
        lines.append("\n### Themes")
        for t in themes[:20]:
            lines.append(f"- {t}")

    if prohibited:
        lines.append("\n### Prohibited Words")
        for w in prohibited[:60]:
            lines.append(f"- {w}")

    return "\n".join(lines).strip() + "\n"


@dataclass
class Phase7Input:
    """Input for Phase 6 workflow."""
    project_id: str
    chapter_number: int
    chapter_title: str
    chapter_notes: str | None = None
    auto_approve_improvements: bool = False  # For testing: auto-apply improvements
    auto_approve_final: bool = False  # For testing: auto-approve final chapter


@dataclass
class Phase7Output:
    """Output from Phase 6 workflow."""
    scene_brief: str
    first_draft: str
    improvement_plan: str
    final_chapter: str
    updated_context_bundle: str
    status: str


@workflow.defn
class Phase7SingleChapterWorkflow:
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

    def __init__(self) -> None:
        self._current_status: str = "starting"
        self._pending_content: str | None = None
        self._pending_description: str | None = None
        self._pending_expected_outputs: list[str] = []
        self._human_inputs: list[Dict[str, Any]] = []

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
    def get_pending_expected_outputs(self) -> list[str]:
        return self._pending_expected_outputs

    @workflow.signal
    async def human_input_received(self, inputs: Dict[str, Any]) -> None:
        self._human_inputs.append(inputs)

    async def _await_human_input(
        self,
        description: str,
        expected_outputs: list[str],
        pending_content: str | None = None,
    ) -> Dict[str, Any]:
        self._current_status = "waiting_for_review"
        self._pending_description = description
        self._pending_content = pending_content if pending_content is not None else description
        self._pending_expected_outputs = expected_outputs

        await workflow.execute_activity(
            human_input_activity,
            args=[description, expected_outputs],
            start_to_close_timeout=workflow.timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        await workflow.wait_condition(
            lambda: any(
                any(k in item for k in expected_outputs)
                for item in self._human_inputs
            ),
            timeout=workflow.timedelta(hours=24),
        )

        match_index = next(
            (
                idx
                for idx, item in enumerate(self._human_inputs)
                if any(k in item for k in expected_outputs)
            ),
            -1,
        )

        received = self._human_inputs.pop(match_index)
        extra = {k: v for k, v in received.items() if k not in expected_outputs}
        if extra:
            self._human_inputs.insert(0, extra)

        self._pending_description = None
        self._pending_content = None
        self._pending_expected_outputs = []
        self._current_status = "running"

        return received
    
    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7Output:
        """Execute Phase 6 workflow."""
        
        workflow.logger.info(f"Starting Phase 6: Chapter {input.chapter_number} - {input.chapter_title}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        # Step 2: Load previous chapter
        workflow.logger.info("Loading previous chapter")

        previous_chapter_text_fut = workflow.start_activity(
            get_previous_chapter_activity,
            args=[input.project_id, input.chapter_number],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        context_bundle = await context_bundle_fut
        previous_chapter_text = await previous_chapter_text_fut
        
        chapter_notes = input.chapter_notes or ""
        
        # Step 3: Create scene brief
        workflow.logger.info("Creating scene brief")
        
        scene_brief = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                    "default",
                    "default",
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
                input.project_id,
                "phase7-scene-brief",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Save scene brief
        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        save_scene_brief_fut = workflow.start_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md", scene_brief],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 4: Write first draft
        workflow.logger.info("Writing first draft")
        
        first_draft = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                    "default",
                    "default",
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
                input.project_id,
                "phase7-first-draft",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        await save_scene_brief_fut
        
        # Save first draft
        save_first_draft_fut = workflow.start_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md", first_draft],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 5: Analyze draft for improvements
        workflow.logger.info("Analyzing draft for improvements")
        
        improvement_plan = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                    "default",
                    "default",
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
                input.project_id,
                "phase7-improvement-plan",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        await save_first_draft_fut

        # Save improvement plan
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/improvement_plan.md", improvement_plan],
            start_to_close_timeout=workflow.timedelta(seconds=30),
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
            project_id=input.project_id,
            auto_approve=input.auto_approve_improvements,
        )
        
        # Step 7: Final review loop
        final_chapter = await self._final_review_loop(
            context_bundle=context_bundle,
            final_chapter=final_chapter,
            project_id=input.project_id,
            auto_approve=input.auto_approve_final,
        )
        
        # Step 8: Update context bundle with final chapter
        workflow.logger.info("Updating context bundle with final chapter")

        updated_context_bundle = self._update_context_bundle_with_chapter(
            context_bundle=context_bundle,
            chapter_number=input.chapter_number,
            final_chapter=final_chapter,
        )
        
        # Step 9: Save all artifacts
        workflow.logger.info("Saving final chapter and updated bundle")

        save_final_fut = workflow.start_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/final.md", final_chapter],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        save_bundle_fut = workflow.start_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 10: Update manifest with chapter status
        workflow.logger.info("Updating chapter status in manifest")

        update_manifest_fut = workflow.start_activity(
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
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        await save_final_fut
        await save_bundle_fut
        await update_manifest_fut
        
        workflow.logger.info(f"Phase 6 complete! Chapter {input.chapter_number} finished")
        
        return Phase7Output(
            scene_brief=scene_brief,
            first_draft=first_draft,
            improvement_plan=improvement_plan,
            final_chapter=final_chapter,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )

    def _update_context_bundle_with_chapter(
        self,
        context_bundle: str,
        chapter_number: int,
        final_chapter: str,
    ) -> str:
        import re

        bundle = (context_bundle or "").rstrip() + "\n"
        chapter_text = (final_chapter or "").strip()
        chapter_block = f"### Chapter {chapter_number}\n\n{chapter_text}\n"

        section_match = re.search(
            r"(^##\s+DRAFTING_PROGRESS\s*$)",
            bundle,
            flags=re.MULTILINE,
        )

        if not section_match:
            return (bundle.rstrip() + f"\n\n## DRAFTING_PROGRESS\n\n{chapter_block}\n").rstrip() + "\n"

        section_start = section_match.start(1)
        after_header_idx = section_match.end(1)

        next_h2 = re.search(r"^##\s+", bundle[after_header_idx:], flags=re.MULTILINE)
        section_end = after_header_idx + next_h2.start(0) if next_h2 else len(bundle)

        section_body = bundle[after_header_idx:section_end]
        chapter_header_re = re.compile(
            rf"^###\s+Chapter\s+{chapter_number}\b.*$",
            flags=re.MULTILINE,
        )
        chapter_header_match = chapter_header_re.search(section_body)

        if not chapter_header_match:
            new_section_body = section_body.rstrip() + "\n\n" + chapter_block + "\n"
        else:
            ch_start = chapter_header_match.start(0)
            ch_after_header = chapter_header_match.end(0)
            next_ch = re.search(r"^###\s+Chapter\s+", section_body[ch_after_header:], flags=re.MULTILINE)
            ch_end = ch_after_header + next_ch.start(0) if next_ch else len(section_body)
            new_section_body = section_body[:ch_start].rstrip() + "\n\n" + chapter_block + "\n" + section_body[ch_end:].lstrip()

        updated = bundle[:after_header_idx] + "\n" + new_section_body.rstrip() + "\n" + bundle[section_end:].lstrip()
        return updated.rstrip() + "\n"
    
    async def _process_improvements(
        self,
        context_bundle: str,
        scene_brief: str,
        first_draft: str,
        improvement_plan: str,
        chapter_number: int,
        chapter_title: str,
        project_id: str,
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
                    "default",
                    "default",
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
                    project_id,
                    "phase7-apply-improvement-plan",
                ],
                start_to_close_timeout=workflow.timedelta(minutes=10),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
            
            return revised_draft
        
        decision_prompt = f"""## Improvement Plan

{improvement_plan}

---

**Review the Improvement Plan.**

Type:
- **APPLY** to implement it as-is
- **CUSTOM** to add your own instructions first
- **SKIP** to keep the first draft as final"""

        decision = await self._await_human_input(
            description="Improvement Plan",
            expected_outputs=["decision"],
            pending_content=decision_prompt,
        )
        
        decision_text = decision.get("decision", "").strip().upper()
        
        if "SKIP" in decision_text:
            workflow.logger.info("User chose SKIP - keeping first draft")
            # Return first draft as-is
            return first_draft
        
        if "CUSTOM" in decision_text:
            workflow.logger.info("User chose CUSTOM - collecting custom notes")
            
            custom_input = await self._await_human_input(
                description="Custom Instructions",
                expected_outputs=["custom_notes"],
                pending_content="""## Custom Instructions

Add your custom instructions (what to emphasize, what to ignore, tone shifts, etc.).""",
            )
            
            custom_notes = custom_input.get("custom_notes", "")
            
            # Apply improvements with custom notes
            revised_draft = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "default",
                    "default",
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
                    project_id,
                    "phase7-apply-improvement-plan",
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
                    "default",
                    "default",
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
                project_id,
                "phase7-apply-improvement-plan",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        return revised_draft
    
    async def _final_review_loop(
        self,
        context_bundle: str,
        final_chapter: str,
        project_id: str,
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

        max_revisions = 3
        for revision_count in range(max_revisions):
            workflow.logger.info(
                f"Requesting final review (attempt {revision_count + 1})"
            )

            decision_prompt = f"""## Final Chapter Review

{final_chapter}

---

**Review the FINAL chapter text.**

Type **APPROVE** to lock it in, or type **REVISE** to provide notes and generate one more pass."""

            decision = await self._await_human_input(
                description="Final Chapter Review",
                expected_outputs=["decision"],
                pending_content=decision_prompt,
            )

            decision_text = decision.get("decision", "").strip().upper()

            if "APPROVE" in decision_text:
                workflow.logger.info("Final chapter approved")
                break

            if "REVISE" in decision_text:
                workflow.logger.info("Final revision requested")

                revision_input = await self._await_human_input(
                    description="Final Revision Notes",
                    expected_outputs=["revision_notes"],
                    pending_content="""## Final Revision Notes

Paste your final revision notes (bullets are best). The agent will revise the FINAL chapter accordingly.""",
                )

                revision_notes = revision_input.get("revision_notes", "")

                workflow.logger.info("Revising final chapter")

                final_chapter = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
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
                        project_id,
                        "phase7-final-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=10),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )

                continue

            workflow.logger.warning(
                f"Unexpected decision: {decision_text}, treating as APPROVE"
            )
            break

        return final_chapter


@dataclass
class Phase7StepOutput:
    artifact: str
    status: str


@workflow.defn
class Phase7SceneBriefWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7StepOutput:
        self._current_status = "loading_context"

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        previous_chapter_text_fut = workflow.start_activity(
            get_previous_chapter_activity,
            args=[input.project_id, input.chapter_number],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        context_bundle = await context_bundle_fut
        previous_chapter_text = await previous_chapter_text_fut
        chapter_notes = input.chapter_notes or ""

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        relevant_context = ""
        try:
            relevant_context = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/relevant_context.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            tags_json = ""
            tags_json = await workflow.execute_activity(
                load_artifact_optional_activity,
                args=[input.project_id, "phase1_outputs/context_bundle_tags.json"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

            if isinstance(tags_json, str) and tags_json.strip():
                relevant_context = _build_relevant_context_markdown(
                    tags_json, input.chapter_number, input.chapter_title, chapter_notes
                )
                if relevant_context.strip():
                    await workflow.execute_activity(
                        save_artifact_activity,
                        args=[input.project_id, f"{chapter_dir}/relevant_context.md", relevant_context],
                        start_to_close_timeout=workflow.timedelta(seconds=30),
                        retry_policy=RetryPolicy(maximum_attempts=3),
                    )

        self._current_status = "generating_scene_brief"

        scene_brief = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a scene planning expert who creates detailed, actionable scene briefs for fiction writing.""",
                f"""<relevant_context>\n{relevant_context}\n</relevant_context>\n\n<context_bundle>\n{context_bundle}\n</context_bundle>\n\n<previous_chapter_text>\n{previous_chapter_text}\n</previous_chapter_text>\n\n<chapter_notes>\n{chapter_notes}\n</chapter_notes>\n\nCreate a detailed scene brief for:\n\n## Chapter {input.chapter_number}: {input.chapter_title}\n\nRequirements:\n- Use relevant_context as the high-priority canon subset when present; use context_bundle to verify continuity.\n- Stay consistent with the OUTLINE, CHARACTERS, WORLDBUILDING, STYLE_SHEET and GENRE_TROPES in the bundle.\n- If previous_chapter_text != NONE, include a short \"continuity carryover\" section.\n- Include: POV, setting, time, scene goal, conflict, beats, emotional arc, and ending hook.\n- Include a short \"DO / DON'T\" list from the style sheet and prohibited words.\n\nOutput as Markdown only.""",
                0.6,
                5000,
                input.project_id,
                "phase6-scene-brief",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_scene_brief"

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md", scene_brief],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase7StepOutput(artifact=scene_brief, status="completed")


@workflow.defn
class Phase7FirstDraftWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7StepOutput:
        self._current_status = "loading_context"

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        scene_brief_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        context_bundle = await context_bundle_fut
        scene_brief = await scene_brief_fut

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        relevant_context = ""
        try:
            relevant_context = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/relevant_context.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            relevant_context = ""

        self._current_status = "generating_first_draft"

        first_draft = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert novelist.\nFollow the style sheet and avoid prohibited words.""",
                f"""<relevant_context>\n{relevant_context}\n</relevant_context>\n\n<context_bundle>\n{context_bundle}\n</context_bundle>\n\n<scene_brief>\n{scene_brief}\n</scene_brief>\n\nWrite Chapter {input.chapter_number}: {input.chapter_title} as complete prose.\n\nRequirements:\n- Use relevant_context as high-priority canon subset when present; use context_bundle to verify continuity.\n- Respect the style sheet (voice, POV, tense, rhythm).\n- Avoid prohibited words and AI-isms.\n- Keep pacing tight: prioritize scene goal + conflict + escalation.\n- End on the hook specified in the scene brief.\n\nOutput only the full chapter in Markdown with a heading:\n## Chapter {input.chapter_number}: {input.chapter_title}""",
                0.75,
                12000,
                input.project_id,
                "phase6-first-draft",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_first_draft"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md", first_draft],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase7StepOutput(artifact=first_draft, status="completed")


@workflow.defn
class Phase7ImprovementPlanWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7StepOutput:
        self._current_status = "loading_context"

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        scene_brief_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        first_draft_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        context_bundle = await context_bundle_fut
        scene_brief = await scene_brief_fut
        first_draft = await first_draft_fut

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        relevant_context = ""
        try:
            relevant_context = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/relevant_context.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            relevant_context = ""

        self._current_status = "generating_improvement_plan"

        improvement_plan = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a developmental editor and line editor. You identify the highest-impact improvements.""",
                f"""<relevant_context>\n{relevant_context}\n</relevant_context>\n\n<context_bundle>\n{context_bundle}\n</context_bundle>\n\n<scene_brief>\n{scene_brief}\n</scene_brief>\n\n<first_draft>\n{first_draft}\n</first_draft>\n\nCreate an improvement plan with:\n1) Continuity issues (with prior chapter/outline)\n2) Character voice issues\n3) Pacing issues\n4) Show-don't-tell upgrades (specific line-level suggestions)\n5) Dialogue/subtext upgrades\n6) Any prohibited word / AI-ism cleanup\n\nOutput as Markdown:\n# IMPROVEMENT PLAN\n- ...""",
                0.3,
                5000,
                input.project_id,
                "phase6-improvement-plan",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_improvement_plan"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/improvement_plan.md", improvement_plan],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase7StepOutput(artifact=improvement_plan, status="completed")


@workflow.defn
class Phase7ApplyImprovementPlanWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7StepOutput:
        self._current_status = "loading_context"

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        first_draft_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        improvement_plan_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/improvement_plan.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        context_bundle = await context_bundle_fut
        first_draft = await first_draft_fut
        improvement_plan = await improvement_plan_fut

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        relevant_context = ""
        try:
            relevant_context = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/relevant_context.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            relevant_context = ""

        self._current_status = "applying_improvement_plan"

        revised_draft = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert reviser. Apply plans precisely while preserving voice.""",
                f"""<relevant_context>\n{relevant_context}\n</relevant_context>\n\n<context_bundle>\n{context_bundle}\n</context_bundle>\n\n<improvement_plan>\n{improvement_plan}\n</improvement_plan>\n\n<draft>\n{first_draft}\n</draft>\n\nRevise the chapter by implementing the improvement plan.\nOutput ONLY the revised chapter in Markdown and start with this exact heading:\n## Chapter {input.chapter_number}: {input.chapter_title}""",
                0.6,
                12000,
                input.project_id,
                "phase6-apply-improvement-plan",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_revised_draft"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/revised_draft.md", revised_draft],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase7StepOutput(artifact=revised_draft, status="completed")


@workflow.defn
class Phase7FinalWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase7Input) -> Phase7StepOutput:
        self._current_status = "loading_context"

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        chapter_dir = f"phase7_outputs/chapter_{input.chapter_number}"
        scene_brief_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/scene_brief.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )
        first_draft_fut = workflow.start_activity(
            load_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/first_draft.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        context_bundle = await context_bundle_fut
        scene_brief = await scene_brief_fut
        first_draft = await first_draft_fut

        relevant_context = ""
        try:
            relevant_context = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/relevant_context.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            relevant_context = ""

        draft_source = "first_draft"
        draft_text = first_draft
        try:
            revised_draft = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/revised_draft.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            if isinstance(revised_draft, str) and revised_draft.strip():
                draft_source = "revised_draft"
                draft_text = revised_draft
        except Exception:
            pass

        improvement_plan = ""
        try:
            improvement_plan = await workflow.execute_activity(
                load_artifact_activity,
                args=[input.project_id, f"{chapter_dir}/improvement_plan.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            improvement_plan = ""

        self._current_status = "generating_final"

        plan_block = (
            f"\n\n<improvement_plan>\n{improvement_plan}\n</improvement_plan>\n"
            if improvement_plan.strip() and draft_source == "first_draft"
            else ""
        )

        final_chapter = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert reviser. Produce a publication-ready final chapter while preserving voice.""",
                f"""<relevant_context>\n{relevant_context}\n</relevant_context>\n\n<context_bundle>\n{context_bundle}\n</context_bundle>\n\n<scene_brief>\n{scene_brief}\n</scene_brief>\n\n<draft>\n{draft_text}\n</draft>{plan_block}\n\nIf an improvement_plan is present, apply it. Otherwise, do a light polish pass for clarity, pacing, voice, and continuity.\n\nOutput ONLY the final chapter in Markdown and start with this exact heading:\n## Chapter {input.chapter_number}: {input.chapter_title}""",
                0.6,
                12000,
                input.project_id,
                "phase7-final-revise",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=10),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_final"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, f"{chapter_dir}/final.md", final_chapter],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase7StepOutput(artifact=final_chapter, status="completed")
