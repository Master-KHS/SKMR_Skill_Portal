# AGENTS.md - SKMR Skill Portal Common Rules

This file is the shared rulebook for AI coding agents working on this repository.
Claude Code reads `CLAUDE.md`, Codex reads `AGENTS.md`, but this file is the single source of truth.

## 1. Project Scope

- Repository: `Master-KHS/SKMR_Skill_Portal`
- Active implementation: `web/` Next.js app
- Reference implementation: Streamlit app under `app/`
- Goal: rebuild and improve the SKMR Skill Portal in Next.js while preserving original behavior, permissions, and data flow.

## 2. Collaboration Rules

1. Start by updating from remote whenever possible: `git fetch origin` and rebase or fast-forward before work.
2. Commit and push in small checkpoints.
3. Do not silently discard another agent's or user's work.
4. Resolve conflicts by preserving both intentions when practical.
5. Before pushing, run type/build verification at minimum: `cd web && ./node_modules/.bin/tsc.cmd --noEmit`.
6. Current shared branch: `claude/skmr-hr-planning-nmgtpl`.

## 3. Data Ownership

- `web/data/members.xlsx` is the SSOT for member master data.
- SQLite is the local app store/cache for operational data such as policies, required skills, assessments, evidence, and skill profiles.
- Do not move non-member operational tables to Excel unless the user explicitly defines that new SSOT.
- For `xlsx`, use buffer-based IO:
  - read: `fs.readFileSync` + `XLSX.read(buf, { type: "buffer" })`
  - write: `XLSX.write(wb, { type: "buffer" })` + `fs.writeFileSync`
  - avoid `XLSX.readFile()` / `XLSX.writeFile()` in standalone/runtime code.

## 4. Implementation Order

1. Check the Streamlit original first: `app/views/*`, `app/*.py`, and seed/schema files.
2. Check the current Next.js implementation: `web/app/*`, `web/components/*`, `web/lib/*`, `web/app/api/*`.
3. Compare behavior, permissions, data persistence, and workflow state.
4. Implement with server/API rules, not UI-only blocking.
5. Verify with typecheck and local page/API checks.

## 5. Permission Rules

- The top bar persona system is identity: `권한 -> 사람`.
- `employee`: own data only.
- `team_leader`: own team scope; cannot leader-assess self.
- `calibration`: own division scope.
- `committee` and `hr_admin`: broader operational scope as implemented by module.
- UI restrictions must also be enforced in APIs.

## 6. Functional Priorities

Foundation:
- `policy`
- `skill-master`
- `member-mgmt`
- `eval-lines`
- `system-setting`

Assessment:
- required skill definition
- self assessment
- leader assessment self-evaluation prevention
- calibration and committee scope
- narrative workflow
- final skill profile

Reporting:
- dashboard
- talent search
- exports

AI talent search:
- Do not invent raw data schemas before the user provides the agent/raw-data definition.

## 7. Required Skill Structure

Required skills use the existing layered model:

- `company / ALL`: company-wide required/core skills
- `department / team`: team-level required/core skills
- `individual / employee_id`: approved personal required skills

Effective requirements are calculated as company + team + approved individual, using the highest target level and core union where the same skill appears more than once.

## 8. Done Criteria

A task is done only when:

1. Original behavior is preserved or intentionally improved.
2. Server/API permissions are enforced.
3. Save and reload behavior is consistent.
4. Typecheck passes.
5. Relevant page/API checks pass.

