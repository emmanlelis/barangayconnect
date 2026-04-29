const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();

const parseCorsOrigins = (value) => {
  if (!value) {
    return [];
  }

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

// Initialize Cloudinary (must be before routes that use it)
require('./middleware/upload');

// Connect to database
connectDB();

const app = express();

// CORS configuration (must be first)
const defaultCorsOrigins = ['http://localhost:3000', 'http://localhost:3001', 'exp://192.168.1.100:8081'];
const configuredCorsOrigins = [
  ...parseCorsOrigins(process.env.CORS_ORIGINS),
  ...parseCorsOrigins(process.env.WEB_APP_ORIGIN),
  ...parseCorsOrigins(process.env.MOBILE_APP_ORIGIN),
];
const corsOrigins = configuredCorsOrigins.length > 0 ? configuredCorsOrigins : defaultCorsOrigins;

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware (configured to allow CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Body parser middleware (before rate limiter)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (after body parser)
const defaultMaxRequests = process.env.NODE_ENV === 'development' ? 1000 : 300;
const configuredMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
const effectiveMaxRequests = process.env.NODE_ENV === 'development'
  ? Math.max(configuredMaxRequests || 0, defaultMaxRequests)
  : (configuredMaxRequests || defaultMaxRequests);
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: effectiveMaxRequests,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/blotters', require('./routes/blotters'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/documents', require('./routes/admin-documents'));
app.use('/api/upload', require('./routes/upload'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'BarangayConnect server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
