# Conquistas (medalhas) — design

Data: 2026-11-17 · Status: aprovado · Revisado por um construtor (4 pontos resolvidos e marcados como decisão do Claude)

## Por que

O objetivo é fazer as pessoas lançarem no app os jogos que fazem, dar um motivo para voltarem ao app, e oferecer sempre uma meta que pareça alcançável. O limite semanal faz com que jogar muito não suba a posição no ranking. As conquistas são o canal para recompensar quem joga mais e com mais gente, sem mexer nos pontos.

## Objetivos

- Medalhas por constância, volume, variedade de adversários e parceiros, salas e alguns feitos em quadra, cada uma com níveis (bronze, prata, ouro e, em duas delas, diamante).
- O primeiro nível precisa sair logo, na 1ª partida, na 1ª vitória ou em 2 semanas seguidas.
- **Expostas para todos:** qualquer jogador vê as medalhas dos outros no perfil.
- O próprio jogador vê o progresso para o próximo nível (barrinha "3/4").
- **Validade igual ao ranking.** Uma medalha só vale enquanto as partidas que a deram estiverem dentro da janela do ranking (`regras.janela_meses`, hoje 6 meses). Quando a pessoa para de jogar, as medalhas vencem e podem ser reconquistadas. O perfil mostra "válida até dd/mm".
- O sininho avisa quando o jogador ganha uma medalha ou sobe de nível, e também uns 10 dias antes de uma medalha vencer.
- O histórico vale: as partidas já confirmadas contam desde a estreia.

## Não-objetivos

- As medalhas não dão pontos e não mudam o ranking.
- O administrador não pode configurar os limites das medalhas pelo app (ficam fixos no código/banco; mudar é uma migração).
- O card do jogador (PNG exportável) não muda nesta versão.
- Não há ranking de medalhas nem mural geral.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Contar partida que não foi confirmada. Só conta `status = 'confirmada'`.
- Medalhas diferentes para pessoas diferentes vendo o mesmo perfil. O cálculo é feito no banco, nunca no aparelho.
- Encher o sininho, como um aviso para cada medalha retroativa na estreia.
- Medalha visível para administrador (administrador não joga).

## Abordagens consideradas

1. **Medalhas permanentes guardadas no banco.** Cada medalha ganha seria gravada com data e ficaria para sempre. Foi descartada a pedido do usuário: com o tempo, quem joga há mais tempo não teria mais nada para ganhar, e as medalhas deixariam de motivar.
2. **Calcular tudo na hora, sem guardar nada.** É simples e sempre consistente, mas não sabe quando avisar "você ganhou" nem "vai vencer".
3. **Escolhida: calcular a partir das partidas da janela e guardar só um retrato do estado atual.** O banco calcula as medalhas de cada jogador a partir das partidas confirmadas dentro da janela, igual ao ranking. Também guarda um retrato do que cada um tem hoje (`conquistas_jogador`). Comparar o retrato antigo com o novo permite avisar quando alguém ganha ou sobe de nível. A data "válida até" do retrato permite avisar antes de vencer. Uma partida anulada sai do cálculo sozinha, sem regra especial.

## Decisões do usuário

- A recompensa é por lançar jogos no app, para atrair o uso e dar uma meta alcançável.
- As medalhas ficam expostas para todos.
- A validade é a mesma janela de 6 meses das partidas no ranking, e há aviso antes de vencer.
- Abordagem 3.

## Catálogo (proposta; decisão do Claude, ajustável)

Contam as partidas confirmadas da janela, somando simples e duplas, salvo indicação. A semana é a mesma do limite semanal: segunda a domingo, `date_trunc('week', data_jogo)`.

