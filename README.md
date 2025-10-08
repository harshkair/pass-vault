# PassVault (Next.js prototype)

Minimal Next.js + TypeScript privacy-first password vault.

Quick features
- Client-side encryption (AES-GCM). Server stores ciphertext only.
- Simple email/password auth with server-side verifier and session tokens.
- Password generator and per-item vault (save / copy / delete).

Prerequisites
- Node 18+ (recommended)
- A MongoDB instance and its connection URI

Local development

1. cd next-app
2. npm install
3. Create a local env file with your Mongo connection string:

```powershell
$env:Name = "MONGODB_URI"; # Windows/Powershell hint
# create .env.local with a single line:
# MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxxx.mongodb.net/passvault?retryWrites=true&w=majority
```

Or create a file named `.env.local` in the `next-app` folder containing:

```
MONGODB_URI=mongodb://localhost:27017/
```

4. Run the dev server:

```powershell
npm run dev
```

Build for production

```powershell
npm run build
npm start
```

Deployment notes
- Vercel: this is ready to deploy as a Next.js app. Add `MONGODB_URI` to the project environment variables in Vercel.
- Docker: you can containerize with a Node image and provide the `MONGODB_URI` at runtime.

Security note
- The master password is never sent to the server; keep it safe. The server stores only ciphertext and metadata needed for key derivation.

Support
- If you want, I can add a GitHub Actions workflow to automatically build and push to Vercel or Docker Hub.
