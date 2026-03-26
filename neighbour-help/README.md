This is a Next.js project for NeighborHelp.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Mock Auth Mode (No Backend Required)

You can test login and sign up before the ASP.NET backend and database are ready.

How it works:
- The app tries real API auth endpoints first.
- If backend is unavailable, auth automatically falls back to local mock auth in browser storage.
- Mock users and session are stored temporarily in localStorage.

Demo accounts:
- Homeowner: homeowner@neighborhelp.test / Password123!
- Handyman: handyman@neighborhelp.test / Password123!
- Admin: admin@neighborhelp.test / Password123!

Optional setting:
- Set NEXT_PUBLIC_USE_MOCK_AUTH=true in your local env file to always use mock auth in browser.

Reset mock data:
- While logged in, open the navbar user menu and click Reset Mock Data.
- This clears temporary mock users/session and reseeds demo accounts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
