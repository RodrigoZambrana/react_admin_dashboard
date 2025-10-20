import { forwardRef } from 'react'
import Input, { type InputProps } from './Input'

type TextareaProps = InputProps

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ placeholder = 'Text area example', ...props }, ref) => {
        return (
            <div>
                <Input
                    placeholder={placeholder}
                    textArea
                    {...props}
                    ref={ref as unknown as Element}
                />
            </div>
        )
    },
)

Textarea.displayName = 'Textarea'

export default Textarea
