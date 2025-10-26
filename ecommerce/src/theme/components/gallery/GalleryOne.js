import { useState } from "react";
import PropTypes from "prop-types";
import {Container} from "react-bootstrap";
import Masonry from "react-masonry-component";
import AnotherLightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import GalleryItem from "@components/gallery/GalleryItem";

const GalleryOne = ({className, galleryData}) => {
    const [index, setIndex] = useState(-1);
    const slides = galleryData.map((img) => ({
        src: img.thumb,
        key: img.id,
    }));
    return (
        <div className={`container-indent ${className ? className : ''}`}>
            <Container>
                <div className="tt-portfolio-masonry tt-no-gutter">
                    <Masonry className="tt-portfolio-content layout-default tt-grid-col-5 tt-show">
                        {galleryData?.map((gallery, i) => (
                                <GalleryItem
                                    key={gallery.id}
                                    image={gallery.image}
                                    onClick={() => setIndex(i)}
                                />
                            ))
                        }
                    </Masonry>
                    <AnotherLightbox
                        open={index >= 0}
                        index={index}
                        close={() => setIndex(-1)}
                        slides={slides}
                        plugins={[Thumbnails, Zoom, Fullscreen]}
                    />
                </div>
            </Container>
        </div>
    );
};

GalleryOne.propTypes = {
    galleryData: PropTypes.array.isRequired
}

export default GalleryOne;