import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  User,
} from "discord.js";
import { getUserProfile } from "../db.js";

const STAR = "⭐";
const FILLED = "█";
const EMPTY = "░";
const BAR_LEN = 8;

function starBar(count: number, max: number): string {
  if (max === 0) return EMPTY.repeat(BAR_LEN);
  const filled = max > 0 ? Math.round((count / max) * BAR_LEN) : 0;
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_LEN - filled);
}

function ratingColor(avg: number | null): number {
  if (avg === null) return 0x99aab5;
  if (avg >= 4.5) return 0x00b06b;
  if (avg >= 3.5) return 0x57f287;
  if (avg >= 2.5) return 0xfee75c;
  if (avg >= 1.5) return 0xe67e22;
  return 0xed4245;
}

function ratingLabel(avg: number | null): string {
  if (avg === null) return "No vouches yet";
  if (avg >= 4.5) return "Excellent ✨";
  if (avg >= 3.5) return "Good 👍";
  if (avg >= 2.5) return "Average 😐";
  if (avg >= 1.5) return "Below Average 👎";
  return "Poor ⚠️";
}

function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:D>`;
}

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("View a user's COZZZY GEN profile and vouch stats")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("The user to look up (leave blank to see your own)")
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const targetUser: User =
    interaction.options.getUser("user") ?? interaction.user;
  const isSelf = targetUser.id === interaction.user.id;

  const profile = await getUserProfile(targetUser.id);

  if (!profile) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x99aab5)
          .setTitle(`${targetUser.displayName}'s Profile`)
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
          .setDescription(
            isSelf
              ? "You haven't submitted any vouches or generated any items yet.\nUse `/fgen`, `/bgen`, or `/xgen` to get started!"
              : `**${targetUser.displayName}** has no activity on this server yet.`
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  const avg = profile.averageStars;
  const color = ratingColor(avg);
  const label = ratingLabel(avg);

  const maxBreakdown = Math.max(...Object.values(profile.starBreakdown), 1);
  const breakdownLines = ([5, 4, 3, 2, 1] as const).map((s) => {
    const n = profile.starBreakdown[s];
    const bar = starBar(n, maxBreakdown);
    return `${STAR.repeat(s).padEnd(5)} \`${bar}\` ${n}`;
  });

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${targetUser.displayName}'s Profile`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setDescription(
      avg !== null
        ? `**Overall Rating: ${avg.toFixed(2)}/5.00** — ${label}`
        : `*${label}*`
    );

  embed.addFields(
    {
      name: "📊 Vouch Breakdown",
      value:
        profile.totalVouches > 0
          ? breakdownLines.join("\n")
          : "*No vouches submitted yet*",
      inline: false,
    },
    {
      name: "📝 Total Vouches",
      value: `\`${profile.totalVouches}\``,
      inline: true,
    },
    {
      name: "🎁 Items Generated",
      value: `\`${profile.totalGens}\``,
      inline: true,
    },
    {
      name: "🏆 Most Vouched Service",
      value: profile.topService ? `**${profile.topService}**` : "*None*",
      inline: true,
    },
    {
      name: "📅 First Activity",
      value: formatDate(profile.firstActivity),
      inline: true,
    },
    {
      name: "\u200b",
      value: "\u200b",
      inline: true,
    },
    {
      name: "\u200b",
      value: "\u200b",
      inline: true,
    }
  );

  if (profile.recentVouches.length > 0) {
    const recent = profile.recentVouches
      .map((v) => {
        const stars = STAR.repeat(v.stars);
        const comment = v.comment
          ? ` — *"${v.comment.slice(0, 60)}${v.comment.length > 60 ? "…" : ""}"*`
          : "";
        return `${stars} **${v.service_name}**${comment}`;
      })
      .join("\n");

    embed.addFields({
      name: "💬 Recent Vouches",
      value: recent,
      inline: false,
    });
  }

  embed
    .setFooter({
      text: isSelf ? "This is your profile" : `Requested by ${interaction.user.displayName}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
