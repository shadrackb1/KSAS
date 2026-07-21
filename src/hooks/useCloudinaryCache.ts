import { useState, useEffect } from 'react';
import { fetchJSONFromCloudinary } from '../lib/cloudinary';

export function useCloudinaryCache(filename: string) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<null | string>(null);

    useEffect(() => {
        const loadCache = async () => {
            setLoading(true);
            try {
                // Check local storage first
                const cached = localStorage.getItem(`ksas_cache_${filename}`);
                if (cached) {
                    setData(JSON.parse(cached));
                    // We don't stop loading here to allow background refresh if needed, 
                    // but for now let's just return immediately for offline resilience
                    setLoading(false);
                }

                // Fetch fresh from cloudinary
                const freshData = await fetchJSONFromCloudinary(filename);
                if (freshData) {
                    setData(freshData);
                    localStorage.setItem(`ksas_cache_${filename}`, JSON.stringify(freshData));
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (filename) loadCache();
    }, [filename]);

    return { data, loading, error };
}
