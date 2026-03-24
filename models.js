// models.js — single source of truth for all Anthropic model IDs used in this project.
// Update here when Anthropic releases new models or retires old ones.

export const MODELS = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku:  'claude-haiku-4-5-20251001',
};

// Allow env overrides (useful for testing or pinning to a specific version)
export function resolvedModels() {
  return {
    sonnet: process.env.CLAUDE_MODEL       || MODELS.sonnet,
    haiku:  process.env.CLAUDE_HAIKU_MODEL || MODELS.haiku,
  };
}
