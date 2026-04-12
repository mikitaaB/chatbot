export function GuestQuotaBadge({
    isGuest,
    remainingQuota
}: Readonly<{
    isGuest: boolean,
    remainingQuota: number
}>) {
    if (!isGuest) return <></>;

    return (
        <div className="px-4 pt-2">
            <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm p-2 rounded-md">
                Free questions left: {remainingQuota} / 3
            </div>
        </div>
    );
}