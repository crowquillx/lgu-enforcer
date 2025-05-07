# Discord Bot with Modular Command System

A modern Discord bot built with discord.js v14, featuring a modular command system and slash commands.

## Features

- Modern discord.js v14 implementation
- Modular command system
- Slash command support
- Environment-based configuration
- Permission-based command access

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   ```
4. Register the slash commands:
   ```bash
   node deploy-commands.js
   ```
5. Start the bot:
   ```bash
   node index.js
   ```

## Adding New Commands

To add a new command:

1. Create a new file in the `commands` directory (e.g., `commands/mycommand.js`)
2. Use the following template:
   ```javascript
   const { SlashCommandBuilder } = require('discord.js');

   module.exports = {
       data: new SlashCommandBuilder()
           .setName('commandname')
           .setDescription('Command description')
           // Add options here
           .addStringOption(option =>
               option.setName('optionname')
                   .setDescription('Option description')
                   .setRequired(true)),
       
       async execute(interaction) {
           // Command logic here
           await interaction.reply('Response');
       },
   };
   ```
3. Run `node deploy-commands.js` to register the new command

## Available Commands

### allowed
Removes a specified role from multiple users.

Usage: `/allowed <role> <users>`
- Requires "Manage Roles" permission
- Role: Mention or ID of the role to remove
- Users: Space-separated list of user mentions or IDs

## License

MIT
