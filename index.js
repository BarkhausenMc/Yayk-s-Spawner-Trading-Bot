require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

const {
  initDefaultSpawner,
  getAllSpawnerPreise,
  getSpawnerPreis,
  updateSpawnerPreis,
  savePanelMessage,
  getPanelMessage,
  getNextTradeNumber,

  createTrade,
  getTradeByThreadId,
  setTradeMessageId,

  claimTrade,
  releaseTrade,
  markTradeBought,

  setCloseRequest,
  clearCloseRequest,
  closeTrade
} = require('./database');


/*
|--------------------------------------------------------------------------
| DEFAULT SPAWNER
|--------------------------------------------------------------------------
*/

initDefaultSpawner('💀 Skelly', 0, 0);
initDefaultSpawner('💥 Creeper', 0, 0);


/*
|--------------------------------------------------------------------------
| CLIENT
|--------------------------------------------------------------------------
*/

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function getSpawnerEmoji(spawnerName) {
  const emojis = {
    '💀 Skelly': '💀',
    '💥 Creeper': '💥'
  };

  return emojis[spawnerName] || '🔹';
}


function formatMillions(millions) {
  if (millions >= 1000) {
    return (millions / 1000).toFixed(1) + 'B';
  }

  if (millions % 1 === 0) {
    return millions + 'M';
  }

  return millions.toFixed(1) + 'M';
}


/*
|--------------------------------------------------------------------------
| PANEL
|--------------------------------------------------------------------------
*/

function buildPanel() {
  const spawnerData = getAllSpawnerPreise();

  const rows = spawnerData
    .map(({ spawner_name, kaufpreis, verkaufspreis }) =>
      `${spawner_name.padEnd(14)}${('🛒' + formatMillions(kaufpreis)).padEnd(14)}💰${formatMillions(verkaufspreis)}`
    )
    .join('\n');

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '# 🛒 • SPAWNER TRADING • 💰\n' +
        '*Yayks Spawner Trading*\n' +
        '*||Only Trusted Trader, Faire Preise 💜||*\n\n' +
        '```SPAWNER      🛒KAUFEN     💰VERKAUF\n' +
        '─────────────────────────────────────────────\n' +
        rows +
        '\n─────────────────────────────────────────────```'
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '💰 **VERKAUFEN** — Du **verkaufst** uns deine Spawner\n' +
        '🛒 **ANKAUF** — Du **kaufst** unsere Spawner'
      )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Klicke unten auf den `💰 VERKAUFEN` oder `🛒 ANKAUF` Button,\n' +
        'um einen Trade zu starten.'
      )
    );

  const spawnerBuyRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('spawner-kaufen')
        .setLabel('Spawner Kaufen')
        .setEmoji('🛒')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('spawner-verkaufen')
        .setLabel('Spawner Verkaufen')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    );

  return {
    container,
    spawnerBuyRow
  };
}


async function updateExistingPanel(guildId) {
  const savedPanel = getPanelMessage(guildId);

  if (!savedPanel) {
    return false;
  }

  try {
    const channel = client.channels.cache.get(
      savedPanel.channel_id
    );

    if (!channel || !channel.isTextBased()) {
      return false;
    }

    const message = await channel.messages.fetch(
      savedPanel.message_id
    );

    if (!message) {
      return false;
    }

    const {
      container,
      spawnerBuyRow
    } = buildPanel();

    await message.edit({
      components: [
        container,
        spawnerBuyRow
      ]
    });

    return true;

  } catch (error) {
    console.error(
      'Fehler beim Aktualisieren des Panels:',
      error
    );

    return false;
  }
}


/*
|--------------------------------------------------------------------------
| TRADE CONTAINER
|--------------------------------------------------------------------------
*/

