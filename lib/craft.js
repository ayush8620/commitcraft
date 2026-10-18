// Core logic shared by the web API, the CLI and the Agent Skill.
const { gemmaJSON } = require("../api/_gemma");

const STYLES = { conventional: "Conventional Commits (type(scope): subject)", gitmoji: "Gitmoji (emoji + subject)", simple: "plain imperative subject" };
const MAX_DIFF = 24000;

// Keep the diff small: drop lockfiles/binaries and cap the size so it fits the free tier.
function trimDiff(diff) {
  const files = String(diff || "").split(/^(?=diff --git )/m);
  const skipped = [];
  const kept = files.filter((f) => {
    const m = /^diff --git a\/(\S+)/.exec(f);
    if (m && (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|.*\.min\.(js|css)|.*\.map)$/.test(m[1]) || /^Binary files/m.test(f))) { skipped.push(m[1]); return false; }
    return true;
  }).join("");
  const truncated = kept.length > MAX_DIFF;
  return { diff: truncated ? kept.slice(0, MAX_DIFF) + "\n…(diff truncated)" : kept, skipped, truncated };
}

function stats(diff) {
  const files = new Set(); let add = 0, del = 0;
  for (const l of String(diff).split("\n")) {
    const m = /^diff --git a\/(\S+)/.exec(l); if (m) files.add(m[1]);
    else if (l.startsWith("+") && !l.startsWith("+++")) add++;
    else if (l.startsWith("-") && !l.startsWith("---")) del++;
  }
  return { files: [...files], additions: add, deletions: del };
}

async function craft({ diff, style = "conventional", context = "", issue = "" }) {
  if (!String(diff || "").trim()) throw Object.assign(new Error("Paste a git diff first (git diff --staged)"), { status: 400 });
  const t = trimDiff(diff);
  const st = stats(t.diff);
  const prompt = `You are CommitCraft, a senior open-source maintainer who writes perfect commit messages and pull requests.
Commit style: ${STYLES[style] || STYLES.conventional}.
${context ? `Author's note about the change: ${String(context).slice(0, 800)}` : ""}
${issue ? `Related issue: ${String(issue).slice(0, 100)} (reference it with "Closes ${String(issue).slice(0, 100)}")` : ""}
Changed files: ${st.files.join(", ") || "unknown"} (+${st.additions} / -${st.deletions}).
Only describe what the diff really does. Subject line max 72 chars, imperative mood, no trailing period.
Return ONLY JSON:
{"commit":{"type":"feat|fix|docs|style|refactor|perf|test|build|ci|chore","scope":"short or empty","subject":"...","body":"wrapped lines explaining why + what, may be empty","breaking":false},
"message":"the full ready-to-paste commit message in the requested style (subject, blank line, body, footer)",
"pr":{"title":"...","description":"Markdown with ## Summary, ## Changes (bullets), ## How to test (numbered), ## Checklist (- [ ] items)"},
"changelog":"one CHANGELOG.md bullet",
"review":[{"severity":"info|warn|risk","note":"possible bug, missing test, leftover debug code, secret, etc."}],
"split":"if the diff mixes unrelated changes, suggest how to split into commits, else empty string"}

DIFF:
${t.diff}`;
  const { data, model } = await gemmaJSON(prompt, { maxOutputTokens: 2500 });
  return { ...data, stats: st, skipped: t.skipped, truncated: t.truncated, model };
}
module.exports = { craft, trimDiff, stats, STYLES };
