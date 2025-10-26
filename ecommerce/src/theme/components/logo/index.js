import Link from "next/link";
import PropTypes from "prop-types";

const Logo = ({src}) => {
    return (
        <Link href="/" className="tt-logo tt-logo-alignment">
            <img src={src} alt="wokiee"/>
        </Link>
    );
};

Logo.propTypes = {
    src: PropTypes.string.isRequired
}

export default Logo;
