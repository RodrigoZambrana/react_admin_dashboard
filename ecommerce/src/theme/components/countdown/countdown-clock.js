const CountdownClock = ({ value, type }) => {
    return (
        <span className="countdown-section">
            <span className="countdown-amount">{value}</span>
            <span className="countdown-period">{type}</span>
        </span>
    )
};

export default CountdownClock;