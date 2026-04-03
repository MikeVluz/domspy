# DomSpy - Guia Completo de Instalacao

Este guia permite que qualquer pessoa, mesmo sem experiencia em programacao,
instale e configure o DomSpy do zero.

---

## Indice

1. Pre-requisitos
2. Obter o Codigo Fonte
3. Instalar Dependencias
4. Configurar o Banco de Dados (Supabase)
5. Configurar Variaveis de Ambiente
6. Criar as Tabelas no Banco
7. Criar o Usuario Administrador
8. Rodar Localmente
9. Deploy na Vercel (Producao)
10. Dominio Proprio (Opcional)
11. Deploy Alternativo: Docker
12. Deploy Alternativo: VPS Ubuntu
13. Backup e Restauracao
14. Atualizacoes
15. Solucao de Problemas
16. Checklist de Seguranca

---

## 1. Pre-requisitos

Voce precisa instalar estas ferramentas antes de comecar:

### 1.1 Node.js (versao 20 ou superior)

Node.js e o motor que roda o DomSpy. Sem ele, nada funciona.

**Windows:**
1. Acesse https://nodejs.org
2. Clique no botao verde "LTS" (versao recomendada)
3. Execute o arquivo baixado (.msi)
4. Clique "Next" em tudo, mantenha as opcoes padrao
5. IMPORTANTE: marque "Add to PATH" se aparecer essa opcao

**Mac:**
1. Acesse https://nodejs.org e baixe o .pkg
2. Execute e siga as instrucoes
3. Ou, se voce tem Homebrew: `brew install node`

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Verificar se instalou:**
Abra o terminal (Prompt de Comando no Windows) e digite:
```bash
node --version
```
Deve mostrar algo como `v20.x.x`. Se mostrar erro, reinicie o computador e tente novamente.

### 1.2 Git

Git e o sistema de controle de versao que permite baixar e gerenciar o codigo.

**Windows:** Baixe de https://git-scm.com e instale com opcoes padrao.
**Mac:** Abra o Terminal e digite: `xcode-select --install`
**Linux:** `sudo apt install git`

**Verificar:** `git --version`

### 1.3 Contas online (todas gratuitas)

Voce precisa criar conta em 3 servicos:

1. **GitHub** (github.com) - para hospedar o codigo
2. **Supabase** (supabase.com) - para o banco de dados
3. **Vercel** (vercel.com) - para hospedar a aplicacao

Dica: crie a conta do GitHub primeiro e use ela para logar no Supabase e Vercel (botao "Continue with GitHub").

---

## 2. Obter o Codigo Fonte

### Opcao A: Clonar do GitHub (recomendado)

Abra o terminal e digite:
```bash
git clone https://github.com/Grupo-xequemat/DomSpy.git
cd DomSpy
```

Isso cria uma pasta chamada "DomSpy" com todo o codigo do projeto.

### Opcao B: Baixar como ZIP

1. Acesse o repositorio no GitHub
2. Clique no botao verde "Code"
3. Clique em "Download ZIP"
4. Extraia o ZIP para uma pasta no seu computador
5. Abra o terminal nessa pasta

---

## 3. Instalar Dependencias

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

**O que este comando faz:** Baixa todos os pacotes que o DomSpy precisa para funcionar (~535 pacotes). Isso pode demorar 1-2 minutos dependendo da sua internet.

Ao terminar, voce vera uma pasta `node_modules` criada dentro do projeto.

O script de pos-instalacao roda automaticamente e gera os tipos do Prisma. Voce deve ver a mensagem: "Generated Prisma Client to ./src/generated/prisma"

---

## 4. Configurar o Banco de Dados (Supabase)

O Supabase fornece um banco de dados PostgreSQL gratuito na nuvem.

### 4.1 Criar conta no Supabase

1. Acesse https://supabase.com
2. Clique em "Start your project"
3. Clique em "Continue with GitHub" (mais facil) ou crie com email
4. Aceite os termos de uso

### 4.2 Criar um projeto

1. Apos logar, clique no botao verde "New Project"
2. **Organization:** selecione sua organizacao (ou crie uma se pedido)
3. **Project name:** digite `domspy`
4. **Database Password:** MUITO IMPORTANTE!
   - Digite uma senha forte (ex: `MinhaS3nh4Sup3r_F0rte`)
   - ANOTE ESSA SENHA em algum lugar seguro
   - Voce vai precisar dela no proximo passo
