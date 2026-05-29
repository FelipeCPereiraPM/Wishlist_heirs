# 🚀 Guia de Desenvolvimento - Wishlist Dreams

Este arquivo serve como um painel de controle e guia técnico para a configuração, desenvolvimento e deploy do seu projeto de lista de desejos.

---

## 🛠️ Stack Tecnológica

- **Front-end:** React 18 (TypeScript) + Vite
- **Estilização:** Tailwind CSS + Shadcn UI + Radix UI
- **Banco de Dados & Auth:** Supabase
- **Hospedagem:** Vercel

---

## 📂 Estrutura de Pastas Implementada

```text
d:\Wishlist
├── Banco de dados/       # CSVs exportados para importação no Supabase
├── src/                  # Código-fonte da aplicação React
├── public/               # Assets estáticos
├── supabase/             # Configurações e Migrations do banco de dados
│   └── migrations/       # Scripts SQL para recriar as tabelas
├── vercel.json           # Configuração de rotas para Single Page Application na Vercel
├── gemini.md             # Este guia de orientação
└── package.json          # Manifesto do projeto e dependências
```

---

## 💾 Configuração do Supabase (Passo a Passo)

Como você está criando o projeto agora, siga estes dois passos essenciais dentro do painel do Supabase:

### 1. Criar a Estrutura (Tabelas e RLS)
No painel do seu projeto no Supabase, vá em **SQL Editor** -> **New Query** e execute o conteúdo dos arquivos de migração que estão na pasta `supabase/migrations` na seguinte ordem (do mais antigo para o mais recente):

1. `20260404160845_931b43b1-3d9d-4a06-b509-72e7dfd56ac1.sql` (Criação inicial)
2. `20260404161959_c047ca3a-e7fe-4df7-bcc2-b7c0b6ae9162.sql` (Tabela de itens)
3. `20260529133246_6e5f8b89-2a03-4ec4-8d75-879a245322be.sql` (Tabelas de listas/membros e novas políticas de segurança)
4. `20260529142539_ae7a4447-ed7d-4326-88ea-12a6d882b84f.sql` (Ajustes finais)

### 2. Importar os Dados Existentes (CSV)
No painel do Supabase, acesse **Table Editor**:
- Selecione a tabela `profiles` -> Clique em **Insert** -> **Import data from CSV** e envie o arquivo `profiles-export-2026-05-29_11-35-16.csv` da pasta `Banco de dados`.
- Selecione a tabela `wish_items` -> Clique em **Insert** -> **Import data from CSV** e envie o arquivo `wish_items-export-2026-05-29_11-35-02.csv`.

---

## ⚡ Comandos Úteis

### Instalação de Dependências
Para instalar os pacotes necessários de forma limpa usando o npm:
```bash
npm install
```

### Executar Localmente
Para rodar o projeto em modo de desenvolvimento local:
```bash
npm run dev
```

### Deploy na Vercel
Para fazer o deploy do projeto direto da linha de comando usando a CLI da Vercel:
```bash
# 1. Instalar a CLI da Vercel globalmente (se não tiver)
npm install -g vercel

# 2. Fazer login na sua conta da Vercel
vercel login

# 3. Vincular e publicar o projeto na Vercel (siga as instruções na tela)
vercel
```
