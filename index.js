const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const express = require('express');

// ==================== 1. Render 網頁補丁 (防止超時斷線) ====================
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('機器人 24H 穩定運行中！'));
app.listen(port, () => console.log(`網頁伺服器監聽中: ${port}`));

// ==================== 2. 初始化 Discord 機器人 ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 簡單的記憶體等級資料庫 (注意：機器人重啟時會歸零)
const lvDb = {}; 

// ==================== 3. 註冊斜線指令 (分三大類) ====================
const commands = [
    // 🎈 娛樂類別 (Fun)
    new SlashCommandBuilder().setName('roll').setDescription('【娛樂】骰出 1 到 100 的隨機數字'),
    new SlashCommandBuilder().setName('dice').setDescription('【娛樂】跟機器人玩擲骰子'),

    // 🛡️ 伺服器管理類別 (Admin)
    new SlashCommandBuilder().setName('clear').setDescription('【管理】批量刪除聊天室訊息').addIntegerOption(opt => 
        opt.setName('count').setDescription('要刪除的訊息數量 (1-100)').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('【管理】將特定成員踢出伺服器').addUserOption(opt => 
        opt.setName('target').setDescription('要踢除的成員').setRequired(true)),

    // 📊 查詢與等級類別 (Utility & Level)
    new SlashCommandBuilder().setName('lv').setDescription('【查詢】查看自己或他人的當前等級與經驗值').addUserOption(opt => 
        opt.setName('user').setDescription('要查看的成員 (不選則為自己)')),
    new SlashCommandBuilder().setName('invite_info').setDescription('【查詢】查看此伺服器的邀請連結使用狀況')
].map(cmd => cmd.toJSON());

// ==================== 4. 監聽訊息發送 (發言賺取經驗值) ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    if (!lvDb[userId]) {
        lvDb[userId] = { xp: 0, level: 1 };
    }

    // 每發一則訊息隨機獲得 5~15 點經驗值
    const xpGained = Math.floor(Math.random() * 11) + 5;
    lvDb[userId].xp += xpGained;

    // 計算升級公式（公式：當前等級 * 100 = 升級所需經驗值）
    const xpNeeded = lvDb[userId].level * 100;
    if (lvDb[userId].xp >= xpNeeded) {
        lvDb[userId].xp -= xpNeeded;
        lvDb[userId].level += 1;
        message.reply(`🎉 恭喜 ${message.author} 升級了！目前等級達到 **Lv.${lvDb[userId].level}**！`);
    }
});

// ==================== 5. 處理指令執行 ====================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, user } = interaction;

    // --- 🎈 娛樂指令處理 ---
    if (commandName === 'roll') {
        const num = Math.floor(Math.random() * 100) + 1;
        await interaction.reply(`🎲 ${user.username} 骰出了 **${num}** 點！`);
    } 
    else if (commandName === 'dice') {
        const userDice = Math.floor(Math.random() * 6) + 1;
        const botDice = Math.floor(Math.random() * 6) + 1;
        let result = '🤝 平手！';
        if (userDice > botDice) result = '🎉 你贏了！';
        if (userDice < botDice) result = '❌ 機器人贏了！';
        await interaction.reply(`🎲 你擲出 ${userDice} 點 🆚 機器人擲出 ${botDice} 點\n➡️ 結果：**${result}**`);
    }

    // --- 🛡️ 管理指令處理 ---
    else if (commandName === 'clear') {
        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ content: '❌ 你沒有「管理訊息」的權限！', ephemeral: true });
        }
        const count = options.getInteger('count');
        if (count < 1 || count > 100) return interaction.reply({ content: '請輸入 1 到 100 之間的數量！', ephemeral: true });
        
        await interaction.channel.bulkDelete(count, true);
        await interaction.reply({ content: `🧹 成功刪除了 ${count} 則訊息！`, ephemeral: true });
    } 
    else if (commandName === 'kick') {
        if (!interaction.member.permissions.has('KickMembers')) {
            return interaction.reply({ content: '❌ 你沒有「踢除成員」的權限！', ephemeral: true });
        }
        const targetUser = options.getMember('target');
        if (!targetUser) return interaction.reply({ content: '找不到該成員！', ephemeral: true });
        
        try {
            await targetUser.kick();
            await interaction.reply(`🛑 成功將 ${targetUser.user.tag} 踢出伺服器！`);
        } catch {
            await interaction.reply({ content: '❌ 無法踢除該成員，請檢查機器人職位權限是否夠高。', ephemeral: true });
        }
    }

    // --- 📊 查詢與等級處理 ---
    else if (commandName === 'lv') {
        const target = options.getUser('user') || user;
        const data = lvDb[target.id] || { xp: 0, level: 1 };
        const nextXp = data.level * 100;

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`📊 ${target.username} 的個人生涯等級`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: '✨ 當前等級', value: `\`Lv.${data.level}\``, inline: true },
                { name: '📈 經驗值進度', value: `\`${data.data ? data.xp : data.xp} / ${nextXp} XP\``, inline: true }
            )
            .setFooter({ text: '多多發言可以賺取經驗值升級喔！' });

        await interaction.reply({ embeds: [embed] });
    } 
    else if (commandName === 'invite_info') {
        try {
            const invites = await guild.invites.fetch();
            if (invites.size === 0) return interaction.reply('📌 目前此伺服器沒有建立任何邀請連結。');

            let replyStr = '📊 **伺服器邀請連結使用狀況：**\n';
            invites.forEach(inv => {
                replyStr += `🔗 \`${inv.code}\` | 邀請人: <@${inv.inviterId}> | 已使用次數: **${inv.uses}** 次\n`;
            });
            await interaction.reply(replyStr);
        } catch {
            await interaction.reply({ content: '❌ 機器人缺少「管理伺服器」權限，無法讀取邀請資料。', ephemeral: true });
        }
    }
});

// ==================== 6. 登入並發布指令 ====================
client.once('ready', async () => {
    console.log(`🤖 機器人已成功登入為 ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 開始同步最新斜線指令...');
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );
        console.log('✅ 完美！所有指令已分類同步成功！');
    } catch (error) {
        console.error('指令同步失敗:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);