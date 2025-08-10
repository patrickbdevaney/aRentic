"use client";

import React from "react";
import { CDPReactProvider } from "@coinbase/cdp-react";
import { createCDPEmbeddedWalletConnector } from "@coinbase/cdp-wagmi";
import { createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { http } from "wagmi";

const cdpConfig = {
    projectId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID!,
    basePath: "https://api.cdp.coinbase.com",
    useMock: false,
    debugging: false,
};

const wagmiConfig = createConfig({
    chains: [base],
    connectors: [createCDPEmbeddedWalletConnector({ cdpConfig, providerConfig: { chains: [base], transports: { [base.id]: http() } } })],
    transports: { [base.id]: http() },
});

export function AppOnchainProvider({ children }: { children: React.ReactNode }) {
    return (
        <CDPReactProvider config={cdpConfig} app={{ name: "Rental AI Assistant", logoUrl: "/logo-48.png" }}>
            {children}
        </CDPReactProvider>
    );
}