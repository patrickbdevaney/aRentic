"use client";

import { useState, useEffect } from "react";
import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";
import { Groq } from "groq-sdk";
import { useAccount, useWalletClient } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserProvider } from "ethers";
import { AppOnchainProvider } from "@/components/OnchainProvider";
import { sendUsdcToDeposit } from "@/lib/escrow";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";
import "./styles.css";

export const dynamic = "force-dynamic";

const queryClient = new QueryClient();

interface Listing {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  description: string;
  detailUrl: string;
  agent: { name: string; email: string; phone?: string };
}

interface ParsedPrompt {
  city?: string;
  state?: string;
  bedrooms?: string;
  maxPrice?: string;
  homeType?: string;
}

const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "",
    authority: "https://login.microsoftonline.com/consumers",
    redirectUri: typeof window !== "undefined" ? window.location.origin : "/",
  },
};

const msalInstance = typeof window !== "undefined" ? new PublicClientApplication(msalConfig) : null;
const msalScopes = ["Calendars.ReadWrite", "Mail.Send"];
const groq = typeof window !== "undefined" ? new Groq({ apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "", dangerouslyAllowBrowser: true }) : null;

const testListing: Listing = {
  id: "test-listing",
  address: "123 Main Street, New York, NY 10001",
  price: 2500,
  bedrooms: 2,
  bathrooms: 1,
  propertyType: "Apartment",
  description: "A cozy 2-bedroom apartment in New York City.",
  detailUrl: "https://www.example.com/listing/123-main-street",
  agent: { name: "Patrick Devaney", email: "patrickbdevaney@gmail.com", phone: "305-815-2198" },
};

const getDefaultBusinessTime = (): string => {
  const now = new Date();
  let targetDate = new Date(now);
  targetDate.setDate(now.getDate() + 3);
  if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
  else if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);
  targetDate.setHours(14, 0, 0, 0);
  return targetDate.toISOString().split(".")[0];
};

const getStreetViewUrl = (address: string) => `/api/streetview?address=${encodeURIComponent(address)}`;

const useEthersSigner = () => {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<any>(null);

  useEffect(() => {
    if (walletClient) {
      const provider = new BrowserProvider(walletClient.transport, base);
      provider.getSigner().then(setSigner).catch((error) => {
        console.error("Failed to get signer:", error);
        setSigner(null);
      });
    } else {
      setSigner(null);
    }
  }, [walletClient]);

  return signer;
};

