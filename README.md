# M2Do

Simple to-do app built with Alpine.js, Tailwind CSS, and Firebase Firestore.

## Setup

1. Create a Firebase project and enable Firestore.
2. Enable Email/Password provider in Firebase Authentication.
3. Add your app domain to Authorized domains in Authentication settings (for local testing, localhost is typically pre-added).
4. Copy your Firebase web app config into `firebase-config.js`.
5. Serve this folder with any static web server.

Example:

```bash
python3 -m http.server 5500
```

Open `http://localhost:5500`.

## Notes

- Assignee values for `TO` are currently in `app.js` under `assignees`.
- `HISTORY` is read-only and auto-populates at creation and each update.
- Sign in using email and password.
