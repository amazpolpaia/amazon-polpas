# Hospedar Amazon Polpas na internet (acesso de qualquer lugar)

Este guia usa **Railway** (railway.app) — site em inglês, mas o passo a passo é simples.
Custo aproximado: plano com créditos gratuitos no início; depois cerca de **US$ 5–15/mês** (API + banco).

Depois de hospedar, você acessa **um único link** (ex.: `https://amazon-polpas.up.railway.app`) no celular, em casa ou na fábrica.

---

## O que vai para a nuvem

| Item | Onde fica |
|------|-----------|
| Tela do sistema | Junto com a API (mesmo link) |
| API Node.js | Railway |
| Banco PostgreSQL | Railway |

---

## Parte 1 — Criar conta no Railway

1. Abra https://railway.app
2. Clique em **Login** e entre com **GitHub** ou **e-mail**
3. Confirme o e-mail se pedir

---

## Parte 2 — Colocar o projeto no GitHub (recomendado)

O Railway instala direto do GitHub. Se ainda não tiver repositório:

1. Crie conta em https://github.com (se não tiver)
2. No GitHub, clique **New repository**
3. Nome: `amazon-polpas` (pode ser outro)
4. Deixe **Private** se quiser privado
5. **Create repository**

No seu PC (PowerShell), na pasta do projeto:

```powershell
cd "c:\Users\contr\Desktop\App Compra de Fruto"
git init
git add .
git commit -m "Amazon Polpas - versao inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/amazon-polpas.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu usuário do GitHub.

> Se o Git pedir login, use o GitHub Desktop ou um Personal Access Token.

**Não envie o arquivo `.env`** (senhas). Ele já está no `.gitignore` da API.

---

## Parte 3 — Criar projeto no Railway

1. No Railway, clique **New Project**
2. Escolha **Deploy from GitHub repo**
3. Autorize o GitHub e selecione o repositório `amazon-polpas`
4. O Railway cria um serviço — clique nele
5. Aba **Settings** → **Root Directory** (ou **Source**):
   - Preencha: `files/api_amazon_polpas/api`
   - Salve (**Save**)

6. Ainda em **Settings**, em **Start Command**, deixe vazio (usa `npm start` do `package.json`)

---

## Parte 4 — Adicionar banco PostgreSQL

1. No projeto Railway, clique **+ New**
2. Escolha **Database** → **PostgreSQL**
3. Aguarde ficar verde (Running)
4. Clique no banco → aba **Variables** ou **Connect**
5. Copie a variável **`DATABASE_URL`** (ou **Postgres Connection URL**)

---

## Parte 5 — Ligar banco à API

1. Clique no serviço da **API** (não no banco)
2. Aba **Variables** → **+ New Variable** (ou **Raw Editor**)
3. Adicione:

| Nome | Valor |
|------|--------|
| `DATABASE_URL` | Cole a URL copiada do PostgreSQL |
| `JWT_SECRET` | Uma frase longa aleatória (ex.: `MinhaEmpresa2025ChaveSecretaXYZ`) |
| `JWT_EXPIRES_IN` | `8h` |
| `NODE_ENV` | `production` |

4. Salve — o Railway **reinicia** o serviço sozinho

> Se o Railway já mostrou `DATABASE_URL` referenciando o Postgres automaticamente, não precisa colar de novo.

---

## Parte 6 — Importar tabelas no banco da nuvem

1. No serviço **PostgreSQL**, abra **Data** → **Query** (ou use **Connect** → Query)
2. Abra no Bloco de Notas o arquivo do seu PC:
   `files\amazon_polpas_banco.sql`
3. Copie **todo** o conteúdo e cole no Query do Railway
4. Execute (**Run** / **Execute**)
5. Depois execute também o arquivo:
   `files\api_amazon_polpas\api\sql\fix-senhas-login.sql`
   (corrige a senha do login na nuvem)

Se der erro “já existe”, parte do banco já foi criado — pode ignorar erros de “already exists” e só rodar o `fix-senhas-login.sql`.

---

## Parte 7 — Gerar link público (domínio)

1. Clique no serviço da **API**
2. Aba **Settings** → seção **Networking** / **Public Networking**
3. Clique **Generate Domain** (ou **Enable Public URL**)
4. Copie o link, exemplo:
   `https://amazon-polpas-production-xxxx.up.railway.app`

Esse é o endereço que você usa **em qualquer lugar**.

---

## Parte 8 — Testar

1. Abra o link no navegador do celular ou outro PC
2. Deve aparecer a **tela de login** (sem pedir URL da API — já detecta sozinha)
3. Login:
   - E-mail: `joao@amazonpolpas.com.br`
   - Senha: `Admin@2025`
4. Teste também: `https://SEU-LINK/health` — deve mostrar `"status":"ok"`

---

## Uso no dia a dia

- **Salve o link** nos favoritos do navegador (celular e computador)
- **Não precisa** mais do `INICIAR-SISTEMA.bat` no PC (só se quiser usar local também)
- Todos os usuários usam o **mesmo link** com logins diferentes (gerente cria usuários no sistema)

---

## Segurança (importante)

1. **Troque a senha** do usuário João depois do primeiro acesso
2. Use `JWT_SECRET` forte e não compartilhe
3. Repositório GitHub **privado** se o código não for público
4. Plano gratuito pode “dormir” — o primeiro acesso pode demorar alguns segundos

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| Deploy falhou | Veja **Deployments** → **View logs**; confira Root Directory `files/api_amazon_polpas/api` |
| Login “senha incorreta” | Rode de novo `sql/fix-senhas-login.sql` no banco da nuvem |
| Página em branco | Aguarde 1–2 min após deploy; teste `/health` |
| Erro de banco | Confira se `DATABASE_URL` está nas variáveis da API |
| Só funciona no PC | Você ainda está em `file://` ou `localhost` — use o **link Railway** |

---

## Alternativa: Render.com

1. https://render.com → New → **Web Service** (repositório GitHub)
2. Root: `files/api_amazon_polpas/api`
3. Build: `npm install` | Start: `npm start`
4. New → **PostgreSQL** e copie **Internal Database URL** para `DATABASE_URL`
5. Mesmos passos de SQL e domínio público

---

## Voltar a usar só no PC

Continue usando `INICIAR-SISTEMA.bat` com `http://localhost:3000` — o sistema local e o da nuvem podem coexistir (bancos separados).
