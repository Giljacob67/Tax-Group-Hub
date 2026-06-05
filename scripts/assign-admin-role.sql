-- Script para atribuir role 'admin' ao primeiro usuário do sistema
-- Execute este script no console SQL do Neon ou via psql

-- Primeiro, veja quais usuários existem:
SELECT id, email, created_at FROM app_users ORDER BY created_at ASC LIMIT 5;

-- Atribuir role 'admin' ao primeiro usuário (substitua USER_ID pelo ID correto):
-- INSERT INTO app_user_roles (user_id, role, scope, granted_by, is_active, created_at)
-- VALUES (USER_ID, 'admin', NULL, USER_ID, true, NOW());

-- Ou se já existir algum role, atualizar:
-- UPDATE app_user_roles SET is_active = true, role = 'admin' WHERE user_id = USER_ID;

-- Verificar se funcionou:
-- SELECT u.email, r.role, r.is_active 
-- FROM app_users u 
-- JOIN app_user_roles r ON u.id = r.user_id 
-- WHERE r.is_active = true;
