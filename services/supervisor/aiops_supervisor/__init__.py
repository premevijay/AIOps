"""AIOps NetOps Supervisor — the first agent.

A LangGraph ReAct agent (hosted Claude model behind a ModelProvider seam) that
turns an intent into read-only capability calls on the execution worker, and
proposes — never executes — anything that would mutate a device.
"""

__version__ = "0.1.0"
