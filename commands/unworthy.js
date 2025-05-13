const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unworthy')
        .setDescription('Kick users and send them a rejection message')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for rejection (optional)'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        require('dotenv').config();
        const reason = interaction.options.getString('reason') || 
            `Sorry, you currently don't seem like a great fit for ${interaction.guild.name}.`;
        // Fetch all members to ensure the cache is populated
        await interaction.guild.members.fetch();
        // Use the target channel from env if set, otherwise use the current channel
        const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
        const channel = TARGET_CHANNEL_ID ? interaction.guild.channels.cache.get(TARGET_CHANNEL_ID) : interaction.channel;
        if (!channel) {
            await interaction.reply({ content: 'Target channel not found.', flags: 64 });
            return;
        }
        // For text channels: get all non-bot members who can view this channel
        const members = interaction.guild.members.cache.filter(m => !m.user.bot && channel.permissionsFor(m).has('ViewChannel'));

        if (members.size === 0) {
            await interaction.reply({ content: 'No users found in this channel.', flags: 64 });
            return;
        }

        // Paging logic
        const membersArr = Array.from(members.values());
        const pageSize = 25;
        const page = 1;
        const totalPages = Math.ceil(membersArr.length / pageSize);
        const pagedMembers = membersArr.slice((page - 1) * pageSize, page * pageSize);

        const options = pagedMembers.map(member => ({
            label: member.displayName,
            description: member.user.tag,
            value: member.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`unworthy-select-users-page-${page}`)
            .setPlaceholder('Select users to kick')
            .setMinValues(1)
            .setMaxValues(options.length)
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder();
        if (totalPages > 1) {
            if (page > 1) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-prev-page-${page}`).setLabel('Previous').setStyle(ButtonStyle.Primary));
            if (page < totalPages) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-next-page-${page}`).setLabel('Next').setStyle(ButtonStyle.Primary));
        }
        const components = [row];
        if (buttonRow.components.length) components.push(buttonRow);

        await interaction.reply({
            content: `Select users to kick from the server.\nReason: ${reason} (Page ${page}/${totalPages})`,
            components,
            flags: 64
        });
        return;
    },

    async handleComponent(interaction) {
        try {
            // Paging handler
            if (interaction.customId.startsWith('unworthy-prev-page-') || interaction.customId.startsWith('unworthy-next-page-')) {
                const isPrev = interaction.customId.startsWith('unworthy-prev-page-');
                const currentPage = parseInt(interaction.customId.split('-').pop(), 10);
                const newPage = isPrev ? currentPage - 1 : currentPage + 1;
                const reasonMatch = interaction.message.content.match(/Reason: (.*?)(?: \(Page|$)/);
                const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1] : 'No reason found.';
                await interaction.guild.members.fetch();
                const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
                const channel = TARGET_CHANNEL_ID ? interaction.guild.channels.cache.get(TARGET_CHANNEL_ID) : interaction.channel;
                if (!channel) {
                    await interaction.update({ content: 'Target channel not found.', components: [], flags: 64 });
                    return true;
                }
                const members = interaction.guild.members.cache.filter(m => !m.user.bot && channel.permissionsFor(m).has('ViewChannel'));
                const membersArr = Array.from(members.values());
                const pageSize = 25;
                const totalPages = Math.ceil(membersArr.length / pageSize);
                const pagedMembers = membersArr.slice((newPage - 1) * pageSize, newPage * pageSize);
                const options = pagedMembers.map(member => ({
                    label: member.displayName,
                    description: member.user.tag,
                    value: member.id
                }));
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`unworthy-select-users-page-${newPage}`)
                    .setPlaceholder('Select users to kick')
                    .setMinValues(1)
                    .setMaxValues(options.length)
                    .addOptions(options);
                const row = new ActionRowBuilder().addComponents(selectMenu);
                const buttonRow = new ActionRowBuilder();
                if (totalPages > 1) {
                    if (newPage > 1) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-prev-page-${newPage}`).setLabel('Previous').setStyle(ButtonStyle.Primary));
                    if (newPage < totalPages) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-next-page-${newPage}`).setLabel('Next').setStyle(ButtonStyle.Primary));
                }
                const components = [row];
                if (buttonRow.components.length) components.push(buttonRow);
                await interaction.update({
                    content: `Select users to kick from the server.\nReason: ${reason} (Page ${newPage}/${totalPages})`,
                    components,
                    flags: 64
                });
                return true;
            }
            const members = interaction.guild.members.cache.filter(m => !m.user.bot && channel.permissionsFor(m).has('ViewChannel'));
            const membersArr = Array.from(members.values());
            const pageSize = 25;
            const totalPages = Math.ceil(membersArr.length / pageSize);
            const pagedMembers = membersArr.slice((newPage - 1) * pageSize, newPage * pageSize);
            const options = pagedMembers.map(member => ({
                label: member.displayName,
                description: member.user.tag,
                value: member.id
            }));
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`unworthy-select-users-page-${newPage}`)
                .setPlaceholder('Select users to kick')
                .setMinValues(1)
                .setMaxValues(options.length)
                .addOptions(options);
            const row = new ActionRowBuilder().addComponents(selectMenu);
            const buttonRow = new ActionRowBuilder();
            if (totalPages > 1) {
                if (newPage > 1) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-prev-page-${newPage}`).setLabel('Previous').setStyle(ButtonStyle.Primary));
                if (newPage < totalPages) buttonRow.addComponents(new ButtonBuilder().setCustomId(`unworthy-next-page-${newPage}`).setLabel('Next').setStyle(ButtonStyle.Primary));
            }
            const components = [row];
            if (buttonRow.components.length) components.push(buttonRow);
            await interaction.update({
                content: `Select users to kick from the server.\nReason: ${reason} (Page ${newPage}/${totalPages})`,
                components,
                flags: 64
            });
            return true;
        }
        // User select handler
        if (interaction.customId.startsWith('unworthy-select-users-page-')) {
            const reasonMatch = interaction.message.content.match(/Reason: (.*?)(?: \(Page|$)/);
            const reason = reasonMatch ? reasonMatch[1] : `Sorry, you currently don't seem like a great fit for ${interaction.guild.name}.`;
            const userIds = interaction.values;

            const results = { success: [], failed: [] };

            for (const userId of userIds) {
                try {
                    const member = await interaction.guild.members.fetch(userId);
                    if (!member.kickable) {
                        results.failed.push(`${member.user.tag} (cannot be kicked - bot lacks permissions or user has higher role)`);
                        continue;
                    }
                    // Try to send DM first
                    try {
                        const dmEmbed = new EmbedBuilder()
                            .setColor('#FF0000')
                            .setTitle('Application Rejected')
                            .setDescription(`You have been removed from **${interaction.guild.name}**\n\n**Reason:** ${reason}`)
                            .setTimestamp();
                        await member.send({ embeds: [dmEmbed] });
                    } catch (dmError) {
                        // Continue even if DM fails
                        console.log(`Could not send DM to ${member.user.tag}`);
                    }
                    await member.kick(reason);
                    results.success.push(member.user.tag);
                } catch (error) {
                    results.failed.push(`User ID: ${userId} (${error.message})`);
                }
            }

            // Create response message
            const responseEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('Kick Operation Summary')
                .setDescription(`Results for kicking users from ${interaction.guild.name}`)
                .setTimestamp();

            if (results.success.length > 0) {
                responseEmbed.addFields({
                    name: '✅ Successfully Kicked',
                    value: results.success.map(user => `- ${user}`).join('\n')
                });
            }
            if (results.failed.length > 0) {
                responseEmbed.addFields({
                    name: '❌ Failed to Kick',
                    value: results.failed.map(user => `- ${user}`).join('\n')
                });
            }

            await interaction.update({ embeds: [responseEmbed], components: [] });
            return true;
        }
    }
};