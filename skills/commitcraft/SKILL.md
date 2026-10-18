---
name: commitcraft
description: Write a clear commit message, pull request title and PR description from a git diff, plus a quick review of risky changes. Use when the user asks to "write a commit message", "describe my changes", "open a PR", "write the PR description" or wants their staged changes reviewed before committing. Uses Google Gemma 4 (open-weight) via the Gemini API.
license: MIT
compatibility: Requires Node.js 18+, git, network access to generativelanguage.googleapis.com and a GEMINI_API_KEY environment variable.
metadata:
  author: Ayush Yadav
  version: "1.0.0"
---

# CommitCraft

Turns a git diff into a ready-to-paste commit message (Conventional Commits, Gitmoji or plain), a PR title and Markdown description, a CHANGELOG line, and review notes (leftover debug code, missing tests, possible secrets).
The zero-dependency CLI `cli.js` at the CommitCraft repo root does the work.

## When to use
- The user has local changes and wants a commit message or PR description.
- The user wants a quick sanity review of a diff before committing or opening a PR (e.g. during Hacktoberfest).

## Prerequisites
- Node.js 18 or newer and a git repository with changes.
- `GEMINI_API_KEY` is set (free key: https://aistudio.google.com/apikey). Never print, log or commit the key.

## Steps
1. Make sure the changes are staged: run `git status --short`. If nothing is staged, ask the user which files to include, then `git add <files>`.
2. Generate the texts from the repo root of the user's project:
   `git diff --staged | node <path-to-commitcraft>/cli.js --json`
   Optional flags: `--style conventional|gitmoji|simple`, `--issue "#123"`, `--note "why this change was made"`.
3. Read the JSON. Show the user `message`, `pr.title` and `pr.description`. Mention any `review` items with severity `warn` or `risk`, and the `split` suggestion if it is not empty.
4. Only commit when the user confirms. Then run `git commit -F -` with `message` on stdin (or `node cli.js --commit`, which asks first). Never push without explicit permission.

## Output fields
- `message`: full commit message. `commit`: type, scope, subject, body, breaking.
- `pr.title`, `pr.description` (Markdown with Summary, Changes, How to test, Checklist).
- `changelog`: one CHANGELOG bullet. `review[]`: `{severity, note}`. `split`: how to split a mixed diff.
- `stats`: files, additions, deletions. `skipped`: lockfiles/binaries that were left out.

## Notes
- Lockfiles, minified files, source maps and binaries are dropped and large diffs are cut at about 24k characters to stay inside the free tier.
- If the API says the rate limit was reached, wait a minute and retry once.
