const express = require('express');
const app = express();
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const pino = require("pino");

// --- DASHBOARD SETUP ---
app.use(express.static('public'));
global.pairingCode = null;

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.send("Namba inahitajika!");
    global.tempNumber = number;
    res.send("Inaandaa kodi...");
});

app.get('/get-code', (req, res) => {
    res.json({ code: global.pairingCode });
});

app.listen(process.env.PORT || 10000, () => console.log("Dashboard iko hewani!"));

// --- BOT LOGIC ---
require('./settings');
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state.creds
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        while (!global.tempNumber) { await delay(2000); }
        let code = await sock.requestPairingCode(global.tempNumber.replace(/[^0-9]/g, ''));
        global.pairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
    }
}
startBot();

