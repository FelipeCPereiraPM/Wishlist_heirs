# 📋 Registro de Melhorias — Wishlist heirs

Documento vivo com o histórico de melhorias aplicadas no projeto e os próximos passos planejados.

---

## ✅ Melhorias Aplicadas (Agosto/2026)

### Fase 1 — Funcionalidades e Bugs (Pontos 1-5)

#### 1. Soft-delete de itens + Lixeira + retenção 30 dias
- **Antes:** Itens eram hard-deletados (`DELETE`) com `window.confirm`. Listas já tinham soft-delete mas sem tela de recuperação.
- **Depois:** Itens agora usam soft-delete (`deleted_at`) com Toast "Desfazer" (10s), igual às listas. Nova página `/trash` permite restaurar ou excluir definitivamente. Cron `pg_cron` apaga registros com >30 dias automaticamente (diário 03:00 UTC).
- **Arquivos:** `src/pages/ListDetail.tsx` (soft-delete + Undo), `src/pages/Trash.tsx` (nova), `src/App.tsx` (rota), `src/components/AppLayout.tsx` (nav + badge), `supabase/migrations/20260815000000_trash_access.sql` (RLS + cron).
- **Textos atualizados:** "7 dias" → "30 dias" em `ListSettingsDialog.tsx`.

#### 2. `/reset-password` só via e-mail de recuperação
- **Antes:** Qualquer sessão existente ativava o formulário de nova senha.
- **Depois:** Só ativa via evento `PASSWORD_RECOVERY` do Supabase. Estado `checking` → `valid`/`invalid` com timeout de 3s. Troca de senha voluntária continua no "Editar perfil".
- **Arquivo:** `src/pages/ResetPassword.tsx`.

#### 3. Removida chamada `supabase.auth.getUser()` redundante
- **Antes:** `MyLists.tsx` chamava `getUser()` dentro da mutation de criar lista, mesmo tendo `user` no `AuthContext`.
- **Depois:** Usa `user.id` do contexto diretamente.
- **Arquivo:** `src/pages/MyLists.tsx:97`.

#### 4. `BrowseLists` busca perfis de forma direcionada
- **Antes:** Varria a tabela inteira de `profiles` para resolver nomes dos donos.
- **Depois:** Filtra `profiles` por `.in('user_id', ownerIds)` — só busca os donos relevantes, respeitando a RLS `can_view_profile`.
- **Arquivo:** `src/pages/BrowseLists.tsx:32`.

#### 5. Popup do app para confirmar exclusão de item
- **Antes:** `window.confirm` nativo do navegador.
- **Depois:** Novo `DeleteItemDialog` (shadcn `AlertDialog`) com design consistente com o app.
- **Arquivos:** `src/components/DeleteItemDialog.tsx` (novo), `src/pages/ListDetail.tsx`.

---

### Fase 2 — Experiência e Segurança (Pontos 6-10)

#### 6. ErrorBoundary montado
- **Antes:** Componente existia mas não estava conectado no `App.tsx`.
- **Depois:** Envolve `<Routes>` com botões "Ir para o início" + "Tentar novamente".
- **Arquivos:** `src/App.tsx`, `src/components/ErrorBoundary.tsx`.

#### 7. Feedback de erro de carregamento (completo)
- **QueryClient com defaults:** `staleTime: 30s`, `retry: 1×`, `refetchOnWindowFocus: false`.
- **Novo componente `QueryError`:** Card reutilizável com "Não foi possível carregar" + botão "Tentar novamente".
- **Helper `toastError`:** Eliminou ~10 duplicações do padrão `onError: (e) => toast({...})`.
- **Error UI aplicada em:** `MyLists`, `ListDetail`, `BrowseLists`, `Trash`, `ListSettingsDialog`.
- **Arquivos:** `src/App.tsx`, `src/components/QueryError.tsx` (novo), `src/lib/toast.ts` (novo), + 5 páginas.

#### 8. Extensão do Chrome — congelada (documentação)
- Marcada como "congelada" no `gemini.md`. Sem manutenção ativa. Reabertura futura requer: refresh de token, build-time injection da chave, testes.
- **Arquivo:** `gemini.md`.

#### 9. Validação de formulários com zod + react-hook-form
- **Antes:** `Auth.tsx` e `ResetPassword.tsx` usavam só `required`/`minLength` do HTML.
- **Depois:** Schemas zod (`authSchema`, `forgotSchema`, `resetPasswordSchema`) com `react-hook-form` + `zodResolver`. Erros inline por campo (e-mail inválido, senha curta, senhas não coincidem).
- **Arquivos:** `src/lib/authValidation.ts` (novo), `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`.

