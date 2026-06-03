const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const express = require('express');

// ==================== 1. Render 網頁補丁 ====================
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('專業管理機器人已上線！'));
app.listen(port, () => console.log(`監聽中: ${port}`));

// ==================== 2. 初始化機器人 ====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 記憶體資料庫（警告紀錄、等級）
const lvDb = {};
const warnDb = {}; 

// ==================== 3. 註冊斜線指令 (20+ 管理指令全開) ====================
const commands = [
    // 1. 🔨 懲處管理系統 (5 個功能)
    new SlashCommandBuilder()
        .setName('manage')
        .setDescription('【管理】核心成員懲處系統')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub => sub.setName('kick').setDescription('【1】踢除成員').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('原因')))
        .addSubcommand(sub => sub.setName('ban').setDescription('【2】封鎖成員').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('原因')))
        .addSubcommand(sub => sub.setName('unban').setDescription('【3】解除封鎖').addStringOption(o => o.setName('userid').setDescription('目標用戶 ID').setRequired(true)))
        .addSubcommand(sub => sub.setName('timeout').setDescription('【4】禁言成員(禁言/禁閉)').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addIntegerOption(o => o.setName('minutes').setDescription('時間(分鐘)').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('原因')))
        .addSubcommand(sub => sub.setName('untimeout').setDescription('【5】解除禁言').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true))),

    // 2. ⚠️ 警告點數系統 (4 個功能)
    new SlashCommandBuilder()
        .setName('warn')
        .setDescription('【管理】警告點數紀錄系統')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('add').setDescription('【6】給予成員一次警告').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('原因').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('【7】移除成員的一次警告').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)))
        .addSubcommand(sub => sub.setName('check').setDescription('【8】查詢成員的警告紀錄').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)))
        .addSubcommand(sub => sub.setName('clear').setDescription('【9】清除成員的所有警告').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true))),

    // 3. 🧹 聊天室與頻道清理 (4 個功能)
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('【管理】訊息批量清理系統')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('any').setDescription('【10】刪除指定數量的任意訊息').addIntegerOption(o => o.setName('count').setDescription('數量(1-100)').setRequired(true)))
        .addSubcommand(sub => sub.setName('bot').setDescription('【11】僅刪除聊天室內機器人的訊息').addIntegerOption(o => o.setName('count').setDescription('檢查的訊息量(1-100)').setRequired(true)))
        .addSubcommand(sub => sub.setName('user').setDescription('【12】僅刪除特定用戶的訊息').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addIntegerOption(o => o.setName('count').setDescription('檢查的訊息量(1-100)').setRequired(true)))
        .addSubcommand(sub => sub.setName('nuke').setDescription('【13】一鍵引爆頻道（完全清除此頻道所有訊息）')),

    // 4. 🔒 伺服器狀態與頻道權限管控 (4 個功能)
    new SlashCommandBuilder()
        .setName('channel')
        .setDescription('【管理】頻道權限快速管控')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub => sub.setName('lock').setDescription('【14】鎖定頻道（禁止所有人發言）'))
        .addSubcommand(sub => sub.setName('unlock').setDescription('【15】解鎖頻道（恢復正常發言）'))
        .addSubcommand(sub => sub.setName('slowmode').setDescription('【16】設定頻道慢速模式（冷卻時間）').addIntegerOption(o => o.setName('seconds').setDescription('秒數(0代表關閉)').setRequired(true)))
        .addSubcommand(sub => sub.setName('rename').setDescription('【17】快速修改當前頻道名稱').addStringOption(o => o.setName('name').setDescription('新名稱').setRequired(true))),

    // 5. 👥 身分組管理與資訊查詢 (5 個功能)
    new SlashCommandBuilder()
        .setName('role')
        .setDescription('【管理】快速身分組與伺服器查詢')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('add').setDescription('【18】給予成員某個身分組').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('身分組').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('【19】拿掉成員的某個身分組').addUserOption(o => o.setName('user').setDescription('目標').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('身分組').setRequired(true)))
        .addSubcommand(sub => sub.setName('serverinfo').setDescription('【20】查看伺服器詳細核心數據資料'))
        .addSubcommand(sub => sub.setName('invites').setDescription('【21】查詢全伺服器邀請連結使用次數統計'))
        .addSubcommand(sub => sub.setName('userinfo').setDescription('【22】查看特定用戶的詳細進群時間與 ID').addUserOption(o => o.setName('user').setDescription('目標'))),

    // 6. 📊 查詢與娛樂 (2 個功能)
    new SlashCommandBuilder().setName('lv').setDescription('【查詢】查看自己或他人的當前等級與經驗值').addUserOption(opt => opt.setName('user').setDescription('目標')),
    new SlashCommandBuilder().setName('roll').setDescription('【娛樂】骰出 1 到 100 的隨機數字')
].map(cmd => cmd.toJSON());

