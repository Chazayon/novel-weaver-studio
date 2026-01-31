"""Temporal worker for executing workflows."""

import asyncio
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from ..config import settings
from .activities import (
    llm_generate_activity,
    python_code_activity,
    human_input_activity,
    web_search_activity,
    save_artifact_activity,
    load_artifact_activity,
    parse_outline_activity,
    get_previous_chapter_activity,
    update_manifest_activity,
)
from .phase1_initial_setup import Phase1InitialSetupWorkflow
from .phase2_brainstorming import Phase2BrainstormingWorkflow
from .phase3_call_sheet import Phase3CallSheetWorkflow
from .phase4_characters import Phase4CharactersWorldbuildingWorkflow
from .phase5_chapter_outline import Phase5ChapterOutlineWorkflow
from .phase6_chapter_writing import (
    Phase6SingleChapterWorkflow,
    Phase6SceneBriefWorkflow,
    Phase6FirstDraftWorkflow,
    Phase6ImprovementPlanWorkflow,
    Phase6ApplyImprovementPlanWorkflow,
    Phase6FinalWorkflow,
)
from .phase7_compilation import Phase7FinalCompilationWorkflow


async def run_worker():
    """Start the Temporal worker."""
    logging.basicConfig(level=logging.INFO)
    
    # Connect to Temporal server
    client = await Client.connect(
        settings.temporal_host,
        namespace=settings.temporal_namespace,
    )
    
    # Create worker
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[
            Phase1InitialSetupWorkflow,
            Phase2BrainstormingWorkflow,
            Phase3CallSheetWorkflow,
            Phase4CharactersWorldbuildingWorkflow,
            Phase5ChapterOutlineWorkflow,
            Phase6SingleChapterWorkflow,
            Phase6SceneBriefWorkflow,
            Phase6FirstDraftWorkflow,
            Phase6ImprovementPlanWorkflow,
            Phase6ApplyImprovementPlanWorkflow,
            Phase6FinalWorkflow,
            Phase7FinalCompilationWorkflow,
        ],
        activities=[
            llm_generate_activity,
            python_code_activity,
            human_input_activity,
            web_search_activity,
            save_artifact_activity,
            load_artifact_activity,
            parse_outline_activity,
            get_previous_chapter_activity,
            update_manifest_activity,
        ],
    )
    
    logging.info(f"Worker starting on task queue: {settings.temporal_task_queue}")
    logging.info(f"Registered workflows: All 7 phases complete!")
    
    # Run the worker
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
