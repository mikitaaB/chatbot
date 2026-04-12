export function StreamingIndicator() {
    return (
        <div className="flex gap-1 items-center py-1">
            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" />
        </div>
    );
}
