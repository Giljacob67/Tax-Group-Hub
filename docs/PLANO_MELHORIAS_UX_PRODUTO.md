# Plano de Melhorias — Tax Group Command Center
## Foco: Usabilidade, Fluxo do Usuário e Adoção pela Equipe Comercial

**Data:** 2026-06-05  
**Status:** Pendente de execução  
**Esforço total estimado:** 30-39 horas

---

## Análise que Originou Este Plano

**Nota do produto:** 6/10 como ferramenta comercial  
**Problema central:** O produto é uma ferramenta para especialistas, não guia o usuário. Um SDR novo precisaria de 1-2 horas de treinamento para usar com confiança.

**Top 10 problemas identificados:**

| # | Problema | Severidade |
|---|----------|------------|
| 1 | Agentes de IA completamente desconectados do CRM | Crítico |
| 2 | Kanban de 16 colunas inutilizável em telas padrão | Crítico |
| 3 | Empty states sem CTA = usuário travado | Crítico |
| 4 | Terminologia técnica exposta ao usuário final (RAG, chunks, system prompt) | Alto |
| 5 | Dashboard é vitrine, não ferramenta de trabalho | Alto |
| 6 | CRM tem 11 tabs — 8 são ruído para o closer | Alto |
| 7 | NextStepCard é o melhor recurso — e está escondido | Alto |
| 8 | Não existe "Quick CNPJ Lookup" | Alto |
| 9 | Descoberta de agentes é impossível (30 agentes sem guidance) | Médio |
| 10 | Métricas do CRMDashboard são dead ends | Médio |

---

## FASE 0: Quick Wins (Terminologia e Segurança Básica)

**Objetivo:** Eliminar jargão técnico e proteger usuários não-técnicos de configurações avançadas.  
**Esforço:** 2-3 horas  
**Risco:** Baixo

### Tarefa 0.1: Renomear terminologia técnica

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/agent-chat.tsx`
- `artifacts/tax-group-hub/src/pages/knowledge-base.tsx`
- `artifacts/tax-group-hub/src/pages/deliverables.tsx`

**Mudanças:**

| Linha | Arquivo | De | Para |
|-------|---------|----|----|
| 965 | agent-chat.tsx | "Sem contexto RAG" | "Resposta sem fontes consultadas" |
| 1339 | agent-chat.tsx | "System Prompt" | "Instruções do Agente" |
| 673 | knowledge-base.tsx | "Chunks" | "Fragmentos" |
| 153 | knowledge-base.tsx | "Busca Semântica" | "Buscar na Base" |
| 907 | knowledge-base.tsx | "pipeline de embeddings" | "processamento de documentos" |
| 823, 954 | deliverables.tsx | "Fontes RAG" | "Fontes Consultadas" |

**Critério de aceite:** Nenhum termo técnico (RAG, chunks, embeddings, system prompt) aparece na interface do usuário final.

---

### Tarefa 0.2: Role-gate da página de Configurações

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/settings.tsx`
- `artifacts/tax-group-hub/src/App.tsx` (roteamento)

**Mudanças:**

1. Adicionar verificação de permissão no início de `settings.tsx`:
```tsx
const { data: userData } = useGetCrmMe();
const isAdmin = userData?.user?.roles?.includes('admin');

if (!isAdmin) {
  return <div>Acesso restrito. Configurações são disponíveis apenas para administradores.</div>;
}
```

2. Esconder botão "Configurações" da sidebar para não-admins (`app-sidebar.tsx` linha 240)

**Critério de aceite:** Usuários sem role "admin" não veem e não acessam a página de configurações.

---

### Tarefa 0.3: Esconder controles avançados do chat de agentes

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/agent-chat.tsx`

**Mudanças:**

1. Linha 764-776: Esconder botão "Configurações avançadas" (engrenagem) para não-admins
2. Linha 1274-1278: Esconder seletor de modelo para não-admins
3. Linha 1186: Não mostrar nome do modelo LLM para usuários normais

**Critério de aceite:** Usuários não-admin não veem controles de modelo, system prompt ou configurações técnicas no chat.

---

## FASE 1: Empty States e Primeiro Uso

**Objetivo:** Guiar o usuário do zero à produtividade em menos de 10 minutos.  
**Esforço:** 4-5 horas  
**Risco:** Baixo

### Tarefa 1.1: Adicionar CTAs em todos os empty states

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`
- `artifacts/tax-group-hub/src/pages/crm.tsx`
- `artifacts/tax-group-hub/src/pages/automations.tsx`
- `artifacts/tax-group-hub/src/pages/agent-chat.tsx`

**Mudanças:**

**Dashboard (quando todos KPIs = 0):**
```tsx
<EmptyState
  icon={Building2}
  title="Comece importando suas empresas-alvo"
  description="Importe uma lista de CNPJs para qualificar leads com IA e iniciar a prospecção comercial."
  action={{
    label: "Importar minha primeira lista",
    onClick: () => navigate('/crm?tab=contacts&import=true')
  }}
/>
```

**CRM contatos vazio (linha 2082-2106):**
Mover botão "Importar" do header para dentro do empty state:
```tsx
<EmptyState
  icon={Building2}
  title="Sua operação comercial ainda não tem empresas mapeadas"
  description="Importe uma lista de CNPJs ou adicione uma empresa-alvo para iniciar a priorização por IA."
  action={{
    label: "Importar CNPJs",
    onClick: () => setShowBulkImport(true)
  }}
  secondaryAction={{
    label: "Adicionar empresa manualmente",
    onClick: () => setShowAddLead(true)
  }}
/>
```

**Automações vazio (linha 287-297):**
Adicionar botão "Criar primeira sequência" que abre modal de criação.

**Agent Chat sidebar vazio (linha 578-586):**
Adicionar referência ao botão "+" e sugestão: "Clique no botão + acima para iniciar uma conversa."

**Critério de aceite:** Todo empty state tem pelo menos um botão CTA primário que executa a ação principal.

---

### Tarefa 1.2: Corrigir sparklines enganosos em KPIs zerados

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`

**Mudanças:**

Linhas 309-355 (array `metrics`):
```tsx
// Antes:
spark: [2, 4, 3, 5, 6, 7, 8, 9, 8, 10]

// Depois:
spark: value > 0 ? [2, 4, 3, 5, 6, 7, 8, 9, 8, 10] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
```

**Critério de aceite:** Quando o valor do KPI é 0, o sparkline mostra linha plana em zero, não tendência ascendente fake.

---

### Tarefa 1.3: Adicionar onboarding checklist no dashboard

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`

**Mudanças:**

Adicionar card no topo do dashboard (após hero, antes de KPIs):
```tsx
{showOnboarding && (
  <Card className="border-primary/20 bg-primary/5">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Configure sua operação em 4 passos
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <ChecklistItem 
        checked={hasContacts}
        label="Importar empresas-alvo"
        onClick={() => navigate('/crm?import=true')}
      />
      <ChecklistItem 
        checked={hasEnrichedContacts}
        label="Enriquecer dados com IA"
        onClick={() => navigate('/agent/diagnostico-cnpj')}
      />
      <ChecklistItem 
        checked={hasSequences}
        label="Criar primeira sequência de automação"
        onClick={() => navigate('/automations')}
      />
      <ChecklistItem 
        checked={hasConversations}
        label="Conversar com o Coordenador Geral"
        onClick={() => navigate('/agent/coordenador-geral')}
      />
    </CardContent>
  </Card>
)}
```

Persistir `showOnboarding` no localStorage. Mostrar apenas enquanto houver itens não-checkados.

**Critério de aceite:** Novo usuário vê checklist progressivo que desaparece quando todos os passos são completados.

---

## FASE 2: Conexão CRM ↔ Agentes

**Objetivo:** Eliminar a desconexão entre CRM e agentes de IA.  
**Esforço:** 6-8 horas  
**Risco:** Médio (requer passagem de contexto entre páginas)

### Tarefa 2.1: Adicionar botão "Analisar com IA" no painel do contato

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/crm.tsx` (ContactDetailPanel)
- `artifacts/tax-group-hub/src/pages/agent-chat.tsx` (recepção de contexto)

**Mudanças:**

**No ContactDetailPanel (crm.tsx):**
Adicionar botão no header do painel:
```tsx
<Button
  onClick={() => {
    const context = {
      contactId: contact.id,
      cnpj: contact.cnpj,
      razaoSocial: contact.razaoSocial,
      segmento: contact.segmento,
      score: contact.aiScore
    };
    navigate(`/agent/diagnostico-cnpj?context=${encodeURIComponent(JSON.stringify(context))}`);
  }}
