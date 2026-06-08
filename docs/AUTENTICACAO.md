# Sistema de Autenticação — Tax Group Hub

## Visão Geral

O sistema agora possui autenticação completa com login/senha. O acesso é restrito a usuários cadastrados.

## Arquitetura

### Backend
- **Tabela `app_users`**: Armazena usuários com senha hash (bcrypt, 12 rounds)
- **Tabela `app_user_roles`**: Gerencia roles (admin, etc.)
- **JWT**: Tokens com expiração de 7 dias
- **Endpoints**:
  - `POST /api/auth/login` — Autentica e retorna JWT
  - `POST /api/auth/register` — Cria usuário (apenas admin)
  - `GET /api/auth/me` — Dados do usuário atual
  - `GET /api/auth/users` — Lista usuários (apenas admin)
  - `DELETE /api/auth/users/:id` — Desativa usuário (apenas admin)
  - `POST /api/auth/users/:id/reset-password` — Reset senha (apenas admin)

### Frontend
- **AuthContext**: Gerencia estado de autenticação
- **ProtectedRoute**: Componente para proteger rotas
- **Fetch interceptor**: Injeta Bearer token automaticamente
- **Tela de login**: `/login`

## Setup Inicial

### 1. Aplicar migrations

```bash
# Local
DATABASE_URL="postgresql://..." node scripts/apply-migrations.mjs

# Ou via Vercel (automático no build)
```

### 2. Criar primeiro admin

```bash
DATABASE_URL="postgresql://..." node scripts/create-first-admin.mjs
```

O script pedirá:
- Email
- Nome
- Senha (mínimo 8 caracteres)

### 3. Fazer login

Acesse: `https://tax-group-hub.vercel.app/login`

Use as credenciais criadas no passo anterior.

## Gerenciando Usuários

### Via API (requer token admin)

```bash
# Listar usuários
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://tax-group-hub.vercel.app/api/auth/users

# Criar usuário
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"novo@taxgroup.com","name":"Novo Usuario","password":"senha123","roles":["admin"]}' \
  https://tax-group-hub.vercel.app/api/auth/register

# Desativar usuário
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://tax-group-hub.vercel.app/api/auth/users/2

# Reset senha
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"novaSenha123"}' \
  https://tax-group-hub.vercel.app/api/auth/users/2/reset-password
```

### Via SQL (emergência)

```sql
-- Criar usuário admin diretamente
-- Primeiro, gere o hash da senha (use bcrypt online ou script)
INSERT INTO app_users (email, name, password_hash, is_active, created_at, updated_at)
VALUES ('admin@taxgroup.com', 'Admin', '$2a$12$...', true, NOW(), NOW());

-- Atribuir role admin
INSERT INTO app_user_roles (user_id, role, scope, granted_by, is_active, created_at)
VALUES ('1', 'admin', NULL, '1', true, NOW());
```

## Variáveis de Ambiente

Certifique-se de que estas variáveis estão configuradas no Vercel:

```env
JWT_SECRET=seu_segredo_jwt_aqui  # Gere com: openssl rand -hex 32
DATABASE_URL=postgresql://...
```

## Fluxo de Autenticação

1. Usuário acessa `/login`
2. Envia email + senha para `/api/auth/login`
3. Backend verifica e retorna JWT
4. Frontend armazena token no localStorage
5. Todas as requisições subsequentes incluem `Authorization: Bearer <token>`
6. Se token expirar (401), frontend redireciona para `/login`

## Segurança

- Senhas são hasheadas com bcrypt (12 rounds)
- Tokens JWT expiram em 7 dias
- Endpoints admin verificam role antes de executar
- CORS configurado para aceitar apenas domínios autorizados
- Rate limiting aplicado a todas as rotas `/api`

## Troubleshooting

### "Unauthorized" em todas as rotas
- Verifique se `JWT_SECRET` está configurado no Vercel
- Verifique se o token está sendo enviado no header

### Não consigo criar o primeiro admin
- Verifique se a migration `003_create_app_users.sql` foi aplicada
- Execute manualmente: `DATABASE_URL="..." node scripts/apply-migrations.mjs`

### Token expirou
- Faça login novamente em `/login`
- O token tem duração de 7 dias

## Próximos Passos

- [ ] Implementar página de gerenciamento de usuários no frontend
- [ ] Adicionar "esqueci minha senha" (requer configuração de email)
- [ ] Implementar 2FA (autenticação em dois fatores)
- [ ] Adicionar logs de auditoria para ações admin
