# Decisoes e Telas do MVP

## Log de decisoes

### Plano inicial

- O MVP comecou como um sistema local de controle de estoque para pequenos mercados.
- A stack definida foi React + Vite no frontend, Node.js + Express no backend e SQLite local em `backend/data.db`.
- A regra central do produto foi separar produto base de entradas de estoque por validade, evitando duplicidade no cadastro.
- O escopo aprovado foi fluxo completo em versao compacta: dashboard, produtos, alertas, saida, perdas e historico.

### Direcao de experiencia

- A direcao visual escolhida foi "Fila de reposicao": o sistema deve priorizar o que precisa de acao no dia.
- A listagem de produtos passou a ser o centro operacional do sistema.
- O cadastro rapido de estoque foi definido dentro da listagem de produtos.
- O fluxo rapido pede apenas quantidade e validade; a data de aquisicao e registrada automaticamente pelo backend.
- O usuario pediu foco em desktop web, sem tratamento especifico para mobile neste MVP.

### Mudancas em relacao ao plano inicial

- A tela dedicada de lotes foi removida da navegacao.
- As informacoes de validade/estoque por entrada passaram a aparecer em um painel flutuante ao clicar em um produto.
- A tela de relatorio de perdas foi removida da navegacao por enquanto e a rota redireciona para o dashboard.
- O termo visual "lote" foi reduzido na interface. A UI agora fala mais em "estoque", "validade" e "produto".
- A saida de estoque foi descrita como baixa pelo produto mais antigo, mas internamente continua seguindo a regra FEFO: consome primeiro a validade mais antiga.

### Decisoes de interface

- O tema foi ajustado para uma base shadcn clara: fundo cinza no conteudo, cards brancos, sidebar em `#ffede0`.
- O laranja comercial principal foi definido como `#c75000`.
- Botoes de acao usam laranja escuro, com hover mais escuro.
- Os cards de prioridade usam cores para passar urgencia da mensagem que a informação quer passar.
- Badges foram padronizadas com largura fixa e texto centralizado.
- Cards de produto foram reorganizados em linha: nome e badge, estoque atual/minimo, acao "Adicionar estoque" no canto direito.

### Decisoes de regra de negocio

- Produto com codigo duplicado nao pode ser salvo.
- Produto com nome exatamente igual nao pode ser salvo.
- Produto com nome parecido gera aviso confirmavel.
- Estoque total do produto e calculado pela soma das entradas ativas.
- Saida de estoque consome primeiro a entrada com validade mais antiga.
- Perda reduz a quantidade da entrada selecionada.
- Quando a quantidade chega a zero, a entrada fica esgotada.
- Alertas de estoque usam o saldo total do produto.
- Alertas de validade usam as datas de validade cadastradas.

## Telas atuais

### Dashboard

Mostra as prioridades gerais do estoque.

Funcionalidades basicas:

- Exibe total de produtos.
- Exibe quantidade de produtos com estoque baixo.
- Exibe quantas validades vencem em ate 7 dias.
- Exibe quantas validades vencem em ate 1 mes.
- Exibe perdas do mes.
- Mostra alertas recentes.
- Tem atalho para adicionar estoque.

### Produtos

Tela principal de operacao diaria.

Funcionalidades basicas:

- Lista produtos em cards horizontais.
- Permite buscar por nome ou codigo.
- Mostra nome do produto.
- Mostra badge de estado.
- Mostra estoque atual e minimo.
- Permite adicionar estoque diretamente pelo botao "Adicionar estoque".
- Ao clicar em um produto, abre painel flutuante com detalhes e validades cadastradas.

### Novo Produto

Tela de cadastro do produto base.

Funcionalidades basicas:

- Cadastra nome, codigo, categoria, fornecedor principal, estoque minimo e observacao.
- Bloqueia codigo duplicado.
- Bloqueia nome igual.
- Mostra alerta confirmavel para nome parecido.

### Editar Produto

Tela para ajuste dos dados de um produto existente.

Funcionalidades basicas:

- Permite editar dados cadastrais do produto.
- Registra movimentacao de edicao no historico.
- Mantem as regras de duplicidade.

### Painel flutuante do produto

Abre ao clicar em um produto na tela de produtos.

Funcionalidades basicas:

- Mostra codigo, categoria, fornecedor e estoque atual/minimo.
- Lista as validades cadastradas daquele produto.
- Mostra quantidade atual/inicial, entrada, validade e estado.
- Permite acessar edicao do produto.

### Adicionar Estoque

Fluxo rapido aberto a partir do card do produto.

Funcionalidades basicas:

- Pede quantidade.
- Pede data de validade.
- Registra automaticamente a data de aquisicao.
- Atualiza o estoque disponivel do produto.
- Registra movimentacao de entrada.

### Alertas

Lista os alertas de estoque e validade.

Funcionalidades basicas:

- Agrupa produtos com estoque baixo.
- Mostra produtos proximos do vencimento.
- Mostra itens vencidos.
- Usa badges coloridas por estado.

### Saida

Registra baixa de estoque por produto.

Funcionalidades basicas:

- Usuario seleciona produto.
- Usuario informa quantidade.
- Sistema reduz automaticamente primeiro a validade mais antiga.
- Registra movimentacao de saida.

### Perdas

Registra perdas por produto e validade.

Funcionalidades basicas:

- Usuario seleciona produto e validade.
- Informa quantidade perdida.
- Informa motivo.
- Pode informar valor estimado.
- Informa data da perda.
- Registra historico da perda.
- Reduz o saldo da validade selecionada.
- Mostra perdas recentes em tabela.

### Historico

Mostra movimentacoes feitas no sistema.

Funcionalidades basicas:

- Lista entradas de estoque.
- Lista saidas.
- Lista perdas.
- Lista edicoes relevantes.
- Mostra tipo, produto, quantidade, descricao e data.

## Rotas mantidas apenas por compatibilidade

- `/lotes/*` redireciona para `/produtos`.
- `/relatorios/perdas` redireciona para `/dashboard`.

## Observacoes tecnicas

- Backend centraliza as regras de estoque e validade.
- Frontend nao calcula consumo FEFO diretamente.
- Banco local fica em `backend/data.db`.
- Dados iniciais sao criados automaticamente quando o banco esta vazio.
- Componentes shadcn ficam em `frontend/src/components/ui`.
