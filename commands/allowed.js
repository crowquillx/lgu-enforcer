const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allowed')
        .setDescription('Remove a role from multiple users')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to remove')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        const role = interaction.options.getRole('role');
        // Fetch all members to ensure the cache is populated
        await interaction.guild.members.fetch();
        // Use the target channel from env if set, otherwise use the current channel
        const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
        const channel = TARGET_CHANNEL_ID ? interaction.guild.channels.cache.get(TARGET_CHANNEL_ID) : interaction.channel;
        if (!channel) {
            return interaction.reply({ content: 'Target channel not found.', ephemeral: true });
        }
        // For text channels: get all non-bot members who can view this channel
        const members = interaction.guild.members.cache.filter(m => !m.user.bot && channel.permissionsFor(m).has('ViewChannel'));

        if (members.size === 0) {
            await interaction.reply({ content: 'No users found in this channel.', flags: 64 });
            return;
        }

        const pageSize = 25;
        const pages = Math.ceil(members.size / pageSize);
        const currentPage = 1;

        const buildSelectMenu = (members, currentPage, pageSize) => {
            const membersArray = Array.from(members?.values ? members.values() : members);
            const options = membersArray.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(member => ({
                label: member.displayName,
                description: member.user.tag,
                value: member.id
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`allowed-select-users-${currentPage}`)
                .setPlaceholder('Select users to remove the role from')
                .setMinValues(1)
                .setMaxValues(options.length)
                .addOptions(options);

            return selectMenu;
        };

        const buildButtonRow = (currentPage, pages) => {
            const row = new ActionRowBuilder();

            if (currentPage > 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('allowed-prev-page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            if (currentPage < pages) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('allowed-next-page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            return row;
        };

        const selectMenu = buildSelectMenu(members, currentPage, pageSize);
        const buttonRow = buildButtonRow(currentPage, pages);

        await interaction.reply({
            content: `Select users to remove the role **${role.name}** from:`,
            components: [new ActionRowBuilder().addComponents(selectMenu), buttonRow],
            flags: 64
        });
    },

    async handleComponent(interaction) {
        try {
            if (interaction.customId.startsWith('allowed-select-users')) {
                const roleMatch = interaction.message.content.match(/\*\*(.+)\*\*/);
                if (!roleMatch) {
                    await interaction.update({ content: 'Role not found in message.', components: [] });
                    return true;
                }
                const userIds = interaction.values;
                const guildRole = interaction.guild.roles.cache.find(r => r.name === roleMatch[1]);
                const results = { success: [], failed: [] };
                const mentions = [];

                for (const userId of userIds) {
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        if (!member.roles.cache.has(guildRole.id)) {
                            results.failed.push(`${member.user.tag} (didn't have the role)`);
                            continue;
                        }
                        await member.roles.remove(guildRole);
                        results.success.push(member.user.tag);
                        mentions.push(`<@${member.id}>`);
                    } catch (error) {
                        results.failed.push(`User ID: ${userId} (${error.message})`);
                    }
                }

                let response = `Role removal summary for **${guildRole.name}**:\n\n`;
                if (results.success.length > 0) {
                    response += `✅ Successfully removed role from:\n${results.success.map(user => `- ${user}`).join('\n')}\n\n`;
                }
                if (results.failed.length > 0) {
                    response += `❌ Failed to remove role from:\n${results.failed.map(user => `- ${user}`).join('\n')}`;
                }
                await interaction.update({ content: response, components: [] });

                // Post welcome message in the general channel if there are successful users
                if (results.success.length > 0 && process.env.GENERAL_CHANNEL_ID) {
                    const generalChannel = interaction.guild.channels.cache.get(process.env.GENERAL_CHANNEL_ID);
                    if (generalChannel) {
                        const welcomeMsg = (process.env.WELCOME_MESSAGE || 'Welcome to the server, {users}!').replace('{users}', mentions.join(' '));
                        const imageUrl = process.env.WELCOME_IMAGE_URL;
                        await generalChannel.send({
                            content: welcomeMsg,
                            files: imageUrl ? [imageUrl] : undefined
                        });
                    }
                }
                return true;
            }

            if (interaction.customId === 'allowed-prev-page' || interaction.customId === 'allowed-next-page') {
                const currentPage = interaction.message.components[0].components[0].customId.match(/allowed-select-users-(\d+)/)[1];
                const pageSize = 25;
                const pages = Math.ceil(interaction.guild.members.cache.size / pageSize);
                
                let newPage;
                if (interaction.customId === 'allowed-prev-page') {
                    newPage = Math.max(1, parseInt(currentPage) - 1);
                } else {
                    newPage = Math.min(pages, parseInt(currentPage) + 1);
                }

                const members = interaction.guild.members.cache.filter(m => !m.user.bot);
                const selectMenu = buildSelectMenu(members, newPage, pageSize);
                const buttonRow = buildButtonRow(newPage, pages);

                await interaction.update({
                    content: `Select users to remove the role **${interaction.message.content.match(/\*\*(.+)\*\*/)[1]}** from:`,
                    components: [new ActionRowBuilder().addComponents(selectMenu), buttonRow],
                    flags: 64
                });
                return true;
            }

            return false;
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
            return false;
        }
    }
};
