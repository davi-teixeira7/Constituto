import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../data.db");

const STATUS_ACTIVE = "Ativo";
const STATUS_EMPTY = "Esgotado";
const STATUS_EXPIRED = "Vencido";

export function openDatabase(filename = DB_PATH) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  return db;
}

export function initializeDatabase(db, options = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      category TEXT NOT NULL,
      main_supplier TEXT,
      min_stock INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      initial_quantity INTEGER NOT NULL,
      current_quantity INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      supplier TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Ativo',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS losses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      lot_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      estimated_value REAL,
      loss_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      lot_id INTEGER,
      type TEXT NOT NULL,
      quantity INTEGER,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE SET NULL
    );
  `);

  if (options.seed !== false) {
    seedDatabase(db);
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnly(value) {
  return value || today();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] =
        a[i - 1] === b[j - 1]
          ? rows[i - 1][j - 1]
          : Math.min(rows[i - 1][j - 1] + 1, rows[i][j - 1] + 1, rows[i - 1][j] + 1);
    }
  }
  return rows[a.length][b.length];
}

function isSimilarName(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right || left === right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const max = Math.max(left.length, right.length);
  return max >= 8 && levenshtein(left, right) / max <= 0.28;
}

function appError(message, status = 400, code = "VALIDATION_ERROR", details = undefined) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function assertPositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw appError(`${label} deve ser um numero inteiro positivo.`);
  }
  return number;
}

function refreshLotStatuses(db, now = today()) {
  db.prepare(
    "UPDATE lots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE current_quantity <= 0 AND status != ?"
  ).run(STATUS_EMPTY, STATUS_EMPTY);
  db.prepare(
    "UPDATE lots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE current_quantity > 0 AND expiration_date < ? AND status = ?"
  ).run(STATUS_EXPIRED, now, STATUS_ACTIVE);
}

function addMovement(db, { product_id, lot_id = null, type, quantity = null, description }) {
  return db
    .prepare(
      `INSERT INTO stock_movements (product_id, lot_id, type, quantity, description)
       VALUES (@product_id, @lot_id, @type, @quantity, @description)`
    )
    .run({ product_id, lot_id, type, quantity, description });
}

export function createProduct(db, input) {
  const name = String(input.name || "").trim();
  const code = input.code ? String(input.code).trim() : null;
  const category = String(input.category || "").trim();
  const min_stock = Math.max(0, Number(input.min_stock || 0));

  if (!name) throw appError("Nome do produto e obrigatorio.");
  if (!category) throw appError("Categoria e obrigatoria.");
  if (!Number.isInteger(min_stock)) throw appError("Estoque minimo deve ser um numero inteiro.");

  if (code) {
    const existingCode = db.prepare("SELECT id, name FROM products WHERE lower(code) = lower(?)").get(code);
    if (existingCode) throw appError("Ja existe produto cadastrado com este codigo.", 409, "DUPLICATE_CODE");
  }

  const products = db.prepare("SELECT id, name FROM products").all();
  const exact = products.find((product) => normalize(product.name) === normalize(name));
  if (exact) throw appError("Ja existe produto cadastrado com este nome.", 409, "DUPLICATE_NAME");

  const similar = products.find((product) => isSimilarName(product.name, name));
  if (similar && !input.confirmSimilar) {
    throw appError("Existe um produto com nome parecido. Confirme para salvar mesmo assim.", 409, "SIMILAR_PRODUCT", similar);
  }

  const result = db
    .prepare(
      `INSERT INTO products (name, code, category, main_supplier, min_stock, notes)
       VALUES (@name, @code, @category, @main_supplier, @min_stock, @notes)`
    )
    .run({
      name,
      code,
      category,
      main_supplier: input.main_supplier || null,
      min_stock,
      notes: input.notes || null
    });

  return getProduct(db, result.lastInsertRowid);
}

export function updateProduct(db, id, input) {
  const product = getProduct(db, id);
  if (!product) throw appError("Produto nao encontrado.", 404, "NOT_FOUND");

  const next = {
    name: String(input.name || product.name).trim(),
    code: input.code === "" ? null : input.code ?? product.code,
    category: String(input.category || product.category).trim(),
    main_supplier: input.main_supplier ?? product.main_supplier,
    min_stock: Number(input.min_stock ?? product.min_stock),
    notes: input.notes ?? product.notes,
    id
  };

  if (!next.name || !next.category) throw appError("Nome e categoria sao obrigatorios.");
  if (!Number.isInteger(next.min_stock) || next.min_stock < 0) {
    throw appError("Estoque minimo deve ser um numero inteiro nao negativo.");
  }

  if (next.code) {
    const existingCode = db
      .prepare("SELECT id FROM products WHERE lower(code) = lower(?) AND id != ?")
      .get(next.code, id);
    if (existingCode) throw appError("Ja existe produto cadastrado com este codigo.", 409, "DUPLICATE_CODE");
  }

  const exact = db
    .prepare("SELECT id, name FROM products WHERE id != ?")
    .all(id)
    .find((item) => normalize(item.name) === normalize(next.name));
  if (exact) throw appError("Ja existe produto cadastrado com este nome.", 409, "DUPLICATE_NAME");

  db.prepare(
    `UPDATE products
     SET name = @name, code = @code, category = @category, main_supplier = @main_supplier,
         min_stock = @min_stock, notes = @notes, updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run(next);

  addMovement(db, {
    product_id: Number(id),
    type: "Edicao de produto",
    description: `Produto ${next.name} atualizado.`
  });

  return getProduct(db, id);
}

