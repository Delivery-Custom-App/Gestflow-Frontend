import { motion } from 'framer-motion'
import { GradientTracing } from '@/components/ui/gradient-tracing'

const CIRCLE_SIZE = 280
const CX = CIRCLE_SIZE / 2
const R  = 110
const CIRCLE_PATH = `M${CX},${CX} m0,-${R} a${R},${R} 0 1,1 -0.1,0 z`

export default function LoadingPage() {
  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-[#010f09] to-[#022c1a] z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      {/* Outer glow */}
      <div className="absolute w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-center">
        {/* Tracing rings */}
        <GradientTracing
          width={CIRCLE_SIZE}
          height={CIRCLE_SIZE}
          path={CIRCLE_PATH}
          baseColor="#4ade80"
          gradientColors={['#4ade80', '#22c55e', '#4ade80']}
          strokeWidth={1.5}
          animationDuration={2.5}
        />
        {/* Second ring slightly larger, opposite direction feel */}
        <div className="absolute">
          <GradientTracing
            width={CIRCLE_SIZE - 30}
            height={CIRCLE_SIZE - 30}
            path={`M${(CIRCLE_SIZE-30)/2},${(CIRCLE_SIZE-30)/2} m0,-${R-22} a${R-22},${R-22} 0 1,1 -0.1,0 z`}
            baseColor="#10b981"
            gradientColors={['#10b981', '#6ee7b7', '#10b981']}
            strokeWidth={1}
            animationDuration={1.8}
          />
        </div>

        {/* Brand centered */}
        <motion.div
          className="absolute flex flex-col items-center gap-2"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <span className="text-2xl font-extrabold tracking-tight text-white drop-shadow-lg">
            Gestflow
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
