# Vini Climatização — App de agendamento (PWA)

> Documento de especificação para implementação. Idioma da interface: **português (Brasil)**. Fuso horário: **America/Bahia (UTC-3)**.

## 1. Objetivo

Um app instalável no celular (PWA) para a **Vini Climatização** (técnico autônomo de ar condicionado em Salvador-BA). O cliente agenda sozinho instalação, limpeza, manutenção, carga de gás ou orçamento. O técnico recebe os pedidos numa agenda organizada, confirma ou remarca, registra o que foi feito e é avisado quando chega a hora de chamar o cliente de volta.

**Princípio:** simples e rápido. Pouco texto nas telas, poucos toques, funciona bem em celular.

## 2. Quem usa

| Perfil | Acesso | O que faz |
|---|---|---|
| **Cliente** | Sem senha: informa nome e WhatsApp ao agendar | Escolhe serviço, dia e horário; vê seus agendamentos e histórico |
| **Técnico** | Login (e-mail e senha) | Vê a agenda, confirma/remarca/cancela, conclui serviços, gerencia clientes e retornos, define horários de trabalho |

## 3. Fluxo geral

```
CLIENTE
Abre o link/app → Escolhe o serviço → Escolhe dia e horário livre
→ Informa endereço, aparelho e foto → Confirma o pedido

TÉCNICO
Pedido entra na agenda como "Pendente"
→ Pode atender?
   ├─ Sim → Confirma → cliente recebe confirmação no WhatsApp
   └─ Não → Sugere outro horário → cliente aceita ou escolhe outro

DIA DO SERVIÇO
Cliente recebe lembrete no WhatsApp → Técnico vê endereço na agenda
→ Faz o serviço → Marca "Concluído" e anota o que foi feito

PÓS-SERVIÇO (recorrência)
Serviço vai para o histórico do cliente → App calcula a data de retorno
(ex.: 6 meses após limpeza) → Ao chegar a data, avisa o técnico
→ Técnico envia lembrete ao cliente → Cliente agenda de novo
```

## 4. Telas (referência visual: mockups em celular 390×844)

Todas as telas existem como mockup no canvas "App Vini Climatização". Itens abaixo descrevem conteúdo e comportamento.

### App do cliente
1. **Abertura** — logo grande, frase "Seu ar condicionado em boas mãos.", botão "Começar", link "Já tenho conta".
2. **Início** — logo e sino de notificações; "Olá, [nome]"; card principal "Agendar serviço" com botão "Agendar agora"; atalhos dos 4 serviços (Instalação, Limpeza, Manutenção, Carga de gás); card "Próximo agendamento" (data, serviço, horário, status); barra inferior: Início, Agenda, Histórico, Perfil.
3. **Escolher serviço** (passo 1 de 3) — lista de seleção única: Instalação (split e janela), Limpeza (higienização completa), Manutenção (diagnóstico e reparo), Carga de gás (recarga e teste), Orçamento (avaliação no local). Botão "Continuar".
4. **Dia e horário** (passo 2 de 3) — navegação por semana; chips de dia (SEG a SÁB); grade de horários em 3 colunas, indisponíveis ficam desabilitados e riscados; resumo editável do endereço e do aparelho; botão "Confirmar horário".
5. **Confirmação** (passo 3 de 3) — ícone de sucesso, "Agendado!", resumo (serviço, data, local, aparelho), cartão do técnico com botão de mensagem, botão "Adicionar à agenda" e link "Voltar ao início".

### Painel do técnico
6. **Agenda de hoje** — alternância Dia/Semana; linha do tempo com horário, serviço, cliente e bairro; status por cor (verde = confirmado, âmbar = pendente); no card pendente, botões "Confirmar" e "Remarcar"; barra inferior: Agenda, Clientes, Serviços, Ajustes.
7. **Clientes e retornos** — busca; card de destaque "N retornos para chamar" com botão "Enviar lembretes"; lista de clientes recentes com último serviço e etiqueta (Retorno hoje, Vencido, Em N meses, Em dia).

### Telas a criar (ainda não desenhadas)
- Cadastro/dados do aparelho (marca, BTUs, tipo, foto) e endereço.
- Detalhe do agendamento (cliente e técnico), com ações conforme o status.
- Concluir serviço (observações, peças/gás usados, valor cobrado, foto opcional).
- Detalhe do cliente (histórico de serviços e aparelhos).
- Ajustes do técnico: dias e horários de trabalho, duração por serviço, intervalo de retorno por serviço, bloqueio de datas, número de WhatsApp.
- Login do técnico.

## 5. Regras de negócio

- **Status do agendamento:** `pendente` → `confirmado` → `concluido`; também `cancelado` e `remarcado`.
- **Horários livres:** calculados a partir dos dias/horários de trabalho do técnico, menos agendamentos existentes (pendentes e confirmados) e bloqueios. Considerar a **duração de cada serviço** e um **intervalo de deslocamento** entre atendimentos (configuráveis).
- **Sem conflito:** dois clientes nunca podem reservar o mesmo horário (validar no servidor, não só na tela).
- **Antecedência mínima** para agendar e **limite de dias à frente** (configuráveis).
- **Retorno:** cada serviço tem um intervalo de retorno em meses (padrão sugerido: limpeza 6, manutenção 12; editável). Ao concluir um serviço, criar o lembrete de retorno. Instalação e orçamento podem não ter retorno.
- **Notificações ao cliente:** confirmação, lembrete na véspera, aviso de remarcação/cancelamento, lembrete de retorno.
- **Notificações ao técnico:** novo pedido pendente, cancelamento pelo cliente.

