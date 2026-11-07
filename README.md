# Vini Climatização — app de agendamento (PWA) · v1.0

App instalável no celular para a Vini Climatização (Salvador-BA). O cliente agenda sozinho;
o técnico confirma, remarca, conclui e é avisado dos retornos. Especificação: `docs/SPEC.md`.

## Rodar no computador

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes das regras de horários livres
npm run build    # gera a pasta dist/
```

Sem configurar nada, o app abre em **modo demonstração**: os dados ficam salvos só no aparelho
(localStorage) e já vêm alguns clientes e agendamentos de exemplo.
Login do técnico na demonstração: `tecnico@vini.app` / `vini123` (rota `#/tecnico`).

## Ligar o banco de verdade (Supabase)

1. Crie um projeto em supabase.com.
2. No **SQL Editor**, cole e rode `supabase/schema.sql` (pode rodar de novo sem problemas).
3. Em **Authentication → Users**, crie o usuário do técnico (e-mail e senha). Desative cadastros públicos
   em **Authentication → Providers → Email → Allow new users to sign up**.
4. No SQL Editor, autorize esse usuário como técnico (copie e cole sem mudar nada — vale para o único usuário criado):
   ```sql
   insert into tecnicos (user_id) select id from auth.users on conflict do nothing;
   ```
5. Copie `Project URL` e `anon public key` (Settings → API) para um arquivo `.env`
   (veja `.env.example`) — ou, no GitHub, em **Settings → Secrets and variables → Actions → Variables**
   como `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

A regra "dois clientes nunca no mesmo horário" é garantida pelo próprio banco
(restrição `sem_conflito` + validação em `validar_horario`), não só pela tela.

## Publicar (Cloudflare Pages)

Na Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → escolha `vini-climatizacao`.

- Framework preset: **Vite** (ou "None")
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (do Supabase)

A cada push na `main` a Cloudflare publica sozinha. Sem as variáveis, o site abre em modo demonstração.
Também há um workflow manual para GitHub Pages em `.github/workflows/deploy.yml`.

## O que tem na v1.0

**Cliente:** abertura, início com próximo agendamento, agendamento em 3 passos (serviço → dia/horário →
confirmação), dados de endereço e aparelho com foto, "Adicionar à agenda" (.ics), mensagem ao técnico,
agenda, histórico, aceitar/escolher outro horário sugerido, mudar horário, cancelar, perfil, instalar app.

**Técnico:** login, agenda Dia/Semana com cores por status, confirmar/remarcar/cancelar com mensagem
pronta no WhatsApp (wa.me), lembretes da véspera, detalhe com mapa/ligar/WhatsApp, concluir serviço
(descrição, peças/gás, valor, foto) criando o retorno automaticamente, clientes e retornos
(Retorno hoje / Vencido / Em N meses / Em dia) com "Enviar lembretes", detalhe do cliente,
serviços (duração, retorno, preço), ajustes (WhatsApp, horários de trabalho, deslocamento,
antecedência, dias à frente, bloqueio de datas), aviso de novo pedido com o app aberto.

**PWA:** manifest, ícones normais e maskable, service worker, aviso offline, funciona no computador.

## Pendências (confirmar com o dono)

Valores iniciais provisórios, todos editáveis no painel: preços (hoje "sob orçamento"),
horário de trabalho (seg–sex 8–12h e 13–18h, sáb 8–12h), durações (instalação 3h, limpeza 1h30,
manutenção 2h, carga de gás e orçamento 1h), retorno (limpeza 6 meses, manutenção 12),
WhatsApp do técnico (`5571999999999`), região atendida e domínio.

## Próxima fase

- Notificação push ao técnico com o app fechado (tarefa agendada no servidor + Web Push).
- Envio automático pelo WhatsApp Business API.
- Fotos no Supabase Storage (na v1 ficam reduzidas dentro do banco).
- Acesso do cliente com código por WhatsApp (na v1, entra só com o número).
