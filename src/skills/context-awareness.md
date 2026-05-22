---
name: Context Window Awareness
version: 1.0.0
description: Monitor and optimize Claude Code context window usage with CWIM
author: CWIM
---

# Context Window Awareness

You have access to real-time context window monitoring via the CWIM CLI tool. Use it to optimize your performance and avoid silent quality degradation.

## Core Principle

Context degradation begins as early as 25% utilization (~50K/200K tokens). Don't wait for the model to struggle — proactively manage context before it becomes a problem.

## When to Check Context

Check context BEFORE:
1. **Complex multi-step tasks** (>5 files, >3 tool calls expected)
2. **Reading large files** (>1000 tokens estimated)
3. **Spawning subagents** (creates nested context)
4. **Long conversations** (every 8-10 messages)
5. **Context feels "off"** (repetition, forgetting, contradictions)

## How to Check

Run: `cwim status --json`

Parse the JSON for:
- `utilizationPercent` — Current usage (0-1)
- `usedTokens` — Actual tokens consumed
- `messageCount` — Conversation length
- `model` — Current model and window size

## Context Guidelines

### 🟢 Healthy (< 40%)
- Proceed normally
- Full file reads acceptable
- No action needed

### 🟡 Moderate (40-60%)
- Be selective with file reads
- Prefer line ranges over full files
- Consider `/compact` after completing current task
- Mention to user: "Context at 52% — I'll be mindful of file sizes"

### 🟠 High (60-75%)
- **Suggest `/compact` before continuing**
- Only read essential files
- Use subagents for isolated work
- Prioritize: finish current task, then compact

### 🔴 Critical (> 75%)
- **Strongly recommend `/clear` or finishing immediately**
- Avoid any new file reads
- Summarize and save state
- Ask user: "Context at 82% — should I /clear and start fresh, or /compact first?"

## Smart Actions

### Before /compact
Generate a preservation prompt:
```
/compact Preserve: [key decisions, API changes, architectural choices]
Summarize: [implementation progress, current state, next steps]
```

### Before /clear
Save critical state:
```
Let me save our progress before clearing:
- Current task: [what we're doing]
- Key findings: [important discoveries]
- Next steps: [what to do after clear]

/clear
```

### Subagent Delegation
When context is tight but work remains:
```
Context at 68%. I'll delegate [specific isolated task] to a subagent 
to keep our main context focused.
```

### Targeted Reads
Instead of: "Read src/auth.ts"
Say: "Read lines 45-120 of src/auth.ts (the login handler)"

## Project-Specific Context

{PROJECT_CONTEXT}

## Memory

Track these across the conversation:
- Files already read (avoid re-reading)
- Decisions made (preserve in /compact)
- Context checks performed
- User preferences on context management

## Anti-Patterns to Avoid

❌ Reading entire directories recursively
❌ Re-reading files already in context
❌ Starting new features when context >70%
❌ Ignoring context until quality degrades
❌ Long prose responses when context is tight

✅ Line-range reads for specific functions
✅ Targeted grep before full file reads
✅ Proactive /compact at 60%+
✅ Subagent delegation for isolated tasks
✅ Bullet points over paragraphs when context is high

## Commands Reference

- `cwim status --json` — Quick context check
- `cwim dashboard` — Real-time monitoring
- `cwim check` — Project health analysis
- `/compact` — Summarize conversation
- `/clear` — Reset context (start fresh)
