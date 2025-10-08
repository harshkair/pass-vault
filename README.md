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

Docker / Local containerized run

1. Build and run with docker-compose (this will start Mongo and the app):

```powershell
docker compose up --build
```

2. Open http://localhost:3000

3. To run only the app (connect to an external Mongo), build the image and run it with the MONGODB_URI env var:

```powershell
docker build -t passvault .
docker run -e MONGODB_URI="mongodb://host.docker.internal:27017/passvault" -p 3000:3000 passvault
```

Notes
- When deploying to a cloud host (Vercel, Railway, Render, etc.) make sure to set `MONGODB_URI` in the provider's environment settings.
- This repo includes a `Dockerfile` and `docker-compose.yml` for easy local testing.