5. **Region:** escolha a mais proxima de voce
   - Para Brasil: "South America (Sao Paulo)"
6. Clique em "Create new project"
7. Aguarde 2-3 minutos enquanto o projeto e criado

### 4.3 Encontrar a Connection String

Esta e a "senha" que conecta o DomSpy ao seu banco de dados:

1. No painel do Supabase, clique no botao verde "Connect" no topo da tela
2. Ou va em: icone de engrenagem (Settings) → Database
3. Procure a secao "Connection string"
4. Clique na aba "URI"
5. Voce vera algo assim:
   ```
   postgresql://postgres.[referencia]:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
6. Substitua `[YOUR-PASSWORD]` pela senha que voce criou no passo 4.2

**IMPORTANTE:** Use a conexao "Transaction Pooler" (porta 6543), NAO a conexao direta (porta 5432). A porta 6543 e necessaria para funcionar com a Vercel.

---

## 5. Configurar Variaveis de Ambiente

### 5.1 Criar o arquivo .env

No terminal, dentro da pasta do projeto:
```bash
cp .env.example .env
```

Este comando copia o arquivo de exemplo para criar sua configuracao local.

### 5.2 Editar o arquivo .env

Abra o arquivo `.env` em qualquer editor de texto (VS Code, Notepad, nano) e preencha:

```env
# Conexao com o banco de dados (cole a string do passo 4.3)
DATABASE_URL="postgresql://postgres.abcdef:MinhaSenh4Forte@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

# Segredo para criptografar sessoes (veja como gerar abaixo)
NEXTAUTH_SECRET="kJ7xP2mN9qR4sT6vW8yA1bC3dE5fG7hI9jK0lM2nO4p"

# URL da aplicacao (mantenha localhost para desenvolvimento)
NEXTAUTH_URL="http://localhost:3000"

# Dados do primeiro administrador
SUPER_ADMIN_EMAIL="admin@domspy.com"
SUPER_ADMIN_PASSWORD="SuaSenhaForte123!"
SUPER_ADMIN_NAME="Administrador"

# Chave do crawler (pode deixar vazio)
DOMSPY_CRAWL_KEY=""
```

### Como gerar o NEXTAUTH_SECRET

Este valor precisa ser uma string aleatoria longa (32+ caracteres).

**Linux ou Mac:**
```bash
openssl rand -base64 32
```

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

**Ou acesse:** https://generate-secret.vercel.app/32 e copie o resultado.

### O que cada variavel faz:

| Variavel | O que e | Exemplo |
|----------|---------|---------|
| DATABASE_URL | Endereco do banco Supabase | postgresql://postgres... |
| NEXTAUTH_SECRET | Chave para criptografar sessoes de login | String aleatoria 32+ chars |
| NEXTAUTH_URL | URL onde o DomSpy esta rodando | http://localhost:3000 |
| SUPER_ADMIN_EMAIL | Email do primeiro admin | admin@domspy.com |
| SUPER_ADMIN_PASSWORD | Senha do primeiro admin (min 8 chars) | SuaSenhaForte123! |
| SUPER_ADMIN_NAME | Nome exibido do admin | Administrador |
| DOMSPY_CRAWL_KEY | Header enviado pelo crawler (opcional) | (vazio) |

---

## 6. Criar as Tabelas no Banco

### Opcao A: Via Prisma (mais facil)

```bash
npx prisma db push
```

Este comando le o schema do Prisma e cria automaticamente todas as tabelas no Supabase.

### Opcao B: Via SQL no Supabase (se a opcao A falhar)

1. No painel do Supabase, clique em "SQL Editor" no menu lateral
2. Clique em "New query" (ou no botao +)
3. Apague tudo que estiver no editor
4. Copie e cole TODO o SQL abaixo
5. Clique em "Run" (ou pressione Ctrl+Enter)
6. Voce deve ver "Success. No rows returned" para cada comando

```sql
-- Tipos (Enums)
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'viewer');
CREATE TYPE "UserStatus" AS ENUM ('active', 'pending', 'disabled');

