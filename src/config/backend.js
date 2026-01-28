// Backend Configuration
// Replace with your deployed Render URL after deployment
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-app.onrender.com' 
  : 'http://localhost:3000';

module.exports = { BACKEND_URL };
