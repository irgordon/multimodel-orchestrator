'use strict';

const { createRequire } = require('node:module');

const requireFromHere = createRequire(__filename);

function resolveCanonicalizeExport(mod) {
  if (typeof mod === 'function') {
    return mod;
  }
  if (mod && typeof mod.canonicalize === 'function') {
    return mod.canonicalize;
  }
  if (mod && typeof mod.default === 'function') {
    return mod.default;
  }
  throw new Error('Canonicalization module does not export a canonicalization function');
}

function wrapCanonicalization(existingCanonicalize, input) {
  if (typeof existingCanonicalize !== 'function') {
    throw new TypeError('existingCanonicalize must be a function');
  }
  return existingCanonicalize(input);
}

function canonicalizeWithModule(modulePath, input) {
  const mod = requireFromHere(modulePath);
  const canonicalize = resolveCanonicalizeExport(mod);
  return wrapCanonicalization(canonicalize, input);
}

module.exports = {
  canonicalizeWithModule,
  resolveCanonicalizeExport,
  wrapCanonicalization,
};
