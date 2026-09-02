// Isologotipo AUNARO: reconstrucción geométrica a partir de "Presentación_MARCA_Aunaro.pdf".
// Reemplazar por el export vectorial oficial si el diseñador entrega un SVG final.
export default function AunaroSymbol({ size = 24, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <line x1="44" y1="16" x2="24" y2="84" stroke="#E8394A" strokeWidth="15" strokeLinecap="round" />
      <line x1="56" y1="16" x2="76" y2="84" stroke="#3BBF7A" strokeWidth="15" strokeLinecap="round" />
      <path
        d="M50 36 C56 36 60 42 64 51 L70 66 C74 75 76 80 74 84 C71 88 64 89 50 89 C36 89 29 88 26 84 C24 80 26 75 30 66 L36 51 C40 42 44 36 50 36 Z"
        fill="#F2A623"
      />
    </svg>
  )
}
