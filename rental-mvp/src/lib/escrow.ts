// lib/escrow.ts (Updated to take escrowAddress parameter)

import { ethers } from 'ethers';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC for testing (update to mainnet if needed)

const usdcAbi = [
    'function transfer(address to, uint256 amount) public returns (bool)',
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
];

export async function sendUsdcToDeposit(signer: ethers.Signer, amount: number, escrowAddress: string) {
    try {
        const usdcContract = new ethers.Contract(USDC_ADDRESS, usdcAbi, signer);
        const decimals = await usdcContract.decimals();
        const amountWei = ethers.parseUnits(amount.toString(), decimals);

        const tx = await usdcContract.transfer(escrowAddress, amountWei);
        const receipt = await tx.wait();

        return receipt.hash; // Return txHash
    } catch (error) {
        console.error('Error sending USDC:', error);
        throw new Error(String(error));
    }
}