function buildTradeContainer(trade) {

  let statusText = '';
  let infoText = '';
  let buttons = [];


  /*
  |--------------------------------------------------------------------------
  | SCHLIESSUNGSANFRAGE
  |--------------------------------------------------------------------------
  */

  if (trade.close_requested_by) {

    statusText =
      `🟠 **Schließungsanfrage von <@${trade.close_requested_by}>**`;

    infoText =
      `⚠️ <@${trade.close_requested_by}> möchte diesen Trade schließen.\n` +
      'Die andere Partei muss die Anfrage annehmen oder ablehnen.';

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-close-accept-${trade.thread_id}`)
        .setLabel('Annehmen')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`trade-close-reject-${trade.thread_id}`)
        .setLabel('Ablehnen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    ];

  }

  /*
  |--------------------------------------------------------------------------
  | GEKAUFT
  |--------------------------------------------------------------------------
  */

  else if (trade.bought) {

    statusText =
      `🟢 **Status:** Gekauft\n` +
      `👷 **Trader:** <@${trade.trader_id}>`;

    infoText =
      '✅ Dieser Trade wurde als gekauft markiert.\n' +
      'Der Trader kann das Ticket jetzt freigeben oder schließen.';

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-release-${trade.thread_id}`)
        .setLabel('Freigeben')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`trade-cancel-${trade.thread_id}`)
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    ];

  }

  /*
  |--------------------------------------------------------------------------
  | CLAIMED
  |--------------------------------------------------------------------------
  */

  else if (trade.claimed) {

    statusText =
      `🟡 **Status:** Übernommen\n` +
      `👷 **Trader:** <@${trade.trader_id}>`;

    infoText =
      `🎯 <@${trade.trader_id}> hat diesen Trade übernommen.`;

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-bought-${trade.thread_id}`)
        .setLabel('Als gekauft')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`trade-release-${trade.thread_id}`)
        .setLabel('Freigeben')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`trade-cancel-${trade.thread_id}`)
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    ];

  }

  /*
  |--------------------------------------------------------------------------
  | OFFEN
  |--------------------------------------------------------------------------
  */

  else {

    statusText =
      '🟢 **Status:** Offen';

    infoText =
      'Ein Trader wird sich gleich um deine Anfrage kümmern.';

    buttons = [
      new ButtonBuilder()
        .setCustomId(`trade-claim-${trade.thread_id}`)
        .setLabel('Claim')
        .setEmoji('🎯')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId(`trade-cancel-${trade.thread_id}`)
        .setLabel('Abbrechen')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    ];
  }


  /*
  |--------------------------------------------------------------------------
  | KAUF / VERKAUF TEXT
  |--------------------------------------------------------------------------
  */

  const title =
    trade.type === 'kaufen'
      ? '# 🛒 • Spawner Kaufen'
      : '# 💰 • Spawner Verkaufen';


  const container = new ContainerBuilder()

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `${title}\n` +
          `**🤝 • Handel #${trade.trade_number}**`
        )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `**👤 Kunde:** <@${trade.customer_id}>\n` +
          `**🎮 ING:** \`${trade.minecraft_name}\`\n` +
          `${getSpawnerEmoji(trade.spawner_name)} **Spawner:** ${trade.spawner_name}`
        )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `**📦 Menge:** ${trade.amount}\n` +
          `**💵 Preis/Stk:** ${formatMillions(trade.price_per_unit)}\n` +
          `**💰 Gesamtpreis:** ${formatMillions(trade.total_price)}`
        )
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(statusText)
    )

    .addSeparatorComponents(
      new SeparatorBuilder()
        .setSpacing(1)
        .setDivider(true)
    )

    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(infoText)
    )

    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(buttons)
    );


  return container;
}


/*
|--------------------------------------------------------------------------
| TRADER CHECK
|--------------------------------------------------------------------------
*/

function isTrader(interaction) {
  const traderRoleId = process.env.TRADER_ROLE_ID;

  if (!traderRoleId) {
    return false;
  }

  return interaction.member.roles.cache.has(
    traderRoleId
  );
}


/*
|--------------------------------------------------------------------------
| INTERACTIONS
|--------------------------------------------------------------------------
*/

