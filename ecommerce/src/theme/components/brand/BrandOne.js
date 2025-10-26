import Link from "next/link";

const BrandOne = ({className, logo, link}) => {
    return (
        <Link href={link ? link : '/'} className={`tt-img-box ${className ? className : ''}`} >
            <img src={logo} alt="brand"/>
        </Link>
    );
};

export default BrandOne;