const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Config
require('./firebase-admin');

// Standard Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');
const applicationRoutes = require('./routes/application.routes');
const paymentRoutes = require('./routes/payment.routes');
const uploadRoutes = require('./routes/upload.routes');
const notificationRoutes = require('./routes/notification.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const companyRoutes = require('./routes/company.routes');
const userRoutes = require('./routes/user.routes');
const emailRoutes = require('./routes/email.routes');
const adminRoutes = require('./routes/admin.routes');

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', userRoutes); // /api/profile
app.use('/api/email', emailRoutes);

app.get('/', (req, res) => {
    res.send('RapidJob Backend API is running...');
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Something went wrong!',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
