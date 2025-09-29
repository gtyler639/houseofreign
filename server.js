require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const validator = require('validator');
const path = require('path');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const twilio = require('twilio');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Phone number validation helper
function toE164(raw, defaultCountry = 'US') {
    if (!raw) return null;
    const p = parsePhoneNumberFromString(raw, defaultCountry);
    return p?.isValid() ? p.number : null;
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files (your frontend)
app.use(express.static(path.join(__dirname)));

// Database setup
const db = new sqlite3.Database('./subscribers.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        // Create subscribers table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT,
                phone TEXT,
                phone_e164 TEXT,
                opted_out BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                UNIQUE(email, phone)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Subscribers table ready');
            }
        });
    }
});

// Validation functions
const validateEmail = (email) => {
    return validator.isEmail(email) && email.length <= 254;
};

const validatePhone = (phone) => {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    // US phone number validation (10 digits)
    return cleanPhone.length === 10 && /^\d{10}$/.test(cleanPhone);
};

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Subscribe endpoint
app.post('/api/subscribe', async (req, res) => {
    try {
        const { email, phone } = req.body;

        // Validation - require either email OR phone
        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                message: 'Either email address or phone number is required'
            });
        }

        if (email && !validateEmail(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Normalize phone to E164 format for SMS sending
        let phoneE164 = null;
        if (phone && String(phone).trim()) {
            phoneE164 = toE164(String(phone).trim(), 'US');
            if (!phoneE164) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone number format'
                });
            }
        }

        // Check if email already exists (only if email is provided)
        if (email) {
            db.get('SELECT id FROM subscribers WHERE email = ?', [email], async (err, row) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Internal server error'
                    });
                }

                if (row) {
                    return res.status(409).json({
                        success: false,
                        message: 'This email is already subscribed'
                    });
                }

                // Insert new subscriber
                await insertSubscriber(email, phone, phoneE164, res);
            });
        } else {
            // No email provided, just insert with phone
            await insertSubscriber('', phone, phoneE164, res);
        }

        async function insertSubscriber(email, phone, phoneE164, res) {
            db.run(
                'INSERT INTO subscribers (email, phone, phone_e164) VALUES (?, ?, ?)',
                [email, phone, phoneE164],
                async function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({
                            success: false,
                            message: 'Failed to subscribe. Please try again.'
                        });
                    }

                    // Send SMS confirmation if phone provided
                    if (phoneE164) {
                        try {
                            const msgParams = process.env.TWILIO_MESSAGING_SERVICE_SID
                                ? {
                                    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
                                    to: phoneE164,
                                    body: `House of Reign: You're in for updates & drops. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`
                                }
                                : {
                                    from: process.env.TWILIO_FROM_NUMBER,
                                    to: phoneE164,
                                    body: `House of Reign: You're in for updates & drops. Reply STOP to opt out, HELP for help. Msg&data rates may apply.`
                                };

                            await client.messages.create(msgParams);
                            console.log(`SMS sent to ${phoneE164}`);
                        } catch (smsError) {
                            console.error('SMS sending error:', smsError);
                            // Don't fail the subscription if SMS fails
                        }
                    }

                    const contactMethod = email ? 'email' : 'SMS';
                    console.log(`New subscriber added via ${contactMethod}: ${email || phone}`);
                    res.json({
                        success: true,
                        message: `Successfully subscribed! You'll receive updates about our upcoming drop via ${contactMethod}.`,
                        subscriberId: this.lastID
                    });
                }
            );
        }
    } catch (error) {
        console.error('Subscribe error:', error);
        return res.status(500).json({
            success: false,
            message: 'Subscription failed. Please try again later.'
        });
    }
});

// Get subscribers count (for admin purposes)
app.get('/api/subscribers/count', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM subscribers WHERE is_active = 1', (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }

        res.json({
            success: true,
            count: row.count
        });
    });
});

// Unsubscribe endpoint
app.post('/api/unsubscribe', (req, res) => {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Valid email address is required'
        });
    }

    db.run(
        'UPDATE subscribers SET is_active = 0 WHERE email = ?',
        [email],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Email not found in our records'
                });
            }

            res.json({
                success: true,
                message: 'Successfully unsubscribed'
            });
        }
    );
});

// Handle SMS replies (STOP/HELP/START) - set this URL in Twilio console
app.post('/api/sms/inbound', express.urlencoded({ extended: false }), async (req, res) => {
    try {
        const from = req.body.From;
        const body = (req.body.Body || '').trim().toUpperCase();

        if (!from) {
            return res.status(400).end();
        }

        // Update database based on reply
        if (body === 'STOP' || body === 'STOP ALL' || body === 'UNSUBSCRIBE' || body === 'CANCEL' || body === 'END' || body === 'QUIT') {
            db.run(
                'UPDATE subscribers SET opted_out = 1 WHERE phone_e164 = ?',
                [from],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                    }
                }
            );

            return res
                .type('text/xml')
                .send(`<Response><Message>You've been unsubscribed. No more messages will be sent. Reply START to resubscribe.</Message></Response>`);
        } 
        else if (body === 'HELP') {
            return res
                .type('text/xml')
                .send(`<Response><Message>House of Reign: For help, reply HELP. To stop, reply STOP. Msg&data rates may apply.</Message></Response>`);
        } 
        else if (body === 'START') {
            db.run(
                'UPDATE subscribers SET opted_out = 0 WHERE phone_e164 = ?',
                [from],
                function(err) {
                    if (err) {
                        console.error('Database error:', err);
                    }
                }
            );

            return res
                .type('text/xml')
                .send(`<Response><Message>You're resubscribed. You'll receive updates from House of Reign.</Message></Response>`);
        }

        // For any other reply, just acknowledge
        return res.status(204).end();
    } catch (error) {
        console.error('SMS inbound error:', error);
        return res.status(500).end();
    }
});

// SMS delivery status webhook (optional)
app.post('/api/sms/status', express.urlencoded({ extended: false }), (req, res) => {
    console.log('SMS Delivery Status:', req.body);
    res.status(204).end();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Frontend: http://localhost:${PORT}`);
});

module.exports = app;

