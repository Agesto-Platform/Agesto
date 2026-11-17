# Agesto product documentation

This folder is now the versioned source of product and architecture documentation. External copies and `MicroERP.Doc/` are legacy and must not guide new implementations.

## Documents

| Document | Purpose | Initial state |
|---|---|---|
| `OVERVIEW.md` | product vision and general status | imported; review needed |
| `REQUIREMENTS.md` | expected system behavior | **under audit** after an earlier rebuild |
| `DESIGN.md` | architecture, integrations and experience | imported; review needed |
| `DECISIONS.md` | history of decisions and their rationale | historical source; validate implementation status |
| `TASKS.md` | roadmap and open items | imported; contains old statuses to reconcile |

## Allowed states

- **Implemented:** proven by code and tests in the repository.
- **Decided:** approved by Davi, even if not implemented.
- **Proposed:** hypothesis or alternative awaiting a decision.
- **Obsolete:** kept only for historical context.

Documentation does not turn a proposal into a requirement. When there is a divergence, record the evidence found in the code or Git and ask for the product decision needed.

## Update process

1. Work in a small patch in the same pull request as the change.
2. Cite the task/KAN and, when useful, the commit that proves the implementation.
3. Review the full diff; never replace a whole document to rebuild it.
4. Update `TASKS.md` only after checking code and tests.
5. Keep legacy documents until the audit is finished; deleting them will be a separate task.
