import RegionMap from '@/components/shared/RegionMap'

const mapColors = [
    '#4f46e5',
    '#3b82f6',
    '#22c55e',
    '#eab308',
    '#ec4899',
    '#a855f7',
]

const getMapColors = (
    data: {
        name: string
        value?: string | number
        color?: string
    }[] = [],
) => {
    return data.map((item, index) => ({
        ...item,
        color: mapColors[index],
    }))
}

const Example = () => {
    const data = [
        {
            name: 'United States of America',
            value: 37.61,
        },
        {
            name: 'Brazil',
            value: 16.79,
        },
        {
            name: 'India',
            value: 12.42,
        },
        {
            name: 'China',
            value: 9.85,
        },
        {
            name: 'Algeria',
            value: 7.68,
        },
        {
            name: 'Indonesia',
            value: 5.11,
        },
    ]

    return <RegionMap data={getMapColors(data)} valueSuffix="%" />
}

export default Example
