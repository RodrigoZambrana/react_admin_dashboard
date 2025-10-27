import { useCallback, useEffect, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
  apiGetCustomerAddresses,
  apiCreateCustomerAddress,
  apiUpdateCustomerAddress,
  apiDeleteCustomerAddress,
  apiSetPrimaryCustomerAddress,
} from '@/services/CustomersService'
import { useTranslation } from 'react-i18next'
import CountrySelect from '@/components/shared/CountrySelect'
import CitySelect from '@/components/shared/CitySelect'
import { deriveCountryCode, useCountryCityData } from '@/components/shared/countryCity'

type Address = {
  id?: number
  street: string
  number: string
  corner?: string
  apartment?: string
  city: string
  country: string
  countryCode?: string
  isPrimary?: boolean
  comments?: string
  label?: string
}

export default function CustomerAddresses({
  customerId,
  className,
}: {
  customerId: string
  className?: string
}) {
  const { t } = useTranslation()
  const [list, setList] = useState<Address[]>([])
  const [editing, setEditing] = useState<Address | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const { getFirstCityForCountry } = useCountryCityData()

  const load = useCallback(async () => {
    const res = await apiGetCustomerAddresses<Address[], { customerId: string }>({ customerId })
    setList(res.data as any)
  }, [customerId])

  useEffect(() => {
    load()
  }, [customerId, load])

  const startEdit = (addr?: Address) => {
    if (addr) {
      setEditing({
        ...addr,
        street: addr.street ?? '',
        number: addr.number ?? '',
        corner: addr.corner ?? '',
        apartment: addr.apartment ?? '',
        city: addr.city ?? '',
        country: addr.country ?? '',
        countryCode: addr.countryCode ?? deriveCountryCode(addr.country ?? ''),
        comments: addr.comments ?? '',
        label: addr.label ?? '',
      })
      return
    }
    setEditing(
      {
        street: '',
        number: '',
        corner: '',
        apartment: '',
        city: '',
        country: '',
        countryCode: '',
        isPrimary: list.length === 0,
        comments: '',
        label: '',
      },
    )
  }

  const save = async () => {
    if (!editing) return
    const payload = {
      ...editing,
      customerId,
      label: (editing.label ?? '').trim(),
    }
    if (editing.id) await apiUpdateCustomerAddress<boolean, any>(payload as any)
    else await apiCreateCustomerAddress<boolean, any>(payload as any)
    setEditing(null)
    load()
  }

  const setPrimary = async (id: number) => {
    await apiSetPrimaryCustomerAddress<boolean, { id: number; customerId: string }>(
      { id, customerId },
    )
    load()
  }

  const doDelete = async () => {
    if (deleteId) {
      await apiDeleteCustomerAddress<boolean, { id: number; customerId: string }>(
        { id: deleteId, customerId },
      )
      setDeleteId(null)
      load()
    }
  }

  useEffect(() => {
    if (!editing) return
    if (!editing.country) return
    if (editing.city) return
    const nextCity = getFirstCityForCountry(editing.country)
    if (!nextCity) return
    setEditing((prev) => (prev ? { ...prev, city: nextCity } : prev))
  }, [editing, getFirstCityForCountry])

  const handleCountryChange = (country?: { code?: string; name?: string }) => {
    setEditing((prev) => {
      if (!prev) return prev
      const name = country?.name?.trim() ?? ''
      if (!name) {
        return { ...prev, country: '', countryCode: '', city: '' }
      }
      const code = country?.code ?? deriveCountryCode(name)
      const suggestedCity = getFirstCityForCountry(name) ?? ''
      return {
        ...prev,
        country: name,
        countryCode: code,
        city: suggestedCity,
      }
    })
  }

  const handleCityChange = (city?: string) => {
    setEditing((prev) => (prev ? { ...prev, city: city ?? '' } : prev))
  }

  return (
    <Card className={className ?? 'mt-4'}>
      <div className="flex items-center justify-between mb-3">
        <h5>{t('text.titles.addressInformation')}</h5>
        <Button size="sm" variant="solid" onClick={() => startEdit()}>
          {t('text.actions.add')}
        </Button>
      </div>
      <div className="space-y-3">
        {list.map((a) => {
          const locality = [a.city, a.country]
            .map((value) => (value || '').trim())
            .filter((value) => value.length > 0)
            .join(', ')

          return (
            <div key={a.id} className="flex items-center justify-between border p-3 rounded">
              <div>
                {a.label && <div className="text-sm font-semibold text-gray-700">{a.label}</div>}
                <div className="font-semibold">
                  {a.street} {a.number} {a.apartment && `Apt ${a.apartment}`}
                </div>
                {a.corner && (
                  <div className="opacity-80 text-sm">
                    {t('text.labels.cornerFormat', {
                      defaultValue: `esquina ${a.corner}`,
                      corner: a.corner,
                    })}
                  </div>
                )}
                {locality && <div className="opacity-80 text-sm">{locality}</div>}
                {a.comments && <div className="opacity-70 text-sm mt-1">{a.comments}</div>}
              </div>
              <div className="flex items-center gap-2">
                {a.isPrimary ? (
                  <span className="text-emerald-600 font-semibold">{t('text.labels.primary')}</span>
                ) : (
                  <Button size="sm" onClick={() => setPrimary(a.id!)}>{t('text.actions.setPrimary') || 'Set primary'}</Button>
                )}
                <Button size="sm" onClick={() => startEdit(a)}>{t('text.actions.edit')}</Button>
                <Button size="sm" color="red-600" onClick={() => setDeleteId(a.id!)}>{t('text.actions.delete')}</Button>
              </div>
            </div>
          )
        })}
        {list.length === 0 && <div className="opacity-70">{t('text.messages.noAddresses') || 'No addresses yet'}</div>}
      </div>

      {editing && (
        <div className="mt-4 border-t pt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={editing.label ?? ''} placeholder={t('text.labels.addressLabel') || 'Etiqueta'} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
            <Input value={editing.street ?? ''} placeholder={t('text.labels.street') || 'Street'} onChange={(e) => setEditing({ ...editing, street: e.target.value })} />
            <Input value={editing.number ?? ''} placeholder={t('text.labels.number') || 'Number'} onChange={(e) => setEditing({ ...editing, number: e.target.value })} />
            <Input value={editing.corner ?? ''} placeholder={t('text.labels.corner') || 'Corner'} onChange={(e) => setEditing({ ...editing, corner: e.target.value })} />
            <Input value={editing.apartment ?? ''} placeholder={t('text.labels.apartment') || 'Apartment'} onChange={(e) => setEditing({ ...editing, apartment: e.target.value })} />
            <CountrySelect
              value={{ code: editing.countryCode || undefined, name: editing.country || undefined }}
              onChange={handleCountryChange}
              placeholder={t('text.labels.country') || 'Country'}
              className="w-full"
            />
            <CitySelect
              countryCode={editing.countryCode}
              countryName={editing.country}
              value={editing.city}
              onChange={handleCityChange}
              placeholder={t('text.labels.city') || 'City'}
              className="w-full"
            />
          </div>
          <Input
            textArea
            rows={3}
            value={editing.comments ?? ''}
            placeholder={t('text.labels.comments') || 'Comentarios'}
            onChange={(e) => setEditing({ ...editing, comments: e.target.value })}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" onClick={() => setEditing(null)}>{t('text.actions.cancel')}</Button>
            <Button size="sm" variant="solid" onClick={save}>{t('text.actions.save')}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteId !== null}
        type="danger"
        title={t('text.actions.delete')}
        confirmButtonColor="red-600"
        onClose={() => setDeleteId(null)}
        onRequestClose={() => setDeleteId(null)}
        onCancel={() => setDeleteId(null)}
        onConfirm={doDelete}
      >
        <p>{t('text.messages.deleteConfirm') || 'Are you sure to delete?'}</p>
      </ConfirmDialog>
    </Card>
  )
}
