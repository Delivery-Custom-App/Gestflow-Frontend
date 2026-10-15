import { iniciales } from '../lib/perfil'
import { cn } from '@/lib/utils'

/** Círculo con las iniciales de la persona: reemplaza a la foto de perfil. */
export default function InicialesPerfil({ user, className }) {
  return (
    <span
      aria-hidden="true"
      data-testid="iniciales-perfil"
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)] font-bold text-[hsl(var(--primary))]',
        className,
      )}
    >
      {iniciales(user)}
    </span>
  )
}
