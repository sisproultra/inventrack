
export interface Product {
  id: string;
  name: string;
  code: string; // SKU or EAN
  category: string;
  defaultZoneType?: ZoneType; // New: To categorize catalog items for stocktaking
}

export interface MixedItem {
    productCode: string;
    productName: string;
    quantity: number;
    expirationDate: string;
}

export interface Pallet {
  lpn: string; // The License Plate Number (YYMMDD + Correlative)
  productCode: string;
  productName: string;
  quantity: number; // New: Quantity of items in the pallet/box
  expirationDate: string;
  receptionDate: string; // ISO string with time
  receivedBy: string; // New: User who received it
  qrCodeUrl: string;
  photos?: string[]; // New: Array of photo URLs (base64) - replaces single photoUrl
  photoUrl?: string; // Deprecated
  isMixed?: boolean; // New: Flag for mixed pallets
  mixedItems?: MixedItem[]; // New: Content of mixed pallets
}

export interface RackLocation {
  aisle: string;
  rackId: number;
  level: number;
  position: number;
}

export interface InventoryItem extends Pallet {
  location: RackLocation | null;
}

// Visual representation types
export interface Slot {
  id: string; // e.g., "A-1-1-1" (Aisle-Rack-Level-Pos)
  location: RackLocation;
  status: 'empty' | 'occupied';
  isBlocked: boolean; // New: For blocked/maintenance locations
  pallet?: InventoryItem;
}

export type ZoneType = 'DRY' | 'COLD' | 'FROZEN';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  temperature?: string;
}

export interface Rack {
  id: number;
  zoneId: string; // New: Link rack to a zone/chamber
  aisle: string;
  levels: number;
  positionsPerLevel: number;
  slots: Slot[]; // In a real DB this might be separate, but here we embed config per slot if needed
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  RECEPTION = 'RECEPTION',
  LAYOUT = 'LAYOUT',
  INVENTORY = 'INVENTORY',
  DISPATCH = 'DISPATCH',
  CONFIGURATION = 'CONFIGURATION'
}