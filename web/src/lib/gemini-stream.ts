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
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash",
    "gemini-2.5-pro",
];

const RETRY_DELAYS = [500, 1000, 2000];

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function getGeminiUrl(model: string) {
    return `https://generativelanguage.googleapis.com/v1/models/${model}:streamGenerateContent`;
}

async function fetchModelStream(
    model: string,
    parts: GeminiPart[]
): Promise<Response> {
    const url = getGeminiUrl(model);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({ contents: [{ parts }] }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${text}`);
    }

    if (!response.body) {
        throw new Error("No response body (stream missing)");
    }

    return response;
}

async function fetchWithRetry(
    model: string,
    parts: GeminiPart[]
): Promise<Response> {
    let lastError: unknown;

    for (let i = 0; i < RETRY_DELAYS.length; i++) {
        try {
            return await fetchModelStream(model, parts);
        } catch (err) {
            lastError = err;

            const msg = err instanceof Error ? err.message : String(err);

            console.warn(
                `Model ${model} is busy. Attempt ${i + 1} failed: ${msg}`
            );
            await sleep(RETRY_DELAYS[i]);
        }
    }

    throw lastError;
}

async function fetchWithFallback(parts: GeminiPart[]): Promise<Response> {
    const errors: string[] = [];

    for (const model of MODEL_PRIORITY) {
        try {
            console.log(`Trying Gemini model: ${model}`);
            const response = await fetchWithRetry(model, parts);
            console.log(`Using model: ${model}`);
            return response;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`${model}: ${message}`);
            console.warn(`Model failed: ${model}`);
        }
    }

    throw new Error(`All models failed:\n${errors.join('\n')}`);
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
