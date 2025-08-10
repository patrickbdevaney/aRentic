import { ethers } from "ethers";

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const usdcAbi = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function decimals() public view returns (uint8)",
];

export async function sendUsdcToDeposit(signer: ethers.Signer, amount: number, escrowAddress: string) {
    try {
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
        const decimals = await usdcContract.decimals();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);
        const tx = await usdcContract.transfer(escrowAddress, amountWei, { gasLimit: 100000 });
        const receipt = await tx.wait();
        if (receipt.status !== 1) throw new Error("Transaction failed");
        return receipt.hash;
    } catch (error) {
        throw new Error("USDC transfer failed");
    }
}