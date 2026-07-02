import cors from "cors";
import express from "express";
import morgan from "morgan";
import {
  createLot,
  createProduct,
  deleteProduct,
  getAlerts,
  getDashboard,
  getLossReport,
  getProduct,
  initializeDatabase,
  listLots,
  listLosses,
  listMovements,
  listProducts,
  openDatabase,
  recordLoss,
  stockOut,
  updateLot,
  updateProduct
} from "./inventory.js";

export function createApp(db = openDatabase()) {
  initializeDatabase(db);
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.get("/api/products", (req, res) => {
    res.json(listProducts(db, { search: req.query.search }));
  });

  app.get("/api/products/:id", (req, res) => {
    const product = getProduct(db, Number(req.params.id));
    if (!product) return res.status(404).json({ error: "Produto nao encontrado." });
    return res.json({ ...product, lots: listLots(db, { product_id: product.id }) });
  });

  app.post("/api/products", (req, res) => {
    res.status(201).json(createProduct(db, req.body));
  });

  app.put("/api/products/:id", (req, res) => {
    res.json(updateProduct(db, Number(req.params.id), req.body));
  });

  app.delete("/api/products/:id", (req, res) => {
    res.json(deleteProduct(db, Number(req.params.id)));
  });

  app.get("/api/lots", (req, res) => {
    res.json(listLots(db, req.query));
  });

  app.get("/api/lots/:id", (req, res) => {
    const lot = listLots(db).find((item) => item.id === Number(req.params.id));
    if (!lot) return res.status(404).json({ error: "Lote nao encontrado." });
    return res.json(lot);
  });

  app.get("/api/products/:id/lots", (req, res) => {
    res.json(listLots(db, { product_id: Number(req.params.id) }));
  });

  app.post("/api/lots", (req, res) => {
    res.status(201).json(createLot(db, req.body));
  });

  app.put("/api/lots/:id", (req, res) => {
    res.json(updateLot(db, Number(req.params.id), req.body));
  });

  app.get("/api/dashboard", (req, res) => {
    res.json(getDashboard(db));
  });

  app.get("/api/alerts", (req, res) => {
    res.json(getAlerts(db));
  });

  app.post("/api/stock-out", (req, res) => {
    res.status(201).json(stockOut(db, req.body));
  });

  app.get("/api/losses", (req, res) => {
    res.json(listLosses(db));
  });

  app.post("/api/losses", (req, res) => {
    res.status(201).json(recordLoss(db, req.body));
  });

  app.get("/api/reports/losses", (req, res) => {
    res.json(getLossReport(db));
  });

  app.get("/api/movements", (req, res) => {
    res.json(listMovements(db));
  });

  app.use((error, req, res, next) => {
    if (!error) return next();
    const status = error.status || 500;
    return res.status(status).json({
      error: error.message || "Erro interno.",
      code: error.code || "INTERNAL_ERROR",
      details: error.details
    });
  });

  return app;
}
