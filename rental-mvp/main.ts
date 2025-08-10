import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
    try {
        // Initialize CDP client with direct values
        const cdp = new CdpClient({

        });

        // Create EVM account
        const account = await cdp.evm.createAccount();
        console.log(`Created EVM account: ${account.address}`);


    } catch (error) {
        console.error("Error creating account:", error);
        process.exit(1);
    }
}

// Run the main function
main();