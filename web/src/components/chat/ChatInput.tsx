'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send } from 'lucide-react';
import { AttachmentPreview } from './AttachmentPreview';
import { uploadFile, type PendingUpload } from '@/lib/upload';

interface ChatInputProps {
    onSend: (content: string, pendingUploads?: PendingUpload[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Readonly<ChatInputProps>) {
    const [message, setMessage] = useState('');
    const [attachments, setAttachments] = useState<(PendingUpload & { key: string })[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if ((!message.trim() && attachments.length === 0) || disabled) return;
        onSend(
            message,
            attachments.length > 0
                ? attachments.map((attachment) => ({
                    storagePath: attachment.storagePath,
                    fileName: attachment.fileName,
                    fileSize: attachment.fileSize,
                    mimeType: attachment.mimeType,
                }))
                : undefined,
        );
        setMessage('');
        setAttachments([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        setIsUploading(true);
        for (const file of files) {
            try {
                const uploaded = await uploadFile(file);
                setAttachments(prev => [
                    ...prev,
                    { ...uploaded, key: uploaded.storagePath },
                ]);
            } catch (err) {
                console.error('Upload failed', err);
            }
        }
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (key: string) => {
        setAttachments(prev => prev.filter(a => a.key !== key));
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const files = items
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter((file): file is File => file !== null);

        if (files.length === 0) return;

        setIsUploading(true);
        for (const file of files) {
            try {
                const uploaded = await uploadFile(file);
                setAttachments(prev => [
                    ...prev,
                    { ...uploaded, key: uploaded.storagePath },
                ]);
            } catch (err) {
                console.error('Paste upload failed', err);
            }
        }
        setIsUploading(false);
    };

    return (
        <div className="border-t p-4 bg-background">
            <div className="max-w-3xl mx-auto">
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                        {attachments.map(att => (
                            <AttachmentPreview
                                key={att.key}
                                name={att.fileName}
                                type={att.mimeType}
                                onRemove={() => removeAttachment(att.key)}
                            />
                        ))}
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder={placeholder || 'Type your message...'}
                            disabled={disabled || isUploading}
                            className="min-h-[80px] resize-none pr-12"
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,application/json,.md,.docx"
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 bottom-2"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || isUploading}
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        onClick={handleSend}
                        disabled={disabled || (!message.trim() && attachments.length === 0) || isUploading}
                        size="icon"
                        className="h-[80px] w-[80px]"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
