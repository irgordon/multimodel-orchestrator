'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FIXTURES_ROOT = path.resolve(__dirname, '..', 'fixtures');
const INDEX_PATH = path.join(FIXTURES_ROOT, 'fixture_index.json');

function readIndex() {
  return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
}

function resolveFixturePath(fixtureId) {
  const index = readIndex();
  const relativePath = index[fixtureId];
  if (!relativePath) {
    throw new Error(`Unknown fixture ID: ${fixtureId}`);
  }
  const absolutePath = path.join(FIXTURES_ROOT, relativePath);
  if (!absolutePath.startsWith(FIXTURES_ROOT)) {
    throw new Error(`Fixture path escapes fixtures root: ${fixtureId}`);
  }
  return absolutePath;
}

function parseByExtension(absolutePath, content) {
  if (absolutePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  if (absolutePath.endsWith('.ndjson')) {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  return content;
}

function loadFixture(fixtureId) {
  const absolutePath = resolveFixturePath(fixtureId);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return parseByExtension(absolutePath, raw);
}

module.exports = {
  FIXTURES_ROOT,
  loadFixture,
  readIndex,
  resolveFixturePath,
};
