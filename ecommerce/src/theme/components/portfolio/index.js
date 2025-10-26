import PropTypes from "prop-types";

const Portfolio = ({title, thumb, slug, excerpt, onClick}) => {
    return (
        <div className="element-item">
            <figure>
                <img src={thumb} alt={title}/>
                <figcaption>
                    <h6 className="tt-title"><a href={slug}>{title}</a></h6>
                    <p>{excerpt}</p>
                    <button className="tt-btn-zomm" aria-label="zoom button" onClick={onClick}/>
                </figcaption>
            </figure>
        </div>
    );
};

Portfolio.propTypes = {
    onClick: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    thumb: PropTypes.string.isRequired,
    excerpt: PropTypes.string,
    slug: PropTypes.string,
}

export default Portfolio;