#### 10. Avatares seguros e eficientes
- **Migration:** Bucket `avatars` público + RLS de upload (só dono escreve em `user_id/*`).
- **Compressão:** Imagens redimensionadas para 256×256 JPEG quality 0.8 no browser (canvas) antes do upload.
- **Limite:** 50MB → 2MB. Validação de content-type real (não só `accept`).
- **Arquivos:** `supabase/migrations/20260815000001_avatar_storage_rls.sql`, `src/lib/compressImage.ts` (novo), `src/components/AppLayout.tsx`.

---

### Fase 3 — Responsividade 100%

#### Componentes base (impacto global)
- **`button.tsx`:** Todos os tamanhos (`default`, `sm`, `icon`) agora têm `h-11` (44px) — alvo de toque WCAG.
- **`input.tsx`:** `h-10` → `h-11` (44px).
- **`tailwind.config.ts`:** Removido bloco `container` morto (não usado em nenhuma página).

#### Problemas graves corrigidos
| Problema | Solução |
|---|---|
| Grid de 7 ícones transbordava no dialog mobile | `grid-cols-4 sm:grid-cols-7` |
| Botões editar/excluir invisíveis em touch (sem hover) | `opacity-100 sm:opacity-0 sm:group-hover:opacity-100` |
| Nav transbordava em 320px | `overflow-x-auto` + `whitespace-nowrap` + `px-3 sm:px-4` |
| Nomes longos de itens quebravam o card | `break-words` |
| Selects de membro não cabiam no mobile | `flex-col sm:flex-row` + `w-full sm:w-32` |

#### Problemas médios (alvo de toque)
- Filtros de categoria: `py-1.5` → `py-2.5` (30px → 40px).
- Link "Ver produto": `py-1.5` → `py-2`.
- Botões "Marcar/Desfazer": `py-2` → `py-2.5`.
- Botão remover membro: `p-1` → `p-2`.
- Inputs do modo edição (`WishItemCard`): `h-9` → `h-11`.

#### Problemas menores
- `ListDetail`: breakpoint `lg:` → `md:` (tablet agora usa 2 colunas) + `gap-4 md:gap-8`.
- Textareas agora têm `resize-y min-h-[80px]`.
- `NotFound`: adicionado `p-4` + link vira `<Button asChild>`.
- Diálogos (`MyLists`, `DeleteItemDialog`): `max-h-[90vh] overflow-y-auto`.
- Botões de modo do `Auth`: `py-2` (área de toque).
- Header do `MyLists`: `flex-wrap` + `truncate` no título.

---

## 📊 Resumo quantitativo

| Métrica | Valor |
|---|---|
| Migrations criadas | 2 (`trash_access`, `avatar_storage_rls`) |
| Arquivos novos | 7 (`Trash.tsx`, `DeleteItemDialog.tsx`, `QueryError.tsx`, `authValidation.ts`, `compressImage.ts`, `toast.ts`, `MELHORIAS.md`) |
| Arquivos editados | ~15 |
| Linhas de código duplicadas eliminadas | ~40 (onError refatorados para `toastError`) |
| Testes | 15/15 passando (lint 0 erros, build OK) |
| Alvo de toque mínimo | 44px (WCAG) em todos os inputs/botões |

---

## 🔄 Próximos Passos Planejados

### Fase 4 — Extrações de Layout (L1-L5)

> Objetivo: reduzir duplicação e melhorar legibilidade, sem mudança visual.

| ID | Tarefa | Status | Descrição |
|---|---|---|---|
| **L1** | Extrair `IconPicker` + mover ícones para `src/lib/listIcons.ts` | Pendente | Hoje `MyLists.tsx` (página) exporta `AVAILABLE_ICONS`/`getListIcon`. Grid de ícones duplicado em `MyLists` e `ListSettingsDialog`. Reduz ~40 linhas duplicadas. |
| **L2** | Extrair opções de visibilidade para constante | Pendente | Opções duplicadas em `MyLists.tsx:223` e `ListSettingsDialog.tsx:244`. Mover para `src/lib/listVisibility.ts`. |
| **L3** | Extrair `ItemForm` reutilizável | ✅ Aplicado | Form de adicionar (`ListDetail`) e editar (`WishItemCard`) agora usam `<ItemForm>` com `react-hook-form` + `zod`. Reduziu ~100 linhas duplicadas. Validação de URL no campo Link agora existente (normaliza `amazon.com` → `https://amazon.com`). |
| **L4** | Extrair `ProfileDialog` + `AvatarUpload` do `AppLayout` | Pendente | `AppLayout.tsx` tem ~397 linhas misturando shell + perfil + avatar + senha + tema. Separar cai para ~120 linhas. |
| **L5** | `ThemeProvider` + corrigir bug do tema | Pendente | Hoje o toggle adiciona `.light` em vez de `.dark` (inconsistente com `darkMode: ["class"]`). Criar `ThemeContext` custom, corrigir o CSS (inverter `:root`/`.dark`) ou adotar `next-themes`. |

