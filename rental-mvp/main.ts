import { CdpClient } from "@coinbase/cdp-sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
    try {
        // Initialize CDP client with direct values
        const cdp = new CdpClient({
            apiKeyId: "3f1c24be-d0c9-4fa4-9baf-1de27b40e32b",
            apiKeySecret: "RBiC9NAwHeXz9gp78Nn9+zro/nVftYPySko+cyHaZNXx4lcBFPTecfu2jfQnV8pUwypzK/OVfmefAGs6uUUDEQ==",
            walletSecret: "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgLOigT7Mse4EbZS2tzc9Y38+CKMUi7cNyRQJR31Vb7HGhRANCAAQtWa8DvJvKOPN7t5fp+3xb5zIbcNuajI6wiSK0yvIo4s4RVrqcRtdxkwXDhItmHE2CYN9Vm+gLn0eULzCRVfVn"
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