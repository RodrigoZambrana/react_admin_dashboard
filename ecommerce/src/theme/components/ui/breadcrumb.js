"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { toCapitalize } from "@utils/toCapitalize";

const Breadcrumb = () => {
    const pathname = usePathname();

    const breadcrumbs = useMemo(() => {
        if (!pathname) return [];
        const sanitized = pathname.split("?")[0];
        const segments = sanitized.split("/").filter(Boolean);
        return segments.map((segment, index) => ({
            label: toCapitalize(segment.replace(/-/g, " ")),
            href: "/" + segments.slice(0, index + 1).join("/"),
        }));
    }, [pathname]);

    return (
        <div className="tt-breadcrumb">
            <div className="container">
                <ul>
                    <li>
                        <Link href="/">Home</Link>
                    </li>
                    {breadcrumbs.map(({ label, href }, index) => {
                        const isLast = index === breadcrumbs.length - 1;
                        return isLast ? (
                            <li key={href}>{label.replace(/\?(.*)/g, "")}</li>
                        ) : (
                            <li key={href}>
                                <Link href={href}>{label}</Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

export default Breadcrumb;
