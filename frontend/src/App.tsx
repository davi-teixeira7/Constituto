import {
  AlertTriangle,
  Archive,
  ClipboardList,
  History,
  Home,
  MinusCircle,
  Plus,
  Search
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertItem, api, Dashboard, Lot, Product } from "./api";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Sheet, Textarea } from "./ui";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/produtos", label: "Produtos", icon: Archive },
  { to: "/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/saida", label: "Saida", icon: MinusCircle },
  { to: "/perdas", label: "Perdas", icon: ClipboardList },
  { to: "/historico", label: "Historico", icon: History }
];

function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loader()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error) => toast.error(error.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, reloadKey]);

  return { data, loading, reload: () => setReloadKey((key) => key + 1) };
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FI</div>
          <div>
            <strong>Fila inteligente</strong>
            <span>controle de estoque</span>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                <Icon aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/produtos" element={<ProductsPage />} />
        <Route path="/produtos/novo" element={<ProductFormPage />} />
        <Route path="/produtos/:id" element={<ProductDetailPage />} />
        <Route path="/produtos/:id/editar" element={<ProductFormPage edit />} />
        <Route path="/lotes/*" element={<Navigate to="/produtos" replace />} />
        <Route path="/alertas" element={<AlertsPage />} />
        <Route path="/saida" element={<StockOutPage />} />
        <Route path="/perdas" element={<LossesPage />} />
        <Route path="/relatorios/perdas" element={<Navigate to="/dashboard" replace />} />
        <Route path="/historico" element={<MovementsPage />} />
      </Routes>
    </AppShell>
  );
}

function DashboardPage() {
  const { data, loading } = useAsync<Dashboard>(() => api.dashboard());
  if (loading || !data) return <Loading title="Dashboard" />;
  return (
    <>
      <PageHeader eyebrow="Fila de reposicao" title="Prioridades de hoje">
        <Link to="/produtos">
          <Button>
            <Plus data-icon="inline-start" /> Adicionar estoque
          </Button>
        </Link>
      </PageHeader>
      <section className="metric-grid">
        <Metric label="Produtos" value={data.totalProducts} />
        <Metric label="Estoque baixo" value={data.criticalProducts} tone="warning" />
        <Metric label="Vencem em 7 dias" value={data.expiringLots} tone="critical" />
        <Metric label="Vencem em 1 mes" value={data.expiringMonthLots} tone="warning" />
        <Metric label="Perdas do mes" value={data.monthlyLosses} tone="info" />
      </section>
      <Card>
        <div className="section-title">
          <h2>Alertas recentes</h2>
          <Link to="/alertas">Ver todos</Link>
        </div>
        <AlertList alerts={data.recentAlerts} />
      </Card>
    </>
  );
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number; tone?: string }) {
  const waveColor =
    tone === "critical"
      ? "#ef2424"
      : tone === "warning"
        ? "#facc15"
        : tone === "info"
          ? "#4f46e5"
          : "#22b14c";
  return (
    <Card className={`metric metric-${tone}`} contentClassName="metric-content">
      <span>{label}</span>
      <strong>{value}</strong>
      <svg className="metric-wave" viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,58 C62,18 132,21 180,48 C247,86 354,70 500,42 L500,150 L0,150 Z" fill={waveColor} />
      </svg>
    </Card>
  );
}

function ProductsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [details, setDetails] = useState<Product | null>(null);
  const { data, loading, reload } = useAsync<Product[]>(() => api.products(search), [search]);

  async function openDetails(product: Product) {
    try {
      setDetails(await api.product(product.id));
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Produtos" title="Fila de reposicao">
        <Link to="/produtos/novo">
          <Button>
            <Plus data-icon="inline-start" /> Novo produto
          </Button>
        </Link>
      </PageHeader>
      <div className="search-row">
        <Search aria-hidden="true" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou codigo" />
      </div>
      <div className="product-list">
        {loading ? <Empty>Carregando produtos...</Empty> : null}
        {data?.map((product) => (
          <ProductRow key={product.id} product={product} onOpen={() => openDetails(product)} onQuickStock={() => setSelected(product)} />
        ))}
        {!loading && data?.length === 0 ? <Empty>Nenhum produto encontrado.</Empty> : null}
      </div>
      <QuickLotSheet
        product={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          reload();
        }}
      />
      <ProductInventorySheet product={details} onClose={() => setDetails(null)} />
    </>
  );
}

