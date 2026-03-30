const admin = require('firebase-admin');

try {
  // Initialize Firebase Admin SDK
  // Option 1: Using FIREBASE_SERVICE_ACCOUNT_PATH from .env
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const path = require('path');
    const serviceAccount = require(path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account file');
  } 
  // Option 2: Using environment variables directly
  else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Replace escaped newlines with actual newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    });
    console.log('✅ Firebase Admin initialized with environment variables');
  } 
  // Warning if not configured
  else {
    console.warn('⚠️  Firebase Admin credentials not found. Please add FIREBASE_SERVICE_ACCOUNT_PATH or project credentials to .env.');
    // Initialize without credentials (will fail on actual DB calls but allows app to start)
    admin.initializeApp();
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization error:', error.message);
}

const db = admin.firestore();

module.exports = { admin, db };
