import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AutocompleteInteraction,
} from "discord.js";
import {
  getShopItems,
  addShopItem,
  removeShopItem,
  searchShopItems,
  getShopItemByName,
} from "../db.js";
import { isOwner } from "../constants.js";

export const data = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("View or manage the COZZZY GEN shop")
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("Browse all available items in the shop")
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a new item to the shop (admin only)")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Product or service name")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("price")
          .setDescription('Price label (e.g. "$5", "10 USD", "DM for price")')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Short description of the item (optional)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove an item from the shop (admin only)")
      .addStringOption((opt) =>
        opt
          .setName("item")
          .setDescription("The shop item to remove")
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

export async function handleAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const focused = interaction.options.getFocused();
  const items = await searchShopItems(focused);
  await interaction.respond(
    items.map((i) => ({ name: `${i.name} — ${i.price}`, value: i.name }))
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === "view") {
    await handleView(interaction);
  } else if (sub === "add") {
    await handleAdd(interaction);
  } else if (sub === "remove") {
    await handleRemove(interaction);
  }
}

const SHOP_CHANNEL_ID = process.env.SHOP_CHANNEL_ID ?? "1483386556285714555";

async function handleView(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const owner = isOwner(interaction.user.id);

  if (!owner && interaction.channelId !== SHOP_CHANNEL_ID) {
    await interaction.reply({
      content: `❌ This command can only be used in <#${SHOP_CHANNEL_ID}>.`,
      flags: 64,
    });
    return;
  }

  await interaction.deferReply();

  const items = await getShopItems();

  if (items.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🛒 COZZZY GEN Shop")
          .setDescription(
            "The shop is currently empty.\nCheck back later or contact an admin."
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  const TIER_EMOJIS = ["🥇", "🥈", "🥉"];
  const itemLines = items.map((item, i) => {
    const emoji = TIER_EMOJIS[i] ?? "🔹";
    const desc = item.description
      ? `\n> ${item.description}`
      : "";
    return `${emoji} **${item.name}** — \`${item.price}\`${desc}`;
  });

  const chunkSize = 10;
  const embeds: EmbedBuilder[] = [];

  for (let i = 0; i < itemLines.length; i += chunkSize) {
    const chunk = itemLines.slice(i, i + chunkSize);
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setDescription(chunk.join("\n\n"))
      .setTimestamp();

    if (i === 0) {
      embed
        .setTitle("🛒 COZZZY GEN Shop")
        .setDescription(
          `Browse our available products and services below.\nTo purchase, open a support ticket.\n\n${chunk.join("\n\n")}`
        )
        .setFooter({ text: `${items.length} item${items.length !== 1 ? "s" : ""} available` });
    } else {
      embed
        .setTitle(`🛒 Shop (continued)`)
        .setDescription(chunk.join("\n\n"));
    }

    embeds.push(embed);
  }

  await interaction.editReply({ embeds: [embeds[0]!] });
  for (let i = 1; i < embeds.length; i++) {
    await interaction.followUp({ embeds: [embeds[i]!] });
  }
}

async function handleAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isOwner(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ Only admins can add items to the shop.",
      flags: 64,
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const name = interaction.options.getString("name", true).trim();
  const price = interaction.options.getString("price", true).trim();
  const description = interaction.options.getString("description")?.trim() ?? null;

  const existing = await getShopItemByName(name);
  if (existing) {
    await interaction.editReply(
      `❌ **${name}** is already in the shop. Remove it first if you want to update it.`
    );
    return;
  }

  const item = await addShopItem(name, price, description, interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("✅ Shop Item Added")
    .addFields(
      { name: "Item", value: item.name, inline: true },
      { name: "Price", value: `\`${item.price}\``, inline: true }
    );

  if (item.description) {
    embed.addFields({ name: "Description", value: item.description });
  }

  embed
    .addFields({ name: "Added by", value: `${interaction.user}`, inline: true })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isOwner(interaction.user.id) && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ Only admins can remove items from the shop.",
      flags: 64,
    });
    return;
  }

  await interaction.deferReply({ flags: 64 });

  const itemName = interaction.options.getString("item", true);
  const item = await getShopItemByName(itemName);

  if (!item) {
    await interaction.editReply(
      `❌ **${itemName}** was not found in the shop.`
    );
    return;
  }

  await removeShopItem(item.id);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🗑️ Shop Item Removed")
        .addFields(
          { name: "Item", value: item.name, inline: true },
          { name: "Price was", value: `\`${item.price}\``, inline: true },
          { name: "Removed by", value: `${interaction.user}`, inline: true }
        )
        .setTimestamp(),
    ],
  });
}
