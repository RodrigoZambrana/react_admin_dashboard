import PropTypes from "prop-types";
import CountdownTimer from "@components/countdown";

const ProductSaleCountdown = ({date, className}) => {
    return (
        <div className={`tt-countdown_inner ${className ? className : ''}`}>
            <div className="tt-countdown">
                <CountdownTimer date={date} />
            </div>
        </div>
    );
};

ProductSaleCountdown.propTypes = {
    date: PropTypes.string.isRequired,
    className: PropTypes.string
}

ProductSaleCountdown.defaultProps = {
    date: Date.now() + 1000000
}

export default ProductSaleCountdown;