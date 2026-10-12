# docs

## Design documents

| Document | Purpose | Audience |
|---|---|---|
| [architecture/hld.md](architecture/hld.md) | High Level Design: context, components, scheduling integration, security, deployment, decisions needed | Client and team |
| [architecture/lld.md](architecture/lld.md) | Low Level Design: data model, rule engine, API surface, state machines, configuration | Developers |
| [architecture/user-flows.md](architecture/user-flows.md) | Journeys with diagrams, and the questions each one raises | Client walkthrough |

Each marks items as built, planned or blocked, so a reviewer can tell implemented behaviour from
intended behaviour.

## Reference and operations

| Document | Purpose | Status |
|---|---|---|
| [api/openapi.json](api/openapi.json) | The `/api/v1` and `/api/ui` contract, exported from the service and committed. The web client generates its types from it. | Generated |
| `integration-guide.md` | For Fidelity: installing the plugin, configuring it, placing the API key, network requirements. | Not written |
| `runbooks/annual-rollover.md` | Generating the next year of calendar dates. Handover deliverable (O-04). | Not written |
| `runbooks/api-key-rotation.md` | Dual-active-key rotation (5.5). First rotation falls due near contract end (R-08). | Not written |
| `runbooks/admin-bootstrap.md` | First Admin account and password reset procedure (O-01, O-03). | Not written |
| `clarifications.md` | Open questions for Fidelity, tracked to answers. | Superseded by RECORD.md |

Source requirements documents live at the repository root as `.docx` files. Decisions taken
against them are recorded in [RECORD.md](../RECORD.md) — read that before either Word document,
since several statements in them have since been superseded.
