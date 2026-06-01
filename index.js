const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder 
} = require('discord.js');

// 🔒 安全升級：改從環境變數讀取密碼，不要直接寫死在程式碼裡
const TOKEN = process.env.DISCORD_TOKEN; 
const CLIENT_ID = process.env.DISCORD_CLIENT_ID; 

if (!TOKEN || !CLIENT_ID) {
    console.error("❌ 錯誤：找不到環境變數 DISCORD_TOKEN 或 DISCORD_CLIENT_ID！");
    process.exit(1);
}
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ================= 【 註冊斜線指令 】 =================
const commands = [
    // 升級版的 /setup-ticket，多了三個可以自訂文字的欄位
    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('📩 在當前頻道發送開票按鈕圖卡（管理員專用）')
        .addStringOption(option => 
            option.setName('title')
                .setDescription('自訂圖卡的大標題（選填）')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('description')
                .setDescription('自訂圖卡的詳細說明文字（選填，可用 \\n 換行）')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('button_text')
                .setDescription('自訂按鈕上顯示的文字（選填）')
                .setRequired(false)),

    // 保留其他的指令
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('🗑️ 批量刪除頻道中的訊息（管理員專用）')
        .addIntegerOption(option => option.setName('amount').setDescription('要刪除的訊息數量 (1-100)').setRequired(true)),
    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('🎲 讓機器人幫你擲一個 6 面骰子'),
    new SlashCommandBuilder()
        .setName('mora')
        .setDescription('✊ 跟機器人來一場驚心動魄的猜拳比賽！')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('請選擇你要出什麼')
                .setRequired(true)
                .addChoices(
                    { name: '剪刀 ✌️', value: '剪刀' },
                    { name: '石頭 ✊', value: '石頭' },
                    { name: '布 ✋', value: '布' }
                ))
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
    console.log(`🎉 機器人已成功上線！登入身分為：${client.user.tag}`);
    try {
        console.log('🔄 正在同步全域斜線指令 [/] ...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ 斜線指令同步成功！');
    } catch (error) {
        console.error('❌ 同步指令失敗:', error);
    }
});

// ================= 【 接收並執行斜線指令 】 =================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // ─── 執行升級版 /setup-ticket ───
    if (commandName === 'setup-ticket') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ 只有管理員可以使用這個指令喔！', ephemeral: true });
        }

        // 讀取使用者輸入的內容，如果沒填，就使用後面的「預設字」
        const customTitle = options.getString('title') || '📩 伺服器客服與開票系統';
        let customDesc = options.getString('description') || '如果您需要聯絡管理員、檢舉玩家或有任何建議，請點擊下方的按鈕建立專屬票單。';
        const customButtonText = options.getString('button_text') || '建立票單 📩';

        // 支援讓使用者輸入 \n 來進行換行
        customDesc = customDesc.replace(/\\n/g, '\n');

        const embed = new EmbedBuilder()
            .setTitle(customTitle)
            .setDescription(customDesc)
            .setColor('#5865F2')
            .setFooter({ text: 'loveyou 機器人客服系統' });

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel(customButtonText)
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: '✅ 開票系統圖卡已成功發送！', ephemeral: true });
    }

    // ─── 這裡省略其餘指令的內文以保持板面乾淨，原本的 clear、dice、mora 功能都在 ───
    if (commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: '❌ 權限不足', ephemeral: true });
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🗑️ 成功刪除 ${amount} 條訊息！`, ephemeral: true });
    }
    if (commandName === 'dice') {
        return interaction.reply(`🎲 你擲出了 **${Math.floor(Math.random() * 6) + 1}** 點！`);
    }
    if (commandName === 'mora') {
        const userChoice = options.getString('choice');
        const botChoice = ['剪刀', '石頭', '布'][Math.floor(Math.random() * 3)];
        let r = userChoice === botChoice ? '🤝 平手！' : ((userChoice === '剪刀' && botChoice === '布') || (userChoice === '石頭' && botChoice === '剪刀') || (userChoice === '布' && botChoice === '石頭')) ? '🎉 你贏了！' : '🤪 你輸了！';
        return interaction.reply(`你出 **${userChoice}**，我出 **${botChoice}**\n【結果】：${r}`);
    }
});

// ================= 【 處理開票按鈕事件（保持不變） 】 =================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'create_ticket') {
        const guild = interaction.guild;
        const user = interaction.user;

        const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
        if (existingChannel) {
            return interaction.reply({ content: `❌ 您已經有一個開啟中的票單了：${existingChannel}`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const ticketChannel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎟️ 票單已建立')
            .setDescription(`你好 ${user}，歡迎來到您的專屬票單頻道。\n請在這裡詳細說明您的問題，管理員會盡快前來協助。`)
            .setColor('#2ECC71');

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('關閉並刪除票單 🔒')
            .setStyle(ButtonStyle.Danger);

        const closeRow = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({ content: `${user} 歡迎使用客服！`, embeds: [welcomeEmbed], components: [closeRow] });
        await interaction.editReply({ content: `🎉 您的票單已成功建立！請前往此頻道：${ticketChannel}` });
    }

    if (interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 票單將在 5 秒後關閉並自動刪除...');
        setTimeout(async () => {
            try { await interaction.channel.delete(); } catch (e) { console.error(e); }
        }, 5000);
    }
});

client.login('MTUxMDQ1NDk4Mjg1ODYzNzMxMg.G6VdrZ.aFOEFhd3p_fWBpo--nZN09sVeb73eAg-vMDvlA');