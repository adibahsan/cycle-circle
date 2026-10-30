## Agent Instructions

See `CLAUDE.md` for project context, monorepo layout, import conventions, development workflow, and code-review-graph MCP tool guidance.

For **implement-orchestrated** from Cursor: follow `docs/agents/implement-orchestrated.md` and the Cursor rule `.cursor/rules/implement-orchestrated.mdc` (local; gitignored).

Key starting points for any task:
- **Local setup**: `docs/LOCAL-DEVELOPMENT.md` — Docker + hybrid dev workflow for newcomers
- **Implementation status**: `DEV_SRS.md` — maps every SRS requirement to files and API routes
- **What to build next**: `CHECKLIST.md` — sprint progress with gap analysis
- **Full requirements**: `docs/vesta/source/SRS.md` — IEEE 830 SRS (22 functional requirements)
- **Architecture exploration**: Use `get_architecture_overview` and `semantic_search_nodes` from the code-review-graph MCP tools before reading files
