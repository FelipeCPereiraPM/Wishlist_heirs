# Wishlist heirs

Aplicação de listas de desejos compartilhadas, construída com React + TypeScript + Supabase.

## Stack

- **Front-end:** React 18 + Vite + TypeScript
- **Estilização:** Tailwind CSS + shadcn/ui (Radix)
- **Banco de Dados & Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Hospedagem:** Vercel

## Comandos

```bash
npm install        # instalar dependências
npm run dev        # rodar localmente
npm run build      # build de produção
npm run lint       # verificar código
npm test           # rodar testes (vitest)
```

## Documentação

- **`gemini.md`** — Guia de desenvolvimento, configuração do Supabase, deploy na Vercel e extensão do Chrome.
- **`MELHORIAS.md`** — Registro de melhorias aplicadas e próximos passos planejados.

## Funcionalidades

- Criar e gerenciar listas de desejos (públicas, privadas ou compartilhadas)
- Adicionar itens com link, categoria, tamanho/cor e observações
- Compartilhar listas com outras pessoas (visualizador ou editor)
- Explorar listas públicas de outros usuários
- Lixeira com recuperação de itens/listas excluídos (retenção de 30 dias)
- Upload de foto de perfil (com compressão automática)
- Modo claro/escuro
- Validação de formulários com zod
- Totalmente responsivo (mobile, tablet, desktop)
