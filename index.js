import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// Parse raw bodies so we can forward arbitrary content (JSON, form-data, etc.)
// Keep limit reasonable to avoid accidental large uploads
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// Autoriser le frontend à accéder à ce backend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Respond to preflight requests immediately
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Proxy général : redirige tout ce qui commence par /api/
app.use("/", async (req, res) => {
  const targetUrl = `https://planex.insa-toulouse.fr${req.url}`; // keep the rest of the path as-is
  console.log(`➡️ Proxying request to: ${targetUrl}`);

  try {
    // Prepare headers: normalize values to strings and replace host
    const forwardedHeaders = {};
    for (const [key, value] of Object.entries(req.headers || {})) {
      // Skip host from incoming request (it's our proxy host)
      if (key.toLowerCase() === "host") continue;
      forwardedHeaders[key] = Array.isArray(value) ? value.join(",") : value;
    }
    forwardedHeaders.host = "planex.insa-toulouse.fr";

    const fetchOptions = {
      method: req.method,
      headers: forwardedHeaders,
      // req.body is a Buffer when using express.raw; only include for non-GET/HEAD
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    };

    const response = await fetch(targetUrl, fetchOptions);

    // Copy status and headers
    res.status(response.status);
    response.headers.forEach((value, name) => {
      // Avoid setting hop-by-hop headers that can confuse Express/clients
      // Also avoid forwarding Content-Encoding and Content-Length because
      // `node-fetch` may already have decompressed the body; leaving
      // Content-Encoding would make browsers try to decode twice and fail
      const lower = name.toLowerCase();
      if (["transfer-encoding", "connection", "content-encoding", "content-length"].includes(lower)) return;
      res.setHeader(name, value);
    });

    // Stream back the body
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res.status(500).send("Erreur du proxy");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy actif sur http://localhost:${PORT}`);
});
