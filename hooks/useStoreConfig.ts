

import { useMemo } from 'react';
import { ShoeStoreProps } from '../types/shoestore';
import { STORE_CONFIGS, StoreConfig } from '../data/storeConfigs';
import { SYNDICATE_THEME } from '../data/themePresets';

export function useStoreConfig(cityId: string, storeId: string): ShoeStoreProps | null {
    const config = useMemo(() => {
        const storeData: StoreConfig | undefined = STORE_CONFIGS[storeId];
        if (!storeData) {
            return null;
        }

        // The new "Syndicate OS" is universal. All stores now use this single, detailed theme.
        // The store-specific 'themeOverrides' are no longer needed as the core theme is now the standard.
        const { themeOverrides, ...restOfStoreData } = storeData;
        
        const finalProps: ShoeStoreProps = {
            ...restOfStoreData,
            theme: SYNDICATE_THEME,
        };

        return finalProps;

    }, [storeId]);

    // The cityId is passed for future use when loaders are more complex.
    return config;
}