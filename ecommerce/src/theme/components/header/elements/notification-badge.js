import Link from "next/link";

const NotificationBadge = ({path, icon, text, number}) => {
    return (
        <div className="tt-parent-box">
            <Link href={path} className="tt-obj-link tt-compare-wrapper" data-tooltip="Compare" data-tposition="bottom">
                <div className="tt-dropdown-toggle">
                    <div className="tt-header-icon">
                        {icon}
                    </div>
                    <span className="tt-text">{text}</span>
                    <span className="tt-badge-cart text-center" suppressHydrationWarning={true}>{number}</span>
                </div>
            </Link>
        </div>
    );
};

export default NotificationBadge;