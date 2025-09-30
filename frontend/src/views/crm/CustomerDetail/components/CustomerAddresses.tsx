import { useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { apiGetCountries, apiGetCities } from '@/services/SettingsService'
import {
  apiGetCustomerAddresses,
  apiCreateCustomerAddress,
  apiUpdateCustomerAddress,
  apiDeleteCustomerAddress,
  apiSetPrimaryCustomerAddress,
} from '@/services/CrmService'
import { useTranslation } from 'react-i18next'

type Address = {
  id?: number
  street: string
  number: string
  corner?: string
  apartment?: string
  city: string
  country: string
  isPrimary?: boolean
}

export default function CustomerAddresses({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const [list, setList] = useState<Address[]>([])
  const [editing, setEditing] = useState<Address | null>(null)
  const [countries, setCountries] = useState<{ value: string; label: string }[]>([])
  const [cities, setCities] = useState<{ value: string; label: string }[]>([])
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    const res = await apiGetCustomerAddresses<Address[], { customerId: string }>({ customerId })
    setList(res.data as any)
  }

  useEffect(() => {
    load()
    apiGetCountries<{ code: string; name: string }[]>().then((res) => setCountries((res.data as any[]).map((c) => ({ value: c.code, label: c.name }))))
  }, [customerId])

  const startEdit = (addr?: Address) => {
    setEditing(
      addr || {
        street: '',
        number: '',
        corner: '',
        apartment: '',
        city: '',
        country: '',
        isPrimary: list.length === 0,
      },
    )
  }

  const save = async () => {
    if (!editing) return
    const payload = { ...editing, customerId }
    if (editing.id) await apiUpdateCustomerAddress<boolean, any>(payload as any)
    else await apiCreateCustomerAddress<boolean, any>(payload as any)
    setEditing(null)
    load()
  }

  const setPrimary = async (id: number) => {
    await apiSetPrimaryCustomerAddress<boolean, { id: number }>({ id })
    load()
  }

  const doDelete = async () => {
    if (deleteId) {
      await apiDeleteCustomerAddress<boolean, { id: number }>({ id: deleteId })
      setDeleteId(null)
      load()
    }
  }

  useEffect(() => {
    const ctry = countries.find((c) => c.label === editing?.country)
    if (editing && ctry) {
      apiGetCities<{ name: string }[], { country: string }>({ country: ctry.value }).then((res) => setCities((res.data as any[]).map((x) => ({ value: x.name, label: x.name }))))
    }
  }, [editing?.country, countries])

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h5>{t('text.titles.addressInformation')}</h5>
        <Button size="sm" variant="solid" onClick={() => startEdit()}>
          {t('text.actions.add')}
        </Button>
      </div>
      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="flex items-center justify-between border p-3 rounded">
            <div>
              <div className="font-semibold">
                {a.street} {a.number} {a.apartment && `Apt ${a.apartment}`}
              </div>
              <div className="opacity-80 text-sm">
                {a.corner && `${t('text.labels.addressLine2')}: Corner ${a.corner} · `}
                {a.city}, {a.country}
              </div>
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
        ))}
        {list.length === 0 && <div className="opacity-70">{t('text.messages.noAddresses') || 'No addresses yet'}</div>}
      </div>

      {editing && (
        <div className="mt-4 border-t pt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={editing.street ?? ''} placeholder={t('text.labels.street') || 'Street'} onChange={(e) => setEditing({ ...editing, street: e.target.value })} />
            <Input value={editing.number ?? ''} placeholder={t('text.labels.number') || 'Number'} onChange={(e) => setEditing({ ...editing, number: e.target.value })} />
            <Input value={editing.corner ?? ''} placeholder={t('text.labels.corner') || 'Corner'} onChange={(e) => setEditing({ ...editing, corner: e.target.value })} />
            <Input value={editing.apartment ?? ''} placeholder={t('text.labels.apartment') || 'Apartment'} onChange={(e) => setEditing({ ...editing, apartment: e.target.value })} />
            <Select options={countries} value={countries.find((c) => c.label === editing.country) as any}
              onChange={(opt) => setEditing({ ...editing, country: (opt as any).label || '' })} />
            <Select options={cities} value={cities.find((c) => c.label === editing.city) as any}
              onChange={(opt) => setEditing({ ...editing, city: (opt as any).label || '' })} />
          </div>
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
