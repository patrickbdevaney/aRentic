'use client';
import React from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

const wagmiConfig = createConfig({
    chains: [base],
    connectors: [
        coinbaseWallet({
            appName: 'Rental AI Assistant',
            preference: 'smartWalletOnly',
        }),
    ],
    transports: {
        [base.id]: http(),
    },
});

export function AppOnchainProvider({ children }: { children: React.ReactNode }) {
    return (
        <OnchainKitProvider
            apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
            projectId={process.env.NEXT_PUBLIC_CDP_PROJECT_ID}
            chain={base}
            config={{
                appearance: {
                    name: 'Rental AI Assistant',
                    logo: '/logo-48.png',
                    mode: 'auto',
                    theme: 'default',
                },
                wallet: {
                    display: 'modal',
                    termsUrl: '/terms',
                    privacyUrl: '/privacy',
                },
            }}
        >
            <WagmiProvider config={wagmiConfig}>
                {children}
            </WagmiProvider>
        </OnchainKitProvider>
    );
}