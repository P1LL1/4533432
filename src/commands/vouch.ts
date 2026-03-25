import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { saveVouch } from "../db.js";
import { getAllowedChannels } from "../channelGuard.js";

const STARS_FILLED = "⭐";
const STARS_EMPTY = "☆";

function starBar(stars: number): string {
  return STARS_FILLED.repeat(stars) + STARS_EMPTY.repeat(5 - stars);
}

const STAR_COLOR: Record<number, number> = {
  1: 0xe04245,
  2: 0xee7e32,
  3: 0xfec75c,
  4: 0x91ff81,
  5: 0x00b06b,
};

export const data = new SlashCommandBuilder()
  .setName("vouch")
  .setDescription("Leave a vouch for a service with screenshot proof")
  .addStringOption((option) =>
    option
      .setName("service")
      .setDescription("The service you are vouching for")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addIntegerOption((option) =>
    option
      .setName("stars")
      .setDescription("Your rating (1 = bad, 5 = excellent)")
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(5)
      .addChoices(
        { name: "⭐ 1 - Poor", value: 1 },
        { name: "⭐⭐ 2 - Below Average", value: 2 },
        { name: "⭐⭐⭐ 3 - Average", value: 3 },
        { name: "⭐⭐⭐⭐ 4 - Good", value: 4 },
        { name: "⭐⭐⭐⭐⭐ 5 - Excellent", value: 5 }
      )
  )
  .addAttachmentOption((option) =>
    option
      .setName("proof")
      .setDescription("Screenshot proof (image required)")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("comment")
      .setDescription("Optional comment about the service")
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const vouchChannelIds = getAllowedChannels("VOUCH_CHANNEL_ID");

  const stars = interaction.options.getInteger("stars", true);
  const serviceName = interaction.options.getString("service", true);
  const proof = interaction.options.getAttachment("proof", true);
  const comment = interaction.options.getString("comment");

  const isImage = proof.contentType?.startsWith("image/");
  if (!isImage) {
    await interaction.reply({
      content: "❌ Please upload a valid image file (PNG, JPG, or WEBP) as proof.",
      flags: 64,
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  try {
    await saveVouch(
      interaction.user.id,
      interaction.user.tag,
      serviceName,
      stars,
      proof.url,
      comment
    );

    const embed = new EmbedBuilder()
      .setColor(STAR_COLOR[stars] ?? 0x5865f2)
      .setTitle(`${starBar(stars)} (${stars}/5) Vouch!`)
      .setAuthor({
        name: interaction.user.displayName,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .addFields(
        { name: "Service", value: serviceName, inline: true },
        { name: "Rating", value: `${starBar(stars)} (\`${stars}/5\`)`, inline: true }
      )
      .setImage(proof.url)
      .setTimestamp();

    if (comment) {
      embed.addFields({ name: "Comment", value: comment });
    }

    let posted = 0;
    for (const channelId of vouchChannelIds) {
      const channel = (await interaction.client.channels
        .fetch(channelId)
        .catch(() => null)) as TextChannel | null;
      if (channel) {
        await channel.send({ embeds: [embed] });
        posted++;
      }
    }

    if (posted > 0) {
      await interaction.editReply({ content: "✅ Your vouch has been posted!" });
    } else {
      await interaction.editReply({
        content: "❌ Vouch channel not found. Check the VOUCH_CHANNEL_ID config.",
      });
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply({
      content: "❌ An error occurred while saving your vouch.",
    });
  }
}
