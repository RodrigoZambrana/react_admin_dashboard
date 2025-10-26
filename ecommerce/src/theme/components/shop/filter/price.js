import {useState, useEffect} from "react";
import PropTypes from "prop-types";
import {useRouter} from "next/router";
import {getClosest, range} from "@utils/method";
import {getProductsUniquePrices} from "@utils/product";
import ShopWidget from "@components/shop/elements/ShopWidget";

const FilterPrice = ({getFilterParam, products}) => {
    const router = useRouter();
    const {query, pathname} = router;
    const prices = getProductsUniquePrices(products);
    const maxPrice = Math.max.apply(Math, prices);
    let priceRange = range(0, maxPrice, 100);
    const selectedPrice = query?.price ? (query?.price).split(",") : [];
    const [prevSelectedPrice, setPrevSelectedPrice] = useState([]);

    const [priceLimit, setPriceLimit] = useState(10);
    const [formState, setFormState] = useState(selectedPrice);


    useEffect(() => {
        if(selectedPrice.length !== 0 && selectedPrice.toString() !== prevSelectedPrice.toString()){
            getFilterParam('price', selectedPrice[0]);
            setPrevSelectedPrice(selectedPrice)
        }
    }, [selectedPrice]);

    const onPriceFilterHandler = (e) => {
        e.preventDefault();
        const target = e.target;
        const value = target.dataset.value;
        let currentFormState = formState.includes(value) ? formState.filter((i) => i !== value) : [...formState, value];
        const {price, ...restQuery} = query;
        router.push({
            pathname, query: {
                ...restQuery, ...(!!currentFormState.length ? {price: currentFormState.join(",")} : {}),
            },
        }, undefined, {scroll: false});

        const closest = getClosest(target, 'UL').childNodes;
        closest.forEach(elem => {
            if (elem.classList.contains('active')) {
                elem.classList.remove('active')
                target.parentNode.classList.add('active')
            } else {
                target.parentNode.classList.add('active')
            }
        });

        getFilterParam('price', value);
    }

    return (
        <>
            <ShopWidget title="FILTER BY PRICE">
                <ul className="tt-list-row">
                    {priceRange.slice(0, priceLimit).map((range, idx) => (<li key={idx}>
                        <a
                            href="/"
                            data-filtertype="price"
                            data-value={range.replace(/ /g, '')}
                            onClick={event => onPriceFilterHandler(event, "price")}
                        >
                            {`USD ${range}`}
                        </a>
                    </li>))}
                </ul>

                {priceRange.length > priceLimit && (<button
                    className="btn-link-02"
                    onClick={() => setPriceLimit(prevState => prevState + 3)}
                >
                    + More
                </button>)}
            </ShopWidget>
        </>
    );
};

FilterPrice.propTypes = {
    products: PropTypes.array.isRequired,
    getFilterParam: PropTypes.func.isRequired
};


export default FilterPrice;
