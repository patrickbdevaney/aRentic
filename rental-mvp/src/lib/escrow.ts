import { ethers } from "ethers";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base Mainnet USDC

const usdcAbi = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
    "function decimals() public view returns (uint8)",
];

export async function sendUsdcToDeposit(signer: ethers.Signer, amount: number, escrowAddress: string) {
    try {
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
        const decimals = await usdcContract.decimals();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);

        // Send transaction with timeout
        const tx = await usdcContract.transfer(escrowAddress, amountWei, {
            gasLimit: 100000,
        });
        const receipt = await Promise.race([
            tx.wait(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Transaction timeout")), 30000)),
        ]);

        if (!receipt || receipt.status !== 1) {
            throw new Error("Transaction failed or not confirmed");
        }

        return receipt.hash; // Return txHash
    } catch (error) {
        console.error("Error sending USDC:", error);
        throw new Error(String(error));
    }
}