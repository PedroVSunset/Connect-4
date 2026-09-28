# Connect 4 — Discord Bot

## Comandos
| Comando | Descrição |
|---|---|
| `!c4 criar` | Cria uma partida no canal |
| `!c4 iniciar` | Inicia o jogo (mín. 2 jogadores) |
| `!c4 cancelar` | Cancela a partida |
| `!c4 ajuda` | Mostra ajuda |
| `/c4 settings` | Muda o idioma (PT-BR / EN-US) |

## Como jogar
1. `!c4 criar` → reaja com ✋ para entrar
2. Escolha sua cor no menu
3. `!c4 iniciar` para começar
4. Na sua vez, reaja com uma **letra** (linha) depois um **número** (coluna)

## Tabuleiro
- **2-3 jogadores:** 6 linhas × 7 colunas
- **4-5 jogadores:** 10 linhas × 8 colunas

## Deploy no Render
1. Crie repositório no GitHub com esses arquivos
2. Acesse render.com → New Web Service → conecte o repositório
3. Configure a variável de ambiente:
   - `DISCORD_TOKEN` = token do seu bot
4. Start command: `npm start`

## Discord Developer Portal
- Intents necessários: `MESSAGE CONTENT`, `SERVER MEMBERS`, `GUILDS`
- Em OAuth2 → adicione permissões: `Send Messages`, `Read Messages`, `Add Reactions`, `Manage Messages`
