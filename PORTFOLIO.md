# 🚀 Guia de Desenvolvimento - Meu Portfólio

Este guia orienta a criação, desenvolvimento e deploy de um Portfólio pessoal baseado na mesma stack e estrutura do projeto Wishlist heirs.

---

## 🛠️ Stack Tecnológica

- **Front-end:** React 18 (TypeScript) + Vite
- **Estilização:** Tailwind CSS + Shadcn UI + Radix UI
- **Banco de Dados & CMS:** Supabase (opcional para armazenar projetos, contatos ou visualizações)
- **Hospedagem:** Vercel

---

## 📂 Estrutura de Pastas Sugerida

```text
meu-portfolio/
├── src/                  # Código-fonte da aplicação React
│   ├── components/       # Componentes reutilizáveis (Card, Button, Layout, etc.)
│   ├── pages/            # Páginas do portfólio (Home, Projects, Contact, About)
│   ├── lib/              # Configurações de bibliotecas (ex: supabaseClient.ts)
│   ├── hooks/            # Hooks customizados do React
│   ├── App.tsx           # Componente raiz com o roteamento
│   ├── main.tsx          # Ponto de entrada do React
│   └── index.css         # Estilização global com Tailwind e variáveis CSS
├── public/               # Assets estáticos (imagens, currículo em PDF, favicon)
├── supabase/             # Configurações e migrations do banco de dados (opcional)
│   └── migrations/       # Tabelas para mensagens de contato ou estatísticas
├── vercel.json           # Configuração de rotas para Single Page Application na Vercel
├── README.md             # Apresentação do repositório
└── package.json          # Manifesto do projeto e dependências
```

---

## ⚙️ Configurações Essenciais

### 1. Suporte a Rotas na Vercel (SPA)
Para evitar erros 404 ao atualizar páginas internas no portfólio hospedado, mantenha o arquivo `vercel.json` na raiz com a seguinte configuração de redirecionamento:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Variáveis de Ambiente (`.env.local`)
Crie um arquivo `.env.local` na raiz para armazenar as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

---

## ⚡ Comandos Úteis

### Instalação de Dependências
Instale os pacotes definidos no `package.json`:
```bash
npm install
```

### Executar Localmente
Rode o projeto em modo de desenvolvimento:
```bash
npm run dev
```

### Deploy na Vercel via CLI
Para publicar o portfólio direto do terminal:

```bash
# 1. Instalar a CLI da Vercel globalmente (se necessário)
npm install -g vercel

# 2. Realizar login na Vercel
vercel login

# 3. Vincular e publicar o projeto
vercel
```
