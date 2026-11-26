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
  EquipmentKit,
  CableBox,
  CableBoxAdjustment,
  ConsumableItem,
  ConsumableAdjustment,
  BackupReminderConfig,
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
  INITIAL_EQUIPMENT_KITS,
  INITIAL_CABLE_BOXES,
  INITIAL_CONSUMABLES,
  DEFAULT_BANK_DETAILS,
  DEFAULT_CONTRACT_CLAUSES,
  DEFAULT_COMPANY_FISCAL_CONFIG,
  DEFAULT_BACKUP_CONFIG,
} from '../lib/initialData.ts';
import { useAuth } from './AuthContext.tsx';
import { generateBarcode, inferGroupFromCategory, ParsedItemRow } from '../lib/barcodeUtils.ts';
import { findUnitOrItemByCode } from '../lib/qrScannerUtils.ts';
import * as XLSX from 'xlsx';

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
  equipmentKits: EquipmentKit[];
  cableBoxes: CableBox[];
  consumables: ConsumableItem[];
  backupConfig: BackupReminderConfig;
  isBackupDue: boolean;
  loading: boolean;
  isOfflineMode: boolean;

  // Item Operations
  saveItem: (item: Partial<Item> & { name: string; category: string; initialSerialNumbers?: string[] }) => Promise<Item>;
  updateItemPrice: (itemId: string, rentalPrice: number, purchasePrice?: number) => Promise<void>;
  archiveItem: (itemId: string, reason?: string) => Promise<void>;
  saveItemUnit: (unit: Partial<ItemUnit> & { itemId: string; serialNumber: string }) => Promise<ItemUnit>;
  importItemsFromSpreadsheet: (parsedRows: import('../lib/barcodeUtils.ts').ParsedItemRow[]) => Promise<{ imported: number; updated: number; unitsCount: number; errors: string[] }>;

  // Composite QR Kits & Cable Boxes
  saveEquipmentKit: (kit: Partial<EquipmentKit> & { name: string }) => Promise<EquipmentKit>;
  deleteEquipmentKit: (kitId: string) => Promise<void>;
  saveCableBox: (box: Partial<CableBox> & { name: string; cableType: string }) => Promise<CableBox>;
  deleteCableBox: (boxId: string) => Promise<void>;
  adjustCableBoxQuantity: (
    boxId: string,
    type: 'broken' | 'lost' | 'restocked',
    amount: number,
    notes?: string,
    eventName?: string
  ) => Promise<CableBox | null>;

  // Consumables with QR & automatic buy-alert status
  saveConsumable: (consumable: Partial<ConsumableItem> & { name: string }) => Promise<ConsumableItem>;
  deleteConsumable: (consumableId: string) => Promise<void>;
  adjustConsumableQuantity: (
    consumableId: string,
    type: 'consumed' | 'restocked',
    amount: number,
    notes?: string,
    eventName?: string
  ) => Promise<ConsumableItem | null>;

  // Backup Reminder & Full JSON Export/Restore
  updateBackupConfig: (partial: Partial<BackupReminderConfig>) => void;
  exportFullBackupJson: () => void;
  exportContractsAndDispatchesArchive: () => void;
  restoreFullBackupJson: (jsonText: string) => Promise<{ restoredCollections: number }>;

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
      section?: string;
      unitSerialNumbers?: string[];
      verifiedByQr?: boolean;
      scannedQrCode?: string;
      kitId?: string;
      cableBoxId?: string;
      kitComponentsSummary?: string;
    }
  ) => Promise<void>;
  verifyDispatchLineByQr: (
    dispatchId: string,
    section: string,
    rawQrCode: string
  ) => Promise<{ label: string; kind: 'kit' | 'cable_box' | 'unit' | 'item' | 'custom' }>;

  // Material Damage Direct from Reception to SAT
  reportDamageFromPurchase: (
    purchaseId: string,
    itemId: string,
    quantity: number,
    description: string,
    photos?: string[]
  ) => Promise<Incident>;
  reportDamageDirectly: (data: {
    itemId: string;
    quantity: number;
    serialNumbers?: string[];
    description: string;
    sourceContext: 'dispatch' | 'return' | 'warehouse';
    referenceName?: string;
    priority?: Incident['priority'];
  }) => Promise<Incident>;

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

// Recursively remove undefined keys so Firestore setDoc never rejects optional fields
const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        clean[k] = stripUndefined(v);
      }
    }
    return clean as T;
  }
  return value;
};

const persistDoc = async (colName: string, id: string, data: unknown) => {
  try {
    await setDoc(doc(db, colName, id), stripUndefined(data) as Record<string, unknown>);
  } catch (err) {
    console.warn(`Firestore write failed for ${colName}/${id}:`, err);
  }
};

