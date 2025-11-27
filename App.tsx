import React, { useState, useEffect } from 'react';
import Reception from './components/Reception';
import Layout from './components/Layout';
import Configuration from './components/Configuration';
import InventoryList from './components/InventoryList';
import { InventoryItem, Rack, Zone, ViewState, Slot, RackLocation, Product } from './types';
import { Package, LayoutGrid, ArrowDownToLine, Settings, ClipboardList } from './components/Icons';
import { generateLPN } from './utils';

// Initial Data Helper
const createSlots = (aisle: string, rackId: number, levels: number, positions: number): Slot[] => {
    const slots: Slot[] = [];
    for (let l = 1; l <= levels; l++) {
        for (let p = 1; p <= positions; p++) {
            slots.push({
                id: `${aisle}${rackId}-${l}-${p}`,
                location: { aisle, rackId, level: l, position: p },
                status: 'empty',
                isBlocked: false
            });
        }
    }
    return slots;
};

const INITIAL_ZONES: Zone[] = [
    { id: 'zone-1', name: 'Cámara Seca A', type: 'DRY' },
    { id: 'zone-2', name: 'Cámara Refrigerada', type: 'COLD' },
];

const INITIAL_RACKS: Rack[] = [
  { id: 1, zoneId: 'zone-1', aisle: 'A', levels: 6, positionsPerLevel: 9, slots: createSlots('A', 1, 6, 9) },
  { id: 2, zoneId: 'zone-1', aisle: 'A', levels: 6, positionsPerLevel: 9, slots: createSlots('A', 2, 6, 9) },
  { id: 3, zoneId: 'zone-1', aisle: 'B', levels: 6, positionsPerLevel: 9, slots: createSlots('B', 3, 6, 9) },
  { id: 4, zoneId: 'zone-2', aisle: 'C', levels: 5, positionsPerLevel: 8, slots: createSlots('C', 4, 5, 8) }, 
];

const INITIAL_CATALOG: Product[] = [
    { id: '1', code: '7751234567890', name: 'Arroz Extra Costeño 5kg', category: 'Granos', defaultZoneType: 'DRY' },
    { id: '2', code: '7759876543210', name: 'Leche Gloria Azul 400g', category: 'Lácteos', defaultZoneType: 'DRY' },
    { id: '3', code: '7755555555555', name: 'Filete Atún Florida', category: 'Conservas', defaultZoneType: 'DRY' },
    { id: '4', code: '7751111111111', name: 'Aceite Primor Premium 1L', category: 'Aceites', defaultZoneType: 'DRY' },
    { id: '5', code: '7752222222222', name: 'Fideos Don Vittorio Spaghetti', category: 'Pastas', defaultZoneType: 'DRY' },
    { id: '6', code: '7753333333333', name: 'Galleta Soda San Jorge Pqt', category: 'Snacks', defaultZoneType: 'DRY' },
    { id: '7', code: '7756666666666', name: 'Yogurt Fresa 1L', category: 'Lácteos', defaultZoneType: 'COLD' },
    { id: '8', code: '7757777777777', name: 'Mantequilla Laive 200g', category: 'Lácteos', defaultZoneType: 'COLD' },
    { id: '9', code: '7758888888888', name: 'Hamburguesa San Fernando', category: 'Congelados', defaultZoneType: 'FROZEN' },
    { id: '10', code: '7759999999999', name: 'Helado D\'Onofrio Tricolor', category: 'Congelados', defaultZoneType: 'FROZEN' },
];

// Helper to generate a lot of dummy data for "Inventory" module
const generateDummyInventory = (): InventoryItem[] => {
    const items: InventoryItem[] = [
        { lpn: "24112600000001", productCode: "7751234567890", productName: "Arroz Extra Costeño 5kg", quantity: 50, expirationDate: "2025-12-01", receptionDate: "2024-01-15T10:00:00.000Z", receivedBy: "Operador 01", qrCodeUrl: "", location: { aisle: 'A', rackId: 1, level: 1, position: 1 } },
        { lpn: "24112600000002", productCode: "7751234567890", productName: "Arroz Extra Costeño 5kg", quantity: 50, expirationDate: "2025-12-01", receptionDate: "2024-01-15T10:05:00.000Z", receivedBy: "Operador 01", qrCodeUrl: "", location: { aisle: 'A', rackId: 1, level: 1, position: 2 } },
        { lpn: "25112600000026", productCode: "TEST-001", productName: "Producto de Prueba", quantity: 100, expirationDate: "2025-12-31", receptionDate: new Date().toISOString(), receivedBy: "Tester", qrCodeUrl: "", location: null },
    ];

    // Generate ~50 more items, some with near expiration dates
    const now = new Date();
    for(let i = 0; i < 50; i++) {
        const product = INITIAL_CATALOG[i % INITIAL_CATALOG.length];
        const isExpiringSoon = i % 10 === 0; // Every 10th item expires soon
        
        const expDate = new Date();
        if (isExpiringSoon) {
            expDate.setDate(now.getDate() + Math.floor(Math.random() * 5)); // 0-5 days
        } else {
            expDate.setDate(now.getDate() + 30 + Math.floor(Math.random() * 300));
        }

        const lpn = generateLPN(100 + i);
        
        items.push({
            lpn,
            productCode: product.code,
            productName: product.name,
            quantity: Math.floor(Math.random() * 100) + 1,
            expirationDate: expDate.toISOString().split('T')[0],
            receptionDate: new Date().toISOString(),
            receivedBy: 'System',
            qrCodeUrl: '',
            location: i < 30 ? { aisle: 'A', rackId: 1, level: (i % 6) + 1, position: (i % 9) + 1 } : null
        });
    }
    return items;
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.RECEPTION);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [sequenceCounter, setSequenceCounter] = useState(25);
  const [catalog, setCatalog] = useState<Product[]>(INITIAL_CATALOG);

  // Load from local storage or init
  useEffect(() => {
    const savedInv = localStorage.getItem('smartwms_inventory');
    const savedSeq = localStorage.getItem('smartwms_sequence');
    const savedRacks = localStorage.getItem('smartwms_racks');
    const savedZones = localStorage.getItem('smartwms_zones');
    
    // Only use initial dummy data if local storage is empty
    setInventory(savedInv ? JSON.parse(savedInv) : generateDummyInventory());
    setSequenceCounter(savedSeq ? parseInt(savedSeq) : 150);
    setRacks(savedRacks ? JSON.parse(savedRacks) : INITIAL_RACKS);
    setZones(savedZones ? JSON.parse(savedZones) : INITIAL_ZONES);
  }, []);

  useEffect(() => {
    localStorage.setItem('smartwms_inventory', JSON.stringify(inventory));
    localStorage.setItem('smartwms_sequence', sequenceCounter.toString());
    localStorage.setItem('smartwms_racks', JSON.stringify(racks));
    localStorage.setItem('smartwms_zones', JSON.stringify(zones));
  }, [inventory, sequenceCounter, racks, zones]);

  const handleReceive = (item: InventoryItem) => {
    setInventory(prev => [...prev, item]);
    setSequenceCounter(prev => prev + 1);
    // Stay in reception view so user can keep scanning
  };

  const handleAssignLocation = (lpn: string, location: RackLocation) => {
    setInventory(prev => prev.map(item => {
      if (item.lpn === lpn) return { ...item, location };
      return item;
    }));
  };

  const handleDispatch = (lpn: string) => {
    setInventory(prev => prev.filter(item => item.lpn !== lpn));
  };

  const handleUpdateItem = (lpn: string, updates: Partial<InventoryItem>) => {
      setInventory(prev => prev.map(item => {
          if (item.lpn === lpn) return { ...item, ...updates };
          return item;
      }));
  };

  // --- Bulk Deletion of Pending Items (Correction) ---
  const handleDeleteInventoryItems = (lpns: string[]) => {
      setInventory(prev => prev.filter(item => !lpns.includes(item.lpn)));
  };

  // --- Bulk Dispatch (Cross-docking / Sold items) ---
  const handleBulkDispatch = (lpns: string[]) => {
      // Logic is similar to delete, but conceptually distinct for future logging
      setInventory(prev => prev.filter(item => !lpns.includes(item.lpn)));
  };

  // --- Configuration Handlers ---
  const handleAddZone = (newZone: Zone) => {
    setZones(prev => [...prev, newZone]);
  };

  const handleDeleteZone = (zoneId: string) => {
      setZones(prev => prev.filter(z => z.id !== zoneId));
      setRacks(prev => prev.filter(r => r.zoneId !== zoneId)); // Cascade delete racks
  };

  const handleAddRack = (newRack: Rack) => {
      setRacks(prev => [...prev, newRack]);
  };

  const handleDeleteRack = (rackId: number) => {
      setRacks(prev => prev.filter(r => r.id !== rackId));
  };

  const handleToggleBlockSlot = (rackId: number, level: number, position: number) => {
      setRacks(prev => prev.map(rack => {
          if (rack.id !== rackId) return rack;
          return {
              ...rack,
              slots: rack.slots.map(slot => {
                  if (slot.location.level === level && slot.location.position === position) {
                      return { ...slot, isBlocked: !slot.isBlocked };
                  }
                  return slot;
              })
          };
      }));
  };

  const itemsPending = inventory.filter(i => i.location === null);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 pb-16 md:pb-0">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded">
               <Package className="w-6 h-6 text-white"/>
             </div>
             <div>
               <h1 className="text-xl font-bold tracking-tight">SmartRack WMS</h1>
               <span className="text-xs text-slate-400">Control de Almacén v2.6</span>
             </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-300">
             <span className="hidden md:inline">Usuario: <strong>Operador 01</strong></span>
             <div className="h-4 w-px bg-slate-700 hidden md:block"></div>
             <button 
                onClick={() => setView(ViewState.CONFIGURATION)}
                className="hover:text-white transition-colors flex items-center gap-1 hidden md:flex"
             >
                 <Settings className="w-4 h-4"/>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row max-w-full mx-auto w-full p-2 md:p-6 gap-6 no-print overflow-hidden h-[calc(100vh-64px)]">
        
        {/* Navigation Sidebar (Desktop Only) */}
        <aside className="w-64 flex-shrink-0 flex-col gap-2 hidden md:flex">
            <button 
                onClick={() => setView(ViewState.RECEPTION)}
                className={`flex items-center gap-3 p-4 rounded-lg font-medium transition-all ${view === ViewState.RECEPTION ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
                <ArrowDownToLine className="w-5 h-5" />
                Recepción
                {itemsPending.length > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {itemsPending.length}
                    </span>
                )}
            </button>
            <button 
                onClick={() => setView(ViewState.LAYOUT)}
                className={`flex items-center gap-3 p-4 rounded-lg font-medium transition-all ${view === ViewState.LAYOUT ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
                <LayoutGrid className="w-5 h-5" />
                Layout & Almacenaje
            </button>
            <button 
                onClick={() => setView(ViewState.INVENTORY)}
                className={`flex items-center gap-3 p-4 rounded-lg font-medium transition-all ${view === ViewState.INVENTORY ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
                <ClipboardList className="w-5 h-5" />
                Inventario & Auditoría
            </button>
            <button 
                onClick={() => setView(ViewState.CONFIGURATION)}
                className={`flex items-center gap-3 p-4 rounded-lg font-medium transition-all ${view === ViewState.CONFIGURATION ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-100' : 'text-slate-600 hover:bg-white/50'}`}
            >
                <Settings className="w-5 h-5" />
                Configuración
            </button>
        </aside>

        {/* Dynamic View Container */}
        <section className="flex-1 min-w-0 overflow-y-auto h-full pb-20 md:pb-0">
            {view === ViewState.RECEPTION && (
                <div className="animate-fade-in h-full">
                    <Reception 
                        onReceive={handleReceive} 
                        lastSequence={sequenceCounter} 
                        pendingItems={itemsPending}
                        catalog={catalog}
                        currentInventory={inventory}
                        onDeleteItems={handleDeleteInventoryItems}
                        onBulkDispatch={handleBulkDispatch}
                    />
                </div>
            )}

            {view === ViewState.LAYOUT && (
                <div className="animate-fade-in h-full">
                    <Layout 
                        inventory={inventory}
                        racks={racks}
                        zones={zones}
                        onAssignLocation={handleAssignLocation}
                        onDispatch={handleDispatch}
                        itemsPendingLocation={itemsPending}
                    />
                </div>
            )}

            {view === ViewState.INVENTORY && (
                <div className="animate-fade-in h-full">
                    <InventoryList 
                        inventory={inventory}
                        onUpdateItem={handleUpdateItem}
                        catalog={catalog}
                        onAddInventory={handleReceive}
                        nextSequence={sequenceCounter}
                        pendingItemsCount={itemsPending.length}
                    />
                </div>
            )}

            {view === ViewState.CONFIGURATION && (
                <div className="animate-fade-in h-full">
                    <Configuration 
                        zones={zones}
                        racks={racks}
                        onAddZone={handleAddZone}
                        onDeleteZone={handleDeleteZone}
                        onAddRack={handleAddRack}
                        onDeleteRack={handleDeleteRack}
                        onToggleBlockSlot={handleToggleBlockSlot}
                    />
                </div>
            )}
        </section>
      </main>

      {/* Mobile Bottom Navigation (Visible only on mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around p-2 shadow-lg safe-area-bottom">
            <button 
                onClick={() => setView(ViewState.RECEPTION)}
                className={`flex flex-col items-center p-2 rounded-lg ${view === ViewState.RECEPTION ? 'text-blue-600' : 'text-gray-400'}`}
            >
                <div className="relative">
                    <ArrowDownToLine className="w-6 h-6" />
                    {itemsPending.length > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-white"></span>}
                </div>
                <span className="text-[10px] font-bold mt-1">Recepción</span>
            </button>
            <button 
                onClick={() => setView(ViewState.LAYOUT)}
                className={`flex flex-col items-center p-2 rounded-lg ${view === ViewState.LAYOUT ? 'text-blue-600' : 'text-gray-400'}`}
            >
                <LayoutGrid className="w-6 h-6" />
                <span className="text-[10px] font-bold mt-1">Layout</span>
            </button>
            <button 
                onClick={() => setView(ViewState.INVENTORY)}
                className={`flex flex-col items-center p-2 rounded-lg ${view === ViewState.INVENTORY ? 'text-blue-600' : 'text-gray-400'}`}
            >
                <ClipboardList className="w-6 h-6" />
                <span className="text-[10px] font-bold mt-1">Inventario</span>
            </button>
            <button 
                onClick={() => setView(ViewState.CONFIGURATION)}
                className={`flex flex-col items-center p-2 rounded-lg ${view === ViewState.CONFIGURATION ? 'text-blue-600' : 'text-gray-400'}`}
            >
                <Settings className="w-6 h-6" />
                <span className="text-[10px] font-bold mt-1">Config</span>
            </button>
      </nav>
    </div>
  );
};

export default App;