## 6. Dados principais (modelo sugerido)

- `servicos`: id, nome, descrição, duração_min, intervalo_retorno_meses, preço_base (opcional)
- `clientes`: id, nome, whatsapp, criado_em
- `enderecos`: id, cliente_id, rua, número, bairro, complemento, observações
- `aparelhos`: id, cliente_id, tipo, marca, btus, foto_url
- `agendamentos`: id, cliente_id, servico_id, endereco_id, aparelho_id, inicio, fim, status, observação_cliente, criado_em
- `atendimentos` (concluídos): id, agendamento_id, descrição_do_que_foi_feito, valor, fotos, concluído_em
- `retornos`: id, cliente_id, aparelho_id, servico_id, data_prevista, status (`pendente`, `avisado`, `agendado`, `dispensado`)
- `disponibilidade`: dia_da_semana, hora_inicio, hora_fim
- `bloqueios`: inicio, fim, motivo
- `ajustes`: whatsapp_do_tecnico, intervalo_deslocamento_min, antecedência_minima_horas, dias_à_frente

## 7. Requisitos de PWA

- `manifest.webmanifest` com nome "Vini Climatização", nome curto "Vini", `display: standalone`, `theme_color` azul (#14307F), `background_color` claro (#F4F8FE), ícones 192 e 512 (também versão maskable).
- Service worker para abrir rápido e mostrar uma tela offline amigável. O agendamento em si exige internet.
- HTTPS, viewport mobile, áreas de toque de pelo menos 44 px, tela instalável (botão ou orientação para "Adicionar à tela inicial").
- Mobile-first. O painel do técnico também deve funcionar bem em computador.

## 8. Stack sugerida (pode ser trocada)

Escolhida pela simplicidade e baixo custo para um técnico individual:

- **Front-end:** React com Vite (ou Next.js), TypeScript, PWA via `vite-plugin-pwa`.
- **Back-end e banco:** Supabase (Postgres, autenticação do técnico, armazenamento de fotos, regras de acesso por linha).
- **Hospedagem:** Vercel ou Netlify.
- **WhatsApp na primeira versão:** links `wa.me` com mensagem pronta (confirmação, lembrete, retorno), que o técnico dispara com um toque. Sem custo e sem aprovação. Automação total via API oficial do WhatsApp Business fica para uma fase 2.
- **Lembretes automáticos:** tarefa agendada no servidor que gera a lista do dia e os retornos vencidos e envia notificação push ao técnico.

## 9. Design (resumo dos mockups)

- **Estilo:** moderno e limpo, cantos bem arredondados, muito espaço em branco, pouco texto, cartões brancos sobre fundo azul bem claro.
- **Fonte:** Plus Jakarta Sans (pesos 500 a 800).
- **Cores:**
  - Azul marinho `#14307F` (principal, títulos de destaque)
  - Azul vivo `#2A6FDB` (degradê dos botões e do card principal)
  - Azul de ação `#1F4FC4` (seleção, links, item ativo)
  - Gelo `#E8F1FD` (fundos de ícones e chips)
  - Fundo `#F4F8FE`
  - Borda `#DCE7F6`
  - Texto `#0E1B3D`
  - Texto secundário `#55627F`
  - Sucesso: fundo `#DDF3E8`, texto `#0F6B4B`
  - Atenção: fundo `#FFEBC2`, texto `#7A4A00`
- **Botão principal:** degradê 135° de `#14307F` a `#2A6FDB`, texto branco, altura 58 px, totalmente arredondado.
- **Cartões:** fundo branco, borda 1 px `#DCE7F6`, raio 20 a 26 px.
- **Ícones:** traço de 1,8 px, estilo linear, sem emoji.
- **Acessibilidade:** contraste mínimo de 4,5:1 no texto, botões reais (`<button>`), rótulos em ícones sem texto.
- **Logo:** arquivo `vini-logo.png` (fundo transparente). Usar sobre fundos claros. Para o ícone do app, criar uma versão quadrada só com o "V" e o floco de neve.

## 10. Informações que faltam (perguntar ao dono antes de finalizar)

- [PREÇOS] de cada serviço, ou exibir "sob orçamento".
- [HORÁRIO DE TRABALHO] dias e horas de atendimento.
- [DURAÇÃO] média de cada serviço.
- [REGIÃO ATENDIDA] bairros ou raio de atendimento.
- [WHATSAPP] número do técnico.
- [INTERVALO DE RETORNO] por serviço.
- [DOMÍNIO] endereço desejado para o site.

## 11. Ordem de implementação sugerida

1. Projeto base com PWA instalável, tema e componentes (botão, cartão, chip, barra inferior).
2. Banco de dados e regras de horários livres (com testes).
3. Fluxo do cliente completo: serviço → horário → dados → confirmação.
4. Login e painel do técnico: agenda, confirmar/remarcar/cancelar.
5. Concluir serviço, histórico e cadastro de clientes.
6. Retornos e lembretes (links de WhatsApp e notificação push ao técnico).
7. Ajustes do técnico (horários, bloqueios, durações).
8. Publicação, testes em celular de verdade e ajustes finais.

**Critério de pronto da versão 1:** um cliente consegue agendar sozinho do início ao fim pelo celular, o técnico recebe, confirma e conclui, e o app mostra os retornos a chamar.
