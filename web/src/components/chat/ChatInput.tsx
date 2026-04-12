'use client';

import { useState, useRef, ChangeEvent, KeyboardEvent, ClipboardEvent, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send } from 'lucide-react';
import { AttachmentPreview } from './AttachmentPreview';
import { uploadFile, type PendingUpload } from '@/lib/upload';

const ACCEPTED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
    '.md',
    '.docx',
].join(',');

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

    const canSend = !disabled && (message.trim().length > 0 || attachments.length > 0) && !isUploading;

    const addAttachment = useCallback((uploaded: PendingUpload) => {
        setAttachments((prev) => [
            ...prev,
            { ...uploaded, key: uploaded.storagePath },
        ]);
    }, []);

    const uploadFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;

        setIsUploading(true);
        try {
            for (const file of files) {
                try {
                    const uploaded = await uploadFile(file);
                    addAttachment(uploaded);
                } catch (err) {
                    console.error('Upload failed', err);
                }
            }
        } finally {
            setIsUploading(false);
        }
    }, [addAttachment]);

    const handleSend = useCallback(() => {
        if (!canSend) return;

        onSend(
            message,
            attachments.length > 0
                ? attachments.map(({ storagePath, fileName, fileSize, mimeType }) => ({
                    storagePath,
                    fileName,
                    fileSize,
                    mimeType,
                }))
                : undefined,
        );

        setMessage('');
        setAttachments([]);
    }, [canSend, message, attachments, onSend]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await uploadFiles(files);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [uploadFiles]);

    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];

        for (const element of items) {
            const item = element;
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            await uploadFiles(files);
        }
    }, [uploadFiles]);

    const removeAttachment = useCallback((key: string) => {
        setAttachments((prev) => prev.filter((a) => a.key !== key));
    }, []);

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
                            accept={ACCEPTED_FILE_TYPES}
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
                        disabled={!canSend}
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
