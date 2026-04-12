import { Button } from '@/components/ui/button';
import { User as AuthUser } from '@/contexts/auth-context';
import { LogOut, User } from 'lucide-react';

interface SidebarFooterProps {
    user: AuthUser | null;
    onSignOut: () => void;
}

export function SidebarFooter({ user, onSignOut }: Readonly<SidebarFooterProps>) {
    return (
        <div className="border-t p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">
                        {user?.email || 'Guest'}
                    </span>
                </div>
                {user && (
                    <Button
                        aria-label="Logout"
                        size="sm"
                        variant="ghost"
                        onClick={onSignOut}
                    >
                        <LogOut className="h-4 w-4 mr-1" />
                        Logout
                    </Button>
                )}
            </div>
        </div>
    );
}