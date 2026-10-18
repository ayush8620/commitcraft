// POST /api/craft { diff, style?, context?, issue? }
const { readBody } = require("./_gemma");
const { craft } = require("../lib/craft");
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try { res.status(200).json(await craft(readBody(req))); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || "Something went wrong" }); }
};
