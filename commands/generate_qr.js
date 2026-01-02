// commands/generate_qr.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const QRCode = require('qrcode');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('generate')
    .setDescription('Generate a QR code for the given text or URL')
    .addStringOption(option =>
      option
        .setName('input')
        .setDescription('Enter text or URL to encode')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply(); // allows async processing

      const input = interaction.options.getString('input', true);

      // Generate QR Code as a PNG buffer
      const qrBuffer = await QRCode.toBuffer(input, {
        type: 'png',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',   // QR color
          light: '#FFFFFF'   // background color
        }
      });

      const attachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode.png' });

      // Reply with QR code image
      await interaction.editReply({
        content: `✅ QR for: **${input}**`,
        files: [attachment],
      });
    } catch (error) {
      console.error('QR generation error:', error);
      try {
        await interaction.editReply({
          content: '❌ Failed to generate QR code. Please try again later.',
          ephemeral: true,
        });
      } catch (e) { /* ignore reply errors */ }
    }
  },
};
