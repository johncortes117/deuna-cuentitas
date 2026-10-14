// ─── Avatar: el mismo color e iniciales en todas las pantallas ──
// Antes había tres fórmulas de color distintas (sala, división y deudas):
// la misma persona aparecía verde en un lado y roja en otro, y la gente
// reconoce a sus amigos por el color antes que por el nombre.
import { getAvatarColor, getInitials } from '../utils';

interface AvatarProps {
  name: string;
  size?: number;
}

export default function Avatar({ name, size = 40 }: AvatarProps) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: getAvatarColor(name), width: size, height: size }}
      aria-hidden="true"
    >
      <span className="text-white font-bold leading-none" style={{ fontSize: Math.round(size * 0.34) }}>
        {getInitials(name)}
      </span>
    </div>
  );
}
