import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import {
  Item,
  ItemUnit,
  Category,
  Location,
  AVEvent,
  EventItem,
  Incident,
  InventoryMovement,
  Client,
  Supplier,
  DispatchNote,
  ReturnNote,
  Purchase,
  InventorySession,
  Contract,
  ContractItem,
  BankPaymentDetails,
  CompanyFiscalConfig,
} from '../types/inventory.ts';
import {
  INITIAL_ITEMS,
  INITIAL_UNITS,
  INITIAL_CATEGORIES,
  INITIAL_LOCATIONS,
  INITIAL_EVENTS,
  INITIAL_EVENT_ITEMS,
  INITIAL_INCIDENTS,
  INITIAL_MOVEMENTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_CONTRACTS,
  INITIAL_DISPATCHES,
  DEFAULT_BANK_DETAILS,
  DEFAULT_CONTRACT_CLAUSES,
  DEFAULT_COMPANY_FISCAL_CONFIG,
} from '../lib/initialData.ts';
import { useAuth } from './AuthContext.tsx';
import { generateBarcode, inferGroupFromCategory, ParsedItemRow } from '../lib/barcodeUtils.ts';

interface AvailabilityCheckResult {
  itemId: string;
  itemName: string;
  availableNow: number;
  maxReservableForDates: number;
  conflictingEvents: {
    eventCode: string;
    eventName: string;
    dates: string;
    quantityBooked: number;
  }[];
  isAvailable: boolean;
}

interface InventoryContextType {
  // Collections
  items: Item[];
  itemUnits: ItemUnit[];
  categories: Category[];
  locations: Location[];
  events: AVEvent[];
  eventItems: EventItem[];
  incidents: Incident[];
  movements: InventoryMovement[];
  clients: Client[];
  suppliers: Supplier[];
  dispatches: DispatchNote[];
  returns: ReturnNote[];
  purchases: Purchase[];
  inventorySessions: InventorySession[];
  contracts: Contract[];
  loading: boolean;
  isOfflineMode: boolean;

  // Item Operations
  saveItem: (item: Partial<Item> & { name: string; category: string; initialSerialNumbers?: string[] }) => Promise<Item>;
  archiveItem: (itemId: string, reason?: string) => Promise<void>;
  saveItemUnit: (unit: Partial<ItemUnit> & { itemId: string; serialNumber: string }) => Promise<ItemUnit>;
  importItemsFromSpreadsheet: (parsedRows: import('../lib/barcodeUtils.ts').ParsedItemRow[]) => Promise<{ imported: number; unitsCount: number; errors: string[] }>;

  // Category & Location Operations
  saveCategory: (category: Partial<Category> & { name: string }) => Promise<Category>;
  saveLocation: (loc: Partial<Location> & { warehouse: string; zone: string }) => Promise<Location>;

  // Event & Reservation Operations
  saveEvent: (event: Partial<AVEvent> & { name: string; dispatchDate: string; returnDate: string }) => Promise<AVEvent>;
  addEventItem: (eventId: string, itemId: string, quantity: number) => Promise<void>;
  removeEventItem: (eventItemId: string) => Promise<void>;
  updateEventStatus: (eventId: string, newStatus: AVEvent['status']) => Promise<void>;
  checkAvailability: (
    itemId: string,
    requestedQuantity: number,
    dispatchDate: string,
    returnDate: string,
    excludeEventId?: string
  ) => AvailabilityCheckResult;

  // Warehouse Operations (Dispatches & Returns)
  processDispatch: (
    eventId: string,
    preparedItems: { itemId: string; quantity: number; unitSerialNumbers?: string[] }[],
    preparedBy: string,
    authorizedBy: string,
    notes?: string
  ) => Promise<DispatchNote>;

  processReturn: (
    eventId: string,
    returnedItems: {
      itemId: string;
      quantity: number;
      condition: 'good' | 'damaged' | 'incomplete' | 'review_pending';
      unitSerialNumbers?: string[];
      incidentNotes?: string;
    }[],
    receivedBy: string,
    notes?: string
  ) => Promise<ReturnNote>;

  // Incidents & Repairs
  createIncident: (incident: Omit<Incident, 'id' | 'code' | 'createdAt' | 'updatedAt'>) => Promise<Incident>;
  updateIncidentStatus: (
    incidentId: string,
    status: Incident['status'],
    appliedSolution?: string,
    cost?: number
  ) => Promise<void>;

  // Locations Transfer & Adjustments
  transferEquipment: (
    itemId: string,
    quantity: number,
    sourceLoc: string,
    targetLoc: string,
    reason: string,
    unitId?: string
  ) => Promise<void>;

  // Purchasing & Inward Goods
  registerPurchase: (
    purchase: Omit<Purchase, 'id' | 'createdAt'>
  ) => Promise<Purchase>;
  updatePurchaseDeliveryNote: (
    purchaseId: string,
    photoUrl: string,
    noteNumber?: string
  ) => Promise<void>;

  // Physical Inventory & Regularization
  createInventorySession: (warehouse: string) => Promise<InventorySession>;
  saveInventoryCount: (sessionId: string, lines: InventorySession['lines']) => Promise<void>;
  regularizeInventory: (sessionId: string, authorizedBy: string) => Promise<void>;

  // Clients & Suppliers
  saveClient: (client: Partial<Client> & { name: string }) => Promise<Client>;
  saveSupplier: (supplier: Partial<Supplier> & { name: string }) => Promise<Supplier>;

  // Contracts & 10% Booking Deposit Operations (Admin)
  saveContract: (contract: Partial<Contract> & { eventName: string; totalAmount: number }) => Promise<Contract>;
  updateContractStatus: (contractId: string, status: Contract['status'], paymentRef?: string) => Promise<void>;
  generateContractFromEvent: (eventId: string) => Promise<Contract>;
  deleteContract: (contractId: string) => Promise<void>;

  // Company & Fiscal Configuration
  companyFiscalConfig: CompanyFiscalConfig;
  defaultBankDetails: BankPaymentDetails;
  updateCompanyFiscalConfig: (newConfig: Partial<CompanyFiscalConfig>) => void;
  updateDefaultBankDetails: (newDetails: Partial<BankPaymentDetails>) => void;

  // Dispatch Note Enhancements (Tablet signature & Material Management)
  saveDispatchSignature: (
    dispatchId: string,
    signatureUrl: string,
    signerName: string,
    signerDni: string,
    driverSignatureUrl?: string
  ) => Promise<void>;
  removeItemFromDispatch: (
    dispatchId: string,
    itemId: string,
    quantityToRemove?: number
  ) => Promise<void>;
  addItemToDispatch: (
    dispatchId: string,
    item: {
      itemId: string;
      itemName: string;
      itemCode: string;
      quantity: number;
      unitSerialNumbers?: string[];
    }
  ) => Promise<void>;

  // Material Damage Direct from Reception to SAT
  reportDamageFromPurchase: (
    purchaseId: string,
    itemId: string,
    quantity: number,
    description: string,
    photos?: string[]
  ) => Promise<Incident>;

  // System Utilities
  seedInitialData: () => Promise<void>;
  clearAllDemoData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Local storage fallback helpers
const getStored = <T,>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(`prompt_maestro_${key}`);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const setStored = <T,>(key: string, val: T) => {
  try {
    localStorage.setItem(`prompt_maestro_${key}`, JSON.stringify(val));
  } catch {
    // quota exceeded or private mode
  }
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // States initialized from local storage or defaults
  const [items, setItems] = useState<Item[]>(() => getStored('items', INITIAL_ITEMS));
  const [itemUnits, setItemUnits] = useState<ItemUnit[]>(() => getStored('units', INITIAL_UNITS));
  const [categories, setCategories] = useState<Category[]>(() => getStored('categories', INITIAL_CATEGORIES));
  const [locations, setLocations] = useState<Location[]>(() => getStored('locations', INITIAL_LOCATIONS));
  const [events, setEvents] = useState<AVEvent[]>(() => getStored('events', INITIAL_EVENTS));
  const [eventItems, setEventItems] = useState<EventItem[]>(() => getStored('event_items', INITIAL_EVENT_ITEMS));
  const [incidents, setIncidents] = useState<Incident[]>(() => getStored('incidents', INITIAL_INCIDENTS));
  const [movements, setMovements] = useState<InventoryMovement[]>(() => getStored('movements', INITIAL_MOVEMENTS));
  const [clients, setClients] = useState<Client[]>(() => getStored('clients', INITIAL_CLIENTS));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => getStored('suppliers', INITIAL_SUPPLIERS));
  const [dispatches, setDispatches] = useState<DispatchNote[]>(() => getStored('dispatches', INITIAL_DISPATCHES));
  const [returns, setReturns] = useState<ReturnNote[]>(() => getStored('returns', []));
  const [purchases, setPurchases] = useState<Purchase[]>(() => getStored('purchases', []));
  const [inventorySessions, setInventorySessions] = useState<InventorySession[]>(() => getStored('inventory_sessions', []));
  const [contracts, setContracts] = useState<Contract[]>(() => getStored('contracts', INITIAL_CONTRACTS));
  const [companyFiscalConfig, setCompanyFiscalConfig] = useState<CompanyFiscalConfig>(() => {
    const stored = getStored<CompanyFiscalConfig>('company_fiscal_config', DEFAULT_COMPANY_FISCAL_CONFIG);
    return { ...DEFAULT_COMPANY_FISCAL_CONFIG, ...stored };
  });
  const [defaultBankDetails, setDefaultBankDetails] = useState<BankPaymentDetails>(() => {
    const stored = getStored<BankPaymentDetails>('default_bank_details', DEFAULT_BANK_DETAILS);
    if (!stored || stored.iban?.includes('0418') || !stored.iban) {
      return DEFAULT_BANK_DETAILS;
    }
    return { ...DEFAULT_BANK_DETAILS, ...stored };
  });