### Fase 4b — Imagem do produto (D + E + F em camadas) ✅ Aplicado

> Objetivo: mostrar thumbnail do produto no card, sem custo de storage.

**Arquitetura:** a imagem é carregada direto do CDN da loja (hotlinking) — só a URL é guardada como texto numa coluna nova. Custo de storage/bandwidth no Supabase: zero.

| Camada | O quê | Arquivo |
|---|---|---|
| **D — Auto-extração** | Serverless `/api/preview` na Vercel faz fetch do HTML e extrai `og:image`. Proteção SSRF (bloqueia IPs privados, timeout 5s, exige JWT). Parse via regex nas tags Open Graph. | `api/preview.ts` |
| **E — Campo manual** | Campo "URL da imagem (opcional)" editável no formulário. Auto-preenchido por D, mas o usuário pode corrigir/limpar. | `src/components/ItemForm.tsx` |
| **F — Favicon fallback** | Se a imagem quebra ou não existe, mostra o favicon da loja via Google S2 (`s2/favicons`). | `src/lib/productImage.ts` |

- **Migration:** `20260816000000_add_item_image.sql` adiciona coluna `image_url` em `wish_items`.
- **Helpers:** `src/lib/productImage.ts` (`fetchPreview`, `faviconUrl`, `isValidImageUrl`).
- **vercel.json:** Rewrite exclui `/api` para a serverless funcionar.
- **Tipos:** `types.ts` atualizado manualmente com `image_url` em `Row`/`Insert`/`Update`.
- **ItemForm:** debounce 800ms no campo Link → chama `/api/preview` → autopreenche a imagem. Preview 64×64 com botão de remover. Falha não bloqueia o cadastro.
- **WishItemCard:** thumbnail lateral 64×64 (`h-16 w-16 object-cover`). Cadeia de fallback: `image_url` → favicon → nada.
- **Trash:** mesma thumbnail nos itens excluídos.
- **Dependência nova:** `@vercel/node` (devDep — só tipos, não afeta o bundle).
- **Custo total: zero.** Sem storage, sem serviço terceiro, usando o plano Hobby da Vercel já existente.

### Fase 4c — Preço do produto (extraído da URL) ✅ Aplicado

> Objetivo: puxar o valor do produto automaticamente ao colar o link, sem custo.

| Loja | Fonte | Confiabilidade |
|---|---|---|
| **Amazon** | Bloco JSON `twister-plus-buying-options-price-data` (`"displayPrice":"R$ 119,90"`) | Alta (buybox principal) |
| **Mercado Livre** | JSON-LD `offers.price` + `priceCurrency` | Alta (dados estruturados) |
| **Outros** | Meta `product:price:amount` ou JSON-LD | Média |

- **Migration:** `20260817000000_add_item_price.sql` adiciona coluna `price` (TEXT) em `wish_items`.
- **api/preview:** extrai preço com prioridade JSON-LD → meta OG → Amazon; formata para `R$ X,XX` pt-BR. Retorna `{ image, title, price }`.
- **ItemForm:** campo "💰 Preço (opcional)" editável, autopreenchido pelo debounce do link (só se o usuário não digitou manualmente).
- **WishItemCard:** badge verde `💰 R$ X,XX` ao lado da categoria.
- **Tipos:** `types.ts` atualizado com `price` em Row/Insert/Update.
- **Nota:** o preço é um snapshot no momento do cadastro (pode mudar na loja depois).
- **Custo: zero.**

### Fase 5 — Arquitetura

