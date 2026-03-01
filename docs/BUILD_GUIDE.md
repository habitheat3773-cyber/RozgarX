# ============================================================
# ROZGARX - COMPLETE BUILD & DEPLOY GUIDE
# ============================================================

## STEP 1: BACKEND SETUP (30 minutes)

### 1.1 Create Supabase Project
1. Go to https://supabase.com → New Project
2. Name: "rozgarx" | Region: Asia South (Mumbai)
3. Copy your DATABASE_URL from Settings > Database

### 1.2 Run Database Schema
1. Open Supabase SQL Editor
2. Copy-paste the full SQL from db.js (the comment block at bottom)
3. Click Run → all tables created!

### 1.3 Deploy Backend to Render
```bash
# Push your code to GitHub first
git init
git add .
git commit -m "Initial RozgarX backend"
git remote add origin https://github.com/YOUR_USERNAME/rozgarx-backend.git
git push -u origin main
```

Then on Render.com:
1. New > Web Service > Connect GitHub > Select repo
2. Build Command: `npm install`
3. Start Command: `node index.js`
4. Add all environment variables from .env.example
5. Deploy!

Your API will be live at: `https://rozgarx-backend.onrender.com`

---

## STEP 2: FLUTTER APP BUILD (1 hour)

### 2.1 Install Flutter
```bash
# Download Flutter SDK
# https://flutter.dev/docs/get-started/install

# Verify installation
flutter doctor
```

### 2.2 Create Flutter Project
```bash
flutter create rozgarx_app
cd rozgarx_app
```

### 2.3 Replace Files
Copy all files from flutter_screens/lib/ into your project's lib/ folder.
Copy pubspec.yaml to replace the default one.

### 2.4 Configure API URL
In lib/services/api_service.dart, update:
```dart
static const String baseUrl = 'https://rozgarx-backend.onrender.com/api';
```

### 2.5 Configure Firebase (for FCM push only)
```bash
# Install Firebase CLI
npm install -g firebase-tools
firebase login

# Initialize Firebase in Flutter project
flutterfire configure
```
This creates google-services.json automatically.

### 2.6 Configure AdMob
1. Go to https://admob.google.com → Create App
2. Get your App ID and Ad Unit IDs
3. Add to AndroidManifest.xml:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"/>
```

### 2.7 Run on Device
```bash
# Connect Android phone (USB debugging ON)
flutter devices

# Run debug build
flutter run

# If no errors, build release APK
```

---

## STEP 3: BUILD RELEASE APK

### 3.1 Generate Keystore (DO THIS ONCE, SAVE IT SAFELY!)
```bash
keytool -genkey -v \
  -keystore rozgarx-release.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias rozgarx
```
Fill in: Name, Org, City, State, Country, Password
⚠️ SAVE the .jks file and passwords - you need them FOREVER for updates!

### 3.2 Configure Signing
Create file: android/key.properties
```
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=rozgarx
storeFile=../../rozgarx-release.jks
```

In android/app/build.gradle, add before android {}:
```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

And update signingConfigs:
```gradle
signingConfigs {
    release {
        keyAlias keystoreProperties['keyAlias']
        keyPassword keystoreProperties['keyPassword']
        storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
        storePassword keystoreProperties['storePassword']
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 3.3 Build Release APK
```bash
# Build APK (for direct distribution or testing)
flutter build apk --release

# APK will be at:
# build/app/outputs/flutter-apk/app-release.apk

# Build App Bundle (for Google Play)
flutter build appbundle --release

# Bundle will be at:
# build/app/outputs/bundle/release/app-release.aab
```

---

## STEP 4: GOOGLE PLAY PUBLISHING

### 4.1 Create Developer Account
1. Go to https://play.google.com/console
2. Pay one-time ₹1,700 (~$25 USD) registration
3. Fill developer profile

### 4.2 Create App Listing
1. Create app > Android > Free > RozgarX
2. Fill in:
   - App name: RozgarX – Sarkari Job Alert
   - Short description (80 chars): India's AI-powered government job alert app
   - Full description: (use your marketing copy)
3. Add screenshots (at least 2 phone screenshots)
4. Add app icon (512x512 PNG)
5. Add feature graphic (1024x500 PNG)

### 4.3 Upload AAB
1. Production > Releases > Create Release
2. Upload app-release.aab
3. Add release notes

### 4.4 Set Up Pricing
1. Free app (monetized via AdMob + In-app subscriptions)
2. Enable In-app purchases for subscriptions

### 4.5 Submit for Review
- Review takes 3-7 business days for first submission
- After approval, app is live on Play Store!

---

## STEP 5: ADMIN PANEL DEPLOY

### 5.1 Deploy to Vercel (Free)
```bash
# Install Vercel CLI
npm i -g vercel

