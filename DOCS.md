# DomSpy - Documentacao Tecnica

## Arquitetura

```
Frontend (Next.js 16 App Router)
    |
    ├── Pages (React Server/Client Components)
    ├── API Routes (/api/*)
    ├── Middleware (rate limiting)
    |
Backend
    ├── Prisma ORM 7
    ├── NextAuth.js (autenticacao)
    ├── Crawler (axios + cheerio)
    |
Database
    └── PostgreSQL (Supabase)
    
Deploy
    └── Vercel (auto-deploy do main)
```

---

## Stack Tecnologica

| Componente | Tecnologia | Versao |
|-----------|------------|--------|
| Framework | Next.js | 16.2.1 |
| ORM | Prisma | 7.6.0 |
| Banco de Dados | PostgreSQL (Supabase) | - |
| Autenticacao | NextAuth.js | 5.x |
| Visualizacao | React Flow (@xyflow/react) | - |
| Icones | Heroicons | @heroicons/react |
| CSS | Tailwind CSS | 4.x |
| HTTP Client | axios | - |
| HTML Parser | cheerio | - |
| Hash | bcryptjs | - |

---

## Estrutura de Diretorio

```
src/
├── app/                           # Next.js App Router
│   ├── page.tsx                   # Dashboard
│   ├── layout.tsx                 # Layout raiz + providers
│   ├── globals.css                # CSS global + temas
│   ├── login/page.tsx             # Tela de login
│   ├── register/page.tsx          # Tela de registro
│   ├── domains/
│   │   ├── page.tsx               # Lista de dominios
│   │   └── [id]/
│   │       ├── page.tsx           # Detalhe do dominio
│   │       ├── alerts/page.tsx    # Alertas
│   │       └── history/page.tsx   # Historico de crawls
│   ├── funnels/
│   │   ├── page.tsx               # Lista de funis
│   │   └── [id]/page.tsx          # Detalhe do funil
│   ├── groups/page.tsx            # Gerenciamento de grupos
│   ├── users/page.tsx             # Gerenciamento de usuarios
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts  # NextAuth handler
│       │   └── register/route.ts       # Registro de usuario
│       ├── domains/
│       │   ├── route.ts           # GET (listar) / POST (criar)
│       │   └── [id]/route.ts      # GET / PATCH / DELETE
│       ├── pages/route.ts         # POST (adicionar paginas)
│       ├── crawl/route.ts         # POST (iniciar crawl)
│       ├── crawl-page/route.ts    # POST (re-crawl pagina)
│       ├── crawl-all/route.ts     # POST (crawl todos)
│       ├── crawl-stop/route.ts    # POST (parar crawls)
│       ├── search/route.ts        # GET (busca global)
│       ├── export/route.ts        # GET (exportar CSV)
│       ├── download-html/route.ts # GET (baixar HTML)
│       ├── groups/
│       │   ├── route.ts           # GET / POST
│       │   ├── [id]/route.ts      # PATCH / DELETE
│       │   └── members/route.ts   # POST / DELETE
│       ├── funnels/
│       │   ├── route.ts           # GET / POST
│       │   ├── [id]/route.ts      # GET / PATCH / DELETE
│       │   ├── members/route.ts   # POST / DELETE
│       │   └── links/route.ts     # POST / DELETE
│       ├── alerts/
│       │   ├── dismiss/route.ts   # POST
│       │   └── dismiss-all/route.ts # POST
│       └── users/
│           ├── route.ts           # GET
│           └── [id]/route.ts      # PATCH / DELETE
├── components/
│   ├── Sidebar.tsx                # Menu lateral + logo + tema
│   ├── SiteTreeGraph.tsx          # Arvore interativa (React Flow)
│   ├── PageDetailPanel.tsx        # Painel de detalhes da pagina
│   ├── StatusCard.tsx             # Card de estatistica
│   ├── ThemeProvider.tsx          # Contexto de tema claro/escuro
│   ├── UserProfileDropdown.tsx    # Dropdown do perfil
│   ├── SessionProvider.tsx        # Provider NextAuth
│   └── AuthLayout.tsx             # Layout autenticado
├── lib/
│   ├── prisma.ts                  # Instancia Prisma Client
│   ├── auth.ts                    # Configuracao NextAuth
│   ├── auth-helpers.ts            # Helpers de autorizacao
│   ├── crawler.ts                 # Logica de crawling
│   ├── security.ts                # Seguranca (SSRF, rate limit, validacao)
│   └── content-analyzer.ts        # Analise de conteudo
├── types/
│   ├── index.ts                   # Tipos e cores de status
│   └── next-auth.d.ts             # Tipos NextAuth
├── middleware.ts                   # Middleware global (rate limiting)
└── generated/
    └── prisma/                    # Prisma Client gerado
```

