import PDFDocument from 'pdfkit';
import getStream from 'get-stream';

export async function generateLeasePdf({
    tenantEmail,
    agentName,
    address,
    price
}: {
    tenantEmail: string;
    agentName: string;
    address: string;
    price: number
}) {
    const doc = new PDFDocument();

    doc.fontSize(25).text('Tentative Lease Contract', { align: 'center' });
    doc.fontSize(12).text(`Tenant: ${tenantEmail}`);
    doc.text(`Agent: ${agentName}`);
    doc.text(`Property: ${address}`);
    doc.text(`Rent: ${price}/month`);
    doc.text('This is a tentative agreement pending viewing and final signing.');

    doc.end();

    // Solution 1: Type assertion (quickest fix)
    return await (getStream as any).buffer(doc);

    // Alternative Solution 2: Manual buffer collection
    // return new Promise<Buffer>((resolve, reject) => {
    //   const chunks: Buffer[] = [];
    //   doc.on('data', (chunk) => chunks.push(chunk));
    //   doc.on('end', () => resolve(Buffer.concat(chunks)));
    //   doc.on('error', reject);
    // });

    // Alternative Solution 3: Import buffer method directly
    // import { buffer } from 'get-stream';
    // return await buffer(doc);
}