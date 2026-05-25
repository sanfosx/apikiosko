
import admin from 'firebase-admin';

// Initialize Firebase Admin based on individual environment variables
// that are commonly set in Vercel or other platforms.

try {
    if (!admin.apps.length) {
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('Initializing Firebase Admin with individual environment variables');
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                })
            });
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim().length > 0) {
            console.log('Initializing Firebase Admin with FIREBASE_SERVICE_ACCOUNT_JSON');
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        } else {
            console.log('Initializing Firebase Admin with default credentials (local file or Google Cloud context)');
            admin.initializeApp();
        }
    }
} catch (error: any) {
    if (error.code !== 'app/duplicate-app') {
        console.error('CRITICAL: Error en la inicialización de Firebase Admin:', error);
    }
}

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;

try {
    db = admin.firestore();
    auth = admin.auth();
} catch (e) {
    console.warn("Firestore or Auth could not be initialized synchronously. They might fail at runtime if environment variables are missing.");
}

export { db, auth };
export default admin;