function ListingCard({
  list,
  handleGenerateDraft,
  listingDrafts,
  calendarTime,
  setCalendarTime,
  authenticated,
  handleLogin,
  sendEmailAndCreateInvite,
  finalActionLoading,
  handleDeposit,
}: {
  list: Listing;
  handleGenerateDraft: (listing: Listing) => void;
  listingDrafts: { [key: string]: string };
  calendarTime: string;
  setCalendarTime: (time: string) => void;
  authenticated: boolean;
  handleLogin: () => void;
  sendEmailAndCreateInvite: (listing: Listing, draft: string, eventTime: string) => void;
  finalActionLoading: { [key: string]: boolean };
  handleDeposit: (listingId: string, amountUSD: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string>("/fallback-image.jpg");

  useEffect(() => {
    setImageUrl(getStreetViewUrl(list.address));
  }, [list.address]);

  return (
    <div className="listing-card">
      <img
        src={imageUrl}
        alt={`Street View of ${list.address}`}
        style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "0.5rem" }}
        onError={(e) => (e.currentTarget.src = "/fallback-image.jpg")}
      />
      <p><strong>Address:</strong> {list.address}</p>
      <p><strong>Price:</strong> ${list.price.toLocaleString()}/month</p>
      <p><strong>Beds / Baths:</strong> {list.bedrooms} bed / {list.bathrooms} bath</p>
      <p><strong>Type:</strong> {list.propertyType}</p>
      <button className="generate-draft-button" onClick={() => handleGenerateDraft(list)}>
        📝 Generate Email Draft
      </button>
      {listingDrafts[list.id] && (
        <div className="draft-container">
          <textarea className="draft-textarea" value={listingDrafts[list.id]} readOnly />
          <button
            className="copy-draft-button"
            onClick={() => navigator.clipboard.writeText(listingDrafts[list.id])}
          >
            📋 Copy Draft
          </button>
          {list.agent.email && (
            <>
              <input
                type="datetime-local"
                className="draft-textarea datetime-input"
                value={calendarTime}
                onChange={(e) => setCalendarTime(e.target.value)}
              />
              {!authenticated ? (
                <button onClick={handleLogin} className="auth-button">
                  🔐 Authorize Microsoft
                </button>
              ) : (
                <button
                  onClick={() => sendEmailAndCreateInvite(list, listingDrafts[list.id], calendarTime)}
                  className="execute-button"
                  disabled={finalActionLoading[list.id] || !list.agent.email}
                >
                  {finalActionLoading[list.id] ? "Sending..." : "🚀 Send Email & Invite"}
                </button>
              )}
              <button
                onClick={() => handleDeposit(list.id, (list.price * 0.15).toFixed(2))}
                className="deposit-button"
              >
                💰 Deposit (${(list.price * 0.15).toFixed(2)})
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Home() {
  const [prompt, setPrompt] = useState<string>("");
  const [chat, setChat] = useState<string[]>(["Welcome to aRentic! 🏠 Enter a search prompt to find rentals."]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [listingDrafts, setListingDrafts] = useState<{ [key: string]: string }>({});
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [account, setAccount] = useState<any>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);
  const [calendarTime, setCalendarTime] = useState<string>(getDefaultBusinessTime());
  const [finalActionLoading, setFinalActionLoading] = useState<{ [key: string]: boolean }>({});

  const signer = useEthersSigner();
  const { isConnected, address } = useAccount();

  useEffect(() => {
    if (isConnected && address) {
      setUserWalletAddress(address);
      setChat((prev) => [...prev, `✅ Wallet Connected: ${address}`]);
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (!msalInstance) return;
    msalInstance.initialize().then(() => {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setAuthenticated(true);
        setChat((prev) => [...prev, "✅ Microsoft session found."]);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!msalInstance) return;
    try {
      const response = await msalInstance.loginPopup({ scopes: msalScopes });
      setAccount(response.account);
      setAuthenticated(true);
      setChat((prev) => [...prev, "✅ Authenticated with Microsoft."]);
    } catch (error) {
      setChat((prev) => [...prev, "❌ Authentication failed."]);
    }
  };

  const parsePrompt = async (prompt: string): Promise<ParsedPrompt> => {
    if (!groq) return { city: "New York", state: "NY", homeType: "apartment" };
    try {
      const response = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [
          {
            role: "system",
            content: `Parse rental search prompt into JSON with fields: city, state, bedrooms, maxPrice, homeType.`,
          },
          { role: "user", content: `Parse: "${prompt}"` },
        ],
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
      return {
        city: parsed.city || "New York",
        state: parsed.state || "NY",
        bedrooms: parsed.bedrooms || "0",
        maxPrice: parsed.maxPrice || "",
        homeType: parsed.homeType || "apartment",
      };
    } catch (error) {
      setChat((prev) => [...prev, "⚠️ Prompt parsing failed. Using defaults."]);
      return { city: "New York", state: "NY", homeType: "apartment" };
    }
  };

  const fetchRentals = async (query: string) => {
    try {
      const params = await parsePrompt(query);
      const searchParams = new URLSearchParams({
        city: params.city || "New York",
        state: params.state || "NY",
        bedsMin: params.bedrooms || "0",
        ...(params.maxPrice && { maxPrice: params.maxPrice }),
        home_type: params.homeType || "Apartment",
      });
      const response = await fetch(`/api/rentcast?${searchParams.toString()}`);
      if (!response.ok) throw new Error("RentCast API error");
      const data = await response.json();
      if (data.props?.length) {
        setListing(data.props[0]);
        setAllListings(data.props.slice(0, 3));
        setChat((prev) => [...prev, `✅ Found ${data.props.length} rentals.`]);
      } else {
        setChat((prev) => [...prev, "❌ No properties found."]);
      }
    } catch (error) {
      setChat((prev) => [...prev, "❌ Failed to fetch listings."]);
    }
  };

  const generateInquiryDraft = async (listing: Listing): Promise<string> => {
    if (!groq) return "Could not generate draft.";
    try {
      const formattedTime = new Date(calendarTime).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      });
      const userEmail = account?.username || "";
      const prompt = `Generate a concise inquiry email for ${listing.address} to ${listing.agent.name}. Mention interest, availability, move-in date, lease terms, and a calendar invite for ${formattedTime} EDT. End with 'Best regards,' and ${userEmail || "no signature"}.`;
      const response = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content || "Could not generate draft.";
    } catch (error) {
      setChat((prev) => [...prev, "⚠️ Failed to generate draft."]);
      return "Could not generate draft.";
    }
  };

  const sendEmailAndCreateInvite = async (selectedListing: Listing, draft: string, eventTime: string) => {
    if (!msalInstance || !selectedListing.agent.email || !draft || isNaN(new Date(eventTime).getTime())) {
      setChat((prev) => [...prev, "⚠️ Missing required information."]);
      return;
    }
    setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: true }));
    try {
      const tokenResponse = await msalInstance.acquireTokenSilent({ scopes: msalScopes, account });
      const accessToken = tokenResponse.accessToken;

      const emailPayload = {
        message: {
          subject: `Inquiry: ${selectedListing.address}`,
          body: { contentType: "HTML", content: draft.replace(/\n/g, "<br>") },
          toRecipients: [{ emailAddress: { address: selectedListing.agent.email } }],
          from: { emailAddress: { address: account.username } },
        },
        saveToSentItems: true,
      };

      const eventPayload = {
        subject: `Property Viewing: ${selectedListing.address}`,
        start: { dateTime: eventTime, timeZone: "America/New_York" },
        end: { dateTime: new Date(new Date(eventTime).getTime() + 30 * 60 * 1000).toISOString(), timeZone: "America/New_York" },
        body: { contentType: "HTML", content: `Discussion for ${selectedListing.address}.` },
        attendees: [{ emailAddress: { name: selectedListing.agent.name, address: selectedListing.agent.email }, type: "required" }],
      };

      await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });

      await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      });

      setChat((prev) => [...prev, `✅ Email and invite sent for ${selectedListing.address}.`]);
    } catch (error) {
      setChat((prev) => [...prev, `❌ Failed to send email/invite: ${error instanceof Error ? error.message : "Unknown error."}`]);
    } finally {
      setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: false }));
    }
  };

  const handleDeposit = async (listingId: string, amountUSD: string) => {
    if (!signer || !userWalletAddress) {
      setChat((prev) => [...prev, "⚠️ Please connect wallet."]);
      return;
    }
    try {
      const txHash = await sendUsdcToDeposit(signer, parseFloat(amountUSD), process.env.NEXT_PUBLIC_ESCROW_ADDRESS!);
      await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, txHash, amountUSD, email: account?.username, walletAddress: userWalletAddress }),
      });
      setChat((prev) => [...prev, `✅ Escrow deposit tx: ${txHash}`]);
    } catch (error) {
      setChat((prev) => [...prev, "❌ Deposit failed."]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setChat((prev) => [...prev, `👤 You: ${prompt}`]);
    await fetchRentals(prompt);
    setIsLoading(false);
    setPrompt("");
  };

  return (
    <div className="container">
      <h1>aRentic</h1>
      <div className="chat-section">
        <div className="chat-messages">
          {chat.map((msg, i) => (
            <p key={i} className={msg.startsWith("👤") ? "user-message" : "system-message"}>{msg}</p>
          ))}
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="e.g., 2BR apartment in New York under $3000"
          disabled={isLoading}
        />
        <button onClick={handleSubmit} disabled={isLoading || !prompt.trim()}>
          Search
        </button>
      </div>
      <div className="listings-section">
        {[testListing, ...allListings].map((list) => (
          <ListingCard
            key={list.id}
            list={list}
            handleGenerateDraft={async (l) => {
              const draft = await generateInquiryDraft(l);
              setListingDrafts((prev) => ({ ...prev, [l.id]: draft }));
              setChat((prev) => [...prev, `📝 Draft generated for ${l.address}.`]);
            }}
            listingDrafts={listingDrafts}
            calendarTime={calendarTime}
            setCalendarTime={setCalendarTime}
            authenticated={authenticated}
            handleLogin={handleLogin}
            sendEmailAndCreateInvite={sendEmailAndCreateInvite}
            finalActionLoading={finalActionLoading}
            handleDeposit={handleDeposit}
          />
        ))}
      </div>
    </div>
  );
}

const config = createConfig({
  chains: [base],
  connectors: [coinbaseWallet({ appName: "Rental AI Assistant", preference: "smartWalletOnly" })],
  transports: { [base.id]: http() },
});

export default function Page() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppOnchainProvider>
          <Home />
        </AppOnchainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}