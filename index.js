import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

// Autoriser le frontend à accéder à ce backend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Proxy général : redirige tout ce qui commence par /api/
app.use("/api", async (req, res) => {
  const targetUrl = `https://planex.insa-toulouse.fr${req.url}`; // garde le reste du chemin tel quel
  console.log(`➡️ Proxying request to: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: "planex.insa-toulouse.fr" },
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });

    // Copie les en-têtes importants de la réponse
    res.status(response.status);
    response.headers.forEach((value, name) => {
      res.setHeader(name, value);
    });

    // Transmet le contenu
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(500).send("Erreur du proxy");
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy actif sur http://localhost:${PORT}`);
});
