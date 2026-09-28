const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const http = require('http');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ── i18n ────────────────────────────────────────────────────────────────────
const LANG = {
  'pt-BR': {
    created:       (u) => `✅ Partida criada por ${u}! Reaja com ✋ para entrar (2-5 jogadores).`,
    chooseColor:   'Escolha sua cor:',
    colorTaken:    'Essa cor já foi escolhida! Tente outra.',
    waitingPlayers:(n) => `Aguardando jogadores... (${n}/5)\nDigite \`!c4 iniciar\` quando todos estiverem prontos.`,
    started:       '🎮 Jogo iniciado!',
    turn:          (u, color) => `Vez de ${u} ${color} — escolha **letra** depois **número** reagindo abaixo. ⏱️ 60s`,
    invalidMove:   'Jogada inválida! Coluna cheia ou fora do tabuleiro.',
    wins:          (u) => `🏆 ${u} venceu!`,
    draw:          '🤝 Empate! Tabuleiro cheio.',
    timeout:       (u) => `⏰ ${u} demorou demais! Vez pulada.`,
    noGame:        'Nenhuma partida ativa neste canal.',
    notYourTurn:   'Não é sua vez!',
    alreadyExists: 'Já existe uma partida neste canal! Use `!c4 cancelar` para cancelar.',
    cancelled:     '❌ Partida cancelada.',
    notEnough:     'São necessários pelo menos 2 jogadores para iniciar.',
    colorChoose:   (u) => `${u} escolheu sua cor!`,
    settingsTitle: '⚙️ Configurações',
    settingsDesc:  'Escolha seu idioma:',
    settingsSaved: (lang) => `✅ Idioma salvo: **${lang}**`,
    joinFirst:     'Entre na partida primeiro reagindo com ✋!',
    alreadyIn:     'Você já está na partida!',
    colors:        { roxo:'🟣', branco:'⚪', laranja:'🟠', azulClaro:'🔵', rosa:'🩷', amarelo:'🟡' },
    colorNames:    { roxo:'Roxo', branco:'Branco', laranja:'Laranja', azulClaro:'Azul Claro', rosa:'Rosa', amarelo:'Amarelo' },
    colLabels:     ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'],
    rowLabels:     ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'],
    empty:         '⬛',
    help:          '`!c4 criar` — Cria partida\n`!c4 entrar` — Entra na partida\n`!c4 iniciar` — Inicia o jogo\n`!c4 cancelar` — Cancela partida\n`/c4 settings` — Configurações',
  },
  'en-US': {
    created:       (u) => `✅ Match created by ${u}! React with ✋ to join (2-5 players).`,
    chooseColor:   'Choose your color:',
    colorTaken:    'That color is already taken! Try another.',
    waitingPlayers:(n) => `Waiting for players... (${n}/5)\nType \`!c4 start\` when everyone is ready.`,
    started:       '🎮 Game started!',
    turn:          (u, color) => `${u}'s turn ${color} — react with a **letter** then a **number** below. ⏱️ 60s`,
    invalidMove:   'Invalid move! Column full or out of bounds.',
    wins:          (u) => `🏆 ${u} wins!`,
    draw:          '🤝 Draw! Board is full.',
    timeout:       (u) => `⏰ ${u} took too long! Turn skipped.`,
    noGame:        'No active game in this channel.',
    notYourTurn:   "It's not your turn!",
    alreadyExists: 'A game already exists in this channel! Use `!c4 cancel` to cancel.',
    cancelled:     '❌ Game cancelled.',
    notEnough:     'At least 2 players are required to start.',
    colorChoose:   (u) => `${u} chose their color!`,
    settingsTitle: '⚙️ Settings',
    settingsDesc:  'Choose your language:',
    settingsSaved: (lang) => `✅ Language saved: **${lang}**`,
    joinFirst:     'Join the game first by reacting with ✋!',
    alreadyIn:     "You're already in the game!",
    colors:        { roxo:'🟣', branco:'⚪', laranja:'🟠', azulClaro:'🔵', rosa:'🩷', amarelo:'🟡' },
    colorNames:    { roxo:'Purple', branco:'White', laranja:'Orange', azulClaro:'Light Blue', rosa:'Pink', amarelo:'Yellow' },
    colLabels:     ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'],
    rowLabels:     ['🇦','🇧','🇨','🇩','🇪','🇫','🇬','🇭','🇮','🇯'],
    empty:         '⬛',
    help:          '`!c4 create` — Create game\n`!c4 join` — Join game\n`!c4 start` — Start game\n`!c4 cancel` — Cancel game\n`/c4 settings` — Settings',
  },
};

