# Guia de deploy — Tenistas do Campestre

Este guia leva o app do computador até o ar, passo a passo. Não é preciso saber programar: basta seguir na ordem. Endereço final do app: `https://stuart-alt.github.io/tenistas-do-clube-campestre/`

Nunca compartilhe nem salve em arquivos do projeto: senha do banco, senha de app do Gmail e a chave `service_role`.

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com e crie uma conta (pode ser com o GitHub).
2. Clique em **New project**. Escolha um nome (ex.: `tenistas-do-campestre`), crie uma senha forte para o banco (guarde em local seguro) e, em **Region**, escolha **South America (São Paulo) — `sa-east-1`**.
3. Aguarde alguns minutos até o projeto ficar pronto. O código do projeto (`<ref>`) aparece na URL do painel: `https://supabase.com/dashboard/project/<ref>`.
4. No terminal, dentro da pasta do projeto:

```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

O `db push` cria as tabelas, regras de segurança, funções e o bucket de fotos `fotos` (já vem nas migrations, não precisa criar à mão). O arquivo `seed.sql` é só para testes locais e **não** vai para produção.

## 2. Conferir o pg_cron e o job `auto-confirmar`

As migrations ativam a extensão `pg_cron` e agendam, a cada hora, o job `auto-confirmar` (confirma automaticamente partidas que ninguém contestou).

- Se o `db push` reclamar de `pg_cron`: no painel, vá em **Database → Extensions**, procure `pg_cron`, ative e rode `npx supabase db push` de novo.
- Para conferir: no painel, abra **SQL Editor** e rode:

```sql
select * from cron.job;
```

Deve aparecer uma linha com `jobname = auto-confirmar`.

Se não aparecer nenhuma linha (por exemplo, se a extensão foi desligada e religada no painel, o que apaga os jobs), crie o job de novo no **SQL Editor**:

```sql
select cron.schedule('auto-confirmar', '0 * * * *', 'select public.auto_confirmar_partidas()');
```

Pode rodar mais de uma vez sem problema; se o job já existir, ele é só atualizado.

## 3. Autenticação (Auth)

1. **Authentication → Providers → Email**: desligue **Confirm email** e salve. (Os jogadores entram direto após o cadastro.)
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://stuart-alt.github.io/tenistas-do-clube-campestre/`
   - **Redirect URLs**: adicione
     - `https://stuart-alt.github.io/tenistas-do-clube-campestre/`
     - `https://stuart-alt.github.io/tenistas-do-clube-campestre/redefinir-senha`

## 4. E-mail pelo Gmail (recuperação de senha)

O e-mail padrão do Supabase tem limite muito baixo; usamos uma conta Gmail do clube.

1. Na conta Gmail: acesse https://myaccount.google.com → **Segurança** → **Verificação em duas etapas** e ative.
2. Na mesma área (**Verificação em duas etapas → Senhas de app**), crie uma senha de app com o nome `Supabase`. O Google mostra **16 caracteres**: copie (sem espaços). Ela só aparece uma vez.
3. No Supabase: **Authentication → Emails → SMTP Settings** (ou **Project Settings → Authentication → SMTP**), ative **Enable custom SMTP** e preencha:
   - **Host**: `smtp.gmail.com`
   - **Port**: `465`
   - **Username**: o e-mail Gmail completo (ex.: `clube@gmail.com`)
   - **Password**: a senha de app de 16 caracteres
   - **Sender email**: o mesmo e-mail Gmail
   - **Sender name**: `Tenistas do Campestre`
4. **Authentication → Emails → Templates → Reset password**, troque por:

   **Subject:**
   ```
   Redefinir sua senha — Tenistas do Campestre
   ```

   **Body (HTML):**
   ```html
   <h2>Redefinir sua senha</h2>
   <p>Recebemos um pedido para redefinir a senha da sua conta no Tenistas do Campestre.</p>
   <p><a href="{{ .ConfirmationURL }}">Clique aqui para criar uma nova senha</a></p>
   <p>Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.</p>
   ```

## 5. GitHub: segredos e Pages

