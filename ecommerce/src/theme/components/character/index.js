import Link from "next/link";
import PropTypes from "prop-types";
import parse from "html-react-parser";

const Character = ({title, url, className}) => {
    return (
        <Link href={url} className={`tt-btn-info tt-layout-03 ${className ? className : ''}`}>
            <div className="tt-title">{parse(title)}</div>
        </Link>
    );
};

Character.propTypes = {
    title: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    className: PropTypes.string
}

export default Character;