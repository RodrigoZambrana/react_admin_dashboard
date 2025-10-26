const GalleryItem = ({className, image, onClick}) => {
    return (
        <div className={`element-item ${className ? className : ''}`}>
            <figure>
                <img src={image} alt="wokiee"/>
                <figcaption>
                    <button onClick={onClick} className="tt-btn-zomm"/>
                </figcaption>
            </figure>
        </div>
    );
};

export default GalleryItem;