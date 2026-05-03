import { useAppSelector } from '@/store'
import { THEME_ENUM } from '@/constants/theme.constant'
import { normalizeAdminAssetSrc } from '@/constants/route.constant'
import type { DetailedHTMLProps, ImgHTMLAttributes } from 'react'

interface DoubleSidedImageProps
    extends DetailedHTMLProps<
        ImgHTMLAttributes<HTMLImageElement>,
        HTMLImageElement
    > {
    darkModeSrc: string
}

const { MODE_DARK } = THEME_ENUM

const DoubleSidedImage = ({
    src,
    darkModeSrc,
    alt = '',
    ...rest
}: DoubleSidedImageProps) => {
    const mode = useAppSelector((state) => state.theme.mode)
    const resolvedSrc = normalizeAdminAssetSrc(
        mode === MODE_DARK ? darkModeSrc : String(src ?? ''),
    )

    return (
        <img src={resolvedSrc} alt={alt} {...rest} />
    )
}

export default DoubleSidedImage
