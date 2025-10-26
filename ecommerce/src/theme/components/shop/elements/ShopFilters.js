import Link from "next/link";
import {useRouter} from "next/router";
import {useFilter, useWindowSize} from "@hooks";
import {toCapitalize} from "@utils/toCapitalize";
import {Fragment, useContext, useState} from "react";
import SortBy from "@components/shop/elements/SortBy";
import {ProductsContext} from "@global/ProductsContext";
import ShopWidget from "@components/shop/elements/ShopWidget";
import {arrSortByCharacter, getClosest, range} from "@utils/method";
import ProductPerPage from "@components/shop/elements/ProductPerPage";
import {
    getProductsUniqueTags,
    getProductsUniquePrices,
    getProductsUniqueSizes,
    getProductsUniqueColors,
    getProductsUniqueVendor,
    getProductsUniqueCategories
} from "@utils/product";
import FilterPrice from "@components/shop/filter/price";
import FilterSize from "@components/shop/filter/size";
import FilterColor from "@components/shop/filter/color";

const ShopFilters = (props) => {
    const {
        sidebar,
        onSortHandler,
        getFilterParam,
        productPerPage,
        filterPanelHandler,
        onProductPerPageHandler,
    } = props;

    const router = useRouter();
    const {pathname, query} = router;
    const {slug} = query;
    const [windowSize] = useWindowSize();
    const {products} = useContext(ProductsContext);
    const {filterBySize} = useFilter(products);


    const vendors = getProductsUniqueVendor(products);


    const tags = getProductsUniqueTags(products, 20);
    const cats = getProductsUniqueCategories(products, -1);
    const categories = arrSortByCharacter(cats);

    const [categoryLimit, setCategoryLimit] = useState(10);
    const [vendorLimit, setVendorLimit] = useState(10);


    return (
        <Fragment>
            {!sidebar && (
                <div className="tt-btn-col-close">
                    <a
                        href="/"
                        onClick={(event => {
                            event.preventDefault();
                            filterPanelHandler()
                        })}
                    >
                        Close
                    </a>
                </div>
            )}

            {windowSize < 1025 && sidebar && (
                <Fragment>
                    <div className="tt-btn-col-close">
                        <a
                            href="/"
                            onClick={(event => {
                                event.preventDefault();
                                filterPanelHandler()
                            })}
                        >
                            Close
                        </a>
                    </div>

                    <ShopWidget>
                        <div className="tt-filter-detach-option">
                            <div className="filters-mobile">
                                <div className="filters-row-select">
                                    <SortBy onSortHandler={onSortHandler}/>

                                    <ProductPerPage
                                        productPerPage={productPerPage}
                                        onProductPerPageHandler={onProductPerPageHandler}
                                    />
                                </div>
                            </div>
                        </div>
                    </ShopWidget>
                </Fragment>
            )}

            <ShopWidget title="PRODUCT CATEGORIES">
                <ul className="tt-list-row">
                    {categories.slice(0, categoryLimit).map(cat => (
                        <li key={cat} className={cat === slug ? 'active' : ''}>
                            <Link href={`/product/category/${cat}`}>{toCapitalize(cat.replace(/-/g, ' '))}</Link>
                        </li>
                    ))}
                </ul>
                {categories.length > categoryLimit && (
                    <button
                        className="btn-link-02"
                        onClick={() => setCategoryLimit(prevState => prevState + 5)}
                    >
                        + More
                    </button>
                )}
            </ShopWidget>

            <FilterPrice
                products={products}
                getFilterParam={getFilterParam}
            />

            <FilterSize
                products={products}
                getFilterParam={getFilterParam}
            />

            <FilterColor
                products={products}
                getFilterParam={getFilterParam}
            />

            <ShopWidget title="VENDOR">
                <ul className="tt-list-row">
                    {vendors.slice(0, vendorLimit).map(vendor => (
                        <li key={vendor.toLowerCase()}>
                            <a href="/"
                               data-filtertype="vendor"
                               data-filtervalue={vendor}
                               onClick={event => filterByHandler(event)}
                            >
                                {vendor}
                            </a>
                        </li>
                    ))}
                </ul>
                {vendors.length > vendorLimit && (
                    <button
                        className="btn-link-02"
                        onClick={() => setVendorLimit(prevState => prevState + 5)}
                    >
                        + More
                    </button>
                )}
            </ShopWidget>

            <ShopWidget title="TAGS">
                <ul className="tt-list-inline">
                    {tags.map(tag => (
                        <li key={tag} className={tag === slug ? 'active' : ''}>
                            <Link href={`/product/tag/${tag}`}>{toCapitalize(tag.replace(/-/g, ' '))}</Link>
                        </li>
                    ))}
                </ul>
            </ShopWidget>
        </Fragment>
    );
};

export default ShopFilters;