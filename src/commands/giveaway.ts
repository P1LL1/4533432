import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  TextChannel,
  ButtonInteraction,
} from "discord.js";
import {
  createGiveaway,
  setGiveawayMessageId,
  getActiveGiveaways,
  getGiveaway,
  markGiveawayEnded,
  toggleGiveawayEntry,
  getGiveawayEntries,
  Giveaway,
} from "../db.js";

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function buildGiveawayEmbed(giveaway: Giveaway, entryCount: number): EmbedBuilder {
  const endUnix = Math.floor(new Date(giveaway.end_time).getTime() / 1000);
  return new EmbedBuilder()
    .setColor(0xff6b6b)
    .setTitle("🎉 GIVEAWAY")
    .setDescription(
      `**${giveaway.prize}**\n\nClick the button below to enter!\n\n` +
      `⏰ Ends: <t:${endUnix}:R> (<t:${endUnix}:f>)\n` +
      `🏆 Winners: **${giveaway.winner_count}**\n` +
      `🎟️ Entries: **${entryCount}**`
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
    .setTimestamp(new Date(giveaway.end_time));
}

function buildEntryButton(giveawayId: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_enter_${giveawayId}`)
      .setLabel("🎉 Enter Giveaway")
      .setStyle(ButtonStyle.Primary)
  );
}

export async function endGiveaway(client: Client, giveawayId: number): Promise<void> {
  const giveaway = await getGiveaway(giveawayId);
  if (!giveaway || giveaway.ended) return;

  await markGiveawayEnded(giveawayId);
  timers.delete(giveawayId);

  const entries = await getGiveawayEntries(giveawayId);
  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null) as TextChannel | null;
  if (!channel) return;

  const winnerIds: string[] = [];
  const pool = [...entries];
  const count = Math.min(giveaway.winner_count, pool.length);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winnerIds.push(pool.splice(idx, 1)[0]!);
  }

  const endedEmbed = new EmbedBuilder()
    .setColor(entries.length === 0 ? 0x808080 : 0x57f287)
    .setTitle("🎉 GIVEAWAY ENDED")
    .setDescription(
      entries.length === 0
        ? `**${giveaway.prize}**\n\nNo one entered — no winners.`
        : `**${giveaway.prize}**\n\n🏆 Winner${winnerIds.length !== 1 ? "s" : ""}: ${winnerIds.map((id) => `<@${id}>`).join(", ")}\n🎟️ Total Entries: **${entries.length}**`
    )
    .setFooter({ text: `Giveaway ID: ${giveaway.id}` })
    .setTimestamp();

  if (giveaway.message_id) {
    const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
    }
  }

  if (winnerIds.length > 0) {
    await channel.send({
      content: `🎉 Congratulations ${winnerIds.map((id) => `<@${id}>`).join(", ")}! You won **${giveaway.prize}**!`,
    });
  } else {
    await channel.send({ content: `❌ No winners for **${giveaway.prize}** — nobody entered.` });
  }
}

export async function handleGiveawayEntry(interaction: ButtonInteraction, client: Client): Promise<void> {
  const giveawayId = parseInt(interaction.customId.replace("giveaway_enter_", ""), 10);
  const giveaway = await getGiveaway(giveawayId);

  if (!giveaway || giveaway.ended) {
    await interaction.reply({ content: "❌ This giveaway has already ended.", flags: 64 });
    return;
  }

  const action = await toggleGiveawayEntry(giveawayId, interaction.user.id);
  const entries = await getGiveawayEntries(giveawayId);
  const updatedEmbed = buildGiveawayEmbed(giveaway, entries.length);

  await interaction.update({
    embeds: [updatedEmbed],
    components: [buildEntryButton(giveawayId)],
  });

  await interaction.followUp({
    content: action === "entered"
      ? "✅ You've entered the giveaway! Good luck! 🍀"
      : "❌ You've left the giveaway.",
    flags: 64,
  });
}

export async function restoreGiveaways(client: Client): Promise<void> {
  const active = await getActiveGiveaways().catch(() => []);
  for (const giveaway of active) {
    const msLeft = new Date(giveaway.end_time).getTime() - Date.now();
    if (msLeft <= 0) {
      await endGiveaway(client, giveaway.id);
    } else {
      const timer = setTimeout(() => endGiveaway(client, giveaway.id), msLeft);
      timers.set(giveaway.id, timer);
    }
  }
}

export const data = new SlashCommandBuilder()
  .setName("giveaway")
  .setDescription("Manage giveaways (admin only)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("start")
      .setDescription("Start a new giveaway in this channel")
      .addStringOption((o) =>
        o.setName("prize").setDescription("What are you giving away?").setRequired(true)
      )
      .addIntegerOption((o) =>
        o
          .setName("duration")
          .setDescription("Duration in minutes")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(10080)
      )
      .addIntegerOption((o) =>
        o
          .setName("winners")
          .setDescription("Number of winners (default 1)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(20)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("end")
      .setDescription("End a giveaway early and pick winners")
      .addIntegerOption((o) =>
        o.setName("id").setDescription("Giveaway ID (shown in the embed footer)").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("reroll")
      .setDescription("Reroll a new winner for an ended giveaway")
      .addIntegerOption((o) =>
        o.setName("id").setDescription("Giveaway ID").setRequired(true)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "start") {
    const prize = interaction.options.getString("prize", true);
    const durationMins = interaction.options.getInteger("duration", true);
    const winners = interaction.options.getInteger("winners") ?? 1;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "❌ This command must be used in a server.", flags: 64 });
      return;
    }

    const endTime = new Date(Date.now() + durationMins * 60 * 1000);
    const giveaway = await createGiveaway(
      interaction.channelId,
      guild.id,
      prize,
      endTime,
      winners,
      interaction.user.id
    );

    const embed = buildGiveawayEmbed(giveaway, 0);
    const row = buildEntryButton(giveaway.id);

    await interaction.reply({ embeds: [embed], components: [row] });
    const msg = await interaction.fetchReply();
    await setGiveawayMessageId(giveaway.id, msg.id);

    const timer = setTimeout(() => endGiveaway(interaction.client, giveaway.id), durationMins * 60 * 1000);
    timers.set(giveaway.id, timer);
    return;
  }

  if (sub === "end") {
    const id = interaction.options.getInteger("id", true);
    const giveaway = await getGiveaway(id);
    if (!giveaway) {
      await interaction.reply({ content: `❌ Giveaway #${id} not found.`, flags: 64 });
      return;
    }
    if (giveaway.ended) {
      await interaction.reply({ content: `❌ Giveaway #${id} has already ended.`, flags: 64 });
      return;
    }
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    await interaction.reply({ content: `⏩ Ending giveaway #${id} now…`, flags: 64 });
    await endGiveaway(interaction.client, id);
    return;
  }

  if (sub === "reroll") {
    const id = interaction.options.getInteger("id", true);
    const giveaway = await getGiveaway(id);
    if (!giveaway || !giveaway.ended) {
      await interaction.reply({ content: `❌ Giveaway #${id} not found or hasn't ended yet.`, flags: 64 });
      return;
    }
    const entries = await getGiveawayEntries(id);
    if (entries.length === 0) {
      await interaction.reply({ content: "❌ No entries to reroll from.", flags: 64 });
      return;
    }
    const winnerId = entries[Math.floor(Math.random() * entries.length)]!;
    await interaction.reply({
      content: `🎲 Reroll! The new winner is <@${winnerId}>! Congratulations on winning **${giveaway.prize}**!`,
    });
  }
}
