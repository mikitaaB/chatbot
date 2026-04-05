import mammoth from 'mammoth';
import { PdfReader } from 'pdfreader';

export async function extractTextFromFile(fileData: Blob, mimeType: string): Promise<string> {
    const buffer = Buffer.from(await fileData.arrayBuffer());

    if (mimeType === 'application/pdf') {
        const pdfReader = new PdfReader();
        return new Promise((resolve, reject) => {
            let fullText = '';

            pdfReader.parseBuffer(buffer, (err, item) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (!item) {
                    resolve(fullText);
                    return;
                }

                if (item.text) {
                    fullText += item.text + '\n';
                }
            });
        });
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }

    if (
        mimeType === 'text/plain' ||
        mimeType === 'text/markdown' ||
        mimeType === 'text/javascript' ||
        mimeType === 'application/json'
    ) {
        return buffer.toString('utf-8');
    }

    return '';
}
