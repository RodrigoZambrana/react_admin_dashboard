import {useFilter} from "@hooks";
import PropTypes from "prop-types";
import {useRouter} from "next/router";
import {getClosest} from "@utils/method";
import {useEffect, useState} from "react";
import {getProductsUniqueSizes} from "@utils/product";
import ShopWidget from "@components/shop/elements/ShopWidget";

const FilterSize = ({products, getFilterParam}) => {
    const router = useRouter();
    const {pathname, query} = router;
    const {filterBySize} = useFilter(products);
    const sizes = getProductsUniqueSizes(products);
    const selectedSize = query?.size ? (query?.size).split(",") : [];

    const [formState, setFormState] = useState(selectedSize);
    const [prevSelectedSize, setPrevSelectedSize] = useState([]);

    useEffect(() => {
        if (selectedSize.length !== 0 && selectedSize.toString() !== prevSelectedSize.toString()) {
            getFilterParam('size', selectedSize[0]);
            setPrevSelectedSize(selectedSize)
        }
    }, [selectedSize]);

    const OnSizeFilterHandler = (e) => {
        e.preventDefault();
        const target = e.target;
        const value = target.dataset.value;
        let currentFormState = formState.includes(value) ? formState.filter((i) => i !== value) : [...formState, value];
        const {price, ...restQuery} = query;
        router.push({
                pathname,
                query: {
                    ...restQuery,
                    ...(!!currentFormState.length ? {size: currentFormState.join(",")} : {}),
                },
            },
            undefined,
            {scroll: false}
        );

        const closest = getClosest(target, 'UL').childNodes;
        closest.forEach(elem => {
            if (elem.classList.contains('active')) {
                elem.classList.remove('active')
                target.parentNode.classList.add('active')
            } else {
                target.parentNode.classList.add('active')
            }
        });
    }

    return (
        <ShopWidget title="FILTER BY SIZE">
            <ul className="tt-options-swatch options-middle on-filter">
                {sizes.map(size => (
                    <li key={size} className={filterBySize === size ? 'active' : ''}>
                        <a href="/"
                           data-value={size}
                           onClick={OnSizeFilterHandler}
                        >
                            {size.toUpperCase()}
                        </a>
                    </li>
                ))}
            </ul>
        </ShopWidget>
    );
};

FilterSize.propTypes = {
    products: PropTypes.array.isRequired,
    getFilterParam: PropTypes.func.isRequired
};


export default FilterSize;
