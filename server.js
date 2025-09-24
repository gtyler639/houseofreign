const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const validator = require('validator');
const path = require('path');

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
                email TEXT UNIQUE NOT NULL,
                phone TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
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
app.post('/api/subscribe', (req, res) => {
    const { email, phone } = req.body;

    // Validation
    if (!email || !phone) {
        return res.status(400).json({
            success: false,
            message: 'Email and phone number are required'
        });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }

    if (!validatePhone(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid 10-digit phone number'
        });
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if email already exists
    db.get('SELECT id FROM subscribers WHERE email = ?', [email], (err, row) => {
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
        db.run(
            'INSERT INTO subscribers (email, phone) VALUES (?, ?)',
            [email, cleanPhone],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to subscribe. Please try again.'
                    });
                }

                console.log(`New subscriber added: ${email}`);
                res.json({
                    success: true,
                    message: 'Successfully subscribed! You\'ll receive updates about our upcoming drop.',
                    subscriberId: this.lastID
                });
            }
        );
    });
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
