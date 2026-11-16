# Tenistas do Campestre — Design

Data: 2026-11-16

## 1. Intenção e porquê

App para os tenistas de um clube de tênis se conectarem e marcarem partidas com mais facilidade. Hoje as quadras são por ordem de chegada e os jogos são combinados informalmente (WhatsApp, na quadra). O app deve:

- facilitar achar parceiros/adversários compatíveis (disponibilidade, nível);
- facilitar montar jogos de simples e duplas (salas com vagas);
- manter um ranking **sadio**, que **incentive jogar cada vez mais** — inclusive quem perde pontua.

Sucesso = mais jogos acontecendo entre sócios, ranking confiável e usado.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos (v1)**
- Perfis com foto, dados básicos, WhatsApp, categoria autodeclarada, autoavaliação de habilidades e disponibilidade.
- Busca de jogadores com filtros.
- Salas (lobbies) de simples e duplas com vagas.
- Registro de resultados com confirmação.
- Dois rankings (Simples e Duplas), com janela móvel de 6 meses.
- Administrador: regras de pontuação, moderação de partidas e jogadores, quadro de avisos.
- Notificações dentro do app (sininho).
- Instalação sem loja (PWA via QR code), em Android **e** iPhone.

**Não-objetivos (v1)**
- Reserva/alocação de quadras (não existe no clube; ordem de chegada).
- Notificações push no celular.
- Publicação nas lojas (fase posterior).
- Chat dentro do app (WhatsApp cobre).
- W.O., torneios, campeão de temporada/snapshot de ranking.
- Aprovação de cadastro.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Ranking que desestimula jogar (ex.: perder tira pontos, jogar contra mais fortes é punido).
- Ranking em que o jogador consegue manipular pontos pelo cliente.
- Categoria virar barreira: categoria **não** pode impedir nem penalizar jogos.

## 3. Restrições

- **Plataformas:** Android e iPhone, sem lojas. Instalação via QR code → link → "Instalar app" (Android) / Safari → Compartilhar → "Adicionar à Tela de Início" (iPhone).
- **Backend:** Supabase (Postgres, Auth, Storage). Plano gratuito deve bastar.
- **Código:** GitHub — repositório `https://github.com/stuart-alt/tenistas-do-clube-campestre`. **Hospedagem:** GitHub Pages (site estático), endereço **`https://stuart-alt.github.io/tenistas-do-clube-campestre/`** (permanente: vai impresso no QR code; base path `/tenistas-do-clube-campestre/`).
- **E-mail:** SMTP do **Gmail** (conta com verificação em 2 etapas + senha de app) configurado como SMTP personalizado no Supabase Auth. Limite do Gmail (~500 e-mails/dia) é suficiente.
- **Futuro:** precisa ser possível publicar nas lojas depois sem reescrever (via Capacitor).
- **Idioma da interface:** português (Brasil).
- iPhone: PWA instalada não compartilha sessão com o Safari → login não pode depender de link mágico por e-mail.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **A) React + TypeScript (Vite), PWA** — **escolhida** | Padrão de mercado, muito material, empacotável para lojas com Capacitor depois | Exige build (resolvido por GitHub Actions → Pages) |
| B) HTML/JS puro | Mais leve, sem build | ~10 telas → código desorganizado rapidamente |
| C) Flutter | Ótimo para apps de loja | Web pesado e lento para abrir, sobretudo no iPhone — ruim justamente na v1 |

Também decidido: **regras de pontuação, ranking, confirmações automáticas e permissões vivem no banco** (Postgres/Supabase: funções, views, RLS, pg_cron), nunca no cliente. Motivos: impedir manipulação, recálculo simples quando o admin muda regras, janela de 6 meses sempre correta, auto-confirmação em 48 h sem depender de alguém abrir o app.

## 5. O que foi decidido