function ProductRow({ product, onOpen, onQuickStock }: { product: Product; onOpen: () => void; onQuickStock: () => void }) {
  const tone = product.status === "Normal" ? "success" : "warning";
  const statusLabel = product.status === "Normal" ? "Normal" : "Estoque baixo";
  return (
    <Card className={`product-row product-row-${tone}`} contentClassName="product-row-content" role="button" tabIndex={0} onClick={onOpen}>
      <div className="product-main">
        <strong>{product.name}</strong>
        <Badge tone={tone}>{statusLabel}</Badge>
      </div>
      <div className="stock-block">
        <strong>{product.total_stock} / {product.min_stock}</strong>
        <span>Atual / minimo</span>
      </div>
      <div className="product-action">
        <span>Adicionar<br />estoque:</span>
        <Button
          aria-label={`Adicionar estoque para ${product.name}`}
          className="product-add-button"
          onClick={(event) => {
            event.stopPropagation();
            onQuickStock();
          }}
        >
          <Plus data-icon="inline-start" />
        </Button>
      </div>
    </Card>
  );
}

function QuickLotSheet({
  product,
  onClose,
  onSaved
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.createLot({
        product_id: product.id,
        initial_quantity: Number(form.get("quantity")),
        expiration_date: form.get("expiration_date")
      });
      toast.success("Estoque adicionado.");
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <Sheet title={product ? `Adicionar estoque: ${product.name}` : "Adicionar estoque"} open={Boolean(product)} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">Informe a quantidade e a validade. A data de aquisicao sera registrada automaticamente agora.</p>
        <Field label="Quantidade">
          <Input name="quantity" type="number" min="1" required autoFocus />
        </Field>
        <Field label="Data de validade">
          <Input name="expiration_date" type="date" required />
        </Field>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Adicionar estoque</Button>
        </div>
      </form>
    </Sheet>
  );
}

function ProductInventorySheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Sheet title={product ? product.name : "Produto"} open={Boolean(product)} onClose={onClose}>
      {!product ? null : (
        <div className="stack">
          <dl className="description-list">
            <dt>Codigo</dt>
            <dd>{product.code || "-"}</dd>
            <dt>Categoria</dt>
            <dd>{product.category}</dd>
            <dt>Fornecedor</dt>
            <dd>{product.main_supplier || "-"}</dd>
            <dt>Atual / minimo</dt>
            <dd>{product.total_stock} / {product.min_stock}</dd>
          </dl>
          <div>
            <h2>Validades cadastradas</h2>
            <LotsTable lots={product.lots || []} />
          </div>
          <Link to={`/produtos/${product.id}/editar`}>
            <Button variant="secondary">Editar produto</Button>
          </Link>
        </div>
      )}
    </Sheet>
  );
}