export function deleteProduct(db, id) {
  const linkedLots = db.prepare("SELECT COUNT(*) AS count FROM lots WHERE product_id = ?").get(id).count;
  if (linkedLots > 0) {
    throw appError("Produto possui lotes vinculados e nao pode ser excluido.", 409, "PRODUCT_HAS_LOTS");
  }
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (!result.changes) throw appError("Produto nao encontrado.", 404, "NOT_FOUND");
  return { ok: true };
}

export function getProduct(db, id, options = {}) {
  refreshLotStatuses(db, options.now);
  const product = db
    .prepare(
      `SELECT p.*,
              COALESCE(SUM(CASE WHEN l.status = 'Ativo' THEN l.current_quantity ELSE 0 END), 0) AS total_stock
       FROM products p
       LEFT JOIN lots l ON l.product_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`
    )
    .get(id);
  if (!product) return null;
  return decorateProduct(product);
}

export function listProducts(db, options = {}) {
  refreshLotStatuses(db, options.now);
  const query = normalize(options.search || "");
  return db
    .prepare(
      `SELECT p.*,
              COALESCE(SUM(CASE WHEN l.status = 'Ativo' THEN l.current_quantity ELSE 0 END), 0) AS total_stock,
              MIN(CASE WHEN l.status = 'Ativo' THEN l.expiration_date ELSE NULL END) AS nearest_expiration
       FROM products p
       LEFT JOIN lots l ON l.product_id = p.id
       GROUP BY p.id
       ORDER BY
        CASE
          WHEN COALESCE(SUM(CASE WHEN l.status = 'Ativo' THEN l.current_quantity ELSE 0 END), 0) <= p.min_stock THEN 0
          WHEN MIN(CASE WHEN l.status = 'Ativo' THEN l.expiration_date ELSE NULL END) IS NOT NULL THEN 1
          ELSE 2
        END,
        p.name COLLATE NOCASE`
    )
    .all()
    .map(decorateProduct)
    .filter((product) => {
      if (!query) return true;
      return normalize(product.name).includes(query) || normalize(product.code).includes(query);
    });
}

function decorateProduct(product) {
  const total = Number(product.total_stock || 0);
  const min = Number(product.min_stock || 0);
  let status = "Normal";
  if (total <= min) status = "Critico";
  else if (total <= min * 2) status = "Estoque baixo";
  return { ...product, total_stock: total, min_stock: min, status };
}

