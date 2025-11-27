
import React, { useState, useEffect } from 'react';
import { InventoryItem, Product, ZoneType } from '../types';
import { Search, AlertTriangle, Camera, CheckCircle, Package, ClipboardList, PlusCircle, History, ArrowDownToLine, FileSpreadsheet, Sun, Snowflake, XCircle, Trash } from './Icons';
import { generateLPN } from '../utils';

interface InventoryListProps {
  inventory: InventoryItem[];
  onUpdateItem: (lpn: string, updates: Partial<InventoryItem>) => void;
  catalog: Product[];
  onAddInventory: (item: InventoryItem) => void;
  nextSequence: number;
  pendingItemsCount: number;
}

const InventoryList: React.FC<InventoryListProps> = ({ 
    inventory, 
    onUpdateItem, 
    catalog,
    onAddInventory,
    nextSequence,
    pendingItemsCount
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'COUNT'>('LIST');
  const [searchTerm, setSearchTerm] = useState('');
  
  // -- Stocktake State --
  const [countProduct, setCountProduct] = useState<Product | null>(null);
  const [countSearch, setCountSearch] = useState('');
  const [countQty, setCountQty] = useState<string>('');
  const [countDate, setCountDate] = useState('');
  const [sessionHistory, setSessionHistory] = useState<InventoryItem[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);

  // Missing Modal State
  const [missingModalZone, setMissingModalZone] = useState<ZoneType | null>(null);

  // Photo Modal State
  const [photoItemLPN, setPhotoItemLPN] = useState<string | null>(null);
  
  // Check expiration immediately on input
  useEffect(() => {
    if (countDate) {
        const today = new Date();
        const exp = new Date(countDate);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 5) {
            setExpiryWarning("⚠️ ¡Atención! Este producto vence en menos de 5 días (o ya venció). Debe ser retirado, pero se permitirá el registro.");
        } else {
            setExpiryWarning(null);
        }
    } else {
        setExpiryWarning(null);
    }
  }, [countDate]);

  // Calculate expiration status for list view
  const getExpirationStatus = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'EXPIRED', color: 'bg-red-100 text-red-800 border-red-200', days: diffDays };
    if (diffDays <= 5) return { status: 'WARNING', color: 'bg-orange-100 text-orange-800 border-orange-200', days: diffDays };
    return { status: 'OK', color: 'bg-green-100 text-green-800 border-green-200', days: diffDays };
  };

  const filteredInventory = inventory.filter(item => 
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lpn.includes(searchTerm) ||
    item.productCode.includes(searchTerm)
  );

  const filteredCatalog = catalog.filter(p => 
     p.name.toLowerCase().includes(countSearch.toLowerCase()) || 
     p.code.includes(countSearch)
  );

  // --- PHOTO HANDLING ---
  const handleAddPhoto = (lpn: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const item = inventory.find(i => i.lpn === lpn);
          if(!item) return;

          const currentPhotos = item.photos || (item.photoUrl ? [item.photoUrl] : []);
          
          if(currentPhotos.length >= 5) {
              alert("Máximo 5 fotos permitidas por producto.");
              return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
              const newPhoto = reader.result as string;
              onUpdateItem(lpn, { photos: [...currentPhotos, newPhoto] });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeletePhoto = (lpn: string, index: number) => {
      const item = inventory.find(i => i.lpn === lpn);
      if(!item) return;
      const currentPhotos = item.photos || (item.photoUrl ? [item.photoUrl] : []);
      
      const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
      onUpdateItem(lpn, { photos: updatedPhotos });
  };

  const handleStocktakeSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!countProduct || !countQty || !countDate) return;

      const newLPN = generateLPN(nextSequence); 
      
      const newItem: InventoryItem = {
          lpn: newLPN,
          productCode: countProduct.code,
          productName: countProduct.name,
          quantity: parseInt(countQty),
          expirationDate: countDate,
          receptionDate: new Date().toISOString(),
          receivedBy: 'Auditor',
          qrCodeUrl: '',
          location: null, // Enters as pending
          photos: []
      };

      onAddInventory(newItem);
      setSessionHistory(prev => [newItem, ...prev]);
      
      setSuccessMsg(`Registrado y enviado a Pendientes`);
      setTimeout(() => setSuccessMsg(null), 3000);

      setCountQty('');
      setCountDate('');
      setExpiryWarning(null);
  };

  const handleExportInventory = () => {
      // Headers
      const headers = ['EAN', 'NOMBRE', 'CANTIDAD', 'FECHA DE VENCIMIENTO'];
      const csvRows = [headers.join(',')];

      for(const item of inventory) {
          const row = [
              item.productCode,
              `"${item.productName.replace(/"/g, '""')}"`,
              item.quantity,
              item.expirationDate
          ];
          csvRows.push(row.join(','));
      }

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `inventario_completo_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- STATS LOGIC ---
  const getZoneStats = (type: ZoneType) => {
      const zoneProducts = catalog.filter(p => p.defaultZoneType === type);
      const totalCatalog = zoneProducts.length;
      
      // Found codes in inventory for this zone type
      const inventoryCodes = new Set(inventory.map(i => i.productCode));
      
      const foundCount = zoneProducts.filter(p => inventoryCodes.has(p.code)).length;
      const missingCount = totalCatalog - foundCount;
      const missingItems = zoneProducts.filter(p => !inventoryCodes.has(p.code));

      return { totalCatalog, foundCount, missingCount, missingItems };
  };

  const statsDry = getZoneStats('DRY');
  const statsCold = getZoneStats('COLD');
  const statsFrozen = getZoneStats('FROZEN');

  const photoModalItem = photoItemLPN ? inventory.find(i => i.lpn === photoItemLPN) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50">
        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200 px-4 pt-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
            <div className="flex gap-4">
                <button
                    onClick={() => setActiveTab('LIST')}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'LIST' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Listado General
                </button>
                <button
                    onClick={() => setActiveTab('COUNT')}
                    className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'COUNT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ClipboardList className="w-4 h-4"/>
                    Toma de Inventario
                </button>
            </div>
            
            {activeTab === 'LIST' && (
                <button 
                    onClick={handleExportInventory}
                    className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 mb-2"
                >
                    <FileSpreadsheet className="w-4 h-4"/> Exportar Excel
                </button>
            )}
        </div>

        {/* --- VIEW: STOCK LIST --- */}
        {activeTab === 'LIST' && (
            <>
                <div className="bg-white p-4 shadow-sm border-b border-gray-200">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar por LPN, Nombre, SKU..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5"/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2">
                    {filteredInventory.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">
                            No se encontraron productos.
                        </div>
                    ) : (
                        filteredInventory.map(item => {
                            const expStatus = getExpirationStatus(item.expirationDate);
                            const hasPhotos = (item.photos && item.photos.length > 0) || !!item.photoUrl;
                            const photosCount = (item.photos?.length || 0) + (item.photoUrl && !item.photos ? 1 : 0);
                            
                            return (
                                <div key={item.lpn} className={`bg-white rounded-lg shadow-sm border p-3 flex flex-col gap-2 ${expStatus.status !== 'OK' ? 'border-red-300' : 'border-gray-200'}`}>
                                    {/* Header: Title and Alerts */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight text-sm md:text-base">{item.productName}</h3>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.productCode}</div>
                                        </div>
                                        {expStatus.status !== 'OK' && (
                                            <div className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${expStatus.color}`}>
                                                <AlertTriangle className="w-3 h-3"/>
                                                {expStatus.status === 'EXPIRED' ? 'VENCIDO' : `${expStatus.days} días`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Details Row: Qty, Date, Loc */}
                                    <div className="grid grid-cols-3 gap-2 items-end">
                                        <div>
                                            <label className="text-[8px] uppercase font-bold text-gray-400 block">Cantidad</label>
                                            <input 
                                                type="number" 
                                                className="w-full border-b border-gray-200 py-0.5 font-bold text-gray-800 focus:border-blue-500 outline-none bg-transparent text-sm"
                                                value={item.quantity}
                                                onChange={(e) => onUpdateItem(item.lpn, { quantity: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[8px] uppercase font-bold text-gray-400 block">Vencimiento</label>
                                            <input 
                                                type="date" 
                                                className={`w-full border-b py-0.5 font-bold outline-none bg-transparent text-xs ${expStatus.status !== 'OK' ? 'text-red-600 border-red-300' : 'text-gray-800 border-gray-200'}`}
                                                value={item.expirationDate}
                                                onChange={(e) => onUpdateItem(item.lpn, { expirationDate: e.target.value })}
                                            />
                                        </div>
                                        <div className="text-right">
                                            <label className="text-[8px] uppercase font-bold text-gray-400 block">Ubicación</label>
                                            <div className="text-xs">
                                                {item.location 
                                                    ? <span className="font-bold text-blue-600">{item.location.aisle}{item.location.rackId}-{item.location.level}-{item.location.position}</span> 
                                                    : <span className="font-bold text-orange-500">PENDIENTE</span>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer: LPN and Actions */}
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-1">
                                        <div className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 rounded">{item.lpn}</div>
                                        
                                        <button 
                                            onClick={() => setPhotoItemLPN(item.lpn)}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border
                                                ${hasPhotos 
                                                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                                                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            <Camera className="w-4 h-4"/>
                                            {hasPhotos ? `Ver Fotos (${photosCount})` : 'Sin Fotos'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </>
        )}

        {/* --- VIEW: STOCKTAKE (BARRIDO) --- */}
        {activeTab === 'COUNT' && (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Progress Cards - Compacted for Mobile */}
                <div className="grid grid-cols-3 gap-2 p-2 md:p-4 bg-white border-b border-gray-200">
                    <button onClick={() => setMissingModalZone('DRY')} className="bg-orange-50 border border-orange-200 rounded p-2 text-center hover:bg-orange-100 transition-colors">
                        <div className="flex justify-center mb-1"><Sun className="w-4 h-4 md:w-5 md:h-5 text-orange-500"/></div>
                        <div className="text-[10px] md:text-xs font-bold text-orange-800 uppercase">Secos</div>
                        <div className="text-base md:text-lg font-black text-orange-900 leading-none">{statsDry.missingCount} <span className="text-[8px] md:text-[10px] font-normal text-orange-600">faltan</span></div>
                    </button>
                    <button onClick={() => setMissingModalZone('COLD')} className="bg-cyan-50 border border-cyan-200 rounded p-2 text-center hover:bg-cyan-100 transition-colors">
                        <div className="flex justify-center mb-1"><Snowflake className="w-4 h-4 md:w-5 md:h-5 text-cyan-500"/></div>
                        <div className="text-[10px] md:text-xs font-bold text-cyan-800 uppercase">Refrig</div>
                        <div className="text-base md:text-lg font-black text-cyan-900 leading-none">{statsCold.missingCount} <span className="text-[8px] md:text-[10px] font-normal text-cyan-600">faltan</span></div>
                    </button>
                    <button onClick={() => setMissingModalZone('FROZEN')} className="bg-blue-50 border border-blue-200 rounded p-2 text-center hover:bg-blue-100 transition-colors">
                        <div className="flex justify-center mb-1"><Snowflake className="w-4 h-4 md:w-5 md:h-5 text-blue-500"/></div>
                        <div className="text-[10px] md:text-xs font-bold text-blue-800 uppercase">Congel</div>
                        <div className="text-base md:text-lg font-black text-blue-900 leading-none">{statsFrozen.missingCount} <span className="text-[8px] md:text-[10px] font-normal text-blue-600">faltan</span></div>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Left: Input Form */}
                    <div className="w-full md:w-2/3 p-2 md:p-6 overflow-y-auto">
                        <div className="max-w-xl mx-auto space-y-3 md:space-y-8 relative">
                            
                            {/* Pending Items Status Badge - Compacted */}
                            <div className="absolute right-0 -top-1 md:top-0 flex items-center gap-1 md:gap-2 bg-orange-100 text-orange-700 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold shadow-sm z-10">
                                <ArrowDownToLine className="w-3 h-3 md:w-4 md:h-4"/>
                                <span>Pendientes: {pendingItemsCount}</span>
                            </div>
                            
                            {/* Export Button inside form view */}
                            <div className="mt-6 flex justify-end md:hidden">
                                <button onClick={handleExportInventory} className="text-green-600 font-bold text-xs flex items-center gap-1 underline">
                                    <FileSpreadsheet className="w-4 h-4"/> Excel
                                </button>
                            </div>

                            {/* 1. Product Select */}
                            <div className="space-y-1 md:space-y-2 mt-4 md:mt-0">
                                <label className="text-xs md:text-sm font-bold text-gray-500 uppercase">Producto</label>
                                {countProduct ? (
                                    <div className="flex items-center justify-between bg-blue-600 text-white p-2 md:p-4 rounded-lg shadow-md">
                                        <div className="min-w-0">
                                            <div className="font-black text-base md:text-lg truncate">{countProduct.name}</div>
                                            <div className="text-xs opacity-75 font-mono">{countProduct.code}</div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setCountProduct(null);
                                                setCountSearch('');
                                                setSuccessMsg(null);
                                            }}
                                            className="text-white hover:bg-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-white/30 ml-2"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Buscar producto..."
                                            className="w-full p-2 md:p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none text-base md:text-lg"
                                            value={countSearch}
                                            onChange={e => setCountSearch(e.target.value)}
                                        />
                                        {countSearch.length > 0 && (
                                            <div className="absolute w-full bg-white shadow-xl border rounded-lg mt-1 max-h-60 overflow-y-auto z-10">
                                                {filteredCatalog.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setCountProduct(p);
                                                            setCountSearch('');
                                                        }}
                                                        className="w-full text-left p-3 hover:bg-gray-100 border-b last:border-0"
                                                    >
                                                        <div className="font-bold text-sm md:text-base">{p.name}</div>
                                                        <div className="text-xs text-gray-500">{p.code}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Form Inputs */}
                            <form onSubmit={handleStocktakeSubmit} className={`space-y-3 md:space-y-6 transition-all ${countProduct ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                <div className="grid grid-cols-2 gap-3 md:gap-6">
                                    <div>
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase mb-1 md:mb-2">Cantidad</label>
                                        <input 
                                            required
                                            type="number" 
                                            min="1"
                                            className="w-full p-2 md:p-4 border border-gray-300 rounded-lg text-xl md:text-2xl font-bold text-center outline-none focus:border-blue-500"
                                            value={countQty}
                                            onChange={e => setCountQty(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] md:text-xs font-bold text-gray-500 uppercase mb-1 md:mb-2">Vencimiento</label>
                                        <input 
                                            required
                                            type="date"
                                            className={`w-full p-2 md:p-4 border rounded-lg font-medium outline-none text-sm md:text-base ${expiryWarning ? 'border-red-500 focus:border-red-500 ring-2 ring-red-100' : 'border-gray-300 focus:border-blue-500'}`}
                                            value={countDate}
                                            onChange={e => setCountDate(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {expiryWarning && (
                                    <div className="bg-red-100 border-2 border-red-500 text-red-900 p-3 md:p-4 rounded-lg text-xs md:text-sm shadow-md flex items-center gap-3">
                                        <AlertTriangle className="w-8 h-8 text-red-600 animate-bounce shrink-0" />
                                        <div>
                                            <p className="font-black uppercase">Alerta de Caducidad</p>
                                            <p className="font-medium">{expiryWarning}</p>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 md:py-4 rounded-xl shadow-lg transform active:scale-95 transition-all flex justify-center items-center gap-2"
                                >
                                    <PlusCircle className="w-5 h-5 md:w-6 md:h-6"/>
                                    Registrar Entrada
                                </button>
                                
                                {successMsg && (
                                    <div className="text-center text-green-600 font-bold bg-green-50 p-2 md:p-3 rounded-lg border border-green-200 animate-fade-in flex items-center justify-center gap-2 text-sm md:text-base">
                                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                        {successMsg}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Right: Session History */}
                    <div className="w-full md:w-1/3 bg-slate-100 border-l border-gray-200 p-4 overflow-y-auto hidden md:block">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-gray-600 flex items-center gap-2">
                                <History className="w-5 h-5"/>
                                Historial Sesión
                            </h4>
                            <button onClick={handleExportInventory} className="hidden md:flex text-green-600 hover:text-green-800" title="Descargar Excel">
                                <FileSpreadsheet className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="space-y-3">
                            {sessionHistory.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center italic mt-10">Aún no se han registrado items.</p>
                            ) : (
                                sessionHistory.map((item, idx) => (
                                    <div key={idx} className="bg-white p-3 rounded shadow-sm border-l-4 border-green-500 animate-fade-in">
                                        <div className="font-bold text-gray-800 text-sm">{item.productName}</div>
                                        <div className="flex justify-between mt-1 text-xs text-gray-600">
                                            <span className="font-mono bg-gray-100 px-1 rounded">{item.lpn}</span>
                                            <span className="font-bold">x{item.quantity}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Vence: {item.expirationDate}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Mobile History (Last Item Only) */}
                    {sessionHistory.length > 0 && (
                        <div className="md:hidden p-2 bg-slate-100 border-t border-gray-200">
                             <div className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1"><History className="w-3 h-3"/> Último Registrado:</div>
                             <div className="bg-white p-2 rounded border-l-4 border-green-500 shadow-sm flex justify-between items-center">
                                <div className="truncate flex-1 pr-2">
                                    <div className="font-bold text-gray-800 text-xs truncate">{sessionHistory[0].productName}</div>
                                    <div className="text-[10px] text-gray-500">Vence: {sessionHistory[0].expirationDate}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-sm">x{sessionHistory[0].quantity}</div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* --- MODAL: MISSING ITEMS --- */}
                {missingModalZone && (
                    <div className="fixed inset-0 z-50 bg-black/60 flex justify-center items-center p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-gray-800">
                                    Faltantes: {missingModalZone === 'DRY' ? 'Secos' : missingModalZone === 'COLD' ? 'Refrigerados' : 'Congelados'}
                                </h3>
                                <button onClick={() => setMissingModalZone(null)} className="text-gray-400 hover:text-gray-600">
                                    <XCircle className="w-6 h-6"/>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {missingModalZone === 'DRY' && statsDry.missingItems.length === 0 && <p className="text-green-600 text-center font-bold">¡Todo contado!</p>}
                                {missingModalZone === 'COLD' && statsCold.missingItems.length === 0 && <p className="text-green-600 text-center font-bold">¡Todo contado!</p>}
                                {missingModalZone === 'FROZEN' && statsFrozen.missingItems.length === 0 && <p className="text-green-600 text-center font-bold">¡Todo contado!</p>}

                                {(missingModalZone === 'DRY' ? statsDry.missingItems : missingModalZone === 'COLD' ? statsCold.missingItems : statsFrozen.missingItems).map(p => (
                                    <div key={p.id} className="p-3 border rounded hover:bg-gray-50 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{p.name}</div>
                                            <div className="text-xs text-gray-400">{p.code}</div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setCountProduct(p);
                                                setMissingModalZone(null);
                                            }}
                                            className="text-blue-600 text-xs font-bold hover:underline"
                                        >
                                            Contar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- MODAL: PHOTO GALLERY --- */}
        {photoModalItem && (
            <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex justify-center items-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="font-bold text-gray-800">Fotos del Producto</h3>
                            <p className="text-xs text-gray-500">{photoModalItem.productName}</p>
                        </div>
                        <button onClick={() => setPhotoItemLPN(null)} className="text-gray-500 hover:text-red-500">
                            <XCircle className="w-6 h-6"/>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 gap-3">
                            {/* Display existing photos */}
                            {(photoModalItem.photos || (photoModalItem.photoUrl ? [photoModalItem.photoUrl] : [])).map((photo, idx) => (
                                <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                                    <img src={photo} alt={`Evidencia ${idx}`} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            onClick={() => handleDeletePhoto(photoModalItem.lpn, idx)}
                                            className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                                            title="Eliminar Foto"
                                        >
                                            <Trash className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Add Photo Button (if < 5) */}
                            {((photoModalItem.photos?.length || 0) + (photoModalItem.photoUrl && !photoModalItem.photos ? 1 : 0)) < 5 && (
                                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg aspect-square cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors">
                                    <Camera className="w-8 h-8 text-gray-400 mb-2"/>
                                    <span className="text-xs font-bold text-gray-500">Agregar Foto</span>
                                    <span className="text-[10px] text-gray-400">Cámara o Galería</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment"
                                        className="hidden" 
                                        onChange={(e) => handleAddPhoto(photoModalItem.lpn, e)}
                                    />
                                </label>
                            )}
                        </div>
                        
                        {((photoModalItem.photos?.length || 0) === 0 && !photoModalItem.photoUrl) && (
                            <p className="text-center text-gray-400 text-sm mt-4 italic">No hay fotos registradas.</p>
                        )}
                    </div>

                    <div className="p-4 border-t bg-gray-50 text-center">
                        <button 
                            onClick={() => setPhotoItemLPN(null)}
                            className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold w-full md:w-auto"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default InventoryList;