const removeDoc = async (colName: string, id: string) => {
  try {
    await deleteDoc(doc(db, colName, id));
  } catch (err) {
    console.warn(`Firestore delete failed for ${colName}/${id}:`, err);
  }
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, isAuthenticated, isPending } = useAuth();
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
  const [equipmentKits, setEquipmentKits] = useState<EquipmentKit[]>(() => getStored('equipment_kits', INITIAL_EQUIPMENT_KITS));
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>(() => getStored('cable_boxes', INITIAL_CABLE_BOXES));
  const [consumables, setConsumables] = useState<ConsumableItem[]>(() => getStored('consumables', INITIAL_CONSUMABLES));
  const [backupConfig, setBackupConfig] = useState<BackupReminderConfig>(() => {
    const stored = getStored<BackupReminderConfig>('backup_config', DEFAULT_BACKUP_CONFIG);
    return { ...DEFAULT_BACKUP_CONFIG, ...stored };
  });
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

  // Compute if periodic Chief Admin backup is currently due
  const isBackupDue = (() => {
    if (!backupConfig.enabled) return false;
    const now = Date.now();
    if (backupConfig.snoozedUntil && new Date(backupConfig.snoozedUntil).getTime() > now) {
      return false;
    }
    if (!backupConfig.lastBackupDate) return true;
    const last = new Date(backupConfig.lastBackupDate);
    const nextDue = new Date(last);
    nextDue.setMonth(nextDue.getMonth() + Math.max(1, backupConfig.intervalMonths || 3));
    return now >= nextDue.getTime();
  })();

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
  useEffect(() => { setStored('equipment_kits', equipmentKits); }, [equipmentKits]);
  useEffect(() => { setStored('cable_boxes', cableBoxes); }, [cableBoxes]);
  useEffect(() => { setStored('consumables', consumables); }, [consumables]);
  useEffect(() => { setStored('backup_config', backupConfig); }, [backupConfig]);
  useEffect(() => { setStored('company_fiscal_config', companyFiscalConfig); }, [companyFiscalConfig]);
  useEffect(() => { setStored('default_bank_details', defaultBankDetails); }, [defaultBankDetails]);

  // Firestore real-time sync effect — subscribes to ALL shared collections once user is approved (Admin, Encargado, Técnico)
  useEffect(() => {
    if (!isAuthenticated || isPending || !userProfile || userProfile.role === 'pending') {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const unsubs: (() => void)[] = [];
    const isAdminUser = userProfile.role === 'admin';

    const sortByDateDesc = <T extends { createdAt?: string }>(a: T, b: T) =>
      (b.createdAt || '').localeCompare(a.createdAt || '');

    const subscribeCollection = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      sortFn?: (a: T, b: T) => number
    ) => {
      let hasReceivedServerData = false;
      const unsub = onSnapshot(
        collection(db, colName),
        (snapshot) => {
          if (cancelled) return;
          if (snapshot.empty && snapshot.metadata.fromCache && !hasReceivedServerData) {
            return;
          }
          if (!snapshot.metadata.fromCache) {
            hasReceivedServerData = true;
          }
          const list: T[] = [];
          snapshot.forEach((docSnap) => list.push(docSnap.data() as T));
          if (sortFn) list.sort(sortFn);
          setter(list);
          setIsOfflineMode(false);
        },
        (err) => {
          console.warn(`Firestore snapshot warning (${colName}):`, err.message);
          if (colName === 'items') setIsOfflineMode(true);
        }
      );
      unsubs.push(unsub);
    };

    const seedCollectionIfEmpty = async <T extends { id: string }>(colName: string, docsToSeed: T[]) => {
      if (docsToSeed.length === 0) return;
      try {
        const snap = await getDocs(collection(db, colName));
        if (snap.empty) {
          await Promise.all(docsToSeed.map((d) => persistDoc(colName, d.id, d)));
        }
      } catch (err) {
        console.warn(`Could not check/seed ${colName}:`, err);
      }
    };

    const initFirestoreSync = async () => {
      try {
        const itemsSnap = await getDocs(collection(db, 'items'));
        if (cancelled) return;

        if (itemsSnap.empty) {
          // Brand-new Firestore database: seed initial dataset once
          await Promise.all([
            ...INITIAL_ITEMS.map((item) => persistDoc('items', item.id, item)),
            ...INITIAL_UNITS.map((unit) => persistDoc('itemUnits', unit.id, unit)),
            ...INITIAL_CATEGORIES.map((cat) => persistDoc('categories', cat.id, cat)),
            ...INITIAL_LOCATIONS.map((loc) => persistDoc('locations', loc.id, loc)),
            ...INITIAL_CLIENTS.map((cli) => persistDoc('clients', cli.id, cli)),
            ...INITIAL_SUPPLIERS.map((sup) => persistDoc('suppliers', sup.id, sup)),
            ...INITIAL_EVENTS.map((ev) => persistDoc('events', ev.id, ev)),
            ...INITIAL_EVENT_ITEMS.map((ei) => persistDoc('eventItems', ei.id, ei)),
            ...INITIAL_DISPATCHES.map((dsp) => persistDoc('dispatches', dsp.id, dsp)),
            ...INITIAL_INCIDENTS.map((inc) => persistDoc('incidents', inc.id, inc)),
            ...INITIAL_MOVEMENTS.map((mov) => persistDoc('movements', mov.id, mov)),
            ...INITIAL_EQUIPMENT_KITS.map((kit) => persistDoc('equipmentKits', kit.id, kit)),
            ...INITIAL_CABLE_BOXES.map((box) => persistDoc('cableBoxes', box.id, box)),
            ...INITIAL_CONSUMABLES.map((cons) => persistDoc('consumables', cons.id, cons)),
            ...(isAdminUser ? INITIAL_CONTRACTS.map((ctr) => persistDoc('contracts', ctr.id, ctr)) : []),
          ]);
        } else {
          // Existing active database: migrate any previously local-only collections if empty in Firestore
          await Promise.all([
            seedCollectionIfEmpty('clients', getStored<Client[]>('clients', INITIAL_CLIENTS)),
            seedCollectionIfEmpty('suppliers', getStored<Supplier[]>('suppliers', INITIAL_SUPPLIERS)),
            seedCollectionIfEmpty('categories', getStored<Category[]>('categories', INITIAL_CATEGORIES)),
            seedCollectionIfEmpty('locations', getStored<Location[]>('locations', INITIAL_LOCATIONS)),
            seedCollectionIfEmpty('itemUnits', getStored<ItemUnit[]>('units', INITIAL_UNITS)),
            seedCollectionIfEmpty('eventItems', getStored<EventItem[]>('event_items', INITIAL_EVENT_ITEMS)),
            seedCollectionIfEmpty('dispatches', getStored<DispatchNote[]>('dispatches', INITIAL_DISPATCHES)),
            seedCollectionIfEmpty('returns', getStored<ReturnNote[]>('returns', [])),
            seedCollectionIfEmpty('incidents', getStored<Incident[]>('incidents', INITIAL_INCIDENTS)),
            seedCollectionIfEmpty('purchases', getStored<Purchase[]>('purchases', [])),
            seedCollectionIfEmpty('inventorySessions', getStored<InventorySession[]>('inventory_sessions', [])),
            seedCollectionIfEmpty('equipmentKits', getStored<EquipmentKit[]>('equipment_kits', INITIAL_EQUIPMENT_KITS)),
            seedCollectionIfEmpty('cableBoxes', getStored<CableBox[]>('cable_boxes', INITIAL_CABLE_BOXES)),
            seedCollectionIfEmpty('consumables', getStored<ConsumableItem[]>('consumables', INITIAL_CONSUMABLES)),
            ...(isAdminUser ? [seedCollectionIfEmpty('contracts', getStored<Contract[]>('contracts', INITIAL_CONTRACTS))] : []),
          ]);
        }

        if (cancelled) return;

        // Attach real-time listeners to ALL shared collections so every role sees changes instantaneously
        subscribeCollection<Item>('items', setItems, sortByDateDesc);
        subscribeCollection<ItemUnit>('itemUnits', setItemUnits, sortByDateDesc);
        subscribeCollection<Category>('categories', setCategories);
        subscribeCollection<Location>('locations', setLocations);
        subscribeCollection<AVEvent>('events', setEvents, sortByDateDesc);
        subscribeCollection<EventItem>('eventItems', setEventItems);
        subscribeCollection<InventoryMovement>('movements', setMovements, (a, b) =>
          (b.timestamp || '').localeCompare(a.timestamp || '')
        );
        subscribeCollection<Incident>('incidents', setIncidents, sortByDateDesc);
        subscribeCollection<Client>('clients', setClients, sortByDateDesc);
        subscribeCollection<Supplier>('suppliers', setSuppliers, sortByDateDesc);
        subscribeCollection<DispatchNote>('dispatches', setDispatches, sortByDateDesc);
        subscribeCollection<ReturnNote>('returns', setReturns, sortByDateDesc);
        subscribeCollection<Purchase>('purchases', setPurchases, sortByDateDesc);
        subscribeCollection<InventorySession>('inventorySessions', setInventorySessions, (a, b) =>
          (b.startDate || '').localeCompare(a.startDate || '')
        );
        subscribeCollection<EquipmentKit>('equipmentKits', setEquipmentKits, sortByDateDesc);
        subscribeCollection<CableBox>('cableBoxes', setCableBoxes, sortByDateDesc);
        subscribeCollection<ConsumableItem>('consumables', setConsumables, sortByDateDesc);

        if (isAdminUser) {
          subscribeCollection<Contract>('contracts', setContracts, sortByDateDesc);
        }

        setIsOfflineMode(false);
      } catch (err) {
        console.warn('Firestore connection failed, using local in-browser persistence:', err);
        setIsOfflineMode(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initFirestoreSync();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [isAuthenticated, isPending, userProfile?.role]);

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
      await persistDoc('movements', newMovement.id, newMovement);

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

        const nextItem: Item = {
          ...item,
          availableQuantity: available,
          reservedQuantity: reservedCount,
          outQuantity: outCount,
          damagedQuantity: damagedCount,
          updatedAt: new Date().toISOString(),
        };
        void persistDoc('items', nextItem.id, nextItem);
        return nextItem;
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
      rentalPrice: data.rentalPrice,
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

    await persistDoc('items', id, fullItem);

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
        await Promise.all(newUnitsToCreate.map((unit) => persistDoc('itemUnits', unit.id, unit)));
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

  // Quick inline price updater (rental/work price and optional purchase price)
  const updateItemPrice = async (itemId: string, rentalPrice: number, purchasePrice?: number) => {
    const now = new Date().toISOString();
    const cleanRental = Math.max(0, Number(rentalPrice) || 0);
    const existing = items.find((it) => it.id === itemId);
    const updatedItem = existing
      ? {
          ...existing,
          rentalPrice: cleanRental,
          ...(purchasePrice !== undefined ? { purchasePrice: Math.max(0, Number(purchasePrice) || 0) } : {}),
          updatedAt: now,
        }
      : null;

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          rentalPrice: cleanRental,
          ...(purchasePrice !== undefined ? { purchasePrice: Math.max(0, Number(purchasePrice) || 0) } : {}),
          updatedAt: now,
        };
      })
    );

    if (updatedItem) {
      await persistDoc('items', itemId, updatedItem);
    } else {
      try {
        await updateDoc(doc(db, 'items', itemId), {
          rentalPrice: cleanRental,
          ...(purchasePrice !== undefined ? { purchasePrice: Math.max(0, Number(purchasePrice) || 0) } : {}),
          updatedAt: now,
        });
      } catch {
        // local fallback
      }
    }
  };

  // Bulk import & smart upsert from spreadsheet (Excel XLSX / CSV) — updates prices/stock on existing items!
  const importItemsFromSpreadsheet = async (
    parsedRows: ParsedItemRow[]
  ): Promise<{ imported: number; updated: number; unitsCount: number; errors: string[] }> => {
    let imported = 0;
    let updated = 0;
    let unitsCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    const newItems: Item[] = [];
    const updatedMap = new Map<string, Item>();
    const newUnits: ItemUnit[] = [];

    for (let index = 0; index < parsedRows.length; index++) {
      const row = parsedRows[index];
      try {
        if (!row.name || !row.name.trim()) continue;
        const cleanName = row.name.trim();
        const cleanCode = row.code?.trim();

        // Check if existing item matches by code or exact name -> smart upsert
        const existing = items.find(
          (it) =>
            (cleanCode && it.code.toLowerCase() === cleanCode.toLowerCase()) ||
            it.name.toLowerCase() === cleanName.toLowerCase()
        );

        if (existing) {
          const nextTotal = row.totalQuantity > 0 ? row.totalQuantity : existing.totalQuantity;
          const nextAvail = Math.max(0, nextTotal - existing.outQuantity - existing.damagedQuantity - existing.reservedQuantity);
          const mergedItem: Item = {
            ...existing,
            name: cleanName,
            group: row.group || existing.group,
            category: row.category || existing.category,
            subcategory: row.subcategory || existing.subcategory,
            brand: row.brand || existing.brand,
            model: row.model || existing.model,
            totalQuantity: nextTotal,
            availableQuantity: nextAvail,
            rentalPrice: row.rentalPrice !== undefined ? row.rentalPrice : existing.rentalPrice,
            purchasePrice: row.purchasePrice !== undefined ? row.purchasePrice : existing.purchasePrice,
            minStock: row.minStock !== undefined ? row.minStock : existing.minStock,
            unit: row.unit || existing.unit,
            supplier: row.supplier || existing.supplier,
            description: row.description || existing.description,
            updatedAt: now,
          };
          updatedMap.set(existing.id, mergedItem);
          updated++;
          await persistDoc('items', existing.id, mergedItem);
          continue;
        }

        const itemId = `item-imp-${Date.now()}-${index}`;
        const category = row.category || 'General';
        const group = row.group || inferGroupFromCategory(category, cleanName);
        const codePrefix = group.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'EQ');
        const code =
          cleanCode ||
          `${codePrefix}-${cleanName.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
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
          purchasePrice: row.purchasePrice ?? 0,
          rentalPrice: row.rentalPrice ?? 0,
          acquisitionDate: now.split('T')[0],
          status: 'active',
          minStock: row.minStock || 2,
          notes: 'Importado mediante plantilla Excel / CSV',
          createdAt: now,
          updatedAt: now,
        };

        newItems.push(itemObj);
        imported++;

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

        await persistDoc('items', itemObj.id, itemObj);
      } catch (err: any) {
        errors.push(`Error en fila ${index + 1} (${row.name || 'desconocido'}): ${err.message}`);
      }
    }

    if (newItems.length > 0 || updatedMap.size > 0) {
      setItems((prev) => {
        const patched = prev.map((it) => updatedMap.get(it.id) || it);
        return [...newItems, ...patched];
      });
    }
    if (newUnits.length > 0) {
      setItemUnits((prev) => [...newUnits, ...prev]);
      await Promise.all(newUnits.map((u) => persistDoc('itemUnits', u.id, u)));
    }

    if (newItems.length > 0 || updatedMap.size > 0) {
      await recordMovement({
        type: 'adjustment',
        itemId: 'bulk-import',
        itemName: `Sincronización Excel (${newItems.length} nuevos, ${updatedMap.size} actualizados)`,
        itemCode: 'IMP-XLS',
        quantity: newItems.length + updatedMap.size,
        sourceLocation: 'Excel / CSV',
        targetLocation: 'Almacén Central',
        reason: `Importación/Actualización de tarifas y stock: ${newItems.length} nuevos, ${updatedMap.size} precios/datos actualizados.`,
        referenceCode: `IMP-${Date.now()}`,
      });
    }

    return { imported, updated, unitsCount, errors };
  };

  // --- Composite Equipment Kits (QR Conjuntos: Carros, Racks, Packs) ---
  const saveEquipmentKit = async (
    kitData: Partial<EquipmentKit> & { name: string }
  ): Promise<EquipmentKit> => {
    const now = new Date().toISOString();
    const id = kitData.id || `kit-${Date.now()}`;
    const cleanCode =
      kitData.code?.trim().toUpperCase() ||
      `KIT-${(kitData.section || 'AV').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')}-${Math.floor(100 + Math.random() * 900)}`;
    const qrCode = kitData.qrCode?.trim() || `QR-${cleanCode}`;

    const fullKit: EquipmentKit = {
      id,
      code: cleanCode,
      name: kitData.name.trim(),
      section: kitData.section || 'Sonido',
      qrCode,
      description: kitData.description || '',
      locationName: kitData.locationName || 'Nave Central',
      rentalPrice: kitData.rentalPrice !== undefined ? Number(kitData.rentalPrice) : 0,
      status: kitData.status || 'available',
      currentEventId: kitData.currentEventId ?? null,
      currentEventName: kitData.currentEventName ?? null,
      components: kitData.components || [],
      notes: kitData.notes || '',
      createdAt: kitData.createdAt || now,
      updatedAt: now,
    };

    setEquipmentKits((prev) => {
      const exists = prev.some((k) => k.id === id);
      return exists ? prev.map((k) => (k.id === id ? fullKit : k)) : [fullKit, ...prev];
    });

    await persistDoc('equipmentKits', id, fullKit);

    return fullKit;
  };

  const deleteEquipmentKit = async (kitId: string) => {
    setEquipmentKits((prev) => prev.filter((k) => k.id !== kitId));
    await removeDoc('equipmentKits', kitId);
  };

  // --- Cable Boxes with QR & Breakage/Loss Deduction ---
  const saveCableBox = async (
    boxData: Partial<CableBox> & { name: string; cableType: string }
  ): Promise<CableBox> => {
    const now = new Date().toISOString();
    const id = boxData.id || `cbox-${Date.now()}`;
    const cleanCode =
      boxData.code?.trim().toUpperCase() ||
      `CAJA-${boxData.cableType.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Math.floor(10 + Math.random() * 90)}`;
    const qrCode = boxData.qrCode?.trim() || `QR-${cleanCode}`;
    const initialQty = Math.max(1, Number(boxData.initialQuantity) || 10);
    const currentQty = boxData.currentQuantity !== undefined ? Math.max(0, Number(boxData.currentQuantity)) : initialQty;

    const fullBox: CableBox = {
      id,
      code: cleanCode,
      name: boxData.name.trim(),
      cableType: boxData.cableType.trim(),
      cableLength: boxData.cableLength || '',
      qrCode,
      linkedItemId: boxData.linkedItemId || undefined,
      initialQuantity: initialQty,
      currentQuantity: currentQty,
      brokenCount: boxData.brokenCount || 0,
      lostCount: boxData.lostCount || 0,
      locationName: boxData.locationName || 'Zona Cableado & Distribución Eléctrica',
      section: boxData.section || 'Cableado',
      status: currentQty < initialQty ? 'incomplete' : (boxData.status || 'available'),
      notes: boxData.notes || '',
      adjustments: boxData.adjustments || [],
      createdAt: boxData.createdAt || now,
      updatedAt: now,
    };

    setCableBoxes((prev) => {
      const exists = prev.some((b) => b.id === id);
      return exists ? prev.map((b) => (b.id === id ? fullBox : b)) : [fullBox, ...prev];
    });

    await persistDoc('cableBoxes', id, fullBox);

    return fullBox;
  };

  const deleteCableBox = async (boxId: string) => {
    setCableBoxes((prev) => prev.filter((b) => b.id !== boxId));
    await removeDoc('cableBoxes', boxId);
  };

  const adjustCableBoxQuantity = async (
    boxId: string,
    type: 'broken' | 'lost' | 'restocked',
    amount: number,
    notes?: string,
    eventName?: string
  ): Promise<CableBox | null> => {
    const box = cableBoxes.find((b) => b.id === boxId);
    if (!box) return null;
    const cleanAmt = Math.max(1, Math.round(amount));
    const now = new Date().toISOString();

    const prevQty = box.currentQuantity;
    const newQty =
      type === 'restocked'
        ? prevQty + cleanAmt
        : Math.max(0, prevQty - cleanAmt);

    const newBroken = type === 'broken' ? box.brokenCount + cleanAmt : box.brokenCount;
    const newLost = type === 'lost' ? box.lostCount + cleanAmt : box.lostCount;
    const nextInitial = type === 'restocked' && newQty > box.initialQuantity ? newQty : box.initialQuantity;

    const adj: CableBoxAdjustment = {
      id: `adj-${Date.now()}`,
      date: now,
      type,
      amount: cleanAmt,
      previousQuantity: prevQty,
      newQuantity: newQty,
      userName: userProfile?.name || 'Técnico Almacén',
      eventName: eventName || undefined,
      notes: notes || (type === 'broken' ? 'Cable roto descontado del QR de caja' : type === 'lost' ? 'Cable perdido descontado del QR de caja' : 'Reposición de cables en caja'),
    };

    const updatedBox: CableBox = {
      ...box,
      initialQuantity: nextInitial,
      currentQuantity: newQty,
      brokenCount: newBroken,
      lostCount: newLost,
      status: newQty < nextInitial ? 'incomplete' : 'available',
      adjustments: [adj, ...(box.adjustments || [])],
      updatedAt: now,
    };

    setCableBoxes((prev) => prev.map((b) => (b.id === boxId ? updatedBox : b)));
    await persistDoc('cableBoxes', boxId, updatedBox);

    // If linked to an inventory catalog item, adjust its damaged/total stock accordingly
    if (box.linkedItemId) {
      const linked = items.find((i) => i.id === box.linkedItemId);
      if (linked) {
        let updatedLinked: Item;
        if (type === 'broken') {
          const newDamaged = linked.damagedQuantity + cleanAmt;
          updatedLinked = {
            ...linked,
            damagedQuantity: newDamaged,
            availableQuantity: Math.max(0, linked.totalQuantity - linked.outQuantity - newDamaged - linked.reservedQuantity),
            updatedAt: now,
          };
        } else if (type === 'lost') {
          const newTotal = Math.max(0, linked.totalQuantity - cleanAmt);
          updatedLinked = {
            ...linked,
            totalQuantity: newTotal,
            availableQuantity: Math.max(0, newTotal - linked.outQuantity - linked.damagedQuantity - linked.reservedQuantity),
            updatedAt: now,
          };
        } else {
          const newTotal = linked.totalQuantity + cleanAmt;
          updatedLinked = {
            ...linked,
            totalQuantity: newTotal,
            availableQuantity: Math.max(0, newTotal - linked.outQuantity - linked.damagedQuantity - linked.reservedQuantity),
            updatedAt: now,
          };
        }
        setItems((prev) => prev.map((it) => (it.id === linked.id ? updatedLinked : it)));
        await persistDoc('items', linked.id, updatedLinked);
      }
    }

    await recordMovement({
      type: type === 'restocked' ? 'in' : 'adjustment',
      itemId: box.linkedItemId || box.id,
      itemName: `${box.name} (${box.cableType})`,
      itemCode: box.code,
      quantity: cleanAmt,
      sourceLocation: box.locationName,
      targetLocation:
        type === 'broken'
          ? 'Baja por Rotura (Cable)'
          : type === 'lost'
          ? 'Pérdida / Extravío (Cable)'
          : box.locationName,
      eventName: eventName || null,
      reason:
        type === 'broken'
          ? `Descuento de ${cleanAmt} cable(s) ROTO(S) en QR ${box.qrCode} (${prevQty} → ${newQty})`
          : type === 'lost'
          ? `Descuento de ${cleanAmt} cable(s) PERDIDO(S) en QR ${box.qrCode} (${prevQty} → ${newQty})`
          : `Reposición de +${cleanAmt} cable(s) en QR ${box.qrCode} (${prevQty} → ${newQty})`,
      notes: notes || '',
      referenceCode: box.qrCode,
    });

    return updatedBox;
  };

  // --- Consumables with QR & Automatic Buy-Alert Tracking ---
  const saveConsumable = async (
    consData: Partial<ConsumableItem> & { name: string }
  ): Promise<ConsumableItem> => {
    const now = new Date().toISOString();
    const id = consData.id || `cons-${Date.now()}`;
    const cleanCode =
      consData.code?.trim().toUpperCase() ||
      `CONS-${consData.name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X')}-${Math.floor(10 + Math.random() * 90)}`;
    const qrCode = consData.qrCode?.trim() || `QR-${cleanCode}`;
    const currentQty = consData.currentQuantity !== undefined ? Math.max(0, Number(consData.currentQuantity)) : 0;
    const minStock = consData.minStock !== undefined ? Math.max(0, Number(consData.minStock)) : 2;
    const recommendedOrderQty =
      consData.recommendedOrderQty !== undefined
        ? Math.max(1, Number(consData.recommendedOrderQty))
        : Math.max(2, minStock * 2);

    const fullConsumable: ConsumableItem = {
      id,
      code: cleanCode,
      name: consData.name.trim(),
      category: consData.category || 'Humo / Efectos',
      unit: consData.unit || 'Garrafas 5L',
      qrCode,
      currentQuantity: currentQty,
      minStock,
      recommendedOrderQty,
      supplier: consData.supplier?.trim() || '',
      locationName: consData.locationName?.trim() || 'Nave Central',
      notes: consData.notes?.trim() || '',
      adjustments: consData.adjustments || [],
      createdAt: consData.createdAt || now,
      updatedAt: now,
    };

    setConsumables((prev) => {
      const exists = prev.some((c) => c.id === id);
      return exists ? prev.map((c) => (c.id === id ? fullConsumable : c)) : [fullConsumable, ...prev];
    });

    await persistDoc('consumables', id, fullConsumable);
    return fullConsumable;
  };

  const deleteConsumable = async (consumableId: string) => {
    setConsumables((prev) => prev.filter((c) => c.id !== consumableId));
    await removeDoc('consumables', consumableId);
  };

  const adjustConsumableQuantity = async (
    consumableId: string,
    type: 'consumed' | 'restocked',
    amount: number,
    notes?: string,
    eventName?: string
  ): Promise<ConsumableItem | null> => {
    const item = consumables.find((c) => c.id === consumableId);
    if (!item) return null;
    const cleanAmt = Math.max(1, Math.round(amount));
    const now = new Date().toISOString();

    const prevQty = item.currentQuantity;
    const newQty = type === 'restocked' ? prevQty + cleanAmt : Math.max(0, prevQty - cleanAmt);
    const needsBuying = newQty <= item.minStock;

    const adj: ConsumableAdjustment = {
      id: `cadj-${Date.now()}`,
      date: now,
      type,
      amount: cleanAmt,
      previousQuantity: prevQty,
      newQuantity: newQty,
      userName: userProfile?.name || 'Operario Almacén',
      eventName: eventName || undefined,
      notes:
        notes ||
        (type === 'consumed'
          ? `Consumo registrado (${prevQty} → ${newQty} ${item.unit})${needsBuying ? ' · AVISO: HAY QUE COMPRAR' : ''}`
          : `Reposición / compra recibida (+${cleanAmt} ${item.unit})`),
    };

    const updated: ConsumableItem = {
      ...item,
      currentQuantity: newQty,
      adjustments: [adj, ...(item.adjustments || [])],
      updatedAt: now,
    };

    setConsumables((prev) => prev.map((c) => (c.id === consumableId ? updated : c)));
    await persistDoc('consumables', consumableId, updated);

    await recordMovement({
      type: type === 'restocked' ? 'in' : 'adjustment',
      itemId: item.id,
      itemName: `${item.name} (Consumible)`,
      itemCode: item.code,
      quantity: cleanAmt,
      sourceLocation: item.locationName,
      targetLocation: type === 'consumed' ? (eventName || 'Consumo en Producción / Evento') : item.locationName,
      eventName: eventName || null,
      reason:
        type === 'consumed'
          ? `Gasto de ${cleanAmt} ${item.unit} de ${item.name} (${prevQty} → ${newQty}). ${
              needsBuying ? 'ALERTA: HAY QUE COMPRAR' : 'Stock suficiente'
            }`
          : `Reposición de +${cleanAmt} ${item.unit} de ${item.name} (${prevQty} → ${newQty})`,
      notes: notes || '',
      referenceCode: item.qrCode,
    });

    return updated;
  };

  // --- Backup Reminder & Full JSON Export / Restore ---
  const updateBackupConfig = (partial: Partial<BackupReminderConfig>) => {
    setBackupConfig((prev) => ({ ...prev, ...partial }));
  };

  const exportFullBackupJson = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const backupPayload = {
      app: 'JD Control de Stock',
      version: '2.0',
      exportedAt: now.toISOString(),
      exportedBy: userProfile?.email || 'admin@jdcontrol.es',
      data: {
        items,
        itemUnits,
        equipmentKits,
        cableBoxes,
        consumables,
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
        backupConfig,
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JD_Backup_Completo_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setBackupConfig((prev) => ({
      ...prev,
      lastBackupDate: now.toISOString(),
      snoozedUntil: null,
    }));
  };

  const exportContractsAndDispatchesArchive = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // 1. Download JSON archive of contracts & dispatches
    const archivePayload = {
      app: 'JD Control de Stock - Archivo de Contratos y Albaranes',
      exportedAt: now.toISOString(),
      contractsCount: contracts.length,
      dispatchesCount: dispatches.length,
      contracts,
      dispatches,
      companyFiscalConfig,
    };
    const blob = new Blob([JSON.stringify(archivePayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JD_Contratos_y_Albaranes_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Also export Excel workbook for physical PC viewing
    const wb = XLSX.utils.book_new();
    const contractRows = contracts.map((c) => ({
      CODIGO: c.code,
      TIPO: c.isGeneric ? 'Genérico / Libre' : 'Estándar',
      EVENTO: c.eventName,
      CLIENTE: c.clientName,
      CIF_CLIENTE: c.clientTaxId || '',
      FECHA_EVENTO: c.eventDate ? new Date(c.eventDate).toLocaleDateString('es-ES') : '',
      UBICACION: c.eventLocation,
      BASE_IMPONIBLE: c.subtotal,
      IVA: c.taxAmount,
      TOTAL_EUR: c.totalAmount,
      ESTADO: c.status,
      CONCEPTOS: c.items.map((i) => `[${i.section || i.category || 'General'}] ${i.quantity}x ${i.itemName} (${i.totalPrice}€)`).join(' | '),
    }));
    const dispatchRows = dispatches.map((d) => ({
      CODIGO_ALBARAN: d.code,
      CONTRATO: d.contractCode || '',
      EVENTO: d.eventName,
      CLIENTE: d.clientName,
      FECHA_SALIDA: d.dispatchDate ? new Date(d.dispatchDate).toLocaleDateString('es-ES') : '',
      ESTADO: d.status,
      FIRMADO_POR: d.signerName || 'Pendiente',
      MATERIAL_Y_VERIFICACION_QR: d.items
        .map((i) => `[${i.section || 'General'}] ${i.quantity}x ${i.itemName}${i.verifiedByQr ? ' (✓ QR: ' + (i.scannedQrCode || 'OK') + ')' : ''}`)
        .join(' | '),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contractRows.length ? contractRows : [{ INFO: 'Sin contratos' }]), 'Contratos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dispatchRows.length ? dispatchRows : [{ INFO: 'Sin albaranes' }]), 'Albaranes');
    XLSX.writeFile(wb, `JD_Contratos_y_Albaranes_${today}.xlsx`);
  };

  const restoreFullBackupJson = async (jsonText: string): Promise<{ restoredCollections: number }> => {
    const parsed = JSON.parse(jsonText);
    const data = parsed?.data || parsed;
    if (!data || typeof data !== 'object') {
      throw new Error('El archivo JSON no tiene un formato de copia de seguridad válido de JD Control de Stock.');
    }
    let count = 0;
    const syncRestored = async <T extends { id: string }>(colName: string, arr: T[]) => {
      await Promise.all(arr.filter((x) => x?.id).map((x) => persistDoc(colName, x.id, x)));
    };
    const syncTasks: Promise<void>[] = [];
    if (Array.isArray(data.items)) { setItems(data.items); syncTasks.push(syncRestored('items', data.items)); count++; }
    if (Array.isArray(data.itemUnits)) { setItemUnits(data.itemUnits); syncTasks.push(syncRestored('itemUnits', data.itemUnits)); count++; }
    if (Array.isArray(data.equipmentKits)) { setEquipmentKits(data.equipmentKits); syncTasks.push(syncRestored('equipmentKits', data.equipmentKits)); count++; }
    if (Array.isArray(data.cableBoxes)) { setCableBoxes(data.cableBoxes); syncTasks.push(syncRestored('cableBoxes', data.cableBoxes)); count++; }
    if (Array.isArray(data.consumables)) { setConsumables(data.consumables); syncTasks.push(syncRestored('consumables', data.consumables)); count++; }
    if (Array.isArray(data.categories)) { setCategories(data.categories); syncTasks.push(syncRestored('categories', data.categories)); count++; }
    if (Array.isArray(data.locations)) { setLocations(data.locations); syncTasks.push(syncRestored('locations', data.locations)); count++; }
    if (Array.isArray(data.events)) { setEvents(data.events); syncTasks.push(syncRestored('events', data.events)); count++; }
    if (Array.isArray(data.eventItems)) { setEventItems(data.eventItems); syncTasks.push(syncRestored('eventItems', data.eventItems)); count++; }
    if (Array.isArray(data.incidents)) { setIncidents(data.incidents); syncTasks.push(syncRestored('incidents', data.incidents)); count++; }
    if (Array.isArray(data.movements)) { setMovements(data.movements); syncTasks.push(syncRestored('movements', data.movements)); count++; }
    if (Array.isArray(data.clients)) { setClients(data.clients); syncTasks.push(syncRestored('clients', data.clients)); count++; }
    if (Array.isArray(data.suppliers)) { setSuppliers(data.suppliers); syncTasks.push(syncRestored('suppliers', data.suppliers)); count++; }
    if (Array.isArray(data.dispatches)) { setDispatches(data.dispatches); syncTasks.push(syncRestored('dispatches', data.dispatches)); count++; }
    if (Array.isArray(data.returns)) { setReturns(data.returns); syncTasks.push(syncRestored('returns', data.returns)); count++; }
    if (Array.isArray(data.purchases)) { setPurchases(data.purchases); syncTasks.push(syncRestored('purchases', data.purchases)); count++; }
    if (Array.isArray(data.inventorySessions)) { setInventorySessions(data.inventorySessions); syncTasks.push(syncRestored('inventorySessions', data.inventorySessions)); count++; }
    if (Array.isArray(data.contracts)) { setContracts(data.contracts); if (userProfile?.role === 'admin') syncTasks.push(syncRestored('contracts', data.contracts)); count++; }
    if (data.companyFiscalConfig) { setCompanyFiscalConfig(data.companyFiscalConfig); count++; }
    if (data.defaultBankDetails) { setDefaultBankDetails(data.defaultBankDetails); count++; }

    if (count === 0) {
      throw new Error('No se encontraron colecciones de datos reconocibles en el archivo JSON.');
    }
    await Promise.all(syncTasks);
    return { restoredCollections: count };
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

    await persistDoc('items', itemId, updatedItem);

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

    await persistDoc('itemUnits', id, newUnit);

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

    await persistDoc('categories', id, category);

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

    await persistDoc('locations', id, location);

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

    await persistDoc('events', id, fullEvent);

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
    await persistDoc('eventItems', lineId, updatedLine);

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
    await removeDoc('eventItems', eventItemId);

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
    await persistDoc('events', eventId, updated);

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
        const nowIso = new Date().toISOString();
        const updatedUnitsToSave: ItemUnit[] = [];
        setItemUnits((prevUnits) =>
          prevUnits.map((u) => {
            if (prep.unitSerialNumbers?.includes(u.serialNumber)) {
              const nextUnit: ItemUnit = {
                ...u,
                status: 'in_event',
                currentEventId: targetEvent.id,
                currentEventName: targetEvent.name,
                updatedAt: nowIso,
              };
              updatedUnitsToSave.push(nextUnit);
              return nextUnit;
            }
            return u;
          })
        );
        for (const u of itemUnits.filter((u) => prep.unitSerialNumbers?.includes(u.serialNumber))) {
          await persistDoc('itemUnits', u.id, {
            ...u,
            status: 'in_event',
            currentEventId: targetEvent.id,
            currentEventName: targetEvent.name,
            updatedAt: nowIso,
          });
        }
      }

      // Update item quantities
      const nowItemIso = new Date().toISOString();
      const nextOut = it.outQuantity + prep.quantity;
      const nextAvail = Math.max(0, it.totalQuantity - nextOut - it.damagedQuantity - it.reservedQuantity);
      const updatedItem: Item = {
        ...it,
        outQuantity: nextOut,
        availableQuantity: nextAvail,
        updatedAt: nowItemIso,
      };
      setItems((prevItems) => prevItems.map((i) => (i.id === it.id ? updatedItem : i)));
      await persistDoc('items', it.id, updatedItem);

      // Update eventItem line
      const matchedLine = eventItems.find((l) => l.eventId === eventId && l.itemId === prep.itemId);
      if (matchedLine) {
        const newDispatched = matchedLine.quantityDispatched + prep.quantity;
        const updatedLine: EventItem = {
          ...matchedLine,
          quantityDispatched: newDispatched,
          status: newDispatched >= matchedLine.quantityRequested ? 'dispatched' : 'partial',
        };
        setEventItems((prevLines) => prevLines.map((l) => (l.id === matchedLine.id ? updatedLine : l)));
        await persistDoc('eventItems', matchedLine.id, updatedLine);
      }

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

    await persistDoc('dispatches', dispatchNote.id, dispatchNote);
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
        const nowIso = new Date().toISOString();
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
                updatedAt: nowIso,
              };
            }
            return u;
          })
        );
        for (const u of itemUnits.filter((u) => ret.unitSerialNumbers?.includes(u.serialNumber))) {
          await persistDoc('itemUnits', u.id, {
            ...u,
            status: isDamaged ? 'damaged' : 'available',
            locationId: isDamaged ? 'loc-sat' : it.defaultLocationId,
            locationName: isDamaged ? 'Taller Técnico y Zona de Reparación' : it.defaultLocationName,
            currentEventId: null,
            currentEventName: null,
            notes: ret.incidentNotes || u.notes,
            updatedAt: nowIso,
          });
        }
      }

      // Update item quantities: reduce outQuantity, if damaged increase damagedQuantity
      const nowRetIso = new Date().toISOString();
      const newOut = Math.max(0, it.outQuantity - ret.quantity);
      const newDamaged = isDamaged ? it.damagedQuantity + ret.quantity : it.damagedQuantity;
      const newAvail = Math.max(0, it.totalQuantity - newOut - newDamaged - it.reservedQuantity);
      const updatedItem: Item = {
        ...it,
        outQuantity: newOut,
        damagedQuantity: newDamaged,
        availableQuantity: newAvail,
        updatedAt: nowRetIso,
      };
      setItems((prevItems) => prevItems.map((i) => (i.id === it.id ? updatedItem : i)));
      await persistDoc('items', it.id, updatedItem);

      // Update eventItem line
      const matchedLine = eventItems.find((l) => l.eventId === eventId && l.itemId === ret.itemId);
      if (matchedLine) {
        const newReturned = matchedLine.quantityReturned + ret.quantity;
        const newLineDamaged = isDamaged ? matchedLine.quantityDamaged + ret.quantity : matchedLine.quantityDamaged;
        const updatedLine: EventItem = {
          ...matchedLine,
          quantityReturned: newReturned,
          quantityDamaged: newLineDamaged,
          status: isDamaged ? 'returned_damaged' : newReturned >= matchedLine.quantityDispatched ? 'returned_ok' : 'partial',
        };
        setEventItems((prevLines) => prevLines.map((l) => (l.id === matchedLine.id ? updatedLine : l)));
        await persistDoc('eventItems', matchedLine.id, updatedLine);
      }

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
    await persistDoc('returns', returnNote.id, returnNote);
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
    await persistDoc('incidents', incident.id, incident);

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
    await persistDoc('incidents', incidentId, updatedInc);

    // If repaired, restore stock and unit status
    if (isRepaired && inc.status !== 'repaired' && inc.status !== 'closed') {
      const it = items.find((i) => i.id === inc.itemId);
      if (it) {
        const newDamaged = Math.max(0, it.damagedQuantity - 1);
        const newAvail = Math.max(0, it.totalQuantity - it.outQuantity - newDamaged - it.reservedQuantity);
        const updatedItem: Item = {
          ...it,
          damagedQuantity: newDamaged,
          availableQuantity: newAvail,
          updatedAt: now,
        };
        setItems((prev) => prev.map((item) => (item.id === it.id ? updatedItem : item)));
        await persistDoc('items', it.id, updatedItem);
      }

      if (inc.unitId) {
        const targetUnit = itemUnits.find((u) => u.id === inc.unitId);
        if (targetUnit) {
          const restoredUnit: ItemUnit = { ...targetUnit, status: 'available', updatedAt: now };
          setItemUnits((prev) => prev.map((u) => (u.id === inc.unitId ? restoredUnit : u)));
          await persistDoc('itemUnits', inc.unitId, restoredUnit);
        }
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
      const targetUnit = itemUnits.find((u) => u.id === unitId);
      if (targetUnit) {
        const updatedUnit: ItemUnit = {
          ...targetUnit,
          locationName: targetLoc,
          updatedAt: new Date().toISOString(),
        };
        setItemUnits((prev) => prev.map((u) => (u.id === unitId ? updatedUnit : u)));
        await persistDoc('itemUnits', unitId, updatedUnit);
      }
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
    await persistDoc('purchases', purchase.id, purchase);

    // Update item totalQuantity and stock
    for (const line of data.items) {
      const it = items.find((i) => i.id === line.itemId);
      if (it) {
        const updatedItem: Item = {
          ...it,
          totalQuantity: it.totalQuantity + line.quantity,
          availableQuantity: it.availableQuantity + line.quantity,
          updatedAt: now,
        };
        setItems((prev) => prev.map((item) => (item.id === it.id ? updatedItem : item)));
        await persistDoc('items', it.id, updatedItem);

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
    const existing = purchases.find((p) => p.id === purchaseId);
    if (!existing) return;
    const updatedPurchase: Purchase = {
      ...existing,
      deliveryNotePhotoUrl: photoUrl,
      ...(noteNumber ? { deliveryNoteNumber: noteNumber } : {}),
    };
    setPurchases((prev) => prev.map((p) => (p.id === purchaseId ? updatedPurchase : p)));
    await persistDoc('purchases', purchaseId, updatedPurchase);
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
    await persistDoc('inventorySessions', session.id, session);
    return session;
  };

  const saveInventoryCount = async (sessionId: string, lines: InventorySession['lines']) => {
    const existing = inventorySessions.find((s) => s.id === sessionId);
    if (!existing) return;
    const updatedSession: InventorySession = { ...existing, lines, status: 'pending_approval' };
    setInventorySessions((prev) => prev.map((s) => (s.id === sessionId ? updatedSession : s)));
    await persistDoc('inventorySessions', sessionId, updatedSession);
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
          const updatedItem: Item = {
            ...it,
            totalQuantity: Math.max(0, it.totalQuantity + diff),
            availableQuantity: Math.max(0, it.availableQuantity + diff),
            updatedAt: now,
          };
          setItems((prev) => prev.map((item) => (item.id === it.id ? updatedItem : item)));
          await persistDoc('items', it.id, updatedItem);

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

    const approvedSession: InventorySession = {
      ...session,
      status: 'approved',
      approvedBy: authorizedBy,
      completionDate: now,
    };
    setInventorySessions((prev) => prev.map((s) => (s.id === sessionId ? approvedSession : s)));
    await persistDoc('inventorySessions', sessionId, approvedSession);
  };

  // Clients & Suppliers — synced instantly in real time across Admin, Encargado & Técnico
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
    await persistDoc('clients', id, client);

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
    await persistDoc('suppliers', id, supplier);

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
      const baseDailyPrice =
        itm?.rentalPrice && itm.rentalPrice > 0
          ? itm.rentalPrice
          : itm?.purchasePrice
          ? Math.max(30, Math.round(itm.purchasePrice * 0.05))
          : 60;
      const unitPrice = baseDailyPrice;
      const totalPrice = unitPrice * line.quantityRequested * days;

      return {
        id: `ci-${Date.now()}-${idx}`,
        itemId: line.itemId,
        section: itm?.category?.toLowerCase().includes('ilumin') ? 'Iluminación' : itm?.category?.toLowerCase().includes('vídeo') || itm?.category?.toLowerCase().includes('video') ? 'Vídeo' : itm?.category?.toLowerCase().includes('truss') ? 'Estructuras / Truss' : itm?.category?.toLowerCase().includes('cable') ? 'Cableado' : 'Sonido',
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
    await persistDoc('contracts', newContract.id, newContract);

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
      await persistDoc('events', targetEvent.id, targetEvent);
    }

    // 2. Ensure Event Items exist so reservation is recorded
    if (contract.items && contract.items.length > 0) {
      const newEventLines: EventItem[] = [];
      contract.items.forEach((ci) => {
        const matchedItem = items.find(
          (i) => i.id === ci.itemId || i.name.toLowerCase() === ci.itemName.toLowerCase()
        );
        const itemId = matchedItem?.id || ci.itemId || `item-${Date.now()}`;
        const existing = eventItems.find((ei) => ei.eventId === targetEvent!.id && ei.itemId === itemId);
        if (!existing) {
          newEventLines.push({
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
      if (newEventLines.length > 0) {
        setEventItems((prev) => [...prev, ...newEventLines]);
        await Promise.all(newEventLines.map((line) => persistDoc('eventItems', line.id, line)));
      }
    }

    // 3. Automatically create or synchronize Dispatch Note (Albarán de Salida)
    const year = new Date().getFullYear();
    const dispatchCode = `ALB-OUT-${year}-${contract.code.replace('CTR-', '').padStart(3, '0')}`;
    const contractSections = contract.items.map((ci) => ({
      section: ci.section || ci.category || 'Sonido',
      description: ci.itemName,
      quantity: ci.quantity,
    }));

    const existingDisp = dispatches.find((d) => d.contractId === contract.id || d.contractCode === contract.code);
    if (existingDisp) {
      const updatedDisp: DispatchNote = { ...existingDisp, contractSections };
      setDispatches((prev) => prev.map((d) => (d.id === existingDisp.id ? updatedDisp : d)));
      await persistDoc('dispatches', updatedDisp.id, updatedDisp);
    } else {
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
        contractSections,
        notes: contract.isGeneric
          ? `Albarán vinculado a Contrato Genérico ${contract.code}. Escanea los códigos QR del material físico en cada apartado (ej. Sonido) para verificar la salida.`
          : `Albarán de salida generado automáticamente desde Contrato ${contract.code}. Material listo para verificación QR y salida.`,
        items: contract.isGeneric
          ? []
          : contract.items.map((ci) => {
              const matched = items.find(
                (i) => i.id === ci.itemId || i.name.toLowerCase() === ci.itemName.toLowerCase()
              );
              return {
                itemId: matched?.id || ci.itemId || `item-${ci.id}`,
                itemName: ci.itemName,
                itemCode: matched?.code || ci.itemCode || 'EQ-AV',
                quantity: ci.quantity,
                section: ci.section || ci.category || 'Sonido',
                unitSerialNumbers: [],
                verifiedByQr: false,
              };
            }),
        createdAt: now,
      };

      setDispatches((prev) => [newDispatch, ...prev]);
      await persistDoc('dispatches', newDispatch.id, newDispatch);
    }
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
      isGeneric: contractData.isGeneric,
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
    await persistDoc('contracts', id, contract);

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

    await persistDoc('contracts', contractId, updated);
  };

  const deleteContract = async (contractId: string): Promise<void> => {
    const target = contracts.find((c) => c.id === contractId);
    if (!target) return;
    const cancelledContract: Contract = { ...target, status: 'cancelled', updatedAt: new Date().toISOString() };
    setContracts((prev) => prev.map((c) => (c.id === contractId ? cancelledContract : c)));
    await persistDoc('contracts', contractId, cancelledContract);
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
    const existing = dispatches.find((d) => d.id === dispatchId);
    if (!existing) return;
    const signedDispatch: DispatchNote = {
      ...existing,
      clientSignatureUrl: signatureUrl,
      signerName,
      signerDni,
      signedAt: now,
      ...(driverSignatureUrl ? { driverSignatureUrl } : {}),
    };
    setDispatches((prev) => prev.map((d) => (d.id === dispatchId ? signedDispatch : d)));
    await persistDoc('dispatches', dispatchId, signedDispatch);
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
      const nowIso = new Date().toISOString();
      const newOut = Math.max(0, it.outQuantity - toRemove);
      const newAvail = Math.max(0, it.totalQuantity - newOut - it.damagedQuantity - it.reservedQuantity);
      const updatedItem: Item = { ...it, outQuantity: newOut, availableQuantity: newAvail, updatedAt: nowIso };
      setItems((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
      await persistDoc('items', itemId, updatedItem);

      // Restore serialized units status
      if (itemInDisp.unitSerialNumbers && itemInDisp.unitSerialNumbers.length > 0) {
        const freedSerials = itemInDisp.unitSerialNumbers.slice(remainingQty);
        setItemUnits((prevUnits) =>
          prevUnits.map((u) =>
            freedSerials.includes(u.serialNumber)
              ? { ...u, status: 'available', locationName: it.defaultLocationName, updatedAt: nowIso }
              : u
          )
        );
        for (const u of itemUnits.filter((u) => freedSerials.includes(u.serialNumber))) {
          await persistDoc('itemUnits', u.id, {
            ...u,
            status: 'available',
            locationName: it.defaultLocationName,
            updatedAt: nowIso,
          });
        }
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

    const updatedDisp: DispatchNote = { ...disp, items: newItems };
    setDispatches((prev) => prev.map((d) => (d.id === dispatchId ? updatedDisp : d)));
    await persistDoc('dispatches', dispatchId, updatedDisp);
  };

  const addItemToDispatch = async (
    dispatchId: string,
    extraItem: {
      itemId: string;
      itemName: string;
      itemCode: string;
      quantity: number;
      section?: string;
      unitSerialNumbers?: string[];
      verifiedByQr?: boolean;
      scannedQrCode?: string;
      kitId?: string;
      cableBoxId?: string;
      kitComponentsSummary?: string;
    }
  ): Promise<void> => {
    const disp = dispatches.find((d) => d.id === dispatchId);
    if (!disp) return;

    const now = new Date().toISOString();
    const it = items.find((i) => i.id === extraItem.itemId);

    if (it) {
      const availableToShip = it.totalQuantity - it.outQuantity - it.damagedQuantity;
      if (extraItem.quantity > availableToShip && !extraItem.verifiedByQr) {
        throw new Error(`Stock insuficiente para "${it.name}". Disponible en almacén: ${availableToShip}`);
      }

      const newOut = Math.min(it.totalQuantity, it.outQuantity + extraItem.quantity);
      const newAvail = Math.max(0, it.totalQuantity - newOut - it.damagedQuantity - it.reservedQuantity);
      const updatedItem: Item = { ...it, outQuantity: newOut, availableQuantity: newAvail, updatedAt: now };
      setItems((prev) => prev.map((item) => (item.id === extraItem.itemId ? updatedItem : item)));
      await persistDoc('items', extraItem.itemId, updatedItem);
    }

    if (extraItem.unitSerialNumbers && extraItem.unitSerialNumbers.length > 0) {
      setItemUnits((prevUnits) =>
        prevUnits.map((u) =>
          extraItem.unitSerialNumbers?.includes(u.serialNumber)
            ? { ...u, status: 'in_event', currentEventId: disp.eventId, currentEventName: disp.eventName, updatedAt: now }
            : u
        )
      );
      for (const u of itemUnits.filter((u) => extraItem.unitSerialNumbers?.includes(u.serialNumber))) {
        await persistDoc('itemUnits', u.id, {
          ...u,
          status: 'in_event',
          currentEventId: disp.eventId,
          currentEventName: disp.eventName,
          updatedAt: now,
        });
      }
    }

    const existingIndex = disp.items.findIndex(
      (i) => i.itemId === extraItem.itemId && (i.section || 'Sonido') === (extraItem.section || i.section || 'Sonido')
    );
    const updatedItems = [...disp.items];
    if (existingIndex >= 0) {
      const existing = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...existing,
        quantity: existing.quantity + extraItem.quantity,
        unitSerialNumbers: Array.from(
          new Set([...(existing.unitSerialNumbers || []), ...(extraItem.unitSerialNumbers || [])])
        ),
        verifiedByQr: extraItem.verifiedByQr || existing.verifiedByQr,
        verifiedAt: extraItem.verifiedByQr ? now : existing.verifiedAt,
        verifiedBy: extraItem.verifiedByQr ? userProfile?.name || 'Operario' : existing.verifiedBy,
        scannedQrCode: extraItem.scannedQrCode || existing.scannedQrCode,
      };
    } else {
      updatedItems.push({
        itemId: extraItem.itemId,
        itemName: extraItem.itemName,
        itemCode: extraItem.itemCode,
        quantity: extraItem.quantity,
        section: extraItem.section || 'Sonido',
        unitSerialNumbers: extraItem.unitSerialNumbers,
        verifiedByQr: extraItem.verifiedByQr,
        verifiedAt: extraItem.verifiedByQr ? now : undefined,
        verifiedBy: extraItem.verifiedByQr ? userProfile?.name || 'Operario' : undefined,
        scannedQrCode: extraItem.scannedQrCode,
        kitId: extraItem.kitId,
        cableBoxId: extraItem.cableBoxId,
        kitComponentsSummary: extraItem.kitComponentsSummary,
      });
    }

    await recordMovement({
      type: 'dispatch',
      itemId: extraItem.itemId,
      itemName: extraItem.itemName,
      itemCode: extraItem.itemCode,
      quantity: extraItem.quantity,
      sourceLocation: it?.defaultLocationName || 'Almacén Central',
      targetLocation: `Albarán ${disp.code} [${extraItem.section || 'General'}]`,
      eventId: disp.eventId,
      eventName: disp.eventName,
      reason: extraItem.verifiedByQr
        ? `Verificación de salida con QR (${extraItem.scannedQrCode || extraItem.itemCode}) en apartado ${extraItem.section || 'General'}`
        : `Material añadido al albarán ${disp.code}`,
      referenceCode: disp.code,
    });

    const updatedDisp: DispatchNote = {
      ...disp,
      items: updatedItems,
      preparedBy: userProfile?.name || disp.preparedBy,
    };
    setDispatches((prev) => prev.map((d) => (d.id === dispatchId ? updatedDisp : d)));
    await persistDoc('dispatches', dispatchId, updatedDisp);
  };

  // Scan QR code directly into a Dispatch Note Section (e.g., Apartado "Sonido") to verify physical exit
  const verifyDispatchLineByQr = async (
    dispatchId: string,
    section: string,
    rawQrCode: string
  ): Promise<{ label: string; kind: 'kit' | 'cable_box' | 'unit' | 'item' | 'custom' }> => {
    const disp = dispatches.find((d) => d.id === dispatchId);
    if (!disp) throw new Error('Albarán no encontrado');
    const cleanCode = rawQrCode.trim();
    if (!cleanCode) throw new Error('Código QR vacío');

    const match = findUnitOrItemByCode(cleanCode, itemUnits, items, equipmentKits, cableBoxes, contracts);
    const now = new Date().toISOString();

    if (match.kit) {
      const kit = match.kit;
      const summary = kit.components.map((c) => `${c.quantity}x ${c.name}`).join(' • ');
      await addItemToDispatch(dispatchId, {
        itemId: kit.id,
        itemName: `[QR CONJUNTO] ${kit.name}`,
        itemCode: kit.code,
        quantity: 1,
        section: section || kit.section || 'Sonido',
        verifiedByQr: true,
        scannedQrCode: kit.qrCode,
        kitId: kit.id,
        kitComponentsSummary: summary,
      });
      const updatedKit: EquipmentKit = {
        ...kit,
        status: 'in_event',
        currentEventId: disp.eventId,
        currentEventName: disp.eventName,
        updatedAt: now,
      };
      setEquipmentKits((prev) => prev.map((k) => (k.id === kit.id ? updatedKit : k)));
      await persistDoc('equipmentKits', kit.id, updatedKit);
      return { label: `${kit.name} (${kit.components.length} elementos)`, kind: 'kit' };
    }

    if (match.cableBox) {
      const box = match.cableBox;
      await addItemToDispatch(dispatchId, {
        itemId: box.id,
        itemName: `[CAJA CABLES] ${box.name} (${box.currentQuantity}/${box.initialQuantity} uds)`,
        itemCode: box.code,
        quantity: 1,
        section: section || box.section || 'Cableado',
        verifiedByQr: true,
        scannedQrCode: box.qrCode,
        cableBoxId: box.id,
        kitComponentsSummary: `${box.currentQuantity} cables ${box.cableType} (${box.cableLength || 'Estándar'})`,
      });
      const updatedBox: CableBox = { ...box, status: 'in_event', updatedAt: now };
      setCableBoxes((prev) => prev.map((b) => (b.id === box.id ? updatedBox : b)));
      await persistDoc('cableBoxes', box.id, updatedBox);
      return { label: `${box.name} — ${box.currentQuantity} cables`, kind: 'cable_box' };
    }

    if (match.unit) {
      const unit = match.unit;
      await addItemToDispatch(dispatchId, {
        itemId: unit.itemId,
        itemName: match.item?.name || unit.itemName,
        itemCode: unit.itemCode,
        quantity: 1,
        section: section || 'Sonido',
        unitSerialNumbers: [unit.serialNumber],
        verifiedByQr: true,
        scannedQrCode: unit.qrCode || unit.serialNumber,
      });
      return { label: `${unit.itemName} (N/S: ${unit.serialNumber})`, kind: 'unit' };
    }

    if (match.item) {
      const it = match.item;
      await addItemToDispatch(dispatchId, {
        itemId: it.id,
        itemName: it.name,
        itemCode: it.code,
        quantity: 1,
        section: section || 'Sonido',
        verifiedByQr: true,
        scannedQrCode: it.qrCode || it.code,
      });
      return { label: `${it.name} (${it.code})`, kind: 'item' };
    }

    // Raw/external QR code attached directly to the section
    await addItemToDispatch(dispatchId, {
      itemId: `qr-ext-${Date.now()}`,
      itemName: `Equipo verificado QR (${cleanCode})`,
      itemCode: cleanCode,
      quantity: 1,
      section: section || 'Sonido',
      verifiedByQr: true,
      scannedQrCode: cleanCode,
    });
    return { label: `QR ${cleanCode}`, kind: 'custom' };
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
    await persistDoc('incidents', incident.id, incident);

    const updatedItemFromPurchase: Item = {
      ...it,
      damagedQuantity: it.damagedQuantity + quantity,
      availableQuantity: Math.max(0, it.availableQuantity - quantity),
      updatedAt: now,
    };
    setItems((prev) => prev.map((item) => (item.id === it.id ? updatedItemFromPurchase : item)));
    await persistDoc('items', it.id, updatedItemFromPurchase);

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

  const reportDamageDirectly = async (data: {
    itemId: string;
    quantity: number;
    serialNumbers?: string[];
    description: string;
    sourceContext: 'dispatch' | 'return' | 'warehouse';
    referenceName?: string;
    priority?: Incident['priority'];
  }): Promise<Incident> => {
    const it = items.find((i) => i.id === data.itemId);
    if (!it) throw new Error('Artículo no encontrado');

    const code = `INC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const contextLabel =
      data.sourceContext === 'dispatch'
        ? `Salidas / Preparación (${data.referenceName || 'Albarán'})`
        : data.sourceContext === 'return'
        ? `Devolución / Entrada (${data.referenceName || 'Control Retorno'})`
        : `Control Almacén Central`;

    const incident: Incident = {
      id: `inc-${Date.now()}`,
      code,
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      serialNumber: data.serialNumbers && data.serialNumbers.length > 0 ? data.serialNumbers.join(', ') : undefined,
      description: `[Detectado en ${contextLabel}]: ${data.description}`,
      status: 'new',
      priority: data.priority || 'high',
      detectionDate: now,
      reportedBy: userProfile?.name || 'Operario de Almacén',
      estimatedCost: 120,
      history: [
        {
          date: now,
          user: userProfile?.name || 'Operario de Almacén',
          action: `Incidencia registrada desde ${contextLabel}`,
          notes: data.description,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setIncidents((prev) => [incident, ...prev]);
    await persistDoc('incidents', incident.id, incident);

    // Update item stock: increment damaged, decrement available (and out if during return)
    const updatedDamagedItem: Item = {
      ...it,
      damagedQuantity: it.damagedQuantity + data.quantity,
      availableQuantity: Math.max(0, it.availableQuantity - data.quantity),
      outQuantity: data.sourceContext === 'return' ? Math.max(0, it.outQuantity - data.quantity) : it.outQuantity,
      updatedAt: now,
    };
    setItems((prev) => prev.map((item) => (item.id === it.id ? updatedDamagedItem : item)));
    await persistDoc('items', it.id, updatedDamagedItem);

    // Update serialized units to damaged status if serials provided
    if (data.serialNumbers && data.serialNumbers.length > 0) {
      setItemUnits((prev) =>
        prev.map((u) =>
          data.serialNumbers?.includes(u.serialNumber)
            ? {
                ...u,
                status: 'damaged',
                locationName: 'Taller Técnico y SAT',
                notes: data.description,
                updatedAt: now,
              }
            : u
        )
      );
      for (const u of itemUnits.filter((u) => data.serialNumbers?.includes(u.serialNumber))) {
        await persistDoc('itemUnits', u.id, {
          ...u,
          status: 'damaged',
          locationName: 'Taller Técnico y SAT',
          notes: data.description,
          updatedAt: now,
        });
      }
    }

    // Register movement
    await recordMovement({
      type: 'repair_send',
      itemId: it.id,
      itemName: it.name,
      itemCode: it.code,
      quantity: data.quantity,
      sourceLocation: contextLabel,
      targetLocation: 'Taller Técnico y SAT',
      reason: `Envío directo a SAT por avería/rotura detectada: ${data.description}`,
      referenceCode: code,
    });

    return incident;
  };

  // Seed or Reset to Initial Realistic AV Data
  const seedInitialData = async () => {
    setItems(INITIAL_ITEMS);
    setItemUnits(INITIAL_UNITS);
    setEquipmentKits(INITIAL_EQUIPMENT_KITS);
    setCableBoxes(INITIAL_CABLE_BOXES);
    setConsumables(INITIAL_CONSUMABLES);
    setCategories(INITIAL_CATEGORIES);
    setLocations(INITIAL_LOCATIONS);
    setEvents(INITIAL_EVENTS);
    setEventItems(INITIAL_EVENT_ITEMS);
    setIncidents(INITIAL_INCIDENTS);
    setMovements(INITIAL_MOVEMENTS);
    setClients(INITIAL_CLIENTS);
    setSuppliers(INITIAL_SUPPLIERS);
    setDispatches(INITIAL_DISPATCHES);
    setReturns([]);
    setPurchases([]);
    setInventorySessions([]);
    setContracts(INITIAL_CONTRACTS);

    await Promise.all([
      ...INITIAL_ITEMS.map((item) => persistDoc('items', item.id, item)),
      ...INITIAL_UNITS.map((unit) => persistDoc('itemUnits', unit.id, unit)),
      ...INITIAL_CATEGORIES.map((cat) => persistDoc('categories', cat.id, cat)),
      ...INITIAL_LOCATIONS.map((loc) => persistDoc('locations', loc.id, loc)),
      ...INITIAL_CLIENTS.map((cli) => persistDoc('clients', cli.id, cli)),
      ...INITIAL_SUPPLIERS.map((sup) => persistDoc('suppliers', sup.id, sup)),
      ...INITIAL_EVENTS.map((ev) => persistDoc('events', ev.id, ev)),
      ...INITIAL_EVENT_ITEMS.map((ei) => persistDoc('eventItems', ei.id, ei)),
      ...INITIAL_DISPATCHES.map((dsp) => persistDoc('dispatches', dsp.id, dsp)),
      ...INITIAL_INCIDENTS.map((inc) => persistDoc('incidents', inc.id, inc)),
      ...INITIAL_MOVEMENTS.map((mov) => persistDoc('movements', mov.id, mov)),
      ...INITIAL_EQUIPMENT_KITS.map((kit) => persistDoc('equipmentKits', kit.id, kit)),
      ...INITIAL_CABLE_BOXES.map((box) => persistDoc('cableBoxes', box.id, box)),
      ...INITIAL_CONSUMABLES.map((cons) => persistDoc('consumables', cons.id, cons)),
      ...(userProfile?.role === 'admin' ? INITIAL_CONTRACTS.map((ctr) => persistDoc('contracts', ctr.id, ctr)) : []),
    ]);
  };

  // Clear all demo items, units, movements, contracts and events to start completely from 0
  const clearAllDemoData = async () => {
    setItems([]);
    setItemUnits([]);
    setEquipmentKits([]);
    setCableBoxes([]);
    setConsumables([]);
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

    localStorage.setItem('prompt_maestro_items', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_units', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_equipment_kits', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_cable_boxes', JSON.stringify([]));
    localStorage.setItem('prompt_maestro_consumables', JSON.stringify([]));
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

    try {
      const collectionsToClear = [
        'items',
        'itemUnits',
        'events',
        'eventItems',
        'dispatches',
        'returns',
        'incidents',
        'purchases',
        'inventorySessions',
        'clients',
        'suppliers',
        'equipmentKits',
        'cableBoxes',
        'consumables',
        ...(userProfile?.role === 'admin' ? ['contracts'] : []),
      ];
      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
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
        equipmentKits,
        cableBoxes,
        consumables,
        backupConfig,
        isBackupDue,
        companyFiscalConfig,
        defaultBankDetails,
        loading,
        isOfflineMode,

        saveItem,
        updateItemPrice,
        archiveItem,
        saveItemUnit,
        importItemsFromSpreadsheet,

        saveEquipmentKit,
        deleteEquipmentKit,
        saveCableBox,
        deleteCableBox,
        adjustCableBoxQuantity,
        saveConsumable,
        deleteConsumable,
        adjustConsumableQuantity,

        updateBackupConfig,
        exportFullBackupJson,
        exportContractsAndDispatchesArchive,
        restoreFullBackupJson,

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
        verifyDispatchLineByQr,

        createIncident,
        updateIncidentStatus,

        transferEquipment,
        registerPurchase,
        updatePurchaseDeliveryNote,
        reportDamageFromPurchase,
        reportDamageDirectly,

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