  // Sync to local storage
  useEffect(() => { setStored('items', items); }, [items]);
  useEffect(() => { setStored('units', itemUnits); }, [itemUnits]);
  useEffect(() => { setStored('categories', categories); }, [categories]);
  useEffect(() => { setStored('locations', locations); }, [locations]);
  useEffect(() => { setStored('events', events); }, [events]);
  useEffect(() => { setStored('event_items', eventItems); }, [eventItems]);
  useEffect(() => { setStored('incidents', incidents); }, [incidents]);
  useEffect(() => { setStored('movements', movements); }, [movements]);
  useEffect(() => { setStored('clients', clients); }, [clients]);
  useEffect(() => { setStored('suppliers', suppliers); }, [suppliers]);
  useEffect(() => { setStored('dispatches', dispatches); }, [dispatches]);
  useEffect(() => { setStored('returns', returns); }, [returns]);
  useEffect(() => { setStored('purchases', purchases); }, [purchases]);
  useEffect(() => { setStored('inventory_sessions', inventorySessions); }, [inventorySessions]);
  useEffect(() => { setStored('contracts', contracts); }, [contracts]);
  useEffect(() => { setStored('company_fiscal_config', companyFiscalConfig); }, [companyFiscalConfig]);
  useEffect(() => { setStored('default_bank_details', defaultBankDetails); }, [defaultBankDetails]);

  // Firestore sync effect
  useEffect(() => {
    let unsubItems: (() => void) | undefined;
    let unsubEvents: (() => void) | undefined;

    const initFirestoreSync = async () => {
      try {
        const itemsColl = collection(db, 'items');
        const snap = await getDocs(itemsColl);
        if (snap.empty) {
          // If empty, auto-seed to Firestore
          console.log('Seeding initial AV inventory to Firestore...');
          for (const item of INITIAL_ITEMS) {
            await setDoc(doc(db, 'items', item.id), item);
          }
          for (const ev of INITIAL_EVENTS) {
            await setDoc(doc(db, 'events', ev.id), ev);
          }
          for (const cat of INITIAL_CATEGORIES) {
            await setDoc(doc(db, 'categories', cat.id), cat);
          }
          for (const loc of INITIAL_LOCATIONS) {
            await setDoc(doc(db, 'locations', loc.id), loc);
          }
        }

        unsubItems = onSnapshot(collection(db, 'items'), (snapshot) => {
          if (!snapshot.empty) {
            const list: Item[] = [];
            snapshot.forEach((docSnap) => list.push(docSnap.data() as Item));
            setItems(list);
          }
        }, (err) => {
          console.warn('Items snapshot warning:', err.message);
          setIsOfflineMode(true);
        });

        unsubEvents = onSnapshot(collection(db, 'events'), (snapshot) => {
          if (!snapshot.empty) {
            const list: AVEvent[] = [];
            snapshot.forEach((docSnap) => list.push(docSnap.data() as AVEvent));
            setEvents(list);
          }
        }, (err) => {
          console.warn('Events snapshot warning:', err.message);
        });

        setIsOfflineMode(false);
      } catch (err) {
        console.warn('Firestore connection failed, using local in-browser persistence:', err);
        setIsOfflineMode(true);
      } finally {
        setLoading(false);
      }
    };

    initFirestoreSync();

    return () => {
      if (unsubItems) unsubItems();
      if (unsubEvents) unsubEvents();
    };
  }, []);

  // Helper to record an immutable movement
  const recordMovement = useCallback(
    async (movementData: Omit<InventoryMovement, 'id' | 'timestamp' | 'userId' | 'userName'>) => {
      const newMovement: InventoryMovement = {
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        userId: userProfile?.id || 'usr-anonymous',
        userName: userProfile ? `${userProfile.name} (${userProfile.role})` : 'Operador AV',
        ...movementData,
      };

      setMovements((prev) => [newMovement, ...prev]);

      try {
        await setDoc(doc(db, 'movements', newMovement.id), newMovement);
      } catch (err) {
        console.warn('Could not record movement in Firestore, saved locally:', err);
      }

      return newMovement;
    },
    [userProfile]
  );

