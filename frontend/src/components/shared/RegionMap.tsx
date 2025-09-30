import { useState, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { THEME_ENUM } from '@/constants/theme.constant'
import WorldMap from '@/assets/maps/world-countries-sans-antarctica.json'
import shadeColor from '@/utils/shadeColor'
import { useAppSelector } from '@/store'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import type { Dispatch, SetStateAction } from 'react'

type MapDataProp = {
    name: string
    value?: string | number
    color?: string
}[]

type RegionMapProps = {
    data: MapDataProp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapSource?: string | Record<string, any> | string[]
    valueSuffix?: string
    valuePrefix?: string
}

type MapProps = Omit<RegionMapProps, 'valueSuffix' | 'valuePrefix'> & {
    prefix?: string
    suffix?: string
}

type MapChartProps = MapProps & {
    setTooltipContent: Dispatch<SetStateAction<string>>
}


const geoUrl = WorldMap
const hoverPercentage = -10

const { MODE_DARK } = THEME_ENUM

const getHighlightedRegion = (
    name: unknown,
    data: MapDataProp,
    defaultMapColor: string,
) => {
    if (data.length > 0 || name) {
        for (let i = 0; i < data.length; i++) {
            const elm = data[i]
            if (name === elm.name) {
                return elm.color
            }
        }
        return defaultMapColor
    }
    return defaultMapColor
}

const getRegionHoverColor = (
    name: unknown,
    data: MapDataProp,
    defaultMapColor = '',
) => {
    if (data.length > 0 || name) {
        for (let i = 0; i < data.length; i++) {
            const elm = data[i]
            if (name === elm.name) {
                return shadeColor(elm.color || '', hoverPercentage)
            }
        }
        return shadeColor(defaultMapColor, hoverPercentage)
    }
    return shadeColor(defaultMapColor, hoverPercentage)
}

const getRegionValue = (
    name: unknown,
    data: MapDataProp,
    suffix = '',
    prefix = '',
) => {
    if (data.length > 0 || name) {
        for (let i = 0; i < data.length; i++) {
            const elm = data[i]
            if (name === elm.name) {
                return `${elm.name} - ${prefix}${elm.value}${suffix}`
            }
        }
        return ''
    }
    return ''
}

const MapChart = (props: MapChartProps) => {
    const { setTooltipContent, data, mapSource, suffix, prefix } = props

    const mode = useAppSelector((state) => state.theme.mode)

    const [tw, setTw] = useState({
        gray500: '',
        gray100: '',
        gray300: '',
        gray600: '',
    });
    
    useEffect(() => {
        const styles = getComputedStyle(document.documentElement);
        const gray100 = styles.getPropertyValue('--color-gray-100').trim();
        const gray500 = styles.getPropertyValue('--color-gray-500').trim();
        const gray300 = styles.getPropertyValue('--color-gray-300').trim();
        const gray600 = styles.getPropertyValue('--color-gray-600').trim();

        setTw({
            gray100,
            gray500,
            gray300,
            gray600,
        });
    }, []);

    return (
        <ComposableMap
            style={{ transform: 'translateY(20px)' }}
            data-tip=""
            height={380}
            projectionConfig={{ scale: 145 }}
        >
            <Geographies geography={mapSource}>
                {({ geographies }) =>
                    geographies.map((geo) => {
                        const geoName = geo.properties.name
                        return (
                            <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                strokeWidth={2}
                                fill={getHighlightedRegion(
                                    geoName,
                                    data,
                                    mode === MODE_DARK
                                        ? tw.gray500
                                        : tw.gray100,
                                )}
                                className=""
                                stroke={
                                    mode === MODE_DARK
                                        ? tw.gray600
                                        : tw.gray300
                                }
                                style={{
                                    hover: {
                                        fill: getRegionHoverColor(
                                            geoName,
                                            data,
                                            mode === MODE_DARK
                                                ? tw.gray500
                                                : tw.gray100,
                                        ),
                                        outline: 'none',
                                    },
                                }}
                                onMouseEnter={() => {
                                    setTooltipContent(
                                        getRegionValue(
                                            geoName,
                                            data,
                                            suffix,
                                            prefix,
                                        ),
                                    )
                                }}
                                onMouseLeave={() => {
                                    setTooltipContent('')
                                }}
                            />
                        )
                    })
                }
            </Geographies>
        </ComposableMap>
    )
}

const Map = (props: MapProps) => {
    const [content, setContent] = useState('')
    return (
        <>
            <MapChart {...props} setTooltipContent={setContent} />
            <ReactTooltip>{content}</ReactTooltip>
        </>
    )
}

const RegionMap = (props: RegionMapProps) => {
    const { data = [], mapSource = geoUrl, valueSuffix, valuePrefix } = props

    return (
        <Map
            data={data}
            mapSource={mapSource}
            prefix={valuePrefix}
            suffix={valueSuffix}
        />
    )
}

export default RegionMap
