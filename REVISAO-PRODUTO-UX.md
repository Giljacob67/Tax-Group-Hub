# Revisão de Produto e Usabilidade — Tax Group Hub

**Data:** 11/06/2026 · **Escopo:** produto/UX (fluxos, features, agentes, hierarquia, empty states, copy) — não técnico
**Método:** 3 auditorias paralelas sobre o código do frontend/backend + verificação manual de cada achado crítico contra o código

---

## Veredito executivo

A plataforma tem fundação de produto sólida — Kanban com fases, prefill entre módulos, registro automático de atividades, copy comercial boa no CRM/dashboard. Mas **o fio condutor do produto (importar → qualificar → diagnosticar → propor → fechar) está rompido em três junções**: pós-importação, navegação por deep-link e handoff CRM→agente. São bugs de poucos arquivos, mas que quebram exatamente a promessa central. Corrigidos os 7 itens críticos/altos abaixo, o produto vira utilizável no dia a dia; sem eles, o time comercial vai abandonar nas primeiras horas.

---

## CRÍTICO — quebra o fluxo central

### C1. Todos os deep-links para o CRM são ignorados
`pages/crm.tsx` **não lê query params** (zero ocorrências de `URLSearchParams`/`location.search` em 5.224 linhas — verificado). Consequência em cascata:

- Os 6 KPIs do Command Center (`dashboard.tsx:356-391`) linkam para `/crm?tab=contacts`, `/crm?filter=temperature:quente`, `/crm?tab=pipeline`, `/crm?tab=today` — todos caem na aba default.
- Os StatCards do TodayView (`TodayView.tsx:377-448`) linkam para `/crm?tab=pipeline&filter=...` — clicar em "Aguardando Matriz: 5" devolve o usuário à própria aba "Hoje".
- Empty states e seções do funil no dashboard (`dashboard.tsx:579, 683, 735`) também usam esses links.

**Efeito:** toda a navegação orientada a ação da plataforma é um beco sem saída. O usuário clica num número e nada acontece — parece quebrado porque está.
**Correção:** ler `tab`/`filter` na montagem do CRMPage e sincronizar com o estado. Um ponto de correção resolve ~15 links.

### C2. Handoff CRM → agente quebrado por IDs errados
`getAgentById` faz match exato e os IDs reais terminam em `-tax-group` (`agents-data.ts:199, 286, 447, 934` — verificado), mas:

- `crm.tsx:2858` navega para `/agent/diagnostico-cnpj?context=...` → "Agente não encontrado". O botão "Analisar com IA" do card do contato — o handoff central com contexto automático — não funciona.
- `app-sidebar.tsx:352-376`: os 5 atalhos do guia "Qual agente usar?" (Diagnóstico CNPJ, Prospecção, Reversão de Objeções, Follow-Up, Roteiro de Reunião) usam IDs sem o sufixo → todos quebrados. O único recurso de recomendação contextual da plataforma está 100% inoperante.

**Ironia relevante:** o `agent-chat.tsx:243` lê o `?context=` e auto-monta a mensagem com CNPJ/segmento/score perfeitamente — o destino funciona, só o link está errado. Correção de 6 strings.

### C3. Importação termina em dead end, sem qualificação em lote
`BulkImportDialog.tsx` importa bem (preview, lotes, resumo), mas o botão final "Ver Painel" só fecha o dialog. Os leads entram como `nao_iniciado`, **sem qualificação automática** (`crm.ts:1522` só enriquece via EmpresAqui) e **não existe qualificação em lote** — as bulk actions são só status/tag/temperatura/responsável. Qualificar 50 leads importados = abrir contato por contato = ~150 cliques.
**Efeito:** o produto promete "importa e a IA qualifica"; na prática a junção importar→qualificar não existe.
**Correção:** (a) oferecer "Qualificar todos agora" no resumo da importação, ou (b) qualificação automática pós-import com fila/progresso; (c) adicionar "Qualificar IA" às bulk actions.

### C4. Onboarding não ensina o fluxo e tem targets quebrados
`use-onboarding.ts:13-60`: os 6 passos descrevem telas ("Visualize métricas..."), nenhum diz "1º importe, 2º qualifique, 3º aborde". Passos 4-6 apontam para `[data-tour="crm"]`, `"chat"`, `"settings"` que não existem no DOM do dashboard — tooltip cai em fallback descrevendo elemento invisível. `restart()` existe mas ninguém chama: fechou o tour, perdeu para sempre.
**Correção:** transformar em checklist persistente de setup ("0/3: importar → qualificar → abordar 1º lead quente") + link "rever tour" em Configurações/Cmd+K.