  // Recalculate dynamic item quantities based on units, dispatches, damages
  const refreshItemStock = useCallback((itemId: string) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        // Count damaged from incidents and units
        const units = itemUnits.filter((u) => u.itemId === itemId);
        let damagedCount = item.damagedQuantity;
        let outCount = item.outQuantity;
        let reservedCount = 0;

        if (item.hasSerialNumbers && units.length > 0) {
          damagedCount = units.filter((u) => u.status === 'damaged' || u.status === 'maintenance').length;
          outCount = units.filter((u) => u.status === 'in_event').length;
          reservedCount = units.filter((u) => u.status === 'reserved').length;
        } else {
          // calculate non-serialized reserved from confirmed / preparing events
          const activeEventIds = events
            .filter((e) => ['confirmed', 'preparing', 'prepared'].includes(e.status))
            .map((e) => e.id);
          const reqs = eventItems
            .filter((ei) => ei.itemId === itemId && activeEventIds.includes(ei.eventId))
            .reduce((sum, ei) => sum + (ei.quantityRequested - ei.quantityDispatched), 0);
          reservedCount = Math.max(0, reqs);
        }

        const available = Math.max(0, item.totalQuantity - outCount - damagedCount - reservedCount);

        return {
          ...item,
          availableQuantity: available,
          reservedQuantity: reservedCount,
          outQuantity: outCount,
          damagedQuantity: damagedCount,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [events, eventItems, itemUnits]);

  // Check Availability for date range (overlap checking to prevent double bookings)
  const checkAvailability = useCallback(
    (
      itemId: string,
      requestedQuantity: number,
      dispatchDate: string,
      returnDate: string,
      excludeEventId?: string
    ): AvailabilityCheckResult => {
      const item = items.find((i) => i.id === itemId);
      if (!item) {
        return {
          itemId,
          itemName: 'Artículo no encontrado',
          availableNow: 0,
          maxReservableForDates: 0,
          conflictingEvents: [],
          isAvailable: false,
        };
      }

      const reqStart = new Date(dispatchDate).getTime();
      const reqEnd = new Date(returnDate).getTime();

      // Find all overlapping active events
      const overlappingEvents = events.filter((ev) => {
        if (excludeEventId && ev.id === excludeEventId) return false;
        if (['draft', 'closed', 'cancelled'].includes(ev.status)) return false;

        const evStart = new Date(ev.dispatchDate).getTime();
        const evEnd = new Date(ev.returnDate).getTime();

        // Check if [reqStart, reqEnd] overlaps with [evStart, evEnd]
        return reqStart <= evEnd && reqEnd >= evStart;
      });

      let totalBookedForDates = 0;
      const conflictingEvents: AvailabilityCheckResult['conflictingEvents'] = [];

      for (const ev of overlappingEvents) {
        const lines = eventItems.filter((ei) => ei.eventId === ev.id && ei.itemId === itemId);
        const bookedInEvent = lines.reduce((acc, l) => acc + (l.quantityRequested - l.quantityReturned), 0);
        if (bookedInEvent > 0) {
          totalBookedForDates += bookedInEvent;
          conflictingEvents.push({
            eventCode: ev.code,
            eventName: ev.name,
            dates: `${new Date(ev.dispatchDate).toLocaleDateString()} - ${new Date(ev.returnDate).toLocaleDateString()}`,
            quantityBooked: bookedInEvent,
          });
        }
      }

      // Safe capacity is total minus broken/in-repair equipment
      const usableTotal = Math.max(0, item.totalQuantity - item.damagedQuantity);
      const maxReservable = Math.max(0, usableTotal - totalBookedForDates);
      const isAvailable = requestedQuantity <= maxReservable;

      return {
        itemId,
        itemName: item.name,
        availableNow: item.availableQuantity,
        maxReservableForDates: maxReservable,
        conflictingEvents,
        isAvailable,
      };
    },
    [items, events, eventItems]
  );

  // Save or edit an item with automatic Barcode, QR Code, Technical Group, and Physical Units
  const saveItem = async (
    data: Partial<Item> & { name: string; category: string; initialSerialNumbers?: string[] }
  ): Promise<Item> => {
    const isNew = !data.id;
    const now = new Date().toISOString();
    const id = data.id || `item-${Date.now()}`;
    const code =
      data.code ||
      `${data.category.substring(0, 3).toUpperCase()}-${data.name.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const totalQty = data.totalQuantity !== undefined ? data.totalQuantity : 1;
    const damagedQty = data.damagedQuantity || 0;
    const outQty = data.outQuantity || 0;
    const reservedQty = data.reservedQuantity || 0;
    const availableQty = Math.max(0, totalQty - damagedQty - outQty - reservedQty);

    const group = data.group || inferGroupFromCategory(data.category, data.name);
    const barcode = data.barcode || generateBarcode(code);
    const qrCode = data.qrCode || `QR-${code}`;

    const fullItem: Item = {
      id,
      code,
      name: data.name,
      group,
      category: data.category,
      subcategory: data.subcategory || 'General',
      brand: data.brand || 'Genérica',
      model: data.model || '',
      description: data.description || '',
      imageUrl: data.imageUrl,
      barcode,
      qrCode,
      unit: data.unit || 'Uds',
      hasSerialNumbers: Boolean(data.hasSerialNumbers),
      totalQuantity: totalQty,
      availableQuantity: availableQty,
      reservedQuantity: reservedQty,
      outQuantity: outQty,
      damagedQuantity: damagedQty,
      defaultLocationId: data.defaultLocationId || 'loc-nave-1',
      defaultLocationName: data.defaultLocationName || 'Nave Central',
      supplier: data.supplier,
      purchasePrice: data.purchasePrice,
      acquisitionDate: data.acquisitionDate || now.split('T')[0],
      status: data.status || 'active',
      minStock: data.minStock !== undefined ? data.minStock : 2,
      notes: data.notes,
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    setItems((prev) => {
      const exists = prev.some((i) => i.id === id);
      return exists ? prev.map((i) => (i.id === id ? fullItem : i)) : [fullItem, ...prev];
    });

    try {
      await setDoc(doc(db, 'items', id), fullItem);
    } catch (err) {
      console.warn('Could not save item to Firestore, saved locally:', err);
    }

    // Auto-generate physical serialized units if hasSerialNumbers is enabled
    if (fullItem.hasSerialNumbers) {
      const newUnitsToCreate: ItemUnit[] = [];

      if (data.initialSerialNumbers && data.initialSerialNumbers.length > 0) {
        for (const sn of data.initialSerialNumbers) {
          const trimmed = sn.trim();
          if (!trimmed) continue;
          const unitId = `unit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          newUnitsToCreate.push({
            id: unitId,
            itemId: fullItem.id,
            itemCode: fullItem.code,
            itemName: fullItem.name,
            serialNumber: trimmed,
            qrCode: `QR-${trimmed}`,
            locationId: fullItem.defaultLocationId,
            locationName: fullItem.defaultLocationName,
            status: 'available',
            createdAt: now,
            updatedAt: now,
          });
        }
      } else if (isNew && totalQty > 0) {
        // Automatically create sequential serials for all items
        for (let i = 1; i <= Math.min(totalQty, 50); i++) {
          const sn = `${fullItem.code}-${String(i).padStart(2, '0')}`;
          const unitId = `unit-${Date.now()}-${i}-${Math.floor(Math.random() * 100)}`;
          newUnitsToCreate.push({
            id: unitId,
            itemId: fullItem.id,
            itemCode: fullItem.code,
            itemName: fullItem.name,
            serialNumber: sn,
            qrCode: `QR-${sn}`,
            locationId: fullItem.defaultLocationId,
            locationName: fullItem.defaultLocationName,
            status: 'available',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      if (newUnitsToCreate.length > 0) {
        setItemUnits((prev) => [...newUnitsToCreate, ...prev]);
        for (const unit of newUnitsToCreate) {
          try {
            await setDoc(doc(db, 'itemUnits', unit.id), unit);
          } catch (e) {
            // local persistence fallback
          }
        }
      }
    }

    await recordMovement({
      type: isNew ? 'create' : 'adjustment',
      itemId: fullItem.id,
      itemName: fullItem.name,
      itemCode: fullItem.code,
      quantity: fullItem.totalQuantity,
      sourceLocation: isNew ? 'Alta de inventario' : fullItem.defaultLocationName,
      targetLocation: fullItem.defaultLocationName,
      reason: isNew
        ? `Alta de nueva referencia de inventario [${fullItem.group}] con código QR y código de barras autogenerados.`
        : 'Modificación de ficha técnica de artículo',
      notes: `Grupo: ${fullItem.group} | Código de barras: ${fullItem.barcode}`,
      referenceCode: fullItem.code,
    });

    return fullItem;
  };

  // Bulk import items from spreadsheet (Excel XLSX / CSV)
  const importItemsFromSpreadsheet = async (
    parsedRows: ParsedItemRow[]
  ): Promise<{ imported: number; unitsCount: number; errors: string[] }> => {
    let imported = 0;
    let unitsCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    const newItems: Item[] = [];
    const newUnits: ItemUnit[] = [];

    for (let index = 0; index < parsedRows.length; index++) {
      const row = parsedRows[index];
      try {
        if (!row.name || !row.name.trim()) continue;

        const itemId = `item-imp-${Date.now()}-${index}`;
        const cleanName = row.name.trim();
        const category = row.category || 'General';
        const group = row.group || inferGroupFromCategory(category, cleanName);
        const codePrefix = group.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'EQ');
        const code = `${codePrefix}-${cleanName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
        const barcode = row.barcode || generateBarcode(code);
        const qrCode = `QR-${code}`;

        const totalQty = row.totalQuantity > 0 ? row.totalQuantity : 1;
        const availableQty = totalQty;

        const defaultLocationName = row.defaultLocationName || 'Nave Central';
        const matchedLoc = locations.find((l) => `${l.warehouse} - ${l.zone}`.toLowerCase().includes(defaultLocationName.toLowerCase()));
        const defaultLocationId = matchedLoc?.id || 'loc-nave-1';

        const itemObj: Item = {
          id: itemId,
          code,
          name: cleanName,
          group,
          category,
          subcategory: row.subcategory || 'General',
          brand: row.brand || 'Genérica',
          model: row.model || '',
          description: row.description || '',
          barcode,
          qrCode,
          unit: row.unit || 'Uds',
          hasSerialNumbers: row.hasSerialNumbers,
          totalQuantity: totalQty,
          availableQuantity: availableQty,
          reservedQuantity: 0,
          outQuantity: 0,
          damagedQuantity: 0,
          defaultLocationId,
          defaultLocationName: matchedLoc ? `${matchedLoc.warehouse} - ${matchedLoc.zone}` : defaultLocationName,
          supplier: row.supplier,
          purchasePrice: row.purchasePrice,
          acquisitionDate: now.split('T')[0],
          status: 'active',
          minStock: row.minStock || 2,
          notes: 'Importado mediante plantilla Excel / CSV',
          createdAt: now,
          updatedAt: now,
        };

        newItems.push(itemObj);
        imported++;

        // Units creation
        if (row.hasSerialNumbers) {
          if (row.serialNumbers && row.serialNumbers.length > 0) {
            for (const sn of row.serialNumbers) {
              const uId = `unit-imp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
              newUnits.push({
                id: uId,
                itemId: itemObj.id,
                itemCode: itemObj.code,
                itemName: itemObj.name,
                serialNumber: sn,
                qrCode: `QR-${sn}`,
                locationId: itemObj.defaultLocationId,
                locationName: itemObj.defaultLocationName,
                status: 'available',
                createdAt: now,
                updatedAt: now,
              });
              unitsCount++;
            }
          } else {
            // Auto-generate serial numbers for each physical unit
            for (let i = 1; i <= Math.min(totalQty, 100); i++) {
              const sn = `${itemObj.code}-${String(i).padStart(2, '0')}`;
              const uId = `unit-imp-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
              newUnits.push({
                id: uId,
                itemId: itemObj.id,
                itemCode: itemObj.code,
                itemName: itemObj.name,
                serialNumber: sn,
                qrCode: `QR-${sn}`,
                locationId: itemObj.defaultLocationId,
                locationName: itemObj.defaultLocationName,
                status: 'available',
                createdAt: now,
                updatedAt: now,
              });
              unitsCount++;
            }
          }
        }

        // Firestore sync attempt
        try {
          await setDoc(doc(db, 'items', itemObj.id), itemObj);
        } catch (e) {
          // ignore offline
        }
      } catch (err: any) {
        errors.push(`Error en fila ${index + 1} (${row.name || 'desconocido'}): ${err.message}`);
      }
    }

    if (newItems.length > 0) {
      setItems((prev) => [...newItems, ...prev]);
    }
    if (newUnits.length > 0) {
      setItemUnits((prev) => [...newUnits, ...prev]);
      for (const u of newUnits) {
        try {
          await setDoc(doc(db, 'itemUnits', u.id), u);
        } catch (e) {
          // ignore offline
        }
      }
    }

    // Record bulk movement
    if (newItems.length > 0) {
      await recordMovement({
        type: 'create',
        itemId: 'bulk-import',
        itemName: `Importación masiva (${newItems.length} referencias)`,
        itemCode: 'IMP-XLS',
        quantity: newItems.reduce((acc, it) => acc + it.totalQuantity, 0),
        sourceLocation: 'Importación Excel / CSV',
        targetLocation: 'Almacén Central',
        reason: `Carga masiva de ${newItems.length} artículos y ${unitsCount} unidades físicas con códigos QR y de barras.`,
        referenceCode: `IMP-${Date.now()}`,
      });
    }

    return { imported, unitsCount, errors };
  };

  // Archive item (soft delete - preserving movement history)
  const archiveItem = async (itemId: string, reason?: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (item.outQuantity > 0 || item.reservedQuantity > 0) {
      throw new Error('No se puede archivar un artículo con unidades fuera del almacén o reservadas para eventos.');
    }

    const updatedItem: Item = {
      ...item,
      status: 'archived',
      availableQuantity: 0,
      updatedAt: new Date().toISOString(),
    };

    setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));

    try {
      await updateDoc(doc(db, 'items', itemId), { status: 'archived' });
    } catch (err) {
      console.warn('Firestore archive fallback to local:', err);
    }

    await recordMovement({
      type: 'archive',
      itemId: item.id,
      itemName: item.name,
      itemCode: item.code,
      quantity: item.totalQuantity,
      sourceLocation: item.defaultLocationName,
      targetLocation: 'Histórico / Archivado',
      reason: reason || 'Archivado de artículo por obsolescencia o fin de ciclo',
      referenceCode: item.code,
    });
  };

  // Save individual physical unit with serial number
  const saveItemUnit = async (
    unitData: Partial<ItemUnit> & { itemId: string; serialNumber: string }
  ): Promise<ItemUnit> => {
    const parentItem = items.find((i) => i.id === unitData.itemId);
    const now = new Date().toISOString();
    const id = unitData.id || `unit-${Date.now()}-${Math.floor(Math.random() * 100)}`;

    const newUnit: ItemUnit = {
      id,
      itemId: unitData.itemId,
      itemCode: parentItem?.code || 'AV-REF',
      itemName: parentItem?.name || 'Equipo AV',
      serialNumber: unitData.serialNumber.trim(),
      qrCode: unitData.qrCode || `QR-${unitData.serialNumber.trim()}`,
      locationId: unitData.locationId || parentItem?.defaultLocationId || 'loc-nave-1',
      locationName: unitData.locationName || parentItem?.defaultLocationName || 'Nave Central',
      status: unitData.status || 'available',
      notes: unitData.notes,
      currentEventId: unitData.currentEventId || null,
      currentEventName: unitData.currentEventName || null,
      createdAt: unitData.createdAt || now,
      updatedAt: now,
    };

    setItemUnits((prev) => {
      const exists = prev.some((u) => u.id === id);
      return exists ? prev.map((u) => (u.id === id ? newUnit : u)) : [newUnit, ...prev];
    });

    try {
      await setDoc(doc(db, 'itemUnits', id), newUnit);
    } catch (err) {
      console.warn('Firestore unit save fallback to local:', err);
    }

    refreshItemStock(unitData.itemId);
    return newUnit;
  };

  // Categories
  const saveCategory = async (catData: Partial<Category> & { name: string }): Promise<Category> => {
    const id = catData.id || `cat-${Date.now()}`;
    const category: Category = {
      id,
      name: catData.name,
      description: catData.description || '',
      icon: catData.icon || 'Package',
      itemCount: items.filter((i) => i.category === catData.name).length,
    };

    setCategories((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? category : c)) : [...prev, category];
    });

    try {
      await setDoc(doc(db, 'categories', id), category);
    } catch (err) {
      console.warn('Firestore category save fallback:', err);
    }

    return category;
  };

  // Locations
  const saveLocation = async (locData: Partial<Location> & { warehouse: string; zone: string }): Promise<Location> => {
    const id = locData.id || `loc-${Date.now()}`;
    const location: Location = {
      id,
      warehouse: locData.warehouse,
      zone: locData.zone,
      description: locData.description || '',
      isRepairZone: Boolean(locData.isRepairZone),
    };

    setLocations((prev) => {
      const exists = prev.some((l) => l.id === id);
      return exists ? prev.map((l) => (l.id === id ? location : l)) : [...prev, location];
    });

    try {
      await setDoc(doc(db, 'locations', id), location);
    } catch (err) {
      console.warn('Firestore location save fallback:', err);
    }

    return location;
  };

  // Save Event
  const saveEvent = async (
    data: Partial<AVEvent> & { name: string; dispatchDate: string; returnDate: string }
  ): Promise<AVEvent> => {
    const isNew = !data.id;
    const now = new Date().toISOString();
    const id = data.id || `ev-${Date.now()}`;
    const year = new Date().getFullYear();
    const code = data.code || `EV-${year}-${Math.floor(100 + Math.random() * 900)}`;

    const fullEvent: AVEvent = {
      id,
      code,
      name: data.name,
      clientId: data.clientId || '',
      clientName: data.clientName || 'Cliente General',
      location: data.location || '',
      address: data.address || '',
      dispatchDate: data.dispatchDate,
      eventDate: data.eventDate || data.dispatchDate,
      returnDate: data.returnDate,
      manager: data.manager || userProfile?.name || 'Jefe de Producción',
      status: data.status || 'planning',
      notes: data.notes || '',
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    setEvents((prev) => {
      const exists = prev.some((e) => e.id === id);
      return exists ? prev.map((e) => (e.id === id ? fullEvent : e)) : [fullEvent, ...prev];
    });

    try {
      await setDoc(doc(db, 'events', id), fullEvent);
    } catch (err) {
      console.warn('Firestore event save fallback:', err);
    }

    return fullEvent;
  };

  // Add Item Line to Event
  const addEventItem = async (eventId: string, itemId: string, quantity: number) => {
    const targetEvent = events.find((e) => e.id === eventId);
    const targetItem = items.find((i) => i.id === itemId);
    if (!targetEvent || !targetItem) return;

    // Check availability
    const avail = checkAvailability(itemId, quantity, targetEvent.dispatchDate, targetEvent.returnDate, eventId);
    if (!avail.isAvailable) {
      throw new Error(
        `Disponibilidad insuficiente para "${targetItem.name}". Solicitadas: ${quantity}, disponibles para esas fechas: ${avail.maxReservableForDates}.`
      );
    }

    const existingLine = eventItems.find((ei) => ei.eventId === eventId && ei.itemId === itemId);
    const lineId = existingLine?.id || `evi-${Date.now()}-${Math.floor(Math.random() * 100)}`;

    const updatedLine: EventItem = {
      id: lineId,
      eventId,
      itemId,
      itemName: targetItem.name,
      itemCode: targetItem.code,
      brand: targetItem.brand,
      quantityRequested: (existingLine?.quantityRequested || 0) + quantity,
      quantityDispatched: existingLine?.quantityDispatched || 0,
      quantityReturned: existingLine?.quantityReturned || 0,
      quantityDamaged: existingLine?.quantityDamaged || 0,
      status: 'requested',
    };

    setEventItems((prev) => {
      const exists = prev.some((l) => l.id === lineId);
      return exists ? prev.map((l) => (l.id === lineId ? updatedLine : l)) : [...prev, updatedLine];
    });

    // Record reserve movement
    await recordMovement({
      type: 'reserve',
      itemId: targetItem.id,
      itemName: targetItem.name,
      itemCode: targetItem.code,
      quantity,
      sourceLocation: targetItem.defaultLocationName,
      targetLocation: `Reserva Evento ${targetEvent.code}`,
      eventId: targetEvent.id,
      eventName: targetEvent.name,
      reason: `Reserva de ${quantity} uds para ${targetEvent.name}`,
      referenceCode: targetEvent.code,
    });

    refreshItemStock(itemId);
  };

  // Remove Item Line from Event
  const removeEventItem = async (eventItemId: string) => {
    const line = eventItems.find((l) => l.id === eventItemId);
    if (!line) return;
    if (line.quantityDispatched > 0) {
      throw new Error('No se puede eliminar una línea de material que ya ha sido entregada.');
    }

    setEventItems((prev) => prev.filter((l) => l.id !== eventItemId));

    await recordMovement({
      type: 'cancel_reserve',
      itemId: line.itemId,
      itemName: line.itemName,
      itemCode: line.itemCode,
      quantity: line.quantityRequested,
      sourceLocation: `Reserva cancelada`,
      targetLocation: `Almacén Principal`,
      eventId: line.eventId,
      reason: `Cancelación de reserva de material para evento`,
      referenceCode: line.eventId,
    });

    refreshItemStock(line.itemId);
  };

  // Update Event Status
  const updateEventStatus = async (eventId: string, newStatus: AVEvent['status']) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    const oldStatus = ev.status;
    const updated = { ...ev, status: newStatus, updatedAt: new Date().toISOString() };

    setEvents((prev) => prev.map((e) => (e.id === eventId ? updated : e)));

    try {
      await updateDoc(doc(db, 'events', eventId), { status: newStatus });
    } catch (err) {
      console.warn('Firestore updateEventStatus fallback:', err);
    }

    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      // Release any reserved units
      const lines = eventItems.filter((l) => l.eventId === eventId);
      for (const line of lines) {
        await recordMovement({
          type: 'cancel_reserve',
          itemId: line.itemId,
          itemName: line.itemName,
          itemCode: line.itemCode,
          quantity: line.quantityRequested,
          sourceLocation: `Cancelación ${ev.code}`,
          targetLocation: 'Almacén',
          eventId: ev.id,
          eventName: ev.name,
          reason: `Liberación de reservas por cancelación del evento ${ev.name}`,
          referenceCode: ev.code,
        });
        refreshItemStock(line.itemId);
      }
    }
  };

  // Process Dispatch (Salida de Almacén con Albarán de Salida)
  const processDispatch = async (
    eventId: string,
    preparedItems: { itemId: string; quantity: number; unitSerialNumbers?: string[] }[],
    preparedBy: string,
    authorizedBy: string,
    notes?: string
  ): Promise<DispatchNote> => {
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) throw new Error('Evento no encontrado');

    const year = new Date().getFullYear();
    const dispatchCode = `ALB-OUT-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const dispatchNoteItems: DispatchNote['items'] = [];

    // Transactionally update items and create movements
    for (const prep of preparedItems) {
      if (prep.quantity <= 0) continue;
      const it = items.find((i) => i.id === prep.itemId);
      if (!it) continue;

      // Check stock sufficiency
      const availableToShip = it.totalQuantity - it.outQuantity - it.damagedQuantity;
      if (prep.quantity > availableToShip) {
        throw new Error(
          `Stock insuficiente para salida de "${it.name}". Disponible en almacén: ${availableToShip}, solicitado retirar: ${prep.quantity}`
        );
      }

      // Update unit statuses if serialized
      if (prep.unitSerialNumbers && prep.unitSerialNumbers.length > 0) {
        setItemUnits((prevUnits) =>
          prevUnits.map((u) => {
            if (prep.unitSerialNumbers?.includes(u.serialNumber)) {
              return {
                ...u,
                status: 'in_event',
                currentEventId: targetEvent.id,
                currentEventName: targetEvent.name,
                updatedAt: new Date().toISOString(),
              };
            }
            return u;
          })
        );
      }

      // Update item quantities
      setItems((prevItems) =>
        prevItems.map((i) => {
          if (i.id !== it.id) return i;
          const newOut = i.outQuantity + prep.quantity;
          const newAvail = Math.max(0, i.totalQuantity - newOut - i.damagedQuantity - i.reservedQuantity);
          return {
            ...i,
            outQuantity: newOut,
            availableQuantity: newAvail,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // Update eventItem line
      setEventItems((prevLines) =>
        prevLines.map((l) => {
          if (l.eventId === eventId && l.itemId === prep.itemId) {
            const newDispatched = l.quantityDispatched + prep.quantity;
            return {
              ...l,
              quantityDispatched: newDispatched,
              status: newDispatched >= l.quantityRequested ? 'dispatched' : 'partial',
            };
          }
          return l;
        })
      );

      // Record immutable movement
      await recordMovement({
        type: 'dispatch',
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: prep.quantity,
        sourceLocation: it.defaultLocationName,
        targetLocation: `${targetEvent.location || 'Lugar del Evento'} (${targetEvent.name})`,
        eventId: targetEvent.id,
        eventName: targetEvent.name,
        reason: `Salida de almacén autorizada por ${authorizedBy}`,
        notes: `Albarán ${dispatchCode}. Preparado por: ${preparedBy}. ${prep.unitSerialNumbers ? `N/S: ${prep.unitSerialNumbers.join(', ')}` : ''}`,
        referenceCode: dispatchCode,
      });

      dispatchNoteItems.push({
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: prep.quantity,
        unitSerialNumbers: prep.unitSerialNumbers,
      });
    }

    // Determine event new status
    const allLines = eventItems.filter((l) => l.eventId === eventId);
    const allDispatched = allLines.every((l) => {
      const match = preparedItems.find((p) => p.itemId === l.itemId);
      const totalDisp = l.quantityDispatched + (match ? match.quantity : 0);
      return totalDisp >= l.quantityRequested;
    });

    const newEvStatus: AVEvent['status'] = 'dispatched';
    await updateEventStatus(eventId, newEvStatus);

    // Look for existing dispatch note in 'preparing' or 'draft' state for this event
    let dispatchNote: DispatchNote;
    const existingIndex = dispatches.findIndex(
      (d) => d.eventId === eventId && (d.status === 'preparing' || d.status === 'draft')
    );

    if (existingIndex >= 0) {
      const existing = dispatches[existingIndex];
      dispatchNote = {
        ...existing,
        preparedBy: preparedBy || existing.preparedBy,
        authorizedBy: authorizedBy || existing.authorizedBy,
        dispatchDate: new Date().toISOString(),
        status: 'completed', // Explicitly Expedido / Completado
        notes: notes || existing.notes,
        items: dispatchNoteItems,
      };
      setDispatches((prev) =>
        prev.map((d, idx) => (idx === existingIndex ? dispatchNote : d))
      );
    } else {
      dispatchNote = {
        id: `disp-${Date.now()}`,
        code: dispatchCode,
        eventId: targetEvent.id,
        eventCode: targetEvent.code,
        eventName: targetEvent.name,
        clientName: targetEvent.clientName,
        preparedBy,
        authorizedBy,
        dispatchDate: new Date().toISOString(),
        status: 'completed', // Explicitly Expedido / Completado
        notes,
        items: dispatchNoteItems,
        createdAt: new Date().toISOString(),
      };
      setDispatches((prev) => [dispatchNote, ...prev]);
    }

    return dispatchNote;
  };

  // Process Return (Devolución de Material con Detección de Averías)
  const processReturn = async (
    eventId: string,
    returnedItems: {
      itemId: string;
      quantity: number;
      condition: 'good' | 'damaged' | 'incomplete' | 'review_pending';
      unitSerialNumbers?: string[];
      incidentNotes?: string;
    }[],
    receivedBy: string,
    notes?: string
  ): Promise<ReturnNote> => {
    const targetEvent = events.find((e) => e.id === eventId);
    if (!targetEvent) throw new Error('Evento no encontrado');

    const year = new Date().getFullYear();
    const returnCode = `DEV-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    let hasIncidents = false;

    const returnNoteItems: ReturnNote['items'] = [];

    for (const ret of returnedItems) {
      if (ret.quantity <= 0) continue;
      const it = items.find((i) => i.id === ret.itemId);
      if (!it) continue;

      const isDamaged = ret.condition === 'damaged' || ret.condition === 'incomplete';
      if (isDamaged) hasIncidents = true;

      // Update serialized units
      if (ret.unitSerialNumbers && ret.unitSerialNumbers.length > 0) {
        setItemUnits((prevUnits) =>
          prevUnits.map((u) => {
            if (ret.unitSerialNumbers?.includes(u.serialNumber)) {
              return {
                ...u,
                status: isDamaged ? 'damaged' : 'available',
                locationId: isDamaged ? 'loc-sat' : it.defaultLocationId,
                locationName: isDamaged ? 'Taller Técnico y Zona de Reparación' : it.defaultLocationName,
                currentEventId: null,
                currentEventName: null,
                notes: ret.incidentNotes || u.notes,
                updatedAt: new Date().toISOString(),
              };
            }
            return u;
          })
        );
      }

      // Update item quantities: reduce outQuantity, if damaged increase damagedQuantity
      setItems((prevItems) =>
        prevItems.map((i) => {
          if (i.id !== it.id) return i;
          const newOut = Math.max(0, i.outQuantity - ret.quantity);
          const newDamaged = isDamaged ? i.damagedQuantity + ret.quantity : i.damagedQuantity;
          const newAvail = Math.max(0, i.totalQuantity - newOut - newDamaged - i.reservedQuantity);
          return {
            ...i,
            outQuantity: newOut,
            damagedQuantity: newDamaged,
            availableQuantity: newAvail,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // Update eventItem line
      setEventItems((prevLines) =>
        prevLines.map((l) => {
          if (l.eventId === eventId && l.itemId === ret.itemId) {
            const newReturned = l.quantityReturned + ret.quantity;
            const newDamaged = isDamaged ? l.quantityDamaged + ret.quantity : l.quantityDamaged;
            return {
              ...l,
              quantityReturned: newReturned,
              quantityDamaged: newDamaged,
              status: isDamaged ? 'returned_damaged' : newReturned >= l.quantityDispatched ? 'returned_ok' : 'partial',
            };
          }
          return l;
        })
      );

      // Automatically create an Incident in SAT if returned damaged!
      if (isDamaged) {
        await createIncident({
          itemId: it.id,
          itemName: it.name,
          itemCode: it.code,
          serialNumber: ret.unitSerialNumbers ? ret.unitSerialNumbers.join(', ') : null,
          detectionDate: new Date().toISOString().split('T')[0],
          reportedBy: `${receivedBy} (en devolución de ${targetEvent.name})`,
          priority: 'high',
          status: 'new',
          description: ret.incidentNotes || `Equipo devuelto con avería/desperfecto desde evento ${targetEvent.code}`,
          estimatedCost: 100,
        });
      }

      // Record immutable movement
      await recordMovement({
        type: 'return',
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: ret.quantity,
        sourceLocation: `${targetEvent.name}`,
        targetLocation: isDamaged ? 'Taller Técnico / Reparación' : it.defaultLocationName,
        eventId: targetEvent.id,
        eventName: targetEvent.name,
        reason: `Recepción de devolución (${ret.condition}) recibida por ${receivedBy}`,
        notes: `Albarán ${returnCode}. ${ret.incidentNotes ? `Incidencia: ${ret.incidentNotes}` : 'Material revisado y en buen estado.'}`,
        referenceCode: returnCode,
      });

      returnNoteItems.push({
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantityReturned: ret.quantity,
        condition: ret.condition,
        unitSerialNumbers: ret.unitSerialNumbers,
        incidentNotes: ret.incidentNotes,
      });
    }

    // Check if all dispatched material for the event has been fully returned
    const eventLines = eventItems.filter((l) => l.eventId === eventId);
    const fullyReturned = eventLines.every((l) => {
      const thisRet = returnedItems.find((r) => r.itemId === l.itemId)?.quantity || 0;
      return l.quantityReturned + thisRet >= l.quantityDispatched;
    });

    if (fullyReturned) {
      await updateEventStatus(eventId, 'closed');
    } else {
      await updateEventStatus(eventId, 'pending_return');
    }

    const returnNote: ReturnNote = {
      id: `ret-${Date.now()}`,
      code: returnCode,
      eventId: targetEvent.id,
      eventCode: targetEvent.code,
      eventName: targetEvent.name,
      receivedBy,
      returnDate: new Date().toISOString(),
      notes,
      hasIncidents,
      items: returnNoteItems,
      createdAt: new Date().toISOString(),
    };

    setReturns((prev) => [returnNote, ...prev]);
    return returnNote;
  };

  // Create Incident
  const createIncident = async (
    data: Omit<Incident, 'id' | 'code' | 'createdAt' | 'updatedAt'>
  ): Promise<Incident> => {
    const year = new Date().getFullYear();
    const id = `inc-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    const code = `INC-${year}-${Math.floor(100 + Math.random() * 900)}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id,
      code,
      createdAt: now,
      updatedAt: now,
      ...data,
      history: [
        {
          date: now,
          user: userProfile?.name || 'Técnico',
          action: 'Apertura de incidencia técnica',
          notes: data.description,
        },
      ],
    };

    setIncidents((prev) => [incident, ...prev]);

    // Record movement to repair zone
    await recordMovement({
      type: 'repair_send',
      itemId: data.itemId,
      itemName: data.itemName,
      itemCode: data.itemCode || 'INC',
      quantity: 1,
      sourceLocation: 'Almacén / Evento',
      targetLocation: 'Taller Técnico y SAT',
      reason: `Envío a reparación por incidencia ${code}: ${data.description}`,
      referenceCode: code,
    });

    return incident;
  };

  // Update Incident Status
  const updateIncidentStatus = async (
    incidentId: string,
    status: Incident['status'],
    appliedSolution?: string,
    cost?: number
  ) => {
    const inc = incidents.find((i) => i.id === incidentId);
    if (!inc) return;

    const now = new Date().toISOString();
    const isRepaired = status === 'repaired' || status === 'closed';

    const updatedInc: Incident = {
      ...inc,
      status,
      appliedSolution: appliedSolution || inc.appliedSolution,
      estimatedCost: cost !== undefined ? cost : inc.estimatedCost,
      returnedDate: isRepaired ? now : inc.returnedDate,
      updatedAt: now,
      history: [
        ...(inc.history || []),
        {
          date: now,
          user: userProfile?.name || 'Responsable SAT',
          action: `Cambio de estado a: ${status}`,
          notes: appliedSolution,
        },
      ],
    };

    setIncidents((prev) => prev.map((i) => (i.id === incidentId ? updatedInc : i)));

    // If repaired, restore stock and unit status
    if (isRepaired && inc.status !== 'repaired' && inc.status !== 'closed') {
      const it = items.find((i) => i.id === inc.itemId);
      if (it) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== it.id) return item;
            const newDamaged = Math.max(0, item.damagedQuantity - 1);
            const newAvail = Math.max(0, item.totalQuantity - item.outQuantity - newDamaged - item.reservedQuantity);
            return {
              ...item,
              damagedQuantity: newDamaged,
              availableQuantity: newAvail,
              updatedAt: now,
            };
          })
        );
      }

      if (inc.unitId) {
        setItemUnits((prev) =>
          prev.map((u) => (u.id === inc.unitId ? { ...u, status: 'available', updatedAt: now } : u))
        );
      }

      await recordMovement({
        type: 'repair_return',
        itemId: inc.itemId,
        itemName: inc.itemName,
        itemCode: inc.itemCode || 'SAT',
        quantity: 1,
        sourceLocation: 'Taller Técnico y SAT',
        targetLocation: 'Almacén Central (Disponible)',
        reason: `Equipo reparado y devuelto a disponibilidad. Solución: ${appliedSolution || 'Reparado con éxito'}`,
        referenceCode: inc.code,
      });
    }
  };

  // Transfer equipment between locations
  const transferEquipment = async (
    itemId: string,
    quantity: number,
    sourceLoc: string,
    targetLoc: string,
    reason: string,
    unitId?: string
  ) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    if (unitId) {
      setItemUnits((prev) =>
        prev.map((u) => {
          if (u.id === unitId) {
            return {
              ...u,
              locationName: targetLoc,
              updatedAt: new Date().toISOString(),
            };
          }
          return u;
        })
      );
    }

    await recordMovement({
      type: 'transfer',
      itemId: item.id,
      itemName: item.name,
      itemCode: item.code,
      quantity,
      sourceLocation: sourceLoc,
      targetLocation: targetLoc,
      reason,
      referenceCode: `TRASL-${Date.now()}`,
    });
  };

  // Purchases & Material Inward
  const registerPurchase = async (
    data: Omit<Purchase, 'id' | 'createdAt'>
  ): Promise<Purchase> => {
    const id = `pur-${Date.now()}`;
    const now = new Date().toISOString();

    const purchase: Purchase = {
      id,
      createdAt: now,
      ...data,
    };

    setPurchases((prev) => [purchase, ...prev]);

    // Update item totalQuantity and stock
    for (const line of data.items) {
      const it = items.find((i) => i.id === line.itemId);
      if (it) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== it.id) return item;
            const newTotal = item.totalQuantity + line.quantity;
            const newAvail = item.availableQuantity + line.quantity;
            return {
              ...item,
              totalQuantity: newTotal,
              availableQuantity: newAvail,
              updatedAt: now,
            };
          })
        );

        await recordMovement({
          type: 'in',
          itemId: it.id,
          itemName: it.name,
          itemCode: it.code,
          quantity: line.quantity,
          sourceLocation: `Proveedor: ${data.supplierName}`,
          targetLocation: data.targetLocationName,
          reason: `Recepción de pedido de compra #${data.orderNumber}`,
          notes: `Coste unitario: ${line.unitPrice}€. Total línea: ${line.totalPrice}€`,
          referenceCode: data.orderNumber,
        });
      }
    }

    return purchase;
  };

  const updatePurchaseDeliveryNote = async (
    purchaseId: string,
    photoUrl: string,
    noteNumber?: string
  ): Promise<void> => {
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.id !== purchaseId) return p;
        return {
          ...p,
          deliveryNotePhotoUrl: photoUrl,
          ...(noteNumber ? { deliveryNoteNumber: noteNumber } : {}),
        };
      })
    );
  };

  // Physical Inventory Count Session
  const createInventorySession = async (warehouse: string): Promise<InventorySession> => {
    const code = `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const lines = items.map((it) => ({
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      locationName: it.defaultLocationName,
      theoreticalQty: it.totalQuantity,
      countedQty: it.totalQuantity,
      discrepancy: 0,
      regularized: false,
    }));

    const session: InventorySession = {
      id: `inv-${Date.now()}`,
      code,
      warehouse,
      status: 'in_progress',
      startedBy: userProfile?.name || 'Responsable de Almacén',
      startDate: new Date().toISOString(),
      lines,
    };

    setInventorySessions((prev) => [session, ...prev]);
    return session;
  };

  const saveInventoryCount = async (sessionId: string, lines: InventorySession['lines']) => {
    setInventorySessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, lines, status: 'pending_approval' } : s))
    );
  };

  const regularizeInventory = async (sessionId: string, authorizedBy: string) => {
    const session = inventorySessions.find((s) => s.id === sessionId);
    if (!session) return;

    const now = new Date().toISOString();

    for (const line of session.lines) {
      if (line.discrepancy !== 0) {
        const it = items.find((i) => i.id === line.itemId);
        if (it) {
          const diff = line.discrepancy;
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== it.id) return item;
              const newTotal = Math.max(0, item.totalQuantity + diff);
              const newAvail = Math.max(0, item.availableQuantity + diff);
              return {
                ...item,
                totalQuantity: newTotal,
                availableQuantity: newAvail,
                updatedAt: now,
              };
            })
          );

          await recordMovement({
            type: 'adjustment',
            itemId: it.id,
            itemName: it.name,
            itemCode: it.code,
            quantity: Math.abs(diff),
            sourceLocation: diff < 0 ? it.defaultLocationName : 'Regularización de Inventario',
            targetLocation: diff > 0 ? it.defaultLocationName : 'Pérdida / Descuadre Regularizado',
            reason: `Ajuste autorizado en sesión ${session.code}: ${line.reason || 'Conteo físico de almacén'}`,
            notes: `Autorizado por: ${authorizedBy}. Diferencia: ${diff > 0 ? `+${diff}` : diff}`,
            referenceCode: session.code,
          });
        }
      }
    }

    setInventorySessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: 'approved',
              approvedBy: authorizedBy,
              completionDate: now,
            }
          : s
      )
    );
  };

  // Clients & Suppliers
  const saveClient = async (data: Partial<Client> & { name: string }): Promise<Client> => {
    const id = data.id || `cli-${Date.now()}`;
    const client: Client = {
      id,
      name: data.name,
      taxId: data.taxId,
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      notes: data.notes,
      createdAt: data.createdAt || new Date().toISOString(),
    };

    setClients((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? client : c)) : [client, ...prev];
    });

    return client;
  };

  const saveSupplier = async (data: Partial<Supplier> & { name: string }): Promise<Supplier> => {
    const id = data.id || `sup-${Date.now()}`;
    const supplier: Supplier = {
      id,
      name: data.name,
      taxId: data.taxId,
      contactPerson: data.contactPerson || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      suppliedCategories: data.suppliedCategories || '',
      notes: data.notes,
      createdAt: data.createdAt || new Date().toISOString(),
    };

    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === id);
      return exists ? prev.map((s) => (s.id === id ? supplier : s)) : [supplier, ...prev];
    });

    return supplier;
  };

  // Contracts & 10% Booking Deposit Operations (Admin)
  const generateContractFromEvent = async (eventId: string): Promise<Contract> => {
    const event = events.find((e) => e.id === eventId);
    if (!event) throw new Error('Evento no encontrado');

    const client = clients.find((c) => c.id === event.clientId || c.name === event.clientName);
    const assignedLines = eventItems.filter((ei) => ei.eventId === eventId);

    const d1 = new Date(event.dispatchDate).getTime();
    const d2 = new Date(event.returnDate).getTime();
    const days = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));

    let contractItems: ContractItem[] = assignedLines.map((line, idx) => {
      const itm = items.find((i) => i.id === line.itemId);
      const baseDailyPrice = itm?.purchasePrice ? Math.max(30, Math.round(itm.purchasePrice * 0.05)) : 60;
      const unitPrice = baseDailyPrice;
      const totalPrice = unitPrice * line.quantityRequested * days;

      return {
        id: `ci-${Date.now()}-${idx}`,
        itemId: line.itemId,
        itemName: line.itemName,
        itemCode: line.itemCode,
        category: itm?.category || 'Audiovisual',
        quantity: line.quantityRequested,
        unitPrice,
        days,
        totalPrice,
      };
    });

    if (contractItems.length === 0) {
      contractItems = [
        {
          id: `ci-${Date.now()}-0`,
          itemName: `Pack Técnico Audiovisual - ${event.name}`,
          quantity: 1,
          unitPrice: 1500,
          days,
          totalPrice: 1500 * days,
        },
      ];
    }

    const subtotal = contractItems.reduce((acc, ci) => acc + ci.totalPrice, 0);
    const taxRate = 21;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const depositRate = 10;
    const depositAmount = Number(((totalAmount * depositRate) / 100).toFixed(2));
    const remainingAmount = Number((totalAmount - depositAmount).toFixed(2));

    const contractCode = `CTR-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`;

    const newContract: Contract = {
      id: `ctr-${Date.now()}`,
      code: contractCode,
      eventId: event.id,
      eventName: event.name,
      eventDate: event.eventDate,
      returnDate: event.returnDate,
      eventLocation: event.location || 'Pendiente de definir',
      clientId: client?.id || event.clientId || `cli-temp-${Date.now()}`,
      clientName: client?.name || event.clientName,
      clientTaxId: client?.taxId || 'Pendiente',
      clientEmail: client?.email || 'cliente@ejemplo.com',
      clientPhone: client?.phone || '+34 600 000 000',
      clientAddress: client?.address || event.address || 'España',
      items: contractItems,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      depositRate,
      depositAmount,
      remainingAmount,
      status: 'draft',
      paymentMethod: 'bank_transfer',
      bankDetails: {
        ...DEFAULT_BANK_DETAILS,
        paymentConcept: `RESERVA ${contractCode} ${event.name.slice(0, 15).toUpperCase().trim()}`,
      },
      depositPaidAt: null,
      depositReference: null,
      notes: `Generado automáticamente para ${event.code}. Para bloquear la fecha del evento se requiere el abono del 10% (${depositAmount.toFixed(2)} €) mediante transferencia bancaria.`,
      clauses: DEFAULT_CONTRACT_CLAUSES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Synchronize contract with Event and automatic Dispatch Note (Albarán de Salida)
    await syncContractWithDispatch(newContract);

    setContracts((prev) => [newContract, ...prev]);

    try {
      await setDoc(doc(db, 'contracts', newContract.id), newContract);
    } catch (e) {
      console.warn('Could not sync contract to Firestore:', e);
    }

    return newContract;
  };

  // Automatically generates and synchronizes an operational Dispatch Note and Event from a Contract
  const syncContractWithDispatch = async (contract: Contract) => {
    // 1. Ensure linked Event exists or register it
    let targetEvent = events.find(
      (e) => e.id === contract.eventId || (contract.eventName && e.name.toLowerCase() === contract.eventName.toLowerCase())
    );

    const now = new Date().toISOString();

    if (!targetEvent) {
      const evId = contract.eventId || `ev-${Date.now()}`;
      const year = new Date().getFullYear();
      const code = `EV-${year}-${Math.floor(100 + Math.random() * 900)}`;
      targetEvent = {
        id: evId,
        code,
        name: contract.eventName,
        clientId: contract.clientId,
        clientName: contract.clientName,
        location: contract.eventLocation || 'Almacén / Recinto',
        address: contract.clientAddress || '',
        dispatchDate: contract.eventDate,
        eventDate: contract.eventDate,
        returnDate: contract.returnDate || contract.eventDate,
        manager: userProfile?.name || 'Administración',
        status: 'confirmed',
        notes: `Generado automáticamente desde Contrato ${contract.code}`,
        createdAt: now,
        updatedAt: now,
      };
      setEvents((prev) => [targetEvent!, ...prev]);
    }

    // 2. Ensure Event Items exist so reservation is recorded
    if (contract.items && contract.items.length > 0) {
      setEventItems((prev) => {
        const updated = [...prev];
        contract.items.forEach((ci) => {
          const matchedItem = items.find(
            (i) => i.id === ci.itemId || i.name.toLowerCase() === ci.itemName.toLowerCase()
          );
          const itemId = matchedItem?.id || ci.itemId || `item-${Date.now()}`;
          const existing = updated.find((ei) => ei.eventId === targetEvent!.id && ei.itemId === itemId);
          if (!existing) {
            updated.push({
              id: `evi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              eventId: targetEvent!.id,
              itemId,
              itemName: ci.itemName,
              itemCode: matchedItem?.code || ci.itemCode || 'EQ-AV',
              brand: matchedItem?.brand || 'Genérico',
              quantityRequested: ci.quantity,
              quantityDispatched: 0,
              quantityReturned: 0,
              quantityDamaged: 0,
              status: 'requested',
            });
          }
        });
        return updated;
      });
    }

    // 3. Automatically create or synchronize Dispatch Note (Albarán de Salida)
    const year = new Date().getFullYear();
    const dispatchCode = `ALB-OUT-${year}-${contract.code.replace('CTR-', '').padStart(3, '0')}`;

    setDispatches((prev) => {
      const exists = prev.find((d) => d.contractId === contract.id || d.contractCode === contract.code);
      if (exists) return prev;

      const newDispatch: DispatchNote = {
        id: `dsp-${Date.now()}`,
        code: dispatchCode,
        eventId: targetEvent!.id,
        eventCode: targetEvent!.code,
        eventName: targetEvent!.name,
        clientName: contract.clientName,
        preparedBy: 'Pendiente de picking (Almacén)',
        authorizedBy: userProfile?.name || 'Administración',
        dispatchDate: contract.eventDate,
        status: 'preparing',
        contractId: contract.id,
        contractCode: contract.code,
        notes: `Albarán de salida generado automáticamente desde Contrato ${contract.code}. Material listo para preparación y picking por el encargado de almacén/técnico.`,
        items: contract.items.map((ci) => {
          const matched = items.find(
            (i) => i.id === ci.itemId || i.name.toLowerCase() === ci.itemName.toLowerCase()
          );
          return {
            itemId: matched?.id || ci.itemId || `item-${ci.id}`,
            itemName: ci.itemName,
            itemCode: matched?.code || ci.itemCode || 'EQ-AV',
            quantity: ci.quantity,
            unitSerialNumbers: [],
          };
        }),
        createdAt: now,
      };

      return [newDispatch, ...prev];
    });
  };

  const saveContract = async (
    contractData: Partial<Contract> & { eventName: string; totalAmount: number }
  ): Promise<Contract> => {
    const id = contractData.id || `ctr-${Date.now()}`;
    const code = contractData.code || `CTR-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`;
    const subtotal = contractData.subtotal ?? Number((contractData.totalAmount / 1.21).toFixed(2));
    const taxRate = contractData.taxRate ?? 21;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const totalAmount = contractData.totalAmount;
    const depositRate = contractData.depositRate ?? 10;
    const depositAmount = Number(((totalAmount * depositRate) / 100).toFixed(2));
    const remainingAmount = Number((totalAmount - depositAmount).toFixed(2));

    const contract: Contract = {
      id,
      code,
      eventId: contractData.eventId,
      eventName: contractData.eventName,
      eventDate: contractData.eventDate || new Date().toISOString(),
      returnDate: contractData.returnDate,
      eventLocation: contractData.eventLocation || 'Almacén Central / Recinto',
      clientId: contractData.clientId || `cli-${Date.now()}`,
      clientName: contractData.clientName || 'Cliente Particular',
      clientTaxId: contractData.clientTaxId,
      clientEmail: contractData.clientEmail || '',
      clientPhone: contractData.clientPhone || '',
      clientAddress: contractData.clientAddress,
      items: contractData.items || [],
      subtotal: Number(subtotal.toFixed(2)),
      taxRate,
      taxAmount,
      totalAmount,
      depositRate,
      depositAmount,
      remainingAmount,
      status: contractData.status || 'draft',
      paymentMethod: contractData.paymentMethod || 'bank_transfer',
      bankDetails: contractData.bankDetails || {
        ...DEFAULT_BANK_DETAILS,
        paymentConcept: `RESERVA ${code} ${(contractData.eventName || '').slice(0, 15).toUpperCase().trim()}`,
      },
      depositPaidAt: contractData.depositPaidAt ?? null,
      depositReference: contractData.depositReference ?? null,
      notes: contractData.notes || '',
      clauses: contractData.clauses || DEFAULT_CONTRACT_CLAUSES,
      createdAt: contractData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setContracts((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? contract : c)) : [contract, ...prev];
    });

    // Automatically create/sync linked Event and Dispatch Note (Albarán de Salida)
    await syncContractWithDispatch(contract);

    try {
      await setDoc(doc(db, 'contracts', id), contract);
    } catch (e) {
      console.warn('Could not sync contract to Firestore:', e);
    }

    return contract;
  };

  const updateContractStatus = async (
    contractId: string,
    status: Contract['status'],
    paymentRef?: string
  ): Promise<void> => {
    const target = contracts.find((c) => c.id === contractId);
    if (!target) return;

    const now = new Date().toISOString();
    const updated: Contract = {
      ...target,
      status,
      updatedAt: now,
      depositPaidAt: status === 'deposit_paid' ? (target.depositPaidAt || now) : target.depositPaidAt,
      depositReference: status === 'deposit_paid' ? (paymentRef || target.depositReference || 'TRF-BANCO-DIRECTA') : target.depositReference,
    };

    setContracts((prev) => prev.map((c) => (c.id === contractId ? updated : c)));

    // If deposit has been paid and tied to an event, automatically mark event as confirmed (blocks the date!)
    if (status === 'deposit_paid' && target.eventId) {
      const ev = events.find((e) => e.id === target.eventId);
      if (ev && (ev.status === 'draft' || ev.status === 'planning')) {
        await updateEventStatus(ev.id, 'confirmed');
      }
    }

    try {
      await setDoc(doc(db, 'contracts', contractId), updated);
    } catch (e) {
      console.warn('Could not update contract in Firestore:', e);
    }
  };

  const deleteContract = async (contractId: string): Promise<void> => {
    setContracts((prev) => prev.map((c) => (c.id === contractId ? { ...c, status: 'cancelled' } : c)));
  };

  const updateCompanyFiscalConfig = (newConfig: Partial<CompanyFiscalConfig>) => {
    setCompanyFiscalConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const updateDefaultBankDetails = (newDetails: Partial<BankPaymentDetails>) => {
    setDefaultBankDetails((prev) => ({ ...prev, ...newDetails }));
  };

  const saveDispatchSignature = async (
    dispatchId: string,
    signatureUrl: string,
    signerName: string,
    signerDni: string,
    driverSignatureUrl?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    setDispatches((prev) =>
      prev.map((d) => {
        if (d.id !== dispatchId) return d;
        return {
          ...d,
          clientSignatureUrl: signatureUrl,
          signerName,
          signerDni,
          signedAt: now,
          ...(driverSignatureUrl ? { driverSignatureUrl } : {}),
        };
      })
    );
  };

  const removeItemFromDispatch = async (
    dispatchId: string,
    itemId: string,
    quantityToRemove?: number
  ): Promise<void> => {
    const disp = dispatches.find((d) => d.id === dispatchId);
    if (!disp) return;

    const itemInDisp = disp.items.find((i) => i.itemId === itemId);
    if (!itemInDisp) return;

    const toRemove =
      quantityToRemove !== undefined && quantityToRemove > 0
        ? Math.min(quantityToRemove, itemInDisp.quantity)
        : itemInDisp.quantity;
    const remainingQty = itemInDisp.quantity - toRemove;

    let newItems: DispatchNote['items'];
    if (remainingQty <= 0) {
      newItems = disp.items.filter((i) => i.itemId !== itemId);
    } else {
      newItems = disp.items.map((i) =>
        i.itemId === itemId
          ? {
              ...i,
              quantity: remainingQty,
              unitSerialNumbers: i.unitSerialNumbers ? i.unitSerialNumbers.slice(0, remainingQty) : undefined,
            }
          : i
      );
    }

    // Restore inventory stock
    const it = items.find((i) => i.id === itemId);
    if (it) {
      const newOut = Math.max(0, it.outQuantity - toRemove);
      const newAvail = Math.max(0, it.totalQuantity - newOut - it.damagedQuantity - it.reservedQuantity);
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, outQuantity: newOut, availableQuantity: newAvail, updatedAt: new Date().toISOString() }
            : item
        )
      );

      // Restore serialized units status
      if (itemInDisp.unitSerialNumbers && itemInDisp.unitSerialNumbers.length > 0) {
        const freedSerials = itemInDisp.unitSerialNumbers.slice(remainingQty);
        setItemUnits((prevUnits) =>
          prevUnits.map((u) =>
            freedSerials.includes(u.serialNumber)
              ? { ...u, status: 'available', locationName: it.defaultLocationName }
              : u
          )
        );
      }

      await recordMovement({
        type: 'in',
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: toRemove,
        sourceLocation: `Albarán ${disp.code}`,
        targetLocation: it.defaultLocationName,
        eventId: disp.eventId,
        eventName: disp.eventName,
        reason: `Retirada de material del albarán ${disp.code} y reingreso a almacén`,
        referenceCode: disp.code,
      });
    }

    setDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? { ...d, items: newItems } : d))
    );
  };

  const addItemToDispatch = async (
    dispatchId: string,
    extraItem: {
      itemId: string;
      itemName: string;
      itemCode: string;
      quantity: number;
      unitSerialNumbers?: string[];
    }
  ): Promise<void> => {
    const disp = dispatches.find((d) => d.id === dispatchId);
    if (!disp) return;

    const it = items.find((i) => i.id === extraItem.itemId);
    if (!it) return;

    const availableToShip = it.totalQuantity - it.outQuantity - it.damagedQuantity;
    if (extraItem.quantity > availableToShip) {
      throw new Error(`Stock insuficiente para "${it.name}". Disponible en almacén: ${availableToShip}`);
    }

    const newOut = it.outQuantity + extraItem.quantity;
    const newAvail = Math.max(0, it.totalQuantity - newOut - it.damagedQuantity - it.reservedQuantity);
    setItems((prev) =>
      prev.map((item) =>
        item.id === extraItem.itemId
          ? { ...item, outQuantity: newOut, availableQuantity: newAvail, updatedAt: new Date().toISOString() }
          : item
      )
    );

    if (extraItem.unitSerialNumbers && extraItem.unitSerialNumbers.length > 0) {
      setItemUnits((prevUnits) =>
        prevUnits.map((u) =>
          extraItem.unitSerialNumbers?.includes(u.serialNumber)
            ? { ...u, status: 'in_event', currentEventId: disp.eventId, currentEventName: disp.eventName }
            : u
        )
      );
    }

    const existingIndex = disp.items.findIndex((i) => i.itemId === extraItem.itemId);
    let updatedItems = [...disp.items];
    if (existingIndex >= 0) {
      const existing = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...existing,
        quantity: existing.quantity + extraItem.quantity,
        unitSerialNumbers: [
          ...(existing.unitSerialNumbers || []),
          ...(extraItem.unitSerialNumbers || []),
        ],
      };
    } else {
      updatedItems.push({
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: extraItem.quantity,
        unitSerialNumbers: extraItem.unitSerialNumbers,
      });
    }

    await recordMovement({
      type: 'dispatch',
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      quantity: extraItem.quantity,
      sourceLocation: it.defaultLocationName,
      targetLocation: `Albarán ${disp.code} (${disp.eventName})`,
      eventId: disp.eventId,
      eventName: disp.eventName,
      reason: `Material extra/escaneado añadido al albarán ${disp.code}`,
      referenceCode: disp.code,
    });

    setDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? { ...d, items: updatedItems } : d))
    );
  };

  const reportDamageFromPurchase = async (
    purchaseId: string,
    itemId: string,
    quantity: number,
    description: string,
    photos?: string[]
  ): Promise<Incident> => {
    const purchase = purchases.find((p) => p.id === purchaseId);
    const it = items.find((i) => i.id === itemId);
    if (!it) throw new Error('Artículo no encontrado');

    const code = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const incident: Incident = {
      id: `inc-${Date.now()}`,
      code,
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      description: `Avería/Daño detectado en recepción de pedido ${purchase?.orderNumber || ''}: ${description}`,
      status: 'in_repair',
      priority: 'high',
      detectionDate: now,
      reportedBy: userProfile?.name || 'Recepción Almacén',
      history: [
        {
          date: now,
          user: userProfile?.name || 'Recepción Almacén',
          action: `Incidencia abierta desde recepción de compra ${purchase?.orderNumber || ''}`,
          notes: description,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setIncidents((prev) => [incident, ...prev]);

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== it.id) return item;
        const newDamaged = item.damagedQuantity + quantity;
        const newAvail = Math.max(0, item.availableQuantity - quantity);
        return {
          ...item,
          damagedQuantity: newDamaged,
          availableQuantity: newAvail,
          updatedAt: now,
        };
      })
    );

    await recordMovement({
      type: 'repair_send',
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      quantity,
      sourceLocation: `Recepción Pedido ${purchase?.orderNumber || ''}`,
      targetLocation: 'Taller Técnico y SAT',
      reason: `Material recibido con averías/roturas: ${description}`,
      referenceCode: code,
    });

    return incident;
  };

  // Seed or Reset to Initial Realistic AV Data
  const seedInitialData = async () => {
    setItems(INITIAL_ITEMS);
    setItemUnits(INITIAL_UNITS);
    setCategories(INITIAL_CATEGORIES);
    setLocations(INITIAL_LOCATIONS);
    setEvents(INITIAL_EVENTS);
    setEventItems(INITIAL_EVENT_ITEMS);
    setIncidents(INITIAL_INCIDENTS);
    setMovements(INITIAL_MOVEMENTS);
    setClients(INITIAL_CLIENTS);
    setSuppliers(INITIAL_SUPPLIERS);
    setDispatches([]);
    setReturns([]);
    setPurchases([]);
    setInventorySessions([]);
    setContracts(INITIAL_CONTRACTS);

    try {
      for (const item of INITIAL_ITEMS) {
        await setDoc(doc(db, 'items', item.id), item);
      }
      for (const ev of INITIAL_EVENTS) {
        await setDoc(doc(db, 'events', ev.id), ev);
      }
    } catch (e) {
      console.warn('Seeding to Firestore error:', e);
    }
  };

  // Clear all demo items, units, movements, contracts and events to start completely from 0
  const clearAllDemoData = async () => {
    setItems([]);
    setItemUnits([]);
    setEvents([]);
    setEventItems([]);
    setIncidents([]);
    setMovements([]);
    setDispatches([]);
    setReturns([]);
    setPurchases([]);
    setInventorySessions([]);
    setContracts([]);
    setClients([]);
    setSuppliers([]);

    // Clear local storage entries
    localStorage.setItem('prompt_maestro_items', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_units', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_events', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_event_items', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_incidents', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_movements', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_clients', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_suppliers', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_dispatches', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_returns', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_purchases', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_inventory_sessions', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_contracts', JSON.stringify([]));

    // Delete Firestore documents if connected
    try {
      const itemsSnap = await getDocs(collection(db, 'items'));
      for (const d of itemsSnap.docs) {
        await deleteDoc(d.ref);
      }
      const eventsSnap = await getDocs(collection(db, 'events'));
      for (const d of eventsSnap.docs) {
        await deleteDoc(d.ref);
      }
      const unitsSnap = await getDocs(collection(db, 'itemUnits'));
      for (const d of unitsSnap.docs) {
        await deleteDoc(d.ref);
      }
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      for (const d of contractsSnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (e) {
      console.warn('Clearing Firestore collections warning:', e);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        itemUnits,
        categories,
        locations,
        events,
        eventItems,
        incidents,
        movements,
        clients,
        suppliers,
        dispatches,
        returns,
        purchases,
        inventorySessions,
        contracts,
        companyFiscalConfig,
        defaultBankDetails,
        loading,
        isOfflineMode,

        saveItem,
        archiveItem,
        saveItemUnit,
        importItemsFromSpreadsheet,

        saveCategory,
        saveLocation,

        saveEvent,
        addEventItem,
        removeEventItem,
        updateEventStatus,
        checkAvailability,

        processDispatch,
        processReturn,
        saveDispatchSignature,
        removeItemFromDispatch,
        addItemToDispatch,

        createIncident,
        updateIncidentStatus,

        transferEquipment,
        registerPurchase,
        updatePurchaseDeliveryNote,
        reportDamageFromPurchase,

        createInventorySession,
        saveInventoryCount,
        regularizeInventory,

        saveClient,
        saveSupplier,

        saveContract,
        updateContractStatus,
        generateContractFromEvent,
        deleteContract,

        updateCompanyFiscalConfig,
        updateDefaultBankDetails,

        seedInitialData,
        clearAllDemoData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