// ── State ────────────────────────────────────────────────────────────────────
const games   = new Map(); // channelId → game
const userLang = new Map(); // userId → 'pt-BR' | 'en-US'

function t(userId, key, ...args) {
  const lang = userLang.get(userId) || 'pt-BR';
  const str  = LANG[lang][key];
  return typeof str === 'function' ? str(...args) : str;
}

function tChannel(game, key, ...args) {
  // uses creator's language for channel-wide messages
  return t(game.creatorId, key, ...args);
}

// ── Board helpers ─────────────────────────────────────────────────────────────
const COLOR_KEYS = ['roxo','branco','laranja','azulClaro','rosa','amarelo'];

function makeBoard(players) {
  const cols = players <= 3 ? 7 : 8;
  const rows = players <= 3 ? 6 : 10;
  return { cols, rows, cells: Array.from({length: rows}, () => Array(cols).fill(null)) };
}

function renderBoard(game) {
  const { board, players, creatorId } = game;
  const lang = userLang.get(creatorId) || 'pt-BR';
  const T = LANG[lang];

  // header: column numbers
  let out = T.empty;
  for (let c = 0; c < board.cols; c++) out += T.colLabels[c];
  out += '\n';

  for (let r = 0; r < board.rows; r++) {
    out += T.rowLabels[r];
    for (let c = 0; c < board.cols; c++) {
      const pid = board.cells[r][c];
      out += pid ? T.colors[players[pid].colorKey] : T.empty;
    }
    out += '\n';
  }
  return out;
}

function dropPiece(board, col, playerId) {
  // find lowest empty row in column
  for (let r = board.rows - 1; r >= 0; r--) {
    if (!board.cells[r][col]) {
      board.cells[r][col] = playerId;
      return r;
    }
  }
  return -1; // full
}

