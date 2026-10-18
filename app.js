const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SEV = { info: "ok", warn: "warn", risk: "bad" };
let last = null;

const SAMPLE = `diff --git a/src/auth.js b/src/auth.js
index 3b1f2a9..8c4d7e1 100644
--- a/src/auth.js
+++ b/src/auth.js
@@ -12,14 +12,24 @@ export async function login(email, password) {
   const res = await fetch("/api/login", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ email, password }),
   });
-  const data = await res.json();
-  localStorage.token = data.token;
-  return data.user;
+  if (!res.ok) throw new Error("Invalid email or password");
+  const data = await res.json();
+  console.log("login ok", data);
+  saveSession(data.token, data.expiresIn);
+  return data.user;
+}
+
+export function saveSession(token, expiresIn = 3600) {
+  const expiresAt = Date.now() + expiresIn * 1000;
+  localStorage.setItem("session", JSON.stringify({ token, expiresAt }));
+}
+
+export function getToken() {
+  const s = JSON.parse(localStorage.getItem("session") || "null");
+  if (!s || Date.now() > s.expiresAt) return null;
+  return s.token;
 }
diff --git a/src/api.js b/src/api.js
index 77aa010..91bb2c3 100644
--- a/src/api.js
+++ b/src/api.js
@@ -1,6 +1,8 @@
+import { getToken } from "./auth.js";
+
 export function api(path, opts = {}) {
-  const token = localStorage.token;
+  const token = getToken();
   return fetch(path, {
     ...opts,
     headers: { ...opts.headers, Authorization: token ? \`Bearer \${token}\` : "" },
`;
$("#sample").onclick = () => { $("#diff").value = SAMPLE; $("#issue").value = "#42"; $("#note").value = "Users stayed logged in forever and a failed login crashed the page"; };

function copyBtn(id, label = "Copy") { return `<button class="ghost small" data-copy="${id}" type="button" style="padding:5px 10px;font-size:12px">${label}</button>`; }
document.addEventListener("click", async (e) => {
  const id = e.target?.dataset?.copy; if (!id || !last) return;
  const text = id === "msg" ? last.message : id === "pr" ? `${last.pr?.title}\n\n${last.pr?.description}` : last.changelog;
  await navigator.clipboard.writeText(text || ""); e.target.textContent = "Copied ✓"; setTimeout(() => (e.target.textContent = "Copy"), 1500);
});

function render(d) {
  last = d;
  const rev = (d.review || []).map((r) => `<li><span class="badge ${SEV[r.severity] || ""}">${esc(r.severity)}</span> ${esc(r.note)}</li>`).join("");
  $("#out").innerHTML = `
    <div class="row" style="justify-content:space-between"><div><span class="badge ok">${esc(d.commit?.type)}${d.commit?.scope ? `(${esc(d.commit.scope)})` : ""}</span>
      ${d.commit?.breaking ? `<span class="badge bad">BREAKING</span>` : ""}</div>
      <span class="muted small">${d.stats.files.length} files · <span class="ok">+${d.stats.additions}</span> <span class="bad">-${d.stats.deletions}</span></span></div>
    <div class="sec"><div class="row" style="justify-content:space-between"><h3>Commit message</h3>${copyBtn("msg")}</div><pre>${esc(d.message)}</pre></div>
    <div class="sec"><div class="row" style="justify-content:space-between"><h3>Pull request</h3>${copyBtn("pr")}</div>
      <div style="font-weight:700;margin-bottom:6px">${esc(d.pr?.title)}</div><pre>${esc(d.pr?.description)}</pre></div>
    ${rev ? `<div class="sec"><h3>Review notes</h3><ul class="list">${rev}</ul></div>` : ""}
    ${d.split ? `<div class="sec"><h3>Split suggestion</h3><p class="muted">${esc(d.split)}</p></div>` : ""}
    ${d.changelog ? `<div class="sec"><div class="row" style="justify-content:space-between"><h3>CHANGELOG</h3>${copyBtn("cl")}</div><pre>${esc(d.changelog)}</pre></div>` : ""}
    <p class="muted small">Model: ${esc(d.model)}${d.skipped?.length ? ` · skipped ${esc(d.skipped.join(", "))}` : ""}${d.truncated ? " · diff was truncated" : ""}</p>`;
}

$("#go").onclick = async () => {
  $("#error").innerHTML = "";
  const diff = $("#diff").value;
  if (!diff.trim()) { $("#error").innerHTML = `<div class="err">Paste a diff first, or click "Try a sample diff".</div>`; return; }
  const btn = $("#go"); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Gemma 4 is reading your diff…`;
  try {
    const r = await fetch("/api/craft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diff, style: $("#style").value, issue: $("#issue").value.trim(), context: $("#note").value.trim() }) });
    const d = await r.json().catch(() => ({ error: "Server returned an invalid response" }));
    if (!r.ok) throw new Error(d.error || `Error ${r.status}`);
    render(d);
  } catch (e) { $("#error").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  finally { btn.disabled = false; btn.textContent = "Craft commit & PR"; }
};