// ==================== 4. 監聽訊息 (LV 等級系統) ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    const userId = message.author.id;
    if (!lvDb[userId]) lvDb[userId] = { xp: 0, level: 1 };
    
    const xpGained = Math.floor(Math.random() * 11) + 5;
    lvDb[userId].xp += xpGained;

    const xpNeeded = lvDb[userId].level * 100;
    if (lvDb[userId].xp >= xpNeeded) {
        lvDb[userId].xp -= xpNeeded;
        lvDb[userId].level += 1;
        message.reply(`🎉 恭喜 ${message.author} 升級到 **Lv.${lvDb[userId].level}**！`);
    }
});

// ==================== 5. 核心指令邏輯處理 ====================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, user } = interaction;
    const subCommand = options.getSubcommand(false);

    // --- 🔨 懲處管理系統 ---
    if (commandName === 'manage') {
        const target = options.getMember('user');
        const reason = options.getString('reason') || '未提供原因';

        if (subCommand === 'kick') {
            await target.kick(reason);
            await interaction.reply(`🛑 已將 **${target.user.tag}** 踢出伺服器。原因: ${reason}`);
        } 
        else if (subCommand === 'ban') {
            await target.ban({ reason });
            await interaction.reply(`🚫 已將 **${target.user.tag}** 永久封鎖。原因: ${reason}`);
        } 
        else if (subCommand === 'unban') {
            const userId = options.getString('userid');
            await guild.members.unban(userId);
            await interaction.reply(`✅ 已成功解除 ID \`${userId}\` 的封鎖。`);
        } 
        else if (subCommand === 'timeout') {
            const minutes = options.getInteger('minutes');
            await target.timeout(minutes * 60 * 1000, reason);
            await interaction.reply(`⏳ 已將 **${target.user.tag}** 禁言 ${minutes} 分鐘。原因: ${reason}`);
        } 
        else if (subCommand === 'untimeout') {
            await target.timeout(null);
            await interaction.reply(`🔊 已解除 **${target.user.tag}** 的禁言。`);
        }
    }

    // --- ⚠️ 警告點數系統 ---
    else if (commandName === 'warn') {
        const target = options.getUser('user');
        if (!warnDb[target.id]) warnDb[target.id] = [];

        if (subCommand === 'add') {
            const reason = options.getString('reason');
            warnDb[target.id].push({ reason, date: new Date().toLocaleDateString(), executor: user.username });
            await interaction.reply(`⚠️ 已成功對 **${target.username}** 記記一次警告。目前累計: **${warnDb[target.id].length}** 次。`);
        } 
        else if (subCommand === 'remove') {
            if (warnDb[target.id].length === 0) return interaction.reply('該成員本來就沒有任何警告。');
            warnDb[target.id].pop();
            await interaction.reply(`✅ 已移除 **${target.username}** 的最近一次警告。剩餘: **${warnDb[target.id].length}** 次。`);
        } 
        else if (subCommand === 'check') {
            const list = warnDb[target.id];
            if (list.length === 0) return interaction.reply(`😇 **${target.username}** 紀錄非常良好，沒有任何警告。`);
            let reply = `📋 **${target.username} 的警告詳細紀錄：**\n`;
            list.forEach((w, i) => reply += `▶️ 【${i+1}】日期: ${w.date} | 原因: ${w.reason} | 執行官: ${w.executor}\n`);
            await interaction.reply(reply);
        } 
        else if (subCommand === 'clear') {
            warnDb[target.id] = [];
            await interaction.reply(`✨ 已徹底洗白並清除 **${target.username}** 的所有警告紀錄！`);
        }
    }

    // --- 🧹 訊息清理系統 ---
    else if (commandName === 'clear') {
        if (subCommand === 'any') {
            const count = options.getInteger('count');
            const deleted = await channel.bulkDelete(count, true);
            await interaction.reply({ content: `🧹 成功清除了 ${deleted.size} 則訊息！`, ephemeral: true });
        } 
        else if (subCommand === 'bot') {
            const count = options.getInteger('count');
            const messages = await channel.messages.fetch({ limit: count });
            const botMsgs = messages.filter(m => m.author.bot);
            await channel.bulkDelete(botMsgs, true);
            await interaction.reply({ content: `🧹 已從最近的 ${count} 則訊息中清理了機器人發言。`, ephemeral: true });
        } 
        else if (subCommand === 'user') {
            const count = options.getInteger('count');
            const targetUser = options.getUser('user');
            const messages = await channel.messages.fetch({ limit: count });
            const userMsgs = messages.filter(m => m.author.id === targetUser.id);
            await channel.bulkDelete(userMsgs, true);
            await interaction.reply({ content: `🧹 已成功清理用戶 **${targetUser.username}** 的訊息。`, ephemeral: true });
        } 
        else if (subCommand === 'nuke') {
            await interaction.reply('💣 正在引爆並重建此頻道...');
            const newChannel = await channel.clone();
            await channel.delete();
            await newChannel.send('💥 頻道已成功清理重置完畢！');
        }
    }

    // --- 🔒 頻道權限管控 ---
    else if (commandName === 'channel') {
        if (subCommand === 'lock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
            await interaction.reply('🔒 **此頻道已被管理員鎖定。** 全體成員目前禁止發言。');
        } 
        else if (subCommand === 'unlock') {
            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
            await interaction.reply('🔓 **此頻道已解鎖。** 全體成員恢復發言權限。');
        } 
        else if (subCommand === 'slowmode') {
            const seconds = options.getInteger('seconds');
            await channel.setRateLimitPerUser(seconds);
            await interaction.reply(`⏳ 此頻道的發言冷卻時間已設定為 **${seconds}** 秒！`);
        } 
        else if (subCommand === 'rename') {
            const newName = options.getString('name');
            await channel.setName(newName);
            await interaction.reply(`📝 已將頻道名稱修改為 \`${newName}\`。`);
        }
    }

    // --- 👥 身分組管理與資訊查詢 ---
    else if (commandName === 'role') {
        if (subCommand === 'add') {
            const member = options.getMember('user');
            const role = options.getRole('role');
            await member.roles.add(role);
            await interaction.reply(`✅ 成功將身分組【${role.name}】賦予給 ${member.user.username}。`);
        } 
        else if (subCommand === 'remove') {
            const member = options.getMember('user');
            const role = options.getRole('role');
            await member.roles.remove(role);
            await interaction.reply(`❌ 成功將 ${member.user.username} 的身分組【${role.name}】移除。`);
        } 
        else if (subCommand === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`📊 ${guild.name} 伺服器核心數據清單`)
                .setThumbnail(guild.iconURL())
                .addFields(
                    { name: '🆔 伺服器 ID', value: `\`${guild.id}\``, inline: true },
                    { name: '👑 建立者', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 總成員數', value: `**${guild.memberCount}** 人`, inline: true },
                    { name: '🔮 加成等級', value: `等級 ${guild.premiumTier} (${guild.premiumSubscriptionCount} 個加成)`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        } 
        else if (subCommand === 'invites') {
            const invites = await guild.invites.fetch();
            let str = '📊 **全伺服器邀請連結排行：**\n';
            invites.forEach(inv => str += `🔗 \`${inv.code}\` | 建立者: <@${inv.inviterId}> | 使用次數: **${inv.uses}** 次\n`);
            await interaction.reply(str || '目前沒有任何邀請連結。');
        } 
        else if (subCommand === 'userinfo') {
            const targetUser = options.getUser('user') || user;
            const targetMember = options.getMember('user') || interaction.member;
            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle(`👤 ${targetUser.username} 的成員報告`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '帳號 ID', value: `\`${targetUser.id}\``, inline: true },
                    { name: '帳號建立時間', value: `${targetUser.createdAt.toLocaleDateString()}`, inline: true },
                    { name: '加入伺服器時間', value: `${targetMember.joinedAt.toLocaleDateString()}`, inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        }
    }

    // --- 📊 基礎查詢與娛樂 ---
    else if (commandName === 'lv') {
        const target = options.getUser('user') || user;
        const data = lvDb[target.id] || { xp: 0, level: 1 };
        await interaction.reply(`📊 **${target.username}** 目前等級為：**Lv.${data.level}** (${data.xp} XP)`);
    } 
    else if (commandName === 'roll') {
        await interaction.reply(`🎲 骰出了 **${Math.floor(Math.random() * 100) + 1}** 點！`);
    }
});

// ==================== 6. 登入並發布指令 ====================
client.once('ready', async () => {
    console.log(`🤖 專業管理機器人已上線: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 正在發布 22 個高級管理與功能指令...');
        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
            { body: commands }
        );
        console.log('✅ 大功告成！全套子指令核心同步成功！');
    } catch (error) {
        console.error('指令同步失敗:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);