function ProductFormPage({ edit = false }: { edit?: boolean }) {
  const params = useParams();
  const navigate = useNavigate();
  const { data } = useAsync<Product>(() => (edit ? api.product(params.id!) : Promise.resolve(null as unknown as Product)), [params.id, edit]);
  const [similarPayload, setSimilarPayload] = useState<Record<string, unknown> | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, confirmSimilar = false) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      name: form.get("name"),
      code: form.get("code"),
      category: form.get("category"),
      main_supplier: form.get("main_supplier"),
      min_stock: Number(form.get("min_stock")),
      notes: form.get("notes"),
      confirmSimilar
    };
    try {
      const product = edit ? await api.updateProduct(params.id!, body) : await api.createProduct(body);
      toast.success(edit ? "Produto atualizado." : "Produto cadastrado.");
      navigate(`/produtos/${product.id}`);
    } catch (error) {
      const typed = error as Error & { code?: string };
      if (typed.code === "SIMILAR_PRODUCT") {
        setSimilarPayload(body);
        toast.warning(typed.message);
      } else {
        toast.error(typed.message);
      }
    }
  }

  async function confirmSimilar() {
    if (!similarPayload) return;
    try {
      const product = await api.createProduct({ ...similarPayload, confirmSimilar: true });
      toast.success("Produto cadastrado.");
      navigate(`/produtos/${product.id}`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <>
      <PageHeader eyebrow={edit ? "Editar produto" : "Cadastro de produto"} title={edit ? "Ajustar produto" : "Novo produto base"} />
      <Card>
        <form className="form two-columns" onSubmit={(event) => submit(event)}>
          <Field label="Nome do produto">
            <Input name="name" required defaultValue={data?.name || ""} />
          </Field>
          <Field label="Codigo">
            <Input name="code" defaultValue={data?.code || ""} />
          </Field>
          <Field label="Categoria">
            <Input name="category" required defaultValue={data?.category || ""} />
          </Field>
          <Field label="Fornecedor principal">
            <Input name="main_supplier" defaultValue={data?.main_supplier || ""} />
          </Field>
          <Field label="Estoque minimo">
            <Input name="min_stock" type="number" min="0" required defaultValue={data?.min_stock ?? 0} />
          </Field>
          <Field label="Observacao">
            <Textarea name="notes" defaultValue={data?.notes || ""} />
          </Field>
          <div className="form-actions wide">
            <Button type="submit">{edit ? "Salvar alteracoes" : "Cadastrar produto"}</Button>
          </div>
        </form>
        {similarPayload ? (
          <div className="inline-alert">
            <strong>Produto parecido encontrado.</strong>
            <span>Confirme apenas se este item for realmente outro produto.</span>
            <Button onClick={confirmSimilar}>Confirmar cadastro</Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const { data, loading, reload } = useAsync<Product>(() => api.product(id!), [id]);
  const [quickLot, setQuickLot] = useState<Product | null>(null);

  if (loading || !data) return <Loading title="Produto" />;
  return (
    <>
      <PageHeader eyebrow="Detalhes do produto" title={data.name}>
        <Button onClick={() => setQuickLot(data)}>
          <Plus data-icon="inline-start" /> Adicionar estoque
        </Button>
        <Link to={`/produtos/${data.id}/editar`}>
          <Button variant="secondary">Editar</Button>
        </Link>
      </PageHeader>
      <section className="detail-grid">
        <Card>
          <h2>Resumo</h2>
          <dl className="description-list">
            <dt>Codigo</dt>
            <dd>{data.code || "-"}</dd>
            <dt>Categoria</dt>
            <dd>{data.category}</dd>
            <dt>Fornecedor</dt>
            <dd>{data.main_supplier || "-"}</dd>
            <dt>Estoque atual / minimo</dt>
            <dd>
              {data.total_stock} / {data.min_stock}
            </dd>
          </dl>
        </Card>
        <Card>
          <h2>Validades cadastradas</h2>
          <LotsTable lots={data.lots || []} />
        </Card>
      </section>
      <QuickLotSheet
        product={quickLot}
        onClose={() => setQuickLot(null)}
        onSaved={() => {
          setQuickLot(null);
          reload();
        }}
      />
    </>
  );
}

function AlertsPage() {
  const { data, loading } = useAsync(() => api.alerts());
  const groups = data
    ? [
        ["Estoque baixo", [...data.stockCritical, ...data.stockLow]],
        ["Proximos do vencimento", data.expiringLots],
        ["Vencidos", data.expiredLots]
      ]
    : [];
  return (
    <>
      <PageHeader eyebrow="Alertas" title="Fila de urgencias" />
      {loading ? <Empty>Carregando alertas...</Empty> : null}
      <div className="stack">
        {groups.map(([title, alerts]) => (
          <Card key={title as string}>
            <h2>{title as string}</h2>
            <AlertList alerts={alerts as AlertItem[]} />
          </Card>
        ))}
      </div>
    </>
  );
}

function StockOutPage() {
  const { data: products } = useAsync<Product[]>(() => api.products());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.stockOut({
        product_id: Number(form.get("product_id")),
        quantity: Number(form.get("quantity"))
      });
      toast.success(`Saida registrada considerando a validade mais antiga.`);
      event.currentTarget.reset();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <>
      <PageHeader eyebrow="Saida de estoque" title="Baixa pelo produto mais antigo" />
      <Card>
        <form className="form" onSubmit={submit}>
          <p className="muted">O sistema reduz automaticamente primeiro o estoque com validade mais antiga.</p>
          <Field label="Produto">
            <Select name="product_id" required>
              <option value="">Selecione</option>
              {products?.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.total_stock} disponiveis
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantidade de saida">
            <Input name="quantity" type="number" min="1" required />
          </Field>
          <Button type="submit">Registrar saida</Button>
        </form>
      </Card>
    </>
  );
}

function LossesPage() {
  const { data: lots, reload: reloadLots } = useAsync<Lot[]>(() => api.lots("?filter=active"));
  const { data: losses, reload: reloadLosses } = useAsync(() => api.losses());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lot = lots?.find((item) => item.id === Number(form.get("lot_id")));
    try {
      await api.createLoss({
        product_id: lot?.product_id,
        lot_id: Number(form.get("lot_id")),
        quantity: Number(form.get("quantity")),
        reason: form.get("reason"),
        estimated_value: form.get("estimated_value") ? Number(form.get("estimated_value")) : null,
        loss_date: form.get("loss_date"),
        notes: form.get("notes")
      });
      toast.success("Perda registrada.");
      event.currentTarget.reset();
      reloadLots();
      reloadLosses();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  return (
    <>
      <PageHeader eyebrow="Perdas" title="Registrar perda por validade" />
      <section className="detail-grid">
        <Card>
          <form className="form" onSubmit={submit}>
            <Field label="Produto e validade">
              <Select name="lot_id" required>
                <option value="">Selecione</option>
                {lots?.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.product_name} - validade {formatDate(lot.expiration_date)} - {lot.current_quantity} un.
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantidade perdida">
              <Input name="quantity" type="number" min="1" required />
            </Field>
            <Field label="Motivo">
              <Select name="reason" required>
                <option>Vencimento</option>
                <option>Avaria</option>
                <option>Excesso de estoque</option>
                <option>Outro</option>
              </Select>
            </Field>
            <Field label="Valor estimado">
              <Input name="estimated_value" type="number" min="0" step="0.01" />
            </Field>
            <Field label="Data da perda">
              <Input name="loss_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Observacao">
              <Textarea name="notes" />
            </Field>
            <Button type="submit">Registrar perda</Button>
          </form>
        </Card>
        <Card>
          <h2>Perdas recentes</h2>
          <LossesTable losses={losses || []} />
        </Card>
      </section>
    </>
  );
}

function MovementsPage() {
  const { data, loading } = useAsync(() => api.movements());
  return (
    <>
      <PageHeader eyebrow="Historico" title="Movimentacoes" />
      <Card>
        {loading ? <Empty>Carregando historico...</Empty> : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Descricao</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((movement) => (
              <TableRow key={movement.id}>
                <TableCell><Badge tone={movement.type === "Perda" ? "info" : movement.type.includes("Saida") ? "warning" : "neutral"}>{movement.type}</Badge></TableCell>
                <TableCell className="font-semibold">{movement.product_name}</TableCell>
                <TableCell>{movement.quantity || "-"}</TableCell>
                <TableCell className="max-w-xl text-muted-foreground">{movement.description}</TableCell>
                <TableCell>{formatDateTime(movement.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function LotsTable({ lots }: { lots: Lot[] }) {
  if (lots.length === 0) return <Empty>Nenhuma validade cadastrada.</Empty>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Atual / inicial</TableHead>
          <TableHead>Entrada</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lots.map((lot) => (
          <TableRow key={lot.id}>
            <TableCell className="font-semibold">{lot.product_name}</TableCell>
            <TableCell>
              {lot.current_quantity} / {lot.initial_quantity}
            </TableCell>
            <TableCell>{formatDate(lot.entry_date)}</TableCell>
            <TableCell>{formatDate(lot.expiration_date)}</TableCell>
            <TableCell>
              <Badge tone={lot.status === "Ativo" ? "success" : lot.status === "Vencido" ? "critical" : "neutral"}>{lot.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AlertList({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts || alerts.length === 0) return <Empty>Nenhum alerta nesta fila.</Empty>;
  return (
    <div className="alert-list">
      {alerts.map((alert, index) => (
        <div className="alert-item" key={`${alert.type}-${alert.product_id}-${alert.lot_id || index}`}>
          <Badge tone={alert.type.includes("vencido") || alert.type.includes("vencimento") ? "critical" : alert.type.includes("baixo") || alert.type.includes("critico") ? "warning" : "success"}>{alert.type}</Badge>
          <strong>{alert.product_name}</strong>
          <span>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}

function LossesTable({ losses }: { losses: Array<{ id: number; product_name: string; quantity: number; reason: string; estimated_value?: number | null; loss_date: string }> }) {
  if (losses.length === 0) return <Empty>Nenhuma perda registrada.</Empty>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {losses.map((loss) => (
          <TableRow key={loss.id}>
            <TableCell className="font-semibold">{loss.product_name}</TableCell>
            <TableCell>{loss.quantity}</TableCell>
            <TableCell><Badge tone="info">{loss.reason}</Badge></TableCell>
            <TableCell>{loss.estimated_value ? `R$ ${Number(loss.estimated_value).toFixed(2)}` : "-"}</TableCell>
            <TableCell>{formatDate(loss.loss_date)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Loading({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Empty>Carregando...</Empty>
    </>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string) {
  return new Date(value.replace(" ", "T")).toLocaleString("pt-BR");
}
