import { Navigate } from 'react-router-dom'

const UserNew = () => (
    <Navigate to="/app/users/list" replace state={{ openUserDrawer: 'new' }} />
)

export default UserNew
