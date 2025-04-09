import { http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID_TESTNET!;

if (!projectId) {
  throw new Error(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID_TESTNET is not set in .env.local"
  );
}

export const config = getDefaultConfig({
  appName: "Auth Test App",
  projectId: projectId,
  chains: [mainnet, sepolia],
  ssr: true, // Required for Next.js App Router
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