| Chave | Medalha | O que conta | Níveis (bronze / prata / ouro / diamante) |
|---|---|---|---|
| `sequencia` | 🔥 Sequência | Maior série de semanas consecutivas com pelo menos 1 partida | 2 / 4 / 8 / 12 semanas |
| `partidas` | 🎾 Partidas | Nº de partidas | 1 / 10 / 25 / 50 |
| `vitorias` | 🥇 Vitórias | Nº de vitórias | 1 / 5 / 15 |
| `adversarios` | 🤝 Enturmado | Nº de adversários diferentes | 3 / 6 / 12 |
| `parceiros` | 👥 Bom parceiro | Nº de parceiros diferentes em duplas | 2 / 4 / 8 |
| `anfitriao` | 🏠 Anfitrião | Salas criadas pelo jogador que viraram partida confirmada | 1 / 5 / 10 |
| `zebra` | 🦓 Zebra | Vitórias com bônus > 0 (venceu alguém mais bem colocado) | 1 / 3 / 5 |
| `virada` | 🔄 Virada | Vitórias em que o lado do jogador perdeu o 1º set | 1 / 3 |
| `pneu` | 🍩 Pneu | Sets vencidos por 6–0 | 1 / 3 |
| `podio` | 🏆 Pódio | Está hoje no top 3 do ranking (por modalidade) | um nível só, "Top 3 Simples" ou "Top 3 Duplas" |
| `numero1` | 👑 Nº 1 | Está hoje em 1º no ranking (por modalidade) | um nível só, por modalidade |

- O catálogo (chave, nome, emoji, descrição, lista de limites por nível) fica numa tabela `conquistas_catalogo`, preenchida pela migração e só de leitura para o app. Os limites são uma lista ordenada (`int[]`), de 1 a 4 níveis. O nível *n* tem nome fixo: 1 bronze, 2 prata, 3 ouro, 4 diamante. Medalhas de nível único (pódio, nº 1) não mostram nome de nível. *(decisão do Claude)*
- `podio` e `numero1` valem enquanto a posição durar. O "válida até" delas não se aplica, e o perfil mostra "atual".
- Na mesma modalidade, `numero1` não exclui `podio`: o nº 1 tem as duas.
- A posição é calculada como na view `ranking` (`rank()`). Em caso de empate, mais de um jogador pode ser nº 1 ou estar no top 3 ao mesmo tempo. *(decisão do Claude)*

## Validade ("válida até")

Para cada medalha e nível atual, a data em que o jogador **cairia de nível** se nenhuma partida nova fosse confirmada. Ou seja, a 1ª data D em que, recalculando só com as partidas que ainda estariam na janela em D (regra do ranking: `data_jogo + make_interval(months => janela_meses) > D`), o nível ficaria menor. Exemplos:
- **Contagens:** com limite N e as partidas que contam ordenadas da mais recente para a mais antiga, a data é a da N-ésima mais recente + janela.
- **Sequência:** considera a série mais recente que ainda atinge o limite. A data é aquela em que ela deixa de ter semanas suficientes dentro da janela.

A janela é `regras.janela_meses` da modalidade `simples` (hoje as duas são 6). Por ora, a medalha soma as duas modalidades.

## Quando calcular

- A função `avaliar_conquistas(p_jogador uuid)` (security definer) recalcula as medalhas do jogador e atualiza o retrato.
- Ela é chamada para todos os jogadores da modalidade no fim de `recalcular_ranking`, que já é chamada em toda confirmação, cancelamento, correção, confirmação automática e mudança de regras. Os jogadores podem ser limitados aos que tiveram partida na modalidade, se o desempenho pedir (decisão do construtor).
- Também é chamada por um cron diário, às 09:00 de São Paulo (12:00 UTC), para todos os jogadores ativos. É ele que faz as medalhas vencerem com o tempo e manda o aviso de "vai vencer".
- Administradores e jogadores inativos ficam de fora (`is_admin` ou `not ativo`), e o retrato deles fica vazio.

## Retrato (`conquistas_jogador`)

Uma linha por jogador e conquista com nível ≥ 1:

- `jogador_id`, `conquista`, `modalidade` (só para `podio`/`numero1`; nulo nas outras), `nivel`, `valor`, `desde` (quando chegou ao nível atual), `valida_ate` (date: queda do nível atual; nulo para pódio/nº 1), `expira_em` (date: a medalha some; nulo para pódio/nº 1), `avisado_vencimento` (bool).

