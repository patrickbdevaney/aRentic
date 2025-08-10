import { ethers } from 'ethers';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base Mainnet USDC
const usdcAbi = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
];

export async function sendUsdcToDeposit(signer: ethers.Signer, amount: number, escrowAddress: string) {
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