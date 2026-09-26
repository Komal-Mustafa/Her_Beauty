# Her Beauty (HB) — Project Documentation

> Premium multi-vendor beauty marketplace · **Pink · Gold · White** · v1.0 · 2026-09-25

Put this whole folder in your repo as `/docs`. **AI coding agents: read `memory.md` first, then this file.**

| # | Document | What it answers | Main readers |
|---|---|---|---|
| 01 | [PRD](01-prd.md) | **What** we build and why — features, plans, ad packages, money rules | Client, everyone |
| 02 | [TRD](02-trd.md) | **How** it's built — stack, modules, API, jobs, integrations, targets | Developers |
| 03 | [App & Web Flow](03-app-web-flow.md) | Site map, customer/seller/admin journeys, system flows | Designers, developers, QA |
| 04 | [UI/UX Design](04-ui-ux-design.md) | Pink/gold/white design system, components, page layouts, 3D art direction | Designers, frontend |
| 05 | [Database Schema](05-database-schema.md) | All tables + SQL (tested on PostgreSQL 16), ledger, RLS, indexes | Backend |
| 06 | [Implementation Plan](06-implementation-plan.md) | Team, milestones, sprints, critical path, launch checklist | You, client |
| 07 | [Payment Gateway](07-payment-gateway.md) | Pakistan providers, international path, escrow flow, COD, payouts, reconciliation | Backend, finance, client |
| 08 | [Website Documentation](08-website-documentation.md) | Developer handbook + customer, seller, admin guides | Dev team, support, users |
| 09 | [Runbook](09-runbook.md) | Incidents, kill switches, deploy/rollback, routine ops, payouts run | On-call, finance |
| – | [rules.md](rules.md) | Coding rules everyone must follow | Developers, AI agents |
| – | [security.md](security.md) | Threat model and protections | Developers |
| – | [memory.md](memory.md) | Short, always-current summary + decision log | AI agents (read first) |
| – | [claude-code-prompt.md](claude-code-prompt.md) | Prompts to build the 3D website with Claude Code | You |

**Replaced (old v0.1 files, don't use):** `prd.md`, `architecture.md`, `design.md`, `task.md`.

**Open client questions:** `01-prd.md` §14 — nothing expensive should be built on a `[CONFIRM]` item until it's answered.
