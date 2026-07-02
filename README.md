# Controle Inteligente de Estoque para Pequenos Mercados

MVP local para controlar produtos, entradas de estoque, validade, estoque baixo, saidas e perdas.

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
2. Veja alertas de estoque baixo e validade.
3. Acesse `/produtos`.
4. Cadastre um produto base ou use `Adicionar estoque` em um card existente.
5. Registre saida em `/saida`.
6. Registre perdas em `/perdas`.
7. Consulte as movimentacoes em `/historico`.

## Regras implementadas

- Produto base nao deve ser duplicado.
- Codigo duplicado e nome igual bloqueiam cadastro.
- Nome parecido gera aviso confirmavel.
- Nova entrada de estoque sempre pertence a um produto existente.
- Cadastro relampago de estoque pede apenas quantidade e validade.
- Data de aquisicao da entrada de estoque e registrada automaticamente.
- Estoque total soma entradas ativas.
- Saida consome primeiro os produtos com validade mais proxima.
- Perda reduz a quantidade disponivel da validade selecionada.
- Alertas de vencimento consideram as validades cadastradas.
- Alertas de estoque consideram a soma das entradas ativas.