---

## ALTO — mina confiança ou custa cliques demais

### A1. Qualificação cria deal fantasma de R$ 50.000
`crm.ts:1743` (verificado): qualify de tier A/B/C cria deal automático com valor fixo `50000` e fechamento +30 dias, sem avisar no toast. Esses valores fictícios entram no "Forecast do Mês" — o gestor vê pipeline inflado por números que ninguém digitou.
**Correção:** não criar deal automático, ou criar sem valor (e marcar origem "auto"), e avisar no toast.

### A2. Dados falsos no dashboard
- Sparklines hardcoded (`dashboard.tsx:354-397`, ex. `spark: [2,4,3,5,6,7,8,9,8,10]` — verificado): "Empresas no CRM: 0" com gráfico subindo.
- "Mensagens estimadas" com `Math.random()` no gráfico semanal (`dashboard.tsx:334`).
- Badge/título "Operação ativa" com tudo zerado (`dashboard.tsx:452`).

**Efeito:** com tudo zerado o produto parece fake — pior que parecer vazio. Remover sparklines quando valor = 0 e eliminar números inventados.

### A3. Kanban não leva ao contato
Clicar num deal abre `DealEditModal` (`crm.tsx:3889`) que mostra a razão social como texto puro (`:3993`), sem link. Para ligar/WhatsApp: fechar modal → aba Empresas → buscar → abrir. 4+ cliques para a ação mais frequente do closer.
**Correção:** razão social clicável abrindo o painel do contato (com as ações rápidas que já existem e já registram atividade).

### A4. O diagnóstico do agente fica preso no chat
- "Adicionar nota no CRM" (`agent-chat.tsx:1311`) é link cru para `/crm` — usuário re-busca o contato e copia/cola na mão.
- "Gerar proposta" no chat só dispara outro prompt; nada vira deliverable nem atividade no deal.
- O wizard de entregáveis (`deliverables.tsx:1152` lê o prefill — funciona) recebe só `contactId/type/product/title`: a proposta **não aproveita o diagnóstico** gerado minutos antes. Diagnóstico→proposta são dois silos com a IA recomeçando do zero.

**Correção:** botão "Salvar como nota/atividade no contato" que poste via API, e passar o resultado do diagnóstico como insumo do entregável.

### A5. Duas taxonomias de funil dessincronizadas
Status do contato (14 opções) × etapa do deal (16+) não se sincronizam (exceto qualify→`qualificado`). O closer mantém dois funis paralelos à mão; contato "em negociação" com deal em "diagnóstico" é inevitável.
**Correção:** derivar o status do contato da etapa do deal (ou esconder um dos dois).

### A6. CTA primário errado para produto vazio
Com zero empresas, o botão preenchido do hero é "Iniciar diagnóstico" (chat sem dados); "Importar empresas-alvo" é outline e leva genericamente a `/crm` (`dashboard.tsx:466-477`).
**Correção:** CTA condicional — `totalContacts === 0` ⇒ "Importar empresas" vira primário e abre o dialog de importação direto.

### A7. Promete Excel, só parseia CSV
`BulkImportDialog.tsx:174` aceita `.csv,.xlsx,.xls`, mas o parse é só PapaParse (`:18, :50` — verificado). Um `.xlsx` resulta em "Nenhum CNPJ encontrado" e o SDR culpa o próprio arquivo. O hint ainda contradiz: "Extensões suportadas: .csv".
**Correção:** integrar SheetJS ou remover xlsx do accept e do texto.

---

## MÉDIO

