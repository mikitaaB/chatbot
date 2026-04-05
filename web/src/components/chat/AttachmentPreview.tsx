'use client';

import { Button } from '@/components/ui/button';
import { X, FileText, Image as ImageIcon } from 'lucide-react';

interface AttachmentPreviewProps {
    name: string;
    type: string;
    onRemove: () => void;
}

export function AttachmentPreview({ name, type, onRemove }: Readonly<AttachmentPreviewProps>) {
    const isImage = type.startsWith('image/');
    return (
        <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1 text-sm">
            {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
            <span className="max-w-[150px] truncate">{name}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>
                <X className="h-3 w-3" />
            </Button>
        </div>
    );
}