>
  <Sparkles className="w-4 h-4 mr-2" />
  Analisar com IA
</Button>
```

**No agent-chat.tsx:**
Ler parâmetro `context` da URL e pré-preencher o chat:
```tsx
useEffect(() => {
  const contextParam = searchParams.get('context');
  if (contextParam) {
    const context = JSON.parse(decodeURIComponent(contextParam));
    setInitialMessage(
      `Analise o CNPJ ${context.cnpj} (${context.razaoSocial}) do segmento ${context.segmento}. Score atual: ${context.score}.`
    );
  }
}, []);
```

**Critério de aceite:** Usuário clica "Analisar com IA" no contato e é levado ao chat com o CNPJ pré-preenchido como primeira mensagem.

---

### Tarefa 2.2: Adicionar botão "Executar Agente" em ações rápidas do contato

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/crm.tsx`

**Mudanças:**

No painel de ações rápidas (Ligar, WhatsApp, Email), adicionar:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <Bot className="w-4 h-4 mr-2" />
      Executar Agente
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => runAgent('diagnostico-cnpj')}>
      Diagnóstico CNPJ
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => runAgent('reversao-objecoes')}>
      Reversão de Objeções
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => runAgent('follow-up')}>
      Follow-Up
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Critério de aceite:** Usuário pode executar agentes específicos diretamente do painel do contato, com contexto do contato passado automaticamente.

---

## FASE 3: Dashboard como Ferramenta de Trabalho

**Objetivo:** Transformar dashboard de vitrine em hub de ação diária.  
**Esforço:** 5-6 horas  
**Risco:** Baixo

### Tarefa 3.1: Reorganizar hierarquia do dashboard

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`

**Nova ordem das seções:**
1. Hero (manter)
2. **Prioridades de hoje** (mover para cá — era 3ª seção)
3. **Onboarding checklist** (novo, da Tarefa 1.3)
4. KPI cards (manter, mas sem sparklines fake)
5. Oportunidades por segmento (manter)
6. Agentes em ação (manter)
7. Ações rápidas (manter)

**Remover:**
- Seção "Como o hub gera valor" (linha 612-654) — já está na landing page
- Seção "Status do Sistema" (linha 536-609) — mover para /admin ou /settings
- Seção "Atividade Semanal" (linha 528-532) — dados hardcoded, sem valor real

**Critério de aceite:** "Prioridades de hoje" é a primeira coisa que o usuário vê após o hero. Seções de marketing/infra são removidas.

---

### Tarefa 3.2: Tornar KPIs clicáveis

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`

**Mudanças:**

Envolver cada KPI card em um link:
```tsx
<Link href="/crm?filter=hot-leads">
  <KpiCard
    label="Leads quentes"
    value={hotLeads}
    icon={Flame}
    clickable
  />
</Link>
```

**Mapeamento:**
- "Empresas no CRM" → `/crm?tab=contacts`
- "Leads quentes" → `/crm?filter=temperature:quente`
- "Propostas abertas" → `/crm?tab=pipeline`
- "Receita potencial" → `/crm?tab=pipeline&view=forecast`
- "Ações hoje" → `/crm?tab=today`
- "Campanhas ativas" → `/automations`

**Critério de aceite:** Clicar em qualquer KPI navega para a lista filtrada correspondente no CRM.

---

### Tarefa 3.3: Adicionar seção "Recomendações da IA" no dashboard

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/dashboard.tsx`
- Novo componente: `artifacts/tax-group-hub/src/components/crm/NextStepsOverview.tsx`

**Mudanças:**

Criar componente que agrega NextStepCard de todos os contatos:
```tsx
<NextStepsOverview
  limit={5}
  onAccept={(contactId, task) => createTask(contactId, task)}
  onIgnore={(contactId) => dismissNextStep(contactId)}
/>
```

Posicionar logo após "Prioridades de hoje".

**Critério de aceite:** Dashboard mostra top 5 recomendações de IA com botões "Criar tarefa" e "Ignorar" funcionais.

---

## FASE 4: Simplificação do CRM

**Objetivo:** Reduzir carga cognitiva e tornar o CRM focado no closer.  
**Esforço:** 4-5 horas  
**Risco:** Baixo

### Tarefa 4.1: Consolidar tabs do CRM

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/crm.tsx`

**Mudanças:**

