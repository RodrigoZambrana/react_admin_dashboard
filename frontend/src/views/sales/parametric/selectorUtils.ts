import type { TFunction } from 'i18next'

export type SelectorOption = {
    value: string
    label: string
}

export type AberturasSelectorSummary = {
    families: string[]
    series: string[]
    colors: string[]
    glass: string[]
}

export type ParametricSelectorMap = {
    families?: string[]
    series?: string[]
    colors?: string[]
    glass?: string[]
    shutterMaterials?: string[]
}

export type SelectorOptionGroups = {
    families: SelectorOption[]
    series: SelectorOption[]
    colors: SelectorOption[]
    glass: SelectorOption[]
    shutterMaterials: SelectorOption[]
}

export const toSelectorOption = (value: string, label?: string): SelectorOption => ({
    value,
    label: label ?? value,
})

export const mapSelectorsToOptions = (
    selectors: ParametricSelectorMap | null | undefined,
    t: TFunction,
): SelectorOptionGroups => {
    const defaultFamilyLabel = t('sales.productForm.parametric.familyDefault', {
        defaultValue: 'Default',
    })

    return {
        families:
            selectors?.families?.map((family) =>
                toSelectorOption(family || '', family || defaultFamilyLabel),
            ) ?? [],
        series: selectors?.series?.map((serie) => toSelectorOption(serie)) ?? [],
        colors: selectors?.colors?.map((color) => toSelectorOption(color)) ?? [],
        glass: selectors?.glass?.map((glass) => toSelectorOption(glass)) ?? [],
        shutterMaterials:
            selectors?.shutterMaterials
                ?.filter((material) => Boolean(material && material.trim().length))
                .map((material) => toSelectorOption(material)) ?? [],
    }
}

export const mergeSelectorValues = (primary: string[] = [], fallback: string[] = []): string[] => {
    const set = new Set<string>()
    primary.filter(Boolean).forEach((value) => set.add(value))
    fallback.filter(Boolean).forEach((value) => set.add(value))
    return Array.from(set)
}
