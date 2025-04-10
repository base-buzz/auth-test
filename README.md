This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Version v0.1

This initial version demonstrates a working implementation of **Sign-In With Ethereum (SIWE)** using NextAuth.js. Users can connect their Ethereum wallet (e.g., MetaMask) and authenticate with the application by signing a message.

## Current Functionality

- Connect Wallet button.
- Sign-In With Ethereum flow via NextAuth.js.
- Displays user's session information (address) upon successful authentication.
- Sign Out functionality.

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- An Ethereum wallet browser extension (e.g., MetaMask)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd <your-repository-directory>
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the project directory. Add the necessary environment variables. Common variables for a NextAuth setup include:

    ```ini
    # A secret key used for signing tokens, JWTs, etc. Generate a strong random string.
    # You can generate one using: openssl rand -base64 32
    NEXTAUTH_SECRET=YOUR_NEXTAUTH_SECRET

    # The canonical URL of your application deployment.
    # For local development:
    NEXTAUTH_URL=http://localhost:3000

    # You might need other variables depending on your specific SIWE/wallet configuration
    # (e.g., RPC provider URLs). Please check the source code (e.g., src/app/api/auth/[...nextauth]/route.ts)
    # for any other required variables.
    ```

    **Important:** Replace `YOUR_NEXTAUTH_SECRET` with a securely generated secret. Do _not_ commit your `.env.local` file to Git.

4.  **Run the development server:**

    ```bash
    npm run dev
    # or
    yarn dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the application. You should be able to connect your wallet and sign in.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