---

## Banco de Dados (Prisma Schema)

### Modelos

#### User
```
id, email (unique), password (bcrypt), name, role, status, createdAt, updatedAt
Roles: super_admin | admin | viewer
Status: active | pending | disabled
```

#### Domain
```
id, url, name, createdAt, lastCrawlAt
Has many: pages, crawls, alerts, groups
```

#### Page
```
id, url, domainId, statusCode, responseTime
SEO: title, description, h1, headings (JSON), bodyText, images (JSON)
contentHash (para detectar duplicados)
parentPageId (arvore de navegacao)
crawlId
Unique: (url, domainId)
Has many: linksFrom, linksTo, dismissedAlerts, groupMembers, funnelPages
```

#### Link
```
id, fromPageId, toPageId, href, statusCode, isExternal, isRedirect, anchor
```

#### CrawlSession
```
id, domainId, status (running|completed|failed|blocked|stopped)
startedAt, finishedAt, totalPages, brokenLinks, slowPages
```

#### DismissedAlert
```
id, userId, pageId, domainId, alertType, dismissedAt
Unique: (userId, pageId, alertType)
```

#### PageGroup
```
id, name, color, domainId, createdAt
Limit: 50 por dominio
```

#### PageGroupMember
```
id, pageId, groupId
Unique: (pageId, groupId)
```

#### Funnel
```
id, name, description, color, createdAt, updatedAt
Has many: pages (FunnelPage), linksFrom, linksTo (FunnelLink)
```

#### FunnelPage
```
id, funnelId, pageId, position
Unique: (funnelId, pageId)
```

#### FunnelLink
```
id, fromFunnelId, toFunnelId
Unique: (fromFunnelId, toFunnelId)
```

---

## API Endpoints

### Autenticacao

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| POST | `/api/auth/[...nextauth]` | Login via NextAuth | Publico |
| POST | `/api/auth/register` | Registro de usuario | Publico (rate limited) |

### Dominios

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/domains` | Listar dominios | viewer |
| POST | `/api/domains` | Criar dominio | admin |
| GET | `/api/domains/[id]` | Detalhe do dominio (com paginas) | viewer |
| PATCH | `/api/domains/[id]` | Atualizar dominio (nome) | admin |
| DELETE | `/api/domains/[id]` | Excluir dominio | admin |

### Paginas

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| POST | `/api/pages` | Adicionar pagina(s) | admin |

### Crawl

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| POST | `/api/crawl` | Iniciar crawl num dominio | admin |
| POST | `/api/crawl-page` | Re-crawl pagina individual | admin |
| POST | `/api/crawl-all` | Crawl todos os dominios | admin |
| POST | `/api/crawl-stop` | Parar crawl(s) | admin |

### Busca

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/search?q=&exact=` | Busca global | viewer |

### Funis

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/funnels` | Listar funis | viewer |
| POST | `/api/funnels` | Criar funil | admin |
| GET | `/api/funnels/[id]` | Detalhe do funil | viewer |
| PATCH | `/api/funnels/[id]` | Atualizar funil | admin |
| DELETE | `/api/funnels/[id]` | Excluir funil | admin |
| POST | `/api/funnels/members` | Adicionar pagina(s) ao funil | admin |
| DELETE | `/api/funnels/members` | Remover pagina do funil | admin |
| POST | `/api/funnels/links` | Vincular funis | admin |
| DELETE | `/api/funnels/links` | Desvincular funis | admin |

### Grupos

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/groups?domainId=` | Listar grupos do dominio | viewer |
| POST | `/api/groups` | Criar grupo | admin |
| PATCH | `/api/groups/[id]` | Atualizar grupo | admin |
| DELETE | `/api/groups/[id]` | Excluir grupo | admin |
| POST | `/api/groups/members` | Adicionar pagina ao grupo | admin |
| DELETE | `/api/groups/members` | Remover pagina do grupo | admin |

### Alertas

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| POST | `/api/alerts/dismiss` | Dispensar alerta individual | admin |
| POST | `/api/alerts/dismiss-all` | Dispensar todos de um tipo | admin |

