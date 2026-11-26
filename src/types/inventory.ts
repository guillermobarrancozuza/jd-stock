export type UserRole = 'admin' | 'warehouse_manager' | 'technician' | 'pending';

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  provider?: 'password' | 'admin_credentials' | 'google';
  status?: 'active' | 'pending' | 'suspended';
  lastLogin?: string;
  assignedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ItemStatus = 'active' | 'archived';

export const AV_GROUPS = [
  'CABLEADO',
  'MICROFONÍA',
  'ETAPAS Y AMPLIFICACIÓN',
  'SONIDO P.A. Y MONITORES',
  'MESAS DE MEZCLAS',
  'ILUMINACIÓN Y ROBÓTICA',
  'CONTROL DE ILUMINACIÓN',
  'ESTRUCTURAS Y TRUSSES',
  'DISTRIBUCIÓN ELÉCTRICA',
  'VÍDEO Y PANTALLAS',
  'FLIGHT CASES Y TRANSPORTE',
  'HERRAMIENTAS Y ACCESORIOS',
  'CONSUMIBLES',
  'OTROS',
] as const;

export type AVGroup = (typeof AV_GROUPS)[number];

export interface Item {
  id: string;
  code: string; // e.g. "MIC-SM58-001"
  name: string;
  group: string; // 'CABLEADO', 'MICROFONÍA', 'ETAPAS...', etc.
  category: string;
  subcategory: string;
  brand: string;
  model: string;
  description: string;
  imageUrl?: string;
  barcode: string; // Auto-generated barcode string (e.g. "8437001928371")
  qrCode: string; // Auto-generated QR code string (e.g. "QR-MIC-SM58-001")
  unit: string; // 'Uds', 'Metros', 'Cajas', 'Kits'
  hasSerialNumbers: boolean;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  outQuantity: number;
  damagedQuantity: number;
  defaultLocationId: string;
  defaultLocationName: string;
  supplier?: string;
  purchasePrice?: number;
  rentalPrice?: number;
  acquisitionDate?: string;
  status: ItemStatus;
  minStock: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type UnitStatus = 'available' | 'reserved' | 'in_event' | 'damaged' | 'maintenance' | 'lost';

export interface ItemUnit {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  serialNumber: string;
  qrCode: string;
  locationId: string;
  locationName: string;
  status: UnitStatus;
  notes?: string;
  currentEventId?: string | null;
  currentEventName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  itemCount?: number;
}

export interface Location {
  id: string;
  warehouse: string;
  zone: string;
  description?: string;
  isRepairZone?: boolean;
}

export type EventStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'preparing'
  | 'prepared'
  | 'dispatched'
  | 'in_progress'
  | 'pending_return'
  | 'closed'
  | 'cancelled';

export interface EventItem {
  id: string;
  eventId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  brand?: string;
  quantityRequested: number;
  quantityDispatched: number;
  quantityReturned: number;
  quantityDamaged: number;
  assignedUnitIds?: string[];
  status: 'requested' | 'prepared' | 'dispatched' | 'returned_ok' | 'returned_damaged' | 'partial';
}

export interface AVEvent {
  id: string;
  code: string; // e.g. "EV-2026-001"
  name: string;
  clientId: string;
  clientName: string;
  location: string;
  address?: string;
  dispatchDate: string; // ISO datetime
  eventDate: string; // ISO datetime
  returnDate: string; // ISO datetime
  manager: string;
  status: EventStatus;
  notes?: string;
  items?: EventItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DispatchNote {
  id: string;
  code: string; // "ALB-OUT-2026-001"
  eventId: string;
  eventCode: string;
  eventName: string;
  clientName: string;
  preparedBy: string;
  authorizedBy: string;
  dispatchDate: string;
  status: 'draft' | 'preparing' | 'completed' | 'partial';
  contractId?: string;
  contractCode?: string;
  notes?: string;
  contractSections?: {
    section: string;
    description: string;
    quantity: number;
  }[];
  items: {
    itemId: string;
    itemName: string;
    itemCode: string;
    quantity: number;
    section?: string;
    unitSerialNumbers?: string[];
    verifiedByQr?: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    scannedQrCode?: string;
    kitId?: string;
    cableBoxId?: string;
    kitComponentsSummary?: string;
  }[];
  clientSignatureUrl?: string;
  signerName?: string;
  signerDni?: string;
  signedAt?: string;
  driverSignatureUrl?: string;
  createdAt: string;
}

export type ReturnCondition = 'good' | 'damaged' | 'incomplete' | 'review_pending';

export interface ReturnNote {
  id: string;
  code: string; // "DEV-2026-001"
  eventId: string;
  eventCode: string;
  eventName: string;
  receivedBy: string;
  returnDate: string;
  notes?: string;
  hasIncidents: boolean;
  items: {
    itemId: string;
    itemName: string;
    itemCode: string;
    quantityReturned: number;
    condition: ReturnCondition;
    unitSerialNumbers?: string[];
    incidentNotes?: string;
  }[];
  createdAt: string;
}

export type IncidentPriority = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus =
  | 'new'
  | 'in_review'
  | 'in_repair'
  | 'waiting_parts'
  | 'repaired'
  | 'unrepairable'
  | 'closed';

export interface Incident {
  id: string;
  code: string; // "INC-2026-001"
  itemId: string;
  itemName: string;
  itemCode?: string;
  unitId?: string | null;
  serialNumber?: string | null;
  detectionDate: string;
  reportedBy: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  description: string;
  technician?: string | null;
  technicalService?: string | null;
  estimatedCost?: number;
  appliedSolution?: string | null;
  sentToRepairDate?: string | null;
  returnedDate?: string | null;
  history?: {
    date: string;
    user: string;
    action: string;
    notes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'in' // Compra / entrada inicial
  | 'dispatch' // Salida para evento
  | 'return' // Devolución de evento
  | 'transfer' // Traslado de almacén/ubicación
  | 'adjustment' // Regularización de inventario
  | 'create' // Alta de artículo
  | 'archive' // Baja / archivado
  | 'repair_send' // Envío al SAT
  | 'repair_return' // Retorno de reparación
  | 'reserve' // Reserva para evento
  | 'cancel_reserve'; // Cancelación de reserva

export interface InventoryMovement {
  id: string;
  timestamp: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  sourceLocation: string;
  targetLocation: string;
  userId: string;
  userName: string;
  eventId?: string | null;
  eventName?: string | null;
  reason: string;
  notes?: string;
  referenceCode?: string;
}

export interface Client {
  id: string;
  name: string;
  taxId?: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  suppliedCategories: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseLine {
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Purchase {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  totalAmount: number;
  targetLocationId: string;
  targetLocationName: string;
  responsibleUser: string;
  notes?: string;
  deliveryNoteNumber?: string;
  deliveryNotePhotoUrl?: string;
  items: PurchaseLine[];
  createdAt: string;
}

export interface InventorySessionLine {
  itemId: string;
  itemName: string;
  itemCode: string;
  locationName: string;
  theoreticalQty: number;
  countedQty: number;
  discrepancy: number;
  reason?: string;
  regularized?: boolean;
}

export interface InventorySession {
  id: string;
  code: string;
  warehouse: string;
  status: 'in_progress' | 'pending_approval' | 'approved' | 'cancelled';
  startedBy: string;
  approvedBy?: string | null;
  startDate: string;
  completionDate?: string | null;
  lines: InventorySessionLine[];
  notes?: string;
}

export type ContractStatus = 'draft' | 'sent' | 'deposit_paid' | 'signed' | 'cancelled';

export const CONTRACT_SECTIONS = [
  'Sonido',
  'Iluminación',
  'Vídeo',
  'Estructuras / Truss',
  'Cableado',
  'Personal / Trabajo',
  'Transporte',
  'Otros',
] as const;

export type ContractSection = (typeof CONTRACT_SECTIONS)[number];

export interface ContractItem {
  id: string;
  itemId?: string;
  section?: string;
  itemName: string;
  itemCode?: string;
  category?: string;
  quantity: number;
  unitPrice: number;
  days?: number;
  totalPrice: number;
}

export interface BankPaymentDetails {
  bankName: string;
  accountHolder: string;
  iban: string;
  bic: string;
  bizumPhone: string;
  hasBizum?: boolean;
  paymentConcept: string;
}

export interface CompanyFiscalConfig {
  companyName: string;
  tradeName: string;
  cif: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  termsAndConditions: string[];
}

export interface Contract {
  id: string;
  code: string; // e.g. "CTR-2026-001"
  isGeneric?: boolean;
  eventId?: string;
  eventName: string;
  eventDate: string;
  returnDate?: string;
  eventLocation: string;
  clientId: string;
  clientName: string;
  clientTaxId?: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress?: string;
  items: ContractItem[];
  subtotal: number;
  taxRate: number; // e.g. 21%
  taxAmount: number;
  totalAmount: number;
  depositRate: number; // 10%
  depositAmount: number; // 10% of totalAmount
  remainingAmount: number; // 90% of totalAmount
  status: ContractStatus;
  paymentMethod: 'bank_transfer' | 'bizum';
  paymentType?: 'deposit_10' | 'full_payment';
  paidAmount?: number;
  bankDetails: BankPaymentDetails;
  depositPaidAt?: string | null;
  depositReference?: string | null;
  notes?: string;
  clauses?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KitComponent {
  id: string;
  itemId?: string;
  itemCode?: string;
  name: string;
  quantity: number;
  notes?: string;
}

export interface EquipmentKit {
  id: string;
  code: string;
  name: string;
  section: string;
  qrCode: string;
  description?: string;
  locationName: string;
  rentalPrice?: number;
  status: 'available' | 'in_event' | 'maintenance';
  currentEventId?: string | null;
  currentEventName?: string | null;
  components: KitComponent[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CableBoxAdjustment {
  id: string;
  date: string;
  type: 'broken' | 'lost' | 'restocked';
  amount: number;
  previousQuantity: number;
  newQuantity: number;
  userName: string;
  eventName?: string;
  notes?: string;
}

export interface CableBox {
  id: string;
  code: string;
  name: string;
  cableType: string;
  cableLength?: string;
  qrCode: string;
  linkedItemId?: string;
  initialQuantity: number;
  currentQuantity: number;
  brokenCount: number;
  lostCount: number;
  locationName: string;
  section: string;
  status: 'available' | 'in_event' | 'incomplete';
  notes?: string;
  adjustments: CableBoxAdjustment[];
  createdAt: string;
  updatedAt: string;
}

export interface ConsumableAdjustment {
  id: string;
  date: string;
  type: 'consumed' | 'restocked';
  amount: number;
  previousQuantity: number;
  newQuantity: number;
  userName: string;
  eventName?: string;
  notes?: string;
}

export interface ConsumableItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  qrCode: string;
  currentQuantity: number;
  minStock: number;
  recommendedOrderQty?: number;
  supplier?: string;
  locationName: string;
  notes?: string;
  adjustments: ConsumableAdjustment[];
  createdAt: string;
  updatedAt: string;
}

export const CONSUMABLE_CATEGORIES = [
  'Humo / Efectos',
  'Cintas',
  'Pilas / Baterías',
  'Lámparas / Fusibles',
  'Limpieza',
  'Otros',
] as const;

export const CONSUMABLE_UNITS = [
  'Garrafas 5L',
  'Litros',
  'Rollos',
  'Unidades',
  'Cajas',
  'Botes',
  'Packs',
] as const;

export interface BackupReminderConfig {
  enabled: boolean;
  intervalMonths: number;
  adminEmail: string;
  lastBackupDate: string | null;
  lastReminderSentDate: string | null;
  snoozedUntil?: string | null;
}

export type QrStickerSize = 'micro_20x20' | 'flycase_17x7' | 'truss_6x6';
