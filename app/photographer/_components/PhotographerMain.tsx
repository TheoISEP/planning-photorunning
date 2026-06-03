"use client";

import { usePathname } from "next/navigation";

// key={pathname} resets scroll on navigation — useLayoutEffect loses to browser scroll restoration
export function PhotographerMain({ children, className }: { children: React.ReactNode; className: string }) {
    const pathname = usePathname();
    return (
        <main key={pathname} className={className}>
            {children}
        </main>
    );
}
