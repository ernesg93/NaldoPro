import { collection, doc, getDocs, getDoc, setDoc, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Campaña, CampañaProducto, CampañaGeneracion, PublicacionGenerada } from '../types';

const CAMPAIGNS_COLLECTION = 'campaigns';
const CAMPAIGN_PRODUCTS_COLLECTION = 'campaignProducts';
const CAMPAIGN_GENERATIONS_COLLECTION = 'campaignGenerations';
const GENERATED_PUBLICATIONS_COLLECTION = 'generatedPublications';

export class CampaignService {
  static async getCampaigns(): Promise<Campaña[]> {
    const q = query(collection(db, CAMPAIGNS_COLLECTION), orderBy('fecha_creacion', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        fecha_creacion: data.fecha_creacion?.toDate ? data.fecha_creacion.toDate() : new Date(data.fecha_creacion)
      };
    }) as Campaña[];
  }

  static async getCampaign(id: string): Promise<Campaña | null> {
    const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      ...data,
      id: snap.id,
      fecha_creacion: data.fecha_creacion?.toDate ? data.fecha_creacion.toDate() : new Date(data.fecha_creacion)
    } as Campaña;
  }

  static async createCampaign(nombre: string, tasa_usada: number): Promise<Campaña> {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const camp: Campaña = {
      id: newId,
      nombre,
      fecha_creacion: new Date(),
      tasa_usada,
      estado: 'borrador'
    };
    await setDoc(doc(db, CAMPAIGNS_COLLECTION, newId), camp);
    return camp;
  }

  static async updateCampaignStatus(id: string, estado: Campaña['estado']): Promise<void> {
    await setDoc(doc(db, CAMPAIGNS_COLLECTION, id), { estado }, { merge: true });
  }

  static async getCampaignProducts(campaignId: string): Promise<CampañaProducto[]> {
    const q = query(
      collection(db, CAMPAIGN_PRODUCTS_COLLECTION),
      where('campaña_id', '==', campaignId),
      orderBy('orden', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CampañaProducto[];
  }

  static async updateCampaignProductStatus(id: string, estado_envio: CampañaProducto['estado_envio']): Promise<void> {
    await setDoc(doc(db, CAMPAIGN_PRODUCTS_COLLECTION, id), { estado_envio }, { merge: true });
  }

  static async getGeneratedPublications(campaignId: string): Promise<PublicacionGenerada[]> {
    const q = query(
      collection(db, GENERATED_PUBLICATIONS_COLLECTION),
      where('campaña_id', '==', campaignId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PublicacionGenerada[];
  }

  static async updateCampaignProducts(campaignId: string, products: CampañaProducto[]): Promise<void> {
    const current = await this.getCampaignProducts(campaignId);
    const batch = writeBatch(db);

    const toKeep = products.map(p => p.id);
    const toDelete = current.filter(p => !toKeep.includes(p.id));

    for (const p of toDelete) {
      batch.delete(doc(db, CAMPAIGN_PRODUCTS_COLLECTION, p.id));
    }

    for (const p of products) {
      batch.set(doc(db, CAMPAIGN_PRODUCTS_COLLECTION, p.id), p);
    }

    await batch.commit();
  }

  static async saveGeneration(
    campaignId: string,
    tasa_usada: number,
    publications: Omit<PublicacionGenerada, 'id'>[]
  ): Promise<void> {
    // Delete existing publications for this campaign first to avoid orphaned records
    const currentPubsQuery = query(
      collection(db, GENERATED_PUBLICATIONS_COLLECTION),
      where('campaña_id', '==', campaignId)
    );
    const currentPubsSnap = await getDocs(currentPubsQuery);

    const batch = writeBatch(db);

    for (const docSnap of currentPubsSnap.docs) {
      batch.delete(docSnap.ref);
    }

    const genId = `gen-${campaignId}`;
    const gen: CampañaGeneracion = {
      id: genId,
      campaña_id: campaignId,
      fecha_generacion: new Date(),
      tasa_usada
    };
    batch.set(doc(db, CAMPAIGN_GENERATIONS_COLLECTION, genId), gen);

    for (const pub of publications) {
      const pubId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substring(7);
      const finalPub: PublicacionGenerada = {
        ...pub,
        id: pubId
      };
      batch.set(doc(db, GENERATED_PUBLICATIONS_COLLECTION, pubId), finalPub);
    }

    batch.set(doc(db, CAMPAIGNS_COLLECTION, campaignId), { estado: 'generada' }, { merge: true });

    await batch.commit();
  }
}
