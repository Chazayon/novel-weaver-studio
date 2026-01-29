#!/usr/bin/env python3
"""
Test script for Phase 2 workflow execution.

This uses the output from Phase 1 test to generate a series outline.
"""

import asyncio
import httpx
import sys


async def test_phase2_workflow():
    """Test Phase 2 workflow execution."""
    
    print("=" * 70)
    print("Novel Weaver Studio - Phase 2 Workflow Test")
    print("=" * 70)
    
    # Use the project ID from Phase 1 test
    # You can change this to any project that has Phase 1 complete
    project_id = "2a691021-9fa7-4c74-af5a-6ac801301c0e"
    
    print(f"\nUsing project from Phase 1: {project_id}")
    
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
        print("   Please start the API first")
        sys.exit(1)
    
    # Execute Phase 2 workflow
    print("\n2. Starting Phase 2 workflow (auto-approve mode)...")
    print("   NOTE: This requires Temporal server and worker to be running!")
    print()
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"http://localhost:8000/api/projects/{project_id}/phases/2/execute",
                json={
                    "phase": 2,
                    "inputs": {
                        "extra_notes": "Focus on creating compelling character arcs and romantic tension",
                        "auto_approve": True,  # Skip human review for testing
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
        sys.exit(1)
    
    # Monitor workflow progress
    print("\n3. Monitoring workflow progress...")
    print("   (This may take a few minutes as LLMs generate the series outline)")
    print()
    
    completed = False
    for i in range(120):  # Check for up to 10 minutes
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://localhost:8000/api/projects/{project_id}/phases/2/status",
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
    print("\n4. Checking generated artifacts...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://localhost:8000/api/projects/{project_id}/artifacts"
            )
            if response.status_code == 200:
                artifacts = response.json()
                print(f"   ✅ Found {len(artifacts)} artifacts total")
                
                # Find Phase 2 artifacts
                phase2_artifacts = [a for a in artifacts if "phase2" in a["path"]]
                if phase2_artifacts:
                    print(f"   📄 Phase 2 artifacts:")
                    for artifact in phase2_artifacts:
                        print(f"      - {artifact['path']} ({artifact['size']} bytes)")
                else:
                    print("   ⚠️  No Phase 2 artifacts found yet")
            else:
                print(f"   ⚠️  Could not list artifacts: {response.text}")
    except Exception as e:
        print(f"   ⚠️  Error listing artifacts: {e}")
    
    print("\n" + "=" * 70)
    print("✅ Phase 2 Workflow Test Complete!")
    print("=" * 70)
    print(f"\nProject ID: {project_id}")
    print(f"Workflow ID: {workflow_id}")
    print(f"\nView artifacts at: ~/.novel-weaver-studio/projects/{project_id}/phase2_outputs/")
    print(f"View in Temporal UI: http://localhost:8233")
    print()


if __name__ == "__main__":
    asyncio.run(test_phase2_workflow())
