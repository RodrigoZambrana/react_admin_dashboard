import { Navigate } from 'react-router-dom'
import { appPath } from '@/constants/route.constant'

const UserNew = () => (
    <Navigate to={appPath("/users/list")} replace state={{ openUserDrawer: 'new' }} />
)

export default UserNew
