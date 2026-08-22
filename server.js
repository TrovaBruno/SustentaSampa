/**
 * FloodGuard — Backend MVP (Node.js + Express)
 * Execute com:  node server.js   (http://localhost:3000)
 *
 * Camada de dados EM MEMÓRIA e maleável: troque as funções do objeto `db`
 * por queries SQL (Postgres/MySQL) ou NoSQL (Mongo) mantendo as assinaturas.
 */
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------- DADOS EM MEMÓRIA ------------------------- */
const WEIGHTS = { transitavel: 0.35, veiculos_altos: 0.7, intransitavel: 1 };
const LEVEL_BOOST = { canela: 0, joelho: 0.1, acima_capo: 0.25 };
const computeWeight = (t, w) => Math.min(1, (WEIGHTS[t] || 0.35) + (LEVEL_BOOST[w] || 0));

const db = {
  reports: [
    [-23.5505, -46.6333, "intransitavel", "acima_capo"],
    [-23.5535, -46.6395, "veiculos_altos", "joelho"],
    [-23.5478, -46.6289, "transitavel", "canela"],
    [-23.5561, -46.6421, "intransitavel", "joelho"],
    [-23.5442, -46.6355, "veiculos_altos", "canela"],
    [-23.5589, -46.6301, "transitavel", "canela"],
    [-23.5512, -46.6448, "intransitavel", "acima_capo"],
  ].map((r, i) => ({
    id: `seed-${i}`,
    lat: r[0],
    lng: r[1],
    trafficability: r[2],
    waterLevel: r[3],
    weight: computeWeight(r[2], r[3]),
    createdAt: new Date(Date.now() - i * 720000).toISOString(),
    userId: "guardiao-1",
  })),
  users: {
    "guardiao-1": { id: "guardiao-1", name: "Guardião da Cidade", points: 40, reports: 4 },
  },
};

/* --------------------------- HAVERSINE ------------------------------ */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ----------------------------- ROTAS -------------------------------- */
app.get("/api/risk-status", (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Parâmetros lat e lng são obrigatórios" });
  }
  const radiusKm = 1;
  const nearby = db.reports.filter((r) => haversineKm(lat, lng, r.lat, r.lng) <= radiusKm);
  const score = nearby.reduce((acc, r) => acc + r.weight, 0);
  let level = "Baixo";
  if (score >= 3.5) level = "Crítico";
  else if (score >= 2) level = "Alto";
  else if (score >= 0.8) level = "Médio";
  res.json({ level, score: Number(score.toFixed(2)), reportsNearby: nearby.length, radiusKm });
});

app.get("/api/heatmap-data", (_req, res) => {
  res.json({ points: db.reports.map((r) => [r.lat, r.lng, r.weight]) });
});

app.post("/api/reports", (req, res) => {
  const { lat, lng, trafficability, waterLevel, userId = "guardiao-1" } = req.body || {};
  if (
    !Number.isFinite(Number(lat)) ||
    !Number.isFinite(Number(lng)) ||
    !WEIGHTS[trafficability] ||
    !(waterLevel in LEVEL_BOOST)
  ) {
    return res.status(400).json({ error: "Payload inválido" });
  }
  const report = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    lat: Number(lat),
    lng: Number(lng),
    trafficability,
    waterLevel,
    weight: computeWeight(trafficability, waterLevel),
    createdAt: new Date().toISOString(),
    userId,
  };
  db.reports.push(report);

  const user =
    db.users[userId] || (db.users[userId] = { id: userId, name: "Guardião da Cidade", points: 0, reports: 0 });
  user.points += 10; // Gamificação: +10 pontos por reporte
  user.reports += 1;

  res.status(201).json({ report, user, pointsEarned: 10 });
});

app.get("/api/profile/:userId", (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json(user);
});

app.listen(PORT, () => console.log(`FloodGuard rodando em http://localhost:${PORT}`));
