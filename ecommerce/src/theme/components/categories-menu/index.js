import Link from "next/link";
import {useState} from "react";
import PropTypes from "prop-types";
import {Col, Row} from "react-bootstrap";

// Icons Import
import Shoe from "@assets/images/svg/shoe.svg";
import MenIcon from "@assets/images/svg/men.svg";
import BuyTemplate from "@assets/images/svg/buy.svg";
import WomenIcon from "@assets/images/svg/women.svg";
import GiftCard from "@assets/images/svg/gift-card.svg";
import Clearance from "@assets/images/svg/clearance.svg";
import Accessories from "@assets/images/svg/accessories.svg";
import NewArrivals from "@assets/images/svg/new-arrivals.svg";
import SpecialOffers from "@assets/images/svg/special-offers.svg";

const CategoriesMenu = ({className, initialVisibility}) => {
    const [dropdownToggle, setDropdownToggle] = useState(initialVisibility);

    const onToggleHandler = () => {
        setDropdownToggle(prevState => !prevState);
    }

    return (
        <div className={`tt-menu-categories ${className ? className : ''}`}>
            <button
                className={`tt-dropdown-toggle ${dropdownToggle ? 'active' : ''}`}
                onClick={onToggleHandler}
            >
                CATEGORIES
            </button>
            <div className={`tt-dropdown-menu ${dropdownToggle ? 'active' : ''}`}>
                <nav>
                    <ul>
                        <li className="tt-submenu">
                            <Link href="/product/category/women">
                                <WomenIcon/>
                                <span>WOMEN</span>
                            </Link>
                            <div className="dropdown-menu size-md">
                                <div className="dropdown-menu-wrapper">
                                    <Row>
                                        <Col xs={12}>
                                            <Row className="tt-col-list">
                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                        TOPS
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li>
                                                            <Link href="/shop">Blouses &amp; Shirts</Link>
                                                        </li>
                                                        <li><Link href="/shop">Dresses</Link></li>
                                                        <li>
                                                            <Link href="/shop">Tops &amp; T-shirts</Link>
                                                        </li>
                                                        <li>
                                                            <Link href="/shop">Sleeveless Tops</Link>
                                                        </li>
                                                        <li><Link href="/shop">Sweaters</Link></li>
                                                        <li><Link href="/shop">Jackets</Link></li>
                                                        <li><Link href="/shop">Outerwear</Link></li>
                                                    </ul>
                                                </Col>

                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                        BOTTOMS
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li>
                                                            <Link href="/shop">Trousers Featured</Link>
                                                        </li>
                                                        <li><Link href="/shop">Jeans</Link></li>
                                                        <li><Link href="/shop">Leggings</Link></li>
                                                        <li>
                                                            <Link href="/shop">Jumpsuit & Shorts</Link>
                                                        </li>
                                                        <li><Link href="/shop">Skirts</Link></li>
                                                        <li><Link href="/shop">Tights</Link></li>
                                                    </ul>
                                                </Col>

                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                        ACCESSORIES
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li><Link href="/shop">Jewellery</Link></li>
                                                        <li><Link href="/shop">Hats</Link></li>
                                                        <li><Link href="/shop">Scarves & Snoods</Link></li>
                                                        <li><Link href="/shop">Belts</Link></li>
                                                        <li><Link href="/shop">Bags</Link></li>
                                                        <li><Link href="/shop">Tights</Link></li>
                                                        <li><Link href="/shop">Shoes Sale 15%</Link></li>
                                                        <li><Link href="/shop">Sunglasses</Link></li>
                                                    </ul>
                                                </Col>
                                            </Row>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col>
                                            <Link href="/shop" className="tt-promo-02">
                                                    <img
                                                        src="/assets/images/no-placeholder/header-promo-01.jpg"
                                                        alt="Header Promo"
                                                    />

                                                    <div className="tt-description tt-point-h-l">
                                                        <div className="tt-description-wrapper">
                                                            <div className="tt-title-small">
                                                                SUMMER
                                                                <span className="tt-base-color"> 2021</span>
                                                            </div>
                                                            <div className="tt-title-large">
                                                                NEW ARRIVALS
                                                            </div>
                                                        </div>
                                                    </div>
                                            </Link>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </li>
                        <li className="tt-submenu ">
                            <Link href="/product/category/men">
                                <MenIcon/>
                                <span>MEN</span>
                            </Link>
                            <div className="dropdown-menu size-lg">
                                <div className="dropdown-menu-wrapper">
                                    <Row>
                                        <Col xs={12}>
                                            <Row className="tt-col-list">
                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                        TOPS
                                                        <img src="/assets/images/custom/header-category-01.jpg"
                                                                alt="Header Promo"/>
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li><Link href="/shop">Blouses &amp; Shirts</Link></li>
                                                        <li><Link href="/shop">Dresses</Link></li>
                                                        <li><Link href="/shop">Tops &amp; T-shirts</Link></li>
                                                        <li><Link href="/shop">Sleeveless Tops</Link></li>
                                                        <li><Link href="/shop">Sweaters</Link></li>
                                                        <li><Link href="/shop">Jackets</Link></li>
                                                        <li><Link href="/shop">Outerwear</Link></li>
                                                    </ul>
                                                </Col>

                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                        BOTTOMS
                                                        <img src="/assets/images/custom/header-category-02.jpg"
                                                                alt="Header Promo"/>
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li><Link href="/shop">Trousers Featured</Link></li>
                                                        <li><Link href="/shop">Jeans</Link></li>
                                                        <li><Link href="/shop">Leggings</Link></li>
                                                        <li><Link href="/shop">Jumpsuit & Shorts</Link></li>
                                                        <li><Link href="/shop">Skirts</Link></li>
                                                        <li><Link href="/shop">Tights</Link></li>
                                                    </ul>
                                                </Col>

                                                <Col sm={4}>
                                                    <Link href="/shop" className="tt-title-submenu">
                                                            ACCESSORIES
                                                            <img src="/assets/images/custom/header-category-03.jpg"
                                                                 alt="Header Promo"/>
                                                    </Link>
                                                    <ul className="tt-megamenu-submenu">
                                                        <li><Link href="/shop">Jewellery</Link></li>
                                                        <li><Link href="/shop">Hats</Link></li>
                                                        <li><Link href="/shop">Scarves & Snoods</Link></li>
                                                        <li><Link href="/shop">Belts</Link></li>
                                                        <li><Link href="/shop">Bags</Link></li>
                                                        <li><Link href="/shop">Tights</Link></li>
                                                        <li><Link href="/shop">Shoes Sale 15%</Link></li>
                                                        <li><Link href="/shop">Sunglasses</Link></li>
                                                    </ul>
                                                </Col>
                                            </Row>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </li>
                        <li>
                            <Link href="/product/category/accessories">
                                    <Accessories/>
                                    <span>ACCESSORIES</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/product/category/shoe">
                                <Shoe/>
                                <span>SHOES</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/shop">
                                <NewArrivals/>
                                <span>NEW ARRIVALS</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/shop">
                                <Clearance/>
                                <span>CLEARANCE</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/shop">
                                <SpecialOffers/>
                                <span>SPECIAL OFFERS</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="/shop">
                                <GiftCard/>
                                <span>GIFT CARD</span>
                            </Link>
                        </li>
                        <li>
                            <Link href="https://1.envato.market/VLXVj" target="_blank" rel="noopener noreferrer">
                                <BuyTemplate/>
                                <span>BUY TEMPLATE!</span>
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
    );
};

CategoriesMenu.defaultProps = {
    initialVisibility: false
}

CategoriesMenu.propTypes = {
    initialVisibility: PropTypes.bool
}

export default CategoriesMenu;