import Link from "next/link";
import PropTypes from "prop-types";
import parse from "html-react-parser";
import {Col, Container, Row} from "react-bootstrap";

const PromoTwo = ({className, thumb, subtitle, title, content, btn, btnLink, containerFluid}) => {
    return (
        <div className={`${className ? className : ''} container-indent`}>
            <Container fluid={containerFluid}>
                <Row className="gx-0">
                    <Col>
                        <div className="tt-promo-fullwidth">
                            <img src={thumb} alt={title}/>
                            <div className="tt-description">
                                <div className="tt-description-wrapper">
                                    <div className="tt-title-small">{parse(subtitle)}</div>
                                    <div className="tt-title-large">{parse(title)}</div>
                                    {content && <p>{parse(content)}</p>}
                                    {btn && <Link href={btnLink} className="btn btn-xl">SHOP NOW!</Link>}
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

PromoTwo.propTypes = {
    btn: PropTypes.bool,
    btnLink: PropTypes.string,
    className: PropTypes.string,
    title: PropTypes.string.isRequired,
    thumb: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired
}

export default PromoTwo;