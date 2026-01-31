from __future__ import annotations

import json
from dataclasses import dataclass

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import llm_generate_activity, load_artifact_activity, save_artifact_activity


@dataclass
class Phase5ContextBundleCurationInput:
    project_id: str
    extra_notes: str | None = None


@dataclass
class Phase5ContextBundleCurationOutput:
    context_bundle: str
    status: str


@dataclass
class Phase5ContextBundleTagsInput:
    project_id: str


@dataclass
class Phase5ContextBundleTagsOutput:
    tags_json: str
    status: str


@workflow.defn
class Phase5ContextBundleCurationWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    async def _load_optional(self, project_id: str, path: str) -> str:
        try:
            return await workflow.execute_activity(
                load_artifact_activity,
                args=[project_id, path],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            return ""

    @workflow.run
    async def run(self, input: Phase5ContextBundleCurationInput) -> Phase5ContextBundleCurationOutput:
        self._current_status = "loading_sources"

        project_id = input.project_id
        extra_notes = input.extra_notes or ""

        context_bundle_fut = workflow.start_activity(
            load_artifact_activity,
            args=[project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        series_outline_fut = workflow.start_activity(
            load_artifact_activity,
            args=[project_id, "phase2_outputs/series_outline.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        call_sheet_fut = workflow.start_activity(
            load_artifact_activity,
            args=[project_id, "phase3_outputs/call_sheet.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        characters_fut = workflow.start_activity(
            load_artifact_activity,
            args=[project_id, "phase4_outputs/characters.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        worldbuilding_fut = workflow.start_activity(
            load_artifact_activity,
            args=[project_id, "phase4_outputs/worldbuilding.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=1),
        )

        style_sheet = await self._load_optional(project_id, "phase1_outputs/style_sheet.md")
        genre_tropes = await self._load_optional(project_id, "phase1_outputs/genre_tropes.md")
        outline = await self._load_optional(project_id, "phase5_outputs/outline.md")

        context_bundle = await context_bundle_fut
        series_outline = ""
        call_sheet = ""
        characters = ""
        worldbuilding = ""

        try:
            series_outline = await series_outline_fut
        except Exception:
            series_outline = ""

        try:
            call_sheet = await call_sheet_fut
        except Exception:
            call_sheet = ""

        try:
            characters = await characters_fut
        except Exception:
            characters = ""

        try:
            worldbuilding = await worldbuilding_fut
        except Exception:
            worldbuilding = ""

        self._current_status = "curating_context_bundle"

        curated_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a meticulous story architect and continuity editor.
You convert scattered project artifacts into a compact, canonical Context Bundle designed for long-form outlining and chapter drafting.""",
                f"""Create a curated, canonical Context Bundle.

Goals:
- Preserve the story's core idea, themes, promise, and constraints.
- Reduce noise: remove duplication and contradictions.
- Make it usable for an 80+ chapter outline and drafting.
- Use explicit, unambiguous bullets where possible.

Rules:
- Output ONLY Markdown.
- Keep sections compact and information-dense.
- If something is uncertain, add it to an OPEN QUESTIONS section rather than guessing.

Include these sections in order (use headings exactly):
1) ## META
2) ## PREMISE (1 paragraph) + ## PROMISE OF THE PREMISE (bullets)
3) ## THEMES & TONE (bullets)
4) ## MAIN CAST (major characters first, then supporting)
5) ## WORLD & RULES (bullets; include institutions/factions)
6) ## SERIES / BOOK ARC (high level)
7) ## PLOT CONSTRAINTS (canon facts that must not change)
8) ## STYLE & PROHIBITIONS (style-sheet highlights + prohibited words if any)
9) ## OUTLINE ANCHORS (chapter-level constraints or major beats if outline exists)
10) ## OPEN QUESTIONS

Inputs:

<existing_context_bundle>
{context_bundle}
</existing_context_bundle>