### Usuarios

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/users` | Listar usuarios | super_admin |
| PATCH | `/api/users/[id]` | Atualizar usuario (role/status) | super_admin |
| DELETE | `/api/users/[id]` | Excluir usuario | super_admin |

### Outros

| Metodo | Rota | Descricao | Permissao |
|--------|------|-----------|-----------|
| GET | `/api/export?domainId=` | Exportar CSV | viewer |
| GET | `/api/download-html?url=` | Baixar HTML da pagina | viewer |

---

## Conexao com o Banco de Dados

### Prisma Client (src/lib/prisma.ts)

O Prisma usa o adapter `@prisma/adapter-pg` (PrismaPg) para conectar diretamente ao PostgreSQL via connection string, com SSL habilitado para compatibilidade com Supabase:

```typescript
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });
```

Em desenvolvimento, o client e armazenado em `globalThis` para evitar reconexoes a cada hot-reload do Next.js.

### Configuracao Prisma (prisma.config.ts)

```typescript
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env["DATABASE_URL"] },
});
```

### Connection String

Formato Supabase (Transaction Pooler, porta 6543):
```
postgresql://postgres.[REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres
```

---

## Fluxo de Autenticacao

### Login (NextAuth.js)

1. Usuario submete email + senha no form `/login`
2. NextAuth chama `authorize()` em `src/lib/auth.ts`
3. Busca usuario por email no banco (`prisma.user.findUnique`)
4. Verifica status: se `pending` → erro "PENDING"; se `disabled` → erro "DISABLED"
5. Compara senha com hash usando `bcrypt.compare()`
6. Se valido, retorna objeto user (sem senha) para o JWT
7. Callbacks `jwt` e `session` adicionam `id`, `role` e `status` ao token/sessao
8. Cliente recebe sessao via `useSession()` hook

### Autorizacao (src/lib/auth-helpers.ts)

```typescript
// Hierarquia: viewer(0) < admin(1) < super_admin(2)
requireRole("admin") // Verifica se role >= admin
requireAuth()        // Apenas verifica se logado
```

Cada API route chama `requireRole()` no inicio. Se o nivel e insuficiente, retorna 403.

### Registro

1. POST `/api/auth/register` com name, email, password
2. Rate limit: 5 por IP a cada 15 minutos
3. Validacao: email formato, senha min 8 chars, nome min 2 chars
4. Hash com bcrypt (12 rounds)
5. Cria usuario com role=`viewer`, status=`pending`
6. Super Admin aprova via `/api/users/[id]` PATCH (status → active)

---

## Fluxo do Crawler (src/lib/crawler.ts)

### Processo Completo

```
crawlDomain(domainId, url)
    │
    ├── Cria CrawlSession (status: "running")
    ├── Deleta todas as pages anteriores do dominio
    │
    ├── Tenta Sitemap:
    │   ├── Busca /robots.txt → extrai URLs de Sitemap
    │   ├── Busca /sitemap.xml e /sitemap_index.xml
    │   ├── Se sitemap index → busca child sitemaps
    │   └── Para cada URL do sitemap → fetchPage()
    │
    ├── Se sem sitemap → BFS Crawl:
    │   ├── Comeca pela URL raiz
    │   ├── Para cada pagina → fetchPage() → extrai links
    │   ├── Links internos nao visitados entram na fila
    │   └── Respeita maxPages(100) e maxDepth(5)
    │
    ├── Para cada pagina:
    │   ├── fetchPage() com SSRF check
    │   ├── parseHtml() → extrai titulo, h1, desc, headings, imagens, links
    │   ├── Salva Page no banco
    │   ├── Salva Links no banco
    │   └── Atualiza contadores da CrawlSession
    │
    └── Finaliza CrawlSession (status: "completed")
```

### Extracao de Conteudo (parseHtml)

O parser usa cheerio para extrair dados do HTML:

1. **Metadados**: title, meta description, h1
2. **Headings**: todos os h2, h3, h4 com tag e texto
3. **Imagens**: src, alt, formato (detectado por extensao)
4. **Links**: href, ancora, isExternal (compara hostname)
5. **Body Text**: percorre o DOM na ordem real via `walkNode()`:
   - Texto → adiciona ao output
   - `<img>` → insere marcador `[IMG:N]` na posicao
   - Blocos (div, p, h1-h6, li) → adiciona quebras de linha
   - Secoes semanticas: HEADER, NAV, CONTEUDO PRINCIPAL, FOOTER
6. **Content Hash**: hash simples do texto para detectar duplicados

### Protecoes do Crawler

- **SSRF**: `isUrlSafe()` bloqueia IPs privados antes de cada request
- **Timeout**: 10s por pagina
- **Max Redirects**: 3 (reduzido de 5 para limitar redirect chains)
- **Cloudflare**: Detecta status 403 + "Just a moment" → marca crawl como "blocked"
- **Headers**: User-Agent simula Chrome real para evitar bloqueios

---

## Seguranca

### Headers HTTP (next.config.ts)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000`

