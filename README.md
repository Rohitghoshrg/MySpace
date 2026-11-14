# MySpace — Personal Hub

> Your Space. Your Memories. Your Control.

MySpace is a private, personal web app: a self-chat, notes, collections and file hub with Google Drive integration. Only you can see what you save.

**Live demo:** https://myspace-check.vercel.app

## What it does

- **Self-chat & notes** — a private space to talk to yourself, keep notes and organise thoughts
- **Collections & files** — organise media into folders and tags
- **Google Drive** — connect your Drive, browse files and upload photos
- **Private by design** — Google sign-in, your data stays yours

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Payload CMS 4** — collections for media, folders and tags (admin at `/admin`)
- **NextAuth 5** — Google sign-in
- **Google Drive API** — file browsing and uploads
- **Tailwind CSS 4**

## Run it locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

### Environment variables

Copy the names below into a `.env` file (never commit real values):

| Variable | What it is |
| --- | --- |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL, e.g. `http://localhost:3000` |
| `PAYLOAD_SECRET` | Payload CMS secret |
| `DATABASE_URI` | Database connection string |

Google Cloud setup: create a project, configure the OAuth consent screen, create a Web application OAuth client with the redirect URI `http://localhost:3000/api/auth/callback/google` (or your deployed URL + `/api/auth/callback/google`), and enable the Google Drive API.

## Deploy

Deployed on **Vercel** (free Hobby plan). Set the same environment variables in Vercel Production and add the production redirect URI to the Google OAuth client.

## Notes

- This is a web app, not a native Android app — on a phone, open it in Chrome and use **Add to Home screen**.
- Originally exported from Figma Make; the Payload CMS and Google Drive backend need a server, so it is not fully offline.

## Author

**Rohit Ghosh** — CSE student, Southeast University, Dhaka · [Portfolio](https://rohitghoshrg.github.io/My-Portfolio/) · [GitHub](https://github.com/Rohitghoshrg)
