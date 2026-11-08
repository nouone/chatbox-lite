import { createFileRoute, Navigate } from '@tanstack/react-router'
export const Route = createFileRoute('/guide/')({ component: RouteComponent })
export function RouteComponent() {
  return <Navigate to="/about" replace />
}