- **M1. Catálogo de 30 agentes sem guidance visível.** No dashboard cada bloco mostra 4 nomes + "+ N mais", sem descrição. Redundâncias do ponto de vista do SDR: Diagnóstico CNPJ × Qualificação de Leads; Roteiro de Reunião × Coach de Descoberta; Pipeline × Relatório de Performance × Estrategista de Deals. Os 8 de marketing têm o mesmo peso visual para quem nunca os usará. ~12-15 agentes cobririam o dia a dia comercial. Mínimo: descrição de 1 linha na listagem + destaque dos 5 essenciais por papel.
- **M2. Orchestrate-modal expõe slugs técnicos.** Lookup hardcoded cobre 22 dos 30 agentes (`orchestrate-modal.tsx:39-74`); os 8 ausentes aparecem como `pricing-roi-tax-group`. O fluxo do modal em si (preview → confirmar → parecer do Coordenador) é bem desenhado.
- **M3. Sidebar mistura trabalho e administração.** 9 itens + rodapé: Base de Conhecimento, Analytics, Qualidade IA e Integrações são telas de admin no mesmo nível do CRM. 2FA como item permanente é ruído. Separar "Comercial" de "Administração" (ou ocultar por papel — o `can.tsx` já existe).
- **M4. "Ações rápidas" do chat são prompts disfarçados.** "Criar tarefa" (`agent-chat.tsx:1277-1310`) pede ao LLM que *descreva* uma tarefa — não cria nada no CRM. Promessa de ação estruturada não cumprida.
- **M5. Rótulo mentiroso:** "Relatórios" nas Ações Rápidas do dashboard leva para `/integrations` (`dashboard.tsx:1217-1220`).
- **M6. Faltas que um time comercial espera:** metas/quotas por vendedor, relatório de performance individual (existe o *agente*, não a tela), notificações de follow-up (hoje só tarefas genéricas).
- **M7. Modo demo não descobrível:** `?demo=1` só existe via landing page (`landing.tsx:217, 282`). SDR logado nunca descobre. Adicionar toggle em Configurações ou Cmd+K.
- **M8. Empty states ambíguos no dashboard:** "Prioridades de hoje" vazio diz "todas as tarefas em dia" — soa como sucesso quando significa "você não começou". "Últimas movimentações" sem orientação de próximo passo.
- **M9. Terminologia técnica em telas que o comercial encosta:** Analytics ("Total Tokens", "Latência Média", "provider" — deveria ser "custo por conversa/agente"), Base de Conhecimento ("Chunks", "embeddingModel", "Reindexar"), Qualidade IA ("Guardrails", "ragSources").
- **M10. Tarefas do TodayView com `contactId` mostram só ícone** (`TodayView.tsx:205`) — não abrem o contato.

## BAIXO

- B1. Enriquecimento EmpresAqui falha silenciosamente sem token configurado — usuário não sabe por que os dados vieram vazios.
- B2. Qualificação sem breakdown de critérios — só reasoning em prosa (o toast com score/nível e o bloco "Análise do Agente" já são bons).

---

## O que já funciona bem (preservar)

Kanban com 16 etapas agrupadas em 5 fases colapsáveis; ações rápidas Ligar/WhatsApp/Email registrando atividade automaticamente; `NextStepCard` criando tarefa em 1 clique; prefill real CRM→Entregáveis e leitura de contexto no chat; badges de leads quentes/tarefas vencidas na sidebar; popover "Qual agente usar?" com situações reais (só corrigir os links); copy comercial nativa no CRM/dashboard; complexidade técnica do chat escondida atrás de `isAdmin`; export de entregáveis em 3 formatos; Cmd+K.

---

## Ordem de execução sugerida

| # | Item | Esforço | Efeito |
|---|------|---------|--------|
| 1 | C2 — corrigir 6 IDs de agente | Trivial (strings) | Reativa handoff e guidance |
| 2 | C1 — CRM ler query params | Pequeno | Conserta ~15 links de uma vez |
| 3 | A7 — Excel ou só CSV | Pequeno | Elimina falha silenciosa |
| 4 | A2 + M5 — remover dados falsos e rótulo errado | Pequeno | Credibilidade imediata |
| 5 | C3 — qualificação em lote/pós-import | Médio | Fecha a junção central do fluxo |
| 6 | A1 — deal automático sem R$ 50k fixo | Pequeno | Forecast confiável |
| 7 | A3 — deal → contato clicável | Pequeno | Corta cliques da rotina do closer |
| 8 | A4 — diagnóstico → nota/proposta | Médio | Fecha o ciclo diagnóstico→proposta |
| 9 | C4 + A6 — checklist de setup + CTA condicional | Médio | Zero→produtivo sem treinamento |
| 10 | A5 — unificar taxonomias | Médio/Grande | Um funil só |
| 11 | M1-M3, M9 — guidance de agentes, sidebar por papel, copy | Médio | Reduz carga cognitiva |

**Critério de pronto:** um SDR novo, sem treinamento, importa um CSV, vê os leads qualificados, clica num lead quente a partir do dashboard, roda o diagnóstico com contexto automático e gera a proposta — sem nenhum beco sem saída no caminho.
