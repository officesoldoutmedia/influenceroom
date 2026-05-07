import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from './cn'

type FieldShellProps = {
  label?: string
  hint?: string
  error?: string | null
  required?: boolean
  className?: string
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const invalid = !!error
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('block', className)}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-stone-700 mb-1.5">
          {label}
          {required && <span className="text-brand-700"> *</span>}
        </label>
      )}
      {children(id, describedBy, invalid)}
      {error ? (
        <p id={errorId} className="mt-1.5 text-[12px] text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-[12px] text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full px-3 py-2.5 border rounded-md text-[15px] bg-white text-stone-900 placeholder:text-stone-400 ' +
  'transition-colors duration-150 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-0 ' +
  'disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed'

const inputColors = (invalid: boolean) =>
  invalid
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
    : 'border-stone-300 focus:border-brand-700 focus:ring-brand-500/20'

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string
  hint?: string
  error?: string | null
}

export const Input = forwardRef<HTMLInputElement, BaseInputProps>(function Input(
  { label, hint, error, required, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy, invalid) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(inputBase, inputColors(invalid))}
          {...rest}
        />
      )}
    </Field>
  )
})

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string | null
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy, invalid) => (
        <textarea
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(inputBase, inputColors(invalid), 'resize-y min-h-[88px]')}
          {...rest}
        />
      )}
    </Field>
  )
})

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: string | null
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, className, children, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id, describedBy, invalid) => (
        <select
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(inputBase, inputColors(invalid), 'appearance-none bg-no-repeat pr-9')}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'><path d='M3 4.5L6 7.5L9 4.5' stroke='%2378716c' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
            backgroundPosition: 'right 0.75rem center',
          }}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  )
})
