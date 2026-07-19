/**
 * Dvary - A WhatsApp Bot
 * Copyright (c) 2026 Dvary
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// --- DASHBOARD SETUP ---
app.use(express.static('public'));
app.get('/pair', (req, res) => {
    const number = req.query.number;
    if (!number) return res.send("Namba inahitajika!");
    global.pairingNumber = number;
    res.send("Ombi limepokelewa. Angalia Logs za Render kwa ajili ya Pairing Code!");
});
app.listen(PORT, () => console.log(`Dashboard iko hewani kwenye port ${PORT}`));

// --- BOT LOGIC ---
require('./settings');
const fs = require('fs');
const chalk = require('chalk');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, makeCacheableSignalKeyStore, delay } = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const readline = require("readline");

const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const { smsg } = require('./lib/myfunc');
const store = require('./lib/lightweight_store');

store.readFromFile();
const settings = require('./settings');

async function startXeonBotInc() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const msgRetryCounterCache = new NodeCache();

    const XeonBotInc = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        getMessage: async (key) => {
            let jid = jidNormalizedUser(key.remoteJid);
            let msg = await store.loadMessage(jid, key.id);
            return msg?.message || "";
        }
    });

    XeonBotInc.ev.on('creds.update', saveCreds);
    store.bind(XeonBotInc.ev);

    // --- PAIRING CODE LOGIC (Updated) ---
    if (!XeonBotInc.authState.creds.registered) {
        console.log(chalk.yellow('Waiting for pairing number from dashboard...'));
        while (!global.pairingNumber) {
            await delay(2000);
        }
        
        let phoneNumberInput = global.pairingNumber.replace(/[^0-9]/g, '');
        try {
            let code = await XeonBotInc.requestPairingCode(phoneNumberInput);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.black(chalk.bgGreen(`🔥 PAIRING CODE YAKO: ${code} 🔥`)));
        } catch (error) {
            console.error('Error:', error);
        }
    }

    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === 'open') console.log(chalk.green("✅ Bot Connected Successfully!"));
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startXeonBotInc();
        }
    });

    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            await handleMessages(XeonBotInc, chatUpdate, true);
        } catch (err) {
            console.error(err);
        }
    });
}

startXeonBotInc().catch(err => console.log(err));

