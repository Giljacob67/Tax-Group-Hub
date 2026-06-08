#!/usr/bin/env node
/**
 * Script para criar o primeiro usuário admin do sistema.
 * 
 * Uso:
 *   node scripts/create-first-admin.mjs
 * 
 * Variáveis de ambiente necessárias:
 *   DATABASE_URL - URL do banco de dados PostgreSQL
 * 
 * O script irá pedir:
 *   - Email do admin
 *   - Nome do admin
 *   - Senha (mínimo 8 caracteres)
 */

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não configurado.");
    process.exit(1);
  }

  console.log("\n🔐 Criar Primeiro Usuário Admin\n");
  console.log("Este script criará o primeiro usuário administrador do sistema.");
  console.log("Após a criação, você poderá fazer login e criar outros usuários.\n");

  const email = await ask("📧 Email: ");
  const name = await ask("👤 Nome: ");
  
  let password = "";
  while (password.length < 8) {
    password = await ask("🔑 Senha (mínimo 8 caracteres): ");
    if (password.length < 8) {
      console.log("❌ Senha muito curta. Tente novamente.");
    }
  }

  rl.close();

  console.log("\n⏳ Criando usuário...");

  const sql = neon(databaseUrl);
  const SALT_ROUNDS = 12;
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    // Create user
    const [user] = await sql`
      INSERT INTO app_users (email, name, password_hash, is_active, created_at, updated_at)
      VALUES (${email.toLowerCase().trim()}, ${name.trim()}, ${passwordHash}, true, NOW(), NOW())
      RETURNING id, email, name
    `;

    console.log(`✅ Usuário criado com ID: ${user.id}`);

    // Assign admin role
    await sql`
      INSERT INTO app_user_roles (user_id, role, scope, granted_by, is_active, created_at)
      VALUES (${String(user.id)}, 'admin', NULL, ${String(user.id)}, true, NOW())
    `;

    console.log("✅ Role 'admin' atribuído com sucesso!");
    console.log("\n🎉 Primeiro admin criado com sucesso!");
    console.log(`\n📋 Dados de login:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nome: ${user.name}`);
    console.log(`\n⚠️  IMPORTANTE: Guarde estas credenciais em local seguro!`);
    console.log(`\n🌐 Agora você pode fazer login em: https://tax-group-hub.vercel.app/login\n`);
  } catch (err) {
    console.error("\n❌ Erro ao criar usuário:", err.message);
    if (err.message.includes("duplicate key")) {
      console.log("💡 Este email já está cadastrado. Tente outro ou resete a senha.");
    }
    process.exit(1);
  }
}

main().catch(console.error);
