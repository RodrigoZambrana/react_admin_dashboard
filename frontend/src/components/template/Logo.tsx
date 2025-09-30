import classNames from 'classnames'
import { Link } from 'react-router-dom'
import { APP_NAME } from '@/constants/app.constant'
import type { CommonProps } from '@/@types/common'

interface LogoProps extends CommonProps {
    type?: 'full' | 'streamline'
    mode?: 'light' | 'dark'
    imgClass?: string
    logoWidth?: number | string
}

const LOGO_SRC_PATH = '/img/logo/'

const Logo = (props: LogoProps) => {
    const {
        type = 'full',
        mode = 'light',
        className,
        imgClass,
        style,
        logoWidth = 'auto',
    } = props

    return (
        <Link to="/">
            <div
                className={classNames('logo', className)}
                style={{
                    ...style,
                    ...{ width: logoWidth },
                }}
            >
                <img
                    className={imgClass}
                    src={`${LOGO_SRC_PATH}logo-${mode}-${type}.png`}
                    alt={`${APP_NAME} logo`}
                />
            </div>
        </Link>
    )
}

export default Logo
