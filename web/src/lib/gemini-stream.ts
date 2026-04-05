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

export async function createGeminiStream(parts: GeminiPart[] | string) {
    const requestParts = typeof parts === 'string' ? [{ text: parts }] : parts;
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": process.env.GEMINI_API_KEY!,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: requestParts,
                    }
                ]
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

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

                    while (buffer.length > 0 && buffer[0] !== '{') {
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
                    } catch (e) {
                        console.error('Failed to parse Gemini object:', e);
                        console.error('JSON:', jsonStr);
                    }

                    startIdx = buffer.indexOf('{');
                }
            }

            if (buffer.trim() && buffer.trim() !== ']' && buffer.trim() !== '[' && buffer.trim() !== ',') {
                console.warn('Unprocessed buffer remaining:', buffer);
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
        },
    });
}
