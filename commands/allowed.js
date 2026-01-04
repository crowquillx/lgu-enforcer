const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, GatewayRateLimitError } = require('discord.js');

// Helper function to check if an error is a rate limit error
const isRateLimitError = (error) => {
    return error instanceof GatewayRateLimitError || 
           (error.name === 'GatewayRateLimitError') || 
           (error.code === 50035 && error.status === 429);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allowed')
        .setDescription('Remove the applicant role from users (always uses the auto-added role)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        // Get the role from env (the auto-added role)
        const DEFAULT_ROLE_ID = process.env.DEFAULT_ROLE_ID;
        if (!DEFAULT_ROLE_ID) {
            return interaction.reply({ content: 'DEFAULT_ROLE_ID not configured in environment.', flags: 64 });
        }
        
        const role = interaction.guild.roles.cache.get(DEFAULT_ROLE_ID);
        if (!role) {
            return interaction.reply({ content: 'Role not found. Check DEFAULT_ROLE_ID configuration.', flags: 64 });
        }
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
                .setMaxValues(Math.min(options.length, 5)) // Cap at 5 to avoid Discord limits
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

        // DEBUG: Log component counts to diagnose the issue
        const selectMenuComponentCount = selectMenu.options ? selectMenu.options.length : 0;
        const buttonRowComponentCount = buttonRow.components ? buttonRow.components.length : 0;
        console.log(`[DEBUG] Select menu options: ${selectMenuComponentCount}, Button row components: ${buttonRowComponentCount}`);

        // Build components array - only include button row if it has buttons
        const components = [new ActionRowBuilder().addComponents(selectMenu)];
        if (buttonRowComponentCount > 0) {
            components.push(buttonRow);
        }

        await interaction.reply({
            content: `Select users to remove the role **${role.name}** from:`,
            components: components,
            flags: 64
        });
    },

    async handleComponent(interaction) {
        try {
            if (interaction.customId.startsWith('allowed-select-users')) {
                // Get the role from env (the auto-added role)
                const DEFAULT_ROLE_ID = process.env.DEFAULT_ROLE_ID;
                if (!DEFAULT_ROLE_ID) {
                    await interaction.update({ content: 'DEFAULT_ROLE_ID not configured.', components: [] });
                    return true;
                }
                
                const guildRole = interaction.guild.roles.cache.get(DEFAULT_ROLE_ID);
                if (!guildRole) {
                    await interaction.update({ content: 'Role not found. Check DEFAULT_ROLE_ID configuration.', components: [] });
                    return true;
                }
                
                const userIds = interaction.values;
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
                        
                        // Handle image based on configuration
                        const imageType = process.env.WELCOME_IMAGE_TYPE?.toLowerCase();
                        let messageOptions = { content: welcomeMsg };
                        
                        if (imageType === 'local') {
                            // Use local file path
                            const imagePath = process.env.WELCOME_IMAGE_PATH || './resources/MIMLSSK.png';
                            messageOptions.files = [imagePath];
                        } else if (imageType === 'url') {
                            // Use URL image
                            const imageUrl = process.env.WELCOME_IMAGE_URL;
                            if (imageUrl) {
                                messageOptions.embeds = [{
                                    image: { url: imageUrl }
                                }];
                            }
                        } else {
                            // Fall back to default behavior (local file)
                            messageOptions.files = ['./resources/MIMLSSK.png'];
                        }
                        
                        await generalChannel.send(messageOptions);
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

                // DEBUG: Log pagination info
                console.log(`[DEBUG] Pagination: currentPage=${currentPage}, newPage=${newPage}, pages=${pages}`);
                console.log(`[DEBUG] Button row components: ${buttonRow.components ? buttonRow.components.length : 0}`);

                // Build components array - only include button row if it has buttons
                const components = [new ActionRowBuilder().addComponents(selectMenu)];
                if (buttonRow.components && buttonRow.components.length > 0) {
                    components.push(buttonRow);
                }

                await interaction.update({
                    content: `Select users to remove the role from:`,
                    components: components,
                    flags: 64
                });
                return true;
            }

            return false;
        } catch (error) {
            if (isRateLimitError(error)) {
                const retryAfter = error.data?.retry_after || error.retry_after || 30;
                console.error(`[RATE LIMIT] Rate limited. Retry after ${retryAfter} seconds.`);
                try {
                    await interaction.reply({ 
                        content: `⚠️ Discord rate limit reached. Please wait ${Math.ceil(retryAfter)} seconds before trying again.`, 
                        ephemeral: true 
                    });
                } catch (replyError) {
                    // If we can't reply, try to update the message
                    try {
                        await interaction.update({ 
                            content: `⚠️ Rate limited. Please wait ${Math.ceil(retryAfter)} seconds.`, 
                            components: [] 
                        });
                    } catch (updateError) {
                        console.error('Failed to respond to rate limit:', updateError);
                    }
                }
                return true;
            }
            console.error(error);
            try {
                await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
            return false;
        }
    }
};