1. No Supabase: **Project Settings → API**. Copie o **Project URL** e a chave **anon / public** (nunca a `service_role`).
2. No GitHub, abra o repositório → **Settings → Secrets and variables → Actions → New repository secret** e crie:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = chave anon/public
3. **Ativar o GitHub Pages**
   1. Abra https://github.com/stuart-alt/tenistas-do-clube-campestre e clique na aba **Settings** (ícone de engrenagem, no topo, à direita de *Insights*).
   2. No menu da esquerda, na seção **Code and automation**, clique em **Pages**.
   3. Em **Build and deployment**, no campo **Source**, troque *Deploy from a branch* por **GitHub Actions**. Salva sozinho, não há botão.
   4. **Não** clique nos modelos de workflow que o GitHub sugere ("Static HTML", "Jekyll"…): o projeto já tem o seu (`.github/workflows/deploy.yml`).
   5. Se aparecer um aviso de que o Pages exige plano pago: o repositório está **privado**. No plano gratuito, o Pages só funciona com repositório **público** (**Settings → General**, no fim da página, **Danger Zone → Change visibility → Public**). O código fica visível, mas nenhum segredo vai junto: as chaves ficam nos *secrets*.
4. **Enviar o código para a `main`** (no terminal do VS Code, dentro da pasta do projeto):

   ```bash
   git checkout main
   git merge feat/app-v1
   git push origin main
   ```

   O `push` dispara a publicação automaticamente.
5. **Acompanhar a publicação**
   1. No repositório, clique na aba **Actions**. Aparece uma execução chamada **Deploy** com o título do último commit e uma bolinha amarela (rodando).
   2. Leva de 2 a 4 minutos: ela instala as dependências, roda os testes, monta o app e publica.
   3. Quando a bolinha ficar com um **✓ verde**, clique na execução: no quadro **deploy** aparece o link do app. O endereço é sempre https://stuart-alt.github.io/tenistas-do-clube-campestre/
   4. Se ficar com um **✗ vermelho**: clique na execução → no quadro **deploy** → na etapa marcada em vermelho, e leia a mensagem. Os casos mais comuns:
      - *Get Pages site failed* / *Not Found* na etapa `deploy-pages`: o passo 3 acima (Source = GitHub Actions) não foi feito. Faça e, na execução que falhou, clique em **Re-run all jobs**.
      - Falha em `npm test`: algum teste quebrou; não publique, me chame.
   5. Se o workflow passou mas o app abre em branco ou com erro ao entrar: os *secrets* do item 2 estão faltando ou com o nome errado. Corrija e rode de novo em **Actions → Deploy → Run workflow** (botão à direita).
6. Para publicar de novo no futuro, basta enviar commits para a `main`; ou rodar manualmente em **Actions → Deploy → Run workflow**.

## 6. Primeiro administrador

1. Abra o app e cadastre-se normalmente com o seu e-mail.
2. No Supabase, **SQL Editor**, rode (trocando pelo seu e-mail):

```sql
update profiles set is_admin = true where email = 'seu-email@exemplo.com';
```

3. Feche e abra o app: o menu de administração aparece.
4. Para outros administradores: peça que se cadastrem no app e repita o SQL acima com o e-mail de cada um (`update profiles set is_admin = true where email = '…';`). Não há como promover administradores dentro do app.

## 7. Distribuição aos jogadores

Imprima `docs/qrcode.png` (aponta para o endereço do app) e cole no clube, ou envie a imagem no grupo de WhatsApp. Para regerar: `npm run qrcode`.

**Instalar no Android:** abra o endereço no **Chrome** → menu (três pontinhos) → **Instalar app** (ou "Adicionar à tela inicial").

**Instalar no iPhone:** abra o endereço no **Safari** (não funciona em outros navegadores) → botão **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.

## Desenvolvimento local (para quem programa)

```
npm install
npm run db:start        # Supabase local (portas 553xx), requer Docker
cp .env.example .env.local   # ajuste as chaves mostradas pelo db:start
                             # no Windows (PowerShell): Copy-Item .env.example .env.local
npm run dev
npm test                # testes do front
npm run db:test         # testes do banco (pgTAP)
```
