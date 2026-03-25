import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import {
  getServices,
  getServiceByName,
  claimStockItem,
  unclaimStockItem,
  logGen,
  getServiceStockCounts,
  getDailyUsage,
  incrementDailyUsage,
  Service,
} from "../db.js";
import { sendGenDM } from "../dmGen.js";
import { getRemainingMs, setCooldown, formatTime } from "../cooldown.js";
import { isAllowedChannel, allowedChannelMentions } from "../channelGuard.js";
import { isOwner } from "../constants.js";

const LOW_STOCK = parseInt(process.env.LOW_STOCK_THRESHOLD ?? "5", 10);

export const data = new SlashCommandBuilder()
  .setName("xgen")
  .setDescription("Generate an exclusive item from stock")
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("The service to generate from (leave blank for random)")
      .setRequired(false)
      .setAutocomplete(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isOwner(interaction.user.id) && !isAllowedChannel(interaction.channelId, "EXCLUSIVE_GEN_CHANNEL_ID")) {
    await interaction.reply({
      content: `❌ This command can only be used in ${allowedChannelMentions("EXCLUSIVE_GEN_CHANNEL_ID")}.`,
      flags: 64,
    });
    return;
  }

  const serviceName = interaction.options.getString("service");
  let service: Service;

  if (serviceName) {
    const found = await getServiceByName(serviceName);
    if (!found) {
      await interaction.reply({
        content: `❌ Service **${serviceName}** not found. Use \`/stock\` to see available services.`,
        flags: 64,
      });
      return;
    }
    if (found.tier !== "exclusive") {
      await interaction.reply({
        content: `❌ **${found.name}** is not an exclusive service. Try \`/fgen\` or \`/bgen\` instead.`,
        flags: 64,
      });
      return;
    }
    service = found;
  } else {
    const exclusiveServices = await getServices("exclusive");
    if (exclusiveServices.length === 0) {
      await interaction.reply({ content: "❌ No exclusive services are available.", flags: 64 });
      return;
    }
    service = exclusiveServices[Math.floor(Math.random() * exclusiveServices.length)]!;
  }

  const remaining = getRemainingMs(interaction.user.id, service.name, service.cooldown_minutes);
  if (remaining > 0) {
    await interaction.reply({
      content: `⏳ You're on cooldown for **${service.name}**! Try again in **${formatTime(remaining)}**.`,
      flags: 64,
    });
    return;
  }

  const isAdmin = isOwner(interaction.user.id) || (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false);
  if (!isAdmin && service.daily_cap !== null) {
    const usage = await getDailyUsage(interaction.user.id, service.id);
    if (usage >= service.daily_cap) {
      await interaction.reply({
        content: `❌ You've reached the daily limit of **${service.daily_cap}** gen${service.daily_cap !== 1 ? "s" : ""} for **${service.name}** today. Come back tomorrow!`,
        flags: 64,
      });
      return;
    }
  }

  await interaction.deferReply();

  const item = await claimStockItem(service.id);
  if (!item) {
    await interaction.editReply(`❌ **${service.name}** is out of stock. Try again later.`);
    return;
  }

  const dmSent = await sendGenDM(interaction.user, service.name, item, "exclusive");

  if (!dmSent) {
    await unclaimStockItem(item.id).catch(() => {});
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle("❌ Couldn't Send DM")
          .setDescription(
            `${interaction.user}, I couldn't send you a DM.\nPlease enable DMs from server members and try again.\nYour stock item has been returned to the pool.`
          )
          .setFooter({ text: "Settings → Privacy & Safety → Allow DMs" })
          .setTimestamp(),
      ],
    });
    return;
  }

  setCooldown(interaction.user.id, service.name);
  await incrementDailyUsage(interaction.user.id, service.id).catch(() => {});
  await logGen(interaction.user.id, interaction.user.tag, service.name).catch(() => {});

  const { available } = await getServiceStockCounts(service.id);

  if (process.env.GEN_LOG_CHANNEL_ID) {
    try {
      const ch = await interaction.client.channels.fetch(process.env.GEN_LOG_CHANNEL_ID) as TextChannel;
      await ch.send({
        embeds: [
          new EmbedBuilder().setColor(0xfee75c).setTitle("📋 Exclusive Gen")
            .addFields(
              { name: "User", value: `${interaction.user} (${interaction.user.tag})`, inline: true },
              { name: "Service", value: service.name, inline: true },
              { name: "Stock Left", value: `${available}`, inline: true }
            ).setTimestamp(),
        ],
      });
    } catch {}
  }

  if (available <= LOW_STOCK && process.env.LOW_STOCK_ALERT_CHANNEL_ID) {
    try {
      const ch = await interaction.client.channels.fetch(process.env.LOW_STOCK_ALERT_CHANNEL_ID) as TextChannel;
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(available === 0 ? 0xed4245 : 0xfee75c)
            .setTitle(available === 0 ? "🔴 Out of Stock" : "⚠️ Low Stock Alert")
            .setDescription(
              available === 0
                ? `**${service.name}** is now out of stock!`
                : `**${service.name}** is running low — only **${available}** item${available !== 1 ? "s" : ""} left!`
            ).setTimestamp(),
        ],
      });
    } catch {}
  }

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("👑 Exclusive Gen Delivered")
        .setDescription(`${interaction.user} just generated a **${service.name}** account.`)
        .addFields({ name: "📬 Check Your DMs", value: "Your credentials have been sent privately — check your DMs!" })
        .setFooter({ text: "Keep your credentials safe — never share them." })
        .setTimestamp(),
    ],
  });
}
