import { useState, useEffect } from 'react';
import { db, doc, onSnapshot, collection, query, where, getDocs } from '../lib/firebase';

export function useFirestoreRealtimeDocument(collectionName: string, docId: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, collectionName, docId), (docSnap) => {
      if (docSnap.exists()) {
        setData({ id: docSnap.id, ...docSnap.data() });
      } else {
        setData(null);
      }
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${collectionName}/${docId}:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, docId]);

  return { data, loading };
}

export interface WhereClause {
  field: string;
  op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'array-contains-any';
  value: any;
}

export function useFirestoreRealtimeCollection(collectionPath: string, filters?: WhereClause[]) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const filtersKey = JSON.stringify(filters || []);

  useEffect(() => {
    let q;
    if (filters && filters.length > 0) {
      const constraints = filters.map(f => where(f.field, f.op, f.value));
      q = query(collection(db, collectionPath), ...constraints);
    } else {
      q = query(collection(db, collectionPath));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(docs);
      setLoading(false);
    }, (error) => {
      console.error(`Error fetching ${collectionPath}:`, error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionPath, filtersKey]);

  return { data, loading };
}
