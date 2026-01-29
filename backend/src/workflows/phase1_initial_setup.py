"""
Phase 1: Initial Setup & Research Workflow

Converts: Novel_Writing/Phase01_Initial_Setup_and_Research.yaml
"""

from dataclasses import dataclass
from typing import Dict, Any

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .activities import (
        llm_generate_activity,
        python_code_activity,
        human_input_activity,
    )


@dataclass
class Phase1Input:
    """Input for Phase 1 workflow."""
    project_id: str
    genre: str | None = None
    book_title: str | None = None
    initial_ideas: str | None = None
    writing_samples: str | None = None
    outline_template: str | None = None
    prohibited_words: str | None = None


@dataclass
class Phase1Output:
    """Output from Phase 1 workflow."""
    genre_tropes: str
    style_sheet: str
    context_bundle: str
    status: str


@workflow.defn
class Phase1InitialSetupWorkflow:
    """
    Phase 1: Initial Setup & Research
    
    Workflow steps:
    1. Collect initial input from user (with signal-based waiting)
    2. Research genre tropes using web search
    3. Generate style sheet  
    4. Assemble context bundle
    5. Human review (APPROVE or REVISE)
    6. If REVISE: collect notes, regenerate, repeat
    7. Save all artifacts
    """
    
    def __init__(self) -> None:
        self._user_input: Dict[str, Any] | None = None
        self._context_approval: str | None = None
        self._revision_notes: str | None = None
        self._current_status: str = "starting"
        self._pending_context_bundle: str | None = None

    @workflow.query
    def get_current_status(self) -> str:
        return self._current_status

    @workflow.query
    def get_pending_content(self) -> str | None:
        return self._pending_context_bundle
    
    @workflow.signal
    async def provide_user_input(self, inputs: Dict[str, Any]) -> None:
        """Signal to provide user input for Phase 1."""
        self._user_input = inputs

    @workflow.signal
    async def user_review_signal(self, review: Dict[str, Any]) -> None:
        """Signal to provide user review decision."""
        approved = review.get("approved", False)
        feedback = review.get("feedback", "")
        
        if approved:
            self._context_approval = "APPROVE"
        else:
            self._context_approval = "REVISE"
            self._revision_notes = feedback
        workflow.logger.info(f"Received user input signal with {len(inputs)} fields")
    
    @workflow.signal
    async def provide_context_approval(self, decision: str, notes: str = "") -> None:
        """Signal to approve or revise the context bundle."""
        self._context_approval = decision.strip().upper()
        self._revision_notes = notes
        workflow.logger.info(f"Received context approval signal: {self._context_approval}")
    
    @workflow.run
    async def run(self, input: Phase1Input) -> Phase1Output:
        """Execute Phase 1 workflow."""
        
        workflow.logger.info(f"Starting Phase 1 for project {input.project_id}")
        self._current_status = "collecting_inputs"
        
        # Step 1: Collect initial input (if not provided)
        genre = input.genre
        book_title = input.book_title
        initial_ideas = input.initial_ideas
        writing_samples = input.writing_samples or "SKIP"
        outline_template = input.outline_template or "SKIP"
        prohibited_words = input.prohibited_words or "SKIP"
        
        workflow.logger.info(f"Received inputs: genre={genre}, title={book_title}, ideas={initial_ideas[:50] if initial_ideas else None}")
        
        if not all([genre, book_title, initial_ideas]):
            workflow.logger.info(f"Missing required inputs, will wait for signal. genre={bool(genre)}, title={bool(book_title)}, ideas={bool(initial_ideas)}")
            self._current_status = "waiting_for_inputs"
            
            # Execute activity to notify frontend that input is needed
            await workflow.execute_activity(
                human_input_activity,
                args=[
                    """**PHASE 1: INITIAL SETUP & RESEARCH**

Goal: Create a *Context Bundle* for your novel project.

Please provide:

1) **Genre** (e.g., Fantasy Romance, Thriller, Literary Fiction)
2) **Book Title** (or working title)
3) **Initial Ideas** (premise, characters, themes, setting - anything you have)

Optional:
4) **Writing Samples** (~3k–6k words of your prose). If none, type `SKIP`.
5) **Outline Template** (your preferred chapter structure). If none, type `SKIP`.
6) **Prohibited Words** (AI-isms/clichés you want to avoid). If none, type `SKIP`.

💡 Tip: If you type `SKIP`, the system will create sensible defaults for you.""",
                    ["genre", "book_title", "initial_ideas", "writing_samples", "outline_template", "prohibited_words"],
                ],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            # Wait for user input signal (with timeout)
            workflow.logger.info("Waiting for user input signal...")
            await workflow.wait_condition(
                lambda: self._user_input is not None,
                timeout=workflow.timedelta(hours=24),
            )
            
            # Extract values from user input
            if self._user_input:
                genre = self._user_input.get("genre", "Fantasy")
                book_title = self._user_input.get("book_title", "Untitled")
                initial_ideas = self._user_input.get("initial_ideas", "A story about...")
                writing_samples = self._user_input.get("writing_samples", "SKIP")
                outline_template = self._user_input.get("outline_template", "SKIP")
                prohibited_words = self._user_input.get("prohibited_words", "SKIP")
                workflow.logger.info(f"User provided: genre={genre}, title={book_title}")
        else:
            workflow.logger.info("All inputs provided, skipping wait for signal")
        
        # Step 2: Research genre tropes using web search
        workflow.logger.info(f"Researching genre tropes for {genre} via web search")
        self._current_status = "researching"
        
        from .activities import web_search_activity
        
        genre_tropes = await workflow.execute_activity(
            web_search_activity,
            args=[
                f"""Research the tropes and conventions of the **{genre}** genre.

Provide a comprehensive analysis that includes:
1. **Core Tropes** - The most expected and beloved elements readers expect
2. **Character Archetypes** - Common character types and roles
3. **Plot Structures** - Typical story arcs and narrative patterns  
4. **Setting Conventions** - Common world-building and atmosphere elements
5. **Themes** - Recurring thematic elements and messages
6. **Reader Expectations** - What readers of this genre expect and demand
7. **Subgenre Variations** - Important subgenres and their unique elements
8. **Current Trends** - What's popular in this genre right now

Include specific examples from successful books in this genre where helpful.
Format as a comprehensive Markdown reference document.""",
                10,  # max_results
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
        
        # Step 3: Save genre tropes
        from .activities import save_artifact_activity
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/genre_tropes.md", genre_tropes],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 4: Generate style sheet
        workflow.logger.info("Generating style sheet")
        self._current_status = "generating_stylesheets"
        
        from .activities import llm_generate_activity
        
        style_sheet_task = f"""<writing_samples>
{writing_samples}
</writing_samples>

Draft a prose style sheet that an LLM can follow to write consistently.

Requirements:
- Emphasize deep POV and show-don't-tell (with examples).
- Specify POV + tense conventions.
- Dialogue style guidance.
- Typical sentence/paragraph rhythm.
- Approximate grade level.

If writing_samples == `SKIP`, write a default style sheet appropriate for {genre}.

Output only the style sheet in Markdown."""
        
        style_sheet = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-4o",
                """You are an expert prose analyst.
If the user provided `SKIP` for writing samples, create a default style sheet suitable for the genre.""",
                style_sheet_task,
                0.2,
                4000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
        )
        
        # Step 5: Save style sheet
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/style_sheet.md", style_sheet],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        # Step 6: Assemble context bundle (with revision loop)
        workflow.logger.info("Assembling context bundle")
        
        context_bundle = await self._generate_context_bundle(
            project_id=input.project_id,
            genre=genre,
            book_title=book_title,
            initial_ideas=initial_ideas,
            prohibited_words=prohibited_words,
            outline_template=outline_template,
            genre_tropes=genre_tropes,
            style_sheet=style_sheet,
        )
        
        # Step 7: Save context bundle
        await workflow.execute_activity(
            save_artifact_activity,
            args=[input.project_id, "phase1_outputs/context_bundle.md", context_bundle],
            start_to_close_timeout=workflow.timedelta(seconds=30),
        )
        
        workflow.logger.info("Phase 1 complete!")
        
        return Phase1Output(
            genre_tropes=genre_tropes,
            style_sheet=style_sheet,
            context_bundle=context_bundle,
            status="completed",
        )
    
    async def _generate_context_bundle(
        self,
        project_id: str,
        genre: str,
        book_title: str,
        initial_ideas: str,
        prohibited_words: str,
        outline_template: str,
        genre_tropes: str,
        style_sheet: str,
    ) -> str:
        """
        Generate context bundle with approval/revision loop.
        
        Returns the final approved context bundle.
        """
        self._current_status = "generating_context_bundle"
        from .activities import llm_generate_activity, human_input_activity
        
        # Initial generation
        context_bundle_task = f"""Build a single Markdown document called **CONTEXT BUNDLE v1**.

It must include these sections, in this order:
1) META (genre, book_title)
2) INITIAL_IDEAS
3) PROHIBITED_WORDS (empty list if SKIP)
4) OUTLINE_TEMPLATE (if SKIP, include "DEFAULT" and a short default template)
5) GENRE_TROPES (paste in full)
6) STYLE_SHEET (paste in full)

Constraints:
- Make it easy to reuse: include clear headings and delimiter lines.
- Keep everything in one document (no links).

Inputs:
<genre>{genre}</genre>
<book_title>{book_title}</book_title>
<initial_ideas>{initial_ideas}</initial_ideas>
<prohibited_words>{prohibited_words}</prohibited_words>
<outline_template>{outline_template}</outline_template>
<genre_tropes>{genre_tropes}</genre_tropes>
<style_sheet>{style_sheet}</style_sheet>

Output ONLY the Markdown Context Bundle."""
        
        context_bundle = await workflow.execute_activity(
            llm_generate_activity,
            args=[
                "openrouter",
                "openai/gpt-4o",
                """You are a meticulous technical writer.
Your job is to compile all Phase 1 artifacts into a single, pasteable Context Bundle.""",
                context_bundle_task,
                0.1,
                7000,
            ],
            start_to_close_timeout=workflow.timedelta(minutes=5),
        )
        
        self._pending_context_bundle = context_bundle
        
        # Human review loop
        max_revisions = 5
        for revision_count in range(max_revisions):
            workflow.logger.info(f"Requesting context bundle review (attempt {revision_count + 1})")
            self._current_status = "waiting_for_review"
            
            # Reset approval state
            self._context_approval = None
            self._revision_notes = None
            
            # Request approval or revision
            await workflow.execute_activity(
                human_input_activity,
                args=[
                    f"""## Context Bundle Review

{context_bundle}

---

**Review the Context Bundle above.**

This bundle contains all the foundational information for your novel project:
- Genre and initial ideas
- Researched genre tropes
- Style sheet for consistent prose

Type **APPROVE** to lock it in and proceed to the next phase.
Type **REVISE** if you want to make changes (you'll be asked for revision notes).""",
                    ["decision"],
                ],
                start_to_close_timeout=workflow.timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=1),
            )
            
            # Wait for approval signal
            workflow.logger.info("Waiting for context approval signal...")
            await workflow.wait_condition(
                lambda: self._context_approval is not None,
                timeout=workflow.timedelta(hours=24),
            )
            
            # Check decision
            if "APPROVE" in self._context_approval:
                workflow.logger.info("Context bundle approved")
                break
            
            if "REVISE" in self._context_approval:
                workflow.logger.info("Revision requested")
                
                # Wait for revision notes if not provided
                if not self._revision_notes:
                    self._revision_notes = None  # Reset
                    
                    await workflow.execute_activity(
                        human_input_activity,
                        args=[
                            """## Revision Notes

Paste specific changes you want (bullets are best). The system will revise the context bundle based on your notes.""",
                            ["revision_notes"],
                        ],
                        start_to_close_timeout=workflow.timedelta(minutes=2),
                        retry_policy=RetryPolicy(maximum_attempts=1),
                    )
                    
                    # Wait for revision notes signal
                    await workflow.wait_condition(
                        lambda: self._revision_notes is not None,
                        timeout=workflow.timedelta(hours=24),
                    )
                
                # Revise the context bundle
                workflow.logger.info("Revising context bundle")
                self._current_status = "revising"
                
                context_bundle = await workflow.execute_activity(
                    llm_generate_activity,
                    args=[
                        "openrouter",
                        "openai/gpt-4o",
                        """You revise context bundles without losing good material.""",
                        f"""<current_context_bundle>
{context_bundle}
</current_context_bundle>

<revision_notes>
{self._revision_notes}
</revision_notes>

Revise the context bundle to implement the revision notes.
Keep it internally consistent and well-structured.

Output ONLY the revised Markdown context bundle.""",
                        0.5,
                        8000,
                    ],
                    start_to_close_timeout=workflow.timedelta(minutes=5),
                    retry_policy=RetryPolicy(maximum_attempts=3),
                )
                
                self._pending_context_bundle = context_bundle
                
                # Loop back for another review
                continue
            
            # If neither APPROVE nor REVISE, treat as approve by default
            workflow.logger.warning(f"Unexpected decision: {self._context_approval}, treating as APPROVE")
            break
        
        return context_bundle

