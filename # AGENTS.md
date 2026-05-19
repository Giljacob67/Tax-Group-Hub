# AGENTS.md

## Projeto
Tax Group Hub é uma aplicação profissional da Tax Group. O objetivo é ter uma plataforma estável, confiável, segura e com aparência premium.

## Diretrizes para agentes
- Não reescrever o projeto inteiro sem necessidade.
- Priorizar correções reais de bugs, estabilidade, segurança e qualidade de produção.
- Preservar identidade visual, copy e estrutura geral, salvo quando houver erro técnico.
- Trabalhar sempre em branch separada.
- Não commitar segredos, tokens, chaves ou credenciais.
- Não inventar endpoints, serviços ou variáveis de ambiente.
- Documentar qualquer variável de ambiente necessária.
- Validar alterações com lint, typecheck, build e testes quando disponíveis.
- Para bugs de upload, autenticação, banco, storage ou API, investigar o fluxo completo do front-end ao back-end.
- Preferir soluções simples, robustas e compatíveis com produção.

## Prioridades
1. Corrigir o upload da base de conhecimento.
2. Corrigir integrações quebradas.
3. Corrigir erros de build, typecheck e deploy.
4. Melhorar tratamento de erros e estados de loading.
5. Documentar configuração mínima do projeto.

## Padrão de entrega
Toda alteração deve vir acompanhada de:
- resumo do problema;
- causa raiz;
- solução aplicada;
- arquivos modificados;
- comandos de validação executados;
- riscos ou pendências.