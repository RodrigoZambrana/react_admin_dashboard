import Link from "next/link";

const BrandTwo = ({className, logo, link, thumb}) => {
    return (
        <Link href={link ? link : '/'} className={`tt-promo-box tt-one-child ${className ? className : ''}`}>
                <img src={thumb} alt="wokiee"/>
                <div className="tt-description">
                    <div className="tt-description-wrapper">
                        <div className="tt-background"/>
                        <img src={logo} alt="wokiee"/>
                    </div>
                </div>
        </Link>
    );
};

export default BrandTwo;