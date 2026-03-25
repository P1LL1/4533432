import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getGenStats } from "../db.js";

export const data = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("View generation statistics");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const stats = await getGenStats();

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📊 Gen Statistics")
    .addFields(
      {
        name: "🔢 Total Gens (All Time)",
        value: `\`${stats.totalAllTime.toLocaleString()}\``,
        inline: true,
      },
      {
        name: "📅 Gens Today",
        value: `\`${stats.totalToday.toLocaleString()}\``,
        inline: true,
      },
      {
        name: "🏆 Most Popular Service",
        value: stats.topService
          ? `**${stats.topService}** — \`${stats.topServiceCount}\` gens`
          : "*No data yet*",
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