-- Tabela: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "status" "UserStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Tabela: Domain
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCrawlAt" TIMESTAMP(3),
    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- Tabela: Page
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "h1" TEXT,
    "headings" TEXT,
    "bodyText" TEXT,
    "images" TEXT,
    "contentHash" TEXT,
    "parentPageId" TEXT,
    "crawlId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Page_url_domainId_key" ON "Page"("url", "domainId");

-- Tabela: Link
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "fromPageId" TEXT NOT NULL,
    "toPageId" TEXT,
    "href" TEXT NOT NULL,
    "statusCode" INTEGER,
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "isRedirect" BOOLEAN NOT NULL DEFAULT false,
    "anchor" TEXT,
    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- Tabela: CrawlSession
CREATE TABLE "CrawlSession" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalPages" INTEGER NOT NULL DEFAULT 0,
    "brokenLinks" INTEGER NOT NULL DEFAULT 0,
    "slowPages" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    CONSTRAINT "CrawlSession_pkey" PRIMARY KEY ("id")
);

-- Tabela: DismissedAlert
CREATE TABLE "DismissedAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DismissedAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DismissedAlert_userId_pageId_alertType_key"
    ON "DismissedAlert"("userId", "pageId", "alertType");

-- Tabela: PageGroup
CREATE TABLE "PageGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "domainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageGroup_pkey" PRIMARY KEY ("id")
);

-- Tabela: PageGroupMember
CREATE TABLE "PageGroupMember" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "PageGroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PageGroupMember_pageId_groupId_key"
    ON "PageGroupMember"("pageId", "groupId");

-- Tabela: Funnel
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- Tabela: FunnelPage
CREATE TABLE "FunnelPage" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FunnelPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FunnelPage_funnelId_pageId_key"
    ON "FunnelPage"("funnelId", "pageId");

