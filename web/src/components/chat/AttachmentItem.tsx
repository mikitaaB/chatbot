'use client';

import Image from 'next/image';
import { FileText, Image as ImageIcon } from 'lucide-react';
import type { ChatAttachment } from '@/hooks/useChatMessages';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AttachmentItem({ attachment }: Readonly<{ attachment: ChatAttachment }>) {
    const isImage = IMAGE_MIME_TYPES.includes(attachment.mime_type);
    const href = attachment.id ? `/api/attachments/${attachment.id}` : undefined;
    const key = attachment.id ?? attachment.file_name;

    if (isImage && href) {
        return (
            <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border border-border/60"
            >
                <Image
                    src={href}
                    alt={attachment.file_name}
                    width={720}
                    height={480}
                    loading="lazy"
                    unoptimized
                    className="max-h-72 w-full rounded-md object-cover"
                />
            </a>
        );
    }

    return (
        <a
            key={key}
            href={href}
            target={href ? '_blank' : undefined}
            rel={href ? 'noreferrer' : undefined}
            className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
        >
            {isImage ? (
                <ImageIcon className="h-4 w-4 shrink-0" />
            ) : (
                <FileText className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{attachment.file_name}</span>
        </a>
    );
}