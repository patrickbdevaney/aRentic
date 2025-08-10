"use client";

import { useState, useEffect } from "react";
import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo } from "@azure/msal-browser";
import { Groq } from "groq-sdk";
import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import { WagmiProvider, createConfig, http, useAccount, useWalletClient } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ethers, BrowserProvider } from "ethers";
import jsPDF from "jspdf";
import "./styles.css";

// Force dynamic rendering for wallet connection
export const dynamic = "force-dynamic";

// Create QueryClient instance
const queryClient = new QueryClient();

// Define interfaces for TypeScript
interface Listing {
  id: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  description: string;
  livingArea: number;
  detailUrl: string;
  agent: AgentContact;
}

interface AgentContact {
  name: string;
  email: string;
  phone?: string;
}

interface ParsedPrompt {
  city?: string;
  state?: string;
  neighborhood?: string;
  bedrooms?: string;
  bathrooms?: string;
  minPrice?: string;
  maxPrice?: string;
  homeType?: string;
}

const usStates = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const cityAliases: { [key: string]: { city: string; state: string } } = {
  nyc: { city: "New York", state: "NY" },
  "new york": { city: "New York", state: "NY" },
  ny: { city: "New York", state: "NY" },
  la: { city: "Los Angeles", state: "CA" },
  sf: { city: "San Francisco", state: "CA" },
  chicago: { city: "Chicago", state: "IL" },
  miami: { city: "Miami", state: "FL" },
};

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

// Web3 configuration
const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "Rental AI Assistant",
      preference: "smartWalletOnly",
    }),
  ],
  transports: {
    [base.id]: http(),
  },
});

const testListing: Listing = {
  id: "test-listing",
  address: "123 Main Street, New York, NY 10001",
  price: 2500,
  bedrooms: 2,
  bathrooms: 1,
  propertyType: "Apartment",
  description: "A cozy 2-bedroom apartment in the heart of New York City, perfect for urban living.",
  livingArea: 800,
  detailUrl: "https://www.example.com/listing/123-main-street",
  agent: {
    name: "Patrick Devaney",
    email: "patrickbdevaney@gmail.com",
    phone: "305-815-2198",
  },
};

// Function to get the next business day at 2:00 PM EDT
const getDefaultBusinessTime = (): string => {
  const now = new Date();
  let targetDate = new Date(now);
  targetDate.setDate(now.getDate() + 3);
  const day = targetDate.getDay();
  if (day === 0) targetDate.setDate(targetDate.getDate() + 1);
  else if (day === 6) targetDate.setDate(targetDate.getDate() + 2);
  targetDate.setHours(14, 0, 0, 0);
  return targetDate.toISOString().split(".")[0];
};

// Function to generate Google Street View URL
const getStreetViewUrl = (address: string) => {
  const encodedAddress = encodeURIComponent(address);
  return `/api/streetview?address=${encodedAddress}`;
};

// Function to generate Coinbase Onramp URL
const getOnrampUrl = (address: string, amount: number) => {
  const params = new URLSearchParams({
    appId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID || "",
    destination: address,
    presetFiatAmount: amount.toString(),
    fiatCurrency: "USD",
    assets: "USDC",
    network: "base",
  });
  return `https://pay.coinbase.com/buy?${params.toString()}`;
};

