import { forwardRef, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'ghost'
  | 'outline'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref' | 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  children?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-okami-accent text-white hover:bg-okami-accent-hover active:brightness-95 shadow-sm focus-visible:ring-okami-accent',
  secondary:
    'bg-gray-200 text-gray-800 hover:bg-gray-300 active:bg-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:active:bg-gray-500 focus-visible:ring-gray-400',
  danger:
    'bg-okami-danger text-white hover:brightness-110 active:brightness-95 shadow-sm focus-visible:ring-okami-danger',
  success:
    'bg-okami-success text-white hover:brightness-110 active:brightness-95 shadow-sm focus-visible:ring-okami-success',
  ghost:
    'bg-transparent text-okami-accent hover:bg-orange-50 active:bg-orange-100 dark:hover:bg-orange-950/40 dark:active:bg-orange-950/60 focus-visible:ring-okami-accent',
  outline:
    'bg-transparent text-gray-700 border border-okami-border hover:bg-okami-panel active:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/50 dark:active:bg-gray-700 focus-visible:ring-gray-400',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'min-h-[44px] px-4 py-2.5 text-sm sm:text-base rounded-xl gap-2',
  lg: 'min-h-[52px] px-6 py-3.5 text-base sm:text-lg rounded-xl gap-2 font-semibold',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  const base =
    'inline-flex items-center justify-center font-semibold transition-colors select-none ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed'

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.1 }}
      className={[
        base,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </motion.button>
  )
})

export default Button
