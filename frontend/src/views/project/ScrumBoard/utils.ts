export const reorder = <T>(list: T[], startIndex: number, endIndex: number) => {
    const result = Array.from(list)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)
    return result
}

export const createUID = (len: number) => {
    const buf = [],
        chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        charlen = chars.length,
        length = len || 32

    for (let i = 0; i < length; i++) {
        buf[i] = chars.charAt(Math.floor(Math.random() * charlen))
    }
    return buf.join('')
}

export const taskLabelColors: Record<string, string> = {
    // type labels (legacy)
    'Live issue': 'bg-rose-500',
    Task: 'bg-blue-500',
    Bug: 'bg-amber-400',
    'Low priority': 'bg-indigo-500',
    // priority labels (new)
    'High priority': 'bg-red-500',
    'Medium priority': 'bg-amber-500',
    // keep low aligned with existing color
}

// Quick filter tabs: priorities (use keys for i18n rendering)
export const labelList = ['high', 'medium', 'low']