| ID | Tarefa | Descrição |
|---|---|---|
| **A1** | Criar camada de dados `src/api/` | Hoje todas as páginas fazem `supabase.from(...)` inline com query keys espalhadas. Criar `src/api/{lists,items,profiles,members}.ts` com query-key factories. **Maior ganho de manutenibilidade.** |
| **A2** | Remover dead code | `Index.tsx` (placeholder), `NavLink.tsx` (órfão), `ErrorBoundary.tsx` (já montado ✅), `use-mobile.tsx` (não usado), `components/ui/use-toast.ts` (re-export redundante), `deleteTimeouts` Map em `ListSettingsDialog.tsx:25`. |
| **A3** | Estender/usar `create_wish_list` RPC | A RPC existe mas é bypassada pelo app (insert direto para setar `icon`). Estender a RPC para aceitar `icon` e usá-la. |
| **A4** | Regenerar `types.ts` | Tipos Supabase desatualizados — faltam `can_view_profile`, `purge_trash`. Rodar `supabase codegen`. |
| **A5** | Corrigir `config.toml` | `project_id = "rfrvegyrniyvrxfxucwk"` difere do `.env` (`uyzrkibtcpkdflhmommm`). Necessário para `supabase db push` local. |
| **A6** | Adicionar scripts no `package.json` | `typecheck` (tsc --noEmit) e `lint:fix` (eslint --fix). |
| **A7** | Avaliar `.gitignore` | `dist/` (build artifacts) e `Banco de dados/` (CSVs) provavelmente não deveriam estar no version control. |

### Fase 6 — Testes

| ID | Tarefa | Descrição |
|---|---|---|
| **T1** | Testes de CRUD | Cobrir mutations de `ListDetail` (add/edit/delete item), `MyLists` (create list), `ListSettingsDialog` (add/remove member, soft-delete). |
| **T2** | Testes de RLS | Validar `can_view_list`, `can_edit_list`, `can_view_profile`, `purge_trash` via SQL. |
| **T3** | E2E com Playwright | Config já existe (`playwright.config.ts`). Escrever: login → criar lista → adicionar item → marcar comprado → soft-delete + undo → restaurar da lixeira. |
| **T4** | Mock do Supabase compartilhado | O mock em `pages.smoke.test.tsx` é duplicado. Extrair para `src/test/__mocks__/supabase.ts`. |

### Fase 7 — Extensão do Chrome (futura)

> Reabrir apenas quando necessário. Requer:
> - Refresh automático de token
> - Build-time injection da anon key (em vez de hardcoded)
> - Cobertura mínima de testes
> - Documentação atualizada

---

## 🗂️ Migrations do Supabase — Status

| # | Arquivo | Status |
|---|---|---|
| 1 | `20260404160845_931b43b1-...sql` | ✅ Aplicada (criação inicial) |
| 2 | `20260404161959_c047ca3a-...sql` | ✅ Aplicada (tabela de itens) |
| 3 | `20260529133246_6e5f8b89-...sql` | ✅ Aplicada (listas/membros/RLS) |
| 4 | `20260529142539_ae7a4447-...sql` | ✅ Aplicada (ajustes finais) |
| 5 | `20260810000000_add_deleted_at.sql` | ✅ Aplicada (soft-delete + icon + avatar_url) |
| 6 | `20260810000001_restrict_profiles_rls.sql` | ✅ Aplicada (RLS perfis + can_view_profile) |
| 7 | `20260815000000_trash_access.sql` | ✅ Aplicada (lixeira RLS + pg_cron purge 30 dias) |
| 8 | `20260815000001_avatar_storage_rls.sql` | ✅ Aplicada (bucket avatars + RLS upload) |

> **Verificação:** Para confirmar que tudo está no ar, rodar no SQL Editor:
> ```sql
> SELECT jobid, schedule, jobname FROM cron.job;  -- deve mostrar 'purge-trash-daily'
> SELECT proname FROM pg_proc WHERE proname IN ('purge_trash', 'can_view_profile', 'can_view_list', 'can_edit_list');
> SELECT id, name, public FROM storage.buckets WHERE id = 'avatars';  -- public = true
> ```

---

## 📌 Notas técnicas

- **Bug do tema (conhecido, adiado para L5):** O toggle em `AppLayout.tsx` adiciona/remove a classe `.light` no `<html>`, mas o Tailwind está configurado com `darkMode: ["class"]` (espera `.dark`). Hoje funciona porque o CSS usa `:root` (escuro) + `.light` (claro), mas variantes `dark:` do Tailwind nunca são ativadas. Será corrigido na Fase 4 (L5).
- **`use-mobile.tsx`:** Existe mas não é usado. As soluções de responsividade usaram classes Tailwind (`sm:`, `md:`, `lg:`) em vez do hook. Remoção prevista na Fase 5 (A2).
- **`config.toml`:** O `project_id` está errado (`rfrvegyrniyvrxfxucwk` vs `uyzrkibtcpkdflhmommm` no `.env`). Corrigir antes de rodar `supabase db push` localmente (Fase 5, A5).
