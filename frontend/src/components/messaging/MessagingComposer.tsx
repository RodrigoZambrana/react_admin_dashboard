import type { ChangeEvent, ReactNode } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type MessagingComposerProps = {
    value: string
    placeholder?: string
    onChange: (event: ChangeEvent<HTMLInputElement>) => void
    onSubmit?: () => void
    disabled?: boolean
    loading?: boolean
    submitIcon?: ReactNode
    inputTestId?: string
    submitTestId?: string
    submitAriaLabel?: string
}

const MessagingComposer = ({
    value,
    placeholder,
    onChange,
    onSubmit,
    disabled = false,
    loading = false,
    submitIcon,
    inputTestId,
    submitTestId,
    submitAriaLabel = 'Enviar mensaje',
}: MessagingComposerProps) => {
    return (
        <div className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-slate-50 px-3 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <Input
                className="flex-1 border-0 bg-transparent shadow-none focus:ring-0"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                data-testid={inputTestId}
            />
            <Button
                shape="circle"
                variant="solid"
                size="sm"
                icon={submitIcon}
                loading={loading}
                disabled={disabled}
                onClick={onSubmit}
                data-testid={submitTestId}
                aria-label={submitAriaLabel}
            />
        </div>
    )
}

export default MessagingComposer
