import PropTypes from "prop-types";
import GoogleMapReact from "google-map-react";

const markerIcon = '/assets/images/no-placeholder/marker.png'

const Marker = ({ text }) => (
    <div className="map-marker">
        <img src={markerIcon} alt={text} />
    </div>
);

const GoogleMap = ({latitude, longitude, height, ...props}) => {
    return (
        <div className="position-relative" style={{height: height ? height : 500}}>
            <GoogleMapReact
                bootstrapURLKeys={{ key: "AIzaSyC6iKLVzr34W23jAZDT3HlrElOHfK6IH_w" }}
                defaultCenter={{lat: latitude, lng: longitude}}
                defaultZoom={10}
            >
                <Marker lat={latitude} lng={longitude} text="Marker" />
            </GoogleMapReact>
        </div>
    );
};

GoogleMap.propTypes = {
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    height: PropTypes.number
}

export default GoogleMap;
