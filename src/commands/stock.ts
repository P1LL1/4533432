import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getAllStockCounts, getServiceByName, getServiceStockCounts, ServiceTier } from "../db.js";
import { getGlobalCooldownMinutes } from "../cooldown.js";

const LOW_STOCK = parseInt(process.env.LOW_STOCK_THRESHOLD ?? "5", 10);

const TIER_LABEL: Record<ServiceTier, string> = {
  free:      "🆓 Free",
  basic:     "💎 Basic",
  exclusive: "👑 Exclusive",
};

const TIER_COLOR: Record<ServiceTier, number> = {
  free:      0x57f287,
  basic:     0x5865f2,
  exclusive: 0xfee75c,
};

function progressBar(available: number, total: number, length = 12): string {
  if (total === 0) return "░".repeat(length);
  const filled = Math.round((available / total) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

export const data = new SlashCommandBuilder()
  .setName("stock")
  .setDescription("View current stock")
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("View stock for a specific service (leave blank for all)")
      .setRequired(false)
      .setAutocomplete(true)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const serviceName = interaction.options.getString("service");

  if (serviceName) {
    const service = await getServiceByName(serviceName);
    if (!service) {
      await interaction.editReply(`❌ Service **${serviceName}** not found.`);
      return;
    }

    const { available, total } = await getServiceStockCounts(service.id);
    const bar = progressBar(available, total);
    const used = total - available;
    const statusEmoji = available === 0 ? "🔴" : available <= LOW_STOCK ? "🟡" : "🟢";
    const typeLabel = TIER_LABEL[service.tier] ?? `${service.tier}`;

    const cooldownMins = service.cooldown_minutes ?? getGlobalCooldownMinutes();
    const cooldownText = cooldownMins === 0 ? "None" : `${cooldownMins}m${service.cooldown_minutes !== null ? " (custom)" : " (global)"}`;
    const capText = service.daily_cap !== null ? `${service.daily_cap}/day` : "Unlimited";

    const embed = new EmbedBuilder()
      .setColor(available === 0 ? 0xed4245 : available <= LOW_STOCK ? 0xfee75c : (TIER_COLOR[service.tier] ?? 0x5865f2))
      .setTitle(`📦 Stock — ${service.name}`)
      .addFields(
        { name: "Tier", value: typeLabel, inline: true },
        { name: "Status", value: `${statusEmoji} ${available > 0 ? "In Stock" : "Out of Stock"}`, inline: true },
        { name: "Cooldown", value: cooldownText, inline: true },
        { name: "Daily Cap", value: capText, inline: true },
        {
          name: "Availability",
          value: `\`${bar}\` **${available}** available / ${total} total (${used} used)`,
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const stocks = await getAllStockCounts();

  if (stocks.length === 0) {
    await interaction.editReply("📦 No services have been added yet.");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📦 Current Stock")
    .setTimestamp();

  const tierGroups: Record<ServiceTier, string[]> = { free: [], basic: [], exclusive: [] };

  for (const { service, available, total } of stocks) {
    const bar = progressBar(available, total);
    const statusEmoji = available === 0 ? "🔴" : available <= LOW_STOCK ? "🟡" : "🟢";
    const line = `${statusEmoji} **${service.name}**\n\`${bar}\` ${available}/${total}`;
    const tier = service.tier ?? "free";
    if (tierGroups[tier]) tierGroups[tier].push(line);
  }

  const sections: Array<{ tier: ServiceTier; header: string }> = [
    { tier: "free",      header: "🆓 Free" },
    { tier: "basic",     header: "💎 Basic" },
    { tier: "exclusive", header: "👑 Exclusive" },
  ];

  for (const { tier, header } of sections) {
    const lines = tierGroups[tier];
    if (lines && lines.length > 0) {
      embed.addFields({ name: header, value: lines.join("\n\n") });
    }
  }

  await interaction.editReply({ embeds: [embed] });
}