### 5.1 Cadastro e login
- Campos: **nome**, **data de nascimento**, **e-mail** (chave única do cadastro), **telefone**, **gênero** (masculino/feminino), **foto**.
- Login por **e-mail + senha**, com "esqueci minha senha" por e-mail (Supabase Auth, enviado via Gmail SMTP). O link de redefinição leva a uma página do app onde a pessoa digita a nova senha e depois entra normalmente no app instalado.
- *(Decisão do construtor)* Cadastro **sem** confirmação obrigatória de e-mail, para a pessoa usar na hora, como pedido.
- **Cadastro aberto**: quem tem o link se cadastra e já usa. Admin pode **desativar** jogadores; desativado some do ranking, das buscas e das salas.
- Dados de perfil (incl. telefone) só visíveis para usuários logados.

### 5.2 Perfil
- **Foto** pessoal.
- **Telefone** com botão de WhatsApp (abre `wa.me/<telefone>`).
- **Categoria** autodeclarada: A, B, C ou D. **Editável** pelo próprio jogador a qualquer momento. **Meramente descritiva** — não afeta pontos, não restringe jogos.
- **Habilidades** (autoavaliação): forehand, backhand, saque, voleio, velocidade, resistência.
- **Disponibilidade**: grade dias da semana (Seg–Dom) × períodos (manhã, tarde, noite), marcação sim/não.
- Mostra posições: "Simples: 5º · Duplas: 12º", pontos e histórico de partidas.
- Mostra pontos a expirar em breve (ex.: "120 pontos expiram em 15 dias").

### 5.3 Buscar jogador
- Lista de jogadores ativos com filtros: **disponibilidade** (dia/período), **categoria**, **gênero**.
- Ordenação padrão: mais períodos de disponibilidade em comum com o usuário.
- Toque → perfil (com WhatsApp).

### 5.4 Salas (lobbies)
- Qualquer jogador cria. Campos: tipo (**simples** / **duplas**), **dia e horário aproximado**, **recado** opcional (texto livre).
- Simples: 2 vagas. Duplas: **Dupla 1** e **Dupla 2**, 2 vagas cada; quem entra escolhe a vaga (permite entrar já com parceiro combinado). O criador ocupa uma vaga ao criar.
- Jogador pode sair; criador pode cancelar.
- Sala cheia → status "Confirmada".
- Após o jogo, resultado é lançado a partir da sala (jogadores pré-preenchidos) → fluxo de confirmação (5.6).
- Salas com data passada sem resultado somem da lista após alguns dias.
- Visível para todos os jogadores ativos (sem restrição por categoria/convite).

### 5.5 Partidas e placar
- Partida pode ser lançada **a partir de uma sala** ou **avulsa** (escolhe adversários/parceiro e digita placar).
- *(Decisão do construtor)* Só quem jogou a partida (ou o admin) pode lançá-la.
- *(Decisão do construtor)* A partida tem **data em que foi jogada**, informada por quem lança: padrão hoje, no máximo **7 dias** para trás, nunca no futuro. Essa data é a referência para a janela de 6 meses, para o bônus e para "pontos a expirar".
- Placar livre de **1 a 3 sets**; vence quem ganhou mais sets; **não existe empate** (placar empatado em sets não pode ser registrado).
- **Super tie-break** lançado como set (ex.: 10-7): conta como set vencido, mas vale **1 game** para o vencedor dele (e 0 para o perdedor).
- Jogo por tempo: lança-se o placar em que parou (precisa ter vencedor).

### 5.6 Confirmação de resultado
- Um jogador lança; o **adversário** confirma ou contesta. O **administrador** também pode confirmar.
- Enquanto pendente: não conta pontos.
- Sem resposta em **48 h** → confirmação automática.
- Contestação → vai para o administrador decidir (confirmar, corrigir ou cancelar).
- Duplas: qualquer um dos dois adversários pode confirmar/contestar. *(Decisão do construtor)* O parceiro de quem lançou não confirma nem contesta.

### 5.7 Pontuação e rankings
- **Dois rankings separados: Simples e Duplas.** Ranking único por modalidade, para todo o clube, sem divisão por gênero nem por categoria.
- Ranking de duplas é **individual** (cada jogador acumula seus pontos de duplas, independentemente do parceiro).
- **Pontos base** (valores iniciais, configuráveis pelo admin, separadamente por modalidade):
  - vitória: 50
  - set vencido: 10
  - game vencido: 1
  - O **perdedor também pontua** pelos sets e games que venceu.
