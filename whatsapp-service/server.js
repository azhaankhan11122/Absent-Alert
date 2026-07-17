const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
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
    headless: false,
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

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: puppeteerConfig
});

let isClientReady = false;

// QR Code Generation event
client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP ON YOUR PHONE ---');
    qrcode.generate(qr, { small: true });
    console.log('-----------------------------------------------------\n');
});

// Client Authentication and Ready events
client.on('ready', () => {
    isClientReady = true;
    console.log('WhatsApp Client is fully authenticated and ready!');
});

client.on('auth_failure', (msg) => {
    console.error('WhatsApp Authentication Failure:', msg);
});

client.on('disconnected', (reason) => {
    isClientReady = false;
    console.log('WhatsApp Client disconnected. Reason:', reason);
});

// Initialize client
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
        
        // Safety feature: implement random delay between 5 to 15 seconds
        const delaySeconds = Math.floor(Math.random() * (15 - 5 + 1)) + 5;
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
        console.log(`Message successfully sent to ${formattedNumber}. ID: ${response.id._serialized}`);
        
        return {
            success: true,
            messageId: response.id._serialized,
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
    const { phoneNumber, message } = req.body;

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

// Health check endpoint
app.get('/status', (req, res) => {
    res.json({
        status: isClientReady ? 'ready' : 'not_ready',
        queueLength: messageQueue.length,
        isProcessing: isProcessingQueue
    });
});

app.listen(PORT, () => {
    console.log(`WhatsApp Notification Gateway listening on port ${PORT}`);
    console.log(`Auth key: ${API_KEY}`);
});
