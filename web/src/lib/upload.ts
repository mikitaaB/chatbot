export type PendingUpload = {
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
};

export async function uploadFile(file: File): Promise<PendingUpload> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return {
        storagePath: data.storagePath,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
    };
}
