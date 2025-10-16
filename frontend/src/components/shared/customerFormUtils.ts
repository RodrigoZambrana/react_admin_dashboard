import type {
    CustomerProps,
    FormModel as CustomerFormModel,
} from '@/views/crm/CustomerForm'

export type CustomerUpsertPayload = Record<string, unknown>

export const composeCustomerPayload = (
    values: CustomerFormModel,
    customer?: (CustomerProps & { id?: string | number }) | null,
): CustomerUpsertPayload => {
    const normalizedFirstName = String(values.firstName || '').trim()
    const normalizedLastName = String(values.lastName || '').trim()
    const normalizedEmail = String(values.email || '').trim()

    const payload: CustomerUpsertPayload = {
        firstName: normalizedFirstName,
        lastName: normalizedLastName || undefined,
        email: normalizedEmail.length > 0 ? normalizedEmail : null,
        img: values.img,
        phoneNumber: values.phoneNumber,
        phoneNumbers: values.phoneNumbers,
        personalInfo: {
            location: values.location,
            phoneNumber: values.phoneNumber,
            phoneNumbers: values.phoneNumbers,
            facebook: values.facebook,
            twitter: values.twitter,
            pinterest: values.pinterest,
            linkedIn: values.linkedIn,
        },
    }

    const rawId = customer?.id
    if (rawId !== undefined && rawId !== null) {
        const numericId = typeof rawId === 'number' ? rawId : Number(rawId)
        if (
            Number.isFinite(numericId) &&
            Number.isInteger(numericId) &&
            numericId > 0 &&
            numericId <= 2_147_483_647
        ) {
            payload.id = numericId
        }
    }

    if (values.address) {
        payload.address = {
            street: values.address.street,
            number: values.address.number,
            corner: values.address.corner,
            apartment: values.address.apartment,
            city: values.address.city,
            country: values.address.state,
            countryCode: values.address.countryCode,
            comments: values.address.comments?.trim() || undefined,
        }
    }

    const computedName = [normalizedFirstName, normalizedLastName]
        .map((part) => String(part || '').trim())
        .filter((part) => part.length > 0)
        .join(' ')

    if (computedName) {
        payload.name = computedName
    }

    return payload
}

export const normalizeCustomerForSuccess = (
    saved: Record<string, unknown>,
    formValues: CustomerFormModel,
) => {
    const sanitizedPhones = (formValues.phoneNumbers || [])
        .map((phone) => phone.trim())
        .filter((phone) => phone.length > 0)
    const primaryPhone = sanitizedPhones[0] || formValues.phoneNumber || ''

    return {
        ...saved,
        phoneNumber: primaryPhone,
        phoneNumbers: sanitizedPhones,
        personalInfo: {
            ...(saved.personalInfo as Record<string, unknown> | undefined),
            location: formValues.location,
            phoneNumber: primaryPhone,
            phoneNumbers: sanitizedPhones,
            facebook: formValues.facebook,
            twitter: formValues.twitter,
            pinterest: formValues.pinterest,
            linkedIn: formValues.linkedIn,
        },
        addresses: formValues.address
            ? [
                  {
                      street: formValues.address.street,
                      number: formValues.address.number,
                      corner: formValues.address.corner,
                      apartment: formValues.address.apartment,
                      city: formValues.address.city,
                      country: formValues.address.state,
                      countryCode: formValues.address.countryCode,
                      isPrimary: true,
                      comments: (formValues.address.comments || '').trim(),
                  },
              ]
            : (saved.addresses as unknown[]) || [],
    }
}
