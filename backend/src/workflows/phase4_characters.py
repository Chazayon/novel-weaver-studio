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
        human_input_activity,
    )


@dataclass
class Phase4Input:
    """Input for Phase 4 workflow."""
    project_id: str
    step: str = "full"  # characters, worldbuilding, or full
    auto_approve: bool = False  # For testing


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
    
    Workflow steps (full mode):
    1. Load context bundle
    2. Develop detailed character profiles (with review gate)
    3. Extract characters.index.json
    4. Save character profiles (markdown + JSON)
    5. Build worldbuilding guide (with review gate)
    6. Extract worldbuilding.index.json
    7. Save worldbuilding guide (markdown + JSON)
    8. Update context bundle with both
    9. Save updated context bundle
    
    Step-based mode (characters or worldbuilding):
    - Execute only the specified step with its review gate
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
    async def run(self, input: Phase4Input) -> Phase4Output:
        """Execute Phase 4 workflow."""
        
        workflow.logger.info(f"Starting Phase 4 for project {input.project_id} (step={input.step})")
        
        # Step 1: Load context bundle
        workflow.logger.info("Loading context bundle")
        
        context_bundle = await workflow.execute_activity(
            load_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md"],
            start_to_close_timeout=workflow.timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=2),
        )
        
        # Route to step-specific execution
        if input.step == "characters":
            return await self._run_characters_step(input.project_id, context_bundle, input.auto_approve)
        elif input.step == "worldbuilding":
            return await self._run_worldbuilding_step(input.project_id, context_bundle, input.auto_approve)
        else:
            # Full workflow (default)
            return await self._run_full_workflow(input.project_id, context_bundle, input.auto_approve)
        
    async def _run_full_workflow(
        self,
        project_id: str,
        context_bundle: str,
        auto_approve: bool,
    ) -> Phase4Output:
        """Execute full Phase 4 workflow (both characters and worldbuilding)."""
        
        # Step 2: Develop characters (with review)
        workflow.logger.info("Developing character profiles")
        
        characters = await self._generate_characters(
            context_bundle=context_bundle,
            auto_approve=auto_approve,
            project_id=project_id,
        )
        
        # Step 3: Extract characters.index.json
        workflow.logger.info("Extracting characters.index.json")
        
        characters_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<characters>
{characters}
</characters>

Extract a structured JSON index of all characters.

