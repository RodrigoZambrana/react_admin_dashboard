/* eslint-disable  @typescript-eslint/no-explicit-any */
import type { Server } from 'miragejs'

export default function usersFakeApi(server: Server, apiPrefix: string) {
    server.get(`${apiPrefix}/users`, (schema) => {
        return schema.db.usersData
    })

    server.post(`${apiPrefix}/users`, (schema, { requestBody }) => {
        const data = JSON.parse(requestBody)
        const id = String((schema.db.usersData.length || 0) + 1)
        const newUser = {
            id,
            name: data.name,
            email: data.email,
            img: data.img || '/img/avatars/thumb-1.jpg',
        }
        schema.db.usersData.insert(newUser as any)
        return newUser
    })

    server.put(`${apiPrefix}/users/:id`, (schema, { params, requestBody }) => {
        const { id } = params
        const data = JSON.parse(requestBody)
        const existing = (schema.db.usersData as any).findBy({ id })
        if (!existing) {
            return new Response(404)
        }
        const updated = { ...existing, ...data }
        ;(schema.db.usersData as any).update({ id }, updated)
        return updated
    })
}
