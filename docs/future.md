# AgentStudio — Future Features

> Planned features not yet implemented, roughly ordered by dependency.

---

## Agent Intelligence

### Scheduled Agent Templates

Pre-built agent configurations for common recurring tasks (repo monitoring, daily briefings, competitor research, feed summaries) with cron-style scheduling and a template browser.

### Self-Improvement Loop

Research agent identifies features or improvements, creates tasks, coding agent implements them, user approves via the task board. All self-improvement requires manual review.

---

## Content & Media

### Svelte Artifact System

Interactive Svelte components rendered inline in chat via sandboxed iframes. Includes a "Save as Component" promotion workflow to persist artifacts as permanent features.

### Design Generation

Agent produces multiple wireframe/UI variations as Svelte artifacts for user selection on the task board. Chosen design feeds back into implementation. Depends on Svelte Artifact System.

---

## Agent Collaboration

### A2A Protocol Support

Structured agent-to-agent communication standard (AgentCard, Task, Message, Artifact types) replacing raw delegation with a formal protocol layer.

### Agent Teams

Persistent collaborative agent groups with shared objectives, role-based coordination, dependency-aware scheduling, shared context/artifacts, and team-level observability. Multiple teams run concurrently across different domains.

---

## Testing Infrastructure

### Test Runner Service

Sandbox runs Playwright tests as an agent tool. Structured test results stored on task records.

### Test Recording Artifacts

Video and screenshots from test runs stored on task records for visual verification.

### Test Gate Enforcement

Failing tests block task approval (configurable strict or advisory mode).

### Agent-Written Tests

Coding agent writes Playwright tests as part of every implementation task.

---

## Visualization

### Pipeline View

Horizontal swimlane view showing team workflow stages end to end. Depends on Agent Teams.

### Project Board

High-level view across teams with shipping timeline and cost/velocity metrics. Depends on Agent Teams.

---

## Self-Management

### Repo Management

GitHub API integration for releases, README updates, documentation generation, issue triage, changelog, demo assets, and community promotion via agent templates.

---

## Other

### Voice Input/Output

Speech-to-text and text-to-speech for hands-free interaction.