Output valid JSON with this structure:
{{
  "major_characters": [
    {{
      "name": "Character Name",
      "role": "protagonist/antagonist/etc",
      "personality": "brief summary",
      "motivation": "core goal",
      "voice_traits": ["trait1", "trait2"]
    }}
  ],
  "minor_characters": [
    {{"name": "Name", "role": "brief", "relation": "to protagonist"}}
  ]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                4000,
                project_id,
                "phase4-characters-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 4: Save characters (markdown + JSON)
        workflow.logger.info("Saving character profiles")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/characters.md", characters],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/characters.index.json", characters_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 5: Build worldbuilding (with review)
        workflow.logger.info("Building worldbuilding guide")
        
        worldbuilding = await self._generate_worldbuilding(
            context_bundle=context_bundle,
            auto_approve=auto_approve,
            project_id=project_id,
        )
        
        # Step 6: Extract worldbuilding.index.json
        workflow.logger.info("Extracting worldbuilding.index.json")
        
        worldbuilding_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<worldbuilding>
{worldbuilding}
</worldbuilding>

Extract a structured JSON index of all worldbuilding elements.

Output valid JSON with this structure:
{{
  "locations": [
    {{"name": "Location Name", "type": "city/region/etc", "description": "brief"}}
  ],
  "magic_tech": [
    {{"name": "System/Item", "description": "how it works"}}
  ],
  "factions": [
    {{"name": "Faction", "role": "allies/enemies", "description": "brief"}}
  ],
  "lore": [
    {{"name": "Historical event/belief", "description": "brief"}}
  ]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                4000,
                project_id,
                "phase4-worldbuilding-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 7: Save worldbuilding (markdown + JSON)
        workflow.logger.info("Saving worldbuilding guide")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/worldbuilding.md", worldbuilding],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/worldbuilding.index.json", worldbuilding_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 8: Update context bundle
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
                project_id,
                "phase4-context-bundle-update",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 9: Save updated context bundle
        workflow.logger.info("Saving updated context bundle")
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase1_outputs/context_bundle.md", updated_context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 4 complete!")
        
        return Phase4Output(
            characters=characters,
            worldbuilding=worldbuilding,
            updated_context_bundle=updated_context_bundle,
            status="completed",
        )
    
    async def _run_characters_step(
        self,
        project_id: str,
        context_bundle: str,
        auto_approve: bool,
    ) -> Phase4Output:
        """Execute only the characters step."""
        
        characters = await self._generate_characters(
            context_bundle=context_bundle,
            auto_approve=auto_approve,
            project_id=project_id,
        )
        
        # Extract JSON
        characters_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<characters>
{characters}
</characters>

Extract a structured JSON index of all characters.

Output valid JSON with this structure:
{{
  "major_characters": [
    {{
      "name": "Character Name",
      "role": "protagonist/antagonist/etc",
      "personality": "brief summary",
      "motivation": "core goal",
      "voice_traits": ["trait1", "trait2"]
    }}
  ],
  "minor_characters": [
    {{"name": "Name", "role": "brief", "relation": "to protagonist"}}
  ]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                4000,
                project_id,
                "phase4-characters-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Save
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/characters.md", characters],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/characters.index.json", characters_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        return Phase4Output(
            characters=characters,
            worldbuilding="",
            updated_context_bundle="",
            status="characters_completed",
        )
    
    async def _run_worldbuilding_step(
        self,
        project_id: str,
        context_bundle: str,
        auto_approve: bool,
    ) -> Phase4Output:
        """Execute only the worldbuilding step."""
        
        worldbuilding = await self._generate_worldbuilding(
            context_bundle=context_bundle,
            auto_approve=auto_approve,
            project_id=project_id,
        )
        
        # Extract JSON
        worldbuilding_json = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "default",
                "default",
                """You are a data extraction specialist.""",
                f"""<worldbuilding>
{worldbuilding}
</worldbuilding>

Extract a structured JSON index of all worldbuilding elements.

Output valid JSON with this structure:
{{
  "locations": [
    {{"name": "Location Name", "type": "city/region/etc", "description": "brief"}}
  ],
  "magic_tech": [
    {{"name": "System/Item", "description": "how it works"}}
  ],
  "factions": [
    {{"name": "Faction", "role": "allies/enemies", "description": "brief"}}
  ],
  "lore": [
    {{"name": "Historical event/belief", "description": "brief"}}
  ]
}}

Output ONLY valid JSON, no markdown fences.""",
                0.2,
                4000,
                project_id,
                "phase4-worldbuilding-json",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=3),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Save
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/worldbuilding.md", worldbuilding],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        await workflow.execute_activity(
            save_artifact_activity,
            args=[project_id, "phase4_outputs/worldbuilding.index.json", worldbuilding_json],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        return Phase4Output(
            characters="",
            worldbuilding=worldbuilding,
            updated_context_bundle="",
            status="worldbuilding_completed",
        )
    
    async def _generate_characters(
        self,
        context_bundle: str,
        auto_approve: bool,
        project_id: str,
    ) -> str:
        """Generate characters with approval/revision loop."""
        
        # Initial generation
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
                project_id,
                "phase4-characters",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping character review")
            return characters
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting character review (attempt {revision_count + 1})")
            
            self._current_status = "waiting_for_review"
            
            # Set pending review state for frontend
            self._pending_content = f"""## Character Profiles Review

{characters}

---

**Review the character profiles above.**

Type **APPROVE** to lock them in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated character profiles"
            self._pending_expected_outputs = ["decision"]
            self._human_input = None
            
            await workflow.execute_activity(
                human_input_activity,
                args=[
                    self._pending_content,
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

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
            
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Characters approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Character revision requested")
                
                self._current_status = "waiting_for_review"
                self._pending_content = """## Character Revision Notes

Describe what needs to change in the characters (bullets are best). The agent will revise based on your notes."""
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
                
                self._current_status = "revising_characters"
                
                characters = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
                        """You revise character profiles without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<current_characters>
{characters}
</current_characters>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the character profiles to implement the revision notes.
Keep consistency with the story world.

Output ONLY the revised Markdown character document.""",
                        0.5,
                        7000,
                        project_id,
                        "phase4-characters-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                continue
            
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return characters
    
    async def _generate_worldbuilding(
        self,
        context_bundle: str,
        auto_approve: bool,
        project_id: str,
    ) -> str:
        """Generate worldbuilding with approval/revision loop."""
        
        # Initial generation
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
                project_id,
                "phase4-worldbuilding",
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        if auto_approve:
            workflow.logger.info("Auto-approve mode: skipping worldbuilding review")
            return worldbuilding
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting worldbuilding review (attempt {revision_count + 1})")
            
            self._current_status = "waiting_for_review"
            
            # Set pending review state for frontend
            self._pending_content = f"""## Worldbuilding Guide Review

{worldbuilding}

---

**Review the worldbuilding guide above.**

Type **APPROVE** to lock it in, or type **REVISE** to request changes."""
            self._pending_description = "Review the generated worldbuilding guide"
            self._pending_expected_outputs = ["decision"]
            self._human_input = None
            
            await workflow.execute_activity(
                human_input_activity,
                args=[
                    self._pending_content,
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )

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
            
            decision_text = decision.get("decision", "").strip().upper()
            
            if "APPROVE" in decision_text:
                workflow.logger.info("Worldbuilding approved")
                break
            
            if "REVISE" in decision_text:
                workflow.logger.info("Worldbuilding revision requested")
                
                self._current_status = "waiting_for_review"
                self._pending_content = """## Worldbuilding Revision Notes

Describe what needs to change in the worldbuilding (bullets are best). The agent will revise based on your notes."""
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
                
                self._current_status = "revising_worldbuilding"
                
                worldbuilding = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "default",
                        "default",
                        """You revise worldbuilding guides without losing good material.""",
                        f"""<context_bundle>
{context_bundle}
</context_bundle>

<current_worldbuilding>
{worldbuilding}
</current_worldbuilding>

<revision_notes>
{revision_notes}
</revision_notes>

Revise the worldbuilding guide to implement the revision notes.
Keep consistency with the story world.
Maintain the same Markdown category structure.

Output ONLY the revised Markdown worldbuilding guide.""",
                        0.5,
                        8000,
                        project_id,
                        "phase4-worldbuilding-revise",
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                continue
            
            workflow.logger.warning(f"Unexpected decision: {decision_text}, treating as APPROVE")
            break
        
        return worldbuilding
