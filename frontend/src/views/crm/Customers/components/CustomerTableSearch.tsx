import { forwardRef } from 'react'
import Input from '@/components/ui/Input'
import { HiOutlineSearch } from 'react-icons/hi'
import debounce from 'lodash/debounce'
import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

type CustomerTableSearchProps = {
    onInputChange: (value: string) => void
}

const CustomerTableSearch = forwardRef<
    HTMLInputElement,
    CustomerTableSearchProps
>((props, ref) => {
    const { onInputChange } = props
    const { t } = useTranslation()

    const debounceFn = debounce(handleDebounceFn, 500)

    function handleDebounceFn(value: string) {
        onInputChange?.(value)
    }

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        debounceFn(e.target.value)
    }

    return (
        <Input
            ref={ref}
            className="max-w-md md:w-52 mb-4"
            size="sm"
            placeholder={t('text.placeholders.search')}
            prefix={<HiOutlineSearch className="text-lg" />}
            onChange={handleInputChange}
        />
    )
})

CustomerTableSearch.displayName = 'CustomerTableSearch'

export default CustomerTableSearch
