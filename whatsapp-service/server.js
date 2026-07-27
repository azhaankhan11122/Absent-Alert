const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const dotenv = require('dotenv');

const os = require('os');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const API_KEY = process.env.WHATSAPP_SERVICE_API_KEY || 'absent_alert_secret_key_2026';

app.use(bodyParser.json());

// Initialize WhatsApp Web Client
console.log('Initializing WhatsApp Web Client...');

const puppeteerConfig = {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    protocolTimeout: 300000,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling'
    ]
};

// On macOS, if Brave Browser is installed, use it to bypass the dlopen issues with cached Chrome for Testing.
if (os.platform() === 'darwin') {
    const bravePath = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
    if (fs.existsSync(bravePath)) {
        console.log(`macOS detected: Using Brave Browser at "${bravePath}" as Puppeteer executable.`);
        puppeteerConfig.executablePath = bravePath;
    }
}

let client;
let isClientReady = false;
let latestQrCode = null;

async function deleteSessionDir(dirPath) {
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            if (fs.existsSync(dirPath)) {
                fs.rmSync(dirPath, { recursive: true, force: true });
                console.log(`Successfully deleted session directory on attempt ${attempt}.`);
                return true;
            }
            return true;
        } catch (err) {
            console.warn(`Attempt ${attempt} to delete session directory failed: ${err.message}. Retrying in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    console.error(`Failed to delete session directory after 5 attempts.`);
    return false;
}

async function cleanAndRestartClient() {
    isClientReady = false;
    latestQrCode = null;
    
    try {
        if (client) {
            console.log('Destroying active client...');
            await client.destroy();
        }
    } catch (err) {
        console.error('Error destroying client:', err.message);
    }

    const sessionPath = './.wwebjs_auth';
    await deleteSessionDir(sessionPath);

    console.log('Re-initializing WhatsApp Web Client...');
    createClient();
    client.initialize();
}

function createClient() {
    console.log('Creating WhatsApp Web Client instance...');
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: puppeteerConfig
    });

    // QR Code Generation event
    client.on('qr', async (qr) => {
        console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE ---');
        qrcode.generate(qr, { small: true });
        console.log('-----------------------------------------------------\n');
        try {
            latestQrCode = await QRCode.toDataURL(qr);
        } catch (err) {
            console.error('Failed to generate base64 QR code image:', err);
        }
    });

    // Client Authentication and Ready events
    client.on('ready', () => {
        isClientReady = true;
        latestQrCode = null;
        console.log('WhatsApp Client is fully authenticated and ready!');
    });

    client.on('auth_failure', (msg) => {
        console.error('WhatsApp Authentication Failure:', msg);
        latestQrCode = null;
    });

    client.on('disconnected', async (reason) => {
        console.log('WhatsApp Client disconnected. Reason:', reason);
        await cleanAndRestartClient();
    });
}

// Initialize client
createClient();
client.initialize();

/**
 * Clean and format phone number to E.164-like format with WhatsApp suffix
 * @param {string} phone 
 * @returns {string}
 */
function formatPhoneNumber(phone) {
    // Strip all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Default country code handling (e.g. assume India '91' if 10 digits)
    if (cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    
    // Append the @c.us suffix required by whatsapp-web.js if not present
    if (!cleaned.endsWith('@c.us')) {
        cleaned = cleaned + '@c.us';
    }
    
    return cleaned;
}

/**
 * Message sending queue to enforce safety delays
 */
const messageQueue = [];
let isProcessingQueue = false;

/**
 * Enqueue a message to be sent after a random delay (5 to 15 seconds)
 */
function enqueueMessage(studentPhoneNumber, message) {
    return new Promise((resolve, reject) => {
        messageQueue.push({ studentPhoneNumber, message, resolve, reject });
        processQueue();
    });
}

/**
 * Queue processor
 */
async function processQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const { studentPhoneNumber, message, resolve, reject } = messageQueue.shift();
        
        // Safety feature: implement random delay between 1 to 3 seconds
        const delaySeconds = Math.floor(Math.random() * (3 - 1 + 1)) + 1;
        console.log(`Queue: Waiting for ${delaySeconds} seconds safety delay before sending...`);
        await new Promise(resolveDelay => setTimeout(resolveDelay, delaySeconds * 1000));

        try {
            const result = await sendAttendanceAlert(studentPhoneNumber, message);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    isProcessingQueue = false;
}

/**
 * Primary function to send attendance alerts via WhatsApp
 */
async function sendAttendanceAlert(studentPhoneNumber, message) {
    if (!isClientReady) {
        throw new Error('WhatsApp Client is not ready. Please scan the QR code and wait for client initialization.');
    }

    const formattedNumber = formatPhoneNumber(studentPhoneNumber);
    console.log(`Attempting to send WhatsApp message to ${formattedNumber}...`);

    try {
        // Validate that the number is actually registered on WhatsApp
        const isRegistered = await client.isRegisteredUser(formattedNumber);
        if (!isRegistered) {
            throw new Error(`The phone number ${studentPhoneNumber} (formatted as ${formattedNumber}) is not registered on WhatsApp.`);
        }

        const response = await client.sendMessage(formattedNumber, message);
        const messageId = response && response.id ? response.id._serialized : 'unknown';
        console.log(`Message successfully sent to ${formattedNumber}. ID: ${messageId}`);
        
        return {
            success: true,
            messageId: messageId,
            recipient: formattedNumber
        };
    } catch (error) {
        console.error(`Failed to send WhatsApp message to ${formattedNumber}:`, error.message);
        throw error;
    }
}

// Basic API Key checking Middleware
function verifyApiKey(req, res, next) {
    let requestKey = req.headers['x-api-key'] || req.query.apiKey;
    
    // Support Bearer token from authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        requestKey = authHeader.substring(7);
    }

    if (requestKey && requestKey === API_KEY) {
        next();
    } else {
        console.warn(`Unauthorized access attempt from IP: ${req.ip}`);
        res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key.' });
    }
}

// API Routes
app.post('/send-alert', verifyApiKey, async (req, res) => {
    let { phoneNumber, message } = req.body;

    // Handle Meta-style payload formats sent by whatsappGateway.js
    if (!phoneNumber && req.body.to) {
        phoneNumber = req.body.to;
    }
    if (!message && req.body.text && req.body.text.body) {
        message = req.body.text.body;
    }

    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Missing required parameters: phoneNumber and message.' });
    }

    try {
        console.log(`Received alert request for: ${phoneNumber}. Enqueueing...`);
        
        // Enqueue the message to enforce safety delays
        const result = await enqueueMessage(phoneNumber, message);
        res.json({
            success: true,
            status: 'sent',
            details: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/logout', verifyApiKey, async (req, res) => {
    try {
        console.log('Logout requested...');
        if (!isClientReady) {
            console.log('Client is not ready, performing forced cleanup and reinitialization...');
            await cleanAndRestartClient();
            return res.json({ success: true, message: 'Forced logout and reinitialization successful.' });
        }

        try {
            // Attempt normal logout. This should trigger the 'disconnected' event, which calls cleanAndRestartClient.
            await client.logout();
            return res.json({ success: true, message: 'Logout successful.' });
        } catch (logoutError) {
            console.warn('Normal logout failed, falling back to forced cleanup:', logoutError.message);
            await cleanAndRestartClient();
            return res.json({ success: true, message: 'Forced logout after normal logout failure.' });
        }
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint
app.get('/status', (req, res) => {
    res.json({
        status: isClientReady ? 'ready' : 'not_ready',
        qr: latestQrCode,
        queueLength: messageQueue.length,
        isProcessing: isProcessingQueue
    });
});

app.listen(PORT, () => {
    console.log(`WhatsApp Notification Gateway listening on port ${PORT}`);
    console.log(`Auth key: ${API_KEY}`);
});
