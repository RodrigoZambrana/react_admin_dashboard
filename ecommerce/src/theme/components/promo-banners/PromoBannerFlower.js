import Link from "next/link";
import {Col, Container, Row} from "react-bootstrap";
import SectionTitle from "@components/ui/section-title";

const PromoBannerFlower = ({className}) => {
    return (
        <div className={`container-indent ${className ? className : className}`}>
            <Container className="container-fluid-custom-mobile-padding">
                <SectionTitle
                    title="Treat<br>someone special"
                />

                <Row className="tt-layout-promo02">
                    <Col sm={6} className="col-12-440width">
                        <div className="tt-promo02 text-center">
                            <Link href="/product/category/flower">
                                <img src="/assets/images/skins/flowers/img-02.jpg" alt="wokiee"/>
                            </Link>

                            <div className="tt-description">
                                <Link href="/product/category/flower"  className="tt-title">
                                    <div className="tt-title-large">Beautiful Flowers</div>
                                </Link>
                                <p>Beautiful, fresh flowers chosen and hand tied by our talented florists for any occasion.</p>
                                <Link href="/product/category/flower" className="btn">
                                    Shop the bouquets
                                </Link>

                            </div>
                        </div>
                    </Col>

                    <Col sm={6} className="col-12-440width">
                        <div className="tt-promo02 text-center">
                            <Link href="/product/category/flower">
                                <img src="/assets/images/skins/flowers/img-03.jpg" alt="wokiee"/>
                            </Link>

                            <div className="tt-description">
                                <Link href="/product/category/flower" className="tt-title">
                                    <div className="tt-title-large">Cupcakes & Cakes</div>
                                </Link>
                                <p>Our decadent cupcakes and treats are the perfect extra touch to our stunning arrangements and are guaranteed to please.</p>
                                <Link href="/product/category/flower" className="btn">
                                    Shop the bouquets
                                </Link>

                            </div>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default PromoBannerFlower;