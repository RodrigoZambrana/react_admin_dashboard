import { useRef, useEffect, useCallback, useMemo } from 'react'
import ApexCharts from 'apexcharts'
import {
    apexLineChartDefaultOption,
    apexBarChartDefaultOption,
    apexAreaChartDefaultOption,
    apexDonutChartDefaultOption,
} from '@/configs/chart.config'
import { DIR_RTL } from '@/constants/theme.constant'
import type { ApexOptions } from 'apexcharts'
import type { Direction } from '@/@types/theme'
import type { ReactNode } from 'react'

const notDonut = ['line', 'bar', 'area']

type ChartType = 'line' | 'bar' | 'area' | 'donut'

export interface ChartProps {
    series?: ApexOptions['series']
    width?: string | number
    height?: string | number
    /* eslint-disable @typescript-eslint/no-explicit-any */
    xAxis?: any
    customOptions?: ApexOptions
    type?: ChartType
    direction?: Direction
    donutTitle?: string | ReactNode
    donutText?: string | ReactNode
    className?: string
}

const cloneChartValue = <T,>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map((item) => cloneChartValue(item)) as T
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>).map(
            ([key, entry]) => [key, cloneChartValue(entry)],
        )
        return Object.fromEntries(entries) as T
    }
    return value
}

const mergeChartOptions = (
    base: Record<string, unknown>,
    override: Record<string, unknown>,
): Record<string, unknown> => {
    const merged = { ...base }
    Object.entries(override).forEach(([key, value]) => {
        const current = merged[key]
        if (
            current &&
            value &&
            typeof current === 'object' &&
            !Array.isArray(current) &&
            typeof value === 'object' &&
            !Array.isArray(value)
        ) {
            merged[key] = mergeChartOptions(
                current as Record<string, unknown>,
                value as Record<string, unknown>,
            )
            return
        }
        merged[key] = value
    })
    return merged
}

const Chart = (props: ChartProps) => {
    const {
        series = [],
        width = '100%',
        height = 300,
        xAxis,
        customOptions,
        type = 'line',
        direction,
        donutTitle,
        donutText,
        className,
        ...rest
    } = props

    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstanceRef = useRef<ApexCharts | null>(null)

    const chartDefaultOption = useMemo(() => {
        switch (type) {
            case 'line':
                return apexLineChartDefaultOption
            case 'bar':
                return apexBarChartDefaultOption
            case 'area':
                return apexAreaChartDefaultOption
            case 'donut':
                return apexDonutChartDefaultOption
            default:
                return apexLineChartDefaultOption
        }
    }, [type])

    const setLegendOffset = useCallback(() => {
        if (typeof window === 'undefined' || !chartRef.current) {
            return
        }
        const legend = chartRef.current.querySelectorAll<HTMLDivElement>(
                'div.apexcharts-legend',
        )[0]
        if (!legend) {
            return
        }
        const isMobile = window.innerWidth < 768
        if (direction === DIR_RTL) {
            legend.style.right = 'auto'
            legend.style.left = '0'
        }
        if (isMobile) {
            legend.style.position = 'relative'
            legend.style.top = '0'
            legend.style.justifyContent = 'start'
            legend.style.padding = '0'
        }
    }, [direction])

    const options = useMemo<ApexOptions>(() => {
        const baseOptions = cloneChartValue(chartDefaultOption)
        const mergedOptions = customOptions
            ? (mergeChartOptions(
                  baseOptions as Record<string, unknown>,
                  customOptions as unknown as Record<string, unknown>,
              ) as ApexOptions)
            : baseOptions

        if (notDonut.includes(type as ChartType)) {
            mergedOptions.xaxis = {
                ...(mergedOptions.xaxis || {}),
                categories: xAxis,
            }
        }

        if (type === 'donut') {
            const pieOptions = mergedOptions.plotOptions?.pie
            const donutOptions = pieOptions?.donut
            const donutLabels = donutOptions?.labels
            const donutTotal = donutLabels?.total

            if (donutTitle && pieOptions && donutOptions && donutLabels && donutTotal) {
                donutTotal.label = donutTitle
            }
            if (donutText && pieOptions && donutOptions && donutLabels && donutTotal) {
                donutTotal.formatter = () => donutText
            }
        }

        return mergedOptions
    }, [chartDefaultOption, customOptions, donutText, donutTitle, type, xAxis])

    useEffect(() => {
        if (typeof window === 'undefined' || !chartRef.current) {
            return
        }

        const chart = new ApexCharts(chartRef.current, {
            ...options,
            chart: {
                ...(options.chart || {}),
                type,
                height,
                width,
            },
            series,
        })

        chartInstanceRef.current = chart

        void chart.render().then(() => {
            if (notDonut.includes(type as ChartType)) {
                setLegendOffset()
            }
        })

        return () => {
            chart.destroy()
            if (chartInstanceRef.current === chart) {
                chartInstanceRef.current = null
            }
        }
    }, [height, options, series, setLegendOffset, type, width])

    return (
        <div
            ref={chartRef}
            style={direction === DIR_RTL ? { direction: 'ltr' } : {}}
            className={className ? `chartRef ${className}` : 'chartRef'}
            {...rest}
        >
        </div>
    )
}

export default Chart
