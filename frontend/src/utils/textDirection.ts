const RTL_RANGES: Array<[number, number]> = [
    [0x0590, 0x06ff],
    [0x0750, 0x077f],
    [0x08a0, 0x08ff],
    [0xfb50, 0xfdff],
    [0xfe70, 0xfeff],
    [0x1ee00, 0x1eeff],
]

const LTR_RANGES: Array<[number, number]> = [
    [0x0041, 0x005a],
    [0x0061, 0x007a],
    [0x00c0, 0x02af],
    [0x0370, 0x052f],
    [0x0530, 0x058f],
    [0x1e00, 0x1fff],
    [0x2c60, 0x2c7f],
    [0xa720, 0xa7ff],
]

const isCodePointInRanges = (codePoint: number, ranges: Array<[number, number]>) =>
    ranges.some(([start, end]) => codePoint >= start && codePoint <= end)

export const resolveTextDirection = (value?: string | null): 'ltr' | 'rtl' => {
    if (!value) {
        return 'ltr'
    }
    for (const char of value) {
        const codePoint = char.codePointAt(0)
        if (codePoint === undefined) {
            continue
        }
        if (isCodePointInRanges(codePoint, RTL_RANGES)) {
            return 'rtl'
        }
        if (
            isCodePointInRanges(codePoint, LTR_RANGES) ||
            (codePoint >= 0x0030 && codePoint <= 0x0039)
        ) {
            return 'ltr'
        }
    }
    return 'ltr'
}

