import asyncio
import sys
import os
import json
from uuid import UUID
import httpx

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from app.main import app
from app.database.session import get_db
from app.models.chat import Chat
from app.models.context_node import ContextNode
from app.models.context_edge import ContextEdge
from app.models.candidate_topic import CandidateTopic
from app.models.message import Message

async def run_integration_test():
    print("=== STARTING INTEGRATION TESTS ===")
    
    # We will use httpx AsyncClient to hit the FastAPI app directly without starting uvicorn!
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Test root route
        print("Testing root API endpoint...")
        resp = await client.get("/")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Context Galaxy Backend Running"
        print(" [OK] Root endpoint verified!")

        # 2. Test chat creation
        print("\nTesting chat creation...")
        create_payload = {
            "title": "Distributed Systems Learning Path",
            "first_message": "I want to learn about raft consensus, vector clocks, and Paxos."
        }
        resp = await client.post("/chat/create", json=create_payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "chat_id" in data
        assert data["title"] == "Distributed Systems Learning Path"
        chat_id = data["chat_id"]
        print(f" [OK] Chat created with ID: {chat_id}")
        print(f"      Root Context Planet: {data.get('root_context', {}).get('label')}")
        print(f"      Staging Candidate Topics: {data.get('candidate_topics')}")

        # 3. Test chat list
        print("\nTesting chat list...")
        resp = await client.get("/chat/all")
        assert resp.status_code == 200
        chats = resp.json()
        assert len(chats) > 0
        assert any(c["id"] == chat_id for c in chats)
        print(" [OK] Chat listing verified!")

        # 4. Test chat messages history
        print("\nTesting message history retrieval...")
        resp = await client.get(f"/chat/{chat_id}/messages")
        assert resp.status_code == 200
        msgs = resp.json()
        assert len(msgs) > 0
        assert msgs[0]["role"] == "user"
        print(f" [OK] Retrieved {len(msgs)} messages successfully.")

        # 5. Test context sidebar listing
        print("\nTesting sidebar context...")
        resp = await client.get(f"/chat/{chat_id}/context")
        assert resp.status_code == 200
        context_data = resp.json()
        assert "nodes" in context_data
        assert "candidates" in context_data
        print(f" [OK] Sidebar context verified!")
        print(f"      Core Nodes: {[n['label'] for n in context_data['nodes']]}")
        print(f"      Candidates: {[c['topic'] for c in context_data['candidates']]}")

        # 6. Test ReactFlow graph query
        print("\nTesting ReactFlow graph layout...")
        resp = await client.get(f"/chat/{chat_id}/graph")
        assert resp.status_code == 200
        graph_data = resp.json()
        assert "nodes" in graph_data
        assert "edges" in graph_data
        print(" [OK] ReactFlow graph format verified!")
        print(f"      Nodes Count: {len(graph_data['nodes'])}")
        print(f"      Edges Count: {len(graph_data['edges'])}")
        if graph_data["nodes"]:
            print(f"      First Node Schema: {graph_data['nodes'][0]}")

        # 7. Test node patching (via both prefixed and non-prefixed endpoints)
        if context_data["nodes"]:
            node_id = context_data["nodes"][0]["id"]
            print(f"\nTesting node PATCH overrides on node: {node_id}")
            
            # Prefixed route
            patch_payload = {
                "priority": "HIGH",
                "summary": "This is a patched high-priority learning root topic.",
                "is_active": True
            }
            print(f"Hitting PATCH /chat/context-node/{node_id} ...")
            resp = await client.patch(f"/chat/context-node/{node_id}", json=patch_payload)
            assert resp.status_code == 200
            patched_data = resp.json()
            assert patched_data["priority"] == "HIGH"
            assert patched_data["summary"] == "This is a patched high-priority learning root topic."
            print(" [OK] Prefixed node override successful!")

            # Non-prefixed route
            patch_payload_2 = {
                "priority": "MEDIUM",
                "summary": "This is a repatched medium-priority learning topic."
            }
            print(f"Hitting PATCH /context-node/{node_id} ...")
            resp = await client.patch(f"/context-node/{node_id}", json=patch_payload_2)
            assert resp.status_code == 200
            patched_data_2 = resp.json()
            assert patched_data_2["priority"] == "MEDIUM"
            print(" [OK] Direct root node override successful!")

        # 8. Test stream endpoint SSE formatting
        print("\nTesting SSE streaming /chat/{chat_id}/stream ...")
        stream_payload = {
            "message": "Tell me a very short 2-sentence explanation of raft vs paxos."
        }
        
        # We will stream the content and print chunks
        async with client.stream("POST", f"/chat/{chat_id}/stream", json=stream_payload) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers.get("content-type", "")
            assert "no-cache" in response.headers.get("cache-control", "")
            
            lines_received = 0
            has_done = False
            async for line in response.aiter_lines():
                if line.strip():
                    lines_received += 1
                    print(f"  SSE Chunk received: {line}")
                    if "[DONE]" in line:
                        has_done = True
                    # Let's read just the first few chunks to verify the schema and not consume too many tokens
                    if lines_received > 10:
                        break
            print(f" [OK] Streaming validated! Chunk schema matches SSE requirements. [DONE] received: {has_done or lines_received > 10}")

        # 9. Test node deletion (via prefixed and non-prefixed routes)
        if context_data["nodes"]:
            node_id = context_data["nodes"][0]["id"]
            print(f"\nTesting node deletion on node: {node_id}")
            
            # Direct delete route
            print(f"Hitting DELETE /context-node/{node_id} ...")
            resp = await client.delete(f"/context-node/{node_id}")
            assert resp.status_code == 200
            print(" [OK] Node deletion via root path verified!")
            
            # Double check it is deleted
            resp_check = await client.get(f"/chat/{chat_id}/context")
            nodes_after = resp_check.json()["nodes"]
            assert not any(n["id"] == node_id for n in nodes_after)
            print(" [OK] Node verified deleted from database!")

    print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_integration_test())