<series_outline>
{series_outline}
</series_outline>

<call_sheet>
{call_sheet}
</call_sheet>

<characters>
{characters}
</characters>

<worldbuilding>
{worldbuilding}
</worldbuilding>

<style_sheet>
{style_sheet}
</style_sheet>

<genre_tropes>
{genre_tropes}
</genre_tropes>

<outline>
{outline}
</outline>

<extra_notes>
{extra_notes}
</extra_notes>""",
                0.25,
                12000,
                project_id,
                "phase50-context-bundle-curation",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=8),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "saving_context_bundle"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase1_outputs/context_bundle.md", curated_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase5ContextBundleCurationOutput(context_bundle=curated_bundle, status="completed")


@workflow.defn
class Phase5ContextBundleTagsWorkflow:
    def __init__(self) -> None:
        self._current_status: str = "starting"

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.run
    async def run(self, input: Phase5ContextBundleTagsInput) -> Phase5ContextBundleTagsOutput:
        self._current_status = "loading_context_bundle"

        project_id = input.project_id

        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )

        outline = ""
        try:
            outline = await workflow.execute_activity(
                load_artifact_activity,
                args=[project_id, "phase5_outputs/outline.md"],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
        except Exception:
            outline = ""

        self._current_status = "generating_tags"

        raw_tags = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You extract a structured tags index from a novel Context Bundle for use in retrieval and chapter-specific context injection.""",
                f"""Return STRICT JSON only (no markdown, no code fences).

Build a tag index from the Context Bundle (and outline if present) using this schema:

{{
  "schemaVersion": 1,
  "generatedAt": "<iso8601>",
  "entities": {{
    "characters": [{{"name": "", "aliases": [""], "role": "", "tags": [""], "summary": ""}}],
    "locations": [{{"name": "", "aliases": [""], "tags": [""], "summary": ""}}],
    "factions": [{{"name": "", "aliases": [""], "tags": [""], "summary": ""}}],
    "objects": [{{"name": "", "aliases": [""], "tags": [""], "summary": ""}}]
  }},
  "rules": [{{"name": "", "tags": [""], "summary": ""}}],
  "themes": [""],
  "prohibitedWords": [""],
  "chapterHints": [{{"chapterNumber": 0, "title": "", "tags": [""], "entities": [""], "summary": ""}}]
}}

Guidance:
- Keep summaries short (1-2 sentences).
- Tags should be lowercase-kebab-case.
- If the outline includes chapter titles, create chapterHints with best-effort tags/entities.
- If a section doesn't apply, use an empty list.

<context_bundle>
{context_bundle}
</context_bundle>

<outline>
{outline}
</outline>""",
                0.1,
                8000,
                project_id,
                "phase50-context-bundle-tags",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=6),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "validating_tags"

        tags_json = raw_tags
        try:
            parsed = json.loads(raw_tags)
            tags_json = json.dumps(parsed, indent=2, ensure_ascii=False)
        except Exception:
            corrected = await workflow.execute_activity(
                llm_generate_activity,
                args=[
                    "default",
                    "default",
                    """You fix JSON formatting issues. You output STRICT JSON only.""",
                    f"""Fix the following so it becomes valid JSON that matches the intended schema.
Output ONLY JSON.

<broken_json>
{raw_tags}
</broken_json>""",
                    0.0,
                    4000,
                    project_id,
                    "phase50-context-bundle-tags-fix-json",
                ],
                start_to_close_timeout=workflow.timedelta(minutes=3),
                retry_policy=RetryPolicy(maximum_attempts=2),
            )
            parsed = json.loads(corrected)
            tags_json = json.dumps(parsed, indent=2, ensure_ascii=False)

        self._current_status = "saving_tags"

        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase1_outputs/context_bundle_tags.json", tags_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        self._current_status = "completed"
        return Phase5ContextBundleTagsOutput(tags_json=tags_json, status="completed")
