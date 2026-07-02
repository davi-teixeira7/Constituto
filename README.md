# Controle Inteligente de Estoque para Pequenos Mercados

MVP local para controlar produtos, lotes, validade, estoque baixo, saidas e perdas.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- Banco local: SQLite em `backend/data.db`

## Instalar

```bash
npm run install:all
```

## Rodar em desenvolvimento

```bash
npm run dev
```

Servicos:

- Frontend: http://localhost:5173
- Backend: http://localhost:3333

## Comandos uteis

```bash
npm test
npm run build
npm start
```

## Fluxo principal

1. Acesse `/dashboard`.
2. Veja alertas de estoque critico e validade.
3. Acesse `/produtos`.
4. Cadastre um produto base ou use `+ lote` em um card existente.
5. Registre saida em `/saida`.
6. Registre perdas em `/perdas`.
7. Consulte `/relatorios/perdas` e `/historico`.

## Regras implementadas

- Produto base nao deve ser duplicado.
- Codigo duplicado e nome igual bloqueiam cadastro.
- Nome parecido gera aviso confirmavel.
- Lote sempre pertence a um produto existente.
- Cadastro relampago de lote pede apenas quantidade e validade.
- Data de aquisicao do lote relampago e registrada automaticamente.
- Estoque total soma lotes ativos.
- Saida consome primeiro os lotes com validade mais proxima.
- Perda reduz a quantidade atual do lote.
- Alertas de vencimento consideram lotes.
- Alertas de estoque consideram a soma dos lotes ativos.