Ao reavaliar:
- **Nível subiu ou medalha nova:** grava e notifica `conquista_ganha`, com o texto "Você ganhou 🔥 Sequência — prata (4 semanas)!" e link para o próprio perfil.
- **Nível desceu ou medalha venceu:** atualiza ou apaga, sem notificar (o aviso prévio já saiu).
- **Aviso de vencimento** *(decisão do Claude)*. Só existe aviso antes de a medalha **sumir de vez**, não a cada queda de nível. Para isso, a avaliação calcula também `expira_em`: a data em que o nível chegaria a 0 sem partidas novas. Quando faltarem ≤ 10 dias para `expira_em` e o aviso ainda não tiver saído, notifica `conquista_vencendo` com "Sua medalha 🔥 Sequência vence em N dias. Lance uma partida para renovar!" e marca `avisado_vencimento`. Se `expira_em` passar para mais tarde (a medalha foi renovada), o aviso volta a ficar disponível. A queda de nível é silenciosa, e o perfil já mostra o "válida até" do nível atual.
- Pódio e nº 1 não geram aviso de vencimento.
- **Pódio e nº 1 sem repetição** *(decisão do Claude)*. O aviso `conquista_ganha` dessas duas só sai se o jogador não tiver recebido o mesmo aviso (mesma conquista e modalidade) nos últimos 30 dias. Assim, quem oscila entre 3º e 4º não recebe um aviso a cada confirmação. Isso usa uma coluna `ultimo_aviso_ganho timestamptz` numa tabela pequena `conquistas_avisos(jogador_id, conquista, modalidade)`, que não é apagada quando a medalha some.

**Estreia:** a migração roda a avaliação para todos sem notificar medalha por medalha. Cada jogador que ganhou alguma coisa recebe uma única notificação: "Chegaram as conquistas! Você já tem N medalhas. Veja no seu perfil." As medalhas que já estiverem a ≤ 10 dias de `expira_em` na estreia entram com `avisado_vencimento = true`, para que o primeiro cron não mande uma enxurrada de avisos. *(decisão do Claude)*

**Notificações:** a constraint de `notificacoes.tipo` ganha `conquista_ganha` e `conquista_vencendo`.

## Leitura pelo app

- **RLS:** `conquistas_jogador` e `conquistas_catalogo` podem ser lidas por todos os autenticados. Ninguém escreve pelo app.
- **RPC `progresso_conquistas(p_jogador uuid)`:** retorna uma linha por conquista do catálogo com `nivel` atual (0 = não tem), `valor` atual, `proximo_limite` (nulo se já está no máximo), `valida_ate`. Ela é calculada na hora, com a mesma lógica da avaliação, para a barrinha ficar sempre certa. Só pode ser chamada pelo próprio jogador (`p_jogador = auth.uid()`); para os outros, retorna `SEM_PERMISSAO`.

## Tela (perfil)

Nova seção **Conquistas** em `src/perfil/PerfilPage.tsx`, depois do card:

```
Conquistas
🔥 Sequência · prata        4 semanas   válida até 12/03
🎾 Partidas · prata         12          válida até 02/04
🏆 Top 3 Simples                        atual
```

- **Perfil de outro jogador:** só as medalhas que ele tem (cor do nível bronze/prata/ouro/diamante, valor, "válida até"). Sem medalhas, aparece "Ainda sem medalhas".
- **Próprio perfil:** as medalhas que tem e, abaixo, as que faltam e o próximo nível, apagadas e com barrinha:
  ```
  🔥 Sequência → ouro      ▓▓▓▓░░░░  4/8
     Jogue esta semana para não quebrar a sequência
  🤝 Enturmado → bronze    ▓▓░  2/3
  ```
  A dica da sequência só aparece quando a série atual está viva e a semana corrente ainda não tem partida.
- **Perfil de administrador:** sem a seção.
- O texto de cada medalha explica o que conta (vem do catálogo), num toque/tooltip ou numa linha pequena.

## Restrições

- O padrão do projeto continua: migração em `supabase/migrations/2026111900000x_conquistas.sql`, testes pgTAP em `supabase/tests/database/11_conquistas.test.sql`, erros em MAIÚSCULAS traduzidos em `src/lib/erros.ts`, `npm run db:types` atualizado, Vitest para o front.
- O cron diário entra na migração e também no `docs/DEPLOY.md`, junto com os outros jobs (eles somem se a extensão `pg_cron` for desligada e religada).
- Não pode deixar a confirmação de partida perceptivelmente mais lenta. O clube é pequeno (dezenas de jogadores), então recalcular os jogadores da modalidade é aceitável.

## Fica para o construtor

- A forma exata do SQL (CTEs/funções auxiliares), contanto que `avaliar_conquistas` e `progresso_conquistas` usem a mesma lógica.
- Índices, se forem necessários.
- O layout fino da seção dentro do estilo atual (Tailwind) e as cores dos níveis.