-- Tabela: FunnelLink
CREATE TABLE "FunnelLink" (
    "id" TEXT NOT NULL,
    "fromFunnelId" TEXT NOT NULL,
    "toFunnelId" TEXT NOT NULL,
    CONSTRAINT "FunnelLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FunnelLink_fromFunnelId_toFunnelId_key"
    ON "FunnelLink"("fromFunnelId", "toFunnelId");

-- Relacionamentos (Foreign Keys)
ALTER TABLE "Page" ADD CONSTRAINT "Page_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE;
ALTER TABLE "Page" ADD CONSTRAINT "Page_parentPageId_fkey"
    FOREIGN KEY ("parentPageId") REFERENCES "Page"("id") ON DELETE SET NULL;
ALTER TABLE "Page" ADD CONSTRAINT "Page_crawlId_fkey"
    FOREIGN KEY ("crawlId") REFERENCES "CrawlSession"("id") ON DELETE SET NULL;
ALTER TABLE "Link" ADD CONSTRAINT "Link_fromPageId_fkey"
    FOREIGN KEY ("fromPageId") REFERENCES "Page"("id") ON DELETE CASCADE;
ALTER TABLE "Link" ADD CONSTRAINT "Link_toPageId_fkey"
    FOREIGN KEY ("toPageId") REFERENCES "Page"("id") ON DELETE SET NULL;
ALTER TABLE "CrawlSession" ADD CONSTRAINT "CrawlSession_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE;
ALTER TABLE "DismissedAlert" ADD CONSTRAINT "DismissedAlert_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "DismissedAlert" ADD CONSTRAINT "DismissedAlert_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE;
ALTER TABLE "DismissedAlert" ADD CONSTRAINT "DismissedAlert_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE;
ALTER TABLE "PageGroup" ADD CONSTRAINT "PageGroup_domainId_fkey"
    FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE;
ALTER TABLE "PageGroupMember" ADD CONSTRAINT "PageGroupMember_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE;
ALTER TABLE "PageGroupMember" ADD CONSTRAINT "PageGroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "PageGroup"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelPage" ADD CONSTRAINT "FunnelPage_funnelId_fkey"
    FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelPage" ADD CONSTRAINT "FunnelPage_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelLink" ADD CONSTRAINT "FunnelLink_fromFunnelId_fkey"
    FOREIGN KEY ("fromFunnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE;
ALTER TABLE "FunnelLink" ADD CONSTRAINT "FunnelLink_toFunnelId_fkey"
    FOREIGN KEY ("toFunnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE;
```

---

## 7. Criar o Usuario Administrador

Execute o script de seed para criar o primeiro usuario Super Admin:

```bash
npx tsx prisma/seed.ts
```

Voce vera a mensagem: `Super admin created: admin@domspy.com`

Se o comando `npx tsx` nao funcionar, tente:
```bash
npx ts-node prisma/seed.ts
```

Este usuario e criado com as credenciais que voce definiu no arquivo `.env`:
- Email: valor de SUPER_ADMIN_EMAIL
- Senha: valor de SUPER_ADMIN_PASSWORD
- Nivel: Super Admin (acesso total)
- Status: Ativo (ja pode logar imediatamente)

---

## 8. Rodar Localmente

Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

Abra o navegador e acesse: http://localhost:3000

Voce deve ver a tela de login do DomSpy com o logo do olho/radar.

Faca login com:
- Email: o que voce definiu em SUPER_ADMIN_EMAIL
- Senha: o que voce definiu em SUPER_ADMIN_PASSWORD

Apos logar, voce vera o Dashboard vazio. Para comecar a usar:
1. Va em "Dominios" no menu lateral
2. Adicione um dominio (nome + URL)
3. Clique no botao play para iniciar o crawl
4. Aguarde o escaneamento terminar

---

## 9. Deploy na Vercel (Producao)

### 9.1 Subir codigo para o GitHub

Se o codigo ainda nao esta no GitHub:

```bash
git init
git add -A
git commit -m "DomSpy v2.0"
git remote add origin https://github.com/SEU-USUARIO/DomSpy.git
git push -u origin main
```

### 9.2 Conectar o repositorio na Vercel

1. Acesse https://vercel.com e faca login com GitHub
2. Clique em "Add New..." no canto superior direito
3. Selecione "Project"
4. Encontre o repositorio "DomSpy" na lista
5. Clique em "Import"

### 9.3 Configurar o build

O Vercel detecta automaticamente que e um projeto Next.js:
- Framework Preset: Next.js (auto-detectado)
- Build Command: deixe o padrao
- Output Directory: deixe o padrao

### 9.4 Adicionar variaveis de ambiente

PASSO CRITICO. Sem isso, o deploy vai falhar.

Na secao "Environment Variables", adicione cada variavel:

1. Clique em "Add"
2. Name: `DATABASE_URL` → Value: (sua string do Supabase)
3. Clique em "Add"
4. Name: `NEXTAUTH_SECRET` → Value: (seu segredo aleatorio)
5. Clique em "Add"
6. Name: `NEXTAUTH_URL` → Value: `https://domspy.vercel.app` (atualize depois)

### 9.5 Fazer o deploy

Clique em "Deploy". Aguarde 2-3 minutos.

### 9.6 Atualizar a URL

Apos o primeiro deploy, a Vercel fornece a URL real (ex: `https://domspy-abc123.vercel.app`):

1. Va em Project Settings → Environment Variables
2. Edite NEXTAUTH_URL com a URL real da Vercel
3. Va em Deployments → clique "..." no deploy mais recente → "Redeploy"

### 9.7 Testar

Acesse sua URL da Vercel. Faca login com as credenciais do admin.

A partir de agora, cada `git push` no branch `main` atualiza automaticamente.

---

## 10. Dominio Proprio (Opcional)

### 10.1 Adicionar na Vercel
1. No projeto na Vercel: Settings → Domains
2. Digite seu dominio (ex: `domspy.suaempresa.com.br`)
3. Clique "Add"

### 10.2 Configurar DNS
No seu provedor de dominio, adicione um registro:
- **Tipo:** CNAME
- **Nome:** `domspy` (ou `@` para dominio raiz)
- **Valor:** `cname.vercel-dns.com`

Aguarde 5-30 minutos para propagacao DNS.

### 10.3 Atualizar NEXTAUTH_URL
Atualize a variavel de ambiente na Vercel para o novo dominio e redeploy.

---

## 11. Deploy Alternativo: Docker

Crie um arquivo `Dockerfile` na raiz do projeto:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

Construir e rodar:
```bash
docker build -t domspy .
docker run -p 3000:3000 --env-file .env domspy
```

Acesse http://localhost:3000

---

## 12. Deploy Alternativo: VPS Ubuntu

### 12.1 Preparar o servidor

Conecte via SSH ao seu servidor e instale as dependencias:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2
```

### 12.2 Clonar e configurar

```bash
cd /var/www
sudo git clone https://github.com/SEU-USUARIO/DomSpy.git
cd DomSpy
sudo chown -R $USER:$USER .
npm install
cp .env.example .env
nano .env
```

Edite o .env com suas credenciais (Ctrl+O para salvar, Ctrl+X para sair).

### 12.3 Build e iniciar com PM2

```bash
npm run build
pm2 start npm --name domspy -- start
pm2 save
pm2 startup
```

O ultimo comando mostra uma linha para copiar e colar — execute-a para iniciar automaticamente apos reboot.

### 12.4 Configurar Nginx como proxy

```bash
sudo nano /etc/nginx/sites-available/domspy
```

Cole este conteudo:
```nginx
server {
    listen 80;
    server_name domspy.seudominio.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar e reiniciar:
```bash
sudo ln -s /etc/nginx/sites-available/domspy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 12.5 HTTPS gratuito com Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d domspy.seudominio.com.br
```

Siga as instrucoes. O certificado e renovado automaticamente.

---

## 13. Backup e Restauracao

### Backup pelo Supabase
No painel do Supabase: Settings → Database → Backups

### Backup manual via terminal
Precisa do cliente PostgreSQL instalado:
```bash
pg_dump "sua_connection_string" > backup_domspy_$(date +%Y%m%d).sql
```

### Restaurar um backup
```bash
psql "sua_connection_string" < backup_domspy_20260403.sql
```

---

## 14. Atualizacoes

### Se usa Vercel:
Apenas faca `git push` no branch main. A Vercel detecta e faz deploy automatico.

### Se usa VPS:
```bash
cd /var/www/DomSpy
git pull origin main
npm install
npm run build
pm2 restart domspy
```

---

## 15. Solucao de Problemas

### "Cannot find module @prisma/client"
```bash
npx prisma generate
```

### "Error: connect ECONNREFUSED" (erro de conexao com banco)
- Verifique se a DATABASE_URL esta correta no .env
- Use a porta 6543 (Transaction Pooler), NAO 5432
- Se a senha tem caracteres especiais (@, #, !), encode-os na URL

### "NEXTAUTH_SECRET is not set"
Gere um novo segredo e adicione ao .env:
```bash
openssl rand -base64 32
```

### Build falha na Vercel
- Verifique se TODAS as variaveis de ambiente estao configuradas
- Verifique os logs de build para erros especificos
- Confirme que DATABASE_URL usa a URL do pooler

### "Crawl bloqueado (Cloudflare)"
Isso e normal para sites protegidos por Cloudflare. O crawler mostra status "Bloqueado".
Se voce controla o site, adicione uma regra no WAF do Cloudflare para permitir o crawler.

### Login nao funciona
- Verifique se NEXTAUTH_URL corresponde a URL real
- Verifique se o usuario existe no banco com status "active"
- Limpe os cookies do navegador e tente novamente

### Paginas nao aparecem apos crawl
- Aguarde o crawl terminar (status "Concluido" no Historico)
- Verifique se houve erros no Historico de crawls
- Tente re-crawlar o dominio

---

## 16. Checklist de Seguranca Pos-Deploy

Apos colocar em producao, verifique:

- [ ] NEXTAUTH_SECRET e uma string aleatoria com 32+ caracteres
- [ ] Senha do banco (DATABASE_URL) e forte (12+ chars, letras, numeros)
- [ ] SUPER_ADMIN_PASSWORD foi alterado do padrao
- [ ] Variaveis de ambiente estao na Vercel (NAO no codigo)
- [ ] Arquivo .env esta no .gitignore (NAO vai para o GitHub)
- [ ] HTTPS esta ativo (Vercel faz automaticamente; VPS precisa Certbot)
- [ ] Primeiro login funciona com credenciais do admin
- [ ] Apos primeiro login, crie um novo usuario e promova a super_admin
- [ ] Teste o crawl em pelo menos um dominio

---

DomSpy v2.0 - Guia Completo de Instalacao
