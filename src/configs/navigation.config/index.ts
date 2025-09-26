import appsNavigationConfig from './apps.navigation.config'
import type { NavigationTree } from '@/@types/navigation'
import { NAV_ITEM_TYPE_ITEM } from '@/constants/navigation.constant'
import { ADMIN, USER } from '@/constants/roles.constant'

const navigationConfig: NavigationTree[] = [
    ...appsNavigationConfig,
]

export default navigationConfig