### Rate Limiting (middleware.ts)
- Login: 10 tentativas por IP a cada 15 minutos
- Registro: 5 por IP a cada 15 minutos
- Crawl: 3 por IP por minuto

### Protecao SSRF (security.ts)
Bloqueia requisicoes HTTP para:
- IPs privados (127.x, 10.x, 192.168.x, 172.16-31.x)
- Localhost e IPv6 local
- AWS metadata (169.254.x)
- Protocolos nao-HTTP (file:, ftp:, data:)

### Validacao de Input (security.ts)
- `sanitizeString()` - Limita comprimento, remove HTML
- `validateUrl()` - Valida formato e protocolo
- `validateEmail()` - Valida formato
- `validatePassword()` - Minimo 8 caracteres
- `safeErrorMessage()` - Esconde stack traces em producao

### Autenticacao
- bcryptjs com 12 rounds para hashing de senhas
- JWT para sessoes (sem cookies de sessao no servidor)
- Hierarquia de roles: viewer < admin < super_admin

---

## Crawler (src/lib/crawler.ts)

### Funcionamento
1. Tenta encontrar `sitemap.xml` e `robots.txt`
2. Se encontrar sitemap, usa as URLs listadas
3. Se nao, faz BFS (busca em largura) a partir da URL raiz
4. Para cada pagina, extrai: titulo, h1, description, headings, body text, imagens, links

### Limites Padrao
- `maxPages`: 100 paginas por crawl
- `maxDepth`: 5 niveis de profundidade
- `timeout`: 10 segundos por pagina
- `maxRedirects`: 3

### Extracao de Conteudo
- Percorre o DOM na ordem real (texto + imagens intercalados)
- Insere marcadores `[IMG:N]` onde as imagens aparecem
- Separa conteudo em secoes: HEADER, NAV, CONTEUDO PRINCIPAL, FOOTER
- Limita body text a 5000 caracteres

### Protecao Cloudflare
Detecta paginas bloqueadas por Cloudflare (status 403 + "Just a moment") e marca o crawl como "blocked".

---

## Sistema de Temas (ThemeProvider.tsx)

### Implementacao
- Context React com `dark` | `light`
- Persiste em `localStorage` como `domspy-theme`
- Aplica atributo `data-theme` no `<html>`
- CSS overrides automaticos via seletores `[data-theme="dark"]`

### Cores do Dark Theme
- Background: `#0B0B14` (quase preto com tom roxo)
- Cards: `#161628`
- Texto: `#F1F1F8`
- Acentos: Gradiente `#7C3AED → #3B82F6`

### Cores do Light Theme
- Background: `#F5F5FA`
- Cards: `#FFFFFF`
- Texto: `#1A1A2E`
- Acentos: Mesmo gradiente roxo

---

## Variaveis de Ambiente

```env
# Banco de Dados (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Autenticacao
NEXTAUTH_SECRET="[string aleatoria de 32+ caracteres]"
NEXTAUTH_URL="https://seudominio.vercel.app"

# Crawler (opcional)
DOMSPY_CRAWL_KEY="[chave para headers do crawler]"

# Seed (apenas setup inicial)
SUPER_ADMIN_PASSWORD="[senha do primeiro admin]"
```

---

## Deploy

### Vercel (Producao)
1. Push no branch `main` = auto-deploy
2. Variaveis de ambiente configuradas no painel Vercel
3. Build: `next build` (Turbopack)

### Supabase (Banco)
1. Projeto: `kwrwbtsdgoexnzhhjbov`
2. Tabelas criadas via SQL Editor ou `npx prisma db push`
3. Connection pooling via Supavisor (porta 6543)

---

## Cores de Status

| Status | Cor | Hex | Quando |
|--------|-----|-----|--------|
| OK | Verde | `#14A44D` | HTTP 200, tempo < 900ms |
| Warning | Amarelo | `#E4A11B` | HTTP 3xx ou tempo 900ms-2s |
| Error | Vermelho | `#DC4C64` | HTTP 4xx/5xx ou tempo > 2s |
| Info | Azul | `#3B82F6` | Pendente (sem dados) |

---

DomSpy v2.0 - Documentacao Tecnica
