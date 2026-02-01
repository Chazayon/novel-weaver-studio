from dataclasses import dataclass
from typing import Dict

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
class Phase5StoryBibleInput:
    project_id: str
    extra_notes: str | None = None
    auto_approve: bool = False


@dataclass
class Phase5StoryBibleOutput:
    story_bible: str
    status: str


@workflow.defn
class Phase5StoryBibleWorkflow:
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

    async def _generate_story_bible(self, *, project_id: str, revision_notes: str = "") -> str:
        self._current_status = "loading_sources"

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

        style_sheet = await self._load_optional(project_id, "phase1_outputs/style_sheet.md")
        genre_tropes = await self._load_optional(project_id, "phase1_outputs/genre_tropes.md")
        tags_json = await self._load_optional(project_id, "phase1_outputs/context_bundle_tags.json")

        self._current_status = "generating_story_bible"

        extra_notes = revision_notes.strip() or ""

        story_bible = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a story bible compiler.
You produce a clean, canonical story bible for long-form drafting, with stable names, rules, and continuity facts.""",
                f"""Create a STORY BIBLE in Markdown.

Goals:
- Canonicalize: names, aliases, locations, factions, magic/tech rules.
- Remove contradictions.
- Make it actionable for chapter outlining and drafting.

Output ONLY Markdown with these headings (in order):
1) ## META
2) ## PREMISE
3) ## THEMES & TONE
4) ## CANONICAL CAST (include aliases)
5) ## WORLD & RULES (canon facts; do-not-change)
6) ## TIMELINE / BACKSTORY (if known)
7) ## CONFLICTS & STAKES
8) ## CONTINUITY CHECKLIST
9) ## OPEN QUESTIONS

Inputs:

<context_bundle>
{context_bundle}
</context_bundle>

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

<context_bundle_tags_json>
{tags_json}
</context_bundle_tags_json>

<extra_notes>
{extra_notes}
</extra_notes>""",
                0.25,
                12000,
                project_id,
                "phase5-story-bible",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=8),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        return story_bible

    @workflow.run
    async def run(self, input: Phase5StoryBibleInput) -> Phase5StoryBibleOutput:
        project_id = input.project_id

        story_bible = await self._generate_story_bible(project_id=project_id)

        self._current_status = "saving_story_bible"
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase5_outputs/story_bible.md", story_bible],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )

        if input.auto_approve:
            self._current_status = "completed"
            return Phase5StoryBibleOutput(story_bible=story_bible, status="completed")

        max_revisions = 3
        for _ in range(max_revisions):
            self._current_status = "waiting_for_review"
            self._pending_content = f"""## Story Bible Review

{story_bible}

---

Type **APPROVE** to lock it in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated story bible"
            self._pending_expected_outputs = ["decision"]
            self._human_input = None

            await workflow.execute_activity(
                human_input_activity,
                args=[self._pending_content, ["decision"]],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

            await workflow.wait_condition(
                lambda: self._human_input is not None,
                timeout=workflow.timedelta(hours=24),
            )

            decision = (self._human_input or {}).get("decision", "").strip().upper()

            self._pending_content = None
            self._pending_description = None
            self._pending_expected_outputs = None

            if "APPROVE" in decision:
                break

            self._current_status = "waiting_for_review"
            self._pending_content = """## Revision Notes

Describe what needs to change in the story bible (bullets are best)."""
            self._pending_description = "Provide revision notes"
            self._pending_expected_outputs = ["revision_notes"]
            self._human_input = None

            await workflow.execute_activity(
                human_input_activity,
                args=[self._pending_content, ["revision_notes"]],
                start_to_close_timeout=workflow.timedelta(hours=24),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

            await workflow.wait_condition(
                lambda: self._human_input is not None,
                timeout=workflow.timedelta(hours=24),
            )

            revision_notes = (self._human_input or {}).get("revision_notes", "").strip()

            story_bible = await self._generate_story_bible(project_id=project_id, revision_notes=revision_notes)

            self._current_status = "saving_story_bible"
            await workflow.execute_activity(
                save_artifact_activity,
                args=[project_id, "phase5_outputs/story_bible.md", story_bible],
                start_to_close_timeout=workflow.timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )

        self._current_status = "completed"
        return Phase5StoryBibleOutput(story_bible=story_bible, status="completed")
