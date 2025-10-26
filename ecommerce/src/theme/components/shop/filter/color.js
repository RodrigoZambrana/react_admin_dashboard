import {useFilter} from "@hooks";
import PropTypes from "prop-types";
import {useRouter} from "next/router";
import {getClosest} from "@utils/method";
import {useEffect, useState} from "react";
import {getProductsUniqueColors} from "@utils/product";
import ShopWidget from "@components/shop/elements/ShopWidget";

const FilterColor = ({products, getFilterParam}) => {
    const router = useRouter();
    const {pathname, query} = router;
    const colors = getProductsUniqueColors(products);
    const selectedColor = query?.color ? (query?.color).split(",") : [];

    const [formState, setFormState] = useState(selectedColor);
    const [prevSelectedColor, setPrevSelectedColor] = useState([]);

    useEffect(() => {
        if (selectedColor.length !== 0 && selectedColor.toString() !== prevSelectedColor.toString()) {
            getFilterParam('color', selectedColor[0]);
            setPrevSelectedColor(selectedColor)
        }
    }, [selectedColor]);

    const onColorFilterHandler = (e) => {
        e.preventDefault();
        const target = e.target;
        const value = target.dataset.value;
        let currentFormState = formState.includes(value) ? formState.filter((i) => i !== value) : [...formState, value];
        const {color, ...restQuery} = query;
        router.push({
                pathname,
                query: {
                    ...restQuery,
                    ...(!!currentFormState.length ? {color: currentFormState.join(",")} : {}),
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
        <ShopWidget title="FILTER BY COLOR">
            <ul className="tt-options-swatch options-middle on-filter">
                {colors.map(color => (
                    <li key={color.name}>
                        <a
                            href="#"
                            data-filtertype="color"
                            data-value={color.name}
                            className="options-color tt-border"
                            style={{backgroundColor: color.code}}
                            onClick={event => onColorFilterHandler(event)}
                        />
                    </li>
                ))}
            </ul>
        </ShopWidget>
    );
};

FilterColor.propTypes = {
    products: PropTypes.array.isRequired,
    getFilterParam: PropTypes.func.isRequired
};


export default FilterColor;
