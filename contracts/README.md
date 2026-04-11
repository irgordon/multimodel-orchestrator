# Contracts Test Spine

This directory contains contract tests, deterministic fixtures, and shared test utilities for validator boundary enforcement.

## Structure

- `fixtures/`: deterministic fixture corpus consumed by validator tests
- `structural/`: Layer 1 structural validator contract tests
- `semantic/`: Layer 2 semantic validator contract tests
- `determinism/`: Layer 3 determinism validator contract tests
- `safety/`: Layer 4 safety validator contract tests
- `shared/`: deterministic fixture loading and test harness helpers

## Determinism

All fixtures are canonical and loaded by stable fixture IDs through `shared/fixture_loader.js`.
