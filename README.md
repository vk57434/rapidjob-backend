# RapidJob Backend

Professional Node.js backend for the RapidJob Android application.

## Tech Stack
- **Node.js & Express**: Web server
- **Firebase Admin SDK**: Authentication and Database (Firestore/RTDB)
- **Cloudinary**: Media storage
- **Razorpay**: Payment processing
- **JWT**: Authorization
- **Multer**: File uploads

## Folder Structure
- `config/`: Configuration files (Firebase, Cloudinary, Razorpay)
- `controllers/`: Request handlers
- `middlewares/`: Express middlewares (Auth, Upload)
- `models/`: Data structures/schemas
- `repositories/`: Data access layer
- `routes/`: API route definitions
- `services/`: Business logic and external integrations
- `utils/`: Helper functions
- `uploads/`: Temporary local file storage
- `logs/`: Application logs

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment variables:
   Copy `.env.example` to `.env` and fill in your credentials.

3. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Auth
- POST `/api/auth/register`
- POST `/api/auth/login`

### Jobs
- GET `/api/jobs`
- POST `/api/jobs`
- PUT `/api/jobs/:id`
- DELETE `/api/jobs/:id`

### Applications
- GET `/api/applications`
- POST `/api/applications`

### Payments
- POST `/api/payment/create-order`
- POST `/api/payment/verify`

### Uploads
- POST `/api/upload/profile-photo`
- POST `/api/upload/company-logo`
- POST `/api/upload/resume`

### Profile
- GET `/api/profile`
- PUT `/api/profile`
