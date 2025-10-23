import React, { JSX, useMemo } from 'react'
import {
  HiOutlineInbox,
  HiOutlinePaperAirplane,
  HiOutlinePencil,
  HiOutlineStar,
  HiOutlineTrash,
} from 'react-icons/hi'
import { useTranslation } from 'react-i18next'

type MenuBase = {
  value: string
  label: string
}

type Group = MenuBase & {
  icon: JSX.Element
}

type Label = MenuBase & {
  dotClass: string
}

// Estas son las claves base. No incluyen texto traducido.
const groupDefs = [
  { value: 'inbox', icon: <HiOutlineInbox /> },
  { value: 'sentItem', icon: <HiOutlinePaperAirplane /> },
  { value: 'draft', icon: <HiOutlinePencil /> },
  { value: 'starred', icon: <HiOutlineStar /> },
  { value: 'deleted', icon: <HiOutlineTrash /> },
]

const labelDefs = [
  { value: 'work', dotClass: 'bg-blue-500' },
  { value: 'private', dotClass: 'bg-indigo-500' },
  { value: 'important', dotClass: 'bg-red-500' },
]

export default function MailList() {
  const { t, i18n } = useTranslation('mail') // usa tu namespace de traducción

  // Traduce dinámicamente los labels cada vez que cambia el idioma
  const groupList: Group[] = useMemo(
    () =>
      groupDefs.map((g) => ({
        ...g,
        label: t(`group.${g.value}`),
      })),
    [t, i18n.language]
  )

  const labelList: Label[] = useMemo(
    () =>
      labelDefs.map((l) => ({
        ...l,
        label: t(`label.${l.value}`),
      })),
    [t, i18n.language]
  )

  // Ejemplo de render (ajústalo a tu caso real)
  return (
    <div>
      <h2>{t('title')}</h2>
      <ul>
        {groupList.map((g) => (
          <li key={g.value} className="flex items-center gap-2">
            {g.icon}
            {g.label}
          </li>
        ))}
      </ul>

      <h3>{t('labelsTitle')}</h3>
      <ul>
        {labelList.map((l) => (
          <li key={l.value} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${l.dotClass}`}></span>
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  )
}