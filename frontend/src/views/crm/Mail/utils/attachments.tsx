import {
    BsFileEarmarkPdf,
    BsFileEarmarkWord,
    BsFileExcel,
    BsFileEarmark,
    BsCardImage,
} from 'react-icons/bs'
import type { ReactNode } from 'react'

export const normalizeAttachmentType = (input?: string | null) => {
    if (!input) {
        return ''
    }
    const lowered = input.toLowerCase()
    if (lowered.includes('/')) {
        return lowered.split('/').pop() || lowered
    }
    if (lowered.includes('.')) {
        return lowered.split('.').pop() || lowered
    }
    return lowered
}

export const getAttachmentIcon = (type?: string | null): ReactNode => {
    const normalized = normalizeAttachmentType(type)
    switch (normalized) {
        case 'doc':
        case 'docx':
            return <BsFileEarmarkWord className="text-blue-500" />
        case 'xls':
        case 'xlsx':
            return <BsFileExcel className="text-emerald-500" />
        case 'pdf':
            return <BsFileEarmarkPdf className="text-red-500" />
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            return <BsCardImage />
        default:
            return <BsFileEarmark />
    }
}