client.on('interactionCreate', async (interaction) => {

  try {

    /*
    |--------------------------------------------------------------------------
    | SLASH COMMAND: SPAWNER PANEL
    |--------------------------------------------------------------------------
    */

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'spawner-panel'
    ) {

      if (
        !interaction.member.roles.cache.has(
          process.env.ADMIN_ROLE_ID
        )
      ) {
        return interaction.reply({
          content:
            '❌ Du hast keine Berechtigung, diesen Befehl zu nutzen.',
          flags: MessageFlags.Ephemeral
        });
      }

      const {
        container,
        spawnerBuyRow
      } = buildPanel();

      const response = await interaction.reply({
        components: [
          container,
          spawnerBuyRow
        ],
        flags: MessageFlags.IsComponentsV2,
        withResponse: true
      });

      const message =
        response.resource?.message;

      if (message) {

        savePanelMessage(
          interaction.guildId,
          interaction.channelId,
          message.id
        );
      }

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | SLASH COMMAND: PREISE SETZEN
    |--------------------------------------------------------------------------
    */

    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'preise-setzen'
    ) {

      if (
        !interaction.member.roles.cache.has(
          process.env.ADMIN_ROLE_ID
        )
      ) {
        return interaction.reply({
          content:
            '❌ Du hast keine Berechtigung, diesen Befehl zu nutzen.',
          flags: MessageFlags.Ephemeral
        });
      }

      const spawnerName =
        interaction.options.getString('spawner');

      const kaufpreis =
        interaction.options.getNumber('kauf');

      const verkaufspreis =
        interaction.options.getNumber('verkauf');


      const existingPrice =
        getSpawnerPreis(spawnerName);


      if (!existingPrice) {
        return interaction.reply({
          content:
            `❌ Spawner "${spawnerName}" existiert nicht.`,
          flags: MessageFlags.Ephemeral
        });
      }


      updateSpawnerPreis(
        spawnerName,
        kaufpreis,
        verkaufspreis
      );


      await interaction.reply({
        content:
          `✅ Preise für ${spawnerName} aktualisiert!\n\n` +
          `🛒 Kauf: ${formatMillions(kaufpreis)}\n` +
          `💰 Verkauf: ${formatMillions(verkaufspreis)}`,
        flags: MessageFlags.Ephemeral
      });


      await updateExistingPanel(
        interaction.guildId
      );

      return;
    }


    /*
    |--------------------------------------------------------------------------
    | BUTTONS
    |--------------------------------------------------------------------------
    */

    if (interaction.isButton()) {

      /*
      |--------------------------------------------------------------------------
      | SPAWNER KAUFEN
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId ===
        'spawner-kaufen'
      ) {

        const spawnerData =
          getAllSpawnerPreise();


        const spawnerSelect =
          new StringSelectMenuBuilder()
            .setCustomId(
              'spawner-kaufen-select'
            )
            .setPlaceholder(
              'Wähle einen Spawner aus'
            )
            .addOptions(
              spawnerData.map(
                ({
                  spawner_name,
                  kaufpreis
                }) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      spawner_name
                    )
                    .setDescription(
                      `🛒 Kaufpreis: ${formatMillions(kaufpreis)}`
                    )
                    .setValue(
                      spawner_name
                    )
              )
            );


        const container =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  '# 🛒 • SPAWNER KAUFEN\n\n' +
                  'Wähle den Spawner aus, den du kaufen möchtest.'
                )
            )
            .addActionRowComponents(
              new ActionRowBuilder()
                .addComponents(
                  spawnerSelect
                )
            );


        return interaction.reply({
          components: [container],
          flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral
        });
      }


      /*
      |--------------------------------------------------------------------------
      | SPAWNER VERKAUFEN
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId ===
        'spawner-verkaufen'
      ) {

        const spawnerData =
          getAllSpawnerPreise();


        const spawnerSelect =
          new StringSelectMenuBuilder()
            .setCustomId(
              'spawner-verkaufen-select'
            )
            .setPlaceholder(
              'Wähle einen Spawner aus'
            )
            .addOptions(
              spawnerData.map(
                ({
                  spawner_name,
                  verkaufspreis
                }) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(
                      spawner_name
                    )
                    .setDescription(
                      `💰 Verkaufspreis: ${formatMillions(verkaufspreis)}`
                    )
                    .setValue(
                      spawner_name
                    )
              )
            );


        const container =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  '# 💰 • SPAWNER VERKAUFEN\n\n' +
                  'Wähle den Spawner aus, den du verkaufen möchtest.'
                )
            )
            .addActionRowComponents(
              new ActionRowBuilder()
                .addComponents(
                  spawnerSelect
                )
            );


        return interaction.reply({
          components: [container],
          flags:
            MessageFlags.IsComponentsV2 |
            MessageFlags.Ephemeral
        });
      }


      /*
      |--------------------------------------------------------------------------
      | TRADE BUTTONS
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId.startsWith(
          'trade-'
        )
      ) {

        const thread =
          interaction.channel;


        if (!thread.isThread()) {
          return interaction.reply({
            content:
              '❌ Dieser Button kann nur in einem Trade-Ticket benutzt werden.',
            flags:
              MessageFlags.Ephemeral
          });
        }


        let trade =
          getTradeByThreadId(
            thread.id
          );


        if (!trade) {
          return interaction.reply({
            content:
              '❌ Dieses Trade-Ticket existiert nicht in der Datenbank.',
            flags:
              MessageFlags.Ephemeral
          });
        }


        const isCustomer =
          interaction.user.id ===
          trade.customer_id;

        const trader =
          isTrader(interaction);


        /*
        |--------------------------------------------------------------------------
        | CLAIM
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-claim-${trade.thread_id}`
        ) {

          if (!trader) {
            return interaction.reply({
              content:
                '❌ Nur ein Trader kann dieses Ticket claimen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (trade.claimed) {
            return interaction.reply({
              content:
                '❌ Dieses Ticket wurde bereits übernommen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (trade.close_requested_by) {
            return interaction.reply({
              content:
                '❌ Für dieses Ticket läuft bereits eine Schließungsanfrage.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          claimTrade(
            trade.thread_id,
            interaction.user.id
          );


          trade =
            getTradeByThreadId(
              trade.thread_id
            );


          const container =
            buildTradeContainer(
              trade
            );


          await interaction.update({
            components: [container]
          });


          await thread.send({
            content:
              `🎯 <@${interaction.user.id}> hat den Trade übernommen.`
          });


          return;
        }


        /*
        |--------------------------------------------------------------------------
        | ALS GEKAUFT
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-bought-${trade.thread_id}`
        ) {

          if (!trader) {
            return interaction.reply({
              content:
                '❌ Nur ein Trader kann diesen Trade als gekauft markieren.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (
            !trade.claimed ||
            trade.trader_id !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Du bist nicht der Trader, der dieses Ticket übernommen hat.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (trade.bought) {
            return interaction.reply({
              content:
                '❌ Dieser Trade wurde bereits als gekauft markiert.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          markTradeBought(
            trade.thread_id
          );


          trade =
            getTradeByThreadId(
              trade.thread_id
            );


          const container =
            buildTradeContainer(
              trade
            );


          await interaction.update({
            components: [container]
          });


          await thread.send({
            content:
              `✅ <@${interaction.user.id}> hat den Trade als **gekauft** markiert.`
          });


          return;
        }


        /*
        |--------------------------------------------------------------------------
        | FREIGEBEN
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-release-${trade.thread_id}`
        ) {

          if (!trader) {
            return interaction.reply({
              content:
                '❌ Nur ein Trader kann dieses Ticket freigeben.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (
            !trade.claimed ||
            trade.trader_id !==
              interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Du bist nicht der Trader, der dieses Ticket übernommen hat.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (trade.close_requested_by) {
            return interaction.reply({
              content:
                '❌ Es läuft bereits eine Schließungsanfrage.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          releaseTrade(
            trade.thread_id
          );


          trade =
            getTradeByThreadId(
              trade.thread_id
            );


          const container =
            buildTradeContainer(
              trade
            );


          await interaction.update({
            components: [container]
          });


          await thread.send({
            content:
              `🔓 <@${interaction.user.id}> hat den Trade freigegeben.`
          });


          return;
        }


        /*
        |--------------------------------------------------------------------------
        | ABBRECHEN
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-cancel-${trade.thread_id}`
        ) {

          if (!isCustomer && !trader) {
            return interaction.reply({
              content:
                '❌ Du bist nicht an diesem Trade beteiligt.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          /*
           * Ein Kunde darf nur abbrechen,
           * wenn ein Trader geclaimt hat.
           */

          if (
            isCustomer &&
            !trade.claimed
          ) {
            return interaction.reply({
              content:
                '❌ Du kannst das Ticket erst abbrechen, wenn ein Trader es übernommen hat.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          /*
           * Ein Trader darf nur abbrechen,
           * wenn er selbst geclaimt hat.
           */

          if (
            trader &&
            trade.claimed &&
            trade.trader_id !==
              interaction.user.id &&
            !isCustomer
          ) {
            return interaction.reply({
              content:
                '❌ Nur der Trader, der dieses Ticket übernommen hat, kann eine Schließungsanfrage stellen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (trade.close_requested_by) {
            return interaction.reply({
              content:
                '❌ Es gibt bereits eine Schließungsanfrage.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          setCloseRequest(
            trade.thread_id,
            interaction.user.id
          );


          trade =
            getTradeByThreadId(
              trade.thread_id
            );


          const container =
            buildTradeContainer(
              trade
            );


          await interaction.update({
            components: [container]
          });


          const otherUserId =
            interaction.user.id ===
            trade.customer_id
              ? trade.trader_id
              : trade.customer_id;


          await thread.send({
            content:
              `⚠️ <@${interaction.user.id}> möchte diesen Trade schließen.\n` +
              `👉 <@${otherUserId}> bitte entscheide, ob der Trade geschlossen werden soll.`
          });


          return;
        }


        /*
        |--------------------------------------------------------------------------
        | SCHLIESSUNG ANNEHMEN
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-close-accept-${trade.thread_id}`
        ) {

          if (!trade.close_requested_by) {
            return interaction.reply({
              content:
                '❌ Es gibt keine aktive Schließungsanfrage.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          /*
           * Antragsteller darf nicht selbst annehmen
           */

          if (
            trade.close_requested_by ===
            interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Du kannst deine eigene Schließungsanfrage nicht annehmen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          const requestedByCustomer =
            trade.close_requested_by ===
            trade.customer_id;


          const requestedByTrader =
            trade.close_requested_by ===
            trade.trader_id;


          const validOtherParty =
            (
              isCustomer &&
              requestedByTrader
            ) ||
            (
              trader &&
              requestedByCustomer &&
              trade.trader_id ===
                interaction.user.id
            );


          if (!validOtherParty) {
            return interaction.reply({
              content:
                '❌ Nur die andere Partei kann diese Schließungsanfrage annehmen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          closeTrade(
            trade.thread_id
          );


          await interaction.reply({
            content:
              '✅ Die Schließungsanfrage wurde angenommen. Das Ticket wird geschlossen.',
            flags:
              MessageFlags.Ephemeral
          });


          await thread.send({
            content:
              `🔒 <@${interaction.user.id}> hat die Schließungsanfrage angenommen.\n` +
              'Dieses Ticket wird jetzt geschlossen.'
          });


          setTimeout(
            async () => {
              try {
                await thread.setArchived(
                  true,
                  'Trade geschlossen'
                );
              } catch (error) {
                console.error(
                  'Fehler beim Archivieren des Threads:',
                  error
                );
              }
            },
            1500
          );


          return;
        }


        /*
        |--------------------------------------------------------------------------
        | SCHLIESSUNG ABLEHNEN
        |--------------------------------------------------------------------------
        */

        if (
          interaction.customId ===
          `trade-close-reject-${trade.thread_id}`
        ) {

          if (!trade.close_requested_by) {
            return interaction.reply({
              content:
                '❌ Es gibt keine aktive Schließungsanfrage.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          if (
            trade.close_requested_by ===
            interaction.user.id
          ) {
            return interaction.reply({
              content:
                '❌ Du kannst deine eigene Schließungsanfrage nicht ablehnen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          const requestedByCustomer =
            trade.close_requested_by ===
            trade.customer_id;


          const requestedByTrader =
            trade.close_requested_by ===
            trade.trader_id;


          const validOtherParty =
            (
              isCustomer &&
              requestedByTrader
            ) ||
            (
              trader &&
              requestedByCustomer &&
              trade.trader_id ===
                interaction.user.id
            );


          if (!validOtherParty) {
            return interaction.reply({
              content:
                '❌ Nur die andere Partei kann diese Schließungsanfrage ablehnen.',
              flags:
                MessageFlags.Ephemeral
            });
          }


          clearCloseRequest(
            trade.thread_id
          );


          trade =
            getTradeByThreadId(
              trade.thread_id
            );


          const container =
            buildTradeContainer(
              trade
            );


          await interaction.update({
            components: [container]
          });


          await thread.send({
            content:
              `❌ <@${interaction.user.id}> hat die Schließungsanfrage abgelehnt.`
          });


          return;
        }
      }
    }


    /*
    |--------------------------------------------------------------------------
    | SELECT MENUS
    |--------------------------------------------------------------------------
    */

    if (interaction.isStringSelectMenu()) {

      /*
      |--------------------------------------------------------------------------
      | KAUFEN
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId ===
        'spawner-kaufen-select'
      ) {

        const spawnerName =
          interaction.values[0];


        const spawnerPreis =
          getSpawnerPreis(
            spawnerName
          );


        if (!spawnerPreis) {
          return interaction.reply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.',
            flags:
              MessageFlags.Ephemeral
          });
        }


        const modal =
          new ModalBuilder()
            .setCustomId(
              `spawner-kaufen-modal-${spawnerName}`
            )
            .setTitle(
              'Spawner Kaufen'
            );


        const minecraftName =
          new TextInputBuilder()
            .setCustomId(
              'minecraft-name'
            )
            .setLabel(
              'Wie lautet dein Minecraft Name?'
            )
            .setPlaceholder(
              'z.B. yayk'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        const spawnerAnzahl =
          new TextInputBuilder()
            .setCustomId(
              'spawner-anzahl'
            )
            .setLabel(
              'Wie viele Spawner möchtest du kaufen?'
            )
            .setPlaceholder(
              'z.B. 10'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              minecraftName
            ),
          new ActionRowBuilder()
            .addComponents(
              spawnerAnzahl
            )
        );


        return interaction.showModal(
          modal
        );
      }


      /*
      |--------------------------------------------------------------------------
      | VERKAUFEN
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId ===
        'spawner-verkaufen-select'
      ) {

        const spawnerName =
          interaction.values[0];


        const spawnerPreis =
          getSpawnerPreis(
            spawnerName
          );


        if (!spawnerPreis) {
          return interaction.reply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.',
            flags:
              MessageFlags.Ephemeral
          });
        }


        const modal =
          new ModalBuilder()
            .setCustomId(
              `spawner-verkaufen-modal-${spawnerName}`
            )
            .setTitle(
              'Spawner Verkaufen'
            );


        const minecraftName =
          new TextInputBuilder()
            .setCustomId(
              'minecraft-name'
            )
            .setLabel(
              'Wie lautet dein Minecraft Name?'
            )
            .setPlaceholder(
              'z.B. yayk'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        const spawnerAnzahl =
          new TextInputBuilder()
            .setCustomId(
              'spawner-anzahl'
            )
            .setLabel(
              'Wie viele Spawner möchtest du verkaufen?'
            )
            .setPlaceholder(
              'z.B. 10'
            )
            .setStyle(
              TextInputStyle.Short
            )
            .setRequired(true);


        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              minecraftName
            ),
          new ActionRowBuilder()
            .addComponents(
              spawnerAnzahl
            )
        );


        return interaction.showModal(
          modal
        );
      }
    }


    /*
    |--------------------------------------------------------------------------
    | MODALS
    |--------------------------------------------------------------------------
    */

    if (interaction.isModalSubmit()) {

      const minecraftName =
        interaction.fields.getTextInputValue(
          'minecraft-name'
        );

      const spawnerAnzahl =
        interaction.fields.getTextInputValue(
          'spawner-anzahl'
        );


      /*
      |--------------------------------------------------------------------------
      | KAUF
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId.startsWith(
          'spawner-kaufen-modal-'
        )
      ) {

        await interaction.deferReply({
          flags:
            MessageFlags.Ephemeral
        });


        const spawnerName =
          interaction.customId.replace(
            'spawner-kaufen-modal-',
            ''
          );


        const spawnerPreis =
          getSpawnerPreis(
            spawnerName
          );


        if (!spawnerPreis) {
          return interaction.editReply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.'
          });
        }


        const anzahl =
          Number(spawnerAnzahl);


        if (
          !Number.isInteger(anzahl) ||
          anzahl <= 0
        ) {
          return interaction.editReply({
            content:
              '❌ Bitte gib eine gültige Anzahl ein.'
          });
        }


        const gesamtpreis =
          spawnerPreis.kaufpreis *
          anzahl;


        const tradeNumber =
          getNextTradeNumber();


        const thread =
          await interaction.channel.threads.create({
            name:
              `🛒 ${minecraftName} - ${anzahl} ${spawnerName}`,
            type: 12,
            autoArchiveDuration: 1440,
            reason:
              'Spawner Kauf Anfrage'
          });


        await thread.members.add(
          interaction.user.id
        );


        const traderRole =
          interaction.guild.roles.cache.get(
            process.env.TRADER_ROLE_ID
          );


        if (traderRole) {

          for (
            const [memberId]
            of traderRole.members
          ) {

            try {

              await thread.members.add(
                memberId
              );

            } catch (error) {

              console.error(
                `Trader ${memberId} konnte nicht hinzugefügt werden:`,
                error
              );

            }
          }
        }


        /*
        |--------------------------------------------------------------------------
        | DATABASE
        |--------------------------------------------------------------------------
        */

        createTrade({
          tradeNumber,
          guildId:
            interaction.guildId,
          channelId:
            interaction.channelId,
          threadId:
            thread.id,
          customerId:
            interaction.user.id,
          type:
            'kaufen',
          minecraftName,
          spawnerName,
          amount:
            anzahl,
          pricePerUnit:
            spawnerPreis.kaufpreis,
          totalPrice:
            gesamtpreis
        });


        let trade =
          getTradeByThreadId(
            thread.id
          );


        /*
        |--------------------------------------------------------------------------
        | CONTAINER
        |--------------------------------------------------------------------------
        */

        const container =
          buildTradeContainer(
            trade
          );


        const message =
          await thread.send({
            components: [
              container
            ],
            flags:
              MessageFlags.IsComponentsV2
          });


        setTradeMessageId(
          thread.id,
          message.id
        );


        /*
        |--------------------------------------------------------------------------
        | EPHEMERAL
        |--------------------------------------------------------------------------
        */

        const createdContainer =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  `✅ Dein Trade Ticket wurde erstellt: ${thread}`
                )
            );


        await interaction.editReply({
          components: [
            createdContainer
          ],
          flags:
            MessageFlags.IsComponentsV2
        });


        return;
      }


      /*
      |--------------------------------------------------------------------------
      | VERKAUF
      |--------------------------------------------------------------------------
      */

      if (
        interaction.customId.startsWith(
          'spawner-verkaufen-modal-'
        )
      ) {

        await interaction.deferReply({
          flags:
            MessageFlags.Ephemeral
        });


        const spawnerName =
          interaction.customId.replace(
            'spawner-verkaufen-modal-',
            ''
          );


        const spawnerPreis =
          getSpawnerPreis(
            spawnerName
          );


        if (!spawnerPreis) {
          return interaction.editReply({
            content:
              '❌ Dieser Spawner existiert nicht mehr.'
          });
        }


        const anzahl =
          Number(spawnerAnzahl);


        if (
          !Number.isInteger(anzahl) ||
          anzahl <= 0
        ) {
          return interaction.editReply({
            content:
              '❌ Bitte gib eine gültige Anzahl ein.'
          });
        }


        const gesamtpreis =
          spawnerPreis.verkaufspreis *
          anzahl;


        const tradeNumber =
          getNextTradeNumber();


        const thread =
          await interaction.channel.threads.create({
            name:
              `💰 ${minecraftName} - ${anzahl} ${spawnerName}`,
            type: 12,
            autoArchiveDuration: 1440,
            reason:
              'Spawner Verkauf Anfrage'
          });


        await thread.members.add(
          interaction.user.id
        );


        const traderRole =
          interaction.guild.roles.cache.get(
            process.env.TRADER_ROLE_ID
          );


        if (traderRole) {

          for (
            const [memberId]
            of traderRole.members
          ) {

            try {

              await thread.members.add(
                memberId
              );

            } catch (error) {

              console.error(
                `Trader ${memberId} konnte nicht hinzugefügt werden:`,
                error
              );

            }
          }
        }


        /*
        |--------------------------------------------------------------------------
        | DATABASE
        |--------------------------------------------------------------------------
        */

        createTrade({
          tradeNumber,
          guildId:
            interaction.guildId,
          channelId:
            interaction.channelId,
          threadId:
            thread.id,
          customerId:
            interaction.user.id,
          type:
            'verkaufen',
          minecraftName,
          spawnerName,
          amount:
            anzahl,
          pricePerUnit:
            spawnerPreis.verkaufspreis,
          totalPrice:
            gesamtpreis
        });


        const trade =
          getTradeByThreadId(
            thread.id
          );


        /*
        |--------------------------------------------------------------------------
        | CONTAINER
        |--------------------------------------------------------------------------
        */

        const container =
          buildTradeContainer(
            trade
          );


        const message =
          await thread.send({
            components: [
              container
            ],
            flags:
              MessageFlags.IsComponentsV2
          });


        setTradeMessageId(
          thread.id,
          message.id
        );


        /*
        |--------------------------------------------------------------------------
        | EPHEMERAL
        |--------------------------------------------------------------------------
        */

        const createdContainer =
          new ContainerBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder()
                .setContent(
                  `✅ Dein Trade Ticket wurde erstellt: ${thread}`
                )
            );


        await interaction.editReply({
          components: [
            createdContainer
          ],
          flags:
            MessageFlags.IsComponentsV2
        });


        return;
      }
    }

  } catch (error) {

    console.error(
      'Fehler bei interactionCreate:',
      error
    );


    if (!interaction.replied &&
        !interaction.deferred) {

      try {

        await interaction.reply({
          content:
            '❌ Es ist ein unerwarteter Fehler aufgetreten.',
          flags:
            MessageFlags.Ephemeral
        });

      } catch (replyError) {

        console.error(
          'Fehler beim Senden der Fehlermeldung:',
          replyError
        );

      }
    }
  }
});


/*
|--------------------------------------------------------------------------
| READY
|--------------------------------------------------------------------------
*/

client.once('ready', () => {

  console.log(
    `✅ ${client.user.tag} ist online!`
  );

});


/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

client.login(
  process.env.DISCORD_BOT_TOKEN
);
