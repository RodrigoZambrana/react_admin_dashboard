import dynamic from "next/dynamic";
import useCountdown from "./use-countdown";

const CountdownClock = dynamic(() => import("./countdown-clock"), {
    ssr: false,
});

const CountdownTimer = ({ date }) => {
    const [days, hours, minutes, seconds] = useCountdown(date);

    return (
        <div
            className="countdown-row"
        >
            <CountdownClock value={days} type="Days" />
            <CountdownClock value={hours} type="Hrs" />
            <CountdownClock value={minutes} type="Min" />
            <CountdownClock value={seconds} type="Sec" />
        </div>
    );
};

export default CountdownTimer;