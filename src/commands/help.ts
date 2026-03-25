import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getGlobalCooldownMinutes } from "../cooldown.js";
import { allowedChannelMentions } from "../channelGuard.js";
import { isOwner } from "../constants.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available bot commands");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const freeChannel  = allowedChannelMentions("FREE_GEN_CHANNEL_ID");
  const basicChannel = allowedChannelMentions("BASIC_GEN_CHANNEL_ID");
  const xclChannel   = allowedChannelMentions("EXCLUSIVE_GEN_CHANNEL_ID");
  const cooldownMins = getGlobalCooldownMinutes();
  const cooldownText = cooldownMins === 0 ? "No cooldown" : `**${cooldownMins}m** (global default)`;
  const isAdmin      = isOwner(interaction.user.id) || (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 COZZZY GEN — Commands")
    .addFields(
      {
        name: "🎁 Generation",
        value:
          `🆓 \`/fgen [service]\` — Free account gen. Cooldown: ${cooldownText} · ${freeChannel}\n` +
          `💎 \`/bgen [service]\` — Basic account gen. Cooldown: ${cooldownText} · ${basicChannel}\n` +
          `👑 \`/xgen [service]\` — Exclusive account gen. Cooldown: ${cooldownText} · ${xclChannel}`,
      },
      {
        name: "📦 Stock & Shop",
        value:
          "`/stock [service]` — View stock levels, cooldowns & daily caps\n" +
          "`/shop view` — Browse items available to purchase",
      },
      {
        name: "✅ Vouching & Profiles",
        value:
          "`/vouch <stars> <service> <proof>` — Leave a star rating + screenshot\n" +
          "`/profile [user]` — View your (or someone else's) vouch stats and activity",
      },
      {
        name: "🎉 Giveaways",
        value:
          "Active giveaways are announced in the server.\nClick the **🎉 Enter Giveaway** button on the giveaway post to join.\nWinners are picked automatically when the giveaway ends.",
      },
      {
        name: "🎫 Support",
        value:
          "Click the **📩 Create Ticket** button in the ticket channel to open a private support ticket.\nAn admin will assist you shortly.",
      },
      {
        name: "📊 Other",
        value:
          "`/stats` — View total gens, gens today & most popular service\n" +
          "`/leaderboard` — See the top 10 most active generators\n" +
          "`/help` — Show this message",
      }
    )
    .setFooter({ text: "COZZZY GEN" })
    .setTimestamp();

  if (isAdmin) {
    embed.addFields({
      name: "─────── Admin Only ───────",
      value:
        "**Services & Stock**\n" +
        "`/addservice` — Add a service (free, basic, or exclusive)\n" +
        "`/addstock` — Add a single stock item\n" +
        "`/bulkstock` — Add many items at once via a form\n" +
        "`/removeservice` — Remove a service and all its stock\n" +
        "\n**Shop**\n" +
        "`/shop add <name> <price> [description]` — Add an item to the shop\n" +
        "`/shop remove <item>` — Remove a shop item\n" +
        "`/shop view` — Browse the shop (use in the designated shop channel)\n" +
        "\n**Users & Cooldowns**\n" +
        "`/resetcooldown <user>` — Reset a user's gen cooldowns\n" +
        "`/setcooldown <service> <minutes>` — Set per-service cooldown (0 = global default)\n" +
        "`/setcap <service> <cap>` — Set daily gen cap per user (0 = unlimited, admins exempt)\n" +
        "`/ban <user> [reason] [delete_days]` — Ban a user\n" +
        "\n**Giveaways**\n" +
        "`/giveaway start <prize> <duration> [winners]` — Start a giveaway\n" +
        "`/giveaway end <id>` — End a giveaway early\n" +
        "`/giveaway reroll <id>` — Reroll a new winner\n" +
        "\n**Tickets**\n" +
        "`/ticket setup` — Send the ticket panel in this channel",
    });
  }

  await interaction.reply({ embeds: [embed], flags: 64 });
}
