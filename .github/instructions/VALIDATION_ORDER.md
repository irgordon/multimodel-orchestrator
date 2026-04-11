Purpose

Define the order in which validators and tests must run.
This prevents nondeterministic CI behavior.

Enforces

• Structural → Semantic → Determinism → Safety
• Fail fast on earlier layers
• No running determinism tests if structural tests fail


Forbids

• Parallelizing layers
• Running determinism tests on invalid artifacts


Minimal content

• The four‑layer pipeline
• Expected outputs per layer
• CI ordering rules