# In admin/ folder
cd rozgarx/admin
vercel --prod
```

Your admin panel: https://rozgarx-admin.vercel.app

### 5.2 Create First Admin User
Run this SQL in Supabase:
```sql
INSERT INTO admin_users (username, password_hash)
VALUES (
  'admin',
  -- Generate hash: node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword123!', 12))"
  '$2a$12$YOUR_HASHED_PASSWORD_HERE'
);
```

---

## STEP 6: GITHUB ACTIONS CI/CD (Auto APK Build)

Create `.github/workflows/build.yml`:
```yaml
name: Build Flutter APK

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.16.0'
      
      - name: Get dependencies
        run: flutter pub get
        working-directory: ./flutter_screens
      
      - name: Build APK
        run: flutter build apk --release
        working-directory: ./flutter_screens
      
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: rozgarx-apk
          path: flutter_screens/build/app/outputs/flutter-apk/app-release.apk
```

Every push to main → auto-builds APK downloadable from GitHub Actions!

---

## ENVIRONMENT VARIABLES CHECKLIST

Backend (Render):
- [ ] DATABASE_URL (Supabase)
- [ ] JWT_SECRET (64+ chars random)
- [ ] JWT_REFRESH_SECRET (64+ chars random)
- [ ] JWT_ADMIN_SECRET (64+ chars random)
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] GEMINI_API_KEY
- [ ] FIREBASE_PROJECT_ID
- [ ] FIREBASE_CLIENT_EMAIL
- [ ] FIREBASE_PRIVATE_KEY
- [ ] MSG91_AUTH_KEY (optional, for OTP)
- [ ] GOOGLE_CLIENT_ID

Flutter App:
- [ ] google-services.json (Firebase)
- [ ] AdMob App ID in AndroidManifest.xml
- [ ] API baseUrl in api_service.dart

---

## TROUBLESHOOTING COMMON ERRORS

### Flutter build fails:
```bash
flutter clean
flutter pub get
flutter build apk --release
```

### Database connection fails:
- Check DATABASE_URL in Render env vars
- Enable connection pooling in Supabase

### FCM notifications not working:
- Check FIREBASE_PRIVATE_KEY has \n as actual newlines
- Verify package name matches Firebase project

### Razorpay payment fails:
- Use TEST keys during development
- Switch to LIVE keys before launch

---

## FOLDER STRUCTURE SUMMARY

```
rozgarx/
├── backend/
│   ├── index.js              ← Main server
│   ├── db.js                 ← DB connection + schema
│   ├── package.json
│   ├── .env.example
│   ├── routes/
│   │   ├── auth.js           ← Login/Register/OTP/Google
│   │   ├── jobs.js           ← Jobs CRUD + search + filter
│   │   ├── saved.js          ← Save/unsave jobs
│   │   ├── profile.js        ← User profile
│   │   ├── study.js          ← Study material
│   │   ├── subscription.js   ← Razorpay payments
│   │   ├── notifications.js  ← FCM push
│   │   └── admin.js          ← Admin panel API
│   ├── middleware/
│   │   └── auth.js           ← JWT middleware
│   └── scrapers/
│       └── jobScraper.js     ← RSS + AI scraper
│
├── flutter_screens/
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart
│       ├── theme/app_theme.dart
│       ├── models/user_model.dart (+ job model)
│       ├── services/api_service.dart
│       ├── providers/
│       │   ├── auth_provider.dart
│       │   ├── jobs_provider.dart
│       │   └── theme_provider.dart
│       └── screens/
│           ├── home_screen.dart
│           ├── job_detail_screen.dart
│           ├── login_screen.dart (+ register + otp)
│           └── main_navigation.dart (+ providers)
│
└── admin/
    └── index.html            ← Complete React admin panel
```

---

## LAUNCH CHECKLIST

Before going live:
- [ ] Test all API endpoints with Postman
- [ ] Test app on real Android device
- [ ] Set up AdMob ad units
- [ ] Switch Razorpay to live keys
- [ ] Add Privacy Policy page (required for Play Store)
- [ ] Add Terms & Conditions
- [ ] Test payment flow end-to-end
- [ ] Test push notifications
- [ ] Test offline mode
- [ ] Create admin account
- [ ] Approve first set of scraped jobs
