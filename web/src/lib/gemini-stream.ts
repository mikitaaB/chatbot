export type GeminiPart =
    | { text: string }
    | {
        inlineData: {
            mimeType: string;
            data: string;
        };
    };

type GeminiChunk = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
};

const MODEL_PRIORITY = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
];

const RETRY_DELAYS = [1000, 2000, 4000];
const MAX_RETRIES = RETRY_DELAYS.length;

async function fetchModelStream(
    model: string,
    parts: GeminiPart[]
): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
    const options: RequestInit = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({ contents: [{ parts }] }),
    };

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const response = await fetch(url, options);

        if (response.ok) {
            return response;
        }

        if (response.status === 503 || response.status === 429) {
            const delay = RETRY_DELAYS[attempt];
            console.warn(
                `Model ${model} is busy (${response.status}), retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
        }

        const errorText = await response.text();
        console.error(`Model ${model} failed with status ${response.status}:`, errorText);
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    throw new Error(`Model ${model} temporarily unavailable after ${MAX_RETRIES} attempts`);
}

async function fetchWithFallback(parts: GeminiPart[]): Promise<Response> {
    const errors: string[] = [];

    for (const model of MODEL_PRIORITY) {
        try {
            console.log(`Trying Gemini model: ${model}`);
            const response = await fetchModelStream(model, parts);
            console.log(`Using model: ${model}`);
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`${model}: ${message}`);
            console.warn(`Fallback: ${model} failed, trying next...`);
        }
    }

    throw new Error(`All Gemini models failed:\n${errors.join('\n')}`);
}

export async function createGeminiStream(parts: GeminiPart[] | string) {
    const requestParts = typeof parts === 'string' ? [{ text: parts }] : parts;
    const response = await fetchWithFallback(requestParts);

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            let buffer = '';
            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                while (buffer.length > 0 && !buffer.startsWith('{')) {
                    buffer = buffer.substring(1);
                }

                let startIdx = 0;
                while (startIdx !== -1 && startIdx < buffer.length) {
                    let braceCount = 0;
                    let endIdx = -1;
                    for (let i = startIdx; i < buffer.length; i++) {
                        if (buffer[i] === '{') braceCount++;
                        else if (buffer[i] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                endIdx = i;
                                break;
                            }
                        }
                    }
                    if (endIdx === -1) break;

                    const jsonStr = buffer.substring(startIdx, endIdx + 1);
                    buffer = buffer.substring(endIdx + 1);

                    while (buffer.length > 0 && !buffer.startsWith('{')) {
                        buffer = buffer.substring(1);
                    }

                    try {
                        const chunk = JSON.parse(jsonStr) as GeminiChunk;
                        const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            const sseChunk = `data: ${JSON.stringify({
                                choices: [{ delta: { content: text } }],
                            })}\n\n`;
                            controller.enqueue(encoder.encode(sseChunk));
                        }
                    } catch (err: unknown) {
                        const errMessage = err instanceof Error ? err.message : 'An unknown error occurred while parse Gemini object';
                        console.error('Failed to parse Gemini object:', errMessage);
                        console.error('JSON:', jsonStr);
                    }

                    startIdx = buffer.indexOf('{');
                }
            }

            const leftover = buffer.trim();
            if (leftover && ![']', '[', ','].includes(leftover)) {
                console.warn('Unprocessed buffer remaining:', leftover);
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });
}