function checkWin(board, row, col, playerId) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr,dc] of dirs) {
    let count = 1;
    for (const sign of [1,-1]) {
      let r = row+dr*sign, c = col+dc*sign;
      while (r>=0&&r<board.rows&&c>=0&&c<board.cols&&board.cells[r][c]===playerId) {
        count++; r+=dr*sign; c+=dc*sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function isBoardFull(board) {
  return board.cells[0].every(c => c !== null);
}

// ── Timer ────────────────────────────────────────────────────────────────────
function startTimer(game) {
  clearTimeout(game.timer);
  game.timer = setTimeout(async () => {
    const current = game.turnOrder[game.turnIndex];
    const player  = game.players[current];
    const channel = await client.channels.fetch(game.channelId).catch(()=>null);
    if (!channel) return;
    await channel.send(tChannel(game, 'timeout', `<@${current}>`));
    advanceTurn(game);
    await updateBoardMessage(game, channel);
  }, 60_000);
}

function advanceTurn(game) {
  game.pendingLetter = null;
  game.pendingCol    = null;
  game.turnIndex = (game.turnIndex + 1) % game.turnOrder.length;
}

// ── Board message ─────────────────────────────────────────────────────────────
async function updateBoardMessage(game, channel) {
  const lang = userLang.get(game.creatorId) || 'pt-BR';
  const T    = LANG[lang];
  const currentId = game.turnOrder[game.turnIndex];
  const currentP  = game.players[currentId];

  const embed = new EmbedBuilder()
    .setTitle('Connect 4')
    .setDescription(renderBoard(game))
    .setColor(0x5865F2)
    .addFields({ name: '⏩ Turno', value: tChannel(game, 'turn', `<@${currentId}>`, T.colors[currentP.colorKey]) });

  try {
    if (game.boardMessageId) {
      const msg = await channel.messages.fetch(game.boardMessageId);
      await msg.edit({ embeds: [embed] });
    } else {
      const msg = await channel.send({ embeds: [embed] });
      game.boardMessageId = msg.id;

      // add row reactions (letters)
      for (let i = 0; i < game.board.rows; i++) await msg.react(T.rowLabels[i]);
      // add col reactions (numbers)
      for (let i = 0; i < game.board.cols; i++) await msg.react(T.colLabels[i]);
    }
  } catch(e) { console.error(e); }

  startTimer(game);
}

// ── Commands ──────────────────────────────────────────────────────────────────
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;
  const content = msg.content.trim().toLowerCase();
  const uid     = msg.author.id;
  const cid     = msg.channel.id;
  const lang    = userLang.get(uid) || 'pt-BR';
  const T       = LANG[lang];

  // !c4 criar / create
  if (content === '!c4 criar' || content === '!c4 create') {
    if (games.has(cid)) return msg.reply(T.alreadyExists);

    const game = {
      channelId:      cid,
      creatorId:      uid,
      phase:          'lobby', // lobby | color | playing
      players:        {},      // uid → { colorKey, name }
      turnOrder:      [],
      turnIndex:      0,
      board:          null,
      boardMessageId: null,
      pendingLetter:  null,    // row index waiting
      timer:          null,
      joinMessageId:  null,
    };
    games.set(cid, game);

    const joinMsg = await msg.channel.send(tChannel(game, 'created', `<@${uid}>`));
    game.joinMessageId = joinMsg.id;
    await joinMsg.react('✋');
    return;
  }

  // !c4 iniciar / start
  if (content === '!c4 iniciar' || content === '!c4 start') {
    const game = games.get(cid);
    if (!game) return msg.reply(T.noGame);
    if (game.phase !== 'lobby') return;
    if (Object.keys(game.players).length < 2) return msg.reply(T.notEnough);

    game.phase     = 'playing';
    game.board     = makeBoard(Object.keys(game.players).length);
    game.turnOrder = Object.keys(game.players);
    game.turnIndex = 0;

    await msg.channel.send(tChannel(game, 'started'));
    await updateBoardMessage(game, msg.channel);
    return;
  }

  // !c4 cancelar / cancel
  if (content === '!c4 cancelar' || content === '!c4 cancel') {
    const game = games.get(cid);
    if (!game) return msg.reply(T.noGame);
    clearTimeout(game.timer);
    games.delete(cid);
    return msg.channel.send(T.cancelled);
  }

  // !c4 ajuda / help
  if (content === '!c4 ajuda' || content === '!c4 help') {
    return msg.reply(T.help);
  }
});

// ── Reactions ─────────────────────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(()=>{});

  const cid  = reaction.message.channelId;
  const game = games.get(cid);
  if (!game) return;

  const uid  = user.id;
  const lang = userLang.get(game.creatorId) || 'pt-BR';
  const T    = LANG[lang];
  const emoji = reaction.emoji.name;

  // ── LOBBY: join with ✋ ──
  if (game.phase === 'lobby' && emoji === '✋' && reaction.message.id === game.joinMessageId) {
    if (game.players[uid]) return; // already in
    if (Object.keys(game.players).length >= 5) return;

    // ask color via DM or channel
    const usedColors = Object.values(game.players).map(p => p.colorKey);
    const available  = COLOR_KEYS.filter(k => !usedColors.includes(k));

    const colorLang = userLang.get(uid) || 'pt-BR';
    const TU = LANG[colorLang];

    const options = available.map(k => ({
      label: TU.colorNames[k],
      value: k,
      emoji: TU.colors[k],
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`color_${cid}_${uid}`)
        .setPlaceholder(TU.chooseColor)
        .addOptions(options)
    );

    const channel = reaction.message.channel;
    const colorMsg = await channel.send({ content: `<@${uid}> ${TU.chooseColor}`, components: [row] });

    // store temp so we know they're picking
    game.players[uid] = { colorKey: null, name: user.username, colorMsgId: colorMsg.id };

    const count = Object.keys(game.players).length;
    await channel.send(tChannel(game, 'waitingPlayers', count));
    return;
  }

  // ── PLAYING: board reactions ──
  if (game.phase !== 'playing') return;
  if (reaction.message.id !== game.boardMessageId) return;

  const currentId = game.turnOrder[game.turnIndex];
  if (uid !== currentId) return; // not their turn

  // remove reaction silently
  await reaction.users.remove(user).catch(()=>{});

  const rowLabels = T.rowLabels;
  const colLabels = T.colLabels;
  const rowIdx = rowLabels.indexOf(emoji);
  const colIdx = colLabels.indexOf(emoji);

  // step 1: pick letter (row)
  if (rowIdx !== -1 && game.pendingLetter === null) {
    game.pendingLetter = rowIdx;
    return;
  }

  // step 2: pick number (col) after letter
  if (colIdx !== -1 && game.pendingLetter !== null) {
    const col = colIdx;
    const channel = reaction.message.channel;

    // drop piece — Connect 4 drops to BOTTOM of column, row hint is just UX
    const landedRow = dropPiece(game.board, col, currentId);
    if (landedRow === -1) {
      game.pendingLetter = null;
      await channel.send(tChannel(game, 'invalidMove'));
      return;
    }

    game.pendingLetter = null;

    // check win
    if (checkWin(game.board, landedRow, col, currentId)) {
      clearTimeout(game.timer);
      await updateBoardMessage(game, channel);
      await channel.send(tChannel(game, 'wins', `<@${currentId}>`));
      games.delete(cid);
      return;
    }

    // check draw
    if (isBoardFull(game.board)) {
      clearTimeout(game.timer);
      await updateBoardMessage(game, channel);
      await channel.send(tChannel(game, 'draw'));
      games.delete(cid);
      return;
    }

    advanceTurn(game);
    await updateBoardMessage(game, channel);
    return;
  }
});