**Manter tabs visíveis para todos:**
- Hoje
- Pipeline
- Empresas

**Mover para menu "Mais" (dropdown):**
- Atividades
- Alertas
- Dashboards

**Mover para /admin (role-gate):**
- Automações
- Filas
- Qualidade
- Governança
- Usuários

**Implementação:**
```tsx
<TabsList>
  <TabsTrigger value="today">Hoje</TabsTrigger>
  <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
  <TabsTrigger value="contacts">Empresas</TabsTrigger>
  
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm">Mais <ChevronDown /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => setActiveTab('activities')}>Atividades</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setActiveTab('alerts')}>Alertas</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setActiveTab('dashboards')}>Dashboards</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</TabsList>
```

**Critério de aceite:** CRM mostra apenas 3 tabs principais + menu "Mais". Tabs admin não aparecem para não-admins.

---

### Tarefa 4.2: Adicionar "Quick CNPJ Lookup" no header do CRM

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/crm.tsx`

**Mudanças:**

Adicionar input no header (ao lado de "Importar" e "Novo Lead"):
```tsx
<div className="relative w-64">
  <Input
    placeholder="Buscar ou adicionar CNPJ..."
    value={quickCnpj}
    onChange={(e) => setQuickCnpj(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && quickCnpj.length === 14) {
        handleQuickAdd(quickCnpj);
      }
    }}
  />
  {quickCnpj.length === 14 && (
    <Button size="sm" className="absolute right-1 top-1" onClick={() => handleQuickAdd(quickCnpj)}>
      Adicionar
    </Button>
  )}
</div>
```

**Função `handleQuickAdd`:**
```tsx
async function handleQuickAdd(cnpj: string) {
  // Busca dados no EmpresAqui
  const enrichedData = await fetchCnpjData(cnpj);
  
  // Cria contato com dados básicos
  const newContact = await createContact({
    cnpj,
    razaoSocial: enrichedData.razaoSocial,
    nomeFantasia: enrichedData.nomeFantasia,
    cnae: enrichedData.cnae,
    regimeTributario: enrichedData.regimeTributario,
    uf: enrichedData.uf,
    // Outros campos básicos
  });
  
  // Abre painel lateral para edição
  setSelectedContact(newContact);
  setQuickCnpj('');
}
```

**Critério de aceite:** Usuário cola um CNPJ de 14 dígitos, pressiona Enter, e o contato é criado com dados básicos preenchidos automaticamente.

---

## FASE 5: Pipeline Usável

**Objetivo:** Tornar o Kanban de 16 colunas utilizável em telas padrão.  
**Esforço:** 3-4 horas  
**Risco:** Baixo

### Tarefa 5.1: Implementar visualização agrupada do pipeline

**Arquivos:**
- `artifacts/tax-group-hub/src/pages/crm.tsx` (PipelineKanbanView)

**Mudanças:**

Agrupar 16 etapas em 5 fases visuais:
```tsx
const PIPELINE_PHASES = [
  {
    name: "Prospecção",
    stages: ["lead_novo", "qualificacao_comercial", "reuniao_agendada"],
    color: "blue"
  },
  {
    name: "Diagnóstico",
    stages: ["diagnostico_comercial", "enviado_para_matriz", "aguardando_matriz"],
    color: "violet"
  },
  {
    name: "Proposta",
    stages: ["proposta_pronta", "apresentacao_ao_cliente", "negociacao"],
    color: "amber"
  },
  {
    name: "Fechamento",
    stages: ["fechado_ganho", "perdido_standby"],
    color: "emerald"
  },
  {
    name: "Pós-Venda",
    stages: ["onboarding_cliente", "execucao_pela_matriz", "acompanhamento_pendencias", "pos_venda_expansao", "encerrado"],
    color: "gray",
    collapsible: true
  }
];
```

Renderizar cada fase como um grupo colapsável:
```tsx
{PIPELINE_PHASES.map(phase => (
  <PipelinePhaseGroup
    key={phase.name}
    phase={phase}
    deals={deals.filter(d => phase.stages.includes(d.stage))}
    defaultCollapsed={phase.collapsible}
  />
))}
```

**Critério de aceite:** Pipeline mostra 4 fases expandidas + 1 fase colapsável (Pós-Venda). Usuário pode expandir/colapsar fases. Em tela 1920px, todas as fases são visíveis sem scroll horizontal.

---

## FASE 6: Descoberta de Agentes

**Objetivo:** Guiar o usuário na escolha do agente certo para cada situação.  
**Esforço:** 3-4 horas  
**Risco:** Baixo

### Tarefa 6.1: Adicionar guia "Qual agente usar?" na sidebar

**Arquivos:**
- `artifacts/tax-group-hub/src/components/app-sidebar.tsx`

**Mudanças:**

Adicionar botão "Qual agente usar?" no topo da seção de agentes:
```tsx
<SidebarGroup>
  <SidebarGroupLabel>
    <HelpCircle className="w-4 h-4 mr-2" />
    Qual agente usar?
  </SidebarGroupLabel>
  <SidebarGroupContent>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          Ver guia rápido
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div>
            <strong>Acabei de receber um lead</strong>
            <div className="text-sm text-muted-foreground">
              → <Link href="/agent/diagnostico-cnpj">Diagnóstico CNPJ</Link>
            </div>
          </div>
          <div>
            <strong>Vou fazer o primeiro contato</strong>
            <div className="text-sm text-muted-foreground">
              → <Link href="/agent/prospeccao">Prospecção</Link>
            </div>
          </div>
          <div>
            <strong>Cliente fez uma objeção</strong>
            <div className="text-sm text-muted-foreground">
              → <Link href="/agent/reversao-objecoes">Reversão de Objeções</Link>
            </div>
          </div>
          <div>
            <strong>Cliente não respondeu</strong>
            <div className="text-sm text-muted-foreground">
              → <Link href="/agent/follow-up">Follow-Up</Link>
            </div>
          </div>
          <div>
            <strong>Preciso preparar uma reunião</strong>
            <div className="text-sm text-muted-foreground">
              → <Link href="/agent/roteiro-reuniao">Roteiro de Reunião</Link>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </SidebarGroupContent>
</SidebarGroup>
```

**Critério de aceite:** Usuário clica "Qual agente usar?" e vê guia com 5 situações comuns e links diretos para os agentes correspondentes.

---

### Tarefa 6.2: Renomear agentes confusos

**Arquivos:**
- `artifacts/api-server/src/lib/agents-data.ts`

**Mudanças:**

| Linha | De | Para | Descrição atualizada |
|-------|----|----|---------------------|
| 33 | "Coordenador Geral" | "Planejador de Campanhas" | "Monta planos completos usando vários agentes ao mesmo tempo." |
| 1788 | "Coach de Descoberta" | "Preparador de Reunião" | "Ajuda a preparar reuniões de diagnóstico com prospects (SPIN/Gap Selling)." |
| 1587 | "Customer Success" | "Pós-Venda" | "Pós-venda, coleta de NPS, renovações e acompanhamento de projetos após fechamento." |
| 1627 | "Pricing & ROI" | "Calculadora de ROI" | "Simula retorno sobre investimento e ajuda a precificar propostas." |
| 1607 | "Compliance de Conteúdo" | "Revisor de Conteúdo" | "Revisa materiais comerciais para garantir conformidade e qualidade." |

**Critério de aceite:** Nomes dos agentes usam vocabulário comercial em português, sem jargão técnico ou inglês desnecessário.

---

## FASE 7: Métricas Acionáveis

**Objetivo:** Transformar números estáticos em pontos de navegação.  
**Esforço:** 3-4 horas  
**Risco:** Baixo

### Tarefa 7.1: Tornar stat cards do TodayView clicáveis

**Arquivos:**
- `artifacts/tax-group-hub/src/components/crm/TodayView.tsx`

**Mudanças:**

Envolver cada stat card em um link:
```tsx
<Link href={`/crm?filter=overdue-followups`}>
  <StatCard
    label="Follow-ups vencidos"
    value={overdueCount}
    icon={Clock}
    color="red"
    clickable
  />
