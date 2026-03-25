import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { getLeaderboard } from "../db.js";

const RANK_EMOJIS = ["🥇", "🥈", "🥉"];

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("See the top 10 most active generators on COZZZY GEN");

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const entries = await getLeaderboard();

  if (entries.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🏆 Gen Leaderboard")
          .setDescription("No generations recorded yet. Be the first to use `/fgen`, `/bgen`, or `/xgen`!")
          .setTimestamp(),
      ],
    });
    return;
  }

  const lines = entries.map((entry) => {
    const medal = RANK_EMOJIS[entry.rank - 1] ?? `**#${entry.rank}**`;
    return `${medal} <@${entry.user_id}> — **${entry.total_gens.toLocaleString()}** gen${entry.total_gens !== 1 ? "s" : ""}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle("🏆 Gen Leaderboard")
    .setDescription(
      `**Top ${entries.length} most active generator${entries.length !== 1 ? "s" : ""}:**\n\n` +
      lines.join("\n")
    )
    .setFooter({ text: "Based on total all-time generations" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
