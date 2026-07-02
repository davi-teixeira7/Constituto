export type Product = {
  id: number;
  name: string;
  code?: string | null;
  category: string;
  main_supplier?: string | null;
  min_stock: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  total_stock: number;
  nearest_expiration?: string | null;
  status: "Normal" | "Estoque baixo" | "Critico";
  lots?: Lot[];
};

export type Lot = {
  id: number;
  product_id: number;
  product_name: string;
  initial_quantity: number;
  current_quantity: number;
  entry_date: string;
  expiration_date: string;
  supplier?: string | null;
  notes?: string | null;
  status: "Ativo" | "Esgotado" | "Vencido";
};

export type AlertItem = {
  type: string;
  product_id: number;
  lot_id?: number;
  product_name: string;
  current_quantity: number;
  expiration_date?: string;
  message: string;
};

export type Dashboard = {
  totalProducts: number;
  activeLots: number;
  criticalProducts: number;
  expiringLots: number;
  expiringMonthLots: number;
  monthlyLosses: number;
  recentAlerts: AlertItem[];
};

export type Alerts = {
  stockCritical: AlertItem[];
  stockLow: AlertItem[];
  expiringLots: AlertItem[];
  expiredLots: AlertItem[];
};

export type Loss = {
  id: number;
  product_id: number;
  lot_id: number;
  product_name: string;
  quantity: number;
  reason: string;
  estimated_value?: number | null;
  loss_date: string;
  notes?: string | null;
};

export type Movement = {
  id: number;
  product_id: number;
  lot_id?: number | null;
  product_name: string;
  type: string;
  quantity?: number | null;
  description: string;
  created_at: string;
};

const API_BASE = "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || "Erro ao chamar a API.") as Error & {
      code?: string;
      details?: unknown;
    };
    error.code = payload?.code;
    error.details = payload?.details;
    throw error;
  }
  return payload as T;
}

export const api = {
  dashboard: () => request<Dashboard>("/api/dashboard"),
  alerts: () => request<Alerts>("/api/alerts"),
  products: (search = "") => request<Product[]>(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  product: (id: string | number) => request<Product>(`/api/products/${id}`),
  createProduct: (body: unknown) => request<Product>("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string | number, body: unknown) =>
    request<Product>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProduct: (id: string | number) => request<{ ok: true }>(`/api/products/${id}`, { method: "DELETE" }),
  lots: (query = "") => request<Lot[]>(`/api/lots${query}`),
  createLot: (body: unknown) => request<Lot>("/api/lots", { method: "POST", body: JSON.stringify(body) }),
  stockOut: (body: unknown) => request<{ consumed: Array<{ lot_id: number; quantity: number }> }>("/api/stock-out", {
    method: "POST",
    body: JSON.stringify(body)
  }),
  losses: () => request<Loss[]>("/api/losses"),
  createLoss: (body: unknown) => request<Loss>("/api/losses", { method: "POST", body: JSON.stringify(body) }),
  lossReport: () =>
    request<{
      totalLosses: number;
      totalItems: number;
      estimatedValue: number;
      byReason: Array<{ reason: string; total_records: number; total_quantity: number; estimated_value: number }>;
      losses: Loss[];
    }>("/api/reports/losses"),
  movements: () => request<Movement[]>("/api/movements")
};
