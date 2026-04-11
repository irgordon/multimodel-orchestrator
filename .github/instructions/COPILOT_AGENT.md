Purpose

Define how Copilot Agents must behave when generating code, tests, or docs.

Enforces

• Copilot MUST read docs/VALIDATOR_BOUNDARY.md before generating anything
• Copilot MUST NOT invent validators
• Copilot MUST NOT modify existing implementation files unless explicitly instructed
• Copilot MUST NOT collapse layers
• Copilot MUST generate deterministic output


Forbids

• “Helpful” cross‑layer blending
• Silent creation of new directories
• Silent modification of schemas
• Silent modification of snapshot rules


Minimal content

• “Always consult VALIDATOR_BOUNDARY.md”
• “Never generate implementation during contract phases”
• “Never modify Phase 0 skeleton”
• “Never generate TODOs or placeholders”