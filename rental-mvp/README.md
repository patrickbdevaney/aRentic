# Rental AI Assistant Application Specification

## 1. Overview

The Rental AI Assistant is a web-based application designed to streamline rental property searches and semi-automate outreach to listing agents. Initially conceived as a real estate listing and gamification decentralized application (DApp), it evolved into an AI-powered agent leveraging APIs (Zillow for listings, RentCast for agent contacts, Grok for natural language processing) and OAuth integration (Microsoft Outlook) for programmatic email and calendar invites. 

**Future goals** include full workflow automation, enhanced search granularity, and monetization via USDC smart contract integration.

This specification outlines the application's original concept, current implementation, and planned future features for a fully automated, user-friendly, and monetizable rental search tool.

## 2. Evolution of the Application

### 2.1 Original Concept: Real Estate Listing and Gamification DApp

**Purpose:** A decentralized platform combining real estate listings with gamification to engage users in property searches and transactions.

#### Core Features:
* Marketplace for browsing and listing properties (rentals and sales)
* Gamification mechanics- reward twitter users promoting links of listings to incentivize engagement
* Blockchain integration for decentralized listing management and smart contracts
* Target audience: Real estate enthusiasts, investors, and renters

#### Challenges:
* Complexity of maintaining a decentralized marketplace
* High development overhead for blockchain and gamification
* reinventing the wheel creating market infra onchain, where there is not a large renter market
* profitability of gamification rewards and incentives
* convincing users to transact onchain- friction

**Outcome:** Pivoted to a focused AI-driven solution due to complexity and impracticality.

### 2.2 Current Implementation: AI Agent for Rental Search and Outreach

**Purpose:** Simplifies rental searches and semi-automates outreach, prioritizing accessibility and efficiency.

#### Core Features:
* **Search Interface:** Natural language prompt input (e.g., "2BR apartment in Los Angeles under $3000/month") with a state dropdown (default: NY)
* **AI-Powered Prompt Parsing:** Grok (groq-sdk) parses prompts into parameters (city, state, bedrooms, max price, home type), with regex fallback
* **Zillow API Integration:** Queries `/api/zillow` proxy, returning up to 40 listings with address, price, bedrooms, bathrooms, property type, living area, and Zillow URL
* **Listing Display:** Responsive grid of listing cards showing key details (no description) and a "Generate Email Draft" button
* **Email Draft Generation:** Grok generates tailored inquiry drafts, displayed inline with a "Copy Draft" button
* **Agent Contact via RentCast:** Queries `/api/get-contact` for primary listing's agent details (name, email), staging email/invite if successful
* **OAuth Integration (Microsoft):** MSAL (@azure/msal-browser) enables email and calendar invite sending via Microsoft Graph API (Calendars.ReadWrite, Mail.Send scopes)
* **UI/UX:** Gradient-themed, responsive design with chat log feedback and readable state dropdown (black text on white)

#### Workflow:
Search → view listings → generate/copy drafts → paste into Zillow's contact form or send automatically (if contact found)

#### Current Benefits:
* **Efficiency:** Inquiries for 20+ listings in minutes
* **Accessibility:** User-friendly, ready for A/B testing
* **Reliability:** Zillow's trusted MLS data ensures accurate listings

#### Limitations:
* Zillow API lacks agent emails, requiring RentCast (unreliable, e.g., 405 errors)
* Manual pasting of drafts into Zillow unless RentCast provides email
* Prompt parsing lacks granularity for nuanced preferences
* No monetization model

### 2.3 Future Goals

#### Full Workflow Automation

**Objective:** Automate search to appointment scheduling, eliminating manual steps.

**Implementation:**
* Source API with agent emails (e.g., Realtor.com, Redfin) or improve RentCast reliability
* Add Google OAuth (google-auth-library) for Gmail/Calendar integration (gmail.send, calendar scopes)
* End-to-end flow: Prompt → listings → agent contacts → automated emails/invites

**Impact:** One-click inquiries and appointments.

#### Granular Search Parameter Parsing

**Objective:** Support specific preferences for better result relevance.

**Implementation:**
* Enhance Grok to parse additional parameters (neighborhood, amenities, lease term)
* Map parameters to API query fields or use richer APIs
* Add UI filters (sliders, checkboxes) for search refinement

**Impact:** Tailored listings, improved user satisfaction.

#### USDC Smart Contract Integration for Monetization

**Objective:** Monetize premium features (unlimited searches, automation) with USDC payments.

