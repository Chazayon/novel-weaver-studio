#!/usr/bin/env python3
"""
Test script for Phase 1 workflow execution.

This script starts Temporal server (if needed), starts the worker,
and triggers a Phase 1 workflow execution.
"""

import asyncio
import httpx
import sys


async def test_phase1_workflow():
    """Test Phase 1 workflow execution."""
    
    print("=" * 70)
    print("Novel Weaver Studio - Phase 1 Workflow Test")
    print("=" * 70)
    
    # Check if API is running
    print("\n1. Checking if API is running...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://localhost:8000/api/health")
            if response.status_code == 200:
                print("   ✅ API is running")
            else:
                print("   ❌ API returned unexpected status")
                sys.exit(1)
    except Exception as e:
        print(f"   ❌ API is not running: {e}")
        print("   Please start the API first: python -m src.main")
        sys.exit(1)
    
    # Create a test project
    print("\n2. Creating test project...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:8000/api/projects",
                json={
                    "title": "Test Novel - Phase 1",
                    "author": "Test Author",
                    "genre": "Fantasy Romance",
                    "seriesLength": 20,
                },
            )
            if response.status_code == 201:
                project = response.json()
                project_id = project["id"]
                print(f"   ✅ Project created: {project_id}")
            else:
                print(f"   ❌ Failed to create project: {response.text}")
                sys.exit(1)
    except Exception as e:
        print(f"   ❌ Error creating project: {e}")
        sys.exit(1)
    
    # Execute Phase 1 workflow
    print("\n3. Starting Phase 1 workflow...")
    print("   NOTE: This requires Temporal server and worker to be running!")
    print("   - Temporal: docker-compose up -d")
    print("   - Worker: python -m src.workflows.worker")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"http://localhost:8000/api/projects/{project_id}/phases/1/execute",
                json={
                    "phase": 1,
                    "inputs": {
                        "genre": "Fantasy Romance",
                        "book_title": "The Crystal Prophecy",
                        "initial_ideas": "A story about a reluctant princess who discovers she can control crystals",
                        "writing_samples": "SKIP",
                        "outline_template": "SKIP",
                        "prohibited_words": "SKIP",
                    },
                },
            )
            if response.status_code == 200:
                result = response.json()
                workflow_id = result["workflowId"]
                print(f"   ✅ Workflow started: {workflow_id}")
                print(f"   📊 Status: {result['status']}")
                print(f"   💡 Current step: {result['currentStep']}")
            else:
                print(f"   ❌ Failed to start workflow: {response.text}")
                sys.exit(1)
    except Exception as e:
        print(f"   ❌ Error starting workflow: {e}")
        print("\n   Make sure Temporal server is running: docker-compose up -d")
        print("   And worker is running: python -m src.workflows.worker")
        sys.exit(1)
    
    # Monitor workflow progress
    print("\n4. Monitoring workflow progress...")
    print("   (This may take several minutes as LLMs generate content)")
    print()
    
    completed = False
    for i in range(60):  # Check for up to 5 minutes
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/projects/{project_id}/phases/1/status",
                    params={"workflow_id": workflow_id},
                )
                if response.status_code == 200:
                    result = response.json()
                    status = result["status"]
                    progress = result["progress"]
                    
                    if status == "completed":
                        print(f"   ✅ Workflow completed! (Progress: {progress}%)")
                        completed = True
                        break
                    elif status == "failed":
                        print(f"   ❌ Workflow failed!")
                        if "error" in result:
                            print(f"   Error: {result['error']}")
                        sys.exit(1)
                    else:
                        print(f"   ⏳ In progress... (Progress: {progress}%)", end="\r")
        except Exception as e:
            print(f"   ⚠️  Error checking status: {e}")
        
        await asyncio.sleep(5)
    
    if not completed:
        print("\n   ⏰ Timeout waiting for workflow completion")
        print("   Check Temporal UI for status: http://localhost:8233")
        sys.exit(1)
    
    # Check generated artifacts
    print("\n5. Checking generated artifacts...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:8000/api/projects/{project_id}/artifacts"
            )
            if response.status_code == 200:
                artifacts = response.json()
                print(f"   ✅ Found {len(artifacts)} artifacts:")
                for artifact in artifacts:
                    print(f"      - {artifact['path']} ({artifact['size']} bytes)")
            else:
                print(f"   ⚠️  Could not list artifacts: {response.text}")
    except Exception as e:
        print(f"   ⚠️  Error listing artifacts: {e}")
    
    print("\n" + "=" * 70)
    print("✅ Phase 1 Workflow Test Complete!")
    print("=" * 70)
    print(f"\nProject ID: {project_id}")
    print(f"Workflow ID: {workflow_id}")
    print(f"\nView artifacts at: ~/.novel-weaver-studio/projects/{project_id}/")
    print(f"View in Temporal UI: http://localhost:8233")
    print()


if __name__ == "__main__":
    asyncio.run(test_phase1_workflow())