export function createLot(db, input) {
  const product = getProduct(db, input.product_id);
  if (!product) throw appError("Produto vinculado nao encontrado.", 404, "PRODUCT_NOT_FOUND");

  const initial_quantity = assertPositiveInteger(input.initial_quantity ?? input.quantity, "Quantidade");
  const entry_date = toDateOnly(input.entry_date);
  const expiration_date = String(input.expiration_date || "").slice(0, 10);
  if (!expiration_date) throw appError("Data de validade e obrigatoria.");

  const result = db
    .prepare(
      `INSERT INTO lots (product_id, initial_quantity, current_quantity, entry_date, expiration_date, supplier, notes, status)
       VALUES (@product_id, @initial_quantity, @current_quantity, @entry_date, @expiration_date, @supplier, @notes, @status)`
    )
    .run({
      product_id: Number(input.product_id),
      initial_quantity,
      current_quantity: initial_quantity,
      entry_date,
      expiration_date,
      supplier: input.supplier || null,
      notes: input.notes || null,
      status: STATUS_ACTIVE
    });

  addMovement(db, {
    product_id: Number(input.product_id),
    lot_id: result.lastInsertRowid,
    type: "Entrada de lote",
    quantity: initial_quantity,
    description: `Entrada de ${initial_quantity} unidade(s) para ${product.name}.`
  });

  return getLot(db, result.lastInsertRowid);
}

export function updateLot(db, id, input) {
  const lot = getLot(db, id);
  if (!lot) throw appError("Lote nao encontrado.", 404, "NOT_FOUND");

  const next = {
    id,
    initial_quantity: Number(input.initial_quantity ?? lot.initial_quantity),
    current_quantity: Number(input.current_quantity ?? lot.current_quantity),
    entry_date: input.entry_date || lot.entry_date,
    expiration_date: input.expiration_date || lot.expiration_date,
    supplier: input.supplier ?? lot.supplier,
    notes: input.notes ?? lot.notes,
    status: input.status || lot.status
  };
  if (!Number.isInteger(next.initial_quantity) || next.initial_quantity <= 0) throw appError("Quantidade inicial invalida.");
  if (!Number.isInteger(next.current_quantity) || next.current_quantity < 0) throw appError("Quantidade atual invalida.");

  db.prepare(
    `UPDATE lots
     SET initial_quantity = @initial_quantity, current_quantity = @current_quantity,
         entry_date = @entry_date, expiration_date = @expiration_date, supplier = @supplier,
         notes = @notes, status = @status, updated_at = CURRENT_TIMESTAMP
     WHERE id = @id`
  ).run(next);

  addMovement(db, {
    product_id: lot.product_id,
    lot_id: Number(id),
    type: "Edicao de lote",
    description: `Lote #${id} atualizado.`
  });

  return getLot(db, id);
}

export function getLot(db, id, options = {}) {
  refreshLotStatuses(db, options.now);
  return db
    .prepare(
      `SELECT l.*, p.name AS product_name
       FROM lots l
       JOIN products p ON p.id = l.product_id
       WHERE l.id = ?`
    )
    .get(id);
}