**Implementation:**
* Solidity smart contract for USDC (ERC-20):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RentalAIAssistant {
    address public owner;
    IERC20 public usdc;
    uint256 public searchFee = 1 * 10**6; // 1 USDC (6 decimals)
    uint256 public automationFee = 5 * 10**6; // 5 USDC
    mapping(address => uint256) public userSearches;

    constructor(address _usdcAddress) {
        owner = msg.sender;
        usdc = IERC20(_usdcAddress);
    }

    function performSearch() external returns (bool) {
        require(usdc.transferFrom(msg.sender, owner, searchFee), "Payment failed");
        userSearches[msg.sender]++;
        return true;
    }

    function automateOutreach() external returns (bool) {
        require(usdc.transferFrom(msg.sender, owner, automationFee), "Payment failed");
        return true;
    }
}
```

* Integrate Web3 wallet (MetaMask) via ethers.js or web3.js for payments
* Add UI payment prompts (e.g., "Pay 1 USDC to search")
* Maintain free tier (e.g., 5 searches/day) with premium features locked
* Backend middleware to verify payments before API calls

**Impact:** Sustainable revenue with transparent blockchain payments.

## 3. Technical Architecture

### 3.1 Current Architecture

* **Frontend:** React, TypeScript, Next.js, Tailwind CSS (inline style jsx), with chat, sidebar, and listings grid
* **Backend:**
  * Zillow Proxy API: `/api/zillow` forwards queries, returns up to 40 listings
  * RentCast API: `/api/get-contact` fetches agent details
* **AI:** Grok for prompt parsing and draft generation
* **OAuth:** Microsoft MSAL and Graph API for email/calendar
* **State Management:** React useState, useEffect

### 3.2 Future Architecture Enhancements

* **API Enhancements:** Use APIs with agent emails or optimize RentCast
* **OAuth Expansion:** Add Google OAuth for Gmail/Calendar
* **Blockchain Integration:**
  * Deploy USDC contract on Ethereum or layer-2 (e.g., Polygon)
  * Use Web3.js/Ethers.js for wallet/contract interactions
  * Add payment verification middleware
* **Database (Optional):** MongoDB/Redis for caching listings/preferences

## 4. User Flow

### 4.1 Current User Flow

1. **Search:** Enter prompt and state; Grok parses, queries Zillow
2. **View Listings:** Up to 40 listing cards with key details and Zillow link
3. **Generate Draft:** Click "Generate Email Draft" for inline draft and "Copy Draft" button
4. **Manual Outreach:** Copy draft, visit Zillow, paste into contact form
5. **Automated Outreach (if contact found):** RentCast provides agent email; authenticate via Microsoft OAuth to send email/invite

### 4.2 Future User Flow

1. **Search with Payment:** Connect wallet, pay 1 USDC, enter granular prompt
2. **Refined Listings:** Grok parses detailed parameters; fetch relevant listings
3. **Automated Outreach:** Retrieve agent emails; send emails/invites via Google/Microsoft OAuth
4. **Appointment Confirmation:** Calendar invites sent, confirmed in chat
5. **Premium Features:** Pay 5 USDC for automation/unlimited searches; free tier for basic searches

## 5. Success Metrics

### Current:
* **Search Speed:** <5 seconds to display listings
* **Draft Generation:** >95% success rate
* **Accessibility:** <10 minutes for 20 inquiries
* **A/B Testing:** Intuitive UI for user testing

### Future:
* **Automation Rate:** >80% listings with automated sends
* **Search Relevance:** >90% relevant results (user surveys)
* **Monetization:** USDC payments and revenue per month
* **Engagement:** Searches per user, premium retention

## 6. Technical Requirements

* **Current:** Next.js, React, TypeScript, Tailwind CSS, Zillow/RentCast/Grok APIs, MSAL, Graph API
* **Future:** Google OAuth, Solidity USDC contract, Web3.js/Ethers.js, optional MongoDB/Redis

## 7. Risks and Mitigations

* **Risk:** Zillow API lacks agent emails; RentCast unreliable
  * **Mitigation:** Use alternative APIs or fix RentCast integration

* **Risk:** Complex prompt parsing reduces relevance
  * **Mitigation:** Fine-tune Grok, add UI filters

* **Risk:** Blockchain complexity and gas fees
  * **Mitigation:** Use layer-2, offer free tier

* **Risk:** OAuth friction or scope limits
  * **Mitigation:** Support Google/Microsoft, streamline UX

## 8. Conclusion

The Rental AI Assistant evolved from a complex DApp to an efficient AI agent for rental searches and outreach, using Zillow and Grok for reliable listings and automation. The current flow is user-friendly and A/B testable. Future enhancements include full automation, granular searches, and USDC monetization for a scalable, profitable platform.