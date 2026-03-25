# Tax Group AI Hub — Automação via Make

## Visão Geral

O AI Hub agora suporta execução automatizada de agentes via webhooks. Qualquer ferramenta de automação (Make, n8n, Zapier) pode consumir os endpoints.

---

## Endpoints Disponíveis

### Triggers (Cenários Pré-configurados)

| Trigger | Endpoint | Descrição |
|---------|----------|-----------|
| Novo Lead | `POST /api/automate/trigger/new-lead` | Lead do site → Prospecção + Qualificação |
| Calendário Editorial | `POST /api/automate/trigger/editorial-calendar` | Gera posts da semana |
| Reforma Tributária | `POST /api/automate/trigger/reforma-tributaria` | Insight diário |
| Follow-Up Check | `POST /api/automate/trigger/follow-up-check` | Leads sem contato recente |
| Conteúdo para Redes | `POST /api/automate/trigger/content-request` | LinkedIn ou Instagram |

### Genéricos

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/automate/execute` | POST | Executa qualquer agente com input custom |
| `/api/automate/pipeline` | POST | Executa múltiplos agentes em sequência |
| `/api/automate/triggers` | GET | Lista todos os triggers disponíveis |

---

## Configuração no Make

### 1. Novo Lead → Prospecção + Qualificação

**Módulo 1: Webhook (Trigger)**
- Tipo: Custom webhook
- URL: Copie a URL gerada pelo Make

**Módulo 2: HTTP (Make a request)**
- URL: `https://tax-group-hub-api-server.vercel.app/api/automate/trigger/new-lead`
- Method: POST
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "name": "{{1.name}}",
  "email": "{{1.email}}",
  "phone": "{{1.phone}}",
  "company": "{{1.company}}",
  "source": "{{1.source}}",
  "message": "{{1.message}}"
}
```

**Módulo 3: Router (Enviar resultado)**
- Branch A: Email de notificação com o script de abordagem
- Branch B: WhatsApp com o lead qualificado
- Branch C: Criar card no CRM/Trello com o scoring

---

### 2. Calendário Editorial Semanal (Cron → Segunda-feira)

**Módulo 1: Schedule (Trigger)**
- Interval: Every week
- Day: Monday
- Time: 07:00

**Módulo 2: HTTP (Make a request)**
- URL: `https://tax-group-hub-api-server.vercel.app/api/automate/trigger/editorial-calendar`
- Method: POST
- Body:
```json
{
  "week": "Semana de {{now}}",
  "channels": ["LinkedIn", "Email", "WhatsApp", "Instagram"]
}
```

**Módulo 3: Parse JSON**
- Extraia o campo `output` da resposta

**Módulo 4: Router por Canal**
- LinkedIn → Criar post agendado no Buffer/Hootsuite
- Email → Criar rascunho no Mailchimp
- WhatsApp → Enviar para o grupo do time

---

### 3. Reforma Tributária Diária

**Módulo 1: Schedule (Trigger)**
- Interval: Every day
- Time: 08:00

**Módulo 2: HTTP**
- URL: `https://tax-group-hub-api-server.vercel.app/api/automate/trigger/reforma-tributaria`
- Method: POST

**Módulo 3: Enviar**
- LinkedIn → Publicar como post
- WhatsApp → Broadcast para clientes
- Email → Newsletter para mailing

---

### 4. Follow-Up Automático (Lead sem contato há 7 dias)

**Módulo 1: Schedule (Trigger)**
- Interval: Every day
- Time: 09:00

**Módulo 2: Google Sheets / CRM (Search)**
- Buscar leads com `lastContact` > 7 dias atrás

**Módulo 3: HTTP**
- URL: `https://tax-group-hub-api-server.vercel.app/api/automate/trigger/follow-up-check`
- Method: POST
- Body:
```json
{
  "leads": [
    {
      "name": "{{2.name}}",
      "lastContact": "{{2.lastContact}}",
      "status": "{{2.status}}",
      "notes": "{{2.notes}}"
    }
  ]
}
```

**Módulo 4: WhatsApp / Email**
- Enviar a mensagem de follow-up gerada pelo agente

---

### 5. Site → LinkedIn/Instagram (Publicação Imediata)

**Módulo 1: Webhook (Trigger)**
- Recebe requisição do formulário do site
- Ou: Watch do banco de dados / Google Sheets

**Módulo 2: HTTP**
- URL: `https://tax-group-hub-api-server.vercel.app/api/automate/trigger/content-request`
- Method: POST
- Body:
```json
{
  "topic": "{{1.topic}}",
  "channel": "{{1.channel}}",
  "audience": "Empresários e profissionais de tributário",
  "tone": "Profissional e acessível"
}
```

**Módulo 3: Router**
- LinkedIn → Buffer / Hootsuite (agendar post)
- Instagram → Canva (gerar imagem) → Instagram API (publicar)

---

## Execução Genérica (Qualquer Agente)

Para executar qualquer agente diretamente:

```
POST /api/automate/execute
{
  "agentId": "linkedin-tax-group",
  "input": "Gere um post sobre os impactos da Reforma Tributária no agronegócio",
  "variables": {
    "client_name": "Fazenda São José",
    "sector": "Agronegócio"
  }
}
```

## Pipeline (Múltiplos Agentes)

Para executar agentes em sequência, onde a saída de um alimenta o próximo:

```
POST /api/automate/pipeline
{
  "steps": [
    {
      "agentId": "prospeccao-tax-group",
      "input": "Gere abordagem para empresa do agronegócio em Maringá"
    },
    {
      "agentId": "qualificacao-leads-tax-group",
      "input": "Qualifique o lead gerado acima"
    },
    {
      "agentId": "followup-tax-group",
      "input": "Gere sequência de follow-up para este lead qualificado"
    }
  ]
}
```

---

## Variáveis de Ambiente Necessárias (Vercel)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | Sim | Chave do Google AI (Gemini) |
| `GEMINI_MODEL` | Não | Modelo Gemini (default: gemini-3-flash-preview) |
| `API_KEY` | Não | Protege system prompts dos agentes |
| `OLLAMA_URL` | Não | URL do Ollama (alternativa ao Gemini) |

---

## Cenários Make — Importação Rápida

Após o deploy, acesse `/api/automate/triggers` para ver a lista completa de triggers com schemas de body. Use isso como referência para montar os cenários no Make.

Cada trigger retorna:
- `success: true/false`
- `output` — conteúdo gerado pelo agente
- `timestamp` — quando foi executado
- `agentUsed` — qual agente processou

Use esses campos para alimentar os próximos módulos do Make (enviar email, publicar post, criar card no CRM, etc.).
