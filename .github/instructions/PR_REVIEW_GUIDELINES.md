Purpose

Give reviewers a deterministic checklist.
This prevents subjective review and enforces the contract.

Enforces

• Every PR must declare which layer it touches
• Every PR must include updated fixtures if needed
• Every PR must include updated contract tests if needed
• Every PR must not modify frozen surfaces


Forbids

• PRs that mix layers
• PRs that modify validator boundaries without version bump
• PRs that add new runtime logic without tests


Minimal content

• Layer‑by‑layer review checklist
• “Reject if cross‑layer contamination is detected”
• “Reject if contract tests are missing”