import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { TableSkeleton, Skeleton } from '@/components/Skeleton'

type User = { _id: string; name: string; email: string; role: string }

export function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getUsers()
      .then((res) => {
        setUsers(res.data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <section>
        <Skeleton width="150px" height="32px" style={{ marginBottom: '24px' }} />
        <TableSkeleton rows={8} columns={3} />
      </section>
    )
  }

  return (
    <section>
      <h2>Users</h2>
      {error && <div className="error">{error}</div>}
      <div className="cards">
        {users.map((u) => (
          <div className="card" key={u._id}>
            <strong>{u.name}</strong>
            <span>{u.email}</span>
            <small>{u.role}</small>
          </div>
        ))}
      </div>
    </section>
  )
}


