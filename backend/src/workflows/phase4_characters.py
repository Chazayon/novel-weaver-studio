"""
Phase 4: Characters & Worldbuilding Workflow

Converts: Novel_Writing/Phase04_Characters_and_Worldbuilding.yaml
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
class Phase4Input:
    """Input for Phase 4 workflow."""
    project_id: str


@dataclass
class Phase4Output:
    """Output from Phase 4 workflow."""
    characters: str
    worldbuilding: str
    updated_context_bundle: str
    status: str


@workflow.defn
class Phase4CharactersWorldbuildingWorkflow:
    """
    Phase 4: Characters & Worldbuilding
    
    Workflow steps:
    1. Load context bundle
    2. Develop detailed character profiles
    3. Save character profiles
    4. Build worldbuilding guide
    5. Save worldbuilding guide
    6. Update context bundle with both
    7. Save updated context bundle
    """
    
    @workflow.run
    async def run(self, input: Phase4Input) -> Phase4Output:
        """Execute Phase 4 workflow."""
        
        workflow.logger.info(f"Starting Phase 4 for project {input.project_id}")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        # Step 2: Develop characters
        workflow.logger.info("Developing character profiles")
        
        characters = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert character developer who creates deep, compelling characters for fiction.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

Create a fleshed-out character document.

For each MAJOR character include:
1) Physical description
2) Role in story
3) Personality profiles (MBTI, Enneagram, CliftonStrengths)
4) Core motivation
5) Background (pre-story)
6) Quirk/hobby
7) Dialogue style
8) 4 short dialogue examples (relaxed, stressed, thoughtful, excited)

For MINOR characters:
- 1–2 sentences each (background + desire + plot relationship)

Output as Markdown with clear headings.""",
                0.5,
                7000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 3: Save characters
        workflow.logger.info("Saving character profiles")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase4_outputs/characters.md", characters],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Build worldbuilding
        workflow.logger.info("Building worldbuilding guide")
        
        worldbuilding = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are an expert worldbuilding specialist who creates rich, immersive fictional worlds.""",
                f"""<context_bundle>
{context_bundle}
</context_bundle>

Create a worldbuilding guide organized into relevant categories (only use categories that apply).

Example categories (use as needed):
- High-level Worldbuilding
- Locations
- Magic/Tech
- Politics/Institutions
- Culture
- History/Lore
- Religion/Beliefs
- Factions/Groups

For each element, write 3–5 sentences with specific usable details.

Output as Markdown with clear headings.""",
                0.5,
                8000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 5: Save worldbuilding
        workflow.logger.info("Saving worldbuilding guide")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase4_outputs/worldbuilding.md", worldbuilding],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 6: Update context bundle
        workflow.logger.info("Updating context bundle with characters and worldbuilding")
        
        updated_context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a meticulous technical writer.
You update the Context Bundle by inserting/overwriting CHARACTERS and WORLDBUILDING sections.""",
                f"""Take the existing Context Bundle and update it:

- Replace or append a section named "CHARACTERS" with the full characters output.
- Replace or append a section named "WORLDBUILDING" with the full worldbuilding output.

Return the full updated Context Bundle in Markdown.

<context_bundle>
{context_bundle}
</context_bundle>

<characters>
{characters}
</characters>

<worldbuilding>
{worldbuilding}
</worldbuilding>""",
                0.1,
                12000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 7: Save updated context bundle
        workflow.logger.info("Saving updated context bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 4 complete!")
        
        return Phase4Output(
            characters=characters,
            worldbuilding=worldbuilding,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