// Custom hook to convert walletClient to ethers.Signer
const useEthersSigner = () => {
  const { data: walletClient } = useWalletClient();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  useEffect(() => {
    if (walletClient) {
      const provider = new BrowserProvider(walletClient);
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

// Function to link wallet address to user email
const linkWalletAddress = async (email: string, walletAddress: string) => {
  try {
    const response = await fetch("/api/link-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, walletAddress }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to link wallet");
    }
    return true;
  } catch (error) {
    console.error("Error linking wallet:", error);
    return false;
  }
};

// Function to send USDC to escrow
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base Mainnet USDC
const usdcAbi = [
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)',
];

async function sendUsdcToDeposit(signer: ethers.Signer, amount: number, escrowAddress: string) {
  try {
    const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
    const decimals = await usdcContract.decimals();
    const balance = await usdcContract.balanceOf(await signer.getAddress());
    const amountWei = ethers.parseUnits(amount.toString(), decimals);
    if (balance.lt(amountWei)) {
      throw new Error("Insufficient USDC balance");
    }
    const tx = await usdcContract.transfer(escrowAddress, amountWei);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error) {
    console.error('Error sending USDC:', error);
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

// Web3-specific component to isolate useAccount and useWalletClient
function Web3Wrapper({
  children,
  onAccountChange,
}: {
  children: (address: string | undefined, signer: ethers.Signer | null) => React.ReactNode;
  onAccountChange: (address: string | undefined, signer: ethers.Signer | null) => void;
}) {
  const { isConnected, address } = useAccount();
  const signer = useEthersSigner();

  useEffect(() => {
    onAccountChange(address, signer);
  }, [address, signer, onAccountChange]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", margin: "1rem 0" }}>
        <ConnectWallet />
      </div>
      {isConnected && address && (
        <p style={{ color: "#22c55e", textAlign: "center" }}>✅ Wallet Connected: {address}</p>
      )}
      {children(address, signer)}
    </div>
  );
}

// Listing Card component
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
  userWalletAddress,
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
  userWalletAddress: string | null;
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
        onError={(e) => {
          e.currentTarget.src = "/fallback-image.jpg";
        }}
      />
      <p><strong>Address:</strong> {list.address}</p>
      <p><strong>Price:</strong> ${list.price.toLocaleString()}/month</p>
      <p><strong>Beds / Baths:</strong> {list.bedrooms} bed / {list.bathrooms} bath</p>
      <p><strong>Type:</strong> {list.propertyType}</p>
      {list.livingArea > 0 && <p><strong>Area:</strong> {list.livingArea.toLocaleString()} sq ft</p>}
      <p>
        <strong>Listing:</strong>{" "}
        {list.detailUrl !== "#" ? (
          <a href={formatUrl(list.detailUrl)} target="_blank" rel="noopener noreferrer" className="agent-link">
            View Agent Site
          </a>
        ) : (
          <span style={{ color: "#d1d5db" }}>No agent site available</span>
        )}
      </p>
      <button className="generate-draft-button" onClick={() => handleGenerateDraft(list)}>
        📝 Generate Email Draft
      </button>
      {userWalletAddress && (
        <button
          className="onramp-button"
          onClick={() => window.open(getOnrampUrl(userWalletAddress, 0.25), "_blank")}
        >
          💸 Fund Wallet ($0.25)
        </button>
      )}
      {listingDrafts[list.id] && (
        <div className="draft-container">
          <textarea className="draft-textarea" value={listingDrafts[list.id]} readOnly />
          <button
            className="copy-draft-button"
            onClick={() => {
              navigator.clipboard.writeText(listingDrafts[list.id]);
            }}
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
                  🔐 Authorize Microsoft to Send
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
                onClick={() => handleDeposit(list.id, "0.25")}
                className="deposit-button"
                disabled={!userWalletAddress}
              >
                💰 Deposit Escrow ($0.25)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Function to format URL with protocol if missing
const formatUrl = (url: string) => {
  if (!url) return "#";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `http://${url}`;
};

function Home() {
  const [prompt, setPrompt] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("NY");
  const [chat, setChat] = useState<string[]>([
    "Welcome to the Rental AI Assistant! 🏠",
    "Find your perfect rental by entering a search prompt below.",
    "Connect your Coinbase Wallet to deposit USDC for escrow.",
    "Use the test listing below to try the full workflow.",
  ]);
  const [emailDraft, setEmailDraft] = useState<string>("");
  const [calendarTime, setCalendarTime] = useState<string>(getDefaultBusinessTime());
  const [listing, setListing] = useState<Listing | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [showAllListings, setShowAllListings] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [listingDrafts, setListingDrafts] = useState<{ [key: string]: string }>({});
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [finalActionLoading, setFinalActionLoading] = useState<{ [key: string]: boolean }>({});
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  // Initialize MSAL
  useEffect(() => {
    if (!msalInstance) return;

    const initMsal = async () => {
      try {
        await msalInstance.initialize();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setAuthenticated(true);
          setChat((prev) => [...prev, "✅ Found existing Microsoft session. Ready to send email and invite."]);
          if (listing && listing.agent.email) {
            const draft = await generateInquiryDraft(listing);
            setListingDrafts((prev) => ({ ...prev, [listing.id]: draft }));
            setEmailDraft(draft);
            setChat((prev) => [...prev, `📝 Email draft updated for ${listing.address}.`]);
          }
        }
      } catch (e) {
        console.error("MSAL initialization failed:", e);
        setChat((prev) => [...prev, "❌ MSAL initialization failed. You can still search for listings."]);
      }
    };
    initMsal();
  }, [listing]);

  // Regenerate email draft when calendarTime changes
  useEffect(() => {
    if (listing && listing.agent.email) {
      generateInquiryDraft(listing).then((draft) => {
        setListingDrafts((prev) => ({ ...prev, [listing.id]: draft }));
        setEmailDraft(draft);
        setChat((prev) => [...prev, `📝 Email draft updated for ${listing.address} with new calendar time.`]);
      });
    }
  }, [calendarTime, listing]);

  // Link wallet address when account or address changes
  useEffect(() => {
    if (authenticated && account?.username && address) {
      linkWalletAddress(account.username, address).then((success) => {
        if (success) {
          setChat((prev) => [...prev, `✅ Wallet address linked to ${account.username}.`]);
        } else {
          setChat((prev) => [...prev, `⚠️ Failed to link wallet address to ${account.username}.`]);
        }
      });
    }
  }, [authenticated, account, address]);

  const handleLogin = async () => {
    if (!msalInstance) return;

    try {
      const loginRequest = { scopes: msalScopes };
      const response = await msalInstance.loginPopup(loginRequest);
      setAccount(response.account);
      setAuthenticated(true);
      setChat((prev) => [...prev, "✅ Authenticated with Microsoft! Ready to send email and invite."]);
      if (listing && listing.agent.email) {
        const draft = await generateInquiryDraft(listing);
        setListingDrafts((prev) => ({ ...prev, [listing.id]: draft }));
        setEmailDraft(draft);
        setChat((prev) => [...prev, `📝 Email draft updated for ${listing.address}.`]);
      }
    } catch (error) {
      console.error("Login failed:", error);
      setChat((prev) => [...prev, "❌ Authentication failed. Please try again to send."]);
    }
  };

  const parsePromptWithLLM = async (prompt: string): Promise<ParsedPrompt> => {
    if (!groq) return parsePromptFallback(prompt);

    try {
      const response = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [
          {
            role: "system",
            content: `You are an expert rental search query parser. Extract search parameters from the prompt. Return a JSON object with: city, state, neighborhood, bedrooms, bathrooms, minPrice, maxPrice, homeType. Map aliases (e.g., 'NYC' -> city: 'New York', state: 'NY'). Be precise.`,
          },
          { role: "user", content: `Parse this prompt: "${prompt}"` },
        ],
        response_format: { type: "json_object" },
      });
      const content = response.choices[0]?.message?.content?.replace(/```json\s*|\s*```/g, "").trim() || "{}";
      const parsed = JSON.parse(content);
      return {
        city: parsed.city || "New York",
        state: parsed.state || "NY",
        neighborhood: parsed.neighborhood || "",
        bedrooms: parsed.bedrooms || "0",
        bathrooms: parsed.bathrooms || "",
        minPrice: parsed.minPrice || "",
        maxPrice: parsed.maxPrice || "",
        homeType: parsed.homeType || "apartment",
      };
    } catch (error) {
      console.error("Groq parsing error:", error);
      setChat((prev) => [...prev, "⚠️ Could not parse prompt with AI. Using default parsing."]);
      return parsePromptFallback(prompt);
    }
  };

  const parsePromptFallback = (prompt: string): ParsedPrompt => {
    const params: ParsedPrompt = {};
    const lowerPrompt = prompt.toLowerCase();
    const cityMatch = lowerPrompt.match(/([a-zA-Z\s]+),\s*([A-Z]{2})/);
    if (cityMatch) {
      params.city = cityMatch[1].trim();
      params.state = cityMatch[2];
    } else {
      for (const alias in cityAliases) {
        if (lowerPrompt.includes(alias)) {
          params.city = cityAliases[alias].city;
          params.state = cityAliases[alias].state;
          break;
        }
      }
    }
    if (!params.state) params.state = selectedState;
    if (!params.city) {
      params.city = "New York";
      setChat((prev) => [...prev, `⚠️ Location unclear. Defaulting to ${params.city}, ${params.state}.`]);
    }
    const bedroomsMatch = lowerPrompt.match(/(\d+|one|two|three|four|five)\s*(?:br|bedroom|bed)/i);
    if (bedroomsMatch) {
      const numberWords: { [key: string]: string } = { one: "1", two: "2", three: "3", four: "4", five: "5" };
      params.bedrooms = numberWords[bedroomsMatch[1]] || bedroomsMatch[1];
    }
    const bathroomsMatch = lowerPrompt.match(/(\d+|one|two|three|four|five)\s*(?:bath|bathroom)/i);
    if (bathroomsMatch) {
      const numberWords: { [key: string]: string } = { one: "1", two: "2", three: "3", four: "4", five: "5" };
      params.bathrooms = numberWords[bathroomsMatch[1]] || bathroomsMatch[1];
    }
    const underMatch = lowerPrompt.match(/under\s*\$?(\d+)/i);
    if (underMatch) params.maxPrice = underMatch[1];
    const overMatch = lowerPrompt.match(/over\s*\$?(\d+)/i);
    if (overMatch) params.minPrice = overMatch[1];
    const betweenMatch = lowerPrompt.match(/between\s*\$?(\d+)\s*and\s*\$?(\d+)/i);
    if (betweenMatch) {
      params.minPrice = betweenMatch[1];
      params.maxPrice = betweenMatch[2];
    }
    const typeMatch = lowerPrompt.match(/(apartment|house|condo|townhome|flat)/i);
    if (typeMatch) params.homeType = typeMatch[1] === "flat" ? "apartment" : typeMatch[1];
    return params;
  };

  const fetchRentals = async (query: string): Promise<{ primary: Listing | null; all: Listing[] }> => {
    try {
      const params = await parsePromptWithLLM(query);
      const homeTypeMap: { [key: string]: string } = { apartment: "Apartment", house: "Single Family", condo: "Condo", townhome: "Townhouse" };
      const homeType = homeTypeMap[params.homeType || ""] || "Apartment";
      const searchParams = new URLSearchParams({
        city: params.city || "New York",
        state: params.state || "NY",
        ...(params.neighborhood && { neighborhood: params.neighborhood }),
        bedsMin: params.bedrooms || "0",
        ...(params.bathrooms && { bathrooms: params.bathrooms }),
        ...(params.minPrice && { minPrice: params.minPrice }),
        ...(params.maxPrice && { maxPrice: params.maxPrice }),
        home_type: homeType,
      });
      const response = await fetch(`/api/rentcast?${searchParams.toString()}`);
      if (!response.ok) throw new Error(`RentCast Proxy error: ${response.status}`);
      const data = await response.json();
      if (data?.props?.length > 0) {
        const allListings = data.props;
        const primaryListing = allListings.find((prop: any) => prop.address && prop.price && prop.agent.email) || allListings[0];
        return { primary: primaryListing, all: allListings };
      }
      setChat((prev) => [...prev, "❌ No properties found for your criteria. Try a different search."]);
      return { primary: null, all: [] };
    } catch (error) {
      console.error("Fetch Rentals Error:", error);
      setChat((prev) => [...prev, "❌ Failed to fetch listings. Please try again."]);
      return { primary: null, all: [] };
    }
  };

  const generateInquiryDraft = async (listing: Listing): Promise<string> => {
    if (!groq) return "Could not generate inquiry draft.";

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
      const userEmail = authenticated && account?.username ? account.username : "";
      const contractText = `Generic Rental Contract\nProperty Address: ${listing.address}\nParties: Tenant [Your Name], Landlord [${listing.agent.name}]\nTerms: Monthly rent $${listing.price}, 12-month lease\nSignature: ________________________ Date: __________`;
      const prompt = `Generate a professional, concise inquiry email for a rental property to maximize inbox delivery and avoid spam filters.
      - Agent Name: ${listing.agent.name}
      - Property Address: ${listing.address}
      - Express interest in the property in a neutral, professional tone, avoiding promotional phrases, exclamation marks, or urgent language.
      - Inquire about availability, move-in date, and lease terms, keeping the request flexible.
      - Mention a tentative calendar invite sent for ${formattedTime} EDT to discuss the property or schedule a virtual tour, noting flexibility to reschedule if needed.
      - Request options for an in-person or virtual viewing.
      - Ask about the next steps in the rental process.
      - Append the following lease contract text at the end of the email after two new lines: "${contractText}"
      - Use a salutation with the agent's name (e.g., 'Dear ${listing.agent.name},').
      - End with 'Best regards,' followed by two new lines and the user's email address (${userEmail}) if provided, otherwise no signature.
      - Use clear, neutral language, avoiding trigger words like 'free', 'win', or 'now' to reduce spam risk.
      - Return only the message content.`;
      const response = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content || "Could not generate inquiry draft.";
    } catch (error) {
      console.error("Groq API error:", error);
      setChat((prev) => [...prev, "⚠️ Failed to generate email draft. Please try again."]);
      return "Could not generate inquiry draft.";
    }
  };

  const generateContractPdfBase64 = (address: string): string => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Generic Rental Contract", 10, 10);
    doc.setFontSize(12);
    doc.text(`Property Address: ${address}`, 10, 20);
    doc.text("This is a generic rental agreement template.", 10, 30);
    doc.text("Parties: Tenant [Your Name] and Landlord [Agent Name].", 10, 40);
    doc.text("Terms: Monthly rent, 12-month lease, etc.", 10, 50);
    doc.text("Signature: ________________________ Date: __________", 10, 60);
    return doc.output("datauristring").split(",")[1];
  };

  const sendEmailAndCreateInvite = async (selectedListing: Listing, draft: string, eventTime: string) => {
    if (!msalInstance || !selectedListing.agent.email || !draft || !eventTime || isNaN(new Date(eventTime).getTime())) {
      setChat((prev) => [...prev, "⚠️ Missing or invalid information to send email and invite."]);
      return;
    }
    setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: true }));
    setChat((prev) => [...prev, `🚀 Sending inquiry email and creating calendar invite for ${selectedListing.address}...`]);

    let accessToken;
    try {
      const tokenResponse = await msalInstance.acquireTokenSilent({ scopes: msalScopes, account: account! });
      accessToken = tokenResponse.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          const tokenResponse = await msalInstance.acquireTokenPopup({ scopes: msalScopes });
          accessToken = tokenResponse.accessToken;
        } catch (popupError) {
          console.error("Token acquisition failed:", popupError);
          setChat((prev) => [...prev, "❌ Failed to acquire access token. Please try authenticating again."]);
          setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: false }));
          return;
        }
      } else {
        console.error("Silent token acquisition error:", error);
        setChat((prev) => [...prev, `❌ Token acquisition error: ${error instanceof Error ? error.message : "Unknown error"}`]);
        setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: false }));
        return;
      }
    }

    const pdfBase64 = generateContractPdfBase64(selectedListing.address);
    const emailPayload = {
      message: {
        subject: `Inquiry: ${selectedListing.address}`,
        body: { contentType: "HTML", content: draft.replace(/\n/g, "<br>") },
        toRecipients: [{ emailAddress: { address: selectedListing.agent.email } }],
        ...(authenticated && account?.username && { from: { emailAddress: { address: account.username } } }),
        attachments: [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: "RentalContract.pdf",
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          },
        ],
      },
      saveToSentItems: true,
    };

    const eventPayload = {
      subject: `Property Viewing: ${selectedListing.address}`,
      start: { dateTime: eventTime, timeZone: "America/New_York" },
      end: { dateTime: new Date(new Date(eventTime).getTime() + 30 * 60 * 1000).toISOString(), timeZone: "America/New_York" },
      body: {
        contentType: "HTML",
        content: `Discussion or virtual tour for the rental property at ${selectedListing.address}.<br><a href="${formatUrl(selectedListing.detailUrl)}">View Listing Details</a><br>Please check your inbox or spam folder for my accompanying rental inquiry email.`,
      },
      attendees: [{ emailAddress: { name: selectedListing.agent.name || "Agent", address: selectedListing.agent.email }, type: "required" }],
    };

    try {
      const emailResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });
      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        throw new Error(`Microsoft Graph API error (Mail): ${errorData.error?.message || "Unknown error"}`);
      }

      const eventResponse = await fetch("https://graph.microsoft.com/v1.0/me/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload),
      });
      if (!eventResponse.ok) {
        const eventErrorData = await eventResponse.json();
        throw new Error(`Microsoft Graph API error (Event): ${eventErrorData.error?.message || "Unknown error"}`);
      }

      setChat((prev) => [
        ...prev,
        `✅ Inquiry email sent to ${selectedListing.agent.email} with PDF contract attached!`,
        `✅ Calendar invite created for ${selectedListing.address}.`,
        "🎉 All done! Good luck with your rental!",
      ]);
      setListing(null);
      setAllListings([]);
      setEmailDraft("");
      setCalendarTime(getDefaultBusinessTime());
      setListingDrafts({});
      setAuthenticated(false);
      setAccount(null);
    } catch (error) {
      console.error("Microsoft Graph API error:", error);
      setChat((prev) => [...prev, `❌ Failed to send email or create invite: ${error instanceof Error ? error.message : "Unknown error"}`]);
    } finally {
      setFinalActionLoading((prev) => ({ ...prev, [selectedListing.id]: false }));
    }
  };

  const handleGenerateDraft = async (selectedListing: Listing) => {
    setListing(selectedListing);
    const draft = await generateInquiryDraft(selectedListing);
    setListingDrafts((prev) => ({ ...prev, [selectedListing.id]: draft }));
    setEmailDraft(draft);
    setChat((prev) => [
      ...prev,
      `📝 Draft generated for ${selectedListing.address}. ${selectedListing.agent.email ? "Select a time and authenticate to send." : "No agent email found."}`,
    ]);
  };

  const handleDeposit = async (listingId: string, amountUSD: string) => {
    if (!signer || !address) {
      setChat((prev) => [...prev, "⚠️ Please connect your Coinbase Wallet to deposit."]);
      return;
    }
    if (!process.env.NEXT_PUBLIC_ESCROW_ADDRESS) {
      setChat((prev) => [...prev, "⚠️ Escrow address not configured."]);
      return;
    }
    setChat((prev) => [...prev, `🚀 Initiating deposit of $${amountUSD} USDC to escrow...`]);
    try {
      const txHash = await sendUsdcToDeposit(signer, parseFloat(amountUSD), process.env.NEXT_PUBLIC_ESCROW_ADDRESS);
      const response = await fetch("/api/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, txHash, amountUSD, email: account?.username || null, walletAddress: address }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to log transaction");
      }
      const result = await response.json();
      setChat((prev) => [...prev, `✅ Escrow deposit of $${amountUSD} USDC submitted: ${result.txHash}`]);
    } catch (e) {
      console.error("Deposit error:", e);
      setChat((prev) => [...prev, `❌ Deposit failed: ${e instanceof Error ? e.message : "Unknown error"}`]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setListing(null);
    setAllListings([]);
    setEmailDraft("");
    setListingDrafts({});
    setShowAllListings(false);
    setIsLoading(true);
    setChat((prev) => [...prev, `👤 You: ${prompt}`]);

    setChat((prev) => [...prev, "🔍 Searching for rentals..."]);
    const { primary, all } = await fetchRentals(prompt);
    setIsLoading(false);

    if (!primary) {
      setPrompt("");
      return;
    }

    setListing(primary);
    setAllListings(all);
    setChat((prev) => [...prev, `✅ Found ${all.length} rental${all.length === 1 ? "" : "s"}: See listings below.`]);

    if (primary.agent.email) {
      const draft = await generateInquiryDraft(primary);
      setEmailDraft(draft);
      setChat((prev) => [...prev, `📝 Prepared email draft and calendar invite for ${primary.address}. Authenticate to send.`]);
    } else {
      setChat((prev) => [...prev, `📋 View listings below to generate an email draft. No agent email found for ${primary.address}.`]);
    }
    setPrompt("");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <Web3Wrapper
          onAccountChange={(newAddress, newSigner) => {
            setAddress(newAddress);
            setSigner(newSigner);
          }}
        >
          {(address, signer) => (
            <div className="container">
              <div className="header">
                <h1 className="main-title">🏠 Rental AI Assistant</h1>
                <p className="subtitle">The smartest way to find and schedule your next rental with crypto escrow.</p>
              </div>

              <div className="pre-schedule-section">
                <h3>🗓️ Set Your Weekly Availability</h3>
                <p>Tell us when you're free, and our AI will schedule viewings for you. (Coming Soon!)</p>
              </div>

              <div className="main-grid">
                <div className="chat-section">
                  <div className="chat-container">
                    <div className="chat-header">
                      <h2 className="chat-title">
                        💬 Chat
                        {isLoading && <div className="spinner"></div>}
                      </h2>
                    </div>
                    <div className="chat-messages">
                      {chat.map((msg, i) => {
                        const isUser = msg.startsWith("👤 You:");
                        return (
                          <div key={i} className={`message-wrapper ${isUser ? "user-message" : "system-message"}`}>
                            <div className={`message ${isUser ? "user" : "system"}`}>
                              <p>{msg}</p>
                            </div>
                          </div>
                        );
                      })}
                      {isLoading && (
                        <div className="message-wrapper system-message">
                          <div className="message system">
                            <div className="typing-indicator">
                              <div className="dot"></div>
                              <div className="dot"></div>
                              <div className="dot"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="input-area">
                      <div className="input-wrapper">
                        <input
                          type="text"
                          className="chat-input"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                          placeholder="e.g., 2BR 1BA apartment in Williamsburg, New York under $3000"
                          disabled={isLoading}
                        />
                        <select
                          className="state-select"
                          value={selectedState}
                          onChange={(e) => setSelectedState(e.target.value)}
                          disabled={isLoading}
                        >
                          {usStates.map((state) => (
                            <option key={state.code} value={state.code}>
                              {state.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleSubmit}
                          className="send-button"
                          disabled={isLoading || !prompt.trim()}
                        >
                          ✈️ Search
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sidebar">
                  <div className="status-panel">
                    <h3 className="panel-title">⚡ Progress</h3>
                    <div className="status-items">
                      {listing && <div className="status-item complete"><div className="status-dot"></div><span>Property Search</span></div>}
                      {listing?.agent.email && <div className="status-item complete"><div className="status-dot"></div><span>Contact Found</span></div>}
                      {emailDraft && <div className="status-item complete"><div className="status-dot"></div><span>Email & Invite Staged</span></div>}
                      {authenticated && emailDraft && listing?.agent.email && (
                        <div className="status-item complete"><div className="status-dot"></div><span>Authenticated to Send</span></div>
                      )}
                      {address && <div className="status-item complete"><div className="status-dot"></div><span>Wallet Connected</span></div>}
                    </div>
                  </div>
                  {listing && (
                    <div className="listing-panel">
                      <h3 className="panel-title">🏠 Selected Property</h3>
                      <p><strong>Address:</strong> {listing.address}</p>
                      <p><strong>Price:</strong> ${listing.price.toLocaleString()}/month</p>
                      <p><strong>Beds / Baths:</strong> {listing.bedrooms} bed / {listing.bathrooms} bath</p>
                      <p><strong>Type:</strong> {listing.propertyType}</p>
                      <p>
                        <strong>Listing:</strong>{" "}
                        {listing.detailUrl !== "#" ? (
                          <a href={formatUrl(listing.detailUrl)} target="_blank" rel="noopener noreferrer" className="agent-link">
                            View Agent Site
                          </a>
                        ) : (
                          <span style={{ color: "#d1d5db" }}>No agent site available</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="listings-section">
                <h3 className="listings-title">Your Best Matches</h3>
                <p className="listings-subtitle">Make a more detailed prompt to get a better match.</p>
                <div className="listings-grid">
                  <ListingCard
                    list={testListing}
                    handleGenerateDraft={handleGenerateDraft}
                    listingDrafts={listingDrafts}
                    calendarTime={calendarTime}
                    setCalendarTime={setCalendarTime}
                    authenticated={authenticated}
                    handleLogin={handleLogin}
                    sendEmailAndCreateInvite={sendEmailAndCreateInvite}
                    finalActionLoading={finalActionLoading}
                    handleDeposit={handleDeposit}
                    userWalletAddress={address || null}
                  />
                  {allListings.slice(0, showAllListings ? allListings.length : 3).map((list, index) => (
                    <ListingCard
                      key={index}
                      list={list}
                      handleGenerateDraft={handleGenerateDraft}
                      listingDrafts={listingDrafts}
                      calendarTime={calendarTime}
                      setCalendarTime={setCalendarTime}
                      authenticated={authenticated}
                      handleLogin={handleLogin}
                      sendEmailAndCreateInvite={sendEmailAndCreateInvite}
                      finalActionLoading={finalActionLoading}
                      handleDeposit={handleDeposit}
                      userWalletAddress={address || null}
                    />
                  ))}
                </div>
                {allListings.length > 3 && (
                  <button onClick={() => setShowAllListings(!showAllListings)} className="see-more-button">
                    {showAllListings ? "Show Less" : `See More (${allListings.length - 3} more)`}
                  </button>
                )}
              </div>

              {emailDraft && (
                <div className="details-panel">
                  <h3 className="details-title">📋 Review Draft</h3>
                  <div className="details-grid">
                    <div className="email-section">
                      <h4 className="section-title email-title">📝 Inquiry Email</h4>
                      <div className="instructions">
                        <strong>Action:</strong>{" "}
                        {authenticated && listing?.agent.email
                          ? "Review the email and calendar invite."
                          : "Authorize Microsoft to send or copy the draft below."}
                      </div>
                      <textarea
                        className="email-textarea"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <style jsx>{`
                .container {
                  min-height: 100vh;
                  background: linear-gradient(135deg, #0f172a 0%, #581c87 50%, #0f172a 100%);
                  padding: 2rem;
                }
                .header {
                  text-align: center;
                  margin-bottom: 3rem;
                  padding-top: 1rem;
                }
                .main-title {
                  font-size: 2.5rem;
                  font-weight: bold;
                  color: white;
                  margin-bottom: 0.5rem;
                  background: linear-gradient(45deg, #60a5fa, #a855f7);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  background-clip: text;
                }
                .subtitle {
                  font-size: 1.1rem;
                  color: #d1d5db;
                  font-weight: 300;
                }
                .pre-schedule-section {
                  text-align: center;
                  color: white;
                  background: rgba(255, 255, 255, 0.1);
                  padding: 1rem;
                  border-radius: 1rem;
                  max-width: 800px;
                  margin: 2rem auto;
                }
                .listings-subtitle {
                  color: #d1d5db;
                  text-align: center;
                  margin-top: -1rem;
                  margin-bottom: 2rem;
                }
                .see-more-button {
                  display: block;
                  margin: 2rem auto;
                  padding: 0.75rem 2rem;
                  background: transparent;
                  border: 1px solid white;
                  color: white;
                  border-radius: 0.5rem;
                  cursor: pointer;
                }
                .see-more-button:hover {
                  background: rgba(255, 255, 255, 0.1);
                }
                .main-grid {
                  display: grid;
                  grid-template-columns: 2fr 1fr;
                  gap: 2rem;
                  max-width: 1200px;
                  margin: 0 auto 3rem;
                }
                @media (max-width: 768px) {
                  .main-grid {
                    grid-template-columns: 1fr;
                  }
                }
                .chat-section {
                  width: 100%;
                }
                .chat-container {
                  background: rgba(255, 255, 255, 0.05);
                  backdrop-filter: blur(20px);
                  border-radius: 1rem;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }
                .chat-header {
                  background: linear-gradient(45deg, #2563eb, #9333ea);
                  padding: 1rem;
                  border-radius: 1rem 1rem 0 0;
                }
                .chat-title {
                  color: white;
                  font-size: 1.25rem;
                  font-weight: bold;
                  margin: 0;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                }
                .spinner {
                  width: 1.25rem;
                  height: 1.25rem;
                  border: 2px solid transparent;
                  border-top: 2px solid white;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                }
                .chat-messages {
                  height: 20rem;
                  overflow-y: auto;
                  padding: 1.5rem;
                  background: rgba(15, 23, 42, 0.8);
                  display: flex;
                  flex-direction: column;
                  gap: 0.75rem;
                }
                .message-wrapper {
                  display: flex;
                  animation: fadeIn 0.3s ease-out;
                }
                .message-wrapper.user-message {
                  justify-content: flex-end;
                }
                .message-wrapper.system-message {
                  justify-content: flex-start;
                }
                .message {
                  max-width: 80%;
                  padding: 0.75rem 1rem;
                  border-radius: 0.75rem;
                }
                .message.user {
                  background: linear-gradient(45deg, #3b82f6, #9333ea);
                  color: white;
                }
                .message.system {
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  border: 1px solid rgba(255, 255, 255, 0.15);
                }
                .message p {
                  margin: 0;
                  font-size: 0.9rem;
                  line-height: 1.4;
                }
                .typing-indicator {
                  display: flex;
                  gap: 0.4rem;
                }
                .dot {
                  width: 0.4rem;
                  height: 0.4rem;
                  background: #60a5fa;
                  border-radius: 50%;
                  animation: bounce 1.2s ease-in-out infinite both;
                }
                .dot:nth-child(1) {
                  animation-delay: -0.24s;
                }
                .dot:nth-child(2) {
                  animation-delay: -0.12s;
                }
                .input-area {
                  padding: 1rem;
                  background: rgba(15, 23, 42, 0.8);
                  border-top: 1px solid rgba(255, 255, 255, 0.1);
                }
                .input-wrapper {
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                }
                .chat-input {
                  flex: 1;
                  padding: 0.75rem 1rem;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 0.5rem;
                  color: white;
                  outline: none;
                }
                .chat-input::placeholder {
                  color: #9ca3af;
                }
                .chat-input:focus {
                  border-color: #3b82f6;
                }
                .state-select {
                  padding: 0.75rem;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 0.5rem;
                  color: white;
                  cursor: pointer;
                }
                .state-select:focus {
                  border-color: #9333ea;
                }
                .state-select option {
                  color: #000000;
                  background: #ffffff;
                }
                .state-select option:hover {
                  background: #e0e7ff;
                }
                .send-button {
                  background: linear-gradient(45deg, #2563eb, #9333ea);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                }
                .send-button:hover:not(:disabled) {
                  transform: scale(1.05);
                }
                .send-button:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
                .sidebar {
                  display: flex;
                  flex-direction: column;
                  gap: 1.5rem;
                }
                .status-panel,
                .listing-panel {
                  background: rgba(255, 255, 255, 0.05);
                  backdrop-filter: blur(20px);
                  border-radius: 1rem;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  padding: 1.5rem;
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }
                .panel-title {
                  color: white;
                  font-size: 1.25rem;
                  font-weight: bold;
                  margin: 0 0 1rem;
                }
                .status-items {
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                }
                .status-item {
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  padding: 0.5rem;
                  border-radius: 0.5rem;
                  background: rgba(34, 197, 94, 0.1);
                  border: 1px solid rgba(34, 197, 94, 0.2);
                }
                .status-dot {
                  width: 0.5rem;
                  height: 0.5rem;
                  border-radius: 50%;
                  background: #22c55e;
                }
                .status-item span {
                  color: white;
                  font-size: 0.9rem;
                }
                .listing-panel p {
                  color: white;
                  font-size: 0.9rem;
                  margin: 0.5rem 0;
                }
                .agent-link {
                  color: #60a5fa;
                  text-decoration: underline;
                }
                .agent-link:hover {
                  color: #93c5fd;
                }
                .listings-section {
                  max-width: 1200px;
                  margin: 0 auto 3rem;
                }
                .listings-title {
                  color: white;
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin: 0 0 1.5rem;
                }
                .listings-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                  gap: 1.5rem;
                }
                .listing-card {
                  background: rgba(255, 255, 255, 0.05);
                  backdrop-filter: blur(20px);
                  border-radius: 1rem;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  padding: 1.5rem;
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                  transition: transform 0.2s;
                }
                .listing-card:hover {
                  transform: scale(1.02);
                }
                .listing-card p {
                  color: white;
                  font-size: 0.9rem;
                  margin: 0.5rem 0;
                }
                .generate-draft-button {
                  background: linear-gradient(45deg, #3b82f6, #9333ea);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                  margin-top: 1rem;
                  width: 100%;
                }
                .generate-draft-button:hover:not(:disabled) {
                  transform: scale(1.05);
                }
                .generate-draft-button:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
                .onramp-button {
                  background: linear-gradient(45deg, #16a34a, #059669);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                  margin-top: 0.5rem;
                  width: 100%;
                }
                .onramp-button:hover:not(:disabled) {
                  transform: scale(1.05);
                }
                .draft-container {
                  margin-top: 1rem;
                  display: flex;
                  flex-direction: column;
                  gap: 0.75rem;
                }
                .draft-textarea {
                  width: 100%;
                  height: 6rem;
                  padding: 0.75rem;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 0.5rem;
                  color: white;
                  resize: none;
                  outline: none;
                }
                .datetime-input {
                  height: 2.5rem;
                }
                .copy-draft-button {
                  background: linear-gradient(45deg, #16a34a, #059669);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                }
                .copy-draft-button:hover {
                  transform: scale(1.05);
                }
                .auth-button {
                  background: linear-gradient(45deg, #2563eb, #9333ea);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                }
                .auth-button:hover {
                  transform: scale(1.05);
                }
                .execute-button {
                  background: linear-gradient(45deg, #16a34a, #059669);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                }
                .execute-button:hover:not(:disabled) {
                  transform: scale(1.05);
                }
                .execute-button:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
                .deposit-button {
                  background: linear-gradient(45deg, #d97706, #b45309);
                  color: white;
                  font-weight: 600;
                  padding: 0.75rem 1.5rem;
                  border: none;
                  border-radius: 0.5rem;
                  cursor: pointer;
                  margin-top: 0.5rem;
                  width: 100%;
                }
                .deposit-button:hover:not(:disabled) {
                  transform: scale(1.05);
                }
                .deposit-button:disabled {
                  opacity: 0.5;
                  cursor: not-allowed;
                }
                .details-panel {
                  max-width: 1200px;
                  margin: 0 auto;
                  background: rgba(255, 255, 255, 0.05);
                  backdrop-filter: blur(20px);
                  border-radius: 1rem;
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  padding: 1.5rem;
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }
                .details-title {
                  color: white;
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin: 0 0 1.5rem;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 1.5rem;
                }
                .email-section {
                  display: flex;
                  flex-direction: column;
                  gap: 1rem;
                }
                .section-title {
                  font-size: 1.1rem;
                  font-weight: 600;
                  margin: 0;
                }
                .email-title {
                  color: #93c5fd;
                }
                .instructions {
                  padding: 0.75rem;
                  background: rgba(30, 64, 175, 0.2);
                  border-left: 3px solid #60a5fa;
                  color: #e0e7ff;
                  font-size: 0.9rem;
                  border-radius: 0.5rem;
                }
                .email-textarea {
                  width: 100%;
                  height: 10rem;
                  padding: 1rem;
                  background: rgba(255, 255, 255, 0.05);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 0.5rem;
                  color: white;
                  resize: none;
                  outline: none;
                }
                .email-textarea:focus {
                  border-color: #3b82f6;
                }
                @keyframes fadeIn {
                  from {
                    opacity: 0;
                    transform: translateY(10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                @keyframes spin {
                  to {
                    transform: rotate(360deg);
                  }
                }
                @keyframes bounce {
                  0%,
                  80%,
                  100% {
                    transform: scale(0);
                  }
                  40% {
                    transform: scale(1);
                  }
                }
              `}</style>
            </div>
          )}
        </Web3Wrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

export default Home;