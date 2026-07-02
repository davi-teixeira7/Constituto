import { beforeEach, describe, expect, it } from "vitest";
import {
  createLot,
  createProduct,
  getAlerts,
  getDashboard,
  initializeDatabase,
  listProducts,
  openDatabase,
  recordLoss,
  stockOut
} from "../src/inventory.js";

describe("inventory rules", () => {
  let db;

  beforeEach(() => {
    db = openDatabase(":memory:");
    initializeDatabase(db, { seed: false });
  });

  it("blocks exact duplicate product names and codes, but allows confirmed similar names", () => {
    createProduct(db, {
      name: "Leite integral 1L",
      code: "LEI-1",
      category: "Laticinios",
      min_stock: 10
    });

    expect(() =>
      createProduct(db, {
        name: "Leite integral 1L",
        code: "LEI-2",
        category: "Laticinios",
        min_stock: 10
      })
    ).toThrow(/nome/i);

    expect(() =>
      createProduct(db, {
        name: "Leite integral 1 litro",
        code: "LEI-3",
        category: "Laticinios",
        min_stock: 10
      })
    ).toThrow(/parecido/i);

    const confirmed = createProduct(db, {
      name: "Leite integral 1 litro",
      code: "LEI-3",
      category: "Laticinios",
      min_stock: 10,
      confirmSimilar: true
    });

    expect(confirmed.id).toBeTypeOf("number");

    expect(() =>
      createProduct(db, {
        name: "Outro leite",
        code: "LEI-1",
        category: "Laticinios",
        min_stock: 10
      })
    ).toThrow(/codigo/i);
  });

  it("creates a quick lot with automatic entry date and includes it in product stock", () => {
    const product = createProduct(db, {
      name: "Arroz branco 5kg",
      category: "Mercearia",
      min_stock: 8
    });

    const lot = createLot(db, {
      product_id: product.id,
      initial_quantity: 20,
      expiration_date: "2026-08-20"
    });

    expect(lot.entry_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(lot.current_quantity).toBe(20);
    expect(listProducts(db)[0].total_stock).toBe(20);
  });

  it("stock-out consumes active lots by closest expiration first", () => {
    const product = createProduct(db, {
      name: "Refrigerante cola 2L",
      category: "Bebidas",
      min_stock: 6
    });
    const later = createLot(db, {
      product_id: product.id,
      initial_quantity: 30,
      entry_date: "2026-07-01",
      expiration_date: "2026-09-30"
    });
    const earlier = createLot(db, {
      product_id: product.id,
      initial_quantity: 10,
      entry_date: "2026-07-01",
      expiration_date: "2026-08-10"
    });

    const result = stockOut(db, {
      product_id: product.id,
      quantity: 12,
      now: "2026-07-02"
    });

    expect(result.consumed).toEqual([
      { lot_id: earlier.id, quantity: 10 },
      { lot_id: later.id, quantity: 2 }
    ]);
    expect(db.prepare("SELECT current_quantity, status FROM lots WHERE id = ?").get(earlier.id)).toEqual({
      current_quantity: 0,
      status: "Esgotado"
    });
    expect(db.prepare("SELECT current_quantity FROM lots WHERE id = ?").get(later.id).current_quantity).toBe(28);
  });

  it("loss registration reduces the lot, records a movement, and appears in reports", () => {
    const product = createProduct(db, {
      name: "Iogurte morango",
      category: "Laticinios",
      min_stock: 12
    });
    const lot = createLot(db, {
      product_id: product.id,
      initial_quantity: 15,
      expiration_date: "2026-07-08"
    });

    const loss = recordLoss(db, {
      product_id: product.id,
      lot_id: lot.id,
      quantity: 4,
      reason: "Vencimento",
      estimated_value: 18.5,
      loss_date: "2026-07-02"
    });

    expect(loss.id).toBeTypeOf("number");
    expect(db.prepare("SELECT current_quantity FROM lots WHERE id = ?").get(lot.id).current_quantity).toBe(11);
    expect(db.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE type = 'Perda'").get().count).toBe(1);
  });

  it("dashboard and alerts separate critical stock from expiring lots", () => {
    const product = createProduct(db, {
      name: "Pao de forma 500g",
      category: "Padaria",
      min_stock: 5
    });
    createLot(db, {
      product_id: product.id,
      initial_quantity: 3,
      entry_date: "2026-07-02",
      expiration_date: "2026-07-05"
    });

    const alerts = getAlerts(db, { now: "2026-07-02" });
    const dashboard = getDashboard(db, { now: "2026-07-02" });

    expect(alerts.stockCritical).toHaveLength(1);
    expect(alerts.expiringLots).toHaveLength(1);
    expect(dashboard.criticalProducts).toBe(1);
    expect(dashboard.expiringLots).toBe(1);
  });
});