- **Bônus** para quem vence alguém com mais pontos: **20% da diferença de pontos**, **teto 50** (configuráveis).
  - Simples: diferença entre os pontos do perdedor e do vencedor.
  - Duplas: diferença entre a **média** de pontos da dupla perdedora e a média da dupla vencedora (no ranking de duplas).
  - Calculado com os pontos **no momento da partida**: a pontuação de cada jogador na janela de 6 meses na data da partida, considerando apenas partidas confirmadas com data anterior.
  - Usa **diferença de pontos, não posição** → resolve o início (todos em 0 ⇒ sem bônus; o bônus surge naturalmente conforme pontos se acumulam).
  - *(Decisão do construtor)* Em duplas, **cada** jogador da dupla vencedora recebe o bônus inteiro.
- *(Decisão do construtor)* **Recálculo por reprocessamento cronológico:** os pontos de cada partida são sempre derivados reprocessando todas as partidas confirmadas em ordem de data jogada (desempate pela ordem de registro), com as regras vigentes. Assim, resultado confirmado com atraso, correção/cancelamento pelo admin ou mudança de regra ajustam corretamente os bônus das partidas posteriores. Os valores por partida podem ser guardados como cache, mas são recalculados nesses eventos.
- **Janela móvel de 6 meses** (configurável): a pontuação de um jogador é a soma dos pontos das partidas confirmadas nos últimos 6 meses. Partidas mais antigas saem da conta.
- **Mudança de regras pelo admin → recálculo de todo o ranking** com as novas regras.
- Exemplo: 6-4 3-6 6-2 → vencedor 50+20+15 = 85; perdedor 10+12 = 22. Se vencedor tinha 100 e perdedor 400: bônus min(20%×300, 50) = 50.

### 5.8 Tela de ranking
- Abas **Simples** | **Duplas**.
- Filtro por **categoria** (Todas / A / B / C / D) — filtra a visualização; posições exibidas continuam as do ranking geral.
- Cada linha: posição, foto, nome, categoria, pontos. Toque → perfil.
- *(Decisão do construtor)* Aparece no ranking de uma modalidade quem tem **pelo menos 1 partida confirmada** dessa modalidade na janela. Empate em pontos = **mesma posição**; ordem visual dentro do empate: mais vitórias na janela, depois nome.

### 5.9 Notificações (sininho, dentro do app)
Contador de não lidas. Eventos:
- alguém entrou/saiu da sua sala; sua sala completou; sala cancelada;
- resultado aguardando sua confirmação; resultado confirmado/contestado;
- novo aviso no quadro;
- (admin) contestação aguardando decisão.

### 5.10 Quadro de avisos
- Só o admin cria/edita/apaga.
- Texto com formatação básica: negrito, itálico, listas, links (Markdown).
- Avisos podem ser **fixados** no topo; demais em ordem do mais novo.

### 5.11 Administrador
- Conta comum marcada como admin diretamente no banco (sem cadastro de admin pela interface).
- Pode: editar regras de pontuação (por modalidade) e a janela; confirmar/corrigir/cancelar partidas; resolver contestações; desativar/reativar jogadores; gerenciar quadro de avisos.

### 5.12 Instalação e distribuição
- Hospedado no GitHub Pages; deploy via GitHub Actions.
- QR code apontando para a URL do app.
- Na primeira abertura fora do modo instalado, o app mostra instruções de instalação (Android e iPhone).

## 6. Deixado para o construtor

- Bibliotecas de UI, roteamento, estado, formulários, renderização de Markdown.
- Escala das habilidades na autoavaliação (sugestão: 1 a 5 estrelas).
- Esquema do banco, nomes de tabelas/funções, políticas RLS concretas.
- Como implementar a janela móvel e o recálculo (view, função materializada, etc.), desde que o resultado seja o definido em 5.7.
- Formato de telefone (sugestão: armazenar com DDI, padrão +55).
- Compressão/redimensionamento da foto antes do upload.
- Quantos dias até salas antigas sumirem (sugestão: 3).
- Visual/identidade (cores, tipografia).
- Testes: regras de pontuação devem ter testes automatizados cobrindo os exemplos acima.