</Link>
```

**Mapeamento:**
- "Follow-ups vencidos" → `/crm?filter=overdue-followups`
- "Follow-ups hoje" → `/crm?filter=today-followups`
- "Reuniões hoje" → `/crm?filter=today-meetings`
- "Leads quentes" → `/crm?filter=temperature:quente`
- "Propostas abertas" → `/crm?tab=pipeline`

**Critério de aceite:** Clicar em qualquer stat card navega para a lista filtrada correspondente.

---

### Tarefa 7.2: Adicionar seção "Ações Urgentes" no CRMDashboard

**Arquivos:**
- `artifacts/tax-group-hub/src/components/crm/PersonaDashboard.tsx`

**Mudanças:**

Adicionar seção no topo do dashboard (antes dos gráficos):
```tsx
<Card>
  <CardHeader>
    <CardTitle>Ações Urgentes</CardTitle>
  </CardHeader>
  <CardContent className="space-y-2">
    {overdueFollowups > 0 && (
      <AlertItem
        icon={Clock}
        label={`${overdueFollowups} follow-ups vencidos`}
        onClick={() => navigate('/crm?filter=overdue-followups')}
        severity="high"
      />
    )}
    {staleDeals > 0 && (
      <AlertItem
        icon={AlertTriangle}
        label={`${staleDeals} deals parados há 7+ dias`}
        onClick={() => navigate('/crm?tab=pipeline&filter=stale')}
        severity="medium"
      />
    )}
    {unscoredLeads > 0 && (
      <AlertItem
        icon={Sparkles}
        label={`${unscoredLeads} leads sem score IA`}
        onClick={() => navigate('/crm?filter=unscored')}
        severity="low"
      />
    )}
  </CardContent>
</Card>
```

**Critério de aceite:** Dashboard mostra alertas de ações urgentes no topo, com links diretos para listas filtradas.

---

## Cronograma Sugerido

| Fase | Duração | Dependências |
|------|---------|--------------|
| **Fase 0: Quick Wins** | 2-3h | Nenhuma |
| **Fase 1: Empty States** | 4-5h | Fase 0 |
| **Fase 2: CRM ↔ Agentes** | 6-8h | Fase 1 |
| **Fase 3: Dashboard** | 5-6h | Fase 1 |
| **Fase 4: Simplificar CRM** | 4-5h | Fase 2 |
| **Fase 5: Pipeline** | 3-4h | Nenhuma |
| **Fase 6: Agentes** | 3-4h | Fase 2 |
| **Fase 7: Métricas** | 3-4h | Fase 3, 4 |

**Total estimado:** 30-39 horas de desenvolvimento

**Ordem recomendada:**
1. Fase 0 (quick wins imediatos)
2. Fase 1 (primeiro uso)
3. Fase 2 (core value loop)
4. Fase 5 (pipeline usável)
5. Fase 3 + 7 (dashboard acionável)
6. Fase 4 (simplificação)
7. Fase 6 (descoberta de agentes)

---

## Métricas de Sucesso

Após implementação, medir:

1. **Tempo até primeira ação:** Novo usuário deve importar primeiro CNPJ em < 5 minutos
2. **Uso de agentes:** % de contatos analisados com IA deve aumentar 3x
3. **Retenção diária:** % de usuários que abrem o app todo dia deve aumentar 50%
4. **NPS interno:** Pesquisa com equipe comercial após 30 dias de uso

---

## O Que Funciona Bem (Manter)

1. **Nomes dos agentes são claros e actionáveis** — "Reversão de Objeções", "Follow-Up", "Proposta Comercial"
2. **Suggested prompts são o secret weapon** — transformam chat vazio em experiência guiada
3. **TodayView é bem estruturado** — tarefas atrasadas em vermelho no topo, auto-simplificação
4. **Terminologia do CRM é excelente** — labels intuitivos para vendedor brasileiro
5. **Botões de ação rápida no painel do contato** — "Ligar", "WhatsApp", "Email" registram atividade automaticamente

---

## Recomendação Final

O produto tem a espinha dorsal certa: CRM + Agentes de IA + Pipeline. Mas atualmente é uma Ferrari sem volante — poderoso, mas o usuário não sabe como dirigir.

**Prioridade zero:** Conectar agentes ao CRM (botão "Analisar com IA" no contato) e guiar o usuário do vazio à produtividade (empty states com CTA + onboarding checklist).

**Prioridade um:** Reduzir carga cognitiva (esconder terminologia técnica, role-gate admin pages, simplificar dashboard).

**Prioridade dois:** Tornar métricas acionáveis (KPIs clicáveis, NextStepCard agregado, TodayView como hub diário).

Com essas mudanças, o produto sai de "precisa de 2h de treinamento" para "usável em 30 minutos" — e aí sim se torna uma ferramenta que a equipe comercial vai usar todo dia, não apenas quando o gerente obrigar.