export function listLots(db, options = {}) {
  refreshLotStatuses(db, options.now);
  const filters = [];
  const params = {};
  if (options.product_id) {
    filters.push("l.product_id = @product_id");
    params.product_id = Number(options.product_id);
  }
  if (options.status) {
    filters.push("l.status = @status");
    params.status = options.status;
  }
  if (options.filter === "expiring") {
    filters.push("l.status = 'Ativo' AND l.expiration_date BETWEEN @today AND @limit");
    params.today = options.now || today();
    params.limit = addDays(params.today, 7);
  }
  if (options.filter === "expired") filters.push("l.status = 'Vencido'");
  if (options.filter === "active") filters.push("l.status = 'Ativo'");
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT l.*, p.name AS product_name
       FROM lots l
       JOIN products p ON p.id = l.product_id
       ${where}
       ORDER BY l.expiration_date ASC, l.id DESC`
    )
    .all(params);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getAlerts(db, options = {}) {
  const now = options.now || today();
  refreshLotStatuses(db, now);
  const products = listProducts(db, { now });
  const lots = listLots(db, { now });
  return {
    stockCritical: products
      .filter((product) => product.total_stock <= product.min_stock)
      .map((product) => ({
        type: "Estoque critico",
        product_id: product.id,
        product_name: product.name,
        current_quantity: product.total_stock,
        message: `${product.name} esta com ${product.total_stock} unidade(s), minimo ${product.min_stock}.`
      })),
    stockLow: products
      .filter((product) => product.total_stock > product.min_stock && product.total_stock <= product.min_stock * 2)
      .map((product) => ({
        type: "Estoque baixo",
        product_id: product.id,
        product_name: product.name,
        current_quantity: product.total_stock,
        message: `${product.name} esta abaixo de duas vezes o estoque minimo.`
      })),
    expiringLots: lots
      .filter((lot) => lot.status === STATUS_ACTIVE && lot.expiration_date >= now && lot.expiration_date <= addDays(now, 7))
      .map((lot) => ({
        type: "Proximo do vencimento",
        product_id: lot.product_id,
        lot_id: lot.id,
        product_name: lot.product_name,
        current_quantity: lot.current_quantity,
        expiration_date: lot.expiration_date,
        message: `${lot.product_name} vence em ${lot.expiration_date}.`
      })),
    expiredLots: lots
      .filter((lot) => lot.status === STATUS_EXPIRED)
      .map((lot) => ({
        type: "Lote vencido",
        product_id: lot.product_id,
        lot_id: lot.id,
        product_name: lot.product_name,
        current_quantity: lot.current_quantity,
        expiration_date: lot.expiration_date,
        message: `${lot.product_name} venceu em ${lot.expiration_date}.`
      }))
  };
}

export function getDashboard(db, options = {}) {
  const now = options.now || today();
  refreshLotStatuses(db, now);
  const alerts = getAlerts(db, { now });
  const expiringMonthLots = listLots(db, { now }).filter(
    (lot) => lot.status === STATUS_ACTIVE && lot.expiration_date > addDays(now, 7) && lot.expiration_date <= addDays(now, 30)
  ).length;
  const currentMonth = now.slice(0, 7);
  const lossMonth = db
    .prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM losses WHERE substr(loss_date, 1, 7) = ?")
    .get(currentMonth).total;

  return {
    totalProducts: db.prepare("SELECT COUNT(*) AS count FROM products").get().count,
    activeLots: db.prepare("SELECT COUNT(*) AS count FROM lots WHERE status = 'Ativo'").get().count,
    criticalProducts: alerts.stockCritical.length,
    expiringLots: alerts.expiringLots.length,
    expiringMonthLots,
    monthlyLosses: Number(lossMonth || 0),
    recentAlerts: [...alerts.stockCritical, ...alerts.expiringLots, ...alerts.stockLow, ...alerts.expiredLots].slice(0, 8)
  };
}

export function stockOut(db, input) {
  const product = getProduct(db, input.product_id, { now: input.now });
  if (!product) throw appError("Produto nao encontrado.", 404, "PRODUCT_NOT_FOUND");
  const quantity = assertPositiveInteger(input.quantity, "Quantidade");
  const now = input.now || today();
  refreshLotStatuses(db, now);

  const lots = db
    .prepare(
      `SELECT * FROM lots
       WHERE product_id = ? AND status = 'Ativo' AND current_quantity > 0
       ORDER BY expiration_date ASC, id ASC`
    )
    .all(product.id);

  const available = lots.reduce((sum, lot) => sum + Number(lot.current_quantity), 0);
  if (available < quantity) throw appError("Estoque disponivel insuficiente.", 409, "INSUFFICIENT_STOCK");

  const consumed = [];
  let remaining = quantity;
  const transaction = db.transaction(() => {
    for (const lot of lots) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, lot.current_quantity);
      const nextQuantity = lot.current_quantity - amount;
      const nextStatus = nextQuantity === 0 ? STATUS_EMPTY : STATUS_ACTIVE;
      db.prepare(
        "UPDATE lots SET current_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(nextQuantity, nextStatus, lot.id);
      consumed.push({ lot_id: lot.id, quantity: amount });
      remaining -= amount;
    }
    addMovement(db, {
      product_id: product.id,
      type: "Saida de estoque",
      quantity,
      description: `Saida de ${quantity} unidade(s) de ${product.name}.`
    });
  });
  transaction();

  return { product_id: product.id, quantity, consumed };
}

export function recordLoss(db, input) {
  const lot = getLot(db, input.lot_id, { now: input.loss_date });
  if (!lot) throw appError("Lote nao encontrado.", 404, "LOT_NOT_FOUND");
  const quantity = assertPositiveInteger(input.quantity, "Quantidade perdida");
  if (quantity > lot.current_quantity) throw appError("Quantidade perdida maior que o saldo do lote.", 409, "INSUFFICIENT_LOT_STOCK");

  const loss_date = input.loss_date || today();
  const result = db.transaction(() => {
    const nextQuantity = lot.current_quantity - quantity;
    db.prepare(
      "UPDATE lots SET current_quantity = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(nextQuantity, nextQuantity === 0 ? STATUS_EMPTY : lot.status, lot.id);

    const inserted = db
      .prepare(
        `INSERT INTO losses (product_id, lot_id, quantity, reason, estimated_value, loss_date, notes)
         VALUES (@product_id, @lot_id, @quantity, @reason, @estimated_value, @loss_date, @notes)`
      )
      .run({
        product_id: lot.product_id,
        lot_id: lot.id,
        quantity,
        reason: input.reason,
        estimated_value: input.estimated_value ?? null,
        loss_date,
        notes: input.notes || null
      });

    addMovement(db, {
      product_id: lot.product_id,
      lot_id: lot.id,
      type: "Perda",
      quantity,
      description: `Perda de ${quantity} unidade(s) de ${lot.product_name} por ${input.reason}.`
    });

    return inserted.lastInsertRowid;
  })();

  return getLoss(db, result);
}

export function getLoss(db, id) {
  return db
    .prepare(
      `SELECT lo.*, p.name AS product_name
       FROM losses lo
       JOIN products p ON p.id = lo.product_id
       WHERE lo.id = ?`
    )
    .get(id);
}

export function listLosses(db) {
  return db
    .prepare(
      `SELECT lo.*, p.name AS product_name
       FROM losses lo
       JOIN products p ON p.id = lo.product_id
       ORDER BY lo.loss_date DESC, lo.id DESC`
    )
    .all();
}

export function getLossReport(db) {
  const losses = listLosses(db);
  const byReason = db
    .prepare(
      `SELECT reason, COUNT(*) AS total_records, COALESCE(SUM(quantity), 0) AS total_quantity,
              COALESCE(SUM(estimated_value), 0) AS estimated_value
       FROM losses
       GROUP BY reason
       ORDER BY total_quantity DESC`
    )
    .all();
  return {
    totalLosses: losses.length,
    totalItems: losses.reduce((sum, loss) => sum + Number(loss.quantity), 0),
    estimatedValue: losses.reduce((sum, loss) => sum + Number(loss.estimated_value || 0), 0),
    byReason,
    losses
  };
}

export function listMovements(db) {
  return db
    .prepare(
      `SELECT m.*, p.name AS product_name, l.expiration_date AS lot_expiration_date
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN lots l ON l.id = m.lot_id
       ORDER BY m.created_at DESC, m.id DESC`
    )
    .all();
}

export function seedDatabase(db) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (existing > 0) return;

  const products = [
    ["Leite integral 1L", "LEI-1L", "Laticinios", "Fazenda Boa", 10],
    ["Iogurte morango", "IOG-MOR", "Laticinios", "Fazenda Boa", 12],
    ["Pao de forma 500g", "PAO-500", "Padaria", "Panificadora Central", 5],
    ["Arroz branco 5kg", "ARR-5KG", "Mercearia", "Graos Brasil", 8],
    ["Refrigerante cola 2L", "REF-COLA", "Bebidas", "Distribuidora Norte", 6],
    ["Sorvete creme 1L", "SOR-CRE", "Congelados", "Gelados Sul", 4]
  ];

  const ids = new Map();
  for (const [name, code, category, main_supplier, min_stock] of products) {
    ids.set(name, createProduct(db, { name, code, category, main_supplier, min_stock }).id);
  }

  const base = today();
  const lots = [
    ["Leite integral 1L", 18, addDays(base, 3), "Fazenda Boa"],
    ["Iogurte morango", 14, addDays(base, 4), "Fazenda Boa"],
    ["Pao de forma 500g", 3, addDays(base, 2), "Panificadora Central"],
    ["Arroz branco 5kg", 42, addDays(base, 90), "Graos Brasil"],
    ["Refrigerante cola 2L", 24, addDays(base, 30), "Distribuidora Norte"],
    ["Refrigerante cola 2L", 30, addDays(base, 60), "Distribuidora Norte"],
    ["Sorvete creme 1L", 8, addDays(base, 20), "Gelados Sul"],
    ["Sorvete creme 1L", 10, addDays(base, 45), "Gelados Sul"]
  ];

  for (const [productName, quantity, expiration_date, supplier] of lots) {
    createLot(db, {
      product_id: ids.get(productName),
      initial_quantity: quantity,
      entry_date: base,
      expiration_date,
      supplier
    });
  }
}

export { appError };