// ── Select menu: color pick ───────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // /c4 settings slash command
  if (interaction.isChatInputCommand && interaction.commandName === 'c4') {
    const sub = interaction.options?.getSubcommand();
    if (sub === 'settings') {
      const uid  = interaction.user.id;
      const lang = userLang.get(uid) || 'pt-BR';
      const T    = LANG[lang];

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`lang_${uid}`)
          .setPlaceholder(T.settingsDesc)
          .addOptions([
            { label: 'Português (Brasil)', value: 'pt-BR', emoji: '🇧🇷' },
            { label: 'English (US)',       value: 'en-US', emoji: '🇺🇸' },
          ])
      );
      return interaction.reply({ content: `${T.settingsTitle}\n${T.settingsDesc}`, components: [row], ephemeral: true });
    }
  }

  if (!interaction.isStringSelectMenu()) return;

  const uid = interaction.user.id;

  // language select
  if (interaction.customId === `lang_${uid}`) {
    const chosen = interaction.values[0];
    userLang.set(uid, chosen);
    const T = LANG[chosen];
    const label = chosen === 'pt-BR' ? 'Português (Brasil)' : 'English (US)';
    return interaction.update({ content: T.settingsSaved(label), components: [] });
  }

  // color select: color_{channelId}_{userId}
  if (interaction.customId.startsWith('color_')) {
    const parts = interaction.customId.split('_');
    const cid   = parts[1];
    const pid   = parts[2];

    if (uid !== pid) return interaction.reply({ content: '❌', ephemeral: true });

    const game = games.get(cid);
    if (!game || !game.players[uid]) return interaction.reply({ content: '❌', ephemeral: true });

    const colorLang = userLang.get(uid) || 'pt-BR';
    const TU = LANG[colorLang];

    const chosen = interaction.values[0];
    const usedColors = Object.values(game.players)
      .filter(p => p.colorKey !== null)
      .map(p => p.colorKey);

    if (usedColors.includes(chosen)) {
      return interaction.reply({ content: TU.colorTaken, ephemeral: true });
    }

    game.players[uid].colorKey = chosen;
    await interaction.update({ content: `${TU.colors[chosen]} ${TU.colorNames[chosen]} ✅`, components: [] });
    return;
  }
});

// ── Keep-alive ping (Render free tier) ───────────────────────────────────────
http.createServer((_, res) => res.end('ok')).listen(process.env.PORT || 3000);

// ── Register slash command on ready ──────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  const { REST, Routes, SlashCommandBuilder } = require('discord.js');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName('c4')
      .setDescription('Connect 4 settings')
      .addSubcommand(sub =>
        sub.setName('settings').setDescription('Change your language / Mude seu idioma')
      )
      .toJSON(),
  ];

  for (const cmd of commands) {
    await rest.post(Routes.applicationCommands(client.user.id), { body: cmd }).catch(console.error);
  }
});

client.login(process.env.DISCORD_TOKEN);
