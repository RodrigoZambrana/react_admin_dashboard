import Link from "next/link";
import PropTypes from "prop-types";
import parse from "html-react-parser";
import {Col, Container, Row} from "react-bootstrap";

const AboutThree = ({className, data, layout, containerInnerClass}) => {
    return (
        <div className={`container-indent ${className ? className : ''}`}>
            <div className={`layout-box01-wrapper ${containerInnerClass}`}>
                <Container>
                    <Row className={`tt-layout-box01 flex-row-reverse ${layout ? layout : ''}`}>
                        <Col md={6} className="col-img">
                            <img src={data.thumb} width="100%" alt="wokiee"/>
                        </Col>

                        <Col md={6} className="col-description">
                            <h6 className="tt-title mt-4 mt-lg-0">{parse(data.title)}</h6>
                            <p>{parse(data.content)}</p>
                            {data.btnText && <Link href={data.btnLink} className="btn">{data.btnText}</Link>}
                        </Col>
                    </Row>
                </Container>
            </div>
        </div>
    );
};

AboutThree.propTypes = {
    data: PropTypes.object.isRequired,
    className: PropTypes.string,
    layout: PropTypes.string
}

export default AboutThree;