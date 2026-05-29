import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.graph.workflow import graph

async def test_compile():
    print("Context Galaxy LangGraph compiled successfully!")
    print("Compiled Nodes:")
    for node_name in graph.nodes.keys():
        print(f" - {node_name}")
    print("Compilation check passed!")

if __name__ == "__main__":
    asyncio.run(test_compile())
