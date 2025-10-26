import Link from "next/link";

const SocialLink = ({url, children, className}) => {
    return (
        <Link href={url} target="_blank" className={className ? className : ''}>
            {children}
        </Link>
    );
};

export